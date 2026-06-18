# 20260618-cliproxyapi-codex-response-v7216-hardening

## 背景

本 space 承接 v7.2.16 intake 的 Phase 2：Codex Responses / Claude 兼容响应 hardening。执行策略仍是 reference-port：只把 upstream 作为参考输入，先用 focused red test 证明当前 fork 行为缺失，再在 GetTokens sidecar 边界内最小实现。

## 目标

1. 先处理低风险、窄范围的 Codex stream error -> Claude SSE error 转换。
2. 继续评估 v7.2.16 Codex Responses WebSocket terminal/error hardening，按红灯测试证明缺口后再最小实现。
3. 处理 WebSocket v2 incremental input 状态：记录上次 response id / pending tool calls，并在下一次请求满足 pending output 时注入 `previous_response_id`。
4. 保持 Codex WebSocket transport、route guard、usage attribution、live sessions 和 account selection 的 GetTokens 自治边界。
5. 每个子切片都必须有 evidence gate、红灯测试、最小实现、fork 验证、sidecar clean rebuild 和 docs/memory 写回。

## 范围

- 已完成子切片：
  - `docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go`
  - `docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response_test.go`
- 当前子切片：
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`
- upstream 参考：
  - v7.2.16 `TestConvertCodexResponseToClaude_StreamCyberPolicyError`
  - v7.2.16 `TestConvertCodexResponseToClaude_StreamErrorTypeFallbackMessage`
  - v7.2.16 `TestForwardResponsesWebsocketTreatsResponseDoneAsTerminalWithoutRewriting`
  - v7.2.16 `TestForwardResponsesWebsocketTreatsErrorPayloadAsTerminal`
  - v7.2.16 `TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseIDForIncremental`
  - v7.2.16 `TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseIDWhenPendingOutputIsPresent`
  - v7.2.16 `TestNormalizeResponsesWebsocketRequestSkipsPreviousResponseIDWhenPendingOutputIsMissing`
  - v7.2.16 `TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls`
  - v7.2.16 input item ID dedupe tests（fork 已有等价覆盖，见 `websocket-input-id-dedupe-audit-v01.md`）
  - v7.2.16 handler-level previous_response_id injection / missing pending output / generate fallback tests（fork 已由 `19fbddc4` 与既有 prewarm/fallback 行为满足，见 `websocket-handler-integration-audit-v01.md`）
  - v7.2.16 passthrough / XAI WebSocket executor tests（本期判定为 provider 策略能力，defer，见 `websocket-passthrough-xai-defer-audit-v01.md`）
- fork commits：
  - `de947e0f fix(translator): map codex stream errors to claude`
  - `66558927 fix(openai): honor responses websocket terminal payloads`
  - `19fbddc4 fix(openai): track responses websocket incremental state`
- 最新 sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `19fbddc44e54258f7ebc8e83ae92c69394eae853:clean:17808a42f6643e93d0485bc67e32d66b2853372cb3223690bc24d3485f59aefb:darwin:arm64`。

## 非目标

- 不改 compact response、pending tool calls、route guard、failure budget 或 usage attribution。
- 不引入 upstream 的 XAI passthrough、auth scheduler 或 session replay 大改。
- 不引入 upstream Responses WebSocket passthrough 分支；XAI Responses WebSocket executor / model catalog / provider routing 另按 `model-catalog-compat` 或 `xai-antigravity-executor-compat` 独立评估。
- `previous_response_id` 仅在本切片内按 pending tool output 状态窄实现；不改变 GetTokens route guard、account selection、rate-limit、live sessions 或 usage attribution 所有权。
- 不改 auth、scheduler、账号 SQLite、management API、Wails 或前端。
- 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

### BDD 场景

1. 给定 Codex streaming 返回 `type=error` 且 `code=cyber_policy`，当转换到 Claude SSE 时，必须输出 `event: error`，payload `type=error`，`error.type=invalid_request_error`，并保留 upstream message。
2. 给定 Codex streaming 返回 `type=error`、`error={}` 且只有顶层 `error_type=overloaded_error`，Claude SSE error 必须把 `error.type` 和 fallback message 都设为 `overloaded_error`。
3. 非 error stream 行为不回归，现有 thinking、tool_use、web_search_call、stop reason tests 必须保持通过。
4. 给定 upstream websocket data channel 返回 `type=response.done`，sidecar 必须原样转发该事件，记录完成 output，并在 data channel 关闭时不再追加 timeout error。
5. 给定 upstream websocket data channel 返回 `type=error` 且 payload 内包含 `status` / `error.message`，sidecar 必须原样转发该 payload，并把它作为终止错误返回给 forwarder，而不是继续等待到 `stream closed before response.completed`。
6. 给定上一轮响应有 `response.id=resp-1`，且下一轮 incremental input 满足上一轮 pending tool call output，sidecar 必须保留 incremental input 并注入 `previous_response_id=resp-1`，避免把 compact/tool output 请求展开成 stale transcript。
7. 给定上一轮仍有 pending tool call，但下一轮 input 没有对应 tool output，sidecar 不得注入 `previous_response_id`，必须走 transcript replacement，避免 upstream 接收不完整 incremental tool output。

### Evidence gate

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 Codex stream error -> Claude error tests |
| 当前代码事实 | fork `ConvertCodexResponseToClaude` 只处理 `response.*` 分支，没有 `type=error` 分支 |
| 预期红灯 | focused error tests 初始输出为空或缺 `event: error` |
| 红灯命令 | `go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude_Stream.*Error' -count=1` |
| 绿灯验收 | focused test、affected package test、full `go test ./... -count=1`、fork diff check、fork commit、clean sidecar rebuild |

