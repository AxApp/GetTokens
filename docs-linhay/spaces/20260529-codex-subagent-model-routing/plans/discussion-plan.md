# Codex Subagent Model Routing 讨论计划

## 讨论目标

在进入实现前，把 Codex subagent 特殊模型配置与 sidecar 账号路由的契约收敛到可测试、可回放、可诊断的方案。

## 讨论顺序

1. 校准 Codex 请求事实：`x-openai-subagent`、`Session_id`、`X-Client-Request-Id`、`X-Codex-Turn-Metadata` 和 body `model`。
2. 定义 sidecar 规范化输入：`subagentSource`、`targetModel`、`sessionID`、`threadID`、`turnID`。
3. 定义账号模型能力匹配与 alias 规则。
4. 定义 fallback、错误原因和 route explain 输出。
5. 定义 usage attribution / live sessions 的最小字段。
6. 明确 P0/P1/P2 切片和测试门禁。

## 当前收敛

1. 本期只处理 `x-openai-subagent` 场景。
2. `X-Codex-Turn-Metadata` 用于观测关联，不替代 `x-openai-subagent` 做 subagent 判定。
3. 具体 `agent_type` / role 路由暂不进入本 space。
4. sidecar fork 已确认 `/v1/responses` HTTP 与 Codex direct route 都进入 `OpenAIResponsesAPIHandler`，body `model` 会进入 auth manager 的 provider/model 选择。
5. 当前 model registry + scheduler 已按 auth 支持模型过滤候选；本期主要缺口是 subagent request context、explain、usage attribution 和 live sessions 字段。

## 输出文档

1. `feasibility-assessment-v01.md`：Codex 源码与真实请求字段校准。
2. `technical-research-v01.md`：sidecar 热路径调研、推荐接入点、P0/P1/P2 切片与测试建议。
