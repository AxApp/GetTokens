# Claude Code 与 Codex 能力对齐

## 背景

GetTokens 已经把 Claude Code 账号列表从旧判断里的“单 key 本地配置”推进为可参与 relay 请求链路的 Anthropic 格式账号工作台；`20260519-claude-code-account-list` 已完成账号列表、请求顺序、启停、模型映射、路由探测和 browser preview。

本轮目标不是重复做账号列表，而是站在当前代码现状和 Claude Code 官方配置模型上，重新评估 Claude Code 与 Codex 工作台可以对齐到什么程度，并给出下一批可施工能力的优先级。

当前代码现状：
- Codex 工作区已有 `feature-config`、`binary-management`、`skills`、`mcp-servers`、`account-list`、`session-management`、`vendor-status`、`usage-codex`。
- Claude 工作区当前已有 `account-list`、`skills`、`mcp-servers`、`session-management`、`usage`；旧 `extensions` hash 仅作为 legacy 入口迁移到 `skills`。
- Claude local apply 已能写入 `~/.claude/settings.json` 的受控 `env` 字段，但明确不修改 MCP、permissions、hooks、statusLine。
- Claude 账号列表已复用统一 `AccountRecord`，按 `supportedFormats` 包含 `anthropic` 进入请求候选。

官方文档确认的 Claude Code 当前配置面：
- Settings 支持用户级、项目级、local 和 managed 分层；官方配置入口是 `settings.json`。
- MCP 服务器按 local/project/user scope 落到 `~/.claude.json` 或项目 `.mcp.json`。
- Skills 使用 `SKILL.md`，项目 `.claude/commands/` 仍可用，但 custom commands 已合并到 skills 语义中。
- Subagents、hooks、permissions、output styles 都是 Claude Code 明确支持的可管理资产。

## 目标

1. 建立 Claude Code 与 Codex 的能力对齐矩阵，区分“可直接复用”“可语义对齐但需适配”“Claude Code 独有能力”“不建议对齐”。
2. 给出下一期可交付范围，优先补齐与 Codex 高复用的扩展管理能力，再处理 Claude Code 独有但高价值的配置资产；每个能力块进入实现前必须先有独立技术调研。
3. 明确后端读写边界：Codex 的 TOML / auth-file / binary 逻辑不能硬套到 Claude Code；Claude Code 的 JSON、Markdown 和目录资产需要 preservative patch。
4. 保持 Claude 顶级工作区，不再把 Claude Code 功能挂回 Codex 子菜单。

## 范围

- 评估并设计以下能力的对齐路径：
  - 账号列表 / 路由探测 / 模型映射
  - Skills / commands
  - MCP servers
  - settings / permissions / hooks / outputStyle
  - CLAUDE.md / memory
  - subagents
  - session / usage
  - binary management
- 产出本轮对齐矩阵、逐块技术调研索引和 P0/P1 施工建议。
- 已进入实现阶段：Claude Code 资产工作台已接入真实 Wails 只读扫描与 MCP 单 server preservative patch；当前继续把合并入口拆成 `skills` / `mcp-servers` 二级菜单。

## 非目标

- 不在本 space 继续扩张 hooks、permissions 或 subagents 管理；Skills / MCP 当前只覆盖已调研验证的资产扫描、展示和 MCP 单 server 保存。
- 不把 Claude Code 做成 Codex 的子功能；两者保持同级工作区。
- 不把 Claude Code 本地 `settings.json` 当成多账号存储；多账号轮换继续发生在 GetTokens relay 内。
- 不承诺 100% UI 形态一致；对齐目标是功能语义、数据边界和用户工作流一致。

## 验收标准

