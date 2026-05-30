# Codex Subagent Model Routing 技术调研方案 v01

> 历史快照：本文件基于 sidecar `a4896197` 调研。主分支同步到 `232f573` 后，CLIProxyAPI gitlink 已更新到 `c6f35c108cfd8b0060d27e8c63797609e3035c0f`，旧公共 `RoutePolicy` / `X-GetTokens-Route-*` 入口已删除。最新修改范围以 `technical-research-v02.md` 为准。

## 调研结论

方案高可行，但需要把实现边界放在 sidecar 热路径，而不是 GetTokens Wails / 前端补偿。

在 Codex 已把 subagent 使用的目标模型写入 `/v1/responses` body `model` 的前提下，当前 sidecar 已具备按模型能力筛账号的主体基础：模型注册按 auth 维度维护，scheduler 按 provider/model shard 选候选，disabled、cooldown、excluded models 和 openai-compatible alias 已经参与候选过滤。本期缺口不是“能不能按模型选账号”，而是缺一个 Codex subagent 请求上下文：解析 `X-OpenAI-Subagent`、关联 `Session_id` / `X-Codex-Turn-Metadata`，并把 route explain、live sessions、usage attribution 标到 subagent source 上。

本期仍只处理 `X-OpenAI-Subagent` 场景。`Session_id`、`X-Client-Request-Id`、`X-Codex-Turn-Metadata` 只做观测与归因关联，不替代 subagent 判定。

## 源码基线

### Codex

本地源码：`/Users/linhey/.nolon/references/github.com/openai@codex`，HEAD `e6773f8`。

关键事实：

1. `codex-rs/core/src/client.rs` 的 `build_subagent_headers()` 会在 `SessionSource::SubAgent` 时写入 `x-openai-subagent`。
2. header 值映射为 `review`、`compact`、`memory_consolidation`、`collab_spawn` 或 `Other(label)` 的 label。
3. `SubAgentSource::ThreadSpawn` 内部有 `agent_role`，但当前 HTTP header 只输出 `collab_spawn`，因此本期不做 role 级路由。

### Sidecar Fork

维护 fork：`/Users/linhey/.prowl/repos/GetTokens/账号与凭证统一存储方案/docs-linhay/references/CLIProxyAPI`，分支 `gettokens/sidecar`，HEAD `a4896197 feat: add sidecar sqlite account store`。当前 GetTokens 仓库 gitlink 也指向该 commit。

关键入口：

1. `internal/api/server.go`
   - `POST /v1/responses` -> `OpenAIResponsesAPIHandler.Responses`
   - `POST /backend-api/codex/responses` -> 同一 handler
   - `GET /v1/responses` 与 `/backend-api/codex/responses` 是 Codex Responses WebSocket 入口
2. `sdk/api/handlers/openai/openai_responses_handlers.go`
   - `Responses()` 读取 request body。
   - `handleNonStreamingResponse()` / `handleStreamingResponse()` 都从 body `model` 取 `modelName`，再进入 `ExecuteWithAuthManager` / `ExecuteStreamWithAuthManager`。
3. `sdk/api/handlers/handlers.go`
   - `GetContextWithCancel()` 把 gin context 放入 context。
   - `headersFromContext()` 会 clone 原始 HTTP headers 到 `executor.Options.Headers`。
   - `requestExecutionMetadata()` 已经集中生成 `executor.Options.Metadata`，可扩展 subagent / turn metadata。
   - `getRequestDetailsWithOptions()` 先解析 model，再用 `util.GetProviderName(baseModel)` 找 provider。
4. `internal/util/provider.go`
   - `GetProviderName()` 优先从全局 model registry 反查支持该 model 的 provider。
5. `sdk/cliproxy/service.go`
   - `registerModelsForAuth()` 以 auth 为单位注册可用模型。
   - Codex 账号按 plan 或 config models 注册模型。
   - openai-compatible 使用 `models[].alias || models[].name` 作为对 Codex 暴露的 model id。
   - `excluded_models` 会在模型注册前过滤。
6. `sdk/cliproxy/auth/scheduler.go`
   - scheduler 按 provider/model shard 维护 ready 候选。
   - `supportedModelSetForAuth()` 从 registry 快照出每个 auth 支持的模型。
   - 不支持目标 model 的 auth 不会进入该 model shard。
7. `sdk/cliproxy/auth/route_policy.go`
   - `RoutePolicy` 收到的是已经通过 disabled、cooldown、model checks 的候选。
   - 因此 subagent 模型能力过滤不应只放在 RoutePolicy；RoutePolicy 适合做请求级重排、deny、explain 和兼容入口。
