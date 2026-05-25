# 账号云端同步与共享场景模拟 v01

日期：2026-05-25

## 参与者与状态

参与者：

- 设备 A：当前机器，用户主要编辑账号。
- 设备 B：同一用户的另一台机器。
- 云端：用户本地配置连接的 PostgreSQL/psql 数据库，保存密文资产和同步元数据。
- 接收方 C：被共享账号或账号组的另一个用户。

核心状态：

- `localSecretRev`：本地 secret 字段版本，例如 API Key、refresh token、session token。
- `cloudSecretRev`：云端密文 secret 字段版本。
- `healthState`：本机运行态诊断，例如 expired、quota error、network error。
- `syncState`：同步态，例如 pending-push、synced、conflict、shared-in、revoked。
- `syncMode`：同步模式，`upload-only`、`download-only` 或 `bidirectional`。

关键规则：

1. `healthState=expired` 不是账号资产本身的云端真相，不能单独上传覆盖云端账号。
2. 用户刷新、替换、重新导入 credential 才是 secret 字段变更，需要生成新的 `localSecretRev` 并进入同步。
3. secret 字段冲突不做 last-write-wins；必须进入冲突队列，由用户选择本机、云端或另存副本。
4. 低风险字段可自动合并，例如备注、标签、禁用意图、分组。
5. Channel Routing 只消费同步后的本地账号快照，不直接访问云端。
6. PostgreSQL 直连模式下，连接密码存 Keychain；数据库只保存密文 payload、最小索引、ACL 和 envelope。
7. `upload-only` 不能静默覆盖远端较新 revision；`download-only` 不能上传本地编辑；`bidirectional` 必须先 pull 再 merge/push。

## 场景 1：设备 A 账号过期，云端没有更新

初始状态：

- 设备 A 与云端同一版本：`localSecretRev=10`，`cloudSecretRev=10`。
- 设备 A 请求 upstream 时返回 token expired。

流程：

1. 设备 A 将本机 `healthState` 标记为 `expired`。
2. 同步扫描发现 secret payload 没有变化，不生成 cloud push。
3. 账号卡展示 `expired / needs refresh`，同步徽标仍可显示 `synced`，但健康态显示异常。
4. 用户需要在设备 A 重新登录或替换 API Key。

预期结果：

- 云端不出现“过期账号覆盖”。
- 设备 B 不会因为 A 的一次过期诊断被强制标记为过期。
- 如果设备 B 自己请求也失败，它会在本机产生自己的 `healthState=expired`。

测试点：

- expired health event 不会创建 `SyncFieldPatch(secret)`。
- expired health event 不会把云端 asset 标为 tombstone 或 disabled。
- UI 同时展示健康异常与同步状态，不能把两者混成一个状态。

## 场景 2：设备 A 账号过期，云端已有设备 B 刷新的新凭据

初始状态：

- 设备 A：`localSecretRev=10`，请求失败，`healthState=expired`。
- 设备 B：已重新登录并推送 `cloudSecretRev=11`。

流程：

1. 设备 A 执行 pull，发现云端 secret revision 更新到 11。
2. 设备 A 解密云端 payload，并把本地 secret 更新到 revision 11。
3. 设备 A 清理旧的 expired 诊断，状态进入 `needs-verify` 或等待下次请求验证。
4. Channel Routing 仍从本地账号快照读取新凭据，不直接访问云端。

预期结果：

- 设备 A 被云端新版本修复，不需要用户手动重复登录。
- 设备 A 的旧 expired 状态不能反向覆盖云端 revision 11。

测试点：

- pull newer secret 后本地 `localSecretRev` 更新。
- 本地 expired health event 的时间晚于云端更新时，仍不能覆盖 newer secret。
- 解密失败时进入 degraded，不删除本地旧账号。

## 场景 3：设备 A 账号过期后用户更新凭据，并同步到云端与设备 B

初始状态：

- 设备 A、B、云端都是 `secretRev=10`。
- 设备 A 发现账号过期。

流程：

1. 用户在设备 A 重新登录或粘贴新的 API Key。
2. 设备 A 生成 `localSecretRev=11`，写入本地账本，状态为 `pending-push`。
3. 设备 A push 到云端，云端保存 encrypted payload 和 `cloudSecretRev=11`。
4. 设备 B pull 到 revision 11，解密并更新本地账号。
5. 设备 B 原本如果也有 expired healthState，应在凭据更新后清除或标记为 `needs-verify`。

