# Claude web_search domain sanitizer tracer bullet

## 证据矩阵

| 项目 | 证据 |
| --- | --- |
| 问题来源 | upstream v7.2.16 `internal/runtime/executor/claude_executor.go` 新增 `sanitizeClaudeWebSearchDomains`；对应测试 `TestSanitizeClaudeWebSearchDomains*`。 |
| 当前 fork 事实位置 | `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/claude_executor.go` 当前没有 `sanitizeClaudeWebSearchDomains`，`Execute` / `ExecuteStream` 的 `bodyForUpstream` 会保留 built-in `web_search_*` tool 上的空 domain 数组。 |
| 可复现缺失 | 对 `{"type":"web_search_20250305","blocked_domains":[]}` 这类 litellm/兼容客户端 payload，fork 没有在发往 Anthropic 前删除空数组；上游注释说明 Anthropic 会拒绝“空 domain list ambiguous”。 |
| 红灯测试 | `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/runtime/executor -run 'TestSanitizeClaudeWebSearchDomains' -count=1 -timeout 60s`，预期先因 `sanitizeClaudeWebSearchDomains` 未定义失败。 |
| 验收路径 | focused tests 通过；`go test ./internal/runtime/executor -run 'Test(SanitizeClaudeWebSearchDomains|ApplyClaudeToolPrefix)'` 通过；直接 package 测试可运行则记录结果；fork diff-check；fork commit；sidecar clean rebuild。 |
| 非目标 | 不引入 upstream `internal/signature` 大改；不改变 tool prefix / OAuth tool rename 策略；不改变 usage reporter 或账号路由。 |

## 实现决策

- 接入：仅删除 built-in `web_search_*` tool 中空的 `allowed_domains` / `blocked_domains` 字段。
- 保留：非 web_search tool 的同名字段、非空 domain 数组、其他 tool 字段如 `max_uses`。
- 调用点：在 Claude `Execute` / `ExecuteStream` 生成最终 `bodyForUpstream` 后、记录请求与发送上游前执行。
- fork commit：`d9d9c6a2 fix(claude): sanitize empty web search domains`。

## 验证记录

- 红灯：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/runtime/executor -run 'TestSanitizeClaudeWebSearchDomains' -count=1 -timeout 60s` 初始失败，`sanitizeClaudeWebSearchDomains` 未定义。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/runtime/executor -run 'TestSanitizeClaudeWebSearchDomains' -count=1 -timeout 60s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/runtime/executor -run 'Test(SanitizeClaudeWebSearchDomains|ApplyClaudeToolPrefix)' -count=1 -timeout 60s`
- 直接 package 测试限制：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/runtime/executor -count=1 -timeout 180s` 在当前 sandbox 失败于既有 `TestAIStudioExecutorExecuteStartsTTFTBeforeRelayWait` 的 `httptest.NewServer` 监听限制：`listen tcp6 [::1]:0: bind: operation not permitted`，不是本切片失败。
- fork `git diff --check`：通过。
- sidecar rebuild：`GOCACHE=/private/tmp/gettokens-go-build-cache ./scripts/ensure-sidecar.sh darwin arm64` 通过；第一次未带 `GOCACHE` 时被默认 Go cache 写入权限阻断，改用 `/private/tmp/gettokens-go-build-cache` 后成功。构建期间 Go module stat cache 写入 home 被 sandbox 拒绝为 warning，未阻断二进制生成。
- sidecar meta fingerprint：`d9d9c6a2450562fcd5d3508972282cb928c99215:clean:6d320244d2e7dc98bf8e3112e527ad5a7bc47bc50f5c14167e9611166e3d1fdf:darwin:arm64`。
- sidecar sha256：`989fe66c50afb9866b62da02d58f22b4bc31717ab01c9f5f55f4eb6a11c2b7a6`。
- 正式版未触碰：`/Applications/GetTokens.app` 时间戳保持 `Jun  7 11:08:33 2026`。

## 延后项

- XAI WebSocket executor：新增运行态 executor 与 repeated response id / store / prompt_cache_key / compact warmup 等行为，涉及 GetTokens WebSocket 热路径所有权，延后到产品策略。
- XAI compact/reasoning/tool_choice normalize：上游 diff 混合 compact endpoint、reasoning text normalization、tool_choice 归一化与 usage reporter 改动，需单独拆分证据。
- Antigravity executor/version：上游 diff 涉及 UA/version 获取、grounding URL、signature/home kv、route model 等运行态策略，延后到 Antigravity 产品场景明确后。
