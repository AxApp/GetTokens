# Account Routing Engine 技术边界

日期：2026-05-24

## 结论

GetTokens 下一阶段自定义端点路由应收敛为 `AccountRoutingEngine`，而不是普通 HTTP middleware。

原因：

1. 账号路由需要复用 selector fallback、retry、cooldown、model availability 和 guard source。
2. HTTP middleware 层缺少账号运行态和 `tried` 上下文，直接拦截会把“可换账号”变成“直接失败”。
3. 自定义端点路由本质是候选账号重写与排序，不是请求拦截。
4. CLIProxyAPI fork 后续要持续合并上游，自定义逻辑必须集中到稳定扩展层。

本次 rollout 同时需要清理既有账号路由逻辑。已经实现的 `RoutePolicy`、`AccountRouteGuardStore`、rate-limit evaluator、session affinity selector 和 WebSocket pinned auth 特例不能作为另一套路由系统长期并行存在；它们要么迁移为 engine policy，要么保留为明确的兼容 shim。

## 推荐架构

```text
RouteContext Normalize
  -> AccountRoutingEngine.Route()
       -> CandidateProvider
       -> CompiledRouteSnapshot
       -> PolicyPipeline
       -> SelectorAdapter
       -> DecisionTrace
  -> Executor.Execute()
  -> ResultRecorder.MarkResult()
  -> RetryController
```

## Policy 分层

固定优先级：

1. `P0 HardFilterPolicy`
   - manual-disabled
   - rate-limit
   - disabled
   - unavailable
   - model cooldown
2. `P1 PoolScopePolicy`
   - endpoint scope
   - provider / model / transport scope
   - target account group
   - target account ids
   - request deny / pool filter
3. `P2 RequestPolicy`
   - allow
   - deny
   - order
   - fallback
4. `P3 StickyPolicy`
   - session affinity
   - pinned auth request-boundary handling
5. `P4 Selector`
   - round-robin
   - fill-first
   - sequential
   - balanced
   - project

`P0` 不允许被后续策略绕过。请求级 allow/order 不能把手动禁用、限流阻断、冷却中或模型不可用账号放回候选。

启停状态的实时性不对称：

- 禁用立即生效：账号 `disabled`、`manual-disabled`、`inventoryGroup.enabled=false` 或 `channelGroup.enabled=false` 高于 `StickyPolicy`、失败降级、retry 和 selector。若当前 stream / pinned auth / sticky 正在使用该账号，执行器必须在 request-boundary 或管理控制可达的最近边界断开连接、释放 pin，并让后续请求重新进入路由引擎。
- 激活非抢占：账号或账号组恢复激活后，只进入后续可路由账号池；不会抢占当前正在工作的 stream，不主动迁移已有 sticky，也不会因为“刚激活”立刻替换当前账号。

## 简化后的核心路由语义

Account Routing Engine 的用户主概念收敛为两步：

1. 构建可路由账号池。
2. 在账号池上执行路由模式。

### 可路由账号池

进入账号池的条件由四类信息决定：

- 账号状态：
  - 激活 / 禁用：用户意图。禁用账号不进入可路由池。
  - 可请求 / 异常：运行态。异常、冷却、限流、模型不可用账号不进入本次可请求候选，但应在 explain 中展示过滤原因。
- 账号排序：`routeOrder` 数值越低越先路由到。
- 账号归属组：账号可属于一个或多个自定义组；未分组账号可归入默认组。
- 组级状态和排序：
  - 组可激活 / 禁用。
  - 组有 `routeOrder`，数值越低越优先。
  - 目标组禁用时，该组不产生候选。

有效排序：

```text
group.routeOrder -> account.routeOrder -> stable account id
```

### 路由模式

核心模式只保留三类：

1. `sequential` 顺序模式
   - 按有效排序从低到高尝试。
   - retry 时排除已尝试账号，继续下一个可路由账号。
2. `balanced` 均衡模式
   - 按账号当前会话数或 in-flight 请求数最少优先。
   - 负载相同再按有效排序。
   - WebSocket session 和长请求应计入当前会话数；短 HTTP 请求计入 in-flight。
3. `project` 项目模式
   - 从请求元数据提取 projectName。
   - projectName 可绑定到账号组或账号。
   - 绑定目标不可用时按配置 fail-closed 或 fallback 到默认模式。

`dedicated / prefer / ordered / weighted / canary` 不进入新的 GetTokens 路由模型。它们只用于合并上游功能时的兼容边界：

- 不在 UI、Wails DTO 或 engine policy 中作为可配置模式暴露。
- 不映射为新的 route mode。
- 不影响 `sequential / balanced / project` 的决策结果。
- 如上游输入携带这些字段，只在 trace 中标记为 `upstream_compat` 或 `ignored_upstream_mode`，再按 GetTokens 三模式继续处理。