1. Given 用户需要判断 Claude Code 后续完善方向，When 查看本 space，Then 能看到 Claude Code 与 Codex 各能力的对齐程度、复用度和优先级。
2. Given 某能力可复用 Codex 代码，When 查看矩阵，Then 能明确复用层级是前端 UI、纯模型、Wails DTO、后端 parser 还是仅交互模式。
3. Given 某能力是 Claude Code 独有，When 查看矩阵，Then 不会被误标为 Codex parity，而是作为 Claude-only enhancement 单独排期。
4. Given 后续进入开发，When 拆分任务，Then P0 优先覆盖 Skills/commands + MCP 的资产管理，以及 settings JSON patcher 的基础设施。
5. Given 后续实现涉及文件写入，When 保存 Claude Code 配置，Then 必须保留未知字段和用户已有配置，并提供 diff / preview。
6. Given 后续实现涉及真实桌面能力，When 交付，Then 需要补自动化测试、Wails/桌面验收和截图归档。
7. Given 某个 Claude Code 能力块准备进入实现，When 查看计划，Then 必须存在对应 `plans/research-*.md` 技术调研文档，覆盖官方语义、本地参考、GitHub 参考、数据边界、TDD 红灯和验收路径。
8. Given Claude Code 相关业务准备进入开发，When 打开设计系统，Then 必须先看到对应业务组件、mock 状态矩阵、Storybook 验收路径和截图归档规则。

## 对齐结论

| 能力 | 当前 Codex | 当前 Claude Code | 可对齐程度 | 结论 |
|------|------------|------------------|------------|------|
| 账号列表 / 请求顺序 / 路由探测 | 已完成 | 已完成本期落地 | 高，约 80% | 已经基本对齐，但 Claude 只纳入 `anthropic` 格式候选。 |
| 模型映射 | 已完成 | 已完成账号详情映射 | 高，约 75% | 语义可对齐，字段名需从 Codex alias 逐步收敛为通用 alias。 |
| Relay local apply | Codex config/auth 写入 | Claude `settings.json env` 写入 | 中高，约 70% | 已有基础；下一步补 settings 全字段 patcher。 |
| Skills / commands | Codex skills 工作台 | 目录与 `SKILL.md` 语义相近；commands 已并入 skills 语义 | 高，约 80-90% | 下一期 P0。后端应抽通用 skill scanner，按 target 提供 roots。 |
| MCP servers | Codex TOML 管理 | Claude JSON scope：`~/.claude.json` / `.mcp.json` | 高，约 75-85% | 下一期 P0。复用 UI 和模型，新增 JSON adapter 与 scope 语义。 |
| Feature config / settings | Codex `[features]` flags | Claude hierarchical `settings.json` | 中，约 50-60% | 不是同构能力；可对齐为“配置工作台 + diff preview”。 |
| CLAUDE.md / AGENTS.md | Codex 用 AGENTS.md 规则 | Claude 用 CLAUDE.md / CLAUDE.local.md | 中高，约 65% | 可做说明书/记忆资产编辑器，但文件层级不同。 |
| Hooks / permissions | Codex feature flags 里有 hooks 开关 | Claude 有完整 hooks / permissions 配置模型 | 低到中，约 40-50% | Claude-only enhancement，不应强行按 Codex feature config 建模。 |
| Subagents | Codex 有 subagent 执行能力但无同型 UI | Claude 有 `agents/` Markdown 资产和 `agent` setting | 中，约 60% | 独立价值高，建议 P1 作为资产管理页。 |
| Output styles | Codex 无直接对应 | Claude 有 output style Markdown 和 `outputStyle` setting | 低，约 30% | Claude-only enhancement，适合挂在配置资产工作台。 |
| Session management | Codex 已有 session/provider mapping | Claude session 存储需重新调研 | 低，约 30-40% | P2，先只读扫描，不做 provider 改写。 |
| Usage / quota | Codex 本地与 relay 用量 | Claude 可复用 relay 侧统计 | 中，约 50% | 先对齐 relay usage；原生 Claude usage 另行调研。 |
| Binary management | Codex release/binary 管理 | Claude 安装分发路径不同 | 中低，约 50% | P2，除非用户明确需要管理 `claude` CLI 版本。 |

## 分期建议

### P0：Claude Code 扩展资产工作台

- 新增 Claude workspace：`skills`、`mcp-servers`；旧 `extensions` 作为兼容 hash 迁移到 `skills`。
- Skills 覆盖用户级 `~/.claude/skills/`、项目级 `.claude/skills/`、兼容 `.claude/commands/` 只读展示与迁移提示。
- MCP 覆盖 user/local `~/.claude.json` 与 project `.mcp.json`，支持 stdio / http、env、headers、tool 限制和 scope 标记。
- 新增通用 target adapter：`codex` 使用 TOML adapter，`claude` 使用 JSON / directory adapter；前端组件尽量复用现有 Codex Extensions。