8. `sdk/cliproxy/usage/manager.go`
   - usage record 已有 `Provider`、`Model`、`Alias`、`AuthID`、`AccountKey`、`ReasoningEffort`、`ServiceTier`。
   - 需要新增或扩展上下文读取，才能记录 `subagent_source`、`turn_id`、`thread_id`、`thread_source`、`client_request_id`。

## 入站请求上下文

建议新增一个 sidecar 内部结构，例如 `CodexRequestContext`：

```go
type CodexRequestContext struct {
    IsSubagent bool
    SubagentSource string
    RequestedModel string
    SessionID string
    ClientRequestID string
    ThreadID string
    ThreadSource string
    TurnID string
    TurnStartedAtUnixMs int64
}
```

解析规则：

1. `SubagentSource` 只来自 HTTP header `X-OpenAI-Subagent`，大小写按 HTTP header 规范处理，值 trim 后非空才视为 subagent。
2. `RequestedModel` 来自请求 body `model`。body 可能是 zstd 编码，必须复用现有 `handlers.ReadRequestBody()` 后的 decoded bytes。
3. `SessionID` 优先取独立 header `Session_id`，缺失时再取 `X-Codex-Turn-Metadata.session_id`。
4. `ClientRequestID` 取 `X-Client-Request-Id`。
5. `ThreadID`、`ThreadSource`、`TurnID`、`TurnStartedAtUnixMs` 从 `X-Codex-Turn-Metadata` JSON 解析。
6. JSON 解析失败不能影响主请求执行，只记录 bounded diagnostic reason。
7. 不解析、不保存 Authorization、API key、cookies、raw body、prompt、workspace 绝对路径全文。

建议把该结构写入 `executor.Options.Metadata`，不要新增全局变量。这样 handler、auth manager、usage plugin、live tracker 都能从同一 request context 读取。

## 路由决策

### P0 决策路径

1. `/v1/responses` handler 读取 body 后解析 `CodexRequestContext`。
2. 如果 `X-OpenAI-Subagent` 不存在或为空，不启用 subagent request context，只走现有 Codex 路由。
3. 如果 `X-OpenAI-Subagent` 存在：
   - `RequestedModel` 继续作为真实路由模型进入 `getRequestDetailsWithOptions()`。
   - model registry / scheduler 继续负责模型支持过滤。
   - route policy 只消费 `subagentSource` 做观测、explain 或后续可选重排。
4. 命中账号后保留两类模型：
   - requested model：Codex body 中的模型，也就是用户/配置希望 subagent 使用的模型。
   - upstream model：OAuth alias、API key alias 或 openai-compatible alias 解析后的实际上游模型。

当前 sidecar 已有大部分模型链路：

1. OAuth/auth-file 默认同名透传；显式 OAuth alias 才转换。
2. API key 模型 alias 通过 config models 编译成 alias -> upstream name。
3. openai-compatible 支持多个真实模型映射到同一个 Codex alias，并会在执行时轮换上游真实模型池。
4. excluded models 在模型注册时被剔除，因此不会进入可用模型列表和 scheduler shard。

### 不建议的路径

1. 不建议把 subagent 特判写成新的 route mode。Codex runtime routing 主路径仍保持 `sequential / balanced`。
2. 不建议用旧 `X-GetTokens-Route-*` probe header 承载正式配置。
3. 不建议只在 RoutePolicy 内做模型能力过滤，因为 RoutePolicy 看不到已经被 model shard 排除掉的账号。
4. 不建议用 `thread_source=user`、`Session_id` 或 `turn_id` 推断 subagent。

## Explain 与错误原因

当前 scheduler 天然会过滤不支持目标 model 的 auth，但 explain 需要补齐“为什么没进候选”的可诊断原因。建议 route explain / dry-run 增加以下原因：

1. `model-unsupported`：账号 registry 中没有目标 requested model。
2. `model-alias-miss`：请求 model 是 alias，但该账号没有对应 upstream name。
3. `model-excluded`：账号或全局配置显式排除了该模型。
4. `account-disabled`：用户手动禁用。
5. `rate-limited` / `cooldown`：账号或模型处于冷却。
6. `provider-unavailable`：provider executor 或 auth 不可用。

对 subagent 请求，explain 顶层应显示 `requestKind=subagent`、`subagentSource=<value>`、`requestedModel=<body.model>`。普通请求不展示 subagent 字段。

## Live Sessions 与 Usage Attribution

建议最小新增字段：

