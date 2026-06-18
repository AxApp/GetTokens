# Round 23 Preview Gate Typed Route Check

## Scope

本轮只更新 Doctor Workbench preview gate 脚本，让 archived/headless gate 同时检查 browser-preview fixture 中的 nested `droppedReason` typed route payload，而不是只检查渲染后的 structured route DOM marker。

写入边界：
- `docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- `docs-linhay/spaces/20260616-doctor-workbench/README.md`
- 本计划

不做：
- 不启动 dev App。
- 不新增 Doctor repair mutation。
- 不修改 quota、extension、protocol 或 sidecar 热路径。
- 不把 `label`、`summary`、`refID`、`source` 或顶层 fields 升级为 route authority。

## Evidence Gate

| 来源 | 当前事实位置 | 风险 | 验收方式 |
| --- | --- | --- | --- |
| Twenty-Third Dispatch | `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260616-subagent-supervision-dispatch-v01.md` | Round22 已证明 fixture path，但 preview script 仍只检查 DOM 渲染结果 | `check-doctor-workbench-preview.mjs` 读取 fixture 源文件并检查 nested `droppedReason` |
| Browser preview fixture | `frontend/src/features/doctor-workbench/model/previewData.ts` | archived/headless fallback 若只看 DOM，可能漏掉 fixture 重新退回 legacy `routeEvidence` 或文本 authority | 脚本检查 `droppedReason.accountKey/authId/model/source/scope/reason/routeBlocking` |
| Conflict text guard | `frontend/src/features/doctor-workbench/model/previewData.ts` | preview fixture 若移除冲突文本，不能证明 typed payload 赢过文本字段 | 脚本检查冲突 `label/summary/source` 仍存在，且该 fixture 块没有 legacy `routeEvidence` |

## BDD Scenarios

1. Given Doctor preview gate falls back to archived DOM snapshot
   When Chrome cannot dump live DOM
   Then the script still reads `previewData.ts` and fails if nested `droppedReason` is missing.

2. Given the preview fixture carries conflicting text fields
   When gate checks the fixture source
   Then it requires nested typed `accountKey/authId/model/source/scope/reason/routeBlocking` and the conflict text.

3. Given Doctor Workbench remains read-only
   When preview gate runs
   Then it continues to reject repair/mutation bindings and does not require dev App startup.

## Implemented Gate

- `check-doctor-workbench-preview.mjs` now reads `frontend/src/features/doctor-workbench/model/previewData.ts` alongside README and DOM snapshot.
- The script asserts the preview fixture contains nested `droppedReason` typed route authority fields.
- The script asserts the fixture keeps conflicting top-level text fields and does not put legacy `routeEvidence` on the nested fixture entry.
- Existing DOM/read-only/no-repair checks remain unchanged.

## Validation

Focused validation executed for this round:

```bash
node docs-linhay/scripts/check-doctor-workbench-preview.mjs
cd frontend && npm run test:doctor-workbench
docs-linhay/scripts/check-docs.sh
git diff --check -- docs-linhay/scripts/check-doctor-workbench-preview.mjs docs-linhay/spaces/20260616-doctor-workbench/README.md docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round23-preview-gate-typed-route-check.md
```

Results:
- `check-doctor-workbench-preview.mjs` passed via archived DOM/screenshot fallback and all new fixture checks were true.
- `npm run test:doctor-workbench` passed 21 tests.
- `check-docs.sh` passed.
- scoped `git diff --check` passed.

## Remaining Risks

- 本轮 gate 覆盖 browser-preview / archived DOM / fixture source path，不替代真实 Wails runtime 或 dev App 桌面验收。
- 本轮未改 DTO、binding、consumer 或 sidecar 输出；若后续生成物移除 `droppedReason`，仍依赖 Round21 binding tests 和主控聚合测试兜底。
