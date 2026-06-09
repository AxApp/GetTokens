# 账号池启动缓存首屏

## 背景

用户反馈：安装最新包后，多账号环境首次启动进入账号池会长期停在卡片骨架屏，标题显示 `已授权的凭据资产库 / 0 UNITS`。期望行为是先读取本地账号数据展示账号列表，sidecar / quota / usage 等后续刷新完成后再增量跟上。用户随后确认“应该直接读 sqlite”，并授权修改 sidecar。

## 目标

1. 账号池冷启动时，Wails 在 sidecar ready 前直接只读 account-store SQLite，先展示脱敏账号卡。
2. sidecar ready 后继续调用真实 `ListAccounts()`，成功后覆盖 SQLite/localStorage 快照并刷新 runtime 补充信息。
3. SQLite/localStorage 首屏快照只保存展示必要字段，不落 `apiKey`、`apiKeys`、`headers`、`platformCookie`、`curlVariables`、`modelFetchApiKey`、`rawAuthFile` 等敏感或大字段。
4. sidecar management `/accounts` 在 credential attach 失败时可降级返回 card-only 列表，避免 UI 因单条坏 credential 或损坏表页整页 500。

## 范围

- `internal/wailsapp/account_store_snapshot.go` 与 root `app.go` 的 `ListCachedAccounts` 绑定。
- `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 的账号列表首屏加载链路。
- `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/accounts_store.go` 的 management `/accounts` 降级路径。
- 账号列表本地快照缓存模型与单元测试。
- 不修改 `/Applications/GetTokens.app` 正式版二进制、不重启/kill 正式版进程、不改正式配置。

## 非目标

- 不把 SQLite/localStorage 首屏快照作为账号真实状态来源；它只负责首屏兜底。
- 不在缓存阶段主动刷新上游 quota / billing。
- 不改变账号增删改的真实提交路径。
- 不在 sidecar runtime 合成路径吞掉缺失 credential；运行时仍保持严格读取，避免用 card-only 记录路由请求。

## 验收标准

1. Given account-store SQLite 中已有账号 card，When 账号池页面首次 mount 且真实 `ListAccounts()` 尚未返回，Then 页面状态已有账号记录且不显示整页 skeleton。
2. Given sidecar ready 后 `ListAccounts()` 成功，When 返回最新账号列表，Then 前端覆盖缓存状态并写入新的本地快照。
3. Given 账号记录包含敏感字段，When 写入缓存，Then 缓存 JSON 不包含明文 API key、cookie、raw auth、headers 或管理专用 key。
4. Given sidecar `/accounts` 在 credential attach 阶段失败，When card 表仍可读，Then management API 返回 `200` + `degraded=true` + card-only 账号列表。
5. 聚焦单元测试、typecheck、build、Wails build 通过。

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | 用户截图与描述：多账号首次启动卡在账号池骨架屏，要求“先读缓存显示，更新后续跟上”。 |
| 当前代码事实 | `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 只有 `ListAccounts()` 返回后才设置 `authFileRecords/apiKeyRecords/accountsLoaded`；`frontend/src/features/accounts/model/accountSnapshot.ts` 在 `loaded=false && accountCount=0` 时显示整页 skeleton；root App 已有 `ListCachedAccounts` SQLite 快照绑定，但前端未及时维护 runtime ref，实时失败时仍可能反复重试。 |
| 当前缺失 | 首次安装包没有 frontend localStorage，必须从 account-store SQLite 读首屏；sidecar `/accounts` 若在 credential attach 阶段失败会整体 500，UI 仍无法得到账号列表。 |
| 本机现场证据 | `/Users/linhey/.config/gettokens/accounts-v1.sqlite` `PRAGMA integrity_check` 报 `database disk image is malformed (11)`；sidecar.log 中 `/v0/management/accounts` 连续 500。直接查询 `account_cards` 能读出部分账号 card，说明可以做只读/降级首屏。 |
| 筛选排查 | 最近筛选改动会影响 `filteredAccounts`，但 `AccountsFeature` 用 `accountCount=accounts.length` 与 `filteredAccountCount=filteredAccounts.length` 区分真实空态和筛选空态；筛选为 0 应显示 filtered empty，不会渲染整页 skeleton。 |
| 预期验收方式 | Wails SQLite snapshot 测试、frontend cache/snapshot/filter 测试、sidecar management fallback 测试、typecheck/build、`scripts/wails-cli.sh build`。 |
| 反证条件 | 如果 `ListCachedAccounts` 被前端阻塞到 `ready` 后、或者 SQLite/localStorage 快照写入了 credential/raw auth 字段，则本修复无效。 |

## 实现记录

