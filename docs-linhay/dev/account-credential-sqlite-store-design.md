# 账号与凭证 SQLite 统一存储最终方案

日期：2026-05-29

## 结论

账号相关改动全部放到 sidecar。GetTokens 不再管理账号事实源，不新增 `internal/accountstore`，不直接打开或写入账号 SQLite。GetTokens 只通过 sidecar management API 展示、创建、更新、删除账号。

从本版本开始，GetTokens sidecar 不再以 CLIProxyAPI 上游兼容为目标。上游功能只作为参考输入；需要的能力在 sidecar 侧重新设计和实现。management API 可以直接按 GetTokens 需求破坏性调整，不需要为了上游或旧端点保留兼容层。

sidecar 持有账号与凭证唯一事实源：

```text
~/.config/gettokens/accounts-v1.sqlite
```

可通过 sidecar 配置显式覆盖：

```yaml
account-store-db: /Users/<user>/.config/gettokens/accounts-v1.sqlite
```

迁移完成后，以下旧账号事实源必须删除或从配置中移除；只停止读取不满足完成定义：

- `~/.config/gettokens/codex-*.json`
- `~/.config/gettokens-data/codex-api-keys/*.json`
- `~/.config/gettokens/codex-api-keys/*.json`
- `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`
- `~/.config/gettokens/config.yaml` 中的 `codex-api-key`
- `~/.config/gettokens/config.yaml` 中的 `openai-compatibility`

`config.yaml` 仍保留 sidecar 启动、监听、remote-management、relay `api-keys`、网络代理等非账号凭证配置。

## 职责边界

### sidecar

- 打开、初始化、迁移 `accounts-v1.sqlite`。
- 分配并持久化 `account_key`，格式为 `acct_<uuid>`。
- 提供账号 management API：list、create、update、delete、status、priority、OAuth finalize/relogin、migration dry-run/commit。
- 迁移旧 auth-file、Codex API key JSON store、`config.yaml.codex-api-key`、`config.yaml.openai-compatibility`。
- 账号写入成功后刷新 sidecar 内存 runtime auth/provider 快照。
- OAuth token 刷新、auth payload 更新、API key 更新、provider key entries 更新都直接写回账号 SQLite。
- 迁移验证通过后删除旧账号事实源，并记录删除审计。

### GetTokens

- 不保存账号事实源。
- 不直接写 auth-file、Codex API key JSON store、`config.yaml` 账号段或账号 SQLite。
- 通过 sidecar management API 读写账号。
- 前端继续消费 `AccountRecord` 类展示模型，但 ID 来源改为 `account_key`。
- 对 rate-limit、usage attribution、route guard、渠道路由、前端详情 hash 不做历史迁移，可围绕新 `acct_*` 重建。

当前实现状态（2026-05-29）：

