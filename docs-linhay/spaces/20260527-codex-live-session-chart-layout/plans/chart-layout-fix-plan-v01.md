# 请求耗时趋势图布局修复计划 v01

## 目标

修复 Codex live-sessions 详情页“请求耗时趋势”图表在长会话和 live 样本下的视觉变形：y 轴标签裁切、x 轴标签重叠、右侧 live ring 截断。修复必须保持当前产品约定的 audio waveform chart：一柱一请求、按 request sequence 等距推进、最新 request 靠右。

## 已知根因

1. `TimingTrendChart` 外层使用 `overflow-hidden`，但 `padding.left = 30` 不足以容纳秒级 y 轴标签；标签的真实 DOM 边界会伸出外框并被裁掉。
2. `padding.right = 18` 小于 live ring 最大半径 `28`，最新 live 点靠右时虚线圆环必然被裁切。
3. `timingTrendAudioBarStepPx = 12` 在宽容器里会显示大量 request，`shouldShowTimingTrendAxisLabel` 又按 `sequence % 5 === 0` 显示刻度；当 sequence 重编号或接近 50 时，底部标签容易密集堆叠。
4. CLIProxyAPI realtime tracker 在保留最近 50 条 request 后会将 retained requests 重新编号为 1..50，这会让前端长期围绕 `#50` 展示，但图表裁切和重叠的直接修复点仍在前端布局。

## BDD 场景

### 场景 1：完整 y 轴标签

Given 图表 y 轴最大值为秒级耗时
When 页面以桌面宽度渲染请求耗时趋势图
Then y 轴文本的 `getBoundingClientRect().left` 不小于图表外框左边界
And 文本完整可见。

### 场景 2：50 request 底部标签不重叠

Given trend points 包含 50 条 request
When 图表在 1280、1512 和 900 宽度视口下渲染
Then 相邻可见 `#sequence` 标签的水平边界不相交
And 图表仍显示足够的波形柱，不退化成少量样本。

### 场景 3：live ring 完整可见

Given 最新 request 为 live 样本
When live ring 半径达到最大值
Then 虚线圆环右边界不超过图表可见外框右边界
And 左右边界均保留最小安全间距。

### 场景 4：指标切换不改变图表类型

Given 用户点击总耗时、TTFT、首 token、stream 等 timing 指标
When selected metric 改变
Then 图表仍只渲染单指标 waveform bar
And 不出现多指标折线、面积 path、横向滚动容器。

## TDD 计划

1. 红灯：在 `frontend/src/features/codex-live-sessions/model.test.mjs` 增加源结构断言，覆盖：
   - chart padding 至少能容纳 y 轴标签和 live ring
   - x 轴标签显示规则不能只按 `sequence % 5`
   - 保留 `buildTimingTrendWaveformBars` / 单指标波形，不回到 path / scroll 方案
2. 红灯：增加 50 request fixture 的趋势模型断言，确认 visible slice、selected/live point 与最新点顺序稳定。
3. 绿灯：最小调整 `TimingTrendChart`：
   - 增大或动态计算 `padding.left/right/bottom`
   - 让 label density 由实际宽度和最小标签间距决定
   - 右侧为 live ring 预留半径安全区
4. 重构：若组件内计算继续膨胀，提取纯函数，例如 `resolveTimingTrendAxisLabels`、`resolveTimingTrendChartPadding`，并用 Node test 锁定。

## 实现建议

1. 将图表安全间距集中成常量：
   - `timingTrendLabelSafeInsetPx`
   - `timingTrendLiveRingMaxRadiusPx`
   - `timingTrendAxisLabelMinGapPx`
2. `padding.left` 按 y 轴最大标签宽度的估计值或保守常量提升，优先选择稳定常量，避免每次 render 测量文本造成抖动。
3. `padding.right` 至少为 live ring 最大半径加 stroke / breathing 余量，latest point 锚点不能贴到外框。
4. x 轴标签选择优先级：
   - selected request
   - live request
   - last visible request
   - 按 `minLabelGap` 从右向左补充稀疏刻度
5. 若后端 `sequence` 重编号暂不改，本期前端仍按传入 `sequence` 显示；是否保留全局 request ordinal 另开后端需求。

## 验证计划

1. 单测：
   - `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
2. 前端门禁：
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
3. 浏览器 DOM 验收：
   - 打开 `http://localhost:5173/#frame=codex&workspace=live-sessions`
   - 断言 y 轴标签、x 轴标签、live ring 均在图表外框内
   - 断言相邻轴标签无重叠
4. 截图归档：
   - `docs-linhay/spaces/20260527-codex-live-session-chart-layout/screenshots/20260527/codex-live-sessions/20260527-codex-live-sessions-chart-layout-after-v01.png`
5. Wails 验收：
   - 在真实 GetTokens App `#frame=codex&workspace=live-sessions` 中验证图表不变形
   - 若当前没有真实 active session，说明 browser preview 覆盖 layout，Wails runtime 图表验收待有真实样本补测。

## 风险与边界

1. 如果只增大 padding，可能会减少可见柱数；需要用宽度驱动的 visible count 平衡信息密度。
2. 如果简单隐藏过多 x 轴标签，可能削弱 request sequence 可读性；需要保留 selected / live / latest 三类关键标签。
3. 如果引入 DOM 测量计算标签宽度，可能造成 ResizeObserver 与 render 抖动；优先使用保守常量。
4. 后端 50 request 重编号会让 `#sequence` 语义看起来像窗口内序号，不是全局请求 ordinal；本期不改后端，但文档中保留这个限制。

## 当前状态

- 状态：implemented
- 创建时间：2026-05-27
- 实施结果：`CodexLiveSessionDetail.tsx` 已新增 `resolveTimingTrendChartPadding` 和 `resolveTimingTrendAxisLabelIndexes`。图表安全边距由常量集中控制，避免 y 轴标签和 live ring 被外层 `overflow-hidden` 裁切；x 轴标签从直接 `sequence % 5` 改为“最新/live/选中优先 + 按实际 x 坐标最小间距补刻度”。
- 样本调整：`model/mockData.ts` 的 browser preview 首个 live session 已改为伪造 50 条近 5 分钟 request，最新请求仍为 `gt-req-8912`，序号提升为 `#50`，用于稳定复现长会话密度和右侧 live ring。
- 红绿灯：新增两条布局回归测试，并把 preview 趋势样本测试更新为 50 request 断言；实现后同一 focused 命令 46/46 通过。
- 验证完成：
  - `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
  - `git diff --check -- frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx frontend/src/features/codex-live-sessions/model.test.mjs`
  - 50 request browser preview DOM：`labelOverflow=[]`、`xLabelOverlap=[]`、`liveRingOverflow=false`
- 截图：`../screenshots/20260527/codex-live-sessions/20260527-codex-live-sessions-chart-layout-after-v02.png`
- 剩余风险：真实 Wails runtime 当前缺少 active live-session 样本，无法补做真实 runtime 截图；本期已通过伪造 50 request browser preview DOM 与源结构测试覆盖布局边界。
