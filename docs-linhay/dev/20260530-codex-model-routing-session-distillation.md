# Codex Model Routing Session Distillation

## 背景

`20260529-codex-subagent-model-routing` 最初从 Codex subagent 请求识别切入。实现和冒烟完成后，用户明确收窄路由语义：移除 `X-OpenAI-Subagent` 判断，只根据请求模型进行路由。

## 稳定结论

1. Codex 账号选择的热路径输入是请求 body 中的 `model`。
2. `X-OpenAI-Subagent` 只作为 Codex Responses client context header 透传给上游，不进入 GetTokens route context、metadata 或账号候选过滤。
3. `Session_id`、`X-Client-Request-Id`、`X-Codex-Turn-Metadata.session_id/thread_id/thread_source/turn_id` 只用于观测关联，不能替代模型路由条件。
4. 普通模型分流：Codex 配置 `model = deepseek`，sidecar 按 `deepseek` 匹配声明支持该模型的账号。
5. 进阶模型分流：账号卡模型映射使用 `name` 表示上游真实模型，`alias` 表示 Codex/路由侧模型。例如 `name = deepseek-chat`、`alias = deepseek` 时，Codex 请求 `deepseek` 会命中该账号，上游请求模型会转换为 `deepseek-chat`。
6. openai-compatible 允许多个真实模型映射到同一个 alias，形成同账号内 alias pool；支持的模型不可用错误可以在该 pool 内切换。

## 沉淀位置

- 项目级 skill：`.agents/skills/gettokens-codex-account-list/SKILL.md`
- 需求 space：`docs-linhay/spaces/20260529-codex-subagent-model-routing/README.md`
- 记忆：`docs-linhay/memory/2026-05-29.md`、`docs-linhay/memory/2026-05-30.md`

## 不升级 AGENTS 的原因

该规则属于 Codex 账号列表与 sidecar 模型路由领域边界，不是 repo-wide 工作流或治理规范。后续类似问题应优先查 `gettokens-codex-account-list` skill。
