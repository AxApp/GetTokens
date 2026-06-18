# Quota Fact Sidecar Implementation v01

日期：2026-06-16

## 本切片范围

本切片只实现 sidecar authority，不改 Wails / frontend：

1. 在 `QuotaRuntimeState` 增加 JSON 字段 `fact`。
2. 在 sidecar hooks 中新增 `QuotaRuntimeFact` builder。
3. 让 runtime normalize、upsert、GET/list/status fallback、management quota refresh、quota-test、billing-test 输出 fact。
4. 保持现有 route guard 规则：只有 fresh success 且已知窗口耗尽并有未来 reset 的状态会写 `quota-empty`；`stale`、`degraded`、`unknown`、`unsupported` 不新增 hard block。

## Fact 字段

`fact` 输出字段与 implementation plan 对齐：

- `state`: `available | no_quota | unknown | stale | denied | unsupported`
- `source`: sidecar runtime 来源，例如 `quota-runtime`、`codex-api-key-quota-curl`、`openai-compatible-quota-curl`、`codex-api-key-quota-test`
- `freshness`: `fresh | stale | unknown`
- `confidence`: `high | medium | low | none`
- `risk`: `none | warning | blocking | denied | unknown`
- `explanation`: sanitized summary，不输出 bearer、API key、cookie、token 或长原始错误正文
- `observed_at`
- `expires_at`
- `evidence_refs`

## Classification Rules

- 输入已经明确提供 `fact` 时保留该事实，只做 trim / explanation redaction / evidence refs 去重。
- fresh success 且所有已知 quota window 都耗尽，并且存在未来 reset boundary：`state=no_quota`、`risk=blocking`，并保持与 `quota-empty` guard 一致。
- fresh success 且有正向窗口或 billing evidence：`state=available`。
- 缺失 runtime 状态、没有窗口/billing 证据、reset 不确定：`state=unknown`。
- stale/degraded cache 且没有 denied 证据：`state=stale`。
- `401/402/403`、unauthorized、forbidden、permission denied、invalid auth、token invalidated、deactivated workspace 等 denied-looking reason：`state=denied`。
- unsupported / not configured / account kind does not support quota：`state=unsupported`。

## Guard Boundary

本切片没有扩大 `AccountRouteGuardStore` 写入条件：

- `QuotaRuntimeStore.syncGuard` 仍然只接受 `status=success`、非 stale、非 degraded 的状态。
- `QuotaEmptyRouteGuardBlocks` 仍要求 fresh、非 stale、非 degraded、耗尽窗口有未来 reset。
- degraded fallback 会清掉旧 fact 后重新构建当前 fact，但不会新增 `quota-empty`。
- stale/degraded 仍不会提前清除已有 fresh `quota-empty`；reset 仍是恢复边界。

## Focused Tests

新增 / 扩展覆盖：

- fact builder 分类：`no_quota`、`available`、`unknown`、`stale`、`denied`。
- 提供 fact 时优先保留。
- GET `quota-status` 输出 fact。
- missing account status 输出 `unknown` fact。
- refresh degraded fallback 输出 sanitized `denied` fact。
- fresh no_quota 与 `quota-empty` guard 一致。
- quota-test / billing-test 非 runtime 写入输出 fact。

## 验证命令

在 `docs-linhay/references/CLIProxyAPI` 下运行：

```bash
go test ./internal/gettokenshooks -run 'TestQuotaRuntime|TestQuotaEmptyRouteGuard'
go test ./internal/api/handlers/management -run 'TestQuota'
```

在父仓库运行：

```bash
git diff --check
```

## 剩余风险

1. Wails/root/frontend 还未透传或消费 `fact`，这是后续切片。
2. `denied` 识别仍基于 sidecar sanitized reason/status 文本；后续可引入结构化 provider reason code。
3. `unsupported` 当前来自 refresh/test 错误文本，不代表完整 account capability schema。
4. 本切片未重建 sidecar binary，也未做 dev App 手点验收；当前验收以 focused Go tests 为准。

## 2026-06-16 Doctor Diagnostics 消费切片

- CLIProxyAPI reference sidecar 新增只读 `GET /v0/management/gettokens/doctor-diagnostics`，作为 Doctor Workbench 后续接真实 sidecar diagnostics 的前置切片。
- `quota_facts` check 只读取 `QuotaRuntimeStore.States()` 中已经归一化的 `QuotaRuntimeState.fact`，不根据 `status/windows/billing` 在 diagnostics endpoint 内重新推导 quota authority。
- evidence 保留 `state/source/freshness/confidence/risk/explanation/observedAt/expiresAt/evidenceRefs`，并嵌入原始 `quotaFact` 结构供 Wails/root/frontend 下一切片稳定映射。
- 本切片不刷新 quota、不调用上游、不新增 repair mutation；主仓 Wails/root/frontend 接线仍待下一切片。
- 验证：`go test -count=1 ./internal/gettokenshooks -run 'TestDoctorDiagnostics|TestQuotaRuntime|TestRouteResilience|TestChannelRouting'` 通过。
