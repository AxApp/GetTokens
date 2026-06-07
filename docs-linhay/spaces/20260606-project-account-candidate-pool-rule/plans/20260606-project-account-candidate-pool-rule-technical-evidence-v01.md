# Project Account Candidate Pool Rule 技术证据 v01

日期：2026-06-06

## 结论

当前代码和既有文档都支持同一个判断：

**项目账号候选池规则应该进入 sidecar route engine 的 `CompiledRouteSnapshot`，并作为 `pool-scope` policy 用 allow set 收窄 account candidate pool；不应恢复 legacy `projectBindings`，也不应新增第三种 route mode。**

校准后的推荐必须贴合现有路由系统对象：

```text
RouteContext(projectKey)
  -> CompiledRouteSnapshot(project candidate pool rules)
  -> PolicyStagePoolScope(strict allow)
  -> DecisionTrace(project rule matched / filtered / fail closed)
  -> P2 RequestPolicy(只能继续作用于收窄池)
  -> P3 StickyPolicy
  -> P4 Selector(sequential / balanced)
```

## 证据 1：route engine 已有明确 policy stage

来源：

- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/engine.go`

关键代码事实：

- `PolicyStageHardFilter = "hard-filter"`
- `PolicyStagePoolScope = "pool-scope"`
- `PolicyStageRequest = "request"`
- `PolicyStageSticky = "sticky"`

`policyStageRank` 明确排序：

```text
hard-filter -> pool-scope -> request -> sticky
```

解释：

项目规则的语义是“某项目只能进入固定账号集合”，属于候选池范围限制。它应该晚于 hard filter、早于 request/sticky/selector，因此对应 `PolicyStagePoolScope`。

如果把项目规则做成 request policy 或 UI 层选择，它会晚于 pool scope，且容易与 sticky、retry、guard 出现二义性。

这里不能把 `P2 RequestPolicy` 从设计里删掉。正确边界是：项目规则在 `P1` 收窄候选池，后续 `P2` 即使继续处理 request deny/order，也不能把项目 allow set 外账号加回候选。

## 证据 2：hard filter 不能被后续 allow 绕过

来源：

- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/engine_test.go`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/routing_policy_test.go`

关键测试：

- `TestEngineRunsHardFilterBeforeRequestPolicy`
- `TestSchedulerGetTokensRoutingDenyCannotBeBypassedByLaterAllow`
- `TestSchedulerGetTokensRoutingHardFilterRunsBeforeEarlierRequestPolicy`
- `TestSessionAffinityGetTokensRoutingDenyCannotBeBypassed`

代码事实：

- 即使 request policy 后续 `AllowIDs` 包含 blocked auth，hard filter 已剔除的账号也不能被加回候选。
- session affinity 同样不能绕过 hard deny。

解释：

项目账号候选池规则的 allow set 只能表示“项目允许哪些账号进入候选池”，不能表示“这些账号一定可用”。`manual-disabled`、`rate-limit`、`quota-empty`、`cooldown`、`unavailable` 仍必须优先。

这支持需求中的规则：

- `allowAccountIDs` 只是 allowed，不是 routeable。
- 命中项目规则后，如果 allow set 内账号全部被 hard filter 阻断，必须 fail closed。

## 证据 3：channel routing 只保留 sequential / balanced

来源：

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/channel.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/channel_test.go`

关键代码事实：

- 前端 `CHANNEL_ROUTE_MODES = ['sequential', 'balanced']`
- sidecar `ChannelRouteMode` 只定义 `sequential` 与 `balanced`
- `TestChannelRouteMode only accepts the GetTokens two-mode routing model` 明确拒绝 `project / dedicated / prefer / ordered / weighted / canary / exclude / round-robin`
- `TestDecideChannelRouteDropsLegacyProjectMode` 证明 legacy `project` mode 会降级到 sequential，不产生 project route 分支。

解释：

项目固定账号不是 route mode。它只能是候选池约束，然后继续交给现有 `sequential / balanced` 选择器。

因此需求里不应出现：

- project route mode
- project route mode override
- project fallback route mode
- weighted/canary/prefer 变体

## 证据 4：legacy projectBindings 已被测试定义为删除对象

