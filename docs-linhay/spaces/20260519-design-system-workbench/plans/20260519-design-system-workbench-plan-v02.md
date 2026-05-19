# Design System Workbench Plan v02

## 需求边界
本期要交付 Storybook 版设计系统工作台，并保留 GetTokens 应用内 `design-system` 入口。Storybook 负责组件预览、Docs、Controls、主题验证和截图回归；应用内入口负责发现、说明和链接。

## 当前基线
1. 前端栈为 React 18 + Vite 5 + Tailwind 3 + TypeScript。
2. 当前没有 Storybook 依赖。
3. 基础组件集中在 `frontend/src/components/ui/`。
4. 全局样式和 token 在 `frontend/src/style.css`。
5. 应用导航仍由 `AppPage`、`pagePersistence`、`Sidebar` 和 hash frame 驱动。
6. 技术细节以 [Technical Design v02](20260519-design-system-workbench-technical-design-v02.md) 为准。

## BDD 场景
### 场景 1：Storybook 可启动
Given 已安装 Storybook 依赖
When 运行 `npm --prefix frontend run storybook`
Then 能在 `http://127.0.0.1:6006` 打开 GetTokens Design System。

### 场景 2：基础组件有 stories
Given 用户打开 Storybook
When 查看 `Design System/Components`
Then 能看到 `SegmentedControl`、`ToggleSwitch`、`ActionSelect`、`Combobox`、`WorkspacePageHeader`、`PageLoadingFallback`。

### 场景 3：token 与主题生效
Given Storybook preview 已加载 `style.css`
When 打开 token stories 或切换主题
Then 组件使用 GetTokens 的 CSS variables
And 不出现默认 Storybook 视觉替代真实组件样式。

### 场景 4：应用内入口可发现
Given 用户打开 GetTokens
When 点击 Sidebar 的设计系统入口
Then 页面展示 Storybook 启动命令、默认地址、覆盖矩阵和截图路径。

### 场景 5：无 Wails 运行时也可预览
Given 用户只启动 Storybook
When 浏览基础组件 stories
Then stories 不调用 `window.go.main.App`
And 可正常展示 mock 数据。

## 实施步骤
### 阶段 1：Storybook 初始化
1. 在 `frontend/` 下执行 Storybook 初始化，使用 React/Vite 框架。
2. 检查生成的 `frontend/.storybook/main.ts` 和 `preview.ts`。
3. 将 `preview.ts` 接入 `frontend/src/style.css` 和必要 provider。
4. 保留最小官方 addons，避免一次性引入过多生态插件。

### 阶段 2：应用内入口
1. `AppPage` 增加 `design-system`。
2. `pagePersistence` 支持 `design-system` 读写和 `#frame=design-system`。
3. `App.tsx` 新增 `DesignSystemPage` lazy import。
4. `Sidebar` 增加设计系统入口。
5. 新建 `DesignSystemEntryFeature`，展示 Storybook 命令、地址、覆盖矩阵和截图路径。
6. `zh.json` / `en.json` 增加导航文案。

### 阶段 3：第一批 stories
1. 基础组件 stories：
   - `SegmentedControl`
   - `ToggleSwitch`
   - `ActionSelect`
   - `Combobox`
   - `WorkspacePageHeader`
   - `PageLoadingFallback`
2. Token stories：
   - colors
   - typography
   - spacing / border / shadow
3. Primitive stories：
   - `btn-swiss`
   - `card-swiss`
   - `input-swiss`
   - `select-swiss`
4. Overlay placeholder stories：
   - Dialog
   - Popover
   - Dropdown
   - Tooltip

### 阶段 4：测试与截图
1. 补 `pagePersistence` 红灯测试。
2. 新增 `storyCatalog.test.mjs`，验证 story catalog。
3. 运行：
   - `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
   - `npm --prefix frontend run test:unit`
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
   - `npm --prefix frontend run build-storybook`
4. 用浏览器打开 Storybook 并截图归档。

## 设计原则
1. Storybook 是真实设计系统工作台，不再自研完整预览器。
2. stories 必须渲染真实组件，不复制静态 HTML。
3. 每个 story 使用 mock 数据，不调用 Wails / sidecar。
4. 视觉延续 GetTokens 的 Swiss-industrial workbench，不使用 Storybook 默认组件视觉替代产品组件。
5. 组件进入业务页面前，先在 Storybook 中补齐状态样本。

## 待确认
1. Storybook 端口已固定为 `6006`，便于应用内入口说明和截图脚本复用。
2. 应用内 `design-system` 入口本期先常驻 Sidebar；后续如有发行顾虑再加开发开关。
3. 账号卡片、Codex 行等业务组件暂不纳入第一批 stories；第二批再按业务组件稳定度推进。

## 执行结果
### 已完成
1. Storybook 已接入 `frontend/.storybook/`，preview 加载 `frontend/src/style.css` 并提供主题 / 字号 globals。
2. `frontend/package.json` 已新增：
   - `storybook`: `storybook dev -p 6006`
   - `build-storybook`: `storybook build`
3. 应用内入口已完成：
   - `AppPage = design-system`
   - `#frame=design-system`
   - Sidebar `设计系统`
   - `DesignSystemEntryFeature`
   - `storyCatalog`
