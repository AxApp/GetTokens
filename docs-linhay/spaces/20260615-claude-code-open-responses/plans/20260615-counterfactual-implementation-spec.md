# 2026-06-15 反事实实现规格

## 目的

这份文档不再回答“现在支不支持”，而是假设后续真的决定实现：

**Claude `/v1/messages` -> openai-compatible `/responses` upstream**

在这个前提下，把实现范围压缩成最小、最清晰、最不容易误改的开发规格。

重点回答四件事：

1. 哪些函数必须改。
2. 哪些函数最好先不要动。
3. 哪些现有逻辑可以复用。
4. 首批 failing tests 应该怎么排。

## 一、最小成立条件

要让这条能力成立，至少需要同时满足四个条件：

1. Claude ingress 仍然是 `/v1/messages`
2. executor 能在 `SourceFormat=claude` 时显式切到：
   - `to = openai-response`
   - upstream path = `/responses`
3. translator registry 中存在：
   - `Claude -> OpenAI Responses` request translator
4. 响应回到 Claude 时，non-stream / stream / tool / usage 都能稳定翻回去

如果只做其中一半，会得到一个“偶尔返回文本、但 agent/tool/stream 不稳”的假支持。

## 二、必须改的函数边界

## A. OpenAICompatExecutor

这是必改组，而且优先级最高。

### 必改函数

1. [docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:85)
   - `func (e *OpenAICompatExecutor) Execute(...)`
2. [openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:290)
   - `func (e *OpenAICompatExecutor) ExecuteStream(...)`

### 当前问题

1. non-stream 默认：
   - `to := openai`
   - `endpoint := "/chat/completions"`：[openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:101)
2. stream 默认：
   - `to := openai`
   - URL 固定 `"/chat/completions"`：[openai_compat_executor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go:306)
3. `responses/compact` 是单独旁路，不适合直接拿来冒充 Claude compat responses

### 推荐改法

新增一个单一决策 helper，统一决定：

```go
func resolveOpenAICompatTargetFormat(
  from sdktranslator.Format,
  opts cliproxyexecutor.Options,
  auth *cliproxyauth.Auth,
) (to sdktranslator.Format, endpoint string, mode string)
```

建议输出：

1. `to`
   - `openai`
   - `openai-response`
2. `endpoint`
   - `/chat/completions`
   - `/responses`
   - `/responses/compact`
3. `mode`
   - `default-chat`
   - `responses-compact`
   - `claude-responses-compat`

### 这么拆的原因

1. non-stream 与 stream 现在各自内嵌了一份目标决策，容易改漏。
2. 后续测试可以直接锚定这个 helper 的输出，而不是每次都从大函数里猜。

## B. Claude -> OpenAI Responses translator 注册与实现

这是第二组必须改动。

### 必改位置

当前缺的是一个正向注册对：

1. 新增 `translator.Register(Claude, OpenaiResponse, ...)`

当前已存在但不能替代的是：

1. [docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/init.go:9)
   - `Claude -> OpenAI`
2. [docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/translator/claude/openai/responses/init.go:9)
   - `OpenaiResponse -> Claude`

### 推荐目录策略

不要把新实现硬塞进现有反向目录，建议新建一个方向明确的目录，例如：

1. `internal/translator/openai-responses/claude/`
2. 或 `internal/translator/openai/claude/responses/`

关键不是名字多优雅，而是让以后的人一眼能看出它是：

- `Claude -> OpenAI Responses`

### request transformer 最小覆盖

首版至少要覆盖：

1. `model`
2. `system` -> `instructions`
3. `messages` -> `input`
4. `thinking` -> `reasoning`
5. `tools`
6. `tool_result`

### response transformer 最小覆盖

首版至少要覆盖：

1. non-stream 基本文本回复
2. stream 事件序列
3. usage
4. finish reason
5. tool call / tool_result 闭环

## C. handler metadata 注入

这里不是一定要大改，但建议补一个明确的 metadata 开关。

### 当前可利用事实

1. `BaseAPIHandler` 已经会构建 `opts.Metadata`：[docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:608)
2. stream 路径同样会带 metadata：[handlers.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/api/handlers/handlers.go:729)
3. conductor 与 executor 已经大量消费 `opts.Metadata`，说明这个机制本来就是正式路径，不是 hack

### 推荐改法

不要滥用 `alt` 去表达“Claude compat responses”。

更好的做法是在 Claude handler 进入 `ExecuteWithAuthManager` / `ExecuteStreamWithAuthManager` 前，通过 metadata 注入一个显式标记，例如：

