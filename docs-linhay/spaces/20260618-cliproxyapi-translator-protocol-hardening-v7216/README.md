# CLIProxyAPI Translator Protocol Hardening v7.2.16

## 背景

本 space 是 v7.2.16 upstream intake 的第一实现切片，只处理 translator/protocol 层可用窄测试证明的行为。当前先落最小 tracer bullet：Gemini 与 Gemini CLI 到 OpenAI Chat Completions 的 streaming 转换中，tool-call 中间 chunk 不应提前输出 finish_reason；只有最终 chunk 带 upstream finishReason 且带 usageMetadata 时，才输出 OpenAI finish_reason。

## 目标

1. 在 CLIProxyAPI fork 中补 focused red tests，证明当前 fork 会过早输出 finish_reason。
2. 最小实现 upstream v7.1.63 对应行为：跨 chunk 记录是否见过 tool call，并把 finish_reason 延迟到最终 chunk。
3. 保持 GetTokens sidecar 自治边界，不触碰账号选择、route guard、rate-limit、live sessions、usage attribution、system proxy、management API 或 Wails。
4. 通过 focused translator tests、相关 package tests 和 diff check。

## 范围

- CLIProxyAPI fork 文件：
  - internal/translator/gemini/openai/chat-completions/gemini_openai_response.go
  - internal/translator/gemini/openai/chat-completions/gemini_openai_response_test.go
  - internal/translator/gemini-cli/openai/chat-completions/gemini-cli_openai_response.go
  - internal/translator/gemini-cli/openai/chat-completions/gemini-cli_openai_response_test.go
- 上游参考：
  - 58bf645e feat(translator): ensure correct finish_reason handling for all response chunks

## 非目标

- 不实现本轮 intake 中其他 translator 行为，例如 web_search_call server tool blocks、tool_result normalization、namespace/function mapping、assistant prefill stripping。
- 不引入 pluginhost/pluginstore/interceptor。
- 不修改父仓 Wails/frontend。
- 不触碰正式版 /Applications/GetTokens.app。

## 证据矩阵

| 项目 | 当前证据 | 预期证明 |
| --- | --- | --- |
| upstream source | 58bf645e / v7.1.63：finish_reason all chunks | 使用 upstream 行为作 reference input，不 cherry-pick |
| current fork location | Gemini 与 Gemini CLI OpenAI response 转换直接按当前 chunk hasFunctionCall 输出 finish_reason=tool_calls | focused tests 初始失败 |
| 当前现象 | tool-call 中间 chunk 会携带 finish_reason，可能让下游误判 stream 已结束 | 红灯测试断言中间 chunk finish_reason 必须为空/null |
| 预期行为 | 跨 chunk 记录 SawToolCall 和 UpstreamFinishReason；最终 chunk 计算 tool_calls / max_tokens / stop | 绿灯测试通过 |
| 验收方式 | focused go test 两个 package；相关 package go test；git diff --check | 本轮不需要 dev App，因为只改纯 translator 函数 |

## 验收标准

### BDD 场景

1. 给定 Gemini streaming 第一个 chunk 只包含 functionCall 且无 finishReason，当转换为 OpenAI chunk 时，finish_reason 必须保持 null/空。
2. 给定同一 stream 之后收到最终 chunk，且最终 chunk 带 finishReason=STOP 和 usageMetadata，当之前见过 tool call 时，finish_reason 必须为 tool_calls，native_finish_reason 必须为 stop。
3. 给定 Gemini CLI streaming 同样的 chunk 序列，行为必须与 Gemini streaming 一致。
4. 给定未见 tool call 的最终 chunk，仍按 upstream finishReason 映射 stop/max_tokens。

## 设计稿入口

- 本期设计稿：未产出
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：feat/20260618-cliproxyapi-translator-protocol-hardening-v7216
- worktree：../GetTokens-worktrees/20260618-cliproxyapi-translator-protocol-hardening-v7216/

## 相关链接

