# Protocol Bridge Round23: list pagination and stable audit cursor

日期：2026-06-17

## 1. 本轮目标

在 Round22 minimal `tools/list` / `resources/list` 与 JSONL audit pagination 基础上补两个稳定性缺口：

- `tools/list` / `resources/list` 支持本地 cursor / limit 翻页，只从 MCP mapping fixture 投影声明，不调用 executor 或真实 sidecar。
- JSONL audit reader 的 cursor 从裸 offset 字符串收敛为带前缀和版本的稳定 token，同时保留 `Offset` 字段作为本地兼容入口。

本轮不做：

- 不启动真实 sidecar endpoint。
- 不接真实 MCP 客户端或外部 endpoint。
- 不做 audit rotation、compaction、fsync、batch flush、schema migration 或真实 ledger DB。
- 不修改 Extension / Route / Doctor / Quota / Wails / frontend。

## 2. 证据门禁

| 来源 | 当前事实 | 本轮约束 |
| --- | --- | --- |
| Twenty-Third Dispatch | Protocol 要求 list pagination 与 stable audit cursor。 | 只改 `internal/protocolbridge/**` 和本 space 文档。 |
| Round22 README / 计划 | `tools/list` / `resources/list` 已可返回完整本地 manifest，但尚无分页。 | list pagination 只能分页本地 mapping fixture，不引入 dynamic truth。 |
| `JSONLAuditReader` | `NextCursor` 当前是裸数字 offset 字符串。 | 改为 `pb-audit-v1:<offset>`；`Cursor` 不再接受裸数字。 |
| 用户边界 | 仍只服务本地 mapping fixture / temp JSONL，不启动真实 sidecar endpoint。 | focused Go tests 使用 fake executor 与 `t.TempDir()`。 |

## 3. BDD 场景

### 场景 A：`tools/list` 支持 cursor / limit 翻页

- Given MCP mapping fixture 中存在多个 tool。
- When `tools/list` 使用 `limit=2`。
- Then response 只返回两个 tool，并返回 `nextCursor`。
- When 后续请求使用该 cursor。
- Then 返回下一页 tool。
- And 不调用 `OperationExecutor`，不触 sidecar。

### 场景 B：`resources/list` 支持 cursor / limit 翻页

- Given MCP mapping fixture 中存在多个 resource。
- When `resources/list` 使用 `limit=2`。
- Then response 只返回两个 resource，并返回 `nextCursor`。
- When 后续请求使用该 cursor。
- Then 返回剩余 resource。
- And 不调用 `OperationExecutor`，不触 sidecar。

### 场景 C：list pagination 拒绝 malformed cursor / limit

- Given JSON-RPC request 使用 `tools/list` 或 `resources/list`。
- When `cursor` 不是 `pb-list-v1:<kind>:<offset>` 或 `limit` 为负数。
- Then response 是 JSON-RPC invalid params。
- And 不调用 executor。

### 场景 D：audit query 返回 stable cursor token

- Given JSONL 文件中存在多条 read audit event。
- When query 使用 `limit=2`。
- Then 返回 `next_cursor=pb-audit-v1:2`。
- When 用该 cursor 查询。
- Then 返回与 `Offset=2` 等价的事件窗口。
- And `Cursor="2"`、未知版本或负 offset token 被拒绝。

## 4. 最小实现计划

1. 为 `tools/list` / `resources/list` 增加可选 params：`cursor`、`limit`。
2. 新增 list pagination helper：
   - `Limit<=0` 保持返回全部本地 manifest。
   - cursor 格式固定为 `pb-list-v1:<tools|resources>:<offset>`。
   - malformed cursor / negative limit 返回 JSON-RPC `invalid params`。
3. 调整 `MCPToolsListResponse` / `MCPResourcesListResponse`，增加 `nextCursor,omitempty`。
4. 调整 audit cursor helper：
   - 输出 `pb-audit-v1:<offset>`。
   - `Offset` 字段继续可用。
   - `Cursor` 不接受裸数字、未知前缀、未知版本或负 offset。
5. 测试只使用 fake executor、本地 mapping fixture 与 `t.TempDir()` JSONL。

## 5. 验证命令

```bash
go test -count=1 ./internal/protocolbridge
git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces
```

结果待本轮实现后补充。

本轮结果：

- 红灯：新增 list pagination 测试后，`go test -count=1 ./internal/protocolbridge` 因 `MCPToolsListResponse.NextCursor` / `MCPResourcesListResponse.NextCursor` 缺失编译失败，证明 list pagination gap 存在。
- 绿灯：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge -run 'TestMCPStdioJSONRPCHandler.*List|TestJSONLAuditReader'` 通过。
- 扩展 focused：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge -run 'TestMCPStdioJSONRPCHandler|TestJSONLAudit'` 通过。
- Whitespace：`git diff --check -- internal/protocolbridge docs-linhay/spaces/20260616-protocol-bridge-surfaces` 通过；本轮 touched 未跟踪文件另用 `rg -n "[ \t]+$" ...` 检查通过。
- 全包限制：`GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/protocolbridge` 在当前沙箱因既有 `httptest.NewServer` 需要监听 `[::1]:0` 被拒绝，未进入本轮 list/audit 失败；主控聚合或非受限环境可重跑全包。

## 6. 剩余风险

- list pagination 仍是本地 fixture 分页，不包含 dynamic `listChanged` 或完整 MCP annotations。
- audit stable cursor 当前仍映射 filtered latest-first offset；它改善裸 offset 暴露，但不解决 JSONL rotation / compaction 后跨文件稳定语义。
- JSONL reader 仍是本地扫描后分页，大文件 bounds 和索引属于后续 ledger 切片。
