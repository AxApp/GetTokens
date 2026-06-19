# Theme Skinning Long-Term Plan v02

## 决策摘要
GetTokens 后续换肤不把 Ant Design、MUI、Chakra、Mantine 等完整预设 UI 框架直接作为全站主题源。长期方向仍是沿用现有 `React + Tailwind + CSS Variables + Storybook`，补一层 GetTokens 自有的换肤框架；Ant Design 允许作为受控 adapter 做页面级试点，试点通过后再决定是否扩大：

```text
ThemeMode -> ThemePreset -> Semantic Tokens -> Component Skin Contracts -> Page Migration Ledger
```

其中：

1. `ThemeMode` 继续只表达明暗策略：`system / light / dark`。
2. `ThemePreset` 表达视觉风格：`classic / parchment-trust-console / future-presets`。
3. CSS semantic tokens 是稳定契约，组件和页面不得直接依赖某套皮肤的具体颜色。
4. 组件换肤通过本项目 wrapper、CSS variables 和设计系统预览完成；若使用第三方组件库，业务页面只能依赖 GetTokens wrapper / adapter，不让组件库成为新的状态源。
5. 页面迁移允许调整布局和呈现方式，但必须用信息变更清单记录是否改变信息含义。

## 为什么不默认全站接入完整 UI 框架
GetTokens 是 macOS/Wails 桌面工作台，不是通用后台模板。完整 UI 框架会带来三类长期成本：

1. 视觉范式成本：预设组件会把 GetTokens 拉回常见 SaaS 后台质感，削弱高密度、工具型、可审计的产品气质。
2. 双轨主题成本：外部框架 theme provider 会和现有 CSS variables、Tailwind token、Wails 明暗模式形成两套主题系统。
3. 业务结构成本：账号池、quota、routing、live sessions、detail modal、hash 恢复等页面不只是视觉组件，强行套组件库容易改变信息层级和交互责任。

完整 UI 框架不作为默认全站主路径；当前新增 `AntD Settings Spike` 只验证 Settings 页是否能被 `ThemeMode + ThemePreset` 驱动，并不等同于全站迁移承诺。

## 可接受的框架边界
### 主框架：自有 Theme Preset Registry
新增本项目自己的主题注册层，建议形态：

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemePreset = 'classic' | 'parchment-trust-console';

