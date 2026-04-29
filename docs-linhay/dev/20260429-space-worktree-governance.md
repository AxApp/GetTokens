# GetTokens Space / Worktree 治理说明

## 背景

当前仓库已经用 `docs-linhay/spaces/<space-key>/` 统一承载单个需求的文档资产，但 Git `worktree` 仍主要用于 release 类场景，尚未和 feature 需求形成稳定映射。随着独立需求稿数量增加，如果继续把多个需求塞进同一个工作目录，会持续出现以下问题：

1. 未提交改动互相污染，切换分支成本高。
2. 同一需求的 spec、计划、截图和代码上下文无法通过同一主键追踪。
3. agent 或人工接手时，只看到代码分支，不知道对应哪份需求空间。

因此需要把 `space` 和 `worktree` 的职责边界、路径约定和生命周期写成统一治理规则。

## 设计目标

1. 让每个独立需求单元有唯一、稳定、可检索的主键。
2. 让文档长期沉淀与代码临时执行环境分离，避免相互污染。
3. 让并行开发、上下文切换和后续回溯都基于同一套命名约定。

## 核心定义

1. `space`
   长期文档资产，承载需求背景、目标、范围、计划、截图、debate 与验收记录。
2. `branch`
   代码提交线，默认使用 `feat/<space-key>` 作为命名口径。
3. `worktree`
   临时执行环境，承载该需求在某一时间段内的实际代码工作目录。

结论：

1. `space` 是长期保留资产。
2. `worktree` 是临时执行上下文。
3. 同一个需求默认共享同一个 `<space-key>`。

## 路径约定

默认映射如下：

```text
space    -> docs-linhay/spaces/<space-key>/
branch   -> feat/<space-key>
worktree -> ../GetTokens-worktrees/<space-key>/
```

示例：

```text
space    -> docs-linhay/spaces/20260429-network-proxy/
branch   -> feat/20260429-network-proxy
worktree -> ../GetTokens-worktrees/20260429-network-proxy/
```

补充规则：

1. feature `worktree` 必须放在主仓库同级目录 `../GetTokens-worktrees/`。
2. 禁止把 feature `worktree` 创建在主仓库目录内部，避免污染 `rg`、IDE 索引和脚本扫描。
3. `/private/tmp/` 只用于 release、打包、一次性验证、临时复现等短命工作区，不用于常规 feature 开发。

## 什么时候创建 worktree

默认先建 `space`，再按需求强度决定是否升级到独立 `worktree`。

只建 `space`，不建 `worktree` 的场景：

1. 当前还在讨论需求边界。
2. 只有 spec、方案或参考资料整理，没有代码实现。
3. 当天内即可完成的小修补，不值得长期占用独立工作目录。

必须建独立 `worktree` 的场景：

1. 多份独立需求稿并行推进。
2. 同一开发者需要在多个需求之间频繁切换。
3. 该需求会持续多天实现或包含明显的实验性改动。
4. 需要让不同 agent / 不同人并行处理不同需求，而不共享未提交改动。

## 生命周期

推荐工作流：

1. 先创建 `space`，在 `README.md` 写明背景、目标、范围、验收标准。
2. 确认进入实现阶段后，创建同 key 的 `branch` 与 `worktree`。
3. 所有该需求的计划、截图、debate、验收记录都继续归档到对应 `space`。
4. 设计稿如需产出 HTML，默认在该 `space` 根目录维护单一入口文件；同一期的多方案对比也在这一个文件内完成。
5. 合并完成后删除 `worktree`，保留 `space` 作为长期记录。

这样可以确保：

1. `space` 负责沉淀。
2. `worktree` 负责执行。
3. 两者通过同一个 `<space-key>` 建立稳定映射。

## 设计稿产物规则

为了避免同一个需求空间里堆积多份平行 HTML 稿，后续统一采用以下约束：

1. 单个 `space` 的单期设计稿只保留一个 HTML 文件。
2. 该文件默认放在 `space` 根目录，不单独再建 `designs/` 或其他平行目录。
3. 如果需要比较多个方向、多个区域方案或多个交互状态，也应写在同一个 HTML 中，通过章节、锚点、切换按钮或并排布局组织。
4. 只有当需求进入下一轮迭代，且确实需要保留上一轮对照时，才新增下一版文件，例如 `usage-dashboard-design-v02.html`。
5. 不再为同一期拆出 `option-a/b/c`、`draft-1/2/3` 这类平行 HTML 文件。

推荐理由：

1. 单一入口更容易从 `README.md` 链接和回溯。
2. 前端交接时不会因为多份平行稿而失去“当前准稿”。
3. 同一文件内对比更容易保持公共布局、 token 和边界一致。

补充说明：

1. 仓库中既有的多 HTML 设计稿属于历史遗留，不要求因为本次治理调整而统一迁移。
2. 后续只要新增设计稿或重构旧稿，应按本规则收敛。

## Space README 最低结构

