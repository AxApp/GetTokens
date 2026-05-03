# 20260429 Text Scale Settings Handoff v01

## 交接目标
把本轮会话已经完成的规划、设计稿、debate 结论和实现边界整理成一份可直接交给后续 Agent 的 handoff，避免下一个实现者重复阅读整段会话。

## 当前结论

### 1. 产品结论
1. 需求不是“页面缩放”，而是“文字大小设置”。
2. 推荐档位固定为：
   - `默认`
   - `较大`
   - `更大`
3. 设置入口放在 `Settings -> Appearance`。
4. 首版默认沿用前端本地偏好持久化，不引入 Go / sidecar 配置写回。

### 2. 设计结论
1. 已产出一个单文件总览页，用于比较同一份内容在不同字号档位下的变化。
2. 当前用于判断字号差异的有效入口是：
   - `text-scale-design-gallery.html`
3. 总览页已经收敛成：
   - 同一份内容
   - 同一套布局
   - 只改变 `默认 / 较大 / 更大`
4. 用户在会话内额外确认：
   - `Large` 需要比初稿更大
   - `XL` 需要再拉大两号

### 3. 实现边界结论
1. 先做 `TextScaleContext + typography tokens`
2. 再改共享控件和极薄基础层
3. 最后替换页面级硬编码字号

## 当前已落地产物

### Space 文档
1. `README.md`
2. `plans/20260429-text-scale-settings-plan-v01.md`
3. `plans/20260429-component-reuse-candidates-v01.md`
4. `plans/20260429-text-scale-settings-handoff-v01.md`
5. `debate/20260429/text-scale-settings/20260429-text-scale-settings-v01.md`

### 设计稿
1. `text-scale-design-gallery.html`
2. `text-scale-design-option-a-editorial-utility.html`
3. `text-scale-design-option-b-raw-terminal-control-room.html`
4. `text-scale-design-option-c-warm-paper-console.html`

说明：
1. 后续实现应以 `text-scale-design-gallery.html` 作为主要视觉参考。
2. `option-a/b/c` 保留为历史过程稿，不是当前主入口。

## 后续 Agent 直接可执行的顺序

### 第一步：建立 text scale 基础设施
1. 新增 `TextScaleContext`
2. 对齐 `ThemeContext` / `I18nContext` 的本地持久化方式
3. 在 `App.tsx` 根层接入 provider
4. 在根节点挂接 `data-text-scale` 或 CSS 变量

### 第二步：收口 typography tokens
优先覆盖：
1. `eyebrow`
2. `field label`
3. `helper text`
4. `body`
5. `title small`
6. `metric`

### 第三步：改第一批共享层
只做这几项：
1. 升级版 `SegmentedControl`
2. 极薄 `ModalFrame`
3. 微型文案原语：
   - `Eyebrow`
   - `FieldLabel`
   - `MetaCode`
   - `HelperText`

### 第四步：高风险页面接入
建议顺序：
1. `SettingsFeature`
2. `Sidebar`
3. `StatusFeature`
4. `AccountCard`
5. `AccountsToolbar`
6. `AccountDetailModal`
7. `ApiKeyDetailModal`
8. `OpenAICompatibleDetailModal`
9. `AccountRotationModal`
10. `UsageDeskWorkspace`

## 组件复用裁定

### 第一批允许进入实现
1. `typography tokens`
2. 升级版 `SegmentedControl`
3. 极薄 `ModalFrame`
4. 微型文案原语

### 第二批观察项
1. `PreferenceRow`
2. `FormField`
3. `MetricBlock / StatCell`
4. `FilterMenu`

### 当前明确不要做
1. 通用 `SettingsOptionSection`
2. 通用 `InfoCard`
3. 语义按钮族
4. `AccountCard` 整体通用化
5. `UsageDeskWorkspace` 图表区通用化
6. `Sidebar` 整体通用化

## 关键风险
1. 当前仓库里 `text-[8px] / text-[9px] / text-[10px] / text-[11px]` 硬编码很多，替换范围比看起来大。
2. 大量文案是全大写、斜体、宽 tracking，字号变大后更容易溢出。
3. `SegmentedControl` 很容易被错误扩展成通用筛选控件，需保持边界只做离散单选。
4. 如果太早抽象大组件，会把旧字号固化进新组件，后续更难改。
5. modal 是当前最容易出现“页面变大了，弹窗没变”的断层区。

## 当前不纳入的临时内容
1. 本轮没有进入真实代码实现。
2. 没有开始抽具体组件代码。
3. 没有运行前端自动化测试，因为当前交付是规划、设计和治理文档，不是实现改动。
4. 三份 `option-a/b/c` 风格稿不再继续扩散，仅保留历史参考。

## 建议实现前先读
1. `README.md`
2. `plans/20260429-text-scale-settings-plan-v01.md`
3. `plans/20260429-component-reuse-candidates-v01.md`
4. `debate/20260429/text-scale-settings/20260429-text-scale-settings-v01.md`
5. `text-scale-design-gallery.html`

## 一句话交接
后续 Agent 不需要再重新做产品判断，本轮已经把需求、字号档位、设计参考、组件复用边界和实现顺序收敛完了；下一步直接进入 `text scale token + SegmentedControl + ModalFrame` 的实现即可。
