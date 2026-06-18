# Protocol Bridge Surfaces Spec v01

日期：2026-06-16

## 1. 任务边界

本规格定义 GetTokens 第一批可桥接 capability surface，用于后续 MCP、A2A、OpenAI-compatible admin surface 等外部协议入口消费 GetTokens 现有运行态能力。

本轮只做协议设计，不落 runtime 代码。后续实现必须继续遵守：

- bridge 是协议适配层，不是第二运行时。
- sidecar 是账号、模型、routeability、quota、route decision、safe action 执行结果的 authority。
- Wails / Go core 可以负责本地 bridge 配置、桌面集成、DTO 聚合和 adapter 生命周期，但不能重新推导 route truth。
- frontend 只负责展示、过滤、排序、交互草稿和 preview fixture，不能伪造 bridge 已闭环。

## 2. 证据门禁

| 来源 | 事实 | 对本规格的约束 |
|---|---|---|
| `docs-linhay/dev/20260615-omniroute-capability-architecture.md` | Protocol bridge 的定位是 sidecar 或 Go core 边界能力，协议出口是桥，不是第二运行时。 | 所有 surface 必须追溯到 sidecar-owned truth；bridge 不保存 candidate pool 或 route state。 |
| `docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md` | 本 space 的第一批 scope 包括 accounts summary、supported models、route diagnostics、quota summary 和显式安全写操作。 | 本规格只覆盖这些首批能力，不扩展到任意管理 API。 |
| `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md` | Phase D1-D3 依次为 capability surface definition、scoped auth/audit、transport adapters。 | 文档按 surface、auth/audit、transport adapter 顺序给出后续实现输入。 |
| `gettokens-domain-engineering` | sidecar autonomy 和 route guard / quota / model catalog / live sessions 等热路径事实必须在 sidecar 内闭环。 | bridge action 只能调用 sidecar-owned 操作，不能由 adapter 写本地 route 结论。 |

## 3. BDD 验收场景

### 场景 A：外部 agent 读取账号摘要

- Given bridge client 具备 `bridge.accounts.read` scope。
- When 它请求账号摘要。
- Then 返回每个账号的稳定 `account_key`、kind、provider、display name、enabled/requestable 摘要、runtime status、quota/status 引用和 evidence refs。
- And 每个 requestable / blocked / stale 字段都标明来自 sidecar runtime snapshot 或 sidecar diagnostics。
- And 返回体不包含 raw secret、access token、refresh token、API key、cookie、完整 auth file 内容。

### 场景 B：外部 agent 读取 supported models

- Given bridge client 具备 `bridge.models.read` scope。
- When 它请求支持模型目录。
- Then 返回模型 id、display name、protocol formats、source account refs、availability、last refreshed time 和 warnings。
- And model availability 追溯到 sidecar model registry / account-associated catalog。
- And bridge 不根据 provider 名称、base URL 或前端缓存重新推断协议能力。

### 场景 C：外部 agent 获取 route diagnostics

- Given bridge client 具备 `bridge.routes.diagnostics.read` scope。
- When 它查询某个 protocol + model + optional account/project 的 route diagnostics。
- Then 返回 sidecar route explain / route decision ledger 的结构化结果。
- And 包含 candidate pool summary、selected / dropped reasons、guard sources、quota/auth/model filtering evidence、last decision refs。
- And bridge 不保存新的 candidate state，也不把 probe 结果写成 route truth。

### 场景 D：外部 agent 读取 quota summary

- Given bridge client 具备 `bridge.quota.read` scope。
- When 它请求 quota summary。
- Then 返回 sidecar quota runtime 中的 windows、remaining、reset、stale/degraded、confidence、source 和 last checked time。
- And stale/cache/estimated 必须显式标记。
- And bridge 不从前端 quota bar、历史 usage 或本地缓存推导可请求状态。

### 场景 E：外部 agent 触发受控 safe action

