# Codex 运行会话项目聚合实施计划

## 阶段 0：边界确认

- 确认 project 信息来源：sidecar 已有字段、Codex runtime 字段、Wails 派生，或 unknown fallback。
- 确认是否需要在 sidecar management API `/gettokens/live-sessions` 增加 `projects` 字段。
- 确认项目 label 脱敏规则：basename、相对 label、hash 后缀、unknown project。

## 阶段 1：红灯测试

- Go：live sessions project aggregation fixture，覆盖多项目和 unknown project。
- Go：root Wails DTO 映射测试，防止绑定类型缺字段。
- TS：project summaries selector 测试。
- TS：搜索 + 状态 + transport + project 组合筛选测试。
- Browser：preview DOM 断言导航区维度切换、项目维度列表、项目选择、脱敏。

## 阶段 2：数据契约实现

- 在 sidecar 或 Wails snapshot 层产生 `projects` 聚合结构。
- 保留原 `sessions` 扁平列表，避免破坏现有详情逻辑。
- 更新 `app_types.go`、`app.go` mapper、`frontend/wailsjs/go/models.ts`。

## 阶段 3：前端模型与 UI

- 新增 `CodexLiveProjectSummary` 前端模型。
- 抽出项目筛选 selector，避免在组件里重复 filter。
- 在导航区增加 `会话` / `项目` 维度切换，避免在主体区域增加项目 rail 或侧栏。
- `项目` 维度下主体列表展示项目聚合行；点击项目行后右侧切换为该项目汇总。
- 会话行补短项目 tag；详情头部补所属项目。
- 当前 session 不可见时清理详情选择。

## 阶段 4：验收

- `go test` 聚合/映射相关测试。
- `npm --prefix frontend run test:unit -- ...` 或等效单测。
- `npm --prefix frontend run typecheck`。
- 无头浏览器验收并保存截图。
- 如触碰 Wails 绑定或 sidecar，完成 dev App 验收；不得触碰正式版 GetTokens。

## 风险与规避

1. **项目来源不稳定**：优先明确 `projectID` 来源；来源缺失时进入 `unknown`，不猜测 prompt/path。
2. **前端重复聚合导致状态不一致**：优先由 sidecar/Wails DTO 提供聚合，前端只做筛选视图派生。
3. **同名项目混淆**：使用脱敏 path label 或 hash 后缀区分。
4. **详情 hash 残留**：项目切换和筛选后主动校验 selected session 是否仍可见。
5. **正式版误操作**：只在 dev 环境与仓库构建产物验证。

## 布局修正记录

2026-06-04 根据用户反馈，废弃左 / 中 / 右三栏设想。第一轮收敛为项目 chips，但用户进一步指出只需要在导航区支持切换维度。因此最终收敛为：运行会话页面 Header 区域提供 `会话` / `项目` 维度切换；主体区域始终只有一个列表。`会话` 维度展示 session rows，`项目` 维度展示 project aggregation rows，点击项目行后右侧切换为该项目汇总。

## 实施记录（2026-06-04）

### 已落地

1. Space 已整理为最终信息架构：Header `会话` / `项目` 维度切换，主体保持“左侧列表 + 右侧汇总详情”的现有运行会话布局。
2. 新增前端维度状态：`CodexLiveSessionsView = session | project`。
3. 运行会话页面 Header actions 区域展示 `会话` / `项目` 维度，并支持 hash 恢复：`view=project`。
4. `会话` 维度沿用现有 session rows；会话行仍展示短项目 tag。
5. `项目` 维度左侧展示 project aggregation rows；点击项目行不进入下级列表，只选中项目并让右侧汇总详情切换到该项目范围。
6. 项目聚合首版基于现有 `CodexLiveSession.projectName` 字段在前端 selector 显式派生，未改 sidecar management API，也未新增 Wails DTO 字段。
7. 补充测试覆盖：项目聚合 health/counts、live sessions view 存储/读取、hash 解析与序列化。

### 验证