### 当前子切片 Evidence gate：Responses WebSocket terminal/error payload

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 websocket terminal/error tests，覆盖 `response.done` 与 data channel inline `type=error` payload |
| 当前代码事实 | fork `forwardResponsesWebsocketWithOptions` 只在 `eventType == wsEventTypeCompleted` 时设置 `completed=true`；data channel 内 `wsEventTypeError` 只会被 `writeResponsesWebsocketPayload` 原样转发，不会转换成 `errMsg` 终止 |
| 可复现缺失 | 对 `response.done`：data channel 关闭后 `completed=false`，会写入 timeout error；对 `type=error`：payload 已转发但继续等待，最终返回 timeout 而不是 payload 内 status/message |
| 红灯命令 | `go test ./sdk/api/handlers/openai -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1` |
| 绿灯验收 | focused test、`go test ./sdk/api/handlers/openai -count=1`、fork diff check、fork `go test ./... -count=1`、fork commit、clean sidecar rebuild |
| 非目标 | 本 terminal/error 子切片不实现 pending tool call ID 返回链路；不改 previous_response_id 注入与 transcript replay；不改变 GetTokens route guard / live sessions / usage attribution 所有权 |

### 当前子切片 Evidence gate：Responses WebSocket incremental state

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 `previous_response_id` injection 与 pending tool call tracking tests |
| 当前代码事实 | fork `normalizeResponsesWebsocketRequestWithMode` 仅保留客户端已显式传入的 `previous_response_id`；forwarder 只保存 `lastResponseOutput`，不保存 `response.id` 或 pending tool call ids |
| 可复现缺失 | 当客户端下一轮只发送 `function_call_output` 且没有显式 `previous_response_id` 时，当前 fork 会把 `lastRequest + lastResponseOutput + nextInput` 合并成完整 transcript，而不是发送 incremental input + `previous_response_id` |
| 红灯命令 | `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseID|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls' -count=1 -timeout 30s` |
| 绿灯验收 | focused tests、全仓 focused selector、fork diff check、fork commit、clean sidecar rebuild |
| 非目标 | 不做 XAI passthrough；不改 model routing / auth scheduler；不改 compact replay 大逻辑；不改 Wails/front-end |

### 实现记录

- 红灯：focused error tests 初始失败，输出为空，缺 `event: error`。
- 实现：新增 `type=error` 分支，把 Codex stream error 映射为 Claude SSE `event: error`；`cyber_policy` / `invalid_request` 规范为 `invalid_request_error`；message 缺失时按 `message -> code -> error_type` fallback。
- 绿灯：focused error tests、`go test ./internal/translator/codex/claude -count=1`、fork `git diff --check`、fork `go test ./... -count=1`、staged `git diff --cached --check` 均通过。
- dev App：本切片只改 translator response 结构，不改 Wails binding、native runtime、sidecar process lifecycle、management API、route guard、usage attribution 或 live sessions；按 AGENTS 第 26 条，本轮不启动真实 dev App。

