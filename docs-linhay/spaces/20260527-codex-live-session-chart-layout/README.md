# Codex Live Session Chart Layout

## 背景

2026-05-27 用户反馈 Codex live-sessions 详情页的“请求耗时趋势”图表变形。截图现象包括：

1. y 轴标签左侧被裁切，只剩 `.6s`、`5ms`、`0ms` 等残缺文本。
2. x 轴 `#sequence` 标签在底部密集重叠，长会话接近 50 条 request 时尤其明显。
3. 最新 live request 的虚线圆环靠右被 `overflow-hidden` 外框截断。

初步排查定位到前端图表布局约束：`TimingTrendChart` 使用 SVG + 绝对定位 HTML 标注，外层 `overflow-hidden`，但图表 `left/right/bottom` padding 与轴标签密度没有覆盖长会话、live ring 半径和 Retina 截图场景。CLIProxyAPI live tracker 的 50 request realtime 留存与重编号会放大该问题，但不是图形裁切的直接原因。

## 目标

1. 修复请求耗时趋势图的标签裁切、底部标签重叠和右侧 live ring 截断。
2. 保持既定视觉语义：forward-moving audio waveform，一柱一请求，x 轴按 request sequence 等距展示。
3. 用测试和浏览器验收锁定长会话 50 request 场景，避免后续回退到时间轴拉伸、横向滚动或多指标叠图。
4. 保持 browser preview 与 Wails runtime 两条验收路径可复现。

## 范围

1. `frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx` 的 `RequestTimingTrend` / `TimingTrendChart` 布局、标注密度、padding 与 marker 裁切边界。
2. `frontend/src/features/codex-live-sessions/model/mockData.ts` 必要的 50 request preview fixture，或等价的测试 fixture。
3. `frontend/src/features/codex-live-sessions/model.test.mjs` 中图表源结构断言、长会话趋势模型断言与布局防回归断言。
4. 浏览器 preview DOM / screenshot 验收脚本与截图归档。

## 非目标

1. 不改变 live-session 数据来源、轮询策略、history 懒加载或 runtime optimization 方向。
2. 不新增 request cancel、replay、强制切号或 WebSocket 恢复能力。
3. 不展示原始 request / response payload、credentials、bearer token、cookie 或未脱敏错误体。
4. 不把图表改回真实时间间隔拉伸、金融折线、ECG 折线或横向滚动图。

## 验收标准

### 场景 1：y 轴标签不被裁切

Given 请求耗时趋势图展示总耗时指标，When y 轴最大值包含秒级标签，例如 `1.1s`、`11s` 或 `44.9s`，Then 标签完整位于图表可见区域内，不被左侧外框裁掉。

### 场景 2：x 轴标签在 50 request 场景下可读

Given 一个 session 有最近 50 条 request，When 图表按容器宽度显示最近请求，Then 底部 `#sequence` 标签不会连续重叠；只显示当前 request、live request、最后 request 和宽度允许的稀疏刻度。

### 场景 3：live ring 不被右侧裁切

Given 最新 request 处于 streaming / active / reconnecting，When 图表渲染 live 虚线圆环，Then 圆环完整留在可见区域内，右侧不被外框切掉。

### 场景 4：音频波形语义保持

Given 用户切换总耗时、TTFT、首 token 等 timing 指标，When 图表刷新，Then 仍然是一柱一请求的垂直 amplitude bar，最新 request 锚在右侧，不能出现多指标叠线、面积图或横向滚动。

### 场景 5：浏览器与 Wails 验收闭环

Given 修复完成，When 在 browser preview 与真实 Wails runtime 中打开 `#frame=codex&workspace=live-sessions`，Then 图表 DOM 断言通过，并归档至少一张 after 截图到本 space 的 `screenshots/` 目录。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-codex-live-session-chart-layout`
- worktree：`../GetTokens-worktrees/20260527-codex-live-session-chart-layout/`

## 相关链接

- 详细计划：`plans/chart-layout-fix-plan-v01.md`
- 根因相关组件：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx`
- 趋势模型：`frontend/src/features/codex-live-sessions/model/requestTimingTrend.ts`
- 关联需求：`../20260521-codex-live-session-detail/README.md`
- 关联运行时优化：`../20260527-codex-live-session-runtime-optimization/README.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-27
- 记录：已完成前端修复与验证。`TimingTrendChart` 已改为集中计算安全 padding：左侧为 y 轴标签预留 56px，右侧按 live ring 最大半径 28px 加余量预留 38px，底部刻度区提升到 54px；x 轴 `#sequence` 标签改为基于实际 x 坐标和 36px 最小间距稀疏显示，保留最新/live/选中样本优先级，避免 50 request 长会话下按序号直接铺满。
- 追加修复：用户继续反馈少量数据时文字/点位与图形不对齐。根因是图表首帧在 `chartWidth=0` 时用 `320px` fallback 坐标绘制，随后 SVG 被真实容器宽度拉伸，而 HTML overlay marker 仍按 fallback 坐标定位；现已改用 `useLayoutEffect` 测量容器宽度，测量完成前隐藏绘制层，并用实测 `chartWidth` 统一 SVG `viewBox` 与 overlay 坐标。
- 样本：browser preview 的首个 live session 已伪造为 50 条近 5 分钟 request，保留 `gt-req-8912` 作为最新 live 请求，序号为 `#50`，用于稳定复现长会话图表密度。
- 验证：已先补红灯测试，再完成实现并通过 `node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build`、`git diff --check`。50 request browser preview DOM 验收结果为 `labelOverflow=[]`、`xLabelOverlap=[]`、`liveRingOverflow=false`，可见 x 轴标签为 `#20/#25/#30/#35/#40/#45/#50`；首帧对齐复验结果为 `shellWidth=884`、`svg viewBox=0 0 884 224`、选中 marker 与 SVG 圆点 X 轴中心差 `0px`。
- 截图：`screenshots/20260527/codex-live-sessions/20260527-codex-live-sessions-chart-layout-after-v02.png`、`screenshots/20260527/codex-live-sessions/20260527-codex-live-sessions-chart-first-frame-after-v01.png`。
- 待补：真实 Wails active session 当前未复现到可用样本；本轮已用 preview 伪造 50 request 完成浏览器长会话验收，后续有真实 runtime 样本时可再补 Wails 截图。
