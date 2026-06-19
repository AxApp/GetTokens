# Settings AntD Handoff v01

## 交付目标

把 Settings 页作为 `Parchment Trust Console` + Ant Design adapter 的第一块可交付试点，供前端执行者继续打磨和落地。

本 handoff 不是要求全站改 AntD。当前只要求 Settings 页证明三件事：

1. AntD 可以被 GetTokens 现有 `ThemeMode + ThemePreset` 驱动。
2. Settings 页可以用 AntD 基础组件承载 Parchment 视觉，而不退回默认后台模板质感。
3. 设置页业务信息、Wails 保存路径、预览 fallback 和验收脚本保持不变。

## 当前状态

已完成首轮试点：

1. 已安装当前 npm `antd`，并同步 `frontend/package-lock.json` 与 `frontend/package.json.md5`。
2. 已新增 `frontend/src/context/antdTheme.ts`，通过 `buildGetTokensAntdTheme` 将 `classic` 与 `parchment-trust-console` 映射到 AntD token。
3. 已新增 `frontend/src/context/AntdThemeProvider.tsx`，Settings 页通过 GetTokens provider 接入 AntD `ConfigProvider`。
4. `frontend/src/features/settings/SettingsFeature.tsx` 已真实直接使用 AntD `Segmented` 与 `Switch`。
5. `docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs` 已增加 Settings AntD DOM 断言。
6. 已有截图证据：`screenshots/20260619/theme-skinning/20260619-theme-skinning-settings-after-v01.png`。

## 执行者任务

### Task 1：收敛 Settings 页 AntD 使用边界

目标：Settings 页先直接使用 AntD 基础组件，不额外抽 wrapper；后续是否抽象由更多页面迁移后再决定。

建议动作：

1. Settings 页继续直接从 `antd` import `Segmented`、`Switch` 等基础控件。
2. 不引入旧的 `ThemePresetPicker` 或卡片式自研入口。
3. AntD 控件必须保留 disabled、loading/pending 文案外显能力。
4. 不要把 `ConfigProvider` 散落到多个页面；仍由 `GetTokensAntdThemeProvider` 作为唯一入口。

验收：

1. `settingsLayout.test.mjs` 仍能证明 Settings 是 AntD 试点页。
2. `antdTheme.test.mjs` 仍能证明 token 从 `ThemePreset` 派生。
3. Settings 页截图中不得出现 AntD 默认蓝、默认圆角后台质感或布局膨胀。

### Task 2：补完整 Settings 状态矩阵

目标：Settings 页不只验证正常态，还要覆盖设置保存中的 pending、disabled、preview fallback 和 error 信息位置。

必须覆盖状态：

1. Appearance：theme mode、theme preset、language、text scale。
2. App lifecycle：loading、unsupported launch item、saving、preview saved、save failed。
3. Local usage refresh：loading、saving、saved、failed。
4. Network proxy：loading、saving、saved live、saved restart、failed。
5. Updates：checking、available、manual fallback、native updater UI。

验收：

1. 单测或源码测试固定关键状态文案不会被删除。
2. 浏览器预览截图至少覆盖 Settings 正常态和 Parchment 主题。
3. 若新增 preview state，必须明确不会污染真实 Wails runtime。

### Task 3：提炼 Parchment component anatomy

目标：不要让 Settings 页长期依赖大段页面 scoped CSS。

建议先抽象以下 component class 或 wrapper：

1. `TrustConsolePage`
2. `TrustConsoleHero`
3. `TrustConsoleSummaryGrid`
4. `TrustConsoleSection`
5. `TrustConsoleField`
6. `TrustConsoleThemePresetCard`

验收：

1. 抽象后 Settings 页 JSX 更接近信息结构，而不是样式细节堆叠。
2. Design System Entry 可以展示这些 anatomy 或至少登记其使用边界。
3. `Parchment Trust Console Component Spec v01` 中对应组件契约保持一致。

### Task 4：复核 AntD 体积和扩展边界

目标：避免 AntD 试点无控制扩散。

必须记录：

1. `SettingsPage` chunk 体积变化。
2. AntD 是否被当前路由按需拆分。
3. 如果未来迁移 Accounts，是否继续用 AntD table/list，还是只复用 provider/token。
4. 若决定回退，哪些 wrapper 可以无痛替换回自研组件。

验收：

