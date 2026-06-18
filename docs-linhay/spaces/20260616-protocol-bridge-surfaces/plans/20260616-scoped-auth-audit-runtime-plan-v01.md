# Protocol Bridge Scoped Auth / Audit Runtime Plan v01

日期：2026-06-16

## 1. 任务边界

本计划承接 `bridge-surfaces-spec-v01.md` 的 Slice 2，只定义 scoped auth、audit runtime model 和 MCP adapter 前置 contract tests 的实施输入。

本轮仍然不实现 MCP / A2A transport，不新增 runtime route / quota truth，不改 sidecar routing、quota、candidate pool、live session 或 usage attribution 热路径。

## 2. 证据门禁

| 来源 | 已有事实 | 对本计划的约束 |
|---|---|---|
| `README.md` | 当前 space 目标包含 scope、auth、audit 边界，下一步是 scoped auth/audit runtime 与 MCP adapter。 | 本计划只细化该下一步，不扩展到 transport 实现。 |
| `plans/bridge-surfaces-spec-v01.md` | Bridge 是协议适配层；sidecar 是账号、模型、routeability、quota、route decision 和 safe action 执行结果 authority。 | 授权和审计可以是 bridge-owned state；route truth、quota truth、model availability truth 仍只能引用 sidecar。 |
| `schemas/bridge-surface-v1.schema.json` | Response envelope 已定义 bridge-auth-generated `actor`、`authority`、`audit`、`error.sidecar_invoked`、action `idempotency_key`；request envelope 不接受外部 `actor`。 | Runtime model 必须产出 actor/audit 字段，不为 MCP 另造私有字段，也不得信任 request-side actor。 |
| `schemas/canonical-operations-v01.json` | Manifest 已枚举 operation、default scope、forbidden bridge state、allowed bridge state 和 canonical error envelopes。 | Contract tests 以 manifest 为表驱动输入，覆盖每个 operation 的 scope、authority 和禁止输出。 |
| `examples/*.json` | 示例已覆盖 read success、safe action accepted、missing scope rejected。 | Tests 要证明缺 scope 时不调用 sidecar，safe action accepted 不代表最终 quota/route/model truth。 |

## 3. BDD 场景

### 场景 A：创建最小只读 bridge client

- Given bridge transport 默认关闭。
- And 用户在 GetTokens 内显式创建 client `local-readonly-agent`。
- When 该 client 被授予 `bridge.accounts.read`、`bridge.models.read` 和 transport allowlist `mcp`。
- Then 持久层只保存 token hash、client metadata、scope grants、transport allowlist、created/updated/optional expiry。
- And token 明文只显示一次，不写入 frontend localStorage、audit、config export 或 logs。
- And 该 client 不能调用 route diagnostics、quota summary 或 safe actions。

### 场景 B：缺少 scope 的请求被 bridge auth 拦截

- Given client 只有 `bridge.models.read`。
- When 它请求 `bridge.routes.diagnostics`。
- Then bridge 返回 canonical rejected envelope，`error.code=missing_scope`。
- And `error.required_scopes=["bridge.routes.diagnostics.read"]`。
- And `error.sidecar_invoked=false`。
- And audit event 被写入，但不包含 raw token、raw request secret 或 provider header。
- And sidecar diagnostics endpoint 没有被调用。

### 场景 C：read surface 授权成功但 authority 仍属于 sidecar

- Given client 具备对应 read scope。
- When 它请求 accounts summary、supported models、route diagnostics 或 quota summary。
- Then bridge 先验证 client、transport allowlist 和 scope grant。
- And bridge 调用对应 sidecar management authority。
- And response envelope 的 `authority.owner` 固定为 `sidecar`。
- And `actor.scopes` 只表达授权上下文，不进入 route selection。
- And bridge 不根据 enabled、provider name、base URL、frontend cache 或 quota bar 推导 requestable、model availability、routeability 或 quota guard。

### 场景 D：safe action 授权成功只创建 sidecar-owned operation

