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

## 2026-05-19 设计系统准入标记
1. 为已纳入设计系统的组件新增统一准入标记：`DesignSystemStoryFrame`。
2. 标记方式：
   - 保留 `data-design-system-component="true"` 属性，方便后续截图或自动化检查
   - 不在设计系统预览内绘制额外边框或角标，避免把“准入标记”误读为组件真实视觉
3. 首批 component stories 已全部套用该标记，覆盖 `Overview` 和单状态 stories。
4. `storyCatalog.test.mjs` 已增加门禁：`components` 分组里的每个 story 文件必须使用 `DesignSystemStoryFrame`。
5. 边界：圈定设计组件只用于真实项目页面里的识别或标注场景，设计系统内部不做可见框选。

## 2026-05-19 项目页面设计组件圈定
1. 根因纠正：此前只给 Storybook wrapper 加了 `data-design-system-component`，真实项目页面里的设计组件实例没有运行时标记，因此项目内不会圈红。
2. App dev 运行时在主框架根节点挂 `data-design-system-highlight="project"`，只在真实项目页面启用红色 outline。
3. 首批运行时基础设计组件已加 `data-design-system-component="true"` 与 `data-design-system-component-name`：
   - `ActionSelect`
   - `Combobox`
   - `PageLoadingFallback`
   - `SegmentedControl`
   - `ToggleSwitch`
   - `WorkspacePageHeader`
4. Storybook 没有 `data-design-system-highlight="project"` 根作用域，因此设计系统内部仍不显示可见框选或角标。

## 2026-05-19 Feature Components 第一批收编
1. 新增 `Design System/Feature Components/Debug Panel`，把调试面板里已经提取且不依赖 Wails 的组件纳入设计系统：
   - `DebugHeader`
   - `DebugEntryCard`
   - `DebugEmptyState`
2. 新 story 使用 mock 请求 / 响应数据，同屏覆盖：
   - 工具栏普通态 / 全选成功态
   - 成功日志卡片
   - 错误日志卡片
   - 折叠日志卡片
   - 空状态
3. `storyCatalog.test.mjs` 的门禁已扩展到 `components` 与 `feature-components` 两个分组，要求每个收编 story 都导出 `Overview` 且使用 `DesignSystemStoryFrame`。
4. 验证通过：
   - `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build-storybook`
5. 浏览器验收 URL：`http://127.0.0.1:6006/?path=/story/design-system-feature-components-debug-panel--overview`
6. 截图：`screenshots/20260519/design-system/20260519-design-system-debug-panel-overview-after-v01.png`

## 2026-05-19 收编 Manifest 与第二批 Feature Components
1. 新增 `frontend/src/features/design-system/componentManifest.ts`，把 feature 组件收编状态显式记录为：
   - `admitted`：已进入设计系统并有 Storybook / catalog / mock 数据
   - `candidate`：已发现，可用现有设计模式或新设计组件收编
   - `deferred`：暂缓，需拆 Wails / localStorage / 页面 controller 边界
   - `excluded`：不单独收编，通常是已有组件的薄包装或页面私有实现
2. `storyCatalog.test.mjs` 新增 manifest 门禁：
   - 扫描 `frontend/src/features/*/components/**/*.tsx`
   - 每个非 story 组件文件必须有 manifest 决策
   - `admitted` 项必须同步到 `feature-components` catalog
   - admitted story 禁止导入 Wails / `window.go` / sidecar / 真实请求
3. 第二批收编 `Design System/Feature Components/Codex Binary`，覆盖：
   - `CodexBinarySummaryPanel`
   - `CodexBinaryVersionList`
   - `CodexBinaryVersionCell`
4. 新 story 使用 `codexBinaryPreviewSnapshot` / `codexBinaryPreviewNotes` mock 数据，同屏覆盖托管 PATH、doctor error、版本筛选、下载进度、release notes 和空列表。
5. 验证通过：
   - `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build-storybook`
6. 浏览器验收 URL：`http://127.0.0.1:6006/?path=/story/design-system-feature-components-codex-binary--overview`
7. 截图：`screenshots/20260519/design-system/20260519-design-system-codex-binary-overview-after-v01.png`

## 2026-05-19 第三批 Feature Components：Account Cards
1. 按“发现未纳入组件 -> 匹配已有模式 -> 写 mock story -> 更新 manifest/catalog/test”的流程，新增 `Design System/Feature Components/Account Cards`。
2. 本批只收编纯展示或可 mock 的账号卡基础构件，不改账号页业务实现：
   - `AccountCardFrame`
   - `AccountCardSkeleton`
   - `AccountHealthBar`
   - `AttributionCard`
   - `CardSections`
