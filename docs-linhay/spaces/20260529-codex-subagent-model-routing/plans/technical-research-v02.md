# Codex Subagent Model Routing 技术调研方案 v02

## 本轮校准结论

已从本地 `master` 同步到 `232f573 chore: normalize wails generated bindings`。当前 GetTokens 主仓 gitlink 指向 CLIProxyAPI `c6f35c108cfd8b0060d27e8c63797609e3035c0f`。

最新结论：方案仍可行，但 v01 中“接旧 `RoutePolicy` / `X-GetTokens-Route-*` debug header”的表述必须废弃。主路径应接入 sidecar 内部 `internal/gettokensrouting`，并补齐 Codex HTTP / WebSocket 两条链路对 `X-OpenAI-Subagent` 的解析、透传和观测字段。

2026-05-30 追加校准：按 OpenAI Codex 最新源码 `3e7baa00e43419967d90d6ad9cef40f58d5ac89f` 复查后，`X-OpenAI-Subagent` 不是唯一需要透传的 Codex client context header。路由判定仍只消费 `X-OpenAI-Subagent`，但 sidecar 上游请求透传必须按 Codex latest 的 Responses client context allowlist 同步，避免 installation / window / parent thread / attestation / v2 session headers 在 sidecar 边界丢失。

本期仍只处理 `X-OpenAI-Subagent` 场景：

1. 不用 `Session_id`、`X-Client-Request-Id`、`X-Codex-Turn-Metadata.thread_source` 推断 subagent。
2. 不做 `agent_role` / `agent_type` 路由。
3. 不新增 Codex header，不要求 Codex 侧扩展协议。
4. 不恢复 `X-GetTokens-Route-*` 或旧请求级 allow / deny / order / fallback 注入面。
5. header 透传允许比 subagent 路由判定更宽，但只限 Codex latest 已定义的 client context / observability headers；`Authorization` 继续由 sidecar 重写，不能直接转发入站值。

## 源码基线

### GetTokens

- 当前工作区：`/Users/linhey/.prowl/repos/GetTokens/模型分流`
- 当前分支：`模型分流`
- 同步点：`232f573 chore: normalize wails generated bindings`
- sidecar gitlink：`docs-linhay/references/CLIProxyAPI -> c6f35c108cfd8b0060d27e8c63797609e3035c0f`

### CLIProxyAPI sidecar

- 可直接读取的本地 checkout：`/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI`
- HEAD：`c6f35c108cfd8b0060d27e8c63797609e3035c0f`
- 说明：当前工作区内的 gitlink 目录未 checkout；另一个本地 checkout 可解析该 commit。`/Users/linhey/.prowl/repos/GetTokens/账号与凭证统一存储方案/docs-linhay/references/CLIProxyAPI` fetch 后仍拿不到 `c6f35c...` 对象，因此本轮源码依据以上 open-sources checkout。

## 最新 sidecar 事实

### 1. 旧 RoutePolicy 和 X-GetTokens-Route 已删除

源码扫描结果：

1. `RoutePolicy`、`RegisterRoutePolicy`、`X-GetTokens-Route-*` 在 `c6f35c...` 工作树中无生产实现命中。
2. 当前路由 registry 是 `internal/gettokensrouting.RegisterPolicy()`。
3. `internal/gettokenshooks/routing_policy.go` 注册两个 GetTokens policy：
   - `channelRoutingPolicy()`，stage 是 `PolicyStagePoolScope`
   - `accountRouteGuardRoutingPolicy(nil)`，stage 是 `PolicyStageHardFilter`
4. `sdk/cliproxy/auth/routing_policy.go` 在 scheduler / auth manager 侧调用 `gettokensrouting.PolicySnapshot()`，再用 `gettokensrouting.NewEngine(...).Route(...)` 改写候选。

关键文件：

- `internal/gettokensrouting/engine.go`
- `internal/gettokenshooks/routing_policy.go`
- `internal/gettokenshooks/channel_routing_policy.go`
- `sdk/cliproxy/auth/routing_policy.go`
- `sdk/cliproxy/auth/scheduler.go`

