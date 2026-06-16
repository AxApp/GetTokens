# 2026-06-15 运行时链路追踪

## 目的

这份文档只回答一个问题：

**当 Claude Code 请求进入 reference sidecar 时，它实际会沿着怎样的运行时链路走，在哪一步决定了它更可能落到 `chat/completions`，而不是 `responses` upstream。**

相比前面的文档，这份更偏“时序与决策点”，不是静态文件清单。

## 一、Claude 请求的运行时主链路

按当前 reference sidecar 代码，Claude 请求的标准主链路可以串成：

1. `POST /v1/messages`
2. `claudeCodeHandlers.ClaudeMessages`
3. `BaseAPIHandler.ExecuteWithAuthManager` 或 `ExecuteStreamWithAuthManager`
4. `getRequestDetailsWithOptions()` 解析模型并决定 provider 列表
5. `AuthManager.Execute` / `ExecuteStream`
6. `pickNextMixed()` 选中某个 auth + executor
7. executor 内部决定目标格式 `to`
8. `sdktranslator.TranslateRequest(from, to, ...)`
9. 发上游 HTTP 请求
10. 收到响应后再用 `TranslateNonStream` / `TranslateStream` 翻回 Claude

## 二、逐步证据

### Step 1：Ingress 固定是 `/v1/messages`

server 路由里：

1. [docs-linhay/references/CLIProxyAPI/internal/api/server.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/api/server.go:458)
   - `POST /v1/messages -> claudeCodeHandlers.ClaudeMessages`
2. 同时 `POST /v1/responses` 走的是另一个 handler：[server.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/api/server.go:460)

这说明 Claude 请求不会直接进入 Responses handler。

### Step 2：Claude handler 固定把自己声明为 `Claude`

1. [docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:49)
   - `HandlerType() string { return Claude }`
2. non-stream 调用：[code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:171)
3. stream 调用：[code_handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/claude/code_handlers.go:232)

也就是说，Claude handler 并不会在入口处把自己改写成 `openai-response` 或别的格式。

### Step 3：BaseAPIHandler 把 `handlerType` 直接塞进 `SourceFormat`

这是整条链里最关键的第一处决策点：

1. [docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:622)
   - non-stream `opts.SourceFormat = sdktranslator.FromString(handlerType)`
2. stream 同样如此：[handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:743)

因为 `handlerType=Claude`，所以：

- `SourceFormat = claude`

从这里开始，后面的 executor 若要支持 Claude 去 Responses upstream，就必须显式知道怎么处理：

- `from = claude`
- `to = openai-response`

### Step 4：provider 不是由 handler 决定，而是由 model registry 决定

`BaseAPIHandler` 先走模型到 provider 的解析：

1. [docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:948)
   - `getRequestDetailsWithOptions()`
2. 真正取 provider 列表的地方：[handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:984)
   - `providers = util.GetProviderName(baseModel)`
3. `util.GetProviderName()` 又直接从 registry 读取：[docs-linhay/references/CLIProxyAPI/internal/util/provider.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/util/provider.go:32)
4. registry 返回 provider 顺序的地方：[docs-linhay/references/CLIProxyAPI/internal/registry/model_registry.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/registry/model_registry.go:1038)
   - provider 按 count 降序返回：[model_registry.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/registry/model_registry.go:1075)

这意味着：

1. Claude handler 本身不决定“走 Claude upstream / OpenAI compat upstream / 其他 upstream”
2. 它只提供 `SourceFormat=claude`
3. 真正命中哪个 executor，要看这个 model 当前在 registry 里注册到了哪些 provider

### Step 5：AuthManager 按 provider 列表选 auth + executor 执行

第二个关键决策点在 conductor：

1. non-stream 入口：[docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1362)
   - `Manager.Execute()`
2. stream 入口：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1428)
   - `Manager.ExecuteStream()`
3. non-stream 真正单轮选取与执行：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1466)
4. 在单轮执行里：
   - `pickNextMixed(...)` 选出 `auth, executor, provider`：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1488)
   - 然后调用 `executor.Execute(...)`：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1545)

这一步说明：

1. `Claude /messages` 不直接等于 Claude provider
2. 只要 model registry 把模型映射到 openai-compatible provider，最终完全可能命中 `OpenAICompatExecutor`

### Step 6：真正决定 upstream path 的是 executor

如果最终命中的是 `OpenAICompatExecutor`，那第三个关键决策点就到了：

1. [docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:101)
   - 默认 `to := openai`
   - 默认 `endpoint := "/chat/completions"`
2. 只有 `opts.Alt == "responses/compact"` 时才会：
   - `to := openai-response`
   - `endpoint := "/responses/compact"`：[openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:104)

所以在 Claude 链路下，只要没有别的额外条件介入，命中 openai-compatible executor 时的默认结果就是：

- `from = claude`
- `to = openai`
- upstream path = `/chat/completions`

而不是：