- sidecar 已落地 SQLite schema、dry-run/commit/delete legacy 管理端点、统一账号 CRUD、Codex OAuth finalize 写 SQLite、Codex/OpenAI-compatible/auth-file runtime 合成器读取 SQLite。
- sidecar 账号写入后会触发 watcher 重新合成 runtime auth，并将当前账号 revision 的 `account_runtime_apply_state` 标记为 `applied`；失败时标记为 `failed` 并保留错误。
- sidecar `coreauth.Manager.Update()` 持久化链路已接入 account store：运行中 Codex token refresh 成功后，会通过 `Auth.AccountKey=acct_*` 定位原 `auth-file` 账号并更新 `auth_file_accounts.auth_json`；不会再把迁移后的账号凭证写回旧 auth-file。account store 内的非 `auth-file` 账号也不会 fallback 到旧文件 store。
- GetTokens 父仓已新增统一账号 API client 和 `UnifiedAccount -> AccountRecord` 映射，`acct_*` Codex API key 更新、删除、disabled、priority 走 sidecar `/v0/management/accounts`。
- GetTokens 父仓 OpenAI-compatible 管理已从旧 `/v0/management/openai-compatibility` 收敛到统一账号 API：列表过滤 `kind=openai-compatible`，创建走 `POST /v0/management/accounts`，编辑走 `PATCH /v0/management/accounts/{account_key}`，删除、disabled、priority 走对应统一账号端点。
- GetTokens 账号池导入 auth-file 账号已从旧 `/v0/management/auth-files` 上传文件链路改为 `POST /v0/management/accounts` 创建 `kind=auth-file` 账号；公开导入入口不再创建 `codex-*.json`。旧 `/auth-files` 上传只保留给迁移前文件替换和兼容流程内部使用。
- 前端 OpenAI-compatible DTO 暴露 `accountKey`，账号卡操作和 Codex 账号列表模型优先使用 `acct_*`；provider name 仅作为迁移前旧卡片解析兜底。
- `AccountRecord` 增加 `accountKind`，取值为 `auth-file | codex-api-key | openai-compatible`。前端删除、禁用同步、复制导入、详情编辑门禁和 Claude/Codex 账号列表分类必须优先使用 `accountKind`，不能再只靠 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 旧 ID 前缀推断账号类型。
- Wails 层仍有旧 ID 兼容分支，目标仅是迁移前残留状态可回退；新账号卡身份必须使用 sidecar 分配的 `acct_*`。

## 迁移边界

必须迁移并保证不丢失：

- 账号卡主记录、标题、provider、priority、disabled 等账号配置。
- Codex OAuth/auth-file 凭证内容和可恢复 runtime auth 的必要 metadata。
- Codex API key、base URL、prefix、headers、models、excluded models、proxy、quota/billing curl 等账号配置。
- OpenAI-compatible provider 的 base URL、prefix、headers、models、api key entries、proxy 等 provider 配置。
- 旧账号资产到新 `account_key` 的基础映射，用于迁移校验和必要诊断。

可以清空或重做：

- rate-limit 规则、状态、事件。
- usage attribution 历史归因。
- route guard 状态。
- Codex/Claude 渠道路由顺序、项目绑定和 probe 结果。
- 前端详情 hash、选择态、筛选草稿、批量选择等 UI 状态。

## 设计原则

1. sidecar SQLite 是账号/凭证唯一事实源。
2. `account_key` 使用 UUID 分配，格式为 `acct_<uuid>`；每张账号卡唯一。
3. 新建账号卡必须分配新 `account_key`；编辑账号、刷新凭证或重新登录必须保留原 `account_key`。
4. 两张账号卡即使凭证完全相同，也必须是两条独立记录。
5. 旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 只进入迁移映射，不能继续作为账号主键。
6. 敏感 entry 不写入 `secret_json` / secret store，明文存储在 SQLite 类型专属表中。
7. 不额外保存完整原始 JSON 副本；`auth_file_accounts.auth_json` 例外，因为它本身就是 sidecar runtime 需要消费的 normalized auth JSON。
8. SQLite 文件权限必须是 `0600`，父目录权限必须是 `0700`；日志、错误提示、debug export、截图必须脱敏。

## SQLite Schema

最终 schema 只保证账号凭证/配置迁移；不包含 rate-limit、usage attribution、route guard、渠道路由和前端详情 hash 历史状态。

```sql
CREATE TABLE account_store_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

初始 meta：

```text
schema_version = 1
created_at_unix_ms = <now>
owner = sidecar
```

```sql
CREATE TABLE account_cards (
  account_key TEXT PRIMARY KEY, -- acct_<uuid>
  kind TEXT NOT NULL, -- auth-file | codex-api-key | openai-compatible
  title TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  credential_source TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_unix_ms INTEGER NOT NULL,
  updated_at_unix_ms INTEGER NOT NULL,
  deleted_at_unix_ms INTEGER
);

CREATE INDEX idx_account_cards_kind
  ON account_cards(kind);