- Parent intake：docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md
- Parent plan：docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-intake-plan-v01.md

## 当前状态

- 状态：implemented-awaiting-parent-closure
- 最近更新：2026-06-18

## 实现记录

- fork commit：51f9d9c4 fix(translator): delay gemini finish reasons until final chunk
- 实现内容：Gemini / Gemini CLI streaming 转 OpenAI Chat Completions 时，functionCall 中间 chunk 不再提前输出 finish_reason；最终 chunk 带 finishReason 和 usageMetadata 时，按 stream 历史映射 tool_calls / max_tokens / stop，并保留 native_finish_reason。
- sidecar rebuild：build/bin/cli-proxy-api.meta.json 指向 51f9d9c4c241e4ff46dd913ef5793427c68cdb91:clean:88b186867bb6863a7f1797b20a9f52395144866ef0dc019543dcb5f16d083141:darwin:arm64。
- dev App：本切片只改纯 translator 函数，不改 sidecar process、management API、Wails binding、窗口生命周期或 native runtime；按 AGENTS 第 26 条，本轮不启动真实 dev App，采用 focused tests、full CLIProxyAPI suite 和 sidecar rebuild 作为验收证据。
- prod untouched：未修改、重启或替换 /Applications/GetTokens.app；仅执行 stat 检查确认存在时间。

## 第二切片：assistant prefill stripping

- 状态：implemented
- 目标：Gemini / Gemini Responses request 转换时，若转换结果最后一条 contents 是 model-authored turn，删除该末尾 prefill，避免 Gemini/Vertex 类模型拒绝最终 assistant/model 预填充请求。
- 上游参考：v7.2.16 中 Gemini OpenAI request / responses request 的 prefill stripping tests 与实现。
- 计划入口：docs-linhay/spaces/20260618-cliproxyapi-translator-protocol-hardening-v7216/plans/assistant-prefill-tracer-bullet-v01.md
- fork commit：803ab64c fix(translator): strip trailing gemini assistant prefill。
- sidecar rebuild：build/bin/cli-proxy-api.meta.json 指向 803ab64c1407d35957e032910468d40499cbb484:clean:bae625d209e5004d93648d013cfe82d6ccadeb414bb2925cb46392ed0b4e670f:darwin:arm64。

## 第三候选：OpenAI Responses completed 顶层 output_text 省略

- 状态：already-satisfied-no-port
- 目标：复核 OpenAI Chat Completions -> OpenAI Responses 转换时，streaming 与 non-streaming completed response 是否错误暴露顶层 `response.output_text` / `output_text`；native Responses 输出只保留 `response.output[].content[].text`。
- 上游参考：v7.2.16 `internal/translator/openai/openai/responses/openai_openai-responses_response_test.go` 中 `CompletedOmitsTopLevelOutputText`、`ToolCallCompletedOmitsTopLevelOutputText` 与 `NonStream_OmitsTopLevelOutputText`。
- 当前 fork 事实位置：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/openai/responses/openai_openai-responses_response.go` 的 `buildResponsesCompletedEvent` 和 `ConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream`。
- 缺失证明：fork test 当前缺少上述上游覆盖；已临时补入 focused tests 判定红/绿。
- 验收结果：临时加入 upstream 三个 output_text 省略场景后运行 `go test ./internal/translator/openai/openai/responses -run 'TestConvertOpenAIChatCompletionsResponseToOpenAIResponses.*OutputText' -count=1`，结果直接通过。说明当前 fork 已满足该行为；按证据门禁撤回临时测试，不做 fork 代码改动、不新建 fork commit、不重建 sidecar。
- 验收方式：本候选没有红灯，终止在 evidence gate；后续若需要长期覆盖，可作为单独 coverage-only 测试增强处理，不与 reference-port 行为修复混为一个实现切片。
- dev App：该候选仅涉及纯 translator 输出结构，不触碰 Wails/native/process/runtime；若进入实现，默认用自动化测试与 clean sidecar rebuild 验收，不启动真实 dev App。

## 第四切片：Claude request 中途 system 消息归并

- 状态：implemented
- 目标：OpenAI 兼容目标不接受对话中途穿插 `role=system` 的普通消息；Claude request translator 应把顶层 `system` 与 `messages[].role=system` 的文本/数组内容统一归并到首个 OpenAI `system` message，并从普通 messages 序列中移除中途 system。
- 上游参考：v7.2.16 `internal/translator/openai/claude/openai_claude_request_test.go` 的 `TestConvertClaudeRequestToOpenAI_MidConversationSystemMessagesMoveToInitialSystem`。
- 当前 fork 事实位置：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/claude/openai_claude_request.go` 只处理顶层 `root.system`，没有预扫 `root.messages` 中的 `role=system`。
- 当前现象：红灯已确认；当前 fork 会输出 6 条 messages，并保留中途 `role=system` 普通消息。
- 红灯命令：`go test ./internal/translator/openai/claude -run TestConvertClaudeRequestToOpenAI_MidConversationSystemMessagesMoveToInitialSystem -count=1`。
- 验收结果：
  - 红灯：`Expected 4 messages, got 6`。
  - 绿灯：focused test 通过。
  - affected package：`go test ./internal/translator/openai/claude -count=1` 通过。
  - fork 全量：`go test ./... -count=1` 通过。
  - fork diff：`git diff --check` 通过。
  - fork commit：`578afbfe fix(translator): consolidate claude system messages`。
- sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `578afbfea1b2a91f6442a290322c98aa684325c2:clean:38aee3501a9adf785d7fa4757110aa493c984103c6a2ed3dec664e5f3d17d8e6:darwin:arm64`。
- dev App：该切片只改纯 request translator，不触碰 sidecar process、management API、Wails binding 或 native runtime；默认采用自动化测试与 clean sidecar rebuild 验收。

## 第五切片：Codex web_search_call 回译 Claude server tool blocks

- 状态：implemented
- 目标：Codex Responses stream / non-stream 中的 `web_search_call` 应回译为 Claude 侧 `server_tool_use` 与 `web_search_tool_result` content blocks，使 Claude typed `web_search_20250305/20260209` 请求经 Codex 后仍保留 server tool 语义。
- 上游参考：v7.2.16 `internal/translator/codex/claude/codex_claude_response_web_search.go` 与 `codex_claude_response_test.go` 中 `StreamWebSearchCallEmitsClaudeServerToolBlocks`、`StreamWebSearchCallReusesFallbackToolUseID`、`NonStream_WebSearchCallEmitsServerToolBlocks` 等测试。
- 当前 fork 事实位置：fork 已有 request 侧 Claude typed web_search -> Codex `web_search` 映射，但 `docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/` 当前缺少 `codex_claude_response_web_search.go`，response 侧没有 `web_search_call` 专用回译逻辑。
- 当前现象：红灯已确认；stream 只输出 message_start/message_delta/message_stop，non-stream 只保留 text，缺少 `server_tool_use` / `web_search_tool_result`。
- 红灯命令：`go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude.*WebSearch' -count=1`。
- 验收结果：
  - 红灯：focused web_search tests 初始失败，stream 缺 `server_tool_use`，non-stream 缺 `server_tool_use` content type。
  - 绿灯：focused web_search tests 通过。
  - affected package：`go test ./internal/translator/codex/claude -count=1` 通过。
  - fork diff：`git diff --check` 与 staged `git diff --cached --check` 通过。
  - fork 全量：`go test ./... -count=1` 通过。
  - fork commit：`7cc308d0 fix(translator): emit claude web search blocks`。
  - sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `7cc308d01a0316972f69eeedb0c59d56f3f00e1e:clean:3a7da4886ce1407e366ee7ae5699c810963ffc4b80c1a48431b56b6c7ac82173:darwin:arm64`。
- 非目标：不改 Codex WebSocket transport、route guard、usage attribution、live sessions、auth、management API 或 Wails；只补 translator response 结构回译。
