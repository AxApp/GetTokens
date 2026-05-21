# Claude Code Workspace 拆分会话沉淀

日期：2026-05-21

## 背景

本轮 Claude Code 对齐 Codex 时，先把 Skills / MCP 做成了一个 `extensions` 合并入口，再改成两个二级菜单，但首次实现仍是两个 URL 指向同一个 tabbed workbench。用户指出应参考 Codex 菜单：Codex 的 `skills` 与 `mcp-servers` 是两个独立 workspace 页面，而不是一个页面内 tab。

## 沉淀模式

当 Claude Code 能力对齐 Codex 已有 workspace 时，先看 Codex 的信息架构粒度：

- Codex 是独立 workspace，Claude 也应优先做独立 workspace。
- 页面 wrapper 只做 workspace dispatch，不承载业务。
- feature 内可共享 snapshot、DTO mapper、preview data、视觉 shell，但页面组件必须按业务面拆开。
- 旧 hash / localStorage 值要显式迁移，不能让旧入口回落到错误页面。
- 页面内 segmented control 只用于局部字段或过滤，不用于替代 sidebar 的二级导航。

## 本轮落地

- `#frame=claude&workspace=skills` 渲染 `ClaudeCodeSkillsWorkspace`。
- `#frame=claude&workspace=mcp-servers` 渲染 `ClaudeCodeMcpServersWorkspace`。
- `#frame=claude&workspace=extensions` 与旧存储值迁移到 `skills`。
- `ClaudePage` 保持薄 wrapper，按 `ClaudeWorkspace` 分派。
- `ClaudeCodeAssetWorkbench` 继续复用 `AssetWorkbenchShell`，但不再提供 Skills / MCP 页面导航 tab。

## 不纳入

- 不把所有 Claude Code 能力都强制做成 Codex 同构页面；settings、hooks、permissions、subagents 仍需按 Claude 官方语义单独判断。
- 不把这条规则升级到 `AGENTS.md`；它属于 GetTokens Claude/Codex workspace 领域规则，已写入 `gettokens-domain-engineering`。

## 后续入口

- 项目 skill：`.agents/skills/gettokens-domain-engineering/SKILL.md` 的 `Claude Code Workspace Parity`。
- 相关 space：`docs-linhay/spaces/20260521-claude-code-codex-alignment/`。
