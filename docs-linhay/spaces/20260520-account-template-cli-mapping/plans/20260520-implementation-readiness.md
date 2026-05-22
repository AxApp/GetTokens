# 账号模板映射本地 CLI 配置实施前整理

日期：2026-05-20

## 实施目标

本轮进入实施时，只做“账号卡模板动作 -> 配置确认页 -> 复用现有 local apply”的闭环，不扩展成完整 CLI 配置编辑器。

P0 交付结果：

1. 已验证模板账号在账号卡右上角菜单展示 `应用到 Codex` / `应用到 Claude Code`。
2. 点击动作后必须先打开确认页；用户未确认前不写本机文件。
3. 确认页采用文件预览器布局：左侧文件列表，右侧选中文件 diff。
4. Codex 根据账号来源固定应用模式：API Key 账号走 `replace_auth_with_apikey` 并写当前账号资产自身的 `apiKey/baseUrl`，OAuth / auth-file 账号走 OAuth 写入模式；Status 页的 `preserve_chatgpt_auth` 仍是保留本机 ChatGPT 登录态的独立路径。
5. Codex provider 先读取用户当前 `CODEX_HOME/config.toml` 的 root `model_provider`，默认 patch `[model_providers.<current>]`，不默认改成 `gettokens`，不按账号新建 provider。
6. DeepSeek P0 只展示 Claude Code 入口；不因 OpenAI-compatible API 能力自动展示 Codex。

## 已定产品规则

### 按钮出现规则

1. 按钮必须来自官方/已验证应用模板白名单，不能只由 `supportedFormats` 推导。
2. 未验证目标不展示按钮，也不展示可点击禁用态。
3. DeepSeek 当前官方模板只开放 Claude Code。
4. OpenAI 当前可作为 Codex 官方模板基线。
5. 禁用或阻塞账号不执行 apply；如需要展示原因，原因只作为不可执行状态或确认页 warning，不写文件。

### Codex 配置规则

1. API Key 账号：
   - 写 `CODEX_HOME/auth.json` 的 `auth_mode=apikey` 与 `OPENAI_API_KEY`。
   - 写或 patch `CODEX_HOME/config.toml` 的模型、reasoning、当前 provider section 的 base URL / wire API 等受控字段。
2. OAuth / auth-file 账号：
   - `CODEX_HOME/auth.json` 只读校验，不写入。
   - 只 patch 当前 custom provider section 的 `experimental_bearer_token`、`base_url`、`requires_openai_auth`、`wire_api = "responses"` 等受控字段。
   - 当前 root `model_provider = "openai"` 时不能静默复用内置 provider；必须阻塞或引导用户选择/创建 custom provider。
3. root `model_provider`：
   - 默认读取并沿用用户当前值。
   - 只有当前 provider 缺失、当前 provider 不可用于目标 auth strategy，或用户明确选择切换时才写入。
   - 确认页必须展示当前 provider，让用户知道 patch 目标。
4. Codex `wire_api` 固定写 `responses`，不写已被 Codex 源码拒绝的 `chat`。

### Claude Code 配置规则

1. 写入范围只限 `~/.claude/settings.json` 的受控 `env` 字段。
2. `ANTHROPIC_BASE_URL` 使用 GetTokens relay endpoint，不直接写上游 `formatBaseUrls.anthropic`。
3. 保留 `permissions`、`hooks`、`statusLine`、MCP、未知字段和现有非受控 env。
4. 遇到 `ANTHROPIC_AUTH_TOKEN` 等冲突沿用既有 local apply warning，不在账号卡吞掉风险。

## 实施拆分

### 1. 后端 / Wails：读取当前 Codex provider 状态

现状：`ListLocalCodexModelProviders` 只列 `[model_providers.*]`，没有暴露 root `model_provider`。

需要新增或扩展：

```go
type LocalCodexModelProviderState struct {
    CurrentProviderID string `json:"currentProviderID"`
    CurrentProviderName string `json:"currentProviderName"`
    CurrentProviderIsBuiltin bool `json:"currentProviderIsBuiltin"`
    Providers []LocalCodexModelProvider `json:"providers"`
}
```

实现边界：

1. 从 `CODEX_HOME/config.toml` 解析 root `model_provider`。
2. 如果 root `model_provider` 缺失，按 Codex 默认语义视为 `openai`，并标记 builtin。
3. 从 `[model_providers.<id>]` 读取 `name`，没有时 fallback 为 provider id。
4. 内置 `openai` 不一定出现在 providers 列表里，但状态必须能表达当前为 builtin openai。
5. 新 Wails 方法必须同时穿透：
   - `internal/wailsapp`
   - root `app.go`
   - root DTO / mapper（如需要）
   - `frontend/wailsjs`

红灯测试：

1. root `model_provider = "corp"` 且 `[model_providers.corp] name = "Corp Relay"` 时，current 为 `corp / Corp Relay`。
2. 无 root `model_provider` 时，current 为 `openai` 且 builtin。
3. root provider 未定义 section 时，current name fallback 为 provider id，并返回 warning 或可由前端展示。

### 2. 纯模型：账号模板到本地 CLI mapping

新增建议文件：

