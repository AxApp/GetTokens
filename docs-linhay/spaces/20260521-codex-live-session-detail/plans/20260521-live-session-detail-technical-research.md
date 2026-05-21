# Codex 实时运行会话详情技术调研

## 结论

可以做。最稳妥的实现方式是在 GetTokens 维护的 CLIProxyAPI sidecar fork 内增加 `gettokenshooks` 级运行事件聚合器，由 Responses WebSocket handler、Codex WebSocket executor、HTTP Responses handler、usage attribution 插件共同写入同一个内存 ring store。GetTokens Wails 层通过 sidecar management API 读取 snapshot/detail，再映射为前端 DTO。

不能做的是“在 Codex 已经降级 HTTP 后由 GetTokens 透明恢复成 WebSocket”。Codex 上游源码中 fallback 是 session-scoped sticky 状态，代理侧只能观测和提示，不能无感修改 Codex 进程内部的 `disable_websockets`。

## 调研范围

本调研覆盖：

- Codex CLI WebSocket fallback 行为。
- CLIProxyAPI sidecar 当前 WebSocket / HTTP Responses 路由。
- GetTokens Wails 透传和 DTO 映射边界。
- request id、execution session id、downstream session、auth id、transport 状态的数据来源。
- runtime event store 和 management API 设计。
- 前端实时展示所需数据契约、脱敏和测试矩阵。

不覆盖：

- 改 Codex CLI 自身恢复策略。
- 长期审计库或完整 payload 留存。
- 控制型操作，例如取消、重放、强制切账号。

## 代码依据

### Codex upstream

- `docs-linhay/references/codex/codex-rs/core/src/client.rs`
  - `responses_websocket_enabled()` 同时受 provider `supports_websockets` 和 session-scoped `disable_websockets` 控制。
  - `try_switch_fallback_transport()` / `force_http_fallback()` 会把当前 Codex session 切到 HTTP fallback，并清理 WebSocket session。
  - WebSocket prewarm、turn 内 reconnect、stream request 共享 session 级 WebSocket 状态。
- `docs-linhay/references/codex/codex-rs/core/tests/suite/websocket_fallback.rs`
  - 426 upgrade required 会立即切 HTTP。
  - WebSocket stream retry 耗尽后重放到 HTTP。
  - `websocket_fallback_is_sticky_across_turns` 明确验证 fallback 在后续 turn 继续走 HTTP，不再增加 WebSocket attempt。
- `docs-linhay/references/codex/codex-rs/codex-api/src/endpoint/responses_websocket.rs`
  - WebSocket 连接发送 `response.create`，读取 `response.completed` / error / close。
  - 包含 WebSocket error event 映射和 connection limit retryable 语义。

### CLIProxyAPI sidecar

- `docs-linhay/references/CLIProxyAPI/internal/api/server.go`
  - `/v1/responses` 同时注册：
    - `GET /v1/responses` -> `ResponsesWebsocket`
    - `POST /v1/responses` -> `Responses`
  - `/backend-api/codex/responses` 也注册同样的 GET/POST direct route。
  - `WithManagementRouterConfigurator` 已给 GetTokens fork 插入 `/v0/management/gettokens/*` 路由的扩展点。
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
  - downstream WebSocket 连接进入 `ResponsesWebsocket`。
  - handler 生成 `passthroughSessionID`，作为 sidecar 侧 downstream/execution session 关联点。
  - 每条 downstream message 会进入 `normalizeResponsesWebsocketRequestWithMode()`，随后 `ExecuteStreamWithAuthManager()`。
  - `handlers.WithExecutionSessionID(cliCtx, passthroughSessionID)` 已把 execution session id 传给 executor。
  - `handlers.WithSelectedAuthIDCallback` 可捕捉 selected auth，并在支持 incremental input 时 pin auth。
  - `forwardResponsesWebsocket()` 能观察 downstream output、`response.completed`、error、stream closed before completed、downstream write failure。
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
  - `CodexWebsocketsExecutor` 有 `codexWebsocketSessionStore`，按 execution session 复用 upstream WebSocket。
  - `ensureUpstreamConn()` / `dialCodexWebsocket()` / `recordAPIWebsocketHandshake()` 是 upstream connect 和 handshake 插桩点。
  - upstream send error 时会 invalidate conn 并 retry once with fresh websocket connection。
  - read error / upstream error 会 `RecordAPIWebsocketError()` 并 publish failure。
  - `applyCodexWebsocketHeaders()` 会透传 `x-client-request-id`、`x-codex-turn-state`、`x-codex-turn-metadata` 等 header。
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/logging_helpers.go`
  - 已有 `RecordAPIWebsocketRequest`、`RecordAPIWebsocketHandshake`、`RecordAPIWebsocketUpgradeRejection`、`AppendAPIWebsocketResponse`、`RecordAPIWebsocketError`。
  - 已有 `LogWithRequestID(ctx)`，request id 来源于 `internal/logging`。
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/usage_attribution.go`
  - 已有 GetTokens sidecar hook 和 `/v0/management/gettokens/usage-attribution` 扩展路由。
  - usage attribution 已把 request id、method/path、model、provider、auth id、auth index、token usage 写入 sqlite summary。
  - completed request 的耗时/usage 可用于校准 live session 的完成态 timing，但 active 请求仍应从内存 event store 聚合。
  - 可以复用其 management route 组织方式，但 live session 第一版不应依赖 sqlite 作为实时主链路。

