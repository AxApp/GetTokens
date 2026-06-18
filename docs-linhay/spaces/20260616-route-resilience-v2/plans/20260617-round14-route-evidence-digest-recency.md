# Round 14: Route Resilience Digest Recency Metadata

日期：2026-06-17

## 目标

在不改变 stable target identity（`account/auth/model/source/scope`）语义的前提下，把 `buildRouteResilienceEvidenceDigests()` 从“只聚合 reason 文案”推进到“聚合后仍保留最新证据上下文”的只读 digest：同一 target 下 reason 文案可以变化但不分裂 target，detail / doctor 等复用方仍能知道最近一次证据来自哪个 decision、哪个 `recordedAt`，以及该 target 首次/最近出现的时间边界。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| digest 当前只保留首次命中的 `decisionID` / `recordedAt` | `frontend/src/features/channel-routing/model/channelRouting.ts` 的 `buildRouteResilienceEvidenceDigests()` | 同一 stable target 后续出现新的 dropped reason 或新的 recordedAt 时，UI 无法知道最新证据来自哪次 decision |
| stable target identity 已在第十一轮锁定，不允许重新引入 `reason` 作为 id 组成部分 | `docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round11-stable-target-identity.md` | 本轮只能补 recency metadata，不能改 `id` 语义 |
| account detail 当前消费 digest，但仍会继承“首条 decision 元数据” | `frontend/src/features/accounts/model/accountPresentation.ts` 的 `buildAccountRouteResilienceEvidence()` | 需要确保 account/detail 后续拿到的是 recency-aware digest，而不是旧 decision 指针 |
| 用户明确限制不能新增 repair mutation、不能改 sidecar/action contract、不能把 UI digest 当 sidecar truth | 本轮任务约束 | 仅改 frontend model/tests 与本 space 文档，不改 Go/Wails/sidecar contract |

## 范围

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- `frontend/src/features/accounts/model/accountPresentation.ts`
- `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
- `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 非目标

1. 不改变 stable target id 的组成字段，也不把 `reason` 放回 identity。
2. 不新增任何 route resilience repair mutation。
3. 不改 sidecar / Wails action contract，不包装 sidecar truth。
4. 不碰 dispatch 总控文档、memory、AGENTS 或其他 `space`。
5. 不清理当前工作树中与本轮无关的脏改动。

## BDD 场景

1. 给定同一 `account/auth/model/source/scope` 在不同 recent decisions 上出现不同 reason 文案，digest `id` 保持稳定，但最新 evidence metadata 指向最近一次 decision。
2. 给定同一 stable target 被多次命中，digest 同时保留首次观测与最近观测边界，供 detail / doctor 复用。
3. 给定单个 recent decision 内同一 target 出现多条 reason，digest 继续聚合 `reasonSummary` 与 `occurrenceCount`，但不会丢失最近观测 decision。
4. 给定 account detail 只读展示 route resilience evidence，返回的 evidence 继承 recency-aware metadata，而不是首条 decision 元数据。

## 验收

1. `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check -- frontend/src/features/channel-routing/model/channelRouting.ts frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/model/accountPresentation.ts frontend/src/features/accounts/tests/accountPresentation.test.mjs docs-linhay/spaces/20260616-route-resilience-v2/README.md docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round14-route-evidence-digest-recency.md`

## 自动沉淀审计

- 候选模式：Route Resilience digest 作为只读 evidence helper 时，identity 必须稳定，recency metadata 必须随最新 decision 更新，不能把 UI 聚合结果误当成 sidecar 真值。
- 结论：仍属于当前 `route resilience v2` 领域内的局部收敛，本轮只沉淀到该 `space` README 与 plan，不升级到 repo-wide 规则，也不写 memory。