预期结果：

- 更新路径为 A 本地 -> 云端密文 -> B 本地。
- B 不需要重新导入账号。
- B 的账号 ID / selection / modal state 不应因为 secret 更新而变化。

测试点：

- `codex-api-key` stable local id 不因 API Key 内容更新而改变。
- B pull 后 `AccountRecord.id` 保持映射稳定。
- 云端 payload 中不出现明文 API Key、token、cookie。

## 场景 4：设备 A 过期并离线编辑，设备 B 在线刷新凭据

初始状态：

- A、B、云端都是 `secretRev=10`。
- A 离线，发现 expired，并编辑备注为“备用账号”。
- B 在线刷新凭据并推送 `secretRev=11`。

流程：

1. A 离线期间只产生备注字段 patch，不产生 secret patch。
2. B push `secretRev=11`。
3. A 恢复网络后先 pull 云端 revision 11，再 push 本地备注 patch。
4. 合并结果为：secret 使用 B 的 revision 11，备注使用 A 的新备注。

预期结果：

- 低风险字段和 secret 更新可合并。
- A 的 expired 诊断不阻塞 B 的修复结果。

测试点：

- field revision merge 保留备注 patch。
- secret revision 采用 newer cloud revision。
- 不生成不必要的 secret conflict。

## 场景 5：设备 A 和设备 B 同时刷新同一账号凭据

初始状态：

- A、B、云端都是 `secretRev=10`。
- A 和 B 在离线或近同时状态下分别重新登录，得到不同 refresh token。

流程：

1. A 生成 `secretRev=11a` 并 push 成功。
2. B 仍基于 `secretRev=10` 生成 `secretRev=11b`，push 时发现云端已是 `11a`。
3. B 收到 secret conflict。
4. UI 展示冲突：保留本机、使用云端、另存为新账号。

预期结果：

- 不使用最后写入覆盖。
- 不自动尝试拼接两个 token。
- 用户可以把 B 的版本另存为一个新账号，避免丢失。

测试点：

- push precondition 检查 base revision。
- conflict payload 不在日志中打印明文 secret。
- 冲突解决后生成新的 revision 或新的 syncID。

## 场景 6：设备 A 删除账号，设备 B 离线更新账号

初始状态：

- A、B、云端都是 `secretRev=10`。
- B 离线编辑 base URL 或模型映射。

流程：

1. A 删除账号并 push tombstone。
2. B 恢复网络后尝试 push 离线编辑。
3. 云端返回 delete-update conflict。
4. UI 默认保持删除，不自动复活账号；用户可以选择恢复为新账号或撤销删除。

预期结果：

- 删除是高风险动作，不被离线编辑静默复活。
- 若选择恢复，必须生成清晰的 revision 记录。

测试点：

- tombstone 优先进入冲突队列。
- 恢复操作有显式用户动作。
- Channel Routing 在 tombstone 生效后不再把账号放入候选池。

## 场景 7：共享账号组给接收方 C，所有者更新凭据

初始状态：

- A 拥有账号组 `team-codex`，包含账号 X。
- A 将该组以 `use-only` 权限共享给 C。
- C 接受共享，获得 shared-in asset 和自己的 envelope。

流程：

1. C 本地可使用账号 X，但不能导出明文 secret。
2. A 发现账号 X 过期并刷新凭据。
3. A push 新 encrypted payload，并为 C 更新 sharing envelope。
4. C pull shared database，解密新版本，账号恢复可用。

预期结果：

- C 不需要重新接受共享。
- C 不拥有原始账号资产，不能写回覆盖 A 的 secret。
- C 的 Channel Routing 只读取本地 shared-in 快照。

测试点：

- shared-in 账号带来源和权限标识。
- `use-only` 不暴露明文导出入口。
- 所有者更新 secret 后接收方可拉到新 envelope。

## 场景 8：共享账号在接收方 C 过期，但所有者 A 还没更新

初始状态：

- C 使用 shared-in 账号请求 upstream，返回 expired。
- A 还没有刷新该账号。

流程：