- Given client 具备 `bridge.actions.quota_refresh`。
- And request 携带 `idempotency_key`。
- When 它请求 `bridge.actions.quota_refresh`。
- Then bridge 记录 idempotency key hash。
- And bridge 调用 sidecar operation runner 或复用 sidecar 去重结果。
- And response status 只能表达 `accepted|rejected|running|completed|failed` 的 operation 状态。
- And final quota truth 必须通过后续 `bridge.quota.summary` 重新读取。
- And bridge 不直接写 quota-empty guard、route guard、candidate pool、session affinity 或 selected account。

### 场景 E：过期或 transport 不匹配的 client 被拒绝

- Given client 已过期，或只允许 `mcp` 但请求来自 `openai_admin`。
- When 它调用任意 canonical operation。
- Then bridge 返回 `rejected`。
- And audit event 记录 `result_status=rejected`、`error_code=client_expired|transport_not_allowed` 的等价内部 code。
- And canonical response 对外可映射为 `missing_scope` 或 `invalid_request`，但不得调用 protected sidecar endpoint。

### 场景 F：审计查询不参与 runtime decision

- Given audit retention 中存在 route diagnostics、quota refresh 和 missing scope 事件。
- When bridge 或后续 MCP adapter 展示 audit history。
- Then audit 只用于追溯 actor、operation、authority endpoint、result 和 redaction 状态。
- And audit history 不参与账号选择、quota guard、route guard、model availability、live session pin 或 usage attribution。

### 场景 G：loopback-only client 必须由 Runtime.Authorize 强制执行

- Given client 设置 `loopback_only=true`。
- When caller / peer context 缺失，或 peer 不能被证明是 loopback。
- Then bridge 返回 rejected envelope，canonical error 可映射为 `invalid_request`。
- And audit event 使用可区分的 `error_code=loopback_required`。
- And `sidecar_invoked=false`，protected sidecar endpoint 不被调用。
- When caller / peer context 可证明是 loopback。
- Then 继续执行 transport allowlist、scope grant 和 action idempotency 校验。

## 4. Scope Grant Model

首期 grant model 是白名单式最小授权，不支持通配符 scope。

### 4.1 Bridge client

| 字段 | 说明 | Authority |
|---|---|---|
| `client_id` | 稳定逻辑 client id，例如 `local-readonly-agent`。 | bridge config |
| `display_name` | 用户可读名称。 | bridge config |
| `token_hash` | bridge token 的不可逆 hash。 | bridge config |
| `token_hash_prefix` | 用于 UI 和 audit 的短前缀，不可用于认证。 | bridge config |
| `transport_allowlist` | 允许的入口：`mcp`、`a2a`、`openai_admin`。 | bridge config |
| `scope_grants` | 精确 scope 列表。 | bridge config |
| `expires_at_unix_ms` | 可选过期时间。 | bridge config |
| `loopback_only` | 可选本机限制；HTTP 类 adapter 首期默认 true；必须在 `Runtime.Authorize` 基于 adapter 提供的 caller / peer context 强制执行。 | bridge config |
| `disabled` | 撤销开关。 | bridge config |
| `created_at_unix_ms` / `updated_at_unix_ms` | 管理元数据。 | bridge config |

### 4.2 Scope catalog

Read scopes：

- `bridge.accounts.read`
- `bridge.models.read`
- `bridge.routes.diagnostics.read`
- `bridge.quota.read`

Action scopes：

- `bridge.actions.routeability_recheck`
- `bridge.actions.quota_refresh`
- `bridge.actions.model_catalog_refresh`
- `bridge.actions.diagnostics_probe`

Bridge config scopes：

- `bridge.config.read`
- `bridge.config.write`

`bridge.config.write` 只允许管理 bridge client、token rotation、transport enablement、scope grant、audit retention 和 schema/version metadata；不得修改账号、凭证、route priority、route guard、quota guard、candidate pool、session affinity 或 live session pin。

### 4.3 Authorization algorithm

