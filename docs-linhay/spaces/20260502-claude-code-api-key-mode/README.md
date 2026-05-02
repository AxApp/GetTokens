# Claude Code API Key 模式一键配置

## 背景
GetTokens 目前已经围绕 Codex 建立了“本地配置一键应用”的能力：状态页可以把 relay endpoint、service API key、model 和 provider 合并写入 `CODEX_HOME`，并通过保留式 patch 尽量不破坏 `config.toml` / `auth.json` 的其他内容。

下一步需要研究并设计 Claude Code 的 API key 模式支持。Claude Code 的 API key 模式主要通过本地配置目录下的 `settings.json` 的 `env` 字段或进程环境变量生效；参考项目 `cc-switch` 也将 Claude Code 供应商配置建模为 `settingsConfig.env`，常见字段包括 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL` 以及可选模型字段。

本需求的最高优先级约束是：一键配置只能修改 GetTokens 明确负责的 Claude Code API key 模式字段，不能改动配置文件里的其他内容。

## 目标
1. 支持从 GetTokens 里一键把选中的 Claude Code API key 模式配置应用到本机 Claude Code。
2. 写入目标默认是 `~/.claude/settings.json`，若用户或环境指定 Claude 配置目录，则使用对应目录下的 `settings.json`。
3. 保存前展示目标路径、受控字段、冲突提示和最小 diff 摘要。
4. 保存时只更新 `env` 下 GetTokens 明确负责的字段，保留其他顶层字段、未知字段、数组、对象、换行风格和已有 `env` 非受控字段。
5. 当现有配置无法安全解析或无法做最小 patch 时，拒绝写入并给出明确错误。
6. 状态页本地 CLI 配置区使用横向选项卡区分 `Codex` 与 `Claude Code`，避免两个工具的配置字段混在同一表单里。
7. 前端实现必须复用项目通用组件和既有样式：`SegmentedControl`、`btn-swiss`、`input-swiss`、`select-swiss` 以及 Status 页现有 section / snippet 组件模式；设计稿不代表新增一套专用 UI 组件。

## 范围
本期已从研究推进到最小闭环实现：状态页的本地 CLI 配置区支持 `Codex / Claude Code` 横向 tab，Claude Code tab 可把 Relay API key 模式写入本机 `settings.json` 的受控 `env` 字段。

v1 建议覆盖：

- 配置目录解析：`CLAUDE_CONFIG_DIR` 或默认 `~/.claude/`。
- 目标文件：`settings.json`。
- 受控字段：
  - `env.ANTHROPIC_API_KEY`
  - `env.ANTHROPIC_BASE_URL`
  - 可选：`env.ANTHROPIC_MODEL`
  - 可选：`env.ANTHROPIC_DEFAULT_HAIKU_MODEL`
  - 可选：`env.ANTHROPIC_DEFAULT_SONNET_MODEL`
  - 可选：`env.ANTHROPIC_DEFAULT_OPUS_MODEL`
- 冲突检测：如果已有 `env.ANTHROPIC_AUTH_TOKEN`，默认不静默删除，必须提示用户 API key 可能不会按预期接管；只有确认替换或确认该值是 GetTokens 上次写入时，才允许删除或改写。
- 本地元数据：记录 GetTokens 上次写入的字段和值摘要，用于判断后续哪些字段属于 GetTokens 可安全更新范围。该项未纳入本次最小闭环。

## 非目标
1. 不管理 Claude Code 官方登录态或订阅账号生命周期。
2. 不修改 `~/.claude.json`，因此不碰 MCP servers、项目列表或其他全局 Claude Code 状态。
3. 不修改 `permissions`、`hooks`、`statusLine`、`includeCoAuthoredBy`、`cleanupPeriodDays`、`model` 等非 API key 模式字段，除非后续另起需求明确纳入受控范围。
4. 不在 v1 支持 Bedrock / Vertex 模式切换；`CLAUDE_CODE_USE_BEDROCK`、`CLAUDE_CODE_USE_VERTEX` 等云厂商模式开关后续单独设计。
5. 不把 Claude Code 配置写入账号池上游 key 资产，也不把账号池资产直接外露为 relay client key。

## 验收标准
- [x] Space 内有清晰的 BDD 场景、实现边界和配置写入规则。
- [x] 方案明确“一键配置”只修改 Claude Code `settings.json` 中的受控 `env` 字段。
- [x] 状态页目标区域以横向选项卡区分 `Codex` / `Claude Code`，切换 tab 不丢失当前未保存草稿。
- [x] 前端落地复用项目通用组件，不新增平行的 tab、button、input、select、card 视觉体系。
- [x] 方案明确保留其他配置内容，不能整文件覆盖或格式化重写。
- [x] 方案明确已有 `ANTHROPIC_AUTH_TOKEN` 与 `ANTHROPIC_API_KEY` 的冲突处理，不静默删除用户字段。
- [x] 后端负责保存与安全判断；前端当前 diff 为结构化最小 patch 预览，不直接写 JSON。
- [x] Go 单元测试覆盖新文件创建、未知字段保留、auth token warning、非法 JSON 拒绝和配置目录解析。

## 设计稿入口

- 本期设计稿：[`design-preview.html`](design-preview.html)
- 当前设计稿同文件内包含 `Codex` 与 `Claude Code` 两个目标，并支持 tab 切换、表单输入与右侧文件 diff 实时更新。
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260502-claude-code-api-key-mode`
- worktree：`../GetTokens-worktrees/20260502-claude-code-api-key-mode/`

## 相关链接
- [研究方案 v01](plans/20260502-claude-code-api-key-mode-research-v01.md)
- [Codex 本地 config.toml 快捷配置](../20260502-codex-config-toml-settings/README.md)
- [relay service 配置边界](../../dev/20260426-relay-service-config-boundary.md)
- [Anthropic Claude Code settings 文档](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Anthropic Claude Code environment variables 文档](https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables)
- [cc-switch Claude Code 配置文件说明](../../references/cc-switch/docs/user-manual/zh/5-faq/5.1-config-files.md)

## 当前状态
- 状态：implemented
- 最近更新：2026-05-02

## 实施摘要

- 后端新增 `ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, model)`，写入 `CLAUDE_CONFIG_DIR/settings.json` 或默认 `~/.claude/settings.json`。
- 写入策略：先校验现有 JSON；已有文件只替换或插入 `env` 对象，保留 `permissions`、`hooks`、`statusLine`、未知顶层字段和非受控 env 字段。
- 冲突策略：检测到 `env.ANTHROPIC_AUTH_TOKEN` 时保留该字段，并在 result 的 `warnings/conflicts` 返回提示。
- 前端状态页收敛为本地 CLI 配置工作区，使用 `SegmentedControl` 区分 `Codex / Claude Code`；Codex tab 的 Relay key、Model、Provider 均为下拉，Wire API 固定 `responses`。
- 右侧复用 `StatusSnippetPanel` 显示当前 tab 的 diff 内容。
- Codex 与 Claude Code tab 的 Relay API key 选择器、Endpoint / Base URL 区域必须复用同一组局部组件，避免同款配置控件在两个 tab 内平行维护。
- 截图验收：Codex tab `screenshots/20260502/status/20260502-status-local-cli-after-v02.png`，Claude Code tab `screenshots/20260502/status/20260502-status-local-cli-claude-after-v02.png`。