1. C 本机标记 shared-in 账号 `healthState=expired`。
2. C 不能把 expired 作为资产更新写回 A。
3. C UI 提示“共享账号需要所有者更新”。
4. 如果权限是 `copy` 且 C 已复制为自己的账号，则 C 可以更新自己的副本；原共享资产不变。

预期结果：

- 接收方诊断不污染所有者云端资产。
- shared-in 与 copied account 行为明确分开。

测试点：

- shared-in health event 不生成 owner asset patch。
- use-only 权限下禁用 secret 编辑入口。
- copy 后产生新 `syncID`，与原 shared asset 脱钩。

## 场景 9：所有者撤销共享

初始状态：

- A 共享账号 X 给 C，权限为 `use-only`。
- C 本地有 shared-in 快照。

流程：

1. A 撤销共享并 push share revocation。
2. C 下次同步收到 revoked 状态。
3. C 的 shared-in 账号从可请求候选中移除。
4. C UI 显示“共享已撤销”；如果之前没有 copy 权限或未复制，不继续使用该账号。

预期结果：

- 撤销共享不会删除 C 自己独立复制出来的账号。
- use-only shared-in 账号不再参与路由。

测试点：

- revoked shared asset 不进入 Channel Routing candidates。
- 本地缓存的 decrypted secret 不再用于新请求。
- copied account 不受原 share 撤销影响。

## 场景 10：共享账号组成员变更

初始状态：

- A 共享账号组 `team-codex` 给 C。
- 组内有账号 X、Y。

流程：

1. A 从共享组移除账号 Y。
2. A 新增账号 Z 到共享组。
3. 云端生成 collection membership patch。
4. C pull 后失去 Y 的共享更新，获得 Z 的 envelope。

预期结果：

- 组成员变更与账号 secret 更新分开记录。
- C 对 Y 的本地 copied account 不受影响，但 shared-in Y 不再更新或参与 use-only 路由。

测试点：

- membership patch 不误改账号 payload revision。
- removed shared asset 从 shared-in 列表变为 removed/revoked。
- added shared asset 需要有单独 envelope 才可解密。

## 场景 11：共享权限从 use-only 降级为 read-only

初始状态：

- C 以 `use-only` 权限使用账号 X。

流程：

1. A 将 C 的权限降级为 `read-only`。
2. C pull 后移除可请求能力，只保留非敏感 metadata。
3. C UI 显示权限变更，并将账号从候选池移除。

预期结果：

- 权限降级不能只改变 UI，必须影响路由候选。
- read-only 不应保留可继续发请求的 secret 使用权。

测试点：

- permission downgrade 清理本地 requestable snapshot。
- read-only asset 不生成 credential material。
- 权限变化有同步日志和用户可见提示。

## 场景 12：PostgreSQL 不可用时的本地更新与后续同步

初始状态：

- 云端网络不可用、PostgreSQL 连接失败、认证失败或 schema 暂时不可访问。

流程：

1. 用户在 A 新增或更新账号。
2. 本地写入 sidecar/local store 和 sync ledger。
3. UI 显示 `pending-push`，账号本地可立即使用。
4. 云端恢复后按账本顺序 push。
5. 如果云端期间已被 B 更新，按字段合并或冲突规则处理。

预期结果：

- 云端不可用不阻塞本地账号操作。
- 恢复同步时有清晰结果：synced、merged 或 conflict。

测试点：

- adapter failure 不回滚本地账号编辑。
- pending queue 按 revision 顺序重放。
- 重放时遵守 secret conflict 规则。

## 场景 13：本机 Keychain 丢失或设备密钥不可用

初始状态：

- 设备 A 有本地账号资产和同步账本。
- 用户迁移系统或清理 Keychain 后，`device key` 不可读取。
- 云端仍保存 encrypted payload 和 envelope。

流程：

1. 设备 A 启动同步服务，发现本机无法解密 record key。
2. 设备 A 进入 `degraded` 状态，只允许本地已有明文仍可用的账号继续按本机规则运行。
3. 设备 A 不允许把无法重新加密的 payload 推送云端。
4. UI 提示用户重新授权、重新登录或从另一台可信设备恢复密钥。

预期结果：

- 不因 Keychain 丢失上传空 payload 或未加密 payload。
- 不删除云端资产。
- 不把所有账号误标为过期或 tombstone。

测试点：