3. 新 story 使用固定 mock 数据，同屏覆盖：
   - 账号卡交互外壳默认态 / 选中态 / 嵌套 action 边界
   - 归因卡健康态 / 失败态 / 紧凑态 / 列表态
   - quota、billing、usage、rate-limit、evidence 指标段
   - 健康条健康 / 混合失败状态
   - 加载骨架
4. 暂缓项：
   - `AccountCard`、详情弹窗和规则编辑器仍包含 Wails / 下载 / 真实保存路径，继续保留 `deferred`。
   - `UsageDeskChart`、`UsageDetailTable`、`Status RelayEditors` 作为下一批候选。

## 2026-05-19 第四批 Feature Components：Status Relay Editors
1. 新增 `Design System/Feature Components/Status Relay Editors`，收编 Status 页中已提取的 Relay 编辑弹窗：
   - `RelayKeyEditorModal`
   - `RelayProviderEditorModal`
   - `RelayModelEditorModal`
2. 新 story 使用本地 editor state mock，不调用真实运行时，覆盖：
   - Key 创建态
   - Key 重命名态
   - Key 重名错误态
   - Provider 编辑态 / 校验错误态
   - Model 编辑错误态
3. `StatusPanels.tsx` 暂不标为 admitted；其中 `StatusSnippetPanel` 和 Codex feature list 仍是下一批候选，避免只收其中一个导出却把整个大文件误判为已准入。

## 2026-05-19 第五批 Feature Components：Status Snippet Panel
1. 从 `StatusPanels.tsx` 拆出 `StatusSnippetPanel.tsx`，让配置片段 / diff 面板拥有独立文件边界和独立 manifest 准入。
2. 新增 `Design System/Feature Components/Status Snippet Panel`，覆盖：
   - 普通配置片段
   - 无复制按钮状态
   - header action 状态
   - unified diff 着色
   - 长行横向滚动
3. `StatusPanels.tsx` 继续保持 `candidate`，后续拆分 Codex feature list 和 local apply 面板后再复查。

## 2026-05-19 第六批 Feature Components：Usage Desk
1. 新增 `Design System/Feature Components/Usage Desk`，收编 Usage Desk 已提取的纯展示组件：
   - `UsageChartCard` / `EmptyChartPlaceholder`
   - `UsageDetailTable`
   - `StatePanel`
   - `InfoCard`
   - `UsageSessionDrilldownPanel`
2. 新 story 使用固定 mock 用量数据，同屏覆盖：
   - 双曲线 usage chart
   - 图表选中点和 footer 状态
   - 图表空态
   - projected 明细表和选中行
   - totals info cards
   - session drilldown 列表和空会话状态
3. 本批只收编 `components/usage-desk/` 下的展示组件，不触碰 Usage Desk 的数据加载、Wails 绑定或现有业务状态。

## 2026-05-19 第七批 Feature Components：Account Modals
1. 新增 `Design System/Feature Components/Account Modals`，先收编账号详情弹窗的基础 shell：
   - `AccountDetailModalFrame`
2. 新 story 使用固定账号详情 mock 内容，同屏覆盖：
   - 默认 header + body + footer
   - 长内容滚动
   - 错误条
   - 无 footer 状态
3. 具体详情弹窗如 `UnifiedAccountDetailModal`、`ApiKeyDetailModal` 仍保留 `deferred`，因为它们包含下载、保存、验证等运行时边界；`OpenAICompatibleDetailModal` 后续在 `RateLimitRulesSection` 支持 mock API 后已复查收编。

## 2026-05-19 第八批 Feature Components：Codex Route Probe
1. 新增 `Design System/Feature Components/Codex Route Probe`，收编 Codex 账号列表中的路由探测工作台：
   - `RouteProbeCard`
2. 新 story 使用固定候选账号队列和终端日志 mock，同屏覆盖：
   - idle 队列
   - running 禁用态
   - fallback 命中
   - 空候选队列
3. `CodexAccountOrderRow` 和 `CodexAccountOrderSection` 仍保持 `candidate`，后续单独处理密度、列表和拖拽状态。

## 2026-05-19 第九批 Feature Components：Account Rotation
1. 新增 `Design System/Feature Components/Account Rotation`，收编账号轮换弹窗中已拆出的纯展示 / 表单组件：
   - `RotationPriorityItem`
   - `RotationConfigSection`
