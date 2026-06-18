# Quota Fact Evidence UI Plan

日期：2026-06-16

## 范围

本切片承接 A3 已完成的 `quotaFact` 透传，只设计前端展示与验收，不改变 sidecar quota authority。

目标是让 account detail / doctor / usage 状态面能稳定展示 sidecar-provided fact evidence：

- `observedAt`
- `expiresAt`
- `evidenceRefs`
- `source`
- `freshness`
- `confidence`
- `risk`
- `explanation`

## Evidence Matrix

| 证据项 | 当前事实 | 下一切片处理 | 验收方式 |
|---|---|---|---|
| A3 DTO 透传 | `QuotaRuntimeState.fact` 已进入 Wails/root/frontend `quotaFact` | 只消费已有字段，不新增 authority 推导 | focused frontend tests |
| 字段完整性 | A3 已透传 `observedAt/expiresAt/evidenceRefs` | UI 增加 evidence summary 与 refs 展示 | snapshot/model tests 断言渲染文本 |
| fallback 兼容 | `resolveQuotaFact()` 无 sidecar fact 时保留旧兼容推导 | fallback 只描述 display semantics，不产生新 authority | test 覆盖 missing fact |
| doctor 消费 | Doctor A2 已读取 quota facts 作为 evidence | Doctor UI 只显示 sidecar evidence，不根据窗口数据重算 | `npm run test:doctor-workbench` |

## BDD Scenarios

1. Given sidecar returns `quotaFact.state=no_quota` with `observedAt` and `evidenceRefs`
   When account quota evidence is rendered
   Then UI shows source, freshness, observed time, evidence refs, and explanation.

2. Given sidecar returns stale cached quota fact with `expiresAt` in the past
   When account detail renders quota evidence
   Then UI labels the fact as stale/cached without converting it into a new `no_quota` authority.

3. Given no `quotaFact` exists on an older sidecar response
   When frontend resolves display state
   Then fallback remains compatible and evidence section is absent or marked unavailable.

## Candidate Write Set

Expected frontend-only implementation:

- `frontend/src/features/accounts/model/accountQuota.ts`
- `frontend/src/features/accounts/model/types.ts`
- `frontend/src/features/accounts/components/**`
- `frontend/src/features/accounts/tests/**`
- `frontend/src/features/doctor-workbench/**`

Avoid touching:

- `docs-linhay/references/CLIProxyAPI`
- `internal/wailsapp` / root DTO unless a missing binding is proven
- protocol bridge / extension contract spaces

## Test Plan

```bash
npm --prefix frontend run test:unit -- src/features/accounts/tests/accountQuotaFact.test.mjs src/features/accounts/tests/accountQuotaRuntime.test.mjs
npm --prefix frontend run test:doctor-workbench
npm --prefix frontend run typecheck
git diff --check
```

If full unit script expands to unrelated legacy tests, record the focused command output and do not repair unrelated failures.

## 验收结果

- `node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/accounts/tests/accountCardLayout.test.mjs`：通过，30/30。
- `npm --prefix frontend run typecheck`：通过。

## 当前实现输出

1. `buildQuotaDisplay()` 将 `resolveQuotaFact()` 的结果挂到 `QuotaDisplay.fact`，使账号卡与详情页复用同一份 sidecar fact display model。
2. `QuotaBars` 增加 `QuotaFactEvidenceStrip`，展示 `state/source/freshness/confidence/risk/observedAt/expiresAt/evidenceRefs`。
3. UI 层不调用 `resolveQuotaFact()`，不根据 `windows/status` 重新生成 authority fact；缺少 fact evidence 时不渲染 evidence strip。

## 不做项

1. 不根据 `windows/status` 重新生成 quota authority。
2. 不把缺失 evidence 当成 `no quota`。
3. 不在 frontend 写入 quota runtime state。
4. 不改变 sidecar quota refresh/probe 行为。
