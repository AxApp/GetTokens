# Claude Code CLAUDE.md / Memory 技术调研

日期：2026-05-21
状态：P1 可做只读/编辑器，import 解析先做预览不做自动重写

## 结论

CLAUDE.md 是 Claude Code 的长期行为指导资产，不等同于 GetTokens 的 `AGENTS.md` 或 qmd memory。P1 可以做 user/project/local CLAUDE 文件发现、预览、编辑和 `@AGENTS.md` import 建议；不直接把 GetTokens memory 自动同步进 CLAUDE.md。

## 已验证依据

- 官方 memory 文档确认：Claude Code 读取 `CLAUDE.md`，不是 `AGENTS.md`；已有 `AGENTS.md` 的仓库可通过 `@AGENTS.md` import 或 symlink 让 Claude 读取同一规则。
- 官方文档确认路径：
  - user：`~/.claude/CLAUDE.md`
  - project：`./CLAUDE.md` 或 `./.claude/CLAUDE.md`
  - local：`CLAUDE.local.md`
- 官方文档确认 `@path/to/import` 支持相对/绝对路径，递归最多五跳；`CLAUDE.local.md` 应 gitignore。
- 本地 GetTokens 已有 `AGENTS.md`，且 `.gitignore` 当前忽略 `/CLAUDE.md`，适合后续生成本地 Claude 专属入口而不污染 git。

## 数据边界

- 读取：
  - `~/.claude/CLAUDE.md`
  - repo root `CLAUDE.md`
  - repo root `.claude/CLAUDE.md`
  - repo root `CLAUDE.local.md`
  - 子目录 CLAUDE 文件只在用户指定 project path 时按需扫描。
- 写入：
  - P1 可写 user / project / local 单文件。
  - 新建 repo root `CLAUDE.md` 前必须提示它可能被 `.gitignore` 忽略。
  - 不自动修改 `AGENTS.md`。
- 只读解析：
  - 识别 `@...` import，显示目标存在/缺失。
  - 不自动展开并重写 import 内容。

## 后端设计

- `GetClaudeCodeMemoryFiles(projectPath)`：
  - 返回 scope、path、exists、gitIgnored、imports。
- `SaveClaudeCodeMemoryFile(input)`：
  - 限定目标 path 在允许列表内。
  - 写前备份，保存 markdown。
- `ValidateClaudeCodeMemoryImports(path)`：
  - 解析 `@` import，限制最多五层，只做存在性与循环提示。

## TDD 红灯

- 发现 `@AGENTS.md` import 并标记存在。
- `CLAUDE.local.md` 未 gitignore 时提示风险。
- import 循环不导致无限递归。
- 保存 `CLAUDE.md` 不修改 `AGENTS.md`。

## 验收方式

- Go 单测覆盖路径发现与 import parser。
- browser preview 验收 Markdown 预览和 import 状态。
- Wails 桌面验收本地临时 repo 文件读写。

## 风险

- CLAUDE.md 是行为指导，不是强制策略；安全策略仍应放 settings permissions / managed settings。
- 自动把 AGENTS 全量复制到 CLAUDE.md 容易形成双写漂移，默认只建议 import。

