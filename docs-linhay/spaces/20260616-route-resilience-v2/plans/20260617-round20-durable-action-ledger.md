# Round 20: Durable Action Ledger

## 证据门禁

- 问题来源：Round19 的 action history 是 sidecar-owned，但仍主要依赖进程内内存；sidecar 重启后无法从文件恢复 operator action 记录。
- 当前事实位置：
  - handler / history helper：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions.go`
  - focused tests：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions_test.go`
  - route space 状态：`docs-linhay/spaces/20260616-route-resilience-v2/README.md`
- 当前缺口：
  - `clear_transient_lockout`、`recheck_routeability`、`rerun_bounded_reconcile` 记录没有 durable JSONL/file ledger。
  - history endpoint 需要能从 ledger 读回，而不是只依赖前端或进程内 history。
  - 测试必须覆盖临时路径，避免写用户正式配置目录。
- 验收方式：
  - focused test 用 `t.TempDir()` 指定 JSONL ledger path。
  - 执行 clear / recheck / rerun bounded reconcile dry-run 后，ledger 文件有 3 条 JSONL。
  - 清空内存 history 后，`GET /gettokens/route-resilience/actions/history` 仍能从 JSONL ledger 读回 3 条 newest-first 记录。
  - bounded reconcile 仍保持 dry-run 无 audit、`reconcileRuns=1`；非 dry-run 有 audit、`reconcileRuns=1`。
- 反证条件：
  - ledger 写入 `~/.config/gettokens` 或其他正式配置目录。
  - history endpoint 只能读内存，清空内存后读不到记录。
  - durable ledger 引入全局 repair scheduler、循环 reconcile 或外部服务调用。

## 实现边界

- 在 `route_resilience_actions.go` 内扩展 Round19 history store：
  - `ledgerPath` 作为 sidecar-owned JSONL 文件路径。
  - action record 时 append JSONL，并继续保留内存副本作为读文件失败时的回退。
  - history 查询优先从 JSONL ledger 读回，按 newest-first 返回。
  - scanner 跳过空行和坏行，避免单条损坏阻断查询。
- 默认路径：
  - 优先 `os.UserCacheDir()/gettokens/route-resilience-actions.jsonl`。
  - 若 cache dir 不可用，回退 `os.TempDir()/gettokens/route-resilience-actions.jsonl`。
  - 不使用 `/Users/linhey/.config/gettokens` 或 dev/prod 正式配置目录。
- 测试路径：
  - `useRouteResilienceActionLedgerPathForTest(t)` 使用 `t.TempDir()`。
  - `setLedgerPath()` 在 cleanup 时恢复旧路径并清空内存副本。
- 保持 Round19 bounded tracer 合约：
  - `recheck_routeability`：`tracerOnly=true`、`reconcileRuns=0`。
  - `rerun_bounded_reconcile`：单次 target-scoped sampling，`tracerOnly=true`、`reconcileRuns=1`。
  - dry-run 不生成 auditId，非 dry-run 生成 `route-audit-*`。
  - 不调用外部服务、不跑 scheduler、不清理 guard store。

## 已证明链路

- 红灯：
  - `go test ./internal/gettokenshooks -run 'TestRouteResilienceActionHistoryReadsDurableJSONLLedger' -count=1`
  - 初始失败为缺少 `setRouteResilienceActionLedgerPathForTest`，证明测试先覆盖临时 ledger path 与 durable readback。
- 绿灯：
  - `clear_transient_lockout` 写入 ledger，记录 auditId、target、before/after block counts。
  - `recheck_routeability` 写入 ledger，记录 auditId、`tracerOnly=true`、`reconcileRuns=0`。
  - `rerun_bounded_reconcile` dry-run 写入 ledger，记录空 auditId、`tracerOnly=true`、`reconcileRuns=1`。
  - 清空内存 history 后，history endpoint 仍从 JSONL ledger 读回 newest-first 三条记录。

## 验证记录

- `gofmt -w internal/gettokenshooks/route_resilience_actions.go internal/gettokenshooks/route_resilience_actions_test.go`
- `go test ./internal/gettokenshooks -run 'TestRouteResilienceActionHistoryReadsDurableJSONLLedger' -count=1`
- `go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
- `go test ./internal/gettokenshooks -count=1`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check -- docs-linhay/spaces/20260616-route-resilience-v2/README.md docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round20-durable-action-ledger.md`
- `git -C docs-linhay/references/CLIProxyAPI diff --check -- internal/gettokenshooks/route_resilience_actions.go internal/gettokenshooks/route_resilience_actions_test.go`

## 剩余风险

- JSONL ledger 当前只有 append / read，没有 compaction、rotation 或 size cap；Round19 的内存 history 仍有 200 条 cap，但文件不会自动裁剪。
- ledger append 失败当前回退到内存副本，不会让 action handler 失败；后续若 operator audit 要求强一致，需要把 ledger error 暴露到 action response 或 management diagnostics。
- 默认 cache/temp path 是 sidecar-owned file ledger，但不是 account SQLite；后续如需要随 profile 迁移或备份，需要接入 profile-aware sidecar runtime path。
- reference 目录内仍有其他 subagent 修改的 `internal/gettokenshooks/doctor_diagnostics.go` / `doctor_diagnostics_test.go`，本轮未触碰。

## 主控聚合测试建议

- `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
- `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks -count=1`
- 若后续 Wails/main app 消费 history endpoint，补主仓 client/DTO/WailsJS/frontend tests，确认查询返回来自 sidecar ledger 而不是前端本地 state。
