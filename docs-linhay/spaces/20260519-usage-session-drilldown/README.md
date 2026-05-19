# Usage Session Drilldown

## 背景
`Usage Desk` 当前已经把 Codex 用量拆成两条链路：

1. `真实请求量 / observed`：来自 sidecar `GetSidecarUsageAttribution`，以账号归因、请求桶和 token 字段为主。
2. `本地投影用量 / projected`：来自本机 Codex rollout/session JSONL，经 `GetCodexLocalUsage` 扫描后写入本地 SQLite usage index。

用户希望明确 `frontend/src/features/accounts/components/usage-desk/UsageDetailTable.tsx` 里的用量明细与上方图表之间的关系，并评估：点击某条用量时，是否能展示相关会话列表；会话列表是否能标注每个当前会话的用量。

## 目标
1. 梳理 `UsageDetailTable`、图表点、用量聚合、会话管理之间的真实数据关系。
2. 判断点击用量下钻到会话列表的可行性。
3. 明确要让会话列表显示“当前会话用量”需要补哪些后端 DTO、前端模型和交互状态。
4. 给出后续实现前的 BDD/TDD 验收边界。

## 范围
1. Codex `Usage Desk` 的 `observed` 与 `projected` 两条数据源。
2. `UsageDetailTable` 点击行与 `UsageChartCard` 选中点之间的联动。
3. `session-management` 已有会话列表与详情能力。
4. 本地 usage index 中 `rollout_path` 与 session 文件的关联能力。

## 非目标
1. 本轮不把会话下钻扩展到 `observed / 真实请求量`。
2. 不把 `observed` sidecar 真实请求量强行映射到本地 Codex session；当前 observed 没有稳定 session id。
3. 不把 quota / 配额窗口混入 session usage；配额仍是独立领域。

## 当前实现关系
1. `UsageDetailTable` 本身只是表格壳：外层 `div` 位于 `UsageDetailTable.tsx:76`，负责横向滚动和边框；表格行点击只调用 `onSelectRow(rowKey, chartPointKey, drilldownDayKey)`。
2. 表格和图表共享同一组聚合数据：`useUsageDeskFeature` 先构造 `observedSnapshot` / `projectedSnapshot`，再派生 `activeDetailRows` 与图表 points。
3. 当前“绘图/图表”和“用量表格”的联动键只有 `timeLabel`：
   - 表格行通过 `resolveUsageDeskChartSelectionKey(row)` 得到 `timeLabel`。
   - 图表点点击后用 `resolveUsageDeskLinkedRowKey(activeDetailRows, chartSelectionKey)` 找回同一时间桶的行。
4. 这意味着当前点击不是“打开会话”，而是“选中同一个日/分钟 bucket”。
5. `projected` 后端索引已经按 `rollout_path + minute_start_timestamp + model` 保存分钟用量；但 `LocalProjectedUsageDetail` 当前只返回 `timestamp/model/inputTokens/cachedInputTokens/outputTokens/requestCount`，没有把 `rollout_path` / `sessionID` 暴露给前端。
6. `session-management` 已经能按 session 文件列出会话，并且 session id 本质上也是 Codex home 下的相对 JSONL 路径。它和 usage index 的 `rollout_path` 是可对齐的同一类标识。

## 可行性结论
可以做，但首版应优先落在 `projected / 本地投影用量`：

1. `projected` 可行：本地 usage index 已有 `rollout_path`，只需要把它保留到 DTO 或新增按 bucket 查询接口，就能从用量 bucket 反查相关 session。
2. 会话列表可注明当前会话用量：按点击的日/分钟 bucket 聚合 `rollout_path` 下的 `input/cached/output/requestCount`，再与 `session-management` 的 session summary join，列表行展示 `请求数 / 总 tokens / 输入 / 缓存 / 输出 / 模型`。
3. `observed` 暂不适合做 session 列表：sidecar attribution 当前有 `accountKey/attributionKey/provider/model/buckets`，但没有本地 Codex JSONL session id。可以保留点击选中和账号归因说明，不承诺 session 下钻。
4. 不建议在前端靠时间范围去猜 session：同一分钟可能有多个 session、多个模型，也可能有 archived session；应以后端 `rollout_path` 为准，避免误归因。

