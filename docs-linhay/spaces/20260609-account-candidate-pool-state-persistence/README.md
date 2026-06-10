# 账号候选池状态持久化与打通

## 背景

用户反馈：账号池里已经能刷新出可用账号，但真实请求时请求账号候选池仍会按旧顺序依次尝试异常账号，不能快速跳过到可用账号。用户明确要求“请求账号候选池需要和账号池状态打通并持久化”，避免每次都从坏账号开始试。

## 目标

1. 账号池探测/刷新得到的异常账号状态要进入 sidecar 真实请求候选池，而不是只停留在 Wails explain 视图。
2. 候选池异常状态要持久化到本地配置文件，sidecar 重启后仍能快速跳过异常账号。
3. sidecar 自身生成的可持久化 route guard 状态也要回写到共享状态文件，减少账号池视图与真实请求路由分叉。
4. 修复保持 sidecar 边界闭环，不通过前端临时补偿伪造请求路由状态。

## 范围

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/channel_routing_policy.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/routing_policy.go`
- `docs-linhay/references/CLIProxyAPI/internal/cmd/run.go` 与相关测试
- `internal/wailsapp/channel_routing.go` 的共享状态兼容读取（如需要）
- 本轮聚焦 sidecar 候选池状态打通与持久化，不重做账号池 UI 结构

## 非目标

1. 不重做账号池视觉与交互布局。
2. 不改请求路由模式本身（`sequential / balanced` 语义保持不变）。
3. 不把账号健康判断挪到前端内存态闭环。
4. 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

1. Given Wails/账号池把某个 `acct_*` 账号写入 `channel-routing/config.json.runtimeStates` 为异常状态，When sidecar 真实请求进入路由，Then `account-route-guard` 能直接跳过该账号。
2. Given sidecar 因 `rate-limit`、`auth-error`、`quota-empty` 等瞬态来源更新了 route guard，When 状态可映射到共享账号键，Then 共享 `runtimeStates` 文件同步更新；`manual-disabled` 不再作为持久 runtime fact 写入。
3. Given sidecar 进程重启且内存 route guard 为空，When 共享状态文件仍存在异常账号状态，Then 首次真实请求仍能跳过对应异常账号。
4. Given 成功结果清除了瞬态异常状态，When 对应 source 已恢复，Then 后续请求不再继续错误跳过该账号。
5. 自动化验证至少覆盖 sidecar hook/policy 测试；若补了 Wails 兼容逻辑，也补对应 Go 单测。

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | 用户直接反馈：“刷新出能用的账号了，请求的账号池还在依次尝试账号。” |
| 当前代码事实 1 | `internal/wailsapp/MarkChannelRouteAccountResult` 会把结果写入 `channel-routing/config.json.runtimeStates`，仅供 Wails explain/probe 使用。 |
| 当前代码事实 2 | sidecar 真实请求路由走 `internal/gettokenshooks/accountRouteGuardRoutingPolicy`，只读内存 `AccountRouteGuardStore`，不会消费 Wails 写入的 `runtimeStates`。 |
| 当前代码事实 3 | sidecar `channel_routing_policy.go` 读取同一个 `channel-routing/config.json`，但当前只解析 `channels`，忽略 `runtimeStates`。 |
| 当前缺失 | 账号池探测出的异常状态没有进入真实请求候选池；route guard 状态也没有稳定持久化/恢复链路。 |
| 反证条件 | 如果真实 sidecar 路由已经直接消费 `runtimeStates`，或 route guard 已经在重启后自动恢复并命中候选过滤，则本修复不成立。 |
| 预期验收方式 | CLIProxyAPI focused Go tests + GetTokens 文档校验；必要时补 Wails channel routing 单测。 |

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260609-account-candidate-pool-state-persistence`
- worktree：`../GetTokens-worktrees/20260609-account-candidate-pool-state-persistence/`

## 相关链接

- [Account Routing Engine 技术边界](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md)
- [Sidecar Route Guard Rate Limit Optimization](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260531-sidecar-route-guard-rate-limit/README.md)
- [账号池启动缓存首屏](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260609-account-startup-cache/README.md)

## 实现记录

1. 在 CLIProxyAPI fork 的 `internal/gettokenshooks/channel_runtime_state.go` 新增共享 runtime state 读写层：读取 explicit profile 下的 `channel-routing/config.json.runtimeStates`，转换为 `AccountRouteGuardBlock`；route guard 变更时把可映射状态回写到同一文件。
2. `account-route-guard` 真实请求 hard filter 现在会把内存 `AccountRouteGuardStore` 与持久化 `runtimeStates` 合并判断，所以 sidecar 重启后首个请求也能跳过已知异常账号。
3. `MarkBlocked / ReplaceSource / ClearSource / ClearAuth` 已同步持久化；清理按 source 粒度进行，不会因为清除 `manual-disabled` 误删同账号的 `rate-limit` 等其他来源。
4. `MarkManualDisabledAuth` 持久化优先使用真实 `acct_*` account key，而不是只落到 `auth-id:<id>`。
5. `channelRoutingPolicyStore.channels` 改为 `json.RawMessage` 保存，避免 sidecar 写 `runtimeStates` 时丢失 Wails 侧的 `manualRequestableAccountIDs / shadowEnabled / accountGroups.name` 等 channel 配置字段。

