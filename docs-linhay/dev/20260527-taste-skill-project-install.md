# Taste Skill 项目级安装记录

## 安装范围

本次将 `Leonxlnx/taste-skill` 仓库中的全部 skill 安装到项目级目录 `.agents/skills/`，用于 GetTokens 仓库内的 Codex project skills 发现。

来源：

- GitHub: `https://github.com/Leonxlnx/taste-skill.git`
- 分支：`main`
- 固定 commit：`3c7017d636c3a4aad378433ea6d0cfa6c921da4a`
- 本地锁文件：`.agents/skills/taste-skill.lock.json`

## 已安装 Skill

| 本地目录 | skill name |
| --- | --- |
| `.agents/skills/taste-skill` | `design-taste-frontend` |
| `.agents/skills/taste-skill-v1` | `design-taste-frontend-v1` |
| `.agents/skills/gpt-tasteskill` | `gpt-taste` |
| `.agents/skills/image-to-code-skill` | `image-to-code` |
| `.agents/skills/imagegen-frontend-web` | `imagegen-frontend-web` |
| `.agents/skills/imagegen-frontend-mobile` | `imagegen-frontend-mobile` |
| `.agents/skills/brandkit` | `brandkit` |
| `.agents/skills/redesign-skill` | `redesign-existing-projects` |
| `.agents/skills/soft-skill` | `high-end-visual-design` |
| `.agents/skills/output-skill` | `full-output-enforcement` |
| `.agents/skills/minimalist-skill` | `minimalist-ui` |
| `.agents/skills/brutalist-skill` | `industrial-brutalist-ui` |
| `.agents/skills/stitch-skill` | `stitch-design-taste` |

## 后续更新流程

推荐使用项目脚本检查或更新：

```bash
docs-linhay/scripts/update-taste-skill.sh --check
docs-linhay/scripts/update-taste-skill.sh --update
```

脚本默认只检查远端 `main` 是否有新 commit；只有传入 `--update` 时，才会按 `.agents/skills/taste-skill.lock.json` 的安装清单替换本地 skill 目录，并更新 lock 文件中的 commit。

手动流程如下：

1. 查询远端最新哈希：

   ```bash
   git ls-remote https://github.com/Leonxlnx/taste-skill.git HEAD refs/heads/main
   ```

2. 对比 `.agents/skills/taste-skill.lock.json` 中的 `source.commit`。
3. 若需要更新，先在临时目录拉取新版本并审阅 `skills/*/SKILL.md` 的变更，再替换对应 `.agents/skills/<name>/` 目录。
4. 更新 `.agents/skills/taste-skill.lock.json` 的 commit 与安装清单。
5. 运行 `docs-linhay/scripts/check-docs.sh`、`qmd update`、`qmd embed`。

## 注意事项

这些外部 skills 的 frontmatter 描述较长，可能增加 Codex skill discovery 的上下文预算压力。若后续出现 skill budget 告警，优先评估是否只保留 GetTokens 高频使用的 taste-skill 子集，而不是继续扩张项目级 skill 数量。

## 会话沉淀

本轮沉淀到 `.agents/skills/gettokens-codex-extensions-management/SKILL.md` 的复用模式：

1. 外部 Git skill 包安装到项目级 `.agents/skills/` 时，要同步写入机器可读 lock。
2. lock 必须包含 source URL、ref、resolved commit，以及 source path 到 local path 的安装清单。
3. 更新脚本默认只检查哈希，替换本地目录必须显式传 `--update`。
4. 文档与 memory 写回后执行 `qmd update` 与 `qmd embed`，确保后续可检索。
