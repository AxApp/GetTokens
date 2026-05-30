# CLIProxyAPI Codex 请求链路与 CodexRequestContext 执行交接

## 目标

把 Codex `/v1/responses` 与 `/v1/responses/ws` 进入 CLIProxyAPI 后的内部处理链路梳理清楚，并给出后续实现 `CodexRequestContext` 的最小落点。

本交接文档用于执行，不再重新讨论“是否要做”。推荐方向是：在 sidecar 内部新增一个统一的 Codex 请求上下文解析层，让 route explain、live sessions、usage attribution 复用同一个解析结果，避免各自重复解析 headers 和 body。

## 范围

本轮执行范围：

1. 梳理 HTTP `/v1/responses` 请求从 handler 到 executor 的主链路。
2. 梳理 WebSocket `/v1/responses/ws` 每条 downstream message 到 upstream executor 的主链路。
3. 明确 `CodexRequestContext` 的推荐字段和生成位置。
4. 明确 route explain、live sessions、usage attribution 的接入顺序。

不在本轮范围：

1. 不新增 Codex 协议 header。
2. 不做 `agent_role` / `agent_type` 路由。
3. 不用 `Session_id`、`thread_source`、`turn_id` 推断 subagent。
4. 不恢复旧 `X-GetTokens-Route-*`。
5. 不全量复制入站 HTTP headers；`Authorization` 继续由 sidecar 按选中账号重写。

## 内部链路总览

```text
Codex client
  |
  | HTTP /v1/responses 或 WS /v1/responses/ws
  v
sdk/api/handlers/openai
  |
  | 解析 body model、原始 headers、gin context
  v
sdk/api/handlers.BaseAPIHandler
  |
  | 组装 executor.Request + executor.Options
  | Options.Headers = 入站 headers
  | Options.OriginalRequest = 原始 body
  | Options.Metadata = requestExecutionMetadata()
  v
sdk/cliproxy/auth.Manager
  |
  | scheduler / routing policy / sticky / cooldown / retry
  v
internal/runtime/executor
  |
  | Codex HTTP executor 或 Codex WebSocket executor
  | 重写 Authorization，透传 allowlist headers
  v
OpenAI upstream
  |
  v
response stream / usage / live sessions / history
```

关键判断：当前链路不是缺入口，而是缺一个统一的 Codex 请求上下文对象。正确方向是 handlers 层解析一次，然后通过 `executor.Options.Metadata` 向后传递。

## HTTP `/v1/responses` 链路

入口文件：

- `sdk/api/handlers/openai/openai_responses_handlers.go`

关键函数：

- `OpenAIResponsesAPIHandler.Responses`
- `handleNonStreamingResponse`
- `handleStreamingResponse`
- `BaseAPIHandler.ExecuteWithAuthManager`
- `BaseAPIHandler.ExecuteStreamWithAuthManager`

处理顺序：

1. `Responses(c)` 读取原始 body。
2. 从 body 取 `model`。
3. 根据 `stream` 分流：
   - 非流式进入 `handleNonStreamingResponse`
   - 流式进入 `handleStreamingResponse`
4. 两条路径都会调用 BaseAPIHandler：
   - 非流式：`ExecuteWithAuthManager`
   - 流式：`ExecuteStreamWithAuthManager`
5. BaseAPIHandler 构造：
   - `coreexecutor.Request{Model, Payload}`
   - `coreexecutor.Options{Stream, Alt, OriginalRequest, SourceFormat, Headers, Metadata}`
6. `Options.Headers` 来自 `headersFromContext(ctx)`，保存入站 headers。
7. `Options.OriginalRequest` 保存原始 body。
8. `Options.Metadata` 来自 `requestExecutionMetadata(ctx)`，当前只包含 request path、pinned auth、execution session、requested model、reasoning effort、service tier 等。

当前缺口：

1. `requestExecutionMetadata()` 不解析 Codex subagent / turn metadata。
2. 后续 route explain、live sessions、usage attribution 如果要读 subagent，只能各自从 `Options.Headers` / body 重复解析。

## WebSocket `/v1/responses/ws` 链路

入口文件：

- `sdk/api/handlers/openai/openai_responses_websocket.go`

关键函数：

- `OpenAIResponsesAPIHandler.ResponsesWebsocket`
- `normalizeResponsesWebsocketRequestWithMode`
- `gettokenshooks.ExtractCodexLiveSessionIdentity`
- `gettokenshooks.RecordDownstreamWebsocketRequest`
- `BaseAPIHandler.ExecuteStreamWithAuthManager`
- `forwardResponsesWebsocketWithOptions`

每条 downstream message 的处理顺序：

