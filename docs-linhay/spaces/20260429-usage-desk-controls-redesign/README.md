# Usage Desk Controls Redesign

## 背景

- `Usage Desk` 已完成真实数据链、分钟级/天级切换、图表联动、索引刷新与本地投影进度反馈。
- 当前页面的控制栏、图表头和摘要排版已经具备功能闭环，但视觉层仍有继续精修空间。
- 本 space 用于承接后续前端设计精写，优先给 Gemini 使用。

## 目标

1. 在不破坏现有交互闭环的前提下，精修 `Usage Desk` 的控制栏与图表头设计。
2. 保持现有产品风格边界，不引入脱离 GetTokens 的独立视觉系统。
3. 明确交接边界：Gemini 主导前端视觉与布局精写，Codex 负责领域边界、接口契约、状态流转、测试门禁与最终集成。

## 范围

- `Usage Desk` 图表上方控制区
- `ChartSurface` 图表头部摘要区
- `Tokens / 请求数` 图表内 metric 切换区

## 非范围

- 不改 `ObservedRequestUsage / LocalProjectedUsage` 的领域定义
- 不改 `CLIProxyAPI` 或 `APP 层` usage 数据真源
- 不改 `Usage Desk` 现有时间范围、分钟级下钻、图表/表格联动规则

## 验收标准

1. `Usage Desk` 的控制栏与图表头视觉层完成精修，但不破坏现有领域闭环和交互路径。
2. 新稿继续保持 GetTokens 当前 app shell、黑白红 mono 视觉语义和 `Usage Desk` 的产品边界，不演变为独立站点或脱离现有信息架构的页面。
3. 本期只保留一个 HTML 设计稿入口；若需要对比多个方向，也在同一个文件内完成，不拆平行 HTML。
4. 进入实现后，Gemini 负责前端视觉与布局精写，Codex 负责领域边界、接口契约、状态流转、测试门禁与最终集成，职责不混淆。

## 2026-05-27 控制栏单行收纳补充

### 场景：宽屏工作台内控制栏优先保持一行

Given 用户打开 `#frame=codex&workspace=usage-codex` 的本地投影用量页
When 图表控制栏同时展示时间范围、视图切换和 `TOKENS / 请求数` 指标切换
Then 控制栏应优先通过更紧凑的间距、固定控件高度和不可换行布局保持单行显示
And 不应因为默认 `flex-wrap` 把时间范围单独挤到上一行。

### 场景：宽度不足时逐步收纳到菜单

Given 可用宽度不足以容纳全部控制项
When 页面继续缩窄
Then 低频的 `项目汇总 / 会话列表`、指标切换、时间范围/分钟粒度应按优先级进入 `更多` 菜单
And 主控制栏仍保持一行，不改变原有点击后的状态流转。

## 2026-05-27 默认汇总态与取消选中补充

### 场景：进入页面默认展示汇总信息

Given 用户打开 `#frame=codex&workspace=usage-codex` 的本地投影用量页
When 页面加载出天级或分钟级明细数据
Then 图表和明细表不应自动选中第一条数据
And 标题/面包屑应停留在汇总态，便于用户先查看整体信息。

### 场景：已选中的明细或图点可再次点击取消

Given 用户已点击某一天、某一分钟或对应明细行进入下钻/选中态
When 用户再次点击同一个图点或同一行
Then 当前选择应被清空
And 本地投影的会话下钻面板应回到图表汇总视图。

## 设计稿入口

- 本期设计稿：`design-preview.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260429-usage-desk-controls-redesign`
- worktree：`../GetTokens-worktrees/20260429-usage-desk-controls-redesign/`

## 交接约束

1. 后续由 Gemini 精写前端设计。
2. Codex 仅在以下场景介入：
   - 需要调整领域边界
   - 需要修改接口或状态模型
   - 需要补测试和回归验收
3. 若 Gemini 输出新稿，应优先落到本 space，再进入代码实现。

## 相关链接

- [design-preview.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-usage-desk-controls-redesign/design-preview.html)
- [Usage Dual Source Space](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md)
- [Usage Desk 图表层对齐说明](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260429-usage-desk-chart-layer-alignment.md)

## 当前状态

- 状态：archived-handoff
- 最近更新：2026-05-16
- 归档判定：本 space 是 Usage Desk 控制栏视觉精修交接稿，当前不作为独立开放需求排队；后续 Usage Desk 视觉改动如需重启，应进入新的实现 space 或并入当期主线。
