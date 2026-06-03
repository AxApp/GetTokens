# 小米厂商模板与账号详情 — 双模式凭据支持

## 背景

小米 MiMo 开放平台同时提供两种计费/调用模式：

| 模式 | 凭据 | Base URL | 用途 |
|------|------|----------|------|
| **按量 API 模式** | `sk-xxxxx` | OpenAI: `https://api.xiaomimimo.com/v1`<br />Anthropic: `https://api.xiaomimimo.com/anthropic` | 按实际 API 调用计费，可用于 `/v1/models` 拉取模型列表 |
| **Token Plan 订阅模式** | `tp-xxxxx` | OpenAI: `https://token-plan-<cluster>.xiaomimimo.com/v1`<br />Anthropic: `https://token-plan-<cluster>.xiaomimimo.com/anthropic` | 从订阅套餐额度扣减，适合 Agent / Claude Code 等工具 |

官方文档明确说明：Token Plan 的 API Key（`tp-xxxxx`）和按量 API Key（`sk-xxxxx`）彼此独立，不能混用；Token Plan 的 Base URL 也与按量 API 不同，且有集群差异（CN/SGP/AMS），应以订阅页显示为准。

## 当前问题

1. Xiaomi MiMo 厂商模板模型建议过时，缺少 V2.5 系列完整模型。
2. 账号详情只有单一 API Key 与单一 Base URL，无法在同一厂商账号下同时维护 `sk` 和 `tp` 两套凭据。
3. 用户希望在账号详情中勾选「使用 API 模式」或「使用订阅模式」来执行 agent 对话。
4. 当前初版计划把两种模式视为“同一个 Base URL 下两套 key”，这是不准确的：Token Plan 必须允许独立 Base URL / formatBaseUrls。

## 目标

1. **厂商模板**：完善 Xiaomi MiMo 预设，包含完整模型建议、按量 API profile、Token Plan profile。
2. **账号详情**：Xiaomi 账号支持同时配置两套模式资料：
   - API 模式：`sk` + API Base URLs
   - 订阅模式：`tp` + Token Plan Base URLs
3. **模式切换**：用户可选择当前 agent 对话使用 `api` 或 `subscription` 模式。
4. **路由闭环**：sidecar / relay / Claude Code 路由必须使用当前 active mode 对应的 key + baseUrl + formatBaseUrls，而不是仅替换 key。
5. **兼容性**：未配置多模式 profile 的其他厂商保持现有单 key 单 baseUrl 行为。

## 推荐数据设计

### 1. 不推荐仅扩展 `OpenAICompatibleAPIKeyEntry`

旧计划中的设计：

```go
OpenAICompatibleAPIKeyEntry{APIKey, KeyMode}
OpenAICompatibleProvider{ActiveKeyMode}
```

**不够**，因为它只能区分 key，无法表达 Token Plan 不同的 Base URL / formatBaseUrls / 集群。

### 2. 推荐新增「模式 Profile」结构

#### Go DTO / sidecar credential

```go
type OpenAICompatibleModeProfile struct {
    Mode           string            `json:"mode"` // api | subscription
    Label          string            `json:"label,omitempty"`
    APIKey         string            `json:"api_key"`
    BaseURL        string            `json:"base_url"`
    FormatBaseURLs map[string]string `json:"format_base_urls,omitempty"`
    Headers        map[string]string `json:"headers,omitempty"`
}

type OpenAICompatibleAccountCredential struct {
    // existing fields remain for backward compatibility
    ProviderName       string `json:"provider_name"`
    RuntimeProviderKey string `json:"runtime_provider_key,omitempty"`
    BaseURL            string `json:"base_url"`
    Prefix             string `json:"prefix,omitempty"`
    APIKeyEntriesJSON  string `json:"api_key_entries_json"`
    HeadersJSON        string `json:"headers_json,omitempty"`
    FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
    ModelsJSON         string `json:"models_json,omitempty"`

    ActiveMode         string `json:"active_mode,omitempty"`
    ModeProfilesJSON   string `json:"mode_profiles_json,omitempty"`
}
```

#### 前端 Draft