### 2. RouteContext 目前没有 subagent 字段，但能读到请求 headers

`internal/gettokensrouting.RouteContext` 当前字段是：

- `Provider`
- `Providers`
- `Model`
- `Options`
- `Candidates`
- `Tried`
- `Now`

`executor.Options` 已包含 `Headers`、`OriginalRequest`、`Metadata`。`sdk/api/handlers/handlers.go` 的 `headersFromContext()` 会把 gin 原始 HTTP headers clone 到 `Options.Headers`，因此 routing policy 理论上已经能从 `req.Options.Headers.Get("X-OpenAI-Subagent")` 读取入站 header。

但这还不是完整方案，因为：

1. 没有规范化 `CodexRequestContext`，live sessions / usage attribution / route explain 会各自重复解析。
2. `requestExecutionMetadata()` 目前只写入 request path、pinned auth、execution session、requested model、reasoning effort、service tier 等字段，没有 subagent / turn metadata。
3. `RouteContext.Trace` 可以记录 policy activated 与 reason，但当前 channel routing policy 不输出 subagent 维度。

### 3. Codex HTTP header 透传当前缺 Codex latest client context

`internal/runtime/executor/codex_executor.go` 的 `applyCodexHeaders()` 当前会透传或设置：

- `X-Codex-Beta-Features`
- `Version`
- `X-Codex-Turn-Metadata`
- `X-Client-Request-Id`
- `Session_id`
- `User-Agent`
- `Originator`
- `Chatgpt-Account-Id`

但对照 Codex latest `codex-rs/core/src/client.rs`，HTTP Responses 还可能携带以下 client context：

- `x-codex-installation-id`
- `x-codex-turn-state`
- `x-codex-parent-thread-id`
- `x-codex-window-id`
- `x-openai-subagent`
- `x-openai-memgen-request`
- `x-oai-attestation`
- `session-id`
- `thread-id`

也就是说，sidecar 虽然可以从入站 headers 读到 subagent 信号和部分 turn metadata，但当前不会完整把 Codex latest client context 继续带到上游请求。

P0 需要建立单一 allowlist 透传：HTTP 与 WebSocket 都复用同一组 Codex Responses client context headers，`X-OpenAI-Subagent` 只是其中一个字段。

### 4. Codex WebSocket 也要覆盖

`sdk/api/handlers/openai/openai_responses_websocket.go` 的 `ResponsesWebsocket()` 是 `/v1/responses/ws` 下游入口。它在每个 downstream message 上：

1. 生成 `passthroughSessionID`
2. 用 `RecordDownstreamWebsocketRequest()` 记录下游请求
3. 调 `ExecuteStreamWithAuthManager()` 进入 auth manager
4. 通过 `handlers.WithExecutionSessionID()`、`WithPinnedAuthID()`、`WithSelectedAuthIDCallback()` 维持长会话和 pinned auth

`internal/runtime/executor/codex_websockets_executor.go` 的 `applyCodexWebsocketHeaders()` 当前会处理：

- `x-codex-beta-features`
- `x-codex-turn-state`
- `x-codex-turn-metadata`
- `x-client-request-id`
- `x-responsesapi-include-timing-metrics`
- `Version`
- `User-Agent`
- `session_id`
- `Originator`
- `ChatGPT-Account-ID`

对照 Codex latest，WebSocket handshake 还会复用 Responses identity headers，并额外设置 `OpenAI-Beta: responses_websockets=2026-02-06` 与 timing metrics。当前 sidecar 已处理 `OpenAI-Beta` 和 timing metrics，但仍缺 installation id、parent thread、window id、subagent、memgen、attestation、`session-id`、`thread-id` 这一组统一 client context。如果本期只改 HTTP `/v1/responses`，Codex WebSocket 请求会漏掉 subagent 上下文、live session 归因和上游 header 透传。

### 5. live sessions 已有 session/request 框架，但缺 subagent / turn 字段

`internal/gettokenshooks/live_sessions.go` 当前：

