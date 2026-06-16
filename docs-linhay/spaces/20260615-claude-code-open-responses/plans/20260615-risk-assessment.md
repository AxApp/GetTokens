# 2026-06-15 实现风险评估

## 目的

在已经明确“当前不支持 Claude Code 对接 open-response 作为正式能力”的前提下，继续回答另一个关键问题：

如果后续决定实现，这条能力最容易在哪些地方出问题，优先级应该怎么排。

本文按风险面拆分为：

1. translator
2. stream 事件
3. tool call / tool_result
4. usage / token 统计
5. error mapping
6. Wails 候选筛选与 probe 证据
7. UI / 产品口径收口

并为每一类给出：

- 当前证据
- 风险等级
- 失败后影响面
- 建议优先级

## 风险总览

| 风险面 | 等级 | 原因摘要 | 建议优先级 |
| --- | --- | --- | --- |
| `Claude -> OpenAI Responses` translator 缺失 | P0 | 当前没有正向注册与主链路消费证据 | 第一批 |
| streaming event 兼容 | P0 | Claude Messages SSE 与 Responses SSE 事件模型差异大 | 第一批 |
| tool call / tool_result 闭环 | P0 | 现有 Claude -> OpenAI Chat 已有大量排序与结构处理，Responses 再做一层会更脆 | 第一批 |
| executor `/responses` path | P0 | OpenAI-compatible executor 当前默认只打 `/chat/completions` | 第一批 |
| usage / token 统计 | P1 | 有现成 usage helper，但 Responses / Claude 字段口径不同 | 第二批 |
| error mapping | P1 | 失败面广，但通常可在主链路可跑后补齐 | 第二批 |
| Wails 候选筛选 / probe | P1 | 依赖产品决策，且建立在 runtime 主链路成立之后 | 第二批 |
| UI / 文案收口 | P2 | 风险较低，但必须在功能成型后补，不然对外口径会继续错 | 第三批 |

## 1. Translator 风险

### 当前证据

1. 已有 `internal/translator/openai/claude/`
   - 方向：`Claude -> OpenAI Chat`
   - 请求侧已有大量细粒度测试：
     - `TestConvertClaudeRequestToOpenAI_ThinkingToReasoningContent`
     - `TestConvertClaudeRequestToOpenAI_ToolResultOrderAndContent`
     - `TestConvertClaudeRequestToOpenAI_AssistantThinkingToolUseThinkingSplit`
2. 已有 `internal/translator/claude/openai/responses/`
   - 方向：`OpenAI Responses -> Claude`
   - 不是当前需求的正向路径
3. 当前未找到：
   - `Claude -> OpenAI Responses` 注册点
   - 对应 request/response transformer

### 风险判断

- **等级：P0**
- 这是最根部的缺口。没有正向 translator，后面 executor 就算能打 `/responses`，也没有稳定的 payload 语义保证。

### 主要风险点

1. Claude `messages/system/thinking/tools` 到 Responses `input/instructions/tools/reasoning` 的映射不是简单字段替换。
2. 已有反向 `OpenAI Responses -> Claude` 不能证明正向一定可逆。
3. 现有 Claude -> OpenAI Chat 的很多逻辑是围绕 Chat Completions 结构写的，不能直接假设能复用到 Responses。

## 2. Streaming 事件风险

### 当前证据

1. `openai_compat_executor_compact_test.go` 里已有：
   - `TestOpenAICompatExecutorResponsesStreamUsesChatCompletionsUpstreamAndTranslatesSSE`
   - 证明 `openai-response` 源格式目前是“Responses client -> chat upstream -> 再翻回 Responses events”
2. `claude_openai-responses_response_test.go` 里已有：
   - `TestConvertClaudeResponseToOpenAIResponses_ThinkingIncludesSignature`
   - 说明 Claude 流式 thinking/signature 转 Responses event 时，事件组织已经不简单

### 风险判断

- **等级：P0**
- Claude Messages SSE 与 Responses SSE 的事件模型差异很大，是最容易“看起来能跑、细节全错”的地方。

### 主要风险点

1. Claude 的 `message_start / content_block_* / message_stop` 要翻成 Responses 的多种 `response.*` event。
2. thinking/signature 要不要落进 `reasoning` item、`encrypted_content`、summary，都要保持一致。
3. 当前现有 stream 测试更多覆盖 `openai-response -> chat upstream`，不是 `claude -> responses upstream`。

## 3. Tool Call / Tool Result 风险

### 当前证据

1. `openai_claude_request_test.go` 已覆盖大量 tool 相关细节：
   - `TestConvertClaudeRequestToOpenAI_ToolResultOrderAndContent`
   - `TestConvertClaudeRequestToOpenAI_ToolResultObjectContent`
   - `TestConvertClaudeRequestToOpenAI_AssistantTextToolUseTextOrder`