2. 新 story 使用固定账号和 routing draft mock，同屏覆盖：
   - 普通优先级列表
   - 拖拽态
   - pending / ready=false 态
   - disabled 账号
   - routing 配置默认态
   - 策略菜单展开态
3. 轮换弹窗整体 `AccountRotationModal` 仍保持 `deferred`，等待保存 / 加载等运行时边界拆出纯 view。

## 2026-05-19 第十批 Feature Components：Codex Account Order
1. 新增 `Design System/Feature Components/Codex Account Order`，先收编 Codex 账号请求顺序中的纯 props 排序行：
   - `AccountOrderRow`
2. 新 story 使用固定 row、policy、quota、usage 和 rate-limit mock，同屏覆盖：
   - full density
   - compact density
   - list density
   - dragging 态
   - probe hit 态
   - policy skipped 态
   - disabled / blocked 态
   - rate-limit blocked 态
3. `CodexAccountOrderSection` 仍保持 `candidate`，因为它会读写 `localStorage/hash` 并依赖 action menu 尺寸测量；后续需固定预览环境或抽出纯 view 后再收编。

## 2026-05-19 第十一批 Feature Components：OpenAI Compatible
1. 新增 `Design System/Feature Components/OpenAI Compatible`，先收编 OpenAI-compatible provider 的纯展示卡：
   - `OpenAICompatibleProviderCard`
2. 新 story 使用固定 provider、verify state、usage 和 rate-limit mock，同屏覆盖：
   - verified / ready
   - verify error
   - disabled / no models
   - pending delete / pending status
   - rate-limit blocked
3. `OpenAICompatibleWorkspace` 仍保持 `candidate`，等待 provider card 稳定后再收组合级 loading / empty / grid / embedded 状态。

## 2026-05-19 第十二批 Feature Components：OpenAI Compatible Workspace
1. 复用 `Design System/Feature Components/OpenAI Compatible`，继续收编 OpenAI-compatible workspace 组合视图：
   - `OpenAICompatibleWorkspace`
2. 新增 workspace 状态矩阵，使用固定 provider、verify state 和 remote models mock 覆盖：
   - loading / not ready
   - empty providers
   - grid providers
   - embedded section
3. 本批不触碰真实 provider 加载、创建、删除、验证或 Wails 边界。

## 2026-05-19 第十三批 Feature Components：Paste Auth Modal
1. 复用 `Design System/Feature Components/Account Modals`，继续收编粘贴导入 auth 文件弹窗：
   - `PasteAuthModal`
2. 新增 paste auth 状态矩阵，使用固定粘贴内容 mock 覆盖：
   - empty textarea
   - filled / ready
   - invalid JSON error
3. 本批只验证受控 textarea、错误条和 footer action 布局，不触碰真实导入、解析或 Wails 边界。

## 2026-05-19 第十四批 Feature Components：OpenAI Compatible Compose
1. 复用 `Design System/Feature Components/OpenAI Compatible`，继续收编 OpenAI-compatible provider 新增表单：
   - `OpenAICompatibleComposeModal`
2. 新增 compose modal 状态矩阵，使用固定 form mock 覆盖：
   - empty custom form
   - preset selected
   - validation error
3. 本批只验证 preset select、基础输入区、API key 输入和错误条布局，不触碰真实创建或 Wails 边界。

## 2026-05-19 第十五批 Feature Components：API Key Compose
1. 复用 `Design System/Feature Components/Account Modals`，继续收编 Codex API key 新增弹窗：
   - `ApiKeyComposeModal`
2. 新增 API key compose 状态矩阵，使用固定 form 和 probe callback mock 覆盖：
   - empty form
   - filled quota form
   - fetching models
   - verify error
3. 本批只验证表单、quota curl、模型探测区和错误条布局，不触碰真实创建、模型请求或 Wails 边界。

## 2026-05-19 第十六批 Feature Components：Accounts Header
1. 新增 `Design System/Feature Components/Accounts Header`，收编账号工作台页头：
   - `AccountsHeader`
2. 新 story 使用固定 refs 和 callback mock 覆盖：
   - default
   - loading refresh
   - menu open
   - not ready
   - unified compose action
3. 本批只验证页头、刷新按钮、导入菜单和统一新增入口布局，不触碰真实文件上传、OAuth 或 Wails 边界。

