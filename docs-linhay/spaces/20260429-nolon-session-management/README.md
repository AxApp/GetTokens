# Nolon Session Management Research

## 背景

用户希望深入研究参考项目 `nolon` 中“会话管理”是如何实现的，并基于真实代码而不是口头描述，明确：

1. `nolon` 管理的“会话”对象到底是什么。
2. 会话扫描、聚合、缓存、详情、rewrite、CLI 对齐是如何串起来的。
3. 这套实现有哪些能力已经落地，哪些边界最容易被误解。

本轮研究对象位于本机参考仓库：

- `/Users/linhey/Desktop/FlowUp-Libs/nolon`

## 目标

1. 明确 `nolon` 的会话管理真实数据源与投影层边界。
2. 明确用户可见能力与 CLI 能力的对齐情况。
3. 明确 `rewrite` 的执行链、落点与风险。
4. 通过一次基于代码证据的 `debate` 产出结构化研究结论。

## 范围

- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift`
- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift`
- `nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift`
- `nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift`
- `nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCommands.swift`
- `nolon/docs-linhay/dev/codex-session-cli-and-scanner-alignment-2026-04-11.md`
- `nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md`

## 非目标

1. 本轮不修改 `GetTokens` 现有实现。
2. 本轮不直接复刻 `nolon` 的整套会话页 UI。
3. 本轮不把 `Codex Sessions` 与 `Codex Usage` 完全混成一个问题，只在必要处讨论它们共享的数据链路。

## 验收标准

1. 能准确说明 `nolon` 会话管理的真源、投影层、缓存层与 UI 状态层。
2. 能列出当前已实现的核心会话管理功能，而不是泛泛而谈。
3. 能说明 `rewrite` 为什么是文件与数据库双写的一条完整链路。
4. 已在本 space 下产出一份 `debate` 纪要，记录代码证据、共识和开放问题。

## 相关链接

- [nolon README](/Users/linhey/Desktop/FlowUp-Libs/nolon/README.md)
- [CodexSessionScanner.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift)
- [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift)
- [CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift)
- [CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift)
- [codex-session-cli-and-scanner-alignment-2026-04-11.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-session-cli-and-scanner-alignment-2026-04-11.md)
- [codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md)
- [debate v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/debate/20260429/nolon-session-management/20260429-nolon-session-management-v01.md)
- [autoresearch results](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/plans/20260429-nolon-session-management-autoresearch-results-v01.tsv)
- [autoresearch state](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/plans/20260429-nolon-session-management-autoresearch-state-v01.json)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-29

## Space Inventory

- `README.md`
  - 当前研究主文档，已收口到完整分析 + 复用指南
- `debate/20260429/nolon-session-management/20260429-nolon-session-management-v01.md`
  - 多参与者补证纪要
- `plans/20260429-nolon-session-management-autoresearch-results-v01.tsv`
  - 前台 `codex-autoresearch` 迭代日志，记录 `6 -> 4 -> 2 -> 0` 的主指标收敛过程
- `plans/20260429-nolon-session-management-autoresearch-state-v01.json`
  - 同一轮 autoresearch 的状态快照与运行配置
- `screenshots/`
  - 当前无截图产物，目录预留

## 深挖发现

1. `summary` 目前不是首屏真数据
   - `CodexSessionStore.makeSessionRecord(...)` 构造 `CodexSessionRecord` 时直接写 `summary: nil`。
   - `CodexSessionStoreTests.loadSnapshotDoesNotReadSummaryFromRolloutBody()` 明确断言首屏 snapshot 不从 rollout 正文提炼摘要。
   - `CodexSessionsTabViewModel` 与详情面板仍保留 `summary` 展示位，说明 UI 预留了摘要能力，但当前 store 主链路并没有稳定供给它。

2. 搜索并不依赖 usage index 或全文索引
   - `CodexSessionsTabViewModel.searchableTexts(for:)` 只搜索 `title`、`displayID`、`modelProvider`、provider label、可选 `summary`、可选 `cwd`。
   - 现阶段搜索是纯展示字段匹配，不会直接命中 usage totals、timeline 细项或 SQLite usage index 内容。
   - `nolon` 的设计文档也多次强调“本轮不引入 FTS”。

3. usage index 的职责是 usage / sort 预热，不是列表主快照
   - `projection cache` 负责恢复 `projects / sections / rows` 首屏投影。
   - `usage index` 负责 `loadSessionUsage(...)`、组头 usage 聚合、usage 排序预热，以及后续 timeline 复用。
   - 当排序偏好为 `usage` 时，ViewModel 会在应用 cached snapshot 前同步预热 usage 排序键，避免先按时间排序、再二次跳变。

