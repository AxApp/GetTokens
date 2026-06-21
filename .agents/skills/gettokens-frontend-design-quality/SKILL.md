---
name: gettokens-frontend-design-quality
description: "GetTokens 桌面/Wails 前端设计质量统一 skill，合并 taste-skill、Impeccable 与 frontend-system-design 的可复用方法。Use when designing, shaping, auditing, polishing, hardening, or system-designing GetTokens frontend/Wails surfaces: UI/UX flows, Gemini/frontend handoff briefs, visual anti-pattern audits, state/DTO/routing/performance checklists, desktop previews, screenshots, and frontend acceptance criteria. 适用于前端体验优化、视觉重构、复杂页面系统设计、设计稿落地、审计页面、发布前 harden；不用于纯后端/sidecar 修复。"
---

# GetTokens Frontend Design Quality

统一入口：把 `taste-skill`、`impeccable`、`frontend-system-design` 沉淀为一个 GetTokens 前端设计质量 skill。不要再拆成多个相似 frontend skills；按本文件的模式选择对应流程即可。

## 0.1 Project Skill Discovery Boundary

2026-06-19 起，Taste 外部包中的视觉风格和图像生成子 skill 不再作为项目级 `.agents/skills/*` 直接参与 discovery。GetTokens 前端/Wails 体验任务默认走本 skill；需要查阅原始外部 prompt 时，读取 `docs-linhay/references/taste-skill/skills/` 下的参考副本。

保留在项目级 discovery 的 Taste 子 skill 只有：

- `output-skill`：用于完整输出/防截断。

已由本 skill 承接或转为参考的入口包括：

- `taste-skill`
- `taste-skill-v1`
- `gpt-tasteskill`
- `redesign-skill`
- `soft-skill`
- `minimalist-skill`
- `brutalist-skill`
- `stitch-skill`
- `image-to-code-skill`
- `imagegen-frontend-web`
- `imagegen-frontend-mobile`
- `brandkit`

## 0. GetTokens 固定边界

- 默认目标是 **macOS/Wails 桌面工作台**，不是移动端或营销站。
- Codex 负责需求边界、业务状态、接口契约、测试门禁、文档和最终集成；视觉实现可按 AGENTS 规则交给 Gemini/设计技能主导。
- 不直接引入参考项目源码、CLI、浏览器扩展或运行时依赖；如需引入检测器/工具，单独开 space 并先写测试。
- 不用前端假状态掩盖 sidecar 事实：账号、quota、routing、live sessions 等热路径必须尊重 sidecar 数据边界。
- 当前运行态只保留一套 `classic light` 样式；不要新增或恢复 `system/dark/light` 切换、`theme-preset` 选择、`.dark` token override、parchment 平行 token 或 Wails 透明窗口合成，除非用户重新开启主题 space 并先更新需求、测试和验收边界。

## 1. 选择模式

根据用户意图选择一个主模式，可组合但不要全量机械执行：

| 模式 | 何时用 | 输出 |
|---|---|---|
| **Shape/Handoff** | 需求模糊、要出交互方案、交给 Gemini/前端实现、设计稿落地前 | design brief + handoff |
| **System Design** | 新增/重构 workspace、涉及 Wails DTO/sidecar/轮询/history/cache/核心域状态 | frontend system design checklist |
| **Audit/Polish/Harden** | 已有页面要审计、反模板化、压缩密度、发布前 harden | P0-P3 audit + fix order + evidence |
| **Implementation Gate** | 已进入代码实现或收尾验收 | tests + screenshots + Wails/desktop evidence |

## 2. Shape/Handoff 模式

先在对应 `space README` 或 `plans/` 中补设计 brief：

- Goal / user scenario / success criteria
- Data contract：Wails binding、sidecar snapshot、history API、local draft、preview fallback 谁是权威
- State matrix：ready / loading / empty / partial / error / degraded / stale-cache / sidecar-not-ready
- Layout responsibilities：sidebar、主区、详情区、modal、表头、操作区
- Interaction rules：点击、筛选、清空、刷新、打开详情、关闭 modal、hash 恢复
- Visual density/tone：专业、冷静、工具感；默认中高密度但保留可扫读层级
- Anti-goals：不要营销站 hero、移动端优先污染、前端伪造 sidecar 状态
- Evidence required：单测、DOM 断言、无头截图、必要时 Wails 桌面实体验证

