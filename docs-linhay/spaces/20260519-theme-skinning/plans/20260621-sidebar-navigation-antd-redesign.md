# 侧边导航菜单 AntD Navigation 重制

## 背景

用户要求按照 Ant Design Navigation 规范重新设计 GetTokens 左侧侧边导航菜单。官方 Navigation 规范强调：导航要告诉用户当前在哪里、能去哪里、如何到达；导航样式和行为应保持一致，降低学习成本；侧边导航适合信息层级多、操作切换频率高的管理型应用。

## 范围

- 只改左侧主导航菜单和其导航视觉、展开行为。
- 不改变 AppPage、CodexWorkspace、ClaudeWorkspace、hash 路由语义。
- 不新增移动端适配，不恢复暗色或过渡视觉系统。
- 保持 modal sidebar offset 变量：展开 15rem，折叠 4.75rem。

## 设计目标

- 使用 AntD Menu 作为侧边导航主体，替代自定义 button 列表和自定义 portal submenu。
- 展开态用 inline Menu 展示一级和二级导航，当前工作区分组保持打开，让用户知道当前位置。
- 折叠态使用 AntD inlineCollapsed 处理图标菜单和二级弹出，避免自定义 hover 行为分叉。
- 菜单 token 对齐 GetTokens AntD 主题：32px item height、6px item radius、16px icon、AntD blue selected state、neutral hover。
- 保留底部版本号和更新入口，但视觉继续使用 AntD 400/600 字重与 palette-only 色彩。

## 验收

- Sidebar 源码测试确认使用 AntD Menu、items、selectedKeys、openKeys、inlineCollapsed。
- Sidebar 源码测试确认不再使用 createPortal / 自定义 Submenu / 手写 submenu role menu。
- AntD theme 测试固定 Menu token：itemHeight、itemBorderRadius、collapsedWidth、selected / hover 色。
- 浏览器截图确认展开态一级/二级导航层级清晰，折叠态仍可见图标导航。
- node --test frontend/src/components/biz/sidebarState.test.mjs frontend/src/context/antdTheme.test.mjs、npm --prefix frontend run typecheck 通过。

## 实施记录

- Sidebar 主导航由自定义 button 列表和自定义 Submenu portal 改为 AntD Menu inline 模式。
- 展开态使用 openKeys 保持当前一级分组上下文；点击 Codex / Claude 分组标题会先切换到对应页面，再打开分组。
- 折叠态使用 AntD inlineCollapsed，不再维护单独 hover submenu 分支。
- AntD 全局主题新增 Menu component token：32px item height、6px item radius、76px collapsed width、AntD blue selected state、neutral hover。
- 侧栏宽度与 App modal offset 对齐：展开 15rem，折叠 4.75rem。

## 验收证据

- 官方规范来源：Ant Design Navigation 中文规范，https://ant.design/docs/spec/navigation-cn/
- 源码测试：node --test frontend/src/components/biz/sidebarState.test.mjs frontend/src/context/antdTheme.test.mjs 通过，8 pass。
- 类型检查：npm --prefix frontend run typecheck 通过。
- AntD 合约与 legacy residue：node --test frontend/src/context/antdColorContract.test.mjs frontend/src/features/design-system/legacyStyleResidue.test.mjs 通过，5 pass。
- 完整前端单测：npm --prefix frontend run test:unit 通过。
- 生产构建：npm --prefix frontend run build 通过，仅保留既有 Vite chunk size warning。
- 浏览器验收：展开态和折叠态均已截图；展开截图 docs-linhay/spaces/20260519-theme-skinning/screenshots/20260621/sidebar-navigation/20260621-sidebar-navigation-expanded-after-v01.png，折叠截图 docs-linhay/spaces/20260519-theme-skinning/screenshots/20260621/sidebar-navigation/20260621-sidebar-navigation-collapsed-after-v01.png。
- 控制台验收：warnings 为 0；剩余 favicon 404 和 browser preview 缺少 Wails runtime 的 window.go.main 错误属于既有预览边界。

## Session Skill Distillation

- 候选模式：GetTokens 主应用侧边导航应以 AntD Menu 为权威交互组件，使用 openKeys / selectedKeys / inlineCollapsed 表达层级、当前位置和折叠态，避免自定义 hover portal 与展开态行为分叉。
- 决策：这是侧边导航专属实现模式，已由本 plan 和源码测试固定；暂不新增 skill、不更新 AGENTS.md。若后续还有其他导航容器重构，再沉淀进 gettokens-frontend-design-quality。
- 沉淀判断：本轮是 AntD design-language contract 在侧边导航的具体落地；已有 antd / gettokens-frontend-design-quality skill 覆盖原则层，当前只写回本 plan 与 memory。

## 2026-07-07 折叠态宽度修正

### 问题来源

- 用户在 `http://127.0.0.1:34115/#frame=codex&workspace=account-list` 浏览器批注侧栏菜单：菜单项“没对齐，还超出父容器了”。

### 当前事实位置

- `frontend/src/components/biz/Sidebar.tsx` 的折叠态侧栏宽度为 `4.75rem`，即 76px。
- `frontend/src/context/antdTheme.ts` 固定 AntD Menu `collapsedWidth: 76`。
- 旧 `nav` 同时保留 `px-2`，导致 76px collapsed Menu 从 `x=8` 开始布局，菜单右边界到 `84px`，超过 `aside` 右边界 `76px`。

### 修复

- 折叠态 `nav` 横向 padding 改为 `px-0`；展开态继续保留 `px-2`。
- `Menu` 增加 `w-full min-w-0 overflow-x-hidden`，并在 `style.css` 中为 `.gt-sidebar-menu.ant-menu-inline-collapsed` 固定 `width: 100%; min-width: 0;`。
- `Menu` 设置 `inlineIndent={18}`，使展开态二级导航缩进与 15rem 侧栏宽度匹配。

### 验收证据

- 红灯测试：新增 `sidebar collapsed menu stays inside the fixed-width rail` 源码契约，先在旧实现下失败。
- 自动化：`node --test frontend/src/components/biz/sidebarState.test.mjs` 通过，7 pass。
- AntD lint：`antd lint frontend/src/components/biz/Sidebar.tsx --format json` 无 issue。
- 类型检查：`npm --prefix frontend run typecheck` 通过。
- 浏览器几何验收：866x964 视口、折叠态下 `aside.right=76`、`menu.right=75`、`maxItemRight=71`，`nav/menu/item` 均无横向溢出。

### 沉淀判断

- 这是既有侧栏 AntD Menu contract 的折叠态宽度补丁，复用当前 plan 和源码测试即可；不新增项目级 skill，不更新 `AGENTS.md`。
