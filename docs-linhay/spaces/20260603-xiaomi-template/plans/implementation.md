# 实现计划 — Xiaomi 双模式 Profile

## 评审结论

旧计划的方向是对的：需要同时配置两套凭据，并由用户选择 agent 对话使用哪种模式。

但旧计划的数据建模不够合理：它只给 `api-key-entries` 加 `key-mode`，只能表达“两套 key”，不能表达 Token Plan 的独立 Base URL / Anthropic Base URL / 集群。因此本计划改为「mode profile」方案。

## 推荐实现原则

1. **管理态保存完整 profile**：`mode_profiles_json` 记录 API / subscription 两套完整配置。
2. **运行态只投影 active profile**：sidecar 路由、usage attribution、route guard 仍按现有单 provider 模型工作，降低热路径改动面。
3. **非 Xiaomi 零影响**：没有 `modeProfiles` 的账号继续走现有 `baseUrl/apiKey/headers/models` 路径。
4. **先测试后实现**：新增 Go 单测和前端模型单测，覆盖双 profile 的保存、回读与投影。

## 改动文件清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `internal/cliproxyapi/types.go` | 修改 | 新增 `OpenAICompatibleModeProfile`，credential 增加 `ActiveMode` / `ModeProfilesJSON` |
| `internal/wailsapp/openai_compatible.go` | 修改 | DTO 透传、保存、active profile 投影 |
| `internal/accounts/account_records.go` | 修改 | AccountRecord 暴露 active mode / mode profiles |
| `internal/wailsapp/claude_code_routing_probe.go` | 测试驱动修改 | 确认 routing candidates 只包含 active profile 投影结果 |
| `frontend/src/features/accounts/model/vendorPresets.ts` | 修改 | VendorPreset 增加 `multiModeProfiles`；Xiaomi 预设更新 |
| `frontend/src/features/accounts/model/openAICompatible.ts` | 修改 | Draft 增加 `activeMode` / `modeProfiles`；构建/归一化逻辑 |
| `frontend/src/features/accounts/hooks/useOpenAICompatibleState.ts` | 修改 | 保存时传递 mode profiles / active mode |
| `frontend/src/features/accounts/components/OpenAICompatibleDetailPanel.tsx` | 修改 | Xiaomi 双 profile UI + active mode toggle |
| `frontend/src/features/accounts/components/UnifiedComposeModal.tsx` | 修改 | 创建流程展示 Xiaomi 双模式配置 |
| `frontend/src/features/claude-code/model/claudeCodeAccountList.ts` | 修改 | 更新 Xiaomi 可切换模型 |

## Step 0：先补测试（红灯）

### Go 测试

1. `TestUpdateOpenAICompatibleProviderPersistsXiaomiModeProfiles`
   - 输入 Xiaomi draft：API profile + subscription profile + activeMode=`subscription`
   - 断言写入 `mode_profiles_json` 与 `active_mode`

2. `TestOpenAICompatibleProviderProjectsActiveModeProfile`
   - 给 credential 两个 profiles，activeMode=`subscription`
   - 断言返回给 runtime / routing 的 baseUrl/key 为 `tp` + token-plan baseUrl

3. `TestClaudeCodeRoutingProbeUsesActiveModeProfile`
   - 两套 profile 都存在
   - activeMode=`api` 时只生成 `sk` route id
   - activeMode=`subscription` 时只生成 `tp` route id

### 前端测试 / 类型检查目标

1. `buildOpenAICompatibleProviderDraft` 能回读 `modeProfiles`。
2. `normalizeXiaomiModeProfiles` 能补齐默认 baseUrl / formatBaseUrls。
3. `saveDetail` 传参包含 `activeMode` 和 `modeProfiles`。

## Step 1：Go DTO 扩展

```go
type OpenAICompatibleModeProfile struct {
    Mode           string            `json:"mode"`
    Label          string            `json:"label,omitempty"`
    APIKey         string            `json:"api_key"`
    BaseURL        string            `json:"base_url"`
    FormatBaseURLs map[string]string `json:"format_base_urls,omitempty"`
    Headers        map[string]string `json:"headers,omitempty"`
}

type OpenAICompatibleAccountCredential struct {
    // existing fields...
    ActiveMode       string `json:"active_mode,omitempty"`
    ModeProfilesJSON string `json:"mode_profiles_json,omitempty"`
}
```