4. 第一批 stories 已完成：
   - `SegmentedControl`
   - `ToggleSwitch`
   - `ActionSelect`
   - `Combobox`
   - `WorkspacePageHeader`
   - `PageLoadingFallback`
   - `ColorTokens`
   - `TypographyTokens`
   - `SwissPrimitives`

### 验证结果
1. 红灯路径已执行并在实现前失败：
   - `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
2. 当前绿灯验证通过：
   - `node --test frontend/src/utils/pagePersistence.test.mjs frontend/src/features/design-system/storyCatalog.test.mjs`
   - `npm --prefix frontend run test:unit`（307 passed）
   - `npm --prefix frontend run typecheck`
   - `npm --prefix frontend run build`
   - `npm --prefix frontend run build-storybook`
3. 浏览器验收通过：
   - Storybook 可在 `http://127.0.0.1:6006` 打开。
   - `Design System/Tokens/Colors` 渲染 CSS token。
   - toolbar 暴露 `GetTokens theme mode` 与 `GetTokens text scale`。
   - 应用内 `http://127.0.0.1:5173/#frame=design-system` 可打开并展示覆盖矩阵。

### 截图归档
1. `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-storybook-web-after-v01.png`
2. `docs-linhay/spaces/20260519-design-system-workbench/screenshots/20260519/design-system/20260519-design-system-app-route-web-after-v01.png`

### 非阻塞记录
1. `build-storybook` 输出 Storybook 大 chunk 警告，构建成功，暂不为首期工作台做 chunk 拆分。
2. 浏览器 dev 验收里 `favicon.ico` 返回 404，属于既有 Vite dev server 静态资源缺口，不影响 `design-system` 页面。

## 本地化补充
### 需求
Storybook 需要支持中文本地化，至少保证 GetTokens 组件预览内容可在中文和英文之间切换。

### 实施
1. 新增 `frontend/src/features/design-system/storybookGlobals.ts`，集中维护 Storybook locale toolbar 选项和默认回退规则。
2. `frontend/.storybook/preview.tsx` 增加 `locale` global：
   - 默认 `zh`
   - toolbar 显示 `中文` / `English`
   - 切换时调用 GetTokens `I18nProvider` 的 `setLocale`
   - 同步 iframe `document.documentElement.lang`
3. 首批 stories 的示例文案改为读取 `useI18n().locale`，覆盖中文和英文示例。

### 验证
1. `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build-storybook`
4. 浏览器验证：
   - `globals=locale:zh` 显示中文示例文案。
   - `globals=locale:en` 显示英文示例文案。

### 边界
Storybook 管理界面文案仍由 Storybook 自身控制；本期只保证 GetTokens preview iframe 内的组件内容、语言状态与 `lang` 属性。

## Story 状态总览补充
### 需求
用户指出 `Design System/Components/ActionSelect` 里的多个状态不应只能分散在不同 story 页面。设计系统用于批量修改和回归，因此复杂组件需要一屏展示关键状态。

### 实施
1. `frontend/src/components/ui/ActionSelect.stories.tsx` 新增 `Overview` story，并放在该组件 story 列表首位。
2. `Overview` 同屏展示：
   - `Create Only`
   - `Create And Delete`
   - `Long Content`
   - `Disabled`
3. 单状态 stories 继续保留，用于隔离调试和交互检查。

### 后续规则
后续为复杂基础组件补 stories 时，默认同时提供：
1. `Overview`：一页状态矩阵，服务设计回归。
2. 独立状态 stories：服务交互调试、Docs 和截图精确定位。

### 推广结果
`Overview` 状态矩阵已推广到首批所有组件 stories：

1. `ActionSelect`
2. `Combobox`
3. `PageLoadingFallback`
4. `SegmentedControl`
5. `ToggleSwitch`
6. `WorkspacePageHeader`

