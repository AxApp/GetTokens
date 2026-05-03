# Claude Code API Key 模式一键配置研究 v01

## 需求边界

用户目标是让 GetTokens 支持“给 Claude Code 一键配置 API key 模式”，并且明确要求不要修改配置文件的其他内容。

因此本需求不是通用 Claude Code 配置中心，也不是 Claude Code 登录态管理器。它只负责把用户选中的上游 API key 配置，以保守、可预览、可拒绝的方式应用到 Claude Code 本地 `settings.json` 的 `env` 字段。

## 调研结论

### 1. Claude Code API key 模式的配置形态

Claude Code 的本地用户配置默认位于 `~/.claude/settings.json`。配置可以包含 `env` 对象，用于注入 Claude Code 运行时环境变量。

API key 模式的核心字段建议按以下优先级建模：

1. `env.ANTHROPIC_API_KEY`：本期默认 API key 字段。
2. `env.ANTHROPIC_BASE_URL`：自定义 Anthropic-compatible endpoint。
3. `env.ANTHROPIC_MODEL`：可选默认模型。
4. `env.ANTHROPIC_DEFAULT_HAIKU_MODEL` / `env.ANTHROPIC_DEFAULT_SONNET_MODEL` / `env.ANTHROPIC_DEFAULT_OPUS_MODEL`：可选模型族覆盖。

参考项目 `cc-switch` 还支持 `ANTHROPIC_AUTH_TOKEN`。它更接近 token / auth-token 模式，本期不应在“API key 模式”里默认写它；但必须检测它的存在，因为很多工具逻辑会优先读取 `ANTHROPIC_AUTH_TOKEN`，如果它与 `ANTHROPIC_API_KEY` 同时存在，用户可能以为一键配置没有生效。

### 2. 目标文件与禁止触碰范围

本期只写：

- `CLAUDE_CONFIG_DIR/settings.json`
- 未设置 `CLAUDE_CONFIG_DIR` 时为 `~/.claude/settings.json`

本期禁止写：

- `~/.claude.json`
- `~/.claude/CLAUDE.md`
- `~/.claude/skills/`
- 项目级 `.claude/settings*.json`
- 任何 MCP / hooks / permissions / statusLine 配置

### 3. “不要修改其他东西”的工程含义

仅用 `encoding/json` 反序列化后 `MarshalIndent` 不是足够安全的方案，因为它会重排或重格式化整份 `settings.json`。本需求应把“保留其他内容”提升为测试约束：

1. 非受控顶层字段的字节内容不变。
2. `env` 内非受控字段的字节内容不变。
3. 只允许新增或替换 GetTokens 受控 key 的行。
4. 无法定位安全插入点时拒绝写入，而不是格式化整文件。

后端可以实现一个专用 JSON object patch helper，限制输入必须是标准 JSON object，且只支持对 `env` object 的 string scalar key 做 upsert / owned-delete。若遇到复杂结构无法稳定 patch，返回“无法安全写入”。

## BDD 场景

### 场景 1：首次创建 Claude Code API key settings

Given 用户没有 `~/.claude/settings.json`

When 用户在 GetTokens 点击“应用到 Claude Code API key 模式”

Then 系统创建 `~/.claude/settings.json`

And 文件只包含必要的 `env.ANTHROPIC_API_KEY` 与可选 `env.ANTHROPIC_BASE_URL`

And 返回写入路径与受控字段摘要。

### 场景 2：保留已有 Claude Code 配置

Given 用户已有 `settings.json`

And 里面包含 `permissions`、`hooks`、`statusLine`、未知顶层字段和 `env.HTTP_PROXY`

When 用户一键应用新的 API key 与 base URL

Then 系统只更新 `env.ANTHROPIC_API_KEY` 与 `env.ANTHROPIC_BASE_URL`

And `permissions`、`hooks`、`statusLine`、未知字段、`env.HTTP_PROXY` 的内容保持不变。

### 场景 3：检测 auth token 冲突

Given 用户已有 `env.ANTHROPIC_AUTH_TOKEN`

