# CLIProxyAPI v7.1.50 Intake Plan v01

## 执行原则

本轮沿用 2026-06-01 后的 reference port 方案：

1. 不做 upstream merge-style sync。
2. 不按 commit 原样 cherry-pick 大块变更。
3. 先审核 tag delta，再按 GetTokens 需要拆成能力子项。
4. 一个接受能力一个子 `space`；子项内按 BDD/TDD 实现。
5. 主控负责边界、集成、验证、文档和最终完成判断；实现可交给 subagent，但不能省略主控验收。

## Phase 0：Intake 准备

1. 保护当前工作区：
   - 父仓：`git status --short --branch`
   - fork：`git -C docs-linhay/references/CLIProxyAPI status --short --branch`
2. 恢复或临时确认 upstream：
   - canonical upstream：`https://github.com/router-for-me/CLIProxyAPI.git`
   - 若要修改 fork remote，先记录当前 `remote.origin.*`，再添加 `upstream`。
   - 若只做审核，可继续使用 `/tmp` 临时 clone，避免污染 fork refs。
3. 获取真实窗口：
   - upstream latest tag：`v7.1.50@4f55ecca`
   - upstream main：`c989cdd9`
   - audit window：`v7.1.37..v7.1.50`
   - post-tag window：`v7.1.50..main`
4. 生成审核材料：
   - `git log --oneline --no-merges v7.1.37..v7.1.50`
   - `git diff --stat v7.1.37..v7.1.50`
   - `git diff --name-only v7.1.37..v7.1.50`
   - 按热点文件标注 GetTokens 冲突面。

## Phase 1：低风险候选优先

### 1A. usage refresh / executor type tracking

上游相关提交：

- `959067ed feat(usage): introduce executor type tracking in usage reporting`
- `f353979e feat(watcher, redisqueue): add usage refresh notification support`

初步判断：可接受候选，但必须重新贴合 GetTokens usage attribution ledger 和 live session projection。

建议子 space：

- `20260608-cliproxyapi-usage-refresh-executor-type`

验收门禁：

- usage record 新字段不会破坏现有 Redis queue payload、SQLite detail paging、legacy usage snapshot。
- watcher refresh event 不触发前端伪状态；只作为 sidecar runtime 事实源。
- focused tests 覆盖 `internal/runtime/executor/helps`、`internal/redisqueue`、`internal/watcher`、GetTokens usage hooks。

### 1B. small translator / model compatibility

上游相关提交：

- `303685c2 fix(executor/xai): drop orphaned tool_choice when Claude tools array is empty`
- `68282c4a fix(translator): normalize message-level system roles for Gemini`
- `bf04a242 feat(models): add support for grok-composer-2.5-fast model`
- `87d813c5 chore(models): remove legacy GPT 5.2 and GPT 5.3 Codex entries from registry`

初步判断：可拆成小子项。模型删除需要先和 GetTokens model catalog / requestable alignment 对齐，不默认照删。

建议子 space：

- `20260608-cliproxyapi-xai-gemini-model-compat`

验收门禁：

- xAI `tool_choice` 修复有失败测试，且不影响非 Claude tools。
- Gemini message-level system role 只修 translator，不改 Codex system/developer 策略。
- 模型 registry 变更先列出影响 GetTokens catalog 的可见项；删除类变更默认暂缓。

## Phase 2：Codex Responses / reasoning 热路径

上游相关提交：

- `e7f4dd47 fix(openai): keep referenced tool call when deduping websocket input IDs`
- `f05d68d4 refactor(openai): parse dedupe input item metadata in a single pass`
- `603a08fc feat(codex): cache reasoning replay items`
- `0e3c809c fix(codex): handle non-empty reasoning and content items, add test for trailing empty messages`
- `17af0891 fix(codex): avoid replaying orphan tool calls`
- `c989cdd9 feat(plugin): add Codex Service Tier request normalizer plugin`

初步判断：高价值但高风险。必须独立设计，不能直接抄 upstream executor。

建议子 space：

- `20260608-cliproxyapi-codex-replay-reasoning-hardening`

验收门禁：

- 覆盖 GetTokens Codex WebSocket pinned auth failover、full transcript replay、previous_response_id 清理、wrapped status extraction。
- reasoning replay cache 不扩大内存驻留；需要说明 TTL / size / cleanup。
- service tier normalizer 若接受，应先判断 GetTokens 已有 `service_tier` usage extraction 和 config source，避免重复插件化。
- 必跑 focused tests：`sdk/api/handlers/openai`、`internal/runtime/executor`、`internal/runtime/executor/helps`、`internal/gettokenshooks`、`internal/gettokensrouting`、`sdk/cliproxy/auth`。

