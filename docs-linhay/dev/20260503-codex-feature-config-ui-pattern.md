# 2026-05-03 Codex Feature Config UI Pattern

## 背景

本轮围绕 Codex 本地 `config.toml` 的 `[features]` bool 配置做 UI 收敛。用户连续指出表格列、预览、概览卡片、重复值标签、开关方向、Stage 列和强制大写等问题，最终确认该页面应是“本地配置列表”，不是数据报表。

## 稳定模式

1. 每个 feature 是一条独立列表行，不使用 `table / thead / tbody / tr / td / th`。
2. 行标题展示 feature key，保持原始大小写，不做 CSS 强制大写。
3. 副标题由 Stage 标签、可选辅助标签和本地化描述组成；Stage 是副标题前的紧凑标签，不是独立列。
4. 描述优先使用 `status.codex_feature_descriptions.<feature_key>`，未知 key 才回退后端描述或空态文案。
5. Bool 值只由开关表达，不再重复展示 `default true/false`、`local value`、`ON/OFF` 等文案。
6. 开关开启态滑块在右侧且使用绿色，关闭态滑块在左侧；切换使用 transform 动画，滑块必须始终在线框内。
7. 已弃用、移除、未知或不支持项可以用 Stage / unsupported 提示表达风险，不增加额外表格列。

## 验收方式

1. DOM 中不应出现 feature 列表表格元素。
2. 桌面和移动视口都不能出现横向溢出。
3. 开关开启 / 关闭时滑块坐标必须在轨道边界内。
4. 浏览器 preview 数据只能用于布局验收；真实 Wails 写入能力仍需通过桌面运行时验证。

## 不纳入

1. `npm --prefix frontend run build` 进程悬挂是本轮观察到的验证风险，但还没有复现归因，不沉淀为稳定规则。
2. 请求编排设计稿属于另一个 space 的独立改动，不纳入 Codex feature 配置 UI 模式。
