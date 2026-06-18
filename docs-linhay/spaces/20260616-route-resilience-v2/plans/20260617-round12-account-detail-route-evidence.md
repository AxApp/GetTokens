# Round 12: Account Detail Route Resilience Evidence Reuse

日期：2026-06-17

## 目标

把第十一轮已经落地的 stable target identity + reason aggregation 证据，复用到账户详情 `运行态路由 -> 最近真实路由` 列表中，作为只读 operator evidence 展示；不触发 action，不新增 mutation，不把这层 UI 包装成 sidecar route truth。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| channel-routing 已有 stable target identity 与 reason aggregation | `frontend/src/features/channel-routing/model/channelRouting.ts` 的 `buildRouteResilienceActionTargets` | 账号维度 detail surface 不应再自己用 `reason` 文案拼 identity |
| account detail recent route decisions 目前只显示 summary/detail | `frontend/src/features/accounts/model/accountPresentation.ts` 的 `buildAccountRecentRouteDecisionSummaries` | droppedReasons 证据尚未复用到 account detail |
| account detail runtime route section 目前没有 evidence marker | `frontend/src/features/accounts/components/AccountDetailSections.tsx` 的 `AccountRuntimeRouteSection` | UI 无法让 operator 看见 stable target / reason aggregation / routeBlocking / source/scope/model |
| 本轮写入面只限 accounts frontend 与 space 文档 | 用户任务约束 | 不改 Wails/root/Go binding，不新增 doctor/detail mutation |

## 范围

- `frontend/src/features/accounts/model/accountPresentation.ts`
- `frontend/src/features/accounts/components/AccountDetailSections.tsx`
- `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
- `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- `docs-linhay/spaces/20260616-route-resilience-v2/README.md`

## 非目标

1. 不调用 `RunRouteResilienceAction`。
2. 不新增 route resilience action result / history mutation。
3. 不把 `not_implemented` / failure 伪装成成功。
4. 不把 account detail evidence 升格成 sidecar route truth；仅展示 recent decisions 自带 droppedReasons 的只读证据。

## BDD 场景

1. 给定同一 account/auth/model/source/scope 在同一 recent decision 下有多条不同 `reason`，account detail 只展示一个 stable evidence marker，并聚合 `reasonSummary`。
2. 给定 `reason` 文案变化但 stable target identity 不变，account detail evidence 的 `id` 保持不变，`reason` 不参与 stable id。
3. 给定 recent decision 没有当前账号对应的 `droppedReasons`，account detail 继续展示现有 route decision summary，不额外插入 evidence marker。

## 验收

1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. 如涉及 TS 类型：`npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`

## 自动沉淀审计

- 候选模式：detail/doctor 等只读 surface 复用 route resilience stable target evidence 时，必须从 recent decisions 的 droppedReasons 派生，只读展示，不触发 action。
- 结论：目前仍属于 Route Resilience v2 空间内的局部收敛，先沉淀在本 space，不提升到 repo-wide AGENTS 或新 skill。
