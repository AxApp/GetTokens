# Assistant Prefill Tracer Bullet v01

## Scope

本 tracer bullet 只实现 Gemini / Gemini Responses request translator 的末尾 assistant/model prefill stripping。它不改变中间历史中的 assistant/model turn，不改变 tool calling、reasoning signature、system/developer role 处理。

## Evidence

| 项目 | 证据 |
| --- | --- |
| upstream source | v7.2.16 中 internal/translator/gemini/openai/chat-completions/gemini_openai_request.go 与 internal/translator/gemini/openai/responses/gemini_openai-responses_request.go 已添加末尾 model turn 删除 |
| current fork gap | 当前 fork 两个文件尾部都缺少 contents 最后一项 role=model 删除逻辑 |
| user-visible risk | Gemini/Vertex 接受历史中的 model turn，但部分模型 surfaces 会拒绝最后一轮是 model-authored prefill 的请求 |
| expected behavior | 只删除转换结果中最后一条 role=model contents，保留之前 user/tool/reasoning 历史 |

## Red tests

- go test ./internal/translator/gemini/openai/chat-completions -run TestConvertOpenAIRequestToGemini_StripsTrailingAssistantPrefill -count=1
- go test ./internal/translator/gemini/openai/responses -run TestConvertOpenAIResponsesRequestToGemini_StripsTrailingAssistantPrefill -count=1

## Implementation

1. 在 chat-completions Gemini request 转换完成 contents 后，检查最后一项 role。
2. 如果最后一项 role=model，删除该 contents。
3. 在 responses Gemini request 转换完成 input contents 后执行同样逻辑。
4. 保持工具声明、generation config 和 systemInstruction 逻辑不变。

## Verification

- focused red tests：
  - go test ./internal/translator/gemini/openai/chat-completions -run TestConvertOpenAIRequestToGemini_StripsTrailingAssistantPrefill -count=1：初始失败，contents length = 2，末尾 role=model。
  - go test ./internal/translator/gemini/openai/responses -run TestConvertOpenAIResponsesRequestToGemini_StripsTrailingAssistantPrefill -count=1：初始失败，contents length = 2，末尾 role=model。
- focused green tests：
  - go test ./internal/translator/gemini/openai/chat-completions -run TestConvertOpenAIRequestToGemini_StripsTrailingAssistantPrefill -count=1：通过。
  - go test ./internal/translator/gemini/openai/responses -run TestConvertOpenAIResponsesRequestToGemini_StripsTrailingAssistantPrefill -count=1：通过。
- package tests：
  - go test ./internal/translator/gemini/openai/chat-completions ./internal/translator/gemini/openai/responses -count=1：通过。
- full fork suite：
  - go test ./... -count=1：通过。
- fork diff check：
  - git diff --check：通过。
- sidecar rebuild：
  - ./scripts/ensure-sidecar.sh darwin arm64：通过，meta commit 803ab64c1407d35957e032910468d40499cbb484，dirty=clean。
- dev App：
  - 未启动。原因：本切片只改纯 request translator 函数，不涉及 native/Wails/runtime binding；按 AGENTS 第 26 条用自动化测试和 sidecar rebuild 作为本轮验收。

## Non-goals

- 不实现 web_search_call server tool blocks。
- 不实现 tool_result normalization。
- 不改账号选择、route guard、management API、Wails 或 frontend。

## Closure status

- 状态：fork-committed
- fork commit：803ab64c
- parent closure：待父仓只 stage 本 space、memory 与 docs-linhay/references/CLIProxyAPI gitlink；当前父仓还有多项非本轮 dirty work，不能混入。