### 2026-06-10 Codex 路由探测补漏

1. 用户在 `Codex -> 账号列表` 浏览器预览中指出无额度账号仍被“路由探测”命中。
2. 复核本 space 与 memory 后确认：6/9 的修复已覆盖 sidecar 真实请求 hard filter，但 Wails `ProbeCodexAccountRouting` 自己构建 probe candidates 并发起真实 relay 请求，属于同一共享候选池边界下的遗漏分支。
3. 修复：`loadCodexRoutingProbeCandidates()` 发真实 relay 请求前读取同一份 `channel-routing/config.json.runtimeStates`，并合并只读 `quota-status` 的 blocked 状态过滤候选。
4. 加固：`activeRuntimeBlockReason()` 将 `quota-empty` 纳入硬阻塞 source，避免无额度账号只因 quota-status 重启后 stale/non-blocked 就重新进入 probe candidates。

### 2026-06-11 Codex API key 模型投影补漏

1. 用户在账号池标注 `公司 1`：卡片显示可用、quota runtime 成功且未 blocked，但 Codex 路由无法命中该账号。
2. 现场证据：正式 sidecar 只读管理接口返回 `acct_dd2172ea-9dd9-458a-88bd-590cc55a468c` 为 `codex-api-key / provider=codex / runtime_apply_status=applied`，`quota-status` 为 `success / blocked=false / plan_type=pro`；但 `/v0/management/accounts/:id/models` 返回 `[]`，请求日志出现 `auth_unavailable: no auth available (providers=codex, model=gpt-5.4/gpt-5.5)`。
3. 根因：SQLite 账号池是事实源，但 sidecar 热路径仍依赖运行态 `AuthManager` 与 `ModelRegistry`。无 watcher 的 embedded refresh 路径只更新 config 快照，未把 account-store Codex API key 重新合成并注册进运行态索引；同时管理模型接口缺少从 SQLite Codex API key 空模型列表回退默认 Codex 模型集的兜底。
4. 修复：`refreshAccountStoreAuths()` 在无 watcher 时主动从 account-store 合成 runtime auth，注册到 `AuthManager` / `ModelRegistry` 并移除已不存在的 account-store auth；`GetAccountModels` 对 active Codex API key 且 `models_json=[]` 时回退 `registry.GetCodexProModels()`，避免候选池/UI 把默认 Codex API key 误判为无模型。

### 2026-06-11 账号卡刷新额度显示补漏

1. 用户在账号池标注 `公司 1`：点击卡片底部“刷新额度”后，页面上可见额度信息没有变化。
2. 现场证据：只读 sidecar 管理接口显示 `/v0/management/gettokens/quota-status?account_key=acct_dd2172ea-9dd9-458a-88bd-590cc55a468c` 已有 quota runtime 窗口 `5H=40% / 7D=14%`，且手动 `quota-refresh` 后 `updated_at / last_evaluated_at` 会更新；页面卡片上可见的 `00:00-23:59 TOKENS 0 / 400M` 是 Route Guard，不是 quota window。
3. 根因：账号卡初始化路径从 Wails `GetQuotaStatuses` 读取 sidecar runtime state，实际字段沿用 sidecar JSON 的 `snake_case`；前端 `buildQuotaDisplay` 只读取 `camelCase`，导致 `plan_type / remaining_percent / reset_label / updated_at` 等字段被丢弃或显示为空。
4. 修复：`buildQuotaDisplay` 对 quota runtime state 同时兼容 `camelCase` 与 `snake_case`；账号卡只展示 quota window 与 reset，不额外显示 runtime refresh timestamp。

### 2026-06-11 Codex 浏览器预演候选池口径补漏

1. 用户在 `Codex -> 账号列表` 浏览器预览中标注：请求顺序列表下方已有 `公司 1` 等账号显示为“候选”，但高级诊断仍显示“未命中 / 候选 0 / 过滤 8”。
2. 现场证据：当前 `localhost:34115` 页面无 Wails bindings，走 `browserMode`；请求顺序列表与路由探测候选来自 `buildCodexRoutePolicyPreview()`，但 `runChannelExplain()` 的浏览器预演分支自己基于 `orderedRows.filter(row.requestable)` 临时组装 candidates 和 filtered，导致同屏出现两套候选解释口径。
3. 根因：高级诊断 preview explain 没有复用 route policy preview 候选池；在项目池/策略/浏览器 preview 状态切换后，可能显示“未命中”，但请求顺序列表仍显示账号参与候选。
4. 修复：新增 `buildCodexRoutePolicyExplainPreview()`，统一产出 browser explain 的候选、过滤原因和项目候选池摘要；`runChannelExplain()` 浏览器分支改为复用该 helper，和请求顺序列表、路由探测共用同一候选池口径。

### 2026-06-11 manual-disabled 持久化边界修正

