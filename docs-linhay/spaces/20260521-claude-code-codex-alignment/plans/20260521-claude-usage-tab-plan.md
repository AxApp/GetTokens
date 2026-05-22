# Claude Code 用量 Tab 第一刀计划

日期：2026-05-21

## 目标

在 Claude 工作区新增 `usage` tab，复用现有 Usage Desk 图表、明细表和状态面板。数据源分为两类：

1. GetTokens relay / sidecar attribution 中可识别为 Claude / Anthropic-compatible 的真实请求用量。
2. Claude Code 本地 session JSONL 的只读 token 投影，作为 `cc-switch` 同类能力的本地文件投影入口。

本期只读扫描本机文件，不写入、不删除、不压缩 Claude 原生 session。

## BDD 场景

### 场景 1：进入 Claude 用量页

Given 用户打开 Claude 工作区
When 点击“用量统计”或进入 `#frame=claude&workspace=usage`
Then 页面展示 Claude Usage Desk，数据源标注为 Sidecar Attribution。

### 场景 2：只看 Claude / Anthropic 归因

Given sidecar attribution 同时包含 Codex、OpenAI-compatible 和 Claude 相关请求
When Claude 用量页聚合数据
Then 只保留 provider / model / attribution key 中可识别为 `anthropic`、`claude`、`sonnet`、`opus`、`haiku` 的记录。

### 场景 3：查看 Claude Code 本地文件投影

Given 本机存在 `~/.claude/projects/**/*.jsonl` session 文件
When 用户进入 Claude 用量页
Then 页面展示“本地文件投影”入口，并按 Claude Code session 文件聚合本地 token 用量。

### 场景 4：保护 Claude 原生 session

Given Claude Code session 文件中包含 user prompt、tool input、绝对路径或其它敏感上下文
When GetTokens 构建 Claude Usage Desk 本地投影
Then 只读取 assistant usage token、模型、时间、session 路径和项目名，不回传完整 message body，不修改原文件。

## 技术边界

- 复用：
  - `UsageDeskFeature`
  - `UsageChartCard`
  - `UsageDetailTable`
  - `buildUsageDeskObservedSnapshot`
- 新增：
  - `ClaudeWorkspace = 'usage'`
  - `UsageDeskWorkspace = 'claude'`
  - observed usage workspace filter
  - `GetClaudeLocalUsage` / `RefreshClaudeLocalUsage` / `RebuildClaudeLocalUsage` Wails binding
  - Claude 本地投影 provider：扫描 `CLAUDE_CONFIG_DIR || ~/.claude` 下的 `projects/**/*.jsonl`
- 调整：
  - 删除 Usage Desk 里此前预留但未接真源的 `gemini` workspace 适配；`UsageDeskWorkspace` 只保留 `codex` / `claude`。
- 不做：
  - 不读取或展示 Claude 原生 session 的完整正文
  - 不写入、删除、压缩或重命名 Claude 原生 session
  - 不接 Claude 官方账单 API
  - 不混入 Codex rollout local projected usage

## 验证

- `go test ./internal/wailsapp -run TestGetClaudeLocalUsage`
- `go test ./internal/wailsapp`
- `go test ./...`
- `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/previewData.test.mjs frontend/src/features/accounts/tests/usageDeskClaudeLocalSource.test.mjs`
- `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/utils/pagePersistence.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- 无头浏览器打开 `http://127.0.0.1:5173/#frame=claude&workspace=usage`，确认页面可渲染 Claude 用量入口。

## 完成记录

- 已完成 Claude workspace `usage` 入口，侧边栏展示“用量统计”，路由为 `#frame=claude&workspace=usage`。
- 已复用 Usage Desk 的 observed 图表和明细表，Claude 页面只展示 Sidecar Attribution 中可识别为 Claude / Anthropic 的记录。
- 已补齐 Claude Code 本地 session 文件投影：扫描 `~/.claude/projects/**/*.jsonl`，跳过 `subagents/agent-*`，按 assistant `message.usage` 聚合 token，按 `message.id` 保留最终 `stop_reason` 条目，并跳过 `output_tokens=0` 的中间记录。
- Claude projected usage 与 Codex rollout projected usage 分 provider 缓存和进度事件；前端按 workspace 调用对应 Wails binding，避免 Claude 页面继续拿 Codex 投影数据。
- 已移除 Usage Desk 的 `gemini` workspace 类型、placeholder 页面和 preview 分支；旧 `usage-gemini` 不再是有效 workspace。
- 已归档截图：`docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/claude-usage/20260521-claude-usage-web-after-v01.png`。
- 2026-05-23 回归：`go test ./internal/wailsapp -run TestGetClaudeLocalUsage`、`go test ./internal/wailsapp`、`go test ./...`、Usage Desk 相关 Node 测试均通过；`npm --prefix frontend run typecheck` 被无关 `StatusCodexFeaturesSection.stories.tsx` 缺 `section` 字段阻塞。
