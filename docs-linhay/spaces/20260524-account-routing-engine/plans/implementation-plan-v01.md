# Account Routing Engine 实施计划 v01

日期：2026-05-24

> 2026-05-30 收口状态：本计划中的“先兼容再迁移”和 `RoutePolicy` 兼容层描述已经完成并废弃。当前实现不再保留 CLIProxyAPI 公共 `RoutePolicy` / `RegisterRoutePolicy`，也不再保留 `X-GetTokens-Route-*` 与 executor metadata allow/deny/order/fallback 请求级注入入口。后续路由系统由 `internal/gettokensrouting` 独立维护。

## 规划原则

1. 统一入口，不做大函数：`AccountRoutingEngine.Route()` 是唯一决策入口，内部仍按 candidate、policy、selector、trace 分层。
2. 热路径只读快照：路由引擎不直接查 DB、不解析大配置、不写持久化状态。
3. 结果回写后置：执行后的 quota、cooldown、model state 由 `ResultRecorder / MarkResult` 更新，retry 再带 `tried` 进入路由引擎。
4. 独立维护：从 2026-05-30 起不再保留旧 `RoutePolicy` 兼容层；新能力直接进入 `internal/gettokensrouting`。
5. 上游合并优先：GetTokens 自定义逻辑集中到 GetTokens-owned 包，上游核心文件只保留 seam。
6. 新旧同轮清理：本次 rollout 不允许留下两套路由系统；rate-limit、session affinity、WebSocket request-boundary 逻辑必须有明确归属。
7. 启停语义不对称：禁用立即生效并高于 sticky / 失败降级 / retry；激活只让账号进入下一轮候选池，不抢占当前 stream 或 sticky。
8. 失败冷却持久化：401/429/5xx/model-unavailable 等执行结果必须写入运行态或 guard source，后续请求和 explain 从同一状态源读取。

## 总体链路

```text
HTTP / WebSocket Handler
  -> RouteContextBuilder
  -> AccountRoutingEngine.Route()
       -> CandidateProvider
       -> CompiledRouteSnapshot
       -> PolicyPipeline
       -> SelectorAdapter
       -> DecisionTrace
  -> ProviderExecutor.Execute()
  -> ResultRecorder.MarkResult()
  -> RetryController
       -> with tried auths, re-enter AccountRoutingEngine.Route()
```

WebSocket 特例：

```text
BeforeRoute(WebSocket boundary)
  -> pinned auth guarded?
  -> release pin + close upstream + transcript replay
  -> AccountRoutingEngine.Route()
```

启停特例：

```text
Disable account / group
  -> update inventory or channel state
  -> rebuild CompiledRouteSnapshot
  -> invalidate sticky / pinned auth
  -> disconnect active stream at nearest controlled boundary
  -> next request re-enter AccountRoutingEngine.Route()

Enable account / group
  -> update inventory or channel state
  -> rebuild CompiledRouteSnapshot
  -> account re-enters routeable pool
  -> wait for next route / retry selection
```

## P0：sidecar seam 与路由引擎骨架

目标：先让新架构有稳定入口，并锁定旧行为；不立即改变生产行为。

任务：

- 新增 GetTokens-owned 包，例如 `internal/gettokensrouting`。
- 定义核心 DTO：
  - `RouteContext`
  - `RouteRequest`
  - `RouteResult`
  - `RouteDecision`
  - `RouteDecisionStep`
  - `CompiledRouteSnapshot`
- 在 `authScheduler` / `Manager` 现有选路点增加最小 seam，允许 GetTokens engine 接管候选改写。
- 明确 hook 安装点，确认并补齐：
  - `InstallRoutingPolicies`
  - `InstallUsageAttributionHook`
  - `InstallRateLimitHook`
- 保持 routing registry 的 order/allow/deny/hard-filter 测试通过。
- 新增 trace 基础结构，但 P0 可只在测试和日志中使用。
- 建立旧逻辑清理基线，按 [既有账号路由逻辑清理清单](./legacy-routing-cleanup-v01.md) 标记每个旧入口的归属。

