# Responses WebSocket incremental state tracer bullet v01

## 背景

v7.2.16 upstream 对 OpenAI Responses WebSocket v2 增加了 incremental state 保护：

1. `response.completed` / `response.done` 中的 `response.id` 需要保存为下一轮可用的 `previous_response_id`。
2. forwarder 需要记录上一轮响应中尚未被 output 满足的 function/custom tool call ids。
3. 下一轮 input 如果包含对应 `function_call_output` / `custom_tool_call_output`，可以发送 incremental input + `previous_response_id`。
4. 如果 pending tool output 缺失，不应注入 `previous_response_id`，而应走 transcript replacement，避免把不完整 incremental 请求发给 upstream。

GetTokens fork 当前只保存 `lastResponseOutput`，且 normalize 只保留客户端显式传入的 `previous_response_id`。这会让本可 incremental 的 tool output 请求被展开成 stale merged transcript，也会让缺失 pending output 的请求缺少明确保护边界。

## BDD 场景

### 场景 1：上次 response id 可注入

- Given 上一轮 request 有 model / instructions
- And 上一轮 response id 是 `resp-1`
- And 下一轮 input 是满足上一轮 tool call 的 `function_call_output`
- When normalize 下一轮 `response.create`
- Then normalized request 保留单项 incremental input
- And 注入 `previous_response_id=resp-1`
- And 补齐 model / instructions / stream

### 场景 2：pending tool output 满足时才注入

- Given 上一轮 pending tool call ids 包含 `call-1`
- And 下一轮 input 包含 `function_call_output.call_id=call-1`
- When normalize 下一轮 `response.create`
- Then 注入 `previous_response_id=resp-1`

### 场景 3：pending tool output 缺失时不注入

- Given 上一轮 pending tool call ids 包含 `call-1`
- And 下一轮 input 只有普通 message，没有对应 tool output
- When normalize 下一轮 `response.create`
- Then 不注入 `previous_response_id`
- And 走 transcript replacement，避免 upstream 接收不完整 incremental input

### 场景 4：已满足的 pending call 被移除

- Given 一个 response payload 同时包含 `function_call` 与对应 `function_call_output`
- When 记录 pending tool call ids
- Then pending 集合为空

## Evidence gate

| 项目 | 证据 |
| --- | --- |
| upstream source | canonical v7.2.16 `openai_responses_websocket_test.go` 中 `TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseIDForIncremental`、`TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseIDWhenPendingOutputIsPresent`、`TestNormalizeResponsesWebsocketRequestSkipsPreviousResponseIDWhenPendingOutputIsMissing`、`TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls` |
| fork code fact | fork 只在 raw JSON 已有 `previous_response_id` 时保留 incremental；forward result 没有 response id / pending tool call ids |
| 红灯证明 | 新增 focused tests 后，当前 fork 会缺少 helper / 不注入 `previous_response_id` / pending tracking helper 不存在 |
| 验收命令 | `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseID|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls' -count=1 -timeout 30s` |

## 实施记录

- 红灯事实：focused tests 初始 build failed，缺 `normalizeResponsesWebsocketRequestWithLastResponseID`、`normalizeResponsesWebsocketRequestWithIncrementalState`、`recordPendingToolCallIDsFromPayload` 和 `sortedStringSet`。
- 最小实现：
  - forwarder 保存 `lastResponseID` 与 `lastResponsePendingToolCallIDs`。
  - completion payload 解析 `response.id`。
  - payload `item` 与 `response.output` 中的 function/custom tool call 增加 pending，function/custom tool output 删除 pending。
  - normalize 在 incremental mode 下，如果 pending tool outputs 已满足，则注入 `previous_response_id` 并保留单项 incremental input；如果 pending output 缺失，则走 transcript replacement。
  - 保留当前 fork 的 dedupe、request logging、live session、route guard 与 usage attribution 逻辑。
- 绿灯命令：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequestInjectsPreviousResponseID|TestNormalizeResponsesWebsocketRequestSkipsPreviousResponseID|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls' -count=1 -timeout 30s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeResponsesWebsocketRequest|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls|TestForwardResponsesWebsocketTreats' -count=1 -timeout 60s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'TestNormalizeResponsesWebsocketRequest|TestRecordPendingToolCallIDsFromPayloadDropsSatisfiedCalls|TestForwardResponsesWebsocketTreats' -count=1 -timeout 180s`
  - `git diff --check`
- 限制记录：当前 sandbox 禁止 localhost bind，`go test ./sdk/api/handlers/openai -count=1 -timeout 120s` 仍失败于既有 `httptest.NewServer` smoke，不是本切片失败。
- fork commit：`19fbddc4 fix(openai): track responses websocket incremental state`。
- sidecar fingerprint：`19fbddc44e54258f7ebc8e83ae92c69394eae853:clean:17808a42f6643e93d0485bc67e32d66b2853372cb3223690bc24d3485f59aefb:darwin:arm64`。

## 实施边界

- 只在 GetTokens fork `gettokens/sidecar` 内窄实现。
- 不 full-merge upstream，不 cherry-pick 大提交。
- 保留 GetTokens route guard、account selection、rate-limit、live sessions、usage attribution、system proxy 所有权。
- 不做 XAI WebSocket passthrough 和 upstream model/router 大改。
- `/Applications/GetTokens.app` 正式版不触碰。
