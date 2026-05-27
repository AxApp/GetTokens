# CLIProxyAPI 上游同步会话沉淀

日期：2026-05-19

## 背景

本轮处理 `docs-linhay/references/CLIProxyAPI` 上游同步：先从 `upstream/main` 合并到当时的维护分支 `gettokens/wham-token-fix`，解决系统代理相关冲突，提交 Codex WebSocket 路由修复，重建本地 sidecar，并同步父仓库 gitlink 与 memory。后续维护分支已统一收敛为 `gettokens/sidecar`。

会话中额外暴露出一个重复风险：fork 工作区出现未跟踪的 `server` Mach-O 可执行文件。它不是源码，也没有被历史跟踪，但会让 fork 状态持续显示 dirty，并进入 `ensure-sidecar.sh` 的源码指纹。

## 上游身份边界

`router-for-me/CLIProxyAPI` 是 GetTokens 期望持续追踪的 canonical upstream。后续判断“上游是否有新变化”、合并 upstream、对比 release tag 或排查是否偏离上游时，都以本地 remote `upstream` 指向的 `router-for-me/CLIProxyAPI` 为准。

`AxApp/CLIProxyAPI` 是 GetTokens 的维护 fork，用来承载 `gettokens/sidecar` 分支上的运行时补丁，并作为 CI / release 构建 sidecar 的源码来源。它不是理想上游，而是可控下游 fork。`linhay/CLIProxyAPI` 只保留为 legacy fork backup。

GitHub metadata 原先显示 `AxApp/CLIProxyAPI` 为 fork，`parent=linhay/CLIProxyAPI`、`source=router-for-me/CLIProxyAPI`。因此当时 GitHub 页面上的 “forked from linhay/CLIProxyAPI” 只代表直接 fork parent；GetTokens 的维护判断仍以 root source / 本地 `upstream` 的 `router-for-me/CLIProxyAPI` 为准。

已用 `gh` 探测直接重建同名 fork：

```bash
gh repo fork router-for-me/CLIProxyAPI --org AxApp --fork-name CLIProxyAPI --clone=false
```

结果为 `HTTP 403: Name already exists on this account`。这说明在 `AxApp/CLIProxyAPI` 已存在时，`gh repo fork` 不能把现有 fork 原地改挂到 `router-for-me/CLIProxyAPI`。若要改变 GitHub 页面显示的 fork parent，需要走 GitHub 侧 fork network 调整，例如支持介入 detach/recreate；这类操作会影响仓库身份、链接或 fork 关系，不能作为普通同步步骤执行。

实际处理采用“rename 旧仓库做备份，再重建同名 fork”的方式：

1. 将旧 `AxApp/CLIProxyAPI` 重命名为 `AxApp/CLIProxyAPI-legacy-20260519`。
2. 从 `router-for-me/CLIProxyAPI` 重新 fork 到 `AxApp/CLIProxyAPI`。
3. 恢复仓库描述、关闭 issues/wiki。
4. 将本地维护分支推回新 fork；当时分支名为 `gettokens/wham-token-fix`，后续已重命名为 `gettokens/sidecar`。
5. 验证新仓库 metadata 为 `parent=router-for-me/CLIProxyAPI`、`source=router-for-me/CLIProxyAPI`。
6. 验证新 fork `main` 与 upstream `main` 均为 `bb5ac40a674cac65549852af9ecfcd6355acb0bb`，维护分支提交为 `14bc6cb99fdc5c5885ecced7020a8894bc60260f`。

分支命名收敛：`gettokens/wham-token-fix` 起源于最早的 wham usage token 修复，但后续已承载系统代理、Codex WebSocket、usage hook 等 GetTokens sidecar 集成补丁。新维护入口统一改为 `gettokens/sidecar`；旧远端分支已从 active fork 删除，只保留历史文档中的事实记录。

## PR #3289 兼容性评估

针对 `router-for-me/CLIProxyAPI#3289`，本轮不整包合并。该 PR 同时包含 OpenAI root path 兼容、Responses tools 转换和全局 `reasoning_content` 注入，三者风险边界不同，不能作为一个补丁整体进入 GetTokens sidecar 分支。

已采纳的部分：