### GetTokens Wails

- `internal/wailsapp/sidecar_client.go`
  - `SidecarRequest()` 通过 `ManagementAPIPrefix="/v0/management"` 调 sidecar management API，自动加 `Authorization: Bearer <management-key>`。
- `internal/wailsapp/usage_attribution.go`
  - 已有 Wails -> sidecar -> DTO -> 前端的同类读取链路。
  - 已有 auth index / auth id / provider 到前端 account key 的解析经验，可作为 live session account join 的参考。
- `frontend/src/pages/CodexPage.tsx`
  - Codex workspace 通过 `CodexWorkspace` 分支渲染。
- `frontend/src/types.ts`
  - `CodexWorkspace` 当前不含 `live-sessions`，需要新增 union 值。
- `frontend/src/components/biz/Sidebar.tsx`
  - Codex 子项数组需要新增 `live-sessions`。
- `frontend/src/utils/pagePersistence.ts`
  - 需要支持 `#frame=codex&workspace=live-sessions` 的解析和持久化。

## 标识来源

| 标识 | 当前来源 | 可靠性 | 用途 |
| --- | --- | --- | --- |
| GetTokens request id | `internal/logging.GenerateRequestID()`，Gin logger 对 AI API path 生成 8 位 hex | 高 | UI 搜索、关联 usage attribution、日志跳转 |
| `x-client-request-id` | Codex downstream header，经 `applyCodexWebsocketHeaders()` 透传到 upstream | 中高 | 用户手中请求标识、fallback 关联线索 |
| execution session id | `ResponsesWebsocket` 生成 `passthroughSessionID` 并写入 `WithExecutionSessionID` | 高 | WebSocket 会话主键候选 |
| downstream session key | `websocketDownstreamSessionKey(c.Request)` | 中 | tool cache / downstream 连接关联 |
| Codex window id | Codex `x-codex-window-id` / ws client metadata，经 headers 或 payload metadata 观测 | 中 | WebSocket -> HTTP fallback 跨请求推断 |
| auth id | selected auth callback、executor `auth.ID`、usage attribution `record.AuthID` | 高 | 命中账号展示、账号详情跳转 |
| auth index | usage attribution / auth manager | 中高 | fallback 到账号映射 |
| upstream request id | WebSocket error headers、HTTP response headers 中 `x-request-id` 等 | 中 | 上游排障标识 |
| model | request payload `model`、usage record alias/model | 高 | 列表筛选、状态摘要 |
| transport | route method + executor path | 高 | downstream/upstream lane |

## 插桩点设计

### 1. downstream WebSocket handler

文件：`sdk/api/handlers/openai/openai_responses_websocket.go`

建议事件：

- `session_opened`
  - `executionSessionID=passthroughSessionID`
  - `downstreamTransport=websocket`
  - `remote`
  - `headers`: 只提取安全 header 名称和值摘要。
- `downstream_request_received`
  - request type：`response.create` / `response.append`
  - model
  - `x-client-request-id`
  - `x-codex-window-id`
  - request body fingerprint，不存 body。
- `auth_selected`
  - selected auth id
  - pinned auth id 变化
  - incremental input support。
- `downstream_response_forwarded`
  - event type
  - first event / completed / error
  - usage 摘要。
- `downstream_disconnected`
  - close reason / read error / context cancelled。

### 2. Codex upstream WebSocket executor

文件：`internal/runtime/executor/codex_websockets_executor.go`

建议事件：

