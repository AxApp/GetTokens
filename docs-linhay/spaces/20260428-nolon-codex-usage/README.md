# Nolon / Codex 用量统计深挖

## 背景
用户希望深入理解参考项目 `nolon` 是如何实现 `Codex` 用量统计的，并要求先开启一个独立 `space` 承载本轮研究结果。

本轮已确认真实参考仓库不在 GetTokens 的 `docs-linhay/references/` 内，而是在本机：

- `/Users/linhey/Desktop/FlowUp-Libs/nolon`

同时，`nolon` 自身也维护了 `docs-linhay/`，其中已经沉淀了这套 `Codex Usage` 的设计背景、边界、缓存策略与刷新链路。

## 目标
1. 明确 `nolon` 的 `Codex` 用量统计真源是什么。
2. 明确它如何从 rollout / session JSONL 还原 token 与 request 用量。
3. 明确它如何把 minute 级投影组织成日趋势、日内明细和 UI 展示。
4. 明确它为首屏性能、手动刷新和进度反馈做了哪些分层设计。

## 范围
- `nolon/docs-linhay/dev/provider-usage-account-usage-boundary-design-2026-04-15.md`
- `nolon/docs-linhay/dev/codex-sessions-usage-index-design-2026-04-17.md`
- `nolon/docs-linhay/dev/codex-usage-startup-cache-design-2026-04-21.md`
- `nolon/docs-linhay/dev/codex-usage-refresh-progress-feedback-2026-04-22.md`
- `nolon/docs-linhay/dev/codex-usage-token-trend-workspace-ui-2026-04-23.md`
- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionEventParser.swift`
- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift`
- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift`
- `nolon/libs/Providers/Sources/ProviderUsage/CodexTokenTrendService.swift`
- `nolon/libs/Providers/Sources/ProviderUsage/CodexIntradayUsageService.swift`

## 非目标
- 本轮不修改 GetTokens 现有用量统计实现。
- 本轮不复刻 `nolon` 的完整 UI。
- 本轮不把 `Codex Sessions` 排序索引与 `Provider Usage` 图表层混成一个单一功能；两者共享真源，但不是同一页面职责。

## 验收标准
- 能准确说明 `nolon` 的 `Codex Usage` 真源与处理链路。
- 能准确区分 `daily trend`、`intraday drilldown`、`sessions usage` 三个消费面。
- 能准确说明缓存与刷新的优化点，而不是只停留在“扫 JSONL”。
- 能指出这套方案对 GetTokens 的可借鉴点和不应混淆的边界。

## 相关链接
- [nolon README](/Users/linhey/Desktop/FlowUp-Libs/nolon/README.md)
- [provider-usage-account-usage-boundary-design-2026-04-15.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/provider-usage-account-usage-boundary-design-2026-04-15.md)
- [codex-sessions-usage-index-design-2026-04-17.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-usage-index-design-2026-04-17.md)
- [codex-usage-startup-cache-design-2026-04-21.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-startup-cache-design-2026-04-21.md)
- [codex-usage-refresh-progress-feedback-2026-04-22.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-refresh-progress-feedback-2026-04-22.md)
- [codex-usage-token-trend-workspace-ui-2026-04-23.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-token-trend-workspace-ui-2026-04-23.md)
- [CodexSessionEventParser.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionEventParser.swift)
- [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift)
- [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift)
- [CodexTokenTrendService.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderUsage/CodexTokenTrendService.swift)
- [CodexIntradayUsageService.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderUsage/CodexIntradayUsageService.swift)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-28

## 当前理解

### 结论 1：`nolon` 的 Codex 用量真源是 rollout / session JSONL，不是 sidecar `/usage`

`nolon` 的设计文档已经明确把 `usage` 从账号 UI 中提升成独立业务域，但事实源不是“账号卡片本身”，而是 provider 对应的本地 session / usage cache 链路，见 [provider-usage-account-usage-boundary-design-2026-04-15.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/provider-usage-account-usage-boundary-design-2026-04-15.md)。

对 `Codex` 来说，当前真实链路已经收敛为：

`rollout JSONL -> usage delta reduce -> usage-index-v1.sqlite -> projected minute usage -> daily trend / intraday drilldown / sessions usage`

这和 GetTokens 当前依赖 sidecar 管理接口的心智不是一回事。

### 结论 2：最核心的 reducer 在 `CodexSessionEventParser.reduceUsageLine(...)`

[CodexSessionEventParser.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionEventParser.swift) 只把会影响 usage 的事件收敛成三类：

1. `session_meta`
2. `turn_context`
3. `token_count`

其中 `reduceUsageLine(...)` 的规则很关键：

1. 优先取 `tokenCount.totalUsage`
2. 若有累计值，则和 `previousTotals` 做差得到本次 delta
3. 若没有累计值，则回退到 `tokenCount.lastUsage`
4. `cachedInputTokens` 会被钳到不大于 `inputTokens`
5. 若本次 `input / cached / output` 全为 `0`，则不生成 delta
6. 每个有效 delta 固定记 `requestCount = 1`

这说明 `nolon` 不是直接把原始 JSONL 当报表，而是显式把会话里的累计 token 进度压缩成“可聚合的请求增量事实”。

### 结论 3：`Codex Sessions` 和 `Codex Usage` 共享同一条 minute usage 真源

[codex-sessions-usage-index-design-2026-04-17.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-usage-index-design-2026-04-17.md) 把独立索引的定位写得很清楚：

1. 真源仍然是 rollout 文件
2. SQLite 只是可丢弃缓存
3. 目标位置是 `~/Library/Application Support/Nolon/codex-sessions/usage-index-v1.sqlite`
4. 它既支撑 `Codex Sessions` 的 row usage / section usage / usage 排序
5. 也支撑 `Provider Usage` 页面对 minute usage 的投影读取

换句话说，`Codex Sessions` 和 `Codex Usage` 不是两套互不相干的统计系统，而是同一条 provider 层 usage 装配链，分别服务于“会话列表”和“图表工作区”。

### 结论 4：`CodexSessionStore` 是真正的编排器

[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift) 里关键职责有三块：

1. `loadProjectedUsageMinutes(...)`
   - 先 `prepareProjectedUsageIndex(...)`
   - 再从 `usageIndex` 读取 minute projection
2. `refreshChangedProjectedUsageDayKeys(...)`
   - 扫描 live / archived rollout inventory
   - 识别 dirty rollout
   - 读取旧 minute rows
   - 重放当前 rollout
   - 回读新 minute rows
   - 计算受影响的 `dayKeys`
3. `loadCachedProjectedUsageMinutes(...)`
   - 只读当前 SQLite 已有的 minute projection，不触发 live refresh

这意味着 `Codex Usage` 的“真计算”不在 ViewModel，也不在 UI service，而是在 `CodexSessionStore` 这一层完成编排。

### 结论 5：`CodexTokenTrendService` 做的是“全局日趋势快照”

[CodexTokenTrendService.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderUsage/CodexTokenTrendService.swift) 有几个重要事实：

1. `fetchGlobalSnapshot(...)` 会先移除环境变量里的 `CODEX_HOME`
2. 它默认走 `loadSessionBackedSnapshot(...)`
3. 它总是先加载完整历史，再本地裁剪 `trailingDays`
4. live snapshot 成功后会写入 `CodexTokenTrendSnapshotCache`
5. 支持 `fetchCachedGlobalSnapshot(...)`
6. 支持 `fetchRefreshedGlobalSnapshot(...)`，基于 cached full snapshot 只回填近端受影响日期

这里的关键边界是：

- `Codex token trend` 是全局口径，不绑定当前账号激活态的 `CODEX_HOME`
- 它的 summary 语义要求全历史完整，再按展示范围裁剪点位

### 结论 6：`CodexIntradayUsageService` 做的是“单日分钟桶投影”

[CodexIntradayUsageService.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderUsage/CodexIntradayUsageService.swift) 并不重新解析 rollout 文件，而是消费 `CodexSessionProjectedUsage`：

1. 先按 `dayKey` 解析当日范围
2. 同样移除 `CODEX_HOME`，走全局口径
3. 优先读取 `loadCachedProjectedUsageMinutes(...)`
4. 缓存 miss 再调用 `loadProjectedUsageMinutes(...)`
5. 再按 bucket 聚合成 `ProviderIntradayUsageSnapshot`

因此，`daily trend` 和 `intraday drilldown` 的源头是一致的，只是一个做“按天汇总”，一个做“按时间桶聚合”。

### 结论 7：首屏性能优化不是“减少扫描”，而是把 cache 语义重新分层

[codex-usage-startup-cache-design-2026-04-21.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-startup-cache-design-2026-04-21.md) 很有价值，因为它记录了设计反复收敛后的边界：

1. 早期曾尝试直接用旧 `cost-usage` day cache 做首屏 hydrate
2. 后来发现这个 cache 可能只覆盖近几天，首屏会发布“截断历史”的错误图表
3. 因此最终废弃该方案
4. 新方案改为缓存“上一次成功的 full snapshot”
5. 手动刷新优先基于 full snapshot cache 做近两天增量回填
6. 只有 cache 缺失时，才退回完整 live snapshot

也就是说，`nolon` 优化的不是“有没有 cache”，而是“这份 cache 的语义是否和 live snapshot 等价”。

### 结论 8：刷新进度反馈是 provider 层显式透传的，不是 UI 猜出来的

[codex-usage-refresh-progress-feedback-2026-04-22.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-refresh-progress-feedback-2026-04-22.md) 与 [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift) 对得上：

`CodexSessionStore.performanceNotification` 会分阶段发通知，细分为：

- `scan_inventory`
- `read_usage_index`
- `reconcile_rollouts`
- `read_previous_minutes`
- `analyze_rollout`
- `read_updated_minutes`
- `rollout_completed`
- `purge_stale_entries`
- `finished`

UI 只是把这些底层 phase 翻译成用户可理解的状态文案和进度条，而不是自己猜“现在应该显示扫描中还是刷新中”。

### 结论 9：UI 只是消费 usage workspace，不拥有事实源

[codex-usage-token-trend-workspace-ui-2026-04-23.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-token-trend-workspace-ui-2026-04-23.md) 说明 UI 层后续主要在解决：

1. `Daily Trend / Intraday Drilldown` 的工作区收敛
2. `Token / Requests` 维度切换
3. sticky / scroll / toolbar rail 的体验问题

这些优化都建立在“同一份 `ProviderTokenTrend*` 和 `ProviderIntradayUsage*` 数据模型已经存在”的前提上，说明 UI 不是用量实现的核心，核心仍在 provider 层的 usage minute projection。

## 一句话总链路

`rollout JSONL -> CodexSessionEventParser.reduceUsageLine -> CodexSessionUsageIndex(SQLite) -> CodexSessionStore projected minute usage -> CodexTokenTrendService / CodexIntradayUsageService -> Provider Usage UI 与 Codex Sessions UI`

## 本轮补全细节

### 1. `usage-index-v1.sqlite` 不是单表，而是“文件级索引 + 分钟投影表”

`CodexSessionUsageIndex` 在本地 `Application Support/Nolon/codex-sessions/usage-index-v1.sqlite` 中维护两张关键表，见 [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift:179) 和 [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift:738)：

1. `usage_entries`
   - 每个 rollout 一行
   - 保存 `absolute_rollout_path / file_id / mtime_unix_ms / size_bytes`
   - 保存 `parsed_bytes / last_model`
   - 保存 `input_tokens / cached_input_tokens / output_tokens / request_count`
   - 负责判断能否 `cacheHit / deltaAppend / fullRebuild`
2. `session_usage_minutes`
   - 每个 rollout、每分钟一行
   - 保存 minute 级 `input / cached / output / request_count`
   - 主键是 `(codex_home_path, rollout_path, minute_start_unix_ms)`
   - 是 daily trend、intraday drilldown 和 session usage 聚合的真实 minute 来源

这也是 `nolon` 这套实现里最值得借鉴的地方：文件级摘要和分钟级投影被分开了，避免所有视图都直接重扫 JSONL。

### 2. `cacheHit / deltaAppend / fullRebuild / fileMissing` 是四个明确出口

按 [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift:190) 的真实分支：

1. `fileMissing`
   - rollout 文件不存在
   - 删除 `usage_entries` 和对应 `session_usage_minutes`
2. `cacheHit`
   - 文件指纹完全一致
   - 且 minute 表不存在“有 token 但 `request_count <= 0`”的旧数据
3. `deltaAppend`
   - 同一路径、同 `file_id`
   - 文件只增不减
   - `parsed_bytes == 旧 size`
   - 且不是 derived rollout
4. `fullRebuild`
   - 不满足 append 条件
   - 或 append 解析失败
   - 或需要做 requestCount backfill

这四条出口里，最容易忽略的是 `requestCount backfill`。旧 minute 数据如果缺 `request_count`，系统会主动打断 cache 复用，强制走重建。

### 3. `requestCount` 的定义不是“原始 message 数”，而是“有效 token delta 数”

按 [CodexSessionEventParser.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionEventParser.swift:146)：

1. reducer 只关注 `session_meta / turn_context / token_count`
2. `token_count` 优先用 `totalUsage` 做差，回退 `lastUsage`
3. 只有本次 `input / cached / output` 不全为 `0` 时，才发出 `tokenDelta`
4. 每个有效 `tokenDelta` 固定记 `requestCount = 1`

然后这个 `requestCount` 会先落到 minute bucket，再写进 `session_usage_minutes.request_count`，见 [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift:1517)。

所以 `nolon` 的请求数语义其实是：

`1 个产生非零 token delta 的 token_count 事件 = 1 次 request`

这是一种清晰、稳定、可解释的 provider 内部约定，但它依然是“usage event 粒度”，不是网络层抓到的 HTTP request 粒度。

### 4. projected minute usage 在 SQL 聚合前还做了一层“逻辑 session 去重”

按 [CodexSessionUsageIndex.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionUsageIndex.swift:1313)：

1. 先把 `session_id` 为空的行归一成 `rollout:<path>`
2. 先按 `logical_session_id + minute_start_unix_ms` 取 `MAX(...)`
3. 再按 `minute_start_unix_ms` 做 `SUM(...)`

这说明 projected minute usage 不是简单把所有 rollout minute 行直接相加，而是先避免同一逻辑会话多 rollout 的重复计数。

### 5. UsageEngine 的刷新接线是“先缓存首屏，再 live refresh，再联动 intraday”

按 [ProviderUsageEngine.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Usage/Engine/ProviderUsageEngine.swift:314) 和 [ProviderUsageEngine.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Usage/Engine/ProviderUsageEngine.swift:1177)：

1. `codexCachedTokenTrendFetchAction`
   - 默认调用 `CodexTokenTrendService.fetchCachedGlobalSnapshot(...)`
2. `codexTokenTrendFetchAction`
   - 默认调用 `CodexTokenTrendService.fetchRefreshedGlobalSnapshot(...)`
3. `loadUsageIfNeeded()`
   - 先用 cached snapshot hydrate `tokenTrendSnapshot`
   - 再 `await loadUsage()`
4. `loadUsage()`
   - 统一进入 `refreshTokenTrend()`
5. `refreshTokenTrend()`
   - 刷 daily trend
   - 再根据 `reconcileIntradayDrilldownSelection(...)` 的结果决定是否联动 `refreshIntraday()`

这条链解释了为什么 `Codex Usage` 首屏既能马上看到旧图，又不会停留在旧图。

### 6. `performanceNotification` 是 provider 层主动发，UI 只是翻译

按 [ProviderUsageEngine.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Usage/Engine/ProviderUsageEngine.swift:405)：

1. `configureCodexTokenTrendDiagnosticsIfNeeded()` 监听 `CodexSessionStore.performanceNotification`
2. `handleCodexTokenTrendPerformanceNotification(...)`
   - 只接收 `prepare_projected_usage_index` 和 `refresh_projected_usage_day_keys`
   - 只接收当前 `codex_home_path`
   - 还会用 `trace_id` 避免串台
3. `makeTokenTrendRefreshStatusData(...)`
   - 把 `detail_phase / processed_rollout_count / dirty_rollout_count / current_rollout_path / current_database_name / current_refresh_reason` 翻译成页面状态卡片

因此，刷新进度不是 UI 猜出来的，而是 provider 层把真实阶段显式透给页面。

### 7. intraday 面板自己的“刷新”并不是只刷新下半区

按 [ProviderUsageEngine.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Usage/Engine/ProviderUsageEngine.swift:1659)：

1. `refreshIntradayPanel()`
   - 若当前没有选中日，则只刷 `refreshIntraday()`
   - 若当前已有选中日，则直接 `await refreshTokenTrend()`
2. `refreshTokenTrend()` 成功后，会再次根据选中日联动 `refreshIntraday()`

也就是说，用户点击 intraday 区域自己的刷新按钮时，真实行为是“触发同一轮 trend refresh，再回刷 intraday”，这和设计文档的“同屏两块数据必须同轮 refresh”是一致的。

### 8. 当前发现的最明确偏差：文档写“最近两天回填”，代码实际按 `affectedDayKeys` 回填

这一点很关键。

文档 [codex-usage-startup-cache-design-2026-04-21.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-usage-startup-cache-design-2026-04-21.md:168) 把手动刷新描述成：

- “只重算最近两天（昨天 + 今天）的 minute projection”

但代码 [CodexTokenTrendService.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderUsage/CodexTokenTrendService.swift:104) 和 [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:719) 的真实实现是：

1. 先 `refreshChangedProjectedUsageDayKeys(...)`
2. 拿到一组 `affectedDayKeys`
3. 再逐日读取 cached projected usage 回填 point

也就是说，当前真实策略不是“昨天 + 今天”写死两天，而是“所有受影响日期”。这应视为当前文档与实现的一个明确偏差。

## 对 GetTokens 的直接启发

1. 如果要做本地 `Codex` 用量统计，首先要区分“代理请求统计”和“本地 session replay 统计”两种事实源。
2. 真正值得借鉴的是 `delta reducer + minute projection + 可丢弃 SQLite 索引` 这条 provider 层链路，而不是单独抄 UI。
3. 若未来 GetTokens 也要做趋势图和会话页，最好让两者共用同一条 usage projection 真源，避免一个看 sidecar、一个看本地日志。
4. `cache` 不能只看命中率，必须先校验语义完整性，否则首屏会快，但口径会错。

## 当前未决问题
1. `nolon` 当前是否还保留旧 `CostUsageFetcher` 兼容路径，以及它在运行态里是否已完全退场。
2. `requestCount = 1` 的定义是否在所有 `token_count` 场景下都稳定等价于“单次请求”。
3. 若要把这套模式映射回 GetTokens，数据持久层放在 Wails 侧还是 sidecar 侧更合适。

## 下一步建议
1. 继续读取 `CodexSessionUsageIndex.swift` 的 minute schema 和增量读取分支，把 SQLite 表结构与增量策略再展开一层。
2. 读取 `ProviderUsageEngine` 的 `codex` refresh 接线，补足“UI 如何接收 performance notification”的最后一段证据。
3. 若要落地到 GetTokens，单独再写一份“可借鉴点 / 不应照搬点 / 接入边界”的设计对照文档。
