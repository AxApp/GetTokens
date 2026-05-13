# Codex MCP 列表区域设计讨论

**日期**：20260513
**模式**：合作型
**参与者**：Gemini（福尔摩斯）/ Codex（主持人）
**总轮次**：2 / 60
**结束原因**：达成可执行共识

## 执行元数据

- 候选参与者：Gemini CLI
- 首轮实际启用：Gemini CLI
- 后续 active participants：Gemini CLI
- 淘汰参与者：无
- 不可用原因：无

## 辩论背景

用户指出 `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:CodexMcpServersWorkspace:div:681` 附近的 MCP 列表设计不可接受，并要求通过 `$debate` 与 Gemini 讨论后直接修改。已知约束包括：MCP 不要 Config Groups，只要列表；点击整条 server 行打开独立 modal；避免多层卡片嵌套；优先使用已有通用组件与样式。

## 各轮观点记录

### 第 1 轮

**[Gemini - 福尔摩斯]**

- 论点：当前列表区域视觉层叠过重 → 引用：`frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:680` → 代码事实：主列表 section 使用 `border-2 bg-main shadow`，其前还有独立 metrics 区 → 结论：容易形成卡片堆叠感，应该弱化独立统计卡片。
- 论点：工具栏布局臃肿 → 引用：`frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:681-693` → 代码事实：toolbar 容器只有 filter/search，却占用完整 `p-4` 区域 → 结论：应把列表标题、路径、统计和工具条重新组织。
- 论点：metrics 与列表割裂 → 引用：`frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:674-678` → 代码事实：total/enabled/changed 是独立三块 metric → 结论：应合入 MCP list section header。

主持人裁定：第 1 轮的问题诊断有效；但 Gemini 初版提出的右侧 dashboard 和行内 toggle 可能违反用户的“只要列表”和“整行打开 modal”约束，因此进入第 2 轮收敛。

### 第 2 轮

**[Gemini - 福尔摩斯]**

- 论点：最小修改应锁定在列表 section → 引用：`frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:674-722` → 代码事实：问题集中在独立 metrics、section header、toolbar、rows 四段 → 结论：无需重做成双栏 dashboard。
- 论点：保留 metrics 但取消独立 card 区 → 引用：`frontend/src/features/status/components/StatusPanels.tsx:581-760` → 代码事实：功能开关面板把 visible/changed chip 放在 section header → 结论：MCP 的 total/enabled/changed 应改成 section header chip。
- 论点：不添加行内 toggle → 引用：`frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx:753-900` → 代码事实：启停和保存已在独立 `McpServerEditorModal` 内完成 → 结论：列表行只显示状态 badge，点击整行进入 modal。

## 最终结论与行动项

### 达成共识

- 移除 MCP 页面里独立的三块 metrics。
- 将 `total/enabled/changed`、`config.toml` 路径、visible count 合入 MCP 主列表 section header。
- filter/search 保留为列表 section 内的第二条工具栏，保持紧凑。
- MCP row 不加入 toggle，只显示 `status` 与 `transport` badge，整行点击仍打开独立 editor modal。
- 不新增 Config Groups，不新增右侧 dashboard，不新增大组件文件。

### 行动项

| # | 行动 | 负责方 | 状态 |
|---|------|--------|------|
| 1 | 修改 `CodexMcpServersWorkspace` 列表区域 JSX | Codex | 已完成 |
| 2 | 补充 `visible` / `empty_mcp` 文案 | Codex | 已完成 |
| 3 | 浏览器截图验证 MCP 列表只有一个主 section | Codex | 已完成 |
| 4 | 运行 typecheck / build | Codex | 已完成 |

### 验收记录

- `npm run typecheck`
- `npm run build`
- 浏览器验证：`document.querySelectorAll("[data-collaboration-id=PAGE_CODEX_MCP_SERVERS] section").length === 1`
- 截图：`docs-linhay/spaces/20260511-cc-switch-codex-skills-mcp/screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-list-redesign-after-v01.png`

### 未解问题

- 是否需要把 `WorkspacePageHeader` 的刷新按钮也收敛到列表 section header，暂未调整；当前为了复用既有页面头操作区，保留在 header actions。