- `to = openai-response`
- upstream path = `/responses`

## 三、translator 在这条链上的真实作用

第四个关键点，是 translator registry 的方向定义。

### 1. request translator 的查找方式

translator registry 的 request 查找规则是：

1. [docs-linhay/references/CLIProxyAPI/sdk/translator/registry.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/translator/registry.go:49)
   - `TranslateRequest(from, to, ...)`
   - 查的是 `requests[from][to]`

因此，如果 executor 想把 Claude 请求转去 OpenAI Responses，它必须存在：

- `requests[claude][openai-response]`

### 2. response translator 的查找方式

response translator 的查找规则和 request 不同：

1. stream：[registry.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/translator/registry.go:82)
   - 查的是 `responses[to][from]`
2. non-stream：[registry.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/translator/registry.go:95)
   - 同样查 `responses[to][from]`

这意味着如果 request 走了：

- `from = claude`
- `to = openai`

那么回包翻译会找：

- `responses[claude][openai]`

而现有的 `Claude -> OpenAI Chat` 注册正好提供了这一对。

### 3. 现有注册为什么足以支撑 `messages -> chat`

1. [docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go:9)
   - `translator.Register(Claude, OpenAI, ...)`

这一次注册同时提供了：

1. request 方向：`Claude -> OpenAI`
2. response 方向：`OpenAI -> Claude`

所以它天然可以支撑：

- `Claude ingress -> OpenAI Chat upstream -> Claude response`

### 4. 现有 Responses 注册为什么还不够

1. [docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go:9)
   - `translator.Register(OpenaiResponse, Claude, ...)`

这次注册支撑的是：

1. request：`OpenAI Responses -> Claude`
2. response：`Claude -> OpenAI Responses`

它适合的是：

- Responses 客户端进入，再翻去 Claude upstream

它**不能直接替代**：

- `Claude -> OpenAI Responses` request translator

因为 request 查找是 `requests[from][to]`，而当前缺的是：

- `requests[claude][openai-response]`

## 四、为什么当前更像 `messages -> chat`，而不是 `messages -> responses`

把上面几步连起来，今天的默认运行链更接近：

1. Claude 请求从 `/v1/messages` 进入
2. `SourceFormat` 被固定成 `claude`
3. model registry 决定 provider 可能是 `openai-compatibility`
4. conductor 选中 `OpenAICompatExecutor`
5. `OpenAICompatExecutor` 默认把 `to` 设为 `openai`
6. 因此 request translator 走的是 `Claude -> OpenAI`
7. upstream path 默认就是 `/chat/completions`
8. 回包时再用 `OpenAI -> Claude` translator 翻回 Claude

这条链是闭合的。

而要变成 `messages -> responses`，至少要同时满足：

1. executor 把 `to` 设成 `openai-response`
2. executor 把 upstream path 设成 `/responses`
3. translator registry 中存在 `Claude -> OpenAI Responses` request translator
4. 对应 stream / non-stream 回包也能稳定翻回 Claude

当前只从代码证据看，这 4 条并没有同时成立。

## 五、现有测试如何支撑这个判断

现有最能直接支撑这条链路判断的测试有两组。

### 1. Claude probe / 产品边界测试

1. [internal/wailsapp/claude_code_routing_probe_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe_test.go:13)
   - 明确要求探测请求是 `POST /v1/messages`
2. [claude_code_routing_probe_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/claude_code_routing_probe_test.go:105)
   - 明确要求非 `anthropic` 账号被过滤

### 2. OpenAICompatExecutor 路径测试

1. [docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go:109)
   - `TestOpenAICompatExecutorResponsesRequestUsesChatCompletionsUpstream`
2. [openai_compat_executor_compact_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go:272)
   - `TestOpenAICompatExecutorResponsesStreamUsesChatCompletionsUpstreamAndTranslatesSSE`

这组测试虽然是 `openai-response` source format，不是 `claude` source format，但它们清楚证明了：

- 当前 compat executor 的默认思路本来就偏 `responses client -> chat upstream`

所以如果还没有新增 `Claude -> openai-response` 的显式逻辑，就更不应假设 Claude 默认会掉到 `/responses` upstream。

## 六、结论

从这份运行时链路追踪看，当前阻止 Claude Code “自然支持 open-response upstream” 的，不是单一点缺失，而是整条链上的三个连续决策都还站在 `messages -> chat` 这一边：

1. ingress 与产品边界：Claude 仍是 `/v1/messages` + `anthropic`
2. executor 默认目标：OpenAI compat 默认 `to=openai`、path=`/chat/completions`
3. translator 注册现状：有 `Claude -> OpenAI`，没有同等级的 `Claude -> OpenAI Responses`

因此，当前最稳妥的工程判断依然是：

**Claude Code 现在不能被描述为“支持 open-response upstream”；更准确的说法仍然是“最多存在 `messages -> chat` 的 compat 主链路基础”。**
