# Theme Skinning

## 背景
GetTokens 当前已经有基础的 `system / light / dark` 色彩模式，并通过 `theme-mode` 写入 `localStorage`。这解决了明暗切换，但还没有形成真正的“主题 / 换肤”体系：

1. 主题能力只暴露为明暗模式，无法承载不同视觉风格、品牌色或用户自定义色。
2. 组件样式里仍存在较多页面级视觉决策，缺少统一 token 与主题契约。
3. 账号池、Codex、代理池、设置页等核心页面持续扩张后，需要一个稳定的视觉系统来避免后续局部改样式互相打架。
4. 文本缩放、语言、窗口主题和 Wails 原生窗口明暗模式已经进入设置体系，换肤应作为同一类用户偏好提上日程。

## 目标
1. 将现有明暗模式升级为可扩展的主题体系，同时保持 `theme-mode` 兼容。
2. 定义 GetTokens 主题 token 契约，覆盖背景、文本、边框、强调色、状态色、图表色、阴影和焦点态。
3. 在设置页提供主题选择入口，至少支持默认、浅色、深色与一个非默认风格主题的最小闭环。
4. 让核心页面在主题切换后仍保持信息密度、可读性、可访问性和交互状态一致。
5. 建立主题预览与回归验证方式，后续新增页面或组件能按同一标准接入。

## 范围
1. 主题模型：
   - 扩展 `ThemeMode = system | light | dark` 与后续 `ThemePreset` / `ThemeScheme` 的边界。
   - 保持旧 `theme-mode` 读取兼容，必要时新增 `theme-preset` 独立存储。
2. 主题 token：
   - 梳理全局 CSS 变量和 Tailwind 使用边界。
   - 将页面级硬编码色彩在完成闭包内收敛为语义 token，不保留过渡态。
3. 设置页：
   - 在现有 Appearance 区域增加主题风格选择。
   - 展示主题预览，避免用户只看到抽象名称。
4. 核心页面接入：
   - 第一阶段覆盖账号池、Codex 账号列表、代理池、状态页、设置页。
   - 优先保证表格、卡片、弹窗、分段控件、状态徽标、图表/用量区块。
5. 验证：
   - 单元测试覆盖主题解析、兼容迁移、持久化 key。
   - 浏览器预览覆盖主题切换后的核心页面截图。
   - Wails 桌面验证窗口明暗模式与 Web 主题状态一致。

## 非目标
1. 不在第一阶段开放任意用户自定义 CSS。
2. 不引入远程主题市场或在线下载主题。
3. 不重做整体信息架构、导航结构或账号业务流程。
4. 不为了换肤降低现有页面信息密度。
5. 不把每个组件都立即重构到完美 token 化；第一阶段聚焦核心页面和高频控件。

## 验收标准
### 场景 1：兼容现有明暗模式
Given 用户本地已有 `theme-mode = "dark"`
When 升级到新主题体系后首次启动 GetTokens
Then 应继续进入深色体验
And 不应重置用户语言、文本缩放或其他设置。

### 场景 2：选择主题风格
Given 用户打开设置页 Appearance 区域
When 选择一个非默认主题风格并保存
Then 页面立即应用该主题
And 重新启动应用后仍保持该主题。

### 场景 3：跟随系统明暗模式
Given 用户选择 `system`
When 系统明暗模式变化
Then GetTokens 应同步切换对应配色层
And 主题风格的品牌色、状态色仍保持一致语义。

### 场景 4：核心页面可读性
Given 用户切换到任意内置主题
When 浏览账号池、Codex 账号列表、代理池、状态页和设置页
Then 文本、边框、焦点态、禁用态、错误态、成功态均可辨识
And 关键操作按钮不会与背景或卡片状态混淆。

