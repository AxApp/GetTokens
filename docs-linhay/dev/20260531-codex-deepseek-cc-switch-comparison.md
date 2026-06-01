# Codex DeepSeek: cc-switch 与 GetTokens/CLIProxyAPI 差异对比

日期：2026-05-31

## 背景

用户要求将 `https://github.com/farion1231/cc-switch` 作为本地参考项目拉取，源码不进入 git，并对比它最近实现的 Codex 对 DeepSeek 支持与 GetTokens/CLIProxyAPI 当前实现的差异。

本次整仓 `git clone` 与 tarball 下载受网络影响未完成，已改用 GitHub API 按需拉取关键源码与文档到 `docs-linhay/references/cc-switch/`。该目录当前被 `.gitignore` 规则 `docs-linhay/references/*/` 忽略，不进入 git。

CLIProxyAPI 本地参考仓库路径：

`/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI`

## cc-switch 的实现方式

cc-switch 的核心判断是：新版 Codex CLI 对下游说的是 OpenAI Responses API，而 DeepSeek、Kimi、MiniMax、SiliconFlow 等上游通常是 OpenAI Chat Completions API。直接把 DeepSeek Chat endpoint 写给 Codex 会导致 `/responses` 404/400、模型列表不匹配或流式事件解析失败。

cc-switch 的闭环是：

1. Codex live config 指向本地路由：`http://127.0.0.1:15721/v1`。
2. Codex 仍保持 `wire_api = "responses"`。
3. Provider preset 标记真实上游格式为 `apiFormat: "openai_chat"`。
4. 本地路由收到 `/responses` 或 `/v1/responses` 后，转成 `/chat/completions` 请求 DeepSeek。
5. 上游 Chat JSON/SSE 返回后，再转回 Codex 可理解的 Responses JSON/SSE。

关键参考：

- `docs-linhay/references/cc-switch/docs/guides/codex-deepseek-routing-guide-zh.md`
- `docs-linhay/references/cc-switch/src/config/codexProviderPresets.ts`
- `docs-linhay/references/cc-switch/src-tauri/src/proxy/providers/codex.rs`
- `docs-linhay/references/cc-switch/src-tauri/src/proxy/providers/transform_codex_chat.rs`
- `docs-linhay/references/cc-switch/src-tauri/src/proxy/providers/streaming_codex_chat.rs`
- `docs-linhay/references/cc-switch/src-tauri/src/proxy/forwarder.rs`

## cc-switch 的 DeepSeek preset

DeepSeek 被作为 Codex provider preset 直接支持：

- `name: "DeepSeek"`
- `base_url: "https://api.deepseek.com"`
- 默认模型：`deepseek-v4-flash`
- `apiFormat: "openai_chat"`
- 模型目录：`deepseek-v4-flash`、`deepseek-v4-pro`
- `contextWindow: 1000000`
- reasoning 配置：
  - `thinkingParam: "thinking"`
  - `effortParam: "reasoning_effort"`
  - `effortValueMode: "deepseek"`
  - `outputFormat: "reasoning_content"`

这说明 cc-switch 不是只把 DeepSeek 当成通用 OpenAI-compatible provider，而是把它作为 Codex 可选 provider，并在本地路由层承担协议转换。

## cc-switch 的路由转换点

`src-tauri/src/proxy/providers/codex.rs` 里有两个关键判断：

- `codex_provider_uses_chat_completions(provider)`：从 `meta.api_format`、`settings_config.api_format`、Codex TOML `wire_api` 或 base URL 推断真实上游是否是 Chat Completions。
- `should_convert_codex_responses_to_chat(provider, endpoint)`：只在 endpoint 是 `/responses`、`/v1/responses`、`/responses/compact`、`/v1/responses/compact` 且 provider 是 Chat Completions 时触发转换。

`forwarder.rs` 中在触发转换后会：

