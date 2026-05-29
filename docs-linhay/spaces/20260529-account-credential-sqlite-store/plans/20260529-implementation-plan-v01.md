# 账号凭证 SQLite 存储实施技术方案 v02

日期：2026-05-29

## 执行前提

- 当前已在执行 worktree/分支 `账号与凭证统一存储方案`，不再新建 feature worktree。
- 本次迁移只保迁账号凭证和账号配置。
- rate-limit、usage attribution、route guard、渠道路由、前端详情 hash 可以直接重做，不做历史迁移。
- 迁移完成后必须删除旧账号事实源；只停止读取旧源不满足完成定义。
- 最新边界：GetTokens 不管理账号，账号相关改动全部放到 sidecar。
- 最新边界：从本版本开始断开与 CLIProxyAPI 上游的合并式同步；上游功能只作为参考输入，需要的能力在 sidecar 侧重新做。

## 目标状态

sidecar 持有账号与凭证唯一事实源：

```text
~/.config/gettokens/accounts-v1.sqlite
```

旧账号事实源在迁移成功后删除或从配置中移除：

```text
~/.config/gettokens/codex-*.json
~/.config/gettokens-data/codex-api-keys/
~/.config/gettokens/codex-api-keys/
~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json
config.yaml.codex-api-key
config.yaml.openai-compatibility
```

不删除：

- `~/.config/gettokens/config.yaml` 本体。
- sidecar 启动、监听、remote-management、relay `api-keys`、网络代理配置。
- usage/rate-limit/live-session SQLite；这些历史状态可以不迁移。

## 架构选择

采用 **sidecar SQLite 事实源 + sidecar runtime apply**。

原因：

1. sidecar 是运行态自治层，账号选择和热路径凭证消费都在 sidecar 内完成。
2. GetTokens 继续作为 UI/Wails bridge，不引入第二个账号事实源。
3. OAuth finalize、token refresh、API key/provider 更新都在 sidecar 内直接更新 SQLite，再刷新运行态快照。
4. 不再设计 GetTokens 写 DB 后同步 runtime mirror 的链路，避免双事实源。
5. 不再为 CLIProxyAPI 上游兼容保留旧 management API 合约；新 GetTokens 版本直接改到 sidecar 自有账号 API。

被否决方案：**GetTokens SQLite 事实源 + sidecar runtime mirror**。该方案要求 GetTokens 管理账号 DB，并把 sidecar 当镜像消费方，和当前“账号相关改动全部放到 sidecar”的边界冲突。

## Sidecar 写入边界

当前实现里，GetTokens 的 auth-file 操作会调用旧 sidecar management API：

- `GET /v0/management/auth-files`
- `GET /v0/management/auth-files/download`
- `POST /v0/management/auth-files`
- `DELETE /v0/management/auth-files`
- `PATCH /v0/management/auth-files/status`

迁移后边界：

1. sidecar SQLite 是账号凭证/配置事实源。
2. GetTokens 的 `UploadAuthFiles`、`SetAuthFileStatus`、`updateAuthFilePriority`、`FinalizeCodexOAuth` 等路径改为调用 sidecar 账号 API。
3. sidecar 负责在 API handler 内写 SQLite、递增 `revision`、刷新 runtime auth/provider 快照。
4. OAuth 登录和重新登录由 sidecar 写入或更新 `auth_file_accounts.auth_json`。
5. 如果 sidecar 在运行中刷新 token 或更新 auth payload，也直接回写 SQLite。
6. GetTokens 不直接修改 sidecar auth-dir、账号 SQLite 或 `config.yaml` 账号段。
7. 旧 `/auth-files`、`/codex-api-key`、`/openai-compatibility` API 不作为兼容层保留；新版本直接切到统一账号 API。

结论：迁移后这套系统就是 **直接修改 sidecar 侧账号事实源**；GetTokens 只调用 sidecar management API。

## 凭证更新风险

迁移后账号更新仍有风险，核心风险是 **DB 已更新但 sidecar 当前进程继续使用旧凭证**。这个风险必须由 sidecar 内部处理，而不是由 GetTokens 补偿。

必须保证：

1. 更新 Codex API key 时，`codex_api_key_accounts.api_key` 写入新 API key，并同事务更新 base URL、prefix、headers、models、proxy、quota/billing 配置。
2. OAuth 重新登录时，更新原账号卡的 `auth_file_accounts.auth_json`，并保留原 `account_key`。
3. token refresh 产生新 auth payload 时，更新原账号卡的 `auth_json`，不创建新账号卡。
4. OpenAI-compatible provider 更新时，API key entries、headers 中的敏感字段明文写入 `openai_compatible_accounts.api_key_entries_json` / `headers_json`。
5. DB commit 后 sidecar 必须刷新 runtime auth/provider 快照。
6. runtime apply 失败不能回滚已提交 DB，但必须记录 failed 状态，并通过 management API 暴露给 GetTokens。
7. 删除旧事实源只能发生在账号凭证/配置迁移和更新链路都验证通过之后。

