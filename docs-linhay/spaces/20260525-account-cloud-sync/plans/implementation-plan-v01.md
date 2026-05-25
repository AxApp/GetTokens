# 账号云端同步与共享实施计划 v01

日期：2026-05-25

## 规划原则

1. 本地优先：账号增删改查先落本地账本和现有 sidecar / local store，再异步同步云端。
2. 密文上云：云端数据库只保存端到端加密 payload、同步元数据和最小非敏感索引。
3. 资产与路由分离：同步 Account Inventory，不把 Channel Routing 的请求顺序、route mode、项目绑定混入账号资产。
4. 冲突可解释：自动合并只覆盖低风险字段；secret、删除、共享权限冲突必须进入用户可审查队列。
5. adapter 先行：先定义 `AccountSyncStore` / `CloudAccountSyncAdapter` 接口，再落 `PsqlAccountSyncAdapter`；后续服务端代理或其他数据库不重写领域层。
6. BDD/TDD 先行：每阶段先补模型测试、冲突合并测试和 adapter contract test，再实现。
7. 同步模式显式：`upload-only`、`download-only`、`bidirectional` 都必须有独立测试和 UI 状态。

## P0：同步账本与纯模型红灯测试

目标：不接云端，先让账号资产具备 stable identity、版本、tombstone 和冲突合并模型。

任务：

- 新增账号同步领域包，建议后端命名：
  - `internal/accountsync/`
  - `SyncAsset`
  - `SyncLedger`
  - `SyncRevision`
  - `SyncFieldPatch`
  - `SyncConflict`
  - `SyncTombstone`
- 建立 asset 映射：
  - `auth-file:<name>` -> `syncID`
  - `codex-api-key:<local-id>` -> `syncID`
  - `openai-compatible:<provider-name>` -> `syncID`
- 对现有账号数据做归一化快照，不直接把 `AccountRecord` 原样持久化为云端 payload。
- 定义字段分类：
  - 可自动合并：备注、标签、分组、禁用意图、排序显示字段、非敏感 metadata。
  - 条件合并：模型映射、quota curl、billing curl、proxy、base URL。
  - 必须确认：API Key、access token、refresh token、cookie、删除与恢复。
- 本地账本落盘路径建议：`~/.config/gettokens-data/account-sync/ledger-v1.json`。

红灯测试：

- 同一个本地账号重复扫描不会生成新 `syncID`。
- API Key 本地 stable id 变化之外的配置编辑不会改变 `syncID`。
- 备注与禁用状态并发编辑可以字段级合并。
- secret 并发编辑生成 `SyncConflict`，不自动覆盖。
- tombstone 遇到离线编辑生成删除冲突，默认保留删除。
- expired / quota error / network error 这类健康诊断不会生成账号资产 patch。

## P1：端到端加密与 Keychain 密钥管理

目标：账号 payload 能以密文形式安全进入云端 adapter。

任务：

- 设计密钥层：
  - device key：本机设备身份，存 Keychain。
  - account record key：每条账号资产独立数据密钥。
  - sharing envelope：面向接收方的 record key 包装。
- 将 secret 字段拆入 encrypted payload，不允许出现在云端索引。
- 非敏感索引只保留：
  - `syncID`
  - `assetKind`
  - `provider`
  - `credentialSource`
  - `updatedAt`
  - `deleted`
  - `schemaVersion`
  - `shareScope`
- 增加密钥轮换与设备移除的预留字段。

测试：

- 云端 payload JSON 中不出现 API Key、token、cookie、Authorization、Cookie header 明文。
- 本机 Keychain 缺失时不能静默上传未加密数据。
- 解密失败进入 degraded 状态，不删除本地账号。
- 同一 payload 反序列化后能恢复账号资产快照。

## P2：PostgreSQL adapter 与同步模式

目标：实现用户配置 PostgreSQL 连接后的单向/双向账号同步，不做共享。

任务：

- 定义 `CloudAccountSyncAdapter`：
  - `PullChanges(cursor)`
  - `PushChanges(batch)`
  - `FetchAsset(syncID)`
  - `SaveCursor(cursor)`
  - `GetAccountStatus()`
- 默认 adapter：`PsqlAccountSyncAdapter`。
- 新增 Go 依赖候选：
  - `github.com/jackc/pgx/v5`：PostgreSQL driver / pool。
  - `github.com/jackc/tern/v2/migrate`：PostgreSQL schema migration，若采用项目内 SQL runner 则可不引。
  - `github.com/pashagolub/pgxmock/v4`：adapter contract mock，若版本不匹配则改用 fake adapter。
  - `github.com/testcontainers/testcontainers-go`：可选 integration test，不进入普通单测必需路径。
- 新增 PostgreSQL 连接配置：
  - host / port / database / schema / table prefix。
  - user / password 或 connection URI。
  - SSL mode / connect timeout / statement timeout。
  - 连接测试与 schema version 检查。
- 新增同步模式：
  - `upload-only`：只上传本地 pending patches；远端较新 revision 进入提示，不静默覆盖。
  - `download-only`：只拉取云端；本地编辑标记 local-only/paused，不推送。
  - `bidirectional`：先 pull，再 merge/conflict，再 push。
- macOS/Wails 边界：
  - Go 领域层只依赖 adapter interface；PostgreSQL 连接实现放在基础设施层。
  - 连接密钥存 Keychain，普通配置只存脱敏 profile。
  - Wails 暴露同步状态、手动同步、冲突列表、解决冲突方法。
- 增加后台同步节流：
  - 启动后 sidecar ready 再扫描账号资产。
  - 本地变更 debounce 后 push。
  - 网络失败指数退避。

测试：

