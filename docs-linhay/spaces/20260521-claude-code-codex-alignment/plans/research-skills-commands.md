# Claude Code Skills / Commands 技术调研

日期：2026-05-21
状态：P0 可实现，先只读扫描 + 预览，写入分二期

## 结论

Claude Code Skills 与 Codex Skills 在 UI 工作流上高度可复用，但数据语义必须按 Claude Code 单独实现。P0 可以做 `~/.claude/skills/`、`~/.agents/skills/`、项目 `.agents/skills/`、项目 `.claude/skills/`、兼容 `.claude/commands/` 的扫描、预览、来源标记和 Git source 预研；不先做“启停开关”，因为 Claude Code 的可见性和触发控制主要来自 frontmatter，而不是 Codex 的 `[[skills.config]] enabled=false`。

## 已验证依据

- 官方文档确认：skill 是包含 `SKILL.md` 的目录；personal 路径为 `~/.claude/skills/<skill-name>/SKILL.md`，project 路径为 `.claude/skills/<skill-name>/SKILL.md`；legacy `.claude/commands/` 仍可用，并且 skill 与 command 同名时 skill 优先。
- 官方 frontmatter 已确认包含 `name`、`description`、`when_to_use`、`argument-hint`、`arguments`、`disable-model-invocation`、`user-invocable`、`allowed-tools`、`model`、`effort`、`context`、`agent`、`hooks`、`paths`、`shell` 等字段。
- 本地参考 `docs-linhay/references/cherry-studio/scripts/skills-sync.ts` 已证明 `.agents/skills/<skill>` 可以通过 symlink mirror 到 `.claude/skills/<skill>`。
- 本地参考 `docs-linhay/references/cherry-studio/scripts/skills-check.ts` 已证明 skill 白名单、symlink 目标和 git tracked 文件范围可以自动校验。
- GetTokens 当前项目级 skills 实际安装在 `.agents/skills/`，用户级开放标准目录为 `~/.agents/skills/`；Claude skills 页面只读扫描必须直接覆盖这两类 roots，否则本机页面会误显示空态。
- 可行性验证已跑过 Node frontmatter 解析原型，可解析 `SKILL.md` 的 YAML frontmatter 与 markdown body。

## 数据边界

- 读取 roots：
  - user：`$CLAUDE_CONFIG_DIR/skills` 或默认 `~/.claude/skills`
  - user agent：`~/.agents/skills`
  - project agent：`<repo>/.agents/skills`
  - project：`<repo>/.claude/skills`
  - legacy command：`<repo>/.claude/commands`
- P0 写入：不写入用户现有 skill；只提供扫描和预览。
- P1 写入：
  - 新增 skill：仅写目标 root 下的新目录，目录名 slug 校验。
  - 删除：需要二次确认，只允许删除已识别 root 内目录。
  - `.agents/skills` mirror：只读扫描可直接读取；涉及同步到 `.claude/skills` 时优先采用 symlink，Windows 或权限受限时降级为复制前必须另行验证。
- 不复用 Codex 的 `[[skills.config]] enabled=false`，Claude Code 没有同构禁用语义。

## 后端设计

- 新增 `internal/wailsapp/claude_code_extensions.go`：
  - `GetClaudeCodeSkillsSnapshot`
  - `GetClaudeCodeSkillFile`
  - 后续再加 `CreateClaudeCodeSkill` / `RemoveClaudeCodeSkill`
- scanner 只识别：
  - `SKILL.md`
  - `.claude/commands/*.md`
- frontmatter 解析失败时保留文件记录，但标记 `parseError`，不能丢弃用户资产。

## 前端设计

- 复用 Codex Extensions 的列表、搜索、详情 modal、Markdown 预览。
- target adapter 输出统一 record：
  - `target=claude`
  - `kind=skill | legacy-command`
  - `scope=user | project`
  - `path`
  - `frontmatter`
  - `previewAvailable`
- 对 legacy command 加迁移提示：可继续使用，但新增能力优先创建 skill。

## TDD 红灯

- `internal/wailsapp/claude_code_extensions_test.go`：
  - 扫描 `CLAUDE_CONFIG_DIR/skills/foo/SKILL.md`。
  - 扫描 `~/.agents/skills/foo/SKILL.md` 和项目 `.agents/skills/bar/SKILL.md`。
  - 扫描项目 `.claude/skills/bar/SKILL.md`。
  - 扫描 `.claude/commands/deploy.md` 为 `legacy-command`。
  - frontmatter 缺失时从正文首段生成摘要。
  - 路径穿越、非 root 内 symlink 不允许作为可删除目标。
- `frontend/src/features/cli-extensions/model.test.mjs`：
  - Claude skill / command source label 正确。
  - legacy command 不显示 Codex enable/disable 开关。
  - Markdown 预览渲染前移除 YAML frontmatter。

## 验收方式

- `go test ./internal/wailsapp -run 'ClaudeCode.*Skill|ApplyClaudeCode'`
- `npm --prefix frontend run test:unit -- src/features/cli-extensions/model.test.mjs`
- browser preview 验收列表和详情，不做真实文件写入。
- Wails 桌面验收真实本机路径读取。

## 风险

- skill live reload 与新目录 watch 有差异，GetTokens 只能提示“Claude Code 可能需要重启会话”，不应承诺立即生效。
- `allowed-tools`、`hooks`、`paths` 等字段未来可能变化，P0 解析时必须保留未知 frontmatter。