- missing device key 阻止 push encrypted payload。
- degraded 状态可见且可恢复。
- 日志不打印 record key、payload 或 secret。

## 场景 14：新版本 schema 迁移后，旧版本设备仍在同步

初始状态：

- 设备 A 升级到 schema v2，新增字段 `sharingPolicy`。
- 设备 B 仍是旧版本，只认识 schema v1。

流程：

1. A push schema v2 asset。
2. B pull 到 v2 asset，识别 schema version 高于本机能力。
3. B 保留本地旧版本可用状态，但不覆盖云端 v2 payload。
4. B UI 显示需要升级客户端才能处理新字段。

预期结果：

- 旧客户端不能把未知字段丢弃后重新 push 成 v1，导致云端数据降级。
- 本地可用性与同步写入能力分开。

测试点：

- unknown newer schema 进入 read-only sync degraded。
- 旧客户端 push 时必须带 schema precondition，不能覆盖 v2。
- 升级后能继续从 v2 恢复。

## 场景 15：同一个 API Key 在两台设备上被独立新增

初始状态：

- A 离线新增 API Key 账号 X。
- B 离线也新增同一个 API Key，但备注、名称或 base URL 轻微不同。

流程：

1. A 恢复网络并 push，新建 `syncID=a1`。
2. B 恢复网络并尝试 push，新建候选 `syncID=b1`。
3. 云端或本地 duplicate detector 根据 normalized identity 识别同一资产。
4. 系统进入 duplicate merge 提示，而不是保留两个完全相同的可请求账号。

预期结果：

- `codex-api-key` 的本地 stable id 继续稳定，但云端同步需要额外 duplicate resolution。
- 备注等低风险字段可以合并；secret 同值时不产生 secret conflict。

测试点：

- duplicate detection 使用 normalized config identity，不使用展示名。
- duplicate merge 后只保留一个云端 active asset。
- 两台设备的本地 `AccountRecord.id` 可以映射到同一 `syncID`。

## 场景 16：auth-file 被重命名或本地文件名变化

初始状态：

- 云端资产 X 映射到 `auth-file:auth.json`。
- 用户在 A 将本地文件重命名为 `auth-file:work.json`，内容未变。

流程：

1. A 扫描发现同一账号身份但 `localAssetKey` 变化。
2. A 更新本地 mapping，不生成新的云端账号资产。
3. B pull 后保持自己的本地文件名或按策略提示是否重命名。

预期结果：

- 文件名不是云端唯一身份。
- 重命名不应复制一份账号，也不应删除原云端资产。

测试点：

- identity hash / account identity 能识别重命名。
- localAssetKey mapping 更新不会改变 `syncID`。
- B 不被强制改文件名，除非用户确认。

## 场景 17：模型映射与 base URL 同时被不同设备修改

初始状态：

- A 修改 openai-compatible provider 的 base URL。
- B 修改同一 provider 的模型映射。

流程：

1. A push base URL field revision。
2. B push model mappings field revision。
3. 同步层判断两个字段不同，可以合并。
4. 合并后触发本地 `needs-verify`，因为 base URL 变化可能影响模型映射有效性。

预期结果：

- 不因不同字段编辑产生整条 provider 冲突。
- 合并后需要提示用户重新测试 provider，而不是静默认为可用。

测试点：

- base URL 和 models 使用不同 field path revision。
- 合并后 `healthState=needs-verify`。
- 如果两边都改 base URL，则进入条件冲突。

## 场景 18：禁用意图与云端 secret 更新同时发生

初始状态：

- A 手动禁用账号 X。
- B 刷新账号 X 的 secret 并推送。

流程：

1. A push `disabled=true`。
2. B push `secretRev=11`。
3. 合并后账号 X 仍保持禁用，但 secret 已更新。
4. Channel Routing 不把 X 放入候选池，直到用户显式启用。

预期结果：

- 手动禁用是用户意图，不应被 secret 更新清除。
- secret 更新可以为未来启用做好准备。

测试点：

- disabled field 与 secret field 可合并。
- enabled/disabled 不从 healthState 推断。
- Routing candidates 尊重 manual disabled。

## 场景 19：共享接收方复制账号后，所有者继续更新原共享账号

初始状态：

- C 对 shared-in 账号 X 执行 `copy`，得到自己的账号 Y。
- A 继续更新原账号 X。

