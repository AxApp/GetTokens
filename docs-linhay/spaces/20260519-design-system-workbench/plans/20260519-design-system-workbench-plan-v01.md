# Design System Workbench Plan v01

> 状态：已被 [Plan v02](20260519-design-system-workbench-plan-v02.md) 取代。v01 保留为历史方案记录；当前实施以 Storybook 主工作台 + 应用内入口为准。

## 需求边界
本期要交付的是一个可运行的设计系统工作台路由，而不是静态设计稿。它应成为后续主题、换肤、基础组件治理和 headless primitive spike 的验收场地。

## 当前基线
1. 前端页面由 `frontend/src/types.ts` 的 `AppPage` 联合类型驱动。
2. `frontend/src/App.tsx` 根据 `activePage` 懒加载真实页面。
3. `frontend/src/hooks/useAppNavigation.ts` 负责读取本地存储、解析 hash、持久化当前页面。
4. `frontend/src/components/biz/Sidebar.tsx` 管理主导航入口。
5. 当前基础组件集中在 `frontend/src/components/ui/`，业务组件分散在 `frontend/src/features/**/components/`。
6. 技术细节以 [Technical Design v01](20260519-design-system-workbench-technical-design-v01.md) 为准：一期采用应用内 `design-system` 路由，不引入 Storybook、React Router 或新的 UI 框架依赖。

## BDD 场景
### 场景 1：设计系统路由持久化
Given `localStorage.active-page = "design-system"`
When 应用启动
Then `readStoredActivePage` 返回 `design-system`
And `AppShell` 渲染设计系统页面。

### 场景 2：hash 直达设计系统
Given 当前 URL hash 为 `#frame=design-system`
When `useAppNavigation` 初始化
Then 应用进入设计系统页面。

### 场景 3：基础组件 catalog 可测试
Given 设计系统组件 catalog 已定义
When 运行单元测试
Then 每个基础组件分组都有稳定 id、标题、描述和至少一个 preview case。

### 场景 4：无 Wails 运行时也可预览
Given 通过浏览器访问 Vite dev server
When 打开 `#frame=design-system`
Then 页面不调用 `window.go.main.App`
And 可正常展示 preview 数据。

## 实施步骤
### 阶段 1：路由接入
1. `AppPage` 增加 `design-system`。
2. `pagePersistence` 支持读写 `design-system`。
3. `App.tsx` 新增 `DesignSystemPage` lazy import 和分发。
4. `Sidebar` 增加入口和图标。
5. `zh.json` / `en.json` 增加导航文案。
6. 补 `pagePersistence` 相关单元测试。
7. 先提交红灯测试，确认当前 `isAppPage`、`readFrameHashState`、`buildFrameHash` 尚不支持 `design-system`。

### 阶段 2：工作台页面骨架
1. 新建 `frontend/src/pages/DesignSystemPage.tsx`。
2. 新建 `frontend/src/features/design-system/DesignSystemFeature.tsx`。
3. 新建 `frontend/src/features/design-system/catalog.ts`，定义组件分组和 preview cases。
4. 新建 `tokenCatalog.ts`、`sampleData.ts`、`model.ts`，把展示元数据、样本值和纯函数从页面文件里拆开。
5. 页面采用工作台布局：左侧分组导航 / 顶部筛选 / 右侧预览区。
6. 支持展示 token、组件、状态、表单、overlay 占位区。

### 阶段 3：基础组件预览
1. 覆盖 `SegmentedControl`、`ToggleSwitch`、`ActionSelect`、`Combobox`。
2. 覆盖全局样式类：`btn-swiss`、`card-swiss`、`input-swiss`、`select-swiss`。
3. 补基础状态：default、hover 说明、active、disabled、loading、success、warning、danger。
4. 补文字缩放检查区，展示长中文、长英文、数字、代码样式。

### 阶段 4：截图和验收
1. 增加 browser check 脚本，打开 `#frame=design-system`。
2. 输出截图到 `docs-linhay/spaces/20260519-design-system-workbench/screenshots/`。
3. 跑 `npm --prefix frontend run test:unit`、`typecheck`、`build`。
4. 若涉及 Wails shell 导航，补做桌面验证。

## TDD 计划
1. 先改 `pagePersistence` 测试，确认 `design-system` 在当前实现下会失败。
2. 再实现 AppPage / hash / localStorage 支持。
3. 新增 catalog model 测试，确保每组 preview 不为空。
4. 最后实现页面 UI，让测试和浏览器截图通过。
5. 第一批验证命令：
   - `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/model.test.mjs`
   - `npm --prefix frontend run test:unit`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`

## 设计原则
1. 第一屏展示真实组件预览，不做介绍型 landing page。
2. 所有 preview 使用本地 mock 数据，不依赖后端或 Wails runtime。
3. 工作台本身也必须使用同一套 token，不能成为独立风格。
4. 每个组件 preview 都要同时展示正常、禁用、异常、长文本状态。
5. 未来引入 Radix / React Aria 时，先在工作台落 wrapper，再迁移业务页面。

## 风险
1. `AppPage` 和 hash 解析如果漏改，刷新或直达会回退到默认页面。
2. 预览页面如果直接复用业务组件，可能意外触发真实 API。
3. 组件 catalog 过早追求完整，可能导致本期膨胀；先覆盖基础组件，再扩业务组件。
4. 设计系统入口是否常驻 Sidebar 需要后续确认：若正式用户不需要，可放到 Debug 或开发开关后面。

## 待确认
1. Sidebar 入口是否对所有用户可见，还是仅开发 / Debug 模式可见。
2. 工作台是否需要支持主题一键切换控件，还是复用设置页的全局主题设置。
3. 第一批是否只覆盖 `components/ui`，还是同步纳入账号卡片等业务组件。