1. `npm --prefix frontend run build` 输出中记录 Settings chunk 大小。
2. 不允许在 Accounts、Codex、Design System 等页面无计划直接 import AntD。
3. 是否扩大 AntD 使用范围必须先更新本 space 的 plan。

## 信息变更边界

本轮信息默认不改。执行者如果想调整信息呈现，必须先更新 Information Change Ledger。

### 当前信息项必须保留

1. 主题模式：`system / light / dark`。
2. 主题风格：`classic / parchment-trust-console`。
3. 语言：`zh / en`。
4. 文字大小：`default / large / x-large`。
5. 登录启动。
6. 显示菜单栏图标。
7. 关闭窗口行为。
8. 本地用量刷新间隔。
9. 系统代理开关与配置路径。
10. 更新检查、应用更新或打开 release 页面。
11. 当前版本、release label、Git hash、CLIProxyAPI Git hash、最新版本、更新资产、更新通道。

### 可直接优化

1. 设置项分组和视觉层级。
2. Summary 卡片的顺序和密度。
3. 状态提示的位置。
4. section anchor 的样式。
5. AntD 控件的 token、radius、padding、hover 和 focus 表达。

### 需要用户确认

1. 删除任一设置项或说明文案。
2. 合并两个设置项。
3. 改名状态标签。
4. 改变保存时机。
5. 把 Update 区域重构成新的信息模型。

## 文件入口

### 需求与规范

1. `docs-linhay/spaces/20260519-theme-skinning/README.md`
2. `docs-linhay/spaces/20260519-theme-skinning/plans/20260619-antd-settings-spike-v01.md`
3. `docs-linhay/spaces/20260519-theme-skinning/plans/20260619-parchment-trust-console-component-spec-v01.md`
4. `docs-linhay/spaces/20260519-theme-skinning/plans/20260619-theme-skinning-long-term-plan-v02.md`
5. `docs-linhay/spaces/20260519-theme-skinning/plans/20260619-ui-migration-sequence-v01.md`

### 代码

1. `frontend/src/features/settings/SettingsFeature.tsx`
2. `frontend/src/context/antdTheme.ts`
3. `frontend/src/context/AntdThemeProvider.tsx`
4. `frontend/src/context/theme.ts`
5. `frontend/src/context/ThemeContext.tsx`
6. `frontend/src/style.css`
7. `frontend/src/features/settings/settingsLayout.test.mjs`
8. `frontend/src/context/antdTheme.test.mjs`

### 验收脚本和截图

1. `docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs`
2. `docs-linhay/spaces/20260519-theme-skinning/plans/20260619-wave-0-2-preview-snapshot-v01.md`
3. `docs-linhay/spaces/20260519-theme-skinning/screenshots/20260619/theme-skinning/20260619-theme-skinning-settings-after-v01.png`

## 验收命令

执行者交付前至少运行：

```bash
node --test frontend/src/features/settings/settingsLayout.test.mjs frontend/src/context/antdTheme.test.mjs
npm --prefix frontend run test:unit
npm --prefix frontend run typecheck
npm --prefix frontend run build
node docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs
docs-linhay/scripts/check-docs.sh
git diff --check
```

如修改 Storybook 或设计系统入口，追加：

```bash
npm --prefix frontend run build-storybook
```

如修改 Wails/native runtime、菜单栏、登录启动、更新器或绑定导出，浏览器截图不够，必须追加 dev App 实体验收。

## Definition of Done

1. Settings 页仍能打开、滚动、跳转 section。
2. Settings 页 DOM 带有 `data-settings-antd-spike="true"`。
3. Settings 页至少渲染 AntD `Segmented` 与 `Switch`。
4. Parchment 和 Classic 两套主题下 Settings 页无横向溢出。
5. 所有设置项信息未丢失，保存逻辑未改变。
6. 预览截图和 snapshot 已更新。
7. Space README、计划文档和 memory 已同步当前状态。

## 风险和注意事项

1. 当前 npm 安装的是 `antd@6.4.4`，不是早先讨论里的 v5；执行者不要按 v5 文档假设 `cssVar: true` 等旧类型。
2. AntD 引入后 Settings chunk 变大，需要后续评估是否接受。
3. AntD 默认视觉必须被 GetTokens token 覆盖，不能出现默认蓝色后台模板。
4. 不要把 AntD 直接扩散到 Accounts / Codex / Doctor 等业务页面。
5. 不要为了视觉迁移改 Wails 设置保存语义。
6. 截图和 memory 不得记录 token、cookie、完整密钥或生产配置路径。