- Given bridge client 具备对应 action scope。
- When 它触发 routeability recheck、quota refresh、model catalog refresh 或 diagnostics probe。
- Then bridge 创建 sidecar-owned operation，并返回 operation id、accepted/rejected 状态、authority endpoint 和 audit id。
- And 操作完成后的事实只能通过 sidecar snapshot / diagnostics 再读取。
- And bridge 不能直接写入 route guard、candidate pool、session affinity、enabled/disabled、priority、delete 或 credential 配置。

## 4. Surface 总览

| Surface | 类型 | 首期目的 | Authority | 默认 scope |
|---|---|---|---|---|
| Accounts Summary | read | 让外部 agent 理解账号池的可用性摘要。 | sidecar account runtime + account store projection | `bridge.accounts.read` |
| Supported Models | read | 暴露 GetTokens 当前可支持的模型目录和来源证据。 | sidecar model registry + account-associated catalog | `bridge.models.read` |
| Route Diagnostics | read / probe-read | 解释某个请求为什么可路由、不可路由或会落到哪个候选。 | sidecar route explain + route decision ledger | `bridge.routes.diagnostics.read` |
| Quota Summary | read | 暴露 quota/runtime risk，而不是前端展示状态。 | sidecar quota runtime + guard source evidence | `bridge.quota.read` |
| Safe Actions | controlled action | 触发受控重检、刷新或探针。 | sidecar operation runner | `bridge.actions.<name>` |

## 5. 通用 envelope

所有 transport adapter 都应映射到同一组 canonical operation，避免 MCP、A2A、OpenAI-compatible admin surface 各自发明字段。

外部 request input 只接受 adapter 能证明的请求字段，例如：

```json
{
  "version": "bridge.surface.v1",
  "request_id": "brq_...",
  "transport": "mcp|a2a|openai_admin",
  "operation": "bridge.accounts.summary",
  "query": {}
}
```

request-side `actor` 不属于外部 authority。Adapter 不接受、不透传、不信任调用方提交的 `actor`；bridge auth 必须基于 token、client config、caller / peer context、transport allowlist 和 active scope grants 生成 response / audit actor。

Bridge auth 通过后的 response envelope 示例：

```json
{
  "version": "bridge.surface.v1",
  "request_id": "brq_...",
  "transport": "mcp|a2a|openai_admin",
  "operation": "bridge.accounts.summary",
  "actor": {
    "client_id": "local-agent",
    "auth_subject": "bridge-token:<hash-prefix>",
    "scopes": ["bridge.accounts.read"]
  },
  "status": "ok",
  "data": {},
  "authority": {
    "owner": "sidecar",
    "endpoint": "/v0/management/gettokens/...",
    "snapshot_id": "optional",
    "generated_at_unix_ms": 0
  },
  "audit": {
    "audit_id": "bra_...",
    "redaction": "secrets-removed"
  },
  "warnings": []
}
```

### 通用字段规则

- `request_id`：bridge call id，由 adapter 生成或透传。
- `transport`：只标识入口协议，不参与 runtime 决策。
- `actor`：只由 bridge auth 生成，用于 response / audit；不是 request adapter 可接受的外部权限声明。
- `actor.scopes`：只展示当前有效、未禁用、未过期的授权上下文，用于审计展示，不进入 route selection。
- `authority.owner`：首期必须为 `sidecar`；若某个字段来自 Wails 本地配置，必须在字段级标注 `source=wails-local-config`，且不得是 route truth。
- `snapshot_id`：只引用 sidecar snapshot / ledger，不允许 bridge 自己创建 route snapshot。
- `warnings`：用于标识 degraded/stale/partial，不得被前端或 adapter 当成 hard block 推导依据。

## 6. Surface 细则

### 6.1 Accounts Summary

Canonical operation：`bridge.accounts.summary`

输入：

- `include_disabled`: boolean，默认 true。
- `kinds`: optional list，例如 `auth-file`、`codex-api-key`、`openai-compatible`。
- `protocol`: optional，例如 `codex`、`openai_responses`、`openai_chat`、`anthropic`，只用于筛选展示，不改变 route truth。
- `detail_level`: `summary|diagnostic_refs`，默认 `summary`。

