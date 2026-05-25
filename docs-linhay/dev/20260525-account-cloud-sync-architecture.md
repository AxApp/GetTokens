# 账号云端同步与共享技术方案

日期：2026-05-25

## 结论

默认实现方向采用 `CloudAccountSyncAdapter` 抽象 + `PsqlAccountSyncAdapter`。用户在本地配置 PostgreSQL/psql 连接，GetTokens 桌面端直接连接云端数据库，按所选同步模式执行单向只上传、单向只拉取或双向同步。

领域层先做本地版本化同步账本、端到端加密和冲突合并模型；PostgreSQL 只保存密文 payload、最小非敏感索引、cursor、ACL / share 元数据和审计记录。后续如需要服务端代理或其他数据库，也只能替换 adapter，不应改写账号领域模型。

## 数据边界

同步对象属于 Account Inventory：

- `auth-file` 派生账号。
- `codex-api-key` 本地账号。
- `openai-compatible` provider。
- 账号组、标签、备注、禁用意图、模型映射、quota curl、billing curl、proxy 和可迁移 metadata。

不同步对象：

- Codex / Claude 渠道路由顺序、route mode、项目绑定和 fallback。
- quota / billing 查询结果。
- usage attribution、rate-limit ledger、live sessions、route events。
- sidecar 运行态、请求热路径状态和 upstream 响应内容。

## 核心模型

```text
SyncAsset
  syncID
  assetKind              auth-file | codex-api-key | openai-compatible | group
  localAssetKey          auth-file:<name> | codex-api-key:<id> | openai-compatible:<name>
  ownerScope             private | shared-in | shared-out
  encryptedPayload
  publicIndex
  fieldRevisions
  tombstone
  schemaVersion
```

```text
FieldRevision
  fieldPath
  deviceID
  logicalClock
  updatedAt
  contentHash
```

```text
SyncConflict
  conflictID
  syncID
  fieldPaths
  localRevision
  remoteRevision
  reason                 secret-conflict | delete-update | schema | permission
  resolution             pending | local | remote | merged | duplicated
```

## PostgreSQL 连接

本地配置项：

- host / port / database。
- schema，例如 `gettokens_sync`。
- table prefix，便于一个数据库中隔离多套环境。
- user / password 或 connection URI。
- SSL mode：默认要求 `require` 或更高；开发环境可显式允许 `disable`。
- connect timeout、statement timeout。
- device profile id 与 sync mode。

安全要求：

1. 连接密码或 URI 存入 Keychain，不进入普通配置文件和日志。
2. UI 可展示脱敏连接摘要，例如 host、database、schema、user，不展示 password。
3. 连接测试只验证 schema、权限和版本，不读取 secret payload 明文。
4. 建议数据库用户使用最小权限，只能访问同步 schema 内的表、视图和函数。
5. 多用户共享必须依赖 owner / recipient / ACL 字段、数据库约束和客户端 envelope 校验；不能只靠 UI 隐藏。

## 依赖规划

首选 Go 依赖：

| 用途 | 建议依赖 | 说明 |
| --- | --- | --- |
| PostgreSQL driver / pool | `github.com/jackc/pgx/v5` | 使用 `pgxpool`，支持 context、TLS、batch、事务、错误码识别；避免再引入 `database/sql` 适配层。 |
| PostgreSQL migration | `github.com/jackc/tern/v2/migrate` | 与 pgx 同源，适合内嵌 SQL migration；替代方案是 `github.com/pressly/goose/v3`。 |
| PostgreSQL mock | `github.com/pashagolub/pgxmock/v4` | 用于 adapter contract 的无数据库单测；若版本不匹配，退回 fake adapter 接口测试。 |
| PostgreSQL integration test | `github.com/testcontainers/testcontainers-go` + postgres module | 只用于可选集成测试；普通单测不依赖 Docker。 |
| UUID | `github.com/google/uuid` | 项目已有间接依赖，可直接升为直接依赖，用于 `syncID`、device profile、remote instance id。 |
| 加密 | 标准库 `crypto/rand`、`crypto/aes`、`crypto/cipher`，必要时 `golang.org/x/crypto/chacha20poly1305` | 默认可用 AES-GCM；如需要 XChaCha20-Poly1305 再显式使用 x/crypto。 |
| Keychain | macOS Security framework wrapper 或小型本地封装 | 当前发布范围 macOS，优先封装 `security` / Security.framework；若要跨平台再评估 `github.com/zalando/go-keyring`。 |

不建议首轮引入：

- ORM：不要引入 GORM/ent/sqlboiler。同步协议需要精确事务、CAS、错误码和 per-row result，手写 SQL 更可控。
- 云数据库 SDK：本期是用户直连 PostgreSQL，不需要 Supabase SDK 或云厂商 SDK。
- 前端数据库客户端：前端不直连 PostgreSQL，所有连接和同步动作走 Wails/Go。

