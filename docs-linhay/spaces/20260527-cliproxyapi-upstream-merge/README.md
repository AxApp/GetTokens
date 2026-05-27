# CLIProxyAPI 上游更新合并

## 背景

`docs-linhay/references/CLIProxyAPI` 是 GetTokens release 构建 sidecar 的维护 fork，当前维护分支为 `gettokens/sidecar`。本轮用户要求处理 upstream 更新合并，但明确提醒 fork 已经离上游较远，不能直接相信上游分析或整包套用，需要先审核上游变更与 GetTokens 已落地能力的重叠关系。

本轮已先执行只读/低副作用探测：

- `git fetch --all --prune`
- `qmd query "CLIProxyAPI 上游 同步 fork 合并 upstream 已做 能力"`
- `git rev-list --left-right --count HEAD...upstream/main`
- `git log --cherry-pick --right-only --no-merges HEAD...upstream/main`
- `git merge-tree --write-tree HEAD upstream/main`

当前基线：

- fork 工作区：`docs-linhay/references/CLIProxyAPI`
- 当前分支：`gettokens/sidecar`
- 当前 HEAD：`c3907174`，相对 `origin/gettokens/sidecar@1c0f0031` ahead 1
- canonical upstream：`upstream/main@4b681031`
- merge base：`167edfec`
- 分叉计数：fork 侧 37 个提交，upstream 侧 7 个提交
- 预演结果：`git merge-tree --write-tree HEAD upstream/main` 可生成 tree `5e85c218`，暂未发现文本级硬冲突

## 目标

1. 把 `upstream/main@4b681031` 的有效更新合入 `gettokens/sidecar`，同时保留 GetTokens sidecar 的运行时能力。
2. 对每个上游更新先做语义审核，明确“直接接受 / 调整后接受 / 本地已覆盖 / 拒绝”的处理结论。
3. 合并后重建本机 sidecar，并让父仓库只呈现必要 gitlink、构建元信息、文档和 memory 变更。
4. 若审核发现上游架构与 GetTokens fork 侧长期补丁差距过大，暂停整包 merge，改走选择性 cherry-pick 或重新设计合并方案。

## 范围

- `docs-linhay/references/CLIProxyAPI#gettokens/sidecar`
- upstream commits：
  - `70a8cf02 fix: clean gemini cli request schemas`
  - `4a85b6b9 fix: log gemini cli schema cleanup errors`
  - `e399edd3 feat(images): add support for configurable GPT Image 2 base model and improved SSE handling`
  - `de280d99 feat(websockets): refine incremental repair logic for tool call responses`
  - `2cbb8c7b fix(translator): correct JSON path for item summary in response event`
  - `4b681031 feat(translator): add reasoning signature handling and tests for Claude-OpenAI conversions`
- GetTokens fork 侧必须保护的能力：
  - live sessions runtime feed、history、project name enrichment
  - channel routing before legacy strategy、active session count
  - account route guard、manual disabled、rate-limit guard、WebSocket hot switch
  - usage attribution ledger 与分页历史
  - system proxy egress
  - Codex WebSocket capability policy、pinned auth failover、wrapped status extraction
  - OpenAI root path / Responses compatibility paths

## 非目标

- 不借本轮重构 CLIProxyAPI 架构。
- 不把 upstream translator 变更拆成独立本地 translator 改造；它只能作为 broader upstream merge 的一部分进入。
- 不清理父仓库现有无关前端/文档改动。
- 不新增 GetTokens UI 功能，除非合并后 sidecar contract 必须同步。
- 不在未完成审核和测试前推送 fork 分支。

## 验收标准

### BDD 场景

1. 上游 Gemini CLI schema 清理合入后，Gemini CLI 请求中的 tool schema / response schema 可被清理，且 GetTokens channel routing、auth refresh、route guard 不受影响。
2. 上游 GPT Image 2 base model 和 SSE keepalive 合入后，`gpt-image-2-base-model` 可进入 config diff，Codex OAuth 图片代理仍走 GetTokens usage reporter 与 payload config。
3. 上游 WebSocket tool call repair 合入后，增量修复逻辑不破坏 GetTokens 的 pinned auth failover、full transcript replay、previous_response_id 清理边界。
4. 上游 Claude/OpenAI Responses reasoning signature 转换合入后，translator 测试通过，且 GetTokens 不引入全局 reasoning_content 注入这类已明确拒绝的兼容路径。
5. 合并产物可通过局部测试、`go test ./...`、`git diff --check`，并通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建本地 sidecar。
6. 父仓库记录 CLIProxyAPI gitlink、space 计划、memory 与必要构建元数据；不混入当前工作区无关改动。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-cliproxyapi-upstream-merge`
- worktree：`../GetTokens-worktrees/20260527-cliproxyapi-upstream-merge/`

## 相关链接

- 维护流程沉淀：`docs-linhay/dev/20260519-cliproxyapi-upstream-sync-session-distillation.md`
- 本轮计划：`docs-linhay/spaces/20260527-cliproxyapi-upstream-merge/plans/upstream-merge-plan-v01.md`

## 当前状态
- 状态：merged-and-verified
- 最近更新：2026-05-27
