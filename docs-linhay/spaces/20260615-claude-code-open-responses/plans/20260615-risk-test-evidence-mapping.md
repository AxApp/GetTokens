# 2026-06-15 风险-测试-验收映射表

## 目的

把这个 research space 里已经分散在不同文档中的三类信息收口成一张可执行表：

1. 风险点
2. 对应的测试门禁
3. 对应的最终验收证据

这样后续一旦进入 implementation spike，就不会出现：

1. 风险知道很多，但不知道先补哪条测试
2. 测试写了几条，但不清楚是否真的覆盖风险
3. 测试过了，但最后不知道应该拿什么证据宣称“可以支持”

## 一、使用方式

建议把这张表当成后续执行 checklist：

1. 先按风险优先级从上往下做
2. 每个风险至少补齐一条 focused test
3. 只有当“测试证据 + 最终验收证据”都成立，才算该风险被压住

## 二、映射总表

| 风险面 | 等级 | 必要测试 | 补充测试 | 最终验收证据 |
| --- | --- | --- | --- | --- |
| `Claude -> OpenAI Responses` translator 缺失 | P0 | `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip` | `ThinkingMapping`、`ToolUseAndToolResult` | Claude request 被转成 Responses `input`，不再落成 chat `messages` |
| streaming event 兼容 | P0 | `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream` | `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason` | 上游命中 `/responses`，Claude 侧流事件顺序与收尾正确 |
| tool call / tool_result 闭环 | P0 | `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult` | `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip` | tool 调用与结果在整条链上不丢、不乱序 |
| executor `/responses` path | P0 | `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream` | `...StreamUsesResponsesUpstream` | upstream 实际 path 为 `/responses`，不是 `/chat/completions` |
| usage / token 统计 | P1 | `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason` | Claude non-stream usage case | usage 最终能在 Claude 侧与 recent requests / 面板统计对齐 |
| error mapping | P1 | `TestOpenAICompatExecutorClaudeResponsesErrorMapping` | Claude handler error envelope case | `/responses` upstream 失败时，Claude 侧错误 envelope 正确 |
| Wails 候选筛选 / probe | P1 | `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates` | `...EvidenceMarksResponsesUpstream` | probe 能展示 compat 路径，不再只会给出 Anthropics 直连假象 |
| UI / 产品口径 | P2 | `claudeCodeAccountList.test.mjs` compat case | workbench story / preview case | UI 文案能表达 compat，不误称“原生支持” |

## 三、逐项展开

## 1. `Claude -> OpenAI Responses` translator 缺失

### 风险

没有正向 request translator，就算 executor 改成打 `/responses`，也只是把错误 payload 发给 upstream。

### 必要测试

1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`

### 补充测试

1. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`
2. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`

### 验收证据

至少需要同时看到：

1. request 顶层存在 `input`
2. `system -> instructions`
3. 不再输出 chat 风格 `messages`

### 不足证据示例

以下证据都不够：

1. 只有某个 helper unit test 过了，但没证明真实 request 结构
2. 只有 executor path 变成 `/responses`，但 body 仍是 chat 结构

## 2. streaming event 兼容

### 风险

即使 non-stream 能跑，stream 仍可能在：

1. delta 顺序
2. completed 收尾
3. usage 收尾
4. thinking/signature

这些地方出错。

### 必要测试

1. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

### 补充测试

1. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`

### 验收证据

至少需要：

1. upstream mock path 是 `/responses`
2. Claude 输出里有正确收尾事件
3. 不会重复 completed
4. usage 能在最终事件里落回

### 不足证据示例

1. 只验证第一段文本 delta 回来了
2. 没验证 `[DONE]` / completed / usage 收尾

## 3. tool call / tool_result 闭环

### 风险

这是最容易形成“能回文本，但 agent 不可用”的地方。

### 必要测试

1. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`

### 补充测试

1. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`

### 验收证据

至少需要：

1. tool_use id 能映射到 Responses tool call
2. tool_result 能映射回正确调用
3. 整条链上顺序不乱

### 不足证据示例

1. 只有 tools schema 被传上去了
2. 没有验证 tool_result 回来的关联关系

## 4. executor `/responses` path

### 风险

如果 path 仍是 `/chat/completions`，那本质上就不是这个需求。

### 必要测试

1. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`

### 补充测试

1. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

### 验收证据

最直接的证据只有一个：

1. upstream server 实际收到 `/v1/responses`

### 不足证据示例

1. 只看到 `to=openai-response` 变量被改了
2. 没有实际 mock server 路径断言

## 5. usage / token 统计

### 风险

功能能跑但 usage 错，会污染：

1. recent requests
2. route explain
3. 面板统计
4. 配额判断

### 必要测试

1. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`

### 补充测试

1. Claude non-stream usage case

### 验收证据

至少要看到：

1. stream 尾事件 usage 对齐
2. non-stream usage 对齐
3. 与现有 usage helper 的消费面不冲突

### 不足证据示例

1. 只看用户输出文本正常
2. 完全不校验 usage 字段

## 6. error mapping

### 风险

如果 `/responses` upstream 出错，但 Claude 侧错误 envelope 不对，CLI 实际体验会非常差。

### 必要测试

1. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

### 补充测试

1. Claude handler error envelope case

### 验收证据

至少要看到：

1. status code 保留
2. message 保留
3. 返回给 Claude 的 envelope 仍是 Claude 风格

### 不足证据示例

1. 只断言 `err != nil`
2. 不检查 envelope 形状

## 7. Wails 候选筛选 / probe

### 风险

runtime 成立后，如果产品层还只会展示“anthropic 直连”，用户仍然看不懂。

### 必要测试

1. `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates`

### 补充测试

1. `TestProbeClaudeCodeAccountRoutingEvidenceMarksResponsesUpstream`

### 验收证据

至少要看到：

1. compat 模式开启时，候选筛选符合产品决策
2. evidence 能指出这是 responses upstream compat

### 不足证据示例

1. 只改候选池，不改 evidence
2. UI 上能选，但 probe 结果仍像原生 Anthropics

## 8. UI / 产品口径

### 风险

如果 UI 直接写成“支持 open-response”，会把 compat 能力误说成原生能力。

### 必要测试

1. `claudeCodeAccountList.test.mjs` compat candidate case

### 补充测试

1. workbench story / preview case

### 验收证据

至少要看到：

1. 列表 / workbench 文案能区分：
   - 原生 anthropic
   - responses upstream compat

### 不足证据示例

1. 只让账号出现在列表里
2. 没有任何能力标签或解释文案

## 四、推荐执行节奏

### 第一批：压住 P0

1. translator request
2. executor `/responses` path
3. stream 基线
4. tool 闭环

### 第二批：压住 P1

1. usage
2. error mapping
3. probe / evidence

### 第三批：压住 P2

1. UI / 文案 / preview

## 五、最小通过门

如果后续只是做技术 spike，而不是产品化交付，我建议把“通过门”定成：

1. 所有 P0 风险至少各有一条 focused test 变绿
2. 至少一条 non-stream 和一条 stream mock 证明 upstream 是 `/responses`
3. 至少一条 tool round-trip proof 成立

只有这样，才值得进入下一轮产品化决策。
