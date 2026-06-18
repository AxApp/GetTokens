# Route Resilience Operator Controls Contract Plan

日期：2026-06-16

## 结论

`operator controls` 可以做，但必须作为 sidecar-owned route resilience 的受控修复面，而不是前端直接改 candidate pool、route guard 或插件执行面的通用入口。

本期只设计三个最小动作：

1. `clear_transient_lockout`
2. `rerun_bounded_reconcile`
3. `recheck_routeability`

## 证据门禁

| 证据项 | 当前事实位置 | 结论 |
|---|---|---|
| transient route guard 已有来源分层 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go` | `auth-error`、`upstream-rate-limit`、`upstream-error` 是 transient source，可按 auth 受控清理 |
| 成功请求会清 transient guard | `AccountRouteGuardStore.MarkResult` | 已有自动恢复语义，operator 清理必须只作为人工补救，不覆盖自动恢复 |
| 健康 auth 更新会清 transient guard | `sdk/cliproxy/service.go` 的 `clearTransientRouteGuardsForHealthyAuth` | 清理动作必须先确认 runtime auth 当前健康，避免强行放行异常账号 |
| bounded reconcile 已存在 | `runBoundedAccountStoreRouteabilityRepair`、`evaluateAccountStoreRouteability` | operator rerun 应复用现有 bounded repair，不新增无限重试或前端轮询 |
| 手动禁用有独立 guard source | `manual-disabled` 与 `ClearManualDisabledAuth` | `clear_transient_lockout` 禁止清 `manual-disabled`、`rate-limit`、`quota-empty` |
| explain / recent decisions 已有 structured dropped reasons | A2/A4 输出与 `RouteDecisionDroppedReasonSnapshot` | operator 动作完成后必须能被 diagnostics / dropped reasons 解释，不只返回 toast |

## 受控动作定义

### clear_transient_lockout

目标：清除单个 account/auth 在 transient source 上的短期锁定。

输入：

- `accountKey` 或 `authId`，二者至少一个，优先以 account-store `acct_*` 身份定位。
- `sources` 只能是 `auth-error`、`upstream-rate-limit`、`upstream-error` 的子集。
- `reason` 必填，进入审计日志。

拒绝条件：

- 尝试清理 `manual-disabled`、`rate-limit`、`quota-empty`。
- 目标 auth 当前仍是 disabled、unavailable 或 `StatusError`，除非请求同时声明 `dryRun=true`。
- 未提供 account/auth 精确目标。

验收：

- 清理后只影响目标 auth 的 transient blocks。
- 不删除 provider/model 范围内其他账号的 lockout。
- 返回 `before` / `after` block count 和被拒绝 source 列表。

### rerun_bounded_reconcile

目标：对 account-store runtime routeability 做一次有上限的 reconcile。

输入：

- `accountKey` 必填。
- `maxDurationMs` 固定由 sidecar clamp，不能由前端任意放大。
- `reason` 必填。

拒绝条件：

- account 不存在。
- account 当前 disabled。
- 同一 account 已有 reconcile in-flight。

验收：

- 只调用现有 bounded repair 路径。
- 输出 `statusBefore`、`statusAfter`、`failureClassBefore`、`failureClassAfter`、`registeredModelsCount`。
- 若仍失败，必须返回 structured dropped reason 或 routeability reason。

### recheck_routeability

目标：只读重新评估 account 当前 routeability，不改变 candidate pool。

输入：

- `accountKey` 必填。
- `model` 可选；提供时必须使用 A4 的 model-scope filter。

拒绝条件：

- 无 account 精确目标。
- 请求携带 selector rewrite、候选排序或临时 provider override。

验收：

- 返回 `registered_routeable`、`applied_not_registered`、`degraded`、`pending` 中的一个状态。
- model-level lockout 只影响请求模型，不拖垮 provider。
- 输出可复用给 Doctor Workbench 的只读诊断片段。

## API 边界

建议 sidecar management surface：

- `POST /v0/management/gettokens/route-resilience/actions`
- 请求体：

```json
{
  "action": "clear_transient_lockout",
  "accountKey": "acct_00000000-0000-4000-8000-000000000000",
  "authId": "codex-auth-1",
  "model": "gpt-5",
  "sources": ["upstream-error"],
  "reason": "operator verified upstream recovered",
  "dryRun": false,
  "idempotencyKey": "route-op-20260616-0001"
}
```

统一响应：

```json
{
  "ok": true,
  "action": "clear_transient_lockout",
  "status": "applied",
  "authority": "sidecar",
  "accountKey": "acct_00000000-0000-4000-8000-000000000000",
  "authId": "codex-auth-1",
  "model": "gpt-5",
  "before": {},
  "after": {},
  "auditId": "route-audit-0001",
  "droppedReasons": []
}
```

## BDD 场景

1. 给定某账号只有 `upstream-error` transient guard，当 operator 清理该账号时，sidecar 只移除该账号的 transient block，并留下审计事件。
2. 给定某账号被 `manual-disabled` 禁用，当 operator 请求 `clear_transient_lockout` 时，sidecar 拒绝清理 manual guard，并保持账号不可路由。
3. 给定 account-store 显示 `applied_not_registered`，当 operator 触发 `rerun_bounded_reconcile` 时，sidecar 复用 bounded repair，返回前后状态与 failure class。
4. 给定某模型被 model-scope lockout，当 operator 触发 `recheck_routeability(model=gpt-5-mini)` 时，结果不得被 `gpt-5` 的 lockout 污染。
5. 给定 Protocol Bridge 后续调用 operator action，当请求缺少 scope grant 或 idempotency key 时，bridge 必须拒绝，不能触达 sidecar action。

## TDD 门禁

CLIProxyAPI focused tests：

- `TestRouteResilienceActionClearsOnlyTransientGuardForTargetAuth`
- `TestRouteResilienceActionRejectsManualDisabledAndQuotaSources`
- `TestRouteResilienceActionRerunsBoundedReconcileWithBeforeAfterState`
- `TestRouteResilienceActionRecheckUsesModelScopeFilter`
- `TestRouteResilienceActionWritesRedactedAuditEvent`

GetTokens main repo tests：

- Wails/client DTO 测试只验证透传，不在 Wails 重建 authority。
- Doctor Workbench 只能消费 operator action result，不能直接改 route guard。
- Protocol Bridge 测试必须证明缺 scope/idempotency 时不会发 sidecar call。

## 禁止项

1. 禁止前端直接修改 route guard store。
2. 禁止把 operator controls 做成插件任意执行入口。
3. 禁止清理 `manual-disabled`、`quota-empty`、持久 rate-limit policy。
4. 禁止绕过 sidecar 维护独立 route state。
5. 禁止把 reconcile 做成无界重试。

## 下一步实现切片

1. 在 CLIProxyAPI reference 新增 route resilience action handler 与纯内存 audit store。
2. 先补失败测试，再实现 `clear_transient_lockout` 的最小路径。
3. 再接 `rerun_bounded_reconcile` 与 `recheck_routeability`。
4. 主仓只做 Wails DTO / Doctor Workbench 展示与 Protocol Bridge scoped call 预留，不做前端 authority。

## 2026-06-16 切片落地：sidecar action handler

已完成：

- 新增 sidecar management route：`POST /v0/management/gettokens/route-resilience/actions`，注册到 `ConfigureGetTokensManagementRoutes`。
- `clear_transient_lockout` 只清理 `auth-error`、`upstream-rate-limit`、`upstream-error`，且必须提供 `accountKey` 或 `authId` 精确目标与 `reason`。
- 请求包含 `manual-disabled`、`rate-limit`、`quota-empty` 等非 transient source 时整次拒绝，不做部分清理。
- `dryRun=true` 返回 `before` / `after` block count 和 `droppedReasons` 预览，不调用 store 写入。
- 响应固定声明 `authority=sidecar`，包含 `action`、`status`、`before`、`after`、`droppedSources` / `droppedReasons` 等 route resilience evidence。

本切片暂不实现：

- `rerun_bounded_reconcile`：当前 `internal/gettokenshooks` management route 聚合层没有直接持有 `sdk/cliproxy.Service` 的 bounded repair 调用权限；贸然实现会变成假 reconcile 或无界重试。
- `recheck_routeability`：当前 hook 层没有统一的只读 routeability service/store projection 可返回 `registered_routeable` / `applied_not_registered` / `degraded` / `pending`；本切片先返回 `not_implemented`，后续必须复用 A4 model-scope filter 与 `ChannelRoutingDroppedReason` DTO。

验证：

- `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction|TestAccountRouteGuard'`