若信息不足，最多先问 2-3 个问题；能从上下文判断时，先 assert 再确认。

Handoff 模板：

```md
## Frontend Handoff: <surface>
- Goal:
- User scenario:
- Data contract:
- State matrix:
- Layout responsibilities:
- Interaction rules:
- Visual density/tone:
- Anti-goals:
- Tests/evidence required:
- Files likely touched:
```

## 3. System Design 模式

只挑与当前 feature 相关的问题，不机械填表：

### 3.1 PRD / space 输入

- 背景：为什么现在做，用户痛点是什么。
- 范围：本期做什么，不做什么。
- 用户流：入口、主路径、失败恢复路径。
- 数据范围：0、1、典型、极限数量。
- 角色/权限：普通用户、无账号、账号禁用、provider 不可用。
- 验收：功能、视觉、性能、文档、截图、测试。

### 3.2 State authority

为每类状态指定权威来源：

| 状态类型 | 常见权威 |
|---|---|
| 账号/凭证 | sidecar/account SQLite + Wails projection |
| quota/billing | sidecar refresh + Wails DTO |
| live sessions | sidecar snapshot/history，live poll 为权威快照 |
| UI draft | frontend local state，保存后回写 Wails/sidecar |
| preview | explicit preview data，不污染真实 runtime |

禁止后续轮询用本地旧状态抵消 sidecar 权威删除/过滤。

### 3.3 API / DTO / routing

- internal Wails DTO、root `app_types.go`、mapper、`frontend/wailsjs`、frontend model 必须一致。
- 错误类型要能区分 not-ready、unauthorized、not-found、partial、upstream failure。
- 详情和调试 modal 默认全应用视口遮罩。
- 打开写入 `detail=<id>` 或 `modal=<route>`；关闭只移除对应参数。
- canonicalizer 不得丢仍属于当前 frame/workspace 的 modal/detail 参数。

### 3.4 Performance / privacy

- 大列表默认考虑分页/windowing/虚拟滚动或限制 history window。
- 轮询要有去重、取消、失败退避和 cache source label。
- 图表/时间线要能处理 0、少量、大量数据。
- 截图、日志、memory 不写 token/cookie/完整密钥。

## 4. Audit/Polish/Harden 模式

### 4.1 P0-P3 分级

- **P0 Blocking**：阻断任务完成、数据误导、危险操作无保护、sidecar 状态被伪造。
- **P1 Major**：核心路径难用、明显 a11y/i18n/长文本问题、状态缺失、Wails 契约不一致。
- **P2 Minor**：布局密度、层级、对比、空态质量、局部交互反馈不足。
- **P3 Polish**：间距、阴影、微动效、文案质感、图表细节。

先修 P0/P1，再做 P2/P3。不要把 polish 当成修复契约问题的替代品。

### 4.2 审计维度

- **任务与状态**：最重要任务是否一眼可见；loading/empty/error/degraded/sidecar-not-ready 是否齐全；清空/删除/重试/刷新是否有反馈和禁用态。
- **数据与契约**：页面展示是否来自权威数据源；DTO/root Wails/frontend model 是否一致；history/snapshot/preview fallback 边界是否清楚。
- **视觉 anti-pattern**：卡片套卡片、过高 summary card、无意义 stats 卡、AI 紫蓝渐变、泛 glow、emoji、全居中、营销站式 hero。
- **A11y/i18n/theming**：键盘焦点、按钮语义、aria label、对比度；中文/英文长文本不溢出；深浅色 token 一致。
- **性能**：大列表/日志/请求时间线限制窗口或分页；轮询/history 加载节流、取消、避免重复请求。

### 4.3 Polish/Harden 规则

- 压缩信息块高度优先靠结构，不靠更小字体硬塞。
- 保留稳定扫描线：标题、摘要、操作、列表、详情不要跳动。
- 图表复用已有组件风格，避免每页一套视觉语言。
- 微交互只服务状态反馈，不做花哨动效。
- 发布前覆盖空数据、单条、典型、多条、超长文本、API 失败、部分失败、cache fallback、disabled/deleted/detached account、hash 恢复。
- 任何文案改动同步 `frontend/src/locales/zh.json` 和 `frontend/src/locales/en.json`。

报告模板：

```md
## Frontend Audit
Score: <0-20> / 20
- P0:
- P1:
- P2:
- P3:

### Anti-pattern verdict
### Fix order
### Evidence required
- tests:
- screenshots:
- Wails check:
```

