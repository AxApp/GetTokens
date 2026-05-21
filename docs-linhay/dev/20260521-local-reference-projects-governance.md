# 本地参考项目治理

日期：2026-05-21

## 背景

Claude Code 后续每个能力块都需要技术调研，调研会依赖 GitHub 项目和本地参考项目。完整外部源码如果直接进入 GetTokens 主仓库，会带来仓库体积、许可证、历史污染和搜索噪音问题。

## 决策

1. `docs-linhay/references/` 保留为参考资料目录，但完整源码型参考项目默认不进 git。
2. `.gitignore` 忽略 `docs-linhay/references/*/`，只允许根部 Markdown 索引和调研摘要进入 git。
3. 本地可以继续保留 `cc-switch`、`CLIProxyAPI`、`Cli-Proxy-API-Management-Center`、`cherry-studio`、`codex` 等参考项目用于检索和源码阅读。
4. 技术结论必须写回到对应 `space/plans/` 或 `docs-linhay/references/*.md`，不能只停留在本地源码目录。
5. 既有已跟踪参考项目视为历史遗留，本次不做 `git rm --cached` 批量清理，避免把参考项目治理和 Claude Code 需求调研混成一个大变更。

## 操作规则

- 新增参考项目：克隆到 `docs-linhay/references/<project>/` 或仓库外路径，源码目录不提交。
- 引用参考项目：在调研文档中记录项目名、URL、本地路径和使用到的文件/模块。
- 需要长期保留的结论：写入 `docs-linhay/spaces/<space-key>/plans/`。
- 需要跨需求复用的治理规则：再同步到 `AGENTS.md` 或项目 skill。

## 验收

- `docs-linhay/references/README.md` 作为当前参考项目索引。
- `.gitignore` 已保护后续新增本地参考项目目录。
- 文档结构校验使用 `docs-linhay/scripts/check-docs.sh`。
