# 2026-06-15 函数级实现蓝图

## 目的

把 “Claude Code 是否支持 open-response” 的研究结果继续下沉到可直接开发的粒度：

1. 需要改哪些具体函数。
2. 每个函数当前承担什么角色。
3. 如果要支持 `Claude /v1/messages -> openai-compatible /responses upstream`，建议怎么改。
4. 对应先补哪些 failing tests。

## 当前主链路函数图

### A. Claude ingress

1. `sdk/api/handlers/claude/code_handlers.go`
   - `func (h *ClaudeCodeAPIHandler) HandlerType() string`
     - 当前返回 `Claude`
   - `func (h *ClaudeCodeAPIHandler) ClaudeMessages(c *gin.Context)`
     - Claude 入口 handler
   - `func (h *ClaudeCodeAPIHandler) handleNonStreamingResponse(...)`
     - 最终调用 `ExecuteWithAuthManager(..., h.HandlerType(), ...)`
   - `func (h *ClaudeCodeAPIHandler) handleStreamingResponse(...)`
     - 最终调用 `ExecuteStreamWithAuthManager(..., h.HandlerType(), ...)`

2. `sdk/api/handlers/handlers.go`
   - `func (h *BaseAPIHandler) executeWithAuthManager(...)`
   - `func (h *BaseAPIHandler) executeStreamWithAuthManager(...)`
   - 这两条路径都会把：
     - `SourceFormat: sdktranslator.FromString(handlerType)`
     - 也就是 Claude handler 固定传入 `SourceFormat=claude`
   - `func (h *BaseAPIHandler) getRequestDetailsWithOptions(...)`
     - 通过 `util.GetProviderName(model)` 决定 provider 集合

### B. Provider / registry 选择

1. `internal/util/provider.go`
   - `func GetProviderName(modelName string) []string`
   - 当前先看 `registry.GetGlobalRegistry().GetModelProviders(modelName)`

2. `internal/registry/model_registry.go`
   - `func (r *ModelRegistry) GetModelProviders(modelID string) []string`
   - `func (r *ModelRegistry) GetAvailableModels(handlerType string) []map[string]any`
   - `func (r *ModelRegistry) convertModelToMap(model *ModelInfo, handlerType string) map[string]any`

### C. OpenAI-compatible executor

1. `internal/runtime/executor/openai_compat_executor.go`
   - `func (e *OpenAICompatExecutor) Execute(...)`
     - 当前默认：
       - `to := openai`
       - endpoint `/chat/completions`
     - 仅当 `opts.Alt == "responses/compact"` 才切到：
       - `to := openai-response`
       - endpoint `/responses/compact`
   - `func (e *OpenAICompatExecutor) ExecuteStream(...)`
     - 当前默认：
       - `to := openai`
       - endpoint `/chat/completions`
     - 没有普通 `/responses` stream 分支

### D. Translator 注册现状

1. `internal/translator/openai/claude/init.go`
   - 当前注册 `Claude -> OpenAI`
   - 对应的是 Claude 请求转 OpenAI Chat Completions

2. `internal/translator/claude/openai/responses/init.go`
   - 当前注册 `OpenaiResponse -> Claude`
   - 方向是 OpenAI Responses 客户端请求转 Claude，不是本需求方向

3. 当前**没有找到**对等的：
   - `Claude -> OpenaiResponse`
   - 或任何 `Claude handler` 常规路径会把 `to` 切到 `openai-response`

### E. Wails / 产品层

1. `internal/wailsapp/channel_routing.go`
   - `func accountSupportsChannel(account, "claude")`
   - 当前只认 `anthropic`

2. `internal/wailsapp/claude_code_routing_probe.go`
   - `func ProbeClaudeCodeAccountRouting(...)`
   - `func loadClaudeCodeRoutingProbeCandidates()`
   - `func supportsAnthropicFormat(...)`
   - 当前 probe 候选和实际请求都只走 Anthropic Messages 语义

3. `frontend/src/features/claude-code/model/claudeCodeAccountList.ts`
   - 当前 rows 构造只收 `supportedFormats.includes("anthropic")`

4. `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx`
   - 当前文案也明确说 “只收 anthropic”

## 建议的函数级改动顺序

### 第 1 组：translator 能力补齐

目标：让运行时至少具备 `Claude -> OpenAI Responses` 的 request/response transformer。

建议动作：

1. 新增一个注册点，方向为：
   - `translator.Register(Claude, OpenaiResponse, ...)`
2. 优先考虑新增目录而不是硬塞进现有反向目录，避免命名继续误导：
   - 候选：`internal/translator/openai-response/claude/`
   - 或按现有风格新增 `internal/translator/openai/responses/claude/` 等明确方向目录