```go
coreexecutor.TargetProtocolMetadataKey = "openai_responses"
```

或更语义化一些：

```go
coreexecutor.UpstreamProtocolMetadataKey = "responses"
coreexecutor.ProtocolCompatModeMetadataKey = "claude_messages_to_openai_responses"
```

### 原因

1. `alt` 现在已经承载 `responses/compact` 的既有语义
2. 如果继续往 `alt` 里堆 compat 模式，后续很难区分：
   - 客户端 path 语义
   - upstream 协议语义

## 三、最好先不要动的地方

## A. BaseAPIHandler 的 provider 解析流程

`getRequestDetailsWithOptions()` 当前职责很清楚：

1. 解析 model
2. 交给 registry 决定 provider 列表

这层当前没有证据表明必须为 Claude responses compat 重写。

### 原因

1. 它已经把 `SourceFormat` 和 `provider` 分离开了
2. 现在的问题不在“Claude handler 选不到 openai-compatible provider”
3. 而在“选到了之后 executor 仍默认走 chat”

所以这一层更适合保持不动，避免把研究问题扩大成路由系统重构。

## B. AuthManager conductor 主选择逻辑

conductor 现在的职责是：

1. 选 auth
2. 选 executor
3. 跑重试、失败转移、cooldown、session route 记录

当前没有证据要求为了 Claude responses compat 去大改：

1. `Execute()`：[docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1362)
2. `ExecuteStream()`：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:1428)

更合理的方式是：

1. 保持 conductor 不变
2. 让 executor 根据 `opts.SourceFormat + opts.Metadata` 决定 target protocol

## C. Wails / UI / probe

这些地方不应进入第一批技术 spike。

### 原因

1. runtime 主链路没跑通前，先改 UI 只会制造假闭环
2. 现在的产品边界测试还在明确锁住 `anthropic`
3. 先让 runtime 成立，再决定是否开放候选池，风险最小

## 四、可以直接复用的现有逻辑

## A. Claude -> OpenAI Chat request translator 的局部映射经验

现有这些测试已经证明 request 侧有不少复杂边界处理，可作为 Responses 版设计锚点：

1. `ThinkingToReasoningContent`
2. `ToolResultOrderAndContent`
3. `AssistantThinkingToolUseThinkingSplit`

这不代表代码可直接复用，但说明：

1. thinking
2. tool result adjacency
3. assistant block 排序

这些难点已经在 chat 版踩过坑，Responses 版不该从零猜。

## B. OpenAI Responses -> Claude 的 response 事件组织经验

现有 `OpenaiResponse -> Claude` 注册虽然方向相反，但它说明 Responses 事件到 Claude block 的组织已经有人实现过一部分。

可复用的不是整段代码，而是事件语义与字段口径。

## C. executor 的 usage / request logging / stream 外壳

`OpenAICompatExecutor` 里这些壳层逻辑大概率不需要重写：

1. request logging
2. proxy-aware HTTP client
3. usage reporter
4. stream scanner / chunk channel 外壳

应该变的是：

1. 目标协议决策
2. request translation
3. response translation
4. endpoint path

## 五、首批 failing tests 排序

## Phase 1：先证明链路存在

### 1. translator request

1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`
2. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`
3. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`

### 2. executor endpoint choice

1. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`
2. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

这 5 条是第一批最值得先写红灯的测试。

原因很简单：

1. 如果连 request translation 和 endpoint choice 都不成立，后面谈 UI 没意义。

## Phase 2：再证明 agent 闭环

1. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`
2. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`
3. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

## Phase 3：最后再开放产品面

1. `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates`
2. `TestProbeClaudeCodeAccountRoutingEvidenceMarksResponsesUpstream`
3. `TestClaudeChannelRoutingSupportsResponsesCompatWhenEnabled`
4. `claudeCodeAccountList.test.mjs` compat candidate / capability 标记 case

## 六、推荐的实现顺序

1. **先做 translator + executor helper**
2. **再做 executor non-stream / stream 正向 `/responses` path**
3. **再做 tool / usage / error 细节**
4. **最后才做 Wails / probe / UI**

## 七、最小可交付 spike 的完成定义

如果只是做 research spike，而不是产品化交付，我建议把 DoD 设得很窄：

1. 存在 `Claude -> OpenAI Responses` request translator
2. `OpenAICompatExecutor` 在指定 metadata 条件下能打 `/responses`
3. 至少一条 non-stream 测试和一条 stream 测试通过
4. 不改 Wails probe / UI / 文案

只有这 4 条都成立，才值得进入下一轮产品化研究。
