# Route Resilience v2 Phase A4 Probe Structured Reasons Plan

日期：2026-06-16

## 范围

Phase A4 只推进 probe / dry-run diagnostics 对 structured `droppedReasons` 的消费与输出。目标是让 `explain`、`recent decisions`、`probe` 三个诊断面共享同一套 sidecar-owned dropped reason structure。

本阶段不实现 operator mutate controls；只把后续 controls 的 API 边界记录清楚。

## Evidence Matrix

| 证据项 | 当前事实 | A4 处理 | 验收方式 |
|---|---|---|---|
| README 验收 | `explain / probe / recent decisions` 三处应看到一致 dropped reasons | A4 补 probe / dry-run diagnostics，不改 recent decisions A3 透传 | sidecar focused tests |
| A2 sidecar structured reasons | `channel_routing_explain.go` 与 `channel_routing_decisions.go` 已输出 `DroppedReasons` | probe 复用同一 reason builder / runtime state，不从 trace 字符串反推 | test 断言 reason `source/scope/model/routeBlocking` |
| model-level isolation | `RouteResilienceState` 支持 account/provider/model scope | probe 输出 model block 时不能扩大成 provider/account block | test 覆盖同账号同 provider 下其他 model 不被标记 blocking |
| sidecar authority | route truth 属于 CLIProxyAPI sidecar | Wails/frontend 仍只透传，不参与 A4 | 本阶段不改主仓 frontend/Wails |

## BDD Scenarios

1. Given account `acct-a` has a transient model-level lockout for `gpt-5`
   When route diagnostics probe runs for `provider=codex, model=gpt-5`
   Then probe response includes one `droppedReasons[]` item with `scope=model`, `model=gpt-5`, `routeBlocking=true`.

2. Given the same account has no lockout for `gpt-5-mini`
   When route diagnostics probe runs for `provider=codex, model=gpt-5-mini`
   Then the model-level `gpt-5` reason is not promoted to account/provider scope.

3. Given probe runs in dry-run mode
   When no candidate is selected
   Then diagnostics may report dropped reasons, but must not mutate route guard, session affinity, candidate pool, or quota state.

## Candidate Write Set

Expected implementation remains inside CLIProxyAPI reference:

- `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/*`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/*`

Do not modify:

- main repo Wails/root DTO
- frontend channel-routing UI
- account / quota runtime state

## Focused Test Plan

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./internal/gettokenshooks -run 'TestRouteResilience|TestChannelRoutingExplain|TestChannelRoutingDecisions|TestRoute.*Probe|Test.*Diagnostics'
go test ./sdk/cliproxy/auth -run 'TestRouteDecision|Test.*Probe|Test.*Diagnostics'
git diff --check
```

If no existing probe test hook exists, add the narrowest package-level test around the current route diagnostics/probe builder instead of introducing a new public management API.

## 2026-06-16 A4 Worker Result

### Evidence Update

- `docs-linhay/references/CLIProxyAPI` 当前没有独立的 route probe builder 或 probe management endpoint；全仓检索只发现 channel-routing explain、recent route diagnostics ledger，以及无关的 quota/account migration dry-run。
- 因此本轮没有硬造新的 probe API。A4 实现收敛到现有 dry-run/explain 与 route guard hard-filter 共用的 structured dropped reason builder：`ChannelRoutingExplainFilteredAccount.droppedReasons` 继续来自 `channelRoutingDroppedReasonsFromBlocks`。
- 新增 model-scope gate：`scope=model` 且 block model 与 requested model 不一致时，不参与本次 hard-filter/dry-run dropped reason；account/provider scope 仍照常 blocking。
- Auth route diagnostics 侧新增 package-level 覆盖，确认 `model-unavailable` source 会落为 structured `scope=model`，不会退化成 account/provider scope。

### Acceptance Result

- 已覆盖 BDD 1：`requestedModel=gpt-5` 命中 model-level block 时，dry-run/explain filtered item 输出 `scope=model`、`model=gpt-5`、`routeBlocking=true`。
- 已覆盖 BDD 2：同一账号仅有 `gpt-5` model-level block 时，`requestedModel=gpt-5-mini` 不再被该 reason 过滤，也不输出 dropped reason。
- 已覆盖 BDD 3 的非 mutate 部分：本轮只复用 explain/dry-run 与 route guard block 读取路径，没有新增 mutate API，也没有写 session affinity、quota state 或 operator controls。

### Validation

```bash
cd docs-linhay/references/CLIProxyAPI
go test ./internal/gettokenshooks -run 'TestRouteResilience|TestChannelRoutingExplain|TestChannelRoutingDecisions|TestRoute.*Probe|Test.*Diagnostics'
go test ./sdk/cliproxy/auth -run 'TestRouteDecision|Test.*Probe|Test.*Diagnostics'
```

两条 focused suites 均通过。

### Remaining Gap

- 真正的 route probe endpoint/builder 仍不存在；A4 只能证明当前 dry-run/explain diagnostics 与 route guard hard-filter 复用 structured dropped reasons。后续若新增真实 probe，应直接复用同一 model-scope filter 与 `ChannelRoutingDroppedReason` DTO，不要从 trace 字符串二次推导。

## Operator Controls Backlog

A later bounded operator-controls slice should design three explicit actions:

1. `clear_transient_lockout`
2. `rerun_bounded_reconcile`
3. `recheck_routeability`

Each action must be sidecar-owned, audit-visible, scoped by account/provider/model where possible, and unavailable to protocol bridge adapters unless a separate scoped permission is granted.

## 不做项

1. 不在 frontend 解析 trace 字符串生成 dropped reasons。
2. 不新增无权限 mutate API。
3. 不让 dry-run probe 写 session affinity、route guard 或 quota state。
4. 不把 model-level lockout 扩大为 provider/account-level block。