4. 选中态是运行时修复，不属于持久缓存的一部分
   - projection cache 设计文档明确“不缓存 `selectedSessionID`、展开态、搜索关键字等高频交互态”。
   - `repairSelection()` 的语义是：保留仍然可见的当前选中项；否则退回首个可见 row；若当前无可见 row 则清空选中。
   - 这意味着进入页面、切换搜索或刷新重建后，选中项追求的是“当前结果集内稳定”，不是跨刷新强持久。

5. `time-project` 漂移已经可以还原出时间线
   - 2026-04-11 的设计文档明确写过 UI/CLI 都采用 `provider` 与 `time-project` 两种分组。
   - 但 2026-04-15 的提交 `aa24aa0 feat(codex-sessions): ship project-first sessions and intraday drilldown` 中，SwiftUI `SessionGroupingMode` 已经收缩为 `project/provider`。
   - 当前 CLI 仍保留 `time-project` payload、help、文本输出与测试，因此这不是“从未实现”，而是 UI 后续重构到 project-first 后没有把 CLI 一起收口。

6. `rewrite` 的真实改写边界比 UI 文案更保守
   - `previewRewrite(...)` 并不预演文件改写，只是先基于当前 snapshot 统计命中的 `sessionCount / live / archived / stateRowCount`。
   - `rewriteProviders(...)` 的执行顺序是：
     - `preview`
     - `resolveRewriteRolloutTargets`
     - `rewrite live rollout files`
     - `rewrite archived rollout files`
     - `rewrite state db`
     - `invalidate inventory / projection cache`
     - `verify`
   - rollout 改写不是重写整份事件流语义，只改每个目标文件“首个非空行里的 `session_meta.payload.model_provider`”。
   - 目标 rollout 的筛选也是保守的：先用 scanner 读首个 `session_meta`，只命中所选 `threadID` 的文件；无关 malformed rollout 会被忽略，不阻塞目标文件改写。
   - state db 改写只更新 `threads` 表中的 `model_provider`，条件是 `id IN (selectedThreadIDs)` 且旧值不等于目标 provider。

7. `rewrite` 不是事务，也允许部分成功
   - 测试覆盖了“rollout 改写成功但 SQLite 更新失败”的场景：结果对象会带 `state db:` 错误和 `rewrite verification:` 失败说明，但已经写成功的 rollout 不会回滚。
   - 因此它的保障模型是：
     - 分阶段执行
     - 收集 failures
     - 最后 verify 暴露不一致
     - 依靠下次刷新重新投影
   - 这也是它在成功后立刻失效 inventory cache 和 projection cache 的原因。

8. 首屏链路的时序比“缓存优先”更细
   - `reload(.initial)` 先尝试 `cached snapshot`，其次 `cached skeleton`。
   - 若命中 `clean + fresh` 的 cached snapshot，会直接短路本轮 reconcile，发出 `load_complete_cached_snapshot`。
   - 若命中 cached snapshot 但状态是 dirty / stale，会先把缓存应用到 UI，再走一次稳定 `loadSnapshotPresentation(...)` 做 reconcile。
   - 若没有 cached snapshot，才会退到 `project skeleton -> snapshotStream -> fallback snapshot` 这条慢路径。

9. usage 预热、列表主快照、timeline 加载是三条不同节奏
   - `apply(snapshotPresentation:..., prewarmUsageFromIndex: true)` 时，会先刷新 projected overview usage，再尝试从 usage index 同步预热每个 row 的 usage state。
   - 这个预热只在“同 logical usage group 没有共享成员”时直接写入，避免重复灌同一 thread/rollout 的 totals。
   - 预热没命中时，后续由 `primeVisibleSessionUsages() -> drainUsageQueueIfNeeded()` 异步补齐真实 usage；若当前排序模式是 `usage`，补齐后会 debounce 一次 `rebuildSectionStates()`。
   - timeline 则完全独立，只在选中 session 后通过 `primeSelectedSessionTimelineIfNeeded()` 按需加载，不参与首屏列表成形。

## Snapshot Stream Delta

- `CodexSessionStore.snapshotStream(...)` 并不会像 `loadSnapshot(...)` 那样每次都发完整快照；它按 `batchSize` 扫描 rollout 文件，把每个 batch 组装成 `CodexSessionSnapshotDelta.sessions` 后立即 yield。
- Provider 侧每个 batch 会先局部排序，再把所有已发出的 session 累积到 `accumulatedSessions`；只有整条 stream 结束后，才把“全量累计结果”重新排序并落到 projection cache。
- 对外语义因此是：
  - stream 中间事件：只代表“新增送达的一批 session 行”
  - stream 结束后的磁盘缓存：才代表新的完整 `session_snapshot`
