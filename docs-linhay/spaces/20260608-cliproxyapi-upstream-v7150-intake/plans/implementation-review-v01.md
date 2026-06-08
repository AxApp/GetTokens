# CLIProxyAPI v7.1.50 Implementation Review v01

## Review 范围

- upstream：`router-for-me/CLIProxyAPI`
- 审核窗口：`v7.1.37..v7.1.50`
- tag 后补充：`main@c989cdd9 feat(plugin): add Codex Service Tier request normalizer plugin`
- 对照 fork：`docs-linhay/references/CLIProxyAPI#gettokens/sidecar@29f4f577`
- 结论口径：不做整包 merge；只按 GetTokens sidecar 边界重实现可接受能力。

## Findings

### P1. Responses WebSocket input 去重仍可能丢掉被 output 引用的 tool call

fork 当前 `dedupeResponsesWebsocketInputRaw` 对相同 `id` 只保留最后一个 item：

- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go:898`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go:909`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go:918`

upstream `e7f4dd47` 后的实现会先收集 `function_call_output/custom_tool_call_output` 引用的 `call_id`，再在重复 `id` 里优先保留仍被 output 引用的 call item，避免 upstream 报 `No tool call found for function call output`。

结论：接受，但只移植该 dedupe 算法和测试，不引入上游其他 WebSocket executor 改动。

建议子项：`20260608-cliproxyapi-codex-websocket-dedupe-referenced-call`

最小验收：

- 失败测试：相同 `id` 出现两个 function call，最后一个没有被 output 引用时，保留被 output 引用的那个。
- 保留现有“无 id item 不去重”“默认同 id 保留最后一个”行为。
- 跑 `go test ./sdk/api/handlers/openai`，再跑 Codex websocket focused tests。

### P1. xAI Responses 空 tools 后仍保留 tool_choice / parallel_tool_calls

fork 当前 `normalizeXAITools` 只过滤 unsupported tools；如果过滤后 `tools` 为空，`tool_choice` 和 `parallel_tool_calls` 仍可能留在 payload：

- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/xai_executor.go:663`

upstream `303685c2` 在 `normalizeXAITools` 后追加 `normalizeXAIToolChoiceForTools`，当 tools 缺失或为空时删除 `tools`、`tool_choice`、`parallel_tool_calls`。

结论：接受，低风险小补丁。

建议子项：可并入 `20260608-cliproxyapi-xai-gemini-model-compat`。

最小验收：

- 空 `tools: []` 删除三字段。
- 缺失 tools 时删除 orphan `tool_choice/parallel_tool_calls`。
- 有有效 tools 时保持 `tool_choice`。
- 跑 `go test ./internal/runtime/executor -run TestNormalizeXAIToolChoiceForTools -count=1`。

### P2. Gemini / Gemini CLI / Antigravity Claude translator 未处理 message-level system role

fork 当前 Claude -> Gemini 类 translator 只把 `assistant` 转为 `model`，message-level `system` 会原样进入 Gemini `contents.role=system`：

- `docs-linhay/references/CLIProxyAPI/internal/translator/gemini/claude/gemini_claude_request.go:71`
- `docs-linhay/references/CLIProxyAPI/internal/translator/gemini-cli/claude/gemini-cli_claude_request.go:77`

upstream `68282c4a` 把 message-level `system` 规范为 `user`，避免 Gemini role 非法。

结论：接受，但只改 Claude -> Gemini / Gemini CLI / Antigravity 三条 translator；不改 Codex system/developer 策略。

建议子项：并入 `20260608-cliproxyapi-xai-gemini-model-compat`。

最小验收：

- 三个 translator 各补一个 message-level system role 测试。
- 保持顶层 `system` 进入 `system_instruction` 的既有行为。

### P2. Codex 非流式 Chat Completions 转换会被 trailing empty items 覆盖

fork 当前 `ConvertCodexResponseToOpenAINonStream` 遍历 output 时，遇到 `summary_text` 或 `output_text` 会直接赋值并 `break` 当前 content 数组；如果后面有空文本 item，可能覆盖前面的非空结果：