- Wails `ListCachedAccounts` 直接只读 sidecar account-store SQLite，按 `account-store-db` 配置解析路径，投影 `account_cards` 与可安全读取的非敏感 credential 元数据。
- `useAccountsPageState` 初始化时先同步读取 localStorage 快照，并在 Wails 环境挂载后立即调用 `ListCachedAccounts`；该 SQLite 快照只填充卡片，不设置 `accountsLoaded=true`，确保 sidecar ready 后仍会跑真实 `ListAccounts()`。
- 实时 `ListAccounts()` 成功后覆盖 UI 状态并写回 localStorage；若实时读取失败但已有 SQLite/localStorage 账号，则标记 loaded 以停止无限重试打爆 `/accounts`。
- `accountSnapshot.shouldShowAccountSkeletons` 改为只有 `accountCount=0` 且未 ready/未 loaded 时显示整页 skeleton；已有缓存账号时不再被 `ready=false` 遮住。
- 快照缓存只保留显示字段，剔除 API key、headers、cookie、raw auth、quota/billing curl 和管理专用密钥。
- sidecar management `/accounts` 在 `Store.ListAccounts()` 失败时尝试 `ListAccountCards()`；如果 card 表仍可读，则返回 `200`、`degraded=true`、`warning=<原错误>` 和 card-only accounts。运行时合成路径仍使用严格 `ListAccounts()`。

## 验收记录

- `cd frontend && node --test src/features/accounts/tests/accountListCache.test.mjs src/features/accounts/tests/accountSnapshot.test.mjs`：通过。
- `cd frontend && node --test src/features/accounts/tests/accountListCache.test.mjs src/features/accounts/tests/accountSnapshot.test.mjs src/features/accounts/tests/accountFilters.test.mjs src/features/accounts/tests/accountSelectors.test.mjs`：通过，覆盖筛选空态不走 skeleton。
- `cd frontend && npm run typecheck`：通过。
- `cd frontend && npm run test:unit -- src/features/accounts/tests/accountListCache.test.mjs`：通过，实际脚本运行完整 unit suite，`801` 项通过。
- `cd frontend && npm run build`：通过。
- `go test ./internal/wailsapp -run 'TestListCachedAccounts|TestListAccountsDoesNotFallback|TestSetAccountDisabled|TestUpdateAccountPriority'`：通过。
- `go test ./internal/wailsapp`：通过。
- `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management -run 'TestListAccountsFallsBackToCardsWhenCredentialReadFails|TestListAccountsReopensCachedStoreAfterRecoverableReadFailure|TestCommitImportWritesAccountsAndIsIdempotentByMigrationSource|TestStoreEnsureSchema'`：通过。
- `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/watcher/synthesizer`：通过。
- `./scripts/wails-cli.sh build`：通过，并确认 `CLIProxyAPI binary out of date, rebuilding` 后重新构建 sidecar 进 app bundle。

## 正式数据恢复记录

- 时间：2026-06-09 18:13-18:20 CST。
- 用户授权范围：用户反馈正式环境已无法使用，并允许尝试修复；本轮未替换 `/Applications/GetTokens.app` 二进制，未修改正式配置。
- 备份：先对正式库执行 SQLite 在线备份，并复制原始 DB/WAL/SHM 到 `/Users/linhey/.config/gettokens/recovery-20260609-181342/`；在线备份 `PRAGMA integrity_check` 为 `ok`。
- 现场根因：正式 sidecar `/v0/management/accounts` 返回 `500`，错误为 `query auth-file credential for acct_1ffdc7a7-a125-4cb9-b5b7-d328c1c14e08: sql: no rows in result set`；该类问题是 active `account_cards` 引用缺失的 `auth_file_accounts` credential。
- 数据修复：正式库中 active auth-file orphan card 清零；修复后 `PRAGMA integrity_check=ok`，active card 为 `226`，其中 auth-file `222`、codex-api-key `3`、openai-compatible `1`。
- 运行时验证：正式 sidecar `/v0/management/accounts` 从 `500` 恢复为 `200 OK`，返回 `226` 个账号且无 `degraded/warning`；sidecar log 后续出现账号详情、quota status、rate-limit、usage attribution 等 `200` 请求，页面数据流已越过骨架屏阶段。
- 恢复边界：旧损坏库 `accounts-v1.sqlite.corrupt-before-restore-20260609T181220` 仍为 malformed；当前可读 dump 与干净库一致，无法从坏页中证明还能恢复用户预期的 1000+ active 账号。本轮只恢复正式环境可用性，不重建缺失账号资产。

## 遗留风险

- 当前正式账号库已从 malformed 状态恢复到 `integrity_check=ok`，但 active 账号数只有 `226`，低于用户预期的 1000+。旧损坏库的坏页无法通过当前 sqlite shell 完整 `.recover`，后续如需找回更多账号，需要从原始导入包、外部备份或更专业的 SQLite page recovery 流程重建。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260609-account-startup-cache`
- worktree：`../GetTokens-worktrees/20260609-account-startup-cache/`

## 相关链接

- 相关规则：`.agents/skills/gettokens-domain-engineering/SKILL.md` 中 “Account groups should render available local data first”。

## 当前状态
- 状态：done
- 最近更新：2026-06-09
