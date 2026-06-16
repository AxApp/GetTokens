# Balanced Mode 正式环境排查 v01

## 背景

用户在正式 GetTokens 的 Codex 运行会话页面观察到：多项目并发时，`balanced` 模式没有按账号均分。当前先记录证据与后续优化边界，本轮不修改正式环境、不改 sidecar 代码。

## 证据门禁

| 项目 | 结论 |
| --- | --- |
| 问题来源 | 用户正式环境截图与提问：`balanced` 模式多项目没有均分账号。 |
| 当前配置事实 | 正式运行态 `~/.config/gettokens/channel-routing/config.json` 中 `codex.routeMode=balanced`。 |
| 当前代码事实 | `selectBalanced` 只按 `ActiveSessions` 最少选择；同数按有效排序 tie-break。 |
| 当前运行证据 | 最近 80 条 route decision 中 72 条走 `channel-routing:codex:balanced`。 |
| 候选池证据 | 多数 `gpt-5.5` 决策 `candidateCount=2`；配置列表中的 disabled、pending / 0 models、模型不匹配、guarded 账号不会参与。 |
| 项目维度证据 | decision 里有 `projectName` 展示值，但当前算法不按 project 做公平调度。 |
| 验收方式 | 后续优化需用 route decision ledger + live sessions history 证明每个项目和账号的 score、候选池、选择结果可解释。 |
| 反证条件 | 若后续发现 route decision 未走 `channel-routing:codex:balanced` 或实际候选池稳定包含多个未阻断账号但仍长期只命中首账号，需重新进入 bug 修复而非产品语义优化。 |

## 正式只读观测

最近 80 条 Codex route decision：

| 维度 | 结果 |
| --- | --- |
| trace reason | 72 条为 `channel-routing:codex:balanced`，8 条没有 channel routing trace。 |
| overall selected | 首位 OAuth 账号 41 次；`公司 1` 34 次；第三账号 1 次；未选中 / 无候选 4 次。 |
| `GetTokens` project | 62 次：`公司 1` 32，首位 OAuth 28，未选中 / 无候选 2。 |
| `Dxyer` project | 14 次：首位 OAuth 10，`公司 1` 2，未选中 / 无候选 2。 |
| empty project | 4 次：首位 OAuth 2，`公司 1` 2。 |
| candidates | 大多数决策 candidate count 为 2，不是全账号池均衡。 |

最近 live history 也显示，请求记录更多体现历史请求落点；balanced 的实时输入不是历史 request count，而是 live tracker 的 active session count。

## 根因判断

当前不是“balanced 配置没有生效”，而是 `balanced` 的产品语义与用户期望不一致：

1. `balanced` 当前只在可路由候选池内按账号活跃 session 数选择。
2. 项目名只是观测字段，不是路由公平性的 key。
3. 候选池会先被 disabled、pending / 0 models、model unsupported、route guard、auth-error 等条件缩小。
4. 历史页面的 80 条 request count 不参与当前 balanced 计算。
5. live tracker 的 active count 当前偏 session 级，不是 request 级或 token 级负载。

## 后续优化目标

### P0：观测补齐

1. route decision history 持久化每次候选池、过滤原因、route mode、projectKey / projectName、selected account、score 输入。
2. live sessions history 保存 routeDecisionID / selectedAccountID / candidateCount / trace summary。
3. 前端运行会话详情能从 request 行跳到对应 route decision 摘要。

### P1：Balanced v2 scoring

1. 引入 sidecar-owned `BalancedScoreProvider`。
2. score 输入至少包含：
   - `activeRequestsByAccount`
   - `activeSessionsByAccount`
   - `recentRequestsByAccount`
   - `recentRequestsByProjectAccount`
   - 可选 `recentTokensByAccount`
   - route guard / cooldown / model support 状态
3. 支持策略名区分：
   - `balanced:account-load`：账号负载均衡。
   - `balanced:project-fair`：项目维度公平分配。
4. tie-break 保留有效路由顺序，保证可预测。

### P2：UI 语义收敛

1. Codex / Claude 账号列表中说明当前 balanced 口径。
2. live sessions 的请求总览显示“当前均衡依据”，避免用户把项目列表误读为项目公平调度。
3. explain 展示“为什么候选只有 2 个”和“为什么本次选中公司 1 / 首位 OAuth”。

## 暂不处理

- 不恢复旧 `project` route mode 或旧 `projectBindings`。
- 不在前端按项目本地分配账号。
- 不用 Wails 临时补偿伪造 sidecar 已经执行项目公平调度。
- 不修改正式版二进制或正式配置。
