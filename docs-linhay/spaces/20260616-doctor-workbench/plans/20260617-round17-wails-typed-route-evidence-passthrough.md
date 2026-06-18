# Round 17 Wails Typed Route Evidence Passthrough

日期：2026-06-17

## 背景

- 问题来源：Round 17 Doctor Workbench bounded implementation，要求补齐 Wails/root typed route evidence passthrough。
- 前置事实：
  - Round 16 前端 `DoctorEvidenceRef` 已支持顶层 typed route fields 与 nested `routeEvidence`，并优先消费 typed adapter。
  - `internal/wailsapp/types.go` 与 root `app_types.go` 的 `DoctorEvidenceRef` 仍只导出 `kind/label/summary/refID/source`。
  - `internal/wailsapp/doctor.go` 的 aggregate fallback `doctorRouteDecisionCheck` 已读取 `DroppedReasons`，但只把 dropped reason 压成文本 summary。
- 当前缺口：
  - sidecar diagnostics 或 aggregate fallback 中的 route dropped reason typed fields 不能端到端到达 generated Wails binding。
  - root mapper 若只复制 core fields，会丢弃 Wails DTO 中新增的 typed route payload。

## BDD / 红灯场景

1. Given sidecar diagnostics unsupported and Wails aggregate reads `droppedReasons`
   When Doctor Workbench builds `route-guard-stale-block`
   Then evidence must include typed route fields or nested `routeEvidence`: account/auth/model/source/scope/reason/routeBlocking.

2. Given root `mapDoctorSnapshot` receives Wails evidence with typed route payload
   When root DTO is returned to Wails binding
   Then top-level fields and nested `routeEvidence` must be preserved.

3. Given generated frontend binding is the source consumed by Doctor Workbench
   When tests inspect `frontend/wailsjs/go/models.ts`
   Then typed route fields are present and no repair/mutation binding appears.

## 实现范围

- `internal/wailsapp/types.go`
- `internal/wailsapp/doctor.go`
- `internal/wailsapp/doctor_test.go`
- `app_types.go`
- `app_mappers.go`
- `app_test.go`
- `frontend/wailsjs/go/models.ts`
- `frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`

## 验收方式

- Go:
  - `go test -count=1 ./internal/wailsapp -run 'TestDoctorSnapshot' -timeout 120s`
  - `go test -count=1 . -run 'TestMapDoctorSnapshotPreservesCoreFields|TestGetDoctorSnapshotRootBindingReturnsNotReadySnapshot' -timeout 180s`
- Frontend:
  - `npm --prefix frontend run test:doctor-workbench`
  - `npm --prefix frontend run typecheck`
- Docs / diff:
  - `docs-linhay/scripts/check-docs.sh`
  - scoped `git diff --check -- <changed files>`

## 边界

- Doctor Workbench 继续只读消费 evidence。
- 不新增 repair action，不新增 mutation handler。
- typed payload 只来自 sidecar diagnostics 或 aggregate route dropped reasons，不把 Doctor 自身推断升级为 route/quota authority。