```text
frontend/src/features/accounts/model/accountLocalCliMapping.ts
frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs
```

输入：

1. `AccountRecord`
2. `VendorPreset`
3. relay key / endpoint / selected model
4. current Codex provider state
5. local Codex auth state

输出：

1. `AccountLocalCliMapping[]`：给账号卡菜单用。
2. `AccountCliApplyDraft`：给确认页和 apply handler 用。
3. `warnings[]`：给确认页展示。

红灯测试：

1. 未命中模板不生成动作。
2. DeepSeek 只生成 Claude Code 动作，不生成 Codex。
3. OpenAI API Key 账号生成 Codex API Key draft，包含 `authStrategy=replace_auth_with_apikey`。
4. OpenAI OAuth/auth-file 账号生成 Codex OAuth draft，包含 `authStrategy=replace_auth_with_oauth`。
5. OAuth draft 可复用 current provider `openai`，但必须移除 `openai_base_url` override，让 Codex 按 `auth_mode=chatgpt` 使用 ChatGPT/Codex backend。
6. current provider 为 `team-codex-relay` 时，draft providerID 保持该值。
7. Claude draft 使用 relay endpoint，不使用上游 anthropic URL。
8. 禁用账号不可执行并返回 disabled reason。

### 3. UI：确认页组件

新增建议文件：

```text
frontend/src/features/accounts/components/AccountLocalCliApplyConfirm.tsx
```

可后续抽取公共 panel，但 P0 优先把账号入口闭环做完。

UI 约束：

1. 文件预览器布局，不恢复复杂多面板说明页。
2. 左侧只列目标文件；右侧只显示选中文件 diff。
3. 顶部展示：
   - 来源账号
   - 目标 CLI
   - 固定应用模式
   - 当前 Codex provider（Codex 时）
4. 底部按钮：
   - `取消`
   - `确认并应用`
5. preview/browser 环境中确认按钮只显示 `PREVIEW ONLY`，不调用 Wails。

### 4. 账号卡集成

`AccountCard.tsx` 已有 `localCliActions` 扩展，可继续复用。

实施方式：

1. 在账号列表/账号页 controller 层调用 resolver。
2. 只把 resolver 输出的动作传给 `AccountCard`。
3. `AccountCard` 仍只负责渲染菜单与派发 intent，不 import mapping 逻辑，不调用 Wails。

### 5. Apply 复用

Codex：

1. 调用既有 `ApplyRelayServiceConfigToLocalV2`。
2. 入参 providerID 使用 current provider state 的 current provider。
3. preserve 模式沿用现有 preflight：拒绝内置 `openai`、拒绝缺失 ChatGPT tokens。

Claude Code：

1. 调用既有 Claude local apply。
2. 复用 `buildClaudeCodeSettingsDiff` 作为预览。

## 验收清单

自动化：

1. `node --test frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs`
2. `node --test frontend/src/features/status/tests/relayLocalState.test.mjs`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build-storybook`
5. 若改 Wails/Go：`go test ./internal/wailsapp -run 'Test.*LocalCodex.*|TestApplyRelayServiceConfigToLocalV2|TestApplyClaudeCodeAPIKeyConfigToLocal'`
6. 若改 Wails binding：重新生成 `frontend/wailsjs` 并确认前端 import 真实存在。

浏览器 / Storybook：

1. `Design System / 业务组件 / 账号卡片 / Account Template Apply Menu`
2. DeepSeek 卡片只展示 `应用到 Claude Code`。
3. OpenAI API Key 卡片弹页展示 `auth.json + config.toml`。
4. OpenAI OAuth 卡片弹页不展示 `auth.json` 写入 diff，只展示 `config.toml`。
5. Codex 弹页展示当前 provider，并 patch `[model_providers.<current>]`。
6. 390px 视口无页面级横向溢出。

Wails / 桌面：

1. 当前 `CODEX_HOME/config.toml` 有 custom provider 时，确认页读取并展示该 provider。
2. 当前 `model_provider = "openai"` 且 OAuth/preserve 模式时，确认页阻塞或引导用户选择 custom provider。
3. 确认前不写文件。
4. 取消不写文件。
5. 确认成功后显示真实目标路径和 warning。

## 实施顺序

1. 先补 Go provider state parser 测试，确认能读 root `model_provider`。
2. 实现 provider state Wails 方法并补绑定。
3. 补前端 resolver 红灯测试。
4. 实现 `accountLocalCliMapping.ts`。
5. 实现账号确认页组件。
6. 接入账号页 controller 和 `AccountCard.localCliActions`。
7. 跑自动化门禁。
8. 跑 Storybook 浏览器验收并归档截图。
9. 跑 Wails 桌面验收。

## 当前不做

1. 不做 Claude Code direct upstream 写入；Codex API key 模式只允许写当前选中账号资产自身内容，不扩展为任意上游直写工作台。
2. 不修改 relay 请求顺序或单账号 pin。
3. 不把账号卡变成 TOML/JSON 编辑器。
4. 不为未验证厂商展示 Codex / Claude Code 按钮。
5. 不迁移既有所有 Status local apply UI；只复用必要模型与 diff builder。