- `CodexLiveSessionIdentity` 只有 `ConversationID`、`ClientRequestID`、`PromptCacheKey`、`CodexWindowID`
- `ExtractCodexLiveSessionIdentity()` 读取 header `x-client-request-id`、`x-codex-window-id`、`session_id`，并从 payload 读取 `prompt_cache_key` / client metadata
- 不解析 `X-Codex-Turn-Metadata`
- 不保存 `subagentSource`、`threadID`、`threadSource`、`turnID`、`turnStartedAtUnixMs`

本期如果要让 live sessions 能区分主 agent / subagent，需要在 sidecar live tracker DTO 和 history store 加字段；GetTokens Wails / frontend 只做透传展示。

### 6. usage attribution 已有 requested/routed model，但缺 subagent / turn 字段

`internal/gettokenshooks/usage_attribution.go` 当前 schema 和 DTO 已有：

- `requested_model`
- `routed_model`
- `provider`
- `account_key`
- `auth_id`
- `auth_index`
- token 与 latency 字段

但没有：

- `subagent_source`
- `session_id`
- `client_request_id`
- `thread_id`
- `thread_source`
- `turn_id`
- `turn_started_at_unix_ms`

P1 需要扩展 SQLite schema、insert、summary/details API 和 management 查询参数。P0 可以先只在内存 metadata / live tracker 中打通，不急着迁移 usage schema。

### 7. 模型能力过滤仍由 registry / scheduler 负责

`sdk/cliproxy/auth/scheduler.go` 当前仍按 auth 支持模型过滤 ready candidates。`internal/registry/model_registry.go` 提供 `ClientSupportsModel()` 与 available models 快照。

因此模型能力过滤不要写成“subagent policy 单独筛模型”。正确边界是：

1. body `model` 继续进入 `getRequestDetailsWithOptions()`。
2. auth registry / scheduler 继续按 provider/model shard 过滤候选。
3. subagent context 只用于：
   - subagent 专属观测
   - route explain 展示
   - 后续可选的 subagent scope/order policy
   - usage/live sessions 归因

## 修改范围判断

### P0：请求上下文与 header 透传

目标：sidecar 能可靠识别 `X-OpenAI-Subagent` 请求，并在 HTTP / WebSocket 两条 Codex Responses 链路保留 Codex latest client context。

建议修改：

1. 新增纯函数，例如 `ExtractCodexRequestContext(headers http.Header, body []byte)`。
   - `SubagentSource` 只来自 `X-OpenAI-Subagent`
   - `RequestedModel` 来自 body `model`
   - `SessionID` 优先独立 `Session_id`，缺失再读 `X-Codex-Turn-Metadata.session_id`
   - `ClientRequestID` 来自 `X-Client-Request-Id`
   - `ThreadID` / `ThreadSource` / `TurnID` / `TurnStartedAtUnixMs` 来自 `X-Codex-Turn-Metadata`
   - `workspaces` 不入库，最多后续提取受信任 project label
2. 在 `sdk/api/handlers/handlers.go` 的 execution metadata 构造链路写入规范化 context。
3. 在 `internal/runtime/executor/codex_executor.go` 建立统一 `codexResponsesClientContextHeaders` allowlist，并由 `applyCodexHeaders()` 复用。
4. 在 `internal/runtime/executor/codex_websockets_executor.go::applyCodexWebsocketHeaders()` 复用同一 allowlist；WebSocket 独有的 `OpenAI-Beta` 与 `x-responsesapi-include-timing-metrics` 继续保留现有专门逻辑。
5. 增加 focused tests：
   - 无 header 的主请求不产生 subagent context
   - `X-OpenAI-Subagent: review`
   - `compact`
   - `memory_consolidation`
   - `collab_spawn`
   - unknown label
   - `X-Codex-Turn-Metadata.session_id` fallback
   - metadata JSON 解析失败不影响主请求
   - latest client context headers 在 HTTP / WebSocket 上游请求中保留

验收：

1. HTTP `/v1/responses` 和 WebSocket `/v1/responses/ws` 都能读到并透传 Codex latest client context headers，其中 `X-OpenAI-Subagent` 用于 subagent 判定。
2. 主 agent 请求不出现 subagent 字段。
3. 路由模型仍以 body `model` 为准。
4. 不泄露 Authorization、Cookie、API key、prompt、tool input、raw body。

