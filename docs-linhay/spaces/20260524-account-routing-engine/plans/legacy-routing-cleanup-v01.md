# 既有账号路由逻辑清理清单 v01

日期：2026-05-24

## 目标

本清单用于约束 Account Routing Engine rollout 中必须一起清理的旧实现。目标不是删行为，而是保留用户可见语义并收敛实现入口。

清理完成后，新增自定义端点路由和已有禁用、限流、session affinity、WebSocket 热切都应通过同一套 GetTokens route engine / policy pipeline 被解释和测试。旧 CLIProxyAPI `RoutePolicy` 兼容接口、`X-GetTokens-Route-*` header 和 executor metadata allow/deny/order/fallback 调试入口不再作为保留目标。

## 必须保留的行为

- `round-robin` 和 `fill-first` 选择结果与旧逻辑兼容。
- priority 仍先于同级选择器生效。
- disabled、cooldown、model availability 不能被请求级 allow/order 绕过。
- manual-disabled 和 rate-limit source 独立，自动恢复不清用户手动禁用。
- 不再保留 `X-GetTokens-Route-*` loopback header 和 executor metadata allow/deny/order/fallback 调试入口；调试和探测改走 GetTokens 渠道路由、guard source 与 route engine 测试面。
- retry/fallback 继续通过 `tried` 排除已尝试账号后重新选择。
- Codex WebSocket pinned auth 在下一条 downstream request 边界释放，不做 mid-response 迁移。

## 清理项

### 历史状态（2026-05-25）

- 已完成：生产启动 hook 安装点，`RoutePolicy` 注册顺序稳定，hard guard 不能被后续 allow/order 放回。
- 已完成：`AccountRouteGuardStore` source 独立，`manual-disabled`、`rate-limit`、`auth-error`、`upstream-rate-limit`、`upstream-error` 分源管理。
- 已完成：真实执行器 `MarkResult` 通过 `AccountRouteGuardResultHook` 写入 transient guard source。
- 已完成：Codex / Claude 主 UI 不再暴露旧 allow / deny / fallback 编排；probe 只按渠道账号顺序传入 `orderAccountIDs`，旧字段保留为空作为兼容 API。
- 已完成：Wails route event ledger 有读 API，Codex / Claude Channel Routing workbench 已展示最近 route ledger。
- 已完成：`rateLimitPolicy` 兼容注册已删除，rate-limit evaluator 只刷新 `AccountRouteGuardSourceRateLimit`，热路径由 `accountRouteGuardPolicy` 统一 deny。
- 已完成：session affinity legacy path 在进入 sticky selector 前会先执行 `RoutePolicy` / engine seam，guard deny 不能被 sticky cache 或 fallback 绕过。
- 已完成：`SessionAffinitySelector` 作为 manager-local sticky policy 接入 scheduler fast path，sticky cache hit 以 `PolicyStageSticky` 排序候选，cache miss 在 selector 选中后绑定结果。
- 已完成：WebSocket pinned auth request-boundary 释放逻辑已收敛到单一 helper，统一使用 `AccountRouteGuardStore` 判断 guarded auth 并触发 transcript replay。
- 当时保留中：`RoutePolicy` 公共类型、`gettokensRoutePolicy`、`accountRouteGuardPolicy` 继续作为 selector 热路径兼容 seam。该状态已被 2026-05-30 删除结论覆盖。

### 当前状态（2026-05-30）

- 已完成：`sdk/cliproxy/auth` 删除旧公共 `RoutePolicy` / `RoutePolicyFunc` / `RoutePolicyRequest` / `RoutePolicyDecision` / `RegisterRoutePolicy` 兼容 API。
- 已完成：`internal/gettokensrouting` 成为 GetTokens 专用 policy registry，scheduler / legacy conductor 只消费 `gettokensrouting.PolicySnapshot()` 与 manager-local sticky policy。
- 已完成：`gettokensRoutePolicy`、`RouteMetadata`、`X-GetTokens-Route-*` header 解析、metadata allow/deny/order/fallback 入口和对应旧测试已删除。
- 已完成：channel routing 以 `PolicyStagePoolScope` 直接注册到 GetTokens routing registry；account route guard 以 `PolicyStageHardFilter` 注册；session affinity 以 manager-local `PolicyStageSticky` 直接进入 engine。
- 已完成：启动链路由 `InstallRoutingPolicies()` 安装 GetTokens routing policies，不再调用 CLIProxyAPI 旧 `InstallRoutePolicyHook()`。

