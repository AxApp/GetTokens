# docs-linhay spaces 结构治理说明

## 背景
GetTokens 的文档结构以 `space` 为中心组织：

```text
docs-linhay/
├── spaces/
│   └── <space-key>/
│       ├── README.md
│       ├── plans/
│       ├── screenshots/
│       └── debate/
├── dev/
├── memory/
├── references/
└── scripts/
```

这里使用目录名 `spaces/`，后续所有规范和引用都以该正式路径为准。

## 设计目标
1. 让单个需求、主题或里程碑的文档收敛到同一工作空间内。
2. 避免需求 spec、计划、截图、辩论记录散落在多个根目录，降低回溯成本。
3. 让 agent 在更新需求文档、截图归档、辩论文档时有明确单点落位。

## 落位规则
1. `docs-linhay/spaces/<space-key>/README.md`
   记录需求背景、目标、范围、验收标准、关联技术方案与测试入口。
2. `docs-linhay/spaces/<space-key>/plans/`
   存放该需求空间内的开发计划、里程碑、分阶段执行方案。
3. `docs-linhay/spaces/<space-key>/screenshots/`
   存放该需求空间内的截图，继续采用按日期、模块分层。
4. `docs-linhay/spaces/<space-key>/debate/`
   存放该需求空间内的多 agent 辩论文档。
5. `docs-linhay/dev/`
   仍然只承载跨需求的技术方案、架构说明、工程规则，不承接单个 feature 的主需求文档。

## 命名约定
1. `<space-key>` 使用英文 slug。
2. 优先使用 `<YYYYMMDD>-<topic>` 或稳定功能名。
3. 禁止空格、中文、`latest`、`final`。
4. 每个 `space` 根文档固定命名为 `README.md`。

## 自动化支持
1. `docs-linhay/scripts/create-space.sh <space-key>`
   用于生成标准 `space` 目录结构与初始 `README.md`；模板内默认包含 `设计稿入口` 与 `Worktree 映射`。
2. `docs-linhay/scripts/check-docs.sh`
   用于校验 `spaces/` 下的目录完整性，以及截图和 debate 文件命名是否符合规则。
3. `docs-linhay/README.md`
   作为文档系统总入口，提供目录说明与常用命令。
4. `docs-linhay/dev/20260429-space-worktree-governance.md`
   作为 `space / branch / worktree` 协同治理说明，补充目录外工作区的路径约定、创建时机、生命周期与单期 HTML 设计稿约束。

## 与 AGENTS 的关系
1. `AGENTS.md` 负责定义 repo-wide 的长期规则。
2. 本文档负责解释 `spaces` 结构的设计意图与落位方法。
3. `gettokens-ops-governance` 负责 `space` 层面的具体执行流程，以及文档/记忆写回闭环。
4. `docs-linhay/dev/20260429-space-worktree-governance.md` 负责补充 `space` 与 Git `worktree` 的边界，不和本文重复维护。
5. 若后续仅需补充某类任务的执行模式，优先新增或更新 `.agents/skills/`，不要把会话级细节继续堆进 `AGENTS.md`。
