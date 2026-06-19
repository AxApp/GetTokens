# GetTokens 项目级 Skills 蒸馏

来源会话：`gemini --resume 05ae7144-6948-432a-8845-8ae91ef183b5`

这轮沉淀只保留对 GetTokens 后续开发仍然稳定有效的能力边界，不保留一次性的修复细节。

## 20260427 更新：补回会话蒸馏入口

此前 `AGENTS.md` 已把“用户说整理 => 触发会话沉淀”写成正式规则，但仓库里缺少实际的 `gettokens-session-skill-distill` 入口文件，导致规则和落地物不一致。

2026-06-19 后续治理：该独立入口已并入 `.agents/skills/gettokens-ops-governance` 的 `Session Skill Distillation` 章节，保留历史记录但不再作为当前 active skill。

本次已补：

1. `.agents/skills/gettokens-session-skill-distill`
   - 负责把“整理”解释为一次正式沉淀动作
   - 先抽模式，再判断是 skill、docs、memory，还是 AGENTS
   - 固定要求在收尾时执行 `qmd update` 与 `qmd embed`

## 20260427 更新：收敛技能入口与描述预算

本次针对 CLI 的 `Exceeded skills context budget` 告警继续做两项治理：

1. `AGENTS.md` 不再引用不存在的 `gettokens-space-governance`、`gettokens-doc-writeback`、`gettokens-agents-governance-sync`，统一收敛到现有的 `gettokens-ops-governance`。
2. 项目级 3 个 skill 的 frontmatter `description` 改成短描述，优先保留触发边界，避免把细节塞进技能列表元数据。

后续约束：

1. 新增项目级 skill 前，先判断是否真的需要新增入口，而不是继续把已有 skill 拆细。
2. skill 的 `description` 只写“触发场景 + 能力边界”，详细规则放正文，不再写成长句枚举。
3. 若再次出现预算告警，优先检查项目级 skill 描述和悬空引用，再考虑继续整合。

## 20260520 更新：Skills 整合

由于项目级 skills 数量过多（9个）导致 CLI 上下文预算超标，现将高频工程规则整合为少量核心技能，以保持高效响应并减少冗余。

## 当前核心 GetTokens Skills

读取优先级：GetTokens 项目级 skill 的权威来源是本仓 `.agents/skills/<skill-name>/SKILL.md`。当任务触发 `gettokens-*` 或本仓安装的外部 project skill 时，先读仓库内版本；全局技能目录找不到只能说明全局未安装，不能判断项目级 skill 不存在。下列只列 GetTokens 核心入口，不等同于 `.agents/skills/` 的完整 active discovery 清单。

1. `.agents/skills/gettokens-ops-governance`
   **项目运营与治理**。整合了 Wails 开发回路（重启规则、就绪模型）、`spaces` 工作空间治理、文档与记忆写回流程、AGENTS 同步、subagent 监督交付闭环、外部 workflow intake、方案仲裁、release 分发验收，以及会话技能蒸馏。它定义了“如何在 GetTokens 仓库里正确地工作”。

2. `.agents/skills/gettokens-domain-engineering`
   **领域工程与技术**。整合了账号池（unified inventory）、账号模板本机 CLI 应用、配额规则（quota rules）、UI 视觉系统（Swiss-industrial）、前端调试归因，以及 CLIProxyAPI fork 维护。它定义了“GetTokens 的技术实现与工程约束”。

3. `.agents/skills/gettokens-codex-account-list`
   **Codex 账号列表与路由**。负责 Codex Channel Routing、账号请求顺序、路由探测、模型映射、OAuth 透传和 openai-compatible 映射保存。

4. `.agents/skills/gettokens-claude-code-account-list`
   **Claude Code 账号列表与路由**。负责 Claude Channel Routing、Anthropic 格式账号筛选、项目绑定兼容边界、路由探测和官方默认模型 profile。

## 20260527 更新：安装外部 Taste Skill 包

本次按用户要求将 `https://github.com/Leonxlnx/taste-skill.git` 的全部 `skills/` 子目录安装到项目级 `.agents/skills/`。

固定来源哈希：

- `main@3c7017d636c3a4aad378433ea6d0cfa6c921da4a`

配套记录：

1. `.agents/skills/taste-skill.lock.json`：机器可读的来源、commit 与安装目录清单。
2. `docs-linhay/dev/20260527-taste-skill-project-install.md`：人工可读的安装范围与后续更新流程。

