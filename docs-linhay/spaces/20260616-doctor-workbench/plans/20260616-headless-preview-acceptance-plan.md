# Doctor Workbench Headless Preview Acceptance Plan

日期：2026-06-16

## 范围

本计划只覆盖 Doctor Workbench 的 headless browser / DOM / screenshot 验收。它用于证明浏览器 preview 与 runtime fallback 不崩溃、source 标识正确、导航 hash 使用当前 App frame 规范。

本计划不替代真实 Wails runtime binding 验收；`GetDoctorSnapshot` 的 runtime correctness 继续由 Go focused tests 和 Wails/root mapper tests 证明。

## Evidence Matrix

| 证据项 | 当前事实 | 下一切片处理 | 验收方式 |
|---|---|---|---|
| Doctor A2 runtime-first / preview-fallback | `DoctorWorkbenchFeature` 在无 Wails 时回到 explicit preview | headless 浏览器打开 Doctor workspace，断言 preview source 可见 | DOM assertion + screenshot |
| preview truth 边界 | A2 plan 要求 `source=preview` 不伪造 runtime | 截图或 DOM 中必须出现 preview-only/source 标识 | Playwright/headless script |
| navigation hash | A2 已修正为 `#frame=status`、`#frame=codex&workspace=account-list`、`#frame=accounts&detail=...` | DOM 测试点击或读取 link href，确认无草案 hash | static source test 或 browser DOM |
| screenshot hygiene | space 截图需归档到 `screenshots/YYYYMMDD/module/` | 输出稳定命名，避免 `latest/final/temp` | file existence check |

## BDD Scenarios

1. Given browser preview has no `window.go.main.App.GetDoctorSnapshot` binding
   When the Doctor workspace loads
   Then it renders a preview snapshot and labels the source as preview.

2. Given runtime binding is absent
   When the refresh action is rendered
   Then it does not claim runtime snapshot was loaded.

3. Given a check has navigation target
   When the browser inspects the target href
   Then the href uses current App hash frame syntax and not `#status/all` or `#codex/channel-routing?...`.

## Candidate Script Shape

Recommended script path:

```text
docs-linhay/scripts/check-doctor-workbench-preview.mjs
```

Expected behavior:

1. Start or reuse local Vite preview server only if a project-standard script already exists; otherwise document the command and keep script focused on browser assertions.
2. Open Doctor workspace in headless Chromium.
3. Assert visible text / attributes for:
   - Doctor Workbench title.
   - `source=preview` or equivalent preview marker.
   - no draft hashes in anchors.
4. Save screenshot to:

```text
docs-linhay/spaces/20260616-doctor-workbench/screenshots/20260616/workbench/20260616-doctor-workbench-headless-baseline-v01.png
```

## Verification Commands

```bash
npm --prefix frontend run test:doctor-workbench
npm --prefix frontend run typecheck
node docs-linhay/scripts/check-doctor-workbench-preview.mjs
docs-linhay/scripts/check-docs.sh
git diff --check
```

If local preview server setup is not available in the current environment, keep the screenshot script pending and record the exact blocker; do not substitute a visible browser click-through on the user's active display.

## 验收结果

- `npm --prefix frontend run test:doctor-workbench`：通过，7/7。
- `node --check docs-linhay/scripts/check-doctor-workbench-preview.mjs`：通过。
- 本地 Vite dev server `http://127.0.0.1:5173/` 下执行 `node docs-linhay/scripts/check-doctor-workbench-preview.mjs`：通过。
- DOM 断言：`title`、`previewSource`、`previewRuntimeBoundary`、`sourceBoundary`、`noDraftStatusHash`、`noDraftCodexHash`、`noDraftAccountsHash` 全部为 true。
- 截图归档：[screenshots/20260616/workbench/20260616-doctor-workbench-headless-baseline-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-doctor-workbench/screenshots/20260616/workbench/20260616-doctor-workbench-headless-baseline-v01.png)

## 不做项

1. 不启动或修改正式版 GetTokens。
2. 不把 browser preview 截图当作 Wails runtime binding 证据。
3. 不打开可见浏览器抢焦点。
4. 不在 Doctor 前端重新推导 route/quota authority。
