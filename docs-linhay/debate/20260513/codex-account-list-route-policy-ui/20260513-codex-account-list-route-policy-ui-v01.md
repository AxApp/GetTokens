# Codex 账号列表路由策略 UI 协作评审

## 辩论背景

- 时间：2026-05-13
- 主题：`CodexAccountListFeature` 路由策略调试区 UI / 交互重构
- 触发原因：用户指出账号列表页面中路由策略区域 UI 和交互体验差，要求 Gemini 参与方案，Codex 负责执行。
- 相关代码：
  - `frontend/src/features/codex/CodexAccountListFeature.tsx`
  - `frontend/src/features/codex/model/codexAccountList.ts`
  - `frontend/src/features/codex/codexAccountList.test.mjs`

## 参与者观点

### Gemini

论点：当前策略区是“表单堆砌”，不符合工作台流程。

代码事实：
- 原实现把允许账号、排除账号、策略顺序拆成多列重复账号选择，用户需要在多块区域里反复定位同一个账号。
- 测试结果独立插入策略与账号列表之间，切断“配置 -> 运行 -> 观察”的路径。

结论：
- 应改成“控制台 + 实时预览列表”。
- 策略编辑器默认折叠。
- 不再三列重复账号，改为一份账号清单，每行选择 `default / allow / deny` 并调整顺序。
- 测试结果合并到 summary。
- 账号列表行展示策略 rank、mode、命中状态。

### Codex

论点：策略 UI 的信息架构应服务真实路由调试，而不是把 sidecar header 入参直接摊成表单。

代码事实：
- `buildCodexRoutePolicyPreview` / `buildCodexRoutePolicyRowStates` 将允许、排除、顺序、fallback 合成最终候选顺序与行状态。
- `RoutePolicyConsoleSummary` 汇总候选顺序、最近命中和策略指标。
- `RoutePolicyEditor` 使用单一账号清单承载模式选择和顺序移动。
- `AccountOrderRow` 展示 `路由 NN / 跳过` 与策略模式，命中账号继续高亮。

结论：
- 保留客户端对 allow/deny/order/fallback 的完全控制粒度。
- UI 不暴露 sidecar auth hash，继续使用用户可理解的账号 row id。
- 列表仍按保存的账号顺序展示，策略候选顺序放在 summary 中，避免临时策略与持久排序语义混淆。

## 二轮评审

Gemini 二轮评审结论：可以交付。

补充建议：
- `RoutePolicyMetric` 数字加强 Swiss-industrial 风格。
- 策略编辑器行切换状态增加过渡反馈。
- `ModelCombobox` input 增加可访问性标签。

执行结果：
- 已将 metric 数字调整为 `italic + tracking-tighter`。
- 已为策略编辑器行增加 `transition-all duration-150`。
- 已为 `ModelCombobox` input 补充 `aria-label`。

## 结论与行动项

结论：
- 采用 Gemini 的“控制台 + 单一策略清单 + 列表行状态预览”方案。
- 本轮 UI 可以交付。

已完成行动项：
- 前端路由策略区域重构。
- 纯函数模型与单元测试补齐。
- Chrome DevTools 验证默认收起、展开编辑、排除账号、候选顺序同步、真实测试按钮、控制台无新增 error/warning。
- 截图归档：`docs-linhay/spaces/20260511-codex-account-list-tab/screenshots/20260513/codex/20260513-codex-account-list-route-policy-redesign-after-v03.png`

后续行动项：
- 如果后续要把“高延迟短期跳过”产品化，可复用本次 `RoutePolicyDraft` 作为页面 overlay 的输入模型，再接入延迟阈值和冷却窗口。