- 把 effective endpoint 切到 `/chat/completions`。
- 调用 `responses_to_chat_completions_with_reasoning` 转请求体。
- 对普通响应和 SSE 流响应做 Chat -> Responses 反向转换。
- 按 provider reasoning config 注入 DeepSeek 所需的 thinking/reasoning 参数。

## GetTokens/CLIProxyAPI 当前实现

当前 CLIProxyAPI 已经具备两类相关能力，但还没有把它们接成 Codex -> DeepSeek 的闭环。

已有能力：

1. `codex-api-key` 账号：
   - 支持自定义 `base-url`、headers、models alias。
   - `CodexExecutor` 会走 Codex/OpenAI Responses 形态，上游 URL 固定拼 `baseURL + "/responses"`。
   - 这适合真实支持 Responses API 的 Codex/OpenAI 兼容上游。

2. `openai-compatibility` provider：
   - 支持 base URL、多个 API key、models alias、thinking 配置。
   - `OpenAICompatExecutor` 默认走 `/chat/completions`。
   - 这适合 DeepSeek 这类 Chat Completions 供应商。

3. translator 已有 Responses 与 Chat 的结构转换基础：
   - `internal/translator/openai/openai/responses/init.go` 注册了 `OpenaiResponse -> OpenAI` 请求转换，以及 Chat -> Responses 的响应转换。

4. Codex model catalog 已有 sidecar 风格入口：
   - `/v1/models?client_version` 可返回 Codex client catalog。
   - custom models 可来自 registry，并有 fallback。

缺口：

- Codex runtime hot path 目前没有根据选中的账号/provider 判断真实上游协议。
- `CodexExecutor` 仍固定请求 `/responses`，不会在 DeepSeek/openai-compatible 上游场景下切到 `/chat/completions`。
- `openai-compatibility` 可以让 DeepSeek 被普通 OpenAI Chat 客户端使用，但还没有作为 Codex channel 的候选执行器完成 Responses <-> Chat 桥接。
- 当前 GetTokens 账号模板治理里曾把 DeepSeek 归为 Claude Code-only 官方模板，不展示 Codex 动作；这与 cc-switch 的新方向不同，需要重新评估。

关键参考：

- `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/config.example.yaml`
- `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_executor.go`
- `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go`
- `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/openai/responses/init.go`
- `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/api/server.go`

## 核心差异

| 维度 | cc-switch | GetTokens/CLIProxyAPI |
| --- | --- | --- |
| 产品形态 | 桌面工具接管本地 Codex config，并内置本地路由 | sidecar 运行态路由、账号池、channel routing |
| Codex 下游协议 | 始终对 Codex 暴露 Responses API | 对 Codex 暴露 Responses API |
| DeepSeek 上游协议 | 标记为 `openai_chat`，本地转换为 Chat Completions | 可作为 `openai-compatibility` 走 Chat Completions |
| Codex -> DeepSeek 闭环 | 已闭环：preset、catalog、路由、请求/响应/SSE 转换、reasoning 映射 | 尚未闭环：Codex 与 openai-compatible 执行路径分离 |
| 模型目录 | 写 `~/.codex/model_catalog_json` | 倾向通过 sidecar `/v1/models?client_version` 动态返回 |
| 密钥暴露 | Codex live config 指向本地路由，真实 DeepSeek key 保存在 cc-switch provider | GetTokens 应保持 relay/channel 资产边界，不直接把 DeepSeek key 写成 Codex 官方 key |
| 路由选择 | 当前启用 provider + 本地路由接管 | channel routing、账号顺序、balanced/sequential、guard/cooldown/live sessions |

## 可借鉴点

