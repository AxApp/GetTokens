# Round 17: Account Detail Per-Reason Blocking Detail

## 证据门禁

- 问题来源：Round 16 digest-level dedupe 已保留 stable digest、reference/full 展示、`matchedRouteBlocking` 与 `Digest Coverage`，但同一 decision 内同一 stable digest 可能同时包含 blocking 与 observe dropped reasons。
- 当前事实位置：
  - presentation：`frontend/src/features/accounts/model/accountPresentation.ts`
  - 详情展示：`frontend/src/features/accounts/components/AccountDetailSections.tsx`
  - 回归测试：`frontend/src/features/accounts/tests/accountPresentation.test.mjs`、`frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- 当前缺口：digest 聚合布尔值能说明 digest 或当前 decision 是否有 blocking，但不能逐条说明同一 decision 内每条 reason 是 `BLOCKING` 还是 `OBSERVE`。
- 预期验收：同一 decision 同一 stable digest 下，presentation 保留每条 dropped reason 的 blocking/observe 状态；账户详情 full/reference evidence 都展示 `Reason Details`、`BLOCKING`、`OBSERVE`，且 stable digest id 不包含 reason 文案。
- 反证条件：若 reason 文案进入 digest id、UI evidence 写回 sidecar truth、或 reference 卡用共享 digest 聚合状态冒充当前 decision 状态，则本轮不通过。

## 范围

- 只改 account detail route resilience evidence 的 presentation 和只读展示。
- 新增 `matchedReasonDetails`，它只由当前 decision 的 `droppedReasons` 派生，按既有 stable digest identity 归组。
- 不改 `buildRouteResilienceEvidenceDigests()` 的 shared digest truth。
- 不新增 operator action，不新增 mutation，不把 UI evidence 当 sidecar truth。
- 不回退到 reason 文案级 target key；stable digest id 继续是 `account/auth/model/source/scope`。

## 实现记录

- `accountPresentation.ts` 新增 per-reason detail DTO，并在 account detail recent decision summary 中为每个 evidence 填充当前 decision 的 reason 明细。
- `AccountDetailSections.tsx` 在 route resilience evidence marker 内新增 `Reason Details` 块，用 per-reason badge 展示 `BLOCKING` / `OBSERVE`。
- `accountPresentation.test.mjs` 覆盖同一 decision 同一 digest 内 mixed blocking/observe reason、reference evidence 的 current-decision reason 状态，以及 stable digest id 不含 reason 文案。
- `accountDetailLayout.test.mjs` 锁定 `Reason Details`、`BLOCKING` / `OBSERVE` 与 `data-account-runtime-route-reason-detail` marker。

## 验证

- `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- 待收尾运行：
  - `npm --prefix frontend run typecheck`
  - `docs-linhay/scripts/check-docs.sh`
  - `git diff --check -- frontend/src/features/accounts/model/accountPresentation.ts frontend/src/features/accounts/components/AccountDetailSections.tsx frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs docs-linhay/spaces/20260616-route-resilience-v2/README.md docs-linhay/spaces/20260616-route-resilience-v2/plans/20260617-round17-account-detail-per-reason-blocking-detail.md`

## 剩余风险

- 本轮只覆盖 account detail presentation；doctor/detail 相关只读 surfaces 还没有复用 per-reason current-decision 明细。
- `rerun_bounded_reconcile` / `recheck_routeability` 仍是 sidecar hook 权限未完成项；本轮不伪造 action 成功。
- 若未来 sidecar dropped reason 增加新的 identity 维度，需要先扩展 shared digest helper，再同步 presentation 匹配逻辑，不能只在 UI 层拼 reason 文案。