1. 通过 centralized ingress / NoRoute rewrite 处理 root path 兼容：`GET /models`、`GET|POST /responses`、`POST /responses/compact` 统一重写到既有 `/v1/*` handler，保留现有 middleware、鉴权、日志和处理链。
2. 在 generic Responses-to-Chat converter 中兼容 nested `tools[].function` 形态，同时跳过缺少 function name 的无效 tool，避免构造异常 chat tool。

明确不采纳的部分：

1. 不在 generic converter 里全局注入 `reasoning_content`。
2. provider 特有响应字段或展示兼容继续放在 provider normalizer / executor 层处理，例如既有 Kimi executor 模式。

落地提交为 `AxApp/CLIProxyAPI#gettokens/sidecar` 的 `5e87841b`：`fix: normalize codex responses compatibility paths`。验证通过 fork 内 `go test ./internal/api`、`go test ./internal/translator/openai/openai/responses`、`go test ./...`；随后通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建本地 sidecar，meta 记录 commit `5e87841b` 且 dirty 为 `clean`。

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

## Subagent 审核合并模式

当 fork 已经明显偏离 upstream，或用户明确要求 subagent 审核时，不直接相信上游 PR 说明，也不只看 `HEAD..upstream/main` 的整体 diff。该 diff 会把 GetTokens fork 独有目录显示成大面积删除，容易误判为上游要移除本地能力。

推荐拆成三类只读 subagent：

1. 总体 upstream commit 审核：用 `git log --cherry-pick --right-only --no-merges HEAD...upstream/main` 和每个 `git show` 判断真实变更，区分内容提交与 merge commit。
2. 高风险运行时审核：专盯 WebSocket、route guard、channel routing、live sessions、usage ledger、system proxy 等 GetTokens fork 运行时补丁。
3. 兼容面审核：专盯 Gemini / Images / translator / config diff / payload config 等 upstream 行为变化。

主控 agent 负责合并、集成、验证和最终判断；subagent 只输出接受 / 调整后接受 / 拒绝 / cherry-pick 建议。若 subagent 指出某个已接受 upstream 行为缺少直接测试，必须在 fork 内补窄回归测试后再关闭合并。例如本轮 `gpt-image-2-base-model` 合入后，补了 config diff 与 Codex image body 使用配置 base model 的测试。

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

## 2026-05-24 同步记录

本轮将 `docs-linhay/references/CLIProxyAPI#gettokens/sidecar` 从 `upstream/main@50d19e20`（`v7.1.20-1-g50d19e20`）合并到维护分支，生成 merge commit `1c5db246` 并推送到 `AxApp/CLIProxyAPI#gettokens/sidecar`。

冲突处理：

1. `internal/registry/model_definitions_test.go` 上游删除、本地保留；该文件仍覆盖 GetTokens 关心的 GPT-5.5 Codex 静态模型、xAI 内建模型和 catalog 校验，因此保留 fork 侧测试。
2. 合并后 `internal/runtime/executor` 两个 Antigravity credits 测试失败，根因是实现已跟随上游 `antigravityLoadCodeAssistBaseURL()` 默认使用 `https://cloudcode-pa.googleapis.com`，而测试仍断言旧 daily host。已把测试断言更新为 `antigravityBaseURLProd`。

验证：

1. `go test ./internal/registry`
2. `go test ./internal/runtime/executor`
3. `go test ./...`
4. `git -C docs-linhay/references/CLIProxyAPI diff --check`

本地 sidecar 已通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建，`build/bin/cli-proxy-api.meta.json` 记录 `commit=1c5db246`、`dirty=clean`、`goos=darwin`、`goarch=arm64`。

## 2026-05-26 同步记录

本轮将 `docs-linhay/references/CLIProxyAPI#gettokens/sidecar` 从 `upstream/main@50d19e20` 之后的最新上游合并到维护分支，生成 merge commit `b72ac277` 并推送到 `AxApp/CLIProxyAPI#gettokens/sidecar`。

上游新增内容包括 Codex model fetch 命令、request logging 文件落盘、home request logging request id、auth file websocket 字段解析与 patch。合并前本地维护分支已有未推送补丁 `b8754677`，本轮保留该补丁并一并推送。

冲突处理：