1. 能力边界值得借鉴：Codex 下游保持 Responses，DeepSeek 上游走 Chat，sidecar 中间做协议桥接。
2. Provider metadata 要显式标记 Codex upstream protocol，例如 `responses | openai_chat`，不要靠 base URL 猜测作为主路径。
3. DeepSeek reasoning 需要独立映射：`thinking`、`reasoning_effort`、`reasoning_content` 不能只依赖通用 OpenAI-compatible thinking 字段。
4. `/responses/compact` 也要纳入兼容边界，至少明确支持或显式拒绝。
5. SSE 转换必须作为一等能力测试，不能只做非流式 JSON 转换。CLIProxyAPI 已有 `OpenaiResponse -> OpenAI` translator 与 OpenAI-compatible executor 转回 source format 的基础，后续重点是把这条路径接入 Codex channel 选中 openai-compatible 账号后的热路径，而不是重写转换器。
6. Codex model catalog 应继续走 GetTokens 已有 `/models?client_version` 机制，而不是照搬 cc-switch 写本地 `model_catalog_json`。
7. Codex channel 下发给前端的模型候选也必须包含 DeepSeek/openai-compatible 的可路由模型或 alias。否则用户无法在 Codex 账号列表、模型映射、路由探测或本地应用流程里选择这些模型，也就无法触发按模型分流。

## 不建议照搬点

1. 不建议照搬“改写用户本地 Codex config 为当前 provider”的模型。GetTokens 的运行态真实来源是 sidecar channel routing，不是单个桌面 provider 选择。
2. 不建议把 DeepSeek key 直接写入 Codex API key mode。GetTokens 应保持 relay endpoint + channel/account config 的边界。
3. 不建议靠 TOML `wire_api` 或 base URL 猜测作为长期主路径。它们可以作为兼容输入，但 GetTokens 主路径应使用账号/provider 的结构化能力标记。
4. 不建议为兼容 cc-switch 而保留上游旧合约。按当前项目规则，CLIProxyAPI fork 需要在 GetTokens sidecar 边界内重新设计和补窄测试。

## 建议的 GetTokens 落地方向

1. 在 sidecar account/channel config 中为 Codex 候选增加 upstream protocol 标记：
   - `codex_upstream_format: "responses" | "openai_chat"`
   - 或在 openai-compatible provider 被纳入 Codex channel 时显式保存该能力。

2. Codex 对下游继续只暴露：
   - `/v1/responses`
   - `/v1/responses/compact`
   - `/v1/models?client_version`

   同时，Codex route config / frontend model options 需要合并 openai-compatible 账号声明的模型与 alias，例如 DeepSeek 的 `deepseek-v4-flash`、`deepseek-v4-pro` 或 GetTokens 侧配置的 Codex-facing alias。模型下发是路由触发入口的一部分，不只是 Codex CLI 的 `/model` catalog。

3. route engine 选中 DeepSeek/openai-compatible 账号时：
   - 请求侧：Responses -> Chat Completions。
   - 上游 endpoint：`/chat/completions`。
   - 响应侧：Chat JSON/SSE -> Responses JSON/SSE。
   - usage、live-session、request log 仍归因到选中的 openai-compatible 账号。

4. 优先复用现有 translator 与 OpenAI-compatible executor 路径：
   - `OpenaiResponse -> OpenAI`
   - `OpenAI -> OpenaiResponse`
   - `OpenAICompatExecutor` 对 `/chat/completions` 的非流式与 SSE 响应已经会调用 `TranslateNonStream` / `TranslateStream` 转回 source format

   因此后续主要补齐 Codex route result 到 openai-compatible executor 的接线、DeepSeek reasoning 参数、SSE 事件完整性、tool call 顺序、compact 行为和错误映射测试。

5. 前端账号模板策略需要调整：
   - DeepSeek 可以从 “Claude Code-only” 改为 “Codex via sidecar route experimental/verified”。
   - 不应展示“把 DeepSeek 直接写入 Codex API key”的动作。
   - 应展示“通过 GetTokens relay/channel routing 应用于本地 Codex”的动作。

## 最小验收建议

如果后续实现该能力，建议先补测试再实现：

