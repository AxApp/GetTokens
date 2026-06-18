# Protocol Bridge Sidecar Execution Binding Slice v01

日期：2026-06-17

## 1. 本轮目标

在 `internal/protocolbridge` 内把 MCP adapter handler 当前的 fakeable executor，收敛成更接近 sidecar execution binding 的最小契约。

本轮只做：

- operation executor contract 收紧
- stub runner
- authorize -> executor 顺序测试
- read / safe action canonical envelope 测试
- audit persistence interface 与 stub 验证
- sidecar-bound executor contract
- fake HTTP transport tests
- canonical operation -> sidecar request path/body/header 映射与 redaction 约束

本轮不做：

- 真实 MCP stdio transport
- 真实 sidecar HTTP / stdio 调用
- 独立 route / quota / model truth
- Wails、frontend、root App binding 改动
- audit 真实持久层

## 2. 证据门禁

| 来源 | 当前事实 | 对本轮切片的约束 |
| --- | --- | --- |
| `README.md` 当前状态 | `internal/protocolbridge.MCPAdapter` 已有 fakeable `OperationExecutor`，但仍停在 handler contract。 | 本轮只能把 executor 往 sidecar execution binding 推进一步，不能跨到真实 transport。 |
| `plans/20260616-scoped-auth-audit-runtime-plan-v01.md` | 成功路径要求先授权，再调 sidecar authority；read 返回 sidecar authority data；safe action 只返回 accepted operation ref。 | 测试和实现都要围绕这三条做强约束。 |
| `schemas/canonical-operations-v01.json` | safe action `adapter_notes` 明确 accepted 只表示创建或复用 sidecar operation，不是最终 truth。 | 成功 action response 不得暴露 completed data，不得声称 quota / route / model 已完成刷新。 |
| `schemas/bridge-surface-v1.schema.json` 与 examples | canonical envelope 已有 `authority`、`audit`、`sidecar_invoked`、`operation_ref` 语义。 | 本轮只能复用这些字段，不新增 adapter 私有成功语义。 |
| `schemas/bridge-surface-v1.schema.json#$defs.error` | canonical error enum 已允许 `sidecar_unavailable`、`operation_rejected`、`rate_limited`，且 error 可带 `sidecar_error_code`。 | sidecar HTTP failure taxonomy 必须先落到现有 canonical error 字段，不新增 bridge 私有失败 envelope。 |
| 用户本轮约束 | 只允许写 `internal/protocolbridge/**` 和本 space 文档。 | 不改 Wails/root/frontend/sidecar reference，不接独立 runtime truth。 |

## 3. BDD 场景

### 场景 A：read operation 在授权后进入 sidecar binding stub

- Given MCP tool 请求映射到 read canonical operation。
- When `Runtime.Authorize` 成功。
- Then adapter 才调用 executor。
- And 成功响应固定是 sidecar authority envelope。
- And `sidecar_invoked=true` 仅表示已进入 sidecar execution binding stub，不表示真实 transport 已实现。

### 场景 B：safe action 成功只返回 accepted operation ref

- Given safe action 请求带有 scope 和 `idempotency_key`。
- When executor 成功创建或复用 sidecar-owned operation ref。
- Then response status 固定为 `accepted`。
- And response 只返回 `operation_ref`、authority、audit、warnings。
- And 不返回 action completed data，不把 accepted 伪造成 completed。

### 场景 C：授权失败不进入 executor

- Given 缺 scope、缺 `idempotency_key`、client disabled/expired、transport mismatch 或 unknown tool。
- When adapter 处理请求。
- Then 返回 canonical rejected envelope。
- And `sidecar_invoked=false`。
- And executor call count 保持 0。

### 场景 D：audit persistence 先走 interface/stub

- Given adapter 有 audit persistence interface。
- When 请求在 authorize reject、read success、safe action accepted 或 executor error 结束。
- Then adapter 把 redacted audit event 交给 stub persister。
- And persister failure 不改变 canonical response。
- And 本轮不落真实存储层。

### 场景 E：sidecar HTTP failure taxonomy 保持 canonical 且脱敏

- Given `SidecarHTTPExecutor` 已经把 canonical operation 映射到 sidecar HTTP request。
- When sidecar 返回 HTTP non-2xx、transport/timeout error、malformed JSON，或返回 `status=rejected` 的 sidecar envelope。
- Then adapter 返回 canonical rejected envelope，而不是泄露 transport/raw body 细节。
- And HTTP non-2xx、transport/timeout error、malformed JSON 统一归为 `error.code=sidecar_unavailable`。
- And sidecar 主动拒绝统一归为 `error.code=operation_rejected`，必要时透传安全的 `error.sidecar_error_code`。
- And `error.message`、`error.sidecar_error_code`、audit projection、warnings 都不得泄露 raw `Authorization`、`Cookie` 或明文 `idempotency_key`。

## 4. 计划中的最小实现

1. 把 executor 成功结果分成 read envelope 与 accepted action ref 两类，避免 safe action 任意回传 `completed` 或 `data`。
2. 提供 package 内 stub runner，方便后续 sidecar binding 替换前先固定契约。
3. 在 adapter 内加入可选 audit persister interface，默认 no-op。
4. 保持所有 authority owner 仍为 `sidecar`，只允许补 snapshot / ledger / sidecar request ref。
5. 新增 `SidecarHTTPExecutor`，只在 `internal/protocolbridge` 内定义 sidecar HTTP contract 与 fake transport interface，不接真实 sidecar 网络。
6. 固化 canonical operation -> sidecar endpoint/path 映射，read/safe action 一律走 sidecar endpoint，body 只携带授权后的 actor、authority、caller 和 canonical query。
7. safe action 只透传 `idempotency_key` 的 SHA-256 哈希 header，不向 body、header 或错误文本暴露明文 key、Authorization 或 Cookie。
8. sidecar HTTP failure 先在 `internal/protocolbridge` 内分类成 canonical executor error：HTTP non-2xx / transport / malformed JSON -> `sidecar_unavailable`，sidecar rejected envelope -> `operation_rejected`；adapter 只输出 canonical rejected envelope。

## 5. 验收

- `go test -count=1 ./internal/protocolbridge`
- `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 6. 风险与后续

- 当前 `sidecar_invoked=true` 只代表进入 sidecar execution binding contract，不代表真实 sidecar transport 已存在；后续仍需单独切 transport / runner。
- audit persistence 本轮只有 interface/stub，没有 retention、查询或真实存储错误恢复。
- 当前 fake transport 只证明请求 contract 和 failure taxonomy，不证明 sidecar 真实 endpoint 对接、认证、重试策略或上游 sidecar error code 全量枚举。
- 真正的 sidecar operation runner、HTTP client、authority endpoint 参数化仍待后续切片。

## 7. 沉淀审计

- 本轮新增模式：canonical operation -> sidecar HTTP request mapping、safe action idempotency 哈希 header、fake transport contract test。
- 结论：暂不升级到项目级 skill、`docs-linhay/dev/` 或 `AGENTS.md`。
- 原因：这些约束仍然只服务 `internal/protocolbridge` 当前切片，尚未证明会在其他 GetTokens 领域或跨层 workflow 中重复出现。
- 记录方式：先留在本 space 计划与 `README.md`，等真实 sidecar client / runner 落地后再判断是否形成稳定复用流程。
