# Codex Live Sessions UI 会话沉淀

## 背景

本轮围绕 `#frame=codex&workspace=live-sessions` 做了两类收敛：

1. 会话列表行从模型、状态、时长等运行指标收窄为用户指定的低噪声信息。
2. 详情页账号区的额度与余额展示改为复用账号卡片组件。

这属于 Codex runtime observability 的 UI 边界沉淀，不是新的 repo-wide 治理规则。

## 沉淀模式

### 1. 列表只承载操作者识别信息

Live sessions 的 feed 不是完整诊断表。默认行只展示：

- 项目名
- `account / http|ws`
- 右侧 session id

状态、模型、请求数、持续时间、TTFT、request id、execution id 和诊断摘要继续放在详情区。这样列表用于快速识别会话，详情用于排障。

如果右侧 session id 支持复制，它必须是独立点击目标，并阻止冒泡触发行选择。复制成功后要给出明确可见反馈，例如短暂切换为绿色 `已复制` / `Copied`，不能只依赖 title、控制台或不可见剪贴板状态。

### 2. `projectName` 必须端到端可选传递

项目名不是 sidecar runtime tracker 的必备真实源。当前应作为可选显示字段贯穿：

- `internal/wailsapp.CodexLiveSession`
- root `main.CodexLiveSession`
- `frontend/wailsjs/go/models.ts`
- `frontend/src/features/codex-live-sessions/model/types.ts`
- backend adapter

当字段不存在时，前端显示明确的未知项目文案，不从 session id 或 window id 伪造项目名。

### 3. 账号资源展示复用账号域组件

Live session detail 的账号区如果展示 quota / billing，不再复制私有 JSX。统一做法：

1. 把 live request 的 `quota` 转成 accounts 域 `QuotaDisplay`。
2. 把 live request 的 `billing` 转成全局 `BillingDisplay`。
3. 直接复用 `QuotaBars` 和 `BillingBalance`。

这能保持账号卡片、账号详情和运行会话详情在额度/余额上的视觉与语义一致。

### 4. 映射层要用纯函数测试锁住

新增或调整这类展示适配时，优先补纯函数测试：

- feed row summary 不应回显模型、状态、持续时间等噪声字段。
- quota adapter 应保留 label、remainingPercent、resetLabel / resetAtUnix。
- billing adapter 应保留 total / granted / topped-up 与 currency。

### 5. 时间线指标要按排障优先级露出首 token

请求时间线不是纯装饰条，而是可快速扫读的排障行。当前更合适的做法是：

1. 默认优先展示 `total`、`TTFT`、`first token` 这三枚主指标。
2. `stream`、`gap` 这类次级指标继续保留在更宽视口或详情区。
3. 视图断点应以“还能不能看清三枚主指标”为准，而不是按固定 `lg/xl` 机械隐藏。

这次改动只是在 timeline 行上把 `firstTokenLabel` 露出来，不代表要把所有次级耗时都前置到列表层。

### 6. 时间线行与详情壳层要避免“卡中卡”

Live sessions 的 detail 面板和筛选区本质上是工作台容器，不是再包一层大卡的内容块。当前更稳的做法是：

1. 筛选条、时间线列表、详情根容器保持同一视觉平面，不额外叠加一层 `border + shadow`。
2. 时间线 row 采用单行扫描式布局，`#序号 · model / request id / time range / 核心指标` 一行读完。
3. 诊断类长文本只留在 detail 内部的次级区块，不再默认显式渲染成底部独立大块。

这条边界适合继续放在 `gettokens-domain-engineering` 的 live sessions 小节里，不上升到 `AGENTS.md`。

### 7. 请求耗时趋势只投影当前 active request

请求耗时趋势图的数据应从请求记录推导，不能让视觉刷新本身成为数据来源。

稳定边界：

1. 已完成请求优先使用 `timing.totalDurationMs`；缺失时才回退到 `completedAt - startedAt`。
2. 当前 active request 可以用 `nowMs - startedAt` 做实时投影，用于显示正在增长的 live 样本。
3. 历史请求即使因为 cache 或 sidecar 残留仍带着 `streaming/reconnecting` 且没有 `completedAt`，也不能继续按 `nowMs` 投影；否则图上所有总耗时点会一起增长。
4. 纯模型仍负责过滤最近窗口内的请求点，但窗口语义是固定数量上限，不是固定时间段；窗口外请求不参与 y 轴最大值。
5. x 轴语义固定为请求序号：按 `startedAt` 排序后的最近请求以等距密集柱形展示，标签使用 `#sequence`，不能再把稀疏请求按真实时间拉开。
6. `sequence` 的真实源头在 CLIProxyAPI live tracker。内存裁剪只允许删除旧 request，不能把 retained requests 重新编号成 `1..50`；否则前端固定数量窗口永远只能显示到 `#50`，无法表达长会话继续推进。
7. 图表类型按 forward-moving audio waveform 处理：一柱一请求，最新 request 锚在右侧；宽容器显示更多最近请求，窄容器显示更少请求，不提供横向滚动或拖动。
8. 回归测试必须覆盖“stale streaming request + active request”并存时，只有 active request 增长，并覆盖固定数量窗口只保留最新请求；组件结构测试需覆盖非滚动 fixed viewport、请求序号 x 轴和一请求一柱边界。

