# App Typography / Weight / Color Inventory

## 背景

用户要求整理整个 App 的字体、字重和颜色，便于人工排查当前运行态视觉一致性。本轮只做源码级盘点和排查清单，不修改运行时代码。

## 2026-06-21 规范决策

用户已明确后续统一方向：

1. 只保留 AntD。
2. 只保留新的视觉系统。

执行规范见 [App Visual System Standard v01](20260621-app-visual-system-standard-v01.md)。本 inventory 是现状盘点；后续统一以该标准为准。

## 范围

- 运行态源码：frontend/src 下的 ts / tsx / js / jsx / css。
- 排除：test 文件、stories 文件、frontend/src/stories。
- 扫描规模：运行态 295 个文件；全部前端源码 339 个文件。
- 当前主题边界：运行态只保留 light / classic，旧 theme-mode 和 theme-preset 仅兼容归一。

## 入口文件

| 类型 | 权威位置 | 说明 |
| --- | --- | --- |
| CSS token | frontend/src/style.css:140 | :root 定义当前单运行态 token。 |
| Tailwind 映射 | frontend/tailwind.config.js:32 | fontFamily、fontSize、colors 映射到 CSS token。 |
| Theme runtime | frontend/src/context/theme.ts:3 | 强制 light / classic，忽略历史 storage 值。 |
| AntD token adapter | frontend/src/context/antdTheme.ts:24 | AntD 当前仍有一份 classicLight palette。 |
| Design System 字体预览 | frontend/src/stories/tokens/TypographyTokens.stories.tsx | Storybook 字体 token 展示，不计入运行态问题。 |
| Design System 颜色预览 | frontend/src/stories/tokens/ColorTokens.stories.tsx | Storybook 颜色 token 展示，不计入运行态问题。 |
| 残留门禁 | frontend/src/features/design-system/legacyStyleResidue.test.mjs | 禁止运行态重新引入旧 heavy workspace 样式信号。 |

## 字体系统现状

### 字族

| Token | 当前值 | 主要用途 |
| --- | --- | --- |
| --font-family-ui | 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace | legacy UI / Tailwind font-sans 映射。 |
| --font-family-mono | 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace | legacy mono / Tailwind font-mono 映射。 |
| --gt-font-family-sans | 'Avenir Next', 'SF Pro Text', 'Helvetica Neue', ui-sans-serif, sans-serif | 新的工作台正文 / sidebar / account detail shell。 |
| --gt-font-family-mono | 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace | 新的代码、ID、数值、日志类内容。 |

当前冲突点：body 仍使用 --font-family-ui，而大量新壳层局部用 --gt-font-family-sans。这不是 bug，但人工排查时要注意：页面整体默认等宽，局部新工作台会切 sans。

### 字号

| 层级 | Token | 当前值 |
| --- | --- | --- |
| micro | --font-size-ui-3xs | 0.4375rem |
| tiny label | --font-size-ui-2xs | 0.5rem |
| badge / meta | --font-size-ui-xs | 0.5625rem |
| compact meta | --font-size-ui-sm | 0.625rem |
| compact body | --font-size-ui-md-compact | 0.6875rem |
| control | --font-size-ui-md | 0.75rem |
| default body | --font-size-ui-lg | 0.875rem |
| row title | --font-size-ui-2xl | 1rem |
| small heading | --font-size-ui-3xl | 1.125rem |
| metric heading | --font-size-ui-4xl | 1.375rem |
| page title | --font-size-ui-5xl | 1.625rem |
| large title | --font-size-ui-6xl | 1.75rem |
| display | --font-size-ui-display | 2.5rem |

Tailwind 常用映射：

| Tailwind | 实际映射 |
| --- | --- |
| text-2xs | --font-size-ui-2xs |
| text-xs | --font-size-ui-xs |
| text-sm | --font-size-ui-lg |
| text-base | --font-size-ui-2xl |
| text-lg | --font-size-ui-3xl |
| text-xl | --font-size-ui-4xl |
| text-2xl | --font-size-ui-5xl |
| text-3xl | --font-size-ui-6xl |
| text-4xl | --font-size-ui-display |

