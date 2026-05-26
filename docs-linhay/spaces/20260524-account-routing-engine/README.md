# Account Routing Engine

## 背景

sidecar 现有账号轮动能力已经包含 `round-robin`、`fill-first`、priority、cooldown、manual-disabled guard、rate-limit guard、请求级 `RoutePolicy`、retry/fallback 和 Codex WebSocket pinned auth 热切。

这些能力的核心热路径已经部分归一到 `authScheduler + RoutePolicy`，但仍存在三个长期风险：

1. 自定义端点路由即将上线，如果继续把规则散落到 handler、selector、scheduler 或 executor，后续维护成本会快速上升。
2. `session-affinity` 目前作为 selector wrapper 存在，会绕过 scheduler fast path，和 `RoutePolicy` 主路径不完全一致。
3. GetTokens 维护 CLIProxyAPI fork，后续合并上游时需要稳定扩展边界，不能在上游核心文件中持续堆业务判断。

本 space 用于规划并分阶段落地 `Account Routing Engine`：把“路由上下文归一化 -> 账号候选 -> 策略改写 -> 账号选择 -> 执行器”收敛为一个可解释、可重试、可观测、低冲突的路由决策入口。

本期同时承担一次性清理任务：把过去已经实现但散落在 `RoutePolicy`、`AccountRouteGuardStore`、rate-limit policy、session affinity selector、WebSocket pinned auth 和启动 hook 中的 GetTokens 路由逻辑重新归档到统一边界内。新端点路由上线前必须完成这轮清理，否则后续会形成两套路由系统。

## 目标

1. 建立统一 `AccountRoutingEngine`，承载账号路由决策，而不是把自定义端点路由做成普通 HTTP middleware。
2. 把 manual-disabled、rate-limit、自定义端点路由、请求级 allow/deny/order/fallback、session affinity 归一为 policy pipeline。
3. 简化用户可理解的路由语义：先由账号状态、排序值、归属组和组级状态/排序确定可路由账号池，再按顺序、均衡两种模式选择账号；项目名绑定保留为兼容数据，但不再作为当前前端可见路由模式。
4. 支持 dry-run / explain：用户或开发者可在不请求上游的情况下看到候选账号、过滤原因、排序和最终选择。
5. 支持 shadow mode：新策略先并行计算并记录差异，不立即接管真实请求。
6. 将持久化账号状态、路由规则、运行态快照、请求级临时状态分层，保证热路径快速决策。
7. 调整 sidecar fork 合并策略：上游核心文件只保留稳定 seam，GetTokens 自定义逻辑集中在 GetTokens-owned 包。
8. 一次性清理既有账号路由实现：保留可验证行为，收敛实现入口，删除或降级重复路径。
9. 明确产品 ownership：按 `Account Inventory / Channel Routing / Routing Engine` 三层拆分；总账号池只负责账号和账号组资产管理，Codex / Claude 账号列表分别负责本渠道的排序、路由模式、路由说明和探测。
10. 区分全局组状态和渠道组状态：全局组禁用影响所有渠道，渠道组禁用只影响当前渠道。
11. 明确启停实时性：账号或有效组禁用立即生效，高于 session sticky、失败降级和 retry；已有流式连接在最近可控边界断开。账号或有效组激活只重新进入可路由池，不抢占当前 stream / sticky，等待下一轮 route 或 retry 自然选择。
12. 持久化失败冷却状态：401/429/5xx/model-unavailable 等执行结果由 `ResultRecorder / MarkResult` 写入账号运行态或 guard source，供后续请求、retry 和 explain 共同读取。

## 范围

