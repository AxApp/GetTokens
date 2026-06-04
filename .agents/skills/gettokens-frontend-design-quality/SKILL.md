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
