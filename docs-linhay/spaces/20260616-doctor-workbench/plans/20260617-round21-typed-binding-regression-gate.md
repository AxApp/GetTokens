# Round 21 Typed Binding Regression Gate

## Scope

本轮只为 Round20 Doctor typed diagnostics consumer 补防回归门禁，证明 nested `droppedReason` 不会在 Wails/root/frontend generated binding 同步时丢失。

写入边界：
- root Doctor mapper / tests。
- `internal/wailsapp` Doctor DTO / tests。
- `frontend/wailsjs` binding tests 或 Doctor Workbench focused tests。
- 本计划与 Doctor Workbench README。

不做：
- 不新增 Doctor repair mutation。
- 不把 `label`、`summary`、`refID` 或顶层文本 evidence 升级为 route authority。
- 不改 quota/status 无关文件。

## Evidence Gate

| 来源 | 当前事实位置 | 风险 | 验收方式 |
| --- | --- | --- | --- |
| Round20 typed consumer | `plans/20260617-round20-typed-diagnostics-consumer.md` | `frontend/wailsjs/go/models.ts` 当时为手动同步，后续 Wails generation 可能丢 `droppedReason` | 新增 generated binding source test 同时断言 Go DTO、root mapper、generated model constructor 与 frontend model |
| Wails DTO | `internal/wailsapp/types.go` | DTO JSON 边界若缺 `droppedReason`，frontend 无法区分 nested typed payload 与顶层文本 evidence | `internal/wailsapp` JSON roundtrip test 断言 nested route fields 保留 |
| Root DTO / mapper | `app_types.go`、`app_mappers.go` | root `main.App` 是 Wails 实际绑定对象；只改 internal DTO 不能证明 binding 可见 | root JSON contract / mapper test 断言 `droppedReason` key 和 nested typed payload 保留 |
| Frontend generated binding | `frontend/wailsjs/go/main/App.*`、`frontend/wailsjs/go/models.ts` | `GetDoctorSnapshot` 或 `DoctorEvidenceRef.droppedReason` export 被 generator 或手工同步遗漏 | `frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs` 读源文件做链路断言 |

## BDD Scenarios

1. Given sidecar diagnostics 返回 route evidence with misleading top-level text fields and nested `droppedReason`
   When Wails DTO JSON roundtrip happens
   Then nested `droppedReason.accountKey/authId/model/source/scope/reason/routeBlocking` remains available.

2. Given root `main.App` maps `internal/wailsapp.DoctorEvidenceRef`
   When the root DTO is marshaled for Wails
   Then JSON includes `droppedReason` and preserves the nested typed route payload.

3. Given Wails/generated bindings are the frontend source of truth
   When Doctor Workbench imports `GetDoctorSnapshot`
   Then generated `DoctorEvidenceRef` declares and converts `droppedReason` as `DoctorRouteEvidencePayload`.

## Implemented Gate

- `internal/wailsapp/doctor_test.go` adds DTO JSON roundtrip for nested `droppedReason`.
- `app_test.go` adds root DTO JSON contract for nested `droppedReason`.
- `frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs` checks internal/root DTO tags, root mapper, generated `App` binding, generated `DoctorEvidenceRef` constructor, generated `DoctorRouteEvidencePayload` fields, and Doctor frontend typed model.

## Validation

已运行：

```bash
go test ./internal/wailsapp -run 'TestDoctorSnapshot|TestDoctorEvidenceRefJSONPreservesDroppedReasonTypedPayload' -count=1
go test . -run 'TestMapDoctorSnapshot|TestDoctorEvidenceRefRootJSONContract|TestGetDoctorSnapshot' -count=1
cd frontend && node --test wailsjs/doctorTypedEvidenceBinding.test.mjs
cd frontend && node --test src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs
cd frontend && node --test src/features/doctor-workbench/tests/doctorWorkbench.test.mjs
docs-linhay/scripts/check-docs.sh
git diff --check -- app_test.go internal/wailsapp/doctor_test.go frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs docs-linhay/spaces/20260616-doctor-workbench/README.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round21-typed-binding-regression-gate.md
```

结果：全部通过。Go tests 仅出现 macOS 链接器重复 `-lobjc` warning，未影响测试结果。

## Remaining Risks

- 本轮不运行 Wails binding generator；门禁证明当前 generated source 与 Go/root/frontend 链路一致，并会在字段被移除时失败。
- 本轮不启动 dev App；按 dispatch，本轮是 typed binding 防回归，不涉及 native runtime 可见性。
