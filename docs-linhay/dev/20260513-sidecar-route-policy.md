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

## Codex 账号列表接入

`CodexAccountListFeature` 的路由策略调试区面向用户展示页面 row id，例如 `auth-file:auth.json`、`codex-api-key:<local-id>`、`openai-compatible:<name>`。这些 id 只属于 GetTokens UI，不直接暴露 sidecar 内部 auth id。

后端 `ProbeCodexAccountRouting` 负责在发起测试请求前做一次翻译：

- auth-file row id 翻译为 sidecar auth file id，即 auth 目录下的文件名。
- codex-api-key row id 通过 sidecar stable id 规则翻译为 `codex:apikey:<hash>`。
- openai-compatible provider row id 可能对应多个 API key auth，后端按 sidecar stable id 规则展开为多个 `openai-compatibility:<provider>:<hash>`。

页面只提交 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback`，真实 relay 请求由后端写入 `X-GetTokens-Route-*` header。这样 UI 不依赖 sidecar hash 细节，也便于后续把高延迟 overlay 做成同一策略输入的一部分。

## 后续扩展

高延迟短期跳过账号应作为 GetTokens 的 route policy overlay 实现：维护 `authID -> blockedUntil`，在候选重写时追加 `DenyIDs` 或过滤候选，不需要继续修改上游 selector 主逻辑。