### 1. Hook 安装点

历史风险：

- `InstallRoutePolicyHook()`、`InstallUsageAttributionHook()`、`InstallRateLimitHook()` 存在定义，但源码检索时未看到明确生产启动调用。

2026-05-25 状态：

- 已完成。`internal/cmd/run.go` 的启动链路通过 `buildGetTokensStartupHooks(configPath)` 安装 GetTokens route policy，启用 usage 时安装 usage attribution / rate-limit ledger，并有启动路径测试覆盖。

2026-05-30 状态：

- 已完成。启动链路调用 `InstallRoutingPolicies()`，安装 channel routing 和 account route guard 到 `internal/gettokensrouting`；旧 `InstallRoutePolicyHook()` 不再存在。

目标：

- 在 sidecar server 启动链路中建立明确安装点。
- 安装点必须幂等，避免重复注册 policy。
- 增加启动路径测试，防止未来合并上游时丢失。

验收：

- 启动后默认 routing policy snapshot 包含 channel routing 和 account guard policy。
- usage attribution 与 rate-limit evaluator 在配置启用时安装。
- 禁用相关配置时不会留下无效 goroutine 或重复 cleanup。

### 2. Rate-limit 双路径

历史风险：

- `RateLimitEvaluator.EvaluateNow()` 会刷新 `AccountRouteGuardSourceRateLimit`。
- `InstallRateLimitHook()` 同时注册 `rateLimitPolicy`，该 policy 直接从 evaluator 输出 `DenyIDs`。
- 两条路径都能 deny 候选，行为接近但职责重复。

目标：

- 收敛为一个权威热路径出口：优先使用 `AccountRouteGuardStore` 的 `rate-limit` source。
- `RateLimitEvaluator` 只负责评估、刷新 guard source、写事件。
- 不再保留独立 `rateLimitPolicy`；rate-limit 只作为 guard source 数据进入统一 hard guard。

2026-05-25 状态：

- 已完成。`InstallRateLimitHook()` 不再注册 `rateLimitPolicy`，也不再维护独立 cleanup 句柄；`RateLimitEvaluator` 评估后只刷新 `AccountRouteGuardSourceRateLimit`。新增测试覆盖 blocked state 在没有 `rateLimitPolicy` 时仍由 `accountRouteGuardPolicy` 输出 deny。

验收：

- block、warn、recovery、rule delete cleanup 测试全部通过。
- route trace 中 rate-limit 只出现一次过滤步骤。
- 自动恢复不会清理 manual-disabled source。

### 3. RoutePolicy 兼容层

历史风险：

- 旧 `RoutePolicy` 曾是候选重写口子，Codex/Claude 路由探测依赖 metadata/header。
- 账号路由已经由 GetTokens 自定义渠道路由接管，继续保留旧兼容层会形成两套策略链。

目标：

- 删除旧 `RoutePolicy` 公共 API 和 `gettokensRoutePolicy`。
- 删除 metadata/header allow/deny/order/fallback 调试入口。
- 将 channel routing、account guard、session affinity 直接接入 `gettokensrouting.Policy`。

2026-05-25 状态：

- 部分完成。公共 `RoutePolicy` 仍保留；它已按 stage 进入 `gettokensrouting.Engine` 的兼容执行顺序，并由 scheduler 热路径调用。新 UI 已停止产生 allow / deny / fallback 主交互，旧 header/metadata 只作为 request policy 兼容入口。

2026-05-30 状态：

- 已完成。公共 `RoutePolicy` 兼容层和旧 request policy 输入面已删除。`sdk/cliproxy/auth` 只保留内部 `routeRequest` 用于组装 `gettokensrouting.RouteContext`；策略注册、stage 排序和候选改写由 `internal/gettokensrouting` 负责。

验收：

