# Round 19 Sidecar Doctor Diagnostics Typed Evidence

## Scope

本轮增强 CLIProxyAPI reference sidecar 的只读 `doctor-diagnostics` 输出字段完整度，让 GetTokens main side 不需要靠 `label/refID/summary` 文本解析补 route / quota truth。

写入边界：
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/doctor_diagnostics.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/doctor_diagnostics_test.go`
- `docs-linhay/spaces/20260616-doctor-workbench/README.md`
- `docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round19-sidecar-doctor-diagnostics-typed-evidence.md`

不做：
- 不新增 Doctor repair mutation。
- 不修改 GetTokens main client / Wails root / frontend。
- 不从 quota `windows`、`blockReason` 或 route 文本反推出 authority truth。

## Evidence Gate

| 来源 | 当前事实位置 | 缺口 | 验收方式 |
| --- | --- | --- | --- |
| Doctor route evidence | `internal/gettokenshooks/doctor_diagnostics.go` | 顶层 typed route evidence 缺 `accountId` alias，nested `droppedReason` 没有 doctor-facing `accountKey/accountId/authId` 字段名闭环 | Go test 断言 JSON 同时包含 top-level 与 nested typed fields |
| Doctor quota evidence | `internal/gettokenshooks/doctor_diagnostics.go` | 输出层依赖 store 侧 normalization；直接携带 fact 的 state 仍需要防御性脱敏、refs 去重和深拷贝 | Go test 构造未经过 Upsert normalization 的 state，断言 secret 不泄漏、refs 不共享 |
| 缺 fact 场景 | `doctor_diagnostics_test.go` 既有测试 | 不能从 `windows` / `blockReason` 推导 quota authority | 继续断言无 explicit fact 时 `quota_facts` 保持 `not_ready` 且 evidence 为空 |
| 汇总计数 | `buildDoctorDiagnosticsSummary` | typed evidence 增强不能破坏 summary/evidence count | route evidence 测试断言 `summary.evidence=1`、route warning + quota not_ready |

## Implemented Chain

1. 新增 `DoctorDiagnosticEvidence.accountId`，与 `accountKey` 同步承载稳定账号 key，供 main side 直接消费。
2. 新增 doctor 专用 nested `DoctorDiagnosticDroppedReason`，输出 `accountKey/accountId/authId/source/scope/reason/model/expiresAt/updatedAt/routeBlocking`。
3. route evidence mapper 从 `ChannelRoutingDroppedReason` 构造顶层和 nested typed payload，不依赖 UI 文案。
4. quota evidence mapper 在 doctor 输出层再次执行 `sanitizeQuotaRuntimeFactExplanation()`，并通过 `uniqueQuotaRuntimeFactRefs()` 复制、修剪、去重 evidence refs。
5. 缺 explicit `QuotaRuntimeFact` 的状态仍不产生 evidence，`quota_facts` 保持 `not_ready`。

## Validation

已运行：

```bash
go test -count=1 $(rg --files internal/gettokenshooks -g '*.go' | rg -v '_test\.go$') internal/gettokenshooks/doctor_diagnostics_test.go -run 'TestDoctorDiagnostics' -timeout 120s
go test -count=1 ./internal/gettokenshooks -run 'TestDoctorDiagnostics' -timeout 120s
go test -count=1 ./internal/gettokenshooks -timeout 180s
```

结果：全部通过。

## Remaining Risks

- 本轮只改 CLIProxyAPI reference sidecar，不改 main app/frontend；main side 对 `accountId` / nested `droppedReason` 新字段的消费由主控聚合测试确认。
- `ChannelRoutingDroppedReason` 共享类型未改，避免影响 channel routing / route resilience 既有端点；doctor endpoint 使用专用 nested DTO 输出更稳定的 doctor-facing 字段名。
- 未启动 dev App；本轮属于 sidecar Go DTO / mapper 变更，用 focused Go tests 覆盖。

## Controller Aggregation Suggestions

1. 在主仓聚合阶段重跑 round18 的 chain tests：
   - `go test ./internal/cliproxyapi -run 'TestDoctorDiagnosticsClient'`
   - `go test ./internal/wailsapp -run 'TestDoctor'`
   - `go test . -run 'TestMapDoctorSnapshot|TestGetDoctorSnapshot'`
2. 若主控会重建 sidecar，确认新 `doctor-diagnostics` JSON 中 top-level `accountId` 与 nested `droppedReason.accountId/authId` 未被 client DTO 丢弃。
3. 前端 Doctor Workbench 仍应只读消费 typed payload；缺 typed fact 时显示 not-ready/fallback，不把文本解析结果升级为 route/quota truth。
