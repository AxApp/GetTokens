# Codex 实时运行会话详情

## 背景

当前 Codex 经 GetTokens relay / sidecar 请求时，每个运行会话和每次请求都存在可追踪标识，例如下游 WebSocket session、execution session、`x-client-request-id`、上游 request id、账号 auth id、模型、上下游 transport 等。

用户需要在 GetTokens 内实时查看“正在运行的 Codex 会话详情”，用于判断当前请求是否仍在跑、命中了哪个账号、是否发生 WebSocket 断开、是否已经从 WebSocket 降级为 HTTP，以及后续是否还能恢复。

现有 `session-management` 更偏本地 Codex 历史会话文件和 provider 映射管理；本需求不是历史会话管理，而是运行时观测能力，应归属到 `Codex` 一级工作区下的独立 tab。

## 目标

1. 在 Codex 一级 Tab 下新增 `live-sessions` 工作区，中文名称建议为“运行会话”。
2. 实时展示当前正在运行和最近完成的 Codex 会话、请求、账号路由、上下游连接状态。
3. 以请求标识为核心索引，支持按 session id、request id、模型、账号、transport、状态快速定位。
4. 明确展示 WebSocket 生命周期：下游连接、上游连接、重连、断开、错误、HTTP fallback 推断。
5. 展示请求级速率与耗时测量：queue、auth、connect、TTFT、first token、stream、total、平均/最长事件间隔、output tokens/s、total tokens/s、reconnect count。
6. 为排障提供可复制的诊断摘要，但默认脱敏 token、API key、完整 prompt、敏感 header 和本地绝对路径。

## 范围

### 信息架构

新增 Codex 工作区：

- `#frame=codex&workspace=live-sessions`
- 侧边栏位置：建议放在 `session-management` 之前或之后；若按实时性排序，放在 `account-list` 后、`session-management` 前。
- 不复用旧顶级 `session-management` 页面名称，避免把“实时运行状态”和“历史 session 文件”混在一起。

### 会话列表

每条运行会话至少展示：

- 会话标识：`executionSessionID` / downstream WebSocket session id / Codex window id（有则展示）。
- 当前状态：`active`、`streaming`、`reconnecting`、`degraded_http`、`completed`、`failed`、`cancelled`。
- 入口协议：`downstream=websocket|http`。
- 上游协议：`upstream=websocket|http|unknown`。
- 当前模型、请求数、最近请求 id、最近账号、开始时间、持续时间、最近事件时间。
- WebSocket 健康摘要：已连接、上游断开、等待 Codex retry、已推断 HTTP fallback。

### 请求详情

每次请求至少展示：

- `requestID`：统一展示 GetTokens 内部 request id、`x-client-request-id`、上游 request id（存在时）。
- 请求来源：Codex / model / source format / route policy / pinned auth。
- 命中账号：auth id、label、provider、credential source、代理 route。
- 生命周期：received、selected auth、upstream connect、first event、usage received、completed / failed。
- 传输状态：downstream transport、upstream transport、WebSocket connection reused、fallback inferred。
- usage：input/output/total tokens、reasoning tokens、缓存命中信息（存在时）。
- timing：queue wait、auth select、upstream connect、first event、first token、stream duration、total duration、average/max event gap、output/total token rate、reconnect count。
- 错误：错误类型、status、code、retryable、fallback 是否发生。

### 实时更新

第一期接受轻量轮询或 Wails event 推送；需求层要求：

- 页面打开后 1 秒内看到当前 active sessions。
- active session 状态变化延迟不超过 2 秒。
- completed / failed 会话保留最近一段时间，默认建议 30 分钟或最近 200 条，避免无限增长。
- 刷新页面后仍能看到 sidecar 内最近完成的运行摘要，不要求恢复完整事件流。

### 诊断摘要

详情页提供“复制诊断摘要”，内容包括：

- session id / request ids
- model / auth id / provider
- downstream/upstream transport
- lifecycle timeline
- fallback 推断原因
- 错误摘要

诊断摘要必须脱敏：

- 不包含 Authorization、API key、refresh token、完整 cookie。
- 不包含完整 prompt / tool input。
- 本地路径默认只展示 basename 或经过脱敏的路径标签。

## 非目标

1. 不改 Codex CLI 自身 WebSocket fallback 策略。
2. 不在本期实现“HTTP 自动恢复为 WebSocket”。
3. 不展示完整 prompt、完整 tool input、完整响应正文。
4. 不做请求重放、取消、强制切账号等控制型操作；第一期只读观测。
5. 不替代现有 `session-management` 历史会话管理。
6. 不要求跨 sidecar 重启持久化完整运行事件。

## 验收标准

### 场景 1：进入 Codex 运行会话 Tab