### P1：route explain / live sessions / usage attribution

目标：把 subagent source 变成可诊断、可聚合的运行态事实，而不是只在请求中临时存在。

建议修改：

1. `internal/gettokensrouting.RouteContext` 不一定必须新增字段；可继续从 `Options.Metadata` 读取规范化 context。但 route explain DTO 应显示：
   - `requestKind=main|subagent`
   - `subagentSource`
   - `requestedModel`
   - `sessionID`
   - `threadID`
   - `turnID`
2. `internal/gettokenshooks/live_sessions.go` 扩展 identity / request DTO：
   - `subagentSource`
   - `sessionID`
   - `clientRequestID`
   - `threadID`
   - `threadSource`
   - `turnID`
   - `turnStartedAtUnixMs`
3. `internal/gettokenshooks/live_session_history.go` 扩展 disk history schema 和 query filter。
4. `internal/gettokenshooks/usage_attribution.go` 扩展 schema / insert / summary / details：
   - `subagent_source`
   - `session_id`
   - `client_request_id`
   - `thread_id`
   - `thread_source`
   - `turn_id`
   - `turn_started_at_unix_ms`
5. management API 增加按 `subagent_source` / `session_id` / `turn_id` 查询的 filter。
6. GetTokens Wails / frontend 只透传 sidecar 字段，不在前端重算。

验收：

1. live sessions 能区分主 agent 和 `review/compact/memory_consolidation/collab_spawn/Other(label)`。
2. usage rows 能按 `subagent_source` 聚合。
3. 同一个 `session_id` / `turn_id` 的 HTTP 与 WebSocket 请求能串联。
4. route explain 能说明请求是主 agent 还是 subagent，以及最终候选为什么命中/被过滤。

### P2：subagent 专属候选范围

目标：只有当用户后续要求“某类 subagent 使用特定账号组/账号顺序”时才进入。

边界：

1. 不新增 route mode，仍使用 `sequential / balanced`。
2. 不恢复旧 `X-GetTokens-Route-*`。
3. 不做 role 级路由；`ThreadSpawn` 只识别为 `collab_spawn`。
4. 可在 `channel-routing/config.json` 增加 Codex channel 下的 subagent scope，例如按 `subagentSource + model` 限定 account group。
5. 该 scope 应实现为 `internal/gettokensrouting` policy 或 channel-routing config 的子配置，而不是前端临时筛选。

## 推荐实现顺序

1. 先补 P0 纯函数和 header 透传测试。
2. 再补 WebSocket 路径测试，避免只覆盖 HTTP streaming。
3. 然后接 live sessions 内存 DTO。
4. 最后接 usage attribution SQLite schema 和 management filter。
5. UI 只在 sidecar 字段稳定后做展示，不参与热路径判断。

## 测试建议

Sidecar：

1. `go test ./sdk/api/handlers/openai -run 'Test.*Subagent|Test.*ResponsesWebsocket.*Subagent' -count=1`
2. `go test ./internal/runtime/executor -run 'Test.*Codex.*Subagent|Test.*Websocket.*Subagent' -count=1`
3. `go test ./internal/gettokenshooks -run 'Test.*Live.*Subagent|Test.*Usage.*Subagent' -count=1`
4. `go test ./sdk/cliproxy/auth -run 'Test.*Routing.*|Test.*Scheduler.*Model' -count=1`

GetTokens：

1. 纯调研文档阶段不需要业务测试。
2. 若后续接 Wails DTO：`go test ./internal/wailsapp -count=1`
3. 若后续接前端展示：`npm --prefix frontend run typecheck` 与相关 unit test。

## 风险

