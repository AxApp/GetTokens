# 方案 V3：拆成两个 Xiaomi 厂商预设

## 0. 结论

相比 V2 的「同一账号内双 Mode Profile」，V3 推荐将 Xiaomi 拆成两个厂商预设：

1. **Xiaomi MiMo API**：按量 API 模式，使用 `sk-xxxxx`
2. **Xiaomi MiMo Token Plan**：订阅套餐模式，使用 `tp-xxxxx` 执行 agent 对话，同时额外配置一个 `sk-xxxxx` 只用于拉取模型列表

这是当前更轻量、更贴近现有 GetTokens openai-compatible 账号模型的方案。

## 1. 为什么 V3 更适合当前代码结构

当前 openai-compatible 账号天然是：

```text
provider + baseUrl + apiKeyEntries + formatBaseUrls + models
```

如果强行在一个账号里支持双模式，需要新增：

- modeProfilesJSON
- activeMode
- active profile 投影
- 路由热路径测试
- usage attribution 区分
- UI 双 profile 管理

而拆成两个厂商后，可以复用现有能力：

```text
Xiaomi MiMo API
  baseUrl = https://api.xiaomimimo.com/v1
  apiKey = sk-xxxxx

Xiaomi MiMo Token Plan
  baseUrl = https://token-plan-cn.xiaomimimo.com/v1
  apiKey = tp-xxxxx
  modelFetchApiKey = sk-xxxxx // 只用于 /v1/models
```

用户通过启用/禁用、优先级、账号选择或 route guard 控制 agent 使用哪个账号，不需要在同一个账号详情里做 active mode 切换。

## 2. 厂商预设设计

### 2.1 Xiaomi MiMo API

```ts
{
  id: 'xiaomimimo',
  name: 'Xiaomi MiMo API',
  apiFormat: 'openai_chat',
  supportedFormats: ['openai_chat', 'anthropic'],
  baseUrl: 'https://api.xiaomimimo.com/v1',
  formatBaseUrls: {
    openai_chat: 'https://api.xiaomimimo.com/v1',
    anthropic: 'https://api.xiaomimimo.com/anthropic',
  },
  apiKeyPlaceholder: 'sk-...',
  modelSuggestions: [...],
  notes: '按量 API 模式，使用 sk-xxxxx。模型列表拉取和 agent 对话均使用此 API Key。',
}
```

### 2.2 Xiaomi MiMo Token Plan

```ts
{
  id: 'xiaomimimo-token-plan',
  name: 'Xiaomi MiMo Token Plan',
  apiFormat: 'openai_chat',
  supportedFormats: ['openai_chat', 'anthropic'],
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  formatBaseUrls: {
    openai_chat: 'https://token-plan-cn.xiaomimimo.com/v1',
    anthropic: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  },
  apiKeyPlaceholder: 'tp-...',
  modelSuggestions: [...],
  modelFetchBaseUrl: 'https://api.xiaomimimo.com/v1',
  modelFetchApiKeyPlaceholder: 'sk-...',
  notes: '订阅模式使用 tp-xxxxx 执行 agent 对话；如需拉取模型列表，请额外填写 sk-xxxxx，仅用于 /v1/models，不参与 agent 对话。Token Plan Base URL 以订阅页显示为准，可改为 cn / sgp / ams。',
}
```

## 3. 数据模型扩展

### 3.1 VendorPreset 扩展

```ts
export interface VendorPreset {
  // existing
  id: string;
  name: string;
  apiFormat: ApiFormat;
  supportedFormats: ApiFormat[];
  baseUrl: string;
  formatBaseUrls?: Partial<Record<ApiFormat, string>>;
  apiKeyPlaceholder: string;
  modelSuggestions: string[];
  category: ...;

  // new
  notes?: string;
  consoleUrl?: string;

  /** 拉取模型列表专用 baseUrl。为空时使用 baseUrl。 */
  modelFetchBaseUrl?: string;
  /** 拉取模型列表专用 API Key 占位符。为空时使用 apiKeyPlaceholder。 */
  modelFetchApiKeyPlaceholder?: string;
  /** 是否需要独立的模型拉取 API Key。 */
  requiresModelFetchApiKey?: boolean;
}
```

