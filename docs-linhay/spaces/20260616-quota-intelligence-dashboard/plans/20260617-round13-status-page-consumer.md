# Round 13 / Status page quota evidence consumer

日期：2026-06-17

## 本轮目标

1. 让 Status 页消费显式 `quotaFact/quota_fact/fact` authority，并以只读 section 展示 quota fact evidence。
2. 证明 Status 页不会从 `windows`、`blockReason`、usage totals 或 sidecar runtime 其他局部字段反推 quota authority。
3. 保持边界在前端消费层，不新增 Go / Wails API。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Status 页 authority 缺口 | `frontend/src/features/status/StatusFeature.tsx` 当前没有 quota fact evidence 面板 | 最小接入 `GetAllQuotaStatuses()`，只消费显式 fact 并渲染只读 panel | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| authority 越权风险 | `CodexQuotaResponse` 同时带 `windows`、`blockReason`、`blocked` 等局部字段 | Status 页只把整个 payload 交给 `resolveQuotaStatusEvidenceFromPayload()`，不从局部字段推导 authority | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` + source assertions |
| snake/camel fact 兼容 | Wails 绑定当前暴露 `quotaFact`，helper 也兼容 `quota_fact` / `fact` | Status 页复用现有 helper，不重复写字段兼容逻辑 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| UI 展示范围 | 需求要求展示 `state/source/freshness/confidence/risk/summary/explanation/evidenceRefs` | 增加只读 section，仅在 helper 返回 evidence 时渲染 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` source assertions |

## 明确不做

1. 不改 Go / Wails / root binding，不新增任何 API。
2. 不改 Doctor / Route / Extension / Protocol。
3. 不从 `windows`、`blockReason`、usage totals、`sidecarStatus` 推导 quota authority。
4. 不回退现有 dirty changes。

## 验收命令

1. `node --test frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`
