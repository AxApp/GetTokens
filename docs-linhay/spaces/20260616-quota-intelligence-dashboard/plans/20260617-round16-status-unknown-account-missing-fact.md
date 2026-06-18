# Round 16 / Status unknown-account missing fact count

日期：2026-06-17

## 本轮目标

1. 修复 Status quota evidence section 对无 `accountKey` payload 的可见性缺口。
2. 当 payload 没有显式 `quotaFact/quota_fact/fact` 且缺少 `accountKey` 时，section state 和 UI 都要暴露 unscoped missing fact count。
3. 继续保持 authority 边界：不得从 `windows`、`blockReason`、usage totals 或其他局部字段推导 quota authority。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| unknown-account 缺口 | `buildStatusQuotaEvidenceSectionState()` 仅累计 `accountKey` 非空的 missing fact，导致无 `accountKey` payload 只能被 `sawPayload` 吞掉，没有任何数量事实 | section state 新增 unscoped missing fact count，并在 mixed/empty notice 中暴露对应文案 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| UI 不显示 unscoped 数量 | `StatusQuotaEvidenceSection` 只渲染 `accountKeys` 列表，没有独立 unscoped count copy | notice 卡片新增 unscoped count 行，例如 `2 UNSCOPED PAYLOADS MISSING EXPLICIT FACT` | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| authority 越权风险 | unknown payload 往往同时带 `windows`、`blockReason`、usage totals，本地很容易错把这些字段当 quota authority | unscoped count 只表达“看到 payload 但缺显式 fact”，不新增 state/source/risk 推断 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` + source assertions |
| 只限本轮切片 | 用户限定只改 quota/status 允许面，不碰 route/doctor/extension/protocol/dispatch/memory/AGENTS | 改动仅落在 `quotaEvidenceSection.ts`、`StatusPanels.tsx`、status tests、space README/plan | scoped diff |

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
