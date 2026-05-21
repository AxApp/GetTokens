# Claude Code 专属能力技术调研索引

日期：2026-05-21

## 调研原则

本 space 后续不再按“Codex parity”粗暴推进，而是按 Claude Code 专属能力块逐个做技术调研。每块进入开发前必须产出：

1. 官方语义：Claude Code 当前官方文档如何定义路径、字段、scope、优先级和限制。
2. 本地参考：`cc-switch`、`CLIProxyAPI`、`Cli-Proxy-API-Management-Center`、`cherry-studio`、`codex` 中有哪些可复用实现或反例。
3. GitHub 参考：至少 2 个外部项目或资料，记录可借鉴点和不可采纳点。
4. 数据边界：读哪些文件、写哪些文件、哪些字段只读、哪些字段必须 preservative patch。
5. TDD 红灯：进入实现前先列测试文件、关键断言和失败条件。
6. 交付验收：browser preview、Wails 桌面验证、截图或调研摘要落位。

## 参考项目池

### 本地参考

| 项目 | 本地路径 | 初步用途 |
|------|----------|----------|
| cc-switch | `docs-linhay/references/cc-switch/` | Claude provider、MCP sync/import、settings、skills、session、usage、provider presets。 |
| CLIProxyAPI | `docs-linhay/references/CLIProxyAPI/` | relay、Anthropic Messages、路由、协议转换、账号命中归因。 |
| Cli-Proxy-API-Management-Center | `docs-linhay/references/Cli-Proxy-API-Management-Center/` | Claude provider 管理、模型映射、usage UI、管理中心信息架构。 |
| cherry-studio | `docs-linhay/references/cherry-studio/` | `.agents/skills` 到 `.claude/skills` 同步、MCP server 内置实现、agent/skill 资产组织。 |
| codex | `docs-linhay/references/codex/` | Codex 侧 feature/config/session/binary 行为校准。 |

### GitHub / 外部参考

| 项目 | URL | 初步用途 |
|------|-----|----------|
| Claude Code 官方 Settings | `https://code.claude.com/docs/en/settings` | settings 分层、字段、managed policy、env 与 scope。 |
| Claude Code 官方 MCP | `https://code.claude.com/docs/en/mcp` | MCP scope、`.mcp.json`、`~/.claude.json`、transport 语义。 |
| Claude Code 官方 Skills / Commands | `https://code.claude.com/docs/en/slash-commands` | commands 到 skills 的官方语义、兼容边界。 |
| Claude Code 官方 Subagents | `https://code.claude.com/docs/en/sub-agents` | agent markdown、tools、model、scope。 |
| Claude Code 官方 Hooks | `https://code.claude.com/docs/en/hooks` | hook event、matcher、command、JSON 结构。 |
| Claude Code 官方 Output Styles | `https://code.claude.com/docs/en/output-styles` | output style markdown 与 settings `outputStyle`。 |
| musistudio/claude-code-router | `https://github.com/musistudio/claude-code-router` | Claude Code 路由、provider 转换、模型映射、runtime 配置。 |
| snowfort-ai/config | `https://github.com/snowfort-ai/config` | Claude Code 配置管理、MCP/插件组织参考。 |
| VoltAgent/awesome-claude-code-subagents | `https://github.com/VoltAgent/awesome-claude-code-subagents` | subagent 分类、模板资产、发现体验。 |
| jandroav/claude-mcp-switch | `https://github.com/jandroav/claude-mcp-switch` | MCP server 启停、profile 切换参考。 |
| spences10/mcpick | `https://github.com/spences10/mcpick` | MCP profile/server selection UX 参考。 |

## 能力块调研计划

### A. 账号列表 / 路由探测 / 模型映射

当前状态：`20260519-claude-code-account-list` 已实现第一轮；本轮已补可行性调研。

待调研问题：
- 非 `anthropic` 格式是否应通过 sidecar translator 进入 Claude Code 候选。
- 模型映射字段是否应从 `codexModel` 命名迁移到 `requestModel` / `aliasModel`。
- Claude Code Router / CLIProxyAPI 对 Anthropic Messages 与 OpenAI-compatible 转换的边界。

