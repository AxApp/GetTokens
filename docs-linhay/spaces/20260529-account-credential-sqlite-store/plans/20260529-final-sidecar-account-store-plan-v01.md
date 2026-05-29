# 账号凭证 SQLite 存储最终方案 v01

日期：2026-05-29

## 最终结论

账号与凭证统一存储放在 GetTokens sidecar 侧实现。GetTokens App 不再管理账号事实源，不新增 `internal/accountstore`，不直接读写账号 SQLite、auth-file、Codex API key JSON store 或 `config.yaml` 账号段。

从本版本开始，GetTokens sidecar 断开与 CLIProxyAPI 上游的合并式同步。上游功能只作为参考输入；需要的能力在 GetTokens sidecar 内重新设计、实现、测试和发布。management API 可以按 GetTokens 账号模型破坏性调整，不为了上游或旧端点保留兼容合约。

sidecar 持有唯一账号事实源：

```text
~/.config/gettokens/accounts-v1.sqlite
```

可通过 sidecar config 覆盖：

```yaml
account-store-db: /Users/<user>/.config/gettokens/accounts-v1.sqlite
```

## 范围

### 必须保迁

- Codex OAuth/auth-file 账号凭证和可恢复 runtime auth 的 metadata。
- Codex API key 明文、base URL、prefix、headers、models、excluded models、proxy、quota/billing curl 等账号配置。
- OpenAI-compatible provider 的 base URL、prefix、headers、models、api key entries、proxy 等配置。
- 账号卡标题、provider、priority、disabled、created/updated timestamps。
- 旧账号资产到新 `account_key` 的迁移映射和删除审计。

### 不保迁

- rate-limit 历史规则、状态、事件。
- usage attribution 历史归因。
- route guard 状态。
- Codex/Claude 渠道路由顺序、项目绑定和 probe 结果。
- 前端详情 hash、筛选草稿、选择态、批量选择等 UI 状态。

这些状态迁移后围绕新 `acct_*` 重建。

## 核心模型

`account_key` 是账号卡唯一业务 ID：

```text
acct_<uuid>
```

规则：

1. 每张账号卡都有独立 `account_key`。
2. 新建账号卡一定生成新 `account_key`。
3. 编辑账号配置、更新 API key、OAuth relogin、token refresh 必须保留原 `account_key`。
4. 相同凭证允许复制成多张账号卡，不能用 `api_key + base_url + prefix` 做唯一约束。
5. 旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` 只作为迁移映射，不再作为账号 ID。

敏感凭证不写 `secret_json`，明文存在 SQLite 类型表：

- `codex_api_key_accounts.api_key`
- `auth_file_accounts.auth_json`
- `openai_compatible_accounts.api_key_entries_json`
- `openai_compatible_accounts.headers_json`

不额外存一份完整 raw JSON。例外是 `auth_file_accounts.auth_json`，因为它就是 sidecar runtime 要消费的 normalized auth JSON。

## Schema

最终 schema 以 `docs-linhay/dev/account-credential-sqlite-store-design.md` 为准，核心表如下：

```text
account_store_meta
account_cards
codex_api_key_accounts
auth_file_accounts
openai_compatible_accounts
account_runtime_identities
account_runtime_apply_state
account_migration_sources
```

关键字段：

- `account_cards.account_key`：`acct_<uuid>`。
- `account_cards.kind`：`auth-file | codex-api-key | openai-compatible`。
- `account_cards.revision`：每次凭证或配置变更递增。
- `account_runtime_apply_state`：sidecar 内部 runtime 快照应用状态，不是事实源。
- `account_migration_sources.deleted_at_unix_ms` / `backup_path`：旧源删除审计。

## Management API

新版本 GetTokens 只调用统一账号 API：

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

- `auth-file`：`auth_json`、`source_file_name`、`status`、`status_message`、`metadata`。
- `codex-api-key`：`api_key`、`base_url`、`prefix`、`proxy_url`、`headers`、`models`、`excluded_models`、`quota_curl`、`billing_curl`。
- `openai-compatible`：`provider_name`、`base_url`、`prefix`、`api_key_entries`、`headers`、`models`。

旧端点不作为兼容层保留：

```text
/v0/management/auth-files
/v0/management/codex-api-key
/v0/management/openai-compatibility
```

它们只作为旧数据来源和旧实现参考；新 GetTokens 版本直接切统一账号 API。

实现备注（2026-05-29）：

- GetTokens `ListAccounts`、`acct_*` 账号状态/优先级/Codex API key 更新已优先走统一账号 API。
- Wails 层仍保留旧 ID 分支作为迁移前残留卡片和既有测试兼容路径；该分支不是新事实源，迁移完成后可删除。
- OpenAI-compatible 的列表、创建、编辑、删除、disabled、priority 已收敛到 `/v0/management/accounts`；前端 DTO 携带 `accountKey`，详情保存和卡片操作优先传 `acct_*`，provider name 只作为迁移前旧卡片解析兜底。
- `AccountRecord.accountKind` 已作为前端账号类型判定字段，避免 `acct_*` 账号被旧前缀逻辑误判为 Codex API key，尤其是通用删除、禁用同步、卡片复制导入、详情编辑和 Claude/Codex 列表分类。

## Sidecar 写入一致性

账号写入必须在 sidecar 内使用事务：

```text
BEGIN IMMEDIATE
  upsert account_cards
  upsert type-specific table
  upsert account_runtime_identities if needed
  mark account_runtime_apply_state pending