### 3.2 OpenAICompatibleProvider / Draft 扩展

新增一个仅用于模型拉取的 key，不参与运行态路由：

```go
type OpenAICompatibleAccountCredential struct {
    // existing
    ProviderName       string `json:"provider_name"`
    BaseURL            string `json:"base_url"`
    APIKeyEntriesJSON  string `json:"api_key_entries_json"`
    HeadersJSON        string `json:"headers_json,omitempty"`
    FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
    ModelsJSON         string `json:"models_json,omitempty"`

    // new; management/UI only, not used by relay route
    ModelFetchAPIKey   string `json:"model_fetch_api_key,omitempty"`
    ModelFetchBaseURL  string `json:"model_fetch_base_url,omitempty"`
}
```

前端：

```ts
export interface OpenAICompatibleProviderDraft {
  // existing
  apiKey: string; // agent 对话 key，Token Plan 厂商下为 tp-xxxxx
  baseUrl: string;

  // new
  modelFetchApiKey?: string;  // Token Plan 厂商下为 sk-xxxxx
  modelFetchBaseUrl?: string; // 默认为 https://api.xiaomimimo.com/v1
}
```

## 4. 模型列表拉取策略

### 4.1 默认规则

`FetchOpenAICompatibleProviderModels` 当前输入：

```go
type FetchOpenAICompatibleProviderModelsInput struct {
    BaseURL string
    APIKey  string
    Headers map[string]string
}
```

无需大改后端，只需要前端在调用时选择正确 key：

```ts
const baseUrl = draft.modelFetchBaseUrl || draft.baseUrl;
const apiKey = draft.modelFetchApiKey || draft.apiKey;
FetchOpenAICompatibleProviderModels({ baseUrl, apiKey, headers })
```

### 4.2 Token Plan 厂商规则

对于 `xiaomimimo-token-plan`：

- agent 对话使用：`draft.apiKey` = `tp-xxxxx`
- 模型拉取使用：`draft.modelFetchApiKey` = `sk-xxxxx`
- 模型拉取 baseUrl：`draft.modelFetchBaseUrl` = `https://api.xiaomimimo.com/v1`

如果用户未填写 `modelFetchApiKey`：

- UI 不应直接用 `tp` 去拉 API 模式 `/v1/models`
- 应提示：`Token Plan 厂商需要额外填写 sk-xxxxx 才能拉取模型列表；也可以使用内置模型建议。`

## 5. UI 设计

### 5.1 Xiaomi MiMo API 厂商

保持现有单 key UI：

```text
API Key: sk-xxxxx
Base URL: https://api.xiaomimimo.com/v1
```

### 5.2 Xiaomi MiMo Token Plan 厂商

账号详情中展示两个 key 区域：

```text
Agent 对话凭据
- Token Plan Key: tp-xxxxx
- OpenAI Base URL: https://token-plan-cn.xiaomimimo.com/v1
- Anthropic Base URL: https://token-plan-cn.xiaomimimo.com/anthropic

模型列表拉取（可选）
- API Key: sk-xxxxx
- Model Fetch Base URL: https://api.xiaomimimo.com/v1
```

强调：

- `tp` 用于 agent 对话。
- `sk` 只用于模型列表，不参与 route guard，不参与 agent 对话。
- Token Plan Base URL 可按订阅页改为 `cn / sgp / ams`。

## 6. 路由与运行态影响

V3 的最大优势是路由逻辑几乎不变：

- Xiaomi API 厂商：route 使用 `sk` + `api.xiaomimimo.com`
- Xiaomi Token Plan 厂商：route 使用 `tp` + `token-plan-*.xiaomimimo.com`
- `modelFetchApiKey` 不进入 `APIKeyEntriesJSON`
- `modelFetchApiKey` 不进入 route candidates
- `modelFetchApiKey` 不进入 usage attribution

