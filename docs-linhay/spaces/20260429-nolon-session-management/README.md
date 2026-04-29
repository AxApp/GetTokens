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

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-29

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