1. route explain：DeepSeek openai-compatible 账号可作为 Codex channel 候选，并显示 `openai_chat` upstream。
2. 前端模型候选：Codex 账号列表、模型映射、路由探测和本地应用确认流能选择 DeepSeek/openai-compatible 下发的 Codex-facing alias。
3. client model catalog：`/v1/models?client_version` 出现 DeepSeek alias，且不依赖写 `~/.codex/model_catalog_json`。
4. 请求接线：Codex `/v1/responses` 请求按模型分流选中 DeepSeek/openai-compatible 后，进入 OpenAI-compatible `/chat/completions` 执行路径。
5. 流式转换：DeepSeek Chat SSE 通过现有 translator 转换为 Codex Responses SSE，Codex CLI 可正常消费。
6. reasoning 映射：`reasoning.effort` 能正确映射到 DeepSeek 所需字段。
7. 密钥边界：真实 DeepSeek key 不写入 Codex `auth.json` 或 provider TOML，只由 sidecar 注入上游请求。
8. 失败语义：DeepSeek 404/401/429/5xx 进入现有 guard/cooldown/live-session 归因链路。

## 结论

cc-switch 已经实现了 Codex 使用 DeepSeek 的完整本地闭环；GetTokens/CLIProxyAPI 目前具备多数基础积木，尤其是 Responses <-> Chat/SSE translator 与 OpenAI-compatible executor 已存在。缺口主要在“Codex route model 下发 + 按模型分流选中 openai-compatible 账号 + 执行器接线 + DeepSeek reasoning 特化”这一层集成。

GetTokens 应吸收 cc-switch 的协议桥接思路，但落点应放在 sidecar routing 和账号池/channel routing 内，而不是照搬本地 Codex config 接管模型。

## 2026-06-01 实施记录

本轮按用户校准后的 alias 语义落地第一阶段闭环：

1. GetTokens 前端 / Wails：
   - DeepSeek openai-compatible 官方 preset 默认模型改为 `deepseek-v4-flash`、`deepseek-v4-pro`，不再自动写 `codex-deepseek-*` alias。
   - Codex-facing 模型选项统一使用 `alias || name`。
   - 用户主动配置 alias 时，模型下拉和 route probe 只显示 alias，不再同时显示真实上游模型名。
   - `CodexAccountListFeature` 的 route probe 模型候选合并 relay catalog，不再只依赖账号行已有 mappings。
   - Browser preview/mock DeepSeek provider 也同步为 v4 真实模型名无 alias，避免预览界面误导为默认仍会生成 `codex-deepseek-*`。

2. CLIProxyAPI fork：
   - `/v0/management/model-definitions/codex` 的静态 Codex channel 模型加入 DeepSeek v4 openai-compatible 模型。
   - OpenAI-compatible provider 未显式配置 `models`，但 provider name 或 base URL 可识别为 DeepSeek 时，运行态自动注册 `deepseek-v4-flash`、`deepseek-v4-pro`。
   - `IsOpenAICompatibilityAlias` / `GetOpenAICompatibilityConfig` 改为按 `alias || name` 匹配；alias 存在时真实 `name` 不再作为 client-facing 命中。
   - 新增 OpenAI-compatible executor 测试，证明 Codex Responses 格式请求命中该 executor 后，上游走 `/chat/completions`，响应转回 Responses 格式。
   - 新增 DeepSeek thinking applier：DeepSeek provider/baseURL 下，`reasoning.effort=xhigh|max` 映射为上游 `thinking.type=enabled` + `reasoning_effort=max`，其他启用档映射为 `high`；显式 `none` 映射为 `thinking.type=disabled` 且不发送 `reasoning_effort`。
   - 新增 executor SSE 热路径测试：DeepSeek/openai-compatible 的 Codex Responses stream 请求上游走 Chat Completions SSE，并通过既有 translator 输出 Responses SSE 事件。
   - 新增 Codex client catalog handler 测试：已注册的 DeepSeek openai-compatible 模型会出现在 `/v1/models?client_version=...` 返回的 Codex `models[].slug` 中，且 `prefer_websockets=false`。