## 5. Implementation Gate

- 先写场景和失败测试；纯视觉也至少要有 DOM/截图脚本或组件状态测试。
- 浏览器验收默认无头，截图落到对应 `space/screenshots/YYYYMMDD/<module>/`。
- 浏览器截图只能证明布局/密度；Wails binding、sidecar readiness、系统菜单、进程生命周期必须用桌面实体验证。
- 修改 Go/Wails binding 后，检查 root `app.go` / `app_types.go` / mapper / `frontend/wailsjs` 是否同步。
- 收尾运行 `docs-linhay/scripts/check-docs.sh`；若未跑自动化测试，交付说明写明原因和风险。

## 6. 继续沉淀规则

- 页面/模块专属经验：写到对应 `space` 或 `docs-linhay/dev/`。
- 可跨模块复用且与本 skill 同域：更新本 skill，不新增相似 frontend skill。
- 明显不同域：再新增独立 skill。
- repo-wide 长期治理规则：再同步 `AGENTS.md`，不要把一次性偏好升级为全局规则。

### 4.4 Live/detail surface consistency rule

当同一页面存在“总览 / 选中项详情 / 项目维度 / 会话维度”等多个状态时，先识别这些状态是否展示同一类内容模块；如果是同类模块，必须共用同一套外壳和行样式，而不是只修用户刚指出的单个实例。

适用模块：趋势图、请求时间线、请求列表、项目/会话列表、summary cards、详情卡片。

执行顺序：
1. 找出同类模块的所有入口：overview、selected detail、project view、empty/single/many rows。
2. 先统一组件职责和外壳：border、background、shadow、header 分隔、content padding、scroll container。
3. 再统一行级样式：选中态、hover、metric pill、空态、单条数据高度。
4. 避免“外层旧 wrapper + 内部新组件”导致双重卡片或两套视觉语言。
5. 单条数据不应被固定 `min-height` 撑成大空白；列表高度应由内容自然增长，再用 `max-height` 控制滚动。
6. 浏览器验收至少覆盖：overview、选中项、单条数据、多条数据；截图写入对应 space。

常见反例：
- 只把 selected detail 图表改成新样式，overview 图表仍是旧样式。
- 请求列表和请求时间线在同页使用不同外壳。
- 项目行点击改变左侧列表结构，导致用户预期的“选择后右侧汇总”变成“下钻”。
- 控制维度放到全局 sidebar，实际应放在页面 header / workspace header 的局部控制区。

### 4.5 Unified detail module rail rule

当详情页采用左侧 rail + 右侧内容的 band layout 时，模块显隐控制只能有一个权威入口；如果左侧 rail 已经提供 checkbox / tab / switch，子模块 header 内不得重复提供同义 enabled 控件。

适用模块：账号详情 Balance/Quota/Billing、可选配置模块、调试详情中的开关型子模块。

执行顺序：
1. 先定义外层模块状态枚举，例如 `quota-billing / quota-only / billing-only / empty`，而不是用多个布尔值在 JSX 中交叉短路。
2. 左侧 rail 控制模块是否渲染；取消模块后对应子 section 必须完全不输出，而不是 disabled 或空壳继续占位。
3. 只剩一个模块时，该模块使用单模块形态占满内容区；两个模块时才进入左右等分或上下分栏。
4. 子模块 header 只保留模块内动作，例如编辑、测试、刷新；不再重复显隐开关。
5. 嵌套子模块 header 使用紧凑 title/action row：左侧 title/meta，右侧 actions，避免 eyebrow、title、meta、actions 分散成多行碎片。
6. 共享组件复用到详情页时，需要显式关闭卡片列表语义的装饰线（例如 card row divider），避免把账号卡的分隔线带进详情内容区。

常见反例：
- 左侧 rail 有“额度模块”，Quota header 里又有“启用额度”。
- 取消额度模块后仍渲染 Quota 空壳，只是 checkbox 变成未选中。
- 只剩余额模块时仍保留两栏布局或左侧空列。
- 把账号卡中的 quota row divider 原样复用到详情页，导致模块内部多一条虚线。

### 4.6 Account credential endpoint boundary

当账号详情同时编辑默认基础 URL、按协议 endpoint 覆盖、代理路由和连通验证时，先按数据责任拆模块，不要把说明文字堆在同一列。

