# AGENTS 执行规范（精简可执行版）

## 0. 路径规范（不可删）
以下目录结构为长期约束，后续修改 `AGENTS.md` 时不得删除，只能增补：

```text
.
├── .codex/            # Codex 项目级配置：subagent、项目运行参数等
│   ├── config.toml
│   └── agents/        # 项目级 Codex custom agents
├── AGENTS.md          # 行为规则，可按任务优化但需保留路径规范
└── docs-linhay/       # 项目文档系统目录：开发计划、需求文档、技术文档等
    ├── spaces/        # 以 feature / topic / milestone 为单位的工作空间根目录
    │   └── <space-key>/
    │       ├── README.md      # 当前 space 的需求背景、目标、范围、验收标准
    │       ├── plans/         # 开发计划、迭代规划、里程碑
    │       └── screenshots/   # 截图，按日期/模块分层存放
    ├── dev/          # 研发文档（架构、技术方案、测试策略、数据字典等）
    ├── memory/       # 记忆系统（MEMORY.md + 每日日志）
    ├── references/   # 参考项目、外部资料归档
    └── scripts/      # 自动化脚本及其说明文档
```

补充约束：
1. `spaces` 为正式目录名，后续所有文档落位和引用都以该路径为准。
2. `<space-key>` 采用可追踪的英文 slug，优先使用 `<YYYYMMDD>-<topic>` 或稳定功能名，禁止空格、中文、`latest`、`final`。
3. 每个 `space` 的入口文档固定为 `README.md`。
4. feature 开发用的 Git `worktree` 不放在仓库目录内，统一放在主仓库同级目录 `../GetTokens-worktrees/`。
5. 单个 feature `worktree` 的推荐路径为 `../GetTokens-worktrees/<space-key>/`；默认与对应 `space` 共享同一个 `<space-key>`。
6. `worktree` 是临时执行环境，`space` 是长期文档资产；需求完成后可删除 `worktree`，不得删除对应 `space` 历史。
7. 单个 `space` 的单期设计稿默认只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内，不再为同一期拆分多个 `option-*.html`。

