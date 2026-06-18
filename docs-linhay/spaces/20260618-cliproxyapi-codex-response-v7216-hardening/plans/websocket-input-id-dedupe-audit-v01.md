# Responses WebSocket input item ID dedupe audit v01

## 背景

v7.2.16 upstream 对 Responses WebSocket input item dedupe 增加了测试，重点是：

- 合并 stale transcript 时丢弃重复 `id` 的旧 input item。
- 如果两个 tool call item 共享同一个 `id` 但 `call_id` 不同，必须保留被 `function_call_output` / `custom_tool_call_output` 引用的那个 call，避免 output orphan。
- repair 后 top-level input 也要去重。

## fork 现状

当前 GetTokens fork 已有同等语义：

- `dedupeResponsesWebsocketInputRaw`：按 `id` 去重，默认保留后出现的 item。
- 同时扫描 tool output 的 `call_id`，当 duplicate id 的 tool call 中有一个被 output 引用时，优先保留被引用的 call。
- `repairResponsesWebsocketToolCallsThenDedupe`：repair 后调用 top-level input dedupe。

现有测试覆盖：

- `TestNormalizeSubsequentRequestDedupesInputItemsByIDKeepingLast`
- `TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs`
- `TestRepairResponsesWebsocketToolCallsThenDedupesTopLevelInput`

## 验证命令

```bash
GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/api/handlers/openai -run 'TestNormalizeSubsequentRequestDedupesInputItemsByIDKeepingLast|TestNormalizeSubsequentRequestKeepsReferencedToolCallWhenDedupingInputIDs|TestRepairResponsesWebsocketToolCallsThenDedupesTopLevelInput' -count=1 -timeout 30s
```

结果：通过。

## 结论

- 状态：already-satisfied-no-port。
- 不新增红灯测试：已有等价 fork tests 直接覆盖 upstream 行为。
- 不做代码改动。
- 不新增 fork commit。
- 不重建 sidecar。
