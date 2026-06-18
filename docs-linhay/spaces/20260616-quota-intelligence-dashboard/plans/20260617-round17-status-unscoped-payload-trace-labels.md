# Round 17 / Status unscoped payload trace labels

日期：2026-06-17

## 本轮目标

1. 为无 `accountKey` 且缺少显式 `quotaFact/quota_fact/fact` 的 Status quota payload 增加只读 trace/sample labels。
2. trace label 只能来自 payload 序号和安全元字段，例如 `source/status/updatedAt/provider`。
3. 继续保持 quota authority 边界：不得从 `windows`、`blockReason`、`usageTotals` 等局部字段推导账号、authority、quota state 或风险等级。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| unscoped payload 只能计数 | Round 16 已有 `unscopedMissingFactCount`，但无法展示可定位样本 | notice 增加 deterministic sample labels，格式以 `payload #<n>` 开头，并追加安全元字段 | `frontend/src/features/status/tests/quotaStatusEvidence.test.mjs` |
| 账号身份不可推导 | 无 `accountKey` payload 可能带 `provider/source`，但这些字段不是账号身份 | sample labels 只作为 read-only trace，不写入 `accountKeys`，UI 明确标注 `UNSCOPED` / `NON-AUTHORITATIVE` | focused tests + UI source assertions |
| authority 越权风险 | payload 可能包含 `windows/blockReason/usageTotals`，这些字段容易被误读成 quota 事实 | label builder 不读取这些字段，测试锁定 label 不包含这些值 | `quotaStatusEvidence.test.mjs` |
| 只限本轮切片 | 用户限定只处理 Quota Intelligence，不碰其它四个 OmniRoute space | 改动仅落在允许文件清单 | scoped diff |

## 明确不做

1. 不从 unscoped payload 推导账号、authority、quota state、risk 或 route 决策。
2. 不修改 sidecar / Wails DTO / management API。
3. 不改 route resilience、doctor workbench、extension contract、protocol bridge。
4. 不清理、回退或合并当前工作树中的其它脏改。

## 验收命令

1. `node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check -- frontend/src/features/status/model/quotaEvidenceSection.ts frontend/src/features/status/components/StatusPanels.tsx frontend/src/features/status/tests/quotaStatusEvidence.test.mjs docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md docs-linhay/spaces/20260616-quota-intelligence-dashboard/plans/20260617-round17-status-unscoped-payload-trace-labels.md`

## 实现记录

- `StatusQuotaEvidenceNotice` 新增 `unscopedMissingFactSamples?: string[]`。
- `buildStatusQuotaEvidenceSectionState()` 对无 `accountKey` 且缺显式 fact 的 payload 生成 deterministic label，最多保留 5 条样本。
- label 只读取 `source/status/updatedAt/provider` 和 payload 序号；不读取 `windows/blockReason/usageTotals`。
- `StatusQuotaEvidenceSection` 在 unscoped count 下展示 sample labels，并明确标记 `UNSCOPED TRACE SAMPLES` 与 `NON-AUTHORITATIVE TRACE`。

## 剩余风险

1. 这些 labels 不是账号身份，也不是 quota authority；无 `accountKey` 的 payload 仍无法定位具体账号。
2. `provider/source/status` 只用于追踪数据来源，不能作为 account key、routing identity 或 authority source。
3. 本轮未改 sidecar 或 Wails DTO；如果后续需要精准账号定位，必须由上游 payload 显式提供安全的 account key 或 trace id。

## 验证结果

- 已通过：`node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- 已通过：`node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs`
- 已通过：`docs-linhay/scripts/check-docs.sh`
- 已通过：`git diff --check -- frontend/src/features/status/model/quotaEvidenceSection.ts frontend/src/features/status/components/StatusPanels.tsx frontend/src/features/status/tests/quotaStatusEvidence.test.mjs docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md docs-linhay/spaces/20260616-quota-intelligence-dashboard/plans/20260617-round17-status-unscoped-payload-trace-labels.md`
- 阻塞：`npm --prefix frontend run typecheck` 当前失败在本轮范围外的 `src/features/accounts/model/accountPresentation.ts(649,33): Cannot find name 'reasonDetailsByDigestID'`；未在本轮修复，避免触碰非 Quota Intelligence 允许范围。