1. 当前 sidecar `applyCodexHeaders()` / `applyCodexWebsocketHeaders()` 没有完整透传 Codex latest client context，如果 OpenAI 上游依赖 `X-OpenAI-Subagent`、window、parent thread、attestation 或 v2 session headers，现状会丢失语义。
2. 如果 Codex 后续改变 `X-Codex-Turn-Metadata` schema，解析必须 allowlist + 容错，不能影响主请求。
3. 完整 explain 若要展示“模型不支持”的全部过滤原因，需要额外构造 model registry 诊断视图；当前 `internal/gettokensrouting` 只能看到进入候选集后的账号。
4. WebSocket pinned auth 已有释放逻辑，subagent scope 若后续参与候选范围，必须遵守“只在请求边界切换，不做 mid-response migration”。
5. `workspaces` 字段可能包含绝对路径和 remote URL，不应默认进入 usage/live history。

## 风险解决方案

### 风险 1：Codex latest client context 在 sidecar 内或上游请求中丢失

解决方案：

1. 建立单一 allowlist：HTTP 与 WebSocket 共同透传 Codex latest Responses client context，包括 `Version`、`x-codex-installation-id`、`x-codex-turn-state`、`x-codex-turn-metadata`、`x-client-request-id`、`x-codex-parent-thread-id`、`x-codex-window-id`、`x-openai-subagent`、`x-openai-memgen-request`、`x-oai-attestation`、`session-id`、`thread-id`。
2. 在 `ExtractCodexRequestContext()` 中只读取入站 headers，不从 body、turn metadata、session id 推断。
3. 在 `applyCodexHeaders()` 和 `applyCodexWebsocketHeaders()` 各补一个 focused test，断言入站 client context headers 会进入上游 request headers。
4. 增加反向测试：无 header 时不上报 subagent context，也不写空 client context。
5. 不采用“全量复制所有入站 HTTP headers”：`Authorization`、`Cookie`、`Host`、`Content-Length`、压缩协商和浏览器 fetch headers 仍按 sidecar 现有规则处理，避免把认证与传输边界打穿。

验收信号：

1. HTTP `/v1/responses` upstream request 中保留 Codex latest client context；`X-OpenAI-Subagent: review|compact|memory_consolidation|collab_spawn|<label>` 可被单独断言。
2. WebSocket upstream handshake headers 中保留同一组 client context。
3. 主 agent 请求不会被标记为 subagent。

### 风险 2：`X-Codex-Turn-Metadata` schema 演进或解析失败影响请求

解决方案：

1. 使用 allowlist 解析，只读：
   - `session_id`
   - `thread_id`
   - `thread_source`
   - `turn_id`
   - `sandbox`
   - `turn_started_at_unix_ms`
2. JSON 解析失败只产生 bounded diagnostic，例如 `turn_metadata_parse_error=true`，不返回 4xx，不阻断路由。
3. `turn_started_at_unix_ms` 只接受数字；字符串或异常类型忽略。
4. 字段长度做上限，例如 session/thread/turn id 256 字符，subagent source 128 字符，sandbox/thread_source 64 字符。
5. 不解析 `workspaces` 全量内容；若后续需要项目名，只单独设计可信 project label 提取。

验收信号：

1. malformed `X-Codex-Turn-Metadata` 请求仍能正常路由。
2. 超长字段被截断或丢弃，不进入日志长文本。
3. `workspaces` 绝对路径和 remote URL 不出现在 usage/live history。

### 风险 3：route explain 无法说明 model shard 前被过滤的账号

解决方案：

1. P0 不把完整 explain 作为阻塞项，只保证最终候选和命中账号正确。
2. P1 新增独立诊断构造函数，例如 `BuildCodexRouteDiagnostics(requestedModel, allAuths, routeCandidates, registrySnapshot, guardState)`。
3. 诊断输入从 auth registry / account runtime snapshot 来，不从 `RouteContext.Candidates` 反推全部账号。
4. 过滤原因分层：
   - model registry 前：`model-unsupported`、`model-excluded`、`model-alias-miss`
   - routing engine 内：`account-disabled`、`rate-limited`、`cooldown`、`channel-scope-excluded`
   - execution 后：`auth-unavailable`、`model-capacity`、`upstream-error`
5. explain 输出只保存账号 id、账号 label、过滤 reason、requested model、subagent source，不保存 payload。

验收信号：

