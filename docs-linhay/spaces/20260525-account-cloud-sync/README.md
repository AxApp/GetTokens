# 账号云端同步与共享

## 背景
- 当前账号资产分散在本机 sidecar auth-files、本地 Codex API Key store、openai-compatible provider 配置和渠道路由配置中。多设备使用 GetTokens 时，用户需要重复导入账号、重复配置模型映射和配额探测参数。
- 账号资产包含高敏感凭据，不能按普通配置文件直接上云；云端数据库只能保存端到端加密后的账号内容、同步元数据和必要的非敏感索引。
- 近期账号领域已形成 `Account Inventory / Channel Routing / Routing Engine` 三层边界。本期只规划账号资产云端同步与共享，不能把渠道路由顺序、实时 quota、请求事件等运行态误归入全局同步资产。
- 用户明确云端为可本地直接配置连接的 PostgreSQL/psql 数据库；本 space 以 `PsqlAccountSyncAdapter` 为默认实现方向，不再以 CloudKit 为首期默认。
- 同步模式需要可选：单向只上传、单向只拉取、双向同步。不同模式下的本地编辑、云端变更、冲突处理和共享可见性必须有明确语义。

## 目标
1. 设计账号资产上云端数据库后的数据模型、同步协议、更新策略、共享机制和冲突合并规则。
2. 支持同一用户多设备间同步账号新增、编辑、删除、禁用、模型映射、quota curl、billing curl、proxy、备注和分组等可迁移配置。
3. 支持用户将部分账号或账号组共享给同一 PostgreSQL 同步空间内的其他数据库身份 / 团队成员，接收方可按权限使用或复制到自己的账号库。
4. 云端数据库不保存明文 token、API Key、refresh token、cookie、quota curl 中的敏感 header；所有 secret 字段必须端到端加密。
5. 冲突合并以“字段级可自动合并 + 高风险字段显式确认”为原则，保留冲突证据和可回滚版本。
6. 以用户配置的 PostgreSQL 连接作为默认云端数据库，支持 host/port/database/schema/user/password/SSL 参数配置与连接测试。
7. 支持同步模式选择：
   - `upload-only`：本机到云端，只上传本机变更，适合备份或主设备发布。
   - `download-only`：云端到本机，只拉取云端变更，适合只读工作机或新设备初始化。
   - `bidirectional`：双向拉取、合并、冲突处理再上传。

## 范围
- 账号云端同步的产品边界、BDD 场景、技术阶段和测试门禁。
- 账号资产同步模型：
  - `auth-file` 派生账号。
  - `codex-api-key` 本地账号。
  - `openai-compatible` provider 及其模型映射。
  - 账号组、标签、备注、禁用意图和可迁移的探测配置。
- 本地同步账本：
  - stable `syncID`。
  - `assetKey` 到现有 `AccountRecord.id` 的映射。
  - per-field revision。
  - tombstone。
  - device identity。
  - sync cursor。
- 云端数据库 adapter：
  - 默认实现：PostgreSQL / psql direct connection。
  - 连接配置：host、port、database、schema、table prefix、user、password、SSL mode、connect timeout。
  - 抽象接口：pull changes、push batch、resolve conflict、share、unshare、accept share、test connection、migrate schema。
- 同步策略：
  - 单向只上传。
  - 单向只拉取。
  - 双向同步。
  - 每个策略都必须明确 pending queue、冲突队列、删除 tombstone 和共享权限处理。
- 端到端加密：
  - 本机密钥材料存入 Keychain。
  - 云端只存密文 payload、非敏感索引和加密 envelope。
  - 共享时按接收方 envelope 发放 record key。
- 前端账号页和同步设置页的状态展示、冲突处理入口和共享确认流程。

## 非目标
- 不在本期把实时 quota、billing 结果、usage attribution、rate-limit ledger、live sessions 或 route events 同步到云端。
- 不把 Codex / Claude 渠道请求顺序、route mode、项目绑定等 Channel Routing 配置作为账号资产强行同步；如后续需要渠道配置同步，应单独建 space。
- 不通过云端数据库执行真实请求代理；云端只做配置同步与共享，不参与模型调用热路径。
- 不支持明文导出共享链接、公共可访问账号库或无需接收方身份的匿名共享。
- 不在第一阶段提供中心化服务端账号系统；PostgreSQL 由用户自行配置连接、权限和可达性。
- 不承诺在直连 PostgreSQL 模式下实现密码学强保证的 `use-only`。一旦接收方客户端可解密 secret，就只能依赖客户端策略、数据库 ACL、审计和本地导出限制；如需强制不可导出，必须另设请求代理服务端。
- 不自动解决所有 secret 冲突。API Key、refresh token、cookie、base URL 等高风险字段冲突必须保留版本并让用户确认。