1. 用户追问 `~/.config/gettokens-dev/channel-routing/config.json.runtimeStates` 是否是数据库，以及为什么账号池中有可用账号但 Codex 高级诊断仍未命中。
2. 现场证据：账号池管理接口返回 `公司 1` 的 SQLite 账号记录为 enabled/applied；同一账号在 `channel-routing/config.json.runtimeStates` 中遗留 `manual-disabled`，Wails `activeRuntimeBlockReason()` 和 sidecar 持久化 guard 读取后继续把它当硬阻塞。
3. 根因：上一期“候选池同步账号池”把 runtimeStates 设计成异常状态持久化入口，但把 `manual-disabled` 也写成独立持久事实，导致账号池 DB 与 runtime cache 发生冲突时，cache 盖过了 DB。
4. 修复：账号禁用/启用事实只来自 SQLite account-store / management status / synthesized runtime auth；Wails explain/probe 忽略 legacy `runtimeStates.manual-disabled`，保存 channel-routing store 时清理该 source；CLIProxyAPI 仍保留当前进程内存 `manual-disabled` 作为即时禁用 guard，但不再持久化或读取共享 JSON 中的 `manual-disabled`。

## 验收记录

- 红灯：新增 `TestAccountRouteGuardPolicyDeniesCandidatesFromPersistedRuntimeStates` 与 `TestAccountRouteGuardStorePersistsRuntimeStateToChannelRoutingConfig` 后，确认旧实现不会消费持久化 `runtimeStates`，也不会把 route guard 状态写回 `channel-routing/config.json`。
- 绿灯：补齐共享 runtime state 读写和 raw-preserving channel store 后，focused route guard 测试通过。
- 回归：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy ./sdk/cliproxy/auth -count=1` 通过。
- 本轮未启动真实 dev App：改动集中在 CLIProxyAPI sidecar 路由热路径，按当前治理规则使用 Go 自动化覆盖；未触碰正式版 `/Applications/GetTokens.app`。
- 2026-06-10 Wails probe 回归：新增 `TestLoadCodexRoutingProbeCandidatesFiltersPersistedQuotaEmptyRuntimeState`，覆盖 quota-status stale/non-blocked 但共享 runtimeStates 仍有未过期 `quota-empty` 时，probe candidates 仍跳过该账号。
- 2026-06-11 Codex API key 模型投影回归：
  - 新增 `TestServiceRefreshAccountStoreAuthsWithoutWatcherRegistersCodexAPIKeyModels`，覆盖无 watcher refresh 也会把 SQLite Codex API key 注册进运行态并支持默认 `gpt-5.5`。
  - 新增 `TestGetAccountModelsFallsBackToCodexDefaultsForAccountStoreAPIKey`，覆盖 `/accounts/:account_key/models` 对 active Codex API key 空模型列表返回默认 Codex 模型。
  - `go test ./sdk/cliproxy ./internal/api/handlers/management ./internal/watcher/synthesizer -count=1` 与 CLIProxyAPI fork `git diff --check` 通过。
- 2026-06-11 账号卡刷新额度显示回归：
  - 新增 `frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs`，覆盖 `GetQuotaStatuses` snake_case runtime state 能渲染 5H/7D、token progress、reset 与更新时间。
  - `node --test frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs frontend/src/features/accounts/tests/rateLimit.test.mjs frontend/src/features/accounts/tests/accountRotation.test.mjs` 通过。
  - `npm --prefix frontend run typecheck` 与 `npm --prefix frontend run build` 通过。
- 2026-06-11 Codex 浏览器预演候选池口径回归：
  - 新增 `buildCodexRoutePolicyExplainPreview uses route policy preview as the candidate pool`，覆盖 route policy deny、项目候选池过滤和 disabled 过滤原因。
  - `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck` 与 `npm --prefix frontend run build` 通过。
- 2026-06-11 manual-disabled 持久化边界回归：
  - 新增 `TestExplainChannelRoutingIgnoresLegacyManualDisabledRuntimeState`，覆盖账号池 enabled 但 runtimeStates 遗留 `manual-disabled` 时 explain 仍能命中账号。
  - 新增 `TestSaveChannelRoutingStorePrunesManualDisabledRuntimeStates`、`TestSetAccountDisabledClearsLegacyManualDisabledRuntimeState`、`TestSetAccountDisabledDoesNotPersistManualDisabledRuntimeState`，覆盖 Wails 保存/账号启停清理旧 source 且保留同账号 `quota-empty` 等其他 source。
  - CLIProxyAPI fork 新增 `TestAccountRouteGuardPolicyIgnoresLegacyManualDisabledPersistedRuntimeState` 与 `TestAccountRouteGuardStoreDoesNotPersistManualDisabledRuntimeState`，覆盖 sidecar 忽略旧持久 `manual-disabled`，但保留当前进程内存禁用 guard。
  - `go test ./internal/wailsapp -count=1`、`go test ./internal/sidecar -count=1`、CLIProxyAPI fork `go test ./internal/gettokenshooks ./sdk/cliproxy ./internal/api/handlers/management -count=1`、前端 `node --test ...`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 通过。

## 当前状态
- 状态：implemented-verified
- 最近更新：2026-06-11
