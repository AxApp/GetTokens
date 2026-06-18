# Round 20 Typed Diagnostics Consumer

## Scope

本轮在 GetTokens main / Wails / frontend Doctor Workbench 消费 Round19 CLIProxyAPI sidecar `doctor-diagnostics` typed evidence。

写入边界：
- `internal/wailsapp/doctor.go`
- `internal/wailsapp/types.go`
- `internal/wailsapp/doctor_test.go`
- `app_types.go`
- `app_mappers.go`
- `app_test.go`
- `frontend/wailsjs/go/models.ts`
- `frontend/src/features/doctor-workbench/**`
- `docs-linhay/spaces/20260616-doctor-workbench/README.md`
- `docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round20-typed-diagnostics-consumer.md`

不做：
- 不新增 Doctor repair mutation。
- 不修改 quota/status 无关文件。
- 不从 `label`、`summary`、`refID` 或顶层文本字段反推出 route / quota authority truth。

## Evidence Gate

| 来源 | 当前事实位置 | 缺口 | 验收方式 |
| --- | --- | --- | --- |
| Round19 sidecar output | `docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round19-sidecar-doctor-diagnostics-typed-evidence.md` | sidecar 已输出 nested `droppedReason` 与 `quotaFact`，main/frontend 仍需证明不丢字段 | Wails/root/frontend tests 断言 `droppedReason` / `quotaFact` 透传 |
| Wails DTO | `internal/wailsapp/types.go`、`app_types.go`、`frontend/wailsjs/go/models.ts` | `DoctorEvidenceRef` 只有 `routeEvidence`，不能证明 nested `droppedReason` 到达 frontend binding | 增加 `droppedReason` 只读 DTO 字段与 mapper 测试 |
| Frontend route model | `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts` | 顶层 route fields 可能被当作结构化 target truth | Node test 断言缺 `droppedReason` / legacy `routeEvidence` 时保持 `unknown-non-authoritative` |
| Frontend quota model | `deriveQuotaFactFromDoctorEvidence()` | quota 只能消费 typed `quotaFact`，不能从 summary 文本补 truth | 既有 Node test 断言 text-only quota evidence 只显示普通 summary/source |

## Implemented Chain

1. `DoctorEvidenceRef` 增加只读 `droppedReason` DTO，root mapper 与 generated models 同步透传。
2. `mapDoctorDiagnosticsSnapshot()` 的 sidecar diagnostics route evidence 只在 nested `droppedReason` 存在时生成结构化 route payload；顶层 fields 不再单独升级成 route target。
3. Frontend `extractTypedDoctorRouteEvidence()` 只从 `droppedReason` 或 legacy `routeEvidence` 读取 route identity，不读取 `label/summary/refID/source` 文本，也不读取 evidence 顶层字段作为 authority。
4. Frontend fallback view 会剥离 route authority 字段，并显示 `Unknown non-authoritative evidence` 或 `Partial identity fallback`。
5. `quotaFact` 继续走 typed payload，缺 `quotaFact` 时保持普通 evidence summary/source，不推导 quota truth。

## Validation

已运行：

```bash
go test ./internal/cliproxyapi -run 'TestDoctorDiagnosticsClient' -count=1
go test ./internal/wailsapp -run 'TestDoctorSnapshot' -count=1
go test . -run 'TestMapDoctorSnapshot|TestGetDoctorSnapshot' -count=1
cd frontend && node --test src/features/doctor-workbench/tests/doctorWorkbench.test.mjs src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs
```

结果：全部通过。

## Remaining Risks

- 本轮未启动 dev App；该切片只改只读 DTO / mapper / frontend model，按 dispatch 交由主控后续做聚合验收。
- `frontend/wailsjs/go/models.ts` 为手动同步本轮新增字段；主控若后续运行 Wails binding generation，需要确认 `droppedReason` 仍保留。
- Doctor Workbench 仍保持只读展示，不提供 repair mutation；route / quota authority 继续依赖 sidecar typed evidence。
