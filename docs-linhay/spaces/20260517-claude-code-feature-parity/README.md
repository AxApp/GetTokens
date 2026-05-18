# Claude Code 功能对齐调研

## 背景

GetTokens 的 Codex 工作台已围绕 Codex CLI 建立了 13 项独特功能，覆盖账号管理、路由探测、二进制管理、配额追踪、会话管理、Skills/MCP 扩展管理等。Claude Code 侧目前仅有状态页的 relay local apply（`settings.json` env 一键写入），差距明显。

本 space 系统调研 Codex 现有功能在 Claude Code 侧的可行性与优先级，为后续 backlog 提供决策依据。

## Claude Code 配置模型速览

| 文件 | 格式 | 内容 |
|------|------|------|
| `~/.claude/settings.json` | JSON | env、permissions、hooks、statusLine、model、includeCoAuthoredBy、cleanupPeriodDays |
| `~/.claude.json` | JSON | mcpServers、projects、installSource |
| `~/.claude/CLAUDE.md` | Markdown | 用户级系统指令 |
| `~/.claude/skills/` | 目录 | 用户自定义 Skills |
| `~/.claude/agents/` | 目录 | 自定义 Agents |
| `.claude/settings.json` (项目级) | JSON | 项目级 settings，与用户级合并 |
| `.claude/CLAUDE.md` (项目级) | Markdown | 项目级系统指令 |

对比 Codex 的 `config.toml`（TOML）+ `auth.json`（JSON），Claude Code 的配置分布在更多文件中，且 `mcpServers` 在 `~/.claude.json` 而非 `settings.json`。

---

## 功能对齐分析

### 1. Skills 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| Skills 目录 | `$CODEX_HOME/skills`、`$HOME/.agents/skills`、`/etc/codex/skills` | `~/.claude/skills/`、项目 `.claude/skills/` |
| Skill 格式 | `SKILL.md` + YAML front matter | 同格式（`SKILL.md`） |
| 启停机制 | `config.toml` 的 `[[skills.config]]` | settings.json 的 `skills` 字段或 `.claude/skills/` 目录存在性 |
| Git 安装 | `tk://github.com/...` / `tk://gitlab.com/...` schema | 同 schema 可用 |
| 文件预览 | 支持 | 同需求 |

**结论：可直接复用。** Claude Code 的 Skills 机制与 Codex 高度相似，`SKILL.md` 格式通用。GetTokens 现有 Skills 管理基础设施（扫描、解析、启停、预览、Git 安装）可 80%+ 复用，主要差异在启停配置写入目标文件不同（Codex 写 `config.toml`，Claude Code 需确认是 `settings.json` 还是 `~/.claude.json`）。

**优先级：P0** — 用户高频使用的扩展管理能力。

---

### 2. MCP Servers 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 配置位置 | `config.toml` 的 `[mcp_servers.<id>]` | `~/.claude.json` 的 `mcpServers.<id>` |
| 配置格式 | TOML section | JSON object |
| Transport 推断 | `command`→stdio, `url`→streamable_http | 同规则 |
| 字段集 | command/args/env/env_vars/cwd/url/http_headers/timeouts/tool filters/scopes | 同字段集（JSON 格式） |
| 嵌套 Tool 配置 | `[mcp_servers.<id>.tools.<tool>]` | `mcpServers.<id>.tools.<tool>` |

**结论：可直接复用，需适配 JSON 格式。** Claude Code 的 MCP 配置语义与 Codex 几乎一致，只是文件格式不同（JSON vs TOML）。GetTokens 现有的 MCP 编辑基础设施（transport 推断、字段编辑、tool filters、preservative patch）可复用，但写入目标需从 `config.toml` TOML patcher 改为 `~/.claude.json` JSON patcher。

**优先级：P0** — MCP 是 Claude Code 核心扩展机制，用户管理需求强烈。

---

### 3. 二进制版本管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 发布源 | GitHub Releases (`openai/codex`, tag 前缀 `rust-v`) | GitHub Releases (`anthropics/claude-code`, 可能为 `@anthropic-ai/claude-code` npm 包) |
| 平台匹配 | aarch64/x86_64 apple-darwin | 同架构 |
| 下载/导入/激活 | 支持 | 同需求 |
| PATH 管理 | 一键注入 shell profile | 同需求 |

**结论：可复用架构，需适配发布源。** Claude Code 通过 npm 分发（`@anthropic-ai/claude-code`），也可通过 GitHub Releases 下载。二进制管理核心流程（导入、下载、版本切换、PATH 管理）可直接复用，差异仅在发布 API 和资源匹配规则。

