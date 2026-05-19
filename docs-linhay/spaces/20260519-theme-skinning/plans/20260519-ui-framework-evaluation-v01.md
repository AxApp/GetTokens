# UI Framework Evaluation v01

## 问题
主题 / 换肤提上日程后，需要判断 GetTokens 是否应该接入 UI 框架。这里的核心不是“少写样式”，而是：

1. 主题 token 能否统一。
2. 复杂交互组件的可访问性和焦点管理能否稳定。
3. 现有高密度、强风格的 GetTokens UI 是否会被预设框架稀释。
4. 后续维护者能否在不理解整套外部组件体系的情况下继续改业务页面。

## 当前基线
1. 前端栈是 `React 18 + Vite + Tailwind 3 + TypeScript`。
2. 当前依赖里没有 Ant Design、MUI、Chakra、Mantine、Radix、Headless UI、React Aria 或 shadcn/ui。
3. 已有少量自研基础组件：
   - `SegmentedControl`
   - `Combobox`
   - `ActionSelect`
   - `ToggleSwitch`
   - `PageLoadingFallback`
   - `WorkspacePageHeader`
4. 全局主题目前靠 `frontend/src/style.css` 中的 CSS 变量承载：`--bg-main`、`--bg-surface`、`--border-color`、`--text-primary`、`--text-muted` 等。
5. 复杂交互已有手写实现，例如 `Combobox` 自己处理 portal、定位、outside click、Escape，但还缺少完整 option keyboard navigation、active descendant 等细节。
6. 一些弹窗和菜单是手写的，部分有 `role="dialog"` / `aria-modal`，但焦点锁定、返回焦点、嵌套弹层和键盘路径还没有统一基础设施。

## 外部选项
### 选项 A：大而全预设组件库
代表：MUI、Mantine、Ant Design、Chakra。

优点：
1. 表单、弹窗、菜单、布局、通知等组件覆盖完整。
2. 官方主题系统成熟，MUI 和 Mantine 都支持 CSS variables / theme provider。
3. 新功能落地速度快。

缺点：
1. 会引入强视觉范式，容易冲掉 GetTokens 当前的高密度、硬边框、终端式产品气质。
2. 主题系统会和现有 CSS token 形成双轨，迁移面大。
3. 组件 API 会反向塑造页面结构，后续业务页面可能越来越像框架默认后台。
4. 为了保持现有风格，需要大量覆盖样式，维护成本可能不低于自研。

判断：不建议作为主题 / 换肤一期方案。

### 选项 B：headless / unstyled primitives
代表：Radix Primitives、React Aria Components、Headless UI。

优点：
1. 保留 GetTokens 自己的视觉和 token。
2. 把复杂交互中的 ARIA、焦点管理、键盘导航交给成熟 primitives。
3. 可以渐进替换：先从 Dialog、Popover、Dropdown Menu、Select、Tooltip 开始。
4. 与 Tailwind 和 CSS variables 兼容，适合现有技术栈。

缺点：
1. 仍需要自己写样式和主题 token。
2. 需要建立本项目的 wrapper 层，避免业务页面直接散用第三方 primitive。
3. React Aria 能力更完整但 API 学习成本较高；Radix 更贴近当前组合方式。

判断：建议作为一期引入方向。

### 选项 C：shadcn/ui 式组件源码治理
shadcn/ui 本质更像“复制组件源码 + Tailwind + CSS variables 的组件规范”，不是传统 npm 黑盒组件库。

优点：
1. 主题 token 思路与 GetTokens 当前 CSS variables 方向一致。
2. 可选择性借鉴 token 命名、组件结构和 Radix primitive 包装方式。
3. 组件源码留在项目内，便于按 GetTokens 风格深改。

缺点：
1. 默认视觉已经很常见，不能直接照搬。
2. CLI 生成体系会带来目录、别名、工具函数等约束，可能和现有项目结构冲突。
3. 若直接批量引入，会形成第二套 UI 语言。

判断：建议借鉴它的 token / wrapper 模式，不建议整套初始化。

## 推荐结论
不接入完整预设 UI 框架；接入“主题 token + 自有 UI 组件 + headless primitives”的组合。

推荐路径：

1. 保留 Tailwind + CSS variables 作为主题核心。
2. 建立 `frontend/src/components/ui/primitives/` 或类似目录，封装第三方 primitive，不让业务页面直接依赖外部库。
3. 第一批只评估并引入 Radix Primitives 的 `Dialog`、`Popover`、`DropdownMenu`、`Select`、`Tooltip`，或用 React Aria Components 做同类对比。
4. shadcn/ui 只作为 token 命名和组件 wrapper 参考，不执行全量 `init`。
5. 主题一期先解决 token 契约、设置入口、预览和核心页面回归；组件 primitive 替换跟着高风险控件逐步做。

## 一期建议依赖
优先候选：

1. `@radix-ui/react-dialog`
2. `@radix-ui/react-popover`
3. `@radix-ui/react-dropdown-menu`
4. `@radix-ui/react-select`
5. `@radix-ui/react-tooltip`

备选评估：

1. `react-aria-components`

暂不建议：

1. `@mui/material`
2. `@mantine/core`
3. `antd`
4. `@chakra-ui/react`

## 官方资料
1. Radix Primitives：官方定位是低层级、可访问、可自定义 primitives，并由调用方完全控制样式。
   - https://www.radix-ui.com/primitives/docs
   - https://www.radix-ui.com/primitives/docs/guides/styling
2. React Aria Components：官方组件通过 className 和 data attributes 暴露样式状态，适合自定义 CSS。
   - https://react-spectrum.adobe.com/react-aria/getting-started.html
3. shadcn/ui Theming：官方推荐 CSS variables 和语义 token。
   - https://ui.shadcn.com/docs/theming
4. Tailwind Dark Mode：官方支持用自定义 selector 或 data attribute 驱动 dark variant。
   - https://tailwindcss.com/docs/dark-mode
5. MUI Theming / CSS variables：
   - https://mui.com/material-ui/customization/theming/
   - https://mui.com/material-ui/customization/css-theme-variables/overview/
6. Mantine CSS variables：
   - https://mantine.dev/styles/css-variables

## 后续动作
1. 做一个最小 spike：用 Radix `Dialog` 替换或新建一个非核心弹窗 wrapper，验证焦点、Escape、overlay click、主题 token。
2. 同时保留现有视觉类名，不改变业务页面布局。
3. 如果 spike 成本可控，再把 `Combobox` / Select 类交互纳入第二批。
4. 如果 Radix 与现有结构冲突，再用 React Aria Components 做同样 spike 对比。
