# UI Migration Sequence v01

## 排序原则
界面迁移不按导航菜单从上到下推进，而按风险和复用收益推进：

1. 先定义 `Parchment Trust Console` 的组件规范和 anatomy，不直接从页面 scoped CSS 开始。
2. 再迁移全局壳层和设计系统入口，建立所有页面共享的视觉契约。
3. 再迁移高频页面，优先处理用户每天会扫读和操作的账号、设置、状态类界面。
4. 详情 modal 和列表筛选单独排队，因为它们承载信息变更风险和 hash 恢复规则。
5. 复杂工作台后置，避免在 token 和组件外壳未稳定前陷入页面级大改。
6. 每个页面迁移前先写 `Information Change Ledger`，未确认的信息含义不改。

## 全局停止线
任一阶段不满足以下条件，不进入下一批页面：

1. `theme-mode` 和 `theme-preset` 可以独立持久化，刷新后不丢失。
2. `classic` 和 `parchment-trust-console` 至少各有 light / dark 可预览组合。
3. `ModalFrame` 仍保持覆盖整个应用窗口视口，包括 sidebar。
4. 设计系统能预览核心组件在不同主题下的状态。
5. 本阶段涉及页面的 loading / empty / error / partial / normal 至少有一种可复现证据。
6. Parchment 页面不得长期依赖大段页面 scoped CSS，必须有可复用组件或 component class 的落点。

## Wave -1：组件规范和 anatomy gate
### 目标
先把风格拆成组件语言，再进入页面迁移，避免“换色但旧结构不变”。

### 输入
1. 用户参考图：`screenshots/20260619/theme-skinning/20260619-theme-skinning-reference-baseline-v01.png`
2. 组件规范：[Parchment Trust Console Component Spec v01](20260619-parchment-trust-console-component-spec-v01.md)

### 必须定义的组件
1. App Shell / Sidebar / Top Toolbar。
2. Filter Bar。
3. Data Table / List Row。
4. Detail Modal Shell。
5. Section Card。
6. Metric Tile。
7. Status Pill。
8. Tabs。
9. Form Field / Credential Field。
10. Event List。
11. Chart / Sparkline。
12. Bottom Action Bar。

### 验收
1. Design System Entry 能展示 component anatomy 和 state matrix。
2. 每个组件至少有 default / hover / selected 或 active / disabled / error 中的必要状态。
3. 普通页面截图中 design-system marker 数量为 `0`。
4. 新页面迁移不得绕过组件规范直接堆页面 CSS。

## Wave 0：设计稿和主题基础设施
### 目标
先让换肤能力存在，而不是先改页面。

### 界面范围
1. 根节点主题标记。
2. 设置页 Appearance 的主题选择入口。
3. 设计系统入口的主题预览能力。

### 主要文件
1. `frontend/src/types.ts`
2. `frontend/src/context/ThemeContext.tsx`
3. `frontend/src/App.tsx`
4. `frontend/src/style.css`
5. `frontend/src/features/settings/SettingsFeature.tsx`
6. `frontend/src/features/design-system/*`

### 验收
1. 旧 `theme-mode=dark` 继续有效。
2. 新 `theme-preset=parchment-trust-console` 可持久化。
3. `data-theme-preset` 出现在 `document.documentElement`。
4. 设计系统可以同屏或切换查看核心组件主题状态。

## Wave 1：全局壳层和基础组件
### 目标
把所有页面共用的外壳先迁掉，避免后续每页重复处理边框、背景、按钮和标题。

### 界面范围
1. Sidebar。
2. WorkspacePageHeader。
3. ModalFrame / detail modal shell。
4. Button、SegmentedControl、ToggleSwitch、Input、Combobox、ActionSelect。
5. Badge、status pill、empty/error/loading block。
6. Card/List section 外壳。

### 主要文件
1. `frontend/src/components/biz/Sidebar.tsx`
2. `frontend/src/components/ui/WorkspacePageHeader.tsx`
3. `frontend/src/components/ui/ModalFrame.tsx`
4. `frontend/src/components/ui/*`
5. `frontend/src/stories/*`
6. `frontend/src/features/design-system/componentManifest.ts`
7. `frontend/src/features/design-system/storyCatalog.ts`

### 信息变更边界
不改业务信息，只改视觉外壳、密度、层级和控件状态呈现。

### 验收
1. Sidebar 在两个主题下选中态、折叠态、更新提示可读。
2. Header 主标题、副标题、actions 不出现溢出或过度营销化。
3. Detail modal 仍保留全应用遮罩、投影间距和 hash 恢复能力。
4. 基础组件在设计系统中覆盖 default / hover / disabled / error / loading。

## Wave 2：Settings + Design System
### 目标
先迁移低业务风险但高回归价值的页面，让后续迁移有可见控制台和预览基线。

Settings 同时作为 AntD adapter 试点：只验证 `ConfigProvider`、token 派生和基础控件皮肤，不承诺把其它页面直接迁移到 AntD。