COMMIT
rebuild/apply runtime auth/provider snapshot
mark account_runtime_apply_state applied or failed
```

一致性要求：

1. DB commit 成功后，runtime 快照必须刷新。
2. runtime apply 失败不能回滚 DB，但必须写入 `account_runtime_apply_state=failed`。
3. management API 必须暴露 runtime apply 状态，让 GetTokens 能显示“已保存，运行态应用失败/待重试”。
4. `PATCH /v0/management/accounts/{account_key}` 必须和 create/status/priority/delete 一样触发 runtime apply，保证凭证编辑后当前 sidecar 进程使用新凭证。
5. sidecar 重启时必须从 SQLite 重建 runtime，不依赖旧 auth-dir 或 `config.yaml` 账号段。
6. GetTokens 不能绕过 sidecar 直接修补账号 DB 或旧文件。

## OAuth / auth-file 策略

迁移后 sidecar 不再把 `codex-*.json` 当持久事实源更新。

- OAuth finalize：创建新 `auth-file` 账号，写入 `auth_file_accounts.auth_json`。
- OAuth relogin：更新指定 `account_key` 的 `auth_json`，保留账号卡 ID。
- token refresh：如果产生新 auth payload，直接回写原账号卡 `auth_json`。
- 旧 auth-dir：只作为迁移来源或短期临时产物；迁移完成后持久旧文件必须删除。

## 迁移流程

### 阶段 1：sidecar schema 与 dry-run

可独立合入，不改变 runtime。

- 新增 sidecar account store。
- 初始化 SQLite schema。
- 扫描旧源：
  - `~/.config/gettokens/codex-*.json`
  - `~/.config/gettokens-data/codex-api-keys/*.json`
  - `~/.config/gettokens/codex-api-keys/*.json`
  - `config.yaml.codex-api-key`
  - `config.yaml.openai-compatibility`
- 输出 dry-run report。
- 不写 DB，不删除文件。

验证：

- schema 初始化。
- 文件权限 `0600`、父目录权限 `0700`。
- 旧三类账号能被识别。
- 相同 API key 配置仍会生成多张候选账号卡。

### 阶段 2：commit import

可独立合入，但不删除旧源。

- 写入 `account_cards` 和类型表。
- 写入 `account_runtime_identities`。
- 写入 `account_migration_sources`。
- 校验账号数量、fingerprint、priority、disabled、headers、models、quota/billing 可 round-trip。

验证：

- 重复执行迁移幂等。
- 旧 ID 只进入 runtime identity。
- commit 后可通过 `/v0/management/accounts` 列出账号。

### 阶段 3：sidecar runtime 读写切换

可独立合入。

- runtime auth/provider 从 SQLite 构建。
- 统一账号 API 写 SQLite。
- Codex API key 更新、auth-file 更新、OAuth relogin/token refresh、OpenAI-compatible 更新都走 AccountService。
- DB commit 后刷新 runtime 快照，并把 `account_runtime_apply_state` 从 `pending` 标记为 `applied` 或 `failed`。

验证：

- 更新 API key 后 runtime 使用新 key。
- OAuth relogin 后 `account_key` 不变，runtime 使用新 token。
- OpenAI-compatible provider rename 不改变账号身份。
- runtime apply 失败可见且可重试。

### 阶段 4：GetTokens 接入统一账号 API

可独立合入。

- `internal/cliproxyapi` 增加统一账号 API client。
- `internal/wailsapp/accounts.go`、`auth_files.go`、`openai_compatible.go` 改为调用统一账号 API。
- `internal/wailsapp/codex_api_key_store.go` 不再作为事实源，保留为迁移辅助或删除。
- 前端 `AccountRecord.id` 切到 `acct_*`，前缀判断改为 `kind` / `credentialSource`。

验证：

- 账号池三类账号完整展示。
- 新建、编辑、禁用、排序、删除账号可用。
- 旧详情 hash 不保留，新详情可打开。
- 旧渠道路由顺序不保留，新顺序可重建。

### 阶段 5：删除旧账号事实源

最终阶段，必须执行。

触发条件：

- dry-run 和 commit report 显示账号凭证/配置完整。
- sidecar runtime 可从 SQLite 重建。
- GetTokens 桌面账号列表完整。
- 新建/编辑/重新登录后的 runtime 凭证验证通过。

删除动作：

- 删除 `~/.config/gettokens/codex-*.json`。
- 删除 `~/.config/gettokens-data/codex-api-keys/`。
- 删除 `~/.config/gettokens/codex-api-keys/`。
- 删除 `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`。
- 从 `config.yaml` 移除 `codex-api-key` 和 `openai-compatibility`。
- 写回 `account_migration_sources.deleted_at_unix_ms` / `backup_path`。

删除前备份到：

```text
~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/
```

备份不是新事实源，只用于人工事故恢复。

## BDD 验收场景

1. 给定旧 auth-file、Codex API key JSON、OpenAI-compatible provider 同时存在，当执行迁移，则每个旧资产都获得新 `acct_*`，账号凭证/配置可 round-trip。
2. 给定两张 Codex API key 账号拥有相同 `api_key + base_url + prefix`，当迁移后，则保留两张不同账号卡。
3. 给定某 auth-file 账号，当 OAuth relogin 或 token refresh 后，则原 `account_key` 不变，`auth_json` 更新，runtime 使用新 token。
4. 给定 OpenAI-compatible provider，当 provider 展示名修改后，则 `account_key` 不变，runtime provider namespace 不依赖展示名。
5. 给定账号 DB commit 成功但 runtime apply 失败，当查询账号状态，则能看到 failed 状态，并可在 reload/下一次更新时重试。
6. 给定迁移验证完成，当执行 delete legacy sources，则旧账号事实源被删除或从 config 移除，再次启动不会从旧源重复导入。

## 测试门禁

sidecar 聚焦测试：

```text
go test ./gettokens/sidecar/...
```

GetTokens 聚焦测试：

```text
go test ./internal/cliproxyapi ./internal/wailsapp ./internal/accounts
```

GetTokens 全量回归：

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

1. 带旧数据 profile 启动。
2. dry-run report 完整。
3. commit migration 后账号池完整。
4. 新建、编辑、禁用、priority、OAuth relogin 可用。
5. 重启后账号仍完整。
6. 删除旧源后不会重复导入。

## 回滚策略

阶段 1-4 未删除旧源前：

- 可关闭 sidecar account-store 开关。
- 可删除 `accounts-v1.sqlite` 后重新 dry-run。
- 旧源仍存在，可回到旧版本。

阶段 5 删除旧源后：

- 以 `accounts-v1.sqlite` 为唯一事实源继续运行。
- 仅允许从 `migration-backups/accounts-v1-<timestamp>/` 人工恢复旧文件。
- 恢复后必须重新执行迁移，不允许长期双写并存。

## 最终 DoD

1. sidecar SQLite 是唯一账号事实源。
2. GetTokens 不直接管理账号事实源。
3. 统一账号 management API 完成接入，旧账号 API 不作为兼容层保留。
4. 账号凭证/配置迁移完整，报告可核对。
5. 凭证更新后 runtime 使用新凭证。
6. 旧账号事实源已删除或从 config 移除。
7. 不保迁数据已明确：rate-limit、usage attribution、route guard、渠道路由、前端详情 hash。
8. 自动化测试、桌面验收、docs、memory、qmd 均完成。
