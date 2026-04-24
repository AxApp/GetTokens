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

## 常用操作

1. 新建 `space`

```bash
docs-linhay/scripts/create-space.sh 20260424-login-refresh
```

2. 校验文档结构

```bash
docs-linhay/scripts/check-docs.sh
```

3. 记忆写回后更新索引

```bash
qmd update && qmd embed
```

## 命名规则

1. `space-key` 使用英文 slug，优先使用 `<YYYYMMDD>-<topic>` 或稳定功能名。
2. 禁止空格、中文、`latest`、`final`。
3. 截图和 debate 文件继续遵循 `AGENTS.md` 与 `gettokens-space-governance` 中的命名规则。

## 推荐使用顺序

1. 需求或范围变化：先更新对应 `spaces/<space-key>/README.md`
2. 技术设计或治理说明：写到 `dev/`
3. 决策、风险、里程碑：写到 `memory/`
4. 文档改动完成后：运行 `check-docs.sh`
5. memory 写回完成后：运行 `qmd update && qmd embed`
