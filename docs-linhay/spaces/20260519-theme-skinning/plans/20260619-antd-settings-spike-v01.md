# AntD Settings Spike v01

## Goal

在不改变 Settings 业务信息和 Wails 设置读写逻辑的前提下，验证当前 npm Ant Design 版本是否适合作为 GetTokens 后续换肤底座之一。

本轮只迁移 Settings 页，产物必须能证明：

1. AntD `ConfigProvider` 可以承接 `ThemeMode + ThemePreset`。
2. Parchment Trust Console 可以通过 AntD token 与 scoped CSS 表达。
3. Settings 页真实使用 AntD 组件，而不是只安装依赖。
4. 现有设置项、保存路径、预览 fallback 不被视觉迁移破坏。

## Scope

### In

- Settings 页局部接入 AntD。
- 新增 GetTokens AntD theme adapter，先覆盖 `classic` 与 `parchment-trust-console`。
- Settings 页将分段控件、开关、按钮或卡片层迁移到 AntD 组件。
- 更新浏览器预览脚本，固定 Settings 页 AntD 试点证据。
- 更新单元测试、typecheck、frontend build 与文档校验。

### Out

- 不迁移全站 AppShell。
- 不迁移 Accounts、Codex、Design System 其它页面。
- 不把所有自研 UI 组件删除。
- 不改正式版 `/Applications/GetTokens.app`。
- 不改变 sidecar / Wails API 合约。

## Evidence Matrix

| Source | Current fact | Expected acceptance | Disproof condition |
|---|---|---|---|
| 用户要求 | 用户明确说 Settings 页先做 Ant Design 试点。 | Settings 页有 AntD provider 与真实 AntD 控件。 | 只安装依赖，页面仍全部使用自研控件。 |
| 代码 | `SettingsFeature.tsx` 已有 Parchment scoped layout 与主题 preset 控制。 | 保留主题 preset 控制和所有设置项，但控件层改为 AntD。 | 删除或隐藏任一设置项，或破坏 Wails 保存函数。 |
| 主题体系 | 当前主题以 `theme-mode`、`theme-preset` 和 `--gt-*` token 驱动。 | AntD token 从同一主题状态派生。 | AntD 使用硬编码主题，无法跟随 preset。 |
| 验收脚本 | `check-theme-skinning-wave02-preview.mjs` 已验证 Settings / Design System。 | Settings case 额外断言 AntD marker 和 `.ant-*` 组件。 | 截图脚本无法证明 AntD 实际渲染。 |

## Information Change Ledger

| Area | Status | Note |
|---|---|---|
| 外观设置 | unchanged | 保留明暗模式、主题风格、语言、文本缩放。 |
| App lifecycle | unchanged | 保留登录启动、菜单栏图标、关闭行为。 |
| 本地用量刷新 | unchanged | 保留刷新间隔与保存反馈。 |
| 网络代理 | unchanged | 保留系统代理开关、配置路径和保存反馈。 |
| 更新 | unchanged | 保留现有 `SettingsReleasePanel`，本轮不深迁。 |

## Acceptance

1. `SettingsFeature.tsx` 使用 GetTokens AntD provider 包裹 Settings 页面。
2. Settings 页 DOM 带有 `data-settings-antd-spike="true"`。
3. Settings 页至少渲染 AntD `Card`、`Segmented`、`Switch`、`Button` 之一的真实 class。
4. AntD theme adapter 对 `classic` 与 `parchment-trust-console` 均有测试。
5. Settings Parchment 截图通过 headless Chrome 检查，无横向溢出。
6. `npm --prefix frontend run typecheck` 与 `npm --prefix frontend run build` 通过。
