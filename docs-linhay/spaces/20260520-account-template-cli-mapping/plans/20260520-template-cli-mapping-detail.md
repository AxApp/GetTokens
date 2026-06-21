# 账号应用模板映射本地 CLI 配置详细设计

## 结论

本需求不是新增一套“账号卡直接写本机配置”的能力，而是在账号卡识别到稳定应用模板后，生成一份可审计的 local CLI apply 草稿，并在应用前打开一个确认页面。确认页面采用文件预览器布局：左侧只列目标文件，右侧展示选中文件的 diff；状态页 `StatusApplyLocalSection` 只作为 diff builder、preflight 和 apply handler 的逻辑参考，不作为页面布局参考。

P0 按目标 CLI 与账号来源分流：

- Codex 复用既有 local apply：API Key 模式写当前账号资产自身的 `apiKey` 与上游 `baseUrl` 到 `CODEX_HOME/auth.json` / `CODEX_HOME/config.toml` 的受控字段；OAuth / auth-file 模式写所选账号 OAuth；保留 ChatGPT 登录态模式只读取校验 `auth.json`，并只 patch `config.toml` 的 custom provider 字段。
- Claude Code 写 `~/.claude/settings.json` 的既有受控 `env` 字段。
- Claude Code 的多账号轮换仍发生在 relay 内，不把上游账号 API Key 或上游 base URL 直接写入 Claude Code。

## 调研依据

### 本仓库现状

- `frontend/src/features/status/StatusFeature.tsx` 持有 relay key、endpoint、provider、model、auth strategy 和 apply handler，并在页面中挂载 `StatusApplyLocalSection`。
- `frontend/src/features/status/components/StatusPanels.tsx` 的 `StatusApplyLocalSection` 已有可参考结构：
  - `activeTarget` 切换 `codex / claude`。
  - Codex 分支用 `buildCodexLocalApplyDiff` 生成 `auth.json + config.toml` diff。
  - Claude 分支用 `buildClaudeCodeSettingsDiff` 生成 `settings.json env` diff。
  - Codex 分支已使用 `getCodexLocalApplyPreflight` / `resolveCodexLocalApplyState` 控制能否应用。
  - Claude 分支已有 `ClaudeCodeLocalApplyDraft` 和最终 `onApplyClaude`。
- `frontend/src/features/status/tests/relayLocalState.test.mjs` 已覆盖 diff builder、preflight 和 draft 隔离，可以直接扩展为确认页模型测试。
- `internal/wailsapp/claude_local_apply_test.go` 已验证 Claude Code 写入时保留 `permissions / hooks / statusLine / HTTP_PROXY`，保留 `ANTHROPIC_AUTH_TOKEN` 并返回 warning，遇到无效 JSON 不覆盖原文件。
- `internal/wailsapp/relay_local_apply_test.go` 已验证 Codex preserve ChatGPT auth 模式不改 `auth.json`、写入 `experimental_bearer_token`、拒绝内置 `openai` provider、拒绝缺失 ChatGPT 登录态，并在 API key 模式清理旧 bearer token。
- `frontend/src/features/accounts/model/vendorPresets.ts` 已承载厂商模板、格式能力、格式 endpoint、模型建议，可作为 P0 应用模板来源。
- DeepSeek 当前公开的官方 coding-agent 适配以 Claude Code / OpenCode / OpenClaw 为主；P0 的 DeepSeek 应用模板只开放 Claude Code，不因底层 API 兼容 OpenAI Chat 就自动开放 Codex。
- 厂商文档链接已归档到 [`docs-linhay/references/20260520-account-template-vendor-doc-links.md`](../../../references/20260520-account-template-vendor-doc-links.md)，后续 resolver 的显式 `localCliTemplateTargets` 应以该表或后续更新为依据。

### Codex OAuth / preserve 模式校准

本轮重新对齐了 OpenAI Codex 官方 config reference 与 `openai/codex` 源码（`codex-rs/model-provider-info`、`codex-rs/model-provider/src/auth.rs`）：

