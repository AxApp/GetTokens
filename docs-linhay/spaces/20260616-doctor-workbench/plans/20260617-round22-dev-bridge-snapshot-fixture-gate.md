# Round 22 Dev Bridge Snapshot Fixture Gate

## Scope

本轮只为 Doctor typed evidence 增加 browser-preview / dev-bridge 类 snapshot fixture 防回归门禁，证明真实 Wails binding 之外的预览路径也不会丢 nested `droppedReason`。

写入边界：
- `frontend/src/features/doctor-workbench/model/previewData.ts`
- `frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- Doctor Workbench space README 与本计划

不做：
- 不新增 Doctor repair mutation。
- 不启动 dev App。
- 不修改 quota、status、extension 或 sidecar 热路径。
- 不把 `label`、`summary`、`refID`、`source` 或顶层 evidence fields 升级为 route authority。

## Evidence Gate

| 来源 | 当前事实位置 | 风险 | 验收方式 |
| --- | --- | --- | --- |
| Twenty-Second Dispatch | `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260616-subagent-supervision-dispatch-v01.md` | Round21 只证明 Wails/root/generated binding，未覆盖浏览器 preview fixture | Round22 focused frontend test 直接读取 `getDoctorWorkbenchPreviewSnapshot()` |
| Browser preview fixture | `frontend/src/features/doctor-workbench/model/previewData.ts` | preview / bridge fallback 若仍用 legacy `routeEvidence` 或文本字段，后续会绕过 nested `droppedReason` gate | fixture 中 structured route evidence 只放 nested `droppedReason`，并保留冲突 label/summary/refID/source |
| Frontend typed consumer | `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts` | 派生 view 可能从冲突文本或顶层字段生成 target | `doctorWorkbench.test.mjs` 断言派生 target/reason/blocking 均来自 nested `droppedReason` |

## BDD Scenarios

1. Given browser preview loads Doctor snapshot without Wails runtime
   When the snapshot contains route evidence with conflicting label/summary/refID/source and nested `droppedReason`
   Then the fixture keeps `droppedReason.accountKey/authId/model/source/scope/reason/routeBlocking`.

2. Given Doctor view derives structured route evidence from that preview snapshot
   When the top-level text conflicts with nested payload
   Then the structured target, reason summary and blocking label come from nested `droppedReason`.

3. Given Doctor preview has no Wails runtime
   When Round22 fixture gate runs
   Then it does not require dev App startup and does not introduce any mutation binding.

## Implemented Gate

- Preview structured route fixture now uses `droppedReason` instead of legacy `routeEvidence`.
- The same fixture deliberately keeps conflicting `label` / `summary` / `refID` / `source` text so the test proves nested typed payload wins.
- Focused model test adds `doctor browser preview snapshot fixture keeps nested droppedReason as route authority`.

## Validation

Red/green executed:

```bash
node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs
```

Red result before fixture update: failed with `missing preview droppedReason fixture`.

Green result after fixture update: 17 tests passed.

Focused closure executed:

```bash
cd frontend && npm run test:doctor-workbench
cd frontend && node --test wailsjs/doctorTypedEvidenceBinding.test.mjs
docs-linhay/scripts/check-docs.sh
git diff --check -- frontend/src/features/doctor-workbench/model/previewData.ts frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs docs-linhay/spaces/20260616-doctor-workbench/README.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round22-dev-bridge-snapshot-fixture-gate.md
```

## Remaining Risks

- 本轮没有启动 dev App，符合 dispatch；覆盖的是 browser-preview / dev-bridge fixture path，不替代真实 Wails binding 验收。
- 本轮没有改 `docs-linhay/scripts/check-doctor-workbench-preview.mjs`，因为 dispatch 写入面限定不包含 docs script；现有 DOM gate 仍能检查同一个 stable route target marker。
