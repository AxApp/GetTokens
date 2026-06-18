# Round 18: Recheck Routeability Sidecar Tracer

## 证据门禁

- 问题来源：operator controls contract 中 `recheck_routeability` 仍与 `rerun_bounded_reconcile` 一起返回 `not_implemented`，导致前端只能展示失败结果，无法证明 sidecar 已经重新采样 route guard / persisted runtime state。
- 当前事实位置：
  - sidecar action handler：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions.go`
  - sidecar action tests：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions_test.go`
  - route state helper：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience.go`、`channel_runtime_state.go`
- 当前缺口：`recheck_routeability` 没有真实 sidecar-owned action 结果；它不能返回 `applied` / `dry_run`、不能带 action-specific before/after evidence、不能生成 audit id，也不能证明没有进入无限 reconcile。
- 预期验收：给定 `accountKey` 或 `authId` 与可选 `model`，`recheck_routeability` 只重新采样 in-memory guard 与 persisted channel runtime blocks，返回 `authority=sidecar`、`before` / `after`、`droppedReasons`、`tracerOnly=true`、`reconcileRuns=0`；dry-run 不生成 `auditId`，非 dry-run 生成 `auditId`。
- 反证条件：若 action 无目标仍成功、dry-run 写 store、非 dry-run 清除 guard、调用 bounded reconcile、或把 `rerun_bounded_reconcile` 顺手实现为成功，则本轮不通过。

## 范围

- 只实现 `recheck_routeability` 的最窄 tracer action。
- 保持 `rerun_bounded_reconcile` 为 `not_implemented`。
- 不触碰真实外部服务，不访问上游模型接口，不做全局 retry。
- 不改前端、Doctor、Quota、Protocol、Extension。

## 已证明链路

- `recheck_routeability` dry-run：
  - 需要 `accountKey` 或 `authId`。
  - 对目标账号和模型重新采样 in-memory `AccountRouteGuardStore` 与 persisted `channel-routing/config.json.runtimeStates`。
  - 返回 `status=dry_run`、`authority=sidecar`、`before/after`、`droppedReasons`。
  - 不生成 `auditId`，不改 store。
- `recheck_routeability` applied：
  - 仍是只读 tracer，不清 block、不跑 reconcile。
  - 返回 `status=applied`、`auditId=route-audit-*`、`tracerOnly=true`、`reconcileRuns=0`。
- `rerun_bounded_reconcile`：
  - 保持 `501 not_implemented`，避免把 bounded repair 与只读 tracer 混在同一轮实现。

## 验证

- 红灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(RecheckRouteability|UnsupportedActions)' -count=1`
  - 初始失败为 `RouteResilienceActionResponse` 缺少 tracer 字段，且 `recheck_routeability` 仍走 `not_implemented` 分支。
- 绿灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
  - `go test ./internal/gettokenshooks -count=1`
  - `go test ./... -count=1`

## 剩余风险

- 本轮没有接入 account-store runtime routeability service，也没有触发 `sdk/cliproxy.Service.reconcileAccountStoreRouteability`；返回的是 sidecar-owned route guard / persisted runtime-state tracer，而不是完整 repair。
- `before` 与 `after` 在当前 tracer 语义下通常相同；后续若接入真实 routeability evaluator，应保持 bounded、target-scoped，并继续输出 `reconcileRuns` 或等价计数，避免无限 reconcile 不可见。
- action response 新增 `tracerOnly` 与 `reconcileRuns` 字段；主仓 UI 目前按原始 sidecar response 展示，若后续要做更细 UI，需要在 Wails/frontend DTO 中显式消费这些字段。