对应测试必须覆盖：

- `UpdateCodexAPIKey` 改 API key 后，`account_key` 不变，SQLite 明文 API key 变更，runtime auth 使用新 key。
- OAuth 重新登录后，`account_key` 不变，`auth_json` 变更，旧临时登录产物不残留为新账号卡。
- token refresh 后，原账号卡 `auth_json` 更新，运行态使用新 token。
- OpenAI-compatible provider 修改 API key entries 后，`account_key` 不变，runtime provider 使用新 entries。
- runtime apply 失败时，DB 保留新凭证，apply state 标记 failed，下一次 reload 可重试。

## sidecar 包边界

新增或收敛到 GetTokens sidecar 内部账号 store 包，建议路径按 sidecar 代码结构命名，例如：

```text
gettokens/sidecar/accountstore
```

职责：

- 打开 `accounts-v1.sqlite`，确保父目录 `0700`、DB 文件 `0600`。
- 初始化和迁移 schema。
- 生成 `account_key`。
- 导入旧账号事实源。
- 提供账号 CRUD。
- 构建 sidecar runtime auth/provider 快照。
- 输出 dry-run / migration report。
- 删除旧账号事实源并写入迁移审计。

GetTokens 侧不新增 `internal/accountstore`。

## Management API 草案

GetTokens 只依赖 sidecar API：

```text
GET    /v0/management/accounts
GET    /v0/management/accounts/{account_key}
POST   /v0/management/accounts
PATCH  /v0/management/accounts/{account_key}
DELETE /v0/management/accounts/{account_key}
PATCH  /v0/management/accounts/{account_key}/status
PATCH  /v0/management/accounts/{account_key}/priority
POST   /v0/management/accounts/{account_key}/oauth/relogin
POST   /v0/management/account-migration/dry-run
POST   /v0/management/account-migration/commit
POST   /v0/management/account-migration/delete-legacy-sources
```

`POST /v0/management/accounts` 和 `PATCH /v0/management/accounts/{account_key}` 使用统一 envelope：

```json
{
  "kind": "codex-api-key",
  "title": "Primary",
  "provider": "openai",
  "priority": 0,
  "disabled": false,
  "credential": {}
}
```

`credential` 按 `kind` 解析：

- `auth-file`：`auth_json`、`source_file_name`、`status`、`status_message` 等。
- `codex-api-key`：`api_key`、`base_url`、`prefix`、`proxy_url`、`headers`、`models`、`quota_curl`、`billing_curl` 等。
- `openai-compatible`：`provider_name`、`base_url`、`prefix`、`api_key_entries`、`headers`、`models` 等。

旧 API 不保留为兼容层：

- `/v0/management/auth-files`
- `/v0/management/codex-api-key`
- `/v0/management/openai-compatibility`

这些旧端点只作为旧数据来源和旧实现参考；新 GetTokens 版本直接改调用统一账号 API。

## 账号 ID 与表结构

`account_key` 使用：

```text
acct_<uuid>
```

账号卡 ID 固定使用 UUID 分配，每张账号卡唯一。

敏感凭证不写入 `secret_json` / secret store，直接明文存在 SQLite 的类型专属表：

- `codex_api_key_accounts.api_key`
- `auth_file_accounts.auth_json`
- `openai_compatible_accounts.api_key_entries_json`
- `openai_compatible_accounts.headers_json`

最终表结构以 `docs-linhay/dev/account-credential-sqlite-store-design.md` 的 `SQLite Schema` 为准。实现时必须包含：

- `account_cards.revision`：每次凭证或配置变更递增，用于驱动 sidecar runtime apply。
- `account_cards.metadata_json`：仅放备注、标签、UI 分组等非核心扩展，不放凭证明文。
- `account_runtime_apply_state`：sidecar 内部 runtime 快照 apply 状态，避免当前进程静默使用旧凭证。
- `account_migration_sources`：记录旧源导入、备份、删除结果，作为删除旧数据的审计依据。
- 类型表不重复保存 `priority` / `disabled`；统一使用 `account_cards.priority` / `account_cards.disabled`。

旧 ID 写入 `account_runtime_identities`：

- `legacy-account-key:auth-file:<file>`
- `legacy-account-key:codex-api-key:<local-id>`
- `legacy-account-key:openai-compatible:<provider>`
- `auth-index:<index>`
- `auth-id:<id>`
- `api-key-hash:<hash>`
- `source-hash:<hash>`

这些只用于迁移校验、诊断和 runtime 辅助，不负责旧 rate-limit/usage/channel 历史迁移。

## 实施阶段

### 阶段 1：sidecar schema 与 dry-run importer

可独立合入。

改动：

- 在 GetTokens sidecar 内新增 account store。
- 初始化 schema。
- 实现旧源扫描：
  - auth-dir `codex-*.json`
  - GetTokens Codex API key JSON store
  - legacy Codex API key JSON store
  - `config.yaml.codex-api-key`
  - `config.yaml.openai-compatibility`
