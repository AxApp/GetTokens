# OAuth Model Probe

## 背景
用户在账号池 OAuth 账号详情页 `#frame=accounts&detail=codex-plus-nightly.json` 询问“为什么没有模型测试”。当前实现中，OAuth/auth-file 账号详情只展示 auth-file 摘要、模型映射和 rate-limit 等模块；“发送验证”只挂在 API key / openai-compatible 的凭据模块上。

这不是单纯的前端漏渲染，而是能力边界不同：API key 测试可以直接用 `apiKey + baseUrl + model` 请求 OpenAI-compatible `/chat/completions`；OAuth/auth-file 账号没有可直接暴露给前端的 API key/base URL，应通过 GetTokens sidecar 的 Codex relay 路由探测来验证某个模型是否能命中指定 OAuth 账号。

## 目标
1. 在 OAuth/auth-file 账号详情页提供“模型测试/模型探测”能力。
2. 测试必须约束到当前账号，不能被 Codex 路由 fallback 到其他账号后误报成功。
3. 结果要展示请求是否成功、HTTP 状态、命中账号、失败原因和可追溯证据。
4. 总账号池详情页与 Codex Channel Routing 详情页保持一致的 OAuth 探测语义。
5. 移除本路径中的 legacy/local-only auth-file 业务，只保留 SQLite account-store 统一账号。

## 范围
1. 账号池 `#frame=accounts` OAuth/auth-file 详情页。
2. Codex Channel Routing 账号详情页中的 `codex-auth-file` 行。
3. 账号池 legacy auth-file 数据路径移除：不再通过 `ListAuthFiles` 派生 `auth-file:<name>` 账号作为账号池业务对象。
4. Wails/root 绑定或复用现有 `ProbeCodexAccountRouting` 能力时的前端调用边界。
5. 相关单元测试、后端 focused tests、浏览器/DOM 验收和必要截图归档。

## 非目标
1. 不把 OAuth token、auth.json 或 refresh token 暴露给前端。
2. 不复用 `VerifyOpenAICompatibleProvider` 伪造 OAuth 测试。
3. 不改变 OAuth/auth-file 默认模型透传和 alias 映射语义。
4. 不新增移动端适配或移动端截图验收。
5. 不自动后台批量测试所有 OAuth 账号，避免额外消耗额度。
6. 不为 legacy/local-only auth-file 账号保留兼容 UI、迁移提示或探测 fallback。

## 证据门禁

| 项目 | 当前证据 |
| --- | --- |
| 问题来源 | 用户在 `2026-06-09` 指出 OAuth 账号详情页没有模型测试。 |
| 当前 UI 事实 | `frontend/src/features/accounts/model/accountDetailLayout.ts` 中 `credentialSource === 'auth-file'` 只返回 `auth-file-actions / models / rate-limit`。 |
| 当前组件事实 | `frontend/src/features/accounts/components/UnifiedAccountDetailModal.tsx` 只有 `credentials` 模块渲染 `AccountCredentialVerifySection`；OAuth 模型区 `editable={isApiKey && ...}`。 |
| 当前后端事实 | `internal/wailsapp/openai_compatible.go` 的 `VerifyOpenAICompatibleProvider` 需要 `apiKey/baseUrl/model`；`internal/wailsapp/oauth_model_alias.go` 只有 OAuth alias 的 list/update。 |
| 可复用能力 | `internal/wailsapp/codex_routing_probe.go` 已支持 `ProbeCodexAccountRouting`，并通过 `AllowAccountIDs` 生成 `X-GetTokens-Route-Allow`，`X-GetTokens-Route-Fallback=false`。 |
| Legacy 事实 | `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 仍拉 `ListAuthFiles`，并通过 `mapAuthFileToRecord` / `resolveLoadedAuthFileRecords` 派生 legacy `auth-file:<name>` 账号。 |
| 风险点 | hash detail 里的 `codex-plus-nightly.json` 不能直接当路由约束；探测必须使用当前 account-store record 的统一 `acct_...` ID，再由后端映射到 auth-file route id。 |
| 验收方式 | focused Go tests + 前端单元测试 + `npm --prefix frontend run typecheck` + 浏览器/DOM 验证详情页出现 OAuth 模型测试入口并能显示 mock/真实探测状态。 |
| 反证条件 | 如果 sidecar route headers 无法稳定约束 auth-file 账号，必须先修 sidecar route guard，不得只在前端展示“指定账号测试”。 |

## 验收标准
1. Given 一个 active OAuth/auth-file Codex 账号，When 在详情页输入或选择模型并点击测试，Then 只允许该账号参与探测，fallback 关闭。
2. Given 目标 OAuth 账号支持该模型，When 探测完成，Then UI 显示成功、HTTP 2xx、命中账号名称和 evidence。
3. Given 目标账号不支持该模型或 token 失效，When 探测完成，Then UI 显示失败状态、HTTP/错误摘要，不把其他账号成功当成当前账号成功。
4. Given 账号被禁用、不可请求或 sidecar 未 ready，Then 测试按钮不可用或给出明确原因。
5. Given 账号数据刷新，Then 账号池不再调用 `ListAuthFiles` 生成 legacy auth-file 账号；OAuth 账号来自 `ListAccounts` 的 unified account-store。
6. Given 当前处于普通浏览器 preview，Then UI 可渲染 preview-only 状态，但 preview 数据也应使用 unified `acct_...` 形态。
7. Given 旧 hash 使用 `detail=<auth-file-name>.json`，Then 只作为深链别名解析到 unified OAuth account；不得重新生成 `auth-file:<name>` legacy 账号。
8. 文档、测试和截图按本 space 归档；未做真实 dev App 手点时必须说明原因。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260609-oauth-model-probe`
- worktree：`../GetTokens-worktrees/20260609-oauth-model-probe/`
- 当前状态：仅开 space 和规划，尚未创建 branch/worktree。

