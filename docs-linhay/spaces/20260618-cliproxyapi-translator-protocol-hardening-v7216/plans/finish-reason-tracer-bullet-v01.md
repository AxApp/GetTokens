# Finish Reason Tracer Bullet v01

## Scope

本 tracer bullet 只实现 upstream v7.1.63 的 finish_reason 延迟输出行为，覆盖 Gemini 与 Gemini CLI 到 OpenAI Chat Completions 的 streaming 转换。

## Red tests

- go test ./internal/translator/gemini/openai/chat-completions -run TestGeminiFinishReasonOnlyOnFinalChunk -count=1
- go test ./internal/translator/gemini-cli/openai/chat-completions -run TestCliFinishReasonOnlyOnFinalChunk -count=1

## Implementation

1. 在 Gemini response params 中加入 SawToolCall 和 UpstreamFinishReason，按 candidate index 记录。
2. functionCall chunk 只记录 SawToolCall，不输出 finish_reason。
3. 当当前 chunk 同时有 upstream finishReason 和 usageMetadata 时视作 final chunk。
4. final chunk 映射：
   - 见过 tool call：finish_reason=tool_calls。
   - upstream MAX_TOKENS：finish_reason=max_tokens。
   - 其他 finishReason：finish_reason=stop。
   - native_finish_reason 记录 upstream finishReason lower-case。
5. Gemini CLI 同样记录 SawToolCall 和 UpstreamFinishReason。

## Verification

- focused red tests：
  - go test ./internal/translator/gemini/openai/chat-completions -run TestGeminiFinishReasonOnlyOnFinalChunk -count=1：初始失败，tool chunk got tool_calls。
  - go test ./internal/translator/gemini-cli/openai/chat-completions -run TestCliFinishReasonOnlyOnFinalChunk -count=1：初始失败，tool chunk got tool_calls。
- focused green tests：
  - go test ./internal/translator/gemini/openai/chat-completions -run TestGeminiFinishReasonOnlyOnFinalChunk -count=1：通过。
  - go test ./internal/translator/gemini-cli/openai/chat-completions -run TestCliFinishReasonOnlyOnFinalChunk -count=1：通过。
- package tests：
  - go test ./internal/translator/gemini/openai/chat-completions ./internal/translator/gemini-cli/openai/chat-completions -count=1：通过。
- full fork suite：
  - go test ./... -count=1：通过。
- scoped diff check：
  - git -C docs-linhay/references/CLIProxyAPI diff --check：通过。
- sidecar rebuild：
  - ./scripts/ensure-sidecar.sh darwin arm64：通过，meta commit 51f9d9c4c241e4ff46dd913ef5793427c68cdb91，dirty=clean。
- dev App：
  - 未启动。原因：本切片只改纯 translator 函数，不涉及 native/Wails/runtime binding；按 AGENTS 第 26 条用自动化测试和 sidecar rebuild 作为本轮验收。

## Non-goals

- 不实现其他 translator v7.2.16 候选。
- 不跑 dev App；本切片不改 sidecar process、Wails binding 或 runtime management API。

## Closure status

- 状态：fork-committed
- fork commit：51f9d9c4
- parent closure：待父仓只 stage 本切片 space、memory 与 docs-linhay/references/CLIProxyAPI gitlink；当前父仓还有多项非本轮 dirty work，不能混入。