测试：

- routing registry 测试：allow、deny、order、hard-filter、fallback。
- hook 安装测试：启动路径必须安装 GetTokens routing policies。
- engine 空策略测试：无自定义策略时选择结果与旧逻辑一致。
- hard guard 优先级测试：manual-disabled/rate-limit 不可被 allow/order 放回。
- 旧路径删除测试：旧 request-level 注入入口不再影响 routing engine。

## P0.5：既有逻辑一次性清理

目标：在 endpoint policy 正式接入前，先消除已经存在的重复或旁路实现。

任务：

- 补齐 hook 安装点并做幂等保护。
- 删除 `gettokensRoutePolicy` 和 request-level metadata/header 注入入口。
- 将 `accountRouteGuardRoutingPolicy` 映射为 engine `HardFilterPolicy`，保持 `AccountRouteGuardStore` source 独立。
- 收敛 rate-limit 双路径：
  - evaluator 负责评估与刷新 `rate-limit` guard source。
  - 热路径 deny 统一从 guard policy 输出。
  - 旧 `rateLimitPolicy` 标记为待删除兼容层或直接移除。
- 将 `SessionAffinitySelector` 的 sticky 语义迁移为 `StickyPolicy`。
- WebSocket handler 保留 request-boundary hook，但重选统一进入 engine。
- 更新旧 route policy / rate-limit 文档中的废弃状态与新边界说明。

测试：

- manual-disabled 与 rate-limit source independence。
- rate-limit block/recovery/delete cleanup 只出现一次 deny trace。
- session affinity hit/miss/guarded reselect。
- 禁用账号或禁用组会清理 sticky / pinned auth，并在最近可控边界断开当前流。
- 激活账号或账号组只进入下一轮候选池，不抢占当前 sticky / stream。
- WebSocket pinned auth release 后通过 engine 重新选择。
- Codex/Claude route probe 不再依赖 metadata/header 兼容入口。

## P1：Routeable Account Pool 与核心路由模式

目标：先把产品语义收敛为“可路由账号池 + 三种路由模式”，再把自定义端点路由接入统一 policy pipeline。

产品 ownership：

- 领域分为三层：
  - `Account Inventory`：账号、账号组和资产状态。
  - `Channel Routing`：各渠道如何使用账号资产。
  - `Routing Engine`：sidecar 执行渠道配置并产出决策。

- 总账号池只负责账号资产和账号组资产：
  - 账号增删改查。
  - 账号启用 / 禁用 / 弃用。
  - 账号组增删改查。
  - 组级启用 / 禁用 / 排序。
  - 基础状态展示。
- 总账号池不负责编排账号轮动，不保存渠道级 route mode，不解释渠道级 fallback。
- `codex - 账号列表` 负责 Codex 渠道：
  - Codex 请求顺序。
  - Codex route mode：`sequential / balanced`。
  - Codex 项目名绑定账号组或账号。
  - Codex 路由说明、dry-run/explain、路由探测。
- `claude - 账号列表` 负责 Claude Code 渠道：
  - Claude 请求顺序。
  - Claude route mode：`sequential / balanced`。
  - Claude 项目名绑定账号组或账号。
  - Claude 路由说明、dry-run/explain、路由探测。
- sidecar `AccountRoutingEngine` 执行渠道规则，但不把渠道规则反写成总账号池属性。
- 组状态分两层：
  - `inventoryGroup.enabled`：全局组启停，禁用后所有渠道不可用。
  - `channelGroup.enabled`：渠道组启停，只影响当前渠道是否使用该组。

任务：

- 定义账号可路由状态模型：
  - `activation`: 用户意图，`active` / `disabled`。
  - `requestability`: 运行态，`requestable` / `error` / `cooldown` / `rate-limited` / `model-unavailable`。
  - `routeOrder`: 账号排序值，数值越低越优先。
  - `groups`: 账号归属组，可为空、单组或多组。