- `requires_openai_auth = true` 表示 provider 需要 OpenAI API Key 或 ChatGPT login token，因此可用于保留本机 ChatGPT OAuth 登录态的 provider account/preflight 语义。
- `experimental_bearer_token` 会作为 provider-scoped `Authorization: Bearer <token>` 优先于 `auth.json` token 参与 provider 请求，源码已有覆盖 models catalog 的测试。
- `experimental_bearer_token` 不应和同 provider 的 `env_key` 或 command-backed `[model_providers.<id>.auth]` 混用；当前后端在 preserve 模式会删除 `env_key`，且不写 `auth` block。
- 内置 `openai` provider 不能作为 preserve 模式目标；默认读取并沿用用户当前 root `model_provider`，只在当前 provider 不可用或用户明确选择时才创建或切换 provider id。
- 设计系统与确认页必须把 `CODEX_HOME/auth.json` 标成 read-only preflight / preserved asset，不能让用户误以为 OAuth 模式会写 `auth.json`。

### 参考项目

Cherry Studio 的 `pages/code` 提供了一个轻量参考：

- CLI 工具有明确枚举：`Claude Code`、`OpenAI Codex` 等。
- provider 筛选按目标工具过滤，例如 Claude Code 接收 anthropic 类 provider，OpenAI Codex 接收 openai-response 或特定 OpenAI 兼容 provider。
- 启动前通过 `generateToolEnvironment` 根据工具生成 env：Claude Code 写 `ANTHROPIC_BASE_URL / ANTHROPIC_MODEL / ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`，OpenAI Codex 写 `OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL / OPENAI_MODEL_PROVIDER`。
- 它的模式偏“启动临时 env”，不负责保留式 patch 本机配置。GetTokens 可以借鉴工具/格式映射，不照搬写入语义。

cc-switch 提供了较重的配置编辑参考：

- Codex 配置被建模为 `auth.json` + `config.toml`，并支持从 TOML 中提取 base URL 和 model。
- Claude provider preset 使用 `settingsConfig.env`，覆盖 `ANTHROPIC_BASE_URL`、认证字段和模型族字段。
- Claude 模型状态有 fallback 语义：Haiku / Sonnet / Opus 默认模型可从对应 env 回读，缺失时可回退主模型。
- cc-switch 更像完整 provider/config 管理器。GetTokens 本期只需要“模板草稿 -> 确认 -> 复用 local apply”，避免把账号卡扩成原始 JSON/TOML 编辑器。

### 官方文档

- Claude Code settings 官方文档说明 `~/.claude/settings.json` 是用户级配置入口，`env` 会应用到每个 session，并且 settings 有 user/project/local/managed 等优先级。确认页必须明确本期只 patch 用户级 `env`，不处理项目级或 managed 配置。
- Claude Code model configuration 官方文档说明 `ANTHROPIC_BASE_URL` 只改变请求发送位置，不决定模型本身；模型可通过 `ANTHROPIC_MODEL`、`model` setting 或默认模型 env 控制。确认页需要把“relay base URL”和“模型 alias / 默认模型族”分开展示。
- Codex config reference 官方文档说明 `model_provider` 指向 `model_providers` 中的 provider id；内置 provider id 保留；custom provider 可设置 `base_url`、`requires_openai_auth`、`supports_websockets`、`wire_api = responses` 等。确认页必须展示 provider id/name/base URL/wire API，并保留既有 preflight。

## 用户流

### 1. 从账号卡或详情页进入

1. 用户打开账号卡右上角菜单。
2. 前端根据 `AccountRecord + VendorPreset + relay 状态` 生成 `AccountLocalCliMapping[]`。
3. 如果没有可用 mapping，不展示本地 CLI 配置动作。
4. 如果只有一个可用目标，展示单个动作，例如 `应用到 Claude Code`。
5. 如果 Codex 和 Claude Code 都可用，展示两个动作。
6. 点击动作后不写文件，先打开确认页面。
7. 用户打开账号详情页时，footer 复用同一批 mapping 结果展示 `应用到 Codex` / `应用到 Claude Code`；详情页不重新判断模板、禁用态或写入目标。
8. 账号详情页关闭入口放在 `AccountDetailLayout` 内容区右上角低权重 icon-only 按钮中；footer 仅保留本地 CLI 应用与保存类主操作，避免关闭与写入/保存混在一起。

DeepSeek 特例：

- DeepSeek 官方应用模板当前只视为 Claude Code 适配。
- Codex 目标不得显示为按钮；最多在说明文字中解释“未展示 Codex 动作”的原因。
- 后续若 DeepSeek 或 GetTokens 明确新增 Codex 应用模板，再单独打开 Codex mapping。

