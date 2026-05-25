# 既有账号路由逻辑清理清单 v01

日期：2026-05-24

## 目标

本清单用于约束 Account Routing Engine rollout 中必须一起清理的旧实现。目标不是删行为，而是保留用户可见语义并收敛实现入口。

清理完成后，新增自定义端点路由和已有禁用、限流、请求级覆盖、session affinity、WebSocket 热切都应通过同一套 route engine / policy pipeline 被解释和测试。

## 必须保留的行为

- `round-robin` 和 `fill-first` 选择结果与旧逻辑兼容。
- priority 仍先于同级选择器生效。
- disabled、cooldown、model availability 不能被请求级 allow/order 绕过。
- manual-disabled 和 rate-limit source 独立，自动恢复不清用户手动禁用。
- `X-GetTokens-Route-*` loopback header 和 executor metadata 调试入口继续可用。
- retry/fallback 继续通过 `tried` 排除已尝试账号后重新选择。
- Codex WebSocket pinned auth 在下一条 downstream request 边界释放，不做 mid-response 迁移。

## 清理项

### 1. Hook 安装点

现状风险：

- `InstallRoutePolicyHook()`、`InstallUsageAttributionHook()`、`InstallRateLimitHook()` 存在定义，但源码检索时未看到明确生产启动调用。

目标：

- 在 sidecar server 启动链路中建立明确安装点。
- 安装点必须幂等，避免重复注册 policy。
- 增加启动路径测试，防止未来合并上游时丢失。

验收：

- 启动后默认 route policy snapshot 包含 GetTokens request policy 和 account guard policy。
- usage attribution 与 rate-limit evaluator 在配置启用时安装。
- 禁用相关配置时不会留下无效 goroutine 或重复 cleanup。

### 2. Rate-limit 双路径

现状风险：

- `RateLimitEvaluator.EvaluateNow()` 会刷新 `AccountRouteGuardSourceRateLimit`。
- `InstallRateLimitHook()` 同时注册 `rateLimitPolicy`，该 policy 直接从 evaluator 输出 `DenyIDs`。
- 两条路径都能 deny 候选，行为接近但职责重复。

目标：

- 收敛为一个权威热路径出口：优先使用 `AccountRouteGuardStore` 的 `rate-limit` source。
- `RateLimitEvaluator` 只负责评估、刷新 guard source、写事件。
- 若短期保留 `rateLimitPolicy`，必须标记为兼容层并在 engine 接管后删除。

验收：

- block、warn、recovery、rule delete cleanup 测试全部通过。
- route trace 中 rate-limit 只出现一次过滤步骤。
- 自动恢复不会清理 manual-disabled source。

### 3. RoutePolicy 兼容层

现状风险：

- 现有 `RoutePolicy` 是候选重写口子，Codex/Claude 路由探测依赖 metadata/header。
- 新 engine 若绕过它，会破坏旧调试能力；若并行保留，会形成两套策略链。

目标：

- 将旧 `RoutePolicyDecision` 映射为 engine 的 `RequestPolicy`。
- `gettokensRoutePolicy` 继续解析 metadata/header，但只作为输入适配层。
- `accountRouteGuardPolicy` 迁移为 `HardFilterPolicy`，或作为兼容 shim 调用 engine guard。

验收：

- allow/deny/order/fallback 旧测试不变。
- loopback header 仍只接受本机请求。
- 远端请求不能通过 header 注入路由控制。

### 4. Session affinity wrapper

现状风险：

- `SessionAffinitySelector` 包装 `RoundRobinSelector` / `FillFirstSelector` 后，`useSchedulerFastPath()` 返回 false。
- 启用 session affinity 时可能绕过 scheduler fast path 和 RoutePolicy 主路径。

目标：

- 将 session affinity 迁移为 engine `StickyPolicy`。
- cache hit 只在 auth 仍可用且未被 guard/cooldown/model state 排除时生效。
- cache miss 再进入 selector。

验收：

- 同 session 命中同一账号。
- sticky auth 被禁用、限流或冷却后失效重选。
- trace 展示 sticky hit/miss/reselect 原因。

### 5. WebSocket pinned auth 特例

现状风险：

- WebSocket handler 和 executor 中保留必要特例，但容易和新 engine 形成重复逻辑。

目标：

- 保留请求边界处理，但将“重新选择”统一进入 `AccountRoutingEngine.Route()`。
- pinned auth guarded 检查使用同一 HardFilterPolicy / guard state。
- executor 继续保证 authID / wsURL 变化时关闭旧 upstream 并重新握手。

验收：

- pinned auth 被 manual-disabled 或 rate-limit 命中后释放。
- downstream WebSocket 保留，旧 upstream 关闭，新 auth 重新握手。
- transcript replay 不携带旧 `previous_response_id`。

### 6. 文档与测试命名

现状风险：

- 旧文档中仍使用“route policy”、“rate-limit middleware”等名称，容易让后续实现误解为 HTTP middleware。

目标：

- 保留历史文档，但在新文档中明确旧名称与新 engine 的关系。
- 新测试命名统一使用 route engine / policy pipeline / guard source。
- 旧测试可保留，但新增兼容层说明。

验收：

- `docs-linhay/dev/20260513-sidecar-route-policy.md` 增补跳转或说明。
- 本 space README 和 implementation plan 指向本清理清单。
- qmd 可检索到“AccountRoutingEngine 清理旧 RoutePolicy / rate-limit / session affinity”。

## 一次性清理顺序

1. 先补测试锁定旧行为。
2. 补齐 hook 安装点。
3. 建 engine 空策略兼容层，证明无行为变化。
4. 迁移 request `RoutePolicy` 为 `RequestPolicy`。
5. 迁移 account guard 为 `HardFilterPolicy`。
6. 收敛 rate-limit 双路径。
7. 迁移 session affinity 为 `StickyPolicy`。
8. 接入 endpoint policy。
9. 保留 WebSocket request-boundary hook，但统一重选入口。
10. 清理旧文档引用和测试命名。

## 不做的清理

- 不删除 `RoutePolicy` 公共抽象，除非确认上游不需要且所有调用已迁移；短期应作为兼容 API 保留。
- 不重写 scheduler 全部实现；只加稳定 seam。
- 不把 WebSocket mid-response 迁移纳入本期。
- 不迁移无关账号 UI 或 quota 展示逻辑。