3. 已验证：
   - `go test ./internal/wailsapp -run 'TestListRelaySupportedModels|TestProbeCodexAccountRouting'`
   - `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs src/features/accounts/tests/openAICompatible.test.mjs`
   - `npm --prefix frontend run test:unit -- src/features/accounts/tests/previewData.test.mjs src/features/codex/codexAccountList.test.mjs src/features/accounts/tests/openAICompatible.test.mjs`
   - `npm --prefix frontend run typecheck`
   - CLIProxyAPI: `go test ./internal/registry ./internal/util ./internal/runtime/executor ./sdk/cliproxy ./sdk/api/handlers/openai -run 'TestCodexStaticModelsIncludeDeepSeekV4OpenAICompatibleModels|TestOpenAICompatibilityAlias|TestOpenAICompatExecutor(ResponsesRequestUsesChatCompletionsUpstream|DeepSeekResponsesReasoningUsesDeepSeekChatOptions|DeepSeekResponsesReasoningNoneDisablesThinking|ResponsesStreamUsesChatCompletionsUpstreamAndTranslatesSSE)|TestRegisterModelsForAuth_OpenAICompatibilityDeepSeekDefaults|TestOpenAIModelsReturnsDeepSeekOpenAICompatibleCodexCatalogEntry|TestOpenAIModelsReturnsCodexCatalogForClientVersionRequests'`
   - CLIProxyAPI: `go test ./internal/translator/openai/openai/responses`
   - CLIProxyAPI: `go test ./internal/thinking/...`
   - CLIProxyAPI 上下游 mock smoke：`go test ./sdk/api/handlers/openai -run 'TestCodexDeepSeekOpenAICompatibleResponses(HTTPDownstreamChatUpstream|StreamDownstreamChatSSEUpstream)Smoke'`

4. 当前收口状态：
   - 本轮已覆盖用户校准的自动模型下发、alias 展示、route probe 模型候选、Codex client catalog 下发、Responses -> Chat 非流式接线、DeepSeek reasoning 特化和 Chat SSE -> Responses SSE executor 热路径。
   - 已补 handler 级上下游 mock smoke：下游从 `/v1/responses` 进入，auth manager 选中 `openai-compatibility` DeepSeek auth，上游 mock 必须收到 `/v1/chat/completions`，并验证非流式 JSON 与 SSE 都转回 Responses 形态。
   - 已补真实 DeepSeek API dev 冒烟：从正式环境 SQLite 中读取 DeepSeek API key 到临时 dev config 的 `openai-compatibility` provider，临时 `CODEX_HOME` 只写 relay 指向和本地 client key，不碰真实 `~/.codex`。本次只输出脱敏状态，不打印 key/token。
   - 真实 catalog 验证：`GET /v1/models?client_version=0.133.0` 返回 1 个 DeepSeek model，`slug=deepseek-v4-flash`，`prefer_websockets=false`。
   - 真实非流式验证：`POST /v1/responses`，模型 `deepseek-v4-flash`，`reasoning.effort=none`，返回 `status=200`、`object=response`、有 response id，usage 为 `input_tokens=9`、`output_tokens=1`、`total_tokens=10`。
   - 真实 SSE 验证：`stream=true` 返回 `status=200`，事件包含 `response.output_text.delta` 与 `response.completed`，共 9 类 Responses SSE 事件。
   - 真实 Codex CLI 进程验证：使用 `codex-cli 0.133.0`、临时 `CODEX_HOME`、临时 CLIProxyAPI dev sidecar 和正式 DeepSeek key 的临时复制配置运行 `codex -a never exec --model deepseek-v4-flash "Reply with exactly: ok"`；`/v1/models?client_version=0.133.0` 返回 `deepseek-v4-flash`，Codex CLI exit code 为 `0`，最后消息为 `ok`，sidecar 日志确认收到 1 次 `/responses` 请求。
   - 收尾：临时 dev sidecar 已停止，包含复制 key 的 `/tmp/gettokens-deepseek-real-smoke.*` 与 `/tmp/gettokens-codex-cli-deepseek-smoke.*` 临时目录已删除。