1. Adapter 解析 canonical operation、transport、request id 和可信 caller / peer context；request-side `actor` 不被接受或信任。
2. Bridge auth 通过 token hash 查找 client；失败即 rejected。
3. 检查 client 未 disabled、未过期。
4. 若 client `loopback_only=true`，caller / peer context 必须能证明 loopback；缺失或非 loopback 均 rejected，并记录 `loopback_required` audit code。
5. 检查 transport 在 allowlist 内。
6. 从 `canonical-operations-v01.json` 找到 operation 的 `default_scope`。
7. 精确匹配当前有效、未禁用、未过期的 scope grant；不做 wildcard、prefix 或 implied scope。
8. 对 action operation 校验 `idempotency_key` 存在。
9. 授权失败时写 audit event，并返回 canonical rejected envelope；protected sidecar endpoint 不被调用。
10. 授权成功后只把 bridge-auth-generated actor/scopes/audit context 传给 bridge response，不传入 sidecar route selection 作为决策输入。

## 5. Audit Event Envelope

审计事件是 bridge-owned allowed state，但只记录调用历史，不记录 runtime truth。

```json
{
  "audit_id": "bra_...",
  "timestamp_unix_ms": 1781587320000,
  "request_id": "brq_...",
  "transport": "mcp",
  "client_id": "local-readonly-agent",
  "auth_subject_hash_prefix": "9f23ab10",
  "scopes": ["bridge.accounts.read"],
  "operation": "bridge.accounts.summary",
  "target_refs": ["acct_codex_primary", "model:gpt-5-codex"],
  "authority": {
    "owner": "sidecar",
    "endpoint": "/v0/management/gettokens/accounts/summary",
    "snapshot_id": "snapshot:accounts:1781587200000",
    "ledger_ref": "optional"
  },
  "result_status": "ok",
  "sidecar_request_id": "scr_accounts_001",
  "duration_ms": 18,
  "error_code": null,
  "recoverable": null,
  "idempotency_key_hash": null,
  "sidecar_operation_id": null,
  "redaction_version": "bridge-redaction-v1"
}
```

### 5.1 Redaction rules

- 必须记录：`audit_id`、timestamp、transport、client id、token hash prefix、operation、result、duration、authority endpoint。
- read surface 可以记录 account refs、model id、protocol、dropped reason code、snapshot / ledger refs。
- safe action 必须记录 idempotency key hash 和 sidecar operation id / result ref。
- 不记录：raw token、raw auth file、access token、refresh token、id token、API key 明文或可逆片段、cookie、provider header、完整 billing response、完整 request body。
- `reason` 字段进入 audit 前必须长度限制和 secret pattern redaction。
- audit retention 是 bridge config；删除旧 audit 不得清理 sidecar ledger 或 runtime state。

### 5.2 Response audit projection

Response envelope 的 `audit` 字段是审计事件的公开投影，只包含：

- `audit_id`
- `redaction`
- `sidecar_request_id`
- `duration_ms`

完整 audit event 不通过普通 read surface 直接返回。后续如果需要 audit history，应单独定义 `bridge.audit.read`，本计划不加入首期 surface。

## 6. Authority Map

| Operation / State | Runtime authority | Bridge 可保存 | Bridge 禁止保存 / 推导 |
|---|---|---|---|
| `bridge.accounts.summary` | sidecar account runtime + account store projection | request id、actor、audit event、short-lived response transport cache | requestable truth、raw auth、secret、candidate pool |
| `bridge.models.supported` | sidecar model registry + account-associated catalog | audit event、schema version metadata | provider/base URL 推导的 availability、disabled account 的 available source |
| `bridge.routes.diagnostics` | sidecar route explain + route decision ledger | audit event、diagnostic request refs | selected account truth、future route promise、route guard、session affinity |
| `bridge.quota.summary` | sidecar quota runtime + guard source evidence | audit event、quota snapshot ref | quota-empty guard、remaining 推导的 requestable、frontend quota bar truth |
| `bridge.actions.*` | sidecar operation runner | idempotency key hash、operation ref、audit event | final route/quota/model truth、guard mutation、candidate pool mutation |
| Bridge client config | bridge config | client metadata、token hash、scope grants、transport allowlist、audit retention | sidecar management key、runtime relay API key、credentials |
| Audit events | bridge audit store | redacted event envelope | raw token、cookies、provider headers、full secrets、runtime decision inputs |