## 相关链接
- 计划：`plans/20260609-oauth-model-probe-plan-v01.md`
- 相关代码：
  - `frontend/src/features/accounts/model/accountDetailLayout.ts`
  - `frontend/src/features/accounts/components/UnifiedAccountDetailModal.tsx`
  - `frontend/src/features/codex/components/CodexAccountDetailModal.tsx`
  - `internal/wailsapp/codex_routing_probe.go`
  - `internal/wailsapp/openai_compatible.go`

## 实现记录

2026-06-09 已实现：
1. 账号池主数据流移除 `ListAuthFiles` 派生账号路径，OAuth/auth-file 账号只来自 `ListAccounts` 的 unified account-store record。
2. 删除账号池前端 `mapAuthFileToRecord` / `resolveLoadedAuthFileRecords` / `removeDeletedAuthFile` legacy helper 使用，selection、patch、disabled sync 和 runtime sync 改为按 unified account id 工作。
3. 新增 `OAuthModelProbeSection`，账号池 OAuth 详情页与 Codex account-list auth-file 详情页共用同一模型测试 UI。
4. 前端发起 probe 时传 `allowAccountIDs: [当前账号 id]`、`orderAccountIDs: [当前账号 id]`、`allowFallback: false`，并要求返回 attempt 同时满足 `success` 与 `accountID === 当前账号 id` 才显示成功。
5. 浏览器 preview OAuth 账号改为 `acct_preview_*` 形态，避免预览继续依赖 `auth-file:<name>` 业务账号。
6. 后端 focused test 覆盖 unified auth-file account id 映射到 auth-file source filename 的 route allow header，并确认 fallback 关闭。
7. 账号详情 hash 同步补充 filename detail 解析：当 `detail=<auth-file-name>.json` 命中 unified OAuth account 的 `name` 时，打开对应 `acct_...` 账号详情，但账号池列表和业务对象仍只保留 unified account-store record。

本轮未启动真实 dev App 手点：该需求不涉及 macOS 菜单栏、窗口生命周期、native runtime 或 Wails binding 新增；按 AGENTS 规则优先使用自动化测试、typecheck 和文档校验。

## 验收记录

