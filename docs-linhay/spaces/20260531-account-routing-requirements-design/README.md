# 账号路由需求设计

## 背景

上一轮已把 Channel Routing 的 legacy 逻辑移除，Codex / Claude 渠道路由现在只保留 `sequential / balanced`、渠道账号顺序和渠道组状态。

当前仍需要重新设计“哪些账号应进入路由循环”的产品与 sidecar 语义。已确认的现状是：账号池展示的 quota / 余额为 0 只是资源展示状态，不会自动写入 sidecar 热路径的 `Auth.Unavailable`、`AccountRouteGuardStore` 或 `rate-limit` guard source。因此，用户可能看到“账号池显示没有额度，但账号仍进入路由循环”。

本 space 用于把账号路由需求先设计清楚，再进入实现。重点不是恢复 legacy，而是在当前两模式路由上明确可路由池、quota/余额、guard source、配置入口和 explain 之间的关系。

## 目标

1. 定义账号进入可路由池的完整条件，区分用户意图、运行态阻断、资源展示和探测新鲜度。
2. 决定 quota / 余额为 0 是否自动阻断路由，以及阻断由哪个层负责：sidecar guard、Wails runtime source、前端展示过滤或手动规则。
3. 定义 Codex / Claude Channel Routing 在 UI 上如何解释“可参与账号 / 被过滤账号 / 无额度账号”。
4. 定义 dry-run / explain / route ledger 的可观测字段，让用户能理解一个账号为什么仍被选中或被排除。
5. 形成 BDD/TDD 验收清单，再进入代码实现。

## 范围

- sidecar 路由热路径：
  - `manual-disabled`
  - `rate-limit`
  - `auth-error`
  - `upstream-rate-limit`
  - `upstream-error`
  - 可选新增的 quota / balance guard source
- Channel Routing：
  - Codex / Claude 请求顺序
  - `sequential / balanced`
  - 渠道组状态
  - dry-run / explain
- 账号池展示：
  - quota / 余额状态
  - requestable / disabled / blocked / error 的文案边界
  - “显示无额度但仍可路由”的解释或阻断入口
- 管理 API / Wails DTO：
  - guard source 状态透出
  - quota / balance 新鲜度、来源与阻断原因透出

## 非目标

- 不恢复 `project` route mode、`projectBindings`、fallback mode 或 upstream compat route mode。
- 不把账号路由阻断做成 Gin middleware；必须保留 selector fallback 和 retry。
- 不把前端展示过滤伪装成 sidecar 已阻断。
- 不设计 streaming 中途账号迁移；WebSocket 仍只在 request boundary 切换。
- 不在本 space 直接实现代码，除非需求和验收先收敛。

## 验收标准

1. Given 账号被用户手动禁用，When 新请求进入路由，Then 该账号不进入候选池，explain 显示 `manual-disabled`。
2. Given 账号命中配置的 rate-limit 规则，When 新请求进入路由，Then selector 跳过该账号并继续 fallback，explain 显示规则、窗口和 next reset。
3. Given 账号 quota / 余额显示为 0，When 需求选择“自动阻断”，Then 阻断必须由 sidecar-owned guard source 产生，前端只展示该事实，不本地推断。
4. Given 账号 quota / 余额显示为 0，When 需求选择“只提示不阻断”，Then 账号仍可进入候选池，但 explain / UI 必须明确 quota 展示不等于 route guard。
5. Given quota 数据过期或来源不可信，When 评估路由阻断，Then 系统不得误杀账号；必须展示 stale / degraded 原因。
6. Given sequential 模式第一个账号因 guard 被过滤，When 后续账号可用，Then 请求继续尝试下一个账号。
7. Given balanced 模式有多个账号可用，When 部分账号被 guard 过滤，Then 均衡只在剩余可路由账号中计算。
8. Given Codex WebSocket pinned auth 命中 guard，When 下一个 downstream request 到达，Then 释放 pin、关闭旧 upstream，并重新进入 route engine。
9. Given 用户打开 Codex / Claude 账号列表，When 查看参与账号，Then UI 能区分“禁用 / 阻断 / 无额度展示 / 错误不可用 / 可请求”。
10. Given 用户运行 dry-run / explain，When 账号被排除，Then trace 不包含 payload、token、cookie 或完整错误体。
11. Given Codex `balanced` 模式有多个项目同时请求，When 候选池内账号数、活跃 session 数和历史请求数不一致，Then route ledger / live sessions 必须能解释本次均衡依据，并明确它是按账号负载、项目公平性还是请求轮询在计算。
12. Given 用户期望“多项目均分账号”，When 当前 `balanced` 只按账号活跃 session 数选择，Then UI / explain 不能暗示它已经提供项目维度公平调度；若要提供该语义，需要进入下一期 `balanced-v2` 设计。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260531-account-routing-requirements-design`
- worktree：`../GetTokens-worktrees/20260531-account-routing-requirements-design/`

## 相关链接

- [Account Routing Quota Guard 技术方案](../../dev/20260531-account-routing-quota-guard.md)
- [Account Routing Engine](../20260524-account-routing-engine/README.md)
- [Account Routing Engine 技术边界](../../dev/20260524-account-routing-engine.md)
- [Sidecar route guard / rate-limit](../20260531-sidecar-route-guard-rate-limit/README.md)
- [2026-05-31 memory：账号池 quota 与路由热路径边界排查](../../memory/2026-05-31.md)

## 当前状态
- 状态：balanced-mode-next-optimization-recorded
- 最近更新：2026-06-16

## 实施记录

### 2026-06-16 正式环境 Codex balanced 多项目未均分排查记录

- 问题来源：用户在正式 GetTokens `#frame=codex&workspace=live-sessions` 看到多项目运行时，`balanced` 模式下账号命中没有按项目均分。
- 只读证据：
  - 正式运行态 `~/.config/gettokens/channel-routing/config.json` 中 `codex.routeMode=balanced`，所以本次不是配置未生效。
  - 正式 sidecar route decision 最近 80 条中，72 条 trace reason 为 `channel-routing:codex:balanced`。
  - 最近 80 条选择分布约为：首位 OAuth 账号 41 次，`公司 1` 34 次，第三账号 1 次，未选中 / 无候选 4 次。
  - 按项目看：`GetTokens` 62 次中 `公司 1` 32、首位 OAuth 28、无候选 2；`Dxyer` 14 次中首位 OAuth 10、`公司 1` 2、无候选 2。
  - 多数 `gpt-5.5` 决策的 `candidateCount=2`，不是配置列表里所有账号都参与。
  - 账号库显示配置顺序里的部分账号处于 disabled、pending / 0 models，或模型不匹配；第三个 OAuth 账号存在 `auth-error` guard，实际只偶发参与。