## 7. Contract Tests Plan

后续实现前先补 adapter-independent contract tests。测试应以 schema、manifest 和 examples 为输入，优先红灯，再实现。

### 7.1 Schema / manifest contract tests

- JSON parser 能解析 `bridge-surface-v1.schema.json`、`canonical-operations-v01.json` 和全部 `examples/*.json`。
- Manifest 每个 `operation.id` 都存在于 schema `operation` enum。
- Manifest 每个 operation 的 `default_scope` 非空且属于 scope catalog。
- Manifest 每个 operation 的 `authority.owner` 都是 `sidecar`。
- Manifest `forbidden_bridge_state` 包含 candidate pool、selected account、route guard state、session affinity、quota-empty block、model availability truth、requestable truth、live session pin。
- Examples 都符合 canonical envelope 的字段语义；missing scope example 必须包含 `error.sidecar_invoked=false`。

### 7.2 Auth contract tests

- `bridge.accounts.summary` 缺 `bridge.accounts.read` 时 rejected，sidecar mock call count 为 0。
- `bridge.routes.diagnostics` 只有 `bridge.models.read` 时 rejected，`required_scopes` 为 `bridge.routes.diagnostics.read`。
- `bridge.actions.quota_refresh` 缺 `idempotency_key` 时在 bridge boundary rejected，sidecar mock call count 为 0。
- disabled client、expired client、transport 不在 allowlist 时 rejected，均写 audit。
- loopback-only client 在缺 caller 或非 loopback caller 时 rejected，audit code 为 `loopback_required`，sidecar mock call count 为 0；loopback caller 继续通过后续授权链。
- scope 匹配必须精确；`bridge.accounts.*`、`bridge.*`、`bridge.accounts` 都不能通过。
- 过期或 disabled scope grant 不出现在 response `actor.scopes` 或 audit `scopes`。

### 7.3 Audit / redaction contract tests

- 成功 read、成功 action accepted、missing scope rejected、sidecar unavailable 都写 audit event。
- Audit event 和 response projection 不包含 raw token、access token、refresh token、API key、cookie、authorization header、billing header。
- Safe action audit 包含 idempotency key hash，不包含 idempotency key 明文。
- Missing scope audit 不包含 sidecar request id，且 response `sidecar_invoked=false`。
- Sidecar unavailable audit 可记录 sidecar endpoint 和 recoverable，但不得合成 routeability、quota 或 model availability。

### 7.4 Authority / no-route-truth contract tests

- Read responses 的 `authority.owner` 必须为 `sidecar`。
- Accounts summary 中 `requestable_source` 只能是 `sidecar-runtime-snapshot` 或 `sidecar-route-diagnostics`。
- Supported models 中 `availability=available` 必须有 sidecar model registry 或 account-associated catalog evidence。
- Route diagnostics `dry_run` 不写 session affinity、route guard、candidate pool 或 selected account state。
- Quota summary 不触发 route guard clear/write；`stale=true` 不得被 adapter 转成 fresh success。
- Safe action accepted 后 bridge store 只保存 operation ref / audit event，不保存 final quota、model availability 或 routeability。

### 7.5 MCP adapter mapping contract tests

这些测试是 MCP adapter 开工前置门禁，不要求本计划实现 MCP。

- MCP tool 名称到 canonical operation 一一映射，例如 `gettokens.accounts.summary -> bridge.accounts.summary`。
- MCP tool 参数完整映射到 canonical `query`，不得新增 adapter-only truth 字段。
- MCP tool response 完整复用 canonical response envelope。
- MCP resources 只暴露 manifest、schema、scope list，不暴露 audit secret 或 token hash。
- MCP stdio 本机启动仍必须绑定 logical `client_id` 和 scope grant，不能因为是 stdio 而跳过 auth/audit。
- MCP safe action tool 只返回 accepted/rejected/operation ref，不把 operation accepted 展示成刷新完成。

