# Claude Code MCP Servers 技术调研

日期：2026-05-21
状态：P0 可实现，支持 user/project/local scope 的 preservative JSON patch

## 结论

Claude Code MCP 与 Codex MCP 的 UI 可对齐，但后端不能复用 Codex TOML adapter。Claude Code MCP 的存储分布在 `~/.claude.json` 和项目 `.mcp.json`：user 和 local 都在 `~/.claude.json`，project 在 `.mcp.json`。P0 需要做 JSON adapter、scope 显示、单 server patch、secret redaction 和写前备份。

## 已验证依据

- 官方文档确认 transport 包含 `http`、`sse`、`stdio`，其中 JSON 配置里的 `streamable-http` 可作为 `http` alias。
- 官方文档确认 MCP scope：
  - local：当前项目私有，存储在 `~/.claude.json` 的项目路径条目下。
  - project：团队共享，存储在项目根 `.mcp.json`。
  - user：跨项目个人配置，存储在 `~/.claude.json`。
- 官方文档确认 scope precedence：local > project > user > plugin-provided servers > claude.ai connectors。
- 本地参考 `docs-linhay/references/cc-switch/src-tauri/src/claude_mcp.rs` 已实现读取/写入 `mcpServers`、校验 stdio/http/sse、保留根部未知字段、atomic write、Windows `npx`/`npm` cmd 包装。
- 外部参考 `spences10/mcpick` 明确支持 Claude Code local/project/user scope，配置路径为 `~/.claude.json` 与 `.mcp.json`，并在输出中 redacts `env` / `headers`。
- Node JSON patch 原型已验证：只替换目标 `mcpServers.<id>` 时可保留 `projects`、`hasCompletedOnboarding` 和未知字段。

## 数据边界

- 读取：
  - user MCP：`~/.claude.json` 根部 `mcpServers`
  - local MCP：`~/.claude.json.projects[projectPath].mcpServers`
  - project MCP：`<repo>/.mcp.json.mcpServers`
- 写入：
  - 只 patch 当前 scope 的目标 server。
  - 保存前创建备份或 rollback entry。
  - 保留根部未知字段、其他项目条目、其他 server、`hasCompletedOnboarding`。
- UI 展示必须 redacts：
  - `env` 中疑似 token/key/secret 的值。
  - `headers.Authorization`、`X-API-Key` 等 header 值。
- 不做：
  - P0 不做跨 scope 批量迁移。
  - P0 不自动运行 `claude mcp add`，直接操作 JSON adapter 更可测试。

## 后端设计

- `GetClaudeCodeMcpServers(projectPath)`：
  - 返回 flattened records，带 `scope`、`sourcePath`、`serverID`、`effectiveRank`、`transport`。
- `SaveClaudeCodeMcpServer(input)`：
  - 校验 `scope`。
  - 校验 `command` 与 `url` 不能同时存在。
  - `stdio` 必须有 `command`；`http/sse/streamable-http` 必须有 `url`。
  - 写前读取原文件，patch 后再次 parse，返回 diff summary。
- `DeleteClaudeCodeMcpServer(input)`：
  - 二次确认由前端负责，后端仍校验 scope 与 path。

## 前端设计

- 复用 Codex MCP editor，但 field adapter 需区别：
  - Claude `type=http|sse|stdio|streamable-http`
  - Codex `url` 推断为 `streamable_http`
  - Claude 支持 `headers`，展示时默认脱敏。
- 列表显示 effective duplicate：
  - 同名 server 在多个 scope 出现时，按 precedence 标记 active / shadowed。

## TDD 红灯

- `internal/wailsapp/claude_code_extensions_test.go`：
  - 解析 user root `mcpServers`。
  - 解析 local `projects[projectPath].mcpServers`。
  - 解析 project `.mcp.json`。
  - patch project server 时保留其他 server 和未知字段。
  - patch local server 时保留 `hasCompletedOnboarding` 与其他 `projects`。
  - `command + url` 同时存在时报错。
  - secrets 在 snapshot 中脱敏但 raw editor 可按权限查看。
- `frontend/src/features/cli-extensions/model.test.mjs`：
  - precedence label 正确。
  - `streamable-http` 显示为 HTTP，保存仍保留用户输入或标准化规则明确。

## 验收方式

- `go test ./internal/wailsapp -run 'ClaudeCode.*Mcp|ApplyClaudeCode'`
- Node JSON patch prototype：构造含 `projects`、`hasCompletedOnboarding`、未知字段的 JSON，patch 单 server 后逐项断言保留。
- browser preview 验收编辑器、diff 和脱敏展示。
- Wails 桌面验收读写临时 `CLAUDE_CONFIG_DIR` 与临时 repo `.mcp.json`。

## 风险

- local MCP 与 general local settings 存储位置不同：local MCP 在 `~/.claude.json`，settings local 在 `.claude/settings.local.json`。UI 必须显式区分。
- SSE 已被官方标记为 deprecated，应支持读取和保守编辑，但新增默认推荐 HTTP。