- 当前代码事实：
  - `internal/gettokensrouting/channel.go` 的 `selectBalanced` 只比较 `Account.ActiveSessions`，同数时按有效路由顺序 tie-break。
  - `internal/gettokenshooks/channel_routing_policy.go` 的 `ActiveSessions` 来自 `currentLiveSessionActiveAuthCounts()`。
  - `currentLiveSessionActiveAuthCounts()` 按 session 级 `AuthID` 统计活跃 session，不按项目、请求数、token 数或最近窗口负载计算。
- 初步结论：
  - 当前 `balanced` 已生效，但语义是“在剩余可路由候选账号中按活跃 session 数粗粒度均衡”，不是“多项目按账号均分”。
  - 截图中的项目名属于 live sessions 展示 / 观测维度，当前不是路由公平性的输入键。
  - 这轮不直接修复代码，记录为后续 `balanced-v2` 优化需求。
- 后续优化方向：
  - sidecar 内新增 `balanced-v2` 或扩展 balanced scorer，按 `projectKey + model + account` 维护滑动窗口负载。
  - scorer 至少考虑 active requests、active sessions、最近 N 分钟 request count、可选 token usage、route guard / cooldown 状态和有效排序 tie-break。
  - route decision ledger 持久化当次候选池、过滤原因、active score、projectKey / projectName、selected account，避免历史页面只能看到 auth 命中而无法解释当时为什么选中。
  - live sessions 与 route explain 使用同一份 sidecar-owned route decision 数据，UI 明确区分“账号负载均衡”和“项目公平均衡”。
- 详细证据记录见：[Balanced Mode 正式环境排查 v01](./plans/20260616-balanced-mode-prod-investigation-v01.md)。

### 2026-05-31 Phase 1 sidecar guard

- 已在 CLIProxyAPI fork 新增 `quota-empty` route guard source 与 quota guard evaluator。
- 已覆盖 fresh quota empty、最晚 resetAt、stale/degraded 不阻断、只清理 `quota-empty`、hard-filter 排除候选、sticky 不能复活候选、WebSocket pinned auth request-boundary release source/reason。
- 已验证：
  - `go test ./internal/gettokenshooks -run 'TestQuotaGuard|TestAccountRouteGuard' -count=1`
  - `go test ./internal/gettokenshooks ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`
- 下一阶段：把账号池 quota curl / billing curl 刷新结果写入 sidecar-owned quota runtime source，并通过 management API / Wails / frontend 统一展示同一份 sidecar 状态。

### 2026-05-31 Phase 2 sidecar quota runtime bridge

