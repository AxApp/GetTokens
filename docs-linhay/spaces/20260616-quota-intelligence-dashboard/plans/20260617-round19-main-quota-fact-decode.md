# Round 19 / Main-side quotaFact decode and status passthrough

日期：2026-06-17

## 本轮目标

1. GetTokens main side 能读取 sidecar runtime status 输出的显式 `quotaFact`。
2. 保留 legacy `fact` 兼容；当 `quotaFact` 与 `fact` 同时存在时，优先使用 `quotaFact`。
3. Wails/status quota consumers 只透传显式 fact；缺 fact 时继续 non-authoritative，不从 `windows`、`blockReason` 或 usage totals 推导 authority。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| sidecar 已输出 `quotaFact` | main side `QuotaRuntimeState` 只按 legacy `fact` tag 解码，`quotaFact` 会丢失 | `QuotaRuntimeState.UnmarshalJSON()` 接受 `quotaFact` / `quota_fact` / `fact`，并让 `quotaFact` 优先 | `TestQuotaRuntimeClientStatus` |
| fact 内部字段 casing | sidecar/Wails/front-end 兼容期可能混用 `observedAt/evidenceRefs` 与 `observed_at/evidence_refs` | `QuotaRuntimeFact.UnmarshalJSON()` 接受 camel/snake 时间与 evidence refs 字段 | `TestQuotaRuntimeClientDecodesQuotaFactAliasesWithoutLocalInference` |
| Wails DTO 透传 | `mapQuotaRuntimeStateToCodexQuotaResponse()` 已从 `state.Fact` 映射到 Wails `quotaFact` | 锁定 `evidenceRefs` 双向深拷贝，避免消费者或源对象互相污染 | `TestQuotaRuntimeStateToCodexQuotaResponsePassesThroughFact` |
| 前端 status authority 边界 | status helper 已只读显式 fact，但缺少三种外层字段并列证明 | 测试覆盖 `quotaFact`、`quota_fact`、legacy `fact` 都是显式 fact；无 fact 的 `windows/blockReason` 仍 non-authoritative | `quotaStatusEvidence.test.mjs` |

## 明确不做

1. 不改 CLIProxyAPI reference。
2. 不改 Extension、Protocol、Route action、Doctor diagnostics。
3. 不引入 Wails/root 本地 quota authority 推导。
4. 不触碰正式 App、正式 sidecar 或正式配置。

## 实现记录

- `internal/cliproxyapi.QuotaRuntimeState` 增加自定义 JSON decode，按 `quotaFact` -> `quota_fact` -> `fact` 顺序选择显式 sidecar fact。
- `internal/cliproxyapi.QuotaRuntimeFact` 增加自定义 JSON decode，兼容 camelCase 与 snake_case 的时间/evidence refs 字段。
- Wails quota response 继续使用现有 `CodexQuotaResponse.QuotaFact` DTO，仅补测试证明 evidence refs 是深拷贝。
- Status frontend helper 继续不从局部 payload 字段推导 authority；本轮只补齐 casing/legacy 显式 fact 测试。

## 验证命令

- 已通过：`go test ./internal/cliproxyapi -run 'TestQuotaRuntimeClientStatus|TestQuotaRuntimeClientDecodesQuotaFactAliasesWithoutLocalInference'`
- 已通过：`go test ./internal/wailsapp -run 'TestQuotaRuntimeStateToCodexQuotaResponsePassesThroughFact'`
- 已通过：`node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs`
- 已通过：`go test ./internal/cliproxyapi`
- 已通过：`go test ./internal/wailsapp -run 'Quota'`
- 已通过：`node --test frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
- 已通过：`docs-linhay/scripts/check-docs.sh && git diff --check`

## 剩余风险

1. 本轮只做 main repo decode/透传，不更新 sidecar reference 输出。
2. `GetAllQuotaStatuses()` 仍直接返回 sidecar-native runtime struct，兼容期内前端 model 需要继续接受 `fact` / `quotaFact` / `quota_fact`。
3. 全量聚合测试由主控在全部 subagent 返回后统一运行；本轮只跑聚焦命令。
