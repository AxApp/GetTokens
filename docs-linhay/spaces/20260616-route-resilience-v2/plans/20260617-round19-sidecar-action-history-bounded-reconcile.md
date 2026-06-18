# Round 19: Sidecar Action History and Bounded Reconcile Tracer

## 证据门禁

- 问题来源：第十八轮后 `recheck_routeability` 已是 sidecar tracer，但 action 结果仍缺 sidecar-owned history；`rerun_bounded_reconcile` 仍是纯 `not_implemented`，operator 无法获得可审计的 bounded tracer 结果。
- 当前事实位置：
  - action handler：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions.go`
  - action tests：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions_test.go`
  - space 状态：`docs-linhay/spaces/20260616-route-resilience-v2/README.md`
- 当前缺口：
  - `clear_transient_lockout` / `recheck_routeability` 没有 sidecar-owned action history 查询面。
  - `rerun_bounded_reconcile` 返回 501，无法表达 bounded、可审计、不会无限运行的 tracer boundary。
- 验收方式：
  - focused tests 证明三类 action 写入 history，history 可按 action / accountKey 查询。
  - `rerun_bounded_reconcile` dry-run 无 audit，非 dry-run 有 audit；两者都 `tracerOnly=true`、`reconcileRuns=1`。
  - store block 不因 bounded tracer 被清理，且不调用外部服务、不进入循环。
- 反证条件：
  - `rerun_bounded_reconcile` 仍返回 501。
  - history 来自前端本地状态而不是 sidecar handler。
  - `reconcileRuns` 无界、递增循环，或 action handler 引入外部服务调用。
  - `clear_transient_lockout` / `recheck_routeability` 成功但查不到 sidecar history。

## 实现边界

- 新增 sidecar 内存 history store：带锁、默认最多保留 200 条，查询默认返回 100 条。
- 新增管理查询路由：`GET /v0/management/gettokens/route-resilience/actions/history`。
- 新增可测试 helper：`ListRouteResilienceActionHistory(filter)`。
- history item 字段：
  - `action`
  - `target`
  - `status`
  - `auditId`
  - `accountKey`
  - `authId`
  - `model`
  - `beforeBlockCount`
  - `afterBlockCount`
  - `createdAt`
  - `tracerOnly`
  - `reconcileRuns`
- `clear_transient_lockout`：
  - dry-run / applied / target-scoped rejected 都写 sidecar history。
  - 既有 clear 语义不变，只清 transient sources，不清 manual / rate / quota。
- `recheck_routeability`：
  - dry-run / applied 都写 sidecar history。
  - 继续保持只读 tracer：`tracerOnly=true`、`reconcileRuns=0`。
- `rerun_bounded_reconcile`：
  - 要求 `accountKey` 或 `authId`。
  - dry-run 返回 `dry_run`，不生成 `auditId`。
  - 非 dry-run 返回 `applied` 和 `auditId=route-audit-*`。
  - `reconcileRuns=1` 明确表示单次 target-scoped 采样 / re-evaluate。
  - 不循环、不访问外部服务、不清理 store block。

## 已证明链路

- 红灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(RecheckRouteabilityAppliedAuditsWithoutReconcile|RerunBoundedReconcile)' -count=1`
  - 初始失败为缺少 `RouteResilienceActionHistoryResponse`、`resetRouteResilienceActionHistoryForTest`，证明测试先行覆盖 history 与 bounded tracer 新合约。
- 绿灯：
  - `clear_transient_lockout` applied 后可查询 sidecar history；history 记录 before/after block count 为 `6 -> 3`，auditId 与 response 一致，`reconcileRuns=0`。
  - `recheck_routeability` applied 后可查询 sidecar history；history 记录 before/after block count 为 `1 -> 1`，`tracerOnly=true`、`reconcileRuns=0`。
  - `rerun_bounded_reconcile` applied 返回 200；history 记录 auditId、`tracerOnly=true`、`reconcileRuns=1`、before/after block count 为 `1 -> 1`。
  - `rerun_bounded_reconcile` dry-run 返回 `dry_run`，无 auditId，`tracerOnly=true`、`reconcileRuns=1`。

## 验证记录

- `gofmt -w internal/gettokenshooks/route_resilience_actions.go internal/gettokenshooks/route_resilience_actions_test.go`
- `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(RecheckRouteabilityAppliedAuditsWithoutReconcile|RerunBoundedReconcile)' -count=1`
- `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
- `go test ./internal/gettokenshooks -count=1`

## 剩余风险

- action history 当前是 sidecar 进程内内存 store，重启后不保留；本轮只满足 sidecar-owned 查询/记录，不引入 SQLite 持久化。
- `rerun_bounded_reconcile` 是 bounded tracer boundary，不是真实 repair evaluator；它不会调用 account-store runtime routeability service，也不会主动清理 runtime guard。
- 第一次整包回归曾出现一次 `TestDoctorDiagnosticsIncludesRouteDroppedReasonEvidence` 失败，随后该用例单跑、Doctor+Action 组合、整包复跑均通过；主控聚合测试可关注 Doctor 全局状态顺序耦合是否还有独立问题。
- reference 目录内已有他人改动 `internal/gettokenshooks/doctor_diagnostics.go` / `doctor_diagnostics_test.go`，本轮未触碰。

## 主控聚合测试建议

- 在所有 subagent 合并后先跑 reference focused 包：
  - `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
  - `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks -count=1`
- 再跑主仓聚合边界：
  - `go test ./internal/cliproxyapi ./internal/wailsapp -count=1`
  - 若前端已接入 history 查询，再补 WailsJS/client DTO 和 frontend model tests。
- 若 Doctor 用例再次偶发失败，优先隔离 `TestDoctorDiagnosticsIncludesRouteDroppedReasonEvidence` 与本轮 action tests 的顺序组合，确认是否为全局 route guard / runtime config path 清理问题。