1. live session request:
   - `subagentSource`
   - `sessionID`
   - `clientRequestID`
   - `threadID`
   - `threadSource`
   - `turnID`
   - `turnStartedAtUnixMs`
   - `requestedModel`
   - `upstreamModel`
2. usage ledger:
   - `subagent_source`
   - `session_id`
   - `client_request_id`
   - `thread_id`
   - `thread_source`
   - `turn_id`
   - `requested_model`
   - `upstream_model`
   - `auth_id`
   - `account_key`

脱敏要求：

1. 不记录 Authorization、Cookie、API key、raw body、prompt、tool input、message content。
2. `X-Codex-Turn-Metadata.workspaces` 默认不入 ledger；如后续确需 projectName，只保存经过信任边界提取的 display label 或 repo basename。
3. 错误 body 必须 bounded + redacted。

## 实现切片

### P0：请求上下文与现有模型路由闭环

目标：证明 `X-OpenAI-Subagent + body.model` 可以让 sidecar 在热路径选择支持账号。

建议改动：

1. 在 sidecar handler 层新增纯函数 `ExtractCodexRequestContext(headers, decodedBody)`。
2. 在 `requestExecutionMetadata()` 或 handler 调用处把上下文写入 `executor.Options.Metadata`。
3. 给 usage context / selected auth callback 增加 requested/upstream model 关联。
4. route explain 增加 subagent 顶层字段和 model 过滤原因。
5. 添加 fixture 覆盖主 agent、`review`、`compact`、`memory_consolidation`、`collab_spawn`、`Other(label)`。

验收：

1. 无 `X-OpenAI-Subagent` 的主 agent 请求不出现 subagent context。
2. 有 `X-OpenAI-Subagent: collab_spawn` 的请求标记为 subagent。
3. 请求 model 只命中支持该 model 的账号。
4. openai-compatible alias 命中时，usage 同时保留 requested model 和 upstream model。
5. 未知 model 或 alias miss 返回可诊断错误，不泄露敏感请求内容。

### P1：观测闭环

目标：live sessions、usage ledger、route explain 能按 subagent source 查询和解释。

建议改动：

1. sidecar live tracker request DTO 增加 subagent/turn/session 字段。
2. usage queue / disk ledger 增加对应字段。
3. GetTokens Wails DTO 与前端只做透传和展示，不重算。
4. 管理端筛选增加 `subagentSource`。

验收：

1. live sessions 能区分主 agent 与 subagent 请求。
2. usage rows 能按 `subagent_source` 聚合。
3. 同一个 `session_id` / `turn_id` 的请求能被串起来。

### P2：配置表达与策略扩展

目标：如果后续需要在 GetTokens UI 配置“subagent 专用候选范围”，再引入配置模型。

建议边界：

1. 不新增 route mode，仍复用 `sequential / balanced`。
2. 配置只表达 scope 或 allow/deny/order，不表达 role 级路由。
3. role 级路由必须等 Codex upstream 透出 role，另开需求。

## 测试建议

Sidecar 聚焦测试：

1. `go test ./sdk/api/handlers/openai -run 'TestOpenAIResponses.*Subagent|TestExtractCodexRequestContext'`
2. `go test ./sdk/cliproxy/auth -run 'TestManagerExecute.*Model|TestRoutePolicy.*Subagent|Test.*OpenAICompat.*Alias'`
3. `go test ./internal/api/handlers/management -run 'Test.*Usage|Test.*Live'`

GetTokens 侧如果只改文档不需要业务测试；进入实现后，涉及 Wails DTO 或前端展示时再跑：

1. `go test ./internal/wailsapp`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run test:unit`

## 风险与待确认

1. 需要端到端确认真实 subagent 请求经过 GetTokens relay 后，`X-OpenAI-Subagent` 未被中间层剥离。
2. 如果 Codex 没有把特殊模型写入 body `model`，sidecar 不能凭 header 自行推断目标模型；那会变成“sidecar 按 subagent source override model”的新需求。
3. 当前 `RoutePolicy` 看不到 model shard 之前被排除的账号，完整 explain 需要额外构造候选诊断视图。
4. `X-Codex-Turn-Metadata` 体积和字段可能继续变化，解析必须 allowlist + 容错。
5. Codex Responses WebSocket 路径也走 `/v1/responses`，实现时要覆盖 HTTP streaming 和 WebSocket 两条路径。

## 推荐下一步

1. 先做 P0 纯函数与 sidecar 单元测试，不动 UI。
2. 用一条真实 subagent 请求脱敏抓包验证 header 到达 sidecar。
3. 再接 usage / live sessions 字段，保证可观测后再考虑配置 UI。