Given 用户打开 GetTokens
When 进入 `Codex -> 运行会话`
Then 页面展示运行会话列表、状态摘要、筛选工具和空状态。

### 场景 2：实时看到 WebSocket 会话

Given Codex CLI 通过 GetTokens 以 WebSocket 发起 `/v1/responses`
When 请求仍在运行
Then `运行会话` 中出现 active session，并展示 downstream=websocket、upstream=websocket、model、request id、auth id。

### 场景 3：查看请求级详情

Given 某个 active session 下存在多个请求
When 用户点击其中一个 request id
Then 详情区展示该请求的账号选择、上下游 transport、生命周期 timeline、usage 和错误摘要。

### 场景 4：上游 WebSocket 断开提示

Given 下游 WebSocket 仍连接，但上游 Codex WebSocket 断开
When sidecar 记录 `upstream_disconnected`
Then 会话状态变为 `reconnecting` 或 `upstream_disconnected`，详情 timeline 中显示断开时间、原因和受影响 request id。

### 场景 5：Codex HTTP fallback 推断

Given 同一 Codex window/session 先出现 downstream WebSocket 请求
When 后续请求变为 HTTP `POST /v1/responses`
Then 页面将该 session 标记为 `degraded_http`，并提示“推断 Codex 已降级到 HTTP，本会话内可能不会自动恢复 WebSocket”。

### 场景 6：最近完成会话保留

Given 某个请求已完成
When 用户在完成后 30 分钟内进入页面
Then 仍能看到该会话摘要和最后一条请求详情，但不会保留完整敏感 payload。

### 场景 7：搜索请求标识

Given 用户手里有某个 request id
When 在搜索框输入完整或部分 request id
Then 列表过滤到对应 session / request，并高亮匹配标识。

### 场景 8：脱敏复制诊断

Given 用户打开请求详情
When 点击复制诊断摘要
Then 复制内容包含请求链路和状态判断，但不包含 token、API key、cookie、完整 prompt 或完整 tool input。

### 场景 9：sidecar 未就绪

Given sidecar 状态不是 ready
When 用户进入运行会话页
Then 页面显示无法读取实时会话，并保留最近缓存摘要；不误报为没有运行会话。

### 场景 10：大并发不会撑爆 UI

Given 最近存在大量请求
When 页面加载运行会话
Then 首屏只渲染必要数量，支持分页或虚拟列表，不因全量事件同步渲染卡顿。

### 场景 11：速率与耗时排障

Given 某个 Codex 请求正在运行或已完成
When 用户打开请求详情
Then 详情区展示 Rate / time measurements，并包含 TTFT、first token、stream duration、total duration、output tokens/s、total tokens/s 和 reconnect count；复制诊断摘要也包含同一组脱敏 timing 字段。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。
- UI / 设计系统方案：`plans/20260521-live-session-detail-ui-design-system-plan.md`

## Worktree 映射

- branch：`feat/20260521-codex-live-session-detail`
- worktree：`../GetTokens-worktrees/20260521-codex-live-session-detail/`

## 相关链接

- Codex 页面入口：[CodexPage.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/pages/CodexPage.tsx)
- Codex workspace 类型：[types.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/types.ts)
- Codex workspace 持久化：[pagePersistence.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/utils/pagePersistence.ts)
- 技术计划：`plans/20260521-live-session-detail-technical-plan.md`
- 详细技术调研：`plans/20260521-live-session-detail-technical-research.md`
- UI / 设计系统方案：`plans/20260521-live-session-detail-ui-design-system-plan.md`
- Sidecar Responses WebSocket handler：`docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- Sidecar Codex WebSocket executor：`docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
- 参考调研：`nolon/docs-linhay/spaces/codex-sessions-tab/readme.md`

## 当前状态
- 状态：real-sidecar-snapshot-connected
- 最近更新：2026-05-21

## 2026-05-21 实现进展

- 已从前端 mock 推进到真实只读数据链路：CLIProxyAPI fork 新增 `gettokenshooks` 内存 live session tracker，并通过 `/v0/management/gettokens/live-sessions` 暴露 snapshot。
- tracker 已接入 Codex Responses WebSocket 下游 handler、Codex WebSocket 上游 executor 和 usage record；默认保留 30 分钟 / 最近 200 条摘要。
- GetTokens Wails 新增 `GetCodexLiveSessionsSnapshot`，root `main.App`、DTO、mapper 与 `frontend/wailsjs` 已同步。
- 前端 `CodexLiveSessionsFeature` 在桌面环境 sidecar ready 后每 2 秒拉取真实 snapshot；浏览器或 binding 不存在时继续使用 preview/mock。
- 当前仍为只读观测：不做请求取消、重放、强制 WebSocket 恢复，不展示完整 payload。

