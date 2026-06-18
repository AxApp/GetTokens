# Round 18 Sidecar Diagnostics Chain v01

## Scope

本轮把真实 sidecar `GET /v0/management/gettokens/doctor-diagnostics` typed payload 接进 GetTokens main side 的 client / Wails / root doctor chain。

写入边界：
- `internal/cliproxyapi/**`
- `internal/wailsapp/doctor*`
- `internal/wailsapp/types.go`
- root `app*.go` doctor DTO / mapper / tests
- `frontend/wailsjs/go/models.ts` 类型同步

不做：
- 不新增 Doctor repair mutation。
- 不触碰正式版 GetTokens App。
- 不改 Protocol / Extension / Route action / Quota runtime。
- 不从自由文本推导 route / quota truth 覆盖 typed payload。

## Evidence Gate

| 来源 | 当前事实位置 | 现象 / 缺口 | 验收方式 |
| --- | --- | --- | --- |
| CLIProxyAPI reference sidecar 已有只读 diagnostics endpoint | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/doctor_diagnostics.go` | payload 包含 `route_guard_dropped_reasons` / `quota_facts`，route evidence 有 `droppedReason`，quota evidence 有 `quotaFact` | client test 使用真实 endpoint path 和 sidecar snake_case nested quota fields decode |
| main side cliproxyapi client | `internal/cliproxyapi/client.go` / `types.go` | 需要请求 `/v0/management/gettokens/doctor-diagnostics`，并把 404 / 501 视作 unsupported 以保留 fallback | `go test ./internal/cliproxyapi -run 'TestDoctorDiagnosticsClient'` |
| Wails doctor aggregate | `internal/wailsapp/doctor.go` | sidecar diagnostics 可用时优先消费 typed payload；sidecar 不支持或不可用时保留既有 `wails-aggregate` route/quota fallback | `go test ./internal/wailsapp -run 'TestDoctor'` |
| root App binding chain | `app_types.go` / `app_mappers.go` / `app_test.go` | root mapper 需要保留 typed route evidence 与 typed quota fact evidence | `go test . -run 'TestMapDoctorSnapshot|TestGetDoctorSnapshot'` |

## Implemented Chain

1. `internal/cliproxyapi.Client.GetDoctorDiagnostics()` 请求真实 sidecar path。
2. `404` / `501` 返回 `supported=false`，让 `internal/wailsapp.GetDoctorSnapshot` 降级到既有 aggregate。
3. `internal/wailsapp.mapDoctorDiagnosticsSnapshot` 把 sidecar checks 映射成 Doctor snapshot。
4. route evidence 只消费 sidecar typed route fields / `droppedReason`，继续输出 `routeEvidence`。
5. quota evidence 只消费 sidecar typed `quotaFact` 或同一 evidence 的 typed quota fields，输出 `quotaFact`，不从文本反推 authority。
6. root `mapDoctorSnapshot` 继续 clone `quotaFact` 到 Wails-facing root DTO。
7. `frontend/wailsjs/go/models.ts` 同步新增 `DoctorEvidenceRef.quotaFact` 类型字段，不改 Doctor 前端 UI。

## Validation

已运行：

```bash
go test ./internal/cliproxyapi -run 'TestDoctorDiagnosticsClient'
go test ./internal/wailsapp -run 'TestDoctor'
go test . -run 'TestMapDoctorSnapshot|TestGetDoctorSnapshot'
```

结果：
- `internal/cliproxyapi` 通过。
- `internal/wailsapp` 通过；本机链接阶段有既有 `ld: warning: ignoring duplicate libraries: '-lobjc'` 警告。
- root package 通过；同样出现既有 `-lobjc` 重复库警告。

## Remaining Risks

- 本轮没有启动 dev App，也没有触碰正式版 App；普通 sidecar/Wails DTO 链路用 focused Go tests 覆盖。
- `frontend/wailsjs/go/models.ts` 是手工最小同步，未运行 Wails binding 生成器；后续若统一生成绑定，需要确认 `quotaFact` 保持存在。
- Doctor UI 目前仍可继续用现有 quota fact display 派生逻辑；本轮只把 typed payload 接到模型链路，不改 UI 展示密度。