适用模块：API Key / OpenAI-compatible / Codex API Key 账号详情的凭据与验证区、协议 endpoint 覆盖区、代理路由区。

执行顺序：
1. 左侧凭据区只放账号名称、API 密钥、默认基础 URL、前缀和必要的短消息连通验证动作。
2. 默认基础 URL 是账号默认入口；不要在左侧字段下重复解释回退关系。
3. 协议 endpoint 覆盖属于连接/路由语义，应放在右侧连接/路由区域，优先位于代理配置上方。
4. 协议 endpoint 文案保持短句，例如 `协议端点`、`留空使用默认基础 URL。`；三端标签使用短名和短 hint。
5. 同一模块内避免 `CREDENTIAL / CONNECTION` 这类英文索引和中文标题叠加；保留一个可扫读标题即可。
6. 如果协议 endpoint 区已经紧贴右侧区域顶部，不要再加顶部边线；用右侧列分隔和模块间距表达层级。
7. 用 DOM/源码测试固定位置、文案长度和边线约束，再用浏览器检查实际密度。

常见反例：
- 左侧 `默认基础 URL` 字段下面再写“三端配置未填写专用端点时回退使用”。
- 协议 endpoint 区放在凭据字段和连通验证之间，导致凭据流被路由配置打断。
- `ENDPOINTS / 三端配置 / 分别覆盖... / 3 CAPABILITIES` 多层长文案同时出现。
- 右侧第一个模块顶部额外加粗线，看起来像被切成两个独立卡片。

### 4.7 Detail modal primary action slot

当 detail modal 内部表单有主动作，例如新建、保存、更新或应用配置时，优先放到 modal 顶部 header 导航栏动作位，不要在 body 顶部或列表底部单独插一条动作行。

适用模块：账号详情、项目配置、路由规则、调试详情、其他覆盖全应用视口的 detail modal。

执行顺序：
1. modal header 提供 primary action slot；业务组件仍持有 action handler、draft、validation、saving/pending 禁用态。
2. 如果 handler 必须留在业务组件里，用 portal 挂载到 header slot；不要把业务 draft 状态硬提到 shell 层。
3. body 首屏直接进入主要表单或列表，不再重复二级标题、规则计数、说明段落或空白动作条。
4. 主动作按钮只出现一次；源码测试固定 `onClick` 出现次数和 slot 挂载位置。
5. 浏览器验收检查按钮在 header 内、不在 body 内、位于 body 上方；同时检查 body 不出现横向滚动条。

常见反例：
- `新建规则` 放在左侧列表底部，用户滚动后才看到主动作。
- modal header 下面又渲染 `项目候选池 / 说明 / 1 rules` 这种重复标题栏。
- 为了把按钮放到 header，把表单 draft 和保存逻辑全部上提到 modal shell，导致 shell 承担业务状态。
- body 顶部保留一条只有按钮的空白 action row，占用内容空间。

### 4.8 Dense filter surface usability

当工作台页面存在多组筛选条件，尤其是账号池、会话列表、用量明细这类高频运维筛选时，不要把“默认不过滤”状态呈现为一屏全勾选 checkbox。默认全量是基线，不是用户已经选择的条件。

适用模块：账号池筛选、会话管理筛选、用量明细 facet、provider / model / status 多维过滤面板。

执行顺序：
1. 先定义筛选模型的语义：默认全量、单维收窄、多维组合、动态枚举项；保留旧本地存储和 URL 状态的兼容迁移。
2. 顶部摘要只显示真正启用的条件。无条件时显示短标签，例如 `显示`；有条件时显示 `显示 · N` 和可移除 condition chips。
3. 为高频路径提供快捷筛选 preset，例如 `全部 / 可用 / 需处理 / HTTP 错误 / 有额度 / API Key`；preset 只是写入同一份筛选状态，不另起一套隐藏状态。
4. 二元业务维度使用三段式控件：`全部 / 有 / 无`、`全部 / 是 / 否`、`全部 / 已用 / 未用`。不要用两个 checkbox 表达默认全量。
5. 动态枚举项，例如 `HTTP 401 / 402 / 429`，用 chips 呈现；需要支持单项移除，并在未来可追加数量标签。
6. 高级面板可以保留中高密度，但应把 `快捷筛选`、`当前条件`、`基础维度`、`动态维度`、`资源维度` 分段，避免一屏同权重 checkbox。
7. 测试必须覆盖 preset 到状态的映射、condition chip 删除、旧状态迁移和摘要排序；浏览器或设计系统验收至少覆盖默认态和已有条件态。