输出字段：

- `account_key`
- `kind`
- `provider`
- `display_name`
- `credential_source`
- `enabled`
- `requestable`
- `requestable_source`
- `runtime_status`
- `guard_sources`
- `quota_ref`
- `model_refs`
- `last_runtime_update_unix_ms`
- `evidence_refs`

禁止输出：

- raw auth file
- access token / refresh token / id token
- API key 明文或可逆片段
- platform cookie
- quota curl / billing curl 中的敏感 header 和 cookie

边界：

- `requestable` 只能来自 sidecar route/runtime state。
- `enabled` 可来自 account store projection，但 runtime route exclusion 仍以 sidecar guard 和 synthesized auth 为准。
- adapter 不得通过 `enabled && quota > 0` 本地计算 requestable。

### 6.2 Supported Models

Canonical operation：`bridge.models.supported`

输入：

- `protocol`: optional，`codex|openai_responses|openai_chat|anthropic`。
- `account_key`: optional，仅用于查看某账号贡献的模型。
- `include_disabled_sources`: boolean，默认 false。

输出字段：

- `model_id`
- `display_name`
- `protocol_formats`
- `source_accounts`
- `source_type`: `account-associated|sidecar-metadata|manual-config`
- `availability`: `available|blocked|stale|metadata_only`
- `capability_tags`
- `warnings`
- `last_refreshed_unix_ms`
- `evidence_refs`

边界：

- model list 必须来自 sidecar model registry 或 account-associated catalog。
- disabled/deleted 账号不得贡献 `available` 模型。
- sidecar-only model definitions 只能标为 `metadata_only`，不能伪造成 account-backed availability。
- bridge 不根据 provider display name 或 base URL substring 推断 OpenAI-compatible / Codex 能力。

### 6.3 Route Diagnostics

Canonical operation：`bridge.routes.diagnostics`

输入：

- `protocol`: required。
- `model`: required。
- `project`: optional。
- `account_key`: optional。
- `include_recent_decisions`: boolean，默认 true。
- `probe_mode`: `none|dry_run`，默认 `none`。

输出字段：

- `routeable`: boolean。
- `selected_candidate`: optional redacted account ref。
- `candidate_pool_summary`
- `dropped_reasons`
- `guard_sources`
- `quota_evidence`
- `model_evidence`
- `auth_evidence`
- `recent_decision_refs`
- `probe_result`: optional dry-run result。
- `authority_trace`

边界：

- `dry_run` 只允许调用 sidecar route explain / probe，不创建 session affinity，不保留 candidate pool，不写 route guard。
- route diagnostics 可以返回“如果现在请求会被过滤”的解释，但不能承诺未来实际请求一定选中同一账号。
- recent decision ledger 是 sidecar audit/read model，不是 bridge cache。

### 6.4 Quota Summary

Canonical operation：`bridge.quota.summary`

输入：

- `account_key`: optional。
- `protocol`: optional。
- `include_billing`: boolean，默认 false。
- `include_stale`: boolean，默认 true。

输出字段：

- `account_key`
- `windows`
- `remaining_percent`
- `used_tokens`
- `limit_tokens`
- `remaining_tokens`
- `reset_at_unix`
- `billing`
- `stale`
- `degraded_reason`
- `confidence`
- `source`
- `last_checked_unix_ms`
- `guard_ref`

边界：

- quota fields 来自 sidecar quota runtime。
- `quota-empty` route guard 只由 sidecar quota runtime 写入和清除。
- bridge 不根据 quota summary 修改 route guard，也不把 stale cache 当 fresh success。

### 6.5 Safe Actions

Canonical operation family：`bridge.actions.*`

首期允许：