这类问题不要先调 CSS 或动画。先检查纯模型输出：`points[].values.totalDurationMs` 与 `points[].isLive` 是否已经错误增长；如果模型输出错，修模型，不修图表。

### 8. 请求耗时趋势图更像音频波形，不像平滑面积图

最新的视觉反馈说明这块图如果画得太“顺”，会更像普通仪表盘趋势图，而不是 live sessions 里应该有的监护波形。现在更稳的表达是：

1. 保留 request timing 记录和 metric 驱动的 y 轴，但 x 轴改为请求序号等距排列，不再按 timestamp 间隔排布。
2. 图表一次只显示一个 timing metric，对应一组垂直振幅条；一根柱只代表一个 request，不再给同一个 request 生成副柱。
3. 下方“耗时”指标块负责维度切换，`总耗时 / TTFT / 首 token / 流式 / 排队 / 选号 / 连接 / 平均间隔 / 最大间隔` 都可以切换图表。
4. 仍然保留 live request 的光圈标记，让正在增长的样本一眼可见。
5. TTFT / first-token 等次级指标切换后也保持同一套音频波形语言，不再回到虚线趋势图或多线叠加。
6. 标签需要随请求序号向后推进，但窗口数据量保持恒定上限。新请求进入后丢弃最老请求，`最新样本` 和右侧轴标签从 `#50` 继续推进到 `#51/#52/...`。
7. 动画只表达状态变化：切换指标时整组波形短暂淡入，实时刷新时只让最新 live 点光圈轻微呼吸；不要每秒重扫整条波形。

### 9. 请求时间线只展示最近 15 条

`请求时间线` 是 detail 面板的扫描区，不是完整历史列表。完整历史仍由 detail/history 数据承载，但页面内只显示排序后的最近 15 条 request，标题行数也以实际展示数量为准，避免 live session 长时间运行后面板无限变长。

### 10. 耗时指标块展示趋势窗口平均值

请求耗时趋势图下方的“耗时”指标块是趋势窗口摘要，不是最新请求详情。稳定边界：

1. 指标块的 `总耗时 / TTFT / 首 token / 流式 / 排队 / 选号 / 连接 / 平均间隔 / 最大间隔` 取当前趋势窗口内可用值的平均值。
2. 当前 active request 的 `totalDurationMs` 仍按 `nowMs - startedAt` 投影后参与平均；历史 stale streaming request 不参与实时投影。
3. `输出/s`、`总计/s` 等速率类字段同样按趋势窗口请求平均，避免看起来像最新单次请求值。
4. 单次请求值继续留在请求时间线行与 chart footer 中，方便用户同时区分“窗口均值”和“最新样本”。

本轮 browser cache 验证中，最新请求时间线仍显示 `#50 总 8.0s / TTFT 562ms / 首 810ms`，而耗时指标块显示 `总耗时 7.1s / TTFT 740ms / 首 token 1.2s`，口径已区分。

### 10.1 耗时均值摘要由 sidecar 声明

趋势窗口平均值的权威口径应由 CLIProxyAPI live-session tracker 返回，而不是只在前端页面进入后临时解释。

稳定边界：

1. session 级 `timingSummary` 是耗时均值的优先数据源，窗口固定描述为 `retained_requests`。
2. summary 必须包含 `sampleCount`、`sequenceFrom / sequenceTo`、`activeIncluded`、`generatedAt` 和 `averages`，让 UI 可以解释样本范围与 active request 投影。
3. active request 只允许用 sidecar 的生成时刻投影 `totalDurationMs`；不要凭空生成 first event / first token 等未出现的字段。
4. 历史 stale streaming / reconnecting request 只能使用已记录 timing 或 `completedAt - startedAt`，不能因为 snapshot 刷新继续增长。
5. 前端 `resolveCodexLiveTimingMetricSummary` 优先使用 sidecar summary；缺失时才回退本地 retained request window 聚合，并在 UI 标记 `本地估算`。
6. summary 只能包含计数、序号、时间与速率字段，不能包含 payload、headers、token、cookie 或未脱敏错误体。

浏览器预览数据也应带 `timingSummary`，避免 preview 永远只覆盖 fallback 分支。结构差分合并时要把 `timingSummary.generatedAt` 和 active 投影导致的 summary 总耗时/流式耗时变化视为 clock-only refresh，避免高频轮询闪烁。