```ts
export interface OpenAICompatibleModeProfileDraft {
  mode: 'api' | 'subscription' | string;
  label: string;
  apiKey: string;
  baseUrl: string;
  formatBaseUrls: Partial<Record<ApiFormat, string>>;
  headersText: string;
}

export interface OpenAICompatibleProviderDraft {
  // existing fields remain for legacy / non-multimode providers
  accountKey?: string;
  currentName: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  headersText: string;
  models: OpenAICompatibleModelRow[];
  verifyModel: string;
  proxyUrl: string;

  activeMode?: string;
  modeProfiles?: OpenAICompatibleModeProfileDraft[];
}
```

### 3. Active Mode 投影规则

对于支持 `modeProfiles` 的账号，保存/应用到运行态时：

1. 找到 `mode === activeMode` 的 profile。
2. 将该 profile 投影为 sidecar 运行态真正使用的：
   - `base_url`
   - `format_base_urls_json`
   - `api_key_entries_json`（只放 active profile 的 key，或在 route guard 中仅允许 active key）
   - `headers_json`
3. 保留 `mode_profiles_json` 作为管理 UI 的完整配置源。

这样可以最小化对现有 route guard / usage attribution / API call 的影响。

## Xiaomi 默认 Profile

```ts
multiModeProfiles: [
  {
    mode: 'api',
    label: 'API 模式（sk）',
    apiKeyPlaceholder: 'sk-...',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    formatBaseUrls: {
      openai_chat: 'https://api.xiaomimimo.com/v1',
      anthropic: 'https://api.xiaomimimo.com/anthropic',
    },
  },
  {
    mode: 'subscription',
    label: '订阅模式（Token Plan / tp）',
    apiKeyPlaceholder: 'tp-...',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    formatBaseUrls: {
      openai_chat: 'https://token-plan-cn.xiaomimimo.com/v1',
      anthropic: 'https://token-plan-cn.xiaomimimo.com/anthropic',
    },
    clusterEditable: true,
  },
]
```

## 范围

### 厂商模板

- 更新 Xiaomi 模型建议：
  - `mimo-v2.5-pro`
  - `mimo-v2-pro`
  - `mimo-v2.5`
  - `mimo-v2-omni`
  - `mimo-v2-flash`
  - `mimo-v2.5-asr`
  - `mimo-v2.5-tts`
  - `mimo-v2.5-tts-voiceclone`
  - `mimo-v2.5-tts-voicedesign`
  - `mimo-v2-tts`
- 新增 Xiaomi 多模式 profile 默认值。
- 增加说明：`sk` 用于按量 API，`tp` 用于 Token Plan，二者不可混用。

### 账号详情

- Xiaomi 显示双 profile 卡片：API 模式、订阅模式。
- 每个 profile 独立配置 key、baseUrl、formatBaseUrls。
- 增加 Active Mode radio/toggle：
  - API 模式：agent 对话使用 `sk` + `api.xiaomimimo.com`
  - 订阅模式：agent 对话使用 `tp` + `token-plan-*.xiaomimimo.com`
- 模型列表拉取默认使用 API 模式 profile；若用户主动选择订阅模式拉取，需使用订阅模式 baseUrl/key，但文案应提示“官方模型列表以 API 文档为准”。

### 后端 / sidecar / 路由

- 账号保存时持久化完整 `mode_profiles_json` 和 `active_mode`。
- 运行态配置投影 active profile，确保 relay 实际请求使用 active profile 对应 key + URL。
- usage attribution 的 usage key 应包含 active baseUrl + active key，避免两种模式混淆。
- route guard / stable route auth id 应基于 active profile，避免 inactive key 被选中。

## 非目标

- 不使用平台 Cookie 作为 agent 对话凭据；Token Plan agent 对话使用官方 `tp-xxxxx`。
- 不实现小米控制台登录 / Cookie 自动抓取。
- 不在本期实现 Token Plan 用量自动查询的完整 UI；现有 `quotaCurlTemplate` 可以保留，但它属于用量查询，不等同于订阅模式 agent key。
- 不改变其他厂商默认单 key 单 baseUrl 的交互。

## 验收标准