- 定义账号组模型：
  - `id`
  - `name`
  - `enabled`
  - `routeOrder`
  - `description`
- 定义渠道级路由配置模型：
  - `channel`: `codex` / `claude` / later provider channels。
  - `routeMode`: `sequential` / `balanced`。
  - `orderedAccountIDs`: 渠道内请求顺序。
  - `groupBindings`: 渠道内可使用的账号组。
  - `channelGroupStates`: group id -> enabled / routeOrder override。
  - `projectBindings`: projectName -> account group / account id。
  - `fallbackMode`: `fail-closed` / `fallback-default` / `fallback-global`。
  - `projectModeFallbackRouteMode`: `sequential` / `balanced`，仅用于旧项目绑定兼容路径命中组后的组内选择。
  - `explainCopy`: 渠道页面展示用说明。
- 定义可路由账号池构建顺序：
  - 请求范围过滤：provider / model / endpoint / transport / format。
  - 用户意图过滤：账号 disabled 或全局目标组 disabled 不进入候选。
  - 渠道范围过滤：目标组在当前渠道被禁用时，不进入该渠道候选。
  - 运行态过滤：异常、冷却、限流、模型不可用账号不进入本次可请求候选。
  - 组归属过滤：路由规则选中账号组时，只取该组内可路由账号。
  - 有效排序：`group.routeOrder` -> `account.routeOrder` -> stable account id。
- 定义执行结果持久化：
  - 401 / token expired / credential invalid -> `auth-error`，持久化为异常状态，直到凭证刷新或用户恢复。
  - 429 / quota / rate-limit -> `rate-limit` 或 `cooldown`，持久化过期时间，窗口恢复只清该 source。
  - 5xx / timeout / network error -> `upstream-error` 短期冷却，保留最近错误摘要。
  - model unavailable -> `model-unavailable`，按模型探测或配置变更恢复。
  - 用户手动禁用 -> `manual-disabled`，不被自动恢复逻辑清除。
- 定义两种核心路由模式：
  - `sequential`：按有效排序值从低到高尝试；retry 排除已尝试账号后继续下一个。
  - `balanced`：按账号当前会话数 / in-flight 请求数最少优先；相同负载再按有效排序。
- 定义项目绑定范围约束：按请求中的项目名绑定到账号组或账号；项目绑定只负责限定目标池，命中组后再按 `sequential` 或 `balanced` 选账号；绑定不可用时按兼容 fallback 规则处理。
- 定义端点路由规则模型：
  - `endpoint`
  - `provider(s)`
  - `model pattern`
  - `transport`
  - `channel`
  - `target group / target accounts`
  - `route mode`
  - `account ids / account groups`
  - `fallback`
  - `enabled`
- 规则变更时编译为内存快照：
  - endpoint matcher
  - provider matcher
  - account lookup
  - group lookup
  - project binding lookup
  - policy chain
  - selector hint
- 上游兼容语义处理：
  - `dedicated / prefer / ordered / weighted / canary` 不进入新路由模型，不在 UI、Wails DTO 或 engine policy 中作为可配置模式暴露。
  - 若后续合并上游带来这些字段，只在兼容边界解析、保留或忽略，并转换为 trace 中的 `ignored_upstream_mode` / `upstream_compat` 说明。
  - 新逻辑只接受 `sequential / balanced` 两种 route mode。
  - `exclude` 不作为 route mode；仅允许作为请求级 deny 或目标池过滤条件进入 `RequestPolicy` / pool filter。
- 将 endpoint policy 输出为统一 `RouteDecision`，不直接调用 executor。

测试：