常见反例：
- 默认状态下 `Auth File / API Key / Pro / Free / 异常 / 已禁用 / 可请求 / 有额度 / 无额度...` 全部显示为已勾选。
- 摘要写成 `显示 · HTTP 401 · HTTP 402 · 有额度...`，长文本挤占分组、排序和批量操作。
- `有额度` 与 `无额度` 用两个 checkbox，用户需要理解“两个都选中等于不过滤”。
- 快捷筛选按钮维护一套额外状态，导致面板里的真实条件和按钮高亮不同步。

### 4.9 Dense grouped list collapse

当工作台列表按套餐、来源、状态、项目或其他业务维度分组，且每组可能包含大量卡片/行时，分组头应支持就地展开/收起，降低滚动成本；折叠是视图状态，不是数据筛选。

适用模块：账号池分组、会话列表分组、用量明细按项目/模型分组、provider 资产分组。

执行顺序：
1. 分组头保留稳定扫描线：展开按钮、标题、数量摘要和分组级动作同一行可见。
2. 折叠后只隐藏该组内容区；刷新、选择、禁用、删除、导出等动作仍按完整分组或当前可见分组数据执行，不因为内容区隐藏而缩窄作用域。
3. 折叠状态优先放在页面容器本地状态，按稳定 `group.id` 记录；分组模式、筛选或数据刷新导致 group 消失时清理无效 key。
4. 按钮必须有明确 `aria-label`、`aria-expanded` 和图标状态；文案同步中英文 locale。
5. 如果列表已有 windowing/virtualization，折叠态应不渲染内容 grid，避免隐藏后仍保留测量和大量 DOM。
6. 测试至少覆盖 props/state 传递、DOM collapsed 标记、折叠后内容 grid 不渲染、分组级动作仍使用原 `group.accounts`。

常见反例：
- 把折叠实现成筛选，导致全选/刷新/删除只作用于展开中的账号。
- 折叠后只把内容 `display:none`，但 virtualization 仍在测量大量不可见 DOM。
- 只有文字按钮，没有图标或 `aria-expanded`，用户难以快速扫描状态。
- 切换分组模式后旧折叠 key 残留，导致新分组初始状态不可解释。

### 4.10 Multi-entry config parity

当同一项本地配置、运行态设置或 Wails 写入 API 同时存在“完整工作台入口”和“快捷入口 / 账号卡入口 / 确认弹窗入口”时，快捷入口不能只展示 diff 或固定默认值；必须识别完整入口中的关键配置项，并用同一份 draft 驱动预览和最终写入。

适用模块：Status 本地 Codex apply 与账号池 apply、账号详情快捷应用、配置导入确认、任何复用 `Apply*ToLocal*` / `Update*Config*` 的多入口表单。

执行顺序：
1. 先列出完整入口已经暴露的关键配置：provider、model、auth strategy、transport、catalog sync、feature toggles、local state summary 等。
2. 快捷入口至少暴露会影响最终写入语义或运行态风险的字段；只读字段要明确标为状态或固定协议，例如 `wire_api=responses`。
3. 预览 diff 和确认写入必须读取同一份 draft；禁止 UI 开关只改展示、不进入 Wails DTO。
4. 如果快捷入口不能安全暴露完整配置，必须显示跳转或阻塞说明，而不是静默使用硬编码默认值。
5. 新增字段时同步检查 root Wails DTO、frontend generated types、draft model、preview diff、apply payload 和单测。
6. 单测至少覆盖：draft 默认值、可编辑入口存在、关键字段进入 apply payload；UI 截图或 DOM 验收覆盖配置区可见性。

常见反例：
- Status 页可配置 `sync_model_catalog`，账号卡 apply 却只写默认 `off`。
- 弹窗显示 `provider / model` 的 diff，但没有任何控件可改，用户只能取消后去另一个页面。
- `supports_websockets` 开关只影响预览文案，不传给 `ApplyRelayServiceConfigToLocalV2`。
- 快捷入口重新维护一套默认模型列表，和完整工作台读取的本地 Codex 状态不同步。

### 4.11 Reference layout vs visual skin

当用户给出参考截图要求“按这种效果”改 GetTokens 既有页面时，先拆分截图中的信息架构和视觉皮肤；除非用户明确要求迁移配色、材质或品牌语言，否则只借布局和交互模型，保留 GetTokens 当前视觉系统。