1. Xiaomi 模板包含完整模型建议和两个默认 profile。
2. Xiaomi 账号详情能同时保存 `sk` 与 `tp`，并保存两套独立 baseUrl / formatBaseUrls。
3. 切换 active mode 后，agent 对话实际命中对应模式的 key + baseUrl。
4. `/v1/models` 拉取不会误用 Token Plan Cookie；若当前 active mode 是 API 模式则使用 `sk`。
5. 其他 openai-compatible 厂商不出现双 profile UI，也不改变保存/路由行为。
6. 覆盖测试：
   - 模板解析 / draft 构建
   - 双 profile 保存 / 回读
   - active mode 投影
   - Claude Code routing probe 命中 active profile
7. 验证命令：
   - `go test ./internal/...`
   - `cd frontend && npx tsc --noEmit`

## 设计稿入口

- 本期不产出独立 HTML 设计稿；改动基于现有账号详情组件条件扩展。

## Worktree 映射

- branch：`feat/20260603-xiaomi-template`
- worktree：`../GetTokens-worktrees/20260603-xiaomi-template/`

## 相关链接

- 小米模型列表：https://platform.xiaomimimo.com/static/docs/quick-start/model.md
- 小米首次调用：https://platform.xiaomimimo.com/static/docs/quick-start/first-api-call.md
- Token Plan 快速接入：https://platform.xiaomimimo.com/static/docs/price/tokenplan/quick-access.md
- Claude Code 配置：https://platform.xiaomimimo.com/static/docs/integration/claudecode.md



## 方案更新：推荐 V3 拆厂商

经复核，当前更推荐采用 `plans/split-vendor-v3.md`：

- `Xiaomi MiMo API`：按量 API 厂商，agent 与模型列表均使用 `sk-xxxxx`。
- `Xiaomi MiMo Token Plan`：订阅厂商，agent 使用 `tp-xxxxx`，额外支持配置 `sk-xxxxx` 仅用于拉取模型列表。

该方案避免在同一账号内引入 active mode / mode profile 投影，route guard、usage attribution、Claude Code routing 热路径改动更小。

## 当前状态

- 状态：implemented
- 最近更新：2026-06-03
- 补充：厂商选择卡片已增加 `API / sk` 与 `Token Plan / tp` 模式 badge，避免两个 Xiaomi 预设只显示同名。
- 补充：额度 / 余额 cURL 模板按拆厂商语义归位：API 预设提供平台余额 `billingCurlTemplate`；Token Plan 预设提供订阅用量 `quotaCurlTemplate` 和平台余额 `billingCurlTemplate`。模板使用 `{{platformCookie}}` 占位符，不固化真实 Cookie。


## 会话交接

以下工作已完成代码落地，待下个会话验证或接续：

### 1. `handlePresetApply` cURL 表单预填确认
- `AccountsFeature.tsx:handlePresetApply` 使用 `unifiedComposeForm` 初始表单
- `billingCurlTemplate` 已存在时区域自动展示，确认两个预设均正常展示余额 cURL 区域

### 2. unified compose 保存时 `billingCurlTemplate` 未预填到 `unifiedComposeForm`
- `handlePresetApply` 未同步将 `preset.billingCurlTemplate` 写入 `form.billingCurl`（目前只写 `quotaCurl`）
- Token Plan 预设选完后需要点击「添加」才看到余额模板，建议确认是否需要在预设选择时自动回填

### 3. 账号记录的 `modelFetchApiKey` 回读测试
- 后端 DTO 和前端 draft 已支持
- 确认 Token Plan 厂商的余额测试不会误用 `tp-xxxxx`

### 4. Claude Code account list 中 `officialSwitchableModels` 更新
- 当前 `mimo` 条目：`['mimo-v2.5-pro[1m]', 'mimo-v2.5', 'mimo-v2.5-tts']`
- 新模型 `mimo-v2-flash`, `mimo-v2-pro`, `mimo-v2-omni` 尚未补充

### 5. DeepLink 导入 / API Key 创建流程
- `ApiKeyComposeModal` 和 DeepLink 导入不经过 UnifiedCompose，未适配 `modelFetchApiKey`
- Token Plan 厂商通过 DeepLink 导入时缺少 modelFetch 字段

