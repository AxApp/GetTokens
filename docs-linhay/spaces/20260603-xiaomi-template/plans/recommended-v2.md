# 推荐方案 V2：Xiaomi MiMo 双模式 Profile

## 0. 结论

采用 **Mode Profile 管理态 + Active Profile 运行态投影** 方案。

不要把 Xiaomi 的双模式只建模为「同一个 provider 下两条 key」。小米 Token Plan 与按量 API 不仅 key 不同，Base URL / Anthropic Base URL 也不同，因此需要把 key、baseUrl、formatBaseUrls 作为一个完整 profile 保存。

## 1. 需求边界

### 用户目标

用户在 Xiaomi MiMo 账号中同时配置两套凭据：

1. **API 模式**：`sk-xxxxx`，用于按量 API 调用、模型列表拉取。
2. **订阅模式**：`tp-xxxxx`，用于 Token Plan 套餐额度执行 agent 对话。

用户可以在账号详情里切换当前 agent 对话使用：

- API 模式
- 订阅模式

### 关键事实

| 模式 | Key | OpenAI Base URL | Anthropic Base URL |
|---|---|---|---|
| API 模式 | `sk-xxxxx` | `https://api.xiaomimimo.com/v1` | `https://api.xiaomimimo.com/anthropic` |
| 订阅模式 | `tp-xxxxx` | `https://token-plan-<cluster>.xiaomimimo.com/v1` | `https://token-plan-<cluster>.xiaomimimo.com/anthropic` |

Token Plan cluster 可能是：

- CN：`token-plan-cn`
- SGP：`token-plan-sgp`
- AMS：`token-plan-ams`

所以订阅模式必须允许用户编辑 Base URL，不能硬编码 CN。

## 2. 核心架构

### 2.1 管理态：保存完整 mode profiles

账号管理数据保存完整双 profile：

```json
{
  "active_mode": "subscription",
  "mode_profiles_json": "[...]"
}
```

每个 profile 是一套完整可调用配置：

```go
type OpenAICompatibleModeProfile struct {
    Mode           string            `json:"mode"`
    Label          string            `json:"label,omitempty"`
    APIKey         string            `json:"api_key"`
    BaseURL        string            `json:"base_url"`
    FormatBaseURLs map[string]string `json:"format_base_urls,omitempty"`
    Headers        map[string]string `json:"headers,omitempty"`
}
```

### 2.2 运行态：只投影 active profile

sidecar 热路径不直接理解 Xiaomi 双模式。

保存或应用运行态时，根据 `active_mode` 找到对应 profile，然后投影成现有 openai-compatible provider：

```text
active profile
  -> BaseURL
  -> FormatBaseURLs
  -> Headers
  -> APIKeyEntries[0]
```

这样 route guard、usage attribution、Claude Code routing、relay model catalog 可以继续使用现有结构。

### 2.3 兼容策略

无 `mode_profiles_json` 的旧账号：

- 继续使用现有 `base_url`、`api_key_entries_json`、`format_base_urls_json`。
- `active_mode` 为空时不做投影。

有 `mode_profiles_json` 的 Xiaomi 账号：

- 详情 UI 展示双 profile。
- 运行态只使用 active profile。

## 3. 数据模型设计

### 3.1 Go：`internal/cliproxyapi/types.go`

新增：

```go
type OpenAICompatibleModeProfile struct {
    Mode           string            `json:"mode"`
    Label          string            `json:"label,omitempty"`
    APIKey         string            `json:"api_key"`
    BaseURL        string            `json:"base_url"`
    FormatBaseURLs map[string]string `json:"format_base_urls,omitempty"`
    Headers        map[string]string `json:"headers,omitempty"`
}
```

扩展：

```go
type OpenAICompatibleAccountCredential struct {
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

扩展 Wails-facing DTO：

```go
type OpenAICompatibleProvider struct {
    AccountKey     string                  `json:"accountKey,omitempty"`
    Name           string                  `json:"name"`
    Priority       int                     `json:"priority,omitempty"`
    Disabled       bool                    `json:"disabled,omitempty"`
    BaseURL        string                  `json:"baseUrl"`
    Prefix         string                  `json:"prefix,omitempty"`
    ProxyURL       string                  `json:"proxyUrl,omitempty"`
    APIKey         string                  `json:"apiKey"`
    APIKeys        []string                `json:"apiKeys,omitempty"`
    Models         []OpenAICompatibleModel `json:"models,omitempty"`
    Headers        map[string]string       `json:"headers,omitempty"`
    FormatBaseURLs map[string]string       `json:"formatBaseUrls,omitempty"`

    ActiveMode     string                        `json:"activeMode,omitempty"`
    ModeProfiles   []OpenAICompatibleModeProfile `json:"modeProfiles,omitempty"`
}
```

### 3.2 TypeScript：`openAICompatible.ts`

新增：

```ts
export interface OpenAICompatibleModeProfileDraft {
  mode: string;
  label: string;
  apiKey: string;
  baseUrl: string;
  formatBaseUrls: Partial<Record<ApiFormat, string>>;
  headersText: string;
}
```

扩展 draft：

```ts
export interface OpenAICompatibleProviderDraft extends OpenAICompatibleProviderFormState {
  accountKey?: string;
  currentName: string;
  headersText: string;
  models: OpenAICompatibleModelRow[];
  verifyModel: string;
  proxyUrl: string;

