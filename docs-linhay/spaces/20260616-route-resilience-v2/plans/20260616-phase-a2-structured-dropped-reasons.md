# Route Resilience v2 Phase A2 Structured Dropped Reasons

日期：2026-06-16

## Phase A2 边界

本阶段把 A1 的 `RouteResilienceState` 接入 channel routing explain 与 recent route decisions 的 dropped reasons。A2 只做 sidecar / reference CLIProxyAPI 内的结构化诊断，不改 selector 语义，不开放 selector script，不接 Wails 或 frontend。

## Evidence Matrix

| 证据项 | 来源 | 当前事实 | A2 处理 | 验收方式 |
|---|---|---|---|---|
| A1 state model | `internal/gettokenshooks/route_resilience.go` | 已有 `RouteResilienceState`、`RouteResilienceScope` 与 route guard source 映射 | 新增 management 层 `ChannelRoutingDroppedReason`，从 A1 state 投影出 account/auth/source/scope/reason/model/time | `TestChannelRoutingExplainFilteredIncludesStructuredRouteGuardDroppedReason` |
| explain filtered accounts | `internal/gettokenshooks/channel_routing_explain.go` | 旧 `filtered` 只有 `id/reason`，route guard source 只隐藏在 requestable=false 后 | 保留旧 `reason`，新增 `droppedReasons`，从 in-memory/persisted guard blocks 生成结构化原因 | `TestChannelRoutingExplain*` |
| recent decisions | `sdk/cliproxy/auth/route_diagnostics.go` 与 `internal/gettokenshooks/channel_routing_decisions.go` | snapshot 保留 trace 字符串，但没有 dropped reason DTO | 在 auth 层记录 `RouteDecisionDroppedReasonSnapshot`，从 `account-route-guard` trace 解析 source/reason/scope，再映射到 management JSON | `TestRouteDecisionSnapshotsParseRouteGuardDroppedReasonsFromTrace` 与 `TestConfigureChannelRoutingDecisionRoutesListsRecentSnapshots` |
| model scope | A1 `FailureScope` | explicit model scope 只能作为结构化状态表达，A2 不改变 hard-filter selector 行为 | explain 输出保留 `scope=model`，同 provider 其他可用账号仍作为候选，避免把模型级证据表达成 provider 级故障 | `TestChannelRoutingExplainModelScopedDroppedReasonDoesNotHideProviderCandidates` |

## 实现说明

1. `internal/gettokenshooks/route_resilience.go`
   - 新增 `ChannelRoutingDroppedReason`。
   - 从 `RouteResilienceState` 投影 `accountID/authID/source/scope/reason/model/expiresAt/updatedAt/routeBlocking`。
2. `internal/gettokenshooks/channel_routing_explain.go`
   - `ChannelRoutingExplainFilteredAccount` 保留旧 `reason` 字段。
   - 新增 `droppedReasons`，在 runtime pool 构建阶段按 account 聚合 route guard blocks。
3. `sdk/cliproxy/auth/route_diagnostics.go`
   - 新增 `RouteDecisionDroppedReasonSnapshot`。
   - 从 `account-route-guard` trace 的 `DenyIDs` 和 reason payload 解析 dropped reasons。
   - auth 层不依赖 `internal/gettokenshooks`，避免 import cycle。
4. `internal/gettokenshooks/channel_routing_decisions.go`
   - route decision management response 新增 `droppedReasons`。
   - 映射 auth 层 snapshot 到 explain 共用的 JSON DTO 形状。

## 验证命令

在 `docs-linhay/references/CLIProxyAPI` 下运行：

```bash
go test ./internal/gettokenshooks -run 'TestRouteResilience|TestChannelRoutingExplain|TestChannelRoutingDecisions|TestAccountRouteGuard'
go test ./sdk/cliproxy/auth -run 'TestRouteDecision'
```

在主仓根目录运行：

```bash
git diff --check
```

## 剩余风险

1. recent decisions 只能从 route trace 解析已记录的 guard source；trace 不携带 expiry 时，decision snapshot 不伪造 `expiresAt`。
2. auth 层不能 import gettokenshooks，因此 source-to-scope 映射保留最小本地规则；后续若 provider/model scope source 增多，需要在 auth diagnostics 映射同步补充。
3. A2 未接 probe、Wails DTO 或 frontend workbench；space README 的完整三面一致验收仍需后续阶段补齐。
4. A2 不改变 hard-filter / selector 语义；model-scoped route guard 若未来要按请求模型精确过滤，需要另开 selector 语义变更阶段。
