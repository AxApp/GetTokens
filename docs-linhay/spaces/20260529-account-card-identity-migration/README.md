# 账号卡身份模型迁移

## 背景

当前账号池存在两套身份语义：

1. GetTokens 前端账号卡使用 `AccountRecord.id`，例如 `codex-api-key:<local-id>`。
2. sidecar 请求热路径和 usage attribution 使用 `auth-id` / `auth-index` / `provider` 等 runtime evidence。

这种分层在展示上可以通过 Wails join 兜底，但在 rate-limit 这种需要稳定策略匹配的能力上会产生错配：规则绑定账号卡 ID，实际用量事件可能只写 runtime evidence，导致账号卡下的单日限量规则用量显示为 0。

本次迁移把产品模型收敛为：**没有用户实体，只有账号卡；账号卡 ID 是所有业务归属的唯一身份源**。

## 目标

1. `account_key` / `account_id` 唯一代表一张账号卡。
2. 登录/导入/复制创建新账号卡并分配新 `account_key`。
3. 重新登录从现有账号卡发起，只更新凭证和 runtime evidence，保留原 `account_key`。
4. sidecar runtime auth candidate 必须携带账号卡 `account_key`。
5. usage attribution 新事件直接写入 `account_key`；`attribution_key` 只作为诊断 evidence。
6. rate-limit 规则、状态、事件只按 `account_key` 匹配，破坏性移除 `match_key`。

## 范围

### GetTokens App

- Wails / management client rate-limit DTO 删除 `matchKey`。
- 前端 `RateLimitRulesSection` 只保存 `accountKey`，保留单行摘要 + 编辑配置态。
- 账号卡文档和测试补充“登录创建卡，重新登录更新卡”的身份语义。

### CLIProxyAPI Sidecar Fork

- `config.CodexKey` 增加并持久化 `local-id`。
- runtime `auth.Auth` 增加 `AccountKey`。
- watcher synthesizer 为 Codex API key、auth-file、OpenAI-compatible provider 填充账号卡 ID。
- usage attribution 新事件必须尽可能写入 `account_key`。
- rate-limit SQLite schema/API/DTO/evaluator 破坏性移除 `match_key`。

## 非目标

- 不兼容旧版本前端或旧 sidecar API。
- 不保留 rate-limit 表中的 `match_key` 数据。
- 不引入服务端多用户体系；OAuth subject / email / API key hash 都只是账号卡 evidence。
- 不把 SQLite `rowid` / 自增 ID 作为产品身份。

## 验收标准

1. sidecar runtime 中每个 GetTokens 管理的 auth candidate 都带稳定 `account_key`。
2. 两张账号卡即使凭证内容相同，也拥有不同 `account_key`，usage 和 rate-limit 不串账。
3. 重新登录账号卡后 `account_key` 不变，旧/new runtime evidence 都归属同一账号卡。
4. 新 `usage_attribution_events` 对 GetTokens 管理账号必须写入非空 `account_key`。
5. `rate_limit_rules` / `rate_limit_events` schema 不再包含 `match_key`。
6. sidecar rate-limit evaluator 查询 usage 时只使用 `account_key = ?`。
7. GetTokens frontend / Wails / API 类型不再出现 rate-limit `matchKey`。
8. 文档和 memory 写入本次身份模型决策，并完成 `qmd update && qmd embed`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260529-account-card-identity-migration`
- worktree：`../GetTokens-worktrees/20260529-account-card-identity-migration/`
- sidecar branch：`gettokens/account-card-identity-migration`
- sidecar worktree：`../CLIProxyAPI-worktrees/20260529-account-card-identity-migration/`

## 相关链接

- 既有限流 space：`docs-linhay/spaces/20260515-rate-limit-middleware/`
- sidecar usage attribution 架构：`docs-linhay/dev/20260514-sidecar-usage-account-attribution-architecture.md`
- 账号详情 runtime 观测边界：`docs-linhay/dev/20260519-account-detail-runtime-observability-boundary.md`

## 当前状态
- 状态：implemented-in-worktrees
- 最近更新：2026-05-29

## 2026-05-29 执行结果

- Sidecar fork 已接入 `Auth.AccountKey`，Codex API key 使用 `local-id`，auth-file 使用 `auth-file:<file-name>`，OpenAI-compatible 使用 `openai-compatible:<provider-name>`。
- Sidecar fork 对缺失 `local-id` 的 standalone Codex API key 会生成 `codex-api-key:legacy-*` 并写回配置。
- Sidecar usage attribution 写入 `account_key`，rate-limit schema / evaluator / API 已破坏性移除 `match_key`。
- GetTokens Wails / cliproxyapi / frontend rate-limit DTO 已移除 `matchKey`。
- `RateLimitRulesSection` 默认展示单行摘要，点击编辑进入配置态；配置态不再使用横向滚动表格。
- 账号详情弹窗的 rate-limit CRUD 改为由页面 shell 注入；browser preview 不再直接触发真实 Wails binding。
- 登录语义保持为：新登录产生新账号卡；从账号详情发起重新登录时回填到原 auth-file 名称，因此保留原账号卡 ID。

## 当前验证

- Sidecar：`go test ./internal/config ./internal/watcher/synthesizer ./internal/gettokenshooks ./internal/runtime/executor/helps ./sdk/cliproxy/usage ./sdk/cliproxy/auth ./internal/api/handlers/management`
- GetTokens：`go test ./internal/sidecar ./internal/cliproxyapi ./internal/wailsapp`
- GetTokens frontend：`npm run typecheck`
- GetTokens frontend：`npm run build`
- GetTokens frontend：`npm run test:unit`
- Build smoke：`CLI_PROXY_SOURCE_DIR=../CLIProxyAPI-worktrees/20260529-account-card-identity-migration ./scripts/wails-cli.sh build`，确认打包产物使用 sidecar 提交 `3837f0a3`。
- Dev runtime smoke：以 `GETTOKENS_APP_PROFILE=dev` 启动构建产物，sidecar 监听 `18317`，`/healthz` 返回 200。
- Rate-limit management smoke：对 dev sidecar 执行 `strategies -> create rule -> status -> events -> delete rule -> list`，状态码均为 200，临时规则 `runtime-smoke-delete-me` 已删除。
- `playwright-cli` preview：打开 `?preview=accounts#frame=accounts&detail=codex-api-key%3Astable-001`，确认无 `Cannot read properties of undefined`，summary 为单行，点击编辑进入配置表单态。
- 截图：
  - `docs-linhay/spaces/20260529-account-card-identity-migration/screenshots/20260529/accounts/20260529-accounts-rate-limit-summary-after-v01.png`
  - `docs-linhay/spaces/20260529-account-card-identity-migration/screenshots/20260529/accounts/20260529-accounts-rate-limit-config-after-v01.png`
