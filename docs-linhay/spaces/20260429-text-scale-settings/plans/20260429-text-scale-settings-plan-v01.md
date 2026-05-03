# 20260429 Text Scale Settings Plan v01

## 目标
把“APP 文字太小，需要提供设置项”收敛成一个可执行、可回归、可渐进落地的实现计划。

## 现状判断
1. 当前设置体系已有 `theme`、`locale`、`local usage refresh interval`，说明“用户偏好配置”已有稳定入口。
2. 当前 typography 体系没有统一 token，很多组件直接写死 `text-[8px]`、`text-[9px]`、`text-[10px]`。
3. 这意味着真正的工作量不在“加一个设置项”，而在“让设置项能驱动全局文本层级”。

## 建议范围

### 第一阶段：收口方案与测试边界
1. 确认文案与档位：
   - `默认`
   - `较大`
   - `更大`
2. 确认默认值：
   - 保持当前版本作为默认档位
3. 确认持久化：
   - 先沿用前端本地存储，与 `ThemeContext`、`I18nContext` 对齐
4. 确认回归清单：
   - `Sidebar`
   - `Settings`
   - `Status`
   - `Accounts`
   - 详情/编辑类弹窗
   - `Usage Desk`

交付物：
1. 本 space `README`
2. 本计划文档

### 第二阶段：TDD 建基础设施
先补失败测试，再写实现。建议最少覆盖：
1. `text scale` 偏好读写
2. 非法值回退到默认档位
3. 档位到 CSS scale/token 的映射
4. `Settings` 页面切换后能立即更新当前值

建议测试位置：
1. `frontend/src/context/` 新增 text scale context 测试
2. `frontend/src/features/settings/` 新增 text scale 选项与映射测试

### 第三阶段：实现全局 text scale
1. 新增 `TextScaleContext`
2. 在 `App.tsx` 根层接入 provider
3. 根节点挂接 `data-text-scale` 或 CSS 变量
4. 在共享样式层定义字号 token，至少覆盖：
   - 超小标签
   - 表单标签
   - 正文
   - 指标数值
   - 标题

阶段完成标准：
1. 改变档位时，至少共享组件可以随档位变化
2. 默认档位不影响现有页面

### 第四阶段：顺手抽取第一批可复用基础件
建议只抽“重复结构已稳定、且和字号规则强相关”的极薄公共层：
1. 升级版 `SegmentedControl`
2. `ModalFrame`
3. `Eyebrow / FieldLabel / MetaCode / HelperText`

阶段完成标准：
1. 至少 2 到 3 个现有页面/弹窗已经接入新基础件
2. 新基础件不引入超大 props 和不透明的样式逃逸
3. 新基础件的字号行为由 token 驱动，而不是内部再写死 `8px/9px`
4. 明确不在本阶段抽业务层 `SettingsOptionSection`、`FormModal`、`InfoCard`

### 第五阶段：替换高风险页面硬编码字号
优先顺序建议：
1. `SettingsFeature`
2. `Sidebar`
3. `StatusFeature`
4. `AccountCard` / `AccountsToolbar`
5. `AccountDetailModal` / `ApiKeyDetailModal` / `OpenAICompatibleDetailModal`
6. `AccountRotationModal`
7. `UsageDeskWorkspace`

策略：
1. 优先替换共享模式重复最多的标签、meta、button、badge
2. 极端窄空间组件允许保留少量例外，但必须显式标注原因
3. 对于会因为字号变大导致拥挤的组件，优先增加 `min-height`、`gap`、`padding`，不要只压缩文案
4. 若局部结构重复但状态机差异大，先收 token 和极薄骨架，延后抽“有业务语义”的总成组件

### 第六阶段：验收与截图
1. 每个高风险页面至少保留一组 `before / after` 截图
2. 截图优先覆盖：
   - 默认档位
   - 较大档位
3. 若 `更大` 档位风险过高，可作为实验性档位延后，但要在实现前先明确是否进入 v1

## 关键设计决策
1. 不做浏览器缩放
2. 不做自由滑杆
3. 先做前端本地偏好，不引入 sidecar / Go 配置写回
4. 先覆盖“全局 text scale”，不扩展到“整体 UI density”

## 风险清单
1. 当前存在大量固定像素字号，替换范围比直觉大。
2. 大量文字使用大写、斜体、宽 tracking，字号变大后更容易溢出。
3. 图表、卡片、toolbar、segmented control 的高度可能要联动调整。
4. 如果不做分阶段回归，很容易出现默认档位没问题、放大档位局部爆布局的情况。
5. 如果组件抽象做得太早太深，容易把语义不同的卡片/弹窗错误合并，导致 props 膨胀。
6. 若不限制 `SegmentedControl` 边界，可能被误扩展为通用筛选控件，反而增加维护成本。

## 推荐验收方式
1. 自动化：
   - 前端单元测试 / 类型检查
2. 手工回归：
   - 设置切换即时生效
   - 重启后保留
   - 高风险页面无明显布局破坏

## 暂不进入本轮的内容
1. 跟随系统无障碍文字大小
2. 自定义百分比字号
3. 比例字体 / 阅读模式切换
4. 全面重构视觉设计系统
