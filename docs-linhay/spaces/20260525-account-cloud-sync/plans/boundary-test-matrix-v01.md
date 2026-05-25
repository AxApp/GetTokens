# 账号云端同步边界测试矩阵 v01

日期：2026-05-25

## 测试分层

1. 纯模型层：不连接 PostgreSQL，不读真实账号文件，只验证同步账本、revision、merge、conflict、tombstone。
2. 加密层：验证 payload / envelope / Keychain 边界，不允许 secret 明文进入云端结构、日志或测试快照。
3. PostgreSQL adapter 层：用 test container 或 fake pg driver 验证 SQL schema、事务、cursor、per-row result、权限错误。
4. Wails / 业务服务层：验证连接 profile、同步模式、sidecar ready、账号快照加载和错误映射。
5. 前端交互层：验证设置页、账号卡状态、冲突 modal、共享权限入口和 preview。
6. 安全回归层：专门扫描日志、错误、截图、qmd 文档和测试 fixture 是否泄漏 secret。

## P0 纯模型边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| M-001 | stable syncID | 同一 `auth-file:<name>` 被重复扫描 | 构建同步快照 | `syncID` 不变，不生成重复 asset |
| M-002 | API Key stable id | `codex-api-key` 修改 apiKey/baseUrl/prefix | 重新扫描 | `AccountRecord.id` 与 `syncID` 映射保持稳定；duplicate 检测仍按 normalized identity |
| M-003 | expired 不是 patch | 本机请求返回 expired | 同步扫描 | 只生成 health event，不生成 asset patch |
| M-004 | 字段级自动合并 | A 改备注，B 改禁用意图 | merge | 两个字段都保留，无冲突 |
| M-005 | secret 并发冲突 | A/B 基于同一 revision 刷新不同 token | merge | 生成 `secret-conflict`，不自动覆盖 |
| M-006 | 删除 vs 离线编辑 | A tombstone，B 离线改模型映射 | merge | 生成 `delete-update` 冲突，默认保留 tombstone |
| M-007 | schema 较新 | remote schema v3，本机只支持 v2 | merge | 进入 read-only/degraded，不允许降级覆盖 |
| M-008 | 时间漂移 | A wall clock 快 10 分钟 | merge | 使用 logical clock / base revision，不用 `updatedAt` 单独裁决 |
| M-009 | duplicate API Key | 两设备离线新增同一 API Key | resolve duplicate | 进入 duplicate resolution，不默认生成两个可请求账号 |
| M-010 | auth-file 重命名 | `auth.json` 改名为 `work.json`，内容身份未变 | 扫描 | 更新 localAssetKey 映射，不新建云端 asset |
| M-011 | 账号组乱序 | membership 先于 asset 到达 | apply changes | 创建 unresolved membership，asset 到达后 resolve |
| M-012 | 另存副本 | secret conflict 选择另存为新账号 | resolve | 生成新 `syncID`，原 conflict 标记 resolved |

## P1 加密与 Keychain 边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| C-001 | secret 不入云端明文 | payload 含 API Key/token/cookie | serialize cloud row | `encryptedPayload` 外不出现 secret 子串 |
| C-002 | 日志脱敏 | push/pull 失败 | 记录错误 | 日志不含 password、URI password、API Key、Authorization、Cookie |
| C-003 | Keychain 丢失 | device key 不可读取 | 启动 sync | 进入 degraded，禁止上传未加密 payload |
| C-004 | envelope 不匹配 | record key envelope 无法解密 | pull | 记录 decrypt issue，保留本地最后可用版本 |
| C-005 | 共享 envelope 更新 | owner 刷新 secret | recipient pull | recipient 使用新 envelope 解密新版本 |
| C-006 | read-only 无 envelope | recipient 权限 read-only | pull shared asset | 只能看 public index，不生成 credential material |
| C-007 | use-only 风险提示 | recipient 权限 use-only | 展示权限说明 | UI 明确“客户端可用不等于密码学不可导出” |