- 源码检索不到 `RoutePolicyRequest`、`RoutePolicyDecision`、`RegisterRoutePolicy`、`RouteMetadata`、`X-GetTokens-Route-*`。
- scheduler fast path、legacy conductor path、mixed provider path 都从 `gettokensrouting.PolicySnapshot()` 取策略。
- hard guard 不能被后续 request/order/sticky 绕过。

### 4. Session affinity wrapper

历史风险：

- `SessionAffinitySelector` 包装 `RoundRobinSelector` / `FillFirstSelector` 后，`useSchedulerFastPath()` 返回 false。
- 启用 session affinity 时可能绕过 scheduler fast path 和当时的 RoutePolicy 主路径。

目标：

- 将 session affinity 迁移为 engine `StickyPolicy`。
- cache hit 只在 auth 仍可用且未被 guard/cooldown/model state 排除时生效。
- cache miss 再进入 selector。

2026-05-25 状态：

- 已完成主线收敛。Wails explain 已覆盖 `stickyAccountID` 失效与激活非抢占语义；普通 session affinity 已作为 manager-local `PolicyStageSticky` 接入 scheduler fast path，cache hit 通过 route engine 排序候选，cache miss 在 selector 选中后绑定结果。WebSocket pinned auth 的连接生命周期边界见第 5 节，已收口为 request-boundary helper。

验收：

- 同 session 命中同一账号。
- sticky auth 被禁用、限流或冷却后失效重选。
- trace 展示 sticky hit/miss/reselect 原因。

### 5. WebSocket pinned auth 特例

历史风险：

- WebSocket handler 和 executor 中保留必要特例，但容易和新 engine 形成重复逻辑。

目标：

- 保留请求边界处理，但将“重新选择”统一进入 `AccountRoutingEngine.Route()`。
- pinned auth guarded 检查使用同一 HardFilterPolicy / guard state。
- executor 继续保证 authID / wsURL 变化时关闭旧 upstream 并重新握手。

2026-05-25 状态：

- 已完成边界收口。WebSocket request-boundary helper 使用同一 `AccountRouteGuardStore` 判断 pinned auth 是否 guarded，命中后释放 pin、关闭旧 execution session、强制 transcript replay，并有 pinned auth release、旧 upstream close、transcript replay、`previous_response_id` 清理测试覆盖。该特例保留为连接生命周期边界，不再作为另一套路由规则实现。

验收：

- pinned auth 被 manual-disabled 或 rate-limit 命中后释放。
- downstream WebSocket 保留，旧 upstream 关闭，新 auth 重新握手。
- transcript replay 不携带旧 `previous_response_id`。

### 6. 文档与测试命名

历史风险：

- 旧文档中仍使用“route policy”、“rate-limit middleware”等名称，容易让后续实现误解为 HTTP middleware。

目标：

- 保留历史文档，但在新文档中明确旧名称与新 engine 的关系。
- 新测试命名统一使用 route engine / policy pipeline / guard source。
- 旧测试和文件命名不再保留旧 RoutePolicy 术语；历史文档保留废弃说明。

验收：

- `docs-linhay/dev/20260513-sidecar-route-policy.md` 增补跳转或说明。
- 本 space README 和 implementation plan 指向本清理清单。
- qmd 可检索到“AccountRoutingEngine 清理旧 RoutePolicy / rate-limit / session affinity”。

2026-05-30 状态：

- 已完成。`20260513-sidecar-route-policy.md` 已标记为历史废弃文档；space README、实施计划和技术边界已写明旧 `RoutePolicy` 和 request-level 注入入口删除结论。
- 已完成。sidecar 源码文件名与测试 fixture 已从 `route_policy` / `routing-policy-*` 收敛为 `routing_policy` / `routing-engine-*`。

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
10. 删除旧 CLIProxyAPI RoutePolicy 兼容 API、header/metadata 调试入口和旧测试。
11. 清理旧文档引用和测试命名。

## 不做的清理

- 已废止：不再保留 `RoutePolicy` 公共抽象；本版本开始 GetTokens sidecar 与 CLIProxyAPI 上游路由系统断开。
- 不重写 scheduler 全部实现；只加稳定 seam。
- 不把 WebSocket mid-response 迁移纳入本期。
- 不迁移无关账号 UI 或 quota 展示逻辑。
