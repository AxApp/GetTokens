# Claude Code Settings / Hooks / Permissions / Output Styles 技术调研

日期：2026-05-21
状态：P1 可实现，先做 settings JSON patcher，再做专用表单

## 结论

Settings、hooks、permissions、output styles 是 Claude Code 独有配置资产，不能按 Codex feature flags 建模。已验证可行的最小路径是：先实现通用 settings JSON snapshot + preservative patcher，P1 再在其上提供 env、permissions、hooks、outputStyle 的专用 UI。

## 已验证依据

- 官方文档确认 settings scope 和优先级：managed > command line > local `.claude/settings.local.json` > project `.claude/settings.json` > user `~/.claude/settings.json`。
- 官方文档确认数组类设置会跨 scope merge，例如 permissions allow/deny 不能简单按 scalar 覆盖。
- 官方 hooks 文档确认 `/hooks` 菜单是 read-only；新增、修改、删除 hook 仍要编辑 settings JSON。hooks 支持 `command`、`prompt`、`agent`、`http`、`mcp_tool` 等类型，并可定义在 settings、plugins、skills、agents。
- 官方 output styles 文档确认 output style 修改 system prompt，`outputStyle` 字段在 settings 中生效；自定义 output style 是独立 Markdown 资产，plugin 也可分发。
- 本地实现 `internal/wailsapp/claude_local_apply.go` 已能 patch `settings.json.env`，保留 `permissions`、`hooks`、`statusLine` 等顶层字段。
- 本地测试 `claude_local_apply_test.go` 已覆盖创建 settings、保留未知顶层和 env 字段、保留 `ANTHROPIC_AUTH_TOKEN`、拒绝 invalid JSON。

## 数据边界

- 读取：
  - user settings：`~/.claude/settings.json`
  - project settings：`.claude/settings.json`
  - local settings：`.claude/settings.local.json`
  - managed settings：只读展示来源，不在 GetTokens 写入。
- 写入：
  - P1 仅写 user/project/local 三层。
  - 保存前必须 parse JSON，invalid JSON 时禁止覆盖。
  - patch 目标字段时保留文件内未知字段和用户格式的基本稳定性。
- 不做：
  - 不编辑 managed policy。
  - 不承诺禁用单个 hook；官方当前语义只有 `disableAllHooks` 这种全局开关。

## 后端设计

- `GetClaudeCodeSettingsSnapshot(projectPath)`：
  - 返回每层 path、exists、parse status、known fields summary。
  - 合并视图只用于展示，不作为写回源。
- `PatchClaudeCodeSettings(input)`：
  - `scope=user|project|local`
  - `path` 必须匹配 scope。
  - `patch` 限制为受控字段路径，例如 `env.*`、`permissions.*`、`hooks`、`outputStyle`。
  - 写前备份，写后 parse。

## 前端设计

- 第一阶段：分 scope 的 JSON editor + field summary + diff preview。
- 第二阶段：
  - env 表单复用已有账号应用字段。
  - permissions 专用表单只操作 allow/deny/defaultMode。
  - hooks 表单先支持 read-only tree + JSON 编辑入口。
  - output styles 先显示当前 `outputStyle` 与 style 文件路径，Markdown 资产管理另开小节。

## TDD 红灯

- `internal/wailsapp/claude_code_settings_test.go`：
  - 读取三层 settings。
  - invalid JSON 返回 parse error，不丢文件。
  - patch `env.ANTHROPIC_MODEL` 保留 hooks/permissions/statusLine。
  - patch `disableAllHooks` 不删除现有 hooks。
  - patch array setting 时不自行合并多个 scope，只写目标文件。
- 前端测试：
  - managed scope 显示只读。
  - local settings 显示 gitignored 风险提示。
  - hooks 单个禁用按钮不出现。

## 验收方式

- `go test ./internal/wailsapp -run 'ClaudeCode.*Settings|ApplyClaudeCode'`
- `go test ./internal/wailsapp -run 'TestApplyClaudeCode'`
- browser preview 验收 JSON editor 和 field summary。
- Wails 桌面验收临时 `CLAUDE_CONFIG_DIR` 与临时 project `.claude` 写入。

## 风险

- settings 合并规则复杂，GetTokens 不应在 P1 自己模拟完整 Claude Code runtime，只显示 per-scope 和简单 effective hint。
- output styles 修改 system prompt，对行为影响大；新增/切换需要明确提示生效可能需 `/clear` 或新 session。