- sidecar / CLIProxyAPI fork：
  - 新增 `AccountRoutingEngine` 或等价包，作为账号路由决策统一入口。
  - 设计 `RouteContext`、`RouteDecision`、`RouteTrace`、`CompiledRouteSnapshot`。
  - 将 endpoint route policy、guard policy、request override、sticky policy 纳入 pipeline。
  - 修复或确认 `InstallRoutePolicyHook`、usage attribution、rate-limit hook 的生产启动安装点。
  - 将 rate-limit 双路径收敛为统一 guard source 输出，避免重复 deny。
  - 将 session affinity 从 selector wrapper 迁移或适配到 engine pipeline，避免绕过 scheduler fast path。
  - 清理既有 `RoutePolicy` / `AccountRouteGuardStore` / `rateLimitPolicy` 的重复职责，明确哪些保留为兼容层、哪些迁移为 engine policy。
  - 建立 `RouteableAccountPool` 规则：账号激活状态、请求可用状态、账号排序、账号归属组、组级启停和组级排序共同决定可路由账号池和基础顺序。
  - 区分 `inventoryGroup.enabled` 与 `channelGroup.enabled`，避免 Codex / Claude 共用账号组时互相影响渠道启停范围。
  - 建立三类核心路由模式：`sequential`、`balanced`、`project`。`dedicated / prefer / ordered / weighted / canary` 不进入新的 GetTokens 路由逻辑，只作为合并上游功能时的兼容语义保留在边界层；`exclude` 仅作为请求级 deny / 过滤输入，不作为路由模式。
  - 保留 Codex WebSocket 请求边界特例：释放 pinned auth、关闭旧 upstream、transcript replay、重新选择。
- GetTokens backend / Wails：
  - 暴露自定义端点路由规则的读取、保存、验证、dry-run/explain API。
  - 透出 route event / decision trace / snapshot version，供前端调试和观测。
  - 保持 root `main.App` 绑定边界，新增 Wails 方法必须经过 root facade 和 generated binding。
- Frontend：
  - 总账号池只提供账号和账号组的增删改查、启停、弃用、排序和基础状态展示；不提供账号轮动编排。
  - `codex - 账号列表` 负责 Codex 渠道的账号请求顺序、路由模式、项目绑定、路由说明和路由探测；路由模式当前仅暴露 `sequential / balanced`。
  - `claude - 账号列表` 负责 Claude Code 渠道的账号请求顺序、路由模式、项目绑定、路由说明和路由探测；路由模式当前仅暴露 `sequential / balanced`。
  - Codex / Claude 可以引用同一个账号组，但各自维护渠道组启停和渠道排序。
  - dry-run/explain 保留为高级诊断能力，默认不作为普通用户主界面内容。
  - 路由工作台已改为“请求模式 + 参与账号”的扁平布局：主路径只回答当前是什么模式、该模式下哪些账号会参与；`参与账号` 默认收起，只显示数量，内部只用分隔线、模式按钮和账号列表，不再做 summary rail、命中图表、过滤图表或卡中卡。
  - Shadow 对照、兼容输入、解释步骤、候选/过滤结果和最近路由默认收进 `高级诊断`，维护者需要排查时再展开。
  - 支持 shadow mode 差异展示和策略启用状态。
  - browser preview 可用，不依赖真实 Wails runtime。
- 文档 / 测试 / 治理：
  - 补充 route engine 架构文档、上游合并敏感区清单、回归测试矩阵。
  - 补齐旧逻辑迁移清单和删除清单，避免后续维护者误用旧入口。
  - 每个阶段按 BDD/TDD：先验收场景，再失败测试，再实现。

## 非目标

- 不把账号阻断做成普通 Gin / HTTP middleware；账号阻断必须保留 selector fallback 和 retry 能力。
- 不在本期实现 streaming 中途迁移账号；WebSocket 只在下一条 downstream request 边界切换。
- 不把账号激活做成主动抢占；激活只让账号进入后续候选池，不切换当前正在工作的账号。
- 不把所有执行结果回写塞进路由引擎；`Executor -> MarkResult -> RetryController` 仍是独立阶段。
- 不要求一次性重写所有 scheduler / selector 代码；先建立 seam 和兼容层，再逐步迁移。
- 不把请求 payload、凭证、bearer token、cookie 或完整错误体写入 route event ledger。

## 验收标准

