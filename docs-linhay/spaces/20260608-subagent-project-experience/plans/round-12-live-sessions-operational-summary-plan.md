# 下期需求：Live Sessions 运营摘要

## 状态

- 日期：2026-06-08
- 环境：dev / 本仓
- 状态：下期需求草案，已完成证据复核，未进入正式实现。
- 原则：候选进入修复前必须有确凿证据；本轮不涉及 native/Wails runtime，默认使用自动化测试与无头浏览器/DOM 验收。
- 整理结论：会话中曾做过一版前端原型并通过 focused tests / typecheck / build / 浏览器 DOM 探测，但用户要求整理会话后，原型代码已撤回，不作为本轮交付。后续实现需重新从本文证据矩阵进入 BDD/TDD。

## Evidence Matrix

| 候选 | 问题来源 | 当前代码/UI 事实 | 观察到的症状或缺失证明 | 预期验收路径 | 可推翻证据 |
| --- | --- | --- | --- | --- | --- |
| `P11` Live Sessions 项目/会话切换入口偏窄，缺少运营摘要 | `experience-product-operator.md` 第 11 条；`unfixed-backlog.md` 当前建议修复顺序第 1 项；第 10 轮已补历史窗口和未闭合语义，剩余为入口摘要问题。 | `CodexLiveSessionsWorkbench.tsx` 只有 header view switch、搜索/筛选和左侧 `SessionFeed` / `ProjectFeed`；`SessionFeed` header 只显示会话数/请求数；`ProjectFeed` 已有项目行但缺少风险、活跃、最近项目的聚合入口。`model/selectors.ts` 已能构建 `CodexLiveProjectSummary`。 | 运营用户进入 Live Sessions 后需要先读列表或切 project view，无法直接看到优先看哪个项目或哪类风险。 | 新增纯模型 `buildCodexLiveOperationalSummary`，从 project summaries 派生 `risk / active / recent` 三个动作；Workbench 在 feed 上方显示 compact operational strip，点击 action 切到 project view 并选中目标项目。Focused model/source tests + typecheck + browser DOM/截图验收。 | 若现有 UI 已有可点击 compact operational strip，且能按风险、活跃、最近直接跳到对应项目，则本候选不进入实现。 |

## 本轮范围

1. 只改 Live Sessions 前端 selector、workbench UI 和测试。
2. 不改 CLIProxyAPI live tracker、Wails binding 或历史接口。
3. 不新增跨页 deep-link；操作只在当前 Live Sessions 页面内切换 project view 与选中项目。
4. UI 文案不得内置在 selector / model 层；`risk / active / recent` 只能作为结构化 kind，面向用户的中文/英文标签进入 component/i18n 层。

## 原型复盘

- 已验证方向：基于 `CodexLiveProjectSummary` 派生风险、活跃、最近三个入口是可行的；点击后切换到 project view 并选中项目，能解决“先读列表再判断”的发现成本。
- 未交付原因：用户要求本轮整理会话并把剩余问题转入下期需求；原型仍存在 model selector 内直接写中文展示标签的问题，不符合 i18n / UI 边界。
- 下期第一步：先补失败测试，断言 model 层只输出 `kind/projectID/metric` 等结构化字段，再由 Workbench/i18n 生成展示文案。

## 验收计划

```bash
cd frontend && node --test src/features/codex-live-sessions/model.test.mjs
cd frontend && npm run typecheck
cd frontend && npm run build
docs-linhay/scripts/check-docs.sh
git diff --check
```

浏览器/DOM：

1. `cd frontend && npm run dev -- --host 127.0.0.1`
2. 打开 `http://127.0.0.1:5173/#frame=codex&workspace=live-sessions`
3. 等待 `运营摘要` 出现。
4. 断言 `风险项目 / 活跃项目 / 最近项目` 可见；点击一个 action 后 project view 激活并选中对应 project row。

真实 dev App 手点：

- 本轮不做。原因：只改前端模型与浏览器可验收 UI，不涉及 macOS 菜单栏、窗口生命周期、status item、LaunchServices、native runtime 或 Wails binding 可见性。
