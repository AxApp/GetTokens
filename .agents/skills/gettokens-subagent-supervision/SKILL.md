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
   - `qmd update`
   - `qmd embed`
   - 必要时 `docs-linhay/scripts/check-docs.sh`
5. 如果仍有未完成项，继续推进；如果卡住，明确写出 blocker 和剩余工作。

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