测试门禁已补齐：`storyCatalog.test.mjs` 会读取 `components` 分组里的 story 文件，确认每个文件都导出 `Overview`。

## 设计系统准入边框
### 需求
用户希望能在设计系统内快速区分哪些组件已经正式进入设计系统，哪些只是普通业务拼装或尚未纳入系统的样例。

### 实施
1. 新增 `frontend/src/features/design-system/DesignSystemStoryFrame.tsx`。
2. 所有已纳入设计系统的 component story 示例必须用 `DesignSystemStoryFrame` 包裹。
3. `DesignSystemStoryFrame` 提供统一标识：
   - 红色虚线边框
   - `DS` 角标
   - `data-design-system-component="true"`
4. `storyCatalog.test.mjs` 新增检查，确保 `components` 分组里的 story 文件使用 `DesignSystemStoryFrame`。

### 边界
该标识只用于 Storybook / 设计系统工作台，不进入真实产品运行时组件，避免污染业务页面外观。

## Feature Components 收编推进
### 本轮目标
在 `components/ui` 全部进入 Storybook 后，开始收编已经从业务页提取出来、但仍属于 feature 目录的低耦合组件。第一批避开账号池当前并行改动，选择不依赖 Wails / sidecar 的 Debug 面板组件。

### 收编循环
后续按用户确认的固定循环推进：

1. 发现新的未纳入组件。
2. 匹配已有设计系统组件或模式。
3. 未匹配到则抽象或新建设计组件。
4. 写 mock story、`Overview` 状态矩阵和 `DesignSystemStoryFrame`。
5. 更新 `componentManifest.ts`、`storyCatalog.ts` 和测试门禁。
6. 运行 catalog/typecheck/Storybook build，并用浏览器确认真实渲染。

### 实施
1. 新增 `frontend/src/features/debug/components/DebugPanelComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Debug Panel`。
3. `Overview` 同屏展示：
   - `DebugHeader` 普通态
   - `DebugHeader` 全选 / 复制成功态
   - `DebugEntryCard` 成功展开态
   - `DebugEntryCard` 错误展开态
   - `DebugEntryCard` 折叠态
   - `DebugEmptyState`
4. 所有已收编示例均使用 `DesignSystemStoryFrame`，保持 DS 准入边框。
5. `storyCatalog.ts` 新增 `feature-components` 分组。
6. `storyCatalog.test.mjs` 的准入门禁从 `components` 扩展到 `components` + `feature-components`。

### 验证
1. `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build-storybook`
4. 浏览器确认 `Debug Panel / Overview` 可渲染，iframe 内存在 6 个 `data-design-system-component="true"` 节点，样式均为 `3px dashed rgb(255, 0, 0)`。

### Manifest 门禁
1. 新增 `frontend/src/features/design-system/componentManifest.ts`。
2. `storyCatalog.test.mjs` 会扫描 `frontend/src/features/*/components/**/*.tsx`，要求每个非 story 组件文件都有 manifest 条目。
3. manifest status：
   - `admitted`：已收编，必须有 story/catalog/mock/required states。
   - `candidate`：已发现，必须写 required states。
   - `deferred`：暂缓，必须写 revisit trigger。
   - `excluded`：不单独收编，必须有稳定理由。

### 第三批：Account Cards
本批继续沿用 feature component 收编循环，并用 subagent 做只读盘点、主线程负责集成和验收。

1. 已新增 `frontend/src/features/accounts/components/AccountCardComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Account Cards`。
3. 本批 admitted 组件：
   - `AccountCardFrame`
   - `AccountCardSkeleton`
   - `AccountHealthBar`
   - `AttributionCard`
   - `CardSections`
4. `Overview` 同屏覆盖：
   - 账号卡外壳默认 / 选中 / 嵌套 action
   - 归因卡健康 / 失败 / 紧凑 / 列表密度
   - quota / billing / usage / rate-limit / evidence 指标段
   - 健康条健康与失败混合状态
   - 加载骨架
5. 下一批候选：
   - `UsageDeskChart`
   - `UsageDetailTable`
   - `UsageDeskPanels`
   - `StatusSnippetPanel`
   - `RelayEditors`

### 第四批：Status Relay Editors
本批选择 Status 页里已从页面控制器提取出来的纯 props modal，继续避免触碰运行时配置保存逻辑。

1. 已新增 `frontend/src/features/status/components/StatusRelayEditors.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Status Relay Editors`。
3. 本批 admitted 文件：
   - `frontend/src/features/status/components/RelayEditors.tsx`
