# Design System Workbench Technical Design v02

## 结论
本期改为 Storybook 主线：使用 `@storybook/react-vite` 建立 GetTokens 的设计系统工作台，应用内 `design-system` 路由只作为入口、说明和后续开发态索引，不再自研完整组件工作台。

这个调整更合理：Storybook 官方定位就是前端 UI 组件和页面的隔离开发工作台，支持组件文档、Controls、Docs、主题切换和独立构建。GetTokens 当前是 React + Vite，Storybook 有官方 React/Vite 框架适配，能减少我们自研预览器、Controls、Docs、story URL、截图入口的成本。

## 方案对比
### 方案 A：Storybook 主工作台 + 应用内入口
摘要：Storybook 承载真实组件预览和文档；GetTokens 内新增 `design-system` 页面作为入口和说明。

成本：中。需要新增 devDependency、`.storybook` 配置、stories、脚本和截图流程。

风险：中低。新增依赖只在前端开发链路，不影响 Wails runtime 和 sidecar。

建立在：`React 18`、`Vite 5`、`Tailwind 3`、`style.css`、`components/ui`。

结论：推荐。

### 方案 B：应用内自研工作台
摘要：在 GetTokens App shell 内自己实现组件 catalog、Controls、状态筛选、文档和截图入口。

成本：中到高。短期看少一个依赖，长期会重复造 Storybook 已解决的问题。

风险：中。自研 preview 与业务页面边界容易混在一起，Controls、Docs、story URL 都要自己维护。

结论：不再作为主线，可保留轻量入口页。

### 方案 C：静态 HTML 设计稿
摘要：在 space 根目录放独立 HTML 设计系统草稿。

成本：低。

风险：高。无法复用真实 React 组件，容易和代码漂移。

结论：不推荐。

## 架构边界
```
frontend/
  .storybook/
    main.ts
    preview.ts
    manager.ts
  src/
    style.css
    context/
      ThemeContext.tsx
      TextScaleContext.tsx
      I18nContext.tsx
    components/ui/
      *.tsx
      *.stories.tsx
    features/design-system/
      DesignSystemEntryFeature.tsx
      storyCatalog.ts
      storyCatalog.test.mjs
    pages/
      DesignSystemPage.tsx
```

运行路径：

1. 组件预览：`npm --prefix frontend run storybook` -> `http://127.0.0.1:6006`
2. 静态构建：`npm --prefix frontend run build-storybook`
3. 应用内入口：`#frame=design-system` -> `DesignSystemPage` -> 展示 Storybook 地址、启动命令、当前覆盖范围和注意事项。

## 文件改动计划
### Storybook 接入
1. `frontend/package.json`
   - 新增脚本：
     - `storybook`: `storybook dev -p 6006`
     - `build-storybook`: `storybook build`
   - 新增 devDependencies：
     - `storybook`
     - `@storybook/react-vite`
     - 视 init 结果保留必要官方 addons。
2. `frontend/.storybook/main.ts`
   - `framework.name = '@storybook/react-vite'`
   - `stories` 覆盖 `../src/**/*.stories.@(ts|tsx|mdx)`。
   - `docs.autodocs = true`。
3. `frontend/.storybook/preview.ts`
   - 导入 `../src/style.css`。
   - 用 decorator 包住 stories，提供 `ThemeProvider`、`TextScaleProvider`、`I18nProvider`。
   - 增加 theme / text-scale globals，便于在 toolbar 或 controls 中切换。
4. `frontend/.storybook/manager.ts`
   - 可选：配置 Storybook UI 品牌名为 GetTokens Design System。

### 应用内入口
1. `frontend/src/types.ts`
   - `AppPage` 增加 `design-system`。
2. `frontend/src/utils/pagePersistence.ts`
   - `appPages` 增加 `design-system`。
   - `readFrameHashState('#frame=design-system')` 返回 `{ page: 'design-system' }`。
   - `buildFrameHash('design-system', ...)` 输出 `#frame=design-system`。
3. `frontend/src/App.tsx`
   - lazy import `DesignSystemPage`。
4. `frontend/src/components/biz/Sidebar.tsx`
   - `navItems` 增加设计系统入口。
5. `frontend/src/pages/DesignSystemPage.tsx`
   - 转发到 `DesignSystemEntryFeature`。
6. `frontend/src/features/design-system/DesignSystemEntryFeature.tsx`
   - 展示 Storybook 启动命令、默认地址、覆盖清单、截图输出路径。
   - 不承载完整组件预览。
7. `frontend/src/features/design-system/storyCatalog.ts`
   - 维护 story 分组元数据，供入口页和测试读取。

### Stories 第一批
1. `frontend/src/components/ui/SegmentedControl.stories.tsx`
2. `frontend/src/components/ui/ToggleSwitch.stories.tsx`
3. `frontend/src/components/ui/ActionSelect.stories.tsx`
4. `frontend/src/components/ui/Combobox.stories.tsx`
5. `frontend/src/components/ui/WorkspacePageHeader.stories.tsx`
6. `frontend/src/components/ui/PageLoadingFallback.stories.tsx`
7. `frontend/src/stories/tokens/ColorTokens.stories.tsx`
8. `frontend/src/stories/tokens/TypographyTokens.stories.tsx`
9. `frontend/src/stories/primitives/SwissPrimitives.stories.tsx`

## Story 编写规则
1. 每个 story 文件必须导出 typed `Meta` 和 `StoryObj`。
2. 每个基础组件至少覆盖：
   - default
   - disabled
   - long content
   - density / compact state when applicable
