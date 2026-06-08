# CLIProxyAPI Upstream v7.1.50 Intake

## 背景

GetTokens sidecar 维护分支已经不再按 CLIProxyAPI upstream 做合并式同步。按照 2026-06-01 之后的方案，上游只能作为参考输入：先审核 upstream tag delta，再把 GetTokens 可接受的能力拆成独立 `space`，在 `AxApp/CLIProxyAPI#gettokens/sidecar` 边界内重实现并补窄测试。

本轮只读探测结果：

- canonical upstream：`router-for-me/CLIProxyAPI`
- upstream `main`：`c989cdd9 feat(plugin): add Codex Service Tier request normalizer plugin`
- upstream 最新 tag：`v7.1.50@4f55ecca`
- 本地 fork 工作区：`docs-linhay/references/CLIProxyAPI`
- 本地维护分支：`gettokens/sidecar@29f4f577`
- 本地 fork 状态：相对 `origin/gettokens/sidecar` ahead 21
- 本地 remote 当前只配置了 `origin=https://github.com/AxApp/CLIProxyAPI.git`，没有 `upstream` remote；执行前需要恢复或临时确认 canonical upstream，避免把 fork 自己误当上游。
- 本地 tag 缓存目前到 `v7.1.37`；远端已有 `v7.1.38..v7.1.50`。

候选窗口从上次参考批次之后开始：

- 已有参考批次：`v7.1.29..v7.1.37`，对应 2026-06-01 的五个能力 space。
- 本轮 intake 窗口：`v7.1.38..v7.1.50`，外加 `main` 上 tag 之后的 `c989cdd9`。
- 本轮不直接 merge `v7.1.50`，也不 cherry-pick 大块 upstream commit。

## 目标

1. 建立一轮可执行的 CLIProxyAPI upstream intake space，承接 `v7.1.38..v7.1.50` 的审核和拆分。
2. 按“低风险可移植 / 需要 GetTokens 重新设计 / 拒绝或暂缓”对候选能力分类。
3. 对接受项逐个创建子 `space`，每个子项都有 BDD 场景、失败测试、最小实现、验证记录。
4. 保护 GetTokens sidecar 自治边界：账号 SQLite、route guard、rate-limit、live sessions、usage attribution、system proxy、Codex WebSocket 和多端 endpoint routing 不被 upstream 通用逻辑覆盖。
5. 让后续执行者可以按计划推进，不需要重新猜“上一轮方案”。

## 范围

- 总控审核：
  - `v7.1.38..v7.1.50` commit log、diff stat、热点文件和风险分级。
  - `main` tag 后 `c989cdd9` 的单独评估。
  - 子 `space` 拆分与执行顺序。
- 候选能力池：
  - usage / watcher / redisqueue 通知与 executor type tracking。
  - Codex Responses WebSocket input dedupe、reasoning replay、orphan tool call、empty message 处理。
  - Gemini / xAI / model registry 小型兼容修复。
  - auth runtime removal、Cloudflare challenge retry、auth error events。
  - file-backed logging、safe mode example API key warning。
  - pluginhost / plugin API / management API 大块能力的研究入口。
  - release workflow / FreeBSD build 变更的排除判断。
- 文档与记忆：
  - 本 space、计划文件、memory 写回。
  - 若后续实现产生稳定复用模式，再同步到项目级 skill；只有 repo-wide 长期规则才更新 `AGENTS.md`。

## 非目标

- 不做 CLIProxyAPI upstream 整包 merge。
- 不把 `v7.1.50` tag ancestry 强行合入 `gettokens/sidecar`。
- 不在本 space 内直接实现具体 upstream 能力。
- 不触碰正式版 `/Applications/GetTokens.app`、正式 sidecar、正式配置或正式进程。
- 不把 upstream 的 pluginhost、release workflow、example plugin 源码直接引入 GetTokens release 产物。
- 不用 Wails/frontend 临时补偿来伪造 sidecar 已处理的 runtime 状态。

## 验收标准

### BDD 场景

1. 给定 upstream tag 已到 `v7.1.50`，当执行 intake 时，先确认 canonical upstream 与当前 fork 状态，再形成候选能力清单，而不是直接执行 merge。
2. 给定候选能力触及 Codex WebSocket、usage attribution、auth routing 或账号选择，当评估是否接受时，必须先声明 GetTokens sidecar 自治边界和需要补的窄测试。
3. 给定某个候选能力低风险且可接受，当进入实现时，必须先新建独立子 `space`，写清 BDD、范围、非目标和验证命令，再进入 TDD。
4. 给定候选能力属于 pluginhost / release workflow 这类大块架构变化，当没有产品决策或 GetTokens 使用场景时，默认只做研究或拒绝，不进入混合实现。
5. 给定最终有子项落地，当 fork HEAD 变化时，必须先在 fork 内提交并推送，再由父仓记录 gitlink、space、memory 和必要构建元信息。

### 门禁

- `docs-linhay/references/CLIProxyAPI` 执行前必须确认 remote 与 branch；若缺少 `upstream` remote，先恢复或使用临时只读 clone 获取 upstream 信息。
- 每个接受项必须有 focused Go tests；涉及 shared runtime 时追加 `go test ./...`。
- 涉及本地运行态交付时，再执行 `./scripts/ensure-sidecar.sh darwin arm64`，确认 meta 为新 commit 且 `dirty=clean`。
- 父仓只提交本轮相关 space、memory、gitlink 和必要构建元数据，不混入当前工作区其他前端/文档改动。
- 本轮纯规划不运行 Go / Node 自动化测试；至少运行 `docs-linhay/scripts/check-docs.sh` 做结构自检。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260608-cliproxyapi-upstream-v7150-intake`
- worktree：`../GetTokens-worktrees/20260608-cliproxyapi-upstream-v7150-intake/`

## 相关链接

- 上一轮 reference port 沉淀：`docs-linhay/dev/20260601-cliproxyapi-tag-reference-port-session-distillation.md`
- 早期 upstream sync 沉淀：`docs-linhay/dev/20260519-cliproxyapi-upstream-sync-session-distillation.md`
- 2026-06-01 子项：
  - `docs-linhay/spaces/20260601-cliproxyapi-websocket-http-fallback/README.md`
  - `docs-linhay/spaces/20260601-cliproxyapi-responses-input-dedupe/README.md`
  - `docs-linhay/spaces/20260601-cliproxyapi-gemini-developer-role/README.md`
  - `docs-linhay/spaces/20260601-cliproxyapi-oauth-callback-hardening/README.md`
  - `docs-linhay/spaces/20260601-cliproxyapi-amp-model-registry/README.md`
- 本轮计划：`docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/plans/v7150-intake-plan-v01.md`
- 实现级 review：`docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/plans/implementation-review-v01.md`

## 当前状态
- 状态：implementation-reviewed
- 最近更新：2026-06-08