## 建议方案
### 方案 A：在现有 LocalProjectedUsageResponse 中透出 session id
1. 给 `LocalProjectedUsageDetail` 增加 `sessionID` 或 `rolloutPath`。
2. 前端 `UsageDeskProjectedDetail` 保留该字段。
3. 构造 projected snapshot 时，除了 `minuteRows`，同步构造 `drilldownSessionsByBucket`。
4. `UsageDetailTable` 行点击后显示一个同页下钻面板，列出该 bucket 关联 session 及每个 session 的当前 bucket 用量。

优点：改动小，能直接复用现有扫描结果。
风险：`GetCodexLocalUsage` 返回体会变大；全量详情继续一次性给前端。

### 方案 B：新增按 bucket 查询接口
1. 新增 Wails API：`GetCodexLocalUsageSessions(input)`。
2. input 至少包含 `dayKey/minuteKey/range/resolution`，可选 `model/provider`。
3. 后端直接查 SQLite `session_usage_minutes_v2`，返回 session 聚合用量和 session summary。
4. 前端只在点击用量时懒加载会话列表。

优点：更适合长期数据量增长，列表可以带分页或 limit。
风险：新增 API、DTO、缓存失效与测试面更大。

首版建议采用方案 A；如果真实用户数据量导致响应过大，再演进到方案 B。

## BDD 验收标准
### 场景 1：点击 projected 日级用量出现会话列表
Given 用户在 Codex Usage Desk 选择 `本地投影用量`
When 点击某一天的用量行
Then 页面展示该日关联的 Codex 会话列表
And 每个会话行显示当前日内的请求数与 token 用量。

### 场景 2：点击 projected 分钟用量出现会话列表
Given 用户切换到 `分钟明细`
When 点击 `14:20` 这一分钟用量行
Then 页面展示该分钟内有 token delta 的会话
And 会话行标注该分钟内的输入、缓存、输出与总 token。

### 场景 3：多个会话同一分钟用量不混淆
Given 同一分钟内两个 session 都产生 token_count delta
When 用户点击该分钟用量
Then 会话列表展示两条 session
And 每条 session 的用量只来自自己的 `rollout_path`。

### 场景 4：observed 数据源不伪造会话
Given 用户选择 `真实请求量`
When 点击某个 observed 用量行
Then 页面只保持账号归因 / 时间 bucket 选中状态
And 不展示“本地会话列表”，除非后端提供稳定 session id。

### 场景 5：本期只做本地模式
Given 用户选择 `真实请求量 / observed`
When 点击任意 observed 用量行
Then 页面不尝试展示本地会话列表
And 不通过时间范围猜测 session 归因。

## TDD 切入点
1. Go：补 `internal/wailsapp/usage_local_test.go`，验证 local usage detail 能保留 `rollout_path` 并按 session 聚合。
2. 前端 model：补 `frontend/src/features/accounts/tests/usageDesk.test.mjs`，验证 projected snapshot 可从同一分钟多 session 构造 session drilldown。
3. 前端交互：补 Usage Desk hook / component 测试，验证点击行后选中 bucket 并显示 session usage list。
4. Session join：复用 `session-management` 的 mapper，避免另起一套不一致的 session summary 字段。

## 实施结果
1. `LocalProjectedUsageDetail` 已新增 `sessionID`，由后端本地 usage index 的 `rollout_path` 透出到 Wails DTO 与前端 generated model。
2. `UsageDeskProjectedDetail` 保留 `sessionID`，`buildUsageDeskProjectedSnapshot` 同步构造：
   - `sessionUsageByDayKey`
   - `sessionUsageByBucket`
3. `UsageDeskFeature` 在 `本地投影用量 / projected` 下新增 `会话列表` surface 选项，与 `天级趋势 / 分钟明细` 同组切换。
4. `UsageSessionDrilldownPanel` 嵌入 `UsageChartCard` 的 chart surface 区域；点击 projected 用量表格行时会自动切换到 `会话列表`。
5. 下钻面板展示当前选中日级或分钟级 bucket 内的会话列表，并标注每个 session 的模型、请求数、Token、输入、缓存、输出。
6. `真实请求量 / observed` 不展示本地会话下钻，保持原有账号归因和时间 bucket 选中语义。

