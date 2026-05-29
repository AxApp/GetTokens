# 账号与凭证 SQLite 统一存储方案

日期：2026-05-29

## 目标

把 GetTokens 账号卡、Codex OAuth / auth-file、Codex API key、本地账号卡 store、OpenAI-compatible provider 等账号/凭证类数据统一存放到一份 SQLite 文件中。

目标文件：

```text
~/.config/gettokens-data/accounts-v1.sqlite
```

该 SQLite 是账号与凭证的唯一事实源。迁移完成后，以下位置不再保存账号事实源数据，只允许作为只读迁移来源或运行期派生缓存：

- `~/.config/gettokens/codex-*.json`
- `~/.config/gettokens-data/codex-api-keys/*.json`
- `~/.config/gettokens/codex-api-keys/*.json`
- `~/.config/gettokens/config.yaml` 中的 `codex-api-key`
- `~/.config/gettokens/config.yaml` 中的 `openai-compatibility`

`config.yaml` 仍保留 sidecar 启动、监听、remote-management、relay `api-keys`、网络代理等非账号凭证配置。

## 当前存储现状

### Codex OAuth / auth-file

当前存放在 sidecar `auth-dir`：

```text
~/.config/gettokens/codex-*.json
```

读取链路：

1. Wails `ListAuthFiles`
2. sidecar management `/v0/management/auth-files`
3. 必要时下载 auth file body 做 provider / email / plan / priority 推断

当前账号卡 ID：

```text
auth-file:<file-name>
```

### Codex API key 账号卡

当前 GetTokens 本地 store：

```text
~/.config/gettokens-data/codex-api-keys/*.json
```

历史位置：

```text
~/.config/gettokens/codex-api-keys/*.json
```

运行时同步到 sidecar：

```yaml
codex-api-key:
  - local-id: codex-api-key:<id>
    api-key: ...
    base-url: ...
```

当前账号卡 ID：

```text
codex-api-key:<local-id>
```

### OpenAI-compatible provider

当前存在 sidecar `config.yaml`：

```yaml
openai-compatibility:
  - name: ...
    base-url: ...
    api-key-entries:
      - api-key: ...
```

当前账号卡 ID：

```text
openai-compatible:<provider-name>
```

### 辅助身份映射

当前文件：

```text
~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json
```

用途：记录旧 `auth-id` / `auth-index` / fingerprint 到 `codex-api-key:<local-id>` 的辅助映射。统一 SQLite 后并入 DB，不再单独写 JSON。

## 设计原则

1. SQLite 是账号/凭证唯一事实源。
2. `account_key` 是 SQLite 分配并持久化的账号卡唯一业务 ID，建议格式为 `acct_<ulid>` 或 `acct_<uuid>`；不能再由 API key hash、email、auth-index、provider name、文件名或 attribution key 反推。
3. 新建账号卡必须分配新 `account_key`；重新登录或编辑当前账号卡必须保留原 `account_key`。
4. 两张账号卡即使凭证完全相同，也必须是两条独立记录。
5. sidecar 运行态必须直接读取或接收 `account_key`，不能让前端或 Wails 在请求后补偿归因。
6. 迁移完成后删除旧账号凭证事实源文件，不保留双写兼容。
7. 旧 ID 只作为迁移证据写入 `account_runtime_identities`，迁移后所有 UI、Wails、sidecar、rate-limit、usage attribution 都只认新的 `account_key`。
8. 凭证字段默认明文存储在本机 SQLite，权限必须是 `0600`；不要写入日志、错误提示或截图。后续如要加密，应单独设计 Keychain / SQLCipher 方案，不混入本次结构迁移。

## 账号 ID 规则

账号卡 ID 由 `internal/accountstore` 在创建事务内生成并写入 `account_cards.account_key`。推荐实现：

```text
acct_<26-char-ulid>
```

规则：

1. `account_key` 只表达“这张账号卡”，不表达账号类型、provider、文件名、API key 或 base URL。
2. 账号登录、新增 API key、导入、复制账号卡：创建新账号卡和新 `account_key`。
3. 重新登录当前账号卡、刷新 OAuth token、编辑 API key、改 base URL、重命名 provider：更新原记录，`account_key` 不变。
4. 迁移旧数据时，为每条旧账号卡生成新 `account_key`，并把旧 `auth-file:<file>`、`codex-api-key:<local-id>`、`openai-compatible:<provider>` 等写入 `account_runtime_identities`。
5. 迁移 rate-limit / usage attribution / route guard 等外部引用时，必须通过 `account_runtime_identities` 一次性替换到新 `account_key`；迁移完成后不得继续用旧 key 匹配。

## SQLite Schema

### meta

