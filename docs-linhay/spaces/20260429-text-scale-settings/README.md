# 20260429 Text Scale Settings

## 背景
用户反馈 GetTokens 当前界面的文字整体偏小，连续使用时存在阅读负担。这个问题不是单一页面文案样式失误，而是当前黑白红 mono 视觉体系为了追求高密度，广泛使用了 `text-[8px]`、`text-[9px]`、`text-[10px]` 等固定字号，且缺少“用户可调节”的全局文字缩放层。

结合当前仓库现状，可以确认：
1. `Settings` 页面已经有主题、语言、本地投影刷新间隔等偏好设置，具备继续承载“显示设置”的产品位置。
2. `ThemeContext` / `I18nContext` 已使用前端本地持久化模式，适合作为文字缩放偏好的实现参考。
3. 目前前端存在大量硬编码小字号，尤其集中在 `Settings`、`Status`、`Sidebar`、账号卡片、详情弹窗、轮动弹窗、Usage Desk 等核心界面。

## 目标
1. 为用户提供一个明确、稳定、全局生效的“文字大小”设置项。
2. 在不破坏现有产品视觉语言的前提下，提高核心界面的可读性与可点击性。
3. 把当前散落在组件里的固定字号收口成可维护的 typography scale，避免后续每次调字号都要逐页打补丁。
4. 为后续更多可访问性设置（例如密度、对比度）预留实现边界。

## 范围
1. 产品方案规划：
   - 设置入口放在 `Settings -> Appearance`
   - 文案语义、选项命名、默认值、持久化策略
2. 前端实现边界规划：
   - 新增全局 text scale preference
   - 新增 context / CSS variable / typography token 方案
   - 收口共享组件与高风险页面的字号使用方式
   - 识别在调整字号时适合沉淀到组件库的重复 UI 结构
3. 回归验收规划：
   - `Sidebar`
   - `Settings`
   - `Status`
   - `Accounts`
   - 账号详情/编辑类弹窗
   - `Usage Desk`

## 非目标
1. 本轮不改系统字体家族，不把 mono 风格整体替换为比例字体。
2. 本轮不实现任意百分比滑杆，也不做复杂的系统无障碍适配桥接。
3. 本轮不顺手重做所有视觉层级；重点是可读性和稳定落地，不是整套 UI redesign。
4. 本轮不采用浏览器/webview 缩放作为产品方案，因为它会同时放大布局、命中区域和图表，副作用太大。

## 验收标准
1. 用户能在 `Settings` 页面看到“文字大小”设置项，并能在 2 到 3 个离散档位中选择。
2. 修改设置后，全局界面即时生效，重新打开 APP 后仍保留用户选择。
3. 默认档位下视觉与当前版本保持近似一致，不引入无意的布局回归。
4. 放大档位下，`Sidebar`、`Settings`、`Status`、`Accounts`、核心弹窗和 `Usage Desk` 不出现大面积文字重叠、按钮内容被截断或关键指标不可见。
5. 新实现不是“逐组件写死另一套字号”，而是形成一层共享的 text scale 机制。

## 推荐方案

### 1. 产品口径
建议把能力定义为“文字大小”而不是“页面缩放”。

推荐档位：
1. `默认`
2. `较大`
3. `更大`

原因：
1. 用户问题集中在“字太小”，不是想缩放整页布局。
2. 离散档位比自由滑杆更容易做回归和截图验收。
3. 当前界面已经存在大量紧凑排版，自由缩放会迅速把风险扩大到所有容器宽高。

### 2. 技术口径
建议采用“前端偏好 + 全局 context + CSS variable + typography token”方案，而不是直接在页面里分散写条件类名。

建议边界：
1. 新增 `TextScaleContext`，持久化方式先对齐 `ThemeContext` / `I18nContext`，使用前端本地存储。
2. 在根节点注入例如 `data-text-scale` 或 CSS 变量 `--app-font-scale`。
3. 在 `style.css` 或共享样式层定义语义化字号 token，例如：
   - `--text-2xs`
   - `--text-xs`
   - `--text-sm`
   - `--text-body`
   - `--text-metric`
4. 共享组件和高频页面优先改为引用 token，而不是继续直接写 `text-[8px]` / `text-[9px]`。

### 3. 为什么不建议直接用浏览器缩放
1. 会连带放大图表、阴影、边框、点击区域，影响现有 Swiss 风格布局密度。
2. 难以控制局部例外，例如 badge、状态码、图表标尺、超长 token 文本。
3. 不利于后续维护，等于把产品问题外包给渲染层。

## 当前问题拆解
1. 当前仓库里已经可以确认有大量极小字号硬编码，尤其 `8px` 和 `9px` 使用非常普遍。
2. 问题不是“某个页面忘了调大”，而是当前视觉规范默认把很多说明文字、分组标题、次级标签都压到了接近极限的字号。
3. 单纯把 `Settings` 页面加一个开关还不够；如果不同时收口共享样式，后续每新增一个页面都会绕过这套能力。

## BDD 场景

### 场景 1：首次打开应用
- 假设：用户第一次启动 APP，没有任何本地偏好
- 当：进入任意主页面
- 则：应用使用默认文字大小，视觉表现与当前基线基本一致

### 场景 2：用户调大文字
- 假设：用户在 `Settings -> Appearance` 中把文字大小从“默认”切到“较大”
- 当：切换回 `Status`、`Accounts`、`Usage Desk`
- 则：主要文本、按钮标签、卡片说明即时变大，不需要重启 APP

### 场景 3：重新打开应用
- 假设：用户上一次选择了“更大”
- 当：重新启动 APP
- 则：应用恢复上一次选择的文字大小

