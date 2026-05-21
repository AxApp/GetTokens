# Claude Code Subagents 技术调研

日期：2026-05-21
状态：P1 可实现扫描/预览/创建，导入市场模板需另做 license 校验

## 结论

Subagents 是 Claude Code 的独立 Markdown 资产，不是 Codex subagent 调度能力的 UI 复刻。P1 可以做 user/project subagent 文件扫描、frontmatter 解析、预览、创建和编辑；市场导入只允许来自已确认 license 的模板源。

## 已验证依据

- 官方文档确认 project subagents 在 `.claude/agents/`，user subagents 在 `~/.claude/agents/`，会递归扫描，身份来自 `name` frontmatter 而不是文件名。
- 官方文档确认 frontmatter 中 `name` 和 `description` 必填；还支持 `tools`、`disallowedTools`、`model`、`permissionMode`、`maxTurns`、`skills`、`mcpServers`、`hooks`、`memory`、`background`、`effort`、`isolation`、`color`、`initialPrompt` 等字段。
- 官方文档确认 plugin subagents 会忽略 `hooks`、`mcpServers`、`permissionMode`，所以 GetTokens 导入 plugin 模板时不能直接声称这些字段生效。
- 外部参考 `VoltAgent/awesome-claude-code-subagents` 提供大量按类别组织的 subagent 模板，适合作为发现体验参考；不能直接内置模板内容，除非确认许可证和来源记录。
- Node frontmatter parser 原型已验证能提取 `name`、`description`、`tools`、`model`。

## 数据边界

- 读取：
  - user：`~/.claude/agents/**/*.md`
  - project：`.claude/agents/**/*.md`
  - managed/plugin：P1 只读标记，不做写入。
- 写入：
  - user/project root 内新建或编辑单个 `.md`。
  - 文件名可与 `name` 不同，但 GetTokens 创建时默认用 `name + ".md"`。
  - 保存时保留未知 frontmatter 字段。
- 不做：
  - 不把 subagent 当成 GetTokens 内置执行 agent 直接运行。
  - 不自动安装 awesome-subagents 模板。

## 后端设计

- `GetClaudeCodeSubagentsSnapshot(projectPath)`：
  - 返回 scope、path、frontmatter、body preview、parse errors。
- `SaveClaudeCodeSubagent(input)`：
  - 校验 `name` slug、`description` 非空。
  - 对 `tools` / `disallowedTools` 做字符串或数组兼容解析。
- `ImportClaudeCodeSubagentTemplate(input)`：
  - P1 先不做；P2 必须要求 source URL、license、原始 commit/ref。

## TDD 红灯

- 递归扫描 user/project agents。
- 文件名与 `name` 不一致时以 `name` 为 identity。
- 缺少 `name` 或 `description` 标记 invalid，不保存。
- plugin 不支持字段在 UI 显示 ignored warning。
- 保存时未知 frontmatter 字段不丢失。

## 验收方式

- Go 单测覆盖 frontmatter parser、路径扫描和保存。
- browser preview 验收列表、详情和字段 warning。
- Wails 桌面验收临时 `.claude/agents` 写入。

## 风险

- subagents 新字段增长快，frontmatter parser 必须宽松保留未知字段。
- `permissionMode`、`mcpServers`、`hooks` 属于高影响字段，编辑 UI 需要展示风险提示。

