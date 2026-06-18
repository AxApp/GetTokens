# Round 12 Route Evidence Normalization

## 背景

- 问题来源：OmniRoute 第十二轮 subagent 任务，要求把 Doctor Workbench 的 `route_guard_dropped_reasons` / route 类 evidence 从普通 summary/source label 收敛为结构化只读视图。
- 关联 space：
  - `docs-linhay/spaces/20260616-doctor-workbench/README.md`
  - `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 当前事实

- 当前代码位置：`frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`
- 当前现象：
  - quota evidence 已走共享 helper，能输出结构化 `sourceLabel` / `summaryLabel`
  - route evidence 仍直接回退到通用 `formatDoctorEvidenceSourceLabel + summary`
  - sidecar diagnostics 透传到 Doctor 前端后，route evidence 只保留 `kind/label/summary/refID/source`
- 风险边界：
  - 不能改 Go/Wails/sidecar，也不能新增 repair mutation
  - 不能凭猜测补 route truth；字段不足时必须保守 fallback

## 本轮目标

1. 给 Doctor route evidence 增加结构化 view：
   - 稳定 target key
   - `accountKey` / `authId` / `model` / `source` / `scope`
   - `reasonSummary`
   - `routeBlockingLabel`
   - `sourceLabel`
2. 同一 stable target 在 reason 文案变化时仍按同一 identity 聚合展示。
3. 字段不足时保留通用 fallback，不伪造 account/auth/model/scope/blocking truth。

## 实现边界

- 只修改：
  - `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`
  - `frontend/src/features/doctor-workbench/model/previewData.ts`（仅如 fixture 需要）
  - `frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
  - `docs-linhay/spaces/20260616-doctor-workbench/README.md`
- 可新增本计划文件

## 验收

1. `doctorWorkbench.test.mjs` 证明：
   - route evidence 缺结构字段时 fallback
   - route evidence 拥有 account/auth/model/source/scope/reason 时，stable identity 不受 reason 文案影响并聚合展示
2. 运行：
   - `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
   - 若涉及 TS 类型：`npm --prefix frontend run typecheck`
   - `docs-linhay/scripts/check-docs.sh`
   - `git diff --check`
