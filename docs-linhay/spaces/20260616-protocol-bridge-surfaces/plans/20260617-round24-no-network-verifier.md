# Protocol Bridge Round24: package-level no-network verifier

日期：2026-06-17

## 1. 本轮目标

为 `internal/protocolbridge` 增加一个沙箱可运行的 package-level no-network verifier，覆盖 Round23 的 `tools/list` / `resources/list` cursor 与 JSONL audit cursor 关键路径，同时绕开既有 `httptest.NewServer` 监听限制。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不运行需要监听端口的 `httptest` 场景。
- 不接真实 MCP client、外部 stdio process 或真实 sidecar transport。
- 不改变 list/audit cursor 语义；Round24 只补稳定 verifier 入口。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| Twenty-Fourth Dispatch | Protocol 要求 package-level verifier 或测试标签/脚本，沙箱中绕开既有 `httptest` 监听限制。 | 只新增 no-network focused verifier，不启动真实 sidecar endpoint。 |
| Round23 验证记录 | `go test -count=1 ./internal/protocolbridge` 在当前沙箱被既有 `httptest.NewServer` 监听 `[::1]:0` 拦截。 | verifier 必须避免执行 `sidecar_http_*_test.go` 中的监听用例。 |
| Round23 list/audit 实现 | list cursor 为 `pb-list-v1:<tools|resources>:<offset>`；audit cursor 为 `pb-audit-v1:<offset>`。 | verifier 必须覆盖 list 分页、wrong-kind/malformed cursor 拒绝，以及 audit cursor/offset 等价和裸数字拒绝。 |

## 3. BDD 场景

### 场景 A：no-network verifier 覆盖 `tools/list`

- Given verifier 使用 in-process `MCPStdioJSONRPCServer` 与 `StubOperationExecutor`。
- When `tools/list` 使用 `limit=2` 并继续使用 `nextCursor` 查询。
- Then 返回稳定 `pb-list-v1:tools:<offset>` cursor 和下一页 tool。
- And executor call count 保持 0。

### 场景 B：no-network verifier 覆盖 `resources/list`

- Given verifier 使用本地 MCP mapping fixture。
- When `resources/list` 使用 `limit=2` 并继续使用 `nextCursor` 查询。
- Then 返回稳定 `pb-list-v1:resources:<offset>` cursor 和剩余 resource。
- And wrong-kind list cursor 被 JSON-RPC invalid params 拒绝。

### 场景 C：no-network verifier 覆盖 audit cursor

- Given verifier 只写入 `t.TempDir()` 下的 JSONL audit 文件。
- When `JSONLAuditReader.Query` 使用 `limit=2`。
- Then 返回 `pb-audit-v1:2`。
- When 用该 cursor 查询。
- Then 返回与 `Offset=2` 等价的事件窗口。
- And `Cursor="2"` 被拒绝。

## 4. 最小实现计划

1. 新增 `docs-linhay/scripts/check-protocolbridge-no-network.mjs`：
   - 先用 `go test -tags protocolbridge_no_network -list '^TestProtocolBridgeNoNetworkVerifier$'` 确认 verifier 存在。
   - 再运行 `go test -count=1 -tags protocolbridge_no_network ./internal/protocolbridge -run '^TestProtocolBridgeNoNetworkVerifier$'`。
2. 新增 `internal/protocolbridge/no_network_verifier_test.go`：
   - 使用 `//go:build protocolbridge_no_network` 隔离为显式 verifier。
   - 只使用 in-process handler、stub executor、`t.TempDir()` JSONL。
   - 不导入 `net/http/httptest`，不监听端口。

## 5. 验证命令

```bash
node docs-linhay/scripts/check-protocolbridge-no-network.mjs
GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_no_network ./internal/protocolbridge -run '^TestProtocolBridgeNoNetworkVerifier$'
git diff --check -- internal/protocolbridge docs-linhay/scripts/check-protocolbridge-no-network.mjs docs-linhay/spaces/20260616-protocol-bridge-surfaces
```

本轮结果：

- 红灯：新增 `docs-linhay/scripts/check-protocolbridge-no-network.mjs` 后，`node docs-linhay/scripts/check-protocolbridge-no-network.mjs` 失败，原因是 `TestProtocolBridgeNoNetworkVerifier` 不存在；该失败只来自 verifier 缺失，没有触发监听或 sidecar endpoint。
- 绿灯：新增 `internal/protocolbridge/no_network_verifier_test.go` 后，`node docs-linhay/scripts/check-protocolbridge-no-network.mjs` 通过。
- 等价 focused Go：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_no_network ./internal/protocolbridge -run '^TestProtocolBridgeNoNetworkVerifier$'` 通过。
- Round23 focused 回归：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge -run 'TestMCPStdioJSONRPCHandler.*List|TestJSONLAuditReader'` 通过。
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh` 与 `git diff --check -- internal/protocolbridge docs-linhay/scripts/check-protocolbridge-no-network.mjs docs-linhay/spaces/20260616-protocol-bridge-surfaces` 通过。
- 全包限制复核：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge` 仍因既有 `sidecar_http_executor_factory_test.go` 中 `httptest.NewServer` 监听 `[::1]:0` 被沙箱拒绝；该失败未进入本轮 no-network verifier 路径。

## 6. 剩余风险

- 该 verifier 是 package-level focused gate，不替代非沙箱环境下的完整 `go test ./internal/protocolbridge`。
- audit cursor 仍映射 filtered latest-first offset，不解决 JSONL rotation / compaction 后跨文件稳定语义。
- list manifest 仍来自本地 MCP mapping fixture，不包含 dynamic `listChanged` 或完整 MCP annotations。