流程：

1. A push X 的 secretRev=12。
2. C pull shared database，shared-in X 更新。
3. C 自己的 copied Y 不跟随更新。
4. UI 同时显示 shared-in X 与 owned Y 的来源差异。

预期结果：

- copy 是脱钩操作，不能继续被原共享账号覆盖。
- 用户可以自行删除 shared-in X 或 copied Y。

测试点：

- copied account 使用新 `syncID` 和 ownerScope=private。
- shared-in X 更新不改变 copied Y。
- 列表去重不能把 shared-in X 和 copied Y 错合并。

## 场景 20：权限从 read-only 升级为 use-only

初始状态：

- C 只有 read-only 权限，能看非敏感 metadata，不能请求。

流程：

1. A 将 C 权限升级为 `use-only`。
2. 云端为 C 生成新的 sharing envelope。
3. C pull 后获得可解密 secret material。
4. C 的本地候选池在下一轮路由快照中加入该账号。

预期结果：

- 权限升级需要 envelope，不只是权限字段变化。
- 没有 envelope 时不能进入 requestable。

测试点：

- permission upgrade without envelope 仍不可请求。
- envelope 到达后 requestable snapshot 才更新。
- UI 显示权限从 read-only 到 use-only 的变化。

## 场景 21：接收方离线期间共享被撤销又重新授予

初始状态：

- C 离线。
- A 先撤销 X 的共享，又重新授予 X 的 use-only 权限。

流程：

1. C 恢复网络后 pull 到一串 shared changes。
2. 同步层按 change token 顺序应用 revoke 和 grant。
3. 最终状态以最新 grant 为准，但本地必须清理旧 envelope 后使用新 envelope。

预期结果：

- 不因为中途 revoke 永久卡死。
- 不复用已撤销的旧 envelope。

测试点：

- shared change replay 保序。
- revoke 清理旧 requestable snapshot。
- grant 使用新 envelope 恢复。

## 场景 22：PostgreSQL 批量上传部分成功、部分失败

初始状态：

- A 有 30 个 pending account patches。
- PostgreSQL batch 写入时，前 20 条成功，后 10 条因唯一约束、权限或 statement timeout 失败。

流程：

1. adapter 返回 per-row result。
2. 成功记录标记为 synced。
3. 失败记录保留 pending，并记录 retryAfter。
4. UI 展示部分同步成功和剩余 pending 数量。

预期结果：

- batch 不是全有或全无。
- 失败记录不会丢失，也不会重复生成新 patch。

测试点：

- per-row retry state。
- 幂等 push 防止重复创建。
- retryAfter 生效，不做紧密重试。

## 场景 23：云端记录损坏或解密失败

初始状态：

- 云端某条 encrypted payload 损坏，或 envelope 与 payload 不匹配。

流程：

1. A pull 到损坏记录。
2. 解密失败，生成 `corrupt-remote` sync issue。
3. A 保留本地最后一个可用版本，不覆盖本地。
4. 用户可选择从本机重新上传修复云端，或忽略该云端版本。

预期结果：

- 解密失败不应删除本地账号。
- 不应把损坏 payload 标记为有效更新。

测试点：

- decrypt failure 保留 local usable snapshot。
- repair push 需要用户确认。
- corrupt issue 不泄漏密文内容。

## 场景 24：设备时间不一致导致 updatedAt 逆序

初始状态：

- A 系统时间快 10 分钟。
- B 系统时间正常。
- 两边编辑不同字段。

流程：

1. A 和 B 分别生成 field revision。
2. 合并时使用 logicalClock / serverChangeToken / base revision，而不是只看设备 `updatedAt`。
3. UI 可以显示本机时间异常提示，但合并不被错误时间影响。

预期结果：

- 不因本机时间漂移导致错误覆盖。
- `updatedAt` 只用于展示和辅助排序，不作为唯一冲突裁决依据。

测试点：

- logicalClock 优先于 wall clock。
- server ack 后校准 remote order。
- 时间异常有诊断但不阻塞本地使用。

## 场景 25：用户解决冲突时选择“另存为新账号”

初始状态：

- A 和 B 同时刷新 secret，形成冲突。
- 用户在 A 的冲突 modal 选择另存为新账号。

流程：