## 1. 全局原则
1. BDD + TDD 必须先行：先场景与验收标准，再失败测试，再实现。
2. 全程中文沟通。
3. 小步提交、可回归验证，避免大块不可控改动。
4. E2E 场景覆盖核心功能，单元测试覆盖边界条件。
5. 文档与记忆同步更新，保持信息一致性。
6. 任何改动都要考虑对后续维护者的可理解性和可操作性。
7. 涉及 Web / 前端体验优化时，默认由 Gemini 主导前端实现；Codex 负责业务逻辑、接口契约、状态流转、测试门禁、回归验收与最终集成。
8. 前端改动若影响后端接口、领域模型或关键交互闭环，必须先由 Codex 明确边界，再交给 Gemini 落地，避免只改视觉不改业务完成度。
9. 当一次会话中出现“有用且重复出现”的行为模式、排障路径或交付动作时，必须先识别复用边界，再优先新增或更新项目级 `skills`；只有当规则已经上升为 repo-wide、长期稳定的约束时，才同步更新 `AGENTS.md`。
10. 当用户明确说“整理”、暂停当前修复、要求剩余项进入下期，或一轮长会话/重要修复/subagent 交付即将收尾时，默认自动触发一次会话沉淀审计：先按 `gettokens-session-skill-distill` 提炼可复用模式，再按是否属于领域 skill、跨领域 workflow、repo-wide 规则或 memory-only 记录，决定是否同步更新 `.agents/skills/`、`docs-linhay/dev/`、`AGENTS.md`、`docs-linhay/memory/`；不需要等用户额外追问“有什么可以沉淀”。
11. 自动触发不以用户口令为唯一条件：只要当前轮已经形成稳定边界、重要失败模式、重复执行步骤、发版/验收/止血流程，主控 agent 在最终回复前就必须主动执行一次沉淀审计，并在交付说明中明确“已沉淀什么”或“为什么这轮不沉淀”。
12. 多份独立需求稿并行推进时，默认按“一个需求单元一个 `space`，必要时再配一个同 key 的 branch 与 `worktree`”组织，不按个人姓名或临时阶段单独命名工作目录。
13. 当用户明确要求“由 subagent 去做、主控 agent 负责监督”时，主控 agent 必须承担需求边界、任务拆分、集成、验收、文档与最终完成判断，不得在“代码已改完”但截图、实机验证、文档写回等验收环节仍未完成时提前停止。
14. 当某个 `space` 的需求施工结束并进入整理期时，默认执行一次行为保持的收尾整理：识别大文件和大数据结构，优先按稳定边界拆分文件；同步提取可复用流程到项目级 `skills`，仅把 repo-wide 且长期稳定的规则写入 `AGENTS.md`；最后更新 space、dev 文档与 memory。
15. 本地 Web / Wails 预览验收默认使用无头浏览器、DOM 断言和文件截图；除非用户明确要求可见窗口，否则不得把 Playwright、Chrome 或其他浏览器验收窗口打开到用户当前激活显示器。确需可见窗口时必须先询问，或放到非激活副屏。
16. 通用看板产品线按固定节奏推进：新建 `space` -> 设计需求 -> 技术细节补充 -> 回到需求调整 -> 调整设计系统的稿子 -> 执行开发 -> 冒烟测试 -> 交付用户测试。
17. sidecar 是 GetTokens 运行态自治层。账号选择、rate-limit、route guard、live sessions、usage attribution、system proxy、Codex WebSocket 等热路径状态优先在 `CLIProxyAPI#gettokens/sidecar` 内闭环，不通过前端或 Wails 临时补偿来伪造 sidecar 已处理状态。
18. 从账号与凭证 SQLite 统一存储版本开始，GetTokens sidecar 不再跟随 CLIProxyAPI 上游做合并式同步。上游提交和功能只能作为参考输入；需要的能力必须在 GetTokens sidecar 边界内重新设计、实现、补窄测试并重建 sidecar。management API 可以按 GetTokens 需求破坏性调整，不为了上游兼容保留旧合约。
19. GetTokens 是 macOS/Wails 桌面工作台产品，默认不做移动端适配、移动端截图或 375/390px 宽度验收。前端与视觉改动默认按桌面窗口、Wails 容器和可用的桌面浏览器预览验收；只有用户在当前需求中明确提出移动端目标时，才增加移动端布局与截图门禁。
20. 项目级 Codex subagent 配置统一放在 `.codex/agents/`，默认命名为 `gettokens_*`；除非正在验证模型路由能力，否则 agent 默认继承父会话模型，只用职责、sandbox 和 reasoning effort 区分任务面。
21. 主控 agent 可根据任务判断自主新增、删除或修改 `.codex/agents/*.toml`，不需要逐次请求授权；但必须说明判断依据，验证 TOML 可解析，并更新 `docs-linhay/dev/20260530-codex-project-subagents.md` 与 memory。
22. 工作台内详情类或调试类 modal 默认必须使用覆盖整个应用窗口视口（包括 sidebar 区域）的遮罩层，面板四周保留可见遮罩与投影间距，并具备可恢复的独立 hash 路由。打开 modal 时写入 `detail=<id>` 或 `modal=<route>`，关闭时只移除对应标记；全局 hash canonicalizer 不得丢弃仍属于当前 frame/workspace 的 modal/detail 参数。
23. 上下游自身限制不由 GetTokens 默认兜底：若根因属于 Codex CLI / Codex upstream 的协议行为、请求体限制或服务端限制，而非 GetTokens sidecar 引入的重复、放大、错误转换或本地限制，默认只做定位、证据保留和规避建议；只有确认是 GetTokens 转发层自身 bug，或用户明确授权做兼容层，才进入 GetTokens 侧实现。
24. 未经用户明确授权，不得触碰正式版 GetTokens：修复与验证默认只在 dev 环境、本仓库构建产物或明确指定的测试环境中进行；禁止擅自修改 `/Applications/GetTokens.app` 正式版二进制、重启/kill 正式版进程、替换正式版 sidecar 或改动正式版配置。
25. 正式版数据可拷贝到 dev 环境用于复现问题：允许从 `/Users/linhey/.config/gettokens/` 拷贝 SQLite 数据库、配置文件等数据到 `/Users/linhey/.config/gettokens-dev/` 进行测试，但必须先在 dev 目录备份原有数据，验证完成后恢复。
26. 真实 dev App 手点验收不再作为每轮功能修复硬门槛：只有涉及 macOS 菜单栏、窗口生命周期、status item、LaunchServices、native runtime、Wails 绑定可见性，或用户在当前轮明确要求时，才启动本仓 dev App 做真实桌面手点。普通前端/后端/sidecar 修复优先使用自动化测试、Wails build、无头浏览器/DOM 断言、dev bridge 或接口状态证据；避免把每轮验收拖入低收益的桌面点击排障。
27. 每个候选问题进入修复前必须先有确凿证据：至少包含 backlog/体验报告/用户反馈等问题来源、当前代码或 UI 的事实位置、可复现现象或缺失证明、预期验收方式。只有猜测、直觉优先级或未复核的 backlog 条目不得直接进入代码修改；证据不足时只能进入调研、方案或标记为待证实。
28. 外部 skills / prompt library / agent workflow 只能作为参考输入，不默认全量安装或照搬；吸收前必须先通过项目级 skill admission gate，并落到 `AGENTS.md`、项目级 `skills`、`docs-linhay/dev/`、领域词汇表、space 或 memory 的正确层级。
29. 非平凡 GetTokens 任务开始前必须完成项目级 context setup；跨层需求默认先走一条 tracer-bullet 端到端行为链。细则见 `gettokens-ops-governance` 与 `docs-linhay/dev/20260616-agent-skill-operating-model.md`。
30. GetTokens 项目级 skill 的权威读取路径是本仓 `.agents/skills/<skill-name>/SKILL.md`。当 AGENTS、dev 文档或任务语义指向 `gettokens-*` 等项目级 skill 时，必须优先读取本仓版本；全局技能目录只作为补充来源，不能因全局目录缺失就判断项目级 skill 不存在。