- `upstream_ws_dial_started`
- `upstream_ws_handshake_completed`
  - status
  - safe response headers：`x-request-id`、模型相关 header、rate limit 摘要。
- `upstream_ws_handshake_failed`
  - status / error / retryable。
- `upstream_ws_send_started`
- `upstream_ws_send_failed`
  - 标记 sidecar retry once。
- `upstream_ws_reconnect_started`
- `upstream_ws_reconnect_succeeded`
- `upstream_ws_read_event`
  - event type，不存完整 payload。
- `upstream_ws_read_error`
- `upstream_ws_completed`
- `upstream_ws_invalidated`
  - reason：`send_error`、`read_error`、`upstream_error`、`unexpected_binary`。

### 3. HTTP Responses handler

文件：`sdk/api/handlers/openai/openai_handlers.go` / `OpenAIResponsesAPIHandler.Responses`

建议事件：

- `http_response_request_received`
  - `downstreamTransport=http`
  - path：`/v1/responses` 或 `/backend-api/codex/responses`
  - `x-client-request-id`
  - `x-codex-window-id`
  - model。
- `http_response_stream_started`
- `http_response_completed`
- `http_response_failed`

该插桩用于 fallback 推断，不应把所有 HTTP 请求都硬归入 degraded。只有能和之前 WebSocket session/window 强关联时才标记。

### 4. usage attribution

文件：`internal/gettokenshooks/usage_attribution.go`

用途：

- 补 completed request 的 token usage。
- 补 auth/account attribution。
- 补 latency、failed、status code。

边界：

- usage attribution 是完成态 ledger，不适合作为 active request 的实时来源。
- 第一版 live session 应从内存 event store 读 active 状态，再用 usage attribution 增强 completed 摘要。

## Runtime Event Store

建议新增 sidecar 包：

- `internal/gettokenshooks/live_sessions.go`
- `internal/gettokenshooks/live_sessions_store.go`
- `internal/gettokenshooks/live_sessions_routes.go`
- `internal/gettokenshooks/live_sessions_test.go`

### 存储策略

- 内存 ring store 为主，默认保留：
  - active sessions 不淘汰。
  - completed / failed sessions 保留 30 分钟。
  - 最近最多 200 个 sessions。
  - 单 session 最近最多 200 条 timeline events。
  - 单 request 最近最多 80 条 events。
- 可选轻量 sqlite summary 为二期，不进入第一期。

### 并发模型

- store 使用 `sync.RWMutex`。
- 写入为 append event + 同步更新 session/request aggregate。
- API 读取返回深拷贝 DTO，避免前端轮询时拿到可变内部结构。
- event 写入必须非阻塞、低成本；失败只打 debug/warn，不影响模型请求。

### 事件结构草案

```go
type LiveSessionEvent struct {
    ID string
    At string
    Kind string
    Severity string
    SessionID string
    RequestID string
    ClientRequestID string
    UpstreamRequestID string
    CodexWindowID string
    DownstreamTransport string
    UpstreamTransport string
    Model string
    AuthID string
    AuthIndex string
    Provider string
    StatusCode int
    ErrorCode string
    ErrorMessage string
    Retryable bool
    Metadata map[string]string
}
```

DTO 输出前统一调用 sanitizer，禁止输出 payload、Authorization、Cookie、API key、refresh token、完整本地路径。

## Management API 设计

建议 sidecar management API：

- `GET /v0/management/gettokens/codex/live-sessions`
  - query:
    - `include_completed=true|false`
    - `limit=200`
    - `q=<request/session/model/auth>`
  - 返回 snapshot。
- `GET /v0/management/gettokens/codex/live-sessions/:session_id`
  - 返回 session detail。
- `GET /v0/management/gettokens/codex/live-requests/:request_id`
  - 返回 request detail。

Wails root app 暴露：

- `GetCodexLiveSessionSnapshot(input CodexLiveSessionSnapshotInput)`
- `GetCodexLiveSessionDetail(sessionID string)`
- `GetCodexLiveRequestDetail(requestID string)`

Wails DTO 文件建议：

- `internal/wailsapp/codex_live_sessions.go`
- `app.go` root method mirror。
- `app_types.go` root DTO mirror，如当前项目绑定规则需要。

前端生成绑定后从 `frontend/wailsjs/go/main/App` 导入，browser preview 走 mock adapter。

## Snapshot DTO 建议