## 验收标准
1. Given 用户在设备 A 新增一个 Codex API Key 账号，When 同步完成并在设备 B 打开账号页，Then 设备 B 显示同一个 stable `syncID` 的账号，且 secret 字段只在本地解密后可用。
2. Given 用户在设备 A 修改账号备注，设备 B 修改同一账号的禁用状态，When 两边完成同步，Then 两个字段自动合并，账号备注与禁用状态都被保留。
3. Given 两台设备同时修改同一账号的 API Key 或 refresh token，When 同步发生冲突，Then 系统不静默覆盖 secret，冲突进入待处理列表，用户可选择保留本机版本、云端版本或另存副本。
4. Given 用户在设备 A 删除账号，设备 B 离线期间仍编辑该账号，When 设备 B 恢复同步，Then tombstone 与本地编辑产生删除冲突，默认不复活账号，必须由用户确认恢复或保留删除。
5. Given 用户共享一个账号组给接收方，When 接收方接受共享，Then 接收方只获得该组内被授权的账号密文 envelope，并能看到共享来源、权限和最后同步时间。
6. Given 共享方撤销共享，When 接收方下一次同步，Then 接收方不再获得新的云端更新；本地是否保留已复制账号按共享策略展示并确认。
7. Given 云端数据库不可用或网络离线，When 用户在本地新增/编辑/删除账号，Then 操作写入本地同步账本并标记 pending，不阻塞本地使用。
8. Given sidecar 未 ready，When 同步服务启动，Then 只加载本地同步账本和云端 cursor，不主动读取 sidecar 账号详情，等 ready 后再做账号资产快照。
9. Given 普通浏览器 preview 打开同步设置页，When 缺少 Wails runtime / PostgreSQL 连接能力，Then 页面展示 preview 数据和不可提交的模拟冲突，不调用真实云端接口。
10. Given 账号资产同步完成，When 用户查看账号详情，Then 页面能明确展示来源：local-only、syncing、synced、conflict、shared-in、shared-out。
11. Given 账号启用/禁用状态被同步，When Channel Routing 工作台计算候选账号，Then 仍以本地账号快照为输入，不直接访问云端数据库。
12. Given 设备 A 只检测到账号过期但没有刷新 credential，When 执行云端同步，Then 只更新本机健康态，不把 expired 作为云端资产变更推送，也不覆盖设备 B 或共享接收方的账号。
13. Given 设备 A 账号过期且云端已有设备 B 刷新的新 credential，When 设备 A pull 云端变更，Then 设备 A 采用云端较新的 secret revision，并清理本机过期诊断到待验证状态。
14. Given 共享接收方 C 使用 shared-in 账号时检测到过期，When C 没有写权限，Then C 不能覆盖所有者账号，只能提示等待所有者更新或在 copy 权限下另存为自己的账号。
15. Given 本机 Keychain 丢失或 device key 不可用，When 同步服务启动，Then 系统进入 degraded 状态，禁止上传未加密 payload，且不删除云端或本地账号。
16. Given 同一个 API Key 在两台设备离线期间被分别新增，When 双方恢复同步，Then 系统识别 duplicate identity，提示合并或另存，而不是生成两个默认可请求账号。
17. Given 旧版本客户端拉到高版本 schema 的云端资产，When 它无法理解新增字段，Then 只能进入只读/降级同步态，不得把未知字段丢弃后覆盖云端。
18. Given PostgreSQL batch 上传部分成功、部分失败，When adapter 返回 per-row result，Then 成功记录标记 synced，失败记录保留 pending 并按 retryAfter 重试。
19. Given 用户关闭账号同步后继续本地编辑，When 重新开启同步，Then 先展示 local-vs-cloud 差异摘要，用户确认后才 pull、merge 或 push。
20. Given 用户将同步模式设置为 `upload-only`，When 云端已有较新 secret revision，Then 本机不能静默覆盖云端，必须提示远端较新并要求确认覆盖或切换双向合并。
21. Given 用户将同步模式设置为 `download-only`，When 本机发生账号编辑，Then 编辑保持 local-only/paused，不推送云端，且 UI 明确提示当前模式不会上传。
22. Given 用户将同步模式设置为 `bidirectional`，When 本机与云端都有变更，Then 先 pull、按字段合并或进入冲突队列，再 push 合并后的安全 patch。
23. Given 用户配置 PostgreSQL 连接，When 点击测试连接，Then 系统验证网络、TLS、schema 版本、必需表和最小权限，不读取或输出任何 secret。
24. Given 运行 `check-docs.sh`，When space 文档结构校验，Then `README.md`、`plans/`、`screenshots/`、`debate/` 均满足项目治理规则。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260525-account-cloud-sync`
- worktree：`../GetTokens-worktrees/20260525-account-cloud-sync/`

## 相关链接
- 技术方案：`../../dev/20260525-account-cloud-sync-architecture.md`
- 实施计划：`./plans/implementation-plan-v01.md`
- 场景模拟：`./plans/scenario-simulation-v01.md`
- 边界测试矩阵：`./plans/boundary-test-matrix-v01.md`
- 依赖规划：见 `../../dev/20260525-account-cloud-sync-architecture.md#依赖规划`
- 账号领域规则：`../../../.agents/skills/gettokens-domain-engineering/SKILL.md`
- 流程治理规则：`../../../.agents/skills/gettokens-ops-governance/SKILL.md`

## 当前状态
- 状态：draft
- 最近更新：2026-05-25