1. 原账号保留云端版本或用户指定版本。
2. 本机冲突版本创建新账号，生成新 `syncID`。
3. 新账号默认 local-only 或 pending-push，由用户选择是否同步。
4. Channel Routing 不自动把新账号插入原渠道顺序，除非用户显式配置。

预期结果：

- 另存副本不会悄悄改变原账号。
- 新账号不会突然影响现有请求流量。

测试点：

- duplicate-as-new 生成新 syncID。
- 原 conflict 标记 resolved。
- Channel Routing 不自动改 orderedAccountIDs。

## 场景 26：接收同一个账号的多个共享来源

初始状态：

- C 从 A 和 D 两个所有者分别收到同名账号或同 provider 账号。

流程：

1. C 接受两个 share。
2. 同步层按 share owner + asset syncID 区分来源。
3. UI 显示两个 shared-in 账号来源，不按名称强制去重。

预期结果：

- shared-in 去重不能只看 display name 或 provider。
- 如果用户想合并或复制，需要显式操作。

测试点：

- owner identity 是 shared asset key 的一部分。
- 同名 shared accounts 可共存。
- routing candidates 能显示来源，避免误用。

## 场景 27：账号组同步和账号资产同步乱序到达

初始状态：

- A 新建账号 Z，并把 Z 加入组 G。
- 云端变更在 B 上乱序到达：先收到 group membership，再收到账号 Z。

流程：

1. B 收到 membership patch，发现账号 Z 本地暂不存在。
2. B 创建 unresolved membership placeholder。
3. B 后续收到账号 Z asset 后补齐关系。
4. 若长时间未收到账号 Z，UI 显示组内存在待同步成员。

预期结果：

- 乱序不导致 membership 丢失。
- 不创建空账号或错误 tombstone。

测试点：

- unresolved membership 可持久化。
- asset 到达后自动 resolve。
- 超时提示不会阻塞其他组成员。

## 场景 28：账号同步开关关闭后的本地编辑

初始状态：

- 用户在 A 关闭账号云端同步。
- 云端仍有上次同步版本。

流程：

1. A 本地继续编辑账号。
2. 编辑不进入 pending push，或者按用户选择进入 paused queue。
3. 用户重新开启同步时，系统先展示差异摘要。
4. 用户确认后才 push 或 pull 合并。

预期结果：

- 关闭同步不是删除云端资产。
- 重新开启同步不能静默覆盖云端或本地。

测试点：

- sync disabled 下不自动 push。
- re-enable 显示 local-vs-cloud diff。
- 用户选择 pull/merge/push 后才执行。

## 场景 29：用户配置 PostgreSQL 连接并测试

初始状态：

- 用户在设置页填入 host、port、database、schema、user、password、SSL mode。
- 本机尚未建立同步 profile。

流程：

1. 用户点击测试连接。
2. adapter 连接 PostgreSQL，验证 TLS、schema version、必需表、最小权限。
3. 连接成功后，password / URI 写入 Keychain，普通配置只保存脱敏 profile。
4. UI 展示连接摘要和当前 sync mode。

预期结果：

- 测试连接不读取或输出 secret payload。
- password 不进入普通配置文件、日志、qmd 文档或截图。
- schema 缺失时提示初始化或迁移，而不是开始同步。

测试点：

- connection profile redaction。
- missing schema / permission denied / TLS failure 都有可理解错误。
- test connection 不修改账号资产。

## 场景 30：upload-only 模式下本机推送备份

初始状态：

- A 设置 `syncMode=upload-only`。
- A 有本地账号变更。
- 云端对应 asset revision 与 A 的 base revision 一致。

流程：

1. A 只读取远端 base revision 和 schema version。
2. A 将本地 pending patches push 到 PostgreSQL。
3. A 不拉取其他设备新增账号。

预期结果：

- 本机是发布源，适合主设备备份。
- 不把云端其他账号拉入本机。

测试点：

- upload-only 不执行 full pull。
- push 仍带 base revision precondition。
- 成功后 pending queue 清空。

## 场景 31：upload-only 遇到云端较新版本

初始状态：

- A 设置 `syncMode=upload-only`。
- A 基于 revision 10 编辑账号。
- 云端已经是 revision 11。

流程：

