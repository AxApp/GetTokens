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
- 状态：implementation-phase-2-5-ui-explain-bridge
- 最近更新：2026-05-31

## 实施记录

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
- 剩余：quota curl / billing curl HTTP 执行器本身仍在 Wails/root 侧，后续可迁入 sidecar；frontend 还未直接展示 `blocked/sources/stale/degraded` explain 字段。

### 2026-05-31 Phase 2.5 UI explain bridge

- 已打通 Wails/root/frontend DTO：`CodexQuotaResponse` 透传 sidecar quota runtime 的 `accountKey/source/status/stale/degradedReason/blocked/blockReason/sources`。
- 账号卡展示阻断状态时读取 sidecar `blocked/sources`，不从本地 quota bars 自行推断是否进入路由阻断。
- 已修复恢复边界：若 `quota-empty` 曾按 `authID` 写入，后续同一 `accountKey` 的 fresh success quota refresh 也能清理该 source，不影响 `manual-disabled` / `rate-limit`。
- 已验证：
  - `go test ./... -count=1`（CLIProxyAPI fork）
  - `go test ./... -count=1`（GetTokens root）
  - `node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs`
  - `npm --prefix frontend run typecheck`
- 剩余：quota curl / billing curl HTTP 执行器本身仍在 Wails/root 侧，后续可迁入 sidecar；Channel Routing explain 过滤原因 UI 仍需单独接入 `quota-empty` 分组展示。
