# Round26 Doctor quota shared-helper convergence

## 范围

- 收敛 Round25 `check-quota-no-direct-fact-parser.mjs` 对 `frontend/src/features/doctor-workbench/` 的目录级 known exception。
- 允许 Doctor Workbench 只通过明确 adapter 消费 typed explicit `quotaFact`。
- 保持 quota authority 语义：没有 `quotaFact` / `quota_fact` / legacy `fact` 这类显式 fact 时，不从 `summary`、`windows`、`blockReason`、`usageTotals` 或 raw payload 推导结论。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round25 static gate 为避免改动 Doctor Workbench，临时放行整个 `frontend/src/features/doctor-workbench/`。 |
| 代码事实 | `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` 的 `knownTypedConsumerExceptions` 使用 `^frontend/src/features/doctor-workbench/`；`doctorWorkbench.ts` 内部直接读取 `evidence.quotaFact`。 |
| 当前风险 | 任何新增 Doctor model 文件都能绕过 no-direct-fact-parser gate，重新直接解析或消费 `quotaFact`。 |
| 红灯方式 | `check-quota-static-gate-integration.test.mjs` 新增临时 repo fixture：`doctor-workbench/model/directQuotaFactConsumer.ts` 直接读取 `payload.quotaFact` 必须失败；当前目录级例外会导致测试先失败。 |
| 验收方式 | gate 输出 `knownTypedConsumerExceptions` 最多只包含 `doctor-workbench/model/quotaEvidenceAdapter.ts`；focused doctor/account/status quota tests 和 frontend typecheck 通过。 |

## 实现结果

- 新增 `frontend/src/features/doctor-workbench/model/quotaEvidenceAdapter.ts`，作为 Doctor Workbench 唯一允许直接读取 typed `quotaFact` 的 adapter。
- `doctorWorkbench.ts` 改为从 adapter 取得 `QuotaFactDisplay`，主模型不再直接访问 `evidence.quotaFact`。
- `check-quota-no-direct-fact-parser.mjs` 的 Doctor 例外从整个目录收窄为 adapter 单文件。
- `check-quota-static-gate-integration.test.mjs` 同时锁定：
  - 整个 doctor-workbench 目录不能被放行；
  - 普通 doctor model 直接读取 `payload.quotaFact` 会失败；
  - adapter 单文件可以消费 typed fact。

## 验收记录

- `node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs`
- `node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`
- `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- `npm --prefix frontend run typecheck`

## 剩余风险

- 本轮只收敛 Doctor Workbench frontend model/test 与 static gate，不改后端或 Wails DTO。
- static gate 仍是轻量词法扫描，不是完整 TypeScript AST；当前已覆盖 property、bracket、destructuring、raw alias、`JSON.parse` 形态，后续如出现新语法绕过需要继续补 fixture。
