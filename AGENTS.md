# AGENTS 执行规范（精简可执行版）

## 0. 路径规范（不可删）
以下目录结构为长期约束，后续修改 `AGENTS.md` 时不得删除，只能增补：

```text
.
├── AGENTS.md          # 行为规则，可按任务优化但需保留路径规范
└── docs-linhay/       # 项目文档系统目录：开发计划、需求文档、技术文档等
    ├── spaces/        # 以 feature / topic / milestone 为单位的工作空间根目录
    │   └── <space-key>/
    │       ├── README.md      # 当前 space 的需求背景、目标、范围、验收标准
    │       ├── plans/         # 开发计划、迭代规划、里程碑
    │       ├── screenshots/   # 截图，按日期/模块分层存放
    │       └── debate/        # 多 agent 辩论文档，按日期和主题分层存放
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
10. 当用户明确说“整理”且语境指向刚完成的一轮工作会话时，默认触发一次会话沉淀流程：先按 `gettokens-session-skill-distill` 提炼可复用模式，再按是否 repo-wide 决定是否同步更新 `AGENTS.md`、`docs-linhay/dev/`、`docs-linhay/memory/`，并执行 `qmd update` 与 `qmd embed`。
11. 多份独立需求稿并行推进时，默认按“一个需求单元一个 `space`，必要时再配一个同 key 的 branch 与 `worktree`”组织，不按个人姓名或临时阶段单独命名工作目录。

## 2. 标准工作流（必须）
1. 明确需求边界与验收条件。
2. 先补测试并确认失败（红灯）。
3. 最小实现让测试通过（绿灯）。
4. 必要重构并保持测试通过。
5. 更新相关文档与记忆。
6. 若本次任务提炼出可复用的项目动作、流程或知识边界，新增或更新对应 `skills`；若同时形成长期稳定规则，再更新 `AGENTS.md`。
7. 若用户以“整理”作为收尾指令，且本轮存在稳定可复用模式，不需要额外追问是否沉淀，直接进入 `skills` / `AGENTS` / docs / memory 的整理流程。
8. 若某个需求将进入并行开发、多日实现或与其他需求同时切换，先补齐对应 `space`，再创建同 key 的 branch / `worktree`。

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
4. `docs-linhay/spaces/<space-key>/debate/`：该需求空间下的多 agent 辩论文档。
5. `docs-linhay/dev/`：研发文档、技术方案、治理说明。
6. `docs-linhay/memory/`：记忆系统（`MEMORY.md` + 每日日志 `YYYY-MM-DD.md`）。
7. `docs-linhay/references/`：参考项目、外部资料归档。
8. `docs-linhay/scripts/`：自动化脚本及其说明文档。

Git `worktree` 治理：
1. `space` 负责需求背景、计划、截图、辩论和验收；`worktree` 只负责该需求的代码执行上下文。
2. 默认映射为：`space = docs-linhay/spaces/<space-key>/`、`branch = feat/<space-key>`、`worktree = ../GetTokens-worktrees/<space-key>/`。
3. 只讨论、不落代码的需求稿只建 `space`，不建 `worktree`。
4. 一次性小修或当天即可完成的短改动，可直接在主工作区开短分支，不强制建 `worktree`。
5. 会并行推进、会持续多天、会频繁切换上下文的需求，必须使用独立 `worktree`。
6. release、打包、一次性验证类短命工作区可继续放在 `/private/tmp/`，但常规 feature `worktree` 不得放在 `/tmp`。
7. 禁止在主仓库目录内嵌套创建 feature `worktree`，避免污染搜索、索引和脚本扫描范围。
8. 合并完成后删除对应 `worktree`，保留 `space` 文档、截图、计划和 debate 历史。

设计稿治理：
1. 设计稿 HTML 默认落在对应 `space` 根目录，作为该期视觉/交互方案的唯一入口。
2. 单个 `space` 的单期设计稿只保留一个 HTML 文件，文件名应语义化且可追踪，例如 `design-preview.html`、`usage-dashboard-design-v01.html`。
3. 同一期内若需要展示多方案对比、多个状态或多个区域稿，统一放在同一个 HTML 文件中，用分节、锚点或标签页组织，不再拆成多个平行 HTML 文件。
4. 只有跨期迭代时才允许新增下一版 HTML，例如从 `*-v01.html` 演进到 `*-v02.html`；同一期内禁止出现 `option-a/b/c` 平行文件。
5. 既有多 HTML 设计稿视为历史遗留；后续新增或重构时按本规则收敛，不要求本次治理整理顺手迁移所有旧稿。

文档落位硬约束：
1. 需求变更先写对应 `space`，再改代码。
2. 技术方案和治理说明放 `docs-linhay/dev/`。
3. 截图、计划、辩论材料必须跟着对应 `space` 走。
4. 外部参考资料统一归档到 `docs-linhay/references/`。

项目级 skills：
1. 涉及 `space` 创建、命名、README 模板、截图或 debate 归档时，优先使用 `gettokens-ops-governance`。
2. 涉及文档写回、memory 写回、`qmd update` / `qmd embed` 同步时，优先使用 `gettokens-ops-governance`。
3. 涉及 AGENTS 级长期治理规则时，优先使用 `gettokens-ops-governance`；若用户明确说“整理”，同时使用 `gettokens-session-skill-distill`。
4. 涉及账号池、quota、视觉系统、前端调试归因或 CLIProxyAPI fork 维护时，优先使用 `gettokens-domain-engineering`。

## 5. 记忆系统规则（必须）

### 5.1 Retrieval（查询）
查询历史信息时，禁止先全量读取 `docs-linhay/memory/MEMORY.md` 或 `docs-linhay/memory/*.md`。按顺序执行：
1. `qmd query "<问题>"`
2. `qmd get <file>:<line> -l 20`
3. 仅当 `qmd` 无结果时，才回退直接读文件

### 5.2 Writeback（写回）
出现以下情况必须写入记忆：关键决策、行动项、偏好变化、里程碑、风险结论。
1. 写入 `docs-linhay/memory/YYYY-MM-DD.md`
2. 执行 `qmd update && qmd embed`
3. 每周合并到 `docs-linhay/memory/MEMORY.md`（只保留稳定高价值信息）

### 5.3 Collection 管理
`qmd` 需支持自动建立 collection，规则如下：
1. 首次在项目中执行 `qmd update` 时，若 collection 不存在，自动创建。
2. collection 名称与项目目录名保持一致。
3. 跨项目查询时，通过 `qmd query --collection <name> "<问题>"` 指定 collection。
4. CI/CD 环境中应跳过 collection 初始化（通过环境变量 `QMD_SKIP_INIT=1` 控制）。

## 6. 文档工具（推荐）
1. 新建 `space` 时优先使用 `docs-linhay/scripts/create-space.sh <space-key>`。
2. 提交前或调整治理规则后，运行 `docs-linhay/scripts/check-docs.sh` 做结构校验。
3. 新建 feature `worktree` 时，默认使用 `git worktree add ../GetTokens-worktrees/<space-key> -b feat/<space-key> master`；若当前集成分支不是 `master`，以当轮基线分支替换末尾参数。

## 7. 完成定义（DoD）
1. 验收场景满足。
2. 相关测试通过，或已说明阻塞、未测原因与风险。
3. 文档已更新到正确目录。
4. 有意义变更已写入记忆并可检索。
5. 若本次工作产生了可复用且重复出现的行为模式，已完成对应 `skills` / `AGENTS.md` 的新增或更新，或已明确说明为何暂不沉淀。
