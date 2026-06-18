# Round 20 / Explicit fact anti-regression

日期：2026-06-17

## 本轮目标

1. 强化 Status / Usage Desk / Account quota consumer 的 explicit-fact-only 门禁。
2. 证明缺少 `quotaFact`、`quota_fact`、legacy `fact` 时，不从 `windows`、`blockReason`、`degradedReason` 或 usage totals 推导 quota authority。
3. 保留显式 fact 兼容：camelCase `quotaFact`、snake_case `quota_fact`、legacy `fact` 都继续被识别为 sidecar explicit fact。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Status/Usage Desk | 共享 `resolveQuotaStatusEvidenceFromPayload()` 已只信显式 fact | 继续锁定 camel/snake/legacy fact；无 fact 的 windows/blockReason/usage totals 返回 non-authoritative | `quotaStatusEvidence.test.mjs`、`usageDesk.test.mjs` |
| Account quota fact | `resolveQuotaFact()` 曾从 windows/status/degradedReason/blockReason 推导 `no-quota/stale/denied/available` | 收窄为：有显式 fact 才返回 authority；无显式 fact 一律 `unknown` + `confidence=none` | `accountQuotaFact.test.mjs` |
| Account quota display | quota bars 仍需要展示 runtime windows/blockReason，但这些字段不能升级为 fact authority | `buildQuotaDisplay()` 保留 windows/block 状态展示，同时 `display.fact` 在无显式 fact 时保持 non-authoritative | `accountQuotaRuntime.test.mjs` |
| Doctor consumer | Doctor workbench/UI 由并行 Doctor agent 负责，本轮不抢写 UI 文件 | 只记录夹具边界：doctor/status fixtures 必须携带 explicit `quotaFact` 才能展示 authority；raw no-fact payload 只能作为 non-authoritative 示例 | 本 plan + 后续 Doctor agent 测试 |

## 明确不做

1. 不改 `frontend/src/features/doctor-workbench/**`。
2. 不改 Doctor UI 或 diagnostics 组件。
3. 不改 CLIProxyAPI reference、Extension、Protocol、Route action。
4. 不把前端窗口、block reason、usage totals 伪造成 sidecar fact。

## 实现记录

- `resolveQuotaFact()` 删除无显式 fact 的本地推导分支；保留 unsupported / missing runtime 的既有 unknown 语义。
- `readExplicitQuotaFact()` 增加 outer `quota_fact` 兼容，保持 `quotaFact` / `quota_fact` / `fact` 都进入同一个 `coerceQuotaFactDisplay()`。
- `accountQuotaFact.test.mjs` 将旧的 inferred authority 用例改为 anti-regression：exhausted windows、stale cache、provider denied reason、usage totals 都不能产生 authority fact。
- `accountQuotaRuntime.test.mjs` 锁定 quota bars 仍显示 windows/block 状态，但 `display.fact` 不再从这些局部字段推导。

## 验证命令

- 已通过：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
- 已通过：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs`
- 已通过：`rg -n "classifies fresh exhausted|classifies cached|classifies provider denied|quotaFactLooksDenied|readQuotaRuntimeSources" frontend/src/features/accounts frontend/src/features/status` 无匹配

## 剩余风险

1. 本轮未运行全量前端单测或 typecheck，主控会在全部 subagents 返回后统一聚合测试。
2. Account quota bars 仍会显示 sidecar runtime windows 和 block reason；这些是 UI 展示数据，不再影响 `fact` authority。
3. Doctor workbench 夹具/组件未在本轮修改，后续 Doctor agent 需要沿用 explicit-fact-only 边界。