- `npm --prefix frontend run test:unit -- src/features/codex-live-sessions/model.test.mjs src/utils/pagePersistence.test.mjs` 通过；由于当前 `test:unit` 脚本固定跑全量列表，本次实际覆盖全量前端 unit，并额外重复指定的两个文件。
- `npm --prefix frontend run typecheck` 通过。

### 未做

- 未改 sidecar / Go / Wails 绑定；本轮复用已有 `projectName` 数据。
- 未运行 Wails 桌面实机验收；本轮改动为前端导航、selector 与 hash 状态，尚未启动 dev App。
- 未新增浏览器截图；如进入视觉确认，再补无头浏览器截图到本 space 的 `screenshots/`。

### 浏览器验收补充（2026-06-04）

- 启动本地 Vite dev：`npm --prefix frontend run dev -- --host 127.0.0.1 --port 34115`，因 34115 被占用自动落到 `http://127.0.0.1:34116/`。
- 使用 Playwright CLI 无头打开：`http://127.0.0.1:34116/#frame=codex&workspace=live-sessions&view=project`。
- DOM snapshot 确认运行会话 Header 内存在 `会话` / `项目` 维度，且 `项目` 处于 pressed 状态。
- DOM snapshot 确认主体展示 `项目运行态` 列表；点击 `GetTokens` 项目行后左侧仍保持项目列表，右侧显示该项目汇总、耗时趋势和请求列表。
- 截图：`screenshots/20260604/live-sessions/20260604-live-sessions-project-after-v01.png`。
- 控制台仅有 Vite/browser preview 下的 `favicon.ico 404`，不影响本功能验收。


### Header 位置修正（2026-06-04）

用户在浏览器评论中明确指出维度切换不应放在左侧 sidebar 的 `运行会话` 子菜单下，而应放在页面顶部 `WorkspacePageHeader` 区域。已移除左侧 sidebar 内的 `会话` / `项目` 二级按钮，改为在运行会话 Header actions 区域展示维度切换；hash 与主体列表行为不变。截图更新：`screenshots/20260604/live-sessions/20260604-live-sessions-project-after-v02.png`。

### Project row click behavior correction（2026-06-04）

根据浏览器评论，项目聚合行点击不应进入下级列表。已改为：左侧保持项目聚合列表并高亮选中项目，右侧 `SessionDetail` overview 区域直接切换为该项目范围的汇总卡片、耗时趋势和请求列表；不显示 `返回项目`，也不渲染项目内会话子列表。截图更新：`screenshots/20260604/live-sessions/20260604-live-sessions-project-after-v03.png`。

### Session trend style alignment（2026-06-04）

根据浏览器评论，选中会话后的右侧 `请求耗时趋势` 模块需要与左侧会话列表卡片风格一致。已将 `RequestTimingTrend` 从裸 section 调整为 session-style 卡片壳：外层使用同类弱边框、`bg-main`、轻 shadow；标题区使用独立 header 和底部分隔；图表与 footer 放入内容区。截图：`screenshots/20260604/live-sessions/20260604-live-sessions-session-trend-after-v01.png`。

### Overview trend style alignment（2026-06-04）

根据浏览器评论，运行总览状态下的 `请求耗时趋势` 与选中会话状态下的趋势模块不能出现两种视觉样式。已将 `OverviewTimingTrend` 也统一为同一套 session-style 卡片壳，并移除外层旧 wrapper：同类边框、`bg-main`、轻 shadow、header 分隔、内容区内边距与 footer 分隔。截图：`screenshots/20260604/live-sessions/20260604-live-sessions-overview-trend-after-v01.png`。

### Request timeline style alignment（2026-06-04）

根据浏览器评论，请求时间线 / 请求列表在运行总览和选中会话状态下也存在多套样式。已将 `Timeline` 自身统一为 session-style 卡片壳，并移除 overview 外层旧列表 wrapper；同时去掉 `min-h-[320px]`，避免单请求会话出现大块空白。overview 可传入 `请求列表` 标题，选中会话默认使用 `请求时间线` 标题；两者共用同一行样式、边框、背景、header 和滚动容器。截图：`screenshots/20260604/live-sessions/20260604-live-sessions-timeline-style-after-v01.png`。
