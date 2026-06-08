# 第 11 轮：Usage Desk 运营分面与数据源文案验收

## 结果

- 日期：2026-06-08
- 范围：`P7/P6` Usage Desk provider/account/model 分面入口与数据源文案。
- 结论：通过。

## 变更摘要

1. `Usage Desk` 数据源按钮从 `真实请求量 / 本地投影用量` 调整为 `Sidecar 归因 / 本地文件投影`。
2. 页面说明明确区分 sidecar 运行态归因与本地 session / rollout 文件只读投影。
3. 新增运营分面：
   - Observed：`Provider / Account / Model`
   - Projected：`Provider / Project / Model`
4. 分面点击会过滤当前图表、摘要和明细；再次点击同一分面会取消过滤。

## 验收证据

自动化：

```bash
cd frontend && node --test src/features/accounts/tests/usageDesk.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
git diff --check
```

结果：

- `usageDesk.test.mjs`：35 项通过。
- `npm run typecheck`：通过。
- `check-docs.sh`：通过。
- `git diff --check`：通过。

浏览器/DOM：

- 启动方式：`cd frontend && npm run dev -- --host 127.0.0.1`
- URL：`http://127.0.0.1:5173/#frame=codex&workspace=usage-codex`
- 验收点：
  - DOM 出现 `Sidecar 归因`、`本地文件投影`、`运营分面`、`Provider`、`Account`、`Model`。
  - 点击 `Provider: codex` 后按钮进入 active 状态。
  - 总请求从 `179 次` 收缩为 `149 次`，证明 facet 过滤作用到图表/摘要数据。
- 截图：`docs-linhay/spaces/20260608-subagent-project-experience/screenshots/20260608/round11/20260608-usage-desk-facets-after-v01.png`

## 真实 dev App 手点

本轮未执行真实 dev App 手点。原因：本轮只改 Usage Desk 前端模型、hook 和页面渲染，不涉及 macOS 菜单栏、窗口生命周期、status item、LaunchServices、native runtime 或 Wails binding 可见性；按 2026-06-08 更新后的治理规则，使用 focused tests、typecheck、无头浏览器/DOM 和截图证据验收。