### 6. 桌面端验收
- Wails build 已通过，但未在桌面端做实机验证
- 建议下个会话在 `/Applications/GetTokens.app` 或 dev build 中确认：
  - UnifiedCompose 选择 Xiaomi 预设后 cURL 区域展示
  - 账号详情中模型拉取凭据区域保存/回读
  - Cookie 指引和 `{{platformCookie}}` 变量提示是否正常渲染

## 模式沉淀

本次会话产出的可复用模式（`docs-linhay/dev/` 无需新增，记录至此供参考）：

- **`modelFetchApiKey` 模式**：管理字段不进入运行态路由。后续任何厂商需要“额外凭据仅用于模型列表拉取”时可复用此设计，不修改 route guard / usage attribution。
- **`setupGuide` 模式**：`VendorPreset.quotaSetupGuide/billingSetupGuide` 配合 `AccountCurlEditorModal.setupGuide` prop，支持厂商在 cURL 编辑器侧边栏展示步骤指引。后续厂商只要 cURL 依赖非 API-Key 凭据都可复用。
- **`variantLabel` 模式**：同一 icon/颜色下多个形态的厂商（如 API vs Token Plan），通过 `variantLabel/variantDescription` 做卡片 badge 区分。

## 2026-06-03 接续收尾：V3 回读、DeepLink 与 Claude Code 模型补齐

### 已补齐

1. **账号记录回读 modelFetch 字段**
   - `internal/accounts.AccountRecord` 已有 `modelFetchApiKey/modelFetchBaseUrl`；本次补齐 Wails app 层 `AccountRecord` DTO 与 `mapAccountRecord` 映射，确保 `ListAccounts` 返回的 openai-compatible 账号也能带回 management-only 模型拉取凭据。
   - 重新运行 `./scripts/wails-cli.sh build` 生成 `frontend/wailsjs/go/models.ts`，前端类型已包含 `AccountRecord.modelFetchApiKey/modelFetchBaseUrl`。

2. **DeepLink 导入支持 Token Plan 模型拉取凭据**
   - `normalizeDeepLinkOpenAICompatibleCredential` 会 trim 并保留 `model_fetch_api_key` 与 `model_fetch_base_url`。
   - 新增 Go 单测覆盖 Xiaomi MiMo Token Plan deep link payload，确认 `tp-agent` 留在 `api_key_entries_json`，`sk-models` 作为模型列表拉取专用凭据进入 management-only 字段。

3. **Claude Code Xiaomi MiMo 官方可切换模型补齐**
   - `officialSwitchableModels` 从旧的 `mimo-v2.5-pro[1m] / mimo-v2.5 / mimo-v2.5-tts` 扩展为包含 `mimo-v2.5-pro`、`mimo-v2-pro`、`mimo-v2-omni`、`mimo-v2-flash`。
   - Storybook mock 数据同步更新，新增单测锁定新增模型。

4. **UnifiedCompose cURL 与模型拉取凭据回归锁定**
   - 补充前端单测锁定 Token Plan 创建时会提交 `modelFetchApiKey/modelFetchBaseUrl`。
   - 补充断言确保 Xiaomi 两个预设存在余额/用量 cURL 回填入口，余额区域由 `billingCurlTemplate` 控制展示。

### 验证

- `go test ./internal/...`：通过。
- `cd frontend && npx tsc --noEmit`：通过。
- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`：31/31 通过。
- `./scripts/wails-cli.sh build`：通过，包含 bindings + 前端编译 + macOS app 打包。

### 仍需注意

- 当前工作树仍包含 Codex live-session 相关未提交改动，提交 Xiaomi 任务前需要按 diff 分离 staging，避免把两个需求混到同一个提交。

## 2026-06-03 创建页 Cookie 输入补强

### 交互补齐

- 在 UnifiedCompose 添加第三方厂商账号页中，若当前厂商 cURL 模板/指引需要平台 Cookie，会展示独立「平台 Cookie」输入框。cURL 文本保持 `{{platformCookie}}` 占位符，保存后由 quota/billing cURL 执行链替换变量。

### 验证

- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs`：通过。
- `cd frontend && npx tsc --noEmit`：通过。