### 2. 确认页面

确认页面建议为账号池内 modal 或 route overlay，P0 不直接复用状态页 route。原因：

- 用户从账号卡进入，应保留账号上下文和返回路径。
- 确认页需要展示“来源账号”和“模板命中证据”，这不是状态页已有信息。
- 仍可复用状态页的 diff builder、preflight 和 apply handler，但不要复刻状态页的配置表单布局。

页面布局：

```text
┌──────────────────────────────────────────────────────────────┐
│  应用模板到 Codex / Claude Code                              │
│  来源账号 / 模板 / 目标 CLI / 固定应用模式 / 当前 provider    │
├──────────────────────────────┬───────────────────────────────┤
│ 左侧：文件列表                │ 右侧：选中文件 diff            │
│ - CODEX_HOME/auth.json       │ - 将新增或修改的字段           │
│ - CODEX_HOME/config.toml     │ - 保留不动的字段说明           │
│ 或 ~/.claude/settings.json   │ - 冲突 / 阻塞 warning          │
│ - read-only preflight 文件   │ - PREVIEW ONLY 状态            │
├──────────────────────────────┴───────────────────────────────┤
│ 取消                                确认并应用               │
└──────────────────────────────────────────────────────────────┘
```

布局硬约束：

- 不恢复“来源 / 配置 / 受控字段”多面板说明页。
- 左侧只承载文件项、文件状态和只读/将写入标识；不要把 provider、模型族和 relay key 表单塞回左侧。
- 顶部摘要展示来源账号、目标 CLI、固定应用模式、当前 Codex provider 和阻塞状态。
- 右侧 diff 承担主要确认信息；必要 warning 贴近 diff 顶部或底部，不另起复杂说明区。

### 3. 应用结果

- 点击取消：关闭确认页，不写本机配置，不改账号、不改模板、不改请求顺序。
- 点击确认并应用：
  - Codex 调用既有 `ApplyRelayServiceConfigToLocalV2`。
  - Claude Code 调用既有 `ApplyClaudeCodeAPIKeyConfigToLocal`。
  - 成功后展示目标文件路径、warning 和下一步提示。
  - 失败后保留确认页，展示错误，不清空草稿。

## 数据契约

### AccountLocalCliMapping

```ts
type LocalCliTarget = 'codex' | 'claude';
type AccountCliMappingStatus =
  | 'ready'
  | 'missing-template'
  | 'unsupported-format'
  | 'disabled-account'
  | 'blocked-account'
  | 'missing-relay-key'
  | 'sidecar-not-ready';

interface AccountLocalCliMapping {
  accountID: string;
  accountTitle: string;
  templateID: string;
  templateName: string;
  target: LocalCliTarget;
  status: AccountCliMappingStatus;
  enabled: boolean;
  disabledReason?: string;
  sourceFormat: 'openai_responses' | 'openai_chat' | 'anthropic';
  sourceFormatBaseUrl: string;
  relayEndpointID: string;
  relayBaseUrl: string;
  relayKeyIndex: number;
  relayKeyLabel: string;
  modelCandidates: string[];
  warnings: AccountLocalCliWarning[];
}
```

### AccountCliApplyDraft

```ts
type AccountCliApplyDraft =
  | {
      target: 'codex';
      source: AccountLocalCliMapping;
      codex: {
        relayKeyIndex: number;
        endpointID: string;
        apiKey: string;
        baseUrl: string;
        model: string;
        providerID: string;
        providerName: string;
        reasoningEffort: string;
        supportsWebsockets: boolean;
        authStrategy: 'replace_auth_with_apikey' | 'replace_auth_with_oauth' | 'preserve_chatgpt_auth';
      };
    }
  | {
      target: 'claude';
      source: AccountLocalCliMapping;
      claude: ClaudeCodeLocalApplyDraft;
    };
```

### Warning

```ts
interface AccountLocalCliWarning {
  code:
    | 'direct-upstream-not-supported'
    | 'relay-only'
    | 'preserve-chatgpt-auth-requires-custom-provider'
    | 'anthropic-auth-token-conflict'
    | 'model-derived-from-template'
    | 'model-family-partial'
    | 'preview-mode';
  severity: 'info' | 'warning' | 'blocking';
  message: string;
}
```

## 映射规则

