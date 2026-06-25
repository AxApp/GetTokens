# Auto 自动路由模型调取

## 背景

用户已确认将 Agent-as-a-Router / ACRouter 调研资料存档，后期用于 GetTokens 的 auto 自动路由模型调取能力。参考资料见：

- docs-linhay/references/20260625-agent-as-a-router-research.md
- docs-linhay/references/agent-as-a-router/
- 论文：<https://arxiv.org/abs/2606.22902>
- 代码：<https://github.com/LanceZPF/agent-as-a-router>
- 主页：<https://omnisource.cn/agent-as-a-router>

GetTokens 现有硬边界：账号选择、route guard、usage attribution、Codex WebSocket 等热路径状态必须在 sidecar 内闭环，不通过前端或 Wails 临时补偿。

## 目标

- 提供一个 auto 模式，让 GetTokens 能基于请求上下文、账号/模型可用性、历史反馈和成本信号自动选择模型/账号。
- 首期先落最小可验证链路：sidecar 结构化 route trace + offline replay evaluator + 简单反馈感知策略。
- 为后续引入 Memory、bandit、embedding retrieval 或更复杂 verifier 保留证据接口，但首期不直接上大而全 ACRouter。

## 范围

- Sidecar：定义 route decision trace DTO，记录 candidate、selected、reason、upstream status、tokens/cost、failure class、feedback signal。
- Sidecar：从 mock upstream / mock downstream 或历史 dev 日志构造小型 task × account/model outcome matrix。
- Evaluator：比较现有 priority、random、cheapest、simple feedback-aware policy 的 replay 结果。
- Management API：提供只读 trace / replay 结果查询，供 Wails/UI 后续展示。
- 文档：记录 auto 策略的决策边界、禁止前端伪造路由状态、真实账号 smoke 的后置条件。

## 非目标

- 首期不接真实账号做在线试错。
- 首期不引入向量数据库、embedding kNN、复杂 bandit、外部 ACRouter runtime 或新模型服务依赖。
- 首期不改变正式版 GetTokens，也不触碰 /Applications/GetTokens.app。
- 首期不把 Agent-as-a-Router demo 的关键词 CLI router 直接搬进 sidecar。

## 证据门禁

| 证据项 | 当前状态 | 后续进入实现前要求 |
| --- | --- | --- |
| 问题来源 | 用户明确要求存档，后期做 auto 自动路由模型调取 | 进入实现前补具体用户场景：Codex / Claude / OpenAI-compatible 哪条链先做 |
| 参考资料 | Agent-as-a-Router 论文、代码、benchmark、demo 已缓存并摘要 | 明确引用版本差异：论文/主页 OOD 62.50 vs repo outputs OOD176 73.30 |
| 代码事实位置 | GetTokens route truth 应在 CLIProxyAPI sidecar 热路径 | 实现前定位具体 selector / route guard / live-session / usage attribution 文件 |
| 当前现象 | 还没有 auto 策略和 route trace/replay evaluator | 先证明现有策略在离线 matrix 上的 baseline 表现 |
| 验收方式 | 文档归档 + 后期 tracer-bullet 计划 | mock upstream/downstream 服务级测试 + replay evaluator + sidecar focused tests |

## 验收标准

- 有一个可复现的 offline replay matrix，至少覆盖成功、429/rate-limit、auth invalid、model unavailable、cost 差异等反馈类型。
- auto 策略输出的每次决策都有 trace：候选、过滤原因、选择理由、反馈写回结果。
- focused sidecar tests 能证明策略不会由前端/Wails 伪造状态。
- replay evaluator 能展示至少四类策略对比：priority、random、cheapest、feedback-aware。
- 若接真实 dev App smoke，必须先证明 dev sidecar 使用本仓构建产物且未触碰正式版。

## 设计稿入口

- 本期设计稿：（未产出）
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：feat/20260625-auto-model-routing
- worktree：../GetTokens-worktrees/20260625-auto-model-routing/

## 相关链接

- 调研摘要：docs-linhay/references/20260625-agent-as-a-router-research.md
- 参考缓存：docs-linhay/references/agent-as-a-router/
- 初期计划：plans/20260625-auto-model-routing-intake.md

## 当前状态

- 状态：backlog
- 最近更新：2026-06-25