## 2026-06-16 切片落地：main repo action bridge

已完成：

- 主仓 `internal/cliproxyapi.Client.RunRouteResilienceAction` 以 `POST /v0/management/gettokens/route-resilience/actions` 调用 sidecar management endpoint。
- `internal/wailsapp.App.RunRouteResilienceAction` 与 root `main.App.RunRouteResilienceAction` 只透传 request/response，不在 Wails/root 推导 route truth。
- DTO 保留 sidecar response 中的 `authority`、`action`、`status`、`before`、`after`、`droppedSources`、`droppedReasons`、`notImplementedReason`、`error`，并额外带出 `httpStatus` 让 UI 区分 501 `not_implemented`。
- 仅对 route resilience action endpoint 放行非 2xx response body，避免真实 sidecar 的 501 被通用 Wails request 包装成不可消费的 error 字符串。
- 手工同步 `frontend/wailsjs` 最小 binding，并新增 binding existence test。

本切片明确不实现：

- 不在主仓补造 `rerun_bounded_reconcile` 或 `recheck_routeability` 能力。
- 不在 frontend/Wails 直接修改 route guard、candidate pool、bounded repair 或 routeability truth。

验证：

- `go test -count=1 ./internal/cliproxyapi -run 'TestRouteResilienceAction|TestRunRouteResilienceAction'`
- `go test -count=1 ./internal/wailsapp -run 'TestRouteResilienceAction|TestRunRouteResilienceAction|TestListChannelRouteDecisions'`
- `go test -count=1 . -run 'TestRouteResilienceAction|TestMapRouteResilienceAction|TestGetDoctorSnapshot|TestMapDoctor'`
- `node --test frontend/wailsjs/*route* frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