```sql
CREATE TABLE account_store_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

初始值：

```text
schema_version = 1
created_at_unix_ms = <now>
```

### account_cards

账号卡主表。所有账号类型都必须有一行。

```sql
CREATE TABLE account_cards (
  account_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  credential_source TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at_unix_ms INTEGER NOT NULL,
  updated_at_unix_ms INTEGER NOT NULL,
  deleted_at_unix_ms INTEGER
);

CREATE INDEX idx_account_cards_kind
  ON account_cards(kind);

CREATE INDEX idx_account_cards_deleted
  ON account_cards(deleted_at_unix_ms);
```

`kind` 允许值：

- `auth-file`
- `codex-api-key`
- `openai-compatible`

`credential_source` 建议值：

- `sidecar-auth-file`
- `gettokens-codex-api-key`
- `sidecar-openai-compatible`

`account_key` 示例：

- `acct_01JZ7R1Z2Y6J3D2K8V9M4N5P6Q`
- `acct_01JZ7R4T4C7H9Q2K1R8S6W5X3A`

### account_credentials

凭证明细表。一个账号卡一条主凭证。

```sql
CREATE TABLE account_credentials (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,
  secret_json TEXT NOT NULL,
  public_json TEXT NOT NULL DEFAULT '{}',
  fingerprint TEXT NOT NULL DEFAULT '',
  updated_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX idx_account_credentials_type
  ON account_credentials(credential_type);
```

`credential_type` 允许值：

- `codex-oauth`
- `codex-api-key`
- `openai-compatible`

`secret_json` 保存敏感字段：

- OAuth tokens / refresh token
- API key
- provider API key entries
- header 中可能包含的 Authorization 等敏感值

`public_json` 保存非敏感字段：

- email
- plan type
- display provider
- model list
- base URL（如果团队认为 base URL 不敏感）

### codex_api_key_accounts

Codex API key 专属配置。

```sql
CREATE TABLE codex_api_key_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
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
  excluded_models_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_codex_api_key_runtime_config
  ON codex_api_key_accounts(base_url, prefix);
```

说明：

- API key 原文只存放在 `account_credentials.secret_json`，不要在专属配置表重复保存。
- `api_key + base_url + prefix` 不是唯一约束，因为允许复制出多张相同配置的账号卡。
- `quota_curl` / `billing_curl` 属于 GetTokens 本地账号卡配置，不同步给 sidecar 热路径。

### auth_file_accounts

Codex OAuth / auth-file 专属配置。

```sql
CREATE TABLE auth_file_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  source_file_name TEXT NOT NULL DEFAULT '',
  auth_json TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  plan_type TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  modified_unix_ms INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0
);
```

说明：

- `source_file_name` 只记录迁移或导入来源，不能作为唯一身份。
- `auth_json` 存 sidecar 需要消费的 normalized auth JSON。

### openai_compatible_accounts

OpenAI-compatible provider 专属配置。

```sql
CREATE TABLE openai_compatible_accounts (
  account_key TEXT PRIMARY KEY REFERENCES account_cards(account_key) ON DELETE CASCADE,
  provider_name TEXT NOT NULL DEFAULT '',
  runtime_provider_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  api_key_entries_json TEXT NOT NULL DEFAULT '[]',
  headers_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]'
);

CREATE UNIQUE INDEX idx_openai_compatible_runtime_provider_key
  ON openai_compatible_accounts(runtime_provider_key);
