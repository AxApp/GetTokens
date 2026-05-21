# 参考项目索引

`docs-linhay/references/` 用于放调研索引、外部资料链接和少量手工摘录。完整源码型参考项目默认只在本机存在，不进入 GetTokens 主仓库。

## 版本控制规则

- 可提交：本目录根部的 `*.md` 索引、调研摘要、外部链接清单。
- 不提交：`docs-linhay/references/<project>/` 下的完整外部源码、克隆仓库、构建产物、依赖目录。
- 如需记录某个参考项目的具体结论，写入 space 的 `plans/` 或本目录根部 Markdown，不直接提交外部源码。
- 既有已跟踪参考目录视为历史遗留；后续新增参考项目必须遵循本规则。

## 当前本地参考项目

| 项目 | 本地路径 | 用途 |
|------|----------|------|
| `cc-switch` | `docs-linhay/references/cc-switch/` | Claude Code provider、MCP、skills、settings、session、usage 等桌面管理参考。 |
| `CLIProxyAPI` | `docs-linhay/references/CLIProxyAPI/` | GetTokens sidecar fork，relay、Anthropic/OpenAI 协议转换、账号路由参考。 |
| `Cli-Proxy-API-Management-Center` | `docs-linhay/references/Cli-Proxy-API-Management-Center/` | Web 管理中心，Claude provider、模型映射、usage UI 参考。 |
| `cherry-studio` | `docs-linhay/references/cherry-studio/` | Skills 同步、MCP server、agent/skill 资产组织参考。 |
| `codex` | `docs-linhay/references/codex/` | Codex CLI 官方源码镜像，Codex 行为校准参考。 |

## GitHub 调研候选

- `musistudio/claude-code-router`：Claude Code 请求路由、provider 转换、配置面参考。
- `snowfort-ai/config`：Claude Code 配置、MCP、插件化管理参考。
- `VoltAgent/awesome-claude-code-subagents`：subagents 资产组织、分类与模板参考。
- `jandroav/claude-mcp-switch`：MCP 配置切换和启停参考。
- `spences10/mcpick`：MCP profile / server selection 参考。
