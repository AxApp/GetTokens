# Sidecar Account SQLite IOERR Optimization

## 背景

2026-06-03 账号卡片出现额度区块 `STALE sidecar 请求失败 (500): {"error":"query accounts: disk I/O error (522)"}`。

已确认现象链路：

1. 前端账号页加载 / 刷新额度时调用 Wails `GetCodexQuota`。
2. `GetCodexQuota` 对统一账号会先访问 sidecar management API，例如 `GET /v0/management/accounts/:account_key`，再触发 `POST /v0/management/gettokens/quota-refresh/:account_key`。
3. sidecar 在 `2026-06-03 10:04:54` 至 `10:08:33` 之间连续返回 `500 | GET /v0/management/accounts` 与 `500 | GET /v0/management/accounts/:account_key`。
4. 前端仍保留旧额度缓存，于是显示旧 5H / 7D 额度条，并把失败原因展示为 `STALE`。
5. `~/.config/gettokens/accounts-v1.sqlite` 当前 `PRAGMA integrity_check` / `quick_check` 均为 `ok`，磁盘空间充足，sidecar 重启后账号接口恢复 200。

根因判断：sidecar 内账号 SQLite store 的长期连接在读取 `account_cards` 时触发 `modernc.org/sqlite` 的 `SQLITE_IOERR_SHORT_READ`（错误码 522）。这更像连接 / driver / WAL 读态异常，而不是账号数据永久损坏。

## 目标

1. 降低 `accounts-v1.sqlite` 读路径出现 `SQLITE_IOERR_SHORT_READ` 的概率。
2. 即使偶发 IOERR，也能自动恢复账号 store 连接，不要求用户重启 GetTokens。
3. 将账号列表、账号详情、额度刷新、route guard 相关接口的异常归因变得可诊断。
4. 前端继续展示旧额度时，要明确区分“旧额度缓存可用”和“sidecar 账号读取失败”。

## 范围

- sidecar `CLIProxyAPI#gettokens/accountstore` SQLite driver / DSN / 连接生命周期。
- sidecar management handler 的账号 store 缓存连接恢复策略。
- Wails `GetCodexQuota` 对 unified account 的失败兜底与错误透传。
- 前端账号卡片 `STALE` 文案和测试覆盖。
- 文档、记忆与回归验收。

## 非目标

- 不重做账号 SQLite schema。
- 不把 sidecar 账号状态搬到前端或 Wails 临时补偿。
- 不删除 WAL 模式，除非验证证明 WAL 是触发条件且有同等性能替代。
- 不把已禁用 / 上游 401 / quota curl 502 等账号业务失败混同为 SQLite I/O 问题。

## 验收标准

1. `GET /v0/management/accounts` 在模拟 `SQLITE_IOERR_SHORT_READ` 后，下一次请求能通过重开 store 连接恢复，且日志包含可检索的错误分类。
2. `GET /v0/management/accounts/:account_key` 不再通过全量 `ListAccounts()` 扫描作为唯一实现路径；至少应有单账号查询路径或同等可恢复处理。
3. sidecar 使用修复过 premature short read 的 `modernc.org/sqlite` 版本，或有明确替代证据说明无需升级。
4. `GetCodexQuota` 遇到 quota refresh 失败但存在 runtime quota cache 时，仍返回 stale quota；遇到账号 store IOERR 时，错误信息应保留但不吞掉恢复机会。
5. 前端账号卡片测试覆盖：有旧额度缓存 + sidecar 500 时显示 `STALE` 与失败原因；恢复后清除 stale 文案。
6. 自动化验证覆盖：sidecar accountstore / management handler 测试、Wails quota 测试、前端 accounts 测试。
7. 文档检查 `docs-linhay/scripts/check-docs.sh` 通过。

## 设计稿入口

- 本期设计稿：`（未产出，稳定性优化不需要独立设计稿）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260603-sidecar-account-sqlite-ioerr`
- worktree：`../GetTokens-worktrees/20260603-sidecar-account-sqlite-ioerr/`

## 相关链接

- 根因排查日志：`~/.config/gettokens/sidecar.log`，关键区间 `2026-06-03 10:04:54` 至 `10:08:46`。
- 账号 store：`docs-linhay/references/CLIProxyAPI/internal/gettokens/accountstore/`
- sidecar management accounts handler：`docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/accounts_store.go`
- Wails quota：`internal/wailsapp/quota.go`
- 前端 quota stale 展示：`frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`、`frontend/src/features/accounts/model/accountQuota.ts`、`frontend/src/features/accounts/components/CardSections.tsx`

## 当前状态

- 状态：validated
- 最近更新：2026-06-03


## 追加发现：添加账号不应回退 legacy store

2026-06-03 排查账号池右上角“添加账号”时发现：Wails `CreateCodexAPIKey` 在 `POST /v0/management/accounts` 失败后会静默调用 legacy `createLegacyCodexAPIKey`，把新账号写到 `~/.config/gettokens-data/codex-api-keys/`，没有进入 `accounts-v1.sqlite`。这会掩盖 account-store 写入失败，并与“SQLite 为运行态 source of truth，legacy 仅作为迁移输入”的边界冲突。

修复范围：

