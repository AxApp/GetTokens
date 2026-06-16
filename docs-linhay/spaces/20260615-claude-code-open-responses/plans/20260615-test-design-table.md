# 2026-06-15 测试设计表

## 目的

把前面已经沉淀出的“首批 failing tests”进一步落成可直接编码的测试设计表。

这份文档回答的是：

1. 每条测试应该放在哪个文件附近。
2. 输入 payload 大致长什么样。
3. upstream mock 应该返回什么。
4. 关键断言锚点是什么。

目标不是替代最终测试代码，而是把测试设计从“测试名”推进到“基本可以直接开写”。

## 一、测试分层

建议仍按三层拆：

1. translator request / response
2. executor upstream path / stream / tool / error
3. Wails / product-facing candidate / evidence

其中第一批 red tests 只做前两层，不做 Wails / UI。

## 二、translator 测试设计

## 1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`

### 建议位置

1. 新文件：
   - `docs-linhay/references/CLIProxyAPI/internal/translator/<new-dir>/claude_openai-responses_request_test.go`

### 目的

证明最基本的 Claude Messages 请求能被转成 OpenAI Responses request，而不是继续落到 chat-completions 形状。

### 输入 payload

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 128,
  "system": "You are helpful.",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "hello" }
      ]
    }
  ]
}
```

### 关键断言

1. 顶层仍有 `model`
2. `system` 被映射到 `instructions`
3. 请求主体使用 `input`
4. `input` 中存在 `message` / `role=user`
5. 不再生成 chat 风格的 `messages`

### 失败信号

如果结果里仍然是 `messages` 而没有 `input`，说明仍走的是 chat 逻辑，不是 responses 逻辑。

## 2. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`

### 目的

证明 Claude assistant thinking 不会丢失，并且被放进 Responses 可消费的 reasoning 结构。

### 输入 payload

```json
{
  "model": "claude-sonnet-4-6",
  "messages": [
    {
      "role": "assistant",
      "content": [
        { "type": "thinking", "thinking": "internal plan" },
        { "type": "text", "text": "visible answer" }
      ]
    }
  ]
}
```

### 关键断言

1. 结果中存在 reasoning 相关结构
2. `"internal plan"` 没丢
3. `"visible answer"` 仍保留为可见内容
4. thinking 和 visible text 不应无序拼成一个纯字符串

### 可复用锚点

1. 参考现有 chat 版 thinking 测试：
   - `TestConvertClaudeRequestToOpenAI_ThinkingToReasoningContent`

## 3. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`

### 目的

证明 Claude `tool_use -> tool_result` 的顺序与关联关系在 Responses request 中还能闭环。

### 输入 payload

```json
{
  "model": "claude-sonnet-4-6",
  "tools": [
    {
      "name": "lookup_weather",
      "description": "Lookup weather",
      "input_schema": {
        "type": "object",
        "properties": {
          "city": { "type": "string" }
        },
        "required": ["city"]
      }
    }
  ],
  "messages": [
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_1",
          "name": "lookup_weather",
          "input": { "city": "Shanghai" }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_1",
          "content": "Sunny"
        }
      ]
    }
  ]
}
```

### 关键断言

1. tools 被映射到 Responses tools 结构
2. tool invocation 与 tool result 的 id 关联仍存在
3. 顺序没有错位
4. tool result 没有退化成普通用户文本

### 可复用锚点

1. chat 版现有测试：
   - `TestConvertClaudeRequestToOpenAI_ToolResultOrderAndContent`
   - `TestConvertClaudeRequestToOpenAI_ToolResultObjectContent`

## 三、executor 测试设计

## 4. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`

### 建议位置

1. `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor_compact_test.go`
2. 或新建更语义化的 `openai_compat_executor_claude_responses_test.go`

### 目的

证明当 `SourceFormat=claude` 且 metadata/compat 模式要求 Responses upstream 时，executor 会真正打 `/v1/responses`。

### 输入 request

1. `req.Model = "deepseek-v4-flash"`
2. `req.Payload` 为 Claude `/messages` 风格 JSON
3. `opts.SourceFormat = sdktranslator.FromString("claude")`
4. `opts.Metadata` 带上约定的 compat 标记

### upstream mock

