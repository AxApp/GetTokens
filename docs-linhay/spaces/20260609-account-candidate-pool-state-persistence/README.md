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
2. Given sidecar 因 `manual-disabled`、`rate-limit` 等来源更新了 route guard，When 状态可映射到共享账号键，Then 共享 `runtimeStates` 文件同步更新。
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

## 验收记录

- 红灯：新增 `TestAccountRouteGuardPolicyDeniesCandidatesFromPersistedRuntimeStates` 与 `TestAccountRouteGuardStorePersistsRuntimeStateToChannelRoutingConfig` 后，确认旧实现不会消费持久化 `runtimeStates`，也不会把 route guard 状态写回 `channel-routing/config.json`。
- 绿灯：补齐共享 runtime state 读写和 raw-preserving channel store 后，focused route guard 测试通过。
- 回归：`go test ./internal/gettokenshooks ./internal/cmd ./sdk/cliproxy ./sdk/cliproxy/auth -count=1` 通过。
- 本轮未启动真实 dev App：改动集中在 CLIProxyAPI sidecar 路由热路径，按当前治理规则使用 Go 自动化覆盖；未触碰正式版 `/Applications/GetTokens.app`。

## 当前状态
- 状态：implemented-verified
- 最近更新：2026-06-09
