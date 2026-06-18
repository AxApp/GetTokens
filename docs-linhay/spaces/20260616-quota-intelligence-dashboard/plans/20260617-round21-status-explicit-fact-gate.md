# Round 21 / Status explicit fact gate

日期：2026-06-17

## 本轮目标

1. 强化 Status / Usage Desk 的 explicit-fact-only 反回归门禁。
2. 证明缺少 `quotaFact`、`quota_fact`、legacy `fact` 时，状态模型和 UI 只呈现 missing / non-authoritative，不从 `windows`、`blockReason` 或 usage totals 推导 quota truth。
3. 保留显式 fact 正常展示：camelCase、snake_case 和 legacy fact 继续进入 authority fact 展示链。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Status evidence helper | `resolveQuotaStatusEvidenceFromPayload()` 只信显式 fact；无 fact 返回 `undefined` | 增加更强 payload 组合测试，覆盖 `windows`、`blockReason`、`usageTotals`、`totalTokens` 与伪 authority 字段 | `quotaStatusEvidence.test.mjs` |
| Status section notice | `buildStatusQuotaEvidenceSectionState()` 对无 fact payload 输出 `NON-AUTHORITATIVE` notice | 锁定 mixed payload 下无 fact 账号和 unscoped payload 只进入 missing notice，不生成 fact card | `quotaStatusEvidence.test.mjs` |
| Usage Desk status evidence | Usage Desk 复用 shared helper；缺 fact 时过去只是不显示 authority | 增加 Usage Desk missing/non-authoritative 状态模型和 UI 分支，明确缺 fact 不是 quota truth | `usageDesk.test.mjs` |
| 显式 fact 兼容 | camelCase `quotaFact`、snake_case `quota_fact`、legacy `fact` 均可被识别 | 保持原有 fact 展示路径不变 | focused frontend tests |

## 明确不做

1. 不改 sidecar quota truth。
2. 不改 Doctor workbench 文件，避免与 Doctor agent 抢写。
3. 不从前端 `windows`、`blockReason`、`degradedReason`、usage totals 生成 `available/no-quota/stale/denied` authority。
4. 不运行真实 Wails/dev App 手点验收；本轮风险集中在前端纯模型与展示门禁。

## 预期验收

- 无 explicit fact 的 Status payload：只有 missing/non-authoritative notice，`items` 为空。
- 无 explicit fact 的 Usage Desk payload：返回 `missing-quota-fact` 状态并渲染 non-authoritative UI，不显示 quota fact chips。
- 有 explicit fact 的 Status / Usage payload：继续展示 `Quota runtime authority`、state/freshness/confidence/risk/evidence refs。

## 实现记录

- `resolveUsageDeskStatusEvidence()` 先复用 `resolveQuotaStatusEvidenceFromPayload()`，只有 explicit fact 能生成 authority evidence。
- 当 Usage Desk payload 没有 valid explicit fact、但带 `windows/blockReason/usageTotals/totalTokens/requestCount/items` 等 usage/quota telemetry 时，返回 `kind: missing-quota-fact`，摘要固定为 `Missing explicit quotaFact / Non-authoritative`。
- `UsageDeskEvidenceStatus` 增加 missing 分支，渲染 `data-usage-desk-evidence-status="missing-quota-fact"` 和 `NON-AUTHORITATIVE`，不读取 `evidence.view`，因此不会显示 state/freshness/confidence/risk 这类 authority fact chips。
- Status tests 增加 quota-shaped authority bait：`windows.authority`、`usageTotals.state/risk`、`factLike` 均不能升级为 fact card；只有 `quota_fact` 进入 authoritative item。

## 验证命令

- 已确认红灯：`node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`，新增 Usage Desk missing 模型和 UI 分支测试失败。
- 已通过：`node --test frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- 已通过：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- 已通过：`npm -C frontend run typecheck`

## 剩余风险

1. 本轮未跑全量 `npm -C frontend run test:unit`，主控会在全部 subagents 返回后统一聚合。
2. Usage Desk 现在会在有 usage/quota telemetry 但缺 explicit fact 时显示 missing/non-authoritative 状态；这是本轮目标行为，但可能让旧 payload 的状态区域更显眼。
3. Doctor workbench 未修改，仍由并行 Doctor agent 负责 typed evidence / binding regression gate。