注意：运行态仍有少量 px 字面量，见“排查重点”。

### 字重

| Token / class | 当前语义 | 当前扫描量 |
| --- | --- | --- |
| --gt-font-weight-normal / 400 | 普通文本 | 局部 inline style 使用。 |
| --gt-font-weight-medium / 500 / font-medium | 次级强调、导航 | font-medium 约 476 次。 |
| --gt-font-weight-semibold / 650 / font-semibold | 主要强调 | font-semibold 约 587 次。 |
| --gt-font-weight-bold / 700 / font-bold | 少量标题或强提示 | font-bold 约 26 次。 |

运行态未扫到 font-black；这是好信号。高于 700 的权重主要留在 style.css 的 trust-console / usage-desk 旧类里。

## 颜色系统现状

### 核心表面 / 文本 / 边框

| Token | 当前值 | 说明 |
| --- | --- | --- |
| --gt-surface-canvas | #ffffff | App 主画布。 |
| --gt-surface-panel | #f9f9f9 | 二级面板。 |
| --gt-surface-raised | #ffffff | 抬升面。 |
| --gt-surface-muted | #f0f0f0 | 弱化背景。 |
| --gt-surface-inverse | #000000 | 反色背景。 |
| --gt-ink-primary | #000000 | 主文字。 |
| --gt-ink-secondary | #666666 | 次级文字。 |
| --gt-ink-muted | #666666 | 弱 meta。 |
| --gt-ink-disabled | #a3a3a3 | 禁用文字。 |
| --gt-border-subtle | #e5e5e5 | 轻边框。 |
| --gt-border-default | #d4d4d4 | 默认控件边框。 |
| --gt-border-strong | #000000 | 强结构线。 |
| --gt-focus-ring | #000000 | 焦点环。 |

### 状态 / 图表 / Provider 色

| 类别 | Token 数 | 说明 |
| --- | ---: | --- |
| 状态 / accent | 20 | success / warning / danger / info，以及旧 --accent-* 兼容名。 |
| 图表 | 15 | Usage Desk、归因、趋势和 grid。 |
| Provider | 21 | vendor icon / provider identity 色。 |
| overlay | 4 | modal scrim 60/70/80/85。 |

## 机器扫描摘要

| 类别 | 主要结果 |
| --- | --- |
| 直接 hex | 主要集中在 style.css、antdTheme.ts、theme.ts，属于 token/palette 定义；运行态组件内只有 Sidebar 少量 #ffffff。 |
| 直接 rgb/rgba | 主要是 token/elevation/overlay；例外是账号详情 quota reset 动态渐变。 |
| Tailwind named color | 主要集中在 DoctorWorkbenchFeature.tsx，仍残留 dark:text-*。 |
| arbitrary token color | 高频使用 border-[var(--gt-border-subtle)]、text-[var(--text-muted)]、text-[var(--text-primary)]，整体已 token 化。 |
| 字重 class | 运行态主要是 font-semibold 和 font-medium；未扫到 font-black。 |
| 字号 class | 高频是 token 字号；但仍有 text-xs、text-sm、text-[10px]。 |
| 字号 inline | 主要在 Sidebar、DebugHeader、DesignSystemEntryFeature、部分图表 label。 |

## 排查重点

按人工排查优先级排序：

1. frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx:36
   - 现象：statusTone / signalTone 仍使用 border-red-500、bg-amber-500、text-emerald-700、dark:text-*。
   - 风险：单运行态已取消 dark token override，这里仍携带旧 dark 样式语义；颜色也未走 --gt-status-*。
   - 建议：后续若你确认视觉不一致，优先把它改为 color-mix + --gt-status-*。

2. frontend/src/features/accounts/components/AccountDetailSections.tsx:1644
   - 现象：quota reset modal 动态渐变使用多组 rgba(...) 和 bg-white/10。
   - 风险：这是刻意保留的动态渐变 / glass 契约，不应机械 token 化；但它会成为全局颜色扫描里的最大“异常”。
   - 建议：只检查是否符合该 modal 的特殊视觉；不要当成普通页面色彩漂移处理。

