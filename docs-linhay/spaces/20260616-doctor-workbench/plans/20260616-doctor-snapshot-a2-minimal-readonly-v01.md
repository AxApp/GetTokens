# Doctor Snapshot A2 Minimal Readonly v01

日期：2026-06-16

## 范围

本切片把 Doctor Workbench 从 preview-only 推进到只读 `GetDoctorSnapshot` 最小闭环：

1. `internal/wailsapp` 新增 Doctor DTO 与 `GetDoctorSnapshot`。
2. root `main.App` 暴露同名 binding，并映射 DTO。
3. `frontend/wailsjs` 手工最小对齐 Doctor binding / models，不运行 Wails 生成器。
4. `DoctorWorkbenchFeature` 在 Wails runtime 可用时读取 runtime snapshot；无 Wails 或调用失败时回到 explicit preview snapshot。

## Evidence Matrix

| 证据项 | 当前事实 | A2 处理 | 验收方式 |
|---|---|---|---|
| Doctor README / implementation plan | Doctor 只能消费 sidecar/Wails diagnostics，不自行修复或推导 route/quota truth | `GetDoctorSnapshot` 只读聚合，未新增 repair mutate API | Go focused tests + frontend focused tests |
| Route A3 plan | dropped reasons 是 sidecar A2/A3 事实，主仓只透传，不从旧 trace 推导 truth | Doctor 只读取 `ListChannelRouteDecisions` 的 dropped reasons；读取失败返回 degraded | `go test ./internal/wailsapp -run 'TestDoctor'` |
| Quota A3 plan | `quotaFact` 是 sidecar authority；Wails/root/frontend 不重新生成 quota authority | Doctor 只读取 `GetAllQuotaStatuses` 中的 fact；读取失败返回 degraded | `go test ./internal/wailsapp -run 'TestDoctor'` |
| Browser preview | 无 Wails 时必须继续可预览，且不能被误认为 runtime truth | `source=preview` 时显示 preview-only；runtime source 不显示 preview-only | `npm run test:doctor-workbench` |

## DTO

新增 DTO：

- `DoctorSnapshotInput`
- `DoctorSnapshot`
- `DoctorSummary`
- `DoctorCheck`
- `DoctorEvidenceRef`
- `DoctorNavigationTarget`

字段覆盖 `status / reason / repairability / evidence / navigation / authority / confidence / source / sidecarReady / generatedAt`。

## Runtime 边界

- sidecar 未 ready：返回 `not_ready` snapshot，只包含 sidecar readiness check，不读取 route/quota runtime surfaces。
- sidecar ready 但 route/quota 读取失败：对应 check 返回 `degraded`，evidence 记录失败来源，不抛成整页失败。
- route decisions 有 `routeBlocking` dropped reasons：返回 warning，并明确只展示 sidecar facts，不判断 stale recovery。
- quota facts 有 blocking / denied / no_quota / stale risk：返回 warning，并以 sidecar fact explanation 作为 evidence。
- navigation hash 使用当前 App frame hash 规范，例如 `#frame=status`、`#frame=codex&workspace=account-list`、`#frame=accounts&detail=...`，不使用草案期 `#status/all` 或 `#codex/channel-routing?...`。
- 本切片不实现 repair mutate，不调用正式版 App，不启动真实桌面。

## 验收结果

- `go test ./internal/wailsapp -run 'TestDoctor'`：通过。
- `go test . -run 'TestGetDoctorSnapshot|TestMapDoctor'`：通过。
- `npm run test:doctor-workbench`：通过。
- `npm run typecheck`：通过。
- `docs-linhay/scripts/check-docs.sh`：通过。
- `git diff --check`：通过。

## 剩余项

1. 已在 CLIProxyAPI reference sidecar 新增真实只读 unified diagnostics endpoint：`GET /v0/management/gettokens/doctor-diagnostics`。
   - 响应包含 `authority=sidecar`、`source=sidecar-diagnostics`、`generatedAt`、`summary`、`checks[]`。
   - `route_guard_dropped_reasons` check 复用 route guard / route resilience 的 `ChannelRoutingDroppedReason` evidence，不保存或推导第二套路由真源。
   - `quota_facts` check 复用 `QuotaRuntimeState.fact`，保留 `state/source/freshness/confidence/risk/explanation/observedAt/expiresAt/evidenceRefs`。
   - endpoint 只读，不新增 repair action，不调用上游，不刷新 quota，不清 guard。
2. 未跑 Wails 生成器，`frontend/wailsjs` 是手工最小对齐，后续正式生成时需要确认 DTO 一致。
3. 未做截图；本轮没有启动 headless preview 截图链路。
4. 主仓 Wails/root/frontend 尚未改为读取 `/v0/management/gettokens/doctor-diagnostics`；该接线留给下一切片，避免与 Route/Binding 并行改动冲突。

## 2026-06-16 Reference Sidecar 补充验收

- 修改位置：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/doctor_diagnostics.go`、`doctor_diagnostics_test.go`、`rate_limit.go` route registration。
- 证据：缺事实返回 HTTP 200 + `not_ready` checks；seeded route dropped reason 进入 diagnostics evidence；seeded quota fact 进入 diagnostics evidence；GetTokens management route 聚合函数注册 endpoint。
- 验证：`go test -count=1 ./internal/gettokenshooks -run 'TestDoctorDiagnostics|TestQuotaRuntime|TestRouteResilience|TestChannelRouting'` 通过。
