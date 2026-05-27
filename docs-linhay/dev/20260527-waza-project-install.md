# Waza 项目级安装记录

## 安装范围

本次将 `tw93/Waza` 仓库中的 8 个直接 coding skills 安装到项目级目录 `.agents/skills/`，并同步共享 `rules/` 到 `.agents/rules/`，用于 GetTokens 仓库内的 Codex project skills 发现与相对引用解析。

来源：

- GitHub: `https://github.com/tw93/Waza.git`
- 分支：`main`
- 当前版本：`3.26.0`
- 固定 commit：`24e207c87daf7123e5e7ce22bf81bcb69bfa3e9e`
- 本地锁文件：`.agents/skills/waza.lock.json`

## 已安装 Skill

| 本地目录 | skill name |
| --- | --- |
| `.agents/skills/think` | `think` |
| `.agents/skills/design` | `design` |
| `.agents/skills/check` | `check` |
| `.agents/skills/hunt` | `hunt` |
| `.agents/skills/write` | `write` |
| `.agents/skills/learn` | `learn` |
| `.agents/skills/read` | `read` |
| `.agents/skills/health` | `health` |

## 共享规则

| 本地目录 | source |
| --- | --- |
| `.agents/rules` | `rules/` |

## 后续更新流程

推荐使用项目脚本检查或更新：

```bash
docs-linhay/scripts/update-waza-skill.sh --check
docs-linhay/scripts/update-waza-skill.sh --update
```

脚本默认只检查远端 `main` 的最新 commit；只有传入 `--update` 时，才会按 `.agents/skills/waza.lock.json` 的安装清单替换本地 skill 目录、同步共享 `rules/`，并更新 lock 文件中的 commit 和版本号。

手动流程如下：

1. 查询远端最新哈希：

   ```bash
   git ls-remote https://github.com/tw93/Waza.git HEAD refs/heads/main
   ```

2. 对比 `.agents/skills/waza.lock.json` 中的 `source.commit` 与 `source.version`。
3. 若需要更新，先在临时目录拉取新版本并审阅 `skills/*/SKILL.md` 与 `rules/*` 的变更，再替换对应 `.agents/skills/<name>/` 与 `.agents/rules/` 目录。
4. 更新 `.agents/skills/waza.lock.json` 的 commit、version 和安装清单。
5. 运行 `docs-linhay/scripts/check-docs.sh`、`qmd update`、`qmd embed`。

## 注意事项

Waza 的 `/think`、`/check`、`/hunt` 等 skills 是通用工程能力，适合与 GetTokens 的领域 skills 并存，但后续若发现 skill discovery 预算压力或命名冲突，再评估是否缩减到高频子集。