- 已在 CLIProxyAPI fork 新增 sidecar `quota-status` runtime store 与 management API，`PUT /v0/management/gettokens/quota-status/<acct_*>` 会同步 `quota-empty` guard，`GET` 返回同一份 runtime + guard source 状态。
- 已调整 Wails `GetCodexQuota`：统一账号 quota refresh 后先写入 sidecar quota-status，再用 sidecar 返回值映射给现有 UI DTO；auth-file cache fallback 写入 `status=stale`。
- reset time 语义已落地：fresh empty window 使用 `reset_at_unix` 生成 `quota-empty.ExpiresAt`；stale/cache 不新增强阻断，也不提前清除已有 fresh block，已有 block 等 reset 到期自然失效。
- 已验证：
  - `go test ./internal/gettokenshooks -run 'TestQuotaRuntime|TestQuotaGuard|TestAccountRouteGuard' -count=1`
  - `go test ./internal/gettokenshooks ./sdk/cliproxy/auth ./sdk/api/handlers/openai -count=1`
  - `go test ./internal/cliproxyapi ./internal/wailsapp -run 'TestQuotaRuntime|TestGetCodexQuota|TestTestCodexAPIKeyQuotaCurl' -count=1`
  - `go test ./internal/cliproxyapi ./internal/wailsapp -count=1`
- 当时剩余：quota curl / billing curl HTTP 执行器与 frontend explain 字段仍未完成；后续 Phase 2.5 / Phase 3a 已继续推进。

### 2026-05-31 Phase 2.5 UI explain bridge

- 已打通 Wails/root/frontend DTO：`CodexQuotaResponse` 透传 sidecar quota runtime 的 `accountKey/source/status/stale/degradedReason/blocked/blockReason/sources`。
- 账号卡展示阻断状态时读取 sidecar `blocked/sources`，不从本地 quota bars 自行推断是否进入路由阻断。
- 已修复恢复边界：若 `quota-empty` 曾按 `authID` 写入，后续同一 `accountKey` 的 fresh success quota refresh 也能清理该 source，不影响 `manual-disabled` / `rate-limit`。
- 已验证：
  - `go test ./... -count=1`（CLIProxyAPI fork）
  - `go test ./... -count=1`（GetTokens root）
  - `node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs`
  - `npm --prefix frontend run typecheck`
- 剩余：quota curl / billing curl 解析和 provider-specific 映射仍在 Wails/root 侧，后续可迁入 sidecar-native endpoint；Channel Routing explain 过滤原因 UI 仍需单独接入 `quota-empty` 分组展示。

### 2026-05-31 Phase 3a sidecar HTTP execution bridge

- 已把 Codex API key quota curl / billing curl 的 HTTP 执行从 Wails/root 直连改为 sidecar `/v0/management/api-call`。
- Wails/root 当前仍保留 curl 解析和 quota/billing 响应映射；sidecar 负责实际出网请求、proxy/system proxy 语义和请求执行。
- quota refresh 成功后仍写入 sidecar `quota-status`，所以 UI 展示与路由过滤继续共享同一 sidecar runtime 状态。
- 已验证：
  - `go test ./internal/wailsapp -run 'Test.*Codex.*Quota|Test.*Billing|TestManagementAPICallResponseStatusCode' -count=1`
  - `go test ./internal/wailsapp ./internal/cliproxyapi -count=1`
  - `node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs`
  - `npm --prefix frontend run typecheck`
- 剩余：quota curl / billing curl 解析器、provider-specific 映射、reset 到期主动 refresh 调度仍可继续迁入 sidecar-native endpoint；Channel Routing explain 过滤原因 UI 仍需单独接入 `quota-empty` 分组展示。

### 2026-05-31 Phase 3b sidecar-native quota refresh 实施

- 已新增 sidecar-native `quota-refresh` / `quota-test` / `billing-test` management endpoint，把 API key quota curl 解析、provider-specific 映射、HTTP 执行和 `quota-status` upsert 放进 sidecar。
- 已保存 Codex API key 账号 refresh 从 sidecar account store 读取 `acct_*` credential，fresh success 写入 `QuotaRuntimeStore.Upsert` 并同步 `quota-empty`；草稿 quota/billing 测试不写 runtime、不生成 guard。
- Wails/root 已切到只调用 sidecar endpoint，并继续把 `QuotaRuntimeState` 映射给现有 UI DTO；root 侧 API key quota/billing parser 已删除，只保留 auth-file usage payload 解析。
- auth-file usage refresh 暂不迁移，仍通过 sidecar `/v0/management/api-call` 做 token 注入后写 quota runtime。
- reset time 继续作为 `quota-empty.ExpiresAt`；本期采用按需 refresh 与过期自然清理，不做后台全量轮询。
- 已验证：
  - `go test ./internal/api/handlers/management -run 'TestQuotaRefresh|TestQuotaDraft|TestBillingDraft' -count=1`（CLIProxyAPI fork）
  - `go test ./internal/api/handlers/management ./internal/gettokenshooks -count=1`（CLIProxyAPI fork）
  - `go test ./... -count=1`（CLIProxyAPI fork）
  - `go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp -count=1`
  - `go test ./... -count=1`（GetTokens root）
  - `node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
  - `./scripts/ensure-sidecar.sh darwin arm64`
- 备注：此前出现过一次 GetTokens root `internal/codexbinary` 本地 mock release binary 版本识别为 `unknown` 的环境失败，本轮复跑 `go test ./... -count=1` 已通过。
- 详细方案见：[Account Routing Quota Guard 技术方案](../../dev/20260531-account-routing-quota-guard.md)。