本地参考：
- `internal/wailsapp/claude_code_routing_probe.go`
- `docs-linhay/references/CLIProxyAPI/`
- `docs-linhay/references/cc-switch/src/config/claudeProviderPresets.ts`

输出文档：
- [`research-account-routing-model-mapping.md`](./research-account-routing-model-mapping.md)

### B. Skills / Commands

当前状态：已完成 P0 技术调研；结论为先做只读扫描 + 预览，写入能力分二期。

待调研问题：
- Claude Code 官方 skills 与 legacy `.claude/commands` 的兼容边界。
- 是否支持启停；若官方无启停语义，GetTokens 应做只读 / 删除 / 移动禁用，还是只做安装状态。
- `.agents/skills` 与 `.claude/skills` 是否采用 symlink mirror，还是复制 `SKILL.md`。
- Git source 安装时是否复用 Codex `tk://` 语义，还是新增 Claude 专属 source。

本地参考：
- `docs-linhay/references/cherry-studio/scripts/skills-sync.ts`
- `docs-linhay/references/cherry-studio/scripts/skills-check.ts`
- `docs-linhay/references/cc-switch/src-tauri/tests/skill_sync.rs`

GitHub 参考：
- `snowfort-ai/config`
- Claude Code 官方 Skills / Commands 文档

输出文档：
- [`research-skills-commands.md`](./research-skills-commands.md)

### C. MCP Servers

当前状态：已完成 P0 技术调研；结论为新增 Claude JSON adapter，支持 user/project/local scope 的单 server patch。

待调研问题：
- `~/.claude.json`、`.mcp.json`、project-local scope 的实际读写优先级。
- 是否需要统一管理 user/project/local 三种 scope，还是 P0 只做 user + project。
- `type=stdio/http/sse` 与 Codex `streamable_http` 的字段兼容关系。
- 修改 MCP 时如何保留 `hasCompletedOnboarding`、projects、其它 Claude Code 未知字段。

本地参考：
- `docs-linhay/references/cc-switch/src-tauri/src/claude_mcp.rs`
- `docs-linhay/references/cc-switch/src-tauri/src/services/mcp.rs`
- `internal/wailsapp/codex_extensions.go`

GitHub 参考：
- `jandroav/claude-mcp-switch`
- `spences10/mcpick`
- Claude Code 官方 MCP 文档

输出文档：
- [`research-mcp-servers.md`](./research-mcp-servers.md)

### D. Settings / Permissions / Hooks / Output Styles

当前状态：已完成 P1 技术调研；结论为先做 settings JSON patcher，再在其上做 env、permissions、hooks、outputStyle 专用 UI。

待调研问题：
- `settings.json` 四层 scope 的实际合并顺序与 GetTokens 可展示方式。
- permissions 和 hooks 是否先做专用表单，还是 JSON editor + schema hint。
- output style 是 Markdown 资产管理，还是 settings 字段选择器。
- JSON patcher 是否需要保留注释；如果 JSON 标准不支持注释，应如何处理 trailing unknown 字段与格式稳定。

本地参考：
- `internal/wailsapp/claude_local_apply.go`
- `docs-linhay/references/cc-switch/docs/user-manual/*/5-faq/5.1-config-files.md`
- `docs-linhay/references/cc-switch/src-tauri/src/settings.rs`

GitHub 参考：
- `snowfort-ai/config`
- Claude Code 官方 Settings / Hooks / Output Styles 文档

输出文档：
- [`research-settings-hooks-permissions-output-styles.md`](./research-settings-hooks-permissions-output-styles.md)

### E. CLAUDE.md / Memory

当前状态：已完成 P1 技术调研；结论为做 user/project/local 文件发现、预览和编辑，默认建议 `@AGENTS.md` import，不自动双写。

