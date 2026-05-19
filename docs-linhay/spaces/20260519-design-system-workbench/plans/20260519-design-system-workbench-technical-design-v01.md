# Design System Workbench Technical Design v01

> 状态：已被 [Technical Design v02](20260519-design-system-workbench-technical-design-v02.md) 取代。v01 保留为历史方案记录；当前实施以 Storybook 主工作台 + 应用内入口为准。

## 结论
本期采用“应用内设计系统工作台”方案：在现有 GetTokens shell 内新增 `design-system` 页面，用同一套主题 token、导航、文字缩放和构建链路承载基础组件预览。

Storybook 是组件文档和隔离开发的官方成熟方案，但本期不作为第一步引入。原因是用户明确需要“独立的前端路由前往我们的设计系统”，并且 GetTokens 当前是 Wails 桌面壳 + hash frame 导航；应用内路由能直接复用真实主题、Sidebar、文本缩放和截图脚本。后续可以把本期 catalog 抽象为 Storybook stories 的数据来源，避免重复维护。

## 方案对比
### 方案 A：应用内 `design-system` 路由
摘要：在现有 App shell 中新增页面和 Sidebar 入口，预览基础组件和 token。

成本：中。主要改前端路由、页面骨架、catalog 和测试。

风险：低。无新增运行时依赖，不碰后端和 sidecar。

建立在：`AppPage`、`useAppNavigation`、`pagePersistence`、`Sidebar`、`components/ui`、`style.css`。

结论：推荐。

### 方案 B：接入 Storybook
摘要：用 Storybook 建独立组件工作台和文档站。

成本：中到高。需要新增 devDependency、配置 Vite/React、主题 provider 包装、截图链路和构建脚本。

风险：中。组件在 Storybook 里的主题环境可能和 Wails 应用不同步，且短期不能满足应用内路由入口。

建立在：`components/ui` 和后续可抽象的 catalog。

结论：作为二期增强，不作为本期主线。

### 方案 C：只写静态 HTML 设计稿
摘要：在 space 根目录放一个 HTML 设计系统草稿。

成本：低。

风险：高。无法复用真实 React 组件，容易和代码漂移。

建立在：现有 space 设计稿规范。

结论：不推荐。本期目标是可运行组件工作台。

## 架构边界
```
Sidebar
  -> setActivePage("design-system")
  -> useAppNavigation
       -> pagePersistence
       -> #frame=design-system
  -> AppShell
       -> DesignSystemPage
       -> DesignSystemFeature
            -> catalog / tokenCatalog / sampleData
            -> components/ui previews
            -> future primitive previews
```

关键边界：

1. `DesignSystemFeature` 不调用 Wails binding，不依赖 sidecar 状态。
2. 业务组件如账号卡片暂不进入第一批，避免带入真实 API 和复杂 hook。
3. 基础组件 preview 只读本地 mock 数据，交互状态留在页面内存，不写业务配置。
4. 所有视觉都使用现有 `style.css` token 和基础类，工作台本身不能有独立主题。

## 文件改动计划
### 路由与导航
1. `frontend/src/types.ts`
   - `AppPage` 增加 `design-system`。
2. `frontend/src/utils/pagePersistence.ts`
   - `appPages` 增加 `design-system`。
   - `readFrameHashState("#frame=design-system")` 返回 `{ page: "design-system" }`。
   - `buildFrameHash("design-system", ...)` 输出 `#frame=design-system`。
3. `frontend/src/utils/pagePersistence.test.mjs`
   - `isAppPage("design-system") === true`。
   - `resolveInitialActivePage("design-system") === "design-system"`。
   - `persistActivePage(..., "design-system")` 写入该值。
   - `readFrameHashState("#frame=design-system")` 正确解析。
   - `buildFrameHash("design-system", ...)` 正确序列化。
4. `frontend/src/App.tsx`
   - lazy import `DesignSystemPage`。
   - 在 page 分发里新增 `activePage === "design-system"` 分支。
5. `frontend/src/components/biz/Sidebar.tsx`
   - `navItems` 增加 `design-system`。
   - 图标使用手写 path 或后续统一迁移 lucide；本期保持 Sidebar 现有 path 模式以减少改动。
