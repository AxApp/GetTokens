# 账号凭证 SQLite 存储执行计划 v01

日期：2026-05-29

## 执行边界

本计划承接最终方案 `20260529-final-sidecar-account-store-plan-v01.md`，用于跟踪从代码落地到真实迁移删除旧源的执行动作。

核心边界：

1. sidecar 是账号与凭证唯一事实源，GetTokens App / Wails / Web 不直接写账号 SQLite 或旧账号文件。
2. `account_key` 使用 `acct_<uuid>`，每张账号卡唯一；凭证更新、OAuth relogin、token refresh、provider 编辑都必须保留原 `account_key`。
3. 敏感 entry 明文存在 SQLite 类型表，不写入 `secret_json`。
4. 只保迁账号凭证和账号配置；rate-limit、usage attribution、route guard、渠道路由、前端详情 hash 可重做。
5. 迁移完成后必须删除旧账号事实源；只停止读取旧源不满足完成定义。

## 当前执行状态

状态标记：

- `[x]` 已完成并验证。
- `[ ]` 待执行。
- `[hold]` 需要真实用户 profile 或发布流程触发，不能在当前代码提交阶段直接执行。

## 阶段 0：主分支同步与工作区确认

- [x] 从 `origin/master` 合并当前分支基线。
- [x] 确认当前 worktree 为 `账号与凭证统一存储方案`。
- [x] 确认父仓和 sidecar fork 都处于可提交状态。

验收：

- 分支无主分支合并冲突。
- sidecar fork 与父仓提交顺序明确：先提交 sidecar fork，再提交父仓 gitlink 与 GetTokens 改动。

## 阶段 1：sidecar SQLite 账号事实源

- [x] 新增 sidecar account store 与 SQLite schema。
- [x] 初始化核心表：
  - `account_store_meta`
  - `account_cards`
  - `codex_api_key_accounts`
  - `auth_file_accounts`
  - `openai_compatible_accounts`
  - `account_runtime_identities`
  - `account_runtime_apply_state`
  - `account_migration_sources`
- [x] 实现统一账号 CRUD API。
- [x] 实现 migration dry-run / commit / delete legacy sources API。
- [x] 实现凭证更新后的 runtime apply，避免 DB 已更新但当前进程继续使用旧凭证。

验收：

- sidecar `go test ./internal/...` 通过。
- `PATCH /v0/management/accounts/{account_key}` 与 create/status/priority/delete 一样触发 runtime apply。
- 迁移删除旧源前会写入备份与删除审计。

## 阶段 2：GetTokens App / Wails 接入

- [x] `internal/cliproxyapi` 增加统一账号 API client 与 DTO。
- [x] `internal/cliproxyapi` 增加 account migration dry-run / commit / delete legacy client 与摘要 DTO。
- [x] Wails 账号列表优先读取 sidecar `/v0/management/accounts`。
- [x] Wails 增加启动迁移桥接：`GetAccountMigrationPreview`、`CommitAccountMigration`、`DeleteLegacyAccountSources`。
- [x] Codex API key 账号的创建、更新、删除、禁用、优先级优先走统一账号 API。
- [x] OpenAI-compatible provider 的列表、创建、编辑、删除、禁用、优先级走统一账号 API。
- [x] root Wails DTO / mapper / bindings 同步透出统一账号字段与迁移摘要字段。
- [x] `AccountRecord` 透出 `accountKind`，避免继续依赖旧 ID 前缀判断账号类型。

验收：

- 父仓 `go test ./internal/...` 通过。
- Wails 绑定文件已更新。
- 迁移 preview 只向前端暴露账号数、候选数、类型摘要、警告和备份提示，不传凭证、auth JSON、raw candidate 或 secret。
- delete legacy 前 Wails 侧再次检查 SQLite 账号数不为 0，前端还需要用户显式勾选确认。
- 旧 ID 分支只作为迁移前残留卡片和既有测试兼容路径，不再作为新事实源。

## 阶段 3：Web 侧账号身份适配与启动迁移引导

