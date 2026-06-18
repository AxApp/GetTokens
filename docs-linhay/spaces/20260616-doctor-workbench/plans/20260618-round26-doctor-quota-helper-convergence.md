# Round26 Doctor quota helper convergence

## 范围

- Doctor Workbench quota evidence 消费从主模型中抽出到共享 adapter。
- 不改 sidecar、Wails/root binding、Doctor snapshot DTO 或 UI 组件。
- 保持只读语义：Doctor 只能展示 sidecar/Wails 已提供的 typed evidence，不从文案或 quota-like 字段补造 authority。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round25 quota static gate 为 Doctor Workbench 留了整个 feature 目录 known exception。 |
| 代码事实 | `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts` 的 `deriveQuotaFactFromDoctorEvidence()` 直接访问 `evidence.quotaFact`。 |
| 当前风险 | Doctor 主模型和未来新增 Doctor 文件可绕过 quota shared helper / adapter 约束，扩大直接 quotaFact 消费面。 |
| 红灯方式 | 新增 gate integration fixture，证明 `doctor-workbench/model/directQuotaFactConsumer.ts` 不能直接访问 `payload.quotaFact`；目录级 exception 下会先失败。 |
| 验收方式 | 只有 `quotaEvidenceAdapter.ts` 能作为 typed quotaFact adapter；Doctor model tests 证明无 typed fact 时不从 `summary/windows/blockReason/usageTotals` 推导 authority。 |

## 实现结果

- 新增 `model/quotaEvidenceAdapter.ts`，封装 Doctor typed explicit `quotaFact` 到 `QuotaFactDisplay` 的适配逻辑。
- `doctorWorkbench.ts` 只调用 `deriveQuotaFactFromDoctorEvidence()`，主模型不再直接读 `quotaFact`。
- `doctorWorkbench.test.mjs` 增加非 fact 字段反回归：带 `blockReason`、`windows`、`usageTotals` 但无 typed `quotaFact` 时，只展示原始 summary/source label。
- `check-quota-no-direct-fact-parser.mjs` 只允许 adapter 单文件作为 Doctor known exception。

## 验收记录

- `node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs`
- `node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`
- `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- `npm --prefix frontend run typecheck`

## 边界

- 本轮不启动 dev App；改动不涉及 native/Wails 绑定可见性。
- 本轮不新增 repair/mutation handler，Doctor Workbench 仍是只读诊断消费面。
