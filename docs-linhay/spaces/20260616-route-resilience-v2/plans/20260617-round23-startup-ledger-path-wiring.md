# Round23: Startup Ledger Path Wiring

日期：2026-06-17

## 目标

把 Round22 已实现的 profile-aware route resilience action ledger path 接到 CLIProxyAPI reference 的 GetTokens startup hook，使真实 runtime config path 能驱动 action ledger 落到 `<profile>/route-resilience/actions.jsonl`，同时保留测试对 ledger path 的临时覆盖能力。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Twenty-Third Dispatch 指定：`Route Resilience startup ledger path wiring`。 |
| 当前代码事实位置 | `internal/cmd/run.go` 通过 `installGetTokensHooks(cfg, configPath)` 调用 `gettokenshooks.InstallRoutingPoliciesWithConfigPath(configPath)`；`internal/gettokenshooks/routing_policy.go` 已向 channel routing / project candidate pool 传递 config path，但未调用 Round22 的 `SetRouteResilienceActionLedgerPathFromConfig()`。 |
| 当前现象 / 缺失证明 | Round22 只证明 direct setter 可写 profile-local ledger；启动 hook 未接线时，runtime config path 不会驱动 route resilience action ledger 目录。 |
| 预期验收方式 | focused Go test 先红后绿：`InstallRoutingPoliciesWithConfigPath(<profile>/config.yaml)` 后执行 route action，会写 `<profile>/route-resilience/actions.jsonl`；随后测试 helper 覆盖 ledger path 后，action 写测试临时 JSONL 而不是 profile ledger。 |
| 反证条件 | 写入正式 GetTokens 配置目录、测试 override 被 startup wiring 覆盖、新增 scheduler/外部 repair service，或 action ledger 仍落到默认 cache/temp path。 |

## 范围

- 只修改 CLIProxyAPI reference fork 内 `internal/gettokenshooks/routing_policy.go` 与 route resilience action focused tests。
- 只更新 Route Resilience space README 与本计划。
- 验证只使用 `t.TempDir()` profile path 和 test override path。

## 非目标

- 不写 `/Users/linhey/.config/gettokens/` 或正式 GetTokens 配置目录。
- 不新增 scheduler、repair worker 或外部 repair service。
- 不改变 action mutation/tracer 语义、HTTP status 或 `ledgerError` policy。
- 不修改主仓 Wails/frontend 或正式 App 配置。

## BDD 场景

1. 给定启动 config path 为 `<profile>/config.yaml`，当 `InstallRoutingPoliciesWithConfigPath()` 运行并执行 `recheck_routeability` action 时，ledger 写入 `<profile>/route-resilience/actions.jsonl`。
2. 给定启动 config path 已设置 profile ledger，当测试 helper 随后覆盖 ledger path 时，action 写入测试临时 JSONL，并且 profile ledger 不被创建。

## 实现记录

- `InstallRoutingPoliciesWithConfigPath(configPath)` 现在在注册 routing policies 前调用 `SetRouteResilienceActionLedgerPathFromConfig(configPath)`。
- setter error 只记录 warning，不阻断既有 routing policy 注册；正常 runtime config path 和空 path 都沿用 Round22 的 fallback 语义。
- 新增 startup wiring focused tests，证明 runtime config path -> ledger dir 的实际写入，以及 test override 的优先级。

## 验收记录

- 红灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(Start|TestLedgerOverride)' -count=1`
  - 初始失败：`TestRouteResilienceActionStartupConfigPathWiresLedgerPath` 未找到 `<profile>/route-resilience/actions.jsonl`。
- 绿灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction(Start|TestLedgerOverride)' -count=1`
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
  - `go test ./internal/gettokenshooks -count=1`

## 剩余风险

- 本轮只证明 CLIProxyAPI reference startup hook 会设置 ledger path；未启动 Wails/dev App，也未重建 sidecar，等待主控统一聚合。
- ledger 仍是 profile-local JSONL + max entries 截断，不包含 rotation metadata、fsync 策略或跨进程锁。
- `ledgerError` 仍只做可观察 surface，不把 ledger failure 升级为 action failure。
