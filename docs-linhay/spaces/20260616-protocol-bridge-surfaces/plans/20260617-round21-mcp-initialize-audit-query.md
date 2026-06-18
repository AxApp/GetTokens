# Protocol Bridge Round21: MCP initialize and audit query

日期：2026-06-17

## 1. 本轮目标

在 Round18-20 的 in-process / external stdio skeleton 与 JSONL audit sink 基础上，补两个最小闭环：

- MCP JSON-RPC handler 支持 `initialize`，返回 protocol version、server info 与最小 `tools` / `resources` capabilities。
- JSONL audit sink 增加只读 query/read API，支持 `limit`、`kind`、`status` 等最小过滤。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不接真实 MCP 客户端或真实外部 stdio server。
- 不实现并发 request、progress/cancel、audit rotation、fsync、batch flush、retry 或 schema migration。
- 不修改 Extension / Route / Doctor / Quota / Wails / frontend。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| Round18 `MCPStdioJSONRPCServer` | 只支持 `tools/call` 和 `resources/read`，`initialize` 会返回 method not found。 | 只补 minimal initialize/capabilities，不绕过 adapter，也不触 executor。 |
| Round20 `MCPExternalStdioProcess` | fake helper process 已可做 JSON-RPC round trip。 | initialize 验证仍只用 in-process handler / helper process，不启动真实 sidecar。 |
| Round20 `JSONLAuditSink` | 只能 append JSONL，不能读取或过滤。 | 新增只读 reader/query，读取本地临时 JSONL，过滤仅使用已脱敏 `AuditEvent` 字段。 |
| 用户边界 | 写入面限定为 `internal/protocolbridge/**`、protocol space README 和本计划。 | 不碰其他 space、memory、AGENTS 或正式版数据。 |

## 3. BDD 场景

### 场景 A：`initialize` 返回 MCP 最小 capabilities

- Given in-process JSON-RPC request 使用 `method=initialize`。
- When handler 收到请求。
- Then response 是 JSON-RPC `result`。
- And result 包含 `protocolVersion`、`serverInfo.name=gettokens-protocol-bridge`。
- And capabilities 至少声明 `tools` 与 `resources`。
- And 不调用 `OperationExecutor`，不触 sidecar。

### 场景 B：JSONL audit reader 按 status / kind / limit 查询

- Given JSONL 文件内已有 `ok` / `rejected` 与 read / safe action 多类 event。
- When query 使用 `status=rejected`、`kind=read`、`limit=1`。
- Then 只返回符合条件的最新一条 event。
- And 返回对象仍是已脱敏 `AuditEvent`，不包含 raw token、Authorization、Cookie、query 或 URI。

### 场景 C：坏行不阻断最小可读性

- Given JSONL 文件中夹杂一行 malformed JSON。
- When query 读取文件。
- Then reader 跳过坏行并返回可解析 event。
- And 可通过 skipped line count 暴露数据质量风险。

## 4. 最小实现计划

1. 为 `MCPStdioJSONRPCServer.handle` 增加 `initialize` 分支，返回固定 minimal `MCPInitializeResponse`。
2. 新增 `JSONLAuditReader` / `JSONLAuditQuery` / `JSONLAuditQueryResult`：
   - `Limit` 控制返回数量，默认全部，负数按 invalid query 拒绝。
   - `Kind` 支持 `read` / `safe_action`，基于 `operationSpecs` 派生，不新增独立 truth。
   - `Status` 支持现有 `Status` 字段精确匹配。
   - 读取时跳过空行与坏行，并记录 `SkippedLines`。
3. 测试只使用 `t.TempDir()` JSONL 与 fake/in-process handler。

## 5. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces
```

结果：

- `go test -count=1 ./internal/protocolbridge`：通过。
- `git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces`：通过；该命令不覆盖未跟踪文件。
- `rg -n "[[:blank:]]+$" internal/protocolbridge/audit_jsonl.go internal/protocolbridge/audit_jsonl_test.go internal/protocolbridge/mcp_stdio_server.go internal/protocolbridge/mcp_stdio_server_test.go docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md docs-linhay/spaces/20260616-protocol-bridge-surfaces/plans/20260617-round21-mcp-initialize-audit-query.md`：无匹配。

## 6. 剩余风险

- MCP initialize 仍是 minimal negotiation，不包含 client capability 协商、notifications/initialized、tools/list、resources/list 或 stdio framing 兼容矩阵。
- JSONL query 是本地文件只读 API，没有 rotation / compaction / size cap；文件增长控制仍属于后续 ledger bounds 切片。
- `kind` 过滤基于当前 `operationSpecs` 的 read / safe_action 类型，后续新增内部 MCP resource audit kind 时需要显式扩展。
