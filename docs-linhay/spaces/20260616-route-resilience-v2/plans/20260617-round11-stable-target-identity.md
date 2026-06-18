# Round 11: Route Resilience Stable Target Identity

日期：2026-06-17

## 目标

修正第十轮剩余风险：Route Resilience operator surface 的 target 去重 key 不再依赖 dropped reason 的 `reason` 文案，而是收敛到稳定身份；同一 target 下继续保留多条 reason 的聚合展示与命中计数，action history 仍按稳定 target 绑定。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| 当前 target key 含 `reason` | `frontend/src/features/channel-routing/model/channelRouting.ts` 中 `buildRouteResilienceActionTargets` | 同一 account/auth/model/source/scope 只要 reason 文案变化，就会被误判成新 target |
| 当前 target 详情直接展示单条 `reason` | `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx` | UI 会把某次 `reason` 文案误呈现成 target identity 本体 |
| action history 依赖 `target.id` | `frontend/src/features/channel-routing/model/channelRouting.ts` 中 `buildRouteResilienceActionHistoryEntry` / `findLatestRouteResilienceActionHistoryForTarget` | 只要 `target.id` 稳定，历史绑定就能保持 |
| bridge passthrough 已覆盖 `not_implemented` | `frontend/wailsjs/routeResilienceActionBinding.test.mjs` | 本轮只收窄前端 target identity，不改 bridge，不包装 sidecar 原始结果 |

## 范围

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`

## 非目标

1. 不改 Go root / Wails client / generated bindings。
2. 不新增 sidecar 尚未支持的 action 实现。
3. 不把 `not_implemented` / failure 包装成成功。

## BDD 场景

1. 给定同一 account/auth/model/source/scope 在不同 recent decisions 上出现不同 `reason` 文案，前端只生成一个 stable target。
2. 给定同一 stable target 下有多条 reason，workbench 仍能看到聚合后的 reasons 与总命中次数。
3. 给定用户在旧 reason 文案时执行 action，后续 reason 文案变化后重新进入页面，历史仍能按 stable target 命中，而不是丢失。

## 实现摘要

1. `RouteResilienceActionTarget.id` 改为 `accountKey|authId|model|source|scope`，不再拼接 `reason`。
2. `RouteResilienceActionTarget` 新增 `reasons` 与 `reasonSummary`，聚合同一 stable target 下的多条 reason 与计数。
3. target list 的 `detail` 改为 reason 聚合摘要 + 总命中次数；selected target 详情也改为展示聚合后的 `reason(s)`。
4. action history 继续绑定 stable `target.id`；workbench action `idempotencyKey` 也改为优先携带 stable target id，避免 reason 文案变更导致前端身份漂移。

## 验收

1. `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`

## 自动沉淀审计

- 候选模式：前端 target identity 与 UI 文案要解耦，聚合展示可以依赖 reason，身份绑定不能依赖 reason。
- 结论：本轮属于当前 Route Resilience operator surface 的局部收敛，先沉淀在本 space；不提升到 repo-wide AGENTS 规则，也不扩写项目级 skill。
- 限制：按本轮用户约束，只写当前 space，不写 memory。
