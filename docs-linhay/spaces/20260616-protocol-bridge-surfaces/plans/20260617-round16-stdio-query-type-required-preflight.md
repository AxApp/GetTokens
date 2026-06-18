## Protocol Bridge Round16: MCP stdio query type/required preflight

日期：2026-06-17

## 1. 本轮目标

在第十五轮 top-level query key allowlist 的基础上，给 MCP stdio preflight 增加当前 canonical query schema 的最小 type/required 校验：

- 只校验当前 canonical schema 已明确出现的基础结构：`boolean`、`string`、`array[string]`。
- 缺少当前 schema `required` 字段时，在 executor 前 canonical reject。
- 保持既有顺序：`authorize -> stdio preflight -> executor`。
- 保持既有 safe action `idempotency_key` 规则，不实现真实 stdio server、真实 sidecar endpoint 或 audit persistence。

本轮只做：

- `internal/protocolbridge` 内 stdio preflight type/required contract
- 对应失败测试与最小实现
- protocol space README 状态更新

本轮不做：

- 完整 JSON Schema 校验器
- enum / pattern / minLength / maxLength 等细粒度 schema 约束
- Extension validator 脚本调整
- 真实 stdio process lifecycle、真实 sidecar runtime endpoint、audit persistence 落盘

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮的约束 |
| --- | --- | --- |
| `plans/20260617-round15-stdio-query-schema-allowlist-preflight.md` | round15 只收敛到 query key allowlist。 | 本轮只能在同一 preflight 层补 type/required，不能扩成完整 schema engine。 |
| `schemas/bridge-surface-v1.schema.json` | `accountsSummaryInput`、`modelsSupportedInput`、`quotaSummaryInput`、`actionInput` 都是 object + `additionalProperties=false`；`routesDiagnosticsInput` 额外要求 `protocol`、`model`。 | required 校验当前只应覆盖 schema 明确声明的字段，不推断额外业务必填。 |
| `schemas/bridge-surface-v1.schema.json` | 当前 query 字段类型只涉及 `boolean`、`string`、`array[string]`。 | 可以手写最小 validator，不引入外部 JSON Schema 依赖。 |
| `internal/protocolbridge/runtime.go` | safe action 缺 `idempotency_key` 已在 authorize 阶段拒绝。 | 不搬动既有 idempotency gate，只补 query 自身类型/required。 |
| 用户限制 | 不改 `docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，不碰 frontend/status/route/doctor/extension。 | 写入面只限 `internal/protocolbridge/**`、space README、round16 plan。 |

## 3. BDD 场景

### 场景 A：required query 字段缺失时在 stdio preflight 拒绝

- Given `gettokens.routes.diagnostics` 映射到 `routesDiagnosticsInput`。
- When query 缺少 `protocol` 或 `model`。
- Then stdio preflight 以 canonical `invalid_request` 拒绝。
- And executor 不被调用。

### 场景 B：query 字段类型错误时在 stdio preflight 拒绝

- Given `include_disabled` 需要 `boolean`，`protocol` / `model` / `account_key` / `reason` 需要 `string`，`kinds` 需要 `array[string]`。
- When tool query 传入错误类型，如 `include_disabled="false"`、`kinds=["auth-file", true]`、`account_key=["acct_1"]`。
- Then stdio preflight 以 canonical `invalid_request` 拒绝。
- And executor 不被调用。

### 场景 C：allowlist 与 type/required 都通过时继续沿既有链路执行

- Given `gettokens.accounts.summary` 使用合法 query。
- When query key、required、type 均匹配 canonical schema。
- Then preflight 放行，executor 继续收到原 canonical query。

### 场景 D：authorize 顺序不回归

- Given query 同时缺 required 或类型错误，且 token 无效。
- When adapter 处理 tool 请求。
- Then 返回授权失败，而不是 preflight 的 type/required 错误。
- And executor 不被调用。

## 4. 最小实现

1. 在 `MCPStdioPreflight` 内把每个 `query_schema_ref` 编译为最小 query contract：allowed keys、required keys、每个 key 的基础类型。
2. 只支持当前 canonical schema 需要的 `boolean`、`string`、`array[string]`。
3. schema 外 key、缺 required、类型不匹配都统一返回同一个 stdio invalid-request preflight 错误。
4. credential-bearing input 检测继续保留在 allowlist/type/required 之后，作为第二层拒绝。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 当前仍不是完整 JSON Schema 校验：enum、pattern、长度、数值范围未覆盖。
- `actionInput` 在当前 canonical schema 中没有 `required` 字段；本轮不会额外推断 account targeting 规则，避免桥接层与 schema 漂移。
- 本轮仍不证明真实 stdio framing、session lifecycle 或 sidecar runtime endpoint 可用性。