适用模块：Codex 配置页、账号池、状态页、调试面板、任何已有 GetTokens 工作台页面的截图驱动重排。

执行顺序：
1. 先复述参考图中可复用的信息架构，例如顶部筛选条、普通设置表、复合对象 panel、内部分组、主开关位置。
2. 再明确哪些不迁移：配色、圆角、阴影、浅色 tint、外部品牌 icon 风格、营销式留白。
3. 实现时优先保留现有 token：`border-color`、`bg-main`、`bg-surface`、`text-primary`、`text-muted`、`btn-swiss`、`input-swiss`、`ToggleSwitch`。
4. 对复合配置对象，父层用独立 panel 承担身份和主开关，子字段按语义分组；长 textarea 字段使用 label 在上、控件全宽，避免在窄列里强塞固定宽控件导致字段名竖排。
5. 浏览器验收除了截图，还要做 DOM 断言：目标 panel 存在、真实字段齐全、示例假字段不存在、父级路径不重复、没有新增临时配色 token。

常见反例：
- 看到浅蓝参考图后新增 `--codex-blue-*` token，把 GetTokens 现有黑白风格一起换掉。
- 只保留“卡片感”，但没有建立普通设置表和复合对象 panel 的层级。
- 在两栏复合面板里复用全局长字段宽度，导致 `usage_hint_text` 这类 key 竖排。
- 把参考图里的假字段名照搬到真实配置页面。

### 4.12 Functional review scope for UI migrations

当用户要求审查 UI 迁移但明确限定为“只看功能有没有坏”“不审样式”时，审查必须把功能回归和视觉/皮肤问题分开；不要把 token、字号、颜色、阴影、圆角或设计契约当作阻塞发现。

适用模块：Parchment token 迁移、AntD adapter 试点、基础 UI 组件换肤、Debug/Settings/Accounts 等页面视觉迁移后的功能验收。

执行顺序：
1. 先复述审查口径：本轮只看事件、状态、数据、路由、禁用态、输入输出、关闭/展开、选择/清空、复制/保存等功能行为。
2. 对通用组件逐项比对行为契约：`onChange`、`onClick`、`disabled`、`readOnly`、`aria` 状态、portal/overlay 关闭、外部点击关闭、keyboard handling、selected/open/expanded state。
3. 对业务页面比对 hook 和 handler 是否仍接入：列表数据来源、选中集合、全选/清空、复制/删除、保存/刷新、hash/modal 参数、Wails binding 调用保护。
4. 视觉类问题只能放到“非本轮阻塞备注”，除非它直接导致功能不可达，例如按钮不可点击、控件被遮挡、文本输入不可见、可访问名称丢失。
5. 验证优先使用 typecheck、build、相关 unit/model tests、DOM/源码断言；如果完整测试失败，必须说明失败是否来自本次 diff，不能把脏工作区的无关失败归因给当前提交。

常见反例：
- 用户要求只审功能时，仍把标题字号、inline color、阴影覆盖作为主要阻塞。
- 只看截图判断“没问题”，没有核对 `disabled`、`onChange`、外部关闭、选中状态和复制/清空等 handler。
- 完整测试因工作区其它未提交文件失败，却没有隔离说明，导致当前 UI 迁移被误判为功能失败。

### 4.13 Pinpoint browser polish loop

当用户在本地预览页连续指出具体 DOM 定位点、要求“这里改一下 / 字体不对 / 按钮只要图标 / 重叠了”等细粒度视觉调整时，把每个微调视为可回归的 UI 契约，而不是只做截图驱动的临时样式修补。

适用模块：账号卡、代理池、Workspace page header、工具栏、列表行、菜单按钮、AntD adapter 控件等本地桌面页面。