## 2026-06-03 平台 Cookie 独立变量化

### 需求修正

用户明确要求：Cookie 不应只作为一次性替换进 cURL 的文本，而应像 `{{apiKey}}` 一样成为独立输入变量；cURL 模板中保留占位符。

### 实现

- 新增 `platformCookie` 字段贯通：
  - Wails `AccountRecord` / `CreateCodexAPIKeyInput` / `UpdateCodexAPIKeyConfigInput` / `TestCodexAPIKeyQuotaCurlInput`
  - 前端 `ApiKeyFormState` / `ApiKeyConfigDraft` / UnifiedCompose form
  - sidecar `codex_api_key_accounts.platform_cookie` SQLite 列
  - sidecar quota/billing test request `platform_cookie`
- cURL 模板从 `-b "<PASTE_PLATFORM_COOKIE>"` 改为 `-b "{{platformCookie}}"`。
- cURL 编辑器变量区新增 `platformCookie`，提示区支持 `{{apiKey}} / {{baseUrl}} / {{prefix}} / {{platformCookie}}`。
- Xiaomi 添加第三方厂商账号页与账号详情页都提供「平台 Cookie」独立输入框；保存后运行 quota / billing curl 时由 sidecar 将 `{{platformCookie}}` 替换为保存值。
- 输入会去除前缀 `Cookie:`，只保存 cookie 内容本身。

### 验证

- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs`：通过。
- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/accounts/tests/openAICompatible.test.mjs`：66/66 通过。
- `cd frontend && npx tsc --noEmit`：通过。
- `go test ./internal/...`：通过。
- sidecar reference：`go test ./internal/gettokens/accountstore ./internal/api/handlers/management` 通过。
- `./scripts/wails-cli.sh build`：通过，已重新生成 Wails bindings 并重建 sidecar。

## 2026-06-03 通用化：辅助凭据与变量声明驱动

### 背景与需求

用户指出：当前 `platformCookie` 虽然是独立字段了，但仍然是 Xiaomi 特判——展示逻辑靠 `requiresModelFetchApiKey`、`quotaSetupGuide` 等字段来推导，不够通用。用户要求**所有输入框都要能作为 `{{变量名}}` 在 cURL 里使用**。

### 实现改动

#### 1. 新增 `VendorCredentialField` 声明式类型（vendorPresets.ts）

```ts
export type VendorCredentialFieldID = "platformCookie" | "modelFetchApiKey" | "modelFetchBaseUrl";

export interface VendorCredentialField {
  id: VendorCredentialFieldID;
  label: string;
  placeholder?: string;
  help?: string;
  secret?: boolean;
  variableName?: string;    // 映射到 cURL 占位符：{{variableName}}
  scope: "curl" | "model_fetch";  // cURL 变量 vs 模型列表拉取凭据
}
```

#### 2. `VendorPreset` 增加 `credentialFields` 数组

Xiaomi 预设声明：

```ts
// API 预设：仅平台 Cookie
credentialFields: [XIAOMI_MIMO_PLATFORM_COOKIE_FIELD]

// Token Plan 预设：平台 Cookie + 模型拉取 key + baseUrl
credentialFields: [XIAOMI_MIMO_PLATFORM_COOKIE_FIELD, ...XIAOMI_MIMO_MODEL_FETCH_FIELDS]
```

#### 3. UI 组件统一渲染（不再有 Xiaomi if/else）

- **UnifiedComposeModal**：新增 `UnifiedComposeCredentialFieldsSection` 组件，读取 `selectedPreset.credentialFields`，按 `scope` 分组渲染为 `cURL 变量` 和 `模型列表拉取` 两组输入框。
- **AccountDetailSections**：新增 `VendorCredentialInputField` 组件，同样按 preset 声明渲染辅助字段。
- **AccountCurlEditorModal**：`buildCurlVariables(draft, vendorFields)` 改为接受 vendor fields 参数，自动将 scope=curl 且含有 variableName 的字段加入变量列表。

