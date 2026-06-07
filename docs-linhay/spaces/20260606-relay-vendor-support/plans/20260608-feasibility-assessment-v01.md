# Relay 厂商多端接入可行性评估 v01

日期：2026-06-08
状态：feasible / runtime-work-required

## 评估结论

可行，而且不是推倒重来。GetTokens 主仓和 CLIProxyAPI fork 已经具备多端接入的大部分基础字段与保存链路，真正缺口集中在 runtime 侧：

1. 主仓 DTO、Wails 输入、账号详情页、创建流和 account-store 已经有 `formatBaseUrls`。
2. account-store SQLite 已有 `format_base_urls_json`，并且有旧 schema 补列测试和往返测试。
3. 本地 CLI apply 已有按目标选择 `openai_responses / anthropic / openai_chat` 的模型函数。
4. Channel Routing 已有候选过滤和 filtered reason 结构，补精确 format 过滤是局部修改。
5. 主要缺口是 CLIProxyAPI synthesizer 只把主 `base_url` 写入 runtime auth attributes，executor 也仍主要读取 `auth.Attributes["base_url"]`。

因此整体判断：

```text
可行性：高
实现风险：中
推荐路线：runtime-first，小步补窄测试
不推荐路线：先加 sub2api/new-api 预设后再补 runtime
```

## 已具备的基础

### 1. 主仓账号 DTO 已有字段

主仓 root DTO 和账号领域模型已经包含：

- `AccountRecord.supportedFormats`
- `AccountRecord.formatBaseUrls`
- `CreateCodexAPIKeyInput.formatBaseUrls`
- `UpdateCodexAPIKeyConfigInput.formatBaseUrls`
- `CreateOpenAICompatibleProviderInput.formatBaseUrls`
- `UpdateOpenAICompatibleProviderInput.formatBaseUrls`

这说明产品层无需新增账号主类型，也不需要新增一套完全不同的账号 DTO。

### 2. Wails 保存链路已经部分到位

当前看到的主仓链路：

- `internal/wailsapp/accounts.go` 能保存 Codex API key 的 `FormatBaseURLsJSON`。
- `internal/wailsapp/openai_compatible.go` 能保存 OpenAI-compatible provider 的 `FormatBaseURLsJSON`。
- `normalizeFormatBaseURLs` 已会过滤空 key / 空 value。
- 前端详情页 draft、变更检测、保存 payload 已包含 `formatBaseUrls`。

这部分适合继续沿用，不需要重写账号详情页。

### 3. account-store 已支持持久化

CLIProxyAPI fork 的 `internal/gettokens/accountstore` 已经具备：

- `codex_api_key_accounts.format_base_urls_json`
- `openai_compatible_accounts.format_base_urls_json`
- `EnsureSchema` 自动补 `openai_compatible_accounts.format_base_urls_json`
- 创建、读取、导入往返 `FormatBaseURLsJSON`
- 旧 schema 补列测试与 import round-trip 测试

这说明“数据存不住”的风险很低，首期不需要大改 SQLite 模型。

### 4. local CLI apply 已具备正确方向

`frontend/src/features/accounts/model/accountLocalCliMapping.ts` 已经按目标选择 format：

- Claude 目标优先 `anthropic`
- Codex 目标优先 `openai_responses`
- 其次才考虑 `openai_chat`

因此本地 CLI 草稿不是主要阻塞点。后续只需要让 `supportedFormats` 的来源更准确，并补 relay preset 用例。

### 5. Channel Routing 结构可承载精确过滤

`internal/wailsapp/channel_routing.go` 已有：

- `buildChannelRouteablePool`
- `accountSupportsChannel`
- `ChannelRoutingFilteredAccount`
- filtered reason 输出

当前问题不是没有 explain 结构，而是 Codex channel 对 `codex-api-key / openai-compatible` 账号过宽放行。这个可通过修改 `accountSupportsChannel` 和测试完成。

## 主要缺口

### 缺口 1：`supportedFormats` 仍主要按 provider 推断

`internal/accounts/account_records.go` 的 `resolveDefaultFormats(provider)` 仍按 provider 名返回能力集合。OpenAI-compatible 账号即使保存了 `formatBaseUrls`，`SupportedFormats` 也可能继续由 provider 默认值决定。