## 2. 标准工作流（必须）
1. 明确需求边界与验收条件。
2. 建立证据门禁：在对应 `space` 或计划文档中列出问题来源、代码/UI 事实位置、当前现象、预期验收方式；证据不足不得进入实现。
3. 先补测试并确认失败（红灯）。
4. 最小实现让测试通过（绿灯）。
5. 必要重构并保持测试通过。
6. 更新相关文档与记忆。
7. 若本次任务提炼出可复用的项目动作、流程或知识边界，新增或更新对应 `skills`；若同时形成长期稳定规则，再更新 `AGENTS.md`。
8. 若用户以“整理”作为收尾指令，或当前轮出现可复用模式、半成品中断、下期需求转写等情况，不需要额外追问是否沉淀，直接进入 `skills` / workflow / `AGENTS` / docs / memory 的整理流程；若审计后确认没有可沉淀内容，也要在 memory 或最终说明中明确“不沉淀”的原因。
9. 若某个需求将进入并行开发、多日实现或与其他需求同时切换，先补齐对应 `space`，再创建同 key 的 branch / `worktree`。
10. 若需求采用 `subagent` 交付，标准完成顺序必须覆盖：需求边界确认、subagent 分工、主控集成、自动化验证、Wails/桌面验收（如适用）、截图或其他验收产物、文档与记忆写回；未跑完这一整链，不得宣称需求完成。
11. 通用看板产品线每轮都必须先更新对应 `space` 的需求与验收，再补技术细节；技术约束反推需求后，需要回到 `space` 调整需求，再进入设计系统稿、开发、冒烟和用户测试。
12. 验收文档按本轮风险选择证据形式：涉及 native/Wails 桌面行为时单列真实 dev App 验收结果；其他修复记录自动化测试、Wails build、浏览器/DOM、dev bridge 或接口状态证据即可。

## 2.1 自动整理 / 沉淀流程（必须）
以下任一条件满足时，主控 agent 必须在最终回复前自动触发一次整理 / 沉淀流程，不需要等待用户再次提醒：
1. 用户明确说“整理”。
2. 当前修复被暂停、改下期、转 backlog 或拆成后续需求。
3. 一轮长会话、重要修复、发版、线上止血、subagent 交付进入收尾。
4. 当前轮出现了新的稳定边界、重复失败模式、重复验证步骤、可复用交付动作或明确的“不该再踩”的坑。