- adapter contract test 覆盖 pull/push/cursor/idempotency。
- Wails 方法在 PostgreSQL 不可用、认证失败、schema 缺失、权限不足时返回可解释错误。
- 离线本地编辑恢复联网后按账本顺序上传。
- sidecar 未 ready 时不读取账号详情、不触发云端误删。
- 设备 A 本机账号过期但云端已有设备 B 刷新的新 secret 时，pull 采用云端较新 secret revision，且 A 的 expired 诊断不反向覆盖云端。
- `upload-only` 遇到远端较新 revision 时阻止静默覆盖。
- `download-only` 本地编辑不进入 push queue。
- `bidirectional` 按 pull -> merge/conflict -> push 顺序执行。
- PostgreSQL adapter 必须满足 `boundary-test-matrix-v01.md` 中 `PG-*` 与 `S-*` 测试。

## P3：PostgreSQL 共享 ACL 与权限模型

目标：支持用户将账号或账号组共享给其他用户，并能撤销。

任务：

- 定义共享对象：
  - `SharedCollection`
  - `SharedAssetRef`
  - `ShareRecipient`
  - `SharePermission`: `read-only` / `use-only` / `copy`
- PostgreSQL 表支持：
  - `sync_acl`
  - `sync_envelopes`
  - `sync_audit_log`
  - 创建 share / 接受 share / 撤销 share / 列出 shared-in 与 shared-out。
- 权限语义：
  - `read-only`：可查看非敏感 metadata，不可解密 secret。
  - `use-only`：可解密并用于本机请求，客户端隐藏明文导出入口并记录审计；直连数据库模式下不能提供密码学强不可导出保证。
  - `copy`：可复制为自己的账号资产，复制后脱离原 share。
- 接收方本地显示共享来源和权限，不把 shared-in 账号误当成本人拥有资产。

测试：

- 共享只包含被授权账号，不外带其他本地账号。
- 撤销共享后接收方不再收到更新。
- shared-in 账号不能被接收方写回覆盖共享方资产，除非权限明确允许。
- copy 后产生新的本地 `syncID`，不再跟随原共享资产。
- 接收方对 shared-in 账号检测到 expired 时，只产生本机健康态，不生成 owner asset patch；`use-only` 权限下只能等待所有者更新，`copy` 后才可更新自己的副本。

## P4：冲突处理 UI 与同步设置

目标：让用户能看懂同步状态、共享状态和冲突证据。

任务：

- 新增设置入口或账号页同步入口：
  - 开启/关闭账号同步。
  - 云端账号状态。
  - 上次同步时间。
  - pending push/pull 数量。
  - 冲突数量。
  - 手动同步。
- 账号卡/详情展示同步徽标：
  - `local-only`
  - `syncing`
  - `synced`
  - `conflict`
  - `shared-in`
  - `shared-out`
- 冲突 modal：
  - 字段级 diff。
  - 保留本机版本。
  - 使用云端版本。
  - 合并非敏感字段。
  - 另存为新账号。
- 浏览器 preview 提供稳定 mock 数据，不依赖 Wails runtime。

测试：

- 纯模型测试覆盖冲突列表排序、字段 diff、解决动作。
- 前端组件测试覆盖同步徽标和冲突 modal 状态。
- 浏览器 preview 无 Wails runtime 不报错。
- Wails 桌面 smoke 覆盖手动同步、冲突打开、解决后刷新。

## P5：服务端代理与跨后端预留

目标：确认直连 PostgreSQL 之外的服务端代理或其他后端可以接入，但不抢第一期实现。

任务：

- 为自建 API / Supabase / 其他数据库预留 adapter contract。
- 明确服务端只处理密文、cursor、共享 ACL，不接触明文 secret。
- 若要强制 `use-only` 不可导出，需要新增请求代理服务端，让接收方客户端不接触 secret material。
- 若做跨平台团队协作，再单独设计账号登录、组织、审计、RLS 和计费边界。

测试：

- 同一 contract test 可以跑 PostgreSQL fake adapter 与 HTTP fake adapter。
- 服务端 schema 不包含 secret 明文字段。

## 依赖门禁

1. 引入依赖前必须先有对应失败测试或 adapter skeleton 需要。
2. PostgreSQL 访问只允许在 Go/Wails 后端层，前端不得新增浏览器端 PostgreSQL 客户端。
3. 不引入 ORM；首期 SQL 需要显式事务、CAS、错误码和 per-row result。
4. migration 依赖只负责 schema 初始化和升级，不承载业务逻辑。
5. testcontainers 只能作为可选集成测试依赖；不能让普通 `go test ./...` 必须依赖 Docker。
6. Keychain 依赖或封装必须保证 password / URI 不进入普通配置、日志、截图和 qmd 文档。

## 首轮 DoD

1. Space README、实施计划和技术方案已写入 `docs-linhay/`。
2. 场景模拟文档覆盖账号过期、更新同步、另一台设备拉取、共享接收、撤销和权限降级。
3. 场景模拟文档还必须覆盖 Keychain 丢失、schema 迁移、重复账号、共享乱序、PostgreSQL 部分失败、云端损坏、同步开关关闭后的重新开启，以及三种同步模式。
4. 边界测试矩阵覆盖纯模型、加密、PostgreSQL adapter、同步模式、共享 ACL、前端/Wails 和安全红线。
5. P0 纯模型测试先红后绿。
6. 本地同步账本不会破坏现有 `ListAccounts`、`UpdateCodexAPIKeyConfig`、auth-files 和 openai-compatible provider 流程。
7. PostgreSQL 不可用时本地账号功能不降级。
8. 文档结构通过 `docs-linhay/scripts/check-docs.sh`。
9. 关键决策写入 `docs-linhay/memory/2026-05-25.md` 并执行 `qmd update && qmd embed`。