And 该值不是 GetTokens 上次写入记录

When 用户尝试一键应用 `env.ANTHROPIC_API_KEY`

Then 系统不静默删除 `ANTHROPIC_AUTH_TOKEN`

And 保存前提示“已有 auth token 可能优先生效”

And 只有用户明确选择替换 token 模式时，才允许把该字段纳入本次 diff。

### 场景 4：非法 JSON 拒绝写入

Given 用户已有 `settings.json`

And 文件不是有效 JSON object

When 用户点击一键应用

Then 系统拒绝写入

And 不创建覆盖文件

And 返回可理解的错误。

### 场景 5：预览 diff 后再保存

Given 用户在应用前打开确认面板

When 后端生成 preview

Then preview 展示目标路径、将新增 / 修改 / 可能删除的受控 key

And 不展示完整 API key，只展示 masked key。

## 建议实现落点

### 后端

建议新增：

- `internal/wailsapp/claude_local_apply.go`
- `internal/wailsapp/claude_local_apply_test.go`

建议 Wails 方法：

1. `ReadClaudeCodeAPIKeyConfig()`
2. `PreviewClaudeCodeAPIKeyApply(apiKey, baseURL, model, options)`
3. `ApplyClaudeCodeAPIKeyToLocal(apiKey, baseURL, model, options)`

核心后端职责：

1. 解析 Claude config dir。
2. 读取现有 `settings.json`。
3. 做受控字段 diff。
4. 做最小 JSON patch。
5. 原子写入。
6. 记录 GetTokens 上次写入元数据，用于后续判断 owned fields。

### 前端

v1 前端目标页面是现有状态页。状态页里的本地 CLI 配置区域需要改为横向选项卡：

1. `Codex` tab：承载现有 Codex `auth.json` / `config.toml` 预览与“应用到本地”能力。
2. `Claude Code` tab：承载新增 Claude Code API key 模式读取、预览、diff 与保存能力。

选项卡交互要求：