### P1：Claude Code 配置与行为资产

- settings JSON patcher：读取 `~/.claude/settings.json`、`.claude/settings.json`、`.claude/settings.local.json`，按分区展示 env、model、permissions、hooks、statusLine、outputStyle 等。
- CLAUDE.md 管理：用户级、项目级、local 文件的读取、编辑、模板和 diff preview。
- Subagents 管理：读取 `~/.claude/agents/` 与 `.claude/agents/`，解析 frontmatter，支持预览、创建、编辑和 tool 权限提示。
- Hooks / permissions 先基于 settings patcher 做专用 UI，不单独建立第二套后端写入逻辑。

### P2：平台化补齐

- Claude session 只读扫描与摘要。
- Claude relay usage 归因统一进入 usage desk。
- Claude binary / installer 管理调研后再决定是否做。
- Output styles 管理并入配置资产工作台。

## 技术边界

- Claude Code 的文件写入必须使用 preservative JSON / Markdown patch，不得重建整个文件覆盖未知字段。
- MCP 的 local scope 和 general local settings 不是同一类：MCP local 存在 `~/.claude.json` 的项目条目里，settings local 存在项目 `.claude/settings.local.json`。
- Skills 与 commands 需要按官方当前语义处理：commands 兼容但不再作为新能力主入口，优先鼓励迁移到 skills。
- 后续新增 Wails 方法时必须同步 root `app.go`、`app_types.go` 和 frontend bindings。
- browser preview 可覆盖布局和基础交互；涉及真实本地文件写入时必须做桌面/Wails 验证。

## 设计系统入口

- 本期入口：`Design System/业务组件/Claude Code 资产工作台`
- Storybook 文件：`frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.stories.tsx`
- 组件文件：`frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.tsx`
- 截图归档：
  - `screenshots/20260521/design-system/20260521-claude-code-asset-workbench-storybook-after-v01.png`
  - `screenshots/20260521/design-system/20260521-claude-code-asset-workbench-storybook-mobile-after-v01.png`

## Worktree 映射

- branch：`feat/20260521-claude-code-codex-alignment`
- worktree：`../GetTokens-worktrees/20260521-claude-code-codex-alignment/`

## 相关链接

- [Claude Code 功能对齐调研](../20260517-claude-code-feature-parity/README.md)
- [Claude Code Account List](../20260519-claude-code-account-list/README.md)
- [Codex Skills / MCP 本地扩展工作台](../20260511-cc-switch-codex-skills-mcp/README.md)
- [Claude Code settings 官方文档](https://code.claude.com/docs/en/settings)
- [Claude Code MCP 官方文档](https://code.claude.com/docs/en/mcp)
- [Claude Code skills / commands 官方文档](https://code.claude.com/docs/en/slash-commands)
- [Claude Code subagents 官方文档](https://code.claude.com/docs/en/sub-agents)
- [Claude Code hooks 官方文档](https://code.claude.com/docs/en/hooks)
- [Claude Code output styles 官方文档](https://code.claude.com/docs/en/output-styles)
- [Claude Code 专属能力技术调研索引](./plans/20260521-technical-research-index.md)
- [Claude Code 相关业务设计系统打磨计划](./plans/20260521-design-system-business-polish-plan.md)
- [账号路由与模型映射调研](./plans/research-account-routing-model-mapping.md)
- [Skills / Commands 调研](./plans/research-skills-commands.md)
- [MCP Servers 调研](./plans/research-mcp-servers.md)
- [Settings / Hooks / Permissions / Output Styles 调研](./plans/research-settings-hooks-permissions-output-styles.md)
- [CLAUDE.md / Memory 调研](./plans/research-claude-md-memory.md)
- [Subagents 调研](./plans/research-subagents.md)
- [Session / Usage 调研](./plans/research-session-usage.md)
- [Binary / Installer / Runtime 调研](./plans/research-binary-installer-runtime.md)
- [本地参考项目索引](../../references/README.md)

## 当前状态
- 状态：claude-skills-mcp-split-pages
- 最近更新：2026-05-21