影响：

- 用户清空某一端 endpoint 后，UI / route 仍可能认为该端可用。
- `sub2api/new-api` 如果 provider 名没有加入默认表，可能被错误认为只支持 `anthropic`。
- 后续 route explain 会建立在不准的能力集合上。

建议：

- 首期新增 `resolveSupportedFormats(provider, formatBaseURLs)`。
- 若 `formatBaseURLs` 有非空 key，则以这些 key 为显式能力。
- 只有 `formatBaseURLs` 为空时，才回退 `resolveDefaultFormats(provider)`。
- 暂缓新增独立 `supported_formats_json`。

### 缺口 2：synthesizer 未投影 per-format endpoint

`synthesizeAccountStoreOpenAICompat` 当前只写：

```text
attrs["base_url"] = base
```

但没有把 `compat.FormatBaseURLsJSON` 投影到 runtime auth attributes。

影响：

- UI / Wails / account-store 保存三端后，runtime auth 仍只看到一个主 `base_url`。
- executor 无法区分 Chat / Responses / Anthropic 应使用哪个 endpoint。

建议：

- decode `FormatBaseURLsJSON`。
- 保留 `base_url` 作为旧回退。
- 新增 attributes：

```text
format_base_url:openai_chat
format_base_url:openai_responses
format_base_url:anthropic
```

Codex API key synthesis 也应同样投影自己的 `FormatBaseURLsJSON`，避免只解决 openai-compatible。

### 缺口 3：executor 仍读取单一 `base_url`

当前三个关键 executor 的取值集中在小函数：

- OpenAI-compatible：`resolveCredentials`
- Codex：`codexCreds`
- Claude：`claudeCreds`

它们都主要读取 `auth.Attributes["base_url"]`。

影响：

- 即使 synthesizer 投影了 per-format endpoint，不改 executor 也不会生效。

建议：

- 在 executor 包里增加小 helper，例如：

```text
authFormatBaseURL(auth, format, fallbackBaseURL)
```

- OpenAI-compatible executor 读取 `openai_chat`。
- Codex executor 读取 `openai_responses`。
- Claude executor 读取 `anthropic`。
- 缺少目标 format 时是否允许 fallback 由上游 route 过滤决定；executor 只保留旧 `base_url` 兼容回退。

### 缺口 4：Codex Channel Routing 过宽

当前 `accountSupportsChannel` 对 Codex channel 逻辑包含：

```text
codex-api-key -> true
openai-compatible -> true
provider == codex -> true
supportedFormats 包含 codex/openai_responses/openai_chat -> true
```

影响：

- 只支持 `openai_chat` 的 openai-compatible 账号可能进入 Codex 候选。
- explain 无法准确告诉用户“缺少 openai_responses”。

建议：

- Codex channel 首期要求 `openai_responses` 或历史 `codex`。
- 不把 `openai_chat` 作为 Codex 默认支持证据。
- filtered reason 从通用 `channel-unsupported` 细化为：

```text
missing_format:openai_responses
missing_format:anthropic
```

### 缺口 5：缺少 endpoint matrix 回归

当前测试覆盖了保存和局部布局，但还缺一条能证明 runtime 真实请求走不同 URL 的测试。

建议新增 mock matrix：

- Chat server
- Responses server
- Anthropic server

验证同一账号三端 URL 不同情况下：

- Chat 请求命中 Chat server。
- Codex / Responses 请求命中 Responses server。
- Claude 请求命中 Anthropic server。

这条测试比“预设出现”或“保存 payload 包含 formatBaseUrls”更能证明需求完成。

## 工作量评估

### 低成本项

1. 新增 `sub2api/new-api` preset。
2. 创建流默认写入三端 `formatBaseUrls`。
3. 账号详情页继续显示和保存三端 endpoint。
4. local CLI apply 补 relay preset 测试。
5. route explain 增加更明确的 filtered reason。

### 中等成本项

1. `resolveSupportedFormats(provider, formatBaseURLs)` 统一能力派生。
2. synthesizer 投影 per-format runtime attributes。
3. 三个 executor 读取目标 format endpoint。
4. endpoint matrix 测试搭建。
5. Codex Channel Routing 从宽放行改为 `openai_responses` 精确过滤。

