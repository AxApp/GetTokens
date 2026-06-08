# 第 5 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 5 轮：评估 + 修复**。
- 基线：延续第 4 轮报告列出的下一轮候选，基于当前工作树继续，不回退第 1/2/3/4 轮或其他 subagent 改动。
- 环境边界：仅修改仓库 dev 代码与本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **MCP tool approval 结构化编辑保存链路**
   - 原因：读取侧已经能解析 `[mcp_servers.<id>.tools.<tool>]`，前端 DTO 也保留 `tools`，但保存后仍从旧文档返回 tool approvals，且没有按结构化输入重建 tool section。
   - 低风险边界：仅补 Wails Go 保存 patch，不改 sidecar 热路径、不改正式数据；保留“未显式传 `Tools` 时不接管旧 tool section”的兼容语义。

2. **MCP raw TOML 多行结构 warning**
   - 原因：当前轻量 parser 只可靠处理单行数组和 inline map。遇到 `args = [`、`env = {` 这类多行 TOML 时，结构化编辑器可能无法完整解析。
   - 低风险边界：只增加 warning，不做 AST patch，不声称支持多行 TOML 结构化改写。

### 本轮未选

- raw `config.toml` 保存前 TOML 预检与备份提示：若做后端备份需要扩展保存 DTO、备份文件策略和 Go 测试；本轮没有实现，因此不声称已有后端备份。
- Skills 启停规则来源解释：需要扩展 Skill record DTO、规则命中来源和前端展示，适合下一轮独立处理。
- MCP raw TOML 多行 AST patch：风险高于 warning，需要完整 TOML AST 或更窄的 patch 边界，本轮暂不处理。

## 红灯测试

本轮先补测试并确认失败：

- `TestSaveCodexMcpServerPatchesToolApprovalSections`
  - 构造 `linear` server 既有 `search`、`old_tool` tool sections，同时保留另一个 `filesystem` server 的 tool section。
  - 保存结构化 `Tools` 后要求：
    - `search` approval 从 `prompt` 更新为 `approve`。
    - 新增带空格工具名 `[mcp_servers.linear.tools."create issue"]`。
    - 删除旧的 `[mcp_servers.linear.tools.old_tool]`。
    - 保留 `[mcp_servers.filesystem.tools.read_file]`。
  - 红灯表现：保存结果仍返回旧 tool approvals，文件没有按结构化输入重建。
- `TestGetCodexMcpServersWarnsAboutMultilineRawStructures`
  - 构造 `args = [` 与 `env = {` 多行结构。
  - 红灯表现：snapshot warnings 为空。

## 本轮修复清单

### 1. MCP tool approval 结构化保存

- `SaveCodexMcpServer` 写入后重新读取 dev `config.toml`，返回保存后的实际 `Tools`，避免继续返回旧 document 缓存。
- 新增 `patchCodexMcpToolSections`：
  - 当 `server.Tools == nil` 时不接管旧 tool sections，保持第 4 轮及旧保存调用的兼容行为。
  - 当结构化输入显式带 `Tools` 时，先移除当前 server 下旧 `.tools.*` sections，再按输入重建。
  - 其他 server 的 tool sections 不受影响。
- tool section header 复用第 4 轮 quoted key formatter，支持 tool name 带空格或非 bare key。

### 2. MCP raw 多行 TOML warning

- 新增 `codexMcpMultilineEditableKey` 与 `startsUnclosedTomlValue`。
- 对以下结构化编辑器相关字段识别“起始行未闭合”的多行 TOML：
  - 数组类：`args`、`enabled_tools`、`disabled_tools`、`scopes`、`env_vars`
  - map 类：`env`、`http_headers`、`env_http_headers`、`oauth`
- warning 文案明确建议先使用 raw `config.toml` 检查，不尝试自动 patch 多行结构。

## 变更文件

- `internal/wailsapp/codex_extensions.go`
- `internal/wailsapp/codex_extensions_test.go`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-5.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
go test ./internal/wailsapp -run TestSaveCodexMcpServerPatchesToolApprovalSections
go test ./internal/wailsapp -run TestGetCodexMcpServersWarnsAboutMultilineRawStructures
go test ./internal/wailsapp -run 'TestGetCodexMcpServersTreatsToolApprovalSectionsAsNestedConfig|TestGetCodexMcpServersWarnsAboutMultilineRawStructures|TestSaveCodexMcpServerPatchesTargetSectionOnly|TestSaveCodexMcpServerPatchesQuotedServerIDInPlace|TestSaveCodexMcpServerPatchesToolApprovalSections|TestSaveCodexMcpServerRejectsTransportConflict'
docs-linhay/scripts/check-docs.sh
```

说明：

- 本轮只改 Wails Go 侧 MCP 读取/保存与文档，未改前端代码，因此未重复运行 `npm run typecheck`。
- 未启动 Wails dev app 做桌面点击验收；本轮行为以 Go focused tests 覆盖保存文件内容、返回 DTO 和 warnings。
- 本轮未做 raw `config.toml` 后端备份，因此没有备份文件验证项。

## 下一轮候选判断

仍有可继续修改的下一轮候选：

1. raw `config.toml` 保存前 TOML 预检与后端备份提示。建议独立小步实现，必须补 Go 测试覆盖备份路径、失败恢复和返回 DTO。
2. Skills 启停规则来源解释。建议扩展 Skill DTO，展示命中的是 path rule、name rule、默认启用还是移除 override 后的结果。
3. MCP tool approval 前端结构化编辑入口强化。后端保存链路已补齐，下一轮可以把现有 `tools` textarea 或行级编辑器接入更明确的校验和保存提示。
4. MCP raw TOML 多行 AST patch。当前只做 warning；若要支持结构化 patch，多行数组/map 仍需要更完整的 TOML AST 方案或非常窄的局部 patch 边界。

仍不建议直接进入的候选：route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index。这些属于较大技术方案，应先定接口边界和失败测试。