> 注意：不建议给 `OpenAICompatibleAPIKeyEntry` 增加 mode 字段作为主模型。它可以作为投影后的运行态结构继续使用，但不适合作为管理态双模式配置源。

## Step 2：active profile 投影函数

新增纯函数：

```go
func projectOpenAICompatibleActiveModeProfile(provider cliproxyapi.OpenAICompatibleProvider) cliproxyapi.OpenAICompatibleProvider
```

规则：

1. 无 `ModeProfiles` 或无 `ActiveMode`：原样返回。
2. 有 `ActiveMode`：找到对应 profile。
3. 投影：
   - `BaseURL = profile.BaseURL`
   - `FormatBaseURLs = profile.FormatBaseURLs`
   - `Headers = profile.Headers`（如为空则继承 provider.Headers）
   - `APIKeyEntries = []OpenAICompatibleAPIKeyEntry{{APIKey: profile.APIKey, ProxyURL: 原首 key proxyURL}}`
4. 找不到 active profile：回退 `api` profile，再回退旧字段。

## Step 3：保存 / 回读

### 保存

`UpdateOpenAICompatibleProviderInput` 增加：

```go
ActiveMode   string                         `json:"activeMode,omitempty"`
ModeProfiles []OpenAICompatibleModeProfile  `json:"modeProfiles,omitempty"`
```

写入 `OpenAICompatibleAccountCredential.ActiveMode` 和 `ModeProfilesJSON`。

### 回读

`OpenAICompatibleProvider` Wails DTO 增加：

```go
ActiveMode   string                        `json:"activeMode,omitempty"`
ModeProfiles []OpenAICompatibleModeProfile `json:"modeProfiles,omitempty"`
```

## Step 4：路由 / usage attribution

路由层不直接理解 Xiaomi 模式语义，而是使用投影后的 provider。

需要检查：

- `loadClaudeCodeRoutingProbeCandidates`
- `captureCodexRoutingUsage`
- `listRelaySupportedModels`
- openai-compatible config apply 到 sidecar 的路径

验收要求：inactive profile 的 key 不应进入 route candidates。

## Step 5：前端 VendorPreset

新增：

```ts
multiModeProfiles?: Array<{
  mode: 'api' | 'subscription' | string;
  label: string;
  apiKeyPlaceholder: string;
  baseUrl: string;
  formatBaseUrls: Partial<Record<ApiFormat, string>>;
  notes?: string;
}>;
```

Xiaomi 填入：

- API profile：`sk` + `api.xiaomimimo.com`
- Subscription profile：`tp` + `token-plan-cn.xiaomimimo.com` 默认；用户可改成 `sgp/ams`

## Step 6：账号详情 UI

当 `selectedPreset.multiModeProfiles` 或 `draft.modeProfiles` 存在：

1. 展示两个 profile 卡片。
2. 每个卡片包含：
   - API Key / Token Plan Key
   - Base URL
   - Anthropic Base URL
   - OpenAI Base URL
3. 顶部展示 active mode toggle。
4. 当前 active card 高亮。
5. 保存前校验：active profile 必须 key + baseUrl 非空。

普通厂商继续显示当前单 key UI。

## Step 7：创建流程 UI

选择 Xiaomi 预设后：

- 初始生成两个 profile。
- activeMode 默认 `api`。
- 允许只填 active profile 后保存，但要保留另一个 profile 的空壳配置，方便后续补齐。

## Step 8：模型列表拉取策略

默认：

- 模型列表拉取优先使用 API profile（`sk` + `https://api.xiaomimimo.com/v1/models`）。
- 若用户当前 activeMode 是 subscription，仍可拉取订阅模式 endpoint，但 UI 提示：Token Plan 模型可用性以订阅页 / 官方文档为准。

## Step 9：验证

```bash
go test ./internal/...
cd frontend && npx tsc --noEmit
```

如果改动 Wails-facing DTO，还需要：

```bash
./scripts/wails-cli.sh build
```

或至少通过项目既有 Wails binding 生成/校验流程，确保 `frontend/wailsjs` 同步。