依赖引入阶段：

1. P0 纯模型：不新增外部依赖，尽量只用标准库。
2. P1 加密/Keychain：先用标准库加密；Keychain 封装可以独立小包实现。
3. P2 PostgreSQL adapter：新增 `pgx/v5`，再按 migration 方案决定 `tern` 或项目内 SQL runner。
4. P2 contract / integration test：先 fake adapter，再按需要引入 `pgxmock` 和 `testcontainers-go`。
5. P4 前端：优先复用现有 React、lucide、设计系统组件，不新增前端依赖。

## 同步模式

`upload-only`：

- 本机是写入来源，只上传本地 pending patches。
- 仍需读取远端 base revision / schema version / tombstone，以避免覆盖远端较新 secret。
- 遇到远端较新 revision 时，不能静默覆盖；进入 `remote-newer` 提示。

`download-only`：

- 云端是来源，只拉取远端变更。
- 本地编辑允许继续落本地，但标记为 `local-only` 或 `paused`，不进入云端 pending push。
- 用户切换到双向或上传模式时，必须先展示 local-vs-cloud diff。

`bidirectional`：

- 每轮同步先 pull，再 merge，再 push。
- 低风险字段自动合并；secret、删除/恢复、权限冲突进入冲突队列。
- push 必须携带 base revision / logical clock / schema version precondition。

## 加密策略

1. 每条账号资产使用独立 record key。
2. record key 由本机 Keychain 中的 device key 包装。
3. 云端保存 `encryptedPayload` 和最小 `publicIndex`。
4. 共享时为接收方生成独立 envelope，不复用明文 secret。
5. 云端、日志、route event 和错误文案不得出现明文 API Key、token、cookie、Authorization 或 Cookie header。

## 合并策略

自动合并：

- 备注、标签、UI 分组、禁用意图、非敏感展示 metadata。
- 不同字段的并发编辑按字段 revision 合并。

条件合并：

- 模型映射按 `name + alias` 合并，删除与修改冲突需记录。
- quota curl / billing curl 先结构化解析，只允许安全 header 字段自动合并。
- proxy / base URL 修改若影响请求出口，进入待确认。

必须确认：

- API Key、access token、refresh token、session token、cookie。
- 删除 vs 编辑。
- 共享权限降级或撤销。
- schema 无法向前迁移。

## PostgreSQL 表边界

建议表：

- `sync_assets`：资产主表，存 `sync_id`、owner、asset kind、public index、encrypted payload、schema version、tombstone。
- `sync_field_revisions`：字段级 revision，支持合并和 explain。
- `sync_conflicts`：冲突记录和解决状态。
- `sync_devices`：设备身份、公钥、最后同步时间、模式摘要。
- `sync_acl`：共享权限，owner、recipient、permission、status。
- `sync_envelopes`：面向设备或接收方的 encrypted record key envelope。
- `sync_cursors`：每个 device profile 的增量 cursor / last seen revision。
- `sync_audit_log`：不含 secret 的审计日志。

事务规则：

1. push batch 需要事务和 per-row result；唯一性冲突、权限冲突、schema 冲突要可定位到单条资产。
2. 所有写入必须带 base revision precondition，防止旧客户端覆盖新数据。
3. delete 使用 tombstone，不直接 hard delete。
4. 共享 ACL 变更与 envelope 变更必须在同一事务提交。

测试入口：

- PostgreSQL adapter 的必测边界记录在 `../spaces/20260525-account-cloud-sync/plans/boundary-test-matrix-v01.md`。
- 首轮实现不能只跑 happy path；至少覆盖 `PG-001`、`PG-003`、`PG-004`、`PG-007`、`PG-008`、`S-001`、`S-002`、`S-005`、`S-007`。

## 共享权限边界

直连 PostgreSQL 模式下，`read-only`、`use-only`、`copy` 是数据库 ACL + 客户端策略 + envelope 分发共同实现的产品语义：

- `read-only`：接收方可读取非敏感 public index，不发放可解密 secret 的 envelope。
- `use-only`：接收方获得 envelope，可在本机用于请求；客户端隐藏明文导出入口并记录审计。
- `copy`：接收方可复制为自己的 private asset，生成新的 `syncID`。

风险说明：如果客户端拿到了能解密 secret 的 envelope，就无法从密码学上阻止高级用户导出 secret。若产品必须强制“可用但不可导出”，需要新增服务端请求代理，让接收方永远不接触 secret material。

## 后续待定

1. 是否允许共享账号以 `use-only` 方式解密但禁止明文导出，需要结合本地系统能力再定。
2. PostgreSQL 连接是否允许明文 TCP / `sslmode=disable`，默认应只允许开发环境显式开启。
3. 是否需要提供初始化 SQL / migration CLI，还是在 App 内自动迁移 schema。
4. 渠道路由配置是否也需要同步，应另开 space，避免和账号资产同步混在一起。