- 这也解释了为什么 stream 路径既能更快让 UI 有内容，又不会放弃 projection cache 这条首屏真恢复链。

## Removed Session IDs

- `removedSessionIDs` 不是 Provider 在 delta 里直接给出的字段，而是 ViewModel 在消费 stream 时自己算出来的。
- 计算规则是：
  - 非最终 batch：`removedSessionIDs = []`
  - `isComplete == true` 的最终 batch：`rowsByID.keys - streamedSessionIDs`
- 含义很关键：只有当本轮 stream 全部结束，ViewModel 才有资格判定“哪些旧 row 这次再也没出现”，从而把它们从当前列表删掉。
- 这样做避免了两类错误：
  - 中途 batch 尚未送达时，误删本应在后续 batch 才出现的 session
  - 复用旧 ViewModel / 命中旧缓存后，刚开始 reconcile 就把缓存里的旧行清空，导致列表抖动
- 所以 stream 路径本质上是“增量补齐 + 末尾一次性收敛删除”，而不是“每个 batch 都试图维护完整真相”。

## Logical Usage Key

- ViewModel 不直接把“一个 row = 一份独立 usage”当成事实，而是先给每条 row 算一个 `logicalUsageKey`。
- 规则很简单但很关键：
  - 有 `threadID`：key 是 `thread:<normalizedThreadID>`
  - 没有 `threadID`：才退回 `rollout:<rolloutPath>`
- 这意味着只要多条 row 实际属于同一个 thread，它们在 UI usage 语义上就会被视为同一逻辑会话：
  - 预热时共用一份 cached usage state
  - 异步真实加载时只排一次队
  - section 聚合 usage 时只取一个 representative
- 因此 `logicalUsageKey` 不是为了列表分组，而是为了防止同一逻辑会话在 usage 展示、usage 排序、组头 usage 聚合里被重复计算。

## Forked Usage Dedupe

- `logicalUsageKey` 解决的是“同一逻辑 thread 在 UI 投影层不要重复算”，但 fork 场景还多一层：派生 rollout 本身可能继承了父会话的 cumulative totals。
- 这层去重发生在 Provider/usage index 侧，不在 ViewModel：
  - `CodexSessionStoreTests` 明确覆盖了 `forked rollout inherits parent cumulative totals` 的场景。
  - 断言结果是：派生 rollout 只统计 fork 之后新增的 usage，而不是把父会话累计 totals 再算一遍。
- 进一步地，若 forked rollout 后续又 append 了新的 cumulative totals，store 会强制 `fullRebuild`，继续保持“只保留 post-fork 增量”的语义，而不是盲目走 tail append。
- 所以这套系统实际上有两层去重：
  - Provider 层：解决 forked rollout 继承父 totals 的问题
  - ViewModel 层：解决同一 logical thread 在多个 row/section 中重复展示 usage 的问题

## Layer Boundary Matrix

| 层 | 真正负责什么 | 不负责什么 |
|---|---|---|
| rollout jsonl | 会话真源；`session_meta`、event 流、usage 原始累计线索 | 不直接提供 UI-ready section/row 投影 |
| state sqlite (`threads`) | 标题、`updatedAt`、`model_provider`、state row count 等补充元数据 | 不保存完整 rollout 事件流，也不是 usage 真源 |
| `CodexSessionStore` | 扫描、聚合、snapshot/stream、rewrite、usage/timeline 索引接线 | 不持有长期 UI 交互态 |
| projection cache | 跨重启恢复 `projects / sections / rows` 首屏投影 | 不缓存 `selectedSessionID`、搜索词、展开态 |
| usage index | usage totals、usage 排序预热、projected usage summary、timeline 复用 | 不承担列表主快照职责 |
| `CodexSessionsTabViewModel` | 分组、排序、搜索、选中修复、usage/timeline 按需加载 | 不回写真源文件，也不自己解析 rollout |
| CLI (`nolon codex session ...`) | 文本/JSON 输出、rewrite 命令面、provider migration 审计 | 不拥有独立 rewrite 引擎；核心逻辑复用 Provider 层 |

- 这张表也是理解 `nolon` 会话管理的最短路径：
  - 真源不止一个介质，但“最终对外的会话对象”由 `CodexSessionStore` 统一投影。
  - cache/index 都是可丢弃加速层，不是 source of truth。
  - UI/CLI 是两套入口，但底层会话扫描、rewrite、usage 聚合并没有分叉成两套实现。

## Final Closure