### 界面范围
1. Settings Appearance。
2. Settings Runtime / Update / Local Usage 等现有 section 外壳。
3. Design System Entry。
4. Storybook token / component previews。

### 主要文件
1. `frontend/src/features/settings/SettingsFeature.tsx`
2. `frontend/src/features/settings/settingsLayout.test.mjs`
3. `frontend/src/features/design-system/DesignSystemEntryFeature.tsx`
4. `frontend/src/features/design-system/businessComponentPreviews.tsx`
5. `frontend/src/stories/tokens/ColorTokens.stories.tsx`

### 信息变更边界
允许把设置项重新分组和调整标题层级；不改开关含义、保存时机、Wails/native 行为。

### 验收
1. Appearance 中主题选择和文字缩放、语言、明暗模式边界清楚。
2. 设置项 disabled / pending / error 状态可读。
3. Settings 页真实出现 AntD `Card`、`Segmented`、`Switch`、`Button`，且仍由 GetTokens 主题状态驱动。
4. 设计系统能作为后续页面迁移的视觉基准。

## Wave 3：Accounts 列表
### 目标
账号池是最高频、最高信息密度页面，迁移它可以验证皮肤在真实业务数据下是否成立。

### 界面范围
1. 账号列表 header。
2. 筛选区。
3. 账号卡 / 行。
4. quota、billing、routeability、runtime warning。
5. 空态、错误态、cache / preview source label。

### 主要文件
1. `frontend/src/features/accounts/AccountsFeature.tsx`
2. `frontend/src/features/accounts/components/*`
3. `frontend/src/features/accounts/model/*`
4. `frontend/src/features/accounts/tests/accountListLayout.test.mjs`
5. `frontend/src/features/accounts/tests/accountPresentation.test.mjs`
6. `frontend/src/features/accounts/tests/accountCardLayout.test.mjs`

### 信息变更边界
允许重排账号卡信息优先级、筛选摘要和状态徽标位置；不改账号状态、quota 事实、routeable 判断和 sidecar readiness 表达。

### 必写 Ledger 项
1. 账号来源和凭据类型如何显示。
2. routeable / disabled / runtime failure 的优先级。
3. quota 和 billing 是摘要、行内还是详情入口。
4. 筛选默认态是否从全勾选改成“默认全量”表达。

### 验收
1. 0、1、典型、多账号、超长名称、异常账号都可读。
2. 默认筛选态不显示一屏全勾选。
3. 错误、partial、stale-cache、sidecar-not-ready 不被视觉弱化。

## Wave 4：Account Detail Modal
### 目标
详情 modal 是信息变更风险最高的界面，必须在列表视觉稳定后单独迁移。

### 界面范围
1. AccountDetailModal shell。
2. 凭据区。
3. endpoint / proxy / route 配置区。
4. quota / billing 模块 rail。
5. 保存、刷新、验证、删除等主动作。