#### 4. 前向兼容

`VendorPreset.requiredModelFetchApiKey`、`modelFetchApiKeyPlaceholder` 等旧字段保留未删除；字段级 `platformCookie` 也保留。新增 `credentialFields` 与旧字段并存。

### 局限与待完成

1. **底层仍为固定字段**：`platformCookie` / `modelFetchApiKey` / `modelFetchBaseUrl` 在 Wails DTO、内联 types、draft 模型中仍是固定成员字段。真正“万能变量”需要升级为 `curlVariables: Record<string, string>`。
2. **sidecar 替换链仍是特判**：`applyQuotaCurlPlaceholders` 只替换已知的 `{{apiKey}} / {{baseUrl}} / {{prefix}} / {{platformCookie}}`。如果新增任意变量名，sidecar 端的通用替换需要后端 `curlVariables` 传递。
3. **账号详情保存/回读**：详情页的 `VendorCredentialInputField` 当前只处理 `platformCookie`。`modelFetchApiKey` 的详情编辑走的是 `OpenAICompatibleDetailPanel` 的独立区域，未纳入此通用渲染。

### 验证

- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs`：通过（`vendor presets drive auxiliary credentials and cURL variables generically` 测试锁定声明式渲染）。
- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`：44/44 通过。
- `cd frontend && npx tsc --noEmit`：通过。

## 会话交接

### 已提交（已入库）

| 提交 | 主题 | 文件 |
|------|------|------|
| `111036c` | fix: distinguish xiaomi provider presets | vendorPresets / AccountsFeature |
| `16e21d1` | chore: close live session projection workflow | live session models |
| `4ac7d9f` | fix: finalize xiaomi quota curls and codex payload notes | cURL / accountDetailConfig |
| `31a0559` | docs: record Xiaomi platform cookie variable flow | memory / space |
| `376e143` | docs: record codex upstream limit boundary | domain skill / AGENTS |
| `52325bb` | fix: cache account-backed codex model catalog | account cache + catalog |
| `76a7226` | feat: add codex model catalog diagnostics | catalog diagnostics |

### 未提交（工作区中）

- Codex live-session UI 改进（`CodexLiveSessionsFeature.tsx` + `snapshotMerge` + `app_codex_live_sessions.*`）
- 不属于 Xiaomi 任务，是另一条并行线

### 待完成（需下个会话接手）

1. **将 `curlVariables` 从固定字段升级为 `Record<string, string>`**
   - 当前 `platformCookie` / `modelFetchApiKey` / `modelFetchBaseUrl` 仍是固定字段
   - 需要升级 Wails DTO、sidecar account-store SQLite（new column `curl_variables_json`）、`ApiKeyConfigDraft` 前端类型
   - sidecar `applyQuotaCurlPlaceholders` 需要支持动态变量替换（从 `quotaCurlInput` 接收 `map[string]string` 而非逐个参数）
   - UI 侧再不需要新增固定字段；preset 声明新变量后保存/回读/替换自动完成

2. **账号详情 `modelFetchApiKey` 纳入通用 `credentialFields` 渲染**
   - 当前详情页的模型拉取 key 走的是 `OpenAICompatibleDetailPanel` 的独立区域（`requiresModelFetchApiKey` 判读）
   - 应合并到 `AccountCredentialVerifySection` 的 `credentialFields` 通用渲染逻辑中

3. **Claude Code account list `officialSwitchableModels` 完整更新**
   - `mimo-v2.5-pro`, `mimo-v2-pro`, `mimo-v2-omni`, `mimo-v2-flash` 已在 vendorPresets 中列出
   - Claude Code profile 已加入，但 `mimo-v2.5-asr`, `mimo-v2.5-tts` 等非对话模型需确认是否跟随

4. **DeepLink 导入 `modelFetchApiKey` 支持**
   - `normalizeDeepLinkOpenAICompatibleCredential` 已保留 `model_fetch_api_key/model_fetch_base_url`
   - 但 `compileDeepLinkAccountWrite` 的 `OpenAICompatible` 分支使用 `normalizeDeepLinkOpenAICompatibleCredential` 只 Trim，后续保存时需要确认 sidecar account-store 正确写入

