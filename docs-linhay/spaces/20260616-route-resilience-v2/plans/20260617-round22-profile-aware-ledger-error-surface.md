# Round22: Profile-Aware Ledger Path And Error Surface

日期：2026-06-17

## 目标

为 Round20/21 durable route resilience action JSONL ledger 补齐 profile-aware/test-overridable path 解析，并把 append/truncate failure 暴露到 action response，避免 operator action 已执行但 ledger 写入失败时只能静默回退到内存 history。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Twenty-Second Dispatch 指定：`Route Resilience profile-aware ledger path and append error surface`。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions.go` 的 `defaultRouteResilienceActionLedgerPath()` 只使用 user cache/temp；`routeResilienceActionHistoryStore.record()` 对 append/truncate error 直接忽略。 |
| 当前现象 / 缺失证明 | Round21 后 ledger 可 durable replay / max entries 截断，但不能从 profile config path 推导 runtime ledger path；append/truncate 失败时 action response 没有任何可观察字段。 |
| 预期验收方式 | focused Go tests 证明：config profile path 可解析到 profile-local `route-resilience/actions.jsonl`；测试仍可覆盖 ledger path；append failure 与 truncate failure 会出现在 action response `ledgerError` 字段，action mutation 状态不被改写。 |
| 反证条件 | ledger path 解析落到正式 GetTokens 配置目录、测试不能覆盖临时路径、append/truncate failure 仍被静默吞掉、或为修复引入 scheduler / 外部 repair service。 |

## 范围

- 只修改 CLIProxyAPI reference fork 内 `internal/gettokenshooks/route_resilience_actions*`。
- 只更新本 space README 与本计划。
- 测试使用 `t.TempDir()` 与 store 注入点模拟 append/truncate failure。

## 非目标

- 不写正式 GetTokens 配置目录。
- 不新增 scheduler、rotation worker 或外部 repair service。
- 不改变 `clear_transient_lockout`、`recheck_routeability`、`rerun_bounded_reconcile` 的 mutation/tracer 语义。
- 不修改主仓 Wails/frontend/正式 App 配置。

## BDD 场景

1. 给定 sidecar profile config path 为 `<profile>/config.yaml`，当解析 route resilience action ledger path 时，返回 `<profile>/route-resilience/actions.jsonl`；给定 profile dir 时返回同一路径。
2. 给定测试覆盖 ledger path 并注入 append failure，当 operator action 成功执行时，response 保留原 `applied` 状态和 auditId，同时包含 `ledgerError=append route resilience action ledger: ...`。
3. 给定测试覆盖 ledger path、max entries 和 truncate failure，当 operator action 成功执行时，response 保留原 `applied` 状态和 auditId，同时包含 `ledgerError=truncate route resilience action ledger: ...`。

## 实现记录

- `RouteResilienceActionResponse` 新增 `ledgerError` 可选字段，只在 ledger append/truncate 失败时返回。
- `routeResilienceActionHistoryStore.record()` 改为返回 append/truncate error；即使 ledger 文件失败，内存 history 仍记录本次 action，避免本轮操作完全不可见。
- 新增 `routeResilienceActionLedgerPathFromConfig()` 与 `SetRouteResilienceActionLedgerPathFromConfig()`，支持从 profile config file 或 profile dir 推导 profile-local JSONL path。
- 新增测试注入点 `setAppendLedgerFunc()` / `setTruncateLedgerFunc()`，用于 deterministic failure surface 测试，不依赖文件系统权限差异。

## 验收记录

- 红灯：`go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(LedgerPathDerivesFromProfileConfigPath|ResponseSurfacesLedger)' -count=1`
  - 初始失败为缺少 `routeResilienceActionLedgerPathFromConfig`、`LedgerError` 与 append/truncate 注入点。
- 绿灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(LedgerPathDerivesFromProfileConfigPath|ResponseSurfacesLedger)' -count=1`
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceActionHistory|TestRouteResilienceActionDefaultLedgerPathAvoidsFormalConfigDir' -count=1`

## 剩余风险

- 本轮只在 route resilience action 文件内新增 profile-aware path setter；启动 hook 是否调用该 setter 留给主控聚合或后续 round 统一接线。
- `ledgerError` 是 action response 可观察字段，不改变 HTTP status 或 action `status`；若未来要求 ledger 强一致，需要单独提升为 action failure policy。
- ledger 仍是最新 N 条 JSONL 截断，没有 rotation metadata、fsync 策略或分页 metadata。