### 场景 4：高密度模块可用
- 假设：用户使用“较大”或“更大”档位
- 当：打开账号详情弹窗、轮动弹窗、Usage Desk 和 Sidebar
- 则：不出现关键操作按钮不可点击、主要数值不可见或成片重叠

## 实施建议
1. 先补需求与计划文档，确认档位、默认值和验收页面。
2. 再做失败测试，优先覆盖 text scale 偏好读写与 token 映射逻辑。
3. 先实现全局 text scale 基础设施，再把能共享的 UI 结构收口成组件，最后清理页面级硬编码字号。
4. 回归时优先看高风险模块：
   - `Sidebar`
   - `SettingsFeature`
   - `StatusFeature`
   - `AccountCard` / `AccountDetailModal`
   - `AccountRotationModal`
   - `UsageDeskWorkspace`

## 组件库抽象观察
当前前端里已经有一批重复结构，适合和字号改造一起收口。以下结论已经过一轮多视角 debate 交叉验证，优先级按“既能减少字号维护面、又不容易把 API 抽炸”排序。

### 第一层：建议本轮顺手抽取
1. `Typography Tokens`
   - 证据：`style.css` 目前只有颜色变量；`SettingsFeature.tsx`、`AccountCard.tsx`、`AccountsToolbar.tsx`、`SegmentedControl.tsx` 里仍广泛硬编码 `text-[8px] / text-[9px] / text-[10px]`
   - 价值：这是 text scale 的主线，不先收 token，后续每抽一个组件都会固化一层旧字号
2. 升级版 `SegmentedControl`
   - 证据：`SettingsFeature.tsx` 多处依赖它承载离散档位切换；`SegmentedControl.tsx` 内部目前写死 `text-[9px]`
   - 价值：它本来就是 text scale 设置项的核心承载控件，但边界要保持窄，只做离散单选
3. 极薄 `ModalFrame`
   - 证据：`ApiKeyComposeModal.tsx`、`OpenAICompatibleComposeModal.tsx`、`CodexOAuthModal.tsx`、`PasteAuthModal.tsx`、`OpenAICompatibleDetailModal.tsx`、`AccountDetailModal.tsx`
   - 重复点：遮罩、容器、header/footer 壳、关闭行为、边框/阴影壳
   - 价值：统一 modal 外壳和字号层级，但不直接抽业务弹窗总成
4. 微型文案原语
   - 建议形态：`Eyebrow / FieldLabel / MetaCode / HelperText`
   - 证据：`SettingsFeature.tsx`、`AccountCard.tsx`、`AccountsToolbar.tsx`、`AccountDetailModal.tsx`
   - 价值：当前最脆弱、最分散、最需要随字号统一放大的正是这些 `8px/9px/10px` 文案

### 第二层：值得规划，但不建议和第一步一起抽太深
1. `PreferenceRow`
   - 证据：`SettingsFeature.tsx` 设置行结构相似，但已有同步切换与异步保存两类状态机
   - 风险：现在就抽容易长出 `loading/saving/message/hint/controlKind` 一串 props
2. `FormField`
   - 证据：`ApiKeyComposeModal.tsx`、`OpenAICompatibleComposeModal.tsx` 等都在重复 `label + input + error`
   - 风险：字段更新策略不同，先统一 label/error/input token 更稳
3. `MetricBlock / StatCell`
   - 证据：`SettingsFeature.tsx` 更新信息区、`StatusFeature.tsx` 状态卡、`AccountDetailModal.tsx` 统计块
   - 风险：语义和布局差异还偏大，建议等 token 稳定后再评估
4. `FilterMenu`
   - 证据：`AccountsToolbar.tsx`
   - 风险：当前复用面不足，而且它不是 `SegmentedControl` 的自然变体

### 当前不建议抽象
1. `AccountCard` 整体不建议直接抽成通用卡片基类。
2. `UsageDeskWorkspace` 的图表和摘要面板暂不建议进通用组件库。
3. `Sidebar` 暂不建议做过度抽象，先只收口其 typography token 与导航 item 内部子结构。
4. 现在不建议继续上升到 `PrimaryButton / SecondaryButton / DangerButton` 这类语义按钮族；先收按钮密度与字号 token。

### 收口顺序建议
1. `text scale token`
2. 升级 `SegmentedControl`
3. `ModalFrame`
4. `Eyebrow / FieldLabel / MetaCode / HelperText`
5. 再评估 `PreferenceRow / MetricBlock / FormField`

## 相关链接
1. `frontend/src/context/ThemeContext.tsx`
2. `frontend/src/context/I18nContext.tsx`
3. `frontend/src/features/settings/SettingsFeature.tsx`
4. `frontend/src/style.css`
5. `docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-text-scale-settings-plan-v01.md`
6. `docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-component-reuse-candidates-v01.md`
7. `docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-text-scale-settings-handoff-v01.md`
8. `docs-linhay/spaces/20260429-text-scale-settings/text-scale-design-gallery.html`
9. `docs-linhay/spaces/20260429-text-scale-settings/text-scale-design-option-a-editorial-utility.html`
10. `docs-linhay/spaces/20260429-text-scale-settings/text-scale-design-option-b-raw-terminal-control-room.html`
11. `docs-linhay/spaces/20260429-text-scale-settings/text-scale-design-option-c-warm-paper-console.html`
12. `docs-linhay/spaces/20260429-text-scale-settings/debate/20260429/text-scale-settings/20260429-text-scale-settings-v01.md`

## 当前状态
- 状态：planned
- 最近更新：2026-04-29