`exclude` 也不作为路由模式；它只允许作为请求级 deny 或目标池过滤条件出现。

## 三层领域模型

Account Routing Engine 采用三层模型：

```text
Account Inventory
  accounts
  accountGroups
  accountState
  groupState

Channel Routing
  codex:
    orderedAccountIDs
    enabledGroupIDs
    routeMode
    projectBindings
    fallbackMode
  claude:
    orderedAccountIDs
    enabledGroupIDs
    routeMode
    projectBindings
    fallbackMode

Routing Engine
  buildRouteablePool(channel, requestContext)
  selectAccount(routeMode, pool)
  return RouteDecision + Trace
```

总账号池属于 `Account Inventory`，不负责编排账号轮动。

总账号池只负责：

- 账号增删改查。
- 账号启用、禁用、弃用。
- 账号组增删改查。
- 组级启用、禁用、排序。
- 账号和账号组基础状态展示。

渠道账号列表属于 `Channel Routing`，负责各自渠道的轮动编排：

- `codex - 账号列表`：
  - Codex 请求顺序。
  - Codex route mode：`sequential / balanced`。
  - Codex 项目名绑定账号组或账号（兼容保留，不作为主模式入口）。
  - Codex 路由说明、dry-run/explain、路由探测。
- `claude - 账号列表`：
  - Claude Code 请求顺序。
  - Claude route mode：`sequential / balanced`。
  - Claude 项目名绑定账号组或账号（兼容保留，不作为主模式入口）。
  - Claude 路由说明、dry-run/explain、路由探测。

sidecar `AccountRoutingEngine` 是执行层，读取渠道级配置和账号池快照后做决策；它不把渠道级顺序或 route mode 反写成总账号池属性。

该边界意味着：

- 账号组是总账号池资产，可被多个渠道引用。
- 账号组启停分为全局组状态和渠道组状态。
- 渠道内排序是渠道配置，不等于总账号池排序。
- Codex 和 Claude 的排序、项目绑定、路由模式互不影响。

## 前端改造边界

前端按三层模型重切页面 ownership：

- `AccountsFeature` 属于 `Account Inventory`。它可以管理账号、账号组、启停、弃用、基础排序和状态展示，但不能再承载 route mode、渠道 fallback、项目绑定或路由探测。
- `CodexAccountListFeature` 属于 Codex `Channel Routing`。它可以整页重做，主职责改为 Codex 渠道账号顺序、`sequential / balanced`、渠道组状态、项目绑定、dry-run/explain 和 probe。
- `ClaudeCodeAccountListFeature` 属于 Claude `Channel Routing`。它可以整页重做，主职责改为 Claude 渠道账号顺序、`sequential / balanced`、渠道组状态、项目绑定、dry-run/explain 和 probe。

建议新增共享前端领域 `frontend/src/features/channel-routing/`，沉淀纯模型、校验、preview 数据和共享工作台组件；Codex / Claude 页面只装配渠道差异。共享不等于共用配置，保存接口、配置 key、preview 数据和 explain trace 必须按渠道隔离。

需要从主路径移除的旧前端语义：