### 主要文件
1. `frontend/src/components/biz/AccountDetailModal.tsx`
2. `frontend/src/components/biz/accountDetail*`
3. `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
4. `frontend/src/components/biz/accountDetailClipboard.test.mjs`

### 信息变更边界
允许改为更清晰的左 rail + 内容 band 布局；不改字段含义、保存动作、验证动作、hash 参数和关闭恢复行为。

### 必写 Ledger 项
1. 默认基础 URL 与协议 endpoint 覆盖的分区。
2. quota / billing 显隐控制入口。
3. 主动作是否移动到 modal header。
4. 删除重复解释文案是否改变用户理解。

### 验收
1. modal 覆盖整个应用视口，包括 sidebar。
2. `detail=<id>` 打开和关闭恢复规则不变。
3. 主动作只出现一次，且位置稳定。
4. 只显示用户启用的模块，不保留空壳占位。

## Wave 5：Codex / Claude Account Lists
### 目标
在账号池和详情 modal 的模式稳定后迁移同类账号列表，复用列表、筛选、状态和详情外壳。

### 界面范围
1. Codex account list。
2. Claude account list。
3. channel routing / provider / model mapping 摘要。
4. OAuth / API key / openai-compatible 显示。

### 主要文件
1. `frontend/src/features/codex/CodexAccountListFeature.tsx`
2. `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`
3. `frontend/src/features/codex/codexAccountList.test.mjs`
4. `frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`

### 信息变更边界
允许统一账号列表视觉和筛选表达；不改请求顺序、channel routing、OAuth 透传、model mapping 含义。

### 验收
1. Codex 与 Claude 账号列表的同类状态使用同一视觉语言。
2. provider、credential source、routing 状态不混淆。
3. 无账号、账号异常、route guard 状态可辨识。

## Wave 6：Proxy Pool + Status + Vendor Status
### 目标
迁移基础运维可观测页面，验证 Parchment Trust Console 对状态、日志、连接性信息的表达。

### 界面范围
1. Proxy Pool。
2. Status。
3. Vendor Status。
4. relay / account store diagnostics / local source label。

### 主要文件
1. `frontend/src/features/proxy-pool/ProxyPoolFeature.tsx`
2. `frontend/src/features/status/StatusFeature.tsx`
3. `frontend/src/features/vendor-status/VendorStatusFeature.tsx`
4. `frontend/src/features/proxy-pool/model.test.mjs`
5. `frontend/src/features/status/tests/*`

### 信息变更边界
允许把诊断项按“当前状态 / 可操作项 / 证据”重排；不改 ready、degraded、failed、preview/cache/live 来源。

### 验收
1. ready / degraded / failed / preview / cache 来源清楚。
2. 状态页面不因暖色皮肤把 warning 和 normal 混成一类。
3. 代理池启用、失败、未配置状态可扫读。

## Wave 7：Usage Desk + Session Management + Live Sessions
### 目标
迁移图表、时间线、会话列表等复杂数据视图，验证 token 对图表和密集列表的支持。

### 界面范围
1. Usage Desk。
2. Session Management。
3. Codex Live Sessions。
4. 请求时间线、趋势图、项目/会话维度切换。

### 主要文件
1. `frontend/src/features/accounts/UsageDeskFeature.tsx`
2. `frontend/src/features/session-management/SessionManagementFeature.tsx`
3. `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx`
4. `frontend/src/features/accounts/tests/usageDesk.test.mjs`
5. `frontend/src/features/session-management/model.test.mjs`
6. `frontend/src/features/codex-live-sessions/model.test.mjs`

### 信息变更边界
允许统一 overview、selected detail、project/session view 的模块外壳；不改 usage attribution、live snapshot、history window、cache source 语义。

### 验收
1. overview 和 selected detail 使用同一套图表/列表外壳。
2. 单条数据不被撑成大空白。
3. live / cache / preview source label 始终可见。
4. 大量数据有滚动或窗口限制，不因视觉迁移造成性能回退。

## Wave 8：Codex Workspace 工具面
### 目标
迁移功能管理类工作台，但不在主题迁移中改变工具逻辑。

### 界面范围
1. Codex Feature Config。
2. Binary Management。
3. Extension Registry。
4. Skills。
5. MCP Servers。

### 主要文件
1. `frontend/src/features/codex/CodexFeature.tsx`
2. `frontend/src/features/codex-binary/CodexBinaryFeature.tsx`
3. `frontend/src/features/codex-extensions/*`
4. `frontend/src/features/gettokens-extension-registry/GetTokensExtensionRegistryFeature.tsx`

### 信息变更边界
允许统一工具页的列表、详情、操作区和状态 pill；不改技能源、MCP section/tool 语义、binary 激活/回退逻辑。

### 验收
1. install / update / rollback / disabled / error 操作状态可读。
2. Skills 和 MCP 页面不直接散用第三方 primitive。
3. 详情或调试 modal 仍遵守全应用覆盖和 hash 规则。

## Wave 9：Import / Debug / Doctor Workbench
### 目标
最后迁移低频、高诊断密度或正在活跃变动的页面，避免和其他功能开发冲突。

### 界面范围
1. Account Import。
2. Debug。
3. Doctor Workbench。
4. Claude asset / subagents 等低频工作台。

### 主要文件
1. `frontend/src/pages/AccountImportPage.tsx`
2. `frontend/src/features/debug/DebugFeature.tsx`
3. `frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`
4. `frontend/src/features/claude-code/ClaudeCodeAssetWorkbenchFeature.tsx`

### 信息变更边界
允许按“问题 / 证据 / 动作 / 结果”重排诊断信息；不改诊断结论、action disabled reason、preview/real source 区分。

### 验收
1. Doctor Workbench 的 critical / warning / degraded / ok 不混色。
2. 诊断 action 的 disabled reason 和 blocked reason 不被隐藏。
3. Debug 页面仍保留足够密度，不变成营销式说明页。

## Wave 10：收尾统一和反模式清理
### 目标
清理迁移过程中遗留的双轨视觉语言。

### 清理项
1. 页面级硬编码色彩。
2. 旧 `card-swiss` / `btn-swiss` 中无法被主题覆盖的样式。
3. 重复 header、重复 summary、卡片套卡片。
4. 全勾选筛选默认态。
5. 只在单页存在的状态色或 chart 色。

### 验收
1. 搜索硬编码颜色和高风险 Tailwind 色值，确认只保留少量必要例外。
2. 设计系统 story 覆盖新增的主题化组件。
3. 主题截图覆盖每个主工作台。
4. 文档更新每个 wave 的完成状态和剩余风险。

## 执行切片建议
每次实施只取一个 wave 或一个 wave 内的一个页面。单个切片必须包含：

1. 对应页面的 `Information Change Ledger`。
2. 失败测试或 DOM/布局断言。
3. 最小实现。
4. 无头截图或设计系统预览证据。
5. `docs-linhay/scripts/check-docs.sh` 和 `git diff --check`。
