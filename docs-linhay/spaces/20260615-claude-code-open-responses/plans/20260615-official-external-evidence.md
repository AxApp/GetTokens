# Claude Code Open Responses 官方外部证据

## 目的

前面的研究主要基于 GetTokens 当前仓库与 reference sidecar 代码。本文件补一层 2026-06-15 当天核对过的官方外部资料，用来回答一个更稳的问题：

1. Claude Code 官方当前到底把哪些 gateway / API format 视为正式接入面
2. 这些官方口径是否支持“Claude Code 已正式支持 open-response”这种表述

## 核对时间

- 核对日期：2026-06-15
- 核对来源：Anthropic / Claude Code 官方文档

## 外部证据 1：Claude Code LLM Gateway 官方要求

来源：

- [LLM gateway configuration](https://code.claude.com/docs/en/llm-gateway)

关键信息：

1. 官方把 Claude Code 可接入 gateway 的 API format 列成了明确白名单。
2. 当前列出的只有三类：
   - Anthropic Messages：`/v1/messages`、`/v1/messages/count_tokens`
   - Bedrock InvokeModel
   - Vertex rawPredict
3. 文档还明确说明 Claude Code 会“根据 API format 决定启用哪些特性”。
4. model discovery 也只对 Anthropic Messages format 生效。

对本研究的意义：

1. 这说明从 Claude Code 客户端视角看，**Anthropic Messages 仍是官方一等公民的通用 gateway 格式**。
2. 官方文档里没有把 OpenAI Responses 列为 Claude Code gateway 的正式接入面。
3. 因此，即使 GetTokens 内部未来实现了 `messages -> responses` relay compat，也更准确的表达仍应是：
   - `Claude Code` 客户端入口继续是 `Anthropic Messages`
   - `GetTokens` 在服务端内部把请求转译到 Responses upstream
4. 不宜对外直接说“Claude Code 支持 open-response 格式”，否则会和官方 gateway contract 冲突。

## 外部证据 2：Claude Code Authentication 官方口径

来源：

- [Authentication](https://code.claude.com/docs/en/iam)

关键信息：

1. Claude Code 官方列出的团队/组织接入方式包括：
   - Claude for Teams / Enterprise
   - Claude Console
   - Amazon Bedrock
   - Google Vertex AI
   - Microsoft Foundry
2. 该文档没有把 OpenAI Responses 或 OpenAI-compatible Responses 网关作为独立官方接入类别。

对本研究的意义：

1. 官方文档当前的认证与部署叙事，仍围绕 Anthropic 自身体系和少数云厂商托管入口。
2. 这进一步说明：如果 GetTokens 要支持 Responses upstream，那也是 **GetTokens 侧的 compat 扩展**，不是 Claude Code 官方产品口径里现成存在的一类接入模式。

## 外部证据 3：Anthropic 的 OpenAI SDK compatibility 页面

来源：

- [OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)

关键信息：

1. 官方把这层 compatibility 定位为“用 OpenAI SDK 测试 Claude API”的兼容层。
2. 文档明确提示它主要用于测试与比较，不建议当成长期开箱即用的生产主方案。
3. 示例调用仍是 `client.chat.completions.create(...)`。
4. 文档把 Anthropic 原生能力和该兼容层做了边界区分，并说明完整特性仍以 native Claude API 为准。
5. 该页当前还写明 rate limits 跟随 `/v1/messages` endpoint。

对本研究的意义：

1. 这份文档证明 Anthropic 官方自己也在做 OpenAI 生态兼容，但其叙事核心依旧是 **兼容层不等于原生协议面**。
2. 它和我们当前对 GetTokens 的建议口径一致：
   - 即便内部可以做协议转译，也不该轻易把 compat 说成“正式原生支持”
3. 另外，这页示例和限制说明更偏向 `chat.completions` 兼容，不足以反证 Claude Code 已支持 OpenAI Responses。

## 外部证据 4：Claude Code Model Configuration

来源：

- [Model configuration](https://code.claude.com/docs/en/model-config)

关键信息：

1. 文档对第三方 provider / gateway 的模型能力暴露，仍以 `ANTHROPIC_BASE_URL` 指向 gateway 为入口叙事。
2. capability 声明、模型展示名覆盖等机制，都是建立在 Claude Code 已经把对端识别为 gateway / provider 的前提上。

对本研究的意义：

1. 这再次说明 Claude Code 官方的扩展入口，是“Anthropic 风格的 gateway 接入”，而不是“客户端原生切到 OpenAI Responses 协议”。
2. 因而 GetTokens 若要扩协议，也更合理定位成：
   - 对 Claude Code 暴露 Anthropic Messages
   - 在服务端内部自行管理对上游的 responses/chat 转译

## 内外证据合并后的结论

把本 space 现有仓库内证据与官方外部证据放在一起，当前最稳的结论是：

1. **Claude Code 当前正式客户端 / gateway 口径仍是 Anthropic Messages 优先，不是 OpenAI Responses。**
2. **GetTokens 当前不应宣称“支持 Claude Code 对接 open-response 格式”作为正式能力。**
3. 如果未来要支持，也应准确描述为：
   - Claude Code 继续通过 `/v1/messages` 接入 GetTokens
   - GetTokens 在内部把请求 relay / translate 到 `/responses` upstream
   - 这属于 GetTokens compat 扩展，不是 Claude Code 官方 format contract 的直接一等支持

## 对当前方案排序的影响

这层外部证据会进一步强化当前 space 里的推荐排序：

1. 方案 A 依然最稳：保持 `messages -> chat` 主路径，先把“不支持 open-response”口径产品化
2. 方案 B 仍然只能在明确需求触发后启动，而且文案必须严格写成 compat / relay
3. 方案 C 依旧是合理兜底：直接维持当前边界，不扩到 responses

## 对后续实现的约束

如果未来进入实现，至少要遵守这条对外表达边界：

1. 不把 `Claude Code` 说成“原生支持 OpenAI Responses”
2. 不把 gateway 客户端入口从 `Anthropic Messages` 叙事里偷换掉
3. 只在 runtime、tests、Wails probe、UI 文案全部完成之后，才允许说“GetTokens 为 Claude Code 提供了 Responses upstream compat”

## 当前状态

- 状态：research
- 最近更新：2026-06-15
