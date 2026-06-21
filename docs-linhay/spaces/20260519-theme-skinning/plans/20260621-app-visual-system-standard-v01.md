# App Visual System Standard v01

## 背景

用户在 2026-06-21 明确两个方向：

1. 只保留 AntD。
2. 只保留新的视觉系统。

本规范用于后续统一字体、字重、颜色和组件外壳。它定义目标态，不表示当前运行时代码已经全部完成迁移。

## 硬约束：不允许保留过渡态

用户已明确“不允许保留过渡”。因此本规范采用闭包交付规则：

- 可以在本地工作区或未交付分支内拆步骤施工。
- 对用户宣称完成、合并或交付的闭包中，不允许运行态继续保留旧 Swiss / parchment visual primitive、legacy alias 新引用、Tailwind named colors、dark:* 或裸 px 字号。
- 如果当前运行态已有旧入口，必须在同一视觉统一闭包内删除、替换或登记为产品例外。
- “迁移期兼容”不能作为完成后的保留理由。
- 产品例外必须写入例外表；例外不是过渡态，必须有明确存在理由和验收边界。

## 目标态

### 1. 组件系统只保留 AntD

目标：

- 新增 UI 默认使用 AntD 组件或 GetTokens 的 AntD adapter wrapper。
- 自研 Swiss / parchment 类、硬边按钮、手写 toolbar action、旧 card shell 不允许作为交付后的运行态保留。
- 不再新增第二套自研 visual primitive。
- 如果 AntD 原生组件不满足桌面密度，需要做 adapter wrapper，而不是绕开 AntD 重写一个新组件系统。

交付要求：

- 现有业务页面中的旧 class 必须在视觉统一闭包内删除或替换。
- Storybook / Design System 中的旧组件展示也不作为长期保留项；如果为了对比临时存在，不能随完成闭包交付。
- 特殊运行态组件若不能替换 AntD，只能作为产品例外登记；不能标记为过渡。

### 2. Token 只保留新的 gt 语义层

目标：

- 新代码优先使用 gt 语义 token：surface、ink、border、status、font、radius、elevation。
- legacy alias 只允许在 style.css 内作为迁移兼容，例如 bg-main、text-primary、border-color、font-size-ui-*。
- JSX / TSX 新增样式不再直接引入 legacy alias。
- 后续统一时，把字体、字号、字重、颜色都收敛到 gt 语义层。
- 完成闭包内不允许以“后续再迁移”为理由继续保留运行态 legacy alias 使用。

目标命名：

| 类型 | 目标入口 |
| --- | --- |
| 字族 | --gt-font-family-sans / --gt-font-family-mono |
| 字号 | --gt-font-size-* |
| 字重 | --gt-font-weight-* |
| 表面 | --gt-surface-* |
| 文本 | --gt-ink-* |
| 边框 / 焦点 | --gt-border-* / --gt-focus-ring |
| 状态 | --gt-status-* |
| 圆角 | --gt-radius-* |
| 阴影 | --gt-elevation-* |

需要新增的 token：

- 当前 style.css 只有 gt-font-size-body、section-title、page-title、metadata、number，无法覆盖现有 font-size-ui-* 的完整层级。
- 迁移前应先补齐 gt 字号阶梯，例如 compact-label、caption、body-sm、body、section-title、page-title、display。
- 补齐后再改 Tailwind fontSize 映射，避免业务页面直接断层。

## 字体 / 字重规范

### 字族

- 产品 UI 默认使用 --gt-font-family-sans。
- 代码、路径、模型 ID、账号 ID、日志、token、数值密集表格可使用 --gt-font-family-mono。
- body 目标态应切到 --gt-font-family-sans；mono 只由局部显式选择。

### 字号

- 运行态新代码不写裸 px 字号。
- 运行态新代码不新增 font-size-ui-* 引用。
- 如果需要一个新字号，先补 gt token，再使用该 token。

### 字重

- 常规 UI 只允许 400 / 500 / 650 / 700。
- 850 / 900 / 950 不再进入业务运行态。
- 旧 trust-console / design-system 展示不能作为完成闭包保留；如需对比，只能存在于未交付施工态。

## 颜色规范

- 业务状态色统一走 --gt-status-*。
- 禁止新增 Tailwind named colors，例如 red-500、emerald-700、amber-500。
- 禁止新增 dark:*，因为当前运行态不再有 dark token override。
- Provider 品牌色保留为 provider identity token。
- Chart 数据色保留为 chart token。
- Overlay 只走 overlay scrim token 或 AntD modal token。
- 直接 hex / rgba 只允许出现在 token 定义、provider brand、chart palette 或已登记特殊例外中。

## AntD 规范

### Theme adapter

- AntD 的 ConfigProvider theme 是唯一组件主题入口。
- 当前 frontend/src/context/antdTheme.ts 的 classicLight palette 需要迁移为从 gt token 同步的 adapter，不能长期独立维护第二份 palette。
- 如果运行时不能直接读取 CSS variable，则以同名 TS token 常量生成 AntD palette 和 CSS var，保证单源。

### Component wrapper

- 新增组件优先从 AntD 开始。
- wrapper 只做三件事：
  1. 接入 GetTokens 桌面密度。
  2. 接入 gt token。
  3. 固定可访问性和状态契约。
- wrapper 不应重新定义另一套视觉语言。

## 例外表

