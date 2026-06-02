---
name: gettokens-subagent-lifecycle
description: GetTokens 项目级 Codex subagent 生命周期治理：创建、拆分、合并、删除、TOML 校验、文档记忆写回。
---

# GetTokens Subagent Lifecycle

用于维护 GetTokens 项目级 Codex custom agents，也就是 `.codex/agents/*.toml` 与 `.codex/config.toml`。

## 触发场景

1. 用户要求新增、删除、修改、整理或优化 subagent。
2. 当前任务暴露出稳定重复的工作流，需要新增专题 agent。
3. 现有 agent 职责重叠、长期不用、过宽或过窄，需要合并或删除。
4. Codex custom agent schema、项目模型路由或 sandbox 策略变化，需要调整配置。

## 决策规则

1. 先复用现有 agent；只有长期重复、边界清楚、能减少主控负担时才新增。
2. 临时实验 agent 用完即删，除非有明确证据证明应长期保留。
3. agent 名称使用 `gettokens_*`，文件名使用 kebab-case，例如 `gettokens-routing-engineer.toml`。
4. 默认不写 `model = ...`，继承父会话模型；只有明确验证模型路由或用户指定模型时才临时设置。
5. 用 `description` 写触发边界，用 `developer_instructions` 写职责和禁止事项；不要把 `AGENTS.md` 或项目 skills 全文复制进 agent。
6. 删除或合并 agent 时，同步删除文档引用，避免留下不可调用角色。

## 标准流程

1. 从 `docs-linhay/dev/`、对应 `space`、memory 或实际任务中提取重复模式。
2. 判断是新增 agent、修改现有 agent、合并 agent，还是删除 agent。
3. 修改 `.codex/agents/*.toml` 或 `.codex/config.toml`。
4. 更新 `docs-linhay/dev/20260530-codex-project-subagents.md`。
5. 有意义的治理变化写入 `docs-linhay/memory/YYYY-MM-DD.md`。
6. 验证：
   - TOML 可解析。
   - `.codex/agents` 中没有意外固定 `model = ...`。
   - `docs-linhay/scripts/check-docs.sh` 通过。
## 验证命令

```bash
python3 -c 'import pathlib,tomllib; [tomllib.load(p.open("rb")) for p in pathlib.Path(".codex").rglob("*.toml")]; print("toml ok")'
rg -n "^model\s*=" .codex/agents .codex/config.toml
docs-linhay/scripts/check-docs.sh
```

`rg` 查找固定模型返回 1 且无输出是期望结果；如果有输出，必须确认是不是本轮刻意设置。

## 与其它 skill 的关系

1. 监督交付流程使用 `gettokens-subagent-supervision`。
2. spaces、memory 和 AGENTS 同步使用 `gettokens-ops-governance`。
3. Codex Skills / MCP 工作台使用 `gettokens-codex-extensions-management`。
4. 本 skill 只负责项目级 `.codex/agents` 的生命周期，不负责业务实现。