### 高风险项

1. 新增独立 `supported_formats_json` 并做全链路 UI 编辑。
   - 会扩大 SQLite schema、Wails DTO、前端表单、复制导入和 migration 范围。
   - 首期不建议。

2. 真实联调所有 `sub2api/new-api` 版本。
   - 版本差异和部署差异会拖慢首期。
   - 建议先完成 GetTokens 自身 endpoint matrix，再做真实兼容性补强。

3. 把 Gemini `/v1beta` 纳入同一需求。
   - 会把三端矩阵扩成四端协议矩阵。
   - 建议另开需求。

## 推荐实施切片

### Slice 1：能力派生与 route explain

目标：让账号“支持哪些端”先变准。

改动：

- `internal/accounts/account_records.go`
- `internal/wailsapp/channel_routing.go`
- 对应 Go tests

验收：

- 非空 `formatBaseUrls` keys 会成为 `SupportedFormats`。
- 清空 `anthropic` 后 Claude channel 过滤为 `missing_format:anthropic`。
- 只有 `openai_chat` 的账号不进入 Codex channel。

### Slice 2：runtime projection

目标：让 runtime auth 携带三端 endpoint。

改动：

- `docs-linhay/references/CLIProxyAPI/internal/watcher/synthesizer/config.go`
- synthesizer tests

验收：

- account-store 中的 `format_base_urls_json` 被投影到 `format_base_url:<format>` attributes。
- `base_url` 仍保留旧回退。

### Slice 3：executor endpoint selection

目标：让真实请求使用正确 endpoint。

改动：

- `openai_compat_executor.go`
- `codex_executor.go`
- `claude_executor.go`
- executor tests

验收：

- OpenAI-compatible 使用 `format_base_url:openai_chat`。
- Codex / Responses 使用 `format_base_url:openai_responses`。
- Claude 使用 `format_base_url:anthropic`。

### Slice 4：relay preset 与创建入口

目标：产品入口交付。

改动：

- `frontend/src/features/accounts/model/vendorPresets.ts`
- 统一创建流测试
- 旧 OpenAI-compatible provider 入口同源化

验收：

- `Sub2API` / `New API` 出现在统一厂商入口。
- 默认三端 endpoint 符合需求。
- 从旧入口进入时字段一致。

### Slice 5：端点预览与管理口补强

目标：降低用户配置和排障成本。

改动：

- 账号详情页 endpoint preview
- `/models` / quota / billing 的聚焦测试补齐

验收：

- 详情页能展示每类请求实际使用的 endpoint。
- 管理接口不误用 `anthropic` 或 `openai_responses`。

## 预计风险与缓解

1. 风险：Codex channel 改严格后，历史只配置 `openai_chat` 的账号不再进入 Codex。
   - 缓解：如果用户确实要让同一 `/v1` 支持 Codex，写入 `openai_responses` 同 URL。
   - route explain 给出 `missing_format:openai_responses`。

2. 风险：旧账号没有 `formatBaseUrls`，能力回退仍不够准确。
   - 缓解：旧账号继续用 provider 默认能力；只有用户编辑后才按显式 endpoint keys 收窄。

3. 风险：executor fallback 到 `base_url` 掩盖配置缺失。
   - 缓解：route 阶段做严格过滤；executor fallback 只作为旧数据兼容，不作为新能力判定。

4. 风险：真实 relay 部署路径差异。
   - 缓解：默认值只给自部署本地语义，详情页允许编辑每端 endpoint，真实联调不作为首期阻塞。

## 最终判断

这项需求可以做，且建议做。原因是它补的是 GetTokens 已经开始承载、但 runtime 尚未打通的账号多端能力。若只新增 `sub2api/new-api` 预设，会形成短期假完成；若按 runtime-first 切片推进，可以把 GetTokens 的通用账号能力补完整，并顺带让后续其他 relay provider 复用同一条链路。

推荐下一步直接进入 Slice 1，先用测试锁住 `formatBaseUrls` 派生能力与 Channel Routing 精确过滤。
