## Protocol Bridge Round15: MCP stdio query-schema allowlist preflight

日期：2026-06-17

## 1. 本轮目标

把第十四轮 `MCP stdio preflight` 从“保守 credential-bearing key/value 拒绝”收窄为“基于 mapping + canonical query schema 的字段 allowlist 拒绝”：

- tool query 只允许对应 `query_schema_ref` 声明的 canonical 字段。
- schema 外 key 在 preflight 边界被拒绝，尤其不能借 `header` / `token` / `cookie` 类 key 混入请求。
- `MCPAdapter.HandleTool(...)` 继续保持 `authorize -> stdio preflight -> executor` 顺序。

本轮只做：

- `internal/protocolbridge` 内的 stdio preflight allowlist contract
- 对应失败测试与最小实现
- Protocol space README / round15 计划更新

本轮不做：

- 真实 MCP stdio server / process lifecycle
- 真实 sidecar endpoint 接入
- audit persistence 落盘
- `docs-linhay/scripts/check-omniroute-contract-artifacts.mjs` 调整

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮的约束 |
| --- | --- | --- |
| `plans/20260617-round14-stdio-transport-preflight.md` | round14 只要求 mapping fixture allowlist + credential-bearing input 检测。 | 本轮要补 schema allowlist，不重做 stdio server。 |
| `schemas/mcp-adapter-mapping-v01.json` | 每个 tool 已固定 `query_schema_ref`，且都映射到 `canonical.query`。 | allowlist 必须按 tool 对应 schema ref 收窄，不能用“所有 query 字段并集”放行。 |
| `schemas/bridge-surface-v1.schema.json` | `accountsSummaryInput`、`modelsSupportedInput`、`routesDiagnosticsInput`、`quotaSummaryInput`、`actionInput` 的 query 字段都已显式声明且 `additionalProperties=false`。 | preflight 可直接以这些 canonical 字段作为允许 key 集，不需要引入完整 JSON Schema 校验器。 |
| `internal/protocolbridge/mcp_adapter.go` | 当前 tool 路径已经先 `Runtime.Authorize` 再决定是否进入 executor。 | 第十五轮只能补 executor 前的 schema allowlist gate，不能把 preflight 提前到 authorize 之前。 |
| 用户限制 | 不能改 extension validator 脚本，也不能碰 frontend/status/route/doctor/extension。 | 改动面只限 `internal/protocolbridge/**`、本 space README 和新增 round15 plan。 |

## 3. BDD 场景

### 场景 A：tool query 只允许 schema 声明字段

- Given `gettokens.accounts.summary` 映射到 `accountsSummaryInput`。
- When query 带入 `account_key` 或其他不在该 schema 的 key。
- Then stdio preflight 以 canonical `invalid_request` 拒绝。
- And executor 不被调用。

### 场景 B：allowlist 必须按 tool 自己的 schema，而不是所有字段并集

- Given `account_key` 在 `modelsSupportedInput` 中合法，但不在 `accountsSummaryInput` 中。
- When `gettokens.accounts.summary` 收到 `account_key`。
- Then 仍然 rejected。

### 场景 C：authorize 顺序不回归

- Given tool query 同时包含 schema 外 key，且 token 无效。
- When adapter 处理 tool 请求。
- Then 返回授权失败结果，而不是 preflight 的 schema allowlist 错误。
- And executor 不被调用。

### 场景 D：credential-bearing key 继续被挡在 schema allowlist 外

- Given query 带有 `headers`、`authorization`、`cookie`、`access_token` 等 key。
- When stdio preflight 按 query schema allowlist 检查。
- Then 这些 key 作为 schema 外字段被拒绝。
- And response / audit 不泄露 raw token、header、cookie。

## 4. 最小实现

1. 在 `MCPStdioPreflight` 内新增基于 `query_schema_ref` 的 tool query allowlist。
2. allowlist 只校验 top-level query key 是否属于 canonical schema 字段；schema 外 key 统一拒绝。
3. 继续保留 round14 的 credential-bearing value 检测，作为 allowlist 通过后的第二层守门。
4. `NewMCPStdioPreflight(...)` 若遇到未知 `query_schema_ref`，构造阶段直接失败，避免 mapping 漂移静默放行。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 当前 allowlist 只覆盖 top-level query key，不做完整 JSON Schema 类型/required 校验；若后续 query 引入嵌套对象，需要补更细的字段路径校验。
- 本轮不接真实 stdio server，因此不证明 stdin/stdout framing、session lifecycle 或 sidecar 运行时可用性。
- 若 canonical schema 新增 query defs，必须同步扩展 `internal/protocolbridge` 的 allowlist 映射与测试。
