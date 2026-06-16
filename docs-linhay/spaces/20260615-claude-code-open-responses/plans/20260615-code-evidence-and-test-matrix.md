# 2026-06-15 代码证据与测试覆盖矩阵

## 目的

把当前关于 Claude Code 与 open-response 的判断，从“结论描述”进一步压实到代码和测试层：

1. 当前仓库哪些实现已经明确限制了 Claude Code 只走 `anthropic`。
2. reference sidecar 哪些实现证明了 `Claude -> OpenAI Chat` 已有路径。
3. 哪些实现同时证明 `Claude -> OpenAI Responses` 还不是现成主链路。
4. 现有测试覆盖了什么，没有覆盖什么。

## 一、当前 GetTokens 仓库中的产品边界证据

### 1. Claude 渠道路由只接纳 `anthropic`

前端 Claude Code 账号列表的入口筛选非常直接：

1. [frontend/src/features/claude-code/model/claudeCodeAccountList.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/claude-code/model/claudeCodeAccountList.ts:243)
   - `isClaudeCodeRequestAccount()` 只判断 `supportedFormats.includes('anthropic')`
2. 同文件 summary 统计也只把 `anthropic` 计为 Claude 侧核心格式：[claudeCodeAccountList.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/claude-code/model/claudeCodeAccountList.ts:163)

这说明在当前产品面，Claude Code 账号列表不是“看到 openai_responses 就可用”，而是明确以 `anthropic` 为入口格式。

### 2. Claude probe 候选筛选只认 `anthropic`

Wails probe 这层同样把边界钉得很死：

1. [internal/wailsapp/claude_code_routing_probe.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe.go:82)
   - `loadClaudeCodeRoutingProbeCandidates()` 里直接过滤：
     - `!codexRoutingRecordRequestable(account)`
     - `!supportsAnthropicFormat(account.SupportedFormats)`
2. `supportsAnthropicFormat()` 只检查 `accountsdomain.APIFmtAnthropic`：[claude_code_routing_probe.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe.go:236)
3. 真正发探测请求时，固定打的是 `/v1/messages`：[claude_code_routing_probe.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe.go:204)

这层的意义很关键：即使某个账号同时支持 `openai_responses`，只要没有 `anthropic`，它就不会进入 Claude Code probe 候选池。

### 3. 测试也在强化这个边界

当前本仓测试已经把以上行为固定下来：

1. [internal/wailsapp/claude_code_routing_probe_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe_test.go:13)
   - `TestProbeClaudeCodeAccountRoutingSendsAnthropicMessagesRequestAndRouteHeaders`
   - 明确要求 relay 请求是 `POST /v1/messages`
2. [claude_code_routing_probe_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe_test.go:105)
   - `TestProbeClaudeCodeAccountRoutingFiltersNonAnthropicAccounts`
   - 明确要求非 `anthropic` 账号被过滤掉

结论：当前仓库里不仅实现如此，测试也把这个边界锁住了。

## 二、reference sidecar 中已存在的 Claude compat 主链路证据

### 1. Claude handler 的标准入口仍是 `/v1/messages`

reference sidecar 的 server 路由非常清楚：

1. [docs-linhay/references/CLIProxyAPI/internal/api/server.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/api/server.go:458)
   - `POST /v1/messages -> claudeCodeHandlers.ClaudeMessages`
2. 同一组里另外独立挂着：
   - `POST /v1/responses -> openaiResponsesHandlers.Responses`
   - `POST /v1/responses/compact -> openaiResponsesHandlers.Compact`

也就是说 Claude 与 Responses 在 ingress 层本来就是两条不同 handler，不是一个 handler 自动双栈。

### 2. Claude handler 运行时固定 `SourceFormat=claude`

Claude handler 最终执行到 auth manager 时：

1. [docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:171)
   - non-stream 走 `ExecuteWithAuthManager(..., h.HandlerType(), ...)`
2. [code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:232)
   - stream 走 `ExecuteStreamWithAuthManager(..., h.HandlerType(), ..., "")`
3. `HandlerType()` 返回 `Claude`：[code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:49)
4. `BaseAPIHandler` 会把这个 `handlerType` 直接转成 `SourceFormat`：[docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:622)
5. stream 路径也是一样：[handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:743)

所以当前运行时语义不是“Claude 客户端自己说 Responses”，而是“Claude ingress 进入后，再看有没有 translator / executor 能把 `claude` 转到目标上游格式”。

### 3. `Claude -> OpenAI Chat` 已有明确注册

reference sidecar 里，正向 Claude compat 的现成注册是这个：

1. [docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go:9)
   - `translator.Register(Claude, OpenAI, ...)`

这说明当前已经有一条明确的正向路径：

- `Claude -> OpenAI Chat`

而且请求侧覆盖还不少：

1. [docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request_test.go:11)
   - `TestConvertClaudeRequestToOpenAI_ThinkingToReasoningContent`
2. [openai_claude_request_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request_test.go:393)
   - `TestConvertClaudeRequestToOpenAI_ToolResultOrderAndContent`
3. [openai_claude_request_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request_test.go:649)
   - `TestConvertClaudeRequestToOpenAI_AssistantThinkingToolUseThinkingSplit`

这也是为什么当前最保守的判断不是“Claude 完全不能走第三方”，而是“更可能已经具备 `messages -> chat` compat 的技术基础”。

## 三、reference sidecar 中“不支持现成 Claude -> Responses 主链路”的证据

