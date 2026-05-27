# CLIProxyAPI 上游更新合并计划 v01

日期：2026-05-27

## 现状快照

- 父仓库当前有大量未提交改动，本轮不吸收无关变更。
- `docs-linhay/references/CLIProxyAPI` 工作区干净，当前在 `gettokens/sidecar`。
- 当前 HEAD：`c3907174 Optimize live session runtime feed`
- 远端维护分支：`origin/gettokens/sidecar@1c0f0031`，本地 ahead 1。
- upstream：`upstream/main@4b681031`，最新 tag 已到 `v7.1.23`。
- 分叉计数：`HEAD...upstream/main = 37 / 7`。
- `git merge-tree --write-tree HEAD upstream/main` 生成 `5e85c21886c14c6a2a41be2ffcf350f851881c68`，说明本轮暂时没有文本级硬冲突。
- merge 结果相对当前 HEAD 预计改动 14 个文件，约 `843 insertions / 146 deletions`。

## 上游变更审核矩阵

| upstream | 主题 | 初判 | 审核重点 |
| --- | --- | --- | --- |
| `70a8cf02` / `4a85b6b9` | Gemini CLI request schema cleanup | 倾向接受 | 确认 `cleanGeminiCLIRequestSchemas` 不改变非 schema 字段；补跑 executor 测试和 `go test ./internal/runtime/executor`。 |
| `e399edd3` | GPT Image 2 base model + image SSE handling | 调整后接受 | 检查 `GPTImage2BaseModel` 与 GetTokens config diff、payload config、usage reporter、Codex OAuth images 代理是否一致；SSE keepalive 不应吞掉上游错误。 |
| `de280d99` | Responses WebSocket tool call incremental repair | 高风险审核 | 与 GetTokens pinned auth failover、full transcript replay、`previous_response_id` 清理、wrapped status failover 直接相邻；必须补跑 OpenAI handler websocket tests。 |
| `2cbb8c7b` | OpenAI Responses item summary JSON path fix | 倾向接受 | 小修，但要确认不会影响 GetTokens 已有 Responses path rewrite。 |
| `4b681031` | Claude/OpenAI Responses reasoning signature handling | 谨慎接受 | 触碰 `internal/translator`；按 fork AGENTS，只作为 broader upstream merge 进入，不单独改 translator。确认不重新引入全局 `reasoning_content` 注入。 |

## 合并策略

1. 先保留当前 `gettokens/sidecar` 的本地 ahead 提交 `c3907174`，不回退、不 squash。
2. 在 fork 内创建临时审核分支或直接在干净 `gettokens/sidecar` 上执行 merge，但 merge 前记录 `merge-tree` 快照。
3. 优先整包 merge `upstream/main@4b681031`，因为文本冲突为零；合并后逐项审核上述 5 类语义风险。
4. 如果 merge 后测试暴露 GetTokens 关键能力退化，不继续堆补丁。先定位是 upstream 变更问题还是 fork 独有能力已经被上游覆盖：
   - 上游已经实现同等能力：删除或收敛 fork 重复补丁。
   - 上游实现方向不同但可兼容：在 merge commit 后追加最小适配提交。
   - 上游方向与 GetTokens 运行时约束冲突：回退 merge，改 cherry-pick 低风险 commits，并开第二版设计。
5. fork 内形成完整提交后，再回到父仓库更新 gitlink、sidecar meta、space、memory。

## 执行步骤

1. 红灯确认
   - `git -C docs-linhay/references/CLIProxyAPI status --short --branch`
   - `git -C docs-linhay/references/CLIProxyAPI log --cherry-pick --right-only --no-merges HEAD...upstream/main`
   - 记录当前测试基线，至少跑与冲突面最相关的 focused tests。

2. 合并
   - `git -C docs-linhay/references/CLIProxyAPI merge --no-ff upstream/main`
   - 若出现冲突，优先保护 GetTokens route guard、channel routing、live sessions、usage ledger、system proxy、Codex WebSocket policy。
   - 若无冲突，也要逐文件审核 `git diff HEAD^1..HEAD`，不能仅凭自动 merge 通过。

3. 局部验证
   - `go test ./internal/runtime/executor`
   - `go test ./internal/translator/claude/openai/responses ./internal/translator/openai/openai/responses`
   - `go test ./sdk/api/handlers/openai`
   - `go test ./internal/gettokenshooks ./internal/gettokensrouting ./sdk/cliproxy/auth`

