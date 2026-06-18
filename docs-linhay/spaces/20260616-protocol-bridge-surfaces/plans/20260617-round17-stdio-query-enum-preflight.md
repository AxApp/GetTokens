## Protocol Bridge Round17: MCP stdio query enum preflight

日期：2026-06-17

## 1. 本轮目标

在第十六轮 canonical query `required` / `type` preflight 基础上，为当前 schema 已声明的 query enum 增加最小拒绝门禁：

- `protocol` 只允许 `bridge-surface-v1.schema.json#/$defs/protocol` 当前声明的协议枚举。
- `detail_level`、`probe_mode` 等 query 字段若在当前 schema 中声明 enum，非法值在 executor 前拒绝。
- `kinds` 这类 `array[string]` 的 item enum 也按当前 schema 拒绝非法元素。
- 保持既有顺序：`authorize -> stdio preflight -> executor`。

本轮只做：

- `internal/protocolbridge` 内 stdio preflight enum contract
- 对应失败测试与最小实现
- protocol space README 状态更新

本轮不做：

- 完整 JSON Schema 校验器
- pattern / minLength / maxLength / uniqueItems / range 等 schema 约束
- 真实 MCP stdio server 或 stdio process lifecycle
- 真实 sidecar runtime endpoint、operation runner 扩展或 audit persistence 落盘

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮的约束 |
| --- | --- | --- |
| `plans/20260617-round16-stdio-query-type-required-preflight.md` | round16 明确剩余风险：enum、pattern、长度、数值范围未覆盖。 | 本轮只补 enum，不能扩成完整 schema engine。 |
| `schemas/bridge-surface-v1.schema.json` | 当前 query enum 包括 `$defs/protocol`、`accountsSummaryInput.kinds.items`、`accountsSummaryInput.detail_level`、`routesDiagnosticsInput.probe_mode`、`actionInput.probe_mode`。 | preflight enum 集合必须和当前 schema 对齐；未声明 enum 的 string 继续按普通 string 放行。 |
| `internal/protocolbridge/mcp_stdio_preflight.go` | `mcpQuerySchemaContract` 只保存 allowed keys、required 和基础类型。 | 最小实现应扩展该 contract，而不是引入 JSON Schema 解释器。 |
| `internal/protocolbridge/mcp_adapter.go` | `HandleTool` 当前顺序为 mapping lookup -> `Runtime.Authorize` -> stdio preflight -> executor。 | enum preflight 必须保持授权优先，未授权请求不能先暴露 enum 错误。 |
| 用户限制 | 只允许写 protocolbridge preflight/test 与 protocol space docs。 | 不碰其它四个 OmniRoute space，不改 frontend / Wails / sidecar 其它文件。 |

## 3. BDD 场景

### 场景 A：非法 enum 在 executor 前拒绝

- Given MCP tool query 使用当前 canonical query schema 已声明的 enum 字段。
- When `protocol=gemini`、`detail_level=full`、`probe_mode=live` 或 `kinds` 包含未知元素。
- Then adapter 以 canonical `invalid_request` 拒绝。
- And `sidecar_invoked=false`。
- And executor 不被调用。

### 场景 B：合法 enum 继续放行

- Given query key、required、type 与 enum 都匹配当前 canonical schema。
- When `protocol=anthropic`、`detail_level=diagnostic_refs` 或 `probe_mode=dry_run`。
- Then stdio preflight 放行。
- And executor 收到原 canonical query。

### 场景 C：authorize 仍先于 enum preflight

- Given 请求 token 无效，且 query 同时包含非法 enum。
- When adapter 处理 MCP tool 请求。
- Then 返回授权失败，而不是 enum preflight 错误。
- And executor 不被调用。

## 4. 最小实现

1. 在 `mcpQuerySchemaContract` 增加 per-field enum allowlist。
2. 在当前手写 schema contract 中为有 enum 的 query 字段补 enum 集合。
3. type 校验通过后再检查 enum；string 字段检查自身，`array[string]` 字段检查每个 string 元素。
4. enum 失败与 schema allowlist / type / required 失败统一返回 canonical query schema validation message。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check -- internal/protocolbridge/mcp_stdio_preflight.go internal/protocolbridge/mcp_stdio_preflight_test.go docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md docs-linhay/spaces/20260616-protocol-bridge-surfaces/plans/20260617-round17-stdio-query-enum-preflight.md`

## 6. 风险与后续

- 当前仍不是完整 JSON Schema 校验：pattern、长度、范围、uniqueItems 仍未覆盖。
- enum 集合仍由当前手写 contract 维护；后续如果 schema 增加 query enum，需要同步更新 preflight contract 或引入受控 schema 编译步骤。
- 本轮仍不证明真实 MCP stdio framing、真实 stdio server 或 sidecar runtime endpoint 可用性。