- 到这一步，可以把 `nolon` 的会话管理总结为一句话：
  - 它不是聊天式“conversation CRUD”，而是一套围绕本地 Codex rollout / state / usage 索引建立的 session 投影与治理系统。
- 对用户可见的能力已经相当完整：
  - 浏览 live / archived session
  - project / provider 分组
  - recent / usage 排序
  - 行内详情、Resume、Copy Command、Show in Finder、share
  - 单 session / 分组 rewrite
  - CLI 等价命令面
- 真正容易被误解的边界有四个：
  - `summary` 现在并不是首屏稳定数据
  - 搜索不是全文检索
  - usage index 不是列表主快照
  - rewrite 不是事务性迁移
- 剩余的“复杂度来源”主要不在 UI，而在多介质一致性：
  - rollout / state sqlite / projection cache / usage index 各自承担不同职责
  - 系统通过 staged rewrite、verify、cache invalidation、runtime repair 来维持整体可用，而不是依赖单次原子提交
- 结合代码、测试、设计文档和时间线来看，这轮研究已经足够支撑“完整分析完成”的判断，不再存在必须继续追的核心实现黑箱。

## Evidence Matrix

| 结论 | 主要代码证据 | 主要测试证据 |
|---|---|---|
| 首屏 `summary` 不来自 rollout 正文 | `CodexSessionStore.makeSessionRecord(...)` 固定写 `summary: nil` | `CodexSessionStoreTests.loadSnapshotDoesNotReadSummaryFromRolloutBody()` |
| `snapshotStream` 发的是 delta，不是完整快照 | `CodexSessionStore.snapshotStream(...)` 每批只 yield `sortedBatch` | `CodexSessionStoreTests.snapshotStreamYieldsDeltaEvents()` |
| cached snapshot 可以 clean/fresh 直接短路 reconcile | `shouldUseCachedSnapshotWithoutReconcile(...)` + `loadCachedPresentationIfAvailable(...)` | `CodexSessionsTabViewModelTests.testBDD_GivenCleanFreshCachedSnapshot_WhenLoading_ThenInitialReconcileIsSkipped()` |
| dirty cached snapshot 仍会走稳定 snapshot reload | `reload(.initial)` 命中缓存后仍可能进入 `loadSnapshotPresentation(...)` | `CodexSessionsTabViewModelTests.testBDD_GivenDirtyCachedSnapshot_WhenLoading_ThenStableSnapshotReloadStillRuns()` |
| 空 stream 完成事件不会把 cached rows 清空 | ViewModel 只在 `isComplete` 时按 `streamedSessionIDs` 计算删除集 | `CodexSessionsTabViewModelTests.testBDD_GivenCachedSnapshotAndEmptyStreamDelta_WhenLoading_ThenCachedRowsAreNotClearedByReconcile()` |
| usage 首屏排序会先用 cached usage index 预热 | `prewarmUsageStateFromIndexIfNeeded(...)` | `CodexSessionsTabViewModelTests` 中 cached snapshot + usage sort 场景会断言 `loadCachedSessionUsageCallCount` 和首屏顺序 |
| forked rollout 只计 post-fork usage | usage record / projected summary 侧对 fork 做去重 | `CodexSessionStoreTests.loadProjectedUsageSummaryCountsOnlyPostForkUsageForDerivedRollout()` 与 `loadSessionUsageRecordRebuildsForkedRolloutToPreserveDerivedTotals()` |
| rewrite 是 rollout + sqlite 双写，且允许部分成功 | `rewriteProviders(...)` 分阶段执行并在结尾 verify | `rewriteProvidersUpdatesMatchingRolloutsAndSQLiteRows()`、`rewriteProvidersReportsConsistencyFailuresWhenSQLiteUpdateFails()` |

- 也就是说，这份研究结论不是只靠“看实现推断”，而是基本都能在对应测试里找到行为护栏。

## Evolution Timeline

| 日期 / 提交 | 演进点 | 说明 |
|---|---|---|
| 2026-04-11 / `cedfd3b` | CLI 命令面补齐 | 增加 `nolon codex session list / preview-rewrite / rewrite`，并把早期 UI 分组语义带到 CLI |
| 2026-04-15 / `aa24aa0` | project-first UI 重构 | SwiftUI 会话页从早期 `time-project` 思路收缩到 `project/provider`，形成后续 CLI/UI 漂移 |
| 2026-04-16 ~ 2026-04-17 | 搜索、usage、inline detail 逐步落地 | 会话页从“可看列表”扩展到“可搜索、可按 usage 看、可展开详情” |
| 2026-04-17 / `ad82270` | usage index 落地 | 把 usage 解析从反复读 rollout 升级成独立 SQLite 可丢弃索引 |
| 2026-04-18 | projection cache 设计成形 | 目标转向“跨重启秒开”，把 `session_snapshot / skeleton` 变成可落盘投影 |
| 2026-04-19 / `864c4b7` 及相关设计 | cached snapshot 首屏排序、startup acceleration、sort pipeline 优化 | 解决“首屏先出现再跳序”和“命中缓存还立刻重扫”的体验问题 |
| 2026-04-20 ~ 2026-04-21 / `d9f3946`、`0614b10` 等 | 详情面板收口、memory control、fork usage 去重与 minute cache 演进 | 会话页从“能用”进入“性能/信息架构/一致性”优化期 |

