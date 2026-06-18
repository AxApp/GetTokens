# Round 13: Route Resilience Evidence Digest Helper

日期：2026-06-17

## 目标

把 `buildRouteResilienceActionTargets()` 内部已经存在的 stable target identity + reason aggregation 抽成只读 helper，收敛为 `buildRouteResilienceEvidenceDigests()` 一类可复用入口，供 account detail 等只读 surface 直接消费，避免再各自复制 `AccountRouteResilienceEvidence` 映射并退回到 reason 文案级 key。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| stable target identity + multiple reason aggregation 已经存在，但只暴露为 action target | `frontend/src/features/channel-routing/model/channelRouting.ts` 的 `buildRouteResilienceActionTargets` | 需要拆出只读 digest helper，避免其他 surface 依赖 action target shape |
| account detail 当前仍自己声明 `AccountRouteResilienceEvidence` 并把 action target 再映射一遍 | `frontend/src/features/accounts/model/accountPresentation.ts` 的 `buildAccountRouteResilienceEvidence` | 应直接消费公共 digest helper，不再维护第二份只读 evidence schema |
| 当前 channel routing 测试只证明 action target 稳定身份与 history 绑定，没有单独锁定只读 digest helper 契约 | `frontend/src/features/channel-routing/tests/channelRouting.test.mjs` | 本轮需新增 helper 级测试，证明 reason 文案变动不影响 stable id，且无 identity 的 dropped reason 不产出 digest |
| 本轮写入面受限在 frontend model/test 与 space 文档 | 用户任务约束 | 不改 Go/Wails/root binding，不触发任何 route resilience action |

## 范围

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `frontend/src/features/accounts/model/accountPresentation.ts`
- `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
- `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 非目标

1. 不改 Go/Wails/root binding。
2. 不调用 `RunRouteResilienceAction`。
3. 不新增 repair mutation，不把 evidence 当 sidecar route truth。
4. 不回退当前工作区其他脏改动。

## BDD 场景

1. 给定同一 `account/auth/model/source/scope` 下 reason 文案变化，digest `id` 保持稳定，reason 仅影响 `reasonSummary` / `detail`。
2. 给定多个 dropped reasons 命中同一 stable target，digest 聚合 `reasonSummary` 与 `occurrenceCount`。
3. 给定 dropped reason 缺少 `accountID` 与 `authID`，不产出 digest。
4. 给定 account detail 展示 recent decisions，只展示当前账号相关 digest，不混入其他账号 evidence。

## 验收

1. `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs`
2. 如涉及 TS 类型：`npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`

## 自动沉淀审计

- 候选模式：route resilience 只读 surface 统一复用 evidence digest helper；action target 继续保留给 operator controls，避免 detail/doctor surface 回退到文案 key。
- 结论：仍属于 Route Resilience v2 领域内的局部模式，先沉淀到本 space README 与本轮计划，不提升到 repo-wide AGENTS 或新 skill。
