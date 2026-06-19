---
name: gettokens-plan-arbiter
description: GetTokens 方案仲裁：比较多个 agent、方案文档、计划草案或设计方向，收敛成一个可执行决策。
---

# GetTokens Plan Arbiter

当用户要求比较、仲裁、合并或选择多个方案时使用本 skill。典型触发语：

1. “比较这几个方案”
2. “让几个 agent 互审后定一个”
3. “Codex/Gemini/subagent 给的方案哪个靠谱”
4. “仲裁方案”
5. 直接点名 `gettokens-plan-arbiter`

## 目标

把多份计划收敛成一个能直接执行的方向，而不是把所有内容混成一个折中清单。

完成状态：

1. 已重建用户的真实目标和硬约束。
2. 已把每份方案归一成可比较的事实。
3. 已用当前仓库、space、dev 文档、测试和代码事实复核关键假设。
4. 已输出一个 Adopt / Hybrid / Revise first 决策。
5. 已给出执行顺序、验证门禁、被拒方案原因和执行者建议。

## 前置门禁

1. 先读取 `AGENTS.md`、当前 `git status --short --branch -uall` 和相关 `space` / dev 文档。
2. 若方案来自外部 skills、prompt library 或 agent workflow，先按 `external-workflow-intake` 判断是否需要 GetTokens 化吸收。
3. 若方案涉及 sidecar / Wails / frontend / dev bridge / native runtime，必须先标出权威事实源和验收证据。
4. 方案仲裁默认只读；只有用户已经明确要求执行，且选定方案没有阻塞项，才进入实现。

## 归一化

对每份方案提取同一组字段：

1. 目标和非目标。
2. 关键假设和未决问题。
3. 计划触碰的文件、模块、API、DTO、UI 状态、space 或工作流。
4. 实施顺序和可独立合并的阶段。
5. 测试、截图、DOM、Wails build、sidecar mock 或真实桌面验收门禁。
6. 数据迁移、发布、回滚或兼容风险。
7. 适合由主控 agent、Gemini、subagent 或人工执行的部分。

不要奖励篇幅。优先选择能被当前仓库事实验证、能小步交付、能清楚说明 tradeoff 的方案。

## 交叉复核

逐项检查：

1. 是否满足用户当前请求，而不是只满足某个 agent 的总结。
2. 是否违反 `AGENTS.md`、space 范围、GetTokens 领域边界或已有治理规则。
3. 是否把 motivating example 误当成核心抽象。
4. 是否遗漏 hard-to-reverse decision：wire format、public id、SQLite/schema、auth/ownership、sidecar authority、hash/modal route、Wails binding。
5. 是否把浏览器预览误当成 native/Wails/runtime 验收。
6. 是否有阶段依赖倒置：Phase N 不能独立合并，必须等 Phase N+1 才有用。
7. 是否存在不必要的 scope drift、外部依赖或无法验证的承诺。

必要时可让 subagent 做独立审查，但主控 agent 必须重新打开关键文件和证据后再下结论。

## 决策规则

输出三种结果之一：

1. **Adopt**：采纳某一方案，允许少量修正。
2. **Hybrid**：明确列出从哪些方案保留哪些部分，形成一个新执行计划。
3. **Revise first**：两个或多个方案都缺少关键事实、互相冲突或无法验证，先退回补计划。

排序原则：

1. 正确满足用户目标和项目硬规则。
2. 基于真实文件、API、DTO、测试、UI 和运行态证据。
3. 第一刀足够小，且不堵死后续方向。
4. 验证与回滚路径更清楚。
5. 质量足够时，执行成本和 token 成本更低。

## 输出模板

```md
Decision
- Adopt / Hybrid / Revise first.

Why
- 决定性证据和 tradeoff。

Execution Plan
- 有序步骤，写清文件、模块或文档面。

Borrowed
- 从非主方案保留的具体内容。

Rejected
- 明确不采用的内容和原因。

Verification
- 测试、docs check、浏览器/DOM、截图、Wails build、sidecar mock 或桌面验收。

Executor
- 建议由主控 agent / Gemini / subagent / 人工执行的边界。
```

如果用户已授权执行，先用一句话说明选定方向，再按计划推进；否则停在决策备忘录，等待用户确认。

## GetTokens 特别规则

1. UI / 前端体验方案若只改视觉但影响接口、状态流转或关键交互闭环，必须先由 Codex 明确业务边界，再交给 Gemini 或 UI subagent。
2. sidecar 热路径、route guard、quota、usage、live sessions、Codex WebSocket 或 management API 方案必须先说明 mock upstream facts 与 mock downstream / spy outputs。
3. 方案要进入多日并行开发时，先补 `space`，必要时再建同 key branch / worktree。
4. 若方案本质是外部 workflow 吸收，优先更新现有 skill / dev doc；只有 admission gate 通过且现有 skill 无法承载时才新增 skill。
5. 仲裁后如果产生稳定模式，收尾前按 `gettokens-session-skill-distill` 判断是否写入 skill、dev 文档、AGENTS 或 memory。