## 验证记录
1. 红灯确认：
   - `go test ./internal/wailsapp -run TestGetCodexLocalUsageAggregatesTokenCountDeltas` 初始失败，原因是 `LocalProjectedUsageDetail` 缺少 `SessionID`。
   - `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs` 初始失败，原因是 projected detail 丢 `sessionID` 且 snapshot 缺少 session bucket 聚合。
2. 绿灯验证：
   - `go test ./internal/wailsapp`
   - `go test ./...`
   - `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs`
   - `npm --prefix frontend run test:unit -- src/features/accounts/tests/usageDesk.test.mjs`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
3. 浏览器预览：
   - URL：`http://127.0.0.1:5173/?preview=usage-codex#frame=codex&workspace=usage-codex`
   - 预览 localStorage：`gettokens.usageDesk.source=projected`
   - 结果：`LOCAL SESSIONS` 面板可见；当前 `05-15` bucket 展示 2 个本地会话，并标注请求、Token、输入、缓存、输出。
   - Console 仅有既有 `favicon.ico 404`，无新增业务错误。
4. 追加交互验收：
   - `会话列表` 作为 projected chart surface 的第三个切换选项出现。
   - 点击 `会话列表` 后，`LOCAL SESSIONS` 出现在原图表区域，表格下方不再重复展示会话面板。
   - 从 `天级趋势` 点击 `05-14` 用量表格行后，chart surface 自动切换到 `LOCAL SESSIONS`，标题更新为 `本地会话 / 05-14`。
5. 表格化修正：
   - `UsageSessionDrilldownPanel` 的会话内容区已改为真实 `table`，列顺序固定为 `会话 / 模型 / 请求 / Token / 输入 / 缓存 / 输出`。
   - 嵌入 chart surface 时保持 280px 高度并在内部滚动，避免会话数增加时撑开趋势卡片。
6. 紧凑显示修正：
   - 第一列改为 `会话来源`，显示 `Codex 本地会话 · <短文件名>`；完整 `sessions/...jsonl` 路径只保留在 hover title，不再直接占据单元格内容。
   - 表格行高从约 52px 压缩到约 30px，减少 chart surface 内的无效高度。
7. 项目归属修正：
   - 后端 `LocalProjectedUsageDetail` 新增 `projectName`，从 Codex session JSONL 的 `session_meta.cwd` / `turn_context.cwd` / git repository 推导项目名。
   - SQLite 本地 usage index 增加 `project_name` 缓存列；旧索引 cache hit 时会轻量回填项目名。
   - 会话表第一列只显示项目归属名，缺失时显示 `未知项目`；session 路径只保留在 hover title。

## 截图
1. `screenshots/20260519/usage-desk/20260519-usage-desk-local-session-drilldown-after-v02.png`
2. `screenshots/20260519/usage-desk/20260519-usage-desk-local-session-chart-surface-after-v03.png`
3. `screenshots/20260519/usage-desk/20260519-usage-desk-local-session-table-surface-after-v04.png`
4. `screenshots/20260519/usage-desk/20260519-usage-desk-local-session-compact-source-after-v05.png`

## 调研代码索引
- 用量表格入口：`frontend/src/features/accounts/components/usage-desk/UsageDetailTable.tsx`
- 图表和表格状态：`frontend/src/features/accounts/hooks/useUsageDeskFeature.ts`
- 用量聚合模型：`frontend/src/features/accounts/model/usageDesk.ts`
- Usage Desk 页面：`frontend/src/features/accounts/UsageDeskFeature.tsx`
- 本地 usage 后端：`internal/wailsapp/usage_local.go`
- session 管理后端：`internal/wailsapp/session_management.go`
- session 管理前端 API：`frontend/src/features/session-management/api.ts`
- 历史结论：`docs-linhay/memory/2026-04-28.md`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260519-usage-session-drilldown`
- worktree：`../GetTokens-worktrees/20260519-usage-session-drilldown/`

## 相关链接

## 当前状态
- 状态：implemented
- 最近更新：2026-05-19