| 例外 | 当前判断 |
| --- | --- |
| AccountDetail quota reset modal 动态渐变 | 作为产品例外保留。它是刻意设计的特殊视觉，不按普通状态色机械 token 化。 |
| Provider brand color | 保留。属于身份色，不是 UI 状态色。 |
| Chart / analytics color | 保留。属于数据编码，不是普通 UI 装饰色。 |
| Storybook / Design System 旧组件展示 | 不作为长期例外。若用于施工对比，只能存在于未交付中间态，完成闭包内应删除或替换。 |

## 统一顺序

### Phase 1：规范与门禁

- 写入本规范。
- 更新 gettokens-frontend-design-quality skill。
- 新增或调整源码扫描门禁，禁止新增：
  - Tailwind named colors。
  - dark:*。
  - 运行态裸 px 字号。
  - 运行态新增 legacy alias token。

可独立合并；不改变 UI。该阶段只建立规则，不宣称视觉统一完成。

### Phase 2：低风险热点统一

优先处理本轮 inventory 已列出的低风险入口：

- DoctorWorkbench tone map。
- Sidebar inline px 字号和直接 #ffffff。
- DebugHeader 按钮字号。
- DesignSystemEntryFeature anatomy 示例字号。

可独立验证；但在用户要求“不允许保留过渡”的前提下，不能把仍残留旧入口的局部页面迁移宣称为最终完成。

### Phase 3：AntD adapter 单源化

- 将 antdTheme.ts 的 palette 和 CSS token 单源化。
- 保留 AntD ConfigProvider 作为唯一组件主题入口。
- 补 focused test 固定 palette 与 gt token 对齐。

可独立验证；但如果 AntD palette 单源化后仍保留第二份运行态 palette，不能宣称标准完成。

### Phase 4：旧 visual primitive 退场

- 在未交付工作分支内可以按页面拆分替换 btn-swiss、card-swiss、parchment-toolbar-action-* 等旧类。
- 每次验证一个页面或一个强相关组件组。
- 完成闭包内不得继续保留旧类；确有产品理由的必须改写为产品例外，而不是旧类保留。

## 验收方式

- 文档门禁：docs-linhay/scripts/check-docs.sh。
- 空白门禁：git diff --check。
- 代码阶段门禁：对应 focused tests + npm run typecheck。
- 视觉阶段门禁：无头浏览器 DOM / computed style 检查，必要时截图归档到本 space。

## 2026-06-21 收敛执行记录

- 已将运行态旧 Swiss / Parchment visual primitive、legacy alias token、Tailwind named status colors、dark variant 入口从 frontend/src 与 frontend/tailwind.config.js 清零。
- 已把设计系统基础样式入口改为 AntD component + gt-* 语义 token；btn-swiss / card-swiss / input-swiss / select-swiss 不再作为可用基础样式保留。
- 已把 Usage Desk、Settings、Debug、Accounts header / toolbar / card actions、Design System previews、Storybook primitives 等已识别热点收敛到 AntD 组件或 gt-* token。
- 已更新源码契约测试，使门禁禁止旧 alias / 旧 primitive，而不是禁止新的 gt-* token。
- 验证：
  - npm --prefix frontend run typecheck 通过。
  - npm --prefix frontend run test:unit 通过，984 pass。
  - npm --prefix frontend run build 通过，仅保留 Vite chunk size warning。
  - 运行态旧口径扫描通过：legacy text token、legacy bg token、font-size-ui-*、line-height-ui-*、parchment-*、btn-swiss、card-swiss、input-swiss、select-swiss、Tailwind named status color、dark variant 在非测试运行态代码中无命中。

## 2026-06-21 严格解释边界

- 本次完成口径是“运行态视觉系统只保留 AntD 主题入口与新的 gt-* 语义 token，不保留旧 Swiss / Parchment / legacy alias 过渡层”。
- 仍存在原生 HTML 控件用于导航、菜单、表格行、可访问性按钮和局部交互；它们不能继续挂旧视觉 primitive，也不能新增旧 token。若后续把“只保留 AntD”升级为“运行态所有交互控件必须用 AntD 组件实例”，需要单独开控件替换工程，因为当前扫描约 441 处原生 button/input/select/textarea，直接机械替换会跨越行为语义和表单提交边界。

## 2026-06-21 Ant Design 设计语言升级

用户明确 AntD 对齐不止色彩，而是 Ant Design introduce/spec 的整套设计语言。本 space 后续完成口径升级为：

- 价值观：Natural / Certain / Meaningful / Growing，优先确定性、可预期、状态清楚、服务任务的企业级界面。
- 色彩：运行态直接色值只允许 Ant Design palette / neutral palette；provider、chart、status、accent 不再保留自定义色例外。透明层必须来自黑色 alpha 或 color-mix 加 AntD palette 色。
- 字体：默认 14px body、系统字体栈；产品 chrome 只使用 400 / 600 字重。
- 间距：默认 4px grid，避免一次性 magic spacing。
- 圆角：控件 6px，surface 8px，小 tag/chip 4px，pill 仅用于头像、badge、dot。
- 阴影：flat-first，只有浮层类 surface 使用阴影。
- 组件：优先 AntD component 和 component token；primary 只给单个主行动。

本轮新增 frontend/src/context/antdColorContract.test.mjs，把运行态 hex/rgb 色值限制到 AntD 设计语言允许集合。
