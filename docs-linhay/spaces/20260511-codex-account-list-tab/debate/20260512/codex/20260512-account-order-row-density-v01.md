# Codex 账号列表行密度评审

## 辩论背景
- 时间：2026-05-12
- 模式：合作型
- 主题：`AccountOrderRow` 视觉密度与交互边界重设计
- 候选参与者：Gemini CLI
- 启用参与者：Gemini CLI
- 淘汰参与者：无

## 代码上下文
- `frontend/src/features/codex/CodexAccountListFeature.tsx:345`：账号行主体承载点击详情、拖拽进入、放下排序事件。
- `frontend/src/features/codex/CodexAccountListFeature.tsx:356`：左侧顺位轨是唯一 `draggable` 区域。
- `frontend/src/features/codex/CodexAccountListFeature.tsx:579`：`ToggleSwitch` 内部 `stopPropagation`，不会触发行详情。
- `frontend/src/features/codex/model/codexAccountList.ts:41`：openai-compatible 模型映射已统一为真实模型 `name` 到 Codex 模型 `alias || name`。

## 参与者观点
### Gemini CLI
1. 论点：高密度运维列表不应有强制的大尺寸占位。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:350`
   代码事实：原行使用 `min-h-[7rem]` 和较大的 `px-4 py-4`。
   结论：压缩行高和内边距，提升同屏账号数量。
2. 论点：左侧拖拽柄是辅助入口，不应承担过多视觉重量。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:350`、`frontend/src/features/codex/CodexAccountListFeature.tsx:361`
   代码事实：原左列宽度接近 `4.75rem`，并同时显示状态色条、`Rank` 文案、巨大序号和拖动文字。
   结论：缩小左列，保留序号和拖动图标，弱化说明文字。
3. 论点：状态色应服务整行扫描，而不是困在拖拽柄内部。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:356`
   代码事实：原状态色条位于拖拽柄内部。
   结论：改成整行左边缘状态色，拖拽柄只表达排序能力。
4. 论点：右侧独立操作列原本空间利用率偏低。
   引用：`frontend/src/features/codex/CodexAccountListFeature.tsx:406`
   代码事实：操作区只放 switch，但请求状态 badge 与 switch 分离。
   结论：将请求状态和启停 switch 放在同一区域，减少视线跳转。

## 主持结论
- 采纳 Gemini 的密度、左侧顺位轨、状态色和右侧状态区建议。
- 不采纳“完全移除请求状态 badge”：启停 toggle 表示账号启用状态，请求状态 badge 表示是否可参与运行时请求，两者语义不同；本轮将两者靠近展示而不是合并语义。
- 保持已有交互边界：整行点击详情、左侧拖拽排序、switch 独立切换。

## 行动项
1. 将 `AccountOrderRow` 压缩为高密度两列/三列响应式行。
2. 将状态色改为整行左边缘，左侧轨只保留序号和拖动图标。
3. 将请求状态 badge 与启停 switch 组合到右侧。
4. 复跑类型检查、单元测试、构建和浏览器交互验收。