- 总账号池中的 `AccountRotationModal` / `useAccountRotation` 轮动编排入口。
- 使用全局 `UpdateAccountPriority` 表达 Codex / Claude 渠道请求顺序。
- 将旧 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback` 作为页面主配置模型。
- 在新 UI 中暴露 `dedicated / prefer / ordered / weighted / canary`。

详细范围见 `docs-linhay/spaces/20260524-account-routing-engine/plans/frontend-rewrite-scope-v01.md`。

### 组级启停分层

组级启停分为两层：

- `inventoryGroup.enabled`：全局组状态。禁用后所有渠道都不能从该组产生候选。
- `channelGroup.enabled`：渠道组状态。只影响当前渠道是否使用该组。

可路由池判断：

```text
account.enabled
AND account.requestable
AND inventoryGroup.enabled
AND channelGroup.enabled
AND supports channel/provider/model/endpoint
```

项目模式只负责把请求限定到某个账号组或账号。若项目绑定命中账号组，组内选择仍使用 `sequential` 或 `balanced`；因此项目模式需要一个 `projectModeFallbackRouteMode` 字段，取值为 `sequential` 或 `balanced`。

## 快照与持久化

热路径读取 `CompiledRouteSnapshot`：

- route rules。
- channel route configs。
- account id lookup。
- account group lookup。
- account activation / requestability。
- inventory group enabled / routeOrder。
- channel group enabled / routeOrder override。
- account routeOrder。
- current session counters。
- project binding lookup。
- guard state。
- model availability。
- priority。
- selector hints。
- snapshot version。

配置或状态变化时重建快照；请求热路径不做 DB 查询和复杂解析。

### 运行态持久化

失败冷却必须由 `ResultRecorder / MarkResult` 写入可恢复的运行态存储或 guard source，而不是只存在于当前 selector 进程内存。至少区分：

- `manual-disabled`：用户或配置意图，只能由用户启用或配置变更清除。
- `rate-limit` / `cooldown`：429、配额窗口或短期熔断，可按窗口到期自动清理。
- `auth-error`：401、token expired、credential invalid，默认保持异常，直到凭证刷新或用户显式恢复。
- `model-unavailable`：模型不可用或账号不支持该模型，可按模型探测或配置变更恢复。
- `upstream-error`：5xx、连接失败、超时，可进入短期冷却并记录过期时间。

`MarkResult` 只负责写运行态和 guard source；下一次请求或 retry 仍通过 `AccountRoutingEngine.Route()` 读取快照后决策。自动恢复只能清理对应 source，不能误清 `manual-disabled`。账号激活会清除对应禁用 source 并使账号进入下一轮候选池，但不触发当前连接抢占。

## Trace 与 Explain

每次决策应能产出简洁 trace：

```text
initial candidates: 12
guard denied: 2
pool scoped to group: codex-pro
route mode: balanced
request deny: 1
selector picked: auth-a
snapshotVersion: 1842
policyVersion: 39
```

Explain API 不请求上游，只运行 route engine 并返回：

- 候选账号。
- 过滤原因。
- 排序步骤。
- 最终选择。
- fallback 顺序。
- 失败原因。

## WebSocket 边界

Codex WebSocket 不承诺 mid-response 迁移。已经开始向 downstream 输出 payload 后，账号切换只能发生在下一条 downstream request：

1. 检查当前 pinned auth 是否被 guard 命中。
2. 命中则释放 pin。
3. 关闭旧 upstream execution session。
4. 强制 transcript replay。
5. 重新进入 `AccountRoutingEngine.Route()`。

如果 pinned auth 在本条 WebSocket request 里返回 401/402/403/429 且尚未写出任何 downstream payload，应先抑制错误输出、释放 pin、关闭旧 execution session、用完整 transcript replay 立即重派，让同一次用户请求切到下一账号。若已经写出 payload，则不做无缝续流，只能在最近可控边界主动断开或等待下一条 downstream request 再根据 retry/fallback 重新选择。

如果 guard 命中来源是 `manual-disabled`、账号 `disabled`、全局组禁用或渠道组禁用，不能等待 sticky 自然过期；需要把当前 pinned auth 视为立即不可用。反向的激活操作只影响下一轮选择，不主动恢复或替换当前连接。

## 上游合并边界

GetTokens 自定义能力应放在 GetTokens-owned 包，例如：

- `internal/gettokensrouting`
- `internal/gettokenshooks`
- management API / Wails adapter

上游核心文件只保留少量 seam：

- 构建 `RouteContext`。
- 调用 engine 或兼容 `RoutePolicy`。
- 将 `RouteResult` 交给 executor。
- WebSocket request-boundary hook。

敏感文件：

- `sdk/cliproxy/auth/conductor.go`
- `sdk/cliproxy/auth/scheduler.go`
- `sdk/cliproxy/auth/selector.go`
- `sdk/api/handlers/openai/openai_responses_websocket.go`
- `internal/runtime/executor/codex_websockets_executor.go`
- config / watcher / synthesizer 相关文件

合并上游时优先保证 seam 存在，不在这些文件中继续堆 endpoint 业务规则。

## 与现有 RoutePolicy 的关系

现有 `RoutePolicy` 不直接删除：

1. P0 作为兼容层保留。
2. `gettokensRoutePolicy` 和 `accountRouteGuardPolicy` 可以先映射为 engine policy。
3. endpoint route policy 上线后，逐步把 session affinity wrapper 等剩余 selector shim 收敛到 engine。

## 既有逻辑清理边界

本次清理以“行为不变、入口收敛”为原则：

- `gettokensRoutePolicy`：保留 metadata/header 解析能力，但归入 `RequestPolicy`。
- `accountRouteGuardPolicy`：归入 `HardFilterPolicy`，继续使用 source aggregation。
- `rateLimitPolicy`：不再作为第二个热路径 deny 出口；rate-limit evaluator 只刷新 `rate-limit` guard source。
- `SessionAffinitySelector`：迁移为 `StickyPolicy`，或至少保证启用 session affinity 时仍进入 route engine。
- `ResponsesWebsocket` pinned auth 检查：保留 request-boundary hook，但 guarded 判断和重新选择复用 engine 语义。
- `CodexWebsocketsExecutor.ensureUpstreamConn`：继续负责 authID / wsURL 变化时关闭旧 upstream，这是连接生命周期逻辑，不迁入 route engine。

清理不包括：

- 删除公共 `RoutePolicy` 类型。
- 重写 scheduler 全部索引结构。
- 实现 streaming mid-response 账号迁移。

## 风险

1. 如果 hook 安装点仍缺失，policy 抽象存在但运行时不生效。
2. 如果 session affinity 继续作为 selector wrapper 存在，会绕过 scheduler fast path。
3. 如果 endpoint route rule 直接写进 handler/executor，会显著增加上游 merge 冲突。
4. 如果 trace 记录过多细节，可能泄露 payload 或凭证；必须只保存摘要。

## 当前实现补充

2026-05-25 的补充实现把 `AccountRoutingEngine` 的可解释性继续往前推了一步：

- `ChannelRoutingConfig` 新增 `shadowEnabled` / `shadowRouteMode`。
- `ExplainChannelRouting` 现在返回 `snapshotVersion`、`policyVersion` 和可选 `shadow` diff。
- `ListChannelRouteEvents` 输出只含安全摘要，不携带 payload / token / cookie / bearer。
- Codex / Claude Channel Routing workbench 已加入 shadow 开关与 shadow explain 展示。
- 2026-05-26 前端重新整理 Channel Routing workbench：从“术语块堆叠”进一步收敛为普通用户只看 `请求模式` 和 `参与账号`。配置区使用上下连续区域，先选择顺序 / 均衡，再列出当前模式下可参与的可请求账号；`参与账号` 默认收起，只显示数量。`Shadow`、legacy compatibility、explain steps、候选 / 过滤、最近 route ledger 和 dry-run 操作全部默认收进 `高级诊断`。默认态不再展示 `pending / policy / DRY-RUN / candidates` 技术串，也不再用图表承载普通用户不关心的过滤细节。

2026-05-25 后续收敛：

- CLIProxyAPI fork 默认 service builder 已接入 `AccountRouteGuardResultHook`，真实执行器 `MarkResult` 可把 401、429、408/5xx/timeout 写入 route guard transient sources，并在成功后只清 transient source，不清 `manual-disabled`。
- Codex / Claude 账号列表已经移除旧 allow / deny / fallback 的主 UI 操作入口；路由探测只按渠道当前账号顺序传入 `orderAccountIDs`，旧字段保留为空作为 request policy 兼容层。
- dev sidecar 真实 upstream 冒烟已完成：`GET /v1/models` 返回 `status=200 models=8`，`POST /v1/responses` 使用 `gpt-5.4` 和 `max_output_tokens=1` 返回 `status=200 object=response`。
- Codex / Claude Channel Routing workbench 已展示最近 route event ledger，桌面模式读取 `ListChannelRouteEvents`，浏览器预览 Explain 后合成 redacted preview event。
- `rateLimitPolicy` 兼容注册已删除；rate-limit evaluator 只刷新 `AccountRouteGuardSourceRateLimit`，热路径由 `accountRouteGuardPolicy` 统一 deny。
- session affinity legacy path 已在 sticky selector 前复用 `RoutePolicy` / engine seam；sticky cache 和 fallback 只能在 guard 过滤后的候选池内工作。
- session affinity 已进一步作为 manager-local `PolicyStageSticky` 接入 scheduler fast path：cache hit 通过 route engine 排序候选，cache miss 由 selector 选中后绑定结果。
- WebSocket request-boundary 特例已收口为单一连接生命周期 helper：guarded pinned auth 释放 pin、关闭旧 execution session、强制 transcript replay。
- WebSocket pinned auth 的 429/401/402/403 前置错误补齐透明 failover：若尚未写出 downstream payload，handler 抑制错误事件、释放 pin、关闭 execution session，并用完整 transcript 立即重派同一 request；若已开始输出，仍保持不做 mid-response 迁移。
- `legacy-routing-cleanup-v01.md` 已更新当前 shim 状态：公共 `RoutePolicy` 兼容 API 是后续上游合并与旧 request policy 的主要兼容边界。
- Codex 前端已把 `session-affinity` / `websocket-pin` / `route-order-header` 收进 `兼容层提示`，前端只保留总数与说明，不展开三条明细；explain 仍记录兼容遮罩摘要，不再回写到新的通道配置，避免上游合并时扩散改动面。

仍未完成的项：

- 完整 selector 热路径接管与旧 shim 删除。

## 账号池单点刷新边界

账号池页面的单点操作需要优先做局部 patch，而不是默认触发整页补偿刷新：

- 删除、禁用、重命名、优先级调整、API Key 配置保存、OAuth 回填都应先更新当前卡片或本地列表，再按需选择是否刷新 supplemental 数据。
- 只有新增、导入或显式强制刷新，才重新拉取整组 quota / usage / rate-limit 数据。
- OAuth 回填在新旧文件名不稳定时，优先按邮箱匹配当前卡片，避免把重新登录误判成新增账号。
- 详情页状态如果已经进入 error，不应被 usage/quota 的“成功”结果覆盖成 available。
