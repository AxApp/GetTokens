# 20260616-xiaomi-mimo-quota-parser

## 背景

用户反馈正式环境 Xiaomi MiMo Token Plan 账号填入平台 Cookie 后，额度显示仍不对，并提供了 `https://platform.xiaomimimo.com/api/v1/tokenPlan/usage` 的浏览器 cURL 作为复现证据。

只读排查发现：

- 正式账号 `acct_44d756af-6030-49c9-bd89-b6a8adb807da` 是 `Xiaomi MiMo Token Plan`，quota/billing 脚本均依赖 `{{platformCookie}}`。
- 真实 usage 响应结构为 `data.usage.percent=0.53`、`data.monthUsage.percent=0.7842`，语义是比例值，即 53% 与 78.42%，不是 0.53% 与 0.7842%。
- 真实 balance 响应结构为 `data.balance/currency/giftBalance/cashBalance`，不是 DeepSeek 风格的 `balance_infos`。
- 当前 parser 把 Xiaomi `percent` 当 0-100 百分数使用，并且 billing parser 不识别 Xiaomi balance shape。

根因：Xiaomi MiMo 平台 usage API 的 `percent` 字段是 0-1 比例，但 GetTokens / sidecar parser 按 0-100 百分数解释，导致剩余额度接近 99%；同时余额接口返回 Xiaomi 专属 `data.*Balance` 结构，当前 billing parser 未适配。

### 2026-06-16 追加进度条问题

用户继续反馈“现在进度条对不上”。基于当前代码复核：

- 问题来源：用户提供 Xiaomi `tokenPlan/usage` cURL，并指出进度条视觉与平台不一致。
- 代码事实位置：`frontend/src/features/accounts/model/accountQuota.ts` 已从 `remainingPercent` 派生 `usedLabel`，但 `frontend/src/features/accounts/components/CardSections.tsx` 的百分比模式仍直接用 `window.remainingPercent` 作为右侧文本和进度条宽度。
- 当前现象：Xiaomi parser 已把平台 `percent=0.53` 归一为 `remainingPercent=47`；GetTokens 卡片百分比进度条显示和填充 47%，而 Xiaomi 平台进度条语义是已用 53%。
- 预期验收：百分比进度条按已用比例填充和显示，颜色仍按剩余额度风险判断；迷你指标、最长窗口筛选、route guard 继续使用 `remainingPercent`。
- 反证条件：如果真实 sidecar runtime 返回的 `remaining_percent` 仍接近 99，说明运行中的 sidecar 未包含 parser 修复，不能归因到前端进度条。

## 目标

1. Xiaomi MiMo Token Plan usage 响应中 `0 <= percent <= 1` 时按比例归一为百分数。
2. Xiaomi MiMo balance 响应映射到统一 `QuotaRuntimeBilling` / `CodexQuotaBilling`。
3. 主仓 parser 与 sidecar fork parser 保持一致，确保 Wails fallback 与 sidecar runtime refresh 都有回归保护。
4. 账号卡 `QuotaBars` 的百分比进度条展示已用进度，避免与 provider 平台 usage 进度条反向。

## 范围

- 主仓：`internal/accounts/quota_curl.go` 与对应测试。
- sidecar fork：`docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/quota_refresh.go` 与对应测试。
- 本仓本地 sidecar binary rebuild：`build/bin/cli-proxy-api`。

## 非目标

- 不修改正式版 `/Applications/GetTokens.app`。
- 不重启、替换或 kill 正式环境 sidecar。
- 不提交或保存用户提供的平台 Cookie、API key、原始响应敏感内容。
- 不调整 Xiaomi 账号创建表单或视觉样式。

## 验收标准

- 旧 parser 在 Xiaomi `percent=0.53/0.7842` fixture 下出现红灯：剩余被算成 99%。
- 修复后同一 fixture 输出 PLAN 剩余 47%、MONTH 剩余 22%，并保留 token used/limit/remaining。
- Xiaomi balance fixture 输出一个 CNY balance info，映射 `balance -> totalBalance`、`giftBalance -> grantedBalance`、`cashBalance -> toppedUpBalance`。
- `remainingPercent=47` 的 quota window 在卡片百分比模式显示 / 填充 53%，但颜色阈值仍按剩余 47% 判断。
- sidecar fork 相关包和全量测试通过。
- 本仓本地 sidecar rebuild 后 meta 指向 clean fork commit。
- 临时隔离 sidecar 运行态验收通过：fixture server 返回 Xiaomi usage/balance shape，真实 `build/bin/cli-proxy-api` 创建临时 openai-compatible 账号后执行 `quota-refresh`，返回 PLAN 47%、MONTH 22%、CNY balance。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-xiaomi-mimo-quota-parser`
- worktree：`../GetTokens-worktrees/20260616-xiaomi-mimo-quota-parser/`

## 相关链接

- sidecar fork commit：`2a1696056466b1c8240c0b6f43379b3ebe068684`
- 本地 sidecar rebuild fingerprint：`2a1696056466b1c8240c0b6f43379b3ebe068684:clean:0a20cd74e24f15510ffe20c0e4a96ef1ad19a1b1931e7a061930c6c421c66009:darwin:arm64`
- 运行态验收：`2026-06-16` 临时 config / 临时 account DB / 本地 fixture server，真实 `build/bin/cli-proxy-api` 创建临时 Xiaomi openai-compatible 账号并执行 `quota-refresh`，返回 PLAN 47%、MONTH 22%、CNY balance；验收后进程与临时目录已清理。
- 追加前端进度条验收：`remainingPercent=47` 的 quota window 现在显示 / 填充已用 `53%`，颜色仍按剩余 `47%` 判断；`node --test frontend/src/features/accounts/tests/accountCardLayout.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs`、`npm --prefix frontend run test:unit -- src/features/accounts/tests/accountCardLayout.test.mjs src/features/accounts/tests/accountQuotaRuntime.test.mjs`、`npm --prefix frontend run typecheck` 通过。
- 浏览器预览验收：`http://127.0.0.1:5173/?preview=accounts#frame=accounts` 无头 Chrome DOM 抽样确认 8 个 quota section 均为 `data-quota-display-mode="percent"`，右侧百分比与实际 fill width 一致；截图：`screenshots/20260616/accounts/20260616-xiaomi-quota-progress-after-v01.png`。

## 当前状态
- 状态：implemented
- 最近更新：2026-06-16
