# 2026-04-29 账号轮动与 API Key 身份边界

## 背景

本轮会话表面上是连续的 UI 微调，但真正反复触发回归风险的，是账号池里两条更底层的领域边界：

1. `codex api key` 编辑配置后，前端引用的账号 `id` 不能变化
2. 轮动里的“禁用”不是“移出顺序”，而是“保留位置但不参与实际轮动”

如果这两条边界不固定下来，后续无论继续改 modal、列表卡片、provider workspace，还是继续拆 Wails / sidecar / frontend 状态流，都会反复出现“状态丢失、按钮语义不一致、拖拽排序后又回退”的问题。

## 1. Codex API Key 身份边界

### 1.1 稳定 ID 优先于派生配置指纹

`codex api key` 以前的资产 id 本质上由这组三元组派生：

- `apiKey`
- `baseUrl`
- `prefix`

这对“只读展示”还勉强成立，但对可编辑详情面板不成立，因为一旦用户保存了新配置：

- 选中态会失效
- 详情 modal 绑定的账号对象会漂移
- 禁用状态、排序引用、前端 pending state 都可能丢锚

因此这轮把 `codex api key` 的记录身份改成：

- 持久化保存一个稳定 `LocalID`
- 前后端统一优先使用这个 `LocalID` 作为 `AccountRecord.id`
- 配置三元组只保留为“配置身份”和去重判断依据

### 1.2 去重规则不能跟着稳定 ID 一起放松

虽然记录 id 稳定了，但“账号是否重复”仍然按归一化后的配置身份判断：

- `NormalizeBaseURL(baseUrl)`
- `NormalizePrefix(prefix)`
- `apiKey`

也就是说：

- 更新同一条记录时，允许它改配置
- 但不能改成另一条记录已经占用的配置身份

这样可以同时满足“可编辑”与“不会把两条上游资产合并污染”。

## 2. 轮动禁用语义边界

### 2.1 禁用不是删除，也不是脱离排序

轮动视角里的禁用语义固定为：

- 账号仍保留在轮动顺序里
- 排序值仍然参与保存
- sidecar 实际轮动时跳过 disabled 账号

因此轮动卡片、账号池卡片、provider workspace 的状态文案都要围绕同一个语义表达：

“保留当前位置，但不参与轮动”

### 2.2 禁用入口必须统一

这轮把禁用动作统一收口到 `SetAccountDisabled`：

- `auth-file:<name>`
- `codex-api-key:<stable-id>`
- `openai-compatible:<name>`

前端不要继续分散成多个“某类资产专用禁用按钮”的实现，否则 modal 和 workspace 很容易再次分叉出不同能力集。

## 3. 轮动卡片 UI 边界

`AccountRotationModal` 不应该长成一套新的卡片系统。

这轮确认的 UI 边界是：

- 轮动卡片复用账号池 `AccountCard` 的内容层级和视觉语言
- 轮动特有信息只额外增加：
  - 左侧排序轨道
  - 拖拽提示
  - 底部启用/禁用动作

换句话说，轮动卡片应该是“账号池卡片的轮动变体”，不是“另一个页面重新设计的一张卡”。

## 4. 本轮落地结果

1. `ApiKeyDetailModal` 已支持保存 `apiKey / baseUrl / prefix`
2. `codex api key` 保存配置后 `id` 保持稳定
3. 三类账号都支持统一启用 / 禁用
4. disabled 账号继续保留轮动位置，但不会参与轮动
5. `AccountRotationModal` 卡片已回收到账号池卡片风格

## 5. 后续执行入口

后续再做账号池 / 轮动 / provider workspace 相关任务时，优先按项目级 skill `gettokens-domain-engineering` 执行，特别检查：

1. 账号身份是否稳定
2. 禁用语义是否仍是“保留位置但跳过”
3. 新 UI 是否复用了账号池既有卡片系统，而不是再开一套