标准动作顺序固定为：
1. 先用 `gettokens-session-skill-distill` 审计本轮候选模式。
2. 判断每个候选应落在哪一层：
   - 临时现象：不沉淀，但要在最终说明或 memory 里写明原因。
   - 单领域复用：更新对应 `.agents/skills/`。
   - 跨领域流程：写入 `docs-linhay/dev/`。
   - repo-wide 长期硬约束：更新 `AGENTS.md`。
   - 关键决策、里程碑、风险、止血结论：写入 `docs-linhay/memory/YYYY-MM-DD.md`。
3. 若本轮有半成品中断或剩余项转下期，必须把证据、范围、验收和下期计划写回，而不是只在聊天里口头说明。
4. 纯治理/文档沉淀至少运行 `docs-linhay/scripts/check-docs.sh` 与 `git diff --check`。
5. 最终回复必须明确：
   - 这次沉淀了什么；
   - 落在哪些文件；
   - 若没有沉淀，为什么不沉淀。

## 3. 测试门禁（必须）
1. 任何功能改动都要有对应测试（新增或更新）。
2. 未运行测试时必须明确说明原因与风险。
3. 禁止“只改代码不验证”。
4. 纯文档或治理规则调整若无可执行测试，至少要完成结构自检、路径校对与引用校对，并在交付说明中明确写明“未运行自动化测试”的原因。

## 4. 文档系统规则（docs-linhay）
`docs-linhay/` 是项目文档系统目录，按类型分文件夹：
1. `docs-linhay/spaces/<space-key>/README.md`：单个需求空间的背景、目标、范围、验收标准、相关链接。
2. `docs-linhay/spaces/<space-key>/plans/`：该需求空间下的开发计划、迭代规划、里程碑。
3. `docs-linhay/spaces/<space-key>/screenshots/`：该需求空间下的截图归档。
4. `docs-linhay/dev/`：研发文档、技术方案、治理说明。
5. `docs-linhay/memory/`：记忆系统（`MEMORY.md` + 每日日志 `YYYY-MM-DD.md`）。
6. `docs-linhay/references/`：参考项目、外部资料归档。
7. `docs-linhay/scripts/`：自动化脚本及其说明文档。

Git `worktree` 治理：
1. `space` 负责需求背景、计划、截图和验收；`worktree` 只负责该需求的代码执行上下文。
2. 默认映射为：`space = docs-linhay/spaces/<space-key>/`、`branch = feat/<space-key>`、`worktree = ../GetTokens-worktrees/<space-key>/`。
3. 只讨论、不落代码的需求稿只建 `space`，不建 `worktree`。
4. 一次性小修或当天即可完成的短改动，可直接在主工作区开短分支，不强制建 `worktree`。
5. 会并行推进、会持续多天、会频繁切换上下文的需求，必须使用独立 `worktree`。
6. release、打包、一次性验证类短命工作区可继续放在 `/private/tmp/`，但常规 feature `worktree` 不得放在 `/tmp`。
7. 禁止在主仓库目录内嵌套创建 feature `worktree`，避免污染搜索、索引和脚本扫描范围。
8. 合并完成后删除对应 `worktree`，保留 `space` 文档、截图和计划历史。

设计稿治理：
1. 设计稿 HTML 默认落在对应 `space` 根目录，作为该期视觉/交互方案的唯一入口。
2. 单个 `space` 的单期设计稿只保留一个 HTML 文件，文件名应语义化且可追踪，例如 `design-preview.html`、`usage-dashboard-design-v01.html`。
3. 同一期内若需要展示多方案对比、多个状态或多个区域稿，统一放在同一个 HTML 文件中，用分节、锚点或标签页组织，不再拆成多个平行 HTML 文件。
4. 只有跨期迭代时才允许新增下一版 HTML，例如从 `*-v01.html` 演进到 `*-v02.html`；同一期内禁止出现 `option-a/b/c` 平行文件。
5. 既有多 HTML 设计稿视为历史遗留；后续新增或重构时按本规则收敛，不要求本次治理整理顺手迁移所有旧稿。