CREATE INDEX idx_account_cards_deleted
  ON account_cards(deleted_at_unix_ms);

CREATE INDEX idx_account_cards_updated
  ON account_cards(updated_at_unix_ms);
```

`credential_source` 建议值：

- `legacy-auth-file`
- `legacy-gettokens-codex-api-key`
- `legacy-config-codex-api-key`
- `legacy-config-openai-compatible`
- `sidecar-management-api`
- `sidecar-oauth`

`priority`、`disabled`、`revision` 只保存在主表。management API 发起的账号凭证或账号配置变更必须递增 `account_cards.revision`，用于驱动 runtime apply。运行时 token refresh 是当前 runtime 自身产生的新 credential snapshot，只更新类型表和 `account_cards.updated_at_unix_ms`，不递增 revision、不重新排队 runtime apply。

```sql
CREATE TABLE codex_api_key_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  api_key_fingerprint TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  proxy_url TEXT NOT NULL DEFAULT '',
  websockets INTEGER NOT NULL DEFAULT 1,
  quota_curl TEXT NOT NULL DEFAULT '',
  quota_enabled INTEGER NOT NULL DEFAULT 0,
  billing_curl TEXT NOT NULL DEFAULT '',
  billing_enabled INTEGER NOT NULL DEFAULT 0,
  format_base_urls_json TEXT NOT NULL DEFAULT '{}',
  headers_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',
  excluded_models_json TEXT NOT NULL DEFAULT '[]',
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX idx_codex_api_key_runtime_config
  ON codex_api_key_accounts(base_url, prefix);

CREATE INDEX idx_codex_api_key_fingerprint
  ON codex_api_key_accounts(api_key_fingerprint);
```

`api_key` 明文保存。`api_key + base_url + prefix` 不是唯一约束，因为允许复制出多张相同配置的账号卡。

```sql
CREATE TABLE auth_file_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  source_file_name TEXT NOT NULL DEFAULT '',
  auth_json TEXT NOT NULL,
  auth_fingerprint TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  plan_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  modified_unix_ms INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX idx_auth_file_source_file_name
  ON auth_file_accounts(source_file_name);

CREATE INDEX idx_auth_file_fingerprint
  ON auth_file_accounts(auth_fingerprint);
```

`source_file_name` 只记录迁移或导入来源，不能作为唯一身份。`auth_json` 明文保存 sidecar runtime 需要消费的 normalized auth JSON。迁移后 sidecar token refresh 或重新登录必须更新本表原账号卡记录。

```sql
CREATE TABLE openai_compatible_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  provider_name TEXT NOT NULL DEFAULT '',
  runtime_provider_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  api_key_entries_json TEXT NOT NULL DEFAULT '[]',
  headers_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_openai_compatible_runtime_provider_key
  ON openai_compatible_accounts(runtime_provider_key);