mock server 返回一个最小 non-stream Responses payload，例如：

```json
{
  "id": "resp_123",
  "object": "response",
  "status": "completed",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        { "type": "output_text", "text": "ok" }
      ]
    }
  ],
  "usage": {
    "input_tokens": 1,
    "output_tokens": 1,
    "total_tokens": 2
  }
}
```

### 关键断言

1. 上游 path 是 `/v1/responses`
2. 上游 body 有 `input`
3. 上游 body 没有 chat 风格 `messages`
4. 返回给调用方的 payload 已经翻回 Claude 非流式格式

### 对照现有测试

1. 当前已有反方向基线：
   - `TestOpenAICompatExecutorResponsesRequestUsesChatCompletionsUpstream`

## 5. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

### 目的

证明 stream 模式也会打 `/v1/responses`，而不是 `/chat/completions`。

### 输入 request

与上一条类似，但：

1. payload 中 `stream=true`
2. 调用 `ExecuteStream`

### upstream mock

使用最小 Responses SSE 事件序列，例如：

```text
data: {"type":"response.output_text.delta","delta":"ok"}

data: {"type":"response.completed","response":{"id":"resp_123","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}

data: [DONE]
```

### 关键断言

1. path 是 `/v1/responses`
2. translator 收到的是 Responses 事件，不是 chat completion chunk
3. 输出给 Claude 的流里存在 Claude 侧收尾事件
4. usage 最终能落回 Claude 语义

## 6. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`

### 目的

证明 executor 在 `Claude -> Responses upstream -> Claude` 这条链上，tool call 闭环不会断。

### 输入 request

沿用前面的 tool_use / tool_result 输入。

### upstream mock

返回最小 Responses tool call 结果序列，至少包括：

1. function/tool call item
2. assistant 最终 message item

### 关键断言

1. Claude stream / non-stream 输出里仍能恢复 tool_use / tool_result 关系
2. 不会把 tool 调用误翻成普通文本

## 7. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

### 目的

证明 `/responses` upstream 返回错误时，Claude 侧拿到的仍是可消费的错误语义。

### upstream mock

返回：

1. HTTP 400 with JSON error body
2. HTTP 429 with JSON error body

### 关键断言

1. executor 不会吞掉 status code
2. Claude handler 最终仍能写出 Claude 风格错误 envelope
3. 不会把 Responses error 原样裸透成错误格式漂移

## 四、response translator 测试设计

## 8. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`

### 目的

证明 Responses stream 的 usage 与 completed / finish 语义能正确落回 Claude。

### 输入事件

最小事件序列：

1. `response.output_text.delta`
2. `response.completed` with usage

### 关键断言

1. Claude 输出中有最终 stop/completed 语义
2. usage 没丢
3. 不会重复发 completed

## 五、Wails / 产品层测试设计

这些不是第一批要写，但可以先占坑。

## 9. `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates`

### 前提

仅在产品决定开放 compat 候选后再写。

### 输入账号

建议用两个账号：

1. 仅 `anthropic`
2. `anthropic + openai_responses`

如果产品以后允许纯 `openai_responses` 候选，再单独加第三类账号，不要一开始混在同一条测试里。

### 关键断言

1. compat 模式开关关闭时，行为保持现状
2. compat 模式开关打开时，带 Responses 能力的候选能被保留

## 10. `TestProbeClaudeCodeAccountRoutingEvidenceMarksResponsesUpstream`

### 目的

证明 probe 结果里的 evidence / message 能告诉用户这是：

- `messages ingress + responses upstream compat`

而不是误写成原生 Anthropics 直连。

### 关键断言

1. `attempt.Evidence` 或 message 中出现 responses upstream 标记
2. account/provider 识别仍正确

## 六、推荐测试落地顺序

### 第一轮

1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`
2. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`
3. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`
4. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

### 第二轮

1. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`
2. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`
3. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`
4. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

### 第三轮

1. Wails probe / evidence tests
2. 前端 candidate / capability 标记 tests

## 七、结论

到这一步，这个 research space 已经不只是“知道现在不支持”，而是已经具备了后续 implementation spike 的最小测试设计底稿：

1. 先写哪几条红灯
2. 每条红灯的 payload 和断言长什么样
3. 哪些现有测试可以当作对照组