### 场景 5：回归截图
Given 每个内置主题都有稳定预览入口
When 执行主题截图检查脚本
Then 应在本 space 的 `screenshots/` 下产出对应主题截图
And 截图命名遵守项目规范。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260519-theme-skinning`
- worktree：`../GetTokens-worktrees/20260519-theme-skinning/`

## 相关链接
- 历史 React 迁移文档：[React Migration Guide](../../dev/20260424-react-migration-guide.md)
- UI 框架选型研判：[UI Framework Evaluation v01](plans/20260519-ui-framework-evaluation-v01.md)
- 长期换肤规划：[Theme Skinning Long-Term Plan v02](plans/20260619-theme-skinning-long-term-plan-v02.md)
- Parchment 组件规范：[Parchment Trust Console Component Spec v01](plans/20260619-parchment-trust-console-component-spec-v01.md)
- AntD 设置页试点：[AntD Settings Spike v01](plans/20260619-antd-settings-spike-v01.md)
- Settings AntD 执行交接：[Settings AntD Handoff v01](plans/20260619-settings-antd-handoff-v01.md)
- 界面迁移顺序：[UI Migration Sequence v01](plans/20260619-ui-migration-sequence-v01.md)
- Wave 0-2 实施记录：[Wave 0-2 Implementation Notes](plans/20260619-wave-0-2-implementation-notes.md)
- Wave 0-2 浏览器验收：[Wave 0-2 Preview Snapshot](plans/20260619-wave-0-2-preview-snapshot-v01.md)
- 执行计划草案：[Theme Skinning Plan v01](plans/20260519-theme-skinning-plan-v01.md)
- Wave 0-2 验收脚本：`docs-linhay/scripts/check-theme-skinning-wave02-preview.mjs`
- 当前主题上下文：`frontend/src/context/ThemeContext.tsx`
- 当前主题应用入口：`frontend/src/App.tsx`
- 当前设置页入口：`frontend/src/features/settings/SettingsFeature.tsx`
- 当前类型定义：`frontend/src/types.ts`

## 当前状态
- 状态：单运行态样式收敛已提交，提交后 test:unit 阻塞已收敛
- 最近更新：2026-06-21
- 已确认方向：不默认全站接入完整预设 UI 框架；允许 AntD 作为受控 adapter 先在 Settings 页试点，仍由 `ThemeMode + ThemePreset + Semantic Tokens + Component Skin Contracts` 驱动。
- 首套非默认风格：`Parchment Trust Console`。
- 设计规范：Parchment 旧迁移方向已被 2026-06-21 决策收口；当前 Settings / Design System 首版视觉视为不符合最终标准的旧稿，后续完成闭包必须按 AntD adapter + gt semantic token 重做，不保留过渡态。
- 页面迁移规则：信息默认不改，布局和呈现方式可以调整；涉及删除、合并、重命名、降级或新增派生信息时，必须先写 `Information Change Ledger` 并核对。
- 推进状态：Wave 0-2 已进入实现验证，Settings 页已开始 AntD adapter 试点；已补 Settings AntD 执行交接文档，下一步由执行者按 handoff 收敛 wrapper、状态矩阵、Parchment component anatomy 和体积边界。
- 工作台收敛进展：2026-06-20 已按 quiet workspace loop 小步迁移代理池、代理池 token/typography cleanup、会话管理、SessionManagementView analysis/raw JSON detail internals、SessionManagementView token/shadow cleanup、Session Plugin Console token cleanup、扩展注册表、Doctor workbench、DoctorWorkbench token/shadow cleanup、状态页主面板、状态页 panels token/typography cleanup、状态页 diagnostics/header status、状态页 Codex features section、状态页 Codex value editor、状态页 Codex config sibling sections、状态页 Relay editor modals、Vendor Status 页面、Vendor Status typography/shadow cleanup、StatusSnippetPanel token cleanup、Account migration gate、AccountsFeature page chrome、AccountsToolbar filter controls、Account CardSections typography cleanup、ThemePresetPicker quiet shell、Codex live session 详情页、Codex live session detail typography/meta、Codex live session detail shadow cleanup、Codex live sessions workbench、Codex live session feed、Channel Routing 工作台、Channel Routing typography/meta、Project candidate pool rules panel、Codex extensions workspaces、Codex extensions modals typography、Claude Code asset workbench、Claude Code account list workbench、Claude Code account list feature shell、Claude Code subagent catalog、Claude Code memory files panel、Claude Code settings scope stack、Codex route probe modal、Codex route probe shadow cleanup、Codex account detail modal、Codex OAuth modal、OAuth model probe section、Codex binary version cell、Codex binary summary/list shell、Quota threshold rule panel、Account local CLI apply confirm、Account rotation config section、Account rotation priority item、Account rotation modal、Usage Desk panels、Usage Desk chart、Usage Desk detail table、Usage Desk page shell、Account proxy route section、Account detail header/runtime route、Account detail credential/connection editor、Account detail shell primitives、Account detail stat/evidence primitives、Account detail quota/billing editors、Account detail quota reset modal、AccountDetailSections token/shadow cleanup、Account detail footer、quotaColor token cleanup、Codex account order toolbar/filter、Codex account order section filter/empty cleanup、Account import page、Account import modal、Account import queue list、Account delete overlay、Account curl editor modal、Deep link import confirm、OpenAI-compatible provider card、OpenAI-compatible workspace、Vendor logo mark token cleanup、API key compose modal、Unified compose modal、Rate limit rules section、RateLimitRulesSection typography cleanup、Quota calibration panel、OpenAI-compatible compose modal、Unified account detail modal internals、UnifiedAccountDetailModal typography cleanup、AssetWorkbenchShell quiet shell、PageLoadingFallback 和 legacy AccountDetailModal 模块，并将复用节奏沉淀到 `gettokens-frontend-design-quality`；账号 quota reset modal 继续保留既有动态渐变/glass 契约。
- 收尾审计：2026-06-20 用户要求“整理，沉淀，提交”后复核当前主仓在 legacy `AccountDetailModal` 之后继续推进 Codex extension modal typography、Account detail quota reset modal 和 Channel Routing typography/meta 小切片；复用流程仍是前端视觉领域的 `Quiet workspace migration loop`，其“干净工作区收尾不夹带下一页迁移”边界已写入 `gettokens-frontend-design-quality`；本轮新增的是 modal 字距门禁、机械替换风险记录、quota reset modal 的“保留动态渐变/glass、收敛 heavy 控件壳层”边界和 Channel Routing meta 字距门禁，落到 space + memory，不升级 `AGENTS.md`、不新增 skill。当前运行时代码旧样式高信号入口以 `UsageDeskFeature.tsx`、`ClaudeCodeAccountListFeature.tsx`、`CardSections.tsx` 为主，后续继续按单页面或强相关组件组小步提交。
- 收尾补充：2026-06-20 追加完成 `ClaudeCodeAccountListFeature.tsx` 页面级 quiet shell、`StatusPanels.tsx` token/typography cleanup 和 `ProxyPoolFeature.tsx` token/typography cleanup；这些文件不再作为当前旧样式高信号入口，后续继续优先看 `CardSections.tsx`、`AccountDetailSections.tsx`、Session 局部残余等独立切片。
- 收尾补充：2026-06-20 用户再次要求“整理，沉淀，提交”时主仓在 `style: align proxy pool typography` 后保持干净；本轮只做治理闭环，不夹带下一页迁移。复核结论是最近三轮 Vendor Status、StatusPanels、ProxyPool 都是既有 `Quiet workspace migration loop` 的 token/typography/shadow 门禁细化，不产生新的跨领域 workflow 或 repo-wide 规则；下一批运行态旧样式高信号入口为 `SessionManagementView.tsx`、`CardSections.tsx`、`ThemePresetPicker.tsx`、`RateLimitRulesSection.tsx` 和 `AccountDetailSections.tsx`。
- 进展补充：2026-06-20 追加完成 `SessionManagementView.tsx` token/shadow cleanup、`CardSections.tsx` typography cleanup、`ThemePresetPicker.tsx` quiet shell、`RateLimitRulesSection.tsx` typography cleanup、`AccountDetailSections.tsx` token/shadow cleanup、`quotaColor.ts` token cleanup、`UnifiedAccountDetailModal.tsx` typography cleanup、`AssetWorkbenchShell.tsx` quiet shell、`StatusSnippetPanel.tsx` token cleanup、`DoctorWorkbenchFeature.tsx` token/shadow cleanup、`CodexRouteProbeCard.tsx` shadow cleanup、`CodexAccountOrderSection.tsx` filter/empty cleanup、`CodexLiveSessionDetail.tsx` shadow cleanup 与 `VendorLogoMark.tsx` token cleanup；这些文件不再作为当前运行态旧样式高信号入口。下一批运行态旧样式高信号入口更新为 `componentManifest.ts`、`OpenAICompatibleComposeModal.tsx`、`FormField.tsx`、`App.tsx` 和 status/settings 局部小切片。

- 排查附件：2026-06-21 已按用户要求整理全 App 字体 / 字重 / 颜色源码清单，见 [App Typography / Weight / Color Inventory](plans/20260621-app-typography-color-inventory.md)。本轮只做盘点，不修改运行时代码；重点疑点是 DoctorWorkbench Tailwind named colors、Sidebar / Debug / DesignSystemEntry 的 px 字号、AntD adapter 独立 palette，以及 AccountDetail quota reset modal 的刻意保留动态渐变。
- 规范决策：2026-06-21 用户明确后续只保留 AntD、只保留新的视觉系统，并进一步明确不允许保留过渡态；执行标准见 [App Visual System Standard v01](plans/20260621-app-visual-system-standard-v01.md)。旧 Swiss / parchment visual primitive 和 legacy token alias 不能作为完成闭包继续保留，新增 UI 默认进入 AntD adapter + gt semantic token 路径。

## 2026-06-21 单运行态样式收敛

### 问题来源
- 用户反馈：桌面 App 的颜色和 Web 预览不一致，并进一步要求“只留一套样式”。

### 当前事实位置
- `frontend/src/context/theme.ts` 旧逻辑接受 `system / light / dark` 和 `classic / parchment-trust-console`，并从各 runtime 的 `localStorage` 读取。
- `frontend/src/App.tsx` 旧逻辑根据 `prefers-color-scheme` 切换 `.dark`，并写入 `data-theme-preset`。
- `frontend/src/style.css` 旧逻辑同时维护 root、`.dark`、`[data-theme-preset='parchment-trust-console']` 与 dark parchment token override。
- `main.go` 旧 Wails 配置开启透明 WebView 与半透明窗口，App 颜色会被 macOS 合成影响。
- `frontend/src/features/settings/SettingsFeature.tsx` 旧设置页暴露 theme mode / preset 控件，允许用户继续制造两套运行态样式。

### 决策
- 运行态只保留一套 `classic light` 样式。
- 旧 `theme-mode` / `theme-preset` localStorage key 只做兼容归一化：无论旧值是什么，读取和写回都归一为 `light / classic`。
- Settings 不再展示主题 mode / preset 控件，只保留语言、文字大小等非样式偏好。
- Ant Design token adapter 提到 App 根部，全局只产出同一套 neutral palette。
- Wails 窗口关闭透明和半透明，背景改为白色，避免 App/Web 颜色被窗口合成拉开。

### 验收方式
- 主题解析、AntD token、CSS token contract、Settings 布局 targeted tests 必须通过。
- `npm run build` 必须通过，确认删除主题切换组件和 token override 后前端打包入口不缺引用。
- `go test -run '^$' .` 必须通过，确认 Wails 配置改动可编译。
- `./scripts/wails-cli.sh build` 应能生成 dev build 产物；本地未签名产物不作为分发签名验收。
- `npm run typecheck` 已恢复通过；账号详情 props 类型漂移已作为本轮阻塞处理修正。
- `go test .` 已恢复通过；`build/darwin/Info.plist` 已补齐，prod/dev plist 均固定注册 `gt` scheme 且不注册 `gt-dev`。
- `npm run test:unit` 提交后已恢复通过（983 pass）：Sidebar 字体 token、账号详情 section-nav 契约、Design System manifest、rateLimit 注入测试和 legacy typography residue 已同步收敛。
- 沉淀判断：提交后阻塞处理属于既有前端设计契约门禁的同步，不新增 skill、不升级 `AGENTS.md`。
