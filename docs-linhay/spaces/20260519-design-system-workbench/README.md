# Design System Workbench

## 背景
换肤 / 主题能力已经进入排期，但如果只在真实业务页面里调样式，修改成本会很高：每次要跳转到账号池、Codex、代理池、设置页等不同页面，才能确认按钮、表单、弹窗、卡片、状态徽标在各主题下是否一致。

当前 GetTokens 已有一批自研基础组件和全局 CSS token，但缺少一个集中预览与回归入口：

1. 基础组件状态分散在业务页面中，难以批量检查。
2. 主题、文字缩放、语言切换会影响组件密度和可读性，但没有专门验证页面。
3. 后续引入 Radix / React Aria 这类 headless primitives 时，需要一个低风险场地先验证视觉、键盘路径和焦点态。
4. 设计系统需要可运行、可截图、可回归，而不是只停留在文档。

## 目标
1. 接入 Storybook 作为 GetTokens 设计系统主工作台，集中预览所有基础 UI 组件及其主要状态。
2. 新增应用内 `design-system` 入口，用于说明设计系统位置、打开 Storybook、承载后续开发态索引。
3. 支持在 Storybook 内观察主题、文字缩放、密度、禁用态、加载态、错误态、成功态、焦点态。
4. 让换肤 / 主题改动可以先在工作台验证，再扩散到业务页面。
5. 为后续组件抽象、Radix primitive spike、截图回归提供稳定入口。

## 范围
1. Storybook 接入：
   - 使用 `@storybook/react-vite` 适配当前 React + Vite 技术栈。
   - 新增 `frontend/.storybook/` 配置。
   - 新增 `npm --prefix frontend run storybook` 与 `build-storybook` 脚本。
   - 在 Storybook preview 中加载 `frontend/src/style.css` 和必要 provider。
2. 应用内入口：
   - `AppPage` 增加 `design-system`。
   - `App.tsx` 懒加载 `DesignSystemPage`。
   - `Sidebar` 增加设计系统入口，页面内提供 Storybook 地址和启动说明。
   - `pagePersistence` 支持 `#frame=design-system` 或等价 hash。
   - 中英文 locale 增加 `nav.design_system`。
3. 组件预览范围：
   - 基础按钮与按钮组。
   - `SegmentedControl`。
   - `ToggleSwitch`。
   - `ActionSelect`。
   - `Combobox`。
   - 输入框、文本域、select、checkbox/radio 等表单基元。
   - 卡片、状态徽标、提示块、空状态、加载骨架。
   - 弹窗 / 菜单 / 下拉 / tooltip / popover 的占位区，后续用于 primitive spike。
4. Token 预览：
   - 颜色 token。
   - 字体层级。
   - 间距、边框、阴影。
   - 状态色：success、warning、danger、muted、info。
5. 验证：
   - 单元测试覆盖路由持久化和 story catalog 数据。
   - Storybook build 覆盖组件文档站可构建。
   - 浏览器截图覆盖 Storybook 页面在核心主题下的状态。

## 非目标
1. 不在本 space 直接完成完整换肤方案；换肤本身仍归属 `20260519-theme-skinning`。
2. 不接入大而全预设 UI 框架。
3. 不把业务页面重构为设计系统组件的强制迁移；本期先建工作台和基础 catalog。
4. 不在 stories 内调用真实 sidecar 或账号接口，避免预览页依赖运行时数据。
5. 不把应用内设计系统入口做成完整组件工作台；真实组件预览以 Storybook 为准。

## 验收标准
### 场景 1：可从应用内进入设计系统
Given 用户打开 GetTokens
When 点击 Sidebar 的设计系统入口
Then 主内容区进入 `DesignSystemPage`
And 页面展示 Storybook 启动命令、默认地址和基础说明
And 刷新后仍停留在设计系统路由。

### 场景 2：可通过 hash 直接打开
Given 浏览器或 Wails WebView 打开 `#frame=design-system`
When 应用初始化
Then `activePage` 应解析为 `design-system`
And 不回退到默认状态页或账号页。

### 场景 3：基础组件集中预览
Given 用户启动 Storybook
When 查看基础组件区
Then 能看到按钮、分段控件、开关、输入控件、下拉控件、卡片、徽标、提示块、加载态、空状态的主要状态。

### 场景 4：主题与文字缩放回归
Given 用户调整主题或文字缩放
When 停留在 Storybook 对应 story
Then story 内组件应即时反映变化
And 不出现文字溢出、控件重叠或低对比状态。

### 场景 5：截图回归
Given Storybook 具备稳定 story URL
When 执行截图检查脚本
Then 截图应归档到本 space 的 `screenshots/`
And 文件名遵守 `<YYYYMMDD>-design-system-<scene>-<status>-v<nn>.png`。

## 设计稿入口