6. `frontend/src/locales/zh.json` / `frontend/src/locales/en.json`
   - 增加 `nav.design_system`。

### 页面与目录
1. `frontend/src/pages/DesignSystemPage.tsx`
   - 只转发到 `DesignSystemFeature`。
2. `frontend/src/features/design-system/DesignSystemFeature.tsx`
   - 页面主体，负责状态、筛选、分组导航和 preview 渲染。
3. `frontend/src/features/design-system/catalog.ts`
   - 定义 preview 分组元数据。
4. `frontend/src/features/design-system/tokenCatalog.ts`
   - 定义颜色、字体、空间、阴影、状态 token 清单。
5. `frontend/src/features/design-system/sampleData.ts`
   - 定义表单选项、长文本、状态样本、空状态样本。
6. `frontend/src/features/design-system/model.ts`
   - 放纯函数：分组过滤、preview 计数、状态标签组装等。
7. `frontend/src/features/design-system/model.test.mjs`
   - 测 catalog 完整性和纯函数。

## Catalog 数据模型
第一期不把 JSX 存在 catalog 里，避免把数据层变成渲染层。catalog 只描述分组与 case，具体渲染由 `DesignSystemFeature` 根据 `componentKey` 分发。

核心字段：

1. Section
   - `id`：稳定英文 slug，例如 `tokens`、`buttons`、`forms`、`overlays`。
   - `title`：显示标题。
   - `description`：用途说明，限制为一行可扫读文案。
   - `items`：preview case 列表。
2. Preview case
   - `id`：稳定英文 slug。
   - `componentKey`：渲染器 key，例如 `segmented-control`、`combobox`。
   - `title`：case 标题。
   - `state`：`default | disabled | loading | success | warning | danger | empty | long-content`。
   - `density`：`compact | normal | roomy`，一期可只渲染 `compact` 和 `normal`。
   - `notes`：面向维护者的约束说明。
3. Token item
   - `id`：CSS variable 名或语义名称。
   - `value`：CSS variable 引用，例如 `var(--bg-main)`。
   - `usage`：用途，例如主背景、正文、边框、强调色。

## 页面布局
页面是工具，不做 landing。

布局：

1. 顶部：`WorkspacePageHeader`
   - 标题：`DESIGN SYSTEM`
   - 副标题：`COMPONENT WORKBENCH / TOKENS / STATES`
   - 右侧放筛选：状态筛选、密度切换、仅显示问题态。
2. 主体：左右两栏
   - 左栏：section anchor nav，固定宽度，展示分组数量。
   - 右栏：preview grid，按 section 分块。
3. Preview card
   - 顶部：case 标题、状态徽标、组件 key。
   - 中部：真实组件实例。
   - 底部：token / 状态说明，不放长篇文档。

视觉方向：

1. 延续 GetTokens 当前 `Swiss-industrial workbench`：高密度、硬边、黑白主轴、红色少量强调。
2. 半径继续保持 0 到 2px，不引入圆角卡片语言。
3. 阴影继续使用 `var(--shadow-color)` 的硬投影，避免玻璃、渐变球或营销式背景。
4. 所有按钮保留 `active:scale-95` 或现有 `btn-swiss:active` 的按压反馈。

## 第一批 Preview 范围
### Token
1. 背景：`--bg-main`、`--bg-surface`、`--bg-muted`。
2. 文本：`--text-primary`、`--text-muted`。
3. 结构：`--border-color`、`--shadow-color`。
4. 强调：`--accent-red`。
5. 字号：`--font-size-ui-*`、`--line-height-ui-*`。

### 基础组件
1. `btn-swiss`
   - default、primary、danger、disabled、long label。
2. `card-swiss`
   - compact、with header、with dense content。
3. `input-swiss`
   - default、disabled、error、long value。
4. `select-swiss`
   - default、disabled、long option。
5. `SegmentedControl`
   - 3 options、4 options、long label。
6. `ToggleSwitch`
   - on、off、disabled。
7. `ActionSelect`
   - create only、create + delete、disabled。