1. `ResponsesWebsocket(c)` 建立 downstream websocket。
2. 读取每个 message payload。
3. `normalizeResponsesWebsocketRequestWithMode()` 修复 / 补齐 request。
4. 从 message body 取 `model`。
5. 生成 `liveRequestID`。
6. 当前会调用：
   - `ExtractCodexLiveSessionIdentity(c.Request.Header, requestJSON)`
   - `RecordDownstreamWebsocketRequest(...)`
7. 构造 `cliCtx`：
   - request id
   - downstream websocket 标记
   - execution session id
   - pinned auth id 或 selected auth callback
8. 调 `ExecuteStreamWithAuthManager(...)` 进入和 HTTP 一样的 auth manager 主路径。
9. 如果 pinned auth 上游失败，当前逻辑会释放 pinned auth，必要时重放 transcript 并 retry。

当前缺口：

1. WebSocket live session identity 自己解析 headers/body。
2. `ExecuteStreamWithAuthManager()` 里生成的 `Options.Metadata` 没有复用这份 identity。
3. route explain / usage attribution 无法直接拿到同一份 session / turn / subagent 上下文。

## Auth Manager 与路由链路

入口文件：

- `sdk/cliproxy/auth/conductor.go`
- `sdk/cliproxy/auth/scheduler.go`
- `sdk/cliproxy/auth/routing_policy.go`
- `internal/gettokensrouting/engine.go`

处理顺序：

1. Auth manager 根据 provider/model 找可用候选账号。
2. scheduler 按模型能力、disabled、cooldown 等过滤。
3. GetTokens routing policy 从 `internal/gettokensrouting.PolicySnapshot()` 读取当前注册 policy。
4. 构造 `gettokensrouting.RouteContext`：
   - `Provider`
   - `Providers`
   - `Model`
   - `Options`
   - `Candidates`
   - `Tried`
   - `Now`
5. routing engine 执行 policies，产出：
   - 候选账号列表
   - `Trace []DecisionStep`

当前缺口：

1. `RouteContext` 没有 `CodexRequestContext` typed 字段。
2. policy 若要读 subagent，只能从 `RouteContext.Options.Headers` 或 `Options.Metadata` 手动解析。
3. `Trace` 可以记录 policy activated 与 reason，但当前 channel routing policy 不输出 subagent 维度。

## Executor 上游请求链路

入口文件：

- `internal/runtime/executor/codex_executor.go`
- `internal/runtime/executor/codex_websockets_executor.go`

处理顺序：

1. Auth manager 选中账号后调用 executor。
2. executor 按选中 `auth` 生成上游 OpenAI 请求。
3. `applyCodexHeaders()` / `applyCodexWebsocketHeaders()`：
   - 设置 `Authorization`
   - 设置 `User-Agent`
   - 设置 `Originator`
   - 透传 Codex client context allowlist
4. 请求发往 OpenAI upstream。
5. response stream / payload 回传给 handler。

职责边界：

1. executor 负责“上游请求怎么发”。
2. executor 不负责“subagent 语义怎么解释”。
3. subagent / session / turn 语义应该在 handlers 层统一解析，然后通过 `Options.Metadata` 向后传。

## 当前 live sessions 逻辑

入口文件：

- `internal/gettokenshooks/live_sessions.go`

当前 `CodexLiveSessionIdentity` 字段：

- `ConversationID`
- `ClientRequestID`
- `PromptCacheKey`
- `CodexWindowID`

当前 `ExtractCodexLiveSessionIdentity()` 读取：

- header `x-client-request-id`
- header `x-codex-window-id`
- header `session_id`
- body `prompt_cache_key`
- body `client_metadata.x-codex-window-id`
- body `client_metadata.x-client-request-id`

当前缺失：

- `x-openai-subagent`
- `x-codex-turn-metadata`
- `session-id`
- `thread-id`
- `x-codex-parent-thread-id`
- `turn_id`
- `thread_source`
- `turn_started_at_unix_ms`

推荐方向：`ExtractCodexLiveSessionIdentity()` 内部改为复用统一 `CodexRequestContext` extractor，再映射到 live session identity。

## 当前 usage attribution 逻辑

入口文件：

- `internal/gettokenshooks/usage_attribution.go`

当前 schema 已有：

- `requested_model`
- `routed_model`
- `provider`
- `account_key`
- `auth_id`
- `auth_index`
- token 字段
- latency / status / failed 字段

当前缺失：

- `codex_request_kind`
- `subagent_source`
- `session_id`
- `client_request_id`
- `thread_id`
- `thread_source`
- `turn_id`
- `turn_started_at_unix_ms`

推荐方向：usage 插入事件时从 `Options.Metadata["codex_request_context"]` 读取，不直接解析 headers/body。

## 推荐新增 CodexRequestContext

建议新增包：

