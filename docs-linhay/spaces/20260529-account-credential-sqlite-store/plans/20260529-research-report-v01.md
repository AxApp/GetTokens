# 账号凭证 SQLite 存储调研报告

日期：2026-05-29

## 调研结论

建议推进 sidecar-owned `accounts-v1.sqlite`，但必须把它视为账号/凭证事实源迁移，而不是单纯把 JSON 文件换成 SQLite。当前边界已明确收窄：只有账号凭证和账号配置必须保迁；rate-limit、usage attribution、route guard、渠道路由和前端详情 hash 都可以直接重做，不作为历史数据保迁目标。

同时，从本版本开始断开与 CLIProxyAPI 上游的合并式同步。上游功能只作为参考输入，GetTokens 需要的功能在 sidecar 侧重新设计、实现和测试；management API 可以按 GetTokens 账号模型直接破坏性调整。

当前已经在执行 worktree/分支 `账号与凭证统一存储方案` 上推进，不需要再新建 worktree。推荐拆成五个阶段：

1. 在 GetTokens sidecar 内新增 account store，只做 schema、迁移导入和只读校验。
2. sidecar runtime 读路径切到 SQLite，但保留旧源为只读迁移来源。
3. sidecar 账号写路径切到 SQLite，并在 DB commit 后刷新自身 runtime auth/provider 快照。
4. GetTokens Wails 账号方法直接切到新的统一 sidecar management API，不新增 GetTokens 侧账号 store，也不为旧上游 API 保留兼容层。
5. 完成账号凭证/配置验证后删除旧账号事实源，不保留长期双写；只停止读取旧源不算完成。

## 当前事实源

### Auth-file

- 当前来源：sidecar `auth-dir`，默认 `~/.config/gettokens/codex-*.json`。
- Wails 路径：`internal/wailsapp/auth_files.go` 通过 `/v0/management/auth-files` list/download/upload/delete/status。
- 当前账号 ID：`auth-file:<file-name>`。
- 风险：文件名既是展示来源又是业务 ID。迁移后它只能作为 `source_file_name` 和 `account_runtime_identities` 证据。

### Codex API key

- 当前来源：`internal/wailsapp/codex_api_key_store.go`，默认 `~/.config/gettokens-data/codex-api-keys/*.json`，并迁移历史 `~/.config/gettokens/codex-api-keys/*.json`。
- 运行同步：`internal/wailsapp/accounts.go` 将本地 JSON store 写回 sidecar `/v0/management/codex-api-key`。
- 当前账号 ID：优先 `local-id`，否则由 `api_key + base_url + prefix` 派生。
- 风险：相同 API key 配置允许复制成多张账号卡，所以 `api_key + base_url + prefix` 不能成为唯一约束。

### OpenAI-compatible provider

- 当前来源：sidecar `config.yaml.openai-compatibility`。
- Wails 路径：`internal/wailsapp/openai_compatible.go` 通过 management API 整组 PUT。
- 当前账号 ID：`openai-compatible:<provider-name>`。
- 风险：provider rename 当前会改变账号 ID。迁移后 sidecar runtime namespace 应由 `account_key` 派生，展示名不再参与身份。

### Runtime identity

- 当前来源：`internal/wailsapp/usage_attribution.go` 读取 auth-index、provider name、`codex-api-key-attribution-identities-v1.json` 做归因兜底。
- 目标：这些映射进入 `account_runtime_identities`，只用于账号迁移校验、必要诊断和 sidecar runtime 辅助，不承担旧 usage/rate-limit/channel 历史重写。

## 目标模型

- 主 DB：`~/.config/gettokens/accounts-v1.sqlite`，由 sidecar 持有。
- 主表：`account_cards(account_key, kind, title, provider, credential_source, priority, disabled, timestamps)`。
- 类型表：`auth_file_accounts`、`codex_api_key_accounts`、`openai_compatible_accounts`。
- 映射表：`account_runtime_identities(identity_key, account_key, identity_kind, timestamps)`。
- runtime apply 状态表：`account_runtime_apply_state(account_key, revision, status, last_error, applied_at, updated_at)`。
- 迁移审计表：`account_migration_sources(id, account_key, source_kind, source_path, source_key, source_fingerprint, imported_at, deleted_at, backup_path)`。
- 新账号 ID：`acct_<uuid>`，只表达“一张账号卡”。
- 敏感凭证不写入 `secret_json` / secret store，明文存在对应类型表中。

## BDD 场景

### 场景 1：旧数据首次迁移

给定本机同时存在 Codex auth-file、Codex API key JSON、OpenAI-compatible provider；
当新版本首次启动并执行迁移；
那么 SQLite 中为每个旧资产创建独立账号卡；
并且每张卡获得新的 `acct_*`；
并且旧 ID 写入 `account_runtime_identities`；
并且账号数量、disabled、priority、quota/billing、OAuth token 可 round-trip。

### 场景 2：相同凭证复制

给定两个 Codex API key 账号拥有相同 `api_key + base_url + prefix`；
当迁移或复制导入执行；
那么它们仍是两张不同账号卡；
并且拥有两个不同 `account_key`；
并且后续新建的 usage、rate-limit、route guard 可以围绕新 `account_key` 独立建立，不需要迁移旧状态。

### 场景 3：重新登录保留账号卡

