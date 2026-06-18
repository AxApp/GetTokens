# Round 14 / Status quota evidence preview hardening

日期：2026-06-17

## 本轮目标

1. 给 Status 页 quota evidence 增加可验证的 preview / doctored payload hardening，不依赖 sidecar 真数据才能证明分支行为。
2. 证明 Status 页只有在显式 `quotaFact/quota_fact/fact` 存在时才展示 authority evidence。
3. 证明 payload 只有 `windows`、`blockReason`、usage totals 等局部字段时，只保留空态 / non-authoritative 提示，不回退本地推断。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| 显式 fact 展示 | `resolveQuotaStatusEvidenceFromPayload()` 已只信显式 fact，但 Status 页缺少“预览可验证”的 section state 层 | 新增 `buildStatusQuotaEvidenceSectionState()`，统一把 payload 映射为 evidence items 或 non-authoritative notice | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| doctored payload 越权风险 | payload 可能只带 `windows`、`blockReason`、`totalTokens` 等局部字段，容易被误当 authority | 用 doctored fixture-like payload 测试锁死：无显式 fact 时 `items=[]`，仅返回 non-authoritative notice | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| Status 页组件空态 | 现有 `StatusQuotaEvidenceSection` 无条目时直接不渲染，难以解释“为什么没 authority” | 允许 section 在无 authority 但有 payload 时展示只读提示，明确不从局部字段推导 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` + source assertions |
| 边界不下沉到 sidecar | 本轮只做前端消费 hardening，不改 quota 真源 | 保持 `quotaStatusEvidence.ts` 只解析显式 fact，不新增本地 quota 推断逻辑 | focused node tests + scoped diff |

## 明确不做

1. 不改 sidecar quota truth。
2. 不新增 quota 推断逻辑。
3. 不改 route / doctor / extension / protocol / dispatch / memory / AGENTS。
4. 不清理或回退其他 worktree 中已有脏改动。

## 验收命令

1. `node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`