来源：

- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `internal/wailsapp/channel_routing_test.go`
- `docs-linhay/dev/20260524-account-routing-engine.md`

关键测试：

- `normalizeChannelRoutingConfig drops legacy routing fields from saved channel config`
- `normalizeChannelRoutingConfig removes legacy project bindings entirely`
- `TestExplainChannelRoutingDropsLegacyProjectModeAndProjectBindings`

关键文档事实：

- `docs-linhay/dev/20260524-account-routing-engine.md` 已记录：`project`、项目绑定、channel fallback 和 project fallback 不进入 Channel Routing 的保存、执行或 UI 路径。
- 同文档补充记录：2026-05-31 已移除 `project` route mode、`projectBindings`、`projectModeFallbackRouteMode`、`fallbackMode`。

解释：

这不是“暂时不用”的字段，而是已有测试和治理文档明确要求丢弃的 legacy 模型。

因此新需求必须写成：

- 删除可写 `projectBindings` 入口。
- 历史输入只允许丢弃或迁移。
- 新 Project Account Candidate Pool Rule 必须独立于 `ChannelRoutingConfig` 存储。

## 证据 5：现有 routeable pool 已是“先建池，再选账号”

来源：

- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/channel.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/channel_test.go`
- `docs-linhay/dev/20260524-account-routing-engine.md`

关键代码事实：

- `DecideChannelRoute` 先调用 `BuildRouteablePool`，再 `selectSequential / selectBalanced`。
- `BuildRouteablePool` 已过滤：
  - tried
  - account-disabled
  - account-unrequestable
  - group-disabled-or-missing
- `TestDecideChannelRouteSequentialFiltersAndOrdersPool` 证明过滤与排序发生在选择之前。

解释：

项目账号候选池规则应该是 `BuildRouteablePool` 或 `pool-scope policy` 阶段中的附加过滤，不应在 selector 之后补救。

这支持需求结构：

```text
CompiledRouteSnapshot
  -> routeable pool
  -> project candidate pool allow set
  -> request policy, if any
  -> sticky validation
  -> sequential / balanced
```

## 证据 5.1：热路径已有 RouteContext 与 DecisionTrace

来源：

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/routing_policy.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/engine.go`

关键代码事实：

- `rewriteScheduledAuthsWithPolicies()` 从 `cliproxyexecutor.Options` 构造 `gettokensrouting.RouteContext`。
- `RouteContext` 已包含 `Provider / Providers / Model / Options / CodexRequest / Candidates / Tried / Now`。
- `CodexRequest` 当前来自 `gettokenscodex.RequestContextFromMetadata(req.Options.Metadata)`。
- `Engine.Route()` 对每个 policy 输出 `DecisionStep`，字段包括 `Stage / Policy / Reason / Before / After / AllowIDs / DenyIDs / OrderIDs / Fallback / Activated`。
- `routeResultActive()` 通过 trace 判断 policy 是否真实参与路由。

解释：

项目规则不能只存在于 Wails explain 或前端状态。它需要先进入 sidecar `RouteContext`，再由快照中的项目规则生成 `PolicyDecision`，并由 `DecisionStep` 解释命中、过滤和 fail closed。

这支持需求中的：

- 新增或补齐 `ProjectKey / ProjectName / ProjectKeySource` 到 route context。
- Project Candidate Pool Rule trace 必须来自 route engine，不从前端二次推导。
- route ledger / explain 需要容纳 project-candidate-pool step。

## 证据 6：候选池变化已有 pool epoch 机制

来源：