- `docs-linhay/references/CLIProxyAPI/internal/translator/codex/openai/chat-completions/codex_openai_response.go:371`
- `docs-linhay/references/CLIProxyAPI/internal/translator/codex/openai/chat-completions/codex_openai_response.go:383`
- `docs-linhay/references/CLIProxyAPI/internal/translator/codex/openai/chat-completions/codex_openai_response.go:394`

upstream `0e3c809c` 改为只拼接非空文本，避免 trailing empty message / reasoning item 抹掉内容。

结论：接受，低风险小补丁。

建议子项：可单独放进 `20260608-cliproxyapi-codex-response-translation-hardening`，或并入 Codex replay/reasoning hardening 的第一个安全切片。

最小验收：

- 非流式 response output 同时有非空和空 `output_text` 时保留非空内容。
- reasoning summary 同理。

### P2. usage executor_type 可接受，但不能回退 GetTokens account identity 与 reasoning preservation

upstream `959067ed` 新增 `ExecutorType` 字段、`NewExecutorUsageReporter`，并要求所有 executor 调用点迁移。fork 当前 usage record 已有 GetTokens 的 `AccountKey`，且 `SetTranslatedReasoningEffort` 只在提取到非空 effort 时覆盖：

- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/usage_helpers.go:68`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/helps/usage_helpers.go:246`
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/usage/manager.go:17`

upstream 对 `SetTranslatedReasoningEffort` 是直接覆盖，若照搬会重新引入“空 translated payload 清掉 context reasoning”的旧问题。

结论：部分接受。只加 `ExecutorType` 字段与 reporter 构造方式；必须保留 `AccountKey`、非空 reasoning 覆盖、TTFT 去重逻辑和现有 usage payload 字段。

建议子项：`20260608-cliproxyapi-usage-refresh-executor-type`。

最小验收：

- usage record/payload 包含 `executor_type`。
- 仍包含 `account_key` 或至少不破坏 GetTokens usage attribution ledger 的账号归因。
- 空 translated reasoning payload 不清空已有 reasoning effort。
- `TrackHTTPClient` 不重复启动 TTFT。

### P2. usage refresh notification 可接受，但不能变成前端伪实时状态

upstream `f353979e` 增加：

- Redis queue 初始 `{"support_refresh":true}` 与后续 `{"refresh":true}`。
- watcher auth load/add/remove 后 `NotifyUsageRefresh()`。

fork 当前 Redis 协议只支持 `usage` channel：

- `docs-linhay/references/CLIProxyAPI/internal/api/redis_queue_protocol.go:17`
- `docs-linhay/references/CLIProxyAPI/internal/api/redis_queue_protocol.go:144`

结论：部分接受。刷新通知本身合理，但只作为 sidecar runtime 事件；前端或 Wails 不得把它解释成“usage 已刷新成功”。

最小验收：

- subscriber 首包 support refresh，不影响旧 LPOP/RPOP。
- auth watcher 变更发出 refresh marker。
- GetTokens live sessions / usage detail SQLite 不因 refresh marker 产生假数据。

### P2. auth Cloudflare/Home refresh 修复有价值，但 raw runtime removal / error events 不能照搬

可接受部分：

- `c9dc6bd6` Home refresh envelope 解析与“同一请求不重复尝试同一 Home auth”。
- `45f58d4f` / `77061aad` Cloudflare challenge 403 进入 quota-style backoff，而不是硬停账号。

不可直接接受部分：

- `55440f0a` 的 `Manager.Remove` 会从 runtime map 直接删除 auth；fork 当前删除路径会标记 disabled，并额外执行 GetTokens live session prune、Codex websocket close、executor ensure：
  - `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/service.go:358`
  - `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/service.go:372`
- `fd309448` 的 error event payload 只有 `auth_id/auth_index`，缺少 GetTokens 稳定 `account_key`；fork 当前 Redis 协议也只有 usage channel。

结论：拆两段。Cloudflare/Home 可重实现；runtime removal 与 error events 需要单独设计，不走 upstream 原形。

建议子项：

- `20260608-cliproxyapi-auth-cloudflare-home-refresh`
- `20260608-cliproxyapi-auth-runtime-events` 仅做方案，不直接实现。

最小验收：

- Cloudflare 403 不把账号永久禁用，只进入可解释 quota/backoff 状态。
- route guard / manual disabled / rate-limit guard 优先级不变。
- error event 若实现，必须包含 `account_key`、事件 schema、消费方和 retention 策略。

### P3. file-backed API request/response logging 可研究，不进第一批实现

fork 已有 file-backed websocket timeline。upstream `5753d1a0` 扩展到 API request / response source：

- `APIRequestSourceContextKey`
- `APIResponseSourceContextKey`
- streaming writer 支持 request/response source。

结论：暂缓。GetTokens 已有 live sessions history 和 usage detail SQLite；引入 request/response file-backed logging 前，先定义隐私、清理、磁盘上限和与现有历史表的边界。

建议子项：`20260608-cliproxyapi-logging-safemode-review`。

### P3. safemode example API key warning server 只适合 dev guard

upstream `bc38b689` 在 top-level `api-keys` 仍为模板值时不启动正常 API server，而启动 warning-only server。

结论：可研究但不默认移植。GetTokens dev 环境可能从 config 生成测试 key，不能因为模板匹配误阻断 sidecar；若接受，只能做 dev/safe-mode guard，并排除 Wails 管理态和测试 fixtures。

### P3. pluginhost / plugin API 大块能力不进入本轮实现

upstream `d625cadd` + `0ed85bb8` 新增 `internal/pluginhost/*`、`sdk/pluginapi/*`、management plugins API 和大量 examples，总计超过 2 万行增量。

结论：拒绝进入本轮代码。它需要产品决策：GetTokens 是否要让 CLIProxyAPI sidecar 运行 upstream pluginhost？它和现有 Codex Skills / MCP / session plugins 如何分层？没有这个答案前，只建 research space。

### P3. build / FreeBSD / release workflow 变更不适用

upstream `bc58c216`、`9ee64935`、`4f55ecca` 主要修改 GitHub release workflow、FreeBSD build、goreleaser。

结论：拒绝。本仓 sidecar 构建由父仓 `./scripts/ensure-sidecar.sh darwin arm64` 和 GetTokens release 流程控制，不跟 upstream FreeBSD release workflow。

### P3. 删除 GPT 5.2 / 5.3 Codex registry entries 不能照抄

upstream `87d813c5` 删除 GPT 5.2 / 5.3 Codex；fork 当前仍保留这些模型：

- `docs-linhay/references/CLIProxyAPI/internal/registry/models/models.json:1410`
- `docs-linhay/references/CLIProxyAPI/internal/registry/models/models.json:1551`
- `docs-linhay/references/CLIProxyAPI/internal/registry/models/models.json:1715`

结论：暂缓。模型删除必须走 GetTokens model catalog / requestable alignment 规则，不能只因 upstream 删除就下架。

## 推荐第一批实现

1. `20260608-cliproxyapi-codex-websocket-dedupe-referenced-call`
2. `20260608-cliproxyapi-xai-gemini-model-compat`
3. `20260608-cliproxyapi-codex-response-translation-hardening`
4. `20260608-cliproxyapi-usage-refresh-executor-type`
5. `20260608-cliproxyapi-auth-cloudflare-home-refresh`

## 暂不实现

- `codex reasoning replay cache`：先做方案，不能直接移植。
- `auth runtime removal / error events`：先补 account_key/schema/consumer 设计。
- `file-backed API request/response logging`：先定隐私和磁盘治理。
- `pluginhost`：只 research。
- `release workflow / FreeBSD build`：不纳入。

## 验证建议

每个实现子项至少满足：

- 先补失败测试。
- focused Go tests 覆盖 touched package。
- 涉及 shared runtime / auth / websocket 时追加 `go test ./...`。
- fork 内提交并推送后，父仓再更新 gitlink、space、memory。
- 若要交付本地 dev sidecar，执行 `./scripts/ensure-sidecar.sh darwin arm64` 并确认 meta clean。