注意：这些是外部通用前端/图像生成 skills，不属于 GetTokens 领域规则本体。若后续出现 skill discovery 预算告警，应优先评估是否保留全量 taste-skill 包，或收敛为实际高频使用的子集。

## 20260619 更新：Taste Skill 项目级 discovery 瘦身

本次按用户要求推进 skill 合并/瘦身，将 Taste 外部包中 12 个视觉/图像生成子 skill 从项目级 `.agents/skills/` discovery 面移除：

- `taste-skill`
- `taste-skill-v1`
- `gpt-tasteskill`
- `image-to-code-skill`
- `imagegen-frontend-web`
- `imagegen-frontend-mobile`
- `brandkit`
- `redesign-skill`
- `soft-skill`
- `minimalist-skill`
- `brutalist-skill`
- `stitch-skill`

保留 `output-skill`，因为它服务完整输出/防截断，和前端设计统一入口不重叠。

后续 GetTokens 桌面/Wails 前端体验、设计审计、视觉 harden、Gemini handoff 默认使用 `.agents/skills/gettokens-frontend-design-quality/`。原 Taste 外部包内容作为参考保留在 `docs-linhay/references/taste-skill/skills/`，`.agents/skills/taste-skill.lock.json` 已记录 active / retired project discovery paths。

## 20260527 更新：安装外部 Waza Skill 包

本次按用户要求将 `https://github.com/tw93/Waza.git` 的 8 个直接 coding skills 安装到项目级 `.agents/skills/`，并同步共享 `rules/` 到 `.agents/rules/`。

固定来源版本：

- `main@24e207c87daf7123e5e7ce22bf81bcb69bfa3e9e`
- 版本号：`3.26.0`

配套记录：

1. `.agents/skills/waza.lock.json`：机器可读的来源、commit、version、安装目录和共享规则目录清单。
2. `docs-linhay/dev/20260527-waza-project-install.md`：人工可读的安装范围与后续更新流程。

## 20260616 更新：外部 skills 启发的 GetTokens 化落地

本次阅读 `mattpocock/skills` 后，没有直接安装外部 skills；原因是 GetTokens 已有项目级 skills，并且此前已经记录过 skill discovery 预算风险。落地方式改为“吸收方法，翻译为项目语境”：

1. 更新 `.agents/skills/gettokens-ops-governance/SKILL.md`，新增 Agent Context Setup、外部 skill intake、skill admission gate、tracer-bullet delivery 等入口规则。
2. 新增 `docs-linhay/dev/20260616-agent-skill-operating-model.md`，作为判断 AGENTS / skill / dev doc / glossary / memory / space 落位的工作流。
3. 新增 `docs-linhay/dev/20260616-gettokens-domain-glossary.md`，把 sidecar、channel routing、route guard、quota fact、live sessions、Wails binding、preview mode、evidence gate 等高频术语收敛为 canonical terms。
4. 更新 `AGENTS.md`，把“外部 skills 先提炼再 GetTokens 化”“新增项目 skill admission gate”“任务开始前 context setup”“术语表与 tracer-bullet 优先级”写成项目级规则入口。
5. 当时按用户要求新增通用 skill `.agents/skills/external-workflow-intake`，用于跨项目复用外部 workflow intake 流程；2026-06-19 已并入 `gettokens-ops-governance` 的 `External Workflow Intake` 章节，避免 active skill 入口膨胀。

后续约束：

1. 外部 skills repo 默认先用 `gettokens-ops-governance` 的 `External Workflow Intake` 做模式提炼，不直接安装全量。
2. 新增项目级 skill 必须通过重复性、触发语、执行步骤和验证路径四项门禁。
3. 术语冲突优先补 glossary；执行细节保留在 `gettokens-ops-governance` 和 dev workflow，`AGENTS.md` 只保留项目级硬入口。

## 20260619 更新：吸收 BuilderIO/skills 的可复用工作流

本次阅读 `https://github.com/BuilderIO/skills` 后，继续沿用“吸收模式，不全量安装”的策略。GetTokens 已有项目级 skills、spaces、memory 和 subagent 治理，因此不引入 hosted Agent-Native Plan 依赖，也不直接安装 BuilderIO 全量 skills。

落地内容：

