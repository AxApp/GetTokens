# Protocol Bridge Round22: tools/resources list and audit pagination

日期：2026-06-17

## 1. 本轮目标

在 Round21 minimal `initialize` 和 JSONL audit query 基础上，补齐两个小闭环：

- MCP stdio JSON-RPC handler 支持 minimal `tools/list` 与 `resources/list`，只从本地 MCP mapping fixture 投影声明，不触发 executor 或真实 sidecar。
- JSONL audit reader 增加 cursor / offset pagination，避免后续 UI 或管理面一次性读取全部 audit event。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不接真实 MCP 客户端或真实外部 stdio server。
- 不做 audit rotation、compaction、fsync、batch flush、schema migration 或真实 ledger DB。
- 不修改 Extension / Route / Doctor / Quota / Wails / frontend。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| Round21 README / 计划 | 下一步明确缺 `tools/list`、`resources/list`，`initialize` 仅声明 capabilities。 | 只补 list response，让 capabilities 有可查询的本地声明。 |
| `MCPStdioJSONRPCServer` | 目前只处理 `initialize`、`tools/call`、`resources/read`。 | `tools/list` / `resources/list` 不应调用 `OperationExecutor`，也不进入 sidecar。 |
| `MCPAdapterMapping` fixture | 已包含 tool/resource 映射、scope、schema ref 和 resource URI。 | list response 只能投影这些本地 manifest 字段，不新增 bridge truth。 |
| `JSONLAuditReader` | 现有 query 支持 `status`、`kind`、`limit`，按最新事件优先返回。 | 在保持既有过滤语义基础上增加 `offset` 与 opaque numeric cursor。 |
| 用户边界 | 写入面限定为 `internal/protocolbridge/**`、本 README 和本计划。 | 不碰其他 dirty 文件，不启动正式版或 dev sidecar。 |

## 3. BDD 场景

### 场景 A：`tools/list` 返回本地 tool manifest

- Given in-process JSON-RPC request 使用 `method=tools/list`。
- When handler 收到请求。
- Then response 是 JSON-RPC `result.tools`。
- And tools 至少包含 `gettokens.accounts.summary`。
- And tool metadata 包含 canonical operation、required scope 与 query schema ref。
- And 不调用 `OperationExecutor`，不触 sidecar。

### 场景 B：`resources/list` 返回本地 resource manifest

- Given in-process JSON-RPC request 使用 `method=resources/list`。
- When handler 收到请求。
- Then response 是 JSON-RPC `result.resources`。
- And resources 至少包含 `gettokens://bridge/manifest`。
- And resource metadata 只包含 mapping fixture 中的 name、uri、kind、source、exposes。
- And 不调用 `OperationExecutor`，不触 sidecar。

### 场景 C：audit query 支持 offset 翻页

- Given JSONL 文件中存在多条 read audit event。
- When query 使用 `limit=2`。
- Then 返回最新两条，并给出 `next_cursor=2`、`has_more=true`。
- When 再用 `offset=2` 查询。
- Then 返回下一页事件。

### 场景 D：audit query 支持 cursor 翻页

- Given 第一页 query 返回 `next_cursor`。
- When 第二页 query 使用该 cursor。
- Then 返回与等价 offset 相同的事件窗口。
- And malformed cursor 或负 offset 被拒绝。

## 4. 最小实现计划

1. 为 `MCPStdioJSONRPCServer.handle` 增加 `tools/list` 与 `resources/list` 分支。
2. 新增 list response DTO：
   - tool: `name`、`canonical_operation`、`type`、`required_scope`、`query_schema_ref`、`requires_idempotency_key`。
   - resource: 复用安全的 `MCPResourceMapping` 字段。
3. 扩展 `JSONLAuditQuery` / `JSONLAuditQueryResult`：
   - `Offset int`：按 filtered latest-first event window 跳过 N 条。
   - `Cursor string`：opaque numeric cursor，等价于 offset。
   - `NextCursor string`、`HasMore bool`、`Offset int`：返回下一页提示。
   - `Limit=0` 保持既有“返回全部匹配”语义。
4. 测试只使用本地 mapping fixture / fake executor / temp JSONL。

## 5. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces
```

结果：

- 红灯：新增测试后 `go test -count=1 ./internal/protocolbridge` 先因 `JSONLAuditQuery.Offset/Cursor` 与 `JSONLAuditQueryResult.NextCursor/HasMore` 缺失编译失败，证明 pagination 缺口存在。
- 绿灯：`go test -count=1 ./internal/protocolbridge` 通过。

## 6. 剩余风险

- `tools/list` / `resources/list` 仍是 minimal manifest 投影，不包含完整 MCP annotations、pagination 或 dynamic list changed notification。
- audit cursor 当前是本地 numeric offset cursor，不具备跨 rotation / compaction 的稳定 ledger cursor 语义。
- JSONL reader 仍需要扫描本地文件后翻页；大文件 bounds、rotation、compaction 属于后续 ledger 切片。
