# Round27 Doctor quota exception removal path

## 范围

- 取消 Doctor Workbench 在 quota static gate 中的 typed consumer 例外。
- Doctor quota adapter 改为复用 frontend/src/features/accounts/model/accountQuota.ts 的 canonical helper。
- 保持 Doctor 只读语义：没有显式 typed fact 时，不从 summary、windows、blockReason、usageTotals 推导 authority。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round26 仍保留 quotaEvidenceAdapter.ts 单文件 known exception。 |
| 代码事实 | frontend/src/features/doctor-workbench/model/quotaEvidenceAdapter.ts 直接访问 evidence.quotaFact 并手工拼接 fallback 字段。 |
| 当前风险 | static gate exceptionFiles=1，Doctor 仍存在直接 quota parser 的保留口。 |
| 红灯方式 | check-quota-static-gate-integration.test.mjs 要求 doctor adapter 使用共享 helper 仍可通过，同时 knownTypedConsumerExceptions=[]、exceptionFiles=0。 |
| 验收方式 | Doctor focused tests、quota gate、typecheck 全通过；typed fact 缺少 source/explanation 时，只允许 fallback 填充展示，不允许从非 fact 字段造 authority。 |

## 实现结果

- accountQuota.ts 将 resolveExplicitQuotaFactDisplay() 提升为 canonical helper：统一解析 quotaFact / quota_fact / fact，并支持 sourceFallback、explanationFallback。
- quotaEvidenceAdapter.ts 不再直接读取 evidence.quotaFact，只做 quota check 判定，再调用共享 helper。
- doctorWorkbench.test.mjs 补充 typed fact 缺少 nested source/explanation 时走共享 fallback 的反回归。
- check-quota-no-direct-fact-parser.mjs 的 knownTypedConsumerExceptions 已降为 []。

## 验收记录

- node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs
- node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
- node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs
- npm --prefix frontend run typecheck

## 结论与下一步

- Round27 已把 Doctor quota typed consumer 例外压到 0。
- 现存剩余风险不是业务语义，而是 static gate 仍属 lexical-light-AST；若后续出现新语法绕过，需要继续补 fixture，而不是回退 known exception。