```ts
type CodexLiveSessionStatus =
  | 'active'
  | 'streaming'
  | 'reconnecting'
  | 'upstream_disconnected'
  | 'degraded_http'
  | 'completed'
  | 'failed'
  | 'cancelled';

type CodexTransport = 'websocket' | 'http' | 'unknown';
```

关键字段：

- snapshot:
  - `generatedAt`
  - `sidecarReady`
  - `source: 'live' | 'cache' | 'preview'`
  - `retention`
  - `summary`
  - `sessions`
- session:
  - `sessionID`
  - `executionSessionID`
  - `downstreamSessionID`
  - `codexWindowID`
  - `status`
  - `startedAt`
  - `lastEventAt`
  - `durationMs`
  - `requestCount`
  - `activeRequestID`
  - `lastRequestID`
  - `model`
  - `authID`
  - `authLabel`
  - `provider`
  - `downstreamTransport`
  - `upstreamTransport`
  - `fallbackInferred`
  - `fallbackConfidence: 'high' | 'medium' | 'low'`
  - `fallbackReason`
  - `transportLane`
  - `recentEvents`
  - `requests`
- request:
  - `requestID`
  - `clientRequestID`
  - `upstreamRequestID`
  - `sessionID`
  - `sequence`
  - `model`
  - `status`
  - `startedAt`
  - `completedAt`
  - `downstreamTransport`
  - `upstreamTransport`
  - `connectionReused`
  - `authID`
  - `authLabel`
  - `provider`
  - `proxyRoute`
  - `usage`
  - `timing`
  - `error`
  - `timeline`

### Timing DTO

请求级 `timing` 只保存聚合测量值，不保存 payload 或流式正文：

```ts
interface CodexLiveTimingMetrics {
  queueWaitMs?: number;
  authSelectMs?: number;
  upstreamConnectMs?: number;
  firstEventMs?: number;
  firstTokenMs?: number;
  averageEventGapMs?: number;
  longestEventGapMs?: number;
  streamDurationMs?: number;
  totalDurationMs?: number;
  reconnectCount?: number;
  outputTokensPerSecond?: number;
  totalTokensPerSecond?: number;
}
```

指标口径：

- `queueWaitMs`：sidecar 接到请求后，到开始上游处理前的等待时间。
- `authSelectMs`：账号选择完成耗时。
- `upstreamConnectMs`：上游 WebSocket/HTTP stream 建连或握手耗时。
- `firstEventMs`：从请求开始到第一个上游事件的耗时，偏链路可用性。
- `firstTokenMs`：从请求开始到第一个输出 token/delta 的耗时，偏用户感知。
- `averageEventGapMs` / `longestEventGapMs`：流式事件间隔，用于发现中途 stall。
- `streamDurationMs`：从开始流式输出到完成/失败的持续时间。
- `totalDurationMs`：请求总耗时。
- `outputTokensPerSecond` / `totalTokensPerSecond`：完成态可由 usage 和耗时计算；active 态可用当前累计估算。
- `reconnectCount`：该请求生命周期内 sidecar 观测到的上游重连或 Codex 触发的关联重试次数。

## Fallback 推断规则

第一期只做 conservative inference：

1. 同一 `codexWindowID` 先出现 `downstream=websocket`。
2. 后续同一 `codexWindowID` 或同一强关联 session key 出现 `POST /v1/responses`。
3. model、`x-client-request-id` 前缀、turn metadata、auth id 至少有一个辅助信号能关联。
4. 标记：
   - `fallbackInferred=true`
   - `fallbackConfidence=high|medium|low`
   - `fallbackReason=websocket_then_http_same_window`
5. UI 文案必须包含“推断”，不能写成“Codex 内部 disable_websockets=true”。

不应标记 degraded 的情况：

- 从未观察到 WebSocket 的纯 HTTP Codex 请求。
- 不同 window id 的请求。
- only model 相同但没有 session/window/request/header 关联。
- sidecar 重启后只看到 HTTP 新请求，没有之前 WebSocket ring event。

## 关于代理恢复 WebSocket

GetTokens sidecar 能做：

- upstream 写失败后重建 upstream WebSocket 并 retry once。
- upstream disconnect 时通知 downstream，让 Codex 自己重试。
- 当 Codex 重新以 WebSocket 建连时正常代理新连接。

GetTokens sidecar 不能做：

- 在 Codex process 内把 session-scoped `disable_websockets` 改回 false。
- 把 Codex 已发出的 HTTP `POST /v1/responses` 无感转成 WebSocket 并保持客户端状态等价。
- 在不改 Codex 的情况下保证同一 Codex session 从 HTTP fallback 自动恢复 WebSocket。