## 8. MCP Adapter 前置门禁

进入 MCP adapter 实现前必须满足：

1. Scoped auth runtime model 的红灯 contract tests 已补齐。
2. Missing scope、invalid request、sidecar unavailable 三类 canonical error envelope 已有测试。
3. Audit redaction tests 覆盖 token、cookie、API key、Authorization header、billing header。
4. Action idempotency key 必填和 hash-only audit 已有测试。
5. Authority map tests 证明 bridge store 不保存 forbidden bridge state。
6. Capability manifest 暴露的 operation / scope / schema ref 与 adapter mapping 表一致。
7. MCP adapter 的 tool/resource 命名表先以文档或 fixture 固化，再写 handler。

未满足以上任一项时，只允许继续补 schema/manifest/auth/audit contract，不进入 MCP transport handler。

## 9. 不做项

- 不实现 MCP、A2A 或 OpenAI-compatible admin transport。
- 不新增 Wails binding、frontend 页面、dev bridge 或 preview fixture。
- 不修改 runtime route、quota、route guard、candidate pool、session affinity、live session、usage attribution。
- 不让 bridge 或 adapter 保存 route truth、quota truth、model availability truth 或 requestable truth。
- 不复用 sidecar management key、runtime relay API key 或 frontend localStorage 作为 bridge auth。
- 不支持 wildcard scope、隐式 scope 继承、局域网免认证访问。
- 不定义 `bridge.audit.read` 首期 surface；audit history 需要另开 scope 和 schema。
- 不改 CLIProxyAPI reference，也不从上游引入 transport 实现。

## 10. 后续交付切片

1. `scoped-auth-contract-tests`：先补 schema/manifest/auth/audit/redaction/no-route-truth tests。
2. `scoped-auth-runtime-minimal`：实现 bridge client、token hash、scope grant、transport allowlist、expiry 和 disabled 检查。
3. `audit-runtime-minimal`：实现 redacted audit event 写入和 response audit projection。
4. `sidecar-authority-adapter-contract`：用 sidecar mock 证明授权成功才调用 authority endpoint，失败不调用。
5. `mcp-adapter-contract-fixture`：固化 MCP tool/resource 到 canonical operation 的映射 fixture，作为 MCP adapter 实现前最后门禁。

## 11. Runtime Core 落地记录

日期：2026-06-16

已新增 adapter-independent Go runtime core：`internal/protocolbridge`。

已覆盖能力：

- `Client` / `ScopeGrant` 模型：保存 token hash、hash prefix、transport allowlist、精确 scope grant、可选 expiry、disabled 状态。
- `Runtime.Authorize`：按 canonical operation 校验 token、client 状态、transport allowlist、scope grant 和 safe action idempotency key。
- `Runtime.Authorize`：对 `loopback_only` client 强制校验 caller / peer context；缺 caller 或非 loopback caller 会在 bridge boundary 以 `loopback_required` audit code 拒绝。
- Scope 匹配：只接受精确 scope；`bridge.accounts.*`、`bridge.*`、`bridge.accounts` 等 wildcard / prefix grant 不生效。
- Actor / audit scopes：只展示当前有效、未禁用、未过期的 grants。
- 拒绝路径：missing scope、disabled、expired、transport mismatch、safe action missing idempotency key 都在 bridge boundary 返回 rejected，并通过 `sidecar_invoked=false` 表达不触达 protected sidecar endpoint。
- 成功路径：只产出授权上下文、sidecar authority endpoint、actor 和 audit projection；read authority owner 仍固定为 `sidecar`，不保存或推导 route / quota / model truth。
- Audit：生成 redacted `AuditEvent` 和公开 `AuditProjection`；safe action 只记录 idempotency key hash，不记录 raw token 或 raw idempotency key。

本轮仍未实现：

- MCP / A2A / OpenAI-compatible admin transport adapter。
- sidecar management client 调用、operation runner、真实 response data 组装。
- route guard、quota guard、candidate pool、model availability truth、requestable truth 或 live session pin 的任何 bridge-local 持久化。

