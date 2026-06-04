# OpenAI-compatible billing quota support

## 背景

DeepSeek 通过 Unified Compose 作为 OpenAI-compatible provider 创建。此前 DeepSeek preset 已提供 `quotaCurlTemplate` / `billingCurlTemplate`，但 `openai-compatible` 账号模型没有承载 quota/billing 字段，导致新建后的 DeepSeek 卡片无法触发余额刷新，也不会显示 `BALANCE`。

已确认：不能把 DeepSeek 改建成 `codex-api-key`，因为这会破坏 OpenAI-compatible provider 的语义与管理链路。

## 目标

1. 保持 DeepSeek / 第三方厂商通过 Unified Compose 创建为 `openai-compatible` unified account。
2. 为 `openai-compatible` provider 增加 quota/billing 配置承载能力。
3. 新建 DeepSeek provider 时保存 preset 的 quota/billing cURL，并在账号卡片使用现有余额展示链路。
4. 不做历史数据迁移；只保证新建/新保存后的 provider 具备能力。

## 范围

- sidecar account-store / management account model 的 openai-compatible credential 字段。
- Wails `OpenAICompatibleProvider` DTO、create/update input、account projection。
- Unified Compose 提交与详情保存链路传递 quota/billing 字段。
- quota refresh 支持 openai-compatible account。
- 前端卡片仍复用现有 `AccountCard` / `BillingBalance`，不做 DeepSeek 特判。

## 非目标

- 不把 DeepSeek 创建为 `codex-api-key`。
- 不迁移历史 `openai-compatible` DeepSeek 账号。
- 不补偿旧数据、旧配置或正式版数据。
- 不新增 DeepSeek 专属 UI 逻辑。
- 不触碰 `/Applications/GetTokens.app` 正式版。

## 验收标准

1. Unified Compose 选择 DeepSeek preset 并提交时，仍调用 `CreateOpenAICompatibleProvider`，不调用 `CreateCodexAPIKey`。
2. 创建 payload 包含 DeepSeek 的 `quotaCurl` / `billingCurl`，且 enabled 状态正确。
3. `ListAccounts()` 投影出的 DeepSeek `AccountRecord` 满足：
   - `accountKind = openai-compatible`
   - `quotaKey = acct_*`
   - `quotaEnabled = true`
   - `billingEnabled = true`
   - `billingCurl` 包含 `/user/balance`
4. `supportsQuota(account)` 对新建 DeepSeek provider 返回 true。
5. `GetCodexQuota(account.quotaKey)` 可对 openai-compatible account 走 sidecar quota refresh 并返回 billing 信息。
6. 相关 Go / frontend 单测、typecheck 与 docs check 通过。

## 设计稿入口

- 本期设计稿：`（不涉及视觉设计稿）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260604-openai-compatible-billing`
- worktree：`../GetTokens-worktrees/20260604-openai-compatible-billing/`

## 相关链接

- 关联原因：DeepSeek 卡片余额不显示；openai-compatible 缺少 quota/billing 能力。

## 当前状态
- 状态：implementation
- 最近更新：2026-06-04