- 这条时间线也解释了为什么当前代码会同时存在：
  - 早期文档中的 `time-project`
  - 现在 UI 的 `project/provider`
  - 仍未同步收口的 CLI `time-project`
- 它们不是互相矛盾的随机残留，而是 4 月中旬连续重构后的自然沉积。

## Reuse Guide

如果把这轮研究转成“GetTokens 能不能借 `nolon` 的会话管理模式”，结论不是“整套抄过来”，而是分层复用。

### 可以直接借的模式

1. 真源与投影分离
   - `nolon` 最稳的一点不是 UI，而是把 `rollout/state sqlite` 和 `session snapshot` 分开。
   - 对 GetTokens 来说，可借的是：
     - 真源继续是本地 Codex rollout
     - UI / Wails API 不直接绑定扫描细节
     - 中间先产出稳定 projection，再给前端消费

2. usage / session 共用索引链路
   - `nolon` 没把“会话列表 usage”和“全局 usage 图表”做成两套统计系统。
   - GetTokens 当前 [usage_local.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/usage_local.go:1) 已经在本地实现了 `usage-index-v1.sqlite` 和 `cacheHit / deltaAppend / fullRebuild / fileMissing` 四分支，这和 `nolon` 的 usage index 思路已经很接近。
   - 真正可复用的方向是：让后续 session 视图复用同一条 usage 投影链，而不是重新发明另一套按会话统计逻辑。

3. cached snapshot 先出内容，再 reconcile
   - 对本地 JSONL 扫描类功能，`projection cache -> background reconcile` 的体感收益非常实在。
   - 如果 GetTokens 后续要做 Codex session 浏览页，这个首屏策略值得直接照搬。

4. 分阶段 rewrite + verify
   - 就算 GetTokens 将来不做 provider rewrite，也可以借用它的工程心智：
     - 明确 preview
     - 明确执行阶段
     - 明确 verify
     - 明确失败是“部分成功 + 暴露不一致”，而不是假装事务性

### 不能直接照搬的边界

1. 不要把 `nolon` 的 session UI 心智直接套到 GetTokens 的 usage desk
   - `nolon` 的 session 管理目标是“浏览与治理本地 Codex 会话”。
   - GetTokens 当前的核心目标仍然是“账号池 / quota / 本地投影 usage / Provider 控制面”。
   - 所以 session 页如果做，也应该是 usage desk 的旁路能力，不该反过来重定义 GetTokens 主界面。

2. 不要把 `summary`、全文搜索、原子 rewrite 当成现成能力
   - `summary` 现在并不稳定。
   - 搜索只是展示字段过滤。
   - rewrite 不是事务。
   - 这些如果在 GetTokens 里做产品承诺，会比 `nolon` 当前真实实现口径更大。

3. 不要把全局文档/治理噪音混进功能结论
   - 这轮 autoresearch 已经验证：repo 级治理脚本可能被无关 space 的历史文件影响。
   - 对 GetTokens 落地时，应该优先确认“功能本身的 source/projection/index 语义”，而不是让治理脚本状态左右方案判断。

### 对 GetTokens 最实际的迁移建议

1. 短期
   - 保持当前 `usage_local.go` 的本地 usage index 路线，不回退到每次全量扫 JSONL。
   - 如果继续对齐 `nolon`，优先补的是“projection 语义”和“受影响日期/会话的增量刷新口径”。

2. 中期
   - 若要增加 Codex session 浏览能力，先单独做 session projection API，不要把会话扫描逻辑塞回现有 usage desk API。
   - usage 与 session 可以共用底层索引，但前端入口、筛选和交互语义应分开。

3. 长期
   - 如果 GetTokens 真的要支持 session 级治理动作，先决定是否接受 `nolon` 这种“多介质 staged rewrite + verify”的一致性模型。
   - 若不能接受，就不能只抄 UI 或命令面，必须连底层一致性策略一起重设计。
