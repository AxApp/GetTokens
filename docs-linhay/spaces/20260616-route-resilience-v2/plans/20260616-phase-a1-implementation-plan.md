# Route Resilience v2 Phase A1 Implementation Plan

日期：2026-06-16

## Phase A1 边界

本阶段只建立 route resilience 的最小 sidecar-owned 状态骨架，并用 focused tests 锁定 failure scope 映射。A1 不接入 Wails DTO、前端 channel-routing UI，也不实现完整五项能力。

## Evidence Matrix

| 证据项 | 来源 | 当前事实 | A1 结论 | 验收方式 |
|---|---|---|---|---|
| Route Resilience v2 需求 | `docs-linhay/spaces/20260616-route-resilience-v2/README.md` | 目标要求 sidecar-owned state model、account/provider/model 三层 failure scope、decision ledger dropped reasons 一致 | A1 先锁定结构化 state 与 source->scope 映射 | 本计划 + focused Go tests |
| 总架构边界 | `docs-linhay/dev/20260615-omniroute-capability-architecture.md` | Route resilience 定位为 sidecar 主能力；frontend/Wails 只做 explain/probe/operator controls | 首批实现必须落在 CLIProxyAPI sidecar 边界 | 不修改前端 candidate pool 或 selector 脚本 |
| 监督派发边界 | `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260616-subagent-supervision-dispatch-v01.md` | Route Resilience subagent 允许写 `docs-linhay/spaces/20260616-route-resilience-v2/**` 与 `docs-linhay/references/CLIProxyAPI/**` | 本轮优先只改子仓与 space | `git status --short` 对照 |
| Route guard 现状 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_guard.go` | 已有 `manual-disabled`、`rate-limit`、`quota-empty`、`auth-error`、`upstream-rate-limit`、`upstream-error` sources，并在 hard-filter 阶段 deny candidates | sources 已能表达 block 来源，但缺少统一 failure scope/state DTO | 新增只读状态模型，不改变 deny 行为 |
| Runtime state 持久化 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/channel_runtime_state.go` | 持久化 runtimeStates 目前按 accountID + sources 保存 reason/model/expiresAt/updatedAt | 可在 A1 内保留兼容字段，补 scope/state 映射测试 | Go tests 验证持久化 source 仍可恢复为 resilience state |
| Decision ledger 现状 | `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/route_diagnostics.go` 与 `internal/gettokenshooks/channel_routing_decisions.go` | ledger 已保留 candidates、selected auth、trace reason，但 dropped reasons 仍主要是 trace 字符串 | A1 不改 response schema，先建立可复用 state；后续 A2 再接 ledger/explain dropped reasons | 本计划列入下一步，不提前改 DTO |
| Auth selection 现状 | `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/routing_policy.go`、`selector.go` | route policies 在 selector 前过滤候选；model cooldown 属于现有 auth selector 层能力 | A1 不改 selection 语义，避免 route mode 或 affinity 回归 | focused tests 不影响现有 selector tests |

## 当前代码事实位置

- `internal/gettokenshooks/route_guard.go`
  - `AccountRouteGuardBlock` 是当前热路径 guard 状态的最小单元。
  - `accountRouteGuardPolicy` 注册为 P0 `hard-filter`，优先级高于 pool scope、request、sticky 和 selector。
  - `accountRouteGuardBlockForResult` 把 upstream/auth 失败转成 transient guard source。
- `internal/gettokenshooks/channel_runtime_state.go`
  - `persistedChannelAccountRuntimeState` 和 `persistedChannelRuntimeStateSource` 是 runtimeStates 的持久化格式。
  - `manual-disabled` 不持久化；自动 source 会按 account runtime id 持久化。
- `internal/gettokenshooks/channel_routing_explain.go`
  - explain 当前通过 `ActiveBlocksForCandidates` 和 persisted runtimeStates 把 route guard block 纳入 filtered reason。
- `sdk/cliproxy/auth/route_diagnostics.go`
  - route decision snapshot 当前保留 trace、candidate、selected、unavailable code/message。
  - 还没有结构化 dropped reason / failure scope 字段。
- `sdk/cliproxy/auth/routing_policy.go`
  - policy engine 会在 auth selection 前改写候选池，session-affinity 属于 sticky 阶段。

## 失败作用域模型

Phase A1 定义三层 failure scope，但只做结构化表达与 source 映射：

| Scope | 适用 source | 含义 | A1 行为 |
|---|---|---|---|
| `account` | `manual-disabled`、`rate-limit`、`quota-empty`、`auth-error` | 单个账号/credential 不应参与新请求 | 保留现有 route guard deny 行为，补 `RouteResilienceState.Scope=account` |
| `provider` | 保留给 provider-wide outage / transport policy | 某 provider 下多个账号可能同时受影响 | A1 只定义常量和测试空白，不主动生成 provider block |
| `model` | model cooldown / model lockout / capacity | 单模型不可用，不应拖垮整个 provider | A1 只定义常量和构造入口，不改 selector cooldown 行为 |

## 测试清单

Phase A1 必跑：

1. `go test ./internal/gettokenshooks -run 'TestRouteResilience|TestAccountRouteGuard'`
   - 验证 route guard 原有 source 独立性仍成立。
   - 验证新增 resilience state 会从 in-memory guard block 和 persisted runtime state 中保留 scope/source/reason/expiresAt。
2. `go test ./internal/gettokenshooks`
   - 验证 channel routing explain / decision endpoint 相关 focused tests 不回归。
3. `git diff --check`
   - 验证文档与 Go 代码无空白错误。

可选但本轮不默认跑：

- `go test ./...`：子仓全量测试成本较高，Phase A1 未触碰执行器和网络路径，留给主控集成或后续大切片。
- 父仓 Wails/frontend tests：A1 不改主仓 DTO/前端，不纳入本轮门禁。

## 回滚 / 停止条件

满足任一条件即停止扩大实现，只保留计划与红灯测试说明：

1. CLIProxyAPI 子仓出现并行 dirty 冲突，且冲突文件正是 route guard / route decision 热路径。
2. 新增结构化 state 需要改动 public request route mode、request-level debug header 或 selector script 才能验证。
3. 需要让 frontend/Wails 改写 candidate pool 才能表达结果。
4. focused tests 显示现有 route guard 持久化语义与 A1 state model 不兼容，需要先由主控确认 schema 迁移策略。
5. 任何实现会触碰 `/Applications/GetTokens.app`、正式版配置或 production sidecar。

## A1 最小实现切片

1. 在 `internal/gettokenshooks` 新增 `RouteResilienceState`、`RouteResilienceScope` 与 source-to-scope 映射。
2. 给 `AccountRouteGuardBlock` 增加可选 `FailureScope` 字段，由 normalize 阶段补齐默认 scope。
3. 从 active guard blocks 构造只读 resilience state，供后续 explain / probe / decision ledger 统一复用。
4. 补 focused tests，覆盖：
   - `manual-disabled / rate-limit / quota-empty / auth-error / upstream-*` 默认都是 `account` scope。
   - 明确 model scope 不会被 normalize 覆盖。
   - persisted runtime state 恢复时能生成 account-scoped resilience state。

## 后续 A2 候选

- 将 `RouteResilienceState` 接入 `channel_routing_explain.go` filtered reasons。
- 将 dropped reasons 结构化映射进 `RouteDecisionSnapshot`，让 recent decisions 与 explain 使用同一套 state。
- 设计 bounded repair/operator controls：clear transient lockout、rerun bounded reconcile、recheck routeability。