**注意：** Claude Code 官方推荐 `npm install -g @anthropic-ai/claude-code`，二进制直管可能不如 npm 更新方便。需权衡是否值得投入。如果用户使用 `claude` CLI（非 npm 安装），则有管理价值。

**优先级：P2** — 有价值但非紧迫；npm 全局安装已覆盖大部分场景。

---

### 4. API Key 存储与管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| Key 存储 | JSON 文件在 `~/.config/gettokens-data/codex-api-keys/` | 不需要独立存储 — Claude Code 只用 `env.ANTHROPIC_API_KEY` |
| 多 Key 优先级 | 支持排序、启停 | Claude Code 单 key 模型，无多 key 需求 |
| Key 配置 | base URL、label、proxy、headers、排除模型、quota curl | 仅 API key + base URL + model |

**结论：不需要。** Claude Code 使用 API key 模式，一个 key 对应一个 `ANTHROPIC_API_KEY`，不存在 Codex 的多 OAuth auth-file 场景。GetTokens 现有的 API key store 不适用于 Claude Code。但 relay key 的管理（多 relay endpoint → 选择写入 settings.json）已在 status 页支持。

**优先级：N/A** — 不适用。

---

### 5. 账号列表与路由探测

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 多账号聚合 | OAuth auth-files + API keys + OpenAI-compatible providers | 不适用（单 API key 模型） |
| 路由优先级 | 拖拽排序 | 不适用 |
| 路由策略 | Allow/Deny/Default per account | 不适用 |
| 路由探测 | 发送探测请求，比对前后用量 | 不适用 — Claude Code 直连 API，无多账号路由 |

**结论：不适用。** Codex 的路由探测针对多账号中继场景设计。Claude Code 直接使用 `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`，不存在多账号路由选择问题。但 relay 侧的请求归属追踪（哪个 relay key 走了多少 token）可独立于工具做。

**优先级：N/A** — 架构差异，不适用。

---

### 6. 配额与用量追踪

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| Auth-file 配额 | OAuth API 查询 | 不适用（API key 模式） |
| API Key 配额 | quota curl 自定义命令 | 可用（Anthropic API 有 usage/tier 接口） |
| 用量归因 | 按 auth-file / api-key 统计 | 可按 relay key 统计 |

**结论：部分可复用。** quota curl 机制可用于 Anthropic API key 查询。用量归因可复用 relay 侧的请求计数。但 Codex 的 OAuth 配额查询不适用于 Claude Code。

**优先级：P2** — relay 用量统计更有价值，单个 API key 的 quota 查看优先级较低。

---

### 7. Feature / 配置管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 管理目标 | `config.toml` 的 `[features]` section（40+ 布尔开关） | `settings.json` 的所有字段 |
| 配置预览 | diff 预览、preservative patch | JSON diff 预览 + preservative merge |
| 分类组织 | stable/experimental/deprecated/removed | 按 settings.json 顶层 key 组织 |

**结论：高价值。** Claude Code 的 `settings.json` 有大量可配置字段（permissions、hooks、statusLine、model、cleanupPeriodDays 等），目前 GetTokens 只能写 env 字段。一个通用的 settings.json 查看器/编辑器（类似 Codex feature config 面板）可大幅提升可用性。

**优先级：P1** — 扩展 env-only 到全字段管理。

---

### 8. CLAUDE.md 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 管理目标 | 无直接对应（Codex 用 AGENTS.md） | `~/.claude/CLAUDE.md`（用户级）+ `.claude/CLAUDE.md`（项目级） |
| 编辑预览 | 无现有功能 | 文本编辑器 + Markdown 预览 |

**结论：新增能力。** Claude Code 的 CLAUDE.md 是核心自定义机制（系统指令注入）。GetTokens 可提供 CLAUDE.md 的查看、编辑、模板化能力。用户级 CLAUDE.md 全局生效，项目级 CLAUDE.md 按项目覆盖。

**优先级：P1** — 高价值、低复杂度，Claude Code 用户的核心自定义入口。

---

### 9. Hooks 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 管理目标 | 无直接对应 | `settings.json` 的 `hooks` 字段 |
| 事件类型 | N/A | PreToolUse、PostToolUse、Notification、Stop、SessionStart 等 |
| 配置复杂度 | N/A | 每个 hook 有 matcher（工具名正则）+ command（shell 命令/脚本） |

**结论：新增能力。** Claude Code 的 hooks 系统是其独特功能（Codex 无对应）。可视化编辑 hook matcher 和 command，提供模板 hook 预设，可降低用户配置门槛。

**优先级：P2** — 有需求但配置复杂，初期可提供 JSON 文本编辑 + 模板。

---