- 总账号池 CRUD 不创建或修改 Codex/Claude 渠道路由配置。
- Codex 排序和 route mode 保存后不影响 Claude 渠道配置。
- Claude 排序和 route mode 保存后不影响 Codex 渠道配置。
- 总账号组禁用后，对引用该组的所有渠道都生效；渠道内排序本身不被重写。
- 渠道组禁用只影响当前渠道，不影响其他渠道对同一全局组的使用。
- 项目绑定命中账号组后，组内选择继续使用 `sequential` 或 `balanced`，不引入第三种选择器。
- 账号 active/requestable 才进入候选；disabled/error/cooldown/rate-limited 只出现在 explain 的过滤结果中。
- 组 disabled 时该组候选为空；账号多组归属时只在命中的启用组下参与路由。
- 账号排序值越低越先路由；相同排序值按 stable account id 排序。
- 顺序模式失败后按有效顺序尝试下一个账号。
- 均衡模式选择当前会话数最低账号；负载相同按有效排序。
- 项目绑定按 projectName 命中账号组或账号；绑定不可用时按 fallback 策略处理。
- 上游 `dedicated/prefer/ordered/weighted/canary` 字段不会改变新 engine 的两模式决策；若输入存在，trace 明确标记兼容处理。
- `exclude` 请求级过滤不会排空后绕过 hard guard，也不会作为第四种路由模式持久化。
- sticky 绑定账号被禁用后，禁用优先级高于 sticky 与失败降级；当前 sticky 被清理，后续按 hard filter 结果重选或失败。
- 激活账号只重新进入可路由账号池；已有 stream / sticky 不因激活而迁移或抢占。
- 失败冷却重启进程后仍能被 explain 和真实请求识别；冷却到期只恢复对应运行态 source。

## P2：Wails / Management API

目标：让 GetTokens 桌面端能管理、验证和解释路由规则。

后端任务：

- CLIProxyAPI management API：
  - list endpoint route rules
  - create/update/delete rule
  - enable/disable rule
  - dry-run/explain route
  - read route event summaries
- GetTokens Wails：
  - client DTO
  - `internal/wailsapp` method
  - root `main.App` facade
  - root DTO mapper
  - regenerated `frontend/wailsjs`
- 写入规则时做服务端校验：
  - endpoint pattern 合法
  - account id 可解析
  - fallback 语义明确
  - mode 与字段组合合法

测试：

- Go API handler tests。
- Wails facade DTO mapping tests。
- generated binding import smoke。
- dry-run 不请求上游。

## P3：Frontend 路由工作台

目标：给用户一个可操作、可解释的自定义端点路由界面。

范围依据：[前端重做范围 v01](./frontend-rewrite-scope-v01.md)。

页面边界：

- 总账号池页面保留账号和账号组资产管理，但移除轮动编排入口。
- `Codex 账号列表` 可整页重做为 Codex Channel Routing 工作台。
- `Claude Code 账号列表` 可整页重做为 Claude Channel Routing 工作台。
- Codex / Claude 复用共享 channel routing 组件，但配置、保存接口、preview 数据和 explain trace 必须按渠道隔离。
- 旧 `allow/deny/order/fallback` 只保留为请求级兼容 policy，不作为新页面主配置模型。
- 新页面不暴露 `dedicated / prefer / ordered / weighted / canary`。

页面建议：

- 入口可放在账号池或 Codex/Claude 工作区下，初期建议作为独立 `路由规则` 工作区，避免塞进账号详情。
- 主要区域：
  - 规则列表
  - 规则编辑器
  - 账号/账号组选择器
  - dry-run/explain 面板
  - shadow mode 差异面板
- browser preview 必须可用：
  - preview data
  - preview-only save
  - mock dry-run
  - visible source label

前端模型拆分：

- `features/channel-routing/model/channelRouting.ts`：渠道路由配置、模式、fallback、项目绑定 DTO。
- `features/channel-routing/model/channelRoutingValidation.ts`：两模式校验、上游兼容模式过滤、项目绑定字段组合校验。
- `features/channel-routing/model/channelRoutingSelectors.ts`：账号池预览、过滤原因、排序展示模型。
- `features/channel-routing/model/channelRoutingPreviewData.ts`：Codex / Claude browser preview 数据。
- `features/channel-routing/components/ChannelRoutingWorkbench.tsx`：共享渠道路由工作台。
- `features/channel-routing/components/RouteExplainPanel.tsx`：dry-run/explain trace 展示。
- `routeRules.ts`：规则 DTO、校验、draft normalize。
- `routeExplain.ts`：trace 展示模型。
- `routeRulePreviewData.ts`：browser preview 数据。
- `useRouteRulesSnapshot.ts`：读取规则。
- `useRouteRuleMutation.ts`：保存/启停/删除。
- `useRouteExplain.ts`：dry-run。

