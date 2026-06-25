# Agent-as-a-Router 调研摘要（2026-06-25）

## 来源与本地缓存

- 论文：<https://arxiv.org/abs/2606.22902>，本地缓存：
  - HTML：'docs-linhay/references/agent-as-a-router/sources/arxiv-2606.22902.html'
  - PDF：'docs-linhay/references/agent-as-a-router/sources/arxiv-2606.22902.pdf'
  - 抽取文本：'docs-linhay/references/agent-as-a-router/sources/arxiv-2606.22902.txt'
- 代码仓库：<https://github.com/LanceZPF/agent-as-a-router>，GitHub tree SHA：'34492e6be313168a8f7a68f63b15a8cbfe43d618'，MIT，2026-06-25 查询时 star 61。
- 项目主页：<https://omnisource.cn/agent-as-a-router>，本地缓存：'docs-linhay/references/agent-as-a-router/sources/project-homepage.html'。
- 代码缓存方式：完整 Git archive / shallow clone 在当前网络环境下反复出现截断或只初始化 '.git'，本轮改用 GitHub tree API 拉取 231 个文件清单，并缓存 67 个关键文件到 'docs-linhay/references/agent-as-a-router/sources/raw/'，覆盖 README、论文 artifact、核心路由源码、benchmark summary、outputs、demo 与测试。

## 一句话结论

Agent-as-a-Router 的有效点不是“再训练一个万能路由分类器”，而是把路由放进 Context → Action → Feedback → Context 闭环：每次选择模型后，用执行/验证结果和成本写回 Memory，让后续路由基于已验证经验而不是静态先验。

## 核心机制

1. Context：当前任务 prompt、任务元数据、历史 Memory。论文实现里 Memory 是按任务 embedding 做 kNN 检索的经验库，记录相似任务下模型表现、成本和验证 trace。
2. Action：选择一个后端 LLM。论文称 ACRouter 的 Orchestrator 结合 DimensionBest prior、top-10 历史邻居、任务元数据和一个轻量 policy model。
3. Feedback：Verifier 对候选输出做 AST、sandbox、visible tests、self-consistency / rule signals 等验证，形成性能分数与成本。
4. Memory update：把反馈写回 Memory，形成下一轮 Context。
5. 评价指标：用 cost-aware reward 与 cumulative regret，而不是只看 pass rate；这更贴近日常多模型路由的目标。

## 论文主张

- 信息缺口比路由 LLM 的“推理能力”更关键。论文 Table 1：Vanilla LLM-as-a-Router AvgPerf 41.41；加入 probing set 的 per-dimension performance stats 后到 47.74，相对提升 15.3%，略高于同样使用维度先验的 DimensionBest 47.50。
- CodeRouterBench 设计成任务 × 模型结果矩阵，用于离线路由评估：约 10K ID coding tasks、8 个后端模型，以及 OOD agentic-programming stream。
- ACRouter 在 ID 和 OOD 上的累计 regret 低于静态分类器、启发式、online bandit 与单模型基线。

## 代码与 demo 结构

- 'src/routing/AGENT_ROUTER.py'：更接近论文描述的 agent router，包含 LLM Orchestrator、epsilon-greedy exploration、local tools（syntax / visible tests / heuristic quality）和 'AgentMemory'。
- 'src/acrouter_repro/inference.py'：面向业务集成的极简 adapter。它没有引入论文的 embedding Memory，而是提供 'route()' 与 'run_with_verifier()' 两个接口：
  - 'route()'：按 dimension_map / memory / default_model 选单模型；
  - 'run_with_verifier()'：按 cheap_chain 尝试，验证失败后按 'k' 条件 escalation。