## 2026-05-22 页面整理

- 页面信息架构收敛为左右工作台：左侧 `SessionFeed` 聚合 conversation 会话列表，右侧 `SessionDetail` 固定展示当前会话诊断，不再在列表行内展开详情。
- `CodexLiveSessionsWorkbench` 只保留筛选、选中、复制诊断与页面编排；统计条、列表、详情和格式化工具分别拆到独立组件文件，便于后续维护。
- 选中逻辑统一使用 `getSelectedCodexLiveSession`：显式 `conversation_id` 存在时优先展示，过滤后失效或未选择时自动回落到当前列表第一条。
- 保持正式版真实数据链路不变；mock 仍仅用于浏览器 preview / Storybook。
- 验证：`npm --prefix frontend run typecheck`、`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run build`、`git diff --check` 已通过；Playwright / Chrome DevTools 本地页面验收因工具审批超时未拿到截图或 DOM 快照。

## 2026-05-26 请求时间线三指标对齐

- 请求时间线行的默认可见指标固定为 `总 / TTFT / 首`，与当前 dev 验收图一致；次级 `流` 指标只在更宽视口显示。
- 回归测试锁定前三个指标不再被 `sm` 断点隐藏，避免线上版退回只显示总耗时。
- 验证：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 通过；浏览器按 1192x964 视口复验，5 条请求行均可见 `总 / TTFT / 首`。

## 2026-05-26 请求时间线倒序

- 请求时间线列表按请求开始时间倒序展示，最新请求在上方，便于先看当前或最近一次请求。
- 排序在 `requestTimelineSummary` 纯模型层完成，组件渲染不突变原始 `session.requests`，同时间戳按 sequence 倒序兜底。
- 验证：新增 `sortRequestTimelineRequests keeps newest request rows first without mutating input` 回归测试；浏览器复验 `#5 -> #4 -> #3 -> #2 -> #1`。

## 2026-05-26 耗时指标降噪

- 请求详情里的“耗时”面板按用户关注顺序展示：`总耗时 / TTFT / 首 token / 流式` 先出现，再展示 `排队 / 选号 / 连接 / 平均间隔 / 最大间隔 / 重连 / 输出/s / 总计/s`。
- 空值指标不再占位显示 `n/a`，主表只渲染有值的项；若整组都没有耗时数据，则显示单行空态。
- 验证：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 通过；浏览器复验主耗时面板不再出现 `n/a`。

## 2026-05-26 请求耗时趋势投影边界

- 图表总耗时曲线的数据来源是请求级 timing：已完成请求使用 `timing.totalDurationMs` 或 `completedAt - startedAt`，当前仍在运行的请求才用 `now - startedAt` 做实时投影。
- 修复：如果历史请求仍带着 `streaming/reconnecting` 且缺少 `completedAt`，前端不再把它们全部按 `now` 投影；只有当前 active request 可以增长并显示 live 标记。
- 验证：新增 `buildCodexLiveRequestTimingTrend only projects the current active request` 回归测试；浏览器观察 2.2 秒，历史点 `6.0s / 5.9s / 9.2s / 4.6s` 保持不变。

## 2026-05-26 请求耗时趋势视口跟随

- 图表视口默认跟随最新 request sample；只有新的请求时间戳进入时才滚到最新点，普通 `nowMs` 刷新不会让 x 轴视口持续前进。
- 用户横向滚动或拖动图表查看历史后，自动跟随暂停；用户回到最右侧后恢复跟随最新点。
- 验证：新增 `codex live session timing chart follows latest samples unless user pans history` 结构回归测试；浏览器确认图表容器为横向可滚动/可拖动，并保留最新点在右侧。

## 2026-05-27 请求耗时趋势少量数据首帧对齐

- 修复少量 request sample 时图表首帧可能出现文字/点位与柱形不对齐的问题：`TimingTrendChart` 改为 `useLayoutEffect` 测量容器宽度，并在测量完成前隐藏绘制层，避免首帧以 `320px` fallback 坐标绘制后被真实容器拉伸。
- SVG `viewBox` 与 HTML overlay marker 统一使用已测得的 `chartWidth`，不再使用 `chartWidth || 0` 参与坐标计算，避免宽屏或窄屏下 SVG 与绝对定位层落入不同坐标系。
- 回归测试：`codex live session timing chart uses a fixed viewport without horizontal panning` 新增测量门禁断言；验证 `node --test src/features/codex-live-sessions/model.test.mjs`、`npm run typecheck`、`npm run build` 通过。
- 浏览器验收：本地 `http://localhost:5173/#frame=codex&workspace=live-sessions` 复验 `shellWidth=884`、`svg viewBox=0 0 884 224`、选中 marker 与 SVG 圆点 X 轴中心差 `0px`。
- 截图证据：`docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/20260527/live-sessions/20260527-live-sessions-timing-trend-after-v01.png`。