1. 新增 `.agents/skills/gettokens-plan-arbiter`，吸收 `plan-arbiter` 的方案比较、交叉复核和 Adopt / Hybrid / Revise first 决策结构。
2. 更新 `.agents/skills/gettokens-subagent-supervision`，吸收 `agent-watchdog` 的 audit loop：重建原始请求、核查实际改动和验证证据、分类 gap / bug / verification miss / scope drift。
3. 更新 `.agents/skills/check`，吸收 `visual-recap` 的复盘结构，但转换为本地 Markdown / docs / review recap，不依赖 Agent-Native hosted Plan。
4. 更新 `.agents/skills/gettokens-ops-governance`，挂载 plan arbitration 和 watchdog audit 入口。
5. 新增 `docs-linhay/dev/20260619-builderio-skills-intake.md`，记录 admission gate、吸收内容和不吸收内容。

## 20260619 更新：流程触发型 Skills 合并

第二轮 skill discovery 瘦身将 4 个流程触发型独立入口并入 `.agents/skills/gettokens-ops-governance`：

- `external-workflow-intake` -> `External Workflow Intake`
- `gettokens-session-skill-distill` -> `Session Skill Distillation`
- `gettokens-subagent-supervision` -> `Subagent Delivery Loop`
- `gettokens-plan-arbiter` -> `Plan Arbitration`

这些能力仍然保留，但不再作为独立 active skill 出现在 `.agents/skills/` discovery 面。理由是它们都属于“如何工作”的治理触发，而不是独立领域能力；继续拆成单独 skill 会增加触发噪音和上下文预算压力。

后续入口：

1. 用户说“整理”或需要沉淀：读 `gettokens-ops-governance` 的 `Session Skill Distillation`。
2. 外部 workflow / prompt library / skills 吸收：读 `External Workflow Intake`。
3. subagent 监督交付或审计另一个 agent：读 `Subagent Delivery Loop`。
4. 多方案比较：读 `Plan Arbitration`。

不吸收内容：

1. 不安装 BuilderIO 全量 skill 包，避免重复和 skill discovery 预算膨胀。
2. 不启用 hosted Agent-Native Plan 作为默认依赖；若未来需要结构化计划/复盘，优先用 GetTokens space、design HTML、截图和 dev 文档承载。
3. 不采用 `quick-recap` 的 emoji 结尾约定；GetTokens 最终回复继续遵循当前 Codex 风格，只明确 done / pending / blocked 状态。

## 为什么进行整合

1. **解决预算告警**：原先 9 个技能的描述总和超出了 CLI 的上下文配额，导致描述被截断。
2. **逻辑内聚**：原先的多个流程类技能（治理、写回、同步、蒸馏）本质上都是关于“工作流”的，将其内聚后更易于理解和调用。
3. **清晰边界**：通过“流程治理” vs “领域工程”的划分，使得技能的触发场景更加明确。

---

## 历史记录 (20260424 蒸馏)

（以下为整合前的原始 skills 列表，仅供参考）
...


当前沉淀出来的长期知识并不是若干孤立 bug，而是八类工作模式：

1. 账号池是当前最复杂、最容易回归的业务面。
2. Wails 开发态存在“看起来编译通过，但桌面窗口没加载新代码”的高频风险。
3. 交互问题经常需要先证明“代码有没有真的跑起来”。
4. 视觉与文案已经形成明确风格，不应每轮重新定义。
5. 会话中沉淀出来的项目知识需要有一套稳定的 skill 提炼流程。
6. AGENTS、文档、记忆、索引如果不同步，项目规则很快会失真。
7. `spaces` 结构落地后，单个需求空间的创建、命名和归档需要稳定执行模式。
8. 文档写回、memory 写回和索引同步是固定动作，应该独立成 skill，避免每次靠人工回忆。
9. “整理”已经成为会话收尾口令，后续应直接把它解释为一次 `skills + AGENTS + docs + memory` 的沉淀动作，而不是只做聊天总结。
10. sidecar 行为问题已经不再只是“看参考项目”，而是需要正式维护 `CLIProxyAPI` fork，并分清源码、fork 分支和 app bundle 实际二进制三层关系。

## 不纳入 skill 的内容

1. 单次提交信息
2. 一次性排障过程中的临时猜测
3. 某个具体账号文件的数据样本
4. 仅在那次会话里出现、但没有复用价值的口头表述
