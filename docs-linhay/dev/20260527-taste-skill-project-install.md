# Taste Skill 项目级安装记录

状态更新：2026-06-19 已完成项目级 discovery 瘦身。Taste 外部包仍保留来源记录和参考副本，但 `.agents/skills/` 只保留仍需直接发现的 `output-skill`；视觉/图像生成类入口统一改由 `.agents/skills/gettokens-frontend-design-quality/` 承接，原始内容可在 `docs-linhay/references/taste-skill/skills/` 查阅。

## 安装范围

2026-05-27 曾将 `Leonxlnx/taste-skill` 仓库中的全部 skill 安装到项目级目录 `.agents/skills/`，用于 GetTokens 仓库内的 Codex project skills 发现。2026-06-19 后，为减少 discovery 噪音，只保留高频且无 GetTokens 统一入口替代的子 skill。

来源：

- GitHub: `https://github.com/Leonxlnx/taste-skill.git`
- 分支：`main`
- 固定 commit：`3c7017d636c3a4aad378433ea6d0cfa6c921da4a`
- 本地锁文件：`.agents/skills/taste-skill.lock.json`

## 当前项目级保留 Skill

| 本地目录 | skill name |
| --- | --- |
| `.agents/skills/output-skill` | `full-output-enforcement` |

## 已从项目级 discovery 移除

这些入口不再直接放在 `.agents/skills/` 下，避免和 GetTokens 统一前端设计入口重复。需要参考时读取 `docs-linhay/references/taste-skill/skills/<source-path>/`。

| 原本地目录 | skill name | 现承接方式 |
| --- | --- | --- |
| `.agents/skills/taste-skill` | `design-taste-frontend` | `gettokens-frontend-design-quality` |
| `.agents/skills/taste-skill-v1` | `design-taste-frontend-v1` | reference-only |
| `.agents/skills/gpt-tasteskill` | `gpt-taste` | `gettokens-frontend-design-quality` |
| `.agents/skills/image-to-code-skill` | `image-to-code` | reference-only / explicit image-to-code task |
| `.agents/skills/imagegen-frontend-web` | `imagegen-frontend-web` | reference-only / explicit image generation |
| `.agents/skills/imagegen-frontend-mobile` | `imagegen-frontend-mobile` | reference-only；GetTokens 默认不做移动端 |
| `.agents/skills/brandkit` | `brandkit` | reference-only / explicit brand-kit task |
| `.agents/skills/redesign-skill` | `redesign-existing-projects` | `gettokens-frontend-design-quality` |
| `.agents/skills/soft-skill` | `high-end-visual-design` | `gettokens-frontend-design-quality` |
| `.agents/skills/minimalist-skill` | `minimalist-ui` | `gettokens-frontend-design-quality` |
| `.agents/skills/brutalist-skill` | `industrial-brutalist-ui` | `gettokens-frontend-design-quality` |
| `.agents/skills/stitch-skill` | `stitch-design-taste` | reference-only |

## 后续更新流程

推荐使用项目脚本检查或更新：

```bash
docs-linhay/scripts/update-taste-skill.sh --check
docs-linhay/scripts/update-taste-skill.sh --update
```

脚本默认只检查远端 `main` 是否有新 commit；只有传入 `--update` 时，才会按 `.agents/skills/taste-skill.lock.json` 的 `installedPaths` 安装清单替换仍保留的本地 skill 目录，并更新 lock 文件中的 commit。`retiredProjectDiscoveryPaths` 只记录已退出项目级 discovery 的来源，不会被脚本自动恢复。

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

这些外部 skills 的 frontmatter 描述较长，且大量入口和 GetTokens 前端设计质量统一 skill 重叠。后续如需恢复某个入口，必须先通过项目级 skill admission gate：重复任务或失败模式、清晰触发语、具体执行步骤和可验证结果。

## 会话沉淀

本轮沉淀到 `.agents/skills/gettokens-codex-extensions-management/SKILL.md` 的复用模式：

1. 外部 Git skill 包安装到项目级 `.agents/skills/` 时，要同步写入机器可读 lock。
2. lock 必须包含 source URL、ref、resolved commit，以及 source path 到 local path 的安装清单。
3. 更新脚本默认只检查哈希，替换本地目录必须显式传 `--update`。
4. 文档与 memory 写回后执行 `qmd update` 与 `qmd embed`，确保后续可检索。