```

说明：

- `provider_name` 是展示和可编辑名称，不参与账号身份判断。
- `runtime_provider_key` 是 sidecar runtime provider namespace，建议由 `account_key` 派生，例如 `openai-compatible:acct_...`，避免 provider rename 影响账号卡 ID。
- provider API key entries 原文只存放在 `account_credentials.secret_json`，`api_key_entries_json` 如果保留在本表，只允许保存脱敏 entry 元数据。

### account_runtime_identities

运行时证据映射表，替代 `codex-api-key-attribution-identities-v1.json`。

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

这些只能用于诊断和历史归因辅助，不能作为账号卡主键。

## 文件归属

建议新增 Go 包：

```text
internal/accountstore/
```

职责：

- 打开/迁移 `accounts-v1.sqlite`
- 提供事务 API
- 提供 CRUD：
  - `ListAccountCards`
  - `CreateCodexAPIKeyAccount`
  - `UpdateCodexAPIKeyAccount`
  - `DeleteAccount`
  - `UpsertAuthFileAccount`
  - `UpsertOpenAICompatibleAccount`
  - `ListRuntimeInputsForSidecar`
- 提供旧数据导入器：
  - `ImportLegacyAuthFiles`
  - `ImportLegacyCodexAPIKeyJSONStore`
  - `ImportLegacyConfigYAMLAccounts`

Wails 层只调用 `accountstore`，不直接读写账号 JSON 文件。

## Sidecar 集成方式

推荐方式：sidecar 读取同一个 SQLite。

新增 sidecar 配置字段：

```yaml
account-store-db: /Users/<user>/.config/gettokens-data/accounts-v1.sqlite
```

sidecar 启动时：

1. 打开 `account-store-db`
2. 读取 `account_cards` + 类型专属表
3. 合成 runtime `Auth`
4. `Auth.AccountKey` 必须直接来自 `account_cards.account_key`
5. rate-limit / usage attribution / route guard 继续用 `account_key`

如果短期内 sidecar 不能直接读 SQLite，可接受过渡方案：

1. SQLite 仍是唯一事实源。
2. App 启动和账号变更后生成 sidecar runtime mirror。
3. mirror 可以写到 sidecar management API，但不能再把 `config.yaml` 或 `codex-*.json` 当事实源。
4. 迁移完成后旧文件仍删除；mirror 文件如果必须存在，应放入专门 cache 目录并可随时重建。

## 迁移流程

### 阶段 1：只读导入并校验

1. 创建 `accounts-v1.sqlite`。
2. 从 `~/.config/gettokens/codex-*.json` 导入 `auth-file` 账号，并为每张卡生成新 `account_key`。
3. 从 `~/.config/gettokens-data/codex-api-keys/*.json` 导入 `codex-api-key` 账号，并为每张卡生成新 `account_key`。
4. 从历史 `~/.config/gettokens/codex-api-keys/*.json` 导入遗漏账号。
5. 从 `~/.config/gettokens/config.yaml` 的 `codex-api-key` 和 `openai-compatibility` 导入 sidecar-only 账号。
6. 生成 `account_runtime_identities`，保存旧 key、auth-id、auth-index、fingerprint 到新 `account_key` 的映射。
7. 迁移 rate-limit / usage attribution / route guard 中仍引用旧 key 的记录到新 `account_key`。
8. 校验账号数量、账号卡 ID、disabled、priority、quota/billing 配置、OAuth tokens 均可 round-trip。

### 阶段 2：切读路径

1. `ListAccounts` 改为读 SQLite。
2. `loadCodexAPIKeys` 改为读 SQLite。
3. `ListAuthFiles` 对账号池用途改为读 SQLite；sidecar 原 `/auth-files` 只作为迁移来源或运行状态补充。
4. `ListOpenAICompatibleProviders` 改为读 SQLite。
5. Usage attribution 账号映射改为读 `account_runtime_identities`。
6. Wails / frontend DTO 中的账号 ID 全部来自 `account_cards.account_key`，不再拼接 `auth-file:`、`codex-api-key:` 或 `openai-compatible:` 前缀。

### 阶段 3：切写路径

1. `CreateCodexAPIKey` 写 SQLite。
2. `UpdateCodexAPIKeyLabel/Config/Priority/Status` 写 SQLite。
3. `UploadAuthFiles` 写 SQLite。
4. OAuth 登录成功写 SQLite。
5. `UpdateAccountPriority` 写 SQLite。
6. `SetAccountDisabled` 写 SQLite，并同步 sidecar route guard/runtime。
7. OpenAI-compatible create/update/delete 写 SQLite。

### 阶段 4：删除旧数据

确认 SQLite 导入和运行验证通过后删除旧账号事实源：

```text
~/.config/gettokens/codex-*.json
~/.config/gettokens-data/codex-api-keys/
~/.config/gettokens/codex-api-keys/
~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json
```

同时从 `config.yaml` 移除：

```yaml
codex-api-key:
openai-compatibility:
```

不要删除：

- `config.yaml` 本体
- `remote-management`
- `api-keys`
- `proxy-url` / `use-system-proxy`
- usage / rate-limit / live-session SQLite

## 事务与一致性

账号写入必须使用事务：

```text
BEGIN IMMEDIATE
  upsert account_cards
  upsert type-specific table
  upsert account_credentials
  upsert account_runtime_identities
COMMIT
```

写入 sidecar runtime mirror 必须在 DB commit 后执行。mirror 同步失败时：

- DB 仍然成功。
- 标记 `pending_runtime_sync = true`，下次 sidecar ready 后重试。
- UI 显示“已保存，本次运行态同步待重试”，不能把 DB 回滚成旧状态。

## 安全要求

1. SQLite 文件权限 `0600`。
2. 父目录权限 `0700`。
3. SQL 查询和日志不得打印 `secret_json`、`api_key`、OAuth token、Authorization header。
4. 测试 fixture 使用假 token。
5. bug report / debug export 默认排除 `account_credentials.secret_json` 和所有 `*_key` 字段。
6. SQLite backup 如果存在，必须和主 DB 一样受权限保护。

## 需要修改的主要范围

### GetTokens

- `internal/wailsapp/codex_api_key_store.go`
  - 替换 JSON 文件 store 为 SQLite store。
- `internal/wailsapp/accounts.go`
  - CRUD 改为 SQLite。
- `internal/wailsapp/auth_files.go`
  - 上传、删除、priority、disabled 改为 SQLite。
- `internal/wailsapp/openai_compatible.go`
  - provider CRUD 改为 SQLite。
- `internal/wailsapp/usage_attribution.go`
  - `codex-api-key-attribution-identities-v1.json` 改为 `account_runtime_identities`。
- `internal/accounts/account_records.go`
  - 保持 `AccountRecord` 业务模型不变，只替换数据来源。
- `internal/cliproxyapi`
  - 只保留 sidecar runtime apply/query 需要的 DTO；不要再把 sidecar config 作为账号事实源。
- `app.go` / `app_types.go` / `frontend/wailsjs`
  - 如果 Wails DTO 不变，可以少改；如果新增迁移状态 API，需补 root binding 并重新生成。
- `frontend/src/features/accounts`
  - 只应感知账号卡模型，不应感知旧文件路径。

### CLIProxyAPI sidecar

- 新增账号 SQLite reader 或 GetTokens account store hook。
- runtime auth synthesis 从 SQLite 获得 `AccountKey`。
- `codex-api-key`、auth-file、openai-compatible runtime config 均以 SQLite 为源。
- 保留 rate-limit / usage attribution 继续按 `account_key` 查询。
- 如果保留 management config API，必须标记账号字段为 derived / runtime mirror，不作为持久事实源。

## 测试清单

### 单元测试

1. 新 SQLite schema 初始化。
2. 旧 `codex-*.json` 导入为 `auth-file` 账号。
3. 旧 `codex-api-keys/*.json` 导入为 `codex-api-key` 账号。
4. `config.yaml.codex-api-key` sidecar-only 账号导入并分配稳定 `account_key`。
5. `config.yaml.openai-compatibility` 导入为 provider 账号。
6. 两个相同 API key 配置导入后保留两张不同账号卡。
7. 迁移旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 后生成新的 `acct_*`，旧 key 只进入 runtime identity。
8. 编辑 API key / base URL / prefix 后 `account_key` 不变。
9. 重新登录 OAuth 后 `account_key` 不变。
10. 新登录 OAuth 创建新账号卡。
11. 删除账号卡级联删除 credentials / runtime identities。
12. 旧文件删除后再次启动不会重复导入。
13. `secret_json` 不进入日志和 debug export。

### 集成测试

1. `ListAccounts` 只从 SQLite 读出三类账号。
2. `CreateCodexAPIKey` 写 SQLite 并同步 sidecar。
3. `UploadAuthFiles` 写 SQLite 并同步 sidecar。
4. `UpdateOpenAICompatibleProvider` 写 SQLite 并同步 sidecar。
5. sidecar 启动后 runtime auth 带正确 `AccountKey`。
6. rate-limit rule 使用 `account_key` 命中。
7. usage attribution 新请求写入正确 `account_key`。
8. 旧 key 引用迁移后，rate-limit / usage attribution 不再依赖 attribution key 兜底匹配。
9. App 重启后账号卡顺序、disabled、priority、quota/billing 配置保持一致。

### 手工验收

1. 迁移前有 Codex OAuth、Codex API key、OpenAI-compatible provider。
2. 启动新版本后账号列表完整。
3. 配置一个账号的单日限量规则。
4. 发起请求并确认 usage / rate-limit 归到同一账号卡。
5. 退出 App，确认旧账号文件已删除或不再作为事实源。
6. 重启 App，账号卡和规则仍存在。

## 不纳入本期

- 不把 usage / rate-limit / live-session 历史明细搬进 `accounts-v1.sqlite`；但这些外部 SQLite / 状态库里引用旧账号 key 的字段，必须在账号迁移时一次性重写为新的 `acct_*`。
- 不把 `~/.codex/auth.json` 或 Claude Code 原生配置纳入该 DB。
- 不做云同步。
- 不做 SQLCipher / Keychain 加密，除非另起安全专项。
- 不保留旧文件双写兼容；迁移成功后删除旧账号事实源。

## 交付顺序建议

1. 新增 `internal/accountstore` 和 schema 测试。
2. 实现旧数据导入测试。
3. 切 GetTokens 读路径。
4. 切 GetTokens 写路径。
5. 改 sidecar runtime 读取或 runtime mirror 同步。
6. 跑账号 CRUD、rate-limit、usage attribution 测试。
7. 桌面真机迁移验收。
8. 删除旧账号事实源文件和旧 JSON store 代码。
