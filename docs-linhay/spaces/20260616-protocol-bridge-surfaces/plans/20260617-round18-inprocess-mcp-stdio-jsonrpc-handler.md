# Protocol Bridge Round18: in-process MCP stdio JSON-RPC handler

日期：2026-06-17

## 1. 本轮目标

在既有 `MCPAdapter` / `Runtime` / `MCPStdioPreflight` / `OperationExecutor` 语义上，补一个最小 in-process MCP stdio JSON-RPC handler/server tracer：

- 读取 JSON-RPC request。
- 支持 `tools/call` 与 `resources/read`。
- `tools/call` 复用既有链路：`Runtime.Authorize -> MCPStdioPreflight -> OperationExecutor`。
- `resources/read` 只返回 mapping fixture 中声明的 resource URI。
- 测试使用 in-memory reader/writer，不启动外部 stdio 进程。

本轮不做：

- 不启动真实 MCP server 子进程。
- 不接真实 sidecar endpoint。
- 不新增 audit persistence。
- 不修改 Extension / Route / Doctor / Quota。
- 不把 handler 做成完整 MCP lifecycle、capabilities negotiation 或 process manager。

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮的约束 |
| --- | --- | --- |
| `internal/protocolbridge.MCPAdapter` | 已有 tool/resource handler，tool 先 authorize，成功后 stdio preflight，再 executor。 | JSON-RPC handler 必须是薄层，不能重新实现或绕过 adapter 链路。 |
| `MCPStdioPreflight` round14-round17 | 已覆盖 mapping allowlist、credential-bearing input、schema 外 query、required/type/enum gate。 | handler 只能把 `tools/call.params.arguments` 映射为 canonical query，仍由 preflight 拒绝非法输入。 |
| `OperationExecutor` contract | executor 可 fake，成功结果分 read envelope / accepted action ref。 | 本轮测试只用 `StubOperationExecutor`，不接真实 sidecar。 |
| 用户本轮边界 | 写入面限制为 `internal/protocolbridge/**` 与 protocol space 文档。 | 不改 Wails/root/frontend/sidecar reference，不写其它 space。 |

## 3. BDD 场景

### 场景 A：`tools/call` 走完整授权与执行链

- Given in-process JSON-RPC request 使用 `method=tools/call`。
- And stdio session 提供 bridge client/token/caller。
- When tool name 映射到 canonical operation 且 query 满足 preflight。
- Then handler 返回 JSON-RPC `result`，其中 bridge envelope 为 `status=ok`。
- And executor 收到授权后的 actor、`TransportMCP` 与 canonical query。

### 场景 B：`resources/read` 只能读 mapping fixture URI

- Given JSON-RPC request 使用 `method=resources/read`。
- When URI 是 `gettokens://bridge/manifest`。
- Then 返回 resource mapping metadata。
- When URI 是 mapping 外的 `gettokens://bridge/token-hash`。
- Then 返回 canonical `invalid_request` rejected envelope。
- And `sidecar_invoked=false`。

### 场景 C：credential-bearing input 与 schema 外 query 在 executor 前拒绝

- Given `tools/call.params.arguments` 含 `headers.Authorization` 或 schema 外字段。
- When handler 调用 adapter。
- Then adapter 返回 canonical `invalid_request`。
- And executor call count 保持 0。
- And JSON-RPC response 不回显 bearer token、header、cookie。

### 场景 D：executor 错误响应不回显 token/header/cookie

- Given executor 返回 canonical error，但 message 或 sidecar error code 带 Authorization/Cookie/header 语义。
- When handler 返回 JSON-RPC `result`。
- Then bridge error 仍为 canonical rejected envelope。
- And response 不包含原 token、Authorization header、Cookie 或 secret-like sidecar error code。

## 4. 最小实现

1. 新增 `MCPStdioJSONRPCSession`：在 in-process stdio 会话边界绑定 client/token/caller，不从 JSON-RPC params 读取 credential。
2. 新增 `MCPStdioJSONRPCServer`：
   - `Serve(ctx, reader, writer)` 循环读取 JSON 值；
   - `ServeOne(ctx, reader, writer)` 便于测试单条 request；
   - `tools/call` 参数为 `name / arguments / request_id / idempotency_key`；
   - `resources/read` 参数为 `uri / request_id`。
3. JSON-RPC method 外的 parse/invalid/method-not-found 错误只返回 JSON-RPC error；bridge 业务拒绝继续放在 JSON-RPC `result` 中的 canonical envelope。
4. 收紧 `executorErrorToMCPToolResponse`：executor/canonical error message 先走 sidecar text redaction；credential/header/token/cookie/secret-like `sidecar_error_code` 不投影到 response。

## 5. 已证明链路

- `tools/call` JSON-RPC request -> `MCPAdapter.HandleTool` -> `Runtime.Authorize` -> `MCPStdioPreflight` -> `StubOperationExecutor`。
- `resources/read` JSON-RPC request -> `MCPAdapter.HandleResource` -> mapping fixture resource allowlist。
- preflight 拒绝时 executor 不被调用。
- executor 错误和 preflight 错误的 JSON-RPC response 不回显测试中注入的 token/header/cookie 片段。

## 6. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
```

## 7. 剩余风险

- 这仍不是完整 MCP stdio server lifecycle：未实现 `initialize`、capabilities negotiation、progress/cancel、stream framing 兼容矩阵或子进程管理。
- 这不证明真实 sidecar endpoint 可用；executor 仍可由 fake/stub 驱动。
- `Serve` 当前按 JSON value 流循环解码，适合 in-process tracer 与测试；真实 stdio framing、日志隔离和 stderr/stdout 污染处理仍需后续切片。
- JSON-RPC error 只做最小 method/params 错误；bridge 业务错误仍在 canonical envelope 内表达，后续若对接具体 MCP client，可能需要增加 MCP content/result shape adapter。
