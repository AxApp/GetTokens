# Quota Fact Wails Frontend Pass-through v01

日期：2026-06-16

## 本切片范围

本切片承接 sidecar fact implementation，只做 main repo 透传与前端消费模型对齐：

1. `internal/cliproxyapi` 解析 sidecar `QuotaRuntimeState.fact`。
2. `internal/wailsapp` 将 sidecar snake_case fact 映射到 Wails camelCase `quotaFact`。
3. root App DTO / mapper 继续透传 `quotaFact`。
4. frontend `resolveQuotaFact` 优先消费 sidecar fact，并兼容旧 `quotaFact` 与 sidecar `fact` 两种入口。

## DTO 字段

透传字段为：

- `state`
- `source`
- `freshness`
- `confidence`
- `risk`
- `explanation`
- `observedAt`
- `expiresAt`
- `evidenceRefs`

sidecar 输入为 `observed_at`、`expires_at`、`evidence_refs`；Wails/root/frontend 输出使用 `observedAt`、`expiresAt`、`evidenceRefs`。前端将 sidecar `no_quota` 标准化为 UI 既有 `no-quota`。

## 边界

- Wails/root/frontend 不根据 `windows/status` 重新生成 authority fact。
- `windows/status` 推导只保留为无 sidecar fact 时的旧兼容 fallback。
- 不运行 Wails 生成器；`frontend/wailsjs/go/models.ts` 仅做必要类型对齐。

## 证据门禁

- 问题来源：sidecar fact plan 已完成 authority 输出，但 main repo 尚未透传到 Wails/root/frontend。
- 代码事实位置：
  - `internal/cliproxyapi/types.go` 缺少 `QuotaRuntimeFact`。
  - `internal/wailsapp/types.go` / `quota.go` 缺少 `quotaFact` DTO 与 mapper。
  - root `app_types.go` / `app_mappers.go` 缺少 root DTO 与 mapper。
  - `frontend/src/features/accounts/model/accountQuota.ts` 只读取 state/source/freshness/confidence/risk/explanation。
- 预期验收：focused Go/Node tests 证明 fact 字段和 evidence/timestamps 从 sidecar 透传到 frontend。

## 验收结果

- `go test ./internal/cliproxyapi -run TestQuotaRuntimeClientStatus`：通过。
- `go test ./internal/wailsapp -run 'TestQuotaRuntime|TestRefreshCodexQuotasBatch|TestCodexQuota'`：通过。
- `go test . -run TestMapCodexQuotaResponsePreservesBilling`：通过。
- `node --test src/features/accounts/tests/accountQuotaFact.test.mjs src/features/accounts/tests/accountQuotaRuntime.test.mjs`：通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

## 剩余项

无本切片剩余实现项。后续若要让 account detail / doctor / usage 展示更多 fact 证据，应在 UI 需求切片中消费 `observedAt`、`expiresAt`、`evidenceRefs`，不要回到前端重新推导 authority。
