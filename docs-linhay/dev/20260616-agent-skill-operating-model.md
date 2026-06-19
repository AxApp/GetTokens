# Agent Skill Operating Model

日期：2026-06-16
状态：已落地为 GetTokens agent / skills 治理补充

通用入口：`.agents/skills/gettokens-ops-governance/SKILL.md` 的 `External Workflow Intake` 章节

## 背景

本轮阅读 `mattpocock/skills` 后确认，外部 repo 的主要启示不是“安装更多提示词”，而是把高频工程动作拆成小、可组合、可验证的 workflow。GetTokens 已经有项目级 skills、spaces、memory 和 subagent 治理，因此本轮采用“翻译成项目语境”的方式落地，而不是直接安装外部 skills。

参考来源：

- `https://github.com/mattpocock/skills`
- `setup-matt-pocock-skills`
- `grill-with-docs`
- `tdd`
- `diagnose`
- `improve-codebase-architecture`

## 决策

1. `AGENTS.md` 继续只承载 repo-wide 长期硬约束，不继续堆具体执行流程。
2. 外部 skills 的可复用模式优先进入既有项目 skill、`docs-linhay/dev/` workflow、领域词汇表或 memory。
3. 新增项目级 skill 前必须通过 admission gate：重复任务或失败模式、清晰触发语、具体执行步骤、可验证结果。
4. 对跨层需求默认采用 tracer-bullet：先打通一条窄的端到端行为，再扩展实现面。
5. 术语不一致本身视为工程风险，需要写入领域词汇表，而不是靠聊天解释。

## Agent Context Setup

非平凡 GetTokens 任务开始前执行：

1. 读取当前 `AGENTS.md`，确认是否有本轮新增或调整过的硬规则。
2. 运行 `git status --short`，识别已有脏文件，避免吸收无关改动。
3. 找到相关 `space`、`docs-linhay/dev/` 文档、领域 skill 和当天 memory。领域或治理 skill 优先从本仓 `.agents/skills/<skill-name>/SKILL.md` 读取；全局技能目录只是补充来源，不能用全局缺失否定项目级 skill。
4. 如果需求涉及 sidecar / Wails / frontend / dev bridge / native runtime，先写清权威事实源和验收证据。
5. 如果出现术语歧义，先查 `docs-linhay/dev/20260616-gettokens-domain-glossary.md`，缺词再补。
6. 对功能实现先列 BDD 场景和证据门禁，再进入红灯测试或最小实现。

## Skill Admission Gate

新增或扩展 skill 前逐项判断：

| 问题 | 通过条件 | 不通过时落位 |
| --- | --- | --- |
| 是否会重复出现？ | 已在多轮会话、多个 feature 或同类排障中出现 | memory |
| 是否有清晰触发语？ | 用户或任务文本能稳定命中该 skill | dev docs |
| 是否有具体执行步骤？ | agent 能按步骤完成，不靠临场发挥补关键流程 | dev docs / space plan |
| 是否可验证？ | 有命令、截图、DOM、API、日志、测试或结构校验 | memory / backlog |
| 是否已有承载 skill？ | 不能清晰放进现有 skill 时才新增 | 更新现有 skill |

结论规则：

1. 单领域复用：更新对应 `gettokens-*` domain skill。
2. 跨领域流程：写入 `docs-linhay/dev/`，并在 `gettokens-ops-governance` 挂入口。
3. repo-wide 长期硬约束：同步 `AGENTS.md`。
4. 一次性事实、决策、风险：写入当天 memory。
5. 半成品或下期项：写回对应 `space` 的 README / plans。

## Debug Feedback Loop

GetTokens 排障默认采用以下闭环：

1. **Issue source**：记录来自用户反馈、体验报告、backlog、日志还是测试失败。
2. **Current fact location**：指出当前代码、UI、sidecar response、SQLite、Wails DTO 或前端 selector 的事实位置。
3. **Reproduction or missing proof**：给出可复现现象，或证明某个期望状态缺失。
4. **Hypothesis**：一次只推进一个候选根因，写明什么证据会推翻它。
5. **Small instrument / test**：优先补 focused test、fixture、curl、DOM 断言或日志解析。
6. **Minimal fix**：只改能让证据闭环通过的最小范围。
7. **Regression check**：运行与影响面匹配的自动化验证；native/Wails runtime 只在适用时做真实 dev App 验收。
8. **Distill**：若本轮出现可复用失败模式，更新 skill / dev docs / glossary / memory。

## Tracer-Bullet Delivery

跨层需求不要先横向铺开。优先选一条用户可感知的行为链：

```text
sidecar authority -> internal/cliproxyapi DTO -> internal/wailsapp -> root App binding -> frontend model -> UI/DOM -> focused test or screenshot
```

执行要求：

1. 先补能失败的窄测试或 contract artifact。
2. 只透传权威字段，不在上层重新推导 sidecar authority。
3. root `main.App` 绑定、`frontend/wailsjs`、frontend 类型和 UI 状态必须一起验证。
4. browser preview 只能证明布局或普通交互；runtime binding、sidecar readiness、native 行为需要匹配风险面验证。
5. 一条链打通后，再扩展批量字段、更多 provider 或更多 UI 状态。

## 外部 Skills Intake

处理外部 skills repo、prompt library 或 agent workflow 时：