4. 全量验证
   - `go test ./...`
   - `git diff --check`
   - `./scripts/ensure-sidecar.sh darwin arm64`

5. 父仓库收口
   - 确认 `docs-linhay/references/CLIProxyAPI` gitlink 前进到新的 merge commit。
   - 检查 `build/bin/cli-proxy-api.meta.json` 是否记录新 commit 且 dirty 为 `clean`。
   - 更新本 space 的执行记录和 `docs-linhay/memory/2026-05-27.md`。
   - 执行 `docs-linhay/scripts/check-docs.sh`、`qmd update`、`qmd embed`。

## 重点保护清单

- `internal/gettokenshooks/*`：实时快照、历史分页、usage attribution、route guard source。
- `internal/gettokensrouting/*`：channel routing source of truth 与 balanced active session count。
- `sdk/cliproxy/auth/*`：route policy、selector、scheduler、websocket policy。
- `sdk/api/handlers/openai/openai_responses_websocket.go`：request id、live session hook、pinned auth retry/failover、websocket capability。
- `sdk/api/handlers/openai/openai_responses_websocket_toolcall_repair.go`：`previous_response_id` 与 orphan tool output 的边界。
- `internal/runtime/executor/codex_websockets_executor.go`：auth 变化重握手、pre-payload quota failover。
- `internal/runtime/executor/codex_openai_images.go`：usage reporter、thinking、payload config。
- `config.example.yaml` / `internal/config/sdk_config.go` / `internal/watcher/diff/config_diff.go`：新增 config 字段必须可被热更新差异识别。

## 暂停条件

- `go test ./...` 出现与 GetTokens route guard、channel routing、usage ledger、live sessions 或 Codex WebSocket failover 相关的失败，且无法用小补丁解释。
- upstream translator 变更要求单独重写 `internal/translator`，超出 broader merge 语义。
- 自动 merge 删除或绕过 GetTokens hook 接入点。
- 需要改变父仓库 Wails DTO、frontend binding 或用户可见行为，但本 space 未包含对应需求。

## 交付物

- fork 内 merge commit 和必要适配 commit。
- 父仓库 CLIProxyAPI gitlink 更新。
- 本地 sidecar rebuild meta。
- 本 space 执行日志。
- memory 写回与 qmd 索引更新。

## 执行记录

### Subagent 审核

本轮按监督模式开出 4 个只读 subagent 审核：

1. 总体 upstream commit 审核：确认 upstream 侧 7 个提交中 6 个为内容提交，`b5959c31` 只是 PR merge commit；不建议 cherry-pick，整包 merge 更不容易漏掉 image/config/test 联动。
2. WebSocket / route guard 高风险审核：确认 `de280d99` 只影响 tool call repair 与对应测试，不覆盖 GetTokens handler 主流程、executor、auth route policy、channel routing 或 hooks；可整包接受。
3. Gemini / Images / Translator 兼容面审核：确认 Gemini schema cleanup 不扫全 payload；GPT Image 2 base model 不绕过 usage reporter / payload config；Claude/OpenAI reasoning signature 未重新引入全局 `reasoning_content` 注入。
4. 交叉兼容审核：补充指出 `gpt-image-2-base-model` 的 config diff 与 Codex image base model 行为需要测试锁定。

审核结论一致：允许整包 merge `upstream/main@4b681031`，但对 `de280d99` 和 `e399edd3` 做重点验证。

### 合并结果

- 创建临时审核分支：`merge/upstream-20260527`
- 合并提交：`57ab8229 Merge upstream/main into gettokens sidecar`
- 适配提交：`ef93d8c0 test: cover configurable codex image base model`
- 维护分支：`gettokens/sidecar`
- 远端推送：`origin/gettokens/sidecar` 已更新到 `ef93d8c0`
- 本地 sidecar：已通过 `./scripts/ensure-sidecar.sh darwin arm64` 重建，meta 为 `ef93d8c0:clean:38d316f7921dcdec1d5dc70aa8552a0b47f58b303455df4d0055b37bc821d276:darwin:arm64`

### 额外测试补强

根据 subagent 审核，merge 后新增两类回归断言：

1. `internal/watcher/diff/config_diff_test.go`
   - `TestBuildConfigChangeDetails_GPTImage2BaseModel`
   - 锁定 `gpt-image-2-base-model` 会进入热更新 diff 文案，并 trim 前后空白。
