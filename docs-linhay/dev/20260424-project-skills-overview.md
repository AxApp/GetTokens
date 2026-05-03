# GetTokens 项目级 Skills 蒸馏

来源会话：`gemini --resume 05ae7144-6948-432a-8845-8ae91ef183b5`

这轮沉淀只保留对 GetTokens 后续开发仍然稳定有效的能力边界，不保留一次性的修复细节。

## 20260427 更新：补回会话蒸馏入口

此前 `AGENTS.md` 已把“用户说整理 => 触发会话沉淀”写成正式规则，但仓库里缺少实际的 `gettokens-session-skill-distill` 入口文件，导致规则和落地物不一致。

本次已补：

1. `.agents/skills/gettokens-session-skill-distill`
   - 负责把“整理”解释为一次正式沉淀动作
   - 先抽模式，再判断是 skill、docs、memory，还是 AGENTS
   - 固定要求在收尾时执行 `qmd update` 与 `qmd embed`

## 20260427 更新：收敛技能入口与描述预算

本次针对 CLI 的 `Exceeded skills context budget` 告警继续做两项治理：

1. `AGENTS.md` 不再引用不存在的 `gettokens-space-governance`、`gettokens-doc-writeback`、`gettokens-agents-governance-sync`，统一收敛到现有的 `gettokens-ops-governance` 与 `gettokens-session-skill-distill`。
2. 项目级 3 个 skill 的 frontmatter `description` 改成短描述，优先保留触发边界，避免把细节塞进技能列表元数据。

后续约束：

1. 新增项目级 skill 前，先判断是否真的需要新增入口，而不是继续把已有 skill 拆细。
2. skill 的 `description` 只写“触发场景 + 能力边界”，详细规则放正文，不再写成长句枚举。
3. 若再次出现预算告警，优先检查项目级 skill 描述和悬空引用，再考虑继续整合。

## 20260520 更新：Skills 整合

由于项目级 skills 数量过多（9个）导致 CLI 上下文预算超标，现将高频工程规则整合为少量核心技能，以保持高效响应并减少冗余。

## 当前 Skills

1. `.agents/skills/gettokens-ops-governance`
   **项目运营与治理**。整合了 Wails 开发回路（重启规则、就绪模型）、`spaces` 工作空间治理、文档与记忆写回流程、AGENTS 同步、subagent 监督交付闭环，以及会话技能蒸馏。它定义了“如何在 GetTokens 仓库里正确地工作”。

2. `.agents/skills/gettokens-domain-engineering`
   **领域工程与技术**。整合了账号池（unified inventory）、配额规则（quota rules）、UI 视觉系统（Swiss-industrial）、前端调试归因，以及 CLIProxyAPI fork 维护。它定义了“GetTokens 的技术实现与工程约束”。

3. `.agents/skills/gettokens-session-skill-distill`
   **会话沉淀入口**。专门处理“整理”场景：提炼会话里真正稳定的模式，决定是否补 skill、写 docs/memory，或升级到 AGENTS。

4. `.agents/skills/gettokens-subagent-supervision`
   **监督交付触发入口**。当用户明确要求“用 subagent 做、主控 agent 监督到完成”时，用这个 skill 直接把会话切到监督交付模式；具体执行细节继续复用 `gettokens-ops-governance`。

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
