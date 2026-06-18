# Main Repo Doctor Diagnostics Consumer v01

日期：2026-06-17

## 范围

本切片只处理主仓 `Doctor Workbench` / quota evidence 对 reference sidecar 只读 endpoint `GET /v0/management/gettokens/doctor-diagnostics` 的消费接线：

1. `internal/cliproxyapi` 新增 doctor diagnostics client / types / tests。
2. `internal/wailsapp` 优先读取 sidecar unified diagnostics；sidecar not ready 或 endpoint `404/501` 时回退既有 `GetDoctorSnapshot` 聚合。
3. root `main.App` / `app_types.go` / `app_mappers.go` 透传新的 doctor snapshot source 和 checks。
4. `frontend/src/features/doctor-workbench` 识别 `sidecar-diagnostics` runtime source，不因旧 sidecar 或 preview 缺 Wails binding 崩页。

## Evidence Matrix

| 证据项 | 当前事实 | 本切片处理 | 验收方式 |
| --- | --- | --- | --- |
| Doctor A2 剩余项 | 主仓 `GetDoctorSnapshot` 仍是本地 `wails-aggregate`，尚未消费 sidecar unified diagnostics | `GetDoctorSnapshot` ready 时优先读 `doctor-diagnostics`；只读、不新增 repair mutate | `go test -count=1 ./internal/wailsapp -run 'TestDoctor|TestDoctorDiagnostics'` |
| CLIProxyAPI reference contract | `GET /v0/management/gettokens/doctor-diagnostics` 已存在，返回 `authority/source/generatedAt/summary/checks` | `internal/cliproxyapi` 直接对齐该 response，并保留 `404/501 => unsupported` 语义 | `go test -count=1 ./internal/cliproxyapi -run 'TestDoctorDiagnostics|TestGetDoctor'` |
| 兼容旧 sidecar | 老 sidecar 可能没有 endpoint，或返回 `501/404` | `internal/wailsapp` 必须回退到既有 route/quota 聚合，不让 Doctor 页面崩 | `go test -count=1 ./internal/wailsapp -run 'TestDoctor|TestDoctorDiagnostics'` |
| Quota authority | doctor quota evidence 应优先消费 sidecar diagnostics / quota fact，不在 frontend 重新推导 authority | frontend 只消费 Wails/root 透传后的 diagnostics snapshot；quota fact card 兼容现有 `resolveQuotaFact()` | `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs` |
| Root binding chain | 新增 Wails-facing 消费链不能只停在 `internal/wailsapp` | root `app.go` / mapper / DTO / tests 同步更新 | `go test -count=1 . -run 'TestGetDoctorSnapshot|TestMapDoctor|TestDoctorDiagnostics'` |

## BDD 场景

1. Given sidecar ready 且 `doctor-diagnostics` endpoint 返回 checks
   When `GetDoctorSnapshot` 被调用
   Then Wails/root/frontend 返回 `source=sidecar-diagnostics` 的 doctor snapshot，并保留 sidecar evidence。

2. Given sidecar ready 但 `doctor-diagnostics` endpoint 返回 `404` 或 `501`
   When `GetDoctorSnapshot` 被调用
   Then Wails 回退到既有 `wails-aggregate` 聚合，不抛错、不让页面崩。

3. Given sidecar not ready
   When `GetDoctorSnapshot` 被调用
   Then 保持既有 `not_ready` snapshot，只包含 readiness check，不读取 doctor diagnostics endpoint。

4. Given browser preview 或缺失 Wails binding
   When Doctor Workbench 渲染
   Then 继续显示 explicit preview snapshot，并明确 `source=preview`。

## 沉淀审计

- 本轮新增的模式仍落在既有 `gettokens-ops-governance` tracer-bullet 和 `gettokens-domain-engineering` 的 sidecar authority / fallback 边界内，没有出现新的稳定 skill 缺口。
- 因此本轮不新增 skill，也不升级 `AGENTS.md`。
- 任务允许写入面限定在 doctor/quota spaces 与实现文件，本轮不额外写 `docs-linhay/memory/`。