### 模板识别

优先级：

1. `account.provider` 或未来显式 `account.templateID` 精确命中 `vendorPresets.id`。
2. `resolveVendorPresetID(account.displayName || account.provider, account.baseUrl)` 命中。
3. `account.formatBaseUrls[*]` 命中某 preset 的 `baseUrl / formatBaseUrls`。
4. 无法命中则不展示动作。

禁止只靠展示名称模糊包含来判断，例如 `displayName.includes("deep")` 不能作为模板命中依据。

按钮渲染硬规则：

1. `supportedFormats` 只代表底层 API 格式能力，不代表本地 CLI 应用模板可用。
2. 账号卡菜单按钮必须由官方/已验证的 `localCliTemplateTargets` 或等价白名单驱动。
3. 未验证目标不渲染按钮；不要用禁用按钮表达“可能支持”，因为用户配置后仍可能不可用。
4. 说明文字可以出现在确认页或详情里，但不能成为可点击动作入口。

### Codex

可用条件：

- 模板或账号支持 `openai_responses` 或 `openai_chat`。
- 账号未禁用，且状态不是 blocking。
- relay key 存在，sidecar ready。

字段：

| 字段 | 来源 | 说明 |
|------|------|------|
| `baseUrl` | 当前 relay endpoint | P0 不写上游 base URL |
| `model` | 账号显式 alias -> 模板建议 -> 当前 Status 选择 | 不可靠时回退用户当前选择 |
| `providerID` | 当前 `config.toml` 的 root `model_provider` | preserve ChatGPT auth 时不能是 `openai`；默认沿用用户当前 provider，避免既有会话迁移 |
| `providerName` | 当前 provider section 的 `name`，缺失时用 provider id | 便于用户确认正在 patch 的既有 provider |
| `wire_api` | 固定 `responses` | 符合当前 Codex reference |
| `reasoningEffort` | 当前用户选择 | 模板不强行覆盖 |

Codex 确认页必须显示：

- `auth.json` 是替换 API key 还是只读校验并保留 ChatGPT 登录态。
- `config.toml` 会改 root `model`、`model_reasoning_effort` 或 `openai_base_url`；root `model_provider` 默认保留用户当前值，只在当前 provider 缺失、不可用于目标 auth strategy，或用户明确选择切换 provider 时写入。
- custom provider 会写 `name / base_url / requires_openai_auth / wire_api / supports_websockets`。
- preserve 模式只 patch `config.toml`，会写 `experimental_bearer_token` 并移除冲突 `env_key`；不会改写 `auth_mode`、`OPENAI_API_KEY`、`tokens` 或账号 metadata。

### Claude Code

可用条件：

- 模板或账号支持 `anthropic`。
- 账号未禁用，且状态不是 blocking。
- relay key 存在，sidecar ready。

字段：

| 字段 | 来源 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | relay key | P0 使用现有 local apply 的 API key 字段 |
| `ANTHROPIC_BASE_URL` | 当前 relay endpoint | 不直接写 `formatBaseUrls.anthropic` |
| `ANTHROPIC_MODEL` | 账号 alias -> 官方/default profile -> 模板建议 | 与 base URL 分开展示 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | default profile | 无可靠来源则留空 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | default profile / main model | 无可靠来源则留空 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | default profile / main model | 无可靠来源则留空 |
| `ANTHROPIC_SMALL_FAST_MODEL` | legacy 兼容 | 有 haiku profile 时可同步填充并标注 deprecated |

Claude 确认页必须显示：

- `settings.json env` 是唯一写入范围。
- `permissions / hooks / statusLine / MCP / 未知字段` 会保留。
- 如果原文件有 `ANTHROPIC_AUTH_TOKEN`，展示冲突 warning，但沿用后端当前保留语义。
- 如果模型族字段只有部分可靠来源，按缺失项逐条提示，不伪造默认值。

## 组件拆分建议

```text
frontend/src/features/accounts/model/
  accountLocalCliMapping.ts        # 模板识别、目标可用性、草稿生成、preview file / diff 拆分的单一维护入口
  accountLocalCliMapping.test.mjs

frontend/src/features/accounts/components/
  AccountLocalCliApplyConfirm.tsx  # 账号来源 + 确认页 shell，只渲染 draft 与 preview files

frontend/src/features/status/components/
  LocalCliFileDiffPreview.tsx      # 可选抽取：文件列表 + diff preview
  LocalCliApplySummary.tsx         # 可选抽取：顶部摘要 / warning 归一
```