| Action | Scope | Sidecar authority | 语义 |
|---|---|---|---|
| `routeability_recheck` | `bridge.actions.routeability_recheck` | sidecar route diagnostics / guard evaluator | 触发指定账号或模型的可请求性重检，返回 operation id。 |
| `quota_refresh` | `bridge.actions.quota_refresh` | sidecar quota refresh endpoint | 对指定账号触发 quota refresh，可选 billing。 |
| `model_catalog_refresh` | `bridge.actions.model_catalog_refresh` | sidecar model catalog refresh | 触发 account-associated model catalog refresh。 |
| `diagnostics_probe` | `bridge.actions.diagnostics_probe` | sidecar diagnostics probe runner | 运行只读或 dry-run 诊断探针。 |

首期禁止：

- enable / disable account
- delete account
- edit credentials
- edit API keys
- edit route priority
- write route guard state
- write session affinity
- force select account for a live request
- mutate candidate pool
- clear quota-empty / rate-limit / auth-error guard by bridge-local decision

Safe action 响应：

```json
{
  "operation_id": "bro_...",
  "status": "accepted|rejected|running|completed|failed",
  "action": "quota_refresh",
  "target": {
    "account_key": "acct_..."
  },
  "authority": {
    "owner": "sidecar",
    "endpoint": "/v0/management/gettokens/quota-refresh/:account_key"
  },
  "audit_id": "bra_...",
  "result_ref": "optional-sidecar-snapshot-or-ledger-ref"
}
```

规则：

- action 必须有 idempotency key 或 sidecar 去重策略，避免外部 agent 重试造成刷新风暴。
- action 默认异步；同步返回只能表示 accepted/rejected，最终事实通过对应 read surface 重新读取。
- action error 必须保留 sidecar error code 和 recoverable 字段。

## 7. Scope / Auth / Audit

### 7.1 Scope model

首期 scope 使用白名单，不支持通配符授权。

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

Admin/config scopes：

- `bridge.config.read`
- `bridge.config.write`

`bridge.config.write` 只允许管理 bridge 本身的 token、client、transport adapter、scope grant 和 audit retention，不允许写账号、凭证、route state 或 quota state。

### 7.2 Auth model

推荐首期采用本地 bridge client token：

- 默认关闭 bridge transport。
- 用户在 GetTokens 内显式创建 client。
- token 只显示一次，持久层保存 hash。
- 每个 client 绑定 transport allowlist、scope allowlist、可选过期时间和可选 loopback-only 限制。
- 不复用 sidecar 全局 management key 作为外部 bridge token。
- MCP stdio transport 即使由本机启动，也仍应绑定一个逻辑 client id 和 scope grant，便于审计和撤销。

后续可以增加：

- mTLS 或 macOS keychain-backed local identity。
- per-project client grant。
- A2A peer identity。

不在首期做：

- 允许任意局域网免认证访问。
- 通过前端 localStorage 存 bridge secret。
- 让外部 agent 直接拿 GetTokens management key。

### 7.3 Audit model

所有 bridge 调用都写 audit event。最小字段：

- `audit_id`
- `timestamp_unix_ms`
- `transport`
- `client_id`
- `auth_subject_hash_prefix`
- `scopes`
- `operation`
- `target_refs`
- `authority_endpoint`
- `result_status`
- `sidecar_request_id`
- `duration_ms`
- `error_code`
- `recoverable`
- `redaction_version`

审计规则：

- 不记录 secret 明文、raw auth、完整请求 body、cookie、API key。
- route diagnostics 可以记录 account refs、model、protocol、dropped reason code。
- safe action 必须记录 idempotency key hash 和 operation id。
- audit retention 是 bridge config，不是 route state。
- audit 只解释调用历史，不参与 runtime selection。

## 8. Transport 顺序

推荐顺序：MCP -> A2A -> OpenAI-compatible admin surface。

### Phase T1：MCP adapter

优先原因：

- GetTokens 已有 Codex Skills / MCP 管理经验，外部 agent 读取工具语义明确。
- MCP 工具天然适合 read-only diagnostics 和受控 tool action。
- 容易把 scope 映射到 tool allowlist，例如 `gettokens.accounts.summary`、`gettokens.routes.diagnostics`。

MCP 首期形态：

