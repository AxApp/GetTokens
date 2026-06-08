# 第 11 轮：Usage Desk 运营分面与数据源文案计划

## 状态

- 日期：2026-06-08
- 环境：dev / 本仓
- 原则：候选进入修复前必须有确凿证据；本轮不做真实桌面手点，因不涉及 native/Wails runtime 行为。

## Evidence Matrix

| 候选 | 问题来源 | 当前代码/UI 事实 | 观察到的症状或缺失证明 | 预期验收路径 | 可推翻证据 |
| --- | --- | --- | --- | --- | --- |
| `P7` Usage Desk 缺少 provider/account/model 分面 | `experience-product-operator.md` 第 7 条；`unfixed-backlog.md` 当前建议修复顺序第 1 项 | `frontend/src/features/accounts/model/usageDesk.ts` 的 `UsageDeskObservedDetail` 已有 `provider/model/accountKey`；`UsageDeskProjectedDetail` 已有 `provider/model/sessionID/projectName`；`UsageDeskFeature.tsx` 当前只有 range/resolution/source/view controls，没有 provider/account/model facet。 | 运营用户能看到聚合趋势，但不能直接按 provider、账号/本地项目、model 缩小当前图表和明细。 | 新增纯模型 facet selector/filter 测试；Observed 来源支持 provider/account/model 三组 facet；Projected 来源支持 provider/project/model 三组 facet；点击 facet 后图表、明细和状态文案反映当前过滤。 | 若源码中已存在可点击 provider/account/model facet 且能过滤当前图表/表格，则本候选不进入实现。 |
| `P6` Usage Desk 数据源文案偏研发 | `experience-product-operator.md` 第 6 条；`unfixed-backlog.md` 当前建议与 P7 合并处理 | `UsageDeskFeature.tsx` header source 按钮为 `真实请求量` / `本地投影用量`，页面描述为 `ObservedRequestUsage` / `LocalProjectedUsage`。 | 文案混合内部实现名与泛称，用户难以判断一个来源来自 sidecar 运行时归因，另一个来源来自本地只读 session 文件投影。 | source 按钮与描述改为明确真源：`Sidecar 归因`、`本地文件投影`；Projected loading/error 文案沿用来源边界，不暗示会修改本地原始 session 文件。 | 若已有 UI 文案清楚展示 sidecar attribution 与 local file projection 边界，则本候选不进入实现。 |

## 本轮范围

1. 只改 Usage Desk 前端模型、hook 和页面控制区。
2. 不改 sidecar attribution 接口，不新增 backend DTO。
3. 不新增账号详情跳转或跨页深链；facet 先作为当前页面内过滤器。

## 验收计划

```bash
cd frontend && node --test src/features/accounts/tests/usageDesk.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
git diff --check
```

说明：本轮不触碰 native/Wails runtime、菜单栏、窗口生命周期或 Wails binding 可见性，因此不做真实 dev App 手点。
