---
name: gettokens-frontend-design-quality
description: "GetTokens 桌面/Wails 前端设计质量统一 skill，合并 taste-skill、Impeccable 与 frontend-system-design 的可复用方法。Use when designing, shaping, auditing, polishing, hardening, or system-designing GetTokens frontend/Wails surfaces: UI/UX flows, Gemini/frontend handoff briefs, visual anti-pattern audits, state/DTO/routing/performance checklists, desktop previews, screenshots, and frontend acceptance criteria. 适用于前端体验优化、视觉重构、复杂页面系统设计、设计稿落地、审计页面、发布前 harden；不用于纯后端/sidecar 修复。"
---

# GetTokens Frontend Design Quality

统一入口：把 `taste-skill`、`impeccable`、`frontend-system-design` 沉淀为一个 GetTokens 前端设计质量 skill。不要再拆成多个相似 frontend skills；按本文件的模式选择对应流程即可。

## 0. GetTokens 固定边界

- 默认目标是 **macOS/Wails 桌面工作台**，不是移动端或营销站。
- Codex 负责需求边界、业务状态、接口契约、测试门禁、文档和最终集成；视觉实现可按 AGENTS 规则交给 Gemini/设计技能主导。
- 不直接引入参考项目源码、CLI、浏览器扩展或运行时依赖；如需引入检测器/工具，单独开 space 并先写测试。
- 不用前端假状态掩盖 sidecar 事实：账号、quota、routing、live sessions 等热路径必须尊重 sidecar 数据边界。

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