2. `internal/runtime/executor/codex_executor_imagegen_test.go`
   - `TestCodexOpenAIImageBodyUsesConfiguredBaseModel`
   - `TestCodexOpenAIImageBaseModelFallsBackWhenInvalid`
   - 锁定 Codex OpenAI image body 使用配置后的 GPT base model，并继续删除 `previous_response_id` / `stream_options`。

### 验证记录

合并前基线：

- `go test ./internal/runtime/executor`
- `go test ./internal/translator/claude/openai/responses ./internal/translator/openai/openai/responses`
- `go test ./sdk/api/handlers/openai`
- `go test ./internal/gettokenshooks ./internal/gettokensrouting ./sdk/cliproxy/auth`

合并后验证：

- `go test ./internal/runtime/executor`
- `go test ./internal/translator/claude/openai/responses ./internal/translator/openai/openai/responses`
- `go test ./sdk/api/handlers/openai`
- `go test ./internal/gettokenshooks ./internal/gettokensrouting ./sdk/cliproxy/auth`
- `go test ./sdk/api/handlers/openai -run 'Test(RepairResponsesWebsocketToolCalls|NormalizeResponsesWebsocketRequestWithPreviousResponseID|ResponsesWebsocketReleasesPinnedAuthAfterQuotaError|ResponsesWebsocketReleasesPinnedAuthAfterRouteGuardBlock|ResponsesWebsocketRequestBoundaryReleaseUsesRouteGuard|ResponsesWebsocketPinsOnlyWebsocketCapableAuth|ResponsesWebsocketCompaction|NormalizeSubsequentRequest)' -count=1`
- `go test ./internal/runtime/executor -run 'Test(BuildCodexWebsocketRequestBodyPreservesPreviousResponseID|CodexWebsocketsExecutePreservesPreviousResponseIDUpstream|CodexWebsocketsExecutionSessionRotatesUpstreamWhenAuthChanges|CodexWebsocketsUpstreamDisconnectChanSignalsOnInvalidate)' -count=1`
- `go test ./sdk/cliproxy/auth -run 'Test(SchedulerRoutePolicy|Legacy.*RoutePolicy|PickNextViaHome.*PinnedWebsocket)' -count=1`
- `go test ./internal/gettokenshooks -run 'Test(AccountRouteGuard|RateLimitEvaluator.*RouteGuard|ChannelRoutingRoutePolicy|LiveSessions.*Websocket|LiveSessionsActiveAuthCounts|LiveSessionsObserveUsageRecordUpdatesExistingWebsocketRequest)' -count=1`
- `go test ./internal/gettokensrouting -run 'Test(Engine|DecideChannelRoute)' -count=1`
- `go test ./internal/runtime/executor -run 'TestCleanGeminiCLIRequestSchemas|TestCodexExecutor|Test.*Image|Test.*Usage|Test.*Payload' -count=1`
- `go test ./sdk/api/handlers/openai -run 'Test.*Images|Test.*ResponsesStream|Test.*ResponsesWebsocket|TestRepairResponsesWebsocket' -count=1`
- `go test ./internal/watcher/diff -run 'TestBuildConfigChangeDetails' -count=1`
- `go test ./internal/runtime/executor/helps -run 'TestApplyPayloadConfigWithRequest|TestUsageReporter|TestParseCodexUsage' -count=1`
- `go test ./internal/runtime/executor -run 'TestCodexOpenAIImageBodyUsesConfiguredBaseModel|TestCodexOpenAIImageBaseModelFallsBackWhenInvalid|TestEnsureImageGenerationTool|TestCleanGeminiCLIRequestSchemas' -count=1`
- `go test ./internal/watcher/diff -run 'TestBuildConfigChangeDetails_GPTImage2BaseModel|TestBuildConfigChangeDetails' -count=1`
- `go test ./...`
- `git diff --check`
- `./scripts/ensure-sidecar.sh darwin arm64`

### 注意事项

- 曾有两个重复并发 push 因远端已经由另一条 push 更新到 `ef93d8c0` 而被 remote lock 拒绝；最终有效 push 已成功，`HEAD` 与 `refs/remotes/origin/gettokens/sidecar` 均为 `ef93d8c0`。
- 父仓库当前仍有大量无关未提交改动，本轮只应纳入 `docs-linhay/references/CLIProxyAPI` gitlink、此 space 与 memory 相关改动。