因此产品能力应是“会话提示 + 诊断 + 后续新 session 建议”，不是“代理自动恢复”。

## 脱敏策略

后端 sanitizer 必须早于 DTO 输出：

- 删除 header：
  - `Authorization`
  - `Cookie`
  - `Set-Cookie`
  - `X-Api-Key`
  - `OpenAI-Session`
  - refresh/access/id token 相关字段。
- payload 默认不进入 event store。
- prompt/tool input/response body 不输出。
- 错误 body 只保留：
  - status
  - code
  - type
  - message 摘要，建议最长 300 字符。
- 本地路径只保留 basename 或 hash label。
- API key 只允许 `sk-...abcd` 这种 suffix 摘要，优先不输出。

## 前端数据流

建议新增：

- `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx`
- `frontend/src/features/codex-live-sessions/model/types.ts`
- `frontend/src/features/codex-live-sessions/model/mockData.ts`
- `frontend/src/features/codex-live-sessions/model/selectors.ts`
- `frontend/src/features/codex-live-sessions/hooks/useCodexLiveSessionSnapshot.ts`
- `frontend/src/features/codex-live-sessions/components/*`
- `frontend/src/features/codex-live-sessions/tests/*.test.mjs`

刷新策略：

- 页面可见时 2 秒轮询 snapshot。
- active session 存在时 1 秒轮询。
- 页面隐藏时降到 10 秒或暂停。
- detail 展开时按 `selectedSessionID` 拉 detail；snapshot 内保留 enough list fields。
- sidecar not ready 时展示最近一次 cache，不误报空列表。

## 测试矩阵

### Sidecar Go tests

- WebSocket connect event 生成 active session。
- downstream request + selected auth + upstream handshake 聚合为 request detail。
- upstream send error -> reconnect_started -> reconnect_succeeded。
- upstream read error -> upstream_disconnected / failed。
- WebSocket followed by HTTP same window -> degraded_http inferred。
- pure HTTP without previous WebSocket -> not degraded。
- sanitizer 不泄漏 Authorization、Cookie、API key、prompt、tool input。
- retention 不删除 active session，completed 超过限制会被淘汰。
- concurrent event append 不 data race。

### Wails Go tests

- sidecar not ready 返回明确错误或 `sidecarReady=false`。
- snapshot DTO 空数组不为 nil。
- detail API 透传 path 和 query 正确。
- auth id/account key join 不改变 sidecar 原始字段。

### Frontend unit tests

- session 排序：active/reconnecting/degraded 优先，随后 lastEventAt。
- request id / client request id / upstream request id 搜索。
- filter：status、transport、auth、model。
- degraded_http badge 文案必须包含“推断”。
- timing summary 必须展示 queue、connect、TTFT、first token、stream、total、event gap、token rate 和 reconnect count，且不包含 payload。
- diagnostic summary 不包含敏感字段。
- sidecar-not-ready 不渲染成 empty state。

### Storybook / Browser preview

- empty
- sidecar-not-ready
- active websocket
- reconnecting
- degraded_http
- failed
- high-volume list
- redacted diagnostic
- dark mode
- 375px mobile viewport 不溢出。

### Desktop acceptance

- 真实 sidecar ready 后 snapshot 可读。
- 发起 Codex WebSocket 请求时 2 秒内出现 active session。
- 模拟 upstream disconnect 后状态进入 reconnecting / upstream_disconnected。
- 同 window 后续 HTTP 请求被保守标记 degraded_http。

## 风险

1. request id 与 `x-client-request-id` 不是同一个概念，UI 必须并列展示，不能合并成一个字段。
2. WebSocket fallback 推断依赖 window/session/header 关联，sidecar 重启会丢失上下文。
3. active 状态必须从 live event store 来，usage attribution 只能补完成态。
4. 事件写入位于请求热路径，不能做重 IO 或复杂 JSON 序列化。
5. Storybook mock 与真实 DTO 容易漂移，需要把 mock data 类型绑定到前端 DTO。

## 推荐实施顺序

1. sidecar live event store + sanitizer + management API。
2. Wails DTO + root binding + sidecar not ready/cache 语义。
3. 前端 model selectors + mock data + Storybook 组件矩阵。
4. Codex workspace 接入 `live-sessions`。
5. fallback 推断与诊断摘要。
6. 自动化测试、Storybook/browser 视觉验收、Wails desktop 验收。
