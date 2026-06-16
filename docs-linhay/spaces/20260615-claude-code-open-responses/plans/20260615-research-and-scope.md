# 2026-06-15 研究计划

## 研究问题

1. Claude Code 在 GetTokens 中当前明确支持哪些请求协议与账号格式。
2. `openai_responses` 与 `openai_chat` 对 Claude Code 分别处于什么状态：
   - 明确支持
   - 仅底层有转换能力
   - 尚未接线
   - 明确不支持
3. 如果后续要支持 Claude Code 对接 open-response，需要新增哪些边界：
   - channel routing 候选筛选
   - runtime translator 接线
   - 模型映射
   - 流式事件与 tool call 兼容
   - route probe / explain / local apply / UI 能力标记

## 研究步骤

1. 梳理现有产品口径：
   - Claude Code account-list space
   - 模板映射 space
   - Claude Code skill
2. 梳理现有代码边界：
   - `supportedFormats` / `formatBaseUrls`
   - `channel_routing.go`
   - Claude Code probe / local apply / Wails-facing DTO
3. 梳理 sidecar 参考实现：
   - `translator/claude/openai/*`
   - `translator/openai/claude/*`
   - 是否已有 handler 级接线，而不只是纯转换函数
4. 形成结论矩阵：
   - 当前是否支持
   - 缺失点
   - 风险
   - 建议优先级

## 候选结论模板

### A. 当前不支持
- 条件：Claude 渠道路由、runtime handler、probe、UI 均未接入 `openai_responses`。
- 后续动作：如果用户要做，实现前先补设计方案和 failing tests。

### B. 当前部分支持
- 条件：sidecar 已可转换，但上层产品口径、候选筛选或 UI 未收口。
- 后续动作：补产品边界、测试和状态呈现，避免“技术上可用但产品上不可宣称”。

### C. 当前已支持但文档缺失
- 条件：运行时主链路、测试、probe 都已通，只是 space / skill / UI 文案未更新。
- 后续动作：先修正文档与能力标记，再决定是否补额外 UX。

## 进入实现前的最小证据

1. 至少一条当前链路的 handler 级调用图，证明请求会到哪里。
2. 至少一组 focused tests 或真实链路证据，证明转换是“可运行”而非“参考代码存在”。
3. 对 tool call / streaming / error / usage 兼容面的缺口判断。
4. 一份明确的验收清单，说明完成后如何证明 Claude Code 真正支持 open-response。

## 2026-06-15 当前研究发现

### 已确认

1. Claude Code sidecar ingress 当前固定为 `/v1/messages`。
2. Wails `ProbeClaudeCodeAccountRouting` 也只探测 `/v1/messages`。
3. Claude handler 运行时 `SourceFormat` 固定为 `claude`。
4. `openai/claude/init.go` 注册了 `Claude -> OpenAI`，说明存在 Claude 请求转 OpenAI Chat 的 translator。
5. `OpenAICompatExecutor` 常规非流式与流式 path 都固定打 `/chat/completions`。

### 未确认 / 当前偏否定

1. 没找到 `Claude -> OpenAI Responses` 的注册与主链路使用证据。
2. `claude/openai/responses/init.go` 实际注册的是 `OpenAI Responses -> Claude`，不是当前研究方向。
3. 没找到覆盖 `OpenAICompatExecutor + SourceFormat=claude` 的 focused tests。
4. 没找到覆盖 “Claude `/messages` -> OpenAI Responses upstream” 的 handler / executor / smoke tests。

### 当前工作假设

当前更接近下面这个判断：

- 已部分存在：`Claude /messages` -> OpenAI Chat-compatible upstream
- 尚未证明：`Claude /messages` -> OpenAI Responses upstream
- 因此用户口径仍应回答为：**不支持 Claude Code 对接 open-response 格式作为正式能力**

## 若进入实现的最小任务包

1. 明确目标能力定义：
   - 只做 relay 兼容转换
   - 还是对外宣称 Claude Code 支持 open-response
2. 新增 `Claude -> OpenAI Responses` request/response translator 注册与 tests。
3. 扩展 OpenAI-compatible executor，让 Claude 源格式也能走 `/responses` 非 compact path，而不是只走 `/chat/completions`。
4. 补 focused tests：
   - non-stream
   - stream
   - tool call / tool_result
   - usage 字段回写
   - error 语义映射
5. 再决定是否修改 Claude channel 候选筛选、probe、explain 和 UI 能力标记。

## 文件级任务拆分建议

### A. Runtime / translator

1. 新增或确认 `Claude -> OpenAI Responses` translator 注册。
2. 确认 request transformer 是否直接复用现有 `OpenAI Responses -> Claude` 的逆向逻辑，还是需要独立实现。
3. 为流式与非流式补 response transformer tests。

### B. Executor

1. 扩展 `OpenAICompatExecutor`：
   - 让 `from=claude` 时可按条件走 `/responses`
   - 明确 `opts.Alt` 或其他 metadata 如何驱动该分支
2. 决定 stream path 是否也走 `/responses`，以及是否要继续复用现有 SSE translate 机制。

### C. Wails / channel routing

1. 决定 `accountSupportsChannel(..., "claude")` 是否继续只认 `anthropic`。
2. 决定 `supportsAnthropicFormat()` 是否要扩成“anthropic 或允许的 compat 能力”。
3. 决定 Claude probe 仍然只发 `/v1/messages`，但在 evidence 中标注 upstream protocol，还是新增额外 probe。

### D. Frontend / product copy

1. 更新 Claude account list 的筛选与文案说明。
2. 在详情或账号卡中区分：
   - 原生 `anthropic`
   - compat `messages -> responses`
3. 更新 preview data 与单测，避免 story / preview 仍写死“只收 anthropic”。
