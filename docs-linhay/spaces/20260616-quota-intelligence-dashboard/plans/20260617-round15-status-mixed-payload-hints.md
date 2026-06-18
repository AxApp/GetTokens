# Round 15 / Status mixed-payload per-account non-authoritative hints

日期：2026-06-17

## 本轮目标

1. 修复 Status quota evidence section 在 mixed payload 下的可解释性缺口。
2. 当部分账号带显式 `quotaFact/quota_fact/fact`、部分账号没有显式 fact 时，仍标明缺失 fact 的账号摘要。
3. 保持 authority 边界不变：不得从 `windows`、`blockReason`、usage totals 或其他局部字段推导 quota authority。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| mixed payload 失声 | `buildStatusQuotaEvidenceSectionState()` 只要收集到任一 authority item 就直接返回 `{ items }`，导致同 payload 内其他无显式 fact 账号没有提示 | section state 新增 per-account missing-fact summary，在 mixed payload 下同时返回 authority items 和 non-authoritative notice | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| authority 越权风险 | Status payload 常同时带 `windows`、`blockReason`、usage totals，本地很容易误把这些字段当 quota authority | 缺失账号提示只基于“看到 payload 但没有显式 fact”这一事实，描述文案明确不从局部字段推导 authority | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` + source assertions |
| Status section 缺少账号级提示 | UI 现仅支持 section 级空态 notice，不能说明 mixed payload 中哪些账号无 fact | `StatusQuotaEvidenceSection` 渲染 missing count / account summary，保持只读 hints，不引入新的 authority 卡片 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| 只限本轮切片 | 用户要求只改 quota/status 面，不触碰 route/doctor/extension/protocol/dispatch/memory/AGENTS | 改动仅落在 `quotaEvidenceSection.ts`、`StatusPanels.tsx`、status tests、space README/plan | scoped diff |

## 明确不做

1. 不改 sidecar quota 真源和 management API。
2. 不从局部 payload 字段新增 quota 推断逻辑。
3. 不修改 route / doctor / extension / protocol / dispatch / memory / AGENTS。
4. 不清理或回退其他需求已产生的 worktree 脏改动。

## 验收命令

1. `node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`