测试：

- Account Inventory 不渲染 `AccountRotationModal`，也不写渠道 route mode。
- Codex route mode / 顺序 / 项目绑定保存只影响 Codex channel config。
- Claude route mode / 顺序 / 项目绑定保存只影响 Claude channel config。
- `ChannelRouteMode` 只接受 `sequential / balanced`。
- 上游 `dedicated/prefer/ordered/weighted/canary` 不进入新 UI 配置保存。
- 项目绑定命中账号组后，组内选择只允许 `sequential / balanced`。
- 规则 draft normalize 单测。
- mode 字段组合校验单测。
- trace rendering 单测。
- browser preview smoke + screenshot。

## P4：Shadow Mode 与 Route Event Ledger

目标：让策略发布可灰度、可观测。

任务：

- route engine 支持 `shadow` 策略集：
  - production decision
  - shadow decision
  - diff reason
- event ledger 只存安全摘要：
  - request id
  - endpoint
  - provider
  - model
  - transport
  - selected auth id
  - filtered reason counts
  - fallback count
  - status
  - latency
  - snapshot version
  - policy version
- 不存 payload、凭证、token、cookie、完整错误体。

测试：

- shadow 不影响真实执行。
- event redaction。
- snapshotVersion / policyVersion 贯穿 trace。

## P5：上游合并治理

目标：降低 CLIProxyAPI fork 后续 merge 成本。

任务：

- 建立上游敏感区清单：
  - `sdk/cliproxy/auth/conductor.go`
  - `sdk/cliproxy/auth/scheduler.go`
  - `sdk/cliproxy/auth/selector.go`
  - `sdk/api/handlers/openai/openai_responses_websocket.go`
  - `internal/runtime/executor/codex_websockets_executor.go`
  - config / watcher / synthesizer 相关文件
- 新增 merge 后固定测试矩阵：
  - route engine compatibility
  - endpoint policy
  - manual-disabled guard
  - rate-limit guard
  - session affinity / sticky
  - WebSocket pinned auth release
  - dry-run/explain
- 文档化 seam：上游文件中允许存在的 GetTokens 调用点必须少且稳定。
- 建立“旧逻辑不得新增”约束：endpoint 业务规则不得再写入 handler、executor、selector 或 scheduler 分支。

## 数据持久化边界

应持久化：

- 手动禁用 / 启用。
- priority。
- endpoint route rules。
- 账号分组 / 标签。
- rate-limit 规则配置。
- model state、quota、nextRetryAfter、最近错误。
- usage attribution ledger 和 route event summary。

不应持久化：

- 请求级 `tried`。
- 单次请求 allow/deny/order override。
- 单次 `RouteDecision` 全量对象。
- WebSocket 当前 pinned auth。
- upstream websocket connection。
- selector cursor。
- session affinity cache，除非后续明确要求跨重启保持。

## 初始验收命令

sidecar fork：

```bash
go test ./internal/gettokenshooks ./sdk/cliproxy ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/runtime/executor
```

GetTokens：

```bash
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
npm --prefix frontend run build
```

文档：

```bash
docs-linhay/scripts/check-docs.sh
qmd update
qmd embed
```

## 当前决策

- 采用 `AccountRoutingEngine` 命名，不使用“HTTP middleware”作为架构名称。
- 自定义端点路由作为 `EndpointPolicy` 接入 engine。
- 既有路由逻辑必须在同一 rollout 清理；不能先上 endpoint policy 再长期保留旧双路径。
- 结果回写继续由 `MarkResult` / recorder 承担，不合并进 route engine。
- WebSocket pinned auth 保持请求边界特例，但重新选择必须复用 engine。
