# Sidecar Route Policy

## 背景

Codex account list 需要验证和控制请求实际命中的账号。单纯依赖 sidecar 既有 `priority`、`fill-first`、`round-robin`、cooldown 只能表达静态顺序，不能让受信任客户端在单次请求上指定候选账号、排除账号或调整顺序。

## 设计

CLIProxyAPI fork 在 `sdk/cliproxy/auth` 增加通用 `RoutePolicy` 口子。它运行在账号已经通过 disabled、cooldown、model availability 检查之后，内置 selector 运行之前。

这意味着策略只能重写“当前可用候选账号”，不能强行绕过已禁用、冷却中或不支持目标模型的账号。

## 控制语义

`RoutePolicyDecision` 支持：

- `AllowIDs`：允许账号集合。
- `DenyIDs`：排除账号集合。
- `OrderIDs`：优先顺序。
- `AllowFallback`：当首选账号不可用时是否允许回退到剩余可用候选。

默认语义：

- 只有 `OrderIDs` 时是偏好顺序，默认允许 fallback。
- 有 `AllowIDs` 时默认是严格 allow set，除非显式设置 `AllowFallback=true`。
- `DenyIDs` 永远排除目标账号。

## GetTokens 接入

GetTokens 独立策略位于 `internal/gettokenshooks/route_policy.go`，由 sidecar server 启动时安装。

受信任内部调用可通过 executor metadata 设置：

- `gettokens.route.allow`
- `gettokens.route.deny`
- `gettokens.route.order`
- `gettokens.route.fallback`

本机 HTTP 调试/探测可通过 header 设置：

- `X-GetTokens-Route-Allow`
- `X-GetTokens-Route-Deny`
- `X-GetTokens-Route-Order`
- `X-GetTokens-Route-Fallback`

header 只接受 loopback 请求，远端请求的路由 header 会被忽略。

## Account Route Guard

2026-05-22 起，GetTokens 在 `internal/gettokenshooks/route_guard.go` 增加统一账号路由守卫。它不是请求中途的 Gin middleware，而是一个 RoutePolicy source 聚合器：

- `manual-disabled`：用户手动禁用账号，由 `sdk/cliproxy.Service.applyCoreAuthAddOrUpdate` 在 auth 变为 disabled 时写入。
- `rate-limit`：自动限流阻断，由 `RateLimitEvaluator` 每轮评估后刷新。

两个 source 共用候选 deny 机制，但清理互不影响。限流窗口恢复只清 `rate-limit`；用户重新启用账号只清 `manual-disabled`。这样可以避免自动策略恢复时误恢复用户手动禁用的账号。

Codex WebSocket 的特殊处理在 service 层完成：当 Codex auth 从可路由状态切到 disabled 时，调用 `CloseCodexWebsocketSessionsForAuthID(authID, "auth_disabled")` 关闭已有上游 session。原因是 WebSocket handler / executor 会复用既有 `pinnedAuthID` 和 upstream connection，单靠候选过滤只能影响后续新选路，不能打断已建立连接。

### P2 WebSocket 热切

P2 将切换边界收敛到下一条 downstream request：

1. `ResponsesWebsocket` 在每条 request 进入 normalize 前检查当前 `pinnedAuthID` 对应 auth 是否被 `AccountRouteGuardBlocksAuth` 阻断。
2. 若已阻断，handler 释放 pin，设置下一轮完整 transcript replay，并关闭当前 execution session 的旧 upstream 资源；downstream WebSocket 连接继续保留。
3. 本轮请求重新进入 AuthManager 选路，RoutePolicy 会剔除 guarded auth。
4. `CodexWebsocketsExecutor.ensureUpstreamConn` 在同 execution session 内发现新 `authID` / `wsURL` 与旧 upstream 不一致时，关闭旧 conn 并重新握手。

该语义不尝试在同一条正在 streaming 的 response 中途迁移账号；中途迁移仍属于取消/重放语义，需要单独设计。

### 会话沉淀规则

本轮沉淀为账号路由领域 skill，而不上升到 `AGENTS.md`：

1. 手动禁用、自动限流、后续高延迟短期跳过都应优先建模为 Route Guard source，而不是分散修改 selector、scheduler 或请求中间件。
2. WebSocket 相关 guard 必须同时检查两层状态：候选过滤只能影响新选路；`pinnedAuthID` / execution session / upstream conn 需要在请求轮次边界释放或重建。
3. P2 热切验收不能只看 RoutePolicy deny。必须证明 downstream WebSocket 连接保留、新 auth 被选中、旧 `previous_response_id` 不泄漏、同 session upstream 重新握手。
4. 中途 streaming 迁移不属于 Route Guard P2，必须作为取消/重放能力单独设计。

## Codex 账号列表接入

`CodexAccountListFeature` 的路由策略调试区面向用户展示页面 row id，例如 `auth-file:auth.json`、`codex-api-key:<local-id>`、`openai-compatible:<name>`。这些 id 只属于 GetTokens UI，不直接暴露 sidecar 内部 auth id。

后端 `ProbeCodexAccountRouting` 负责在发起测试请求前做一次翻译：

- auth-file row id 翻译为 sidecar auth file id，即 auth 目录下的文件名。
- codex-api-key row id 通过 sidecar stable id 规则翻译为 `codex:apikey:<hash>`。
- openai-compatible provider row id 可能对应多个 API key auth，后端按 sidecar stable id 规则展开为多个 `openai-compatibility:<provider>:<hash>`。

页面只提交 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback`，真实 relay 请求由后端写入 `X-GetTokens-Route-*` header。这样 UI 不依赖 sidecar hash 细节，也便于后续把高延迟 overlay 做成同一策略输入的一部分。

## 后续扩展

高延迟短期跳过账号应作为 GetTokens 的 route policy overlay 实现：维护 `authID -> blockedUntil`，在候选重写时追加 `DenyIDs` 或过滤候选，不需要继续修改上游 selector 主逻辑。
