# Codex 实时运行会话详情技术计划

## 定位

本计划承接 space README。目标是在 Codex 一级工作区新增 `live-sessions`，提供 sidecar 运行时会话观测。第一期只读，不做请求控制。

## 数据来源

优先从 sidecar 运行时收集事件，不从请求日志文件反扫作为主链路：

1. Responses WebSocket handler
   - downstream connected / disconnected
   - downstream session id
   - payload request id / model
   - selected auth callback
   - synthetic prewarm
   - forward completed / failed
2. Codex WebSocket executor
   - upstream ws url
   - upstream connected / disconnected
   - handshake status
   - send / read / retry
   - usage publish
3. HTTP Responses handler
   - `POST /v1/responses`
   - model / auth / request id
   - 可用于推断同一 session/window 已从 WebSocket 降级到 HTTP

## 后端模型草案

### CodexLiveSessionSnapshot

- `generatedAt`
- `sidecarReady`
- `summary`
  - `activeSessions`
  - `activeRequests`
  - `websocketSessions`
  - `httpSessions`
  - `degradedSessions`
  - `errorSessions`
- `sessions[]`

### CodexLiveSession

- `sessionID`
- `codexWindowID`
- `downstreamSessionID`
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
- `downstreamTransport`
- `upstreamTransport`
- `fallbackInferred`
- `fallbackReason`
- `recentEvents[]`
- `requests[]`

### CodexLiveRequest

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
- `error`
- `timeline[]`

## API 草案

Wails / root app 需要暴露：

- 已实现：`GetCodexLiveSessionsSnapshot()`
- 当前不单独实现 detail API：第一期详情数据随 snapshot 中的 session/request 一并返回，前端行内展开即可读取。
- 当前不单独实现 refresh API：前端 refresh 按钮直接重新调用 snapshot 方法。

如果 sidecar 支持 management API，Wails 层只做透传和 DTO 映射；如果 sidecar 暂不支持，则先在 GetTokens 后端增加轻量 adapter。

## 前端入口

需要新增：

- `CodexWorkspace = 'live-sessions'`
- Sidebar Codex 子项：`nav.codex_live_sessions`
- URL：`#frame=codex&workspace=live-sessions`
- 页面组件：`CodexLiveSessionsFeature`

建议布局：

1. 顶部摘要条：active / reconnecting / degraded / failed。
2. 左侧或主列表：session rows，支持状态筛选和 request id 搜索。
3. 右侧详情或行内展开：timeline、requests、transport lanes、auth route、usage、error。
4. 详情内复制诊断摘要。

## 状态语义

- `active`：会话存在 active request。
- `streaming`：已收到上游事件但未完成。
- `reconnecting`：sidecar 记录上游断开或重连尝试中。
- `degraded_http`：同一 session/window 先走 WebSocket，后续观察到 HTTP Responses 请求。
- `completed`：最后请求正常完成。
- `failed`：最后请求错误完成。
- `cancelled`：下游断开或 context cancelled。

## Fallback 推断规则

第一期只做保守推断：

1. 观察到同一 `codexWindowID` 或强相关 session key 先出现 WebSocket 请求。
2. 随后出现 HTTP `POST /v1/responses`。
3. model / auth / client metadata 能关联到同一运行上下文。
4. 标记为 `fallbackInferred=true`，展示“推断”，不宣称读取到 Codex 内部 `disable_websockets` 状态。

## 脱敏规则

后端输出 DTO 前必须脱敏：

- Authorization / Cookie / API key / refresh token 全部移除。
- request body 默认不进入 DTO。
- prompt、tool input、完整 response body 不进入 DTO。
- 本地路径使用 basename 或 hash label。
- 错误 body 最多保留 status、code、message 摘要。

## BDD / TDD 计划

1. 后端单元测试
   - WebSocket session event 聚合为 active session。
   - upstream disconnect 后状态变为 reconnecting / failed。
   - WebSocket 后出现 HTTP 请求时 fallback 推断为 true。
   - 脱敏规则不会泄漏 Authorization / prompt。
2. 前端模型测试
   - session rows 排序、筛选、搜索 request id。
   - fallback 状态文案和 badge。
   - 诊断摘要生成脱敏。
3. Browser preview
   - preview data 覆盖 active、reconnecting、degraded_http、failed、empty、sidecar-not-ready。
4. Wails / desktop 验收
   - sidecar ready 后能读取真实 snapshot。
   - 真实 Codex WebSocket 请求运行时页面有实时更新。

## 第一期开工边界

建议第一期只交付：

1. sidecar 运行事件聚合。
2. Wails snapshot / detail API。
3. Codex `live-sessions` 页面只读展示。
4. request id 搜索和复制诊断摘要。
5. WebSocket -> HTTP fallback 推断提示。

暂不做：

1. 请求取消、重放、强制恢复 WebSocket。
2. 完整 payload 查看。
3. 长期持久化事件库。
4. 复杂链路图编辑。

## 2026-05-21 实现记录

- CLIProxyAPI fork：
  - 新增 `internal/gettokenshooks/live_sessions.go` 与测试。
  - 新增管理端点 `/v0/management/gettokens/live-sessions`。
  - Responses WebSocket handler 记录 downstream connect/request/disconnect，并为每个 WebSocket frame 生成 request id。
  - Codex WebSocket executor 记录 upstream connect、first event、completion、disconnect。
  - usage attribution plugin 同步把 Codex HTTP completed request 投递到 live tracker。
- GetTokens Wails：
  - 新增 `internal/wailsapp.GetCodexLiveSessionsSnapshot`，只读转发 sidecar management API。
  - root `main.App` 暴露同名方法，新增 DTO mapper，并重新生成 `frontend/wailsjs`。
- 前端：
  - 新增 backend adapter，将 Wails `main.CodexLiveSessionsSnapshot` 归一化为 feature 内部模型。
  - `CodexLiveSessionsFeature` 在桌面环境每 2 秒刷新真实 snapshot，browser preview 保持 mock。
  - `SessionFeed` 默认只展示状态、模型/账号、连接方式、速率、首 token 和运行时长；内部 id 保留到展开详情。
- 验证：
  - CLIProxyAPI：`go test ./...`
  - GetTokens：`go test ./...`
  - 前端：`npm --prefix frontend run typecheck`、`node --test frontend/src/features/codex-live-sessions/model.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`、`npm --prefix frontend run build`
  - Wails：`./scripts/wails-cli.sh generate module`、`./scripts/wails-cli.sh build -skipbindings`