待调研问题：
- 用户级、项目级、local CLAUDE 文件的发现、编辑和冲突提示。
- import / include 语义是否需要解析，还是 P0 只做文本编辑和引用提示。
- 与 GetTokens `AGENTS.md` / `docs-linhay/memory` 的概念边界。

本地参考：
- `AGENTS.md`
- `docs-linhay/references/cc-switch/docs/user-manual/*/5-faq/5.1-config-files.md`
- `docs-linhay/references/cherry-studio/CLAUDE.md`

GitHub 参考：
- Claude Code 官方 Memory 文档
- `snowfort-ai/config`

输出文档：
- [`research-claude-md-memory.md`](./research-claude-md-memory.md)

### F. Subagents

当前状态：已完成 P1 技术调研；结论为扫描/预览/创建可做，市场模板导入需 license/source 校验后再做。

待调研问题：
- agent markdown frontmatter 字段、tools 白名单、model 字段和 scope。
- subagent 与 skills 的 UI 信息架构是否合并为“Claude 资产”。
- 是否需要从 awesome-subagents 导入模板，导入时如何处理许可证和来源。

本地参考：
- `docs-linhay/references/cherry-studio/resources/builtin-agents/`
- `docs-linhay/references/cherry-studio/resources/data/agents-*.json`

GitHub 参考：
- `VoltAgent/awesome-claude-code-subagents`
- Claude Code 官方 Subagents 文档

输出文档：
- [`research-subagents.md`](./research-subagents.md)

### G. Session / Usage

当前状态：已完成 P2 技术调研；结论为仅做只读摘要与 relay usage 归因，不写 Claude 原生 session。

待调研问题：
- Claude Code session 文件路径、格式、隐私字段、可展示摘要。
- relay usage 与本地 session usage 的归因边界。
- 是否只做只读摘要，避免修改 Claude 原生 session。

本地参考：
- `frontend/src/features/session-management/`
- `internal/wailsapp/session_management.go`
- `docs-linhay/references/cc-switch/session-manager.md`
- `docs-linhay/references/cc-switch/src/lib/api/sessions.ts`

GitHub 参考：
- `musistudio/claude-code-router`
- `ccusage` 类 Claude usage 工具后续另查

输出文档：
- [`research-session-usage.md`](./research-session-usage.md)

### H. Binary / Installer / Runtime

当前状态：已完成 P2 技术调研；结论为只做安装状态与 PATH doctor，暂不管理版本安装/升级。

待调研问题：
- Claude Code 当前官方安装渠道、版本发现和升级策略。
- 是否值得管理 `claude` CLI 二进制，还是只做安装状态与 PATH doctor。
- auto-updater env（例如禁用自动更新）是否属于 settings 管理，而不是 binary 管理。

本地参考：
- `internal/codexbinary/`
- `docs-linhay/references/cc-switch/docs/user-manual/*/2-providers/2.1-add.md`
- `docs-linhay/references/cc-switch/src-tauri/src/settings.rs`

GitHub 参考：
- Claude Code 官方安装文档
- `snowfort-ai/config`

输出文档：
- [`research-binary-installer-runtime.md`](./research-binary-installer-runtime.md)

## 调研顺序

1. P0：Skills / Commands、MCP Servers、本地参考项目治理。
2. P1：Settings / Hooks / Permissions / Output Styles、CLAUDE.md / Memory、Subagents。
3. P2：Session / Usage、Binary / Installer / Runtime。

## 当前结论

- 本轮先不直接写产品代码。
- 所有 Claude 专属能力进入开发前都要先补独立 research 文档；截至 2026-05-21，本索引列出的 8 个能力块均已有第一版可行性调研。
- 本地参考项目源码目录默认不进 git，调研结论进 space plans 或 references 根部 Markdown。
- P0 可进入下一步 BDD/TDD 的能力只有 Skills / Commands 与 MCP Servers；Settings、CLAUDE.md、Subagents 为 P1，Session/Usage 与 Binary/Runtime 暂按只读或状态诊断处理。
