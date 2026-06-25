# Auto 自动路由模型调取 intake 计划（2026-06-25）

## 决策

将 Agent-as-a-Router 资料归档为后期 GetTokens auto 自动路由能力的参考输入。首期不直接移植 ACRouter，而是先做 GetTokens sidecar 原生的 trace + replay evaluator。

## 最小实施顺序

1. 定义 sidecar route trace DTO：candidate、selected、reason、filter、feedback、cost、failure class。
2. 用 mock upstream/downstream 固定一组请求事实，生成小型 matrix。
3. 实现 replay evaluator，对比 priority / random / cheapest / feedback-aware。
4. 只在 replay 有收益后，新增 auto strategy 开关和 management read-only trace endpoint。
5. 后置 smoke：使用 dev sidecar，本仓构建产物，不触碰正式版。

## mock upstream facts

- 成功：某账号/模型返回可用响应并记录 tokens。
- 软失败：quota-empty / cooldown / model-unavailable。
- 硬失败：401 auth invalid、429 usage limit、5xx upstream error。
- 成本差异：同一任务不同模型/账号 token 和单价不同。

## mock downstream / spy outputs

- route trace 被写入并可查询。
- runtime state 只由 sidecar 更新。
- feedback-aware 策略在 replay 中改变后续选择。
- priority / cheapest 等 baseline 结果可复现。

## 不做

- 不接真实账号在线探索。
- 不引入向量库或 embedding kNN。
- 不把 demo 关键词路由器作为生产策略。
- 不改正式版 GetTokens。

## 验证门禁

- sidecar focused tests：route trace、runtime state、replay evaluator。
- git diff --check。
- 文档结构校验：docs-linhay/scripts/check-docs.sh。