3. request transformer 至少要覆盖：
   - `model`
   - `system`
   - `messages`
   - `thinking / reasoning`
   - `tools / tool_choice`
   - `tool_result`
4. response transformer 至少要覆盖：
   - non-stream
   - stream event
   - usage
   - finish reason

### 第 2 组：executor `/responses` path

目标：让 openai-compatible executor 在 Claude 源格式下按条件打 `/responses`，而不是永远 `/chat/completions`。

建议优先改：

1. `func (e *OpenAICompatExecutor) Execute(...)`
2. `func (e *OpenAICompatExecutor) ExecuteStream(...)`

建议引入一个小 helper，例如：

```go
func shouldUseResponsesUpstream(from sdktranslator.Format, opts cliproxyexecutor.Options, auth *cliproxyauth.Auth) bool
```

或

```go
func resolveOpenAICompatTargetFormat(from sdktranslator.Format, opts cliproxyexecutor.Options, auth *cliproxyauth.Auth) (sdktranslator.Format, string)
```

输出：

1. target translator format：`openai` / `openai-response`
2. upstream endpoint：`/chat/completions` / `/responses` / `/responses/compact`

这样可以避免把条件判断散在 `Execute` 和 `ExecuteStream` 两份逻辑里。

### 第 3 组：handler / metadata 驱动

目标：让 Claude handler 能显式表达“这次虽然 ingress 是 `/messages`，但目标 upstream protocol 是 responses”。

候选改动点：

1. `sdk/api/handlers/claude/code_handlers.go`
   - 现状是直接传 `ExecuteWithAuthManager(..., h.HandlerType(), ..., alt="")`
   - 可以考虑通过：
     - `alt`
     - `opts.Metadata`
     - headers/context metadata
     来告诉 executor 目标 upstream protocol

更推荐 metadata，而不是滥用 `alt`：

1. `alt` 当前已经带有 `responses/compact` 语义
2. 如果把 compat responses 也塞进 `alt`，后续会混淆“客户端入口 path”和“upstream protocol”

### 第 4 组：Wails / 账号候选与 probe

目标：当产品决定开放此能力后，Wails 层能正确筛选候选并产出证据。

优先改动点：

1. `internal/wailsapp/channel_routing.go`
   - `accountSupportsChannel(..., "claude")`
2. `internal/wailsapp/claude_code_routing_probe.go`
   - `supportsAnthropicFormat(...)`
   - `loadClaudeCodeRoutingProbeCandidates()`
3. `frontend/src/features/claude-code/model/claudeCodeAccountList.ts`

这里必须先做产品决策：

1. 是不是允许 `supportedFormats = ["openai_responses"]` 但无 `anthropic` 的账号进入 Claude 候选池
2. 还是仍要求 ingress 视角上有 `anthropic` 能力，只把 responses 当 upstream compat 细节

## 建议补的 focused tests

### 已有、可复用的测试锚点

1. `internal/wailsapp/claude_code_routing_probe_test.go`
   - 当前证明：
     - probe 打 `/v1/messages`
     - 只筛 Anthropic 候选

2. `internal/runtime/executor/openai_compat_executor_compact_test.go`
   - 当前证明：
     - `openai-response` 源格式会打 `/v1/chat/completions`
     - stream 也会转成 Responses events

3. `internal/translator/openai/claude/openai_claude_request_test.go`
   - 当前证明 Claude -> OpenAI Chat request transformer 已经有较细覆盖

4. `internal/translator/claude/openai/responses/claude_openai-responses_request_test.go`
   - 当前证明 OpenAI Responses -> Claude request transformer 已有覆盖

### 建议新增测试名

#### Translator

1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`
2. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`
3. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`
4. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`

#### Executor

1. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`
2. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`
3. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`
4. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

#### Wails / probe

1. `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates`
2. `TestProbeClaudeCodeAccountRoutingEvidenceMarksResponsesUpstream`
3. `TestClaudeChannelRoutingSupportsResponsesCompatWhenEnabled`

#### UI / model

1. `claudeCodeAccountList.test.mjs`
   - 新增 compat 候选筛选 case
   - 新增 capability 标记 case
2. `ClaudeCodeAccountListWorkbench` story / preview data
   - 新增 `messages->responses compat` 状态

## 推荐的开发切片

### 切片 1：纯 research spike

1. 只补 translator 注册和 executor helper
2. 只加 focused tests，不碰 Wails / UI
3. 证明技术主路径成立

### 切片 2：relay compat 落地

1. 补 probe / explain evidence
2. 补 routing candidate policy
3. 仍不对外宣传“Claude 原生支持 open-response”

### 切片 3：产品化收口

1. 前端能力标记
2. 文案与帮助说明
3. 最终 acceptance 与 space 更新