## 2026-06-04 会话列表表头与右侧总览校正

- 产品语义校正：左侧 `SessionFeed` 只保留会话列表，不再通过点击表头切换到请求列表视图。
- 交互补充：点击左侧 `SessionFeed` 表头会清空当前会话选中态并回到右侧请求汇总；点击会话行仍进入单会话详情。
- 表头统计恢复为列表汇总：显示当前筛选后会话数与全部请求数，例如 `N 个会话 · M 个请求`；请求仍可通过搜索 request id 定位到所属会话。
- 右侧未选中会话时不再自动打开第一条会话详情，而是展示当前列表的请求总览；总览保留紧凑汇总卡片、请求耗时趋势图和请求列表，不再展示原整块统计条。
- 清空入口移到页面顶部操作区；左侧会话列表表头不再承载清空按钮。
- 图表数据来源修复：未选中会话的总览会额外加载不带 `session_id` 的全局 `GetCodexLiveSessionHistory({ sessionID: '', window: 'all', limit: 80 })`，避免真实 live snapshot 不携带 embedded request timing 时总览图表空白。
- 回归测试：新增 `codex live session feed header summarizes all requests without switching to a request view` 与 `codex live sessions workbench keeps the right pane as overview until a session is selected`。
- 验证：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck` 通过；无头浏览器打开 `http://127.0.0.1:5173/#frame=codex&workspace=live-sessions` 验证顶部有清空按钮、左侧表头区点击后显示汇总、右侧标题为 `请求总览 / 请求耗时趋势 / 请求列表`、图表线条存在、图表点数为 31、页面无“切换至请求”。
- 截图证据：`docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/20260604/live-sessions/20260604-live-sessions-nav-after-v03.png`。

## 2026-06-04 Open Design 参与的总览卡片化修正

- Open Design 状态：用户启动后本机 `od status --json` 正常，版本 `0.8.0`，可读取 design-systems registry；本轮选取 `ant` 作为数据密集桌面工作台参考，采用其 4/8/12/16 间距、清晰层级和一致网格原则，不引入新的品牌色。
- 设计判断：`SessionOverview` 原第 165 行是整块信息条，`运行总览 / 请求总览 / 会话请求状态串` 挤在同一平面，不利于扫读。改为 4 个同级卡片：身份说明、请求总量、运行态、风险态；后续按用户反馈把卡片最小高度从 `9rem` 压到 `5.75rem`，移除 identity 卡里的说明长句，浏览器实测整排高度 `92px`。
- 样式复用：汇总图表改为 `OverviewTimingTrend`，复用会话详情的 `TimingTrendChart`、footer 指标条和 header 排版；汇总请求列表删除自定义行，改为复用会话详情 `Timeline` 请求时间线样式。
- 验证：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck` 通过；无头浏览器验证 summary cards=4、cardHeights=`[92,92,92,92]`、图表 line path 存在、pointCount=41、timeline 文本显示 `请求时间线 15 行`、trend/timeline shell 均为 `session-style`。
- 截图证据：before `docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/20260604/live-sessions/20260604-live-sessions-summary-before-v01.png`；after `docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/20260604/live-sessions/20260604-live-sessions-overview-after-v06.png`。

## 2026-06-04 会话列表表头回汇总交互

- 用户补充：`SessionFeed` 表头应当可点击显示汇总。
- 实现：`SessionFeed` 表头从静态 `div` 改为 `div role="button"`，新增 `data-codex-session-feed-overview-trigger="true"` 与 `aria-pressed`；`CodexLiveSessionsWorkbench` 传入 `onShowOverview={() => setSelectedSessionID(undefined)}`，只清空会话选中态，不恢复请求列表视图切换。表头总览态与会话行选中态统一使用 `codex-live-session-list-item-selected`，避免出现独立选中样式；选中态加重为 `text-primary 12%` 背景并带 3px 左侧 rail。
- 验证：无头浏览器点击第一条会话后 `selectedRows=1`、`aria-pressed=false`、右侧离开汇总；再点击表头后 `selectedRows=0`、`aria-pressed=true`、右侧出现 `请求总览` 与 `请求耗时趋势`。等待 `transition-colors` 结束后，表头总览态与会话行选中态 computed background 均为 `color(srgb 0.88 0.88 0.88)`，box-shadow 均为 `rgb(0, 0, 0) 3px 0px 0px 0px inset`。
- 截图证据：`docs-linhay/spaces/20260521-codex-live-session-detail/screenshots/20260604/live-sessions/20260604-live-sessions-overview-after-v08.png`。
