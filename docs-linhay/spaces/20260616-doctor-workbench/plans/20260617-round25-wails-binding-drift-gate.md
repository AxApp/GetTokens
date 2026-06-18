# Round 25 Wails Binding Drift Gate

日期：2026-06-17

## 目标

补一个不依赖真实 Wails generator / dev App 的 generated binding surface drift 门禁，把 Doctor typed evidence 的 `droppedReason` 从 internal Wails、root `main.App` DTO / mapper、generated `frontend/wailsjs` 到 frontend model 的关键链路集中断言，降低 Round20-24 手动同步 generated binding 后再次漂移的风险。

## 证据矩阵

| 项 | 证据 |
|---|---|
| 问题来源 | Round25 retry 指定上一批 agent 因上游 stream disconnected 中断，需要继续补 generated binding surface drift gate。 |
| 代码事实位置 | `internal/wailsapp/types.go`、`internal/wailsapp/doctor.go`、`app_types.go`、`app_mappers.go`、`frontend/wailsjs/go/main/App.js`、`frontend/wailsjs/go/main/App.d.ts`、`frontend/wailsjs/go/models.ts`、`frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`。 |
| 当前现象 | Round24 已有分散 `frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs`，但缺少可被 docs/scripts 与 Node test 共同调用的集中 generated surface drift gate。 |
| 预期验收 | `docs-linhay/scripts/check-wails-binding-surface.mjs` 与 `frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs` 能证明 `droppedReason` typed payload 在 root/Wails/frontend generated surface 中一致。 |

## BDD Scenarios

1. Given Doctor snapshot evidence includes typed `droppedReason`
   When the drift gate checks internal DTO, root DTO, root mapper, generated models and frontend consumer
   Then `droppedReason` remains `DoctorRouteEvidencePayload` and uses generated typed conversion.

2. Given the Wails generated method surface is checked without generator
   When `GetDoctorSnapshot` is inspected
   Then `App.js` and `App.d.ts` still expose `DoctorSnapshotInput -> DoctorSnapshot`.

## TDD 记录

- 红灯：`node docs-linhay/scripts/check-wails-binding-surface.mjs` 失败，原因是脚本不存在，当前没有集中 drift gate 入口。
- 绿灯计划：新增集中脚本，并通过 `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs` 纳入 Node test 层。

## 实现边界

- 不启动 dev App。
- 不运行 Wails generator。
- 不修改 Doctor 业务实现或 sidecar diagnostics 语义。
- 只新增静态 drift gate 与本轮计划文档。

## 验收命令

```bash
node docs-linhay/scripts/check-wails-binding-surface.mjs
node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-wails-binding-surface.mjs frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round25-wails-binding-drift-gate.md
```

## 验收结果

- `node docs-linhay/scripts/check-wails-binding-surface.mjs`：通过。
- `node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`：通过，5 个 binding tests 全绿。
- `npm --prefix frontend run typecheck`：通过。
- `git diff --check -- ...round25 files...`：通过。
- `docs-linhay/scripts/check-docs.sh`：未通过；当前工作区既有 `check-docs.sh` 会调用缺失的 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`，该文件不属于本轮 Round25 binding gate 改动。

## 剩余风险

- 本门禁不替代真实 Wails generator；它验证当前手动同步后的 generated surface 是否保留关键字段。
- 本轮按要求不做 dev App 验收。