## 2026-05-19 第十七批 Feature Components：Codex Account Order Section
1. 复用 `Design System/Feature Components/Codex Account Order`，继续收编 Codex 请求顺序列表容器：
   - `CodexAccountOrderSection`
2. 新增 section 状态矩阵，使用固定 row、policy、quota、usage 和 rate-limit mock 覆盖：
   - compact
   - full unsaved
   - list saving
   - waiting
   - loading
   - empty
3. 本批只验证列表容器、密度切换、筛选、保存提示和空态布局，不触碰真实拖拽保存、路由探测或 Wails 边界。

## 2026-05-19 第十八批 Feature Components：Status Codex Features
1. 从 `StatusPanels.tsx` 拆出 Codex feature 配置列表，并新增 `Design System/Feature Components/Status Codex Features`：
   - `StatusCodexFeaturesSection`
2. 新 story 使用固定 snapshot、rows 和 preview mock 覆盖：
   - ready
   - dirty preview
   - saving
   - loading
   - empty
   - unsupported/readOnly
3. 本批只验证配置列表、stage filter、搜索空态、ToggleSwitch 和保存区布局，不触碰真实读取、预览、保存或 Wails 边界。

## 2026-05-19 第十九批 Feature Components：Codex OAuth Modal
1. 复用 `Design System/Feature Components/Account Modals`，继续收编 Codex OAuth 登录链接弹窗：
   - `CodexOAuthModal`
2. 新增 OAuth 状态矩阵，使用固定 URL 和 copy state mock 覆盖：
   - ready
   - existing account / copy success
   - copy error
3. 本批只验证 URL 展示、复制反馈和打开浏览器 action 布局；复制动作通过 `onCopyUrl` mock 隔离，不触碰真实 clipboard、OAuth 或 Wails 边界。

## 2026-05-19 第二十批 Feature Components：Unified Compose Modal
1. 复用 `Design System/Feature Components/Account Modals`，继续收编统一新增账号两步弹窗：
   - `UnifiedComposeModal`
2. 新增 unified compose 状态矩阵，收敛为三个代表性分支：
   - preset list
   - provider form step
   - validation error
3. 本批只验证 preset 选择、端点输入、API key / quota / billing 区块和错误条布局；不额外展开重复的 loading/disabled 场景，不触碰真实创建或 Wails 边界。

## 2026-05-19 第二十一批 Feature Components：Codex Account Detail Modal
1. 复用 `Design System/Feature Components/Codex Account Order`，继续收编 Codex 账号详情弹窗：
   - `CodexAccountDetailModal`
2. 新增 detail modal 状态矩阵，按场景收敛规则只保留：
   - mapped
   - empty models
   - saving
3. 本批只验证详情字段、模型映射 Combobox、空映射说明和保存中按钮状态；用 story 容器隔离 fixed modal，不触碰真实模型保存、Codex runtime 或 Wails 边界。

## 2026-05-19 第二十二批 Feature Components：OpenAI Compatible Detail Panel
1. 从运行时 `OpenAICompatibleDetailModal` 中拆出无 Wails 展示层，并复用 `Design System/Feature Components/OpenAI Compatible` 收编：
   - `OpenAICompatibleDetailPanel`
2. 新增 detail panel 状态矩阵，按场景收敛规则只保留：
   - ready remote models
   - validation error
   - fetching models
3. 本批只验证 provider 详情字段、proxy route、headers、模型候选和验证 footer；完整 modal 当时仍保留 `RateLimitRulesSection` 组合，后续在第二十九批复查收编。

## 2026-05-19 第二十三批 Feature Components：Status Local CLI Apply
1. 新增 `Design System/Feature Components/Status Local CLI Apply`，收编 Status 页本地 CLI 配置应用区块：
   - `StatusApplyLocalSection`
2. 新 story 使用固定 relay key、endpoint、provider、model、auth state 和 diff mock 覆盖：
   - codex ready
   - codex blocked
   - codex preserve ChatGPT auth
   - codex applying
   - claude ready
3. 为 `StatusApplyLocalSection` 增加可选 `initialActiveTarget`，只用于 Storybook 固定展示 Codex / Claude 标签页初始态，不改变业务默认值。
4. 本批只验证本地配置表单、认证策略、endpoint/provider/model 选择和 diff 面板布局，不触碰真实写入 Codex / Claude Code 配置或 Wails 边界。

## 2026-05-19 第二十四批 Feature Components：Accounts Toolbar
1. 新增 `Design System/Feature Components/Accounts Toolbar`，收编账号工作台搜索 / 筛选 / 密度 / 批量选择工具栏：
   - `AccountsToolbar`