### 1. 现有 Responses 相关 translator 是反方向

仓库里能直接找到的 Responses 方向注册是：

1. [docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go:9)
   - `translator.Register(OpenaiResponse, Claude, ...)`

也就是：

- `OpenAI Responses -> Claude`

而不是：

- `Claude -> OpenAI Responses`

这个差异不能忽略。它意味着当前找到的 Responses translator 主要服务的是“Responses 客户端进入，再翻成 Claude”这条路径，不是我们现在研究的目标方向。

### 2. OpenAICompatExecutor 默认仍走 `/chat/completions`

OpenAI-compatible executor 的默认行为也很关键：

1. [docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:101)
   - 默认 `to := openai`
   - 默认 `endpoint := "/chat/completions"`
2. 只有 `opts.Alt == "responses/compact"` 时才切到：
   - `to := openai-response`
   - `endpoint := "/responses/compact"`：[openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:104)

stream 路径虽然这里没展开全文，但现有测试已经证明它也是按 chat upstream 在跑，而不是普通 `/responses` upstream。

### 3. 现有 executor 测试明确证明 Responses client 默认打到 chat upstream

现在最直接的证据来自测试名本身：

1. [docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go:109)
   - `TestOpenAICompatExecutorResponsesRequestUsesChatCompletionsUpstream`
   - 断言上游 path 是 `/v1/chat/completions`
2. [openai_compat_executor_compact_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go:272)
   - `TestOpenAICompatExecutorResponsesStreamUsesChatCompletionsUpstreamAndTranslatesSSE`
   - stream 也断言 path 是 `/v1/chat/completions`

这组测试说明：即使 source format 是 `openai-response`，当前 compat executor 的主思路仍是“Responses client -> chat upstream”，而不是“Responses client -> responses upstream”。

把这个事实代入 Claude 场景后，就更没有理由假设当前已经存在 `Claude -> Responses upstream` 的现成主链路。

## 四、一个容易混淆但必须拆开的边界

### local CLI draft 能生成 Claude 配置，不等于 runtime 已支持 open-response

当前前端本地配置草稿能力里，确实存在一个很容易让人误解的事实：

1. [frontend/src/features/accounts/model/accountLocalCliMapping.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountLocalCliMapping.ts:229)
   - `openai_responses` 会生成 `codex` target
2. [accountLocalCliMapping.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountLocalCliMapping.ts:232)
   - `anthropic` 会生成 `claude` target
3. 但 `resolveSourceFormat()` 对 `claude` target 的要求仍然是：
   - 只能返回 `anthropic`
   - 不会把 `openai_responses` 直接当成 Claude 的 source format：[accountLocalCliMapping.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountLocalCliMapping.ts:494)

对应测试也把这个边界写死了：

1. [frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs:69)
   - `custom compatible accounts generate Codex and Claude actions from openai_responses and anthropic`
2. 同一测试明确断言：
   - `codex.sourceFormat === 'openai_responses'`
   - `claude.sourceFormat === 'anthropic'`：[accountLocalCliMapping.test.mjs](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs:92)

这说明当前产品中已经存在一种“同一个账号可以为 Codex 生成 Responses 草稿，也可以为 Claude 生成 Anthropic 草稿”的双 target 体验。

但这件事表达的是：

1. 同一个账号可能同时暴露多种 format
2. 不同 CLI target 会各自选自己的 source format

它**不能直接推出**：

1. Claude Code runtime 现在已经支持 `openai_responses`
2. Claude probe / relay / runtime 已经会把 `messages` 自动打到 `/responses`

## 五、现有测试覆盖与缺口盘点

## 已覆盖

### A. 当前产品边界

1. Claude probe 只打 `/v1/messages`
2. Claude probe 只认 `anthropic`
3. local CLI 映射里 Claude target 只取 `anthropic`

### B. reference compat 现状

1. `Claude -> OpenAI Chat` request translator 已有多组请求侧细节测试
2. `OpenAI Responses -> Claude` request/response translator 已有至少基础覆盖
3. `OpenAICompatExecutor` 已有“Responses source format -> chat upstream”的 non-stream / stream 测试

## 未覆盖或证据不足

### A. `Claude -> OpenAI Responses` 正向 translator

当前没有找到：

1. 明确注册 `translator.Register(Claude, OpenaiResponse, ...)`
2. 对应 request transformer tests
3. 对应 response transformer tests

### B. Claude ingress 命中 `/responses` upstream 的 executor 测试

当前没有找到：

1. `SourceFormat=claude` 时，OpenAICompatExecutor 命中 `/responses` 的 non-stream 测试
2. 同场景的 stream 测试
3. tool call / tool_result round trip 测试

### C. 产品层开放 compat 后的 Wails / UI 测试

当前没有找到：

1. Claude probe 允许 Responses compat 候选的测试
2. Claude 账号列表展示 compat 能力标记的测试
3. evidence 明确标记 `messages ingress + responses upstream` 的测试

## 结论

基于当前这份代码证据矩阵，最稳妥的结论仍然是：

1. **当前 GetTokens 产品边界下，Claude Code 正式支持面仍是 `anthropic` / `/v1/messages`。**
2. **reference sidecar 已明确存在 `Claude -> OpenAI Chat` compat 技术基础。**
3. **但没有足够证据表明当前已经存在 `Claude -> OpenAI Responses upstream` 的现成主链路。**
4. **因此“Claude Code 支持 open-response”在今天仍不能当作已交付能力来描述。**