4. `Overview` 同屏覆盖：
   - Relay key 创建
   - Relay key 重命名
   - Relay key 错误态
   - Provider 编辑和错误态
   - Model 编辑错误态
5. `StatusPanels.tsx` 继续保持 candidate，因为该文件包含多个未完全收编的导出组件；后续应拆 `StatusSnippetPanel` / Codex feature list，再决定是否整体 admitted。

### 第五批：Status Snippet Panel
本批先处理 `StatusPanels.tsx` 中已稳定复用的代码片段展示块，通过拆文件让 manifest 准入粒度保持真实。

1. 已新增 `frontend/src/features/status/components/StatusSnippetPanel.tsx`，并让 `StatusPanels.tsx` 复用该独立组件。
2. 已新增 `frontend/src/features/status/components/StatusSnippetPanel.stories.tsx`。
3. Storybook 路径为 `Design System/Feature Components/Status Snippet Panel`。
4. `Overview` 同屏覆盖：
   - 普通配置片段
   - 无复制按钮状态
   - header action
   - unified diff add/remove/hunk 着色
   - 长行横向滚动
5. `StatusPanels.tsx` 仍保持 candidate，剩余 local apply / Codex feature list 后续继续拆分收编。

### 第六批：Usage Desk
本批收编账号域下 Usage Desk 已提取的纯展示组件，但不碰数据加载和 Wails 运行时边界。

1. 已新增 `frontend/src/features/accounts/components/usage-desk/UsageDeskComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Usage Desk`。
3. 本批 admitted 文件：
   - `UsageDeskChart.tsx`
   - `UsageDetailTable.tsx`
   - `UsageDeskPanels.tsx`
4. `Overview` 同屏覆盖：
   - 双曲线 chart
   - chart 空态
   - selected point / footer 状态
   - projected minute table 和选中行
   - info cards
   - session drilldown rows / empty rows
5. 后续仍需处理账号域更重的弹窗、规则编辑器和完整 workspace 组合组件。

### 第七批：Account Modals
本批只收账号详情 modal shell，不提前收具体账号详情业务弹窗。

1. 已新增 `frontend/src/features/accounts/components/AccountModalComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Account Modals`。
3. 本批 admitted 文件：
   - `AccountDetailModalFrame.tsx`
4. `Overview` 同屏覆盖：
   - 默认 header / body / footer
   - 长内容滚动
   - 错误条
   - 无 footer 状态
5. `UnifiedAccountDetailModal`、`ApiKeyDetailModal`、`OpenAICompatibleDetailModal` 继续 deferred，等待下载、保存、验证、规则编辑等运行时边界拆出纯 view。

### 第八批：Codex Route Probe
本批先收 Codex account-list 里的独立 route probe workbench，不提前收排序 row / section。

1. 已新增 `frontend/src/features/codex/components/CodexRouteProbeCard.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Codex Route Probe`。
3. 本批 admitted 文件：
   - `CodexRouteProbeCard.tsx`
4. `Overview` 同屏覆盖：
   - idle candidate queue
   - running disabled controls
   - fallback hit terminal
   - empty candidates
5. `CodexAccountOrderRow`、`CodexAccountOrderSection` 继续保持 candidate，下一批围绕密度、列表和拖拽状态单独处理。

### 第九批：Account Rotation
本批收账号轮换弹窗中已拆出的 row / config 组件，不直接收整个 `AccountRotationModal`。

1. 已新增 `frontend/src/features/accounts/components/account-rotation/AccountRotationComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Account Rotation`。
3. 本批 admitted 文件：
   - `RotationPriorityItem.tsx`
   - `RotationConfigSection.tsx`
4. `Overview` 同屏覆盖：
   - 普通优先级列表
   - 拖拽态
   - pending / ready=false 态
   - disabled 账号
   - routing 配置默认态
   - strategy menu 展开态
5. `AccountRotationModal` 继续 deferred，等待加载、保存和真实 routing 配置边界拆出纯 view。

### 第十批：Codex Account Order
本批先收 Codex account-list 里的排序 row，不直接收带 `localStorage/hash` 和 action menu 测量的整个 section。

1. 已新增 `frontend/src/features/codex/components/CodexAccountOrderComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/Codex Account Order`。
3. 本批 admitted 文件：
   - `CodexAccountOrderRow.tsx`
4. `Overview` 同屏覆盖：
   - full density
   - compact density
   - list density
   - dragging
   - probe hit
   - policy skipped
   - disabled / blocked
   - rate-limit blocked