## P2 PostgreSQL Adapter 边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| PG-001 | 连接 profile 脱敏 | 用户输入 connection URI | 保存 | password/URI secret 存 Keychain，配置只保留脱敏摘要 |
| PG-002 | 测试连接只读 | 用户点击测试连接 | adapter 检查 schema | 不读取 encrypted payload，不写账号数据 |
| PG-003 | schema 缺失 | 数据库无 `gettokens_sync` schema | test connection | 返回 `schema-missing`，不自动同步 |
| PG-004 | 权限不足 | DB 用户无写权限 | push | 返回 permission error，pending queue 保留 |
| PG-005 | TLS 不满足 | sslmode 不符合策略 | connect | 拒绝连接并提示 SSL 配置 |
| PG-006 | remote instance 切换 | profile 指向另一个库 | load cursor | 不复用旧 cursor，要求用户确认初始化方式 |
| PG-007 | base revision CAS | remote revision 已变化 | push old patch | 拒绝静默覆盖，返回 `remote-newer` |
| PG-008 | per-row result | batch 30 条，10 条失败 | push batch | 20 条 synced，10 条 pending，失败原因逐条可见 |
| PG-009 | 事务一致性 | ACL 与 envelope 同批写入 | 其中 envelope 失败 | ACL 不应单独提交为可用共享 |
| PG-010 | cursor 幂等 | pull 同一 cursor 重试 | apply changes | 不重复创建 asset 或 conflict |
| PG-011 | statement timeout | SQL 超时 | push/pull | 返回 retryable 状态，不清 pending |
| PG-012 | migration 失败回滚 | schema migration 中途失败 | migrate | schema_version 不前进，旧数据可继续读取 |
| PG-013 | advisory lock | 两个客户端同时迁移 schema | migrate | 只有一个迁移执行，另一个等待或返回 busy |
| PG-014 | driver error mapping | pgx 返回唯一约束、权限、连接、timeout 错误 | adapter 映射错误 | 转成稳定业务错误码，不暴露 DSN / password |
| PG-015 | migration idempotency | migration 已执行过 | 再次 migrate | 不重复建表，不破坏已有数据 |
| PG-016 | no ORM dependency | adapter 实现访问数据库 | dependency scan | 不引入 GORM/ent/sqlboiler |

## P3 同步模式边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| S-001 | upload-only 正常备份 | local pending，remote base 一致 | sync | 只 push，不 full pull |
| S-002 | upload-only 遇到远端较新 | remote revision 更高 | sync | 阻止静默覆盖，提示切换双向或显式覆盖 |
| S-003 | upload-only tombstone | local 删除，remote 有更新 | sync | 生成 remote-newer/delete conflict，不直接删除远端 |
| S-004 | download-only 初始化 | remote 有资产，local 空 | sync | 只拉取，生成本地快照 |
| S-005 | download-only 本地编辑 | local 修改账号 | sync | 标记 local-only/paused，不 push |
| S-006 | download-only 远端 tombstone | remote 删除 | sync | 本地 shared/synced 账号移除候选或标记删除 |
| S-007 | bidirectional 顺序 | local/remote 都有变更 | sync | 固定 pull -> merge/conflict -> push |
| S-008 | 模式切换 upload -> bidirectional | upload-only 下积累 pending | 切换模式 | 先展示 local-vs-cloud diff |
| S-009 | 模式切换 download -> upload | local-only 草稿存在 | 切换模式 | 需要用户确认上传哪些草稿 |
| S-010 | sync disabled | 用户关闭同步 | 本地编辑 | 不进入 active push queue；可选 paused queue |