1. A push 前读取远端 base revision。
2. adapter 发现云端较新，拒绝静默覆盖。
3. UI 提示：远端较新，可切换双向合并、强制覆盖或取消。

预期结果：

- upload-only 不是无条件覆盖。
- secret 字段默认不允许强制覆盖，除非用户在冲突 UI 中确认。

测试点：

- remote-newer 阻止 silent overwrite。
- 强制覆盖需要显式用户动作和审计记录。
- secret 冲突仍进入冲突队列。

## 场景 32：download-only 模式下只拉取云端

初始状态：

- B 设置 `syncMode=download-only`。
- 云端有新账号和更新。
- B 本地也有编辑草稿。

流程：

1. B pull 云端变更并更新本地账号快照。
2. B 的本地编辑草稿标记为 `local-only` 或 `paused`。
3. B 不向 PostgreSQL push 本地 patch。

预期结果：

- B 适合作为只读工作机或新设备初始化。
- 本地编辑不会意外污染云端。

测试点：

- download-only 禁止 push queue flush。
- local-only 编辑有清晰提示。
- 切换到 bidirectional 前必须展示 diff。

## 场景 33：bidirectional 模式下 pull-merge-push

初始状态：

- A 设置 `syncMode=bidirectional`。
- A 修改备注。
- 云端由 B 更新了 secret。

流程：

1. A 先 pull 云端 secret revision。
2. A 合并备注字段和云端 secret。
3. A push 合并后的备注 patch。
4. A 本地账号状态变为 synced 或 needs-verify。

预期结果：

- 双向同步必须先 pull 再 push。
- 低风险字段自动合并，高风险字段冲突进入队列。

测试点：

- bidirectional 顺序为 pull -> merge/conflict -> push。
- 不先 push 本地旧 base revision。
- 合并结果可解释。

## 场景 34：PostgreSQL 连接切换到另一个库

初始状态：

- 用户从生产库切换到另一个 PostgreSQL 数据库或 schema。
- 本地已有旧云端的 sync cursor 和 `syncID` 映射。

流程：

1. 用户保存新连接 profile。
2. 系统检测 remote instance id 与原库不同。
3. UI 提示这是新同步空间，需要选择：初始化上传、只拉取、保持本地 local-only。
4. 未确认前不复用旧 cursor。

预期结果：

- 不把旧库 cursor 用到新库。
- 不把生产账号误推到测试库，除非用户确认。

测试点：

- remote instance id 变化清空 cursor 或创建新 profile。
- 连接 profile 与 sync ledger 绑定。
- 切库需要显式确认。

## 必须补进实现的模拟测试集合

后端纯模型：

- expired health 不生成 cloud asset patch。
- newer cloud secret 修复本地 expired account。
- local note patch + remote secret patch 自动合并。
- concurrent secret refresh 进入 conflict。
- delete tombstone + offline edit 进入 conflict。
- revoked shared-in asset 不进入 candidates。
- missing device key 进入 degraded 且阻止未加密上传。
- duplicate API Key 新增进入 duplicate resolution。
- schema newer-than-client 不被旧客户端降级覆盖。
- logicalClock / base revision 优先于设备 wall clock。
- upload-only remote-newer 阻止静默覆盖。
- download-only 本地编辑不进入 push queue。
- bidirectional 固定 pull-merge-push 顺序。

前端/交互：

- 账号卡同时展示健康态和同步态。
- 冲突 modal 支持本机、云端、另存副本。
- shared-in 账号展示来源、权限、撤销状态。
- use-only / read-only / copy 三种权限对应不同操作入口。
- Keychain 丢失、云端损坏、PostgreSQL 部分失败都有可理解状态。
- 重新开启同步时展示 local-vs-cloud 差异摘要。
- PostgreSQL 连接 profile 脱敏展示，测试连接不泄漏 password。
- 切换 sync mode 和切换数据库 profile 都需要展示影响说明。

adapter contract：

- push 使用 base revision precondition。
- pull 能返回 private changes 与 shared changes。
- sharing envelope 更新后接收方可解密新版本。
- revoke 后接收方不再获得 secret material。
- per-row retry 能处理部分成功、部分失败。
- shared change replay 保序，revoke 后再 grant 使用新 envelope。
- PostgreSQL schema version / remote instance id / per-row result 是 adapter contract 的一部分。
