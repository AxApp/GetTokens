# Round 13 Structured Route Evidence UI

## 背景

- 问题来源：OmniRoute 第十三轮 subagent 任务，要求把第十二轮已归一化的 route evidence 结构化字段真正呈现在 Doctor Workbench evidence card 中。
- 关联 space：
  - `docs-linhay/spaces/20260616-doctor-workbench/README.md`
  - `docs-linhay/spaces/20260616-doctor-workbench/plans/20260617-round12-route-evidence-normalization.md`

## 当前事实

- 当前代码位置：`frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`
- 当前现象：
  - `doctorWorkbench.ts` 已输出 `targetKey/accountKey/authId/model/scope/reasonSummary/routeBlockingLabel`
  - evidence card 仍只展示 `label`、`kind/sourceLabel`、`summaryLabel`
  - 结构化 route identity 对用户不可见，Doctor UI 无法直接显示 target/account/auth/model/scope/blocking markers
- 风险边界：
  - 不改 Doctor model、accounts、channel-routing、Go/Wails
  - 不新增 repair mutation，不触发 action
  - 结构化 block 只是只读 UI，不代表 sidecar route truth 以外的新 authority

## 本轮目标

1. 当 evidence 带 `targetKey` 时，在 Doctor evidence card 渲染只读结构化 route evidence block。
2. 结构化 block 至少展示：
   - `targetKey`
   - `accountKey` / `authId`
   - `model` / `scope`
   - `routeBlockingLabel`
3. 缺结构字段时保留原有 label/source/summary UI，不伪造缺失字段。

## 实现边界

- 只修改：
  - `frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`
  - `frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`
  - `docs-linhay/spaces/20260616-doctor-workbench/README.md`
- 可新增本计划文件

## 验收

1. `doctorWorkbenchEntry.test.mjs` source gate 覆盖：
   - `data-doctor-route-evidence-target`
   - `data-doctor-route-evidence-account`
   - `data-doctor-route-evidence-auth`
   - `data-doctor-route-evidence-model`
   - `data-doctor-route-evidence-scope`
   - `data-doctor-route-evidence-blocking`
2. 运行：
   - `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
   - 如涉及 TS 类型：`npm --prefix frontend run typecheck`
   - `docs-linhay/scripts/check-docs.sh`
   - `git diff --check`