## Phase 3：Auth runtime / error events

上游相关提交：

- `c9dc6bd6 Fix Home auth refresh retry handling`
- `45f58d4f fix(auth): retry and backoff cloudflare challenge 403 errors`
- `77061aad refactor(auth): simplify and narrow cloudflare challenge checks`
- `55440f0a feat(auth): add runtime auth removal and unscheduling logic`
- `fd309448 feat(auth): add error event publishing and Redis queue integration`

初步判断：必须单独设计。它直接碰账号生命周期、调度、错误事件和 Redis queue，与 GetTokens SQLite 账号事实源、route guard、manual disabled、rate-limit guard 有重叠。

建议子 space：

- `20260608-cliproxyapi-auth-runtime-events`

验收门禁：

- 先画清楚 upstream auth state 与 GetTokens account store / runtime snapshot / route guard 的关系。
- runtime removal 不能绕过 GetTokens manual disabled、quota guard、project candidate pool。
- error event publishing 必须有稳定 schema，并说明前端/日志/queue 谁消费；没有消费侧则只保留 sidecar telemetry。
- Cloudflare retry/backoff 不得造成账号池热路径阻塞或无限重试。

## Phase 4：Logging / safemode

上游相关提交：

- `5753d1a0 feat(logging): enable file-backed request/response sources for enhanced API logging`
- `bc38b689 feat(safemode): implement example API key warning server and related functionality`

初步判断：可研究，默认暂缓实现。GetTokens 已有 live sessions 和 usage detail SQLite，不能让 file-backed logging 变成第二套未经治理的明细存储。

建议子 space：

- `20260608-cliproxyapi-logging-safemode-review`

验收门禁：

- 先说明与 GetTokens live session history、usage detail paging、request logging 的边界。
- example API key warning 若接受，必须只作为 dev/safe-mode guard，不影响正式请求路径。

## Phase 5：Pluginhost 大块架构

上游相关提交：

- `d625cadd feat(pluginhost): add capabilities for command-line flag handling and plugin execution`
- `0ed85bb8 feat(pluginhost): refactor and enhance plugin system with new execution and thinking capabilities`
- 涉及 `internal/pluginhost/*`、`sdk/pluginabi/*`、`sdk/pluginapi/*`、management plugins API、examples/plugin 大量源码。

初步判断：不进入本轮实现。先建研究 space，除非用户明确要把 CLIProxyAPI pluginhost 纳入 GetTokens sidecar 插件体系。

建议子 space：

- `20260608-cliproxyapi-pluginhost-research`

验收门禁：

- 必须先回答：GetTokens 是否需要运行 upstream pluginhost？它和现有 Codex Skills / MCP / session plugins 的关系是什么？
- 不能把 examples/plugin 大量源码直接提交进父仓文档参考目录。
- 不能把 pluginhost management API 暴露给 GetTokens 前端，除非权限、安全、配置和生命周期方案完整。

## Phase 6：Build / release workflow

上游相关提交：

- `bc58c216 chore(build): update dependencies, enhance cross-compilation, and refactor workflows`
- `9ee64935 chore(build): remove goreleaser configuration and refactor release workflow`
- `3dedf478` 到 `4f55ecca` 的 FreeBSD / release workflow 调整。

初步判断：默认拒绝或记录为 upstream-only。GetTokens 通过父仓 `./scripts/ensure-sidecar.sh darwin arm64` 和 release 流水线管理 sidecar，不跟 upstream FreeBSD release workflow。

门禁：

- 只有当 GetTokens release CI 需要对应改动时，才单独开 release governance space。
- 不把 upstream release workflow 混进功能子项。

## 推荐执行顺序

1. 先建并执行 `usage-refresh-executor-type`，它价值明确、范围较窄。
2. 再做 `xai-gemini-model-compat`，把小兼容修复清掉。
3. 第三做 `codex-replay-reasoning-hardening`，因为它影响最核心 Codex WebSocket 路径，需要最多测试。
4. 第四做 `auth-runtime-events`，先设计再实现。
5. `logging-safemode-review` 和 `pluginhost-research` 只研究，不进入本轮代码。
6. build / release workflow 暂不处理。

## DoD

- 每个接受项都有独立子 space 和计划。
- 每个实现项都有失败测试、实现提交、focused tests、必要时 `go test ./...`。
- fork 内提交和推送先完成，再回父仓更新 gitlink、space、memory。
- 若重建本地 sidecar，必须确认 meta commit 与 fork HEAD 一致且 dirty clean。
- 最终运行 `docs-linhay/scripts/check-docs.sh`，并写回当天 memory。