5. `CodexAccountOrderSection` 继续保持 candidate，下一批先处理预览环境固定或纯 view 抽离，再覆盖 ready/loading/empty/filter/action menu 状态。

### 第十一批：OpenAI Compatible
本批先收 OpenAI-compatible provider card，不直接收整个 workspace。

1. 已新增 `frontend/src/features/accounts/components/OpenAICompatibleComponents.stories.tsx`。
2. Storybook 路径为 `Design System/Feature Components/OpenAI Compatible`。
3. 本批 admitted 文件：
   - `OpenAICompatibleProviderCard.tsx`
4. `Overview` 同屏覆盖：
   - verified / ready
   - verify error
   - disabled / no models
   - pending delete / pending status
   - rate-limit blocked
5. `OpenAICompatibleWorkspace` 继续保持 candidate，下一批再处理 workspace 组合态。

### 第十二批：OpenAI Compatible Workspace
本批复用 OpenAI Compatible story，继续收 OpenAI-compatible workspace 组合视图。

1. 继续更新 `frontend/src/features/accounts/components/OpenAICompatibleComponents.stories.tsx`。
2. Storybook 路径仍为 `Design System/Feature Components/OpenAI Compatible`。
3. 本批 admitted 文件：
   - `OpenAICompatibleWorkspace.tsx`
4. `Overview` 新增 workspace 状态：
   - loading / not ready
   - empty providers
   - grid providers
   - embedded section
5. 本批只用固定 mock 回调和数据，不触碰真实 provider 加载、创建、删除、验证或 Wails 边界。

### 第十三批：Paste Auth Modal
本批复用 Account Modals story，继续收粘贴导入 auth 文件弹窗。

1. 继续更新 `frontend/src/features/accounts/components/AccountModalComponents.stories.tsx`。
2. Storybook 路径仍为 `Design System/Feature Components/Account Modals`。
3. 本批 admitted 文件：
   - `PasteAuthModal.tsx`
4. `Overview` 新增 paste auth 状态：
   - empty textarea
   - filled / ready
   - invalid JSON error
5. 本批只用固定 mock 回调和粘贴内容，不触碰真实导入、解析或 Wails 边界。

### 第十四批：OpenAI Compatible Compose
本批复用 OpenAI Compatible story，继续收 OpenAI-compatible provider 新增表单。

1. 继续更新 `frontend/src/features/accounts/components/OpenAICompatibleComponents.stories.tsx`。
2. Storybook 路径仍为 `Design System/Feature Components/OpenAI Compatible`。
3. 本批 admitted 文件：
   - `OpenAICompatibleComposeModal.tsx`
4. `Overview` 新增 compose modal 状态：
   - empty custom form
   - preset selected
   - validation error
5. 本批只用固定 mock 回调和 form，不触碰真实创建或 Wails 边界。

### 第十五批：API Key Compose
本批复用 Account Modals story，继续收 Codex API key 新增弹窗。

1. 继续更新 `frontend/src/features/accounts/components/AccountModalComponents.stories.tsx`。
2. Storybook 路径仍为 `Design System/Feature Components/Account Modals`。
3. 本批 admitted 文件：
   - `ApiKeyComposeModal.tsx`
4. `Overview` 新增 API key compose 状态：
   - empty form
   - filled quota form
   - fetching models
   - verify error
5. 本批只用固定 form 和 probe callback mock，不触碰真实创建、模型请求或 Wails 边界。
4. admitted story 必须在 `feature-components` catalog 中存在，并且 story 文件不能导入 Wails / `window.go` / sidecar / 真实请求。

### 第二批：Codex Binary
1. 新增 `frontend/src/features/codex-binary/components/CodexBinaryComponents.stories.tsx`。
2. 收编组件：
   - `CodexBinarySummaryPanel`
   - `CodexBinaryVersionList`
   - `CodexBinaryVersionCell`
3. 复用已有模式：
   - 摘要面板匹配 `WorkspacePageHeader` 的 summary/action 模式。
   - 版本筛选匹配 `SegmentedControl`。
   - 可展开版本行匹配 DebugPanel 的展开详情模式。
4. 使用现有 `codexBinaryPreviewSnapshot` / `codexBinaryPreviewNotes` 作为 mock data，不触发 Wails。
5. 浏览器确认 `Codex Binary / Overview` 可渲染，iframe 内存在 4 个 `data-design-system-component="true"` 节点，样式均为 `3px dashed rgb(255, 0, 0)`。
