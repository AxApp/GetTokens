# Account Pool WebContent Performance Plan v01

## 执行原则

- 每个优化项先证明旧行为，再实现，再用同一口径证明改善。
- 默认使用 dev App、本仓构建产物、生产数据副本或 preview 规模数据；未经授权不触碰正式版 `/Applications/GetTokens.app`。
- 账号池自动同步、WebView cache、usage attribution、rate-limit status 和 sidecar SQLite 分开验收，避免一个总内存数字掩盖具体回归。

## Phase 0：证据基线

目标：建立可复跑观测脚本和预算。

范围：
- WebContent pid / `vmmap -summary` / `ps` 进程分类。
- WebKit storage `du`、LocalStorage key size、WAL size。
- 账号页 DOM card count、virtual window count。
- 自动 runtime sync 请求计数、chunk count、payload bytes、duration。

验收：
- 生成一份 dev App 或 production-readonly baseline 记录。
- 记录 total accounts、rendered cards、sync target count、quota chunks、rate-limit payload、usage payload、LocalStorage writes。
- 不输出账号 key 列表、凭证、请求正文。

## Wise Council 后的 Phase 顺序

两位外部顾问均裁决：第一刀从自动 runtime sync 目标收窄开始。LocalStorage/WAL 治理是必要项，但不能单独证明 WebContent 1GB 问题被修复。

强制顺序：

1. Phase 1：自动 runtime sync 目标收窄。
2. Phase 2：WebView cache 去重与清理。
3. Phase 3：rate-limit status batch/filter 或 usage attribution summary，按 Phase 1 证据决定。
4. Phase 4：账号 summary/detail 分层。

## Phase 1：自动 runtime sync 目标收窄

状态：implemented on 2026-07-08；等待新包 dev/prod 数据观测。

目标：把自动同步从整池快照推进到可见/展开/脏账号集合，同时保留用户主动刷新语义。

候选实现：
- 从虚拟窗口导出 visible account ids 或 group render window。
- 自动 sync 使用 visible/expanded/dirty target set。
- Header 手动“同步运行状态”仍保留整池语义，不受自动 sync target 收窄影响。
- 组头刷新保持组内语义，卡片刷新保持单账号语义。
- 离屏账号状态存放在中心化状态中，离屏只停止订阅或渲染，不删除状态。
- 自动 sync 打点输出触发原因：`visible / expanded / dirty / manual`。

验收：
- 代码级完成：自动 sync target set 已由可见虚拟窗口账号 id 驱动；大池无 targets 时跳过自动 sync；小池保留整池兼容。
- 1000+ 账号 preview/dev App 中自动 sync target count 明显低于 total accounts。
- 1179 账号静置 30 分钟 WebContent Physical Footprint P95 `<500MB`；`<350MB` 作为第二阶段目标。
- 自动 sync bridge payload P95 `<150KB`；`<100KB` 作为第二阶段目标。
- 自动 sync CPU spike P95 `<20%`；`<15%` 作为第二阶段目标。
- 手动 header sync 仍覆盖整池：已由 `refreshAccountsRuntime()` 继续使用 `runtimeSyncAccounts` 固定。
- 组头 refresh 仍覆盖当前组：已保留 `onRefreshGroup(group.accounts)`。
- 离屏后回到视口，账号状态不丢失，stale/usage/quota/rate-limit 保持连续。
- DOM 节点数仍受虚拟窗口限制。

本轮额外处理：
- `DebugProvider.trackRequest()` 不再保留 Wails 原始大 payload，只保存摘要并限制最近 80 条，避免 debug state 复制账号池和 runtime sync 响应。

已跑验证：
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/context/debugPayload.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `docs-linhay/scripts/check-docs.sh`
- 本轮触达文件 `git diff --check -- ...`
- `./scripts/wails-cli.sh build`

验证备注：
- 全局 `git diff --check` 仍失败在既有生成物 `frontend/wailsjs/go/models.ts` 的 trailing whitespace；该文件不是本轮优化触达面。

必须排除：
- 不改 sidecar API 契约。
- 不改 usage ledger / Usage Desk 明细结构。
- 不引入第三方虚拟滚动库。
- 不做完整 summary/detail DTO 重构。
- 不把 LocalStorage WAL 缩小作为 WebContent 内存修复的唯一证据。

## Phase 2：WebView cache 去重与清理

目标：Wails runtime 不再依赖大型 localStorage 账号/quota cache。

候选实现：
- `accountListCache` / `accountQuotaCache` 增加 runtime policy。
- Wails runtime 下 best-effort 删除旧 `gettokens.accounts.list-cache` 和 `gettokens.accounts.quota-cache`。
- Browser preview 保留 cache，避免开发预览 first-paint 退化。

验收：
- 单测覆盖 Wails runtime 不写大型 cache、browser preview 仍可读写。
- dev App storage 检查 key 体积和 WAL 不继续增长。
- `npm --prefix frontend run typecheck`、必要时 `npm --prefix frontend run build`。

## Phase 3：usage attribution 增量摘要

目标：卡片 usage 不再周期性读取完整 24h attribution。

候选实现：
- sidecar 维护 per-account usage summary runtime store。
- Wails 新增 summary / changed-since API。
- Usage Desk 明细保留既有 30D/24h 能力，不与卡片摘要混用。

验收：
- mock upstream + usage ledger 测试证明请求完成后 summary 更新。
- 卡片同步只读 summary 或 changed-since。
- Usage Desk 仍可读取明细窗口。

## Phase 4：rate-limit status batch/filter

目标：自动 sync 不再全量读取所有 rate-limit statuses。

候选实现：
- sidecar management 支持 `account_keys` 查询 rate-limit status。
- Wails/root/client 增加 batch binding。
- 前端按 target keys chunk 读取。

验收：
- mock management API 断言自动 sync 不调用全量 endpoint。
- 大账号池下 rate-limit payload bytes 受 target set 控制。

## Phase 5：账号 summary/detail 分层

目标：列表页只过桥卡片 summary，详情页懒加载重字段。

候选实现：
- 定义 AccountListSummary DTO。
- `ListAccounts` 或新 endpoint 返回 summary。
- 详情 modal 打开时读取 detail-only 字段。

验收：
- payload size 预算。
- 列表页不包含 detail-only 大字段。
- 详情页功能保持可用。

## 风险与回滚

- 如果禁用 WebView cache 影响 first paint，回滚为 bounded cache：保留最近 summary，不保留 quota/runtime 详情。
- 如果可见窗口 sync 导致用户误解离屏卡片不更新，增加 UI copy 或只对自动 sync 使用可见策略，手动 sync 继续整池。
- 如果 sidecar 增量 summary 与 Usage Desk 明细口径冲突，保持接口分离，不牺牲 Usage Desk 统计完整性。
