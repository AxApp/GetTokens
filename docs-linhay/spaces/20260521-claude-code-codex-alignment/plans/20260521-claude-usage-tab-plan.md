# Claude Code 用量 Tab 第一刀计划

日期：2026-05-21

## 目标

在 Claude 工作区新增 `usage` tab，复用现有 Usage Desk 图表、明细表和状态面板。第一刀只展示 GetTokens relay / sidecar attribution 中可识别为 Claude / Anthropic 的真实请求用量，不扫描、不估算、不写入 Claude 原生 session。

## BDD 场景

### 场景 1：进入 Claude 用量页

Given 用户打开 Claude 工作区
When 点击“用量统计”或进入 `#frame=claude&workspace=usage`
Then 页面展示 Claude Usage Desk，数据源标注为 Sidecar Attribution。

### 场景 2：只看 Claude / Anthropic 归因

Given sidecar attribution 同时包含 Codex、OpenAI-compatible 和 Claude 相关请求
When Claude 用量页聚合数据
Then 只保留 provider / model / attribution key 中可识别为 `anthropic`、`claude`、`sonnet`、`opus`、`haiku` 的记录。

### 场景 3：不暴露 Codex 本地投影能力

Given Codex 用量页支持本地投影用量、索引刷新和重建
When 用户进入 Claude 用量页
Then 不展示“本地投影用量”、刷新索引、重建索引等 Codex-only 操作。

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
- 移除：
  - 删除 Usage Desk 里此前预留但未接真源的 `gemini` workspace 适配；`UsageDeskWorkspace` 只保留 `codex` / `claude`。
- 不做：
  - 不从 Claude 原生 session 估算 token
  - 不接 Claude 官方账单 API
  - 不混入 Codex local projected usage

## 验证

- `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/utils/pagePersistence.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build`
- 无头浏览器打开 `http://127.0.0.1:5173/#frame=claude&workspace=usage`，确认页面可渲染 Claude 用量入口。

## 完成记录

- 已完成 Claude workspace `usage` 入口，侧边栏展示“用量统计”，路由为 `#frame=claude&workspace=usage`。
- 已复用 Usage Desk 的 observed 图表和明细表，Claude 页面只展示 Sidecar Attribution 中可识别为 Claude / Anthropic 的记录。
- 已隐藏 Codex-only 本地投影用量入口和索引刷新/重建操作。
- 已移除 Usage Desk 的 `gemini` workspace 类型、placeholder 页面和 preview 分支；旧 `usage-gemini` 不再是有效 workspace。
- 已归档截图：`docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/claude-usage/20260521-claude-usage-web-after-v01.png`。
