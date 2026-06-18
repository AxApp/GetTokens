# Protocol Bridge Round19: stdio lifecycle wrapper and audit persistence skeleton

日期：2026-06-17

## 1. 本轮目标

在既有 in-process JSON-RPC handler 基础上，补 protocol bridge 内部的 stdio lifecycle wrapper 与可注入 audit persistence skeleton：

- wrapper 能 `Serve` / `Shutdown`。
- context cancel 后能停止阻塞中的 stdio serve。
- malformed JSON-RPC request 只返回通用 parse error，不回显 token、header、cookie。
- audit persistence 可注入，成功 tool call、preflight rejection、resource rejection 都会尝试写入 audit event。
- 测试只使用 in-memory pipe / fake executor，不启动真实外部 sidecar，不连接真实 endpoint。

本轮不做：

- 不启动 MCP / sidecar 外部进程。
- 不实现完整 MCP initialize / capabilities negotiation。
- 不修改 Extension / Route / Doctor / Quota。
- 不新增真实持久层 schema 或落盘实现。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| `internal/protocolbridge.MCPStdioJSONRPCServer` | round18 已支持 in-process `tools/call` / `resources/read` 分发。 | lifecycle wrapper 必须包在现有 handler 外层，不重写 adapter 链路。 |
| `MCPAdapter` | tool path 已有 `AuditPersister` option；resource path 只有 projection，没有持久化事件。 | 只补可注入 skeleton 和测试，不做真实数据库/ledger。 |
| `MCPStdioPreflight` | credential-bearing input / schema 外字段会在 executor 前拒绝。 | preflight rejection 的 audit event 不能携带 query/token/header/cookie。 |
| 用户边界 | 本轮写入面限制为 `internal/protocolbridge/**` 与 protocol space 文档。 | 不改 Wails/root/frontend/sidecar reference。 |

## 3. BDD 场景

### 场景 A：context cancel 停止 stdio serve

- Given lifecycle wrapper 正在 `Serve` 一个阻塞中的 reader。
- When 上游 context cancel。
- Then wrapper 关闭可关闭 reader，使 `Serve` 返回。
- And 取消后再写入 pipe 会失败。

### 场景 B：Shutdown 停止运行中的 serve

- Given lifecycle wrapper 已进入 running 状态。
- When 调用 `Shutdown(ctx)`。
- Then wrapper cancel 当前 serve 并等待退出。
- And 不启动任何外部进程。

### 场景 C：malformed request 不泄密

- Given malformed JSON-RPC payload 内含 `Authorization: Bearer ...` 类文本。
- When handler 返回 JSON-RPC parse error。
- Then response 只包含 `parse error`，不包含 token、Authorization、Cookie 或 bearer 内容。

### 场景 D：audit persistence skeleton 覆盖三类结果

- Given 注入 `AuditPersister` fake。
- When successful tool call 完成。
- Then audit event 以 `status=ok` 写入，包含 sidecar request ref。
- When tool query 被 stdio preflight 拒绝。
- Then audit event 以 `status=rejected / error=invalid_request` 写入，executor call count 为 0。
- When resource read 被 allowlist 拒绝。
- Then resource rejection 也会尝试写入 audit event，且不持久化 raw URI 中可能出现的 secret-like material。

## 4. 最小实现

1. 新增 `MCPStdioLifecycleWrapper`：
   - `Serve(ctx, reader, writer)` 绑定单个 running session。
   - context cancel / `Shutdown` 会关闭实现了 `io.Closer` 的 reader/writer，以解除阻塞 decode。
   - `Running()` 仅用于生命周期观察和测试。
2. 收紧 `MCPStdioJSONRPCServer.Serve`：
   - 每轮 decode 前检查 context。
   - reader 因 cancel/shutdown 关闭时返回 context error，不把关闭误报为 malformed payload。
3. 扩展 `MCPResourceResponse` 内部 audit skeleton：
   - 增加内部 `AuditEvent` 字段，`json:"-"`，不暴露给 JSON-RPC 客户端。
   - allowed resource / resource preflight rejection / resource unknown 均尝试 `persistAudit`。
   - resource audit event 只记录 `mcp-resource` 目标引用，不记录 raw URI。

## 5. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
```

结果：通过。

## 6. 剩余风险

- 这是 lifecycle wrapper skeleton，不是完整 MCP stdio daemon/process manager。
- `Shutdown` 通过关闭可关闭 reader/writer 解除阻塞；真实 stdio 进程边界仍需要后续 selector / runner 切片定义。
- audit persistence 仍是接口注入和 fake 测试，不包含真实 ledger/DB schema、重试、批量 flush 或后台队列。
- resource audit event 当前没有 client/token 上下文，后续若 resource read 需要授权客户端身份，应扩展 request/session 结构而不是从 JSON-RPC params 读取 credential。