- 'src/acrouter_repro/ood_repro.py'：OOD176 的 verify-and-escalate replay；默认 cheap chain 后，只有 cheap attempts 的 'apply_ok' 数达到阈值才升级到高价模型。
- 'scripts/run_pipeline.py'：可用 JSON config 构造自定义 benchmark matrix，并跑 'acrouter' / 'always' / 'oracle' / 'cheapest' 等 router。
- 'demos/api_coding_solver/'：通过 OpenAI-compatible API 跑单个 coding problem；需要用户提供 API key。
- 'demos/commercial_cli_router/'：很薄的 CLI router MVP，按关键词或工具可用性把 prompt 分给 Codex / Claude Code / opencode。本轮 dry-run 选择了 'codex exec --sandbox workspace-write --cd ...'，未调用真实模型。

## 结果与版本差异

本轮发现论文 / 项目主页与 GitHub README / checked-in outputs 存在 OOD 数字差异，后续引用必须说明来源版本：

| 来源 | ID ACRouter | OOD ACRouter |
| --- | --- | --- |
| 论文 PDF / 项目主页主表 | AvgPerf 49.98、CumReg 205.5、Perf/$ 3.79 | AvgPerf 62.50、CumReg 17.0、Perf/$ 1.18 |
| GitHub README / checked-in outputs | ID expected output: AvgPerf 50.14、CumReg 202.0、$Total 22.31、Perf/$ 2.25 | OOD176 expected output: AvgPerf 73.30、CumReg 15.9、$Total 86.72、Perf/$ 0.85 |

仓库的 'outputs/baselines_ood176/baseline_table.md' 明确写了当前 OOD176 表是 2026-06-23 重新计算的 unified OOD176 matrix；这很可能是 repo artifact 比论文/主页更新。不要把 62.50 和 73.30 混用。

## 对 GetTokens 的可用判断

可借鉴：

1. 路由 trace 结构：GetTokens sidecar 当前账号/模型路由也需要把“候选、选择理由、反馈、成本/失败原因”结构化，否则后续 UI 和调试只看到结果，看不到路由为什么发生。
2. Verifier 先行：不要只靠模型名字或静态 priority。对 Codex / Claude / OpenAI-compatible 请求，可用成功状态、429/5xx、tool-call 失败、apply/patch 成功率、用户中断、token/cost 作为反馈。
3. Memory 是 sidecar 权限：热路径状态应在 sidecar 内闭环，不应由前端伪造；这与 GetTokens 现有 sidecar 规则一致。
4. 先做 replay，再接真实账号：CodeRouterBench 的矩阵思路适合 GetTokens：先用历史请求日志/模拟 upstream 固定 task × account/model outcome，再评估 route policy，避免直接拿真实账号做试错。

暂不直接照搬：

1. 论文级 ACRouter 依赖 embedding kNN、Verifier、sandbox 和完整任务矩阵。GetTokens 现阶段如果要做多 LLM 路由，第一版应先做最小 sidecar trace + replay matrix + 简单 policy，不需要直接引入向量库。
2. 'demos/commercial_cli_router' 的 CLI 路由只是关键词/可用性 MVP，不是生产级路由器；可作为 UI/CLI 接入形状参考，不适合作为 GetTokens sidecar 逻辑。
3. 仓库当前 'inference.py' 是轻量 adapter，不等同论文完整 Orchestrator + embedding Memory；产品方案引用时要区分 paper concept、benchmark replay 和 integration adapter。

## 本轮验证

- 已下载论文 HTML/PDF 并抽取文本。
- 已下载项目主页 HTML。
- 已拉取 GitHub repo API、recursive tree API 和关键源码/benchmark/demo/test 文件。
- 已执行关键 Python 文件 'py_compile'。
- 已执行 'demos/commercial_cli_router/router_mvp.py --dry-run'，生成路由计划，未调用真实模型/API。

## 后续如果要接入 GetTokens

最小 tracer-bullet 不应从“智能路由”大而全开始，而应先做：

1. 在 sidecar 增加 route decision trace DTO：candidate accounts/models、selected、reason、upstream status、tokens/cost、failure class。
2. 从 dev/test 日志构造一个小型 offline matrix。
3. 写一个 replay evaluator 比较：现有 priority / random / cheapest / simple feedback-aware policy。
4. 只有 replay 证明有收益后，再考虑 Memory、bandit 或 embedding retrieval。

