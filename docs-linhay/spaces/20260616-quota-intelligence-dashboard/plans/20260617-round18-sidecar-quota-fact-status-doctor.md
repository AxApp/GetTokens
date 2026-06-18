# Round 18 / Sidecar quota fact status and doctor proof

日期：2026-06-17

## 本轮目标

1. 在 CLIProxyAPI 参考实现中证明：只要 sidecar runtime 持有 `QuotaRuntimeState.Fact`，`quota-status` runtime snapshot 必须输出显式 `quotaFact`。
2. doctor diagnostics 的 quota check 必须拷贝同一个 fact 和 `evidenceRefs`，不能只给下游 `windows/blockReason/usage totals`。
3. 当 raw runtime state 没有 fact 时，doctor 不从 `windows`、`blockReason` 或 usage totals 推导 authority。

## 证据矩阵

| 证据项 | 当前事实 | 本轮处理 | 验收方式 |
| --- | --- | --- | --- |
| status/runtime snapshot 缺显式 `quotaFact` | sidecar 内部已有 `Fact`，JSON 只稳定暴露 legacy `fact` | `QuotaRuntimeState.MarshalJSON()` 增加 `quotaFact` 别名，保留 `fact` 兼容 | `TestQuotaRuntimeRoutesPutAndGetStatus` |
| doctor quota check 需要 fact/evidence refs | doctor evidence 已有 `quotaFact` 字段，但需要证明拷贝和脱敏 | 测试锁定 evidence 中 `quotaFact`、top-level fields、`evidenceRefs` 一致，且修改返回副本不影响 store | `TestDoctorDiagnosticsIncludesQuotaFactEvidence` |
| 无 fact 不推导 authority | 读取路径会对 raw state 调用 fact builder，可能从 windows/blockReason 推导 | `withGuardState` 改为只 normalize 已存在 fact；raw no-fact state 在 doctor quota check 中保持 `not_ready` | `TestDoctorDiagnosticsDoesNotInferQuotaFactWhenMissing` |

## 明确不做

1. 不改前端。
2. 不引入本地推导 authority。
3. 不触碰正式 App、正式 sidecar 或正式配置。
4. 不扩大到 Route、Doctor client、Protocol、Extension。

## 实现记录

- `QuotaRuntimeState` 新增自定义 JSON marshal：当 `Fact` 存在时，同时输出 legacy `fact` 和显式 `quotaFact`。
- `withGuardState` 只规范化已有 `Fact`，不在读取路径凭窗口、block reason 或 usage totals 现造 fact。
- doctor diagnostics quota evidence 继续只消费 `state.Fact`；测试证明 `quotaFact` 与 `evidenceRefs` 是拷贝，且 explanation 保持脱敏。

## 验证命令

- 已通过：`go test ./internal/gettokenshooks -run 'TestQuotaRuntimeRoutesPutAndGetStatus|TestDoctorDiagnosticsIncludesQuotaFactEvidence|TestDoctorDiagnosticsDoesNotInferQuotaFactWhenMissing'`
- 已通过：`go test ./internal/gettokenshooks`
- 已通过：`go test ./internal/api/handlers/management -run 'Quota|Billing'`

## 剩余风险

1. `fact` 仍保留为 legacy JSON 字段；下游应优先使用 `quotaFact`，但兼容期内两者会同时存在。
2. 本轮只证明 sidecar reference runtime/doctor 输出，不接入前端或 Wails 新链路。
3. `BuildQuotaRuntimeFact()` 仍是写入/刷新时的 sidecar fact builder；本轮限制的是读取/doctor 消费路径不得对无 fact raw state 旁路推导 authority。