给定用户从某张 auth-file 账号卡发起重新登录；
当 OAuth token 被刷新或替换；
那么 SQLite 更新原账号卡凭证；
并且 `account_key` 不变；
并且旧/new runtime identity 都指向同一账号卡。

### 场景 4：provider 重命名不改身份

给定一个 OpenAI-compatible provider 账号卡；
当用户修改 provider 展示名；
那么 `account_key` 不变；
并且 sidecar runtime provider namespace 不再依赖展示名；
并且账号凭证和 provider 配置仍指向同一账号卡；渠道路由可以重做。

### 场景 5：sidecar runtime apply 失败

给定 sidecar 账号写入 SQLite 已提交；
当 sidecar runtime 快照应用失败；
那么 DB 不回滚；
并且记录 `account_runtime_apply_state=failed`；
并且下次 sidecar reload 或账号更新后可重试；
并且 UI 明确显示运行态应用失败。

## 实施边界

### GetTokens

- 不新增 `internal/accountstore`，不打开账号 SQLite。
- `internal/wailsapp/codex_api_key_store.go` 不再直接管理 JSON 事实源。
- `internal/wailsapp/accounts.go`、`auth_files.go`、`openai_compatible.go` 写路径改为调用 sidecar 账号 API。
- `internal/wailsapp/usage_attribution.go` 后续只需让新事件能按新 `account_key` 归因；旧 attribution 历史不迁移。
- `internal/accounts/account_records.go` 保留业务展示模型，但 ID 来源切到 `account_key`。

### CLIProxyAPI sidecar

- 持有并直接读取账号 SQLite。
- 账号管理 API、OAuth finalize/relogin、token refresh 都直接写 SQLite。
- DB commit 后刷新 runtime auth/provider 快照。
- runtime auth 的 `AccountKey` 必须来自 SQLite `account_cards.account_key`。
- `config.yaml.codex-api-key` 和 `openai-compatibility` 只能作为迁移来源或派生 runtime 配置。
- 不再以 CLIProxyAPI 上游 API 兼容为目标；账号 management API 以 GetTokens 统一账号模型为准。

### 前端

- 前端继续消费 `AccountRecord`，但不要再依赖 ID 前缀判断真实存储来源。
- 旧前缀判断需要迁移到明确字段，例如 `kind` / `credentialSource` / `runtimeKind`。
- hash detail、批量选择、渠道路由 order 列表不做历史迁移，切换后可按新 `acct_*` 重新建立。

## 风险清单

1. sidecar SQLite schema 直接进入热路径，需要 schema 版本、WAL、busy timeout、只读事务边界。
2. runtime apply 失败会导致当前进程短暂使用旧凭证，必须持久记录 apply state 并可重试。
3. 明文 SQLite 存敏感凭证，权限、日志、debug export 必须先落测试。
4. OpenAI-compatible provider 目前以 name 为 ID，rename 迁移需要单独测试。
5. 删除旧文件不可逆，必须有 dry-run、备份或至少迁移校验报告。
6. 运行态和 UI 派生状态会丢弃重建，交付说明需要明确告知 rate-limit、usage attribution、route guard、渠道路由和详情 hash 不保迁。

## TDD 测试优先级

### P0 单元测试

- schema 初始化与 `schema_version`。
- `0600` DB 文件权限和 `0700` 父目录。
- 旧 auth-file 导入。
- 旧 Codex API key JSON 导入。
- sidecar `config.yaml.codex-api-key` / `openai-compatibility` 导入。
- 相同 API key 配置生成不同账号卡。
- 编辑凭证保留 `account_key`。
- 删除账号级联删除 type-specific rows/runtime identities。
- 明文凭证不进入日志/debug export。

### P1 集成测试

- `ListAccounts` 从 SQLite 读出三类账号。
- Codex API key create/update/delete 经 sidecar 写 SQLite 并刷新 runtime。
- auth-file upload/delete/status/priority 经 sidecar 写 SQLite 并刷新 runtime。
- OpenAI-compatible create/update/delete 经 sidecar 写 SQLite 并刷新 runtime。
- 切换后新建 usage attribution 事件可以写入新 `account_key`。
- 切换后新建 rate-limit rule 可以按新 `account_key` 命中。

### P2 桌面验收

- 带旧数据启动新版本，账号列表完整。
- 迁移后重新配置一个账号限流，发起请求后新的 usage/rate-limit 同账号归因。
- 退出并重启后账号顺序、禁用状态、priority、quota/billing 配置保持。
- 旧账号事实源不再参与读写；旧 rate-limit、usage attribution、route guard、渠道路由和详情 hash 不要求保留。

## 开放问题

1. 删除旧文件前是否需要自动备份到 `~/.config/gettokens/migration-backups/`。
2. 前端 `AccountRecord.id` 是否直接改为 `account_key`，还是新增 `accountKey` 后分阶段替换。

## 建议下一步

当前已在实现 worktree 上。第一阶段只做 sidecar account store 和迁移 dry-run：

1. 建 schema 和 DB opener。
2. 写旧源 importer 的红灯测试。
3. 实现 dry-run report，dry-run 阶段先不删除旧文件。
4. 用测试覆盖旧账号凭证/配置到新 `acct_*` 的映射。
5. 输出迁移报告后再切读路径。
6. 最终迁移验证通过后执行旧账号事实源删除，并把删除结果写入迁移报告。
