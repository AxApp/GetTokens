# Codex 账号列表行设计评审

## 辩论背景
- 时间：2026-05-12
- 模式：合作型
- 主题：`AccountOrderRow` 截图设计评审
- 候选参与者：Gemini CLI
- 启用参与者：Gemini CLI
- 淘汰参与者：无

## 代码上下文
- `frontend/src/features/codex/CodexAccountListFeature.tsx:407`：账号行主体使用 grid，承载行点击详情、拖拽排序进入与放下事件。
- `frontend/src/features/codex/CodexAccountListFeature.tsx:418`：左侧顺位块是唯一 `draggable` 区域。
- `frontend/src/features/codex/CodexAccountListFeature.tsx:438`：中间内容包含账号名、来源 badge、请求出口和异常原因。
- `frontend/src/features/codex/CodexAccountListFeature.tsx:468`：右侧 switch 当前在非宽屏下带虚线分隔并下沉到第二行。
- `frontend/src/components/ui/ToggleSwitch.tsx:27`：共享 switch 只有轨道与滑块，可通过 `stopPropagation` 保持独立交互。

## 参与者观点
### Gemini CLI
1. 论点：当前行高和内边距偏重。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:407`
   代码事实：行使用 `min-h-[5.75rem]` 和 `py-3`。
   结论：视觉更像卡片而不是高密度请求顺序列表，应压低到约 52-56px。
2. 论点：左侧顺位块视觉重量过大。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:418`
   代码事实：顺位块有 `min-h-[4.25rem]`、`border-2` 和粗数字。
   结论：顺位应是轻索引，不应成为第一视觉重心。
3. 论点：右侧虚线分段造成表单化。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:468`
   代码事实：非宽屏下 switch 使用 `border-t-2 border-dashed` 并落到第二行。
   结论：应移除虚线，让 switch 固定在右侧同一水平扫描线。
4. 论点：route 标签增加噪音。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:457`
   代码事实：请求出口区显示独立标签和 endpoint。
   结论：高密度行可以用 mono endpoint 和位置表达语义，弱化或移除显式标签。

## 主持结论
- 采纳：移除行内虚线分段，switch 始终作为右侧独立控制列；压缩行高和左侧 rank 视觉重量。
- 采纳：保留整行左侧状态色条、source badge、mono endpoint 和 switch `stopPropagation` 逻辑。
- 暂不采纳：完全移除请求出口语义标签可以后续再验证；当前可先弱化标签而不是直接删除，避免对新用户失去上下文。

## 推荐布局
- `article` 使用单行三列：`rank / account+route / switch`。
- 左侧 rank 列控制在 2.75-3rem，拖拽点在前，数字在后。
- 中间内容压成两行：第一行账号名 + source badge，第二行 endpoint；异常原因紧贴账号信息显示。
- 右侧只保留 `ToggleSwitch`，不加额外卡片、状态点、虚线和文字。
