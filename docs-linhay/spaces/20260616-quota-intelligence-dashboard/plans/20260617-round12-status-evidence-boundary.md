# Round 12 / Status evidence authority boundary

日期：2026-06-17

## 本轮目标

1. 把 usage desk 当前“只信显式 quota fact”的规则抽成通用纯模型 helper。
2. 为后续 status page 复用预留稳定入口，避免再次从 `windows`、`blockReason` 或 usage totals 反推 quota authority。
3. 用 focused tests 锁死 authority 读取边界。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Usage desk authority 来源 | `resolveUsageDeskStatusEvidence()` 当前内联读取 `quotaFact/quota_fact/fact` | 抽到通用 helper，usage desk 改为只消费该 helper | `usageDesk.test.mjs` |
| Status page 复用风险 | status 面下一步若直接读取 payload，容易误把 `windows/blockReason` 当 authority | 新增纯模型 helper，只接受显式 fact record | `usageDesk.test.mjs` |
| Snake case 兼容 | sidecar/Wails 可能返回 `quota_fact`、`observed_at`、`evidence_refs` | helper 接受 `quotaFact` / `quota_fact` / `fact`，仍复用 `coerceQuotaFactDisplay()` | `usageDesk.test.mjs` + `accountQuotaFact.test.mjs` |
| Authority 越权推导 | payload 可能只有 `windows`、`blockReason`、usage totals | helper 明确返回 `undefined`，不生成 evidence | `usageDesk.test.mjs` |
| 不完整 fact | 某些 payload 可能有 fact 容器但缺 `state` | helper 视为无效，不渲染 authority evidence | `usageDesk.test.mjs` |

## 明确不做

1. 不改 sidecar / Wails / Doctor / Route / Go。
2. 不新增从 quota windows、block reason、usage totals 到 authority evidence 的任何推导。
3. 不改 usage/status 的大 UI 文件，除非 import 迁移必要。

## 验收命令

1. `node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
2. `npm --prefix frontend run typecheck`（若 helper 迁移触及 TS surface）
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`
