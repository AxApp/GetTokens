# docs-linhay 文档入口

`docs-linhay/` 是 GetTokens 的项目文档系统根目录，日常查阅和维护优先从这里进入，不要把 `AGENTS.md` 当作普通导航页使用。

## 目录说明

1. `spaces/`
   单个需求、主题或里程碑的工作空间。每个 `space` 下固定包含 `README.md`、`plans/`、`screenshots/`、`debate/`。
2. `dev/`
   技术方案、工程治理说明、流程设计、测试策略。
3. `memory/`
   关键决策、里程碑、风险、偏好变化的长期记忆。
4. `references/`
   外部参考项目和资料归档。
5. `scripts/`
   文档脚手架与校验脚本。

## Worktree 约定

1. `space` 是长期文档资产；`worktree` 是临时代码工作目录。
2. 独立需求默认使用同一个 `<space-key>` 映射三处路径：
   `docs-linhay/spaces/<space-key>/`、`feat/<space-key>`、`../GetTokens-worktrees/<space-key>/`
3. 常规 feature `worktree` 必须放在主仓库同级目录 `../GetTokens-worktrees/`，不要创建在仓库内部。
4. `/private/tmp/` 只用于 release、打包、临时验证，不用于日常 feature 开发。

## 设计稿约定

1. 单个 `space` 的单期设计稿只保留一个 HTML 文件，默认放在该 `space` 根目录。
2. 多稿对比、多个状态或多个区域方案，统一收敛在同一个 HTML 文件里，不再拆成 `option-a/b/c` 多文件。
3. 只有跨期迭代时才新增下一版 HTML；同一期内优先改同一个文件。

## 常用操作

1. 新建 `space`

```bash
docs-linhay/scripts/create-space.sh 20260424-login-refresh
```

生成的 `README.md` 默认会带出：
- `设计稿入口`
- `Worktree 映射`
- `背景 / 目标 / 范围 / 非目标 / 验收标准 / 当前状态`

2. 校验文档结构

```bash
docs-linhay/scripts/check-docs.sh
```

3. 创建 feature worktree

```bash
git worktree add ../GetTokens-worktrees/20260429-network-proxy -b feat/20260429-network-proxy master
```

4. 记忆写回后更新索引

```bash
qmd update && qmd embed
```

## 命名规则

1. `space-key` 使用英文 slug，优先使用 `<YYYYMMDD>-<topic>` 或稳定功能名。
2. 禁止空格、中文、`latest`、`final`。
3. 截图和 debate 文件继续遵循 `AGENTS.md` 与 `gettokens-ops-governance` 中的命名规则。
4. 设计稿 HTML 文件名应语义化且可追踪，例如 `design-preview.html`、`usage-dashboard-design-v01.html`；避免 `option-a.html` 这类只表达比较序号、不表达主题的命名。

## 推荐使用顺序

1. 需求或范围变化：先更新对应 `spaces/<space-key>/README.md`
2. 若该需求会产出设计稿：先把 `README.md` 中的“设计稿入口”指向唯一 HTML 文件
3. 若该需求进入实现：确认 `README.md` 中的 branch / worktree 映射与实际一致
4. 技术设计或治理说明：写到 `dev/`
5. 决策、风险、里程碑：写到 `memory/`
6. 文档改动完成后：运行 `check-docs.sh`
7. memory 写回完成后：运行 `qmd update && qmd embed`
8. 需求进入并行实现后：为对应 `space-key` 创建同 key 的 branch 和 `worktree`
