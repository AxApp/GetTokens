# 20260429 Component Reuse Candidates v01

## 目标
把 `text scale settings` 相关的组件复用判断单独沉淀成一份可执行清单，避免后续实现时还要从 `README`、`plan` 和 `debate` 纪要里反向拼结论。

## 适用边界
这份清单只回答两个问题：
1. 在本轮字体大小改造里，哪些 UI 结构值得顺手收进组件库或基础层？
2. 哪些 UI 结构虽然看起来相似，但现在抽象会带来更高风险？

它不替代：
1. `README` 的需求边界
2. `text scale` 的实现计划
3. `debate` 纪要中的完整争论过程

## 裁定摘要
本轮最终裁定不是“把大块页面组件通用化”，而是先做：
1. `typography tokens`
2. 升级版 `SegmentedControl`
3. 极薄 `ModalFrame`
4. 微型文案原语：`Eyebrow / FieldLabel / MetaCode / HelperText`

暂不进入第一批：
1. 通用 `SettingsOptionSection`
2. `StatBlock / MetricTile`
3. 语义按钮族
4. 通用 `InfoCard`
5. `AccountCard`、`UsageDeskWorkspace`、`Sidebar` 的整体通用化

## 第一批候选

### 1. Typography Tokens
状态：`must`

原因：
1. 当前 `style.css` 只有颜色类变量，字号和密度仍大量硬编码在组件内部。
2. 如果不先收 token，后面每抽一个组件，都会把旧的 `8px/9px/10px` 再固化一层。

主要证据：
1. `frontend/src/style.css`
2. `frontend/src/features/settings/SettingsFeature.tsx`
3. `frontend/src/features/accounts/components/AccountCard.tsx`
4. `frontend/src/features/accounts/components/AccountsToolbar.tsx`
5. `frontend/src/components/ui/SegmentedControl.tsx`

建议输出：
1. `--text-eyebrow`
2. `--text-field-label`
3. `--text-helper`
4. `--text-body`
5. `--text-title-sm`
6. `--text-metric`

### 2. Upgraded SegmentedControl
状态：`must`

原因：
1. `text scale` 设置本身就会落在离散档位切换控件上。
2. 现有 `SegmentedControl` 直接写死 `text-[9px]`，是当前最明显的字体放大阻塞点之一。
3. 这个控件的职责边界比较清晰，适合先收口。

主要证据：
1. `frontend/src/components/ui/SegmentedControl.tsx`
2. `frontend/src/features/settings/SettingsFeature.tsx`

建议边界：
1. 只处理离散单选
2. 接入 text scale token
3. 接入统一最小高度 / padding
4. 不扩展成多选筛选菜单

### 3. ModalFrame
状态：`must`

原因：
1. 多个 modal 的遮罩、容器、header/footer 壳、关闭行为高度相似。
2. modal 是当前 `8px/9px/10px/11px` 小字最密集的高频区域之一。
3. 如果主页面字号变大但弹窗不统一，用户最先感知到的回归会出现在这里。

主要证据：
1. `frontend/src/features/accounts/components/ApiKeyComposeModal.tsx`
2. `frontend/src/features/accounts/components/OpenAICompatibleComposeModal.tsx`
3. `frontend/src/features/accounts/components/CodexOAuthModal.tsx`
4. `frontend/src/features/accounts/components/PasteAuthModal.tsx`
5. `frontend/src/features/accounts/components/OpenAICompatibleDetailModal.tsx`
6. `frontend/src/components/biz/AccountDetailModal.tsx`

建议边界：
1. 只抽遮罩、容器、header/footer 壳和基础布局
2. 不接管业务内容
3. 不做 render-props 巨型容器
4. 允许 `maxWidth`、`scrollableBody` 这类少量稳定配置

### 4. Micro Copy Primitives
状态：`must`

建议项：
1. `Eyebrow`
2. `FieldLabel`
3. `MetaCode`
4. `HelperText`