- tools：accounts summary、supported models、route diagnostics、quota summary、safe actions。
- resources：只读 capability manifest、schema、scope list。
- prompts：不作为首期接口真源，可后置。

### Phase T2：A2A adapter

第二优先原因：

- A2A 更适合 agent-to-agent 任务式交互和 operation 状态轮询。
- safe action 的异步 operation id / result ref 可以自然映射为 task。
- 需要等 MCP 的 canonical operation 和 audit 字段稳定后再映射，避免两个 adapter 字段漂移。

A2A 首期形态：

- capability discovery。
- task：diagnose routeability、refresh quota、refresh model catalog。
- artifact：sidecar diagnostic snapshot ref。

### Phase T3：OpenAI-compatible admin surface

第三优先原因：

- 名称容易和 `/v1/models`、`/v1/responses` 等热路径兼容 API 混淆。
- 必须明确 admin namespace，不能污染 OpenAI runtime route。
- 更适合作为脚本/HTTP 管理入口，而不是 agent tool 首选入口。

OpenAI-compatible admin 首期形态：

- 使用独立 admin namespace，例如 `/v1/gettokens/admin/*` 或 `/v0/bridge/*`，不得复用 runtime `/v1/responses`。
- 只暴露 canonical operation 的 HTTP JSON 映射。
- 需要独立 bearer token 和 bridge scope，不接受 runtime relay API key 作为 admin auth。

## 9. Capability manifest

每个 transport 都应暴露同一个 capability manifest，供外部 agent 发现能力和 schema。

```json
{
  "version": "gettokens.bridge.capabilities.v1",
  "surfaces": [
    {
      "id": "bridge.accounts.summary",
      "type": "read",
      "required_scopes": ["bridge.accounts.read"],
      "authority": "sidecar",
      "schema_version": "accounts-summary.v1"
    }
  ],
  "transports": ["mcp", "a2a", "openai_admin"],
  "safety": {
    "route_state_owner": "sidecar",
    "bridge_route_state": "forbidden",
    "mutate_bypass": "forbidden"
  }
}
```

## 10. Canonical artifacts

本 space 固化以下 canonical surface contract artifacts，后续 MCP / A2A / OpenAI-compatible admin adapter 不再各自发明字段：

| Artifact | 路径 | 用途 |
|---|---|---|
| Bridge surface JSON Schema | `schemas/bridge-surface-v1.schema.json` | 定义统一 request / response envelope、read surface 输入输出、safe action 输入输出和 missing scope 等错误 envelope。 |
| Canonical operation manifest | `schemas/canonical-operations-v01.json` | 枚举首批 canonical operation、scope、authority source、schema ref、禁止输出和 adapter 注意事项。 |
| Read surface success example | `examples/read-surface-success-response.json` | 示例化 `bridge.accounts.summary` 成功响应，包含 sidecar authority、audit、source notes 和 redaction 边界。 |
| Safe action accepted example | `examples/safe-action-accepted-response.json` | 示例化 `bridge.actions.quota_refresh` 的 accepted 响应，强调 accepted 只代表 sidecar operation 已创建或去重。 |
| Missing scope rejection example | `examples/rejected-missing-scope-response.json` | 示例化缺少 scope 的 rejected 响应，保留 audit，且不调用 sidecar diagnostics。 |

Artifact 约束：

- JSON Schema 只固化 contract，不引入 runtime validator 依赖。
- request / response envelope 必须绑定 `operation` 与对应 `query` / `data` schema；safe action request 必须携带 `idempotency_key`，缺少 scope 的 rejected envelope 必须显式标记 `sidecar_invoked=false`。
- Manifest 中的 `route_state_owner` 固定为 `sidecar`，adapter 只能映射 canonical operation。
- Manifest 必须列出 canonical error envelope，至少覆盖 `missing_scope`、`invalid_request`、`sidecar_unavailable`，避免 MCP / A2A / OpenAI-compatible admin adapter 各自发明错误字段。
- Examples 只能演示 envelope 和 redaction 语义，不能作为 runtime fixture 伪造 sidecar 已闭环。
- 后续实现如果需要新增字段，必须先更新 schema / manifest / examples，再进入 adapter 实现。

