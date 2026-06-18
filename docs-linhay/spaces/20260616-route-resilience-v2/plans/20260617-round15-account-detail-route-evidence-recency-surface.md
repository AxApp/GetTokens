# Round 15: Account Detail Route Evidence Recency Surface

日期：2026-06-17

## 目标

在不新增 action mutation、不改 sidecar truth、也不触碰 Doctor/Quota/Extension/Protocol 的前提下，把第十四轮 digest 已有的 recency metadata 显式展示到账户详情 `运行态路由 -> 最近真实路由 -> Route Resilience Evidence`，并确保详情页消费的是 digest 结果而不是按单条 decision 各算各的临时元数据。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| digest 已输出 `decisionID` / `recordedAt`（latest）与 `firstObserved*` / `lastObserved*` | `frontend/src/features/channel-routing/model/channelRouting.ts` | recency truth 已存在于公共只读 helper，无需新增 sidecar 或 action contract |
| account detail 现状仍按单条 decision 调 `buildRouteResilienceEvidenceDigests([decision], ...)` | `frontend/src/features/accounts/model/accountPresentation.ts` | 即使 helper 支持跨 decision 汇总，详情 evidence 也只会看到当前 decision 的局部结果，无法显式继承 first/last observed 边界 |
| 账户详情 Route Resilience Evidence UI 仅展示 stable target / reason / routeBlocking / source-scope-model | `frontend/src/features/accounts/components/AccountDetailSections.tsx` | latest decision/recordedAt、first seen、last seen 尚未暴露 |
| 本轮用户限制为只读 metadata surface | 当前任务约束 | 只能改 accounts frontend model/UI/tests 与 route space 文档，不能引入 mutation、doctor 兼容层或 sidecar truth 包装 |

## 范围

- `frontend/src/features/accounts/model/accountPresentation.ts`
- `frontend/src/features/accounts/components/AccountDetailSections.tsx`
- `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
- `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`（仅回归，不必改实现）
- `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 非目标

1. 不新增任何 route resilience repair/recheck mutation。
2. 不修改 `RouteResilienceEvidenceDigest` 的 stable target identity 组成字段。
3. 不改 Doctor、Quota、Extension、Protocol 相关文件。
4. 不改 dispatch/memory/AGENTS，也不清理与本轮无关的工作树脏改动。
5. 不把账户详情 UI 聚合结果伪装成 sidecar 新真值。

## BDD 场景

1. 给定同一 stable target 在两个 recent decisions 中出现且 reason 文案变化，账户详情两条 decision 下的 evidence 仍共享同一个 digest `id`。
2. 给定上述场景，详情 evidence 暴露的 `decisionID` / `recordedAt` 指向 latest evidence，而 `firstObserved*` / `lastObserved*` 保留完整边界。
3. 给定 route resilience evidence UI，详情面板显式展示 `Latest Evidence`、`First Seen`、`Last Seen` 只读标签。
4. 给定同一 stable target 的 reason 文案变化，详情 target identity 仍不受 `reason` 文案影响。

## 验收

1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check -- frontend/src/features/accounts/model/accountPresentation.ts frontend/src/features/accounts/components/AccountDetailSections.tsx frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs docs-linhay/spaces/20260616-route-resilience-v2/README.md docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round15-account-detail-route-evidence-recency-surface.md`

## 自动沉淀审计

- 候选模式：账户详情若复用 route resilience digest，必须先按账户 recent decisions 构建共享 digest，再按 decision 命中的 stable target 回填，不能退回到“单 decision digest + 当前卡片局部 metadata”的旧行为。
- 结论：仍属于 `route resilience v2` 领域内的局部流程收敛，本轮只写入当前 `space` README 与 round15 plan，不升级到 repo-wide 规则，也不写 memory。