1. 先读取源内容，提炼其真正解决的失败模式。
2. 判断 GetTokens 是否已有等价 skill / doc / AGENTS 规则。
3. 不直接复制外部措辞；改写成 GetTokens 的事实源、路径、命令和验收门禁。
4. 不默认安装全量外部 skill 包，除非用户明确要求，且已记录来源、版本和更新流程。
5. 若只得到思想启发，落地为 dev workflow 或 glossary；若产生稳定执行入口，再更新 skill。

## 多方案仲裁

当外部 workflow、多个 agent、多个计划文档、PR 策略或设计方向互相竞争时，先使用 `.agents/skills/gettokens-ops-governance/SKILL.md` 的 `Plan Arbitration` 章节，再进入执行。

仲裁不是把所有方案平均混合，而是输出一个明确结果：

1. `Adopt`：采纳某一方案，允许少量修正。
2. `Hybrid`：明确从各方案保留哪些部分，形成一个新的执行计划。
3. `Revise first`：关键事实缺失或冲突，退回补计划。

仲裁前必须把每个方案归一成目标、假设、触碰面、实施顺序、验证方式、回滚/迁移风险和执行者建议。关键结论要回到当前仓库文件、space、dev 文档、测试、截图或运行态证据，不能只引用 agent 的总结。

本规则来自 `BuilderIO/skills` 的 `plan-arbiter`，已翻译进 GetTokens `gettokens-ops-governance`，不直接安装外部包。

## 验收

本工作流的验收方式：

1. `gettokens-ops-governance` 能指向本文件和领域词汇表。
2. `gettokens-ops-governance` 的 `External Workflow Intake` 能作为外部 workflow 吸收入口，并把 GetTokens 专属落位收敛在同一治理 skill 内。
3. 纯治理/文档沉淀至少运行：

```bash
docs-linhay/scripts/check-docs.sh
git diff --check
```

4. `AGENTS.md` 只保留项目级短入口；执行细则留在 `gettokens-ops-governance` 和本文档。

## 混合脏工作区下的提交收口

当一个 feature 已完成，但同一工作区还存在另一条需求的 tracked/untracked 改动时，提交本身必须先被视为一次治理动作，而不是简单 `git add .`：

1. 先读取 `git status --short --branch -uall`，把每个变更分为本 feature、无关用户改动、生成验收证据、混合内容文件。
2. 本 feature 使用精确 pathspec 或 hunk 暂存；混合 memory/docs 文件只暂存本 feature 段落，不能为了提交方便把其它需求记录一起带上。
3. 对 browser DOM snapshot、截图等验收产物单独判断。如果生成时叠加了无关主题、布局或本地实验改动，就不能把它提交到另一个 feature slice；应保留为本地证据或重新在干净工作树生成。
4. commit 前重新读取 `git diff --cached --name-only` 与 `git diff --cached --stat`，确认暂存面能逐项追溯到本 feature。
5. 验证命令按本 feature 风险运行；最终说明要明确 residual dirty files 属于哪条并行需求，避免把“工作树不干净”误读成当前 feature 未完成。

这个流程的执行入口在 `.agents/skills/gettokens-ops-governance/SKILL.md` 的 `Mixed Worktree Ship Hygiene`。它是跨功能的提交卫生规则，但还不是 repo-wide 硬约束，因此不升级到 `AGENTS.md`。

## 跨项目复用提示词

将下面提示词粘到其它项目的 agent 会话中，让它按该项目上下文落地同类流程：

```text
请负责把外部 skills / prompt library / agent workflow 的吸收流程落到本项目。

目标不是直接安装或照搬外部 skills，而是先提炼它们解决的稳定失败模式，再翻译成本项目自己的治理结构。请先读取本项目的 AGENTS/CLAUDE/README 等 agent 入口、现有 skills/agents/rules/docs/memory 目录和 git dirty 状态，然后执行：

1. 设计项目级 skill admission gate：新增或扩展 skill 必须同时满足“重复任务或失败模式、清晰触发语、具体执行步骤、可验证结果”。
2. 设计 agent context setup：非平凡任务开始前，agent 必须先读取项目规则、检查 dirty worktree、识别相关需求文档/skill/dev doc/memory，并避免吸收无关改动。
3. 设计外部 workflow intake：外部 skills / prompt library / agent workflow 只能作为参考输入，先提炼失败模式，再决定落到 AGENTS、项目级 skill、dev workflow、glossary、需求空间或 memory。
4. 如果项目有跨层架构，加入 tracer-bullet 原则：先打通一条窄的端到端行为链并验证，再扩展实现面。
5. 如果项目有领域术语混乱，新增或更新 domain glossary，给每个 canonical term 写清语义、权威事实源和验收证据。
6. 压缩 AGENTS：AGENTS 只保留项目级硬入口和路由规则；执行细则放到项目 skill 或 dev workflow，不把 AGENTS 写成手册。
7. 更新 memory / changelog / docs 索引，说明沉淀了什么、落在哪些文件、哪些内容没有升级为 AGENTS。
8. 运行该项目的文档/格式校验和 git diff 空白检查；如果是纯治理文档变更，不需要跑业务测试，但要明确说明。
9. 最后只提交本轮相关文件，不要 stage 或提交工作区里已有的无关改动。

交付物至少包含：
- AGENTS 中的短项目级规则入口
- 一个可复用的 workflow/dev doc
- 必要时一个 domain glossary
- 对应项目 skill 的入口更新
- memory/changelog 记录
- 验证命令结果
- commit hash
```