- [x] 前端账号类型判断优先使用 `accountKind`。
- [x] OpenAI-compatible 前端模型透出 `accountKey`。
- [x] 详情保存、卡片操作、hash、Codex/Claude 列表优先使用 `acct_*`。
- [x] 旧 `auth-file:` / `codex-api-key:` / `openai-compatible:` 前缀只保留为迁移前兜底。
- [x] App 启动完成且 sidecar `ready` 后检查账号迁移 preview。
- [x] 启动流程收敛为：App 启动 -> 加载动画 -> 如有旧账号源则显示迁移页 -> 用户点确认 -> 执行迁移并清理旧源 -> 进入主页面。
- [x] 当 preview 为 `needs-migration` 或 `ready-to-delete-legacy` 时，显示覆盖整个 App shell 的整屏 modal，阻断进入工作台；preview 未返回前只显示 `PageLoadingFallback`。
- [x] 浏览器预览支持 `?preview=account-migration`，用于不连接 Wails/sidecar 时做桌面布局截图。
- [x] 迁移 modal 只展示保迁/重做/删除范围、SQLite 账号数、旧源候选数和类型摘要；不展示任何敏感凭证内容。
- [x] 迁移页使用单确认按钮：`needs-migration` 时先 commit，再在 SQLite 账号已写入后自动 delete legacy sources；`ready-to-delete-legacy` 时只执行 delete legacy sources。

验收：

- `npm run typecheck` 通过。
- `npm run test:unit` 通过。
- `npm run build` 通过；当前仅存在 Vite chunk size warning。
- 桌面截图已归档：`docs-linhay/spaces/20260529-account-credential-sqlite-store/screenshots/20260529/account-migration/20260529-account-migration-startup-modal-desktop-after-v01.png`。
- 浏览器预览点击验证：点击 `确认迁移` 后迁移页消失，主框架 `[data-collaboration-id="MAIN_FRAME"]` 存在。
- GetTokens 默认不做移动端适配和移动端截图验收，当前启动迁移 modal 按 macOS/Wails 桌面工作台验收。

## 阶段 4：文档、记忆与提交

- [x] 更新最终方案、技术设计、space README、memory、项目级 skill 与 AGENTS 规则。
- [x] 执行 `qmd update` 与 `qmd embed`。
- [x] 重建 darwin arm64 sidecar。
- [x] 提交 sidecar fork：`a4896197 feat: add sidecar sqlite account store`。
- [x] 提交父仓：`a16f5b4 feat: route accounts through sidecar sqlite store`。

验收：

- sidecar fork 和父仓提交后均为 clean。
- sidecar fork 和父仓功能分支已 push。
- `docs-linhay/scripts/check-docs.sh` 失败原因是历史 space 缺少 `plans/screenshots/debate`，不是本 space 新增问题。

## 阶段 5：推送与合并

- [x] push sidecar fork 分支 `gettokens/sidecar`。
- [x] push 父仓当前分支 `账号与凭证统一存储方案`。
- [x] 按项目流程创建 PR 或合并回主线。
- [x] 合并前确认父仓 gitlink 指向已推送的 sidecar fork commit。

验收：

- 远端可获取 sidecar commit `a4896197`。
- 远端可获取父仓 commit `6ef891f`。
- 父仓 gitlink 指向 sidecar commit `a489619720a2627473c8c8d7d1c9923d00d2562f`，该 commit 已存在于远端 `gettokens/sidecar`。
- PR：`https://github.com/AxApp/GetTokens/pull/4`，已合并。
- merge commit：`5c5f31a00e0db146e5dbb5d0a2fa49f20cd72182`。
- CI 或本地复验可从源码重建 sidecar，不依赖 CLIProxyAPI 上游 release 资产。

## 阶段 6：真实账号迁移与旧源删除

- [hold] 使用真实 profile 调用 `POST /v0/management/account-migration/dry-run`。
- [hold] 人工核对 dry-run report：账号数量、类型、标题、priority、disabled、base URL、prefix、headers、models、quota/billing、auth JSON fingerprint。
- [hold] 核对无误后调用 `POST /v0/management/account-migration/commit`。
- [hold] 重启 sidecar / App，确认账号池完全从 SQLite 重建。
- [hold] 对至少一张 Codex API key 账号执行凭证更新，确认 `account_key` 不变且 runtime 使用新凭证。
- [hold] 对 OAuth/auth-file 账号执行 relogin 或 token refresh 验证，确认原 `account_key` 不变。
- [hold] 对 OpenAI-compatible provider 执行 API key entries 或 headers 更新，确认 runtime provider 使用新配置。
- [hold] 调用 `POST /v0/management/account-migration/delete-legacy-sources` 删除旧账号事实源。
- [hold] 再次重启 sidecar / App，确认不会从旧源重复导入，账号池仍完整。