### 11. 右侧详情列要自包含滚动

长运行会话的详情内容会明显高于视口。宽屏双栏布局下，右侧详情列不能只靠外层 workbench 滚动访问底部，否则用户在请求耗时趋势或请求时间线附近滚动时，会把页头、搜索栏和左侧列表一起卷走。

稳定边界：

1. 右侧详情列继续保持 sticky，让详情上下文跟随左侧列表扫描。
2. sticky 容器本身设置 viewport 高度上限，并启用纵向内部滚动。
3. 使用 overscroll containment 阻止滚到详情列边界后继续把外层 workbench 带走。
4. 回归测试至少锁住详情列的 `max-height`、`overflow-y-auto` 与 overscroll containment，浏览器验收要检查 detail 容器为独立 scroll container。

### 12. 刷新用结构差分合并，不用整包替换

Live sessions 是高频轮询页面，刷新时不能把每秒变化的时钟字段当成整页数据变化。否则即使业务结构没有变，React 也会反复替换 snapshot、列表和详情引用，表现为会话列表与图表区域持续闪烁。

稳定边界：

1. `CodexLiveSessionsFeature` 加载 snapshot 后先进入纯模型合并层，而不是直接 `setSnapshot(next)`。
2. 仅 `generatedAt`、preview/cache 时间戳、active session duration、active request streaming duration 等时钟型变化时，复用旧 snapshot 引用。
3. 如果只有某个 session 或 request 发生结构变化，只替换该节点；未变化的 session / request 继续复用旧对象引用。
4. browser preview/cache 下的 detail polling 不应每秒重写 detail state；图表需要增长感时，通过 `nowMs` 投影当前 active request。
5. 回归测试要覆盖 clock-only refresh、cache preview clock refresh、局部结构变化三类场景，并验证未变化节点引用保持稳定。

本轮浏览器验收在 `#frame=codex&workspace=live-sessions` 的 CACHE 页面连续采样 4 次、约 3.6 秒，`来源 CACHE`、会话列表片段、`最新样本#50` 与页面滚动位置均保持稳定。

### 13. Preview timing 数据要模拟真实请求历史

5173 browser preview 是 live-session UI 的主要视觉验收入口。preview 数据不能只追求“看起来在动”，否则会把 mock 动画误判成真实运行态问题。

稳定边界：

1. completed preview requests 的 timing 必须从稳定身份生成，例如 `sequence`，不能从当前可见窗口 index 生成。滚动窗口从 `#1..#50` 变成 `#2..#51` 后，同一个 request 的 `totalDurationMs / TTFT / first token / gap / rate` 仍应保持不变。
2. preview 可保留一个 active/live request，但每秒变化只能影响这个最新样本。历史 completed bars 不应随 preview refresh 改变高度。
3. preview 数据应包含少量已完成慢请求 spike，用真实历史峰值承载 chart scale；不要让 live elapsed 每秒成为新的全局最大值，否则历史 waveform bars 会被重新缩放，看起来像所有柱体都在变化。
4. 结构差分合并需要忽略 preview live sample 的 clock-only timing/rate 变化，避免列表和详情区域因为 mock refresh 闪烁。
5. 回归测试至少覆盖：连续 1 秒刷新时 overlapping completed requests timing 不变；滚动 6 秒进入新 request 后 overlap 部分 timing 不变；live sample 低于 completed spike；浏览器 DOM 连续采样时只有最后一个 bar 几何变化。

本轮 5173 验收中，Playwright 连续采样 `1.5s` 得到 `barCount=50`、`changedCount=1`、`changedIndexes=[49]`、`dashed=0`，确认只有最后一个 live 样本变化。

## 不纳入

- 不新增独立 `gettokens-codex-live-sessions` skill；当前规则继续归入 `gettokens-domain-engineering` 的 Codex Live Sessions 小节。
- 不把这次视觉顺序、间距和具体 Tailwind class 升级为 AGENTS 规则。
- 不承诺 GetTokens 能从 Codex HTTP fallback 透明恢复到 WebSocket。

## 后续入口

- Codex live sessions / runtime observability：`.agents/skills/gettokens-domain-engineering`
- 文档与 memory 写回：`.agents/skills/gettokens-ops-governance`
- 会话沉淀：`.agents/skills/gettokens-ops-governance` 的 `Session Skill Distillation`

## 验证记录

本轮已通过：

- `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

Go focused test 曾被当前工作区其他变更阻塞过：`internal/accounts/auth_file_normalize.go` 缺少 `convertSessionLikePayloadToCPA`。后续提交 live sessions 改动时，应重新确认当前工作区是否已经恢复可编译。