3. frontend/src/components/biz/Sidebar.tsx:194
   - 现象：导航文字用 inline fontSize: '13px'、lineHeight: '20px'、fontWeight: 500/400。
   - 风险：绕开 Tailwind 字号 token，但已用 --gt-font-family-sans 和 --gt-ink-*。
   - 建议：排查 sidebar 和页面正文是否出现不协调时重点看这里。

4. frontend/src/components/biz/Sidebar.tsx:298
   - 现象：更新按钮仍有 color: '#ffffff' 与 fontSize: '10px'。
   - 风险：直接白色值不影响单运行态，但不是 token 化写法。

5. frontend/src/features/design-system/DesignSystemEntryFeature.tsx:169
   - 现象：设计系统 anatomy 示例用 fontSize: '11px'。
   - 风险：属于应用内 design-system 页面，不是业务主路径；但如果你在排查“整个 app”会看到它。

6. frontend/src/features/debug/components/DebugHeader.tsx:46
   - 现象：debug header 按钮用 fontSize: '12px'。
   - 风险：视觉上可能与统一 toolbar action 不完全一致。

7. frontend/src/context/antdTheme.ts:24
   - 现象：AntD adapter 有独立 classicLight palette，而不是直接从 CSS 变量读取。
   - 风险：颜色是固定 classic light，但与 style.css token 并非单源定义；如果以后改 CSS token，AntD 需要同步。

8. frontend/src/style.css:494
   - 现象：.settings-trust-title、.design-system-trust-title 等旧 trust-console 类使用 font-weight: 950、italic、uppercase。
   - 风险：这类高视觉权重主要在 Settings / Design System 过渡页面，不是所有工作台通用样式；但排查字体粗细时容易显眼。

## 推荐排查顺序

1. 先看主工作台壳层：Sidebar、WorkspacePageHeader、App shell。
2. 再看高频页面：Accounts、Status、Proxy Pool、Session Management、Codex live sessions。
3. 再看特殊页面：Doctor、Debug、Design System。
4. 最后看特例 modal：quota reset 动态渐变、导入/删除/确认类 overlay。

## 后续收敛建议

如果人工排查确认需要继续收敛，建议按下面的小步顺序：

1. DoctorWorkbench tone map：把 Tailwind named colors 和 dark:text-* 改为 --gt-status-*。
2. Sidebar px 字号：用 --gt-font-size-body、--gt-font-size-metadata 或现有 --font-size-ui-* 替换。
3. DebugHeader / DesignSystemEntryFeature 按钮字号：接入 toolbar action token 或组件 class。
4. AntD adapter palette：决定是否允许保留独立 TS palette；若不允许，需要从 CSS token 契约同步生成。
5. style.css trust-console 高字重：只在 Settings / Design System 视觉方向确认后处理，不建议机械降权。

## 本轮不处理项

- 不改 AccountDetailSections quota reset modal 动态渐变；这是历史明确保留的特殊视觉契约。
- 不新建主题 / dark / preset；当前运行态仍保持 classic light。
- 不启动 Wails dev App；本轮是源码级视觉盘点，无 native/Wails runtime 改动。

## 验证记录

- 已完成：git status --short --branch -uall，确认本轮开始时工作区无脏改动。
- 已完成：源码扫描运行态 295 个文件，排除 tests / stories。
- 已运行：docs-linhay/scripts/check-docs.sh 与 git diff --check 均通过。

## 2026-06-21 收敛后复核

- 旧视觉系统运行态扫描已清零：parchment-*、btn-swiss、card-swiss、input-swiss、select-swiss、font-size-ui-*、line-height-ui-*、legacy text token、legacy bg token、Tailwind named status colors、dark variant 在非测试运行态代码中无命中。
- 字体/字重：运行态裸 px 字号已从本轮识别热点中清除；公共字号走 gt-font-size-*，公共行高走 gt-line-height-*，字重走 gt-font-weight-* 或 AntD token。
- 颜色：运行态组件散落 hex 扫描只剩 antdTheme.ts / theme.ts 的单一主题源色值；页面和组件色彩改走 gt-* token、provider brand token 或 chart token。
- 验证命令：
  - npm --prefix frontend run typecheck
  - npm --prefix frontend run test:unit
  - npm --prefix frontend run build
