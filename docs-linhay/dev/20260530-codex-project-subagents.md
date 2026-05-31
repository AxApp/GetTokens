# Codex 项目级 Subagents 配置

日期：2026-05-30
状态：已落地并扩展项目级 `.codex` 配置

## 背景

GetTokens 已经形成稳定的多阶段工作流：先明确 `space` / 验收边界，再拆分实现、UI、验证、审查和文档收口。此前这些职责主要靠主控 agent 临时口头分配，本次将高频任务面沉淀为项目级 Codex custom agents，便于后续显式调用。

2026-05-30 追加深读 `docs-linhay/dev/` 和高频 spaces 后，发现 `gettokens_domain_engineer` 覆盖面过宽。账号 SQLite、routing engine、运行时观测、Codex 扩展、配置写入、设计系统、macOS runtime 和 CLIProxyAPI fork 都已经有多篇独立开发文档和重复排障模式，因此新增一组专题 agent。通用 agent 仍保留作为兜底，专题 agent 用于风险更高、边界更清楚的任务。

## 验收场景

### 场景 1：复杂需求拆分

Given 一个需求同时涉及 sidecar、Wails UI、测试和文档
When 主控 agent 启动 subagent 工作流
Then 可以按探索、领域实现、UI 集成、验证、审查、沉淀等职责分派任务
And 主控 agent 仍保留最终集成和完成判断。

### 场景 2：只读探索与审查

Given 用户要求调研、review 或排查风险
When 使用只读 agent
Then agent 只能读取代码和文档，输出文件路径、证据和风险，不修改仓库。

### 场景 3：模型路由不被项目配置误导

Given GetTokens 正在维护 Codex 模型路由和账号能力过滤
When 项目级 subagent 配置被加载
Then 默认继承父会话模型，不把某个模型名硬编码到 agent 配置
And 只有在明确验证模型路由时才临时指定模型。

## 配置入口

- 全局并发配置：`.codex/config.toml`
- 项目级 agents：`.codex/agents/*.toml`
- 默认并发：`max_threads = 6`
- 默认嵌套深度：`max_depth = 1`
- 默认单 worker 超时：`job_max_runtime_seconds = 1800`

## Agent 分工

| Agent | Sandbox | 适用任务 |
| --- | --- | --- |
| `gettokens_explorer` | `read-only` | 只读探索代码路径、space、dev docs、sidecar/Wails 边界 |
| `gettokens_domain_engineer` | `workspace-write` | sidecar、账号池、routing、quota、live sessions、Wails binding、聚焦测试 |
| `gettokens_ui_integrator` | `workspace-write` | 桌面优先 UI、Wails preview、设计系统接入、前端状态派生 |
| `gettokens_verifier` | `workspace-write` | 自动化验证、无头浏览器证据、截图归档、DoD 缺口报告 |
| `gettokens_reviewer` | `read-only` | correctness、安全、回归、测试缺口和治理合规 review |
| `gettokens_session_distiller` | `workspace-write` | “整理”场景下的 skills、dev docs、memory、qmd 收口 |
| `gettokens_release_operator` | `workspace-write` | macOS release、DMG 验收、Sparkle、notarization、CI release 检查 |
| `gettokens_subagent_architect` | `workspace-write` | 项目级 Codex custom agents 的创建、合并、删除、TOML 校验和治理写回 |

## 专题 Agent

| Agent | Sandbox | 适用任务 |
| --- | --- | --- |
| `gettokens_account_store_migrator` | `workspace-write` | sidecar 账号 SQLite、凭证迁移、OAuth refresh 写回、`acct_*` 身份和旧事实源删除 |
| `gettokens_routing_engineer` | `workspace-write` | channel routing、model alias、route guard、retry/fallback、WebSocket pinned auth 和 decision trace |
| `gettokens_observability_analyst` | `workspace-write` | usage attribution、live sessions、本地 usage 投影、运行时 telemetry、bounded snapshot 和隐私边界 |
| `gettokens_codex_extensions_maintainer` | `workspace-write` | Codex Skills、MCP Servers、`config.toml` raw/structured editor、Git skill source |
| `gettokens_config_apply_guardian` | `workspace-write` | Codex/Claude local apply、deep link 导入、auth/config/settings 保守 patch 和 diff 确认 |
| `gettokens_design_system_curator` | `workspace-write` | Storybook、component admission、设计 token、inspect mode、桌面 UI 一致性 |
| `gettokens_macos_runtime_operator` | `workspace-write` | Wails root binding、macOS lifecycle、sidecar 进程归属、status item、App menu、native 验证 |
| `gettokens_upstream_fork_curator` | `workspace-write` | CLIProxyAPI fork、上游源码校准、gitlink、sidecar rebuild、双仓提交边界 |

## 推荐组合