分层原则：

- `AccountCard.tsx` 只渲染菜单项和打开确认页，不写映射逻辑。
- `accountLocalCliMapping.ts` 不 import React，不调用 Wails。
- 确认页可以复用 `StatusSnippetPanel` 或 diff builder，但不要复用 `StatusRelayKeyPicker`、`StatusEndpointPicker`、`StatusModelPicker` 组成复杂配置页。
- 状态页后续也可以迁移到同一 panel，避免两处 local apply UI 分叉。

## 状态机

```text
idle
  -> resolving(account)
  -> unavailable(reason)
  -> draft-ready
  -> confirm-open
  -> applying
  -> applied(result)
  -> failed(error)
```

关键规则：

- `resolving` 只做本地同步推导，不访问网络。
- `confirm-open` 才允许用户微调字段。
- `applying` 禁用取消以外的重复提交；是否允许关闭需按现有 modal 规范决定。
- `failed` 保留用户修改后的草稿。
- `applied` 不自动关闭，除非用户点击完成，避免用户看不到写入路径和 warning。

## Preview 规则

普通浏览器缺少 Wails runtime 时：

- 使用 preview relay key 和 preview endpoint。
- diff 仍可生成。
- 点击“确认并应用”不调用 Wails，改为展示 preview-only 成功消息。
- 页面必须明确显示 `PREVIEW ONLY`。

## 测试计划

### 红灯测试优先

1. `accountLocalCliMapping.test.mjs`
   - 未命中模板不生成动作。
   - 命中 `anthropic` 模板只生成 Claude 动作。
   - 命中 `openai_chat + anthropic` 但应用模板只声明 Claude Code 时，只生成 Claude 动作。
   - 命中同时声明 Codex 与 Claude Code 的模板时生成两个动作。
   - 禁用账号生成 disabled reason，不可应用。
   - Claude base URL 写 relay endpoint，不写 `formatBaseUrls.anthropic`。
   - Codex provider id 避免 preserve 模式下使用 `openai`，默认读取并沿用用户当前 `model_provider`。
2. `relayLocalState.test.mjs`
   - 模板草稿进入 Codex diff 后包含 provider / model / auth strategy。
   - 模板草稿进入 Claude diff 后包含模型族字段和保留字段说明。
3. 组件测试或 Storybook smoke
   - 确认页显示来源账号、模板、目标 CLI、diff、取消、确认并应用。
   - 无 Wails runtime 时不调用真实 apply。

### 后端回归

如果只新增前端确认页和纯模型，不需要改 Go 后端；仍建议跑：

```bash
npm --prefix frontend run test:unit
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
```

如果改动 local apply 后端或 Wails DTO，再补：

```bash
go test ./internal/wailsapp -run 'TestApplyRelayServiceConfigToLocalV2|TestApplyClaudeCodeAPIKeyConfigToLocal'
go test ./...
```

## 开放问题

1. `providerID` 命名：默认不命名新 provider；先读取用户当前 `model_provider` 并 patch 对应 section。只有当前 provider 不可用或用户显式选择高级分槽时才创建新 provider id。
2. 是否需要“固定当前账号为 relay 候选”。P0 建议不做；否则会跨到路由策略持久化。
3. direct upstream 模式是否进入 P1。若进入，必须重新定义密钥写入、冲突提示、回滚和安全边界。
4. Claude Code 是否应写 `model` setting 而不是 `ANTHROPIC_MODEL`。当前沿用已有 env patch；如切换到 setting，需要处理 settings 优先级与项目/managed 冲突。

## 已定交互形态

- P0 确认页采用账号池内 modal / overlay，不跳转 Status 页。
- 用户点击账号卡菜单动作后，必须先进入确认页；未点击“确认并应用”前不写文件。
- 确认页布局固定为文件预览器：左侧文件列表，右侧选中文件 diff；顶部摘要展示来源账号、目标 CLI、固定应用模式和当前 Codex provider。

## 外部资料

- Claude Code settings：`https://code.claude.com/docs/en/settings`
- Claude Code model configuration：`https://code.claude.com/docs/en/model-config`
- Codex config reference：`https://developers.openai.com/codex/config-reference`
