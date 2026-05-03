# 20260429 Text Scale Settings v01

## 辩论背景
在推进 `text scale settings` 时，用户追加了一个实现约束：希望同步判断当前前端里是否存在值得沉淀到组件库的重复 UI 结构，并且要求采用多路独立扫描后再交叉验证的方式，而不是单人主观判断。

本轮采用合作型 debate，由宿主负责收集代码上下文与裁定，两位参与者分别代表：
1. `Rawls`：积极抽象立场，优先寻找应进入第一批组件库的候选
2. `Parfit`：保守抽象立场，优先识别过度抽象风险和应延后的候选

## 代码上下文
本轮明确扫描了以下文件：
1. `frontend/src/features/settings/SettingsFeature.tsx`
2. `frontend/src/features/status/StatusFeature.tsx`
3. `frontend/src/features/accounts/components/AccountCard.tsx`
4. `frontend/src/features/accounts/components/AccountsToolbar.tsx`
5. `frontend/src/features/accounts/components/ApiKeyComposeModal.tsx`
6. `frontend/src/features/accounts/components/OpenAICompatibleComposeModal.tsx`
7. `frontend/src/features/accounts/components/CodexOAuthModal.tsx`
8. `frontend/src/components/biz/AccountDetailModal.tsx`
9. `frontend/src/components/ui/SegmentedControl.tsx`
10. `frontend/src/style.css`

## 参与者观点

### 2026-04-29 19:xx Rawls（积极抽象）
1. 论点：`PreferenceRow` 和升级版 `SegmentedControl` 应进入第一批。
   - 引用：`frontend/src/features/settings/SettingsFeature.tsx:203`、`frontend/src/features/settings/SettingsFeature.tsx:345`、`frontend/src/components/ui/SegmentedControl.tsx:15`
   - 代码事实：`SettingsFeature` 里已经有两组高度同构的设置行，`SegmentedControl` 本身又把按钮字号硬编码成 `text-[9px]`。
   - 结论：如果设置行和分段控件不先收口，text scale 实现会在设置页持续扩散。
2. 论点：`ModalFrame + ModalField + ModalError + ModalActions` 值得作为第二优先级。
   - 引用：`frontend/src/features/accounts/components/ApiKeyComposeModal.tsx:21`、`frontend/src/features/accounts/components/OpenAICompatibleComposeModal.tsx:32`、`frontend/src/features/accounts/components/CodexOAuthModal.tsx:32`、`frontend/src/components/biz/AccountDetailModal.tsx:218`
   - 代码事实：多类 modal 都复用了遮罩、容器、header、footer 和 `text-[9px]/text-[10px]/text-[11px]` 的紧凑层级。
   - 结论：字体放大如果不统一 modal，最容易出现主页面变大、弹窗仍然偏小的断层。
3. 论点：`MetricTile / StatBlock` 可以进入第一批。
   - 引用：`frontend/src/features/status/StatusFeature.tsx:651`、`frontend/src/components/biz/AccountDetailModal.tsx:276`、`frontend/src/features/settings/SettingsFeature.tsx:243`
   - 代码事实：状态页、详情页、设置页都在重复“微型标签 + 数值”的信息块。
   - 结论：这类块的本质是字号与盒模型组合，理论上适合与 text scale 一起收口。
4. 论点：`eyebrow / field-label / meta-code / helper-copy` 这种微型文案原语必须尽快统一。
   - 引用：`frontend/src/features/settings/SettingsFeature.tsx:195`、`frontend/src/features/accounts/components/AccountCard.tsx:140`、`frontend/src/features/accounts/components/AccountsToolbar.tsx:87`、`frontend/src/components/biz/AccountDetailModal.tsx:291`
   - 代码事实：当前 `8px/9px/10px` 的层级完全散落在组件内部。
   - 结论：这是 text scale 改造中最脆弱的一层。

### 2026-04-29 19:xx Parfit（保守抽象）
1. 论点：不要现在就抽通用 `SettingsOptionSection`。
   - 引用：`frontend/src/features/settings/SettingsFeature.tsx:193`、`frontend/src/features/settings/SettingsFeature.tsx:345`
   - 代码事实：`Appearance` 与 `Local Usage Refresh` 虽然长得像，但一个是纯切换，一个带 `loading/saving/message` 的异步状态。
   - 结论：贸然抽象会迅速长出 `loading/saving/hint/message/controlKind` 等 props。
2. 论点：不要因为结构相似就抽全局 `PageHeader`。
   - 引用：`frontend/src/features/settings/SettingsFeature.tsx:183`、`frontend/src/features/status/StatusFeature.tsx:638`
   - 代码事实：Settings 页头与 Status 页头的信息职责和视觉密度差异很大。
   - 结论：目前只适合统一 token，不适合抽统一 header 组件。