2. 这说明即使只做 Claude -> OpenAI Chat，tool call 顺序和 message adjacency 就已经是高复杂度点。

### 风险判断

- **等级：P0**
- 如果改成 Claude -> OpenAI Responses，上层会再多一层 `function_call / function_call_output / response.output item` 语义，出错概率极高。

### 主要风险点

1. assistant tool_use 与后续 tool_result 的顺序要求非常严格。
2. Responses 可能把 tool 调用拆成 item 序列，不再只是 Chat 的 `tool_calls`。
3. 如果这里错，通常不是“内容差一点”，而是 agent 直接失效。

## 4. Executor `/responses` Path 风险

### 当前证据

1. `OpenAICompatExecutor.Execute()`：
   - 默认 `to=openai`
   - 默认 `/chat/completions`
   - 只有 `responses/compact` 才切到 `openai-response`
2. `OpenAICompatExecutor.ExecuteStream()`：
   - 默认仍是 `/chat/completions`
   - 没有普通 `/responses` 分支

### 风险判断

- **等级：P0**
- 这是 runtime 主路径缺口，不补它就谈不上“支持 responses upstream”。

### 主要风险点

1. 需要同时改 non-stream 和 stream path。
2. 不能破坏现有 `openai-response -> chat upstream` 兼容能力。
3. `alt`、`metadata`、`sourceFormat` 如何一起驱动 path 选择，设计不清会把逻辑弄乱。

## 5. Usage / Token 统计风险

### 当前证据

1. 现有 translator / executor 已有 usage 合并逻辑。
2. `claude_openai_response_test.go` 已有 cached token usage merge 相关测试。
3. `claude_openai-responses_response_test.go` 目前更关注 thinking/signature，不足以证明 usage 口径完整。

### 风险判断

- **等级：P1**
- 不是首个阻塞点，但如果 usage 不对，后续 recent requests、面板统计、配额解释都会变脏。

### 主要风险点

1. Claude usage 字段与 Responses usage 字段结构不同。
2. stream 末尾 usage 是否完整，需要单独验证。
3. 如果 upstream 是 Responses，不一定还能沿用 chat completion 那套 usage 归因假设。

## 6. Error Mapping 风险

### 当前证据

1. 现有 executors 大多通过 statusErr / upstream body 透传错误。
2. 但当前没找到专门覆盖 “Claude -> Responses upstream” 的错误映射测试。

### 风险判断

- **等级：P1**
- 风险真实存在，但通常在主链路打通后更容易补。

### 主要风险点

1. upstream `/responses` 的错误 body 未必和 `/chat/completions` 一样。
2. Claude 客户端期待的错误形状与 OpenAI 异常形状不同。
3. 如果错误映射不收口，Wails probe 和用户实际 CLI 报错会不一致。

## 7. Wails 候选筛选 / Probe 风险

### 当前证据

1. `claude_code_routing_probe_test.go` 证明：
   - probe 只打 `/v1/messages`
   - 只筛 `anthropic`
2. 前端 `claudeCodeAccountList.ts` / workbench 也明确只收 `anthropic`

### 风险判断

- **等级：P1**
- 它依赖 runtime 主路径和产品决策，但一旦不改，会导致“底层可用、产品界面完全看不见”。

### 主要风险点

1. 是否允许仅 `openai_responses` 账号进入 Claude 候选池，本身就是产品决策。
2. probe 仍然打 `/v1/messages` 没问题，但 evidence 需要显示 upstream protocol，否则用户误以为还是 Anthropic 直连。

## 8. UI / 产品口径风险

### 当前证据

1. Claude workbench 文案明确说“只收 anthropic”
2. 现有 preview data 和测试也都站在这个假设上

### 风险判断

- **等级：P2**
- 技术上不是最难，但如果不改，会继续误导用户和后续开发者。

### 主要风险点

1. 容易把 compat 能力误说成原生能力。
2. 文案与真实路由脱节时，排障会变得非常难。

## 推荐的实现优先级

### 第一批（必须先做）

1. `Claude -> OpenAI Responses` translator
2. `OpenAICompatExecutor` `/responses` path
3. stream 兼容
4. tool call / tool_result 兼容

### 第二批（主链路跑通后立刻补）

1. usage / token 统计
2. error mapping
3. Wails probe / explain evidence
4. Claude channel 候选策略

### 第三批（产品化收口）

1. UI 能力标记
2. workbench / preview / 文案更新
3. 最终 docs 与验收截图

## 不建议的实现顺序

以下顺序风险很高：

1. 先改 UI / 候选筛选，再补 runtime
2. 只补 translator，不补 executor `/responses` path
3. 只验证 non-stream，不验证 stream / tool call

因为这样很容易得到一个“看起来能选、偶尔能回文本、但 agent 实际不可用”的假支持。