### 当前子切片实现记录：Responses WebSocket terminal/error payload

- 红灯：focused tests 初始失败；`response.done` 路径返回 `stream closed before response.completed`，inline `type=error` 路径返回 408 timeout 而不是 payload 内 429 / `upstream failed`。初始测试 harness 使用 `httptest.NewServer` 时受当前 sandbox 端口监听限制，已改为 `net.Pipe` + gorilla upgrader 的真实 WebSocket 握手以保证测试可执行。
- 实现：新增 `wsEventTypeDone` 与 `isResponsesWebsocketCompletionEvent`，让 `response.done` 与 `response.completed` 一样设置完成状态并捕获 output；新增 `responsesWebsocketErrorMessageFromPayload`，对 data channel 内 `type=error` 原样转发后按 payload `status` / `status_code` / `error.message` / `message` 生成终止 `errMsg`。
- 绿灯：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1 -timeout 30s` 通过；`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1 -timeout 180s` 通过；fork `git diff --check` 与 staged `git diff --cached --check` 通过。
- 环境限制：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -count=1 -timeout 120s` 在当前受限 sandbox 失败于既有 `httptest.NewServer` 用例 `TestCodexModelRoutingResponsesHTTPDownstreamUpstreamSmoke` 的 `listen tcp6 [::1]:0: bind: operation not permitted`，不是本切片实现失败。
- fork commit：`66558927 fix(openai): honor responses websocket terminal payloads`。
- sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `66558927fb6044f44c43f59f633fed6f1e97cd65:clean:c7d586db8d16dd787296b05f8f4f39ea643309d926aa0e9edd919115a51b8187:darwin:arm64`，binary sha256 `08f7506ad944af5b24a693aba9b634d1c950d54f082f9d3e7929dcdd12d9db1e`。
- dev App：本切片只改 sidecar WebSocket forwarder 的协议终止判定，不改 Wails binding、native runtime、App lifecycle、菜单栏、LaunchServices 或前端；按 AGENTS 第 26 条，自动化测试 + sidecar rebuild 为主要验收，真实 dev App 手点不作为硬门槛。

### 当前子切片实现记录：Responses WebSocket incremental state

- 红灯：focused tests 初始 build failed，缺 `normalizeResponsesWebsocketRequestWithLastResponseID`、`normalizeResponsesWebsocketRequestWithIncrementalState`、`recordPendingToolCallIDsFromPayload` 和 `sortedStringSet`，证明 fork 没有 incremental state 注入与 pending tool call tracking 入口。
- 实现：forwarder 保存 `lastResponseID` 与 `lastResponsePendingToolCallIDs`；completion payload 解析 `response.id`；payload output/item 更新 pending tool call 集合；normalize 在允许 incremental 且 pending tool outputs 满足时注入 `previous_response_id`，否则走 transcript replacement；保留现有 GetTokens dedupe、route guard、live session、usage attribution 边界。
- 绿灯：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseID|TestNormalizeResponsesWebsocketRequestSkipsPreviousResponseID|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls' -count=1 -timeout 30s` 通过；`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequest|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls|TestForwardResponsesWebsocketTreats' -count=1 -timeout 60s` 通过；`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'TestNormalizeResponsesWebsocketRequest|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls|TestForwardResponsesWebsocketTreats' -count=1 -timeout 180s` 通过；fork `git diff --check` 与 staged `git diff --cached --check` 通过。
- 环境限制：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -count=1 -timeout 120s` 在当前 sandbox 仍失败于既有 `httptest.NewServer` 用例 `TestCodexModelRoutingResponsesHTTPDownstreamUpstreamSmoke` 的 `listen tcp6 [::1]:0: bind: operation not permitted`，不是本切片实现失败。
- fork commit：`19fbddc4 fix(openai): track responses websocket incremental state`。
- sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `19fbddc44e54258f7ebc8e83ae92c69394eae853:clean:17808a42f6643e93d0485bc67e32d66b2853372cb3223690bc24d3485f59aefb:darwin:arm64`，binary sha256 `68fb0ff26b81252a3243cffe7bc9e7801f2474837d9fe675b2a80046af06176d`。
- dev App：本切片只改 sidecar WebSocket forwarder 的协议状态与 normalize 行为，不改 Wails binding、native runtime、App lifecycle、菜单栏、LaunchServices 或前端；按 AGENTS 第 26 条，自动化测试 + sidecar rebuild 为主要验收，真实 dev App 手点不作为硬门槛。