为了让 `space` 在“讨论阶段”到“实现阶段”之间都具备单点入口，后续 `README.md` 至少应包含以下区块：

1. `背景`
2. `目标`
3. `范围`
4. `非目标`
5. `验收标准`
6. `设计稿入口`
7. `Worktree 映射`
8. `相关链接`
9. `当前状态`

约束说明：

1. `设计稿入口` 必须指向该期唯一 HTML 文件；未产出时也要明确写 `（未产出）`，避免读者猜测。
2. `Worktree 映射` 默认填写：
   - `branch: feat/<space-key>`
   - `worktree: ../GetTokens-worktrees/<space-key>/`
3. 如果该需求当前只停留在讨论阶段，还没有创建实际 `worktree`，仍然保留这两个推荐值，等进入实现阶段再核对是否与实际一致。
4. `当前状态` 至少要写状态值和最近更新日期，避免 space 变成无人维护的静态草稿。

## 模板落地

`docs-linhay/scripts/create-space.sh` 生成的新 `space README` 已经内置：

1. `设计稿入口`
2. `Worktree 映射`
3. 单期单 HTML 的提示语

后续新建 `space` 时，不需要再手工补这些基础字段。

推荐样板：

1. `docs-linhay/spaces/20260429-usage-desk-controls-redesign/README.md`
   该历史 space 已按当前规则收敛为标准示例，适合后续新 space 直接参照。
2. `docs-linhay/spaces/20260429-text-scale-settings/README.md`
   该历史研究型 space 已按当前规则收敛为“短 README + plans/handoff/debate 下钻”的示例，适合后续大体量需求文档参照。
3. `docs-linhay/spaces/20260429-nolon-session-management/README.md`
   该历史研究型 space 已按同样规则执行一轮真实收敛，适合作为“长分析回落到 autoresearch summary / debate，README 只保留裁定与入口”的示例。

## 研究型 README 瘦身规则

当单个 `space README` 同时承载需求边界、完整实现计划、组件抽象观察、handoff 和 debate 结论时，后续应主动收敛，避免 README 继续膨胀成会话转录。

推荐拆分方式：

1. `README.md`
   只保留背景、目标、范围、非目标、验收标准、当前裁定、设计稿入口、worktree 映射、相关链接、当前状态。
2. `plans/*.md`
   承载分阶段实施计划、技术方案、组件复用候选、handoff 等可执行长文。
3. `debate/*.md`
   承载完整争论过程、证据、分歧与回合记录。

判断标准：

1. 如果 README 已经让读者需要连续滚动数屏才能找到“当前结论”和“主入口链接”，就应该拆。
2. 如果某一节已经有独立稳定主题，例如“实施计划”“组件抽象观察”“handoff”，就不应继续堆在 README 里。
3. README 的职责是导航和裁定，不是保存整个研究过程。

## 命名规则

1. `<space-key>` 继续使用英文 slug。
2. 优先使用 `<YYYYMMDD>-<topic>` 或稳定功能名。
3. `branch` 默认采用 `feat/<space-key>`。
4. 禁止出现 `latest`、`final`、中文、空格或同义别名漂移。

错误示例：

1. `proxy-redesign`
2. `network-proxy-v2-final`
3. `linhay-branch`

这些命名都无法稳定反推出对应 `space`、需求时间点或业务边界。

## 目录建议

推荐在主仓库同级维护以下结构：

```text
../GetTokens/
../GetTokens-worktrees/
    ├── 20260429-network-proxy/
    ├── 20260429-text-scale-settings/
    └── account-pool/
```

理由：

1. 路径稳定，不依赖 `/tmp` 生命周期。
2. 语义明确，主仓库和 feature 工作区天然分开。
3. 便于后续脚本化清理和批量巡检。

## 常用命令

基线分支默认以 `master` 为例：

```bash
docs-linhay/scripts/create-space.sh 20260429-network-proxy
git worktree add ../GetTokens-worktrees/20260429-network-proxy -b feat/20260429-network-proxy master
git worktree list
git worktree remove ../GetTokens-worktrees/20260429-network-proxy
```

说明：

1. 如果当前集成基线不是 `master`，用当轮集成分支替换命令最后一个参数。
2. 删除 `worktree` 前应确认改动已经合并、转存或明确废弃。

## 与现有规范的关系

1. `AGENTS.md` 负责 repo-wide 的长期强约束。
2. 本文负责解释 `space / branch / worktree` 的职责边界、路径约定和使用时机。
3. `docs-linhay/README.md` 负责提供日常入口和常用命令。

## 落地结论

后续默认采用以下规则：

1. 独立需求稿默认先建 `space`。
2. 进入并行开发、多日实现或频繁切换阶段后，再创建同 key 的 `branch` 与 `worktree`。
3. 常规 feature `worktree` 固定放在主仓库同级 `../GetTokens-worktrees/`。
4. release 或短命验证类工作区才允许放在 `/private/tmp/`。