1. 复杂功能：`gettokens_explorer` 先映射边界，再按领域选择专题 agent；没有明确专题时使用 `gettokens_domain_engineer`，最后由 `gettokens_verifier` 做验证，主控 agent 集成。
2. 风险审查：`gettokens_explorer` 收集执行路径，`gettokens_reviewer` 输出 finding，主控 agent 决定是否修复。
3. UI 回归：`gettokens_ui_integrator` 修布局和状态，`gettokens_verifier` 保存无头截图或报告桌面验收缺口。
4. 账号迁移：`gettokens_account_store_migrator` 负责 sidecar SQLite 和迁移门禁，`gettokens_verifier` 补真实备份或隔离目录验证，主控 agent 审核旧事实源是否仍被读取。
5. 路由问题：`gettokens_routing_engineer` 负责 route policy 和热路径测试，`gettokens_observability_analyst` 可并行检查 usage/live sessions 归因是否受影响。
6. Codex/Claude 本地配置：`gettokens_config_apply_guardian` 负责 patch 语义和 diff，`gettokens_codex_extensions_maintainer` 只在 Skills/MCP/config workspace 涉及时介入。
7. 设计系统与桌面 UI：`gettokens_design_system_curator` 负责 Storybook/manifest/视觉一致性，`gettokens_ui_integrator` 负责具体页面接线。
8. macOS runtime：`gettokens_macos_runtime_operator` 负责 Wails binding、native menu/status item 和 sidecar 进程生命周期，`gettokens_verifier` 记录桌面验收缺口或截图。
9. 发布：`gettokens_release_operator` 负责 release 证据链，主控 agent 避免把 CI 发布和可分发 DMG 验收混为一谈。
10. subagent 治理：`gettokens_subagent_architect` 负责 agent 设计、裁剪、合并与配置校验；具体业务实现继续交给对应专题 agent。
11. 会话整理：`gettokens_session_distiller` 提炼可复用模式，主控 agent 审阅后确认是否升级到 `AGENTS.md`。

## 使用边界

1. subagent 不拥有最终完成判断。GetTokens 的主控 agent 仍负责需求边界、集成、测试门禁、Wails/桌面验收、截图、docs、memory 和 `qmd` 收口。
2. 读写 agent 也必须小步修改，不能跨越任务边界吸收无关变更。
3. 浏览器 preview 只能证明布局和交互；涉及 sidecar readiness、Wails binding、macOS runtime 或 release 资产时，仍需真实桌面或对应系统级验证。
4. `.codex/agents/*.toml` 不写固定模型名，避免和 GetTokens 的模型路由、账号池能力过滤测试互相干扰。
5. 如果后续需要专门验证某个模型路由策略，应在单次任务中显式指定或临时新增实验 agent，完成后再决定是否长期保留。
6. 专题 agent 优先处理自己文档边界内的任务；跨专题改动必须由主控 agent 拆分写入面，避免多个 agent 同时改同一文件族。
7. `gettokens_domain_engineer` 是兜底实现 agent，不应在已有专题 agent 明确命中的情况下继续承接全部工作。

## 后续维护

1. 新增 agent 前先判断能否扩展现有 agent 的 instructions；不要为单次任务新增长期 agent。
2. agent instructions 要保持窄职责和明确边界，避免把 `AGENTS.md` 或项目 skills 的全文复制进去。
3. 若发现某个 agent 长期不用，应删除或合并，减少 subagent 选择噪音。
4. 如果 Codex custom agent schema 发生变化，优先更新 `.codex/agents/*.toml`，再同步本文档和 memory。
5. 当某个专题 agent 的职责已经稳定迁移到项目 skill 或被其它 agent 覆盖时，优先合并或删除 agent，而不是继续扩张角色列表。
6. 创建、删除、合并或拆分 agent 时，优先使用项目 skill `.agents/skills/gettokens-subagent-lifecycle/SKILL.md`；需要委托时使用 `gettokens_subagent_architect`。

## 维护授权

用户已明确授权：后续 GetTokens 工作中，主控 agent 可以随时按判断新增、删除或修改项目级 subagent。

执行要求：

1. 修改前先说明触发原因，例如新重复工作流出现、agent 职责重叠、长期不用、schema 变化或任务需要更窄角色。
2. 修改 `.codex/agents/*.toml` 后必须验证 TOML 可解析，并检查是否意外硬编码 `model = ...`。
3. 新增 agent 需要同步本文档的分工或推荐组合；删除或合并 agent 需要同步移除引用。
4. 有意义的 subagent 治理变化必须写入 `docs-linhay/memory/YYYY-MM-DD.md`，并执行 `qmd update` 与 `qmd embed`。
5. 仍然禁止为了单次临时任务永久新增 agent；临时实验 agent 用完后应删除，或明确升级为长期角色的依据。

## 配套 Skill

项目级 subagent 生命周期治理已沉淀为 `.agents/skills/gettokens-subagent-lifecycle/SKILL.md`。

该 skill 负责：

1. 判断是否应该新增、修改、合并或删除 agent。
2. 维护命名、职责、sandbox、reasoning effort 和默认不硬编码模型的规则。
3. 固化 TOML 校验、固定模型扫描、文档更新、memory 写回和 qmd 同步流程。