## P4 共享 ACL 边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| A-001 | read-only | recipient 只读权限 | pull shared asset | 无 secret envelope，不进入可请求候选 |
| A-002 | use-only | recipient use-only | pull shared asset | 可本机请求，隐藏导出入口并记录审计 |
| A-003 | copy | recipient 复制账号 | copy | 生成 private `syncID`，与原 shared asset 脱钩 |
| A-004 | 撤销共享 | owner revoke | recipient sync | shared-in 不再进入候选，旧 envelope 作废 |
| A-005 | 撤销后重授予 | recipient 离线，owner revoke 再 grant | replay changes | 按顺序清旧 envelope，再使用新 envelope |
| A-006 | 权限降级 | use-only -> read-only | sync | 清理 requestable snapshot，不保留可用 secret |
| A-007 | 权限升级 | read-only -> use-only | sync | 只有 envelope 到达后才 requestable |
| A-008 | 多来源同名共享 | A/D 共享同名账号给 C | pull | 以 owner + syncID 区分，可共存 |
| A-009 | 组成员移除 | owner 从共享组移除账号 | recipient sync | shared-in 账号不再更新或参与 use-only 路由 |
| A-010 | 接收方过期诊断 | C 请求 shared-in expired | health update | 不写回 owner asset，只产生本机 healthState |

## P5 前端与 Wails 边界

| ID | 场景 | Given | When | Then |
| --- | --- | --- | --- | --- |
| UI-001 | 连接配置表单 | 用户填 PostgreSQL profile | 保存 | password 不回显，摘要脱敏 |
| UI-002 | 测试连接错误 | schema/权限/TLS 错误 | test connection | 错误可理解，不泄漏 DSN |
| UI-003 | 同步模式切换 | 切换 mode | 展示确认 | 文案说明 upload/download/bidirectional 影响 |
| UI-004 | 状态徽标 | 账号 synced + expired | 渲染账号卡 | 同时显示 syncState 与 healthState |
| UI-005 | 冲突 modal | secret conflict | 打开 modal | 支持本机、云端、另存副本，默认不选危险覆盖 |
| UI-006 | shared-in 权限 | read-only/use-only/copy | 渲染详情 | 操作入口按权限显示/禁用 |
| UI-007 | browser preview | 无 Wails runtime | 打开设置页 | 使用 mock profile 和 mock conflict，不连真实 PostgreSQL |
| UI-008 | sidecar 未 ready | App 启动 | sync service init | 不读取账号详情，不触发云端误删 |
| UI-009 | qmd / screenshot 安全 | 生成文档和截图 | 检查 artifact | 不包含 password、API Key、token、cookie |

## P6 安全红线

这些测试失败时不能进入实现下一阶段：

1. 任意云端 row、日志、错误对象、截图、qmd 文档出现明文 API Key、refresh token、access token、cookie、Authorization、PostgreSQL password。
2. 任意 sync mode 在未确认情况下覆盖远端较新 secret。
3. `download-only` 模式把本地编辑推送到 PostgreSQL。
4. `upload-only` 模式在未检查 remote base revision 时上传。
5. Keychain 缺失时上传空 payload、未加密 payload 或 tombstone。
6. 旧 schema 客户端丢弃未知字段并覆盖新 schema 云端资产。
7. shared-in revoked / read-only 账号进入 Channel Routing 候选池。
8. PostgreSQL profile 切换后复用旧库 cursor。
9. 前端直接连接 PostgreSQL 或保存 PostgreSQL password。
10. 普通单测必须依赖 Docker 才能通过。

## 首轮自动化建议

首批先实现以下最小红灯集合：

- `M-003` expired 不生成 patch。
- `M-005` secret 并发冲突。
- `C-001` secret 不入云端明文。
- `PG-007` base revision CAS。
- `PG-014` driver error mapping。
- `S-001` upload-only 正常备份。
- `S-002` upload-only remote-newer 阻止覆盖。
- `S-005` download-only 本地编辑不 push。
- `S-007` bidirectional pull-merge-push。
- `A-001` read-only 无 envelope。
- `UI-001` connection profile 脱敏。