  activeMode?: string;
  modeProfiles?: OpenAICompatibleModeProfileDraft[];
}
```

### 3.3 VendorPreset：`vendorPresets.ts`

扩展：

```ts
export interface VendorPresetModeProfile {
  mode: string;
  label: string;
  apiKeyPlaceholder: string;
  baseUrl: string;
  formatBaseUrls?: Partial<Record<ApiFormat, string>>;
  notes?: string;
}

export interface VendorPreset {
  // existing fields
  notes?: string;
  consoleUrl?: string;
  multiModeProfiles?: VendorPresetModeProfile[];
}
```

Xiaomi preset：

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
    notes: 'Token Plan Base URL 以订阅页显示为准，可按集群改为 cn / sgp / ams。',
  },
]
```

## 4. 运行态投影规则

新增纯函数，便于单测：

```go
func projectOpenAICompatibleActiveModeProfile(provider cliproxyapi.OpenAICompatibleProvider) cliproxyapi.OpenAICompatibleProvider
```

规则：

1. `ModeProfiles` 为空：原样返回。
2. `ActiveMode` 为空：默认找 `api` profile；找不到则原样返回。
3. 按 `ActiveMode` 找 profile；找不到则回退 `api`；仍找不到则原样返回。
4. profile 投影：
   - `provider.BaseURL = profile.BaseURL`
   - `provider.FormatBaseURLs = profile.FormatBaseURLs`
   - `provider.Headers = profile.Headers`，为空时继承原 headers
   - `provider.APIKeyEntries = []OpenAICompatibleAPIKeyEntry{{APIKey: profile.APIKey, ProxyURL: 原首 key ProxyURL}}`
5. 如果 active profile 的 `APIKey` 为空：
   - 管理 UI 保存可以允许空；
   - 应用运行态 / 验证 / agent 路由必须报错或跳过该账号，不能落到另一套 key。

## 5. UI 设计

### 5.1 账号详情

Xiaomi 显示两个 profile 卡片：

```text
┌ Xiaomi MiMo 模式 ─────────────────────────────┐
│ 当前用于 agent 对话：                          │
│  ● API 模式（sk）   ○ 订阅模式（tp）            │
└──────────────────────────────────────────────┘

┌ API 模式（sk） ───────────────────────────────┐
│ API Key             [sk-...]                  │
│ OpenAI Base URL     [https://api.../v1]        │
│ Anthropic Base URL  [https://api.../anthropic] │
└──────────────────────────────────────────────┘

┌ 订阅模式（tp） ────────────────────────────────┐
│ Token Plan Key     [tp-...]                   │
│ OpenAI Base URL    [https://token-plan-cn.../v1]│
│ Anthropic Base URL [https://token-plan-cn.../anthropic]│
└──────────────────────────────────────────────┘
```

细节：

- active profile 高亮。
- inactive profile 可留空，但如果用户切到该模式再保存，必须提示 key/baseUrl 不能为空。
- 普通厂商仍显示原来的单 key 单 baseUrl 表单。

### 5.2 创建流程

UnifiedCompose 选择 Xiaomi 后：

- 自动生成两个 profile。
- 默认 activeMode = `api`。
- 支持只填写 active profile 后创建。
- 未填的 inactive profile 保留默认 baseUrl，key 为空，后续详情可补。

### 5.3 模型列表拉取

建议策略：

- 默认使用 API profile 拉取 `/v1/models`。
- 如果 API profile 缺 key，但 active profile 是 subscription，可以允许用 subscription profile 拉取对应 `/v1/models`，但 UI 文案提示模型可用性以官方文档 / 订阅页为准。
- 禁止把 Token Plan 用量查询 Cookie 当作模型列表 key。

## 6. 后端实现步骤

### Step 1：补 Go 红灯测试