### 10. Permissions 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 管理目标 | 无直接对应 | `settings.json` 的 `permissions` 字段 |
| 权限规则 | N/A | allow/deny/ask 按工具名或模式匹配 |

**结论：新增能力。** 类似 hooks，Claude Code 的 permissions 系统独特且实用。可视化编辑比手写 JSON 更友好。

**优先级：P2** — 与 Feature/配置管理合并到 settings.json 通用编辑器中即可。

---

### 11. Session 管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| Session 列表 | Codex CLI sessions | Claude Code sessions（不同存储格式） |
| Provider 映射 | 支持更新 session provider mapping | Claude Code 无此概念 |
| Session 详情 | 模型、provider、状态 | 项目路径、模型、最后活跃时间等 |

**结论：部分可参考。** Claude Code 有 session/对话历史（存储在 `~/.claude/projects/` 下），但与 Codex session 的数据结构和 API 不同。如有读取 Claude Code session 的能力，可展示使用统计。

**优先级：P2** — 需先调研 Claude Code session 存储格式。

---

### 12. Relay Local Apply（一键配置）

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 写入目标 | `config.toml` + `auth.json` | `settings.json` 的 `env` 字段 |
| Diff 预览 | 结构化 patch 预览 | 已实现 |
| 冲突检测 | provider 冲突 | ANTHROPIC_AUTH_TOKEN 冲突 |

**结论：已完成。** Claude Code 的 relay local apply 已实现（env 字段写入），但仅覆盖 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL` 三个字段。

**扩展空间：** 可支持写入更多 env 字段（`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_SMALL_FAST_MODEL`），以及非 env 字段（model、permissions 等）。

**优先级：P0（扩展）** — 最小闭环已完成，扩展 env 字段和 settings 编辑范围可显著提升价值。

---

### 13. 模型供应商管理

| 维度 | Codex 现状 | Claude Code 可行性 |
|------|-----------|-------------------|
| 管理目标 | `config.toml` 的 `[model_providers.<id>]` | `settings.json` 的 `env.ANTHROPIC_BASE_URL` + 第三方 API 兼容 |
| 供应商列表 | 枚举本地配置 | 同概念 |

**结论：有限适用。** Claude Code 不直接支持多 provider 切换（这是 Codex 的特性），但可通过修改 `ANTHROPIC_BASE_URL` 指向 relay 或其他兼容 API 来间接实现。

**优先级：P2** — 与 relay local apply 合并。

---

## 优先级汇总

### P0 — 核心闭环（应优先投入）

| 功能 | 复用度 | 说明 |
|------|--------|------|
| **Skills 管理** | 80%+ | Codex Skills 基础设施可直接复用到 Claude Code skills 目录 |
| **MCP Servers 管理** | 70%+ | 语义相同，需适配 JSON 格式（`~/.claude.json`）替代 TOML |
| **Relay Local Apply 扩展** | 已完成基础 | 扩展 env 字段覆盖范围，增加 settings.json 通用编辑入口 |

### P1 — 工作台扩展（高价值、中等投入）

| 功能 | 复用度 | 说明 |
|------|--------|------|
| **Feature / 配置管理** | 50% | Codex feature config 面板可参考，但 Claude Code 是 JSON schema 而非 feature flags |
| **CLAUDE.md 管理** | 新增 | 用户级/项目级 CLAUDE.md 查看编辑，可结合模板 |
| **Hooks 管理** | 新增 | Claude Code 独有功能，可视化编辑 hooks 配置 |

### P2 — 平台化（后续考虑）

| 功能 | 复用度 | 说明 |
|------|--------|------|
| **二进制版本管理** | 60% | 架构可复用，但 Claude Code 主要走 npm 分发，需求有限 |
| **Permissions 管理** | 合并到 P1 | 与 Feature/配置管理合并为 settings.json 通用编辑器 |
| **Session 管理** | 需调研 | Claude Code session 存储格式不同，需先调研 |
| **配额与用量追踪** | 30% | relay 侧用量统计可跨工具复用，API key 配额查询需新对接 |
| **模型供应商管理** | 有限 | Claude Code 无原生多 provider 机制 |

### N/A — 不适用

| 功能 | 原因 |
|------|------|
| API Key 多账号存储 | Claude Code 单 key 模型 |
| 账号列表与路由探测 | Claude Code 无多账号路由 |
| OAuth 认证流程 | Claude Code 用 API key 模式 |

---

## 技术约束

1. **写入策略**：所有配置文件写入必须 preservative patch，保留未知字段、用户注释和已有非受控配置。Codex 的 TOML patcher 需对应 Claude Code 的 JSON patcher。

2. **文件格式差异**：Codex 使用 TOML（`config.toml`），Claude Code 使用 JSON（`settings.json`、`~/.claude.json`）。MCP 管理需适配 JSON 解析/写回。

3. **配置分布**：Claude Code 配置分散在 `settings.json` 和 `~/.claude.json` 两个文件，需明确各功能的读写目标文件。

4. **配置目录解析**：遵循 `CLAUDE_CONFIG_DIR` 环境变量或默认 `~/.claude/`。

5. **UI 组件复用**：所有 Claude Code 新功能必须复用 GetTokens 现有组件体系（`WorkspacePageHeader`、`SegmentedControl`、`btn-swiss`、`input-swiss`、`ToggleSwitch` 等），不为 Claude Code 单独建立视觉系统。

6. **工作区架构**：Claude Code 功能可通过以下方式组织：
   - 状态页已有 `Codex / Claude Code` tab（relay apply）
   - Codex 工作区 (`#frame=codex`) 可考虑扩展为通用 CLI 工作区或新增 `#frame=claude` 工作区
   - MCP/Skills/Hooks 等功能建议整合到通用 CLI 扩展管理工作区

