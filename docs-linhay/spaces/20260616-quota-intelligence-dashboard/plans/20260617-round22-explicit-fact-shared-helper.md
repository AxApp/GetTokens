# Round 22 / Explicit fact shared helper consolidation

日期：2026-06-17

## 本轮目标

1. 将 Account / Status / Usage Desk 的 explicit-fact-only 判定收敛到一个共享 helper。
2. 用统一测试矩阵锁定 `quotaFact`、`quota_fact`、legacy `fact` 三种显式 fact 入口。
3. 继续证明缺少 explicit fact 时，不从 `windows`、`blockReason`、`usageTotals`、`totalTokens` 或伪 `factLike/authority` 字段推导 quota truth。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Account fact reader | `resolveQuotaFact()` 内部有私有 explicit fact 读取逻辑 | 上提为 `resolveExplicitQuotaFactDisplay(payload)`，Account 自身也复用该 helper | `accountQuotaFact.test.mjs` |
| Status / Usage reader | `resolveQuotaStatusEvidenceFromPayload()` 自己读取 `quotaFact/quota_fact/fact` 后再 coerce | 改为复用 `resolveExplicitQuotaFactDisplay(payload)`，Status 与 Usage Desk 通过同一个 Status evidence helper 进入 | `usageDesk.test.mjs`、`quotaStatusEvidence.test.mjs` |
| 统一兼容矩阵 | camelCase、snake_case、legacy fact 已分散覆盖 | 新增共享矩阵测试，同时断言 Account helper 与 Status evidence 输出同一 evidence ref | `accountQuotaFact.test.mjs` |
| 反推导门禁 | Round20/21 已证明缺 fact 不推导 | 共享矩阵继续包含 `windows.authority`、`usageTotals.state`、`factLike` bait，期望 helper 返回 `undefined` | `accountQuotaFact.test.mjs` |

## 明确不做

1. 不改 sidecar truth、Wails DTO 或 management API。
2. 不改 Doctor workbench，避免与并行 Doctor agent 抢文件。
3. 不做 UI 视觉大改；本轮只动 quota model/helper/tests 与 space 文档。
4. 不把 `windows`、`blockReason`、`degradedReason`、usage totals 升级为 authority fact。

## 红绿灯记录

- 红灯：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`，失败于 `accountQuota.ts` 尚未导出 `resolveExplicitQuotaFactDisplay`。
- 绿灯：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`。

## 实现记录

- `accountQuota.ts` 新增并导出 `resolveExplicitQuotaFactDisplay(payload)`。
- `resolveQuotaFact()` 改为调用共享 helper，不再保留 Account 私有 explicit fact reader。
- `quotaStatusEvidence.ts` 改为调用同一个共享 helper；Status 与 Usage Desk 继续通过 `resolveQuotaStatusEvidenceFromPayload()` 消费。
- `accountQuotaFact.test.mjs` 新增统一矩阵，覆盖 Account / Status / Usage 共享 helper 的 explicit fact 入口与 bait payload。

## 剩余风险

1. 本轮只运行 focused frontend tests，未跑全量 `npm -C frontend run test:unit`；主控可在全部 subagents 返回后统一聚合。
2. Doctor workbench explicit fact 预览/桥接路径仍由并行 Doctor agent 负责，本轮未触碰。
3. 未来新增 quota 消费面仍需主动复用 `resolveExplicitQuotaFactDisplay()` 或 `resolveQuotaStatusEvidenceFromPayload()`；本轮已降低绕过风险，但不能阻止全新文件手写另一套解析。
