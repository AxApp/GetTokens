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