- 输出 `MigrationReport`。

验证：

- sidecar Go 单测覆盖 schema、权限、重复账号、相同 API key 配置、多 provider。
- dry-run 不写 DB、不删除文件。

### 阶段 2：sidecar commit import 与迁移报告

可独立合入，但不删除旧源。

改动：

- `ImportLegacy(commit)` 写入 SQLite。
- 写入 `account_runtime_identities`。
- 校验账号数量、凭证 fingerprint、priority、disabled、quota/billing、models、headers。
- 生成迁移报告，记录旧源路径和新 `account_key` 映射。

验证：

- commit 后再次 dry-run 不重复导入。
- 相同 API key 配置仍生成两张账号卡。
- 重新运行迁移幂等。

### 阶段 3：sidecar runtime 读写切换

可独立合入。

改动：

- sidecar runtime auth/provider 从账号 SQLite 构建。
- Codex API key create/update/delete 写 SQLite。
- auth-file upload/delete/status/priority 写 SQLite。
- OAuth finalize/relogin/token refresh 写 SQLite。
- OpenAI-compatible create/update/delete 写 SQLite。
- DB commit 后刷新 runtime snapshot，并写 `account_runtime_apply_state`。

验证：

- 写 DB 成功后 runtime 使用新凭证。
- runtime apply 失败可见且可重试。
- 新建 rate-limit/usage 可以围绕新 `account_key` 工作。

### 阶段 4：GetTokens 直接接入新账号 API

可独立合入。

改动：

- `internal/cliproxyapi` 增加新账号 API client。
- `internal/wailsapp/accounts.go`、`auth_files.go`、`openai_compatible.go` 改为调用统一 sidecar 账号 API。
- `internal/wailsapp/codex_api_key_store.go` 不再作为事实源，只作为迁移兼容辅助或删除。
- 删除或冻结旧 `/auth-files`、`/codex-api-key`、`/openai-compatibility` client 调用，不做上游兼容适配。
- `internal/accounts/account_records.go` 的 ID 来源切到 `acct_*`。
- 前端不再依赖 `auth-file:` / `codex-api-key:` / `openai-compatible:` 前缀判断真实存储来源。

验证：

- 账号池三类账号完整展示。
- 旧详情 hash 不保留；新详情可打开。
- 旧渠道路由顺序不保留；新顺序可重建。

### 阶段 5：删除旧账号事实源

最终阶段，必须执行。

触发条件：

- 迁移报告显示账号凭证/配置 round-trip 通过。
- sidecar SQLite 读写路径通过自动化测试。
- sidecar runtime 从 SQLite 重建成功。
- 桌面启动后账号列表完整。

删除动作：

- 删除 `~/.config/gettokens/codex-*.json`。
- 删除 `~/.config/gettokens-data/codex-api-keys/`。
- 删除 `~/.config/gettokens/codex-api-keys/`。
- 删除 `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`。
- 从 `config.yaml` 移除 `codex-api-key` 和 `openai-compatibility`。

保底策略：

- 删除前生成迁移报告。
- 推荐把被删除内容备份到：

```text
~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/
```

备份不是新事实源，只用于人工回滚和事故排查。

## 测试门禁

sidecar 聚焦测试：

```text
go test ./gettokens/sidecar/...
```

GetTokens 聚焦测试：

```text
go test ./internal/cliproxyapi ./internal/wailsapp ./internal/accounts
```

GetTokens 全量 Go 回归：

```text
go test ./...
```

前端回归：

```text
cd frontend
npm run typecheck
npm run test:unit
npm run build
```

桌面验收：

1. 使用包含旧 auth-file、Codex API key、OpenAI-compatible provider 的本机 profile。
2. sidecar dry-run migration report 显示账号凭证/配置完整。
3. sidecar commit migration 后账号池完整。
4. 新建或编辑账号后 sidecar runtime 可用且使用新凭证。
5. 重启 App 后账号仍完整。
6. 旧账号事实源已删除或从 config 中移除。

## 回滚策略

阶段 1-4 未删除旧源前：

- 可关闭 sidecar 账号 SQLite 开关，回到旧源。
- 可删除 `accounts-v1.sqlite` 重新 dry-run。

阶段 5 删除旧源后：

- 以 sidecar `accounts-v1.sqlite` 为事实源继续运行。
- 若必须人工恢复，只能从 `migration-backups/accounts-v1-<timestamp>/` 恢复旧文件；恢复后需要重新执行迁移，不允许双写并存。

## DoD

1. 账号凭证/配置迁移完整，dry-run 和 commit report 可核对。
2. sidecar SQLite 是唯一账号事实源。
3. GetTokens 不直接管理账号事实源。
4. 旧账号事实源已删除或从 config 移除。
5. 旧 rate-limit、usage attribution、route guard、渠道路由、详情 hash 不保迁，交付说明明确。
6. 自动化测试和桌面验收通过。
7. memory 与 qmd 索引已更新。
