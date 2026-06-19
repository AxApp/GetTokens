# Wave 0-2 Implementation Notes

## 范围
本轮推进 `UI Migration Sequence v01` 的 Wave 0 到 Wave 2：

1. Wave 0：主题基础设施。
2. Wave 1：全局 token 兼容层和基础组件主题接入起点。
3. Wave 2：Settings Appearance 与 Design System 主题 preset 入口。

## 已完成
### Theme preset 基础设施
1. 新增 `ThemePreset = classic | parchment-trust-console`。
2. 新增 `theme-preset` localStorage key，独立于既有 `theme-mode`。
3. `ThemeContext` 同时暴露 `themeMode` 和 `themePreset`。
4. App 根节点写入 `data-theme-preset`。
5. `system` 明暗模式监听 `prefers-color-scheme` 变化。

### Token 兼容层
1. `style.css` 新增 `--gt-*` semantic tokens。
2. 旧变量 `--bg-main`、`--bg-surface`、`--border-color`、`--text-primary`、`--text-muted` 继续保留，并映射到新 token。
3. 增加 `parchment-trust-console` light 组合。
4. 增加 `dark + parchment-trust-console` 组合。
5. `SegmentedControl` 焦点态接入 `--gt-focus-ring`。
6. `ToggleSwitch` 启用态接入 `--gt-status-success`。

### Settings + Design System
1. Settings Appearance 新增主题风格选择卡。
2. Design System 入口新增主题 preset baseline 区块，可直接切换当前 `theme-preset`。
3. Storybook `ColorTokens` 展示 `--gt-*` token，并增加 Parchment Trust Console swatch 列。
4. 中英文 locale 已补齐 Settings 与 Design System 新文案。

### Settings + Design System 重新设计
1. Settings 从旧的纵向机械表格改为 `Parchment Trust Console` 审计台布局：顶部页面标题、横向 section index、当前偏好摘要、Appearance 四宫格、Runtime 两列控制区。
2. Design System 从 Storybook 列表入口改为设计系统控制台：首屏保留 Storybook 命令、覆盖矩阵、主题风格实验区和业务组件预览入口。
3. 新增 scoped 页面层样式 `settings-trust-console` 与 `design-system-trust-console`，不修改全局 `card-swiss` 默认视觉，避免影响后续未迁移页面。
4. Design System component marker 改为仅在 `data-design-system-inspect-mode="active"` 时显示，普通 Settings / Design System 预览不再出现红色组件标签。

### 浏览器验收补齐
1. 新增 `docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs`。
2. 脚本启动 Vite dev server，并通过 headless Chrome DevTools Protocol 注入 `theme-mode=light` 与 `theme-preset`。
3. 覆盖 `#frame=settings` 的 classic baseline 与 Parchment after 截图。
4. 覆盖 `#frame=design-system` 的 Parchment baseline 区块截图。
5. 断言 `html[data-theme-preset]`、关键 DOM selector、实际 `--gt-surface-canvas` token、无横向溢出。
6. 断言普通预览中可见 design-system marker 数量为 `0`，避免 DEV 高亮污染产品截图。

## Information Change Ledger
### Settings Appearance
- 当前信息项: 明暗模式、语言、文字大小。
- 权威来源: 前端本地偏好 `localStorage` 与现有 I18n/TextScale/Theme Context。
- 当前呈现位置: Settings -> Appearance。
- 当前问题: 只有明暗模式，没有独立风格皮肤入口。
- 建议呈现: 在明暗模式下方新增主题风格卡片。
- 是否改变信息含义: no。
- 是否需要用户确认: no。
- 验收方式: `settingsLayout.test.mjs` 源码断言、typecheck、build。

### Design System Entry
- 当前信息项: Storybook 入口、组件覆盖、业务组件预览。
- 权威来源: `storyCatalog.ts`、`businessComponentPreviews.tsx`、Theme Context。
- 当前呈现位置: Design System 页面。
- 当前问题: 设计系统没有主题 preset baseline。
- 建议呈现: 在页面顶部新增主题风格矩阵。
- 是否改变信息含义: no。
- 是否需要用户确认: no。
- 验收方式: `storyCatalog.test.mjs` 源码断言、Storybook build。

## 未触碰边界
1. 未修改 `frontend/src/components/biz/Sidebar.tsx`，因为当前工作区已有无关 dirty 改动。
2. 未进入 Accounts、Account Detail Modal 或 Codex / Claude account list；这些属于后续 Wave。
3. 未引入 Radix / React Aria 等 headless primitive；当前 Wave 只建立主题基础。
4. 未改 Wails binding、sidecar 或正式版 `/Applications/GetTokens.app`。

## 验证
已通过：

```bash
node --test src/context/ThemeContext.test.mjs src/features/settings/settingsLayout.test.mjs src/features/design-system/storyCatalog.test.mjs
node --test src/features/settings/settingsLayout.test.mjs src/features/design-system/storyCatalog.test.mjs src/features/status/tests/statusTypography.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run build-storybook
node docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs
docs-linhay/scripts/check-docs.sh
git diff --check
```

## 浏览器验收产物
1. DOM/screenshot snapshot：`docs-linhay/spaces/20260519-theme-skinning/plans/20260619-wave-0-2-preview-snapshot-v01.md`
2. Settings classic baseline：`docs-linhay/spaces/20260519-theme-skinning/screenshots/20260619/theme-skinning/20260619-theme-skinning-settings-baseline-v01.png`
3. Settings Parchment after：`docs-linhay/spaces/20260519-theme-skinning/screenshots/20260619/theme-skinning/20260619-theme-skinning-settings-after-v01.png`
4. Design System Parchment after：`docs-linhay/spaces/20260519-theme-skinning/screenshots/20260619/theme-skinning/20260619-theme-skinning-design-system-after-v01.png`

## 下一步
Wave 3 从 Accounts 列表开始。进入 Wave 3 前先补 Accounts 的 `Information Change Ledger`，重点核对账号来源、凭据类型、routeability、quota/billing 和筛选默认态。