1. `sdk/api/handlers/openai/openai_responses_websocket.go` 与上游 file-backed websocket timeline 变更冲突；合并时保留上游 `websocketTimelineLog` / `FileBodySource` 结构。
2. 同一文件保留 GetTokens live-session hook、`RecordDownstreamWebsocketConnected/Disconnected/Request`、request id 注入、pinned auth retry/failover 与 wrapped status code 提取。
3. websocket capability 继续走 fork 侧 `coreauth.AuthAllowsWebsockets(auth)`，避免上游仅检查显式 `metadata/attributes.websockets` 后收窄 Codex API key 默认 websocket 路由能力。

验证：

1. `go test ./sdk/api/handlers/openai`
2. `go test ./internal/api/handlers/management ./internal/api/middleware ./internal/logging ./internal/runtime/executor ./sdk/api/handlers/openai`
3. `go test ./...`
4. `git diff --check`

本地 sidecar 已通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建，`build/bin/cli-proxy-api.meta.json` 记录 `commit=b72ac277`、`dirty=clean`、`goos=darwin`、`goarch=arm64`。该 meta 文件和二进制当前未被父仓库 git 跟踪，父仓库可见变更为 CLIProxyAPI gitlink 前进到 `b72ac277`。

## 2026-05-26 内存剪裁记录

本轮针对 sidecar RSS 偏高做了三类剪裁：

1. live sessions tracker 仍然保留最近 30 分钟窗口，但每个 session 只保留最近 50 条 request，并新增 `DELETE /v0/management/gettokens/live-sessions` 清理接口；`requestMap` 也跟着回收，避免单个长会话和索引一起无限增长。被内存裁掉的 request 会以完整 `LiveRequest` JSON 落到 `live-sessions-v1.sqlite`，并通过 `GET /v0/management/gettokens/live-sessions/history` 分页追溯；清理实时 snapshot 不删除磁盘历史。
2. legacy `internal/usage/logger_plugin.go` 不再把 request details 长驻内存，`Snapshot()` 只保留聚合字段；细粒度数据继续通过磁盘分页接口追溯，避免 12.8 万条 detail 常驻堆上。
3. legacy usage snapshot 文件切到 `usage-observed-v2.sqlite`，聚合快照继续落盘；首次启动若 v2 无数据但 `usage-observed-v1.sqlite` 存在，会读取 v1 聚合并回写 v2，避免升级后历史聚合归零。历史明细通过 `GET /v0/management/gettokens/usage-attribution/details` 继续追溯，不再依赖一次性回灌旧的巨大 payload JSON。

新增的磁盘读取接口包括：

1. `GET /v0/management/gettokens/live-sessions/history`：支持 `window / limit / offset / session_id`，用于追溯已被实时内存窗口裁掉的 live request。
2. `GET /v0/management/gettokens/usage-attribution/details`：支持 `window / limit / offset / account_key / attribution_key`，用于后续前端按页拉取明细而不是一次性把整坨数据抬进内存。

验证：

1. `go test ./internal/gettokenshooks ./internal/usage ./internal/cmd`
2. `go test ./...`
3. `git diff --check`

当前侧边车相关内存剪裁仍是可继续迭代的方向，后续若前端真要消费分页明细，再补对应 UI 和调用层。

## 2026-05-27 subagent 审核同步记录

本轮按监督模式处理 `upstream/main@4b681031` 合并。4 路只读 subagent 审核结论一致：整包 merge 可接受，重点验证 `de280d99` Responses WebSocket tool repair 与 `e399edd3` GPT Image 2 base model / SSE。

执行结果：

1. `gettokens/sidecar` 合并 upstream，生成 `57ab8229 Merge upstream/main into gettokens sidecar`。
2. 按 subagent 指出的测试缺口追加 `ef93d8c0 test: cover configurable codex image base model`，覆盖 `gpt-image-2-base-model` config diff 和 Codex image body 使用配置 base model / invalid fallback。
3. `origin/gettokens/sidecar` 已推送到 `ef93d8c0`，本地 sidecar 通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建，meta 为 `ef93d8c0:clean:38d316f7921dcdec1d5dc70aa8552a0b47f58b303455df4d0055b37bc821d276:darwin:arm64`。

验证：

1. 合并前 focused baseline。
2. 合并后 WebSocket failover / route guard / channel routing / image / config / payload focused tests。
3. `go test ./...`
4. `git diff --check`

沉淀结论：该流程属于 CLIProxyAPI fork 领域维护规则，已补入 `gettokens-domain-engineering`；不升级 `AGENTS.md`。