8. `Combobox`
   - closed、open interaction、filter value、empty options。
9. `PageLoadingFallback`
   - loading surface。
10. `WorkspacePageHeader`
   - with actions、long subtitle。

### 状态与组合
1. Badge：neutral、success、warning、danger、muted。
2. Alert strip：info、warning、danger。
3. Empty state：无数据、过滤无结果。
4. Skeleton：列表骨架、卡片骨架。
5. Overlay 占位：Dialog、Popover、Dropdown、Tooltip，用于后续 Radix / React Aria spike。

## 状态管理
1. 页面本地 `useState` 只保存工作台自身状态：
   - active section
   - selected density
   - selected state filter
   - interactive sample values
2. 不写入 `localStorage`，避免污染真实用户设置。
3. 主题和文字缩放复用全局 `ThemeProvider` / `TextScaleProvider`，不在工作台内复制一套 provider。

## 依赖策略
一期不新增依赖。

二期若做 overlay primitive spike，优先用 Radix Primitives。官方定位是可访问、无样式、可渐进采用的低层级组件，适合 GetTokens 保留自有视觉。React Aria Components 作为备选，适合更复杂的键盘与组合控件，但学习成本更高。

暂不引入 React Router。React Router 官方推荐 `createBrowserRouter` 管理 web URL 和 history，但 GetTokens 当前使用 hash frame + Wails shell 语义，现有 `pagePersistence` 已覆盖本需求；引入 React Router 会扩大迁移面。

## 测试策略
### 红灯测试
1. 先在 `pagePersistence.test.mjs` 加 `design-system` 用例，当前实现应失败。
2. 新增 `features/design-system/model.test.mjs`，先断言 catalog 不为空、section id 唯一、case id 唯一、每个 case 有 componentKey 和 state。

### 绿灯实现后
1. `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/model.test.mjs`
2. `npm --prefix frontend run test:unit`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`

### 浏览器验收
1. 启动 Vite dev server。
2. 打开 `http://127.0.0.1:<port>/#frame=design-system`。
3. 检查：
   - Sidebar 高亮设计系统。
   - 刷新后仍停留在设计系统。
   - 控制台无 error。
   - 组件 preview 不依赖 Wails runtime。
4. 截图路径：
   - `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-workbench-web-after-v01.png`

## 可回滚性
本期不改后端、不写业务数据、不改 sidecar 配置。若方向不合适，回滚范围只包含：

1. `AppPage` 的 `design-system`。
2. `pagePersistence` 相关分支和测试。
3. Sidebar 入口与 locale。
4. `pages/DesignSystemPage.tsx`。
5. `features/design-system/` 目录。

回滚不会影响账号、代理、Codex 或设置业务数据。

## 攻击面检查
### 依赖失败
一期不新增依赖，失败面主要是现有 Vite / React 构建。可降级为隐藏 Sidebar 入口但保留文档和 space。

### 规模膨胀
如果 catalog 直接纳入业务组件，会迅速拖入 API、hook 和复杂数据。第一期只允许 `components/ui` 和 CSS 基础类，业务组件进入二期。

### 回滚成本
路由与页面都是前端本地改动，无数据迁移，回滚成本低。

### 前提崩塌
最脆弱的前提是“设计系统入口对真实用户可见是可接受的”。如果不可接受，入口应放到 Debug 页面或开发开关后，但 hash 路由和页面仍保留。

## 官方资料
1. Storybook 文档：可生成组件文档和设计系统站点，适合作为二期外部工作台。
   - https://storybook.js.org/docs/writing-docs
2. Storybook 官网：定位为前端 UI 组件和页面的隔离开发工作台。
   - https://storybook.js.org/
3. React Router `createBrowserRouter`：适合基于 DOM History API 的完整 Web 路由树；本期不引入是为了保持 Wails hash frame 语义。
   - https://reactrouter.com/api/data-routers/createBrowserRouter
4. Radix Primitives：低层级、可访问、无样式，可作为后续 overlay primitive 基础。
   - https://www.radix-ui.com/primitives/docs
   - https://www.radix-ui.com/primitives/docs/guides/styling
