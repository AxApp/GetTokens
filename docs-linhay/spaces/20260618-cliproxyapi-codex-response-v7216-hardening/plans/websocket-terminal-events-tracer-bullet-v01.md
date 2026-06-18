# Responses WebSocket terminal/error tracer bullet v01

## 背景

v7.2.16 upstream 对 OpenAI Responses WebSocket forwarder 增加了两类终止语义：

1. `response.done` 与 `response.completed` 一样代表完成，不应被改写，也不应在 data channel 关闭后追加 timeout error。
2. data channel 内联 `type=error` payload 已经是 upstream 返回给客户端的终止错误，sidecar 应原样转发，并把 payload 中的 status/message 作为 forwarder 错误返回。

GetTokens sidecar 当前只认 `response.completed` 为完成事件；`type=error` payload 只会被原样转发，不会短路终止。这会让已完成或已失败的 upstream websocket 响应在关闭时被误判成 `stream closed before response.completed`。

## BDD 场景

### 场景 1：`response.done` 原样终止

- Given upstream websocket data channel 发送 `{"type":"response.done","response":{"id":"resp-1","output":[{"type":"message","id":"out-1"}]}}`
- When sidecar forwarder 把 payload 写给下游 websocket client
- Then 下游收到的 payload type 仍为 `response.done`
- And forwarder 捕获 completed output `out-1`
- And data channel 关闭后不写入 timeout error

### 场景 2：内联 `type=error` payload 终止

- Given upstream websocket data channel 发送 `{"type":"error","status":429,"error":{"message":"upstream failed"}}`
- When sidecar forwarder 把 payload 写给下游 websocket client
- Then 下游收到的 payload type 仍为 `error`
- And forwarder 返回 `StatusCode=429`
- And forwarder error message 包含 `upstream failed`
- And forwarder 不继续等待到 synthetic timeout

## Evidence gate

| 项目 | 证据 |
| --- | --- |
| upstream source | canonical v7.2.16 `sdk/api/handlers/openai/openai_responses_websocket_test.go` 中 `TestForwardResponsesWebsocketTreatsResponseDoneAsTerminalWithoutRewriting` 与 `TestForwardResponsesWebsocketTreatsErrorPayloadAsTerminal` |
| fork code fact | `forwardResponsesWebsocketWithOptions` 只在 `eventType == wsEventTypeCompleted` 时设置完成；没有 `wsEventTypeDone`；没有 data-channel payload error -> `interfaces.ErrorMessage` 解析 |
| 红灯证明 | 新增同名 focused tests 后，当前 fork 应分别失败于收到 timeout/error payload 或 `errMsg.StatusCode` 不等于 429 |
| 验收命令 | `go test ./sdk/api/handlers/openai -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1` |
| 扩展验收 | `go test ./sdk/api/handlers/openai -count=1`、`go test ./... -count=1`、`git diff --check`、clean sidecar rebuild |

## 实施记录

- 红灯事实：`response.done` focused test 初始返回 `stream closed before response.completed`；inline `type=error` focused test 初始返回 408 timeout，未保留 payload 内 429 / `upstream failed`。
- 测试 harness：当前 sandbox 禁止 localhost bind，新增测试使用 `net.Pipe` single-connection listener + gorilla websocket upgrader，仍走真实 HTTP/WebSocket 握手但不占用端口。
- 最小实现：`response.done` 纳入 completion event；inline `type=error` payload 写给下游后立刻转换为 `interfaces.ErrorMessage` 并终止 forwarder。
- 绿灯命令：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1 -timeout 30s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'TestForwardResponsesWebsocketTreats(ResponseDoneAsTerminalWithoutRewriting|ErrorPayloadAsTerminal)' -count=1 -timeout 180s`
  - `git diff --check`
- 限制记录：`go test ./sdk/api/handlers/openai -count=1 -timeout 120s` 在当前 sandbox 失败于既有 `httptest.NewServer` 监听限制，失败点不是本切片新增测试或实现。
- fork commit：`66558927 fix(openai): honor responses websocket terminal payloads`。
- sidecar fingerprint：`66558927fb6044f44c43f59f633fed6f1e97cd65:clean:c7d586db8d16dd787296b05f8f4f39ea643309d926aa0e9edd919115a51b8187:darwin:arm64`。

## 实施边界

- 只在 GetTokens fork `gettokens/sidecar` 内做窄实现。
- 不 full-merge upstream，不 cherry-pick 大提交。
- 不改 route guard、account selection、rate-limit、live sessions、usage attribution、system proxy。
- 不实现 upstream 当前更大的 previous_response_id / pending tool call ID / XAI passthrough 变更。
- `/Applications/GetTokens.app` 正式版不触碰。