原因：
1. 当前最脆弱的不是大标题，而是这些到处散落的 `8px/9px/10px` 小型文案。
2. 它们跨 `Settings`、`Accounts`、`Status`、modal、toolbar 高度重复。
3. text scale 成功与否，很大程度取决于这批微型文案能否整体、稳定地一起放大。

主要证据：
1. `frontend/src/features/settings/SettingsFeature.tsx`
2. `frontend/src/features/accounts/components/AccountCard.tsx`
3. `frontend/src/features/accounts/components/AccountsToolbar.tsx`
4. `frontend/src/components/biz/AccountDetailModal.tsx`

## 第二批候选

### 1. PreferenceRow
状态：`later`

原因：
1. `SettingsFeature` 里确实已经存在高度相似的设置行。
2. 但当前至少有两种状态机：
   - 纯同步切换
   - 带 `loading/saving/message` 的异步保存
3. 现在直接抽，很容易膨胀成带很多可选 props 的总成组件。

建议策略：
1. 先用 token + `SegmentedControl` + 微型文案原语收口
2. 等 text scale 第一轮上线后，再看 `PreferenceRow` 是否真的稳定

### 2. FormField
状态：`later`

原因：
1. compose modal 里都在重复 `label + input + error`
2. 但字段更新策略差异很大，状态模型也不一致
3. 现在就抽容易把状态管理策略也一起塞进去

建议策略：
1. 先统一 label、input、error box 的 token 和极薄布局
2. 后续若 form 结构继续收敛，再评估是否上升为组件

### 3. MetricBlock / StatCell
状态：`later`

原因：
1. 状态页、设置页、详情页都在重复“标签 + 数值”块
2. 但这些块的语义、密度、布局差异仍偏大
3. 现在抽容易把组件 API 做成 size/tone/layout 全部可配的大变体

建议策略：
1. 先统一数值字号 token、card header token、spacing token
2. 再看是否有必要上升为 `StatCell`

### 4. FilterMenu
状态：`later`

原因：
1. `AccountsToolbar` 的 filter dropdown 有明确复用潜力
2. 但当前只有单一落点，且模型是单选 + 多选混合
3. 还看不到足够稳定的第二个消费方

## 当前不建议抽象

### 1. AccountCard 整体
原因：
1. 承担 selection mode、pending delete、quota refresh、reauth、details 等复杂交互
2. 与 detail modal 虽然共享局部展示语义，但交互职责完全不同

### 2. UsageDeskWorkspace 图表与摘要整体
原因：
1. 领域语义太强
2. 布局、图表、状态联动复杂
3. 当前应优先解决字号与局部 token，不应引入更大抽象风险

### 3. Sidebar 整体
原因：
1. 虽然导航结构稳定，但目前重点只是 typography 和导航 item 层级
2. 还没到必须组件库化的程度

### 4. 语义按钮族
原因：
1. 目前 `btn-swiss` 更像视觉底座，不是稳定的按钮语义体系
2. 各处仍通过 `!px-* !py-* !text-*` 大量重写尺寸
3. 应先收 token，再决定是否拆出 `PrimaryButton / DangerButton`

## 建议实施顺序
1. `typography tokens`
2. 升级 `SegmentedControl`
3. `ModalFrame`
4. `Eyebrow / FieldLabel / MetaCode / HelperText`
5. 在 `SettingsFeature` 与 2 到 3 个 modal 中接入
6. 再评估 `PreferenceRow / FormField / MetricBlock`

## 进入实现前的检查问题
1. 这个候选是否直接减少了 text scale 的维护面？
2. 它的 API 是否已经稳定到不会在两三个页面后爆炸？
3. 它抽出去之后，是否只是把硬编码字号换了个文件继续写死？
4. 如果只用 token / utility class 就能解决，是否真的需要组件化？

## 相关链接
1. `docs-linhay/spaces/20260429-text-scale-settings/README.md`
2. `docs-linhay/spaces/20260429-text-scale-settings/plans/20260429-text-scale-settings-plan-v01.md`
3. `docs-linhay/spaces/20260429-text-scale-settings/debate/20260429/text-scale-settings/20260429-text-scale-settings-v01.md`