5. **UnifiedCompose `billingCurlTemplate` 预设自动回填确认**
   - `handlePresetApply` 中 `billingCurl` 使用 `preset.billingCurlTemplate ?? prev.billingCurl`
   - 已确认回填逻辑存在；但选中预设后余额 cURL 区域展示依赖 `selectedPreset.billingCurlTemplate || form.billingCurl` 非空判断
   - 需要桌面端最终验证

### 模式沉淀小结

本轮沉淀了以下可复用模式：

| 模式 | 入口 | 适用范围 |
|------|------|---------|
| `credentialFields` 声明式辅助凭据 | `VendorPreset.credentialFields` | 任何需要额外输入框的厂商 |
| `{{variableName}}` cURL 变量替换 | `buildCurlVariables` + `applyQuotaCurlPlaceholders` | 任意 cURL 模板的占位符替换 |
| `scope: "curl" / "model_fetch"` 分组 | UI 组件自动分组渲染 | 区分 cURL 变量和模型拉取凭据 |
| `variantLabel` 同 icon 多形态区分 | vendor card badge | API vs Token Plan 等 |


## 2026-06-03 补充：curlVariables 通用替换链路落地

本轮完成辅助凭据“最后一公里”的第一部分：将 cURL 变量从单个 `platformCookie` 特判扩展为 `curlVariables: Record<string, string>`。

### 已完成

- Wails DTO 增加 `curlVariables?: Record<string, string>`：
  - `AccountRecord`
  - `CreateCodexAPIKeyInput`
  - `UpdateCodexAPIKeyConfigInput`
  - `TestCodexAPIKeyQuotaCurlInput`
- 前端账号详情 `ApiKeyConfigDraft` 增加 `curlVariables`，`VendorCredentialField.id` 放宽为任意字符串。
- `credentialFields` 中 `scope=curl` 的任意字段可写入 draft `curlVariables[field.id]`，cURL 编辑器变量区也按声明展示。
- sidecar account-store 为 `codex_api_key_accounts` 新增 `curl_variables_json TEXT NOT NULL DEFAULT '{}'`，并在 schema ensure 中补列。
- sidecar `quota-test` / `billing-test` 请求支持 `curl_variables`，`applyQuotaCurlPlaceholders` 支持替换任意 `{{key}}`。
- 兼容保留 `platformCookie`：保存时同步进入 `curlVariables.platformCookie`，旧字段仍可回读与替换。

### 验证

- CLIProxyAPI：新增 `TestQuotaDraftReplacesArbitraryCurlVariables`，覆盖 `{{organizationId}}` 任意变量替换。
- CLIProxyAPI：新增 `TestCodexAPIKeyCurlVariablesRoundTrip`，覆盖 SQLite `curl_variables_json` 保存/回读。
- GetTokens：`go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp -count=1` 通过。
- CLIProxyAPI：`go test ./internal/gettokens/accountstore ./internal/api/handlers/management -count=1` 通过。
- 前端：`node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs` 44/44 通过。
- 前端：`cd frontend && npx tsc --noEmit` 通过。

### 未完成

- 账号详情 `modelFetchApiKey` / `modelFetchBaseUrl` 仍在 `OpenAICompatibleDetailPanel` 内作为独立区域编辑；尚未完全并入 `credentialFields` 通用渲染路径。
- DeepLink 的 `model_fetch_api_key` / `model_fetch_base_url` 仅完成保留与 trim 路径复核，尚未做完整导入闭环验收。
- Wails 桌面端真实渲染、选预设后 billing cURL 展示仍待桌面验收。

## 2026-06-03 补充 2：modelFetch 详情页并入 credentialFields 通用渲染

### 已完成

`OpenAICompatibleDetailPanel` 中硬编码的模型拉取凭据区域（`modelFetchApiKey` / `modelFetchBaseUrl` 输入框）已替换为 credentialFields 声明式通用渲染：

