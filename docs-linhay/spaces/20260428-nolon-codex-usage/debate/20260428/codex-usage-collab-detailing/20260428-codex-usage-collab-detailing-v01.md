# Codex Usage Collab Detailing

**日期**：20260428
**模式**：合作型
**参与者**：Codex（主持人） / Epicurus（SQLite 索引） / Poincare（缓存与全局口径） / Copernicus（UsageEngine 候选，超时未产出）
**总轮次**：1 / 60
**结束原因**：首轮并行补证后已形成可交付共识；1 名候选参与者超时退出

## 执行元数据
- 候选参与者：Epicurus / Poincare / Copernicus
- 首轮实际启用：Epicurus / Poincare / Copernicus
- 后续 active participants：Epicurus / Poincare
- 淘汰参与者：Copernicus
- 不可用原因：首轮超时，主持人中断后仍未返回有效摘要，最终 shutdown

## 辩论背景
> 用户要求“多方合作补全细节”，目标不是重复已有结论，而是把 `nolon` 的 Codex usage 实现再往下钉三层：SQLite minute 索引、刷新进度接线、缓存与全局口径。主持人本地先读主链路，再把不同证据面并行分给参与者，避免单一路径遗漏。

## 各轮观点记录

### 第 1 轮
**[Epicurus]** 代码事实：`CodexSessionUsageIndex.swift:738` → 假设：`usage-index-v1.sqlite` 不是单表缓存，而是 `usage_entries + session_usage_minutes` 双层索引；`usage_entries` 负责文件级判定，`session_usage_minutes` 才是 minute 真源。  
**[Epicurus]** 代码事实：`CodexSessionUsageIndex.swift:190`、`CodexSessionUsageIndex.swift:273` → 假设：`fileMissing / cacheHit / deltaAppend / fullRebuild` 四个出口都已写死，且 `requestCount` 缺失会主动打断缓存复用。  
**[Poincare]** 代码事实：`CodexTokenTrendService.swift:73`、`CodexIntradayUsageService.swift:34` → 假设：Codex Usage 的“全局口径”不是文案层概念，而是代码里显式移除了 `CODEX_HOME`。  
**[Poincare]** 代码事实：`CodexTokenTrendService.swift:104`、`CodexSessionStore.swift:719` → 假设：当前手动刷新已不是“全量重投历史”，而是“先更新 usage index，再按 `affectedDayKeys` 回填受影响日期”。  
**[Codex - 主持人本地补证]** 代码事实：`ProviderUsageEngine.swift:405`、`ProviderUsageEngine.swift:420` → 假设：刷新状态卡片来自 `CodexSessionStore.performanceNotification`，不是 UI 自己猜阶段。  
**[Codex - 主持人本地补证]** 代码事实：`ProviderUsageEngine.swift:1177`、`ProviderUsageEngine.swift:1555`、`ProviderUsageEngine.swift:1659` → 假设：Usage 首屏先 hydrate cached snapshot，再 live refresh；intraday panel 自己的 refresh 也会回到整轮 `refreshTokenTrend()`。

## 最终结论与行动项

### 达成共识 / 裁定结论
- `nolon` 的 Codex usage 真源是 rollout/session JSONL，但真正支撑 UI 的不是文件扫描本身，而是 `CodexSessionUsageIndex` 持久化出来的 minute projection。
- `usage-index-v1.sqlite` 至少包含两层职责：`usage_entries` 负责文件级指纹、游标和摘要；`session_usage_minutes` 负责 minute 级 token/request 投影。
- `requestCount` 的口径是“1 个产生非零 token delta 的 `token_count` 事件记 1 次 request”，不是 HTTP request 数，也不是 message 数。
- `Codex Usage` 的全局口径是代码级事实：daily 和 intraday 服务都会主动移除 `CODEX_HOME`，回到默认 `~/.codex`。
- 刷新状态卡片并非 UI 推断，而是 `CodexSessionStore.performanceNotification -> ProviderUsageEngine.makeTokenTrendRefreshStatusData(...)` 的显式翻译。
- 当前最明确的文档/代码偏差是：设计文档写“手动刷新只回填最近两天”，但代码实际按 `affectedDayKeys` 回填所有受影响日期。

### 行动项
| # | 行动 | 负责方 | 截止 |
|---|------|--------|------|
| 1 | 将 SQLite 双层索引、refresh 接线、文档偏差补回当前 space README | Codex | 本轮完成 |
| 2 | 将“真实 `nolon` 路径 + affectedDayKeys 偏差”写入今日 memory | Codex | 本轮完成 |
| 3 | 后续若继续深挖，单独补一份 `CodexSessionUsageIndex` schema/增量策略对照文档 | 待定 | 后续 |

### 未解问题
- `CodexTokenTrendSnapshotCache` 的具体落盘文件路径与序列化格式，本轮未展开。
- `requestCount = 1` 在所有 `token_count` 事件场景下是否都严格等价于“单次用户可感知请求”，仍需更细的样本核对。
