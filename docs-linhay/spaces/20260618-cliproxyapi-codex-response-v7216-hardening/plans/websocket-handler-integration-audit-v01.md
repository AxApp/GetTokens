# Responses WebSocket handler integration audit v01

## 背景

v7.2.16 upstream 在 unit-level normalize / forwarder tests 之外，还补了真实 `ResponsesWebsocket` handler 路径验证：

- websocket-capable upstream 第二轮请求应注入上次 `response.id` 为 `previous_response_id`。
- 上一轮仍有 pending tool call 且下一轮缺少对应 output 时，不应注入 `previous_response_id`。
- websocket-capable auth 首次尝试失败并 fallback 到 HTTP auth 时，第一次 websocket payload 保留 `generate=false`，fallback payload 必须去掉 `generate`。

## 审计过程

当前 sandbox 禁止 `httptest.NewServer` 监听端口，因此审计使用临时 `net.Pipe` + gorilla upgrader handler tests，不占用 localhost 端口。

临时验证结果：

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocket(InjectsPreviousResponseIDForWebsocketUpstream|DoesNotInjectPreviousResponseIDWhenPendingToolOutputMissing)' -count=1 -timeout 30s
```

结果：通过。

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run TestResponsesWebsocketStripsGenerateWhenWebsocketAttemptFallsBackToHTTP -count=1 -timeout 30s
```

结果：通过。

## 结论

- 状态：already-satisfied-no-port。
- `19fbddc4` 已接入真实 handler 所需的 `lastResponseID` / pending tool call state。
- 既有 prewarm/fallback 逻辑已经清理 HTTP fallback payload 中的 `generate`。
- 因没有红灯证据，临时测试已撤回，不做代码改动，不新增 fork commit，不重建 sidecar。

## 非目标

- 不引入 XAI passthrough。
- 不改 model router / auth scheduler。
- 不触碰 Wails、前端或正式版 `/Applications/GetTokens.app`。
