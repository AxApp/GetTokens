# Round21: Ledger Bounds And Query Filters

日期：2026-06-17

## 目标

为 Round20 sidecar-owned durable action JSONL ledger 增加测试可控的增长边界，并让 history endpoint 支持 bounded query filter。目标是保留可审计的最近动作记录，同时避免 JSONL 文件无限追加后只能全量扫描。

## 证据门禁

| 项 | 证据 |
| --- | --- |
| 问题来源 | Twenty-First Dispatch 指定：`Route Resilience ledger bounds and query filters`，要求 max entries / truncation 或 rotation 边界，并支持 action/status/target/limit 等过滤。 |
| 当前代码事实位置 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions.go` 的 `routeResilienceActionHistoryStore.record()` 只裁剪内存 `items`，`appendRouteResilienceActionLedgerItem()` 仍 append-only；`readRouteResilienceActionLedger()` 会扫描完整 JSONL 后再倒序返回。 |
| 当前现象 / 缺失证明 | Round20 测试只证明 JSONL durable replay 和默认路径不写正式 config；没有证明 ledger 文件可被 max entries 截断，也没有证明 history endpoint 支持 `status` / `target` 过滤。 |
| 预期验收方式 | 先补 focused Go tests 证明：测试可配置 max entries 后 JSONL 文件只保留最新 N 条；history endpoint 支持 `action`、`status`、`target`、`accountKey`、`authId`、`model`、`limit` 组合过滤，且 `limit=0` 可返回空列表。 |
| 反证条件 | 若 ledger 在写入 3 条且 max entries=2 后文件仍保留 3 行，或 history 查询无法按 `status` / `target` 精确过滤，则本轮未完成。 |

## 范围

- 只修改 CLIProxyAPI reference fork 内 `internal/gettokenshooks/route_resilience_actions*`。
- 只更新本 space README 与本计划。
- 允许测试使用 `t.TempDir()` 和 test helper 覆盖 ledger path / max entries。

## 非目标

- 不写用户正式配置目录。
- 不新增后台 scheduler、轮询器或异步 compaction worker。
- 不调用外部 repair service。
- 不改变 action mutation 语义，也不恢复旧 management API 兼容层。

## BDD 场景

1. 给定测试将 route resilience action ledger path 指向 `t.TempDir()` 且 max entries 设为 2，当连续写入 clear / recheck / bounded reconcile 三条 action history 后，JSONL 文件只保留最新两条，history replay 也只返回这两条 newest-first。
2. 给定 ledger 中包含 applied / dry_run、不同 action 与不同 target，当调用 history endpoint 携带 `action`、`status`、`target`、`accountKey`、`authId`、`model`、`limit` 时，只返回匹配项；`limit=0` 明确返回空列表。

## 验收记录

- 通过：`go test ./internal/gettokenshooks -run 'TestRouteResilienceActionHistory' -count=1`
- 通过：`go test ./internal/gettokenshooks -run 'TestRouteResilienceAction' -count=1`
- 本轮未重建 sidecar、未启动 dev App；Twenty-First Dispatch 指定主控最后统一聚合。

## 实现记录

- `routeResilienceActionHistoryStore` 新增 `maxEntries`，默认 200；测试可通过 helper 设置更小边界。
- 每次 ledger append 成功后同步截断 JSONL，只保留最新 `maxEntries` 条，避免依赖后台 scheduler。
- history filter 标准化支持 `action`、`status`、`target`、`accountKey`、`authId`、`model`、`limit`；`limit=0` 明确返回空列表。