删除范围：

- `~/.config/gettokens/codex-*.json`
- `~/.config/gettokens-data/codex-api-keys/`
- `~/.config/gettokens/codex-api-keys/`
- `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`
- `config.yaml.codex-api-key`
- `config.yaml.openai-compatibility`

验收：

- 删除前备份落到 `~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/`。
- `account_migration_sources.deleted_at_unix_ms` / `backup_path` 写入成功。
- 删除后 `accounts-v1.sqlite` 是唯一账号事实源。

### 2026-05-30 dev 正式数据副本验证

- [x] 不停止正式 App / 正式 sidecar，使用 SQLite `.backup` 在线复制正式 profile 到 `~/.config/gettokens-dev`。
- [x] dev 配置隔离为 `port: 18317`、`auth-dir: /Users/linhey/.config/gettokens-dev`、`account-store-db: /Users/linhey/.config/gettokens-dev/accounts-v1.sqlite`。
- [x] dev sidecar 使用新构建版本 `v7.1.16-92-ge6655916`，对应 sidecar commit `e6655916 fix: wait for account store sqlite locks`。
- [x] dev dry-run 候选 11 个：`auth-file` 3 个、`codex-api-key` 8 个。
- [x] dev commit 结果：`imported=11`、`skipped=0`、`errors=0`。
- [x] dev delete legacy 结果：`deleted=11`，备份目录 `/Users/linhey/.config/gettokens-dev/migration-backups/accounts-v1-20260530T021439Z`。
- [x] dev 迁移后账号 12 个：`auth-file` 4 个、`codex-api-key` 8 个。
- [x] dev sidecar 日志未出现 `SQLITE_BUSY`、`database is locked` 或 `account store metadata` 错误。

边界：

- 正式 `/Applications/GetTokens.app` 与正式 sidecar 未停止、未替换、未执行删除旧源。
- 正式 App 只有在安装包含 sidecar `e6655916` 的版本后，迁移启动页才具备本次 SQLite lock fix。

## 阶段 7：发布前最终回归

- [x] sidecar：`go test ./internal/...`。
- [x] 父仓：`go test ./...`。
- [x] 前端：`npm --prefix frontend run typecheck`。
- [x] 前端：`npm --prefix frontend run test:unit`。
- [x] 前端：`npm --prefix frontend run build`。
- [x] 浏览器桌面预览截图：`?preview=account-migration#frame=accounts`。
- [ ] 真实桌面验收：账号池三类账号展示、创建、编辑、禁用、priority、删除、重启恢复。

验收：

- 所有自动化门禁通过。
- 本轮测试执行时间：2026-05-29。
- `npm --prefix frontend run test:unit` 结果：620 passed。
- `npm --prefix frontend run build` 结果：通过，仅保留 Vite chunk size warning。
- `docs-linhay/scripts/check-docs.sh` 结果：失败，原因是历史 spaces 缺 `plans/screenshots/debate`；当前 `20260529-account-credential-sqlite-store` space 结构齐全，未出现在错误列表。
- 桌面 App 侧显示的账号卡 ID 均优先为 `acct_*`。
- 旧账号事实源删除后，新建和更新账号不会再写回旧 JSON store 或 `config.yaml` 账号段。

## 风险与卡点

1. 真实迁移和旧源删除必须使用用户确认过的 profile 执行，不能在代码提交阶段直接删除本机真实数据。
2. 凭证更新的核心风险是 runtime apply 失败；必须通过 `account_runtime_apply_state` 暴露并可重试。
3. 若 push / PR 前远端 master 有新提交，需要重新合并主分支并复跑相关门禁。
4. 旧 API 分支仍存在时，只能作为迁移前兜底；发布后应排期删除旧兼容路径，防止事实源边界回退。

## 完成定义

1. sidecar SQLite 是账号与凭证唯一事实源。
2. GetTokens App / Wails / Web 只通过 sidecar unified account API 操作账号。
3. 凭证更新、OAuth relogin、token refresh 后 `account_key` 保持稳定，runtime 使用新凭证。
4. 真实迁移报告已核对，旧账号事实源已删除并有备份审计。
5. 自动化测试、桌面验收、文档、memory、qmd 均完成。
