# BuilderIO Skills Intake

日期：2026-06-19
状态：已按 GetTokens 项目语境吸收，不全量安装

参考来源：

- `https://github.com/BuilderIO/skills`
- `agent-watchdog`
- `plan-arbiter`
- `visual-plan`
- `visual-recap`
- `plow-ahead`
- `efficient-frontier`
- `read-the-damn-docs`
- `stay-within-limits`
- `quick-recap`

## Intake 结论

BuilderIO/skills 的主要价值是 agent 工作流组织：方案仲裁、跨 agent 审计、计划/复盘 artifact、自治执行边界和预算意识。GetTokens 已有 `.agents/skills/`、`docs-linhay/spaces/`、dev docs、memory、subagent 和 review 治理，因此本次不直接安装外部 skill 包，而是按 `gettokens-ops-governance` 的 `External Workflow Intake` admission gate 翻译为本仓规则。

## 已吸收

### 1. Plan Arbiter -> `gettokens-ops-governance / Plan Arbitration`

已吸收到项目级治理 skill：

- `.agents/skills/gettokens-ops-governance/SKILL.md`

适用场景：

- 多个 agent 或多份计划互相竞争。
- Codex / Gemini / subagent 对实现路线有不同判断。
- 外部 workflow 或设计方向需要决定 Adopt / Hybrid / Revise first。

验证方式：

- 输出决策备忘录时必须写清 scope、assumptions、files/surfaces、validation、rollback 和 rejected alternatives。
- 高风险结论必须回到当前仓库文件、space、dev 文档、测试或截图证据。

### 2. Agent Watchdog -> `gettokens-ops-governance / Subagent Delivery Loop`

已补入 watchdog audit loop。后续主控 agent 监督另一个 agent、session、PR、branch 或 subagent 输出时，必须先重建用户请求和验收条件，再检查实际 diff / 测试 / CI / 截图 / 日志 / docs，最后把问题分成：

- `gap`
- `bug`
- `verification miss`
- `scope drift`
- `no issue`

这补齐了原 supervision skill 偏交付闭环、缺少“审计另一个 agent 的实际证据”的问题。

### 3. Visual Recap -> `check` 的 Large Change Recap Gate

不引入 hosted Agent-Native Plan，但吸收大变更复盘结构：

1. Outcome
2. Surface/state inventory
3. File map
4. Key changes
5. Verification evidence
6. Risk

适用在大 PR、多文件 UI/API/schema/Wails/sidecar/native 变更、subagent 交付或 review 前。

### 4. Visual Plan -> 现有 space / plans / design HTML

BuilderIO 的 visual-plan 强调“计划是可评论、可审批 artifact，而不是聊天段落”。GetTokens 已有更适合本项目的承载物：

- `docs-linhay/spaces/<space-key>/README.md`
- `docs-linhay/spaces/<space-key>/plans/`
- 单期设计稿 HTML
- screenshots
- dev workflow 文档

因此吸收原则，不吸收工具依赖。后续高风险计划仍应独立可读、先讲具体产品状态、明确 hard-to-reverse decision、把 open questions 收敛在计划文档内。

### 5. Plow Ahead / Efficient Frontier 的局部规则

已通过 `gettokens-ops-governance` 和现有 Codex 行为覆盖大部分自治推进规则。本次只确认以下规则继续有效：

- 普通 ambiguity 由主控 agent 做保守假设并继续推进。
- 真 blocker 包括凭证缺失、生产/破坏性操作、用户明确保留的决策、重复验证失败后的推测性大改。
- subagent handoff 必须自包含：repo path、目标、scope/out-of-scope、证据格式、验证命令、stop conditions。
- 主控 agent 必须重新打开关键证据，不能把 subagent 结论当事实。

## 暂不吸收

### `quick-recap`

不采用 emoji 红黄绿结尾约定。原因：

- 与本仓当前中文交付风格和 Codex final 规范不一致。
- `AGENTS.md` 已要求最终说明测试、文档、沉淀和未测风险。
- 只需保留 done / pending / blocked 状态意识，不需要额外格式约束。

### `stay-within-limits`

暂不新增预算 skill。原因：

- 当前 GetTokens 没有稳定的一手 usage/budget 工具接入。
- 预算暂停/恢复更适合作为未来自动化或主控调度能力，而不是现在写成无法验证的硬规则。

可保留的软规则：

- 长任务分 wave，默认不超过 3 个并行 subagent。
- wave 之间检查当前任务是否仍有进展和明确验证路径。

### `read-the-damn-docs`

不新增同名 skill。原因：

- 当前系统和 `gettokens-ops-governance` 的 `External Workflow Intake` 已要求外部 API、当前行为、官方文档优先查证。
- OpenAI、AntD、release、CLIProxyAPI 等已有更具体的项目或全局 skill。

## 为什么不全量安装

1. GetTokens 已有大量项目级 skills，继续全量安装会增加 discovery 预算和触发噪音。
2. BuilderIO 的 visual-plan / visual-recap 默认依赖 hosted Agent-Native Plan 或 local bridge；这不应成为 GetTokens 需求治理的默认基础设施。
3. 本仓已有 `spaces`、design HTML、screenshots、dev docs、memory，可承担相同的 review artifact 职责。
4. 外部 skills 作为供应链输入，应先审查、提炼、翻译，再按最窄 durable layer 落地。

## 后续使用入口

- 方案比较：`gettokens-ops-governance` 的 `Plan Arbitration`
- subagent 监督和 agent 产物审计：`gettokens-ops-governance` 的 `Subagent Delivery Loop`
- 大 PR / 多文件变更复盘：`check` 的 `Large Change Recap Gate`
- 外部 workflow 再吸收：`gettokens-ops-governance` 的 `External Workflow Intake`

## 验收

本轮是治理与文档变更，无业务代码变更。验收命令：

```bash
docs-linhay/scripts/check-docs.sh
git diff --check
```