执行顺序：
1. 先定位用户给出的文件、组件和元素行，确认它属于当前可见页面和本轮目标，不顺手扩大到其它页面。
2. 若改动涉及 AntD 组件，先查 `antd info <Component> --format json` 或 lint，确认使用 props 和语义符合当前版本。
3. 结构调整优先让相关元素进入同一个横向或纵向容器，避免用绝对定位、负 margin 或单纯缩小字号规避重叠。
4. 图标按钮必须保留 `aria-label` / `title`，按钮尺寸、图标尺寸和间距使用稳定 class/token；不要仅靠按钮文字隐藏后留下不可解释宽度。
5. 每个视觉契约都补一个轻量 DOM/源码断言，锁住关键结构、class、无旧文案、无旧 wrapper 或无错误控件。
6. 浏览器验收优先读计算样式和 bounding rect：尺寸、间距、字体、文本是否为空、是否重叠；不需要每轮都保存截图。
7. 全高工作台壳层改造后必须检查主容器 bounding rect 是否被列表内容撑高；若高度远超 viewport，优先补外层 `min-h-0` 与 `overflow-hidden`，让列表列内部滚动。
8. 收尾时运行聚焦测试、typecheck、组件 lint（如 AntD），再说明浏览器实测值；不要只说“看起来好了”。

常见反例：
- 用户指出标签和按钮重叠，只把字体改小，没有把标签区和按钮放进同一横向容器。
- 图标按钮删除文字后没有 `aria-label`，或按钮仍保留文字按钮宽度。
- AntD AutoComplete 只改 input class，却忽略 options 自定义 label 的实际显示字号。
- 连续微调只靠手看浏览器，没有把最终布局写进可回归的 DOM/源码断言。

### 4.14 Quiet workspace migration loop

当一轮视觉收敛从单点微调扩展到多个真实工作台页面时，按“扫描旧样式信号 -> 选一个独立页面 -> 加门禁 -> 最小迁移 -> 验证 -> 提交”的小步节奏推进，避免一次性重写所有页面。

适用模块：代理池、会话管理、扩展注册表、Doctor workbench、状态页、账号详情等桌面工作台页面。

执行顺序：
1. 先用源码扫描定位旧样式高信号入口，例如粗描边、hard shadow、`bg-main/bg-surface`、heavy uppercase、旧 Swiss button 或局部硬编码色。
2. 每轮只选一个可独立验收的真实页面或一组强相关 modal；不要把多个业务域放进同一提交。
3. 先补轻量源码/DOM 测试并确认会因旧壳层失败，断言应覆盖新 shell 标记、共享 class 常量和旧样式禁止项。
4. 迁移时优先定义页面内共享 class 常量，如 panel、muted panel、button、chip、meta row；复用 `--gt-surface-*`、`--gt-border-*`、`--gt-text-*`、`--gt-elevation-*` token。
5. 页头摘要进入 `WorkspacePageHeader.meta`；主操作优先使用 40px icon-only 按钮并保留 `aria-label/title`；列表和详情区用轻描边、内部滚动和稳定 `min-h-0`。
6. 验证按风险选择 focused tests、typecheck、组件 lint、无头 preview 或浏览器 computed style；若某个 preview gate 有环境限制，记录替代证据而不是跳过说明。
7. 每个提交同步更新对应 space 和 memory，说明本轮页面、门禁、验证命令、剩余旧样式扫描结果；收尾整理时再判断是否需要扩写本 skill。
8. 当用户明确要求“整理/沉淀/提交”且当前工作区已经没有代码漂移时，不再为了制造提交而开启下一页迁移；只做治理闭环，记录最近完成切片、复用流程、未升级为 AGENTS/新 skill 的理由和下一批候选入口。
9. 当用户明确把节奏改成“把剩下的界面一次性收完”或已有跨页面视觉漂移需要收口时，可以增加一个运行态源码残留门禁，扫描 `frontend/src` 的 `.ts/.tsx/.js/.jsx`，排除 `*.test.*`、`*.stories.*` 与 `style.css` 这类测试/展示/兼容层；门禁只禁止运行态继续引入旧 Swiss class、粗描边、旧 `bg-main/bg-surface`、bracket shadow、heavy uppercase/tracking 等高信号样式，不把 Storybook 历史示例作为本轮阻塞。

常见反例：
- 一次性把多个页面改到半成品，最后只能靠截图主观判断。
- 先改视觉再补测试，导致旧 wrapper、旧文案或旧按钮宽度悄悄回归。
- 页面主容器缺 `min-h-0` / `overflow-hidden`，列表内容把工作台撑到远超 viewport。
- 只在 memory 记录完成页面，没有把可复用迁移节奏沉淀到前端设计 skill。
- 用户要求收尾整理时，又启动新的页面迁移，导致整理提交夹带未请求的新功能改动。
- 批量收口门禁把 `style.css` 旧兼容 class 或 stories 演示也纳入阻塞，导致一次视觉收口变成无边界的设计系统历史重写。