## 11. 不创建独立 route state 的硬边界

bridge 可以保存：

- client config
- token hash
- scope grants
- transport enablement
- audit events
- operation refs
- schema version metadata

bridge 不能保存：

- candidate pool
- selected account
- fallback order
- route guard state
- session affinity
- quota-empty block
- rate-limit block
- auth-error block
- model availability truth
- requestable truth
- live session pin

允许的缓存仅限协议性能缓存，且必须满足：

- cache key 包含 sidecar snapshot id 或 generated time。
- cache TTL 很短，并标记 `cache_source=bridge_transport_cache`。
- 缓存命中仍不得被写回 sidecar 或参与 route decision。
- route diagnostics 和 safe action 默认不使用 bridge cache。

## 12. 后续实现切片

实施顺序固定为：

```text
canonical schema -> scoped auth/audit -> MCP adapter -> A2A adapter -> OpenAI-compatible admin surface
```

### Slice 1：Canonical schema + authority map

目标：

- 以 `schemas/bridge-surface-v1.schema.json` 和 `schemas/canonical-operations-v01.json` 作为唯一入口。
- 在 sidecar / Go core 设计 canonical response DTO，但不让 adapter 直接读取内部临时结构。
- 为每个字段标注 authority source；route truth、quota truth、model availability truth 和 requestable truth 必须来自 sidecar。

验收：

- schema / manifest / example JSON 均可被 JSON parser 解析。
- request schema 不接受 request-side `actor`；actor 只能由 bridge auth 生成到 response / audit。
- 补 schema contract tests，覆盖 accounts summary、models supported、routes diagnostics、quota summary、safe action accepted、missing scope rejected。
- contract tests 需要覆盖 operation/query/data 绑定、safe action idempotency key 必填，以及 missing scope 不调用 sidecar 的 `sidecar_invoked=false`。
- 证明输出中没有 token、API key、cookie、raw auth file、敏感 billing header。

禁止项：

- 禁止先做 MCP / HTTP handler 再反推 schema。
- 禁止由 Wails / frontend 拼出 requestable、model availability 或 quota status。
- 禁止 adapter 私有字段成为事实标准。

风险：

- sidecar route diagnostics DTO 尚未稳定时，schema 可能过早固化字段；实现前应优先补 contract test 和字段 source 注释。
- 如果 canonical schema 只覆盖成功响应，scope / auth / degraded 情况会被 adapter 各自实现出漂移。

### Slice 2：Scoped auth + audit

目标：

- 增加 bridge client、token hash、scope grants、transport allowlist 和可选过期时间。
- 实现 read / action scope 授权；首期不支持通配符 scope。
- 所有调用写 audit event，safe action 额外记录 idempotency key hash 和 sidecar operation id。

验收：

- 缺少 scope 时返回 canonical rejected envelope。
- audit 不记录 raw token、raw auth、完整 cookie、API key、敏感 provider header。
- bridge token 不复用 sidecar management key，也不复用 runtime relay API key。

禁止项：

- 禁止默认打开 bridge transport。
- 禁止把 token 存在 frontend localStorage。
- 禁止外部 agent 直接持有 GetTokens management key。
- 禁止 `bridge.config.write` 修改账号、凭证、route state 或 quota state。

风险：

- audit 上下文过量可能泄露 provider header；需要 redaction test 先行。
- scope model 如果过早支持通配符，后续很难解释最小授权边界。

### Slice 3：MCP adapter

目标：

- 将 canonical operations 映射为 MCP tools/resources。
- resources 暴露 capability manifest、schema、scope list。
- tools 覆盖 accounts summary、supported models、route diagnostics、quota summary、safe actions。

验收：

- MCP 输出与 canonical schema 对齐，不新增 adapter-only truth 字段。
- 本地只读 fixture 证明 tool 输出不含 secret。
- safe action tool 返回 accepted/rejected，不把最终状态伪造成同步完成。