- `internal/gettokenscodex/request_context.go`

建议字段：

```go
type RequestKind string

const (
	RequestKindMain     RequestKind = "main"
	RequestKindSubagent RequestKind = "subagent"
)

type RequestContext struct {
	RequestKind          RequestKind
	SubagentSource       string
	RequestedModel       string
	SessionID            string
	ClientRequestID      string
	ThreadID             string
	ThreadSource         string
	TurnID               string
	TurnStartedAtUnixMs  int64
	CodexWindowID        string
	ParentThreadID       string
	InstallationID       string
	PromptCacheKey       string
	MetadataParseError   string
}
```

推荐解析函数：

```go
func ExtractRequestContext(headers http.Header, body []byte, fallbackModel string) RequestContext
```

字段来源规则：

1. `SubagentSource` 只来自 `X-OpenAI-Subagent` / `x-openai-subagent`，trim 后非空才表示 subagent。
2. `RequestKind=subagent` 只由 `SubagentSource` 决定。
3. `RequestedModel` 优先 body `model`，其次 fallback model。
4. `SessionID` 优先 `Session_id`，其次 `session-id`，再 fallback `X-Codex-Turn-Metadata.session_id`。
5. `ClientRequestID` 来自 `X-Client-Request-Id`。
6. `ThreadID` 优先 `thread-id`，其次 metadata `thread_id`。
7. `ThreadSource`、`TurnID`、`TurnStartedAtUnixMs` 来自 `X-Codex-Turn-Metadata`。
8. `CodexWindowID` 优先 header `x-codex-window-id`，其次 body `client_metadata.x-codex-window-id`。
9. `ParentThreadID` 来自 `x-codex-parent-thread-id`。
10. `InstallationID` 来自 `x-codex-installation-id`。
11. `PromptCacheKey` 来自 body `prompt_cache_key`。
12. `workspaces` 不解析、不入库。
13. metadata JSON 解析失败不阻断请求，只写 `MetadataParseError`。

## 推荐接入方式

### 1. handlers 层解析一次

在 `sdk/api/handlers/handlers.go` 中，给 `ExecuteWithAuthManager`、`ExecuteCountWithAuthManager`、`ExecuteStreamWithAuthManager` 三条路径加统一 helper。

推荐 helper：

```go
func attachCodexRequestMetadata(meta map[string]any, headers http.Header, rawJSON []byte, modelName string, handlerType string)
```

只在 Codex Responses handler 上启用，避免影响 Claude / Gemini / 普通 OpenAI-compatible。

建议判断：

- `handlerType == "openai-response"` 或当前 Codex Responses handler 使用的真实 handler type。
- 如果后续 Codex image / compact 也需要，可显式列入 allowlist，不做模糊匹配。

写入 `Options.Metadata`：

- `codex_request_context`: typed context
- `codex_request_kind`
- `codex_subagent_source`
- `codex_session_id`
- `codex_client_request_id`
- `codex_thread_id`
- `codex_thread_source`
- `codex_turn_id`
- `codex_turn_started_at_unix_ms`

### 2. RouteContext 加 typed 字段

在 `internal/gettokensrouting.RouteContext` 增加：

```go
CodexRequest *gettokenscodex.RequestContext
```

scheduler / routing policy 构造 `RouteContext` 时，从 `opts.Metadata["codex_request_context"]` 提取。

好处：

1. policy 不再解析 headers。
2. route explain 可以直接输出上下文。
3. 后续 subagent scope policy 有明确输入。

### 3. live sessions 复用 extractor

`ExtractCodexLiveSessionIdentity(headers, payload)` 内部改为：

1. 调 `gettokenscodex.ExtractRequestContext(headers, payload, "")`。
2. 映射到 `CodexLiveSessionIdentity`。
3. 兼容旧字段：
   - `ConversationID` 仍按当前优先级兜底。
   - `ClientRequestID`、`PromptCacheKey`、`CodexWindowID` 保持原语义。

扩展 identity 字段：

- `RequestKind`
- `SubagentSource`
- `SessionID`
- `ThreadID`
- `ThreadSource`
- `TurnID`
- `TurnStartedAtUnixMs`
- `ParentThreadID`
- `InstallationID`

### 4. usage attribution 只读 Metadata

usage 事件生成时读取：

- `Options.Metadata["codex_request_context"]`

不要在 usage 层重新解析 headers/body。

新增 schema 列：

- `codex_request_kind TEXT NOT NULL DEFAULT ''`
- `subagent_source TEXT NOT NULL DEFAULT ''`
- `session_id TEXT NOT NULL DEFAULT ''`
- `client_request_id TEXT NOT NULL DEFAULT ''`
- `thread_id TEXT NOT NULL DEFAULT ''`
- `thread_source TEXT NOT NULL DEFAULT ''`
- `turn_id TEXT NOT NULL DEFAULT ''`
- `turn_started_at_unix_ms INTEGER NOT NULL DEFAULT 0`