因此无需 active profile 投影，也不用新增 activeMode。

## 7. 实现步骤

### Step 1：更新 VendorPreset

- 保留 / 更新 `xiaomimimo` 为 `Xiaomi MiMo API`
- 新增 `xiaomimimo-token-plan`
- 补充完整模型建议
- 新增 `modelFetchBaseUrl` / `requiresModelFetchApiKey`

### Step 2：扩展账号 DTO

Go：

- `OpenAICompatibleAccountCredential.ModelFetchAPIKey`
- `OpenAICompatibleAccountCredential.ModelFetchBaseURL`
- Wails `OpenAICompatibleProvider` 透出 `modelFetchApiKey` / `modelFetchBaseUrl`
- create/update input 支持两个字段

TS：

- draft 增加 `modelFetchApiKey` / `modelFetchBaseUrl`

### Step 3：账号详情 UI

- 当 preset `requiresModelFetchApiKey` 为 true 时显示“模型列表拉取（可选）”区域
- 普通厂商不显示

### Step 4：模型拉取调用

- `fetchRemoteModelsForDraft` 根据 draft 中的 `modelFetchApiKey` / `modelFetchBaseUrl` 选择拉取凭据
- 如果 `requiresModelFetchApiKey` 但未填写，显示提示而不是用 `tp` 误拉

### Step 5：创建流程

- 选择 `Xiaomi MiMo Token Plan` 时：
  - 主 key placeholder 为 `tp-...`
  - 额外显示模型拉取 key `sk-...`（可选）

### Step 6：测试

Go：

1. `TestUpdateOpenAICompatibleProviderPersistsModelFetchCredential`
2. `TestOpenAICompatibleProviderModelFetchCredentialNotInAPIKeyEntries`
3. `TestFetchModelsUsesModelFetchCredentialForTokenPlanPreset`（如果后端聚合逻辑参与）

前端：

1. Token Plan draft 构建包含 `modelFetchBaseUrl`
2. fetch models 使用 `modelFetchApiKey` 而非 `apiKey`
3. 普通厂商不显示模型拉取 key 区域

## 8. 验收标准

1. 厂商列表中出现：
   - `Xiaomi MiMo API`
   - `Xiaomi MiMo Token Plan`
2. API 厂商使用 `sk` 作为 agent key，可正常拉取模型列表。
3. Token Plan 厂商使用 `tp` 作为 agent key，baseUrl 为 token-plan endpoint。
4. Token Plan 厂商可额外填写 `sk` 作为模型列表拉取 key。
5. Token Plan 厂商拉模型时不会误用 `tp`。
6. `modelFetchApiKey` 不进入 route candidates / usage attribution。
7. DeepSeek、OpenRouter 等普通厂商无 UI / 保存 / 路由回归。

## 9. V2 与 V3 对比

| 维度 | V2：同账号双 Mode Profile | V3：拆两个厂商 |
|---|---|---|
| 数据模型复杂度 | 高 | 中低 |
| 路由热路径改动 | 需要 active profile 投影 | 基本不改 |
| UI 复杂度 | 一个账号内双 profile + active toggle | 两个厂商，各自单模式 |
| 用户理解成本 | 中：一个账号里切模式 | 低：API / Token Plan 两个厂商 |
| 模型拉取特殊需求 | 需要 profile 级策略 | Token Plan 厂商加 modelFetchApiKey 即可 |
| 推荐度 | 适合未来多厂商多模式 | 更适合当前 Xiaomi 需求 |

## 10. 推荐结论

当前更推荐 V3：**拆成两个 Xiaomi 厂商**。

原因：

1. 更贴近小米官方配置方式：Pay-as-you-go 与 Token Plan 是两套 Base URL + 两套 Key。
2. 更贴近 GetTokens 现有账号模型：一个 provider 一套运行态 key/baseUrl。
3. 避免改动 route guard / usage attribution / relay hot path。
4. Token Plan 特有的“需要 sk 拉模型”可以通过 `modelFetchApiKey` 局部解决。
