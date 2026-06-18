# Round 14 Route Evidence Digest Reuse

日期：2026-06-17

## 背景

- 问题来源：OmniRoute 第十四轮 Doctor Workbench 切片，要求 Doctor route evidence 尽量复用 Route Resilience 的 digest/helper 语义，避免 Doctor 自维护一套独立 stable identity/summary。
- 关联实现：
  - `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`
  - `frontend/src/features/channel-routing/model/channelRouting.ts`

## 当前事实

- Doctor 第十二轮已能从 `label/refID/summary/source` 文本里提取 route evidence 字段，并在前端按 stable target 聚合。
- 但当前聚合逻辑仍留在 Doctor 自己的 model 内部，包含：
  - target key 组装；
  - reason 合并；
  - source label 格式化；
  - route blocking label。
- Route Resilience 已有 `buildRouteResilienceEvidenceDigests()` 等 helper，在 route/account detail 场景下使用固定 identity 语义：`accountKey|authId|model|source|scope`。
- 风险边界：
  - 只读，不新增 repair mutation。
  - 不改 accounts/status/extension/protocol/dispatch/memory/AGENTS。
  - partial identity 继续 fallback，不能从 Doctor UI 文本编造 route truth。

## 本轮目标

1. Doctor route evidence 尽量复用 Route Resilience 现有 digest/helper 语义，或抽出窄 adapter。
2. 对同一 dropped reason target，Doctor 的 `targetKey`、reason summary、source label 与 route/account detail 保持一致。
3. reason 文案变化不让 Doctor target 分裂；partial identity 仍维持普通 evidence fallback。
4. 结构化 route evidence UI markers 保持可用，不回退到非结构化展示。

## BDD / 红灯场景

1. Given 两条 Doctor route evidence 指向同一 `account/auth/model/source/scope`，但 reason 文案不同
   When Doctor 派生 evidence view
   Then 仍只生成一个 structured target，并按共享 digest 语义聚合 reason。

2. Given Doctor route evidence 只有 partial identity
   When Doctor 派生 evidence view
   Then 保持通用 fallback，不生成 `targetKey/account/auth/model/scope`。

3. Given Doctor feature 渲染 structured route evidence
   When 代码读取 evidence view
   Then `data-doctor-route-evidence-*` markers 仍存在。

## 实现边界

- 允许修改：
  - `frontend/src/features/doctor-workbench/**`
  - `frontend/src/features/channel-routing/model/channelRouting.ts` 中为 Doctor 复用所需的纯 helper / 导出类型小调整
  - Doctor tests
  - 本 space README / 本计划文件
- 不修改：
  - repair action / mutate API
  - accounts/status/extension/protocol 文件
  - dispatch / memory / AGENTS

## 验收

1. `node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`
2. 若触碰 route helper：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
3. `npm --prefix frontend run typecheck`
4. `docs-linhay/scripts/check-docs.sh`
5. `git diff --check`

## 沉淀审计

- 当前模式仍属于已有 channel-routing/doctor 共享纯 helper 复用，不形成新的 repo-wide 规则。
- 因此本轮默认只写回 space 文档，不更新 memory / AGENTS / skills；收尾时若出现新的稳定复用口，再重新判断是否升级沉淀层级。