export interface ThemePresetDefinition {
  id: ThemePreset;
  label: string;
  description: string;
  rootAttribute: string;
  previewTokens: {
    canvas: string;
    panel: string;
    ink: string;
    accent: string;
  };
}
```

根节点采用组合标记：

```html
<html class="dark?" data-theme-preset="parchment-trust-console">
```

`class="dark"` 只由 `ThemeMode` 和系统明暗偏好决定；`data-theme-preset` 只由 `ThemePreset` 决定。

### 辅助框架：headless primitives
后期如需要改善复杂交互组件，可评估 Radix Primitives 或 React Aria Components，但只能通过 GetTokens 自有 wrapper 暴露给业务页面。候选范围限定在：

1. Dialog / AlertDialog
2. Popover / Dropdown Menu
3. Select / Combobox
4. Tooltip

这类依赖解决的是焦点管理、ARIA、键盘路径，不承担视觉风格。

### 受控试点：Ant Design adapter
Ant Design 可以进入受控试点，但必须满足以下边界：

1. 由 `buildGetTokensAntdTheme` 从 `ThemePreset` 派生 token，不单独维护主题状态。
2. 业务页面通过 GetTokens provider / wrapper 接入，不能散落创建多个 `ConfigProvider`。
3. 先从 Settings 这类低业务风险页面验证真实组件、体积影响、截图验收和皮肤一致性。
4. 若扩大到全局基础组件，必须先补设计系统 anatomy 和 Information Change Ledger。

### 不采用的路径
1. 不执行 shadcn/ui 全量初始化。
2. 不把 MUI / Mantine / Ant Design / Chakra 直接作为全站主题体系。
3. 不开放任意用户自定义 CSS。
4. 不引入远程主题市场。
5. 不让业务页面直接 import 第三方 primitive。

## Token Contract
长期 token 分为五层，旧变量保持兼容映射，避免一次性改完整个前端。

### Surface
```css
--gt-surface-canvas
--gt-surface-panel
--gt-surface-raised
--gt-surface-muted
--gt-surface-inverse
```

### Ink
```css
--gt-ink-primary
--gt-ink-secondary
--gt-ink-muted
--gt-ink-inverse
--gt-ink-disabled
```

### Border / Focus / Shadow
```css
--gt-border-subtle
--gt-border-default
--gt-border-strong
--gt-focus-ring
--gt-shadow-panel
--gt-shadow-overlay
```

### Accent / Status
```css
--gt-accent-primary
--gt-accent-hover
--gt-status-success
--gt-status-warning
--gt-status-danger
--gt-status-info
```

### Chart / Provider
```css
--gt-chart-primary
--gt-chart-secondary
--gt-chart-grid
--gt-provider-*
```

兼容层继续保留：

```css
--bg-main: var(--gt-surface-canvas);
--bg-surface: var(--gt-surface-panel);
--bg-muted: var(--gt-surface-muted);
--border-color: var(--gt-border-strong);
--text-primary: var(--gt-ink-primary);
--text-muted: var(--gt-ink-muted);
```

## Parchment Trust Console
`parchment-trust-console` 是第一套非默认皮肤。它不是营销站风格，而是面向 GetTokens 工作台的可信控制台风格。

组件级规范以 [Parchment Trust Console Component Spec v01](20260619-parchment-trust-console-component-spec-v01.md) 为准。页面迁移前必须先确认对应组件 contract 已存在，不能只靠页面 scoped CSS 临时拼接。

### 视觉原则
1. 羊皮纸底色只作为系统气质，不做仿古装饰。
2. 字体从 mono-first 调整为 sans-first；mono 只用于 code、ID、metadata 和 keyboard hint。
3. 字体和密度保持工具台可扫读，不牺牲数据密度。
4. 强调色使用暖橙棕，避免 AI 紫蓝默认感。
5. 状态色仍按语义表达成功、警告、危险、信息，不跟随品牌色混淆。
6. 详情类 modal 仍覆盖整个应用窗口视口，包括 sidebar，保持当前 hash 恢复规则。
7. 层级通过 1px hairline、圆角和柔和阴影表达，不继续沿用 2px 黑边框和硬 offset shadow。

### 初始 token
```css
[data-theme-preset='parchment-trust-console'] {
  --gt-surface-canvas: #f5f4ed;
  --gt-surface-panel: #faf9f5;
  --gt-surface-raised: #ffffff;
  --gt-surface-muted: #e8e6dc;
  --gt-surface-inverse: #30302e;
  --gt-ink-primary: #141413;
  --gt-ink-secondary: #5e5d59;
  --gt-ink-muted: #87867f;
  --gt-ink-inverse: #faf9f5;
  --gt-border-subtle: #f0eee6;
  --gt-border-default: #e8e6dc;
  --gt-border-strong: #d1cfc5;
  --gt-focus-ring: #c2b7a0;
  --gt-accent-primary: #c96442;
  --gt-accent-hover: #d97757;
}
```

## 信息变更规则
用户已确认：信息默认不改，但布局和呈现方式可以改；如果迁移时发现更好的信息表达方式，可以提出修改并核对。

因此每个页面迁移必须维护 `Information Change Ledger`。

### Ledger 模板
```md
## Information Change Ledger: <surface>
- 当前信息项:
- 权威来源:
- 当前呈现位置:
- 当前问题:
- 建议呈现:
- 是否改变信息含义: yes/no
- 是否需要用户确认: yes/no
- 验收方式:
```

### 默认必须保留的信息
1. 账号来源、凭据类型、启用/禁用状态。
2. quota、billing、routeability、runtime readiness、sidecar readiness。
3. 错误类型、partial/degraded/stale-cache/not-ready 状态。
4. 保存、刷新、验证、删除、导入、打开详情等关键动作。
5. detail modal 的 hash 参数和关闭恢复行为。

### 可以直接重排的信息
1. 字段分组。
2. summary、列表、详情、筛选区的顺序。
3. 状态徽标和说明文案的视觉层级。
4. 列表行、卡片、rail、section 的组织方式。
5. 空态、错误态、loading 态的位置。

### 需要核对后才能改的信息
1. 删除重复说明。
2. 合并同义统计。
3. 重命名状态标签。
4. 降级低价值指标。
5. 新增派生指标或摘要判断。
6. 改变默认筛选策略。

## 长期迁移顺序
详细页面顺序以 [UI Migration Sequence v01](20260619-ui-migration-sequence-v01.md) 为准。本节只保留阶段摘要。

### Phase 0：规划固化
1. 更新本 space 的 README、长期计划和 memory。
2. 把 `Parchment Trust Console` 定为第一套非默认主题。
3. 明确不默认全站接入完整 UI 框架，先通过 Settings AntD 试点验证。
4. 先完成 Parchment component spec 和 anatomy gate，再进入页面级重做。

### Phase 1：主题基础设施
1. 扩展 `ThemePreset` 类型。
2. 更新 `ThemeContext`，同时持久化 `theme-mode` 和 `theme-preset`。
3. 在 `AppShell` 根节点应用 `data-theme-preset`。
4. 新增主题解析、非法值回退、旧值兼容测试。

### Phase 2：Token 兼容层
1. 在 `style.css` 新增 `--gt-*` semantic tokens。
2. 把旧变量映射到新 token。
3. 为 `classic` 和 `parchment-trust-console` 提供明暗组合。
4. 保持现有 Tailwind config 不大改，只扩展必要 token。

### Phase 3：设计系统验收入口
1. 设置页 Appearance 增加主题风格选择和预览。
2. Settings 页增加 AntD adapter 试点入口，验证 `ConfigProvider` 是否能承接 GetTokens token。
3. Storybook / 设计系统入口支持主题切换。
4. 核心组件状态进入主题预览：Button、SegmentedControl、Input、Badge、Card/List、ModalFrame、Sidebar。

### Phase 4：首批页面迁移
优先迁移：

1. Accounts 列表。
2. Account Detail Modal。
3. Settings Appearance。
4. Design System Entry。

每个页面先写 ledger，再改 UI。

### Phase 5：扩展到工作台页面
第二批：

1. Codex account list。
2. Claude account list。
3. Proxy Pool。
4. Status。
5. Usage Desk。
6. Session Management。
7. Doctor Workbench。

### Phase 6：交互 primitive 评估
只有当现有手写弹层或选择器暴露出明确焦点、键盘或可访问性问题时，才进入 Radix / React Aria spike。spike 先做非核心 wrapper，不直接替换高风险业务 modal。

## 验收门禁
### 测试
```bash
node --test frontend/src/context/ThemeContext.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
git diff --check
```

页面迁移时还要补对应页面的 layout / presentation 测试，不能只依赖截图。

### 截图
主题截图默认用无头浏览器输出到本 space：

```text
docs-linhay/spaces/20260519-theme-skinning/screenshots/<YYYYMMDD>/<surface>-<theme>-<state>-v01.png
```

至少覆盖：

1. `classic` light / dark。
2. `parchment-trust-console` light / dark。
3. loading / empty / error / partial / normal。

### Wails 验证
普通页面布局可用浏览器验证；如果改动涉及 Wails binding、原生窗口明暗模式、系统菜单或桌面生命周期，必须做 dev App 验证。

## 未决问题
1. 是否需要为 `parchment-trust-console` 提供深色变体，还是先只保证 light 与 `dark` 可组合但视觉接近 charcoal console。
2. 是否把主题偏好纳入配置导入导出。
3. 是否允许不同 workspace 后期绑定不同 accent，例如 Codex / Claude / Gemini。
4. `classic` 是否继续保持当前 Swiss hard-edge 视觉，还是作为“兼容默认”逐步软化。
