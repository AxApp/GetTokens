# api-key-detail-vs-provider-verify

**日期**：20260427
**模式**：对抗型
**参与者**：Kepler（A 侧）/ Raman（B 侧）
**总轮次**：1 / 60
**结束原因**：主持人基于代码证据裁定

## 执行元数据
- 候选参与者：Kepler、Raman、Arendt
- 首轮实际启用：Kepler、Raman
- 后续 active participants：Kepler、Raman
- 淘汰参与者：Arendt
- 不可用原因：首轮返回了旧议题内容，未按本轮代码上下文回答，视为上下文污染

## 辩论背景
> 争议点不是“GetTokens 要不要正式验证”，而是“正式验证是否应该整理进 `ApiKeyDetailModal` 的 footer/详情链路”。用户随后要求引入 `cc-switch` 作为本地参考项目，再评判它是否支持这种归属。

## 各轮观点记录

### 第 1 轮
**[Kepler - A 侧]**
- 论点：当前 GetTokens 已把单 key 详情和正式验证拆成不同职责 → 引用： [frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8 )、[frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:351]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:351 )、[frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:126]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:126 ) → 代码事实：`ApiKeyDetailModal` 只有重命名、优先级、复制配置；`OpenAICompatibleWorkspace` 才持有 `verifyStates`、`onVerifyModelChange`、`onVerify` → 结论：把正式验证塞回 `ApiKeyDetailModal` 是改写职责边界。
- 论点：GetTokens 后端验证桥接面对的是 provider 配置对象 → 引用：[internal/wailsapp/openai_compatible.go:13]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:13 )、[internal/wailsapp/openai_compatible.go:117]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:117 ) → 代码事实：验证输入是 `BaseURL / APIKey / Model / Headers`，返回消息也是“provider 验证成功/失败” → 结论：正式验证入口和后端对象模型应继续对齐在 provider 工作区。
- 论点：cc-switch 参考也没有把正式验证挂到单 key 详情 → 引用：[docs-linhay/references/cc-switch/src/components/providers/ProviderActions.tsx:286]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/components/providers/ProviderActions.tsx:286 )、[docs-linhay/references/cc-switch/src/hooks/useStreamCheck.ts:16]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/hooks/useStreamCheck.ts:16 )、[docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13 ) → 代码事实：按钮、前端 hook、后端命令全部围绕 `provider` / `providerId` 建模 → 结论：cc-switch 不支持把“正式验证”解释成单 API key 详情职责。

**[Raman - B 侧]**
- 论点：GetTokens 当前代码已经把 API key 详情与 provider 验证分开，但这不等于正式验证只能停留在独立 workspace 页面 → 引用：[frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8 )、[frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:82]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:82 ) → 代码事实：`ApiKeyDetailModal` 是 `AccountRecord`；`OpenAICompatibleWorkspace` 是 `providers.map` 卡片 → 结论：正式验证可以下沉到 provider 卡片级动作，但不是 API key detail。
- 论点：GetTokens 现有验证桥接语义是 provider 配置是否可工作，不是 account 详情 → 引用：[internal/wailsapp/openai_compatible.go:13]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:13 )、[internal/wailsapp/openai_compatible.go:31]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:31 )、[internal/wailsapp/openai_compatible.go:117]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:117 ) → 代码事实：provider 列表结构含 `KeyCount`，前端暴露的 `APIKey` 只是 provider 中首个 key 的投影，验证函数则完全按 provider 配置发请求 → 结论：不要把技术上可复用的输入字段误解成详情职责归属。
- 论点：cc-switch 支持的是 provider 卡片级正式能力，而非单 key detail → 引用：[docs-linhay/references/cc-switch/src/components/providers/ProviderCard.tsx:455]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/components/providers/ProviderCard.tsx:455 )、[docs-linhay/references/cc-switch/src/types.ts:110]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/types.ts:110 )、[docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13 ) → 代码事实：`onTest(provider)`、`ProviderMeta.testConfig`、`stream_check_provider(provider_id)` 一致贯通 → 结论：若要借鉴 cc-switch，应借鉴 provider card / provider meta / provider command 这套架构，而不是借它为 `ApiKeyDetailModal` 背书。

## 主持人裁定

### 确认的代码事实
| # | 事实 | 来源 |
|---|------|------|
| 1 | `ApiKeyDetailModal` 当前只有重命名、优先级、配置复制，没有验证契约、验证输入、验证状态或验证按钮 | [frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:8 )、[frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:351]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:351 ) |
| 2 | GetTokens 当前正式验证入口已经在 `openai-compatible` provider 卡片上 | [frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:82]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:82 )、[frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:126]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/OpenAICompatibleWorkspace.tsx:126 ) |
| 3 | GetTokens 后端验证桥接以 provider 配置对象为输入，且返回文案就是“provider 验证成功/失败” | [internal/wailsapp/openai_compatible.go:31]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:31 )、[internal/wailsapp/openai_compatible.go:117]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/openai_compatible.go:117 ) |
| 4 | cc-switch 的测试入口在 `ProviderActions` / `ProviderCard`，不是单 key 详情 | [docs-linhay/references/cc-switch/src/components/providers/ProviderActions.tsx:286]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/components/providers/ProviderActions.tsx:286 )、[docs-linhay/references/cc-switch/src/components/providers/ProviderCard.tsx:455]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/components/providers/ProviderCard.tsx:455 ) |
| 5 | cc-switch 的测试执行链也是 `providerId -> stream_check_provider(provider_id)`，并支持 `ProviderMeta.testConfig` | [docs-linhay/references/cc-switch/src/hooks/useStreamCheck.ts:16]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/hooks/useStreamCheck.ts:16 )、[docs-linhay/references/cc-switch/src/types.ts:110]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src/types.ts:110 )、[docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13]( /Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/cc-switch/src-tauri/src/commands/stream_check.rs:13 ) |

### 裁定结论
- `cc-switch` 不能为“把正式验证整理进 ApiKeyDetailModal footer/详情链路”提供支持。
- `cc-switch` 能支持的最强结论只有：正式验证可以是 `provider card / provider detail` 的正式能力，而不一定非要是单独 workspace 页面。
- 但这和 `ApiKeyDetailModal` 不是一回事。`ApiKeyDetailModal` 当前是 `AccountRecord` / 单 key 详情对象；`cc-switch` 的测试对象始终是 `provider` / `providerId` / `ProviderMeta.testConfig`。

### 最终判断
1. 如果问题是“要不要把正式验证放进 `ApiKeyDetailModal`？”答案是 **不要**。
2. 如果问题是“正式验证是不是只能停留在独立 workspace 页面？”答案是 **也不是**。
3. 更准确的产品边界应是：正式验证属于 `provider`，可以落在 `provider workspace`、`provider card` 或未来的 `provider detail panel`，但不属于单 API key 详情。

### 行动项
| # | 行动 | 负责方 | 截止 |
|---|------|--------|------|
| 1 | 在需求文档中把“正式验证归属”改成更硬的表述：`provider` 级，不进入 `ApiKeyDetailModal` | Codex | 本轮 |
| 2 | 后续若补正式详情面板，优先做 `provider detail / edit panel + testConfig`，而不是 `API key detail verify` | Codex / Gemini | 后续实现 |

### 未解问题
- GetTokens 第二阶段是否要像 cc-switch 一样引入 `provider.testConfig` 持久化层，而不是继续依赖列表卡片上的临时 `model` 输入。