- 本期设计稿：不单独产出静态 HTML；以 Storybook 工作台和应用内入口作为可运行设计稿。
- Storybook：`http://127.0.0.1:6006/`
- 应用内入口：`#frame=design-system`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260519-design-system-workbench`
- worktree：`../GetTokens-worktrees/20260519-design-system-workbench/`

## 相关链接
- 关联主题 space：[Theme Skinning](../20260519-theme-skinning/README.md)
- UI 框架研判：[UI Framework Evaluation v01](../20260519-theme-skinning/plans/20260519-ui-framework-evaluation-v01.md)
- 当前技术设计：[Technical Design v02](plans/20260519-design-system-workbench-technical-design-v02.md)
- 当前实施计划：[Plan v02](plans/20260519-design-system-workbench-plan-v02.md)
- 历史方案：[Technical Design v01](plans/20260519-design-system-workbench-technical-design-v01.md)
- 当前 App 页面分发：`frontend/src/App.tsx`
- 当前 AppPage 类型：`frontend/src/types.ts`
- 当前导航持久化：`frontend/src/hooks/useAppNavigation.ts`
- 当前 Sidebar：`frontend/src/components/biz/Sidebar.tsx`
- 当前基础样式 token：`frontend/src/style.css`
- 当前基础组件目录：`frontend/src/components/ui/`
- Storybook 配置：`frontend/.storybook/`
- 应用内入口：`frontend/src/features/design-system/DesignSystemEntryFeature.tsx`
- Story catalog：`frontend/src/features/design-system/storyCatalog.ts`
- Storybook 验收截图：`screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png`
- App 路由验收截图：`screenshots/20260519/design-system/20260519-design-system-app-route-web-after-v01.png`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-19

## 2026-05-19 交付记录
1. 已接入 Storybook 10 + `@storybook/react-vite`，新增 `storybook` / `build-storybook` 脚本。
2. 已新增应用内 `design-system` 路由、Sidebar 入口、hash 持久化、双语导航文案。
3. 第一批 stories 覆盖 3 个分组、9 个条目：tokens、primitives、components。
4. 验证通过：
   - `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
   - `npm --prefix frontend run test:unit`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
   - `npm --prefix frontend run build-storybook`
5. 浏览器验收通过：
   - Storybook `Design System/Tokens/Colors` 可渲染 CSS token。
   - Storybook toolbar 暴露 GetTokens theme mode / text scale。
   - 应用内 `#frame=design-system` 可打开，覆盖矩阵显示 3 个分组、9 个 stories。
6. 已知非阻塞项：
   - Storybook build 有大 chunk 警告，属于 Storybook/DocsRenderer 常见产物，不影响构建成功。
   - Vite dev server 请求 `favicon.ico` 返回 404，和本期设计系统入口无关。

## 2026-05-19 本地化补充
1. Storybook preview toolbar 已新增 `GetTokens preview language`，支持 `中文` / `English`。
2. 默认语言为中文，并同步设置 iframe `document.documentElement.lang` 为 `zh-CN`；切换英文时同步为 `en`。
3. 首批 stories 的示例文案已接入 GetTokens `I18nProvider`，覆盖：
   - `SegmentedControl`
   - `ToggleSwitch`
   - `ActionSelect`
   - `Combobox`
   - `WorkspacePageHeader`
   - `ColorTokens`
   - `TypographyTokens`
   - `SwissPrimitives`
4. 说明：Storybook 左侧导航、Controls、onboarding 等管理界面属于 Storybook 自身 UI，本期不做非官方汉化；GetTokens 组件预览内容支持中英文切换。
5. 本地化截图：`screenshots/20260519/design-system/20260519-design-system-storybook-locale-zh-after-v01.png`

## 2026-05-19 Story 状态总览补充
1. 设计系统里的组件 story 不应只依赖单状态切换；复杂组件需要提供一个 `Overview` story，把关键状态放在同一页面，方便主题、字号、密度和截图回归。
2. `ActionSelect` 已新增 `Overview`，同屏展示：
   - 仅创建
   - 创建和删除
   - 长内容
   - 禁用
3. 单状态 stories 仍保留，便于单独调试交互。
4. 验收 URL：`http://127.0.0.1:6006/?path=/story/design-system-components-actionselect--overview&globals=locale:zh`
5. 截图：`screenshots/20260519/design-system/20260519-design-system-actionselect-overview-zh-after-v01.png`

## 2026-05-19 Overview 推广
1. `Overview` 状态矩阵已推广到首批全部 component stories：
   - `ActionSelect`
   - `Combobox`
   - `PageLoadingFallback`
   - `SegmentedControl`
   - `ToggleSwitch`
   - `WorkspacePageHeader`
2. 新增测试门禁：`frontend/src/features/design-system/storyCatalog.test.mjs` 会检查 `components` 分组下每个 story 文件都导出 `Overview`。
3. 规则已同步到 `gettokens-domain-engineering` skill 的 Storybook Scope：组件 stories 必须有 `Overview` 状态矩阵，单状态 stories 保留用于隔离调试。
4. 截图：`screenshots/20260519/design-system/20260519-design-system-components-overview-zh-after-v01.png`

## 2026-05-19 设计系统准入边框
1. 为已纳入设计系统的组件新增统一准入标记：`DesignSystemStoryFrame`。
2. 标记样式：
   - 红色虚线外边框
   - 右上角 `DS` 标签
   - `data-design-system-component="true"` 属性，方便后续截图或自动化检查
3. 首批 component stories 已全部套用该标记，覆盖 `Overview` 和单状态 stories。
4. `storyCatalog.test.mjs` 已增加门禁：`components` 分组里的每个 story 文件必须使用 `DesignSystemStoryFrame`。
5. 边界：该边框只用于 Storybook / 设计系统预览，不改真实业务运行时组件外观。
6. 截图：`screenshots/20260519/design-system/20260519-design-system-admitted-border-zh-after-v01.png`
