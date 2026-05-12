# Codex 二进制管理顶部状态面板重构 Debate

## 辩论背景

用户指出 `frontend/src/features/codex-binary/CodexBinaryFeature.tsx:143` 的顶部状态面板太乱，要求与 Gemini 一起按 `$debate` 商量。议题是：在不扩大二进制管理面板信息量、不改变“下载/激活在列表 cell 上操作”的前提下，重构顶部状态面板的信息层级与样式。

候选参与者：
- Gemini CLI：启用，`gemini --version` 返回 `0.41.1`。

淘汰参与者：
- 无。用户明确要求与 Gemini 商量，本轮不额外启用 Claude/Copilot/Codex 作为参与者。

## 代码事实

- `CodexBinaryFeature.tsx:143` 的原 section 同时承载当前版本、doctor 状态、PATH 状态、一键托管、检查更新、三条路径元信息和加载消息。
- `CodexBinaryFeature.tsx:156-184` 将 `StatusPill` 与 `btn-swiss` 按钮混在同一 `flex-wrap` 容器内。
- `CodexBinaryFeature.tsx:186-200` 用带 border-top 的 grid 展示托管目录、当前 codex、写入配置，三项都可能是长路径。
- `CodexBinaryFeature.tsx:205` 之后才进入版本列表，而用户要求该业务主要围绕下载/激活和变更记录。
- `style.css:60-85` 已有 `btn-swiss` 统一按钮体系。

## 第一轮观点

### Gemini

论点：身份信息与技术路径层级混淆
引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:146-153`
代码事实：左侧同时展示大字号版本名和紧随其后的长路径。
结论：长路径会干扰“当前版本”这个核心状态，应把技术元数据降权。

论点：动作区视觉对齐失调
引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:156-184`、`frontend/src/style.css:60-85`
代码事实：平扁的状态 pill 与带硬阴影的 `btn-swiss` 混在同一行。
结论：应把状态与动作分离，按钮放到独立动作区。

论点：配置详情区过重
引用：`frontend/src/features/codex-binary/CodexBinaryFeature.tsx:186-200`
代码事实：三项路径以 grid + `break-all` 展示，占用较多纵向空间。
结论：路径信息应改为低权重 metadata，不再抢占主业务列表视线。

### Codex 主持裁定

采纳 Gemini 的方向，但不隐藏“写入配置”目标，因为此前用户明确关心一键托管写入哪里。最终方案：
- 顶部面板分成三段：主状态、独立动作区、低权重元信息脚注。
- 主状态只突出当前版本；doctor/PATH 状态贴近版本，但不与按钮混排。
- 动作区只放“一键托管”和“检查更新”。
- 托管目录、当前 codex、写入配置保留，但改为小字号 metadata，使用 truncate 降低噪声。

## 落地结果

- `CodexBinaryFeature.tsx:143` section 改为 `bg-main`、紧凑 padding、grid 两栏布局。
- 状态 pill 从按钮区移到当前版本标题旁。
- 动作按钮留在独立右侧动作区，继续复用 `btn-swiss`。
- 新增 `ManagedMeta` 小组件承载路径元信息，统一 label/value 层级。
- 桌面截图：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-after-v01.png`
- 移动截图：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-mobile-after-v01.png`

## 共识结论

本次属于合作型设计讨论，Gemini 与 Codex 共识为：问题根因是信息层级混排，不是单个颜色或按钮 class。顶部状态面板应只负责 orient 和 enable action，下载/激活继续交给版本列表 cell，路径信息降为低权重 metadata。