- `docs-linhay/dev/20260603-session-account-affinity-failure-budget.md`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/routing_policy_test.go`

关键测试：

- `TestSessionAffinityPoolEpochBumpInvalidatesStaleBinding`
- `TestSessionAffinityDisabledAccountMustNotStick`

关键文档事实：

- 账号池变更推进 epoch，session affinity 下次请求感知并重新评估。
- 禁用账号必须清除 binding + bump epoch，下一请求走其他账号。

解释：

项目 allow set 变更和账号禁用一样，都会改变“当前 session 的合法候选池”。因此保存项目规则后必须推进 route snapshot / pool epoch，使 sticky 在下一请求重新评估。

这支持需求中的：

- 项目规则新增/删除/启用/禁用/修改都 bump epoch。
- 已 commit 的 streaming response 不迁移。
- 下一条 downstream request 重新进 route engine。

## 证据 7：WebSocket 切换边界已经固定为 request boundary

来源：

- `docs-linhay/dev/20260524-account-routing-engine.md`
- `docs-linhay/dev/20260603-session-account-affinity-failure-budget.md`

关键文档事实：

- Codex WebSocket 不承诺 mid-response 迁移。
- 已经开始向 downstream 输出 payload 后，账号切换只能发生在下一条 downstream request。
- guarded pinned auth 命中时，释放 pin、关闭旧 upstream execution session、强制 transcript replay，然后重新进入 routing registry。

解释：

项目账号候选池规则变更后，当前 pinned auth 可能不再合法。处理方式应复用 WebSocket request-boundary 语义，而不是在 stream 中途拼接另一个账号。

## 证据 8：projectName 目前是展示/派生字段，不是运行时强 key

来源：

- `app_codex_live_sessions.go`
- `frontend/src/features/codex-live-sessions/model/selectors.ts`
- `internal/wailsapp/session_management.go`

关键代码事实：

- live session DTO 暴露的是 `ProjectName string json:"projectName,omitempty"`。
- 前端 `getCodexLiveProjectIDForSession` 从 `projectName` 派生 `project:<slug>`。
- session management `slugifySessionProjectName` 只是 lowercase + 空格替换，主要服务历史会话归类。

解释：

当前已有 `projectName` 信号，但它不是 sidecar route context 中的稳定强约束 key。需求必须把 `projectName` 与 `projectKey` 拆开：

- `projectName`：展示、审计、发现项目。
- `projectKey`：运行时匹配规则。

首版不允许仅从 `projectName` 自动派生可启用的强路由 key。当前 Codex 推荐从单 workspace path 派生 `workspace:<sha256(filepath.Clean(abs_workspace_path))>`；手动项目名只能创建 draft，启用前必须绑定 observed 或 confirmed `projectKey`。

## 证据 9：前端帮助文案已经承认项目/账号组限定是“先缩小候选池”

来源：

- `frontend/src/features/channel-routing/model/channelRouting.ts`

关键文案：

- “项目或账号组限定会先缩小候选池，再在候选池内按顺序或均衡模式选择。”

解释：

虽然 runtime 还没有项目账号候选池规则，但产品语义已经朝“项目限定 = 候选池收窄”方向表达。新需求应该补齐 runtime 能力，而不是改变用户心智。

## 精进后的需求调整

基于以上证据，需求设计应从 v01 调整为：

1. 项目账号候选池规则必须编译进 `CompiledRouteSnapshot`，热路径只读快照。
2. 项目账号候选池规则是 `PolicyStagePoolScope` policy，不只是概念上 P1。
3. 规则执行使用 strict allow set：`AllowIDs = allowAccountIDs` 且 `AllowFallback = false`。
4. 规则命中但 after count 为 0 时返回项目级无可用账号错误，不继续 fallback。
5. Project Candidate Pool Rule trace 必须成为 `DecisionStep` 或 explain section，不只在前端摘要里展示。
6. `projectKey` 必须进入 sidecar `RouteContext`，不能只存在于 Wails/live-session UI。
7. `P2 RequestPolicy`、`P3 StickyPolicy`、selector 都只能在项目规则收窄后的候选池内工作。
8. `projectBindings` 清理要从“建议”提升为实现验收：可写入口必须消失，历史输入只可丢弃/迁移。

## 待确认技术问题

1. sidecar `RouteContext` 中是否已有稳定 request-level project 信息源；如果没有，需要新增 `ProjectKey / ProjectName / ProjectKeySource`。
2. Codex 与 Claude 的 project key 来源是否一致；如果不一致，Project Account Candidate Pool Rule store 是否需要记录 source。
3. fail closed 错误应映射到哪一类 response error，避免被客户端误判为 transient upstream 失败。
4. route ledger 当前是否能容纳 project-candidate-pool trace；若不能，需要扩展 redacted event schema。
