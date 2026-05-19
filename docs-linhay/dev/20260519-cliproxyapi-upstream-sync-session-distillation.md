# CLIProxyAPI 上游同步会话沉淀

日期：2026-05-19

## 背景

本轮处理 `docs-linhay/references/CLIProxyAPI` 上游同步：从 `upstream/main` 合并到维护分支 `gettokens/wham-token-fix`，解决系统代理相关冲突，提交 Codex WebSocket 路由修复，重建本地 sidecar，并同步父仓库 gitlink 与 memory。

会话中额外暴露出一个重复风险：fork 工作区出现未跟踪的 `server` Mach-O 可执行文件。它不是源码，也没有被历史跟踪，但会让 fork 状态持续显示 dirty，并进入 `ensure-sidecar.sh` 的源码指纹。

## 沉淀模式

后续遇到 CLIProxyAPI fork 上游同步，按以下顺序收口：

1. 在 fork 内检查状态：`git status --short --branch`、`remote -v`、`log --left-right HEAD...upstream/main`。
2. 若有本地未提交源码补丁，先判断归属；必要时 stash，完成 upstream merge 后恢复。
3. 解决冲突时优先保留 GetTokens 运行时约束，例如 `use-system-proxy` 覆盖、proxy priority、Codex WebSocket 选择语义。
4. 先跑局部测试，再跑 `go test ./...`；如果上游合并引入测试编译缺口，在 fork 合并提交内修正。
5. fork 内先提交：上游 merge、必要修复、后续本地补丁。
6. 每次 fork HEAD 变化后，重跑 `./scripts/ensure-sidecar.sh darwin arm64`。
7. 父仓库只提交 gitlink、必要 docs/memory、必要构建产物；不要把无关前端/文档改动混入。
8. 写回 memory，执行 `qmd update`、`qmd embed`，并用 `qmd query` 抽查可检索性。

## 构建产物判断

未跟踪文件不要凭文件名直接提交。先执行：

```bash
ls -lh <path>
file <path>
git ls-files <path>
git log --all --oneline -- <path>
git check-ignore -v <path>
```

判断规则：

- 体积较大的 Mach-O / ELF / PE 可执行文件，且没有历史跟踪记录，默认是本地构建产物。
- 这类文件不进入 fork 提交，也不进入父仓库 gitlink提交之外的 staged set。
- 如果它反复污染状态，优先在 fork `.gitignore` 增加窄规则，例如 `server`，再提交该忽略规则。
- 不要用全局粗规则掩盖真实源码或配置文件。

## 不纳入内容

- 本轮具体上游功能列表不沉淀为规则，只保留在 git 历史和 memory 中。
- `server` 文件本体不归档、不提交。
- 不把该流程升级到 `AGENTS.md`；它属于 CLIProxyAPI fork 领域维护流程，已沉淀到 `gettokens-domain-engineering` skill。