3. 论点：现在不要抽组件库级业务 modal，只适合极薄的 `ModalFrame`。
   - 引用：`frontend/src/features/accounts/components/ApiKeyComposeModal.tsx:21`、`frontend/src/features/accounts/components/OpenAICompatibleComposeModal.tsx:32`、`frontend/src/features/accounts/components/CodexOAuthModal.tsx:32`、`frontend/src/components/biz/AccountDetailModal.tsx:219`
   - 代码事实：modal 外壳相似，但内部有表单、URL copy、长滚动详情、create/rename 多模式等明显分叉。
   - 结论：业务层 modal 如果现在抽，最终会沦为 render-props 容器。
4. 论点：不要急着抽 `FormModal` / `FieldList`。
   - 引用：`frontend/src/features/accounts/components/ApiKeyComposeModal.tsx:34`、`frontend/src/features/accounts/components/OpenAICompatibleComposeModal.tsx:46`
   - 代码事实：字段布局相似，但状态更新策略完全不同。
   - 结论：先统一 label、error、input 尺寸和 token，比抽大表单组件更稳。
5. 论点：`SegmentedControl` 要保持边界窄，不要让 AccountsToolbar 的 filter 反向污染它。
   - 引用：`frontend/src/features/accounts/components/AccountsToolbar.tsx:84`、`frontend/src/components/ui/SegmentedControl.tsx:15`
   - 代码事实：Accounts filter 是单选 + 多选混合模型，不适合强行改造成 segmented 变体。
   - 结论：`SegmentedControl` 应只处理离散单选，不继续扩展到所有筛选 UI。
6. 论点：`btn-swiss` 当前只提供视觉底座，不适合马上再抽 `Primary/Secondary/Danger` 语义按钮组件。
   - 引用：`frontend/src/style.css:35`、`frontend/src/features/accounts/components/AccountCard.tsx:171`、`frontend/src/features/accounts/components/AccountsToolbar.tsx:139`
   - 代码事实：各处仍通过 `!px-* !py-* !text-*` 大量重写按钮尺寸。
   - 结论：先收按钮 token，再看是否值得上升为按钮组件变体。

## 交叉验证与裁定

### 共识点
1. 两方都认可：当前最先要收的是 typography token，而不是一上来做大而全的组件库。
2. 两方都认可：modal 外壳层确实高度重复，但应该先落在“极薄骨架”而不是业务弹窗总成。
3. 两方都认可：`SegmentedControl` 是 text scale 改造的关键点，但它的职责边界要保持窄，不要被其它筛选 UI 绑架。
4. 两方都认可：最值得统一的是 `8px/9px/10px` 这一批微型文字层级。

### 分歧点
1. `SettingsFeature` 的设置行是否应该直接抽成 `PreferenceRow`
   - `Rawls` 认为已经足够稳定
   - `Parfit` 认为现在就抽会把异步状态一起揉进去
2. `StatBlock / MetricTile` 是否应该进入第一批
   - `Rawls` 倾向尽快统一
   - `Parfit` 认为不同页面差异仍偏大，更适合先收 card/header/padding token
3. 是否立刻继续上升到语义按钮组件
   - `Rawls` 没有强推
   - `Parfit` 明确反对，主张先收按钮尺寸和密度 token

### 宿主裁定
基于代码证据，本轮结论如下：
1. **第一批应落地的不是“大组件库”，而是“token + 极薄骨架 + 极少量稳定原语”。**
2. **进入第一批的项：**
   - `typography tokens`
   - 升级版 `SegmentedControl`（接入字号 token，但不扩展职责）
   - `ModalFrame`（只管遮罩、容器、header/footer 壳，不接管业务内容）
   - 微型文字原语：`Eyebrow / FieldLabel / MetaCode / HelperText`
3. **暂缓进入第一批的项：**
   - 通用 `SettingsOptionSection`
   - `StatBlock / MetricTile`
   - 语义按钮组件族
   - 通用 `InfoCard / PanelCard`
4. **保留观察但延后：**
   - `FormField`
   - `FilterMenu`
   - 局部 card header / padding utility

## 结论与行动项
1. text scale 实现的第一步仍然是 token 化，尤其是当前最散乱的 `8px/9px/10px` 文本层级。
2. 组件抽象不应脱离 text scale 的主线；本轮应优先处理那些能直接减少字号维护面的公共层。
3. 后续实现顺序建议：
   - `TextScaleContext + typography tokens`
   - `SegmentedControl` 接入 token
   - `ModalFrame`
   - `Eyebrow / FieldLabel / MetaCode / HelperText`
   - 再评估 `PreferenceRow`
4. 本轮明确不建议把 `AccountCard`、`UsageDeskWorkspace`、`Sidebar` 整体提升为组件库级通用组件。