禁止项：

- 禁止 MCP adapter 保存 candidate pool、selected account、route guard state 或 quota guard。
- 禁止 MCP prompt 成为首期接口真源。
- 禁止 tool 自己推导 routeability。

风险：

- MCP tool 参数若与 canonical query 字段不一致，会产生长期 adapter 漂移；contract test 必须覆盖映射。
- stdio transport 容易被误认为免认证；即使本机启动也要绑定 logical client id 和 scope grant。

### Slice 4：A2A adapter

目标：

- 将 safe action 映射为 A2A task。
- 将 read surface 映射为 capability discovery 和只读 artifact。
- operation polling 通过 sidecar operation ref / diagnostics snapshot ref 串联。

验收：

- safe action task 的 accepted、running、completed、failed 状态都能映射回 canonical envelope。
- audit id 在 task lifecycle 中可追溯。
- task artifact 只保存 sidecar diagnostic snapshot ref，不保存 bridge-local route truth。

禁止项：

- 禁止 A2A task 自己维护 operation truth。
- 禁止把 probe 结果写成 route guard 或 future selection promise。
- 禁止把 live session pin 暴露为可写 task 状态。

风险：

- A2A 异步模型可能诱导 adapter 缓存 operation 状态；必须明确最终事实仍通过 sidecar snapshot / diagnostics 读取。
- 如果 polling 频率不受控，外部 agent 可能造成 diagnostics / quota endpoint 压力。

### Slice 5：OpenAI-compatible admin surface

目标：

- 增加独立 admin namespace，例如 `/v1/gettokens/admin/*` 或 `/v0/bridge/*`。
- HTTP JSON 映射必须复用 canonical schema / manifest。
- 与 runtime `/v1/models`、`/v1/responses`、relay API key 完全隔离。

验收：

- runtime `/v1/models`、`/v1/responses` 不受 admin surface 影响。
- admin bearer token 和 bridge scope 不可与 runtime relay API key 混用。
- HTTP error envelope 与 missing scope / invalid request / sidecar unavailable canonical error 对齐。

禁止项：

- 禁止复用 runtime `/v1/*` 热路径作为 admin bridge。
- 禁止 OpenAI-compatible admin surface 接受 runtime relay API key。
- 禁止 admin endpoint 直接改 account enable、credentials、route priority、route guard、session affinity 或 quota guard。

风险：

- namespace 不清会导致外部 client 把 admin surface 当 runtime compatibility ingress。
- HTTP 管理入口更容易被暴露到 loopback 之外；首期必须默认关闭并限制 bridge client token。

## 13. 风险与决策

已定决策：

1. Transport 顺序为 MCP -> A2A -> OpenAI-compatible admin surface。
2. bridge token 不复用 sidecar management key，也不复用 runtime relay API key。
3. safe action 只触发 sidecar operation，不直接修改 route authority。
4. route diagnostics 的 dry-run 不创建 session affinity，不保存 candidate pool。
5. OpenAI-compatible admin surface 必须使用独立 admin namespace，避免和 runtime compatibility ingress 混淆。

主要风险：

- 如果 sidecar route diagnostics schema 尚未稳定，bridge adapter 会过早固化字段；应先落 canonical schema test。
- 如果 OpenAI-compatible admin surface 命名不清，外部 client 可能误把 admin endpoint 当 runtime endpoint；必须在 namespace 和 auth 上隔离。
- safe action 若缺少 idempotency，外部 agent 重试可能造成 quota/model refresh 风暴；实现时必须有去重或速率限制。
- audit 若记录过多上下文，可能泄露 auth / cookie / provider header；实现时先做 redaction test。

## 14. 本轮不做项

- 不实现任何代码。
- 不新增 Wails binding。
- 不新增 frontend 页面。
- 不创建 worktree。
- 不更新 AGENTS / skill / memory；本规格属于当前 space 的一次性协议设计输入，尚未形成 repo-wide 新规则。
