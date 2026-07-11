# Wise Council Verdict

## 背景

本轮就账号体系治理 space 咨询了两个外部 CLI advisor：

- Antigravity CLI：`agy`
- GitHub Copilot CLI：`copilot`

问题聚焦：

1. App 与 sidecar 是否可以直接共享 SQLite 数据层。
2. 当前 space 的 phase 是否过宽或顺序错误。
3. 第一刀应该落在哪里。
4. 什么 proof 才能证明账号体系开始变稳。

## Advisor 反馈摘要

### Antigravity CLI

- 原始立场：强烈反对 App 与 sidecar 共享主 SQLite 文件，认为这是 shared database integration pattern，会放大 SQLite lock、split-brain 和状态漂移。
- 最强 challenge：`共享数据层` 不能理解为共享 DB/ORM/连接；sidecar 应该是 SQLite 主库唯一拥有者。
- 最强建议：
  - Phase 2 从“共享数据层抽取”改为“IPC 契约与数据库隔离”。
  - OAuth refresh singleflight 前置。
  - 第一刀是只读接口幂等化，把 probe/refresh 拆到显式 POST。
  - 证明标准包括只读接口零写入断言、并发 refresh singleflight、状态收敛测试。

### GitHub Copilot CLI

- 原始立场：force-ranked `A > B >>> C`。
  - A：sidecar DB 独占 + API 契约。
  - B：共享 accountstore 包但 App 可只读 DB。
  - C：维持现状只补测试。
- 最强 challenge：App 只读主库仍会造成一致性语义漂移、诱导 App 层补 probe/refresh、增加 schema 演进成本。
- 最强建议：
  - 目标架构选 A。
  - 过渡期如果需要只读，只允许 sidecar 导出版本化只读投影库/快照，不允许 App 直连主库。
  - 第一刀只钉死 `GET /accounts` 与 `GET /accounts/:id` 纯读化。
  - 不要先重做 schema、前端缓存或大一统 accountstore 抽象。

## 裁决

采用 A：sidecar DB 独占 + API 契约。

GetTokens 主账号库 `accounts-v1.sqlite` 由 sidecar 独占。App/Wails 不直接打开主 SQLite，不参与 runtime 状态机写入。所谓“共享数据层”在本 space 中改名为“共享账号契约”：共享 API schema、DTO/read model、validation/normalization、fixture 和测试契约，而不是共享主 DB 访问。

如未来确实需要 App 本地高速只读，只能设计 sidecar 导出的版本化只读投影库/快照。该投影必须有 schema version、TTL、字段范围和明确的“只用于展示、不参与状态机决策”约束。

## 采纳

- Sidecar 是主 SQLite 文件唯一拥有者。
- Phase 1 先做 read path purity：GET 不触发 apply/refresh/probe/reconcile。
- OAuth refresh singleflight 前置为 Phase 2。
- Phase 3 改为 IPC 契约与数据库隔离，不做 App 直连 account-store。
- Proof standard 强化为 invariance、single-writer evidence、concurrency safety。

## 拒绝

- 拒绝 App 与 sidecar 双写或双读主 SQLite 的长期架构。
- 拒绝把“共享 accountstore 包”作为第一刀。
- 拒绝用手动点击、开发环境短期不复现或普通 ORM 单测覆盖率作为完成证明。

## 推迟

- sidecar 导出的只读投影库/快照设计推迟到 Phase 3 评估。
- 全量 command bus 重构推迟到 Phase 4。
- 账号卡视觉和前端缓存重做不进入第一刀。

## 第一刀

只做 `GET /accounts` 与 `GET /accounts/:account_key` 纯读化闭环：

1. 盘点 GET 路径中所有 apply/refresh/probe/reconcile/registry mutation。
2. 给 sidecar management handler 增加 spy/fake hook 测试，断言 GET 连续读取不触发写入和外呼。
3. 将确实需要状态迁移的动作移动到显式 POST command/probe/refresh。
4. 增加 trace/event，证明状态迁移来自 command/reconcile/probe，而不是 GET。

## 验收

- 连续 N 次 GET 同一账号，runtime apply status、routeability、model count、token state 不因 GET 改变。
- mock upstream model/OAuth/refresh 失败时，GET 不把模型列表写成 0，不把账号写成 failed/degraded。
- 并发 GET 与详情查询不会触发 refresh，spy upstream refresh call count 为 0。
- 只有 POST probe/refresh/apply 允许状态迁移，并有 audit/trace。
- OAuth refresh 并发测试中同一账号同一窗口只发生 1 次真实 upstream refresh。

## 当前状态

- 状态：accepted
- 最近更新：2026-07-11

## V2 破坏性架构追加仲裁

用户明确“不需要兼容历史”后，第二轮咨询强制比较：

- A：新建 v2 DB，一次迁移后单读。
- B：原地升级 v1。
- C：完全清空并要求所有账号重建。

Advisor force-rank 为 `A > B > C`，主控采纳 A。

追加裁决：

1. `accounts-v2.sqlite` 只保存账号资产与 credential。
2. `runtime-v1.sqlite` 保存 guard、quota、rate-limit 和 bounded evidence。
3. live session、WebSocket pin、refresh lease 只保存在内存。
4. OAuth 只迁移资产元数据，统一 `reauth_required`，不复制旧 refresh token。
5. R1 同批完成 v2 runtime cutover 和旧 credential discovery 删除，不允许把旧 source 删除推迟到后续 phase。
6. migration 失败 fail-closed；回滚只能恢复 v1 备份并回退旧二进制。
7. provider identity 默认不得产生跨账号阻断；只有带 TTL 和审计证据的明确 provider-global 上游事件可以例外。

完整裁决已落到 `plans/account-runtime-authority-v2.md`。