本轮聚焦测试：

- `go test ./internal/protocolbridge`

## 12. MCP Adapter Mapping Fixture 落地记录

日期：2026-06-16

已新增 MCP adapter 前置 mapping fixture：`schemas/mcp-adapter-mapping-v01.json`。

已覆盖契约：

- MCP tool 到 canonical operation 一一映射，覆盖 `canonical-operations-v01.json` 的 8 个 operation。
- 每个 tool 的 `required_scope` 必须等于 canonical operation `default_scope`。
- 每个 tool 的参数只映射到 `canonical.query`，`query_schema_ref` 指向 `bridge-surface-v1.schema.json` 对应 `$defs`。
- 每个 tool 的 response 固定复用 `bridge.surface.v1.responseEnvelope`，不新增 MCP 私有 response truth。
- 所有 safe action tool 显式 `requires_idempotency_key=true`，并标记 `safe_action_result=operation_ref_only`，避免把 accepted 展示成刷新完成。
- MCP resources 只暴露 manifest、schema、scope list 三类 contract 信息，不暴露 token hash、audit secret、raw token、provider header、cookie 或 credential material。

已新增 adapter-independent Go validator：`internal/protocolbridge/mcp_mapping.go`。

验证门禁：

- `go test -count=1 ./internal/protocolbridge` 会读取 mapping fixture 并校验其与 `operationSpecs` 对齐。
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs` 会校验 mapping fixture 与 canonical operations / bridge schema 对齐，并检查 resources 不能暴露 secret/hash/audit material。

本轮仍未实现：

- MCP handler、stdio server、resource provider 或 tool executor。
- sidecar management client 调用或真实 response data 组装。
- MCP stdio client 绑定、token/session lifecycle 或 audit store 持久化。

## 13. MCP Adapter Handler Contract 落地记录

日期：2026-06-16

已新增 MCP adapter handler 第一块：`internal/protocolbridge/mcp_adapter.go`。

已覆盖能力：

- Adapter-facing types：`MCPToolRequest`、`MCPToolResponse`、`MCPResourceRequest`、`MCPResourceResponse`、`MCPAdapter`、`OperationRequest`、`OperationResult`、`OperationExecutor`。
- Tool handler：按 `MCPAdapterMapping` 查找 tool 到 canonical operation 的映射，构造 `AuthorizeRequest`，固定传入 `transport=mcp`、client token、idempotency key、caller / peer context。
- Authorization gate：unknown tool、missing scope、safe action missing idempotency key 均在 adapter boundary 返回 canonical rejected envelope，`sidecar_invoked=false`，且不会调用 executor。
- Executor boundary：授权通过后才调用 `OperationExecutor.Execute(ctx, OperationRequest)`；测试使用 fake executor，本轮不调用 sidecar。
- Read envelope：read operation 返回 executor data，并保留 `authority.owner=sidecar`、snapshot / sidecar request ref / audit projection。
- Safe action envelope：safe action 只返回 `operation_ref.operation_id`、accepted status 和 ledger/result ref；不返回 completed action data，不声称 quota / route / model refresh 已完成。
- Resource handler：只允许 mapping fixture 中 `manifest`、`schema`、`scope_list` 三类 resource；unknown resource rejected；resource response 不暴露 token hash、audit secret、Authorization header、cookie、access token、refresh token、id token 或 API key 明文。

新增 handler contract tests：`internal/protocolbridge/mcp_adapter_test.go`。

已覆盖测试：

- read MCP tool maps to canonical operation and invokes fake executor only after authorize success。
- missing scope rejects before executor / sidecar invocation。
- safe action without idempotency key rejects before executor。
- safe action with idempotency returns operation ref only，并把 idempotency key 只以 hash 进入 audit。
- unknown tool/resource rejects。
- resource response excludes forbidden secret material。

本轮仍未实现：

- 真实 MCP stdio server / process lifecycle。
- sidecar management client / operation runner / response data 组装。
- audit store persistence 或 audit history surface。
- A2A / OpenAI-compatible admin adapters。
