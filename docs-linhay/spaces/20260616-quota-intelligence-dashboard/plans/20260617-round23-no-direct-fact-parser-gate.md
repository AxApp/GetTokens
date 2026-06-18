# Round 23 / No direct fact parser gate

日期：2026-06-17

## 本轮目标

1. 增加静态/测试门禁，防止新的 quota 消费面绕过共享 helper 直接手写 `quotaFact` / `quota_fact` / legacy `fact` 解析。
2. 保留共享 helper、focused tests 和 preview fixtures 内部构造/解析显式 fact 的能力。
3. 不改 UI、不改 Doctor Workbench、不改 sidecar truth。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| Round22 共享 helper | `resolveExplicitQuotaFactDisplay(payload)` 是 Account / Status / Usage 的唯一显式 fact 读取入口 | 静态门禁只允许该 helper 内部直接读取 `quotaFact/quota_fact/fact` | `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` |
| Status / Usage 消费 | `resolveQuotaStatusEvidenceFromPayload()` 已复用共享 helper，`usageDesk.ts` 通过它消费 | 测试检查 Status/Usage 仍调用 helper，不在消费面重新写字段兼容逻辑 | `quotaStatusEvidence.test.mjs` |
| 测试与 fixture | focused tests 和 preview data 需要继续构造 `quotaFact` payload | 扫描器将 `frontend/src/features/accounts/tests/**`、`frontend/src/features/status/tests/**`、`previewData.ts` 作为 fixture 允许面 | 静态脚本输出 allowed fixture policy |
| 新消费面绕过风险 | Dispatch 指出未来新代码可能直接手写 `quotaFact/quota_fact/fact` 解析 | 扫描 `frontend/src/features/**`，除共享 helper/fixture/已排除的 Doctor 既有 typed consumer 外发现 direct parser 即失败 | focused test + standalone script |

## 明确不做

1. 不修改 Doctor Workbench；Doctor typed evidence 路径由并行 Doctor agent 负责。
2. 不修改 `frontend/package.json`，避免扩大并行脏工作树写入面；本轮通过直接 focused command 验收。
3. 不阻止 DTO 类型、测试数据或 preview fixture 中出现 `quotaFact` 字段。
4. 不把 `fact` 的所有普通英文用法视为违规；门禁只针对 quota fact parser 形态。

## 红绿灯记录

- 红灯：先在 `quotaStatusEvidence.test.mjs` 接入尚不存在的 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`，`node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` 失败于 `MODULE_NOT_FOUND`，证明测试链路会调用门禁。
- 绿灯：脚本存在后，`quotaStatusEvidence.test.mjs` 通过；新增的临时 `/tmp` fixture 证明未授权 feature 直接读取 `payload.quotaFact` / `payload['quota_fact']` / `payload.fact` 会返回非零并报告文件行号。

## 实现记录

- 新增 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`，递归扫描 `frontend/src/features`。
- 唯一 direct parser 入口限定为 `frontend/src/features/accounts/model/accountQuota.ts`。
- 允许 accounts/status/doctor focused tests 与 preview fixture 构造显式 fact payload。
- Doctor Workbench 既有 typed quota evidence consumer 保留为本轮 scope 外例外，避免抢并行 Doctor 文件；例外在脚本输出中显式列出。
- `quotaStatusEvidence.test.mjs` 增加两个门禁测试：当前源码无违规、临时未授权 consumer 会被阻止。

## 验收命令

```bash
node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs
docs-linhay/scripts/check-docs.sh
git diff --check
```

## 剩余风险

1. 本轮不改 Doctor Workbench，因此扫描器对现有 Doctor typed consumer 保留已知例外；后续若要把 Doctor 也收敛到同一 helper，需要单独切片避免抢并行文件。
2. 静态门禁是语法形态扫描，不是完整 AST 解析；复杂动态字段拼接仍需代码 review 配合。
