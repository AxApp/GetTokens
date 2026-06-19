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
   - 将页面级硬编码色彩逐步收敛为语义 token。
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
- 状态：Settings AntD adapter spike
- 最近更新：2026-06-19
- 已确认方向：不默认全站接入完整预设 UI 框架；允许 AntD 作为受控 adapter 先在 Settings 页试点，仍由 `ThemeMode + ThemePreset + Semantic Tokens + Component Skin Contracts` 驱动。
- 首套非默认风格：`Parchment Trust Console`。
- 设计规范：Parchment 迁移先定义组件 anatomy 和状态矩阵，再迁移页面；当前 Settings / Design System 首版视觉属于过渡稿，后续需按组件规范重做。
- 页面迁移规则：信息默认不改，布局和呈现方式可以调整；涉及删除、合并、重命名、降级或新增派生信息时，必须先写 `Information Change Ledger` 并核对。
- 推进状态：Wave 0-2 已进入实现验证，Settings 页已开始 AntD adapter 试点；已补 Settings AntD 执行交接文档，下一步由执行者按 handoff 收敛 wrapper、状态矩阵、Parchment component anatomy 和体积边界。
- 工作台收敛进展：2026-06-20 已按 quiet workspace loop 小步迁移代理池、会话管理、扩展注册表、Doctor workbench、状态页主面板、状态页 Codex features section、状态页 Codex config sibling sections、状态页 Relay editor modals、Vendor Status 页面和 Codex live session 详情页，并将复用节奏沉淀到 `gettokens-frontend-design-quality`；下一轮可继续从账号详情、channel routing 等旧样式高信号入口推进。