1. Given 用户配置自定义端点路由规则，When 请求进入 sidecar，Then 规则通过 `AccountRoutingEngine` 改写候选账号，而不是在 HTTP handler 中直接返回失败。
2. Given 某账号被手动禁用，When endpoint route rule 指定该账号为 allow/order，Then hard guard 仍优先拒绝该账号，不能被请求级规则放回。
3. Given 某账号被 rate-limit block，When rate-limit window 恢复，Then 只清理 `rate-limit` source，不影响用户手动禁用 source。
4. Given 路由规则指定目标账号组且模式为顺序模式，When 候选账号不可用，Then 路由结果按 retry/fallback 配置继续尝试下一个账号或明确失败，并给出 trace。
5. Given 路由规则指定目标账号组且模式为均衡模式，When 多个账号可用，Then selector 不使用上游 `weighted/prefer` 语义，而是只按当前会话数和有效排序选择。
6. Given 用户执行 dry-run/explain，When 输入 provider、model、endpoint、transport 和 metadata，Then 返回候选数量、过滤原因、排序步骤、最终选择或失败原因，且不请求上游。
7. Given shadow mode 开启，When 新策略与当前真实选择不同，Then 记录差异事件，但真实请求仍按当前生产策略执行。
8. Given session affinity 开启，When 同一 session 多次请求，Then sticky 决策通过 route engine trace 可解释；当 sticky auth 被 guard 命中时自动失效重选。
9. Given Codex WebSocket 当前 pinned auth 被 guard 命中，When 下一条 downstream request 到达，Then handler 释放 pin、关闭旧 upstream、强制 transcript replay，并通过 route engine 重新选择账号。
10. Given 执行器返回 429/401/5xx 或模型不可用，When `MarkResult` 回写状态，Then retry loop 带 `tried` 再次进入同一个 route engine 入口。
11. Given 合并上游 CLIProxyAPI，When 上游修改 scheduler/conductor/selector，Then GetTokens 自定义端点路由主要集中在 GetTokens-owned 包，冲突面限定在稳定 seam。
12. Given 前端普通浏览器打开 preview，When 没有 Wails runtime，Then 可编辑 preview 规则、执行 dry-run mock、查看 explain，不出现空白页。
13. Given 旧的 rate-limit deny 逻辑同时存在 evaluator policy 和 guard source，When 清理完成，Then 热路径只保留一个权威 deny 出口，测试证明 block/recovery 行为不变。
14. Given session affinity 开启，When 清理完成，Then 它不再绕过统一 route engine；同一 session 命中、失效重选和 guarded auth 释放都有 trace。
15. Given `InstallRoutePolicyHook`、usage attribution、rate-limit hook 过去只在定义处可见，When 清理完成，Then 生产启动链路有明确安装点和自动化测试覆盖。
16. Given 旧 `RoutePolicy` header/metadata 调试入口仍被 Codex/Claude 路由探测使用，When 清理完成，Then 这些入口作为兼容 RequestPolicy 保留，行为和旧测试一致。
17. Given 账号启用但处于异常或冷却，When 构建可路由账号池，Then 该账号保留在配置和解释结果中，但不进入本次可请求候选。
18. Given 账号属于多个启用组，When 构建路由顺序，Then 按匹配规则选定的目标组计算有效组排序，再按账号排序值升序排列；同排序值使用稳定账号 ID 作为 tie-breaker。
19. Given 某账号所在目标组被禁用，When 该组被路由规则选中，Then 该账号不进入该组的可路由池；如果账号也属于其他启用组，只有其他组被选中时才可参与路由。
20. Given 路由模式为顺序模式，When 请求失败且允许 retry，Then 按有效顺序尝试下一个可路由账号。
21. Given 路由模式为均衡模式，When 多个账号可用，Then 优先选择当前会话数最低的账号；会话数相同再按有效排序值决定。
22. Given 路由模式为项目模式，When 请求携带项目名且项目绑定了账号组或账号，Then 优先使用该绑定；绑定目标不可用时按配置决定失败或回退到默认模式。
23. Given 用户在总账号池修改账号或账号组，When 保存成功，Then 只影响账号资产、账号组资产、启停/弃用和基础排序，不直接修改 Codex 或 Claude 的渠道轮动配置。
24. Given 用户在 Codex 账号列表调整排序或路由模式，When 保存成功，Then 只影响 Codex 渠道路由，不改变 Claude 渠道排序，也不改变总账号池的资产排序。
25. Given 用户在 Claude 账号列表调整排序或路由模式，When 保存成功，Then 只影响 Claude 渠道路由，不改变 Codex 渠道排序，也不改变总账号池的资产排序。
26. Given 用户查看路由说明，When 当前在 Codex 或 Claude 账号列表，Then 页面解释的是该渠道的可路由池、排序、模式和 fallback，而不是总账号池的全局排序。
27. Given 总账号池禁用某账号组，When Codex 或 Claude 引用该组，Then 两个渠道都不能从该组产生候选。
28. Given Codex 渠道禁用某账号组，When Claude 渠道仍启用该组，Then Codex 不从该组产生候选，但 Claude 仍可按自身渠道配置使用该组。
29. Given 项目模式命中账号组，When 该组内有多个可路由账号，Then 项目绑定只负责限定目标池，组内选择继续按该渠道配置的 `sequential` 或 `balanced` 执行。
30. Given 某账号已被 session sticky 或 WebSocket pinned auth 占用，When 用户禁用该账号或其有效组，Then sticky / pin 立即失效；当前流式连接在最近可控边界断开，后续请求重新进入 route engine。
31. Given 某账号或账号组从禁用切回激活，When 当前已有其他账号承载 stream / sticky，Then 不主动抢占或迁移当前连接；该账号只进入下一轮 route / retry 的可路由账号池。
32. Given 某账号因 401/429/5xx/model-unavailable 进入失败冷却，When 后续请求进入路由引擎，Then 该冷却状态从持久化运行态或 guard source 读取；冷却到期只恢复对应 source，不清除用户禁用状态。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 请求调用图：`screenshots/20260524/routing/20260524-routing-account-routing-engine-diagram-baseline-v01.png`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260524-account-routing-engine`
- worktree：`../GetTokens-worktrees/20260524-account-routing-engine/`

## 相关链接

- [Sidecar Route Policy](../../dev/20260513-sidecar-route-policy.md)
- [Account Routing Engine 技术边界](../../dev/20260524-account-routing-engine.md)
- [实施计划 v01](./plans/implementation-plan-v01.md)
- [routing.strategy 完整绕过实施计划 v01](./plans/routing-strategy-bypass-v01.md)
- [实施准备清单 v01](./plans/implementation-readiness-v01.md)
- [实施记录 v01](./plans/implementation-log-v01.md)
- [前端重做范围 v01](./plans/frontend-rewrite-scope-v01.md)
- [既有逻辑清理清单](./plans/legacy-routing-cleanup-v01.md)
- [账号限流策略中间件 v5](../20260515-rate-limit-middleware/plans/20260515-rate-limit-middleware-plan-v05.md)
- [Claude Code Account List](../20260519-claude-code-account-list/README.md)
- [Codex Live Session Current Account](../20260523-codex-live-session-current-account/README.md)

## 当前状态
- 状态：implementation-ready
- 最近更新：2026-05-26
- 2026-05-26 补充：Codex / Claude 的 channel routing 进入“完整绕过 `routing.strategy`”收口，后续以 `channel-routing` 快照作为唯一决策源；旧 `config.yaml` 只保留 legacy relay 边界，不再参与渠道路由主路径。
- 2026-05-26 补充：Codex 账号列表的旧 `session-affinity` / `websocket-pin` / `route-order-header` 现在只作为 `兼容层提示` 的总数与说明呈现，不写入新的 `ChannelRoutingConfig`，也不展开三条明细，以便后续继续和上游代码保持最小合并面。
- 2026-05-26 补充：Codex / Claude 路由工作台主界面进一步降噪，只保留当前请求模式和参与账号列表；诊断、预演、Shadow、候选/过滤和最近路由默认隐藏。验收截图：`screenshots/20260526/codex/20260526-channel-routing-workbench-desktop-after-v05.png`、`screenshots/20260526/codex/20260526-channel-routing-workbench-mobile-collapsed-after-v05.png`。

## 实施入口

下一步从 [实施准备清单 v01](./plans/implementation-readiness-v01.md) 继续执行。批次 1 已完成前端边界红灯测试与模型骨架，批次 2 已完成 route policy 顺序与 hard guard 回归，批次 3 已完成 sidecar 路由引擎骨架与最小闭环，记录见 [实施记录 v01](./plans/implementation-log-v01.md)。下一批进入 engine seam 接入、hook 安装点测试和旧逻辑收敛。