文档落位硬约束：
1. 需求变更先写对应 `space`，再改代码。
2. 技术方案和治理说明放 `docs-linhay/dev/`。
3. 截图、计划材料必须跟着对应 `space` 走。
4. 外部参考资料统一归档到 `docs-linhay/references/`。
5. 完整源码型本地参考项目默认不进入 git；`docs-linhay/references/` 只提交根部 Markdown 索引、调研摘要和必要的小型资料，参考项目源码目录由 `.gitignore` 忽略。既有已跟踪参考目录视为历史遗留，后续新增参考项目必须遵循“不提交源码目录，只提交调研结论”的规则。

项目级 skills：
GetTokens 项目级 skill 以本仓 `.agents/skills/<skill-name>/SKILL.md` 为准；触发到项目级 skill 时先读本仓版本，再考虑全局技能目录中的通用补充。
1. 涉及 `space` 创建、命名、README 模板或截图归档时，优先使用 `gettokens-ops-governance`。
2. 涉及文档写回或 memory 写回时，优先使用 `gettokens-ops-governance`。
3. 涉及 AGENTS 级长期治理规则时，优先使用 `gettokens-ops-governance`；若用户明确说“整理”，同时使用 `gettokens-session-skill-distill`。
4. 涉及账号池、quota、视觉系统、前端调试归因或 CLIProxyAPI fork 维护时，优先使用 `gettokens-domain-engineering`。
5. 涉及 Codex 账号列表、请求顺序、路由探测、OAuth/openai-compatible 模型映射时，优先使用 `gettokens-codex-account-list`。
6. 涉及“主控 agent 监督、subagent 实做、直到完整需求闭环才停止”的执行模式时，优先使用 `gettokens-ops-governance` 中的 `Subagent Delivery Loop`。
7. 若用户希望用显式 skill 名称触发该模式，使用 `gettokens-subagent-supervision`；它是监督交付模式的轻量触发入口。
8. 涉及 Codex Skills / MCP Servers、`[[skills.config]]`、`tk://github.com` / `tk://gitlab.com` Skill source、`~/.codex/config.toml` MCP 解析与保存时，优先使用 `gettokens-codex-extensions-management`。
9. 涉及项目级 Codex custom agents、`.codex/config.toml`、`.codex/agents/*.toml` 或 subagent 任务分工配置时，优先参考 `docs-linhay/dev/20260530-codex-project-subagents.md`。
10. 涉及项目级 Codex subagent 的新增、删除、合并、拆分、验证或生命周期治理时，优先使用 `gettokens-subagent-lifecycle`。
11. 涉及外部 skills / prompt library / agent workflow 吸收时，优先使用 `external-workflow-intake`；若需要落到 GetTokens 的 spaces、memory、AGENTS 或领域规则，再配合 `gettokens-ops-governance`。

## 5. 记忆系统规则（必须）

### 5.1 Writeback（写回）
出现以下情况必须写入记忆：关键决策、行动项、偏好变化、里程碑、风险结论。
1. 写入 `docs-linhay/memory/YYYY-MM-DD.md`
2. 每周合并到 `docs-linhay/memory/MEMORY.md`（只保留稳定高价值信息）

## 6. 文档工具（推荐）
1. 新建 `space` 时优先使用 `docs-linhay/scripts/create-space.sh <space-key>`。
2. 提交前或调整治理规则后，运行 `docs-linhay/scripts/check-docs.sh` 做结构校验。
3. 新建 feature `worktree` 时，默认使用 `git worktree add ../GetTokens-worktrees/<space-key> -b feat/<space-key> master`；若当前集成分支不是 `master`，以当轮基线分支替换末尾参数。
4. 采用 `subagent` 交付的需求，主控 agent 收尾前默认补做一次 DoD 自检：测试、桌面验收、截图、文档、memory、必要时 `check-docs.sh`。

## 7. 完成定义（DoD）
1. 验收场景满足。
2. 相关测试通过，或已说明阻塞、未测原因与风险。
3. 文档已更新到正确目录。
4. 有意义变更已写入记忆并可追溯。
5. 若本次工作产生了可复用且重复出现的行为模式，已完成对应 `skills` / `AGENTS.md` 的新增或更新，或已明确说明为何暂不沉淀。