1. `TestProjectOpenAICompatibleActiveModeProfileUsesSubscription`
2. `TestProjectOpenAICompatibleActiveModeProfileUsesAPI`
3. `TestUpdateOpenAICompatibleProviderPersistsModeProfiles`
4. `TestClaudeCodeRoutingProbeUsesOnlyActiveModeProfile`

### Step 2：扩展 DTO / 类型

- `internal/cliproxyapi/types.go`
- `internal/wailsapp/openai_compatible.go`
- 根层 Wails DTO：`app_types.go` / `app.go` 如有暴露需求必须同步。

### Step 3：实现投影函数

放在 `internal/wailsapp/openai_compatible.go` 或独立 helper 文件。

### Step 4：保存和回读

- `CreateOpenAICompatibleProviderInput` 支持 `ActiveMode` / `ModeProfiles`
- `UpdateOpenAICompatibleProviderInput` 支持 `ActiveMode` / `ModeProfiles`
- `openAICompatibleAccountWrite` 写入 `ActiveMode` / `ModeProfilesJSON`
- `openAICompatibleProviderFromUnifiedAccount` 回读完整 profiles 给 UI

### Step 5：路由与 usage 检查

检查并测试以下路径是否使用投影后 provider：

- Claude Code routing probe candidates
- relay model catalog
- usage attribution key
- sidecar config apply

验收：inactive profile 的 key 不进入 route candidates。

## 7. 前端实现步骤

### Step 1：VendorPreset 扩展

- 加 `multiModeProfiles`
- Xiaomi preset 填两套默认 profile
- 更新模型建议列表

### Step 2：Draft 构建与归一化

新增纯函数：

```ts
buildModeProfilesFromPreset(preset: VendorPreset): OpenAICompatibleModeProfileDraft[]
normalizeOpenAICompatibleModeProfiles(...)
resolveActiveOpenAICompatibleModeProfile(...)
```

### Step 3：详情 UI

- `OpenAICompatibleDetailPanel.tsx` 条件渲染 multimode UI。
- 可考虑拆组件：`OpenAICompatibleModeProfilesSection.tsx`，避免详情面板继续膨胀。

### Step 4：保存逻辑

`useOpenAICompatibleState.saveDetail` 发送：

```ts
{
  ...legacyFields,
  activeMode: draft.activeMode,
  modeProfiles: draft.modeProfiles,
}
```

同时 legacy fields 投影 active profile，保证后端或旧路径也能拿到正确当前模式。

### Step 5：创建流程

`UnifiedComposeModal` 选择 Xiaomi preset 后：

- 初始化 `modeProfiles`
- 显示双 profile 配置
- submit 传递 active mode 与 profiles

## 8. 验收门禁

### 自动化

```bash
go test ./internal/...
cd frontend && npx tsc --noEmit
```

如果新增 Wails-facing DTO 或方法：

```bash
./scripts/wails-cli.sh build
```

### 手工 / 桌面验收

1. 新建 Xiaomi 账号，填写 API profile，保存成功。
2. 补充 Token Plan profile，切换 activeMode 到 subscription，保存成功。
3. 打开账号详情，两个 profile 均能回显。
4. 运行 Claude Code routing probe：
   - API 模式命中 `sk` + `api.xiaomimimo.com/anthropic`
   - 订阅模式命中 `tp` + `token-plan-*.xiaomimimo.com/anthropic`
5. DeepSeek / OpenRouter 等普通厂商 UI 不显示双模式区域，保存行为不变。

## 9. 风险与规避

| 风险 | 规避 |
|---|---|
| 只替换 key 不替换 baseUrl，导致 Token Plan 请求走错 endpoint | 用 mode profile 保存 key + baseUrl + formatBaseUrls，并投影 active profile |
| inactive key 被 route guard 选中 | route candidates 只使用 active profile 投影结果 |
| Wails DTO 改动后 frontend/wailsjs 不同步 | 走 `scripts/wails-cli.sh` build / binding hygiene |
| 账号详情文件继续膨胀 | 新建 `OpenAICompatibleModeProfilesSection.tsx` |
| Token Plan cluster 硬编码 CN | 默认 CN，但 UI 允许编辑 baseUrl / Anthropic URL |
| Cookie 与 tp key 概念混淆 | 文案明确：agent 对话用 `tp-xxxxx`，Cookie 只属于用量查询 curl |

## 10. DoD

- [ ] Space README 与计划已更新。
- [ ] 红灯测试已补齐。
- [ ] Go 测试通过。
- [ ] TS 类型检查通过。
- [ ] Wails DTO / bindings 已同步。
- [ ] 桌面端 Xiaomi 账号详情双模式可保存 / 回显 / 切换。
- [ ] Claude Code routing probe 证明 activeMode 生效。
- [ ] 普通 openai-compatible 厂商无回归。
