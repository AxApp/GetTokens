# Round 16: Account Detail Route Evidence Digest Dedupe

日期：2026-06-17

## 目标

在不改变 `最近真实路由` per-decision 列表、不新增 action mutation、不改 sidecar truth 的前提下，压缩账户详情 `运行态路由 -> 最近真实路由 -> Route Resilience Evidence` 的重复 metadata 展示。对于同一 stable target digest，只保留一次完整 recency metadata 展示；后续 decision 卡片仅保留引用与追溯信息，避免 `Latest Evidence / First Seen / Last Seen` 在同一详情页重复多次出现。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| 详情页每个 decision 卡片都会直接渲染 `routeResilienceEvidence` | `frontend/src/features/accounts/components/AccountDetailSections.tsx` | 同一 digest 命中多个 decision 时，完整 metadata 会在多个卡片下重复出现 |
| 详情页当前为每个 decision 回填同一个共享 digest 对象 | `frontend/src/features/accounts/model/accountPresentation.ts` | 重复不是 sidecar 重复，而是 UI 对同一 digest 的重复渲染 |
| digest 已具备 latest/first/last metadata，但没有“相关 decision 列表”或“首次/引用展示模式” | `frontend/src/features/channel-routing/model/channelRouting.ts`、`frontend/src/features/accounts/model/accountPresentation.ts` | 可以在 accounts presentation 层追加只读展示态，不需要改 sidecar truth 或 channel-routing helper 契约 |
| 共享 digest 的 `routeBlocking` 是聚合布尔值 | `frontend/src/features/channel-routing/model/channelRouting.ts` 的 `buildRouteResilienceEvidenceDigestsFromDroppedReasons()` | account detail 若直接复用聚合布尔值，会把当前 decision 的 observe/blocking 差异压平；需要在 presentation 层补 per-decision explainability，而不是修改 helper truth |
| 用户限制为只读压缩展示 | 当前任务约束 | 只能在 accounts model/UI/tests 与 route space 文档内完成，不得改 Doctor/Status/Extension/Protocol、dispatch、memory、AGENTS |

## 范围

- `frontend/src/features/accounts/model/accountPresentation.ts`
- `frontend/src/features/accounts/components/AccountDetailSections.tsx`
- `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
- `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 非目标

1. 不修改 `buildRouteResilienceEvidenceDigests()` 的 sidecar-derived digest truth。
2. 不改 per-decision recent route list 的排序、数量、命中/候选语义。
3. 不新增 route resilience action、doctor/detail mutation 或补偿性后端字段。
4. 不清理本轮范围外的工作树改动。

## BDD 场景

1. 给定同一 stable target 在多个 recent decisions 中命中，详情页只在第一条出现处展示完整 digest metadata。
2. 给定后续 decision 仍命中同一 stable target，详情页保留该 decision 的引用信息，但不再重复展示 `Latest Evidence / First Seen / Last Seen`。
3. 给定同一 stable target 的共享 digest，第一次完整展示必须能回溯所有 relevant decisions 与 recordedAt。
4. 给定单个 decision 独有的 digest，详情页仍保持完整 evidence 展示，不额外降级为引用模式。
5. 给定同一 digest 覆盖 blocking 与 observe 两类 decision，详情页必须保留当前 decision 的 blocking/observe 状态与共享 digest 的覆盖计数，不能把非阻塞 decision 静默渲染成 blocking。

## 验收

1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check -- frontend/src/features/accounts/model/accountPresentation.ts frontend/src/features/accounts/components/AccountDetailSections.tsx frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs docs-linhay/spaces/20260616-route-resilience-v2/README.md docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round16-account-detail-route-evidence-digest-dedupe.md`

## 自动沉淀审计

- 候选模式：当 account detail 复用共享 route resilience digest 时，重复压缩应优先在 presentation 层通过“首次完整展示 + 后续引用”完成；若 digest 自身只有聚合布尔值，还要额外保留 per-decision blocking/observe explainability，而不是改动 digest truth 或回退到单 decision 局部 metadata。
- 结论：这是 `route resilience v2` 的局部展示收敛，落当前 space README 与 round16 plan；不升级到 repo-wide 规则，也不写 memory。