### 候选审计：Responses WebSocket input item ID dedupe

- 结论：already-satisfied-no-port。
- upstream 参考：v7.2.16 新增 duplicate input item id / referenced tool call dedupe tests。
- fork 事实：当前 fork 已有 `dedupeResponsesWebsocketInputRaw` / `dedupeResponsesWebsocketInputItems`，且测试覆盖保留最后 duplicate item、保留被 `function_call_output` 引用的 tool call，以及 repair 后 top-level input 去重。
- 验证：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeSubsequentRequestDedupesInputItemsByIDKeepingLast|TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs|TestRepairResponsesWebsocketToolCallsThenDedupesTopLevelInput' -count=1 -timeout 30s` 通过。
- 本候选没有红灯，不做 fork 代码改动、不新增 sidecar commit、不重建 sidecar。

### 候选审计：Responses WebSocket handler integration

- 结论：already-satisfied-no-port。
- upstream 参考：`TestResponsesWebsocketInjectsPreviousResponseIDForWebsocketUpstream`、`TestResponsesWebsocketDoesNotInjectPreviousResponseIDWhenPendingToolOutputMissing`、`TestResponsesWebsocketStripsGenerateWhenWebsocketAttemptFallsBackToHTTP`。
- fork 事实：`19fbddc4` 已把 `lastResponseID` / `lastResponsePendingToolCallIDs` 接入真实 `ResponsesWebsocket` handler；既有 `TestResponsesWebsocketPrewarmHandledLocallyForSSEUpstream` 覆盖 prewarm 后 follow-up 不泄漏 `previous_response_id` 与 `generate`；临时 no-listener handler tests 验证上一轮后已满足 upstream 三个场景。
- 临时验证：补入 `net.Pipe` 版 handler tests 后运行 `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocket(InjectsPreviousResponseIDForWebsocketUpstream|DoesNotInjectPreviousResponseIDWhenPendingToolOutputMissing)' -count=1 -timeout 30s` 通过；补入 `TestResponsesWebsocketStripsGenerateWhenWebsocketAttemptFallsBackToHTTP` 后同样通过。测试已撤回，避免在无红灯候选上制造 test-only commit。
- 本候选没有红灯，不做 fork 代码改动、不新增 fork commit、不重建 sidecar。

### 候选审计：Responses WebSocket passthrough / XAI executor

- 结论：defer-product-strategy-no-port。
- upstream 参考：`TestResponsesWebsocketCodexWebsocketPassthroughPassesCompactedRequestWithoutTranscriptMerge`、`TestResponsesWebsocketXAIWebsocketPassthroughCarriesPreviousResponseID`、`TestWebsocketUpstreamSupportsIncrementalInputForXAI`、`TestResponsesWebsocketUsesUpstreamWebsocketPassthroughForXAI`。
- fork 事实：GetTokens sidecar 已拥有 Codex WebSocket transport、route guard、live sessions、usage attribution、account selection 与 failover 证据链；`19fbddc4` 已在现有 handler 内满足 incremental state，不需要引入 upstream passthrough 分支。
- 延后原因：upstream passthrough 会改变 WebSocket 热路径所有权；XAI Responses WebSocket 是 provider/executor 策略能力，不是本期 response protocol bug fix。
- 后续入口：拆到 `model-catalog-compat` 或 `xai-antigravity-executor-compat`，先补产品需求、model catalog、fake upstream、route guard/live sessions/usage attribution 回归证据，再决定是否实现。
- 本候选不做 fork 代码改动、不新增 fork commit、不重建 sidecar。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260618-cliproxyapi-codex-response-v7216-hardening`
- worktree：`../GetTokens-worktrees/20260618-cliproxyapi-codex-response-v7216-hardening/`

## 相关链接

- Parent intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`
- Parent plan：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-intake-plan-v01.md`
- Translator hardening space：`docs-linhay/spaces/20260618-cliproxyapi-translator-protocol-hardening-v7216/README.md`

## 当前状态
- 状态：websocket-incremental-state-implemented; input-id-dedupe-already-satisfied; handler-integration-already-satisfied; passthrough-xai-deferred
- 最近更新：2026-06-18