- 在 `OpenAICompatibleDetailPanel` 中通过 `resolveVendorPresetID` + `getVendorPreset` 解析当前账号对应的厂商预设。
- 过滤 `vendorPreset.credentialFields` 中 `scope === "model_fetch"` 的字段。
- 每个字段按声明（`label / placeholder / secret / help`）自动渲染，不再硬编码 JSX。
- 新增 `readModelFetchDraftField` / `writeModelFetchDraftField` 辅助函数处理 `OpenAICompatibleProviderDraft` 与 credentialField ID 的映射。
- 兼容保留：若 draft 中已有 `modelFetchApiKey` / `modelFetchBaseUrl` 值但未匹配到 credentialFields 时，仍显示凭据区域。

### 当前状态

- `UnifiedComposeModal`（创建新账号）：已在上一轮完成 credentialFields 按 scope 分组渲染（curl / model_fetch）。
- `OpenAICompatibleDetailPanel`（编辑已有账号）：本轮完成 model_fetch 字段的 credentialFields 通用化。
- `requiresModelFetchApiKey` 保留在 `openAICompatible.ts` 中用于 `resolveOpenAICompatibleModelFetchConfig` 的业务逻辑（判断模型拉取是否需要专用 key），不涉及渲染。

### 验证

- `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`：44/44 通过。
- `node --test frontend/src/features/accounts/tests/openAICompatible.test.mjs`：22/22 通过。
- `cd frontend && npx tsc --noEmit`：通过。

### 仍待完成

- DeepLink 导入 `model_fetch_api_key` / `model_fetch_base_url` 完整闭环验证（sidecar 导入验收）。
- Wails 桌面端真实渲染验收（选预设 → 账号详情 model fetch 区域确认）。

## 2026-06-03 补充 3：DeepLink + sidecar model_fetch 闭环修复

### 问题

`normalizeDeepLinkOpenAICompatibleCredential` 已保留 `ModelFetchAPIKey` / `ModelFetchBaseURL` trim 路径，但 sidecar（CLIProxyAPI fork）的 `oidc-api-compatible` 的 `OpenAICompatibleCredential` 和 SQLite `openai_compatible_accounts` 表中完全缺失这两个字段，导致 DeepLink 导入时字段被 JSON 反序列化丢弃。

### 修复

在 sidecar 中补齐完整链路：

- `accountstore.OpenAICompatibleCredential` 新增 `ModelFetchAPIKey` / `ModelFetchBaseURL`（`model_fetch_api_key` / `model_fetch_base_url` JSON tag）
- SQLite `openai_compatible_accounts` 表新增 `model_fetch_api_key TEXT NOT NULL DEFAULT ''` 和 `model_fetch_base_url TEXT NOT NULL DEFAULT ''`
- `EnsureSchema` 新增自动补列迁移
- `attachCredential` SELECT + `insertCredentialRows` INSERT 均已更新
- 新增 `TestOpenAICompatibleModelFetchFieldsRoundTrip` 覆盖 SQLite 保存/回读

### 验证

- CLIProxyAPI：`go test ./internal/gettokens/accountstore ./internal/api/handlers/management -count=1` 通过
- GetTokens：`go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp -count=1` 通过
- 前端：66/66 测试通过（44 account + 22 openai-compatible）
- `cd frontend && npx tsc --noEmit` 通过
- sidecar `go build ./cmd/server` 成功
- `./scripts/wails-cli.sh build` 成功（bindings 重生成 + 前端编译通过）

### 轮次总结

| 优先级 | 内容 | 状态 |
|--------|------|------|
| 1 | `curlVariables: Record<string,string>` 通用替换链路 | ✅ |
| 2 | `modelFetch` 详情页并入 credentialFields 通用渲染 | ✅ |
| 3 | DeepLink 导入闭环验证 | ✅ |
| 3 | Wails 桌面端真实渲染验收 | ⏳ 需桌面端手动确认 |

仍待 Wails 桌面端手动确认：
- 新建 Xiaomi Token Plan 账号 → 确认 3 个 credentialFields 输入框（平台 Cookie / 模型拉取 API Key / Model Fetch Base URL）
- 进入账号详情 → 确认 model_fetch 凭据区域正确渲染
- cURL 编辑器变量区按声明展示 {{platformCookie}}