1. 未进入候选的账号也能显示明确过滤原因。
2. `model-unsupported` 与 `account-disabled` 不混淆。
3. explain 中能看到 `requestKind=subagent`、`subagentSource`、`requestedModel`。

### 风险 4：WebSocket pinned auth 与 subagent scope 冲突

解决方案：

1. P0 不引入 subagent scope，只做 context 和 header 透传，避免影响 pinned auth。
2. P2 若增加 subagent scope，必须在 request boundary 之前判断当前 pinned auth 是否仍满足：
   - 未被 route guard 阻塞
   - 支持当前 requested model
   - 满足 subagent source scope
3. 不满足时复用现有边界：
   - release pin
   - close old execution session
   - force full transcript replay
   - 重新进入 auth manager 选择
4. 已经开始向下游写 payload 后，不做 mid-response migration；只记录诊断，下一请求边界处理。
5. 对 retryable 401/402/403/429 且尚未写 payload 的情况，继续走现有 pre-payload retry/failover 语义。

验收信号：

1. WebSocket 同一 session 的 pinned auth 不会在响应中途切换。
2. 下一次 downstream request 边界可以释放不再满足 scope 的 pinned auth。
3. transcript replay 后不会携带旧 `previous_response_id` 造成上游找不到 response。

### 风险 5：usage/live history 泄露 workspace、remote URL、prompt 或凭证

解决方案：

1. `CodexRequestContext` 明确分成 routing fields 和 observability fields，不存 raw headers、raw body、raw metadata。
2. usage/live history 只允许写：
   - `subagent_source`
   - `session_id`
   - `client_request_id`
   - `thread_id`
   - `thread_source`
   - `turn_id`
   - `turn_started_at_unix_ms`
   - `requested_model`
   - `routed_model`
   - `auth_id`
   - `account_key`
3. 禁止写：
   - `Authorization`
   - `Cookie`
   - API key
   - raw request body
   - prompt / message content
   - tool input
   - `workspaces` 原始 JSON
   - absolute repo path
   - git remote URL
4. 测试 fixture 使用带敏感字段的 metadata，断言 history/detail API 不包含这些字符串。
5. debug log 只输出 bounded field summary，不输出完整 header map。

验收信号：

1. `rg` 测试 fixture 中的 fake token / remote URL / absolute path 不会在 usage/live API 响应中出现。
2. request log 开启时仍遵守已有 redaction 策略。
3. history SQLite schema 不包含 raw metadata / raw header 字段。

### 风险 6：用户以为“subagent 特殊模型”已经实现了账号组配置

解决方案：

1. 文档和实现切片明确区分：
   - P0：识别和透传 subagent 请求上下文
   - P1：观测和归因
   - P2：可配置 subagent 候选 scope
2. UI 不在 P0/P1 阶段提供“subagent 专用账号组”可保存入口，避免前端显示配置但 sidecar 没有热路径执行。
3. 如果必须提前展示，只能标记为 read-only diagnostic，不写配置。
4. P2 配置落点必须在 sidecar `channel-routing/config.json` 或其后继 sidecar-owned config，不能只写 GetTokens 前端 state。

验收信号：

1. P0/P1 完成时，用户能看到 subagent 请求和归因，但不能误配置账号组。
2. P2 开始前有独立需求和测试，证明 sidecar 热路径真正消费该配置。

### 风险 7：模型 alias 与 upstream model 归因混淆

解决方案：

1. 保留两个字段：
   - `requestedModel`：Codex body `model`
   - `routedModel` / `upstreamModel`：实际执行模型或 provider alias 后模型
2. OAuth/auth-file 默认同名透传；显式 alias 才记录 alias 映射。
3. openai-compatible 继续按 `models[].name -> models[].alias || name` 保存，usage 同时记录 requested 和 routed。
4. explain 中把 alias miss 与 model unsupported 分开：
   - alias 不存在：`model-alias-miss`
   - 账号能力不含该模型：`model-unsupported`

验收信号：

1. usage row 同时显示 requested model 和 routed/upstream model。
2. openai-compatible alias 命中时不把真实上游模型误报成 Codex 请求模型。
3. alias miss 返回可诊断错误，不 fallback 到任意默认模型。