已通过：
1. `go test ./internal/wailsapp -run 'TestProbeCodexAccountRouting'`
2. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/accounts/tests/accountDelete.test.mjs frontend/src/features/accounts/tests/accountPreviewData.test.mjs frontend/src/features/accounts/tests/previewData.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
3. `npm --prefix frontend run typecheck`
4. Headless DOM：`#frame=accounts&detail=acct_preview_codex_pro_json` 渲染 `data-oauth-model-probe-account` 1 个，详情 modal 存在。
5. Headless DOM：`#frame=codex&workspace=account-list&detail=acct_preview_codex_pro_json` 渲染 `data-oauth-model-probe-account` 1 个，Codex account detail modal 存在。
6. 正式数据快照验收：按 AGENTS 规则先备份 `/Users/linhey/.config/gettokens-dev/`，再从 `/Users/linhey/.config/gettokens/` 复制 SQLite 快照到 dev；验证正式快照中 active auth-file 账号使用 unified `acct_...` ID，`account_key LIKE 'auth-file:%'` 为 0，旧 `codex-plus-nightly.json` filename hash 无匹配。验收后已恢复 dev 目录。
7. 正式数据 mock-Wails DOM 验收：使用正式快照中的 `acct_804e89a7-16e4-416b-abdc-bdd3ef7d4768` 打开 `#frame=accounts&detail=acct_804e89a7-16e4-416b-abdc-bdd3ef7d4768`，详情 modal 存在，`data-oauth-model-probe-account` 等于该 `acct_...`，点击“测试模型”后 mock probe 状态为 `success`。
8. Legacy hash 兼容验收：打开或从有效详情切到 `#frame=accounts&detail=codex-plus-nightly.json` 会解析到同名 unified OAuth account；详情 modal 里的 `data-oauth-model-probe-account` 必须是 `acct_...`，不能是 `auth-file:<name>` 或 filename。

风险记录：
1. 直接启动 dev sidecar 读取正式 OAuth 数据快照会触发 core auth auto-refresh；本轮观察到拷贝数据内的部分 token refresh 返回 `refresh_token_reused`。后续用正式数据做 OAuth UI 验收时，应避免让 sidecar 自动刷新真实 token，优先做 SQLite/management 只读验证，或先提供可关闭 auto-refresh 的 dev 启动方式。
2. 本轮真实 sidecar 探测曾误把 dev sidecar 指向正式 `/Users/linhey/.config/gettokens/accounts-v1.sqlite`，随后正式库出现 `database disk image is malformed`。已使用 SQLite `.recover` 恢复，并在 `2026-06-09` 清理恢复后多出的 18 条 active `auth-file` orphan card。修复前备份位于 `/Users/linhey/.config/gettokens-dev-backups/formal-orphan-clean-20260609T101733Z/`，修复后 `integrity_check=ok`、`foreign_key_check` 通过、orphan count 为 0。
3. 正式 App 重启后 sidecar 日志显示 `/v0/management/accounts` 从连续 500 恢复为 200，账号页骨架屏的直接触发条件已解除。

## OAuth refresh storm hardening

2026-06-09 用户追问 `https://auth.openai.com/oauth/token` 为什么同一个账号/同组织会调用多次，并强调“刷新需要可以重置状态”。

排查证据：
1. 正式 `accounts-v1.sqlite` 只读统计显示 active 账号 `846`，其中 `842` 为 `auth-file`；active `refresh_token` 无重复，但 `account_id` 有两个重复组，其中一个组有 `735` 张 active card，另一个组有 `100` 张。
2. 按 Codex refresh lead 估算，`735` 组内约 `520` 张会被 auto-refresh 判定为 due now。
3. 正式 `sidecar.log` 出现大量 `Token refresh attempt`，其中 `app_session_terminated` 和 `refresh_token_reused` 是终态 OAuth 错误；旧实现只把 `refresh_token_reused` 视为不可重试，`app_session_terminated` 会走 3 次重试并在 5 分钟后继续调度。

修复：
1. Codex OAuth `RefreshTokensWithRetry` 将 `refresh_token_reused`、`app_session_terminated`、`invalid_grant`、`session has ended`、`please log in again` 归类为不可重试。
2. core auth manager 将上述终态 OAuth 错误映射为 `unauthorized`/reauth-required，清空 `NextRefreshAfter` 并移出 auto-refresh schedule。
3. `Service.applyCoreAuthAddOrUpdate` 在同一 runtime auth 的 refresh/access/id token、过期时间、`last_refresh` 或 API key 类字段变化时，视为新凭证，重置 `LastError`、`Unavailable`、`NextRefreshAfter`、旧 `ModelStates` 和 quota runtime cooldown，避免重登或刷新成功后仍被旧状态卡住。

验证：
1. `go test ./internal/auth/codex`
2. `go test ./sdk/cliproxy/auth`
3. `go test ./sdk/cliproxy`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-09