1. tab 使用项目现有 `SegmentedControl`，不新增独立页面。
2. 切换 tab 不应丢失各自未保存草稿。
3. 两个 tab 共享同一个状态页上下文中的 relay endpoint / service API key 候选，但各自的目标路径、受控字段和风险提示必须独立展示。
4. `Codex` tab 继续强调 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`；`Claude Code` tab 只强调 `~/.claude/settings.json` 的 `env` patch。

组件复用要求：

1. 横向 tab 复用 `frontend/src/components/ui/SegmentedControl.tsx`。
2. 按钮复用 `btn-swiss` 样式，不新增专用 button class。
3. 表单控件复用 `input-swiss` / `select-swiss` 或现有 Status 页同类控件样式。
4. diff 文件内容展示应优先复用或扩展 `StatusSnippetPanel` 的 header + copy 结构，而不是新增一套 snippet card。
5. 状态页当前 `StatusApplyLocalSection` 已包含 endpoint、provider、reasoning、model 选择模式；新增 Claude Code tab 时优先抽取共享子组件，不复制一份相似 JSX。

Claude Code tab 和现有 Codex “应用到本地”能力保持相同交互语义：

1. 用户选择 API key 来源。
2. 用户选择 base URL / model。
3. 点击预览。
4. 确认后保存。

前端不直接拼 JSON，也不直接决定删除冲突字段；所有 diff 和安全判断来自后端。

## 测试清单

Go 单元测试必须先补红灯：

1. 新文件创建。
2. 已有 `settings.json` 只 patch 受控 `env` 字段。
3. `permissions` / `hooks` / 未知字段保留。
4. `env` 内非受控字段保留。
5. `ANTHROPIC_AUTH_TOKEN` 冲突默认拒绝或 warning。
6. GetTokens 上次写入的 owned key 允许更新。
7. 非法 JSON 拒绝写入。
8. API key 在 preview / result 中必须 mask。

前端测试覆盖：

1. 空 key 不允许保存。
2. 冲突 warning 可见。
3. preview loading / error / success 状态。
4. 保存成功后显示路径与 masked key。
5. `Codex` / `Claude Code` 横向 tab 切换不丢失各自草稿。
6. tab 使用通用 `SegmentedControl` 的可访问交互，不引入第二套 tab DOM 规则。

## 开放问题

1. 是否把 Claude Code API key 模式放在现有 Status 页，还是先做一个统一“本地 CLI 配置”入口，和 Codex config.toml 快捷配置并列。
2. 是否允许用户选择 `ANTHROPIC_AUTH_TOKEN` 作为高级模式字段。若允许，应单独命名为 token 模式，不要混进 API key 模式。
3. 是否把 `ANTHROPIC_MODEL` 等模型字段纳入 v1。最小闭环只需要 key + base URL，模型字段可以作为增强项。
4. 是否需要备份文件。若做备份，应只在真正写入前创建，例如 `settings.json.gettokens-backup-YYYYMMDDHHMMSS`。

## 推荐 v1 结论

先做最小闭环：

1. 支持读取 / 预览 / 保存 `~/.claude/settings.json` 的 `env.ANTHROPIC_API_KEY` 与 `env.ANTHROPIC_BASE_URL`。
2. 遇到 `ANTHROPIC_AUTH_TOKEN` 默认 warning，不静默删除。
3. 保存策略必须是最小 patch，不能整文件 JSON 格式化。
4. `~/.claude.json` 和 MCP 相关配置完全不碰。
5. 状态页本地 CLI 配置区先用横向 tab 分出 `Codex` / `Claude Code`，后续再决定是否独立成完整配置中心。
6. 等 Codex config.toml 快捷配置的后端 patch 抽象稳定后，再考虑沉淀一个通用 local CLI config apply 模块。

## 实施结果

已完成最小闭环实现：

1. 后端新增 `internal/wailsapp/claude_local_apply.go`，提供 `ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, model)`。
2. 写入目录遵循 `CLAUDE_CONFIG_DIR`，未设置时使用 `~/.claude/settings.json`。
3. 新文件创建时只生成必要 `env` 对象；已有文件先做 JSON 校验，再仅替换或插入 `env` 对象，避免整文件 `MarshalIndent` 重排。
4. 受控字段为 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、可选 `ANTHROPIC_MODEL`；`ANTHROPIC_AUTH_TOKEN` 默认保留，并通过 `warnings/conflicts` 返回提示。
5. 根层 `main.App` 已补 Wails wrapper 与 `ClaudeCodeLocalApplyResult`，前端绑定已同步。
6. 状态页已改为本地 CLI 配置工作区，横向 tab 区分 `Codex / Claude Code`；Codex tab 的 Relay key、Model、Provider 均使用下拉控件，Wire API 固定显示 `responses`。
7. 右侧复用 `StatusSnippetPanel` 显示当前 tab 的最小 diff。

验证：

- `go test ./...`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`

## 设计稿

本期设计稿落位：`docs-linhay/spaces/20260502-claude-code-api-key-mode/design-preview.html`。

设计稿表达的实现边界：

1. 目标页面仍是状态页。
2. 本地 CLI 配置区使用横向 tab 区分 `Codex` 与 `Claude Code`。
3. 同一个 HTML 内同时包含 `Codex` 与 `Claude Code` 两个设计稿，不再拆分平行 HTML。
4. 设计稿支持交互：tab 切换、表单输入、右侧文件 diff 实时更新。
5. `Codex` tab 展示 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml` 的合并 diff。
6. `Claude Code` tab 明确展示目标路径 `~/.claude/settings.json`、受控字段列表、`ANTHROPIC_AUTH_TOKEN` 冲突提示和 settings.json diff。
7. 预览中所有非受控配置都标记为 unchanged 或保留说明，强化“只 patch 受控字段”的交付边界。
8. Codex tab 交互要求：Relay API key 使用下拉选择并提供 `+` 弹框添加；Model 使用下拉；Provider 使用下拉；Wire API 固定为 `responses`，不提供编辑入口。
9. 设计稿仅表达布局与阅读层次；实现时必须复用项目通用组件和 Status 页已有组件模式。