新增索引：

- `(subagent_source, completed_at_unix_ms)`
- `(session_id, completed_at_unix_ms)`
- `(turn_id, completed_at_unix_ms)`

### 5. route explain 输出上下文

route explain DTO 建议增加：

- `requestKind`
- `subagentSource`
- `requestedModel`
- `sessionID`
- `threadID`
- `turnID`

`DecisionStep.Reason` 可补充 subagent 维度，但不要把每个 trace step 都塞满重复字段。

建议格式：

- 主请求：保持现状，避免噪音。
- subagent 请求：`codex subagent=review model=gpt-5.1 channel=codex mode=sequential`

## 分阶段执行

### P0：请求上下文打通

目标：解析一次，贯穿到 auth/routing/executor。

文件：

- `internal/gettokenscodex/request_context.go`
- `internal/gettokenscodex/request_context_test.go`
- `sdk/api/handlers/handlers.go`
- `sdk/api/handlers/handlers_metadata_test.go`
- `internal/gettokensrouting/engine.go`
- `sdk/cliproxy/auth/routing_policy.go`

验收：

1. `X-OpenAI-Subagent: review` 进入 `Options.Metadata`。
2. 无 subagent header 时 `RequestKind=main`。
3. malformed `X-Codex-Turn-Metadata` 不影响请求。
4. routing policy 可以从 `RouteContext.CodexRequest` 读到 subagent。

### P1：live sessions 接入

文件：

- `internal/gettokenshooks/live_sessions.go`
- `internal/gettokenshooks/live_sessions_test.go`
- 如有 history schema：同步扩展 live session history。

验收：

1. live session row 能区分 main / subagent。
2. WebSocket 同一 session / turn 能关联。
3. 旧 session id fallback 不回退。

### P2：usage attribution 持久化

文件：

- `internal/gettokenshooks/usage_attribution.go`
- `internal/gettokenshooks/usage_attribution_test.go`
- management usage API 相关 handler / DTO。

验收：

1. 新 SQLite 列自动迁移。
2. 旧数据默认空字段可查询。
3. 新 usage row 持久化 `subagent_source/session_id/thread_id/turn_id`。
4. summary/detail 支持按 `subagent_source` 过滤。

### P3：route explain 展示

文件：

- `internal/gettokensrouting/engine.go`
- `internal/gettokenshooks/channel_routing_policy.go`
- route explain / probe management API 相关文件。

验收：

1. explain 可看到 `requestKind/subagentSource/requestedModel/sessionID/threadID/turnID`。
2. subagent 信息只影响展示，不改变候选选择。
3. 主请求 explain 不出现无意义空字段。

## 测试命令

sidecar 聚焦测试：

```sh
go test ./internal/gettokenscodex ./internal/gettokensrouting ./internal/gettokenshooks ./sdk/api/handlers ./sdk/cliproxy/auth -count=1
```

Codex executor header 回归：

```sh
go test ./internal/runtime/executor -run TestApplyCodex -count=1
```

编译检查：

```sh
go build -o test-output ./cmd/server
```

完成后删除临时二进制：

```sh
rm -f test-output
```

## 风险与处理

### 风险 1：把观测字段误用成路由条件

处理：

- 本期账号选择不使用 `SessionID`、`ThreadID`、`TurnID`、`ThreadSource`。
- subagent 判定只来自 `X-OpenAI-Subagent`。
- 模型能力仍由 body `model` + registry / scheduler 决定。

### 风险 2：metadata schema 变化导致请求失败

处理：

- `X-Codex-Turn-Metadata` 解析失败只写 `MetadataParseError`。
- 不阻断上游请求。
- 不把 raw metadata 全量入库。

### 风险 3：usage schema 迁移影响旧数据

处理：

- 新列全部 `NOT NULL DEFAULT ''` 或 `DEFAULT 0`。
- 查询兼容空字段。
- 不做历史回填。

### 风险 4：WebSocket retry / pinned auth 语义被破坏

处理：

- 不改变 pinned auth 释放逻辑。
- `CodexRequestContext` 只随每条 downstream request 解析。
- retry 时用 retry 后的 request body 重建 context，避免旧 turn 信息污染新请求。

## 最终判断

执行时不要从 live sessions、usage attribution、route explain 三处分别开工。第一步必须先落 `CodexRequestContext`，再逐个消费者接入。

最小可合并切片是 P0：解析、metadata、RouteContext 打通，并保证现有请求行为不变。P1/P2/P3 都可以在 P0 之后独立合并。