1. `CreateCodexAPIKey`：有 sidecar/management client 时只写 unified account-store；失败直接返回 sidecar/account-store 错误，不再写 legacy store。
2. `ListAccounts`：有 sidecar/management client 时账号列表失败直接返回错误，不再用 legacy key/auth-file 伪造运行态账号列表。
3. legacy 路径仅保留给完全没有 management client 的离线/旧测试路径。

新增回归：

```bash
go test ./internal/wailsapp -run 'Test(ListAccountsDoesNotFallbackToLegacyWhenAccountStoreErrors|CreateCodexAPIKeyDoesNotFallbackToLegacyWhenAccountStoreCreateFails|CreateCodexAPIKeyAllowsDuplicateConfigAsSeparateAccounts)' -count=1
go test ./internal/wailsapp -count=1
```

结果均通过。

## 追加发现：旧 store fallback / replay 二次清理

2026-06-03 继续排查“是否还有旧逻辑没进 SQLite”时发现：

1. `UpdateCodexAPIKeyLabel`、`UpdateCodexAPIKeyConfig`、`DeleteCodexAPIKey`、`UpdateCodexAPIKeyPriority`、`SetCodexAPIKeyStatus` 在目标是 unified `acct_` 时，如果 sidecar account-store 读写失败，仍会回退 legacy codex-api-key store。
2. Wails `Startup` 在 sidecar ready 后仍会调用 `syncStoredCodexAPIKeysToSidecar()`，把 legacy codex-api-key store 重放到 sidecar 旧配置端点。
3. usage attribution 的 unresolved auth-index 解析仍查询 `/v0/management/codex-api-key` 和 `/v0/management/openai-compatibility` 旧端点。

修复：

1. unified `acct_` 账号 mutation 只走 `/v0/management/accounts`；account-store 失败直接返回错误，不再 fallback 到 legacy store。
2. 启动流程不再重放 legacy codex-api-key store。
3. usage attribution 改为从 `/v0/management/accounts` unified account-store 解析 auth-file 与 openai-compatible 的 auth-index/provider 映射。
4. legacy codex-api-key store 相关方法仅保留给无 management client 的离线/旧测试路径和迁移输入，不作为运行态 fallback。

新增/更新回归：

```bash
go test ./internal/wailsapp -run 'TestUnifiedCodexAPIKeyMutationsDoNotFallbackToLegacyOnAccountStoreErrors|TestStartupDoesNotReplayLegacyCodexAPIKeysToSidecar' -count=1
go test ./internal/wailsapp -run 'TestGetSidecarUsageAttributionResolvesAuthIndexToAuthFileAndProvider|TestGetSidecarUsageAttributionResolvesCodexAPIKeyLocalID|TestGetSidecarUsageAttributionIncludesUnresolvedSourceForJoinEvenWhenCallerDoesNotRequestIt' -count=1
go test ./internal/cliproxyapi ./internal/wailsapp -count=1
```

结果均通过。


## 2026-06-03 实施进展补充

- sidecar fork 已补账号 store 读恢复诊断与结构化错误分类；可恢复 SQLite I/O 读错误返回 `account_store_io_error` / `recoverable=true`。
- 前端账号卡片 stale banner 对账号库 IOERR 使用用户可读摘要，避免 raw JSON 撑破卡片；状态页诊断卡保留原始错误摘要用于排障。
- 已完成 sidecar accountstore / management / sdk、根仓 cliproxyapi / wailsapp、前端 runtime warning / diagnostics / account card targeted 回归。


## 2026-06-03 验收结果

- `npm run typecheck`、`npm run build`、`npm run test:unit` 均通过；完整前端 unit 为 `673 pass / 0 fail`。
- sidecar fork accountstore / management / sdk cliproxy 测试通过。
- 根仓 `go test . ./internal/cliproxyapi ./internal/wailsapp -count=1` 通过。
- `./scripts/ensure-sidecar.sh darwin arm64` 已从当前源码重建 `build/bin/cli-proxy-api`。
- `docs-linhay/scripts/check-docs.sh` 通过。

## 追加收敛：正常运行态只保留 SQLite，legacy 仅作为迁移输入

按用户要求“只留迁移”，继续删除主仓 Wails 运行态的 legacy account source：

1. `CreateCodexAPIKey`、Codex API Key label/config/delete/priority/status、`ListAccounts` 不再提供无 sidecar/legacy fallback；必须走 unified account-store management client。
2. 非 `acct_` legacy id 在 Wails 账号 mutation 中直接返回“不支持的账号类型”。
3. 删除主仓本地 legacy codex-api-key store 读写工具与测试，不再维护 `~/.config/gettokens-data/codex-api-keys/` 作为运行态资产。
4. 删除 `cliproxyapi.Client` 对旧配置端点 `/v0/management/codex-api-key`、`/v0/management/openai-compatibility` 的封装；Wails 侧 openai-compatible 仍通过 `/v0/management/accounts` unified account-store 工作。
5. `ListRelaySupportedModels` 改为从 unified accounts 中读取 openai-compatible / codex-api-key 模型，不再读取 legacy codex-api-key store。
6. usage attribution 不再读取 legacy codex-api-key store；历史 attribution identity store 仅作为历史归因映射，不是账号事实源。

验证：

```bash
go test ./... -count=1
```

结果通过。主仓生产代码扫描中，旧 `/codex-api-key` / `/openai-compatibility` 端点只剩测试里用于禁止调用的断言；迁移输入仍由 sidecar account-migration 能力负责。