3. 需要交互的组件使用 story 本地 state，不写 `localStorage`，不调用 Wails。
4. stories 只使用 mock 数据，禁止调用 `window.go.main.App`。
5. 组件标题按层级组织：
   - `Design System/Tokens/Colors`
   - `Design System/Primitives/Button`
   - `Design System/Components/SegmentedControl`
   - `Design System/Overlays/Placeholder`

## 主题与 Provider
Storybook preview decorator 使用真实 provider，但不能让 story 改写真实用户本地设置。

实现策略：

1. `ThemeProvider` 当前会读写 `localStorage.theme-mode`，Storybook 里需要确认是否可接受。
2. 如果不希望污染本地设置，抽一个更底层的 `ThemeRuntimeProvider` 或给 `ThemeProvider` 增加 storage 注入能力。
3. 一期可接受临时写 Storybook iframe localStorage，因为它运行在 `localhost:6006`，与 Wails 应用 origin 分离。
4. `TextScaleProvider` 同理优先复用现有 provider，必要时再抽 storage adapter。

## 应用内 `design-system` 页面职责
这个页面不是组件工作台，只做四件事：

1. 告诉维护者 Storybook 是设计系统主入口。
2. 展示启动命令：`npm --prefix frontend run storybook`。
3. 展示默认地址：`http://127.0.0.1:6006`。
4. 展示当前 story 覆盖矩阵和截图输出路径。

如果未来要给最终用户隐藏该入口，可以加开发开关；当前先常驻 Sidebar，便于团队发现。

## 测试策略
### 红灯测试
1. `pagePersistence.test.mjs` 增加 `design-system` 用例，确认当前实现失败。
2. `features/design-system/storyCatalog.test.mjs` 断言 catalog 分组不为空、story id 唯一、每个 story 有文件路径和标题。

### 绿灯实现后
1. `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
2. `npm --prefix frontend run test:unit`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`
5. `npm --prefix frontend run build-storybook`

### 浏览器验收
1. 启动 Storybook：`npm --prefix frontend run storybook`
2. 打开 `http://127.0.0.1:6006`。
3. 检查：
   - 能看到 `Design System` 分组。
   - `style.css` token 生效。
   - `SegmentedControl`、`ToggleSwitch`、`Combobox` 等 story 正常渲染。
   - 切换主题或文字缩放后不出现明显溢出。
4. 应用内入口验收：
   - 启动 GetTokens 前端。
   - 打开 `#frame=design-system`。
   - Sidebar 高亮设计系统。
   - 页面展示 Storybook 启动命令和覆盖矩阵。
5. 截图路径：
   - `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png`

## 可回滚性
本期不改后端、不写业务数据、不改 sidecar 配置。回滚范围：

1. `frontend/.storybook/`
2. `frontend/src/**/*.stories.tsx`
3. `frontend/package.json` / `frontend/package-lock.json` 中 Storybook 相关依赖和脚本。
4. 应用内 `design-system` 入口相关文件。

回滚不会影响账号、代理、Codex 或设置业务数据。

## 实施确认
2026-05-19 已按本方案落地 Storybook 主工作台和应用内入口。

关键实现：

1. Storybook 配置：
   - `frontend/.storybook/main.ts`
   - `frontend/.storybook/preview.tsx`
2. 应用内入口：
   - `frontend/src/pages/DesignSystemPage.tsx`
   - `frontend/src/features/design-system/DesignSystemEntryFeature.tsx`
   - `frontend/src/features/design-system/storyCatalog.ts`
3. 第一批 stories：
   - `frontend/src/components/ui/*.stories.tsx`
   - `frontend/src/stories/tokens/*.stories.tsx`
   - `frontend/src/stories/primitives/*.stories.tsx`
4. 路由接入：
   - `frontend/src/types.ts`
   - `frontend/src/utils/pagePersistence.ts`
   - `frontend/src/App.tsx`
   - `frontend/src/components/biz/Sidebar.tsx`

验证已通过：

1. `npm --prefix frontend run test:unit`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build`
4. `npm --prefix frontend run build-storybook`
5. 浏览器打开 `http://127.0.0.1:6006` 和 `http://127.0.0.1:5173/#frame=design-system`

首期验收截图：

1. `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png`
2. `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-app-route-web-after-v01.png`

## 风险与约束
1. Storybook 是额外开发服务器，团队需要记住启动命令；用应用内入口和 README 降低发现成本。
2. Storybook iframe 的 CSS 与 Wails WebView 可能存在细微差异；关键页面仍需在真实应用内验收。
3. stories 如果直接复用业务组件，可能引入 Wails binding 依赖；一期只覆盖 `components/ui` 和 mock 数据。
4. Storybook 依赖升级可能带来配置 churn；锁定 package-lock，避免无计划升级。

## 官方资料
1. Storybook 官网：定位为前端 UI 组件和页面的隔离开发工作台。
   - https://storybook.js.org/
2. Storybook 安装文档：官方推荐 `npm create storybook@latest`。
   - https://storybook.js.org/docs/get-started/install
3. Storybook React/Vite：官方 `@storybook/react-vite` 框架适配当前项目栈。
   - https://storybook.js.org/docs/get-started/frameworks/react-vite
4. Storybook Browse Stories：Docs、Controls 和 story 浏览是核心能力。
   - https://storybook.js.org/docs/get-started/browse-stories
5. Storybook Themes：官方 addon 支持主题切换 decorators。
   - https://storybook.js.org/docs/essentials/themes