2. 新 story 使用固定 search term、filter state、display mode 和 selection state mock 覆盖：
   - default
   - filters open
   - empty selection
   - bulk selection
3. 为 `AccountsToolbar` 增加可选 `initialFiltersMenuOpen`，只用于 Storybook 固定展示筛选菜单打开态，不改变业务默认值。
4. 本批只验证工具栏布局、筛选浮层、密度切换和批量操作栏，不触碰账号加载、导出实现或 Wails 边界。

## 2026-05-19 第二十五批 Feature Components：Account Group Sections
1. 从 `AccountGroupSection` 拆出无 Wails 的分组容器 view，并新增 `Design System/Feature Components/Account Group Sections`：
   - `AccountGroupSectionView`
2. 新 story 使用固定 account group 和 mock card renderer 覆盖：
   - full grid
   - compact grid
   - list
   - empty
3. `AccountGroupSection` 继续作为业务 wrapper 组合真实 `AccountCard`，暂不直接收编；Storybook 只使用纯 view，避免引入 Wails `DownloadAuthFile`。
4. 本批只验证分组标题、数量 meta、响应式 grid/list 容器和空分组布局，不触碰真实账号卡 action、auth 下载或 Wails 边界。

## 2026-05-19 第二十六批 Feature Components：Account Proxy Route
1. 新增 `Design System/Feature Components/Account Proxy Route`，收编账号详情里的代理出口选择区块：
   - `AccountProxyRouteSection`
2. 为 `AccountProxyRouteSection` 增加可选 `proxyNodes` 注入；业务默认仍读取 proxy-pool localStorage，Storybook 使用固定 proxy node mock。
3. 新 story 覆盖：
   - inherit
   - direct
   - custom
   - detached current URL
   - no nodes
   - readonly
4. 本批只验证模式切换、当前出口摘要、代理节点 select、无节点提示和只读说明，不触碰真实 proxy-pool 存储或账号保存边界。

## 2026-05-19 第二十七批 Feature Components：Account Card
1. 复用 `Design System/Feature Components/Account Cards`，继续收编完整账号卡：
   - `AccountCard`
2. `AccountCard` 不再直接 import Wails `DownloadAuthFile`，改为可选 `downloadAuthFile` prop；业务 wrapper `AccountGroupSection` 负责注入真实 Wails 函数，Storybook 使用 mock。
3. `Overview` 新增完整账号卡状态：
   - ready
   - selection selected
   - pending delete
   - list blocked
4. 本批只验证账号卡整体组合、菜单边界、选择态、删除确认和列表限流态；真实 auth file 下载仍停留在业务 wrapper 注入层。

## 2026-05-19 第二十八批 Feature Components：Rate Limit Rules
1. 新增 `Design System/Feature Components/Rate Limit Rules`，收编路由守卫规则编辑区块：
   - `RateLimitRulesSection`
2. `RateLimitRulesSection` 不再直接 import Wails rate-limit CRUD，改为可选 `RateLimitRulesAPI` 注入；运行时详情弹窗继续注入真实 Wails API，Storybook 使用 mock API。
3. 新 story 覆盖：
   - active rules
   - empty rules
   - preview fallback
4. 本批只验证规则表单、策略 / 窗口 / 限额 / action 输入、启用开关、保存删除按钮和评估用量行，不触碰真实路由守卫持久化。

## 2026-05-19 第二十九批 Feature Components：OpenAI Compatible Detail Modal
1. 复用 `Design System/Feature Components/OpenAI Compatible`，在 `RateLimitRulesSection` 已支持 `RateLimitRulesAPI` 注入后复查并收编完整详情弹窗：
   - `OpenAICompatibleDetailModal`
2. `Overview` 已包含完整 modal 场景：
   - rate-limit composed
3. 本批只验证详情弹窗 shell、provider detail panel 与规则编辑区块的组合态；真实 provider 保存、验证、远端模型拉取和规则持久化仍由运行时父组件注入。

## 场景收敛规则
1. 后续收编组件时，状态矩阵默认只保留能代表视觉或交互分支的最小集合。
2. 对已经在同类组件中验证过的 loading、disabled、empty、error 行为，不重复为每个组件铺满；仅在该组件有独特布局或行为差异时新增状态。
3. 若多个业务动作共用同一视觉模式，优先归并到一个设计系统场景，再用文档说明适用范围。