```

`provider_name` 是展示和可编辑名称，不参与账号身份判断。`runtime_provider_key` 由 `account_key` 派生，例如 `openai-compatible:acct_...`，避免 provider rename 改变账号身份。`api_key_entries_json` 明文保存 provider API key entries。

```sql
CREATE TABLE account_runtime_identities (
  identity_key TEXT PRIMARY KEY,
  account_key TEXT NOT NULL REFERENCES account_cards(account_key) ON DELETE CASCADE,
  identity_kind TEXT NOT NULL,
  created_at_unix_ms INTEGER NOT NULL,
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX idx_account_runtime_identities_account
  ON account_runtime_identities(account_key);
```

示例：

- `legacy-account-key:auth-file:codex-pro.json`
- `legacy-account-key:codex-api-key:stable-001`
- `legacy-account-key:openai-compatible:deepseek`
- `auth-id:<id>`
- `auth-index:<index>`
- `api-key-hash:<hash>`
- `source-hash:<hash>`

这些只能用于迁移校验、诊断和 runtime 辅助，不能作为账号卡主键。

```sql
CREATE TABLE account_runtime_apply_state (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending | applied | failed
  last_error TEXT NOT NULL DEFAULT '',
  applied_at_unix_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX idx_account_runtime_apply_state_status
  ON account_runtime_apply_state(status);
```

`account_runtime_apply_state` 不是跨进程 mirror 状态，而是 sidecar 内部 runtime 快照应用状态。它用于避免“DB 已更新但当前进程仍使用旧凭证”静默发生。sidecar 重启时可从 SQLite 重建 runtime，不能把该表当账号事实源。

```sql
CREATE TABLE account_migration_sources (
  id TEXT PRIMARY KEY,
  account_key TEXT NOT NULL REFERENCES account_cards(account_key) ON DELETE CASCADE,
  source_kind TEXT NOT NULL, -- auth-file | codex-api-key-json | config-codex-api-key | config-openai-compatible
  source_path TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL DEFAULT '',
  source_fingerprint TEXT NOT NULL DEFAULT '',
  imported_at_unix_ms INTEGER NOT NULL,
  deleted_at_unix_ms INTEGER NOT NULL DEFAULT 0,
  backup_path TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_account_migration_sources_account
  ON account_migration_sources(account_key);

CREATE INDEX idx_account_migration_sources_kind
  ON account_migration_sources(source_kind);
```

`account_migration_sources` 用于证明旧账号事实源已经导入、备份并删除。迁移完成后，旧源删除结果必须写回 `deleted_at_unix_ms` / `backup_path`。

## Management API 边界

sidecar 直接提供 GetTokens 自有账号级 API。API 以 `account_key` 和 `kind` 为核心，不再暴露旧 `auth-file` 文件名、Codex API key local-id、OpenAI-compatible provider name 作为主身份。

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

旧 management API 不作为兼容目标继续维护：

- `/v0/management/auth-files`
- `/v0/management/codex-api-key`
- `/v0/management/openai-compatibility`

这些旧端点在本迁移中只作为旧 GetTokens 版本或旧数据结构的参考输入。新 GetTokens 版本必须直接改到 `/v0/management/accounts` / `/v0/management/account-migration`。

## 写入与更新一致性

账号写入必须在 sidecar 内使用事务：

```text
BEGIN IMMEDIATE
  upsert account_cards
  upsert type-specific table
  upsert account_runtime_identities if needed
  mark account_runtime_apply_state pending
COMMIT
rebuild/apply runtime snapshot for changed account_key
mark account_runtime_apply_state applied or failed
```

凭证更新是迁移后的最高风险路径。必须保证：

1. Codex API key 编辑更新原 `codex_api_key_accounts` 行，`account_key` 不变。
2. OAuth 重新登录或 token refresh 更新原 `auth_file_accounts.auth_json`，`account_key` 不变。
3. OpenAI-compatible provider 更新写入原 `openai_compatible_accounts` 行，`account_key` 不变。
4. DB commit 后 sidecar 必须刷新 runtime auth/provider 快照；否则当前进程可能继续使用旧 token 或旧 API key。`PATCH /v0/management/accounts/{account_key}` 是凭证更新主入口，不能只更新 DB 后返回。
5. runtime apply 失败不能回滚已提交 DB，但 management API 必须暴露 failed 状态，下一次 sidecar ready/reload 或账号更新时重试。
6. GetTokens 不能绕过 sidecar 直接补写 DB 或 auth-file。
7. token refresh 从 `coreauth.Manager.Update()` 进入持久化时，必须由 account-store token store 拦截 `acct_*` 账号：`auth-file` 写 SQLite，非 account-store auth 才允许 fallback 到旧文件 store。

## Sidecar 是否还更新 auth-file

迁移后 sidecar 不再把 `codex-*.json` 当持久事实源更新。sidecar 会更新的是 `auth_file_accounts.auth_json`：

- OAuth finalize 写入新的 auth-file 账号，或更新指定 `account_key` 的原账号卡。
- OAuth relogin 保留原 `account_key`，只替换 `auth_json` 和派生 metadata。
- 运行中 token refresh 如果产生新 auth payload，必须直接回写 SQLite，并保留已有 `email` / `plan_type` 等可展示派生字段，避免 refresh payload 不完整时把账号套餐识别结果清空。
- 旧 `auth-dir` 只能作为迁移来源或短期临时产物；迁移完成后持久旧文件必须删除。

## 迁移流程

1. sidecar schema 与 dry-run importer：创建 DB、扫描旧源、生成账号映射和校验报告，不删除旧文件。
2. commit import：写入 `account_cards`、类型表、`account_runtime_identities`、`account_migration_sources`。
3. sidecar 读写切换：management API 与 runtime auth/provider 都从账号 SQLite 构建。
4. GetTokens 接入：Wails 账号相关方法改为调用新的 sidecar management API；不再读写本地账号 JSON store。
5. 删除旧数据：确认迁移报告、runtime 验证和 GetTokens 展示通过后，删除旧 auth-file、旧 Codex API key JSON store、旧 attribution identity 文件，并从 `config.yaml` 移除账号段。

删除前建议备份到：

```text
~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/
```

备份不是新事实源，只用于人工事故恢复。

## 安全要求

1. SQLite 文件权限 `0600`。
2. 父目录权限 `0700`。
3. SQL 查询和日志不得打印 `api_key`、OAuth token、Authorization header、Cookie 等敏感明文。
4. 测试 fixture 使用假 token。
5. bug report / debug export 默认排除所有 `api_key`、`auth_json`、`api_key_entries_json`、Authorization header、Cookie 和 `*_key` 字段。
6. SQLite backup 如果存在，必须和主 DB 一样受权限保护。

## 测试清单

### sidecar 单元测试

1. schema 初始化与 `schema_version`。
2. 父目录 `0700`、DB 文件 `0600`。
3. 旧 `codex-*.json` 导入为 `auth-file` 账号。
4. 旧 `codex-api-keys/*.json` 导入为 `codex-api-key` 账号。
5. `config.yaml.codex-api-key` 导入并分配新 `account_key`。
6. `config.yaml.openai-compatibility` 导入为 provider 账号。
7. 两个相同 API key 配置导入后保留两张不同账号卡。
8. 迁移旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 后生成新的 `acct_*`。
9. 编辑 API key/base URL/prefix 后 `account_key` 不变。
10. 重新登录 OAuth 后 `account_key` 不变。
11. token refresh 更新原 `auth_json`，不生成新账号卡、不写旧 auth-file、不清空已有套餐识别字段。
12. 删除账号卡级联删除 type-specific rows/runtime identities/apply state。
13. 旧文件删除后再次启动不会重复导入。
14. 明文凭证不进入日志和 debug export。
15. 更新凭证后 runtime auth/provider 快照使用新凭证。

### GetTokens 集成测试

1. `ListAccounts` 只通过 sidecar management API 读出三类账号。
2. Codex API key、auth-file、OpenAI-compatible 的 create/update/delete 都调用 sidecar 账号 API。
3. 前端账号卡 ID 使用 `acct_*`。
4. 旧详情 hash、旧渠道路由不保留；新状态可围绕 `acct_*` 重建。
5. App 重启后账号卡顺序、disabled、priority、quota/billing 配置保持一致。

## 不纳入本期

- 不把 usage/rate-limit/live-session 历史明细搬进 `accounts-v1.sqlite`。
- 不迁移旧 usage attribution、rate-limit、route guard、渠道路由、前端详情 hash。
- 不把 `~/.codex/auth.json` 或 Claude Code 原生配置纳入该 DB。
- 不做云同步。
- 不做 SQLCipher/Keychain 加密，除非另起安全专项。
- 不保留旧文件双写兼容；迁移成功后必须删除旧账号事实源。