---

## 架构建议

### 方案 A：扩展现有 Codex 工作区为通用 CLI 管理工作区

将 `#frame=codex` 扩展为支持 `&target=codex|claude|gemini` 的通用 CLI 工作区。Skills、MCP、CLAUDE.md/AGENTS.md 等功能按 target 切换读写目标。

**优点：** 代码复用最大化，用户只需学一套 UI。
**缺点：** 工作区复杂度上升，Codex-only 用户可能困惑。

### 方案 B：新增独立 Claude Code 工作区

新建 `#frame=claude` 工作区，包含 Claude Code 专属的 Skills、MCP、Settings 等管理。后端新增 Claude Code 对应的 service 文件。

**优点：** 隔离清晰，各工具独立演化。
**缺点：** 大量重复代码（Skills/MCP 管理等 80% 逻辑可复用）。

### 建议

从 Skills/MCP 管理开始，采用方案 A 的思路：后端抽取通用 CLI 扩展管理逻辑（skill scanner、MCP parser 等），每个 CLI 工具只提供配置路径和文件格式适配器。前端在 Codex 工作区基础上增加 `target` 参数，按 target 切换数据源。

---

## 技术评估文档

- [P0: Skills + MCP + Relay Apply 扩展技术评估](plans/P0-Skills-MCP-technical-assessment.md)
  - Skills: 复用度 85%+（前端）/ 70%+（后端），主要差异在 roots 和启停机制
  - MCP: 复用度 90%+（前端）/ 60%+（后端），核心改造在 JSON patcher 替代 TOML patcher
  - Relay Apply: 2026-05-18 已扩展 `ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_SMALL_FAST_MODEL`、`CLAUDE_CODE_MAX_OUTPUT_TOKENS`、`API_TIMEOUT_MS`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`。

- [P1: settings.json 通用编辑器 + CLAUDE.md + Hooks 技术评估](plans/P1-settings-CLAUDEmd-hooks-technical-assessment.md)
  - settings.json 通用编辑器: 需实现通用 JSON preservative merger（~300 行），一站式管理所有配置
  - CLAUDE.md: 极简实现（~60 行后端），用户级/项目级 Markdown 编辑 + 模板
  - Hooks: 零后端开发，纯前端可视化编辑 + 模板预设

- [P2: 二进制管理 + Session + Quota + Permissions 技术评估](plans/P2-binary-session-quota-permissions-technical-assessment.md)
  - 二进制管理: 需先调研发布渠道（npm vs GitHub Releases）
  - Session: 需调研 `~/.claude/projects/` 存储格式
  - Quota: 优先 relay 用量统计（跨工具通用），Anthropic API usage 延后
  - Permissions: 合并到 settings.json 通用编辑器

## 参考

- [cc-switch 业务覆盖路线](../20260505-cc-switch-coverage-roadmap/README.md) — P0/P1/P2 优先级框架
- [Claude Code API Key 模式一键配置](../20260502-claude-code-api-key-mode/README.md) — 已完成的 relay local apply
- [Codex Skills / MCP 本地扩展工作台](../20260511-cc-switch-codex-skills-mcp/README.md) — Skills/MCP 实现的参考实现
- [cc-switch 配置文件说明](../../references/cc-switch/docs/user-manual/zh/5-faq/5.1-config-files.md) — Claude Code 配置模型参考
- [Anthropic Claude Code settings 文档](https://docs.anthropic.com/en/docs/claude-code/settings)

## 当前状态

- 状态：relay-apply-env-expanded
- 最近更新：2026-05-18
