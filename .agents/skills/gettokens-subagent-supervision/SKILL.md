---
name: gettokens-subagent-supervision
description: GetTokens 监督交付模式：当用户说“用 subagent 做、你负责监督到完成”或引用本 skill 时触发。进入主控 agent 负责拆分、调度、集成、验收、截图、文档与最终闭环，subagent 负责具体实现。
---

# GetTokens Subagent Supervision

当用户明确要求：

1. “这个需求用 subagent 做，你负责监督到完成”
2. “subagent 做，你盯到闭环”
3. “按监督模式执行”
4. 或直接点名 `gettokens-subagent-supervision`

默认进入本模式。

## 目标

把主控 agent 和 subagent 的责任拆开：

1. subagent 负责 bounded implementation work
2. 主控 agent 负责边界、调度、集成、验证、截图、文档、memory 和最终完成判断

## 强制执行顺序

1. 先确认对应 `space`、范围和验收标准。
2. 按写入面拆分 subagent 任务，避免冲突。
3. 主控 agent 持续集成 subagent 结果，不等到最后统一收口。
4. 跑完整个需求闭环后才停止：
   - 代码集成
   - 自动化验证
   - Wails / 桌面验收（如适用）
   - 截图或其他验收产物
   - docs / memory 写回
   - 必要时 `docs-linhay/scripts/check-docs.sh`
5. 如果仍有未完成项，继续推进；如果卡住，明确写出 blocker 和剩余工作。

## 体验巡检型用法

当用户要求“用 subagents 体验项目、给修改意见、再评估修复”时，优先使用项目级体验巡检四件套：

1. `gettokens_experience_product_operator`：只读体验产品/运营路径，至少 10 条中度建议。
2. `gettokens_experience_runtime_routing`：只读体验运行态、路由、归因和 sidecar 证据链，至少 10 条中度建议。
3. `gettokens_experience_extension_workbench`：只读体验 Skills / MCP / config / local apply 等扩展工作台，至少 10 条中度建议。
4. `gettokens_evaluation_repair_controller`：汇总三份报告，建立证据门禁，筛选低风险修复候选，维护 backlog / 下期需求 / 小范围修复计划。

主控 agent 的额外责任：

1. 在 space 中固定每个 subagent 的报告路径和输出格式。
2. 要求体验报告同时覆盖业务体验和代码/文档事实，不接受纯主观建议。
3. 评估修复前必须有 evidence matrix；证据不足的候选只能进 backlog、调研或下期需求。
4. 每轮结束自动更新 unfixed backlog、acceptance、memory，并按自动沉淀审计判断是否更新 skill / workflow / AGENTS。
5. 若用户暂停或要求剩余项下期实现，撤回半成品代码，只保留证据和下期需求文档。

## Watchdog Audit Loop

当需要监督另一个 agent、session、PR、branch、报告或 subagent 输出时，主控 agent 不能只转述对方结论。必须先做一次 watchdog 审计：

1. 重建原始用户请求、后续 scope 变化、硬约束和验收条件。
2. 读取对方实际改动、报告、截图、测试输出、CI、日志或最终声明。
3. 将问题分为：
   - `gap`：用户要求的行为缺失或未完成。
   - `bug`：实现可能失败或引入回归。
   - `verification miss`：实现可能正确，但证据不足。
   - `scope drift`：改动超出范围或跳过约束。
   - `no issue`：已有证据证明完成。
4. 只有用户授权修复时才做窄修；修复仍要保留无关脏改动，不移动 branch，不做推测性重写。
5. 最终报告必须区分“对方声称做了什么”和“主控复核证据证明了什么”。

## 停止条件

只有以下情况可以停止：

1. 需求已经完整闭环
2. 用户明确暂停
3. 当前环境存在无法自行解决的具体 blocker

“代码已改完”不是停止条件。  
“只剩截图或文档”也不是停止条件。

## 与现有 skill 的关系

1. 本 skill 是触发入口，负责把会话切到监督交付模式。
2. 进入该模式后，仍应按需使用：
   - `gettokens-ops-governance`
   - `gettokens-domain-engineering`
   - `gettokens-session-skill-distill`

## 推荐最小口令

后续最推荐你直接说：

`用 gettokens-subagent-supervision 做这个需求。`

或者更口语化一点：

`这个需求用 subagent 做，你负责监督到完成。`
