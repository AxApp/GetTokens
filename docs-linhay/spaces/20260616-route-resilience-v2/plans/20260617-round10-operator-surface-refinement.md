# Round 10: Route Resilience Operator Surface Refinement

日期：2026-06-17

## 目标

在 `channel-routing` 的 Route Resilience UI/model 上继续收窄 operator surface：

1. 不再只基于“最近第一条 dropped reason”推导 action target。
2. 引入更明确的 action target/result/history view model，或至少提供可选择的 target list。
3. action response 只能复用 sidecar 原始返回，不在 frontend/Wails 伪造 `not_implemented`、失败成功化或 reconcile/recheck 假结果。

## 本轮证据门禁

| 证据项 | 当前事实位置 | 结论 |
| --- | --- | --- |
| 当前前端只挑一个 target | `frontend/src/features/channel-routing/model/channelRouting.ts` 中 `buildRouteResilienceActionTarget` | 现状会把 operator surface 绑定到最近第一条带 identity 的 dropped reason |
| 当前 UI 只有一份 action result | `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx` 中 `routeActionResult` | 切换目标后无法稳定复用之前 action response |
| 当前测试也固化了“first dropped reason wins” | `frontend/src/features/channel-routing/tests/channelRouting.test.mjs` | 需要先改测试红灯，再改 model/UI |
| Go/Wails bridge 已经能透传 `not_implemented` | `frontend/wailsjs/routeResilienceActionBinding.test.mjs` 与现有 Wails bindings | 本轮不得改 bridge，只消费既有 sidecar response |

## 范围

- `frontend/src/features/channel-routing/model/channelRouting.ts`
- `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
- `frontend/src/features/channel-routing/tests/channelRouting.test.mjs`

## 非目标

1. 不改 Go root / Wails client / generated bindings。
2. 不补 sidecar 尚未支持的 `rerun_bounded_reconcile` / `recheck_routeability` 真实现。
3. 不把 route truth 挪到 frontend，不重建 sidecar authority。

## BDD 场景

1. 给定 recent decisions 含多条可定位 dropped reason，当 workbench 渲染 Route Resilience 时，operator 能看到可选 target 列表，而不是只拿第一条。
2. 给定用户在 target A 上执行 action 后切到 target B，再切回 target A 时，A 的最近 action response 仍可复用，不会被 B 覆盖。
3. 给定 sidecar 返回 `not_implemented` 或失败结果时，UI/history 只展示 sidecar 原始结果语义，不把它包装成成功。

## 验收

1. model tests 能证明 target list 不再退化为单一 first-hit target。
2. action history 绑定 target，可稳定回看最近 sidecar response。
3. `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`
4. `npm --prefix frontend run typecheck`
5. `docs-linhay/scripts/check-docs.sh`
6. `git diff --check`
