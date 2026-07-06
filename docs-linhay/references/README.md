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
| `cc-switch` | `docs-linhay/references/cc-switch/` | Claude Code provider、MCP、skills、settings、session、usage 等桌面管理参考；已更新到 2026-05-27 `origin/main` HEAD `3c3d417457a4c3420139488c19718b7415641584`，版本 `3.15.0`。 |
| `CLIProxyAPI` | `docs-linhay/references/CLIProxyAPI/` | GetTokens sidecar fork，relay、Anthropic/OpenAI 协议转换、账号路由参考。 |
| `Cli-Proxy-API-Management-Center` | `docs-linhay/references/Cli-Proxy-API-Management-Center/` | Web 管理中心，Claude provider、模型映射、usage UI 参考。 |
| `cherry-studio` | `docs-linhay/references/cherry-studio/` | Skills 同步、MCP server、agent/skill 资产组织参考。 |
| `cockpit-tools` | `docs-linhay/references/cockpit-tools/` | AI IDE 账号管理、多平台账号切换、配额监控、多实例与 Codex/CLIProxyAPI sidecar 集成参考；本地浅克隆更新到 2026-07-01 `origin/main` HEAD `746b7c4e0dae83bd34b4401f6c2350404e305f74`。 |
| `codex` | `docs-linhay/references/codex/` | Codex CLI 官方源码镜像，已更新到 2026-05-22 `origin/main` HEAD `162a6e746b7b4ef6024ccc819bf8ceaaa5f802f6`，用于行为校准参考。 |
| `OmniRoute` | `docs-linhay/references/OmniRoute/` | 多 provider AI gateway / OpenAI-compatible endpoint 参考；本地浅克隆更新到 2026-06-15 `origin/main` HEAD `4066a2ca3122f4c81ec17eb2b7b8b3fa0c9c52fc`，可用于路由、fallback、provider 聚合与 CLI 兼容能力调研。 |
| `agent-as-a-router` | `docs-linhay/references/agent-as-a-router/` | 多 LLM agentic coding 路由参考；本地缓存论文、主页、GitHub tree 与关键源码/benchmark/demo/test 文件，摘要见 `20260625-agent-as-a-router-research.md`；后期需求落位 `docs-linhay/spaces/20260625-auto-model-routing/`。 |
| `taste-skill` | `docs-linhay/references/taste-skill/` | AI 前端设计 skills、反模板化 UI、image-to-code、品牌板和 Web/移动端视觉生成参考；本地镜像更新到 2026-05-26 `3c7017d636c3a4aad378433ea6d0cfa6c921da4a`，摘要见 `20260604-frontend-design-reference-projects.md`，已合并沉淀到统一入口 `.agents/skills/gettokens-frontend-design-quality/`。 |
| `impeccable` | `docs-linhay/references/impeccable/` | 前端设计质量 skill、23 个命令、anti-pattern 检测、live iteration 与 PRODUCT/DESIGN 文档化参考；本地镜像更新到 2026-06-03 `1d5d745823aae7019044e8b0a621af4366dae224`，摘要见 `20260604-frontend-design-reference-projects.md`，已合并沉淀到统一入口 `.agents/skills/gettokens-frontend-design-quality/`。 |
| `frontend-system-design` | `docs-linhay/references/frontend-system-design/` | 大型前端系统设计 checklist（PRD、架构、性能、安全、i18n、治理、QA）；本地镜像为 2022-02-24 `ca56b546e5f12c408a2e75b2499264aacba99065`，摘要见 `20260604-frontend-design-reference-projects.md`，已合并沉淀到统一入口 `.agents/skills/gettokens-frontend-design-quality/`。 |

## GitHub 调研候选

- `musistudio/claude-code-router`：Claude Code 请求路由、provider 转换、配置面参考。
- `snowfort-ai/config`：Claude Code 配置、MCP、插件化管理参考。
- `VoltAgent/awesome-claude-code-subagents`：subagents 资产组织、分类与模板参考。
- `jandroav/claude-mcp-switch`：MCP 配置切换和启停参考。
- `spences10/mcpick`：MCP profile / server selection 参考。
- `yynxxxxx/GPTSession2CPAandSub2API`：多格式自动检测、转换为 CPA 格式并上传的流程参考。
