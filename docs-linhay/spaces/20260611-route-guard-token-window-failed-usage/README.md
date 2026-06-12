# Route Guard Token Window Failed Usage

## 背景
用户反馈 route guard 的 Token 统计在界面上会先到约 80m 再降到约 1.2m，怀疑 fallback / fail back 的失败流量先被加入 token-window。

2026-06-11 初步只读排查 dev 数据库 `/Users/linhey/.config/gettokens-dev/usage-attribution-v1.sqlite`：

- 最近 24 小时某账号成功 usage 汇总约 83.5m，失败请求 90 条但 `failed_tokens=0`。
- 最近 24 小时全部失败请求按状态码汇总 token 均为 0。
- 现象不像当前 dev 数据中已经出现“失败 fallback token 入账”，但代码口径存在隐患：token-window SQL 直接 `SUM(total_tokens)`，没有过滤 `failed=0`。

## 目标
1. 明确 route guard token-window 的统计语义：只按成功完成并产生真实 token usage 的事件计入 token 限流。
2. 失败 attempt 仍保留 usage attribution 事件和 request-window 计数，但不参与 token-window 用量。
3. 为 fallback / upstream failure 场景补回归测试，避免失败事件携带 token 时误触发 route guard。

## 范围
- CLIProxyAPI fork：`internal/gettokenshooks/rate_limit.go`
- CLIProxyAPI fork 测试：`internal/gettokenshooks/rate_limit_test.go`
- 文档与记忆写回

## 非目标
1. 不修改 usage desk / live sessions 的展示刷新策略。
2. 不清洗既有历史 usage 数据。
3. 不触碰正式版 GetTokens App、正式版 sidecar 或正式版配置。

## 验收标准
1. Given 同一账号 24h token-window limit=500，When 窗口内有成功 usage 100 tokens 和失败 usage 900 tokens，Then route guard 当前 token usage 为 100 且不阻断。
2. Given 同一账号 24h token-window limit=100，When 成功 usage 达到 100 tokens，Then route guard 仍按成功 token 立即阻断。
3. Given request-window 规则，When usage attribution 中存在失败事件，Then request-window 仍按请求事件数量统计，不被本次 token 口径调整改变。
4. 自动化验证覆盖 focused 测试与 `internal/gettokenshooks` 包测试。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260611-route-guard-token-window-failed-usage`
- worktree：`../GetTokens-worktrees/20260611-route-guard-token-window-failed-usage/`

## 相关链接
- [Sidecar Route Guard / Rate Limit 技术方案](../../dev/20260531-sidecar-route-guard-rate-limit.md)
- [Sidecar Route Guard Rate Limit Optimization](../20260531-sidecar-route-guard-rate-limit/README.md)

## 当前状态
- 状态：implemented-verified
- 最近更新：2026-06-12

## 实施记录

### 2026-06-12

- 追加问题来源：用户在账号池卡片标注“今日请求 / 今日 TOKEN”，指出解除限制后昨日用量仍留在今日统计里。
- 代码事实：`frontend/src/features/accounts/components/CardSections.tsx` 的 `RateLimitGuard` 在没有限流规则时会进入无限制展示分支；此前直接使用 `usageSummary.requestCount / totalTokens`，而 `useAccountsUsageState` 拉取的是 `GetSidecarUsageAttribution({ window: '24h', bucket: '1h' })`，24h 汇总会包含本地昨日但仍在 24 小时窗口内的 bucket。
- 修复：新增 `buildAccountTodayUsageTotals()`，按本地日历日过滤 `trafficBuckets` 后汇总“今日请求 / 今日 TOKEN”；无 bucket 的 legacy 数据保持旧 fallback。`RateLimitGuard` 的无限制分支改用该当天汇总，活动条也跟随当天值。
- 验证：
  - `node --test src/features/accounts/tests/accountUsage.test.mjs src/features/accounts/tests/rateLimit.test.mjs`
  - `npm run typecheck`
- 沉淀判断：这是账号池 route guard 卡片展示口径的局部修复；已用前端模型测试与源码守卫固化，不新增项目级 skill 或 AGENTS 规则。

### 2026-06-11

- 红灯：新增 `TestRateLimitEvaluatorTokenWindowIgnoresFailedUsageTokens`，验证成功 usage 100 tokens + 失败 usage 900 tokens + limit 500 时，旧实现会得到 `UsageValue=1000` 并错误阻断。
- 修复：`rateLimitTokenWindowStrategy` 的 usage SQL 增加 `failed = 0`，token-window 只统计成功完成的真实 token usage；request-window 语义保持不变，仍按事件数量统计。
- 绿灯：
  - `go test ./internal/gettokenshooks -run 'TestRateLimitEvaluator(TokenWindowIgnoresFailedUsageTokens|BlocksTokenWindowRule|BlocksRequestWindowRule)' -count=1 -v`
  - `go test ./internal/gettokenshooks -run 'TestUsageAttributionPluginRefreshesRateLimitGuardAfterPersist' -count=1 -v`
  - `go test ./internal/gettokenshooks -count=1`
- 沉淀判断：本轮是已存在 route guard/token-window 领域规则的补窄，不新增项目级 skill；语义写入本 space 和 memory 即可。
