# Round27 quota exception removal path

## 范围

- 把 quota no-direct-fact-parser static gate 的 knownTypedConsumerExceptions 从 Doctor 单文件例外压到 0。
- 统一显式 quota fact 解析入口，避免 Doctor 自行维护第二套 typed fact 适配逻辑。
- 保持显式 authority 边界：只有 quotaFact / quota_fact / fact 是 canonical typed fact，其他 quota-like 字段都不是 authority。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Round26 gate 输出仍为 exceptionFiles=1。 |
| 代码事实 | check-quota-no-direct-fact-parser.mjs 仍保留 quotaEvidenceAdapter.ts 单文件例外；Doctor adapter 直接访问 quotaFact。 |
| 当前风险 | 若继续保留 exception，未来 Doctor model 可沿着旧模式扩张 direct parser 面。 |
| 红灯方式 | static gate integration test 断言 knownTypedConsumerExceptions=[]，并要求 doctor adapter 通过共享 helper 路径仍可过 gate。 |
| 验收方式 | gate 结果 exceptionFiles=0、knownTypedConsumerExceptions=[]；quota/account/doctor focused tests 和 typecheck 通过。 |

## 实现结果

- accountQuota.ts 新增显式 fact fallback 能力，成为 Doctor / Status / Account 共用的 canonical helper。
- quotaEvidenceAdapter.ts 改成共享 helper 消费，不再保留 direct parser 形态。
- check-quota-no-direct-fact-parser.mjs 与 check-quota-static-gate-integration.test.mjs 都更新为零例外策略。
- quotaStatusEvidence.test.mjs 固化 exceptionFiles=0 与空 exception 列表，防止回退。

## 验收记录

- node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs
- node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
- node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs
- npm --prefix frontend run typecheck

## 剩余风险

- 业务语义上没有保留例外；typed fact consumer exception 已归零。
- 工具层仍是轻量词法扫描，不等于完整 TS AST。后续若发现新绕过形态，应补 integration fixture 与 scanner 规则，不要再用 exception 回滚。
