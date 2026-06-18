# Doctor / Quota usage-status evidence 切片 v10

日期：2026-06-17

## 本轮范围

1. 不改 sidecar / Wails / route / protocol。
2. 只在 `frontend/src/features/accounts/**` 的 usage/status/quota evidence 面接入共享 evidence view。
3. 最小 UI 切片选择 usage desk 现有 `UsageChartCard.status` 槽位，不做账号卡或页面布局大改。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Quota authority | `QuotaRuntimeState.fact` 已是 sidecar 权威事实 | 不再从 windows/blockReason 反推新的 authority；只把已有 fact 收敛为 `QuotaFactEvidenceView` | `accountQuotaFact.test.mjs` |
| Doctor diagnostics | doctor quota evidence 已带 `summary/source`，但 label 仍是页面内直出字符串 | 本轮不再扩大 doctor 改动范围，只记录其已共享同一 helper 边界 | 现有 doctor tests |
| Usage/status 当前切口 | usage desk chart 已预留 `status` header slot，但一直未消费 quota fact | 在 usage desk model 读取 payload `quotaFact/fact`，映射到 `QuotaFactEvidenceView` 并挂到 `UsageChartCard.status` | `usageDesk.test.mjs` + preview fixture |
| 反推 authority 风险 | usage payload 可能同时含 `windows/blockReason` 等局部字段，容易被前端错误重推 | `resolveUsageDeskStatusEvidence()` 只在显式 `quotaFact/fact` 存在时返回 evidence；缺失时不渲染 quota authority | `usageDesk.test.mjs` |

## 本轮实现

1. `resolveUsageDeskStatusEvidence()`：usage/status model 只从 payload `quotaFact/quota_fact/fact` 读取 authority fact，再交给 `coerceQuotaFactDisplay()` + `buildQuotaFactEvidenceView()`。
2. `UsageDeskEvidenceStatus`：在 usage desk chart header 里展示 `state/source/freshness/confidence/risk/summary/explanation/evidenceRefs` 的最小 evidence strip。
3. preview fixtures 给 observed/projected usage payload 都补了显式 quota fact，保证浏览器预览和 focused tests 能证明 usage/status 已实际消费该模型。

## 明确不做

1. 不把 account card 普通展示改成 quota diagnostics UI。
2. 不在 usage desk 里临时拼 quota authority。
3. 不新增 route / extension / protocol / Go sidecar 改动。
4. 不把 doctor workbench 本轮扩大成第二个消费面。

## 下一刀输入

1. 若 status 页面也要显示 quota/status evidence，继续复用 `resolveUsageDeskStatusEvidence()` 的读取边界或抽更通用 helper，但仍只信显式 `quotaFact/fact`。
2. 需要新字段时，应优先扩 `QuotaFactDisplay` / `QuotaFactEvidenceView`，不要在 Doctor/usage 内分别造结构。
