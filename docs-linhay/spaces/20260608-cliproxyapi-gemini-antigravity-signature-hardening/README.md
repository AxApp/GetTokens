# CLIProxyAPI Gemini Antigravity Signature Hardening

## 背景

`20260608-cliproxyapi-upstream-v7150-intake` 对 canonical upstream `router-for-me/CLIProxyAPI@v7.1.53` 做完增量 review 后，确认只有 `v7.1.51` 的 translator hardening 适合进入 GetTokens sidecar fork。本轮不合并 upstream tag，不 cherry-pick 大块提交，只按 GetTokens sidecar 边界重实现可接受行为。

当前 fork：`docs-linhay/references/CLIProxyAPI@gettokens/sidecar@649d00d3`。

上游参考：`v7.1.51@ec672446` 及 `365415c8` 中的 Codex Gemini request fallback。

## 目标

1. Gemini -> Claude streaming 正确处理 signature-only thinking chunk，不生成空 text block 或未打开 block 的 stop。
2. Gemini -> Claude streaming 在 finish metadata 缺少 `candidatesTokenCount` 但存在 `thoughtsTokenCount` 时仍发出 final `message_delta`。
3. Antigravity -> Claude streaming 支持没有 `thought: true` 但携带 `thoughtSignature` / `thought_signature` 的 signature-only chunk。
4. Antigravity -> Claude non-streaming 支持没有 `thought: true` 但携带 signature-only thinking carrier 的响应。
5. Codex Gemini request translator 支持 camelCase `systemInstruction.parts` fallback。

## 范围

- 修改 `docs-linhay/references/CLIProxyAPI` fork 内 translator 相关文件。
- 新增 focused Go tests，先红灯后实现。
- 父仓只更新本 space、memory、CLIProxyAPI gitlink 和必要 sidecar 构建元信息。

## 非目标

- 不合并 upstream `v7.1.53`。
- 不引入 upstream service tier plugin example。
- 不合入 Linux release workflow、Docker `ca-certificates`、README sponsorship。
- 不改变 GetTokens route guard、account routing、usage attribution 或 sidecar management API。

## 验收标准

- `go test ./internal/translator/gemini/claude ./internal/translator/antigravity/claude ./internal/translator/codex/gemini -count=1` 通过。
- 若 focused tests 通过且 fork 无其它进行中风险，运行 `go test ./... -count=1`。
- 通过父仓 `./scripts/ensure-sidecar.sh darwin arm64` 重建 dev sidecar。
- 使用 `GETTOKENS_APP_PROFILE=dev` 的真实 dev App 做手点验收，确认 dev sidecar `/healthz` 正常，截图归档到本 space。

## 证据矩阵

| 候选 | 当前事实位置 | 缺失证明 | 验收路径 |
| --- | --- | --- | --- |
| Gemini signature-only streaming | `internal/translator/gemini/claude/gemini_claude_response.go` 只在 `text` + `thought` 路径处理 thinking，没有读取 `thoughtSignature` / `thought_signature` | signature-only part 会因为 `text` 存在但 `thought` 为 false 或没有文本而被当作普通文本/空块处理，缺少 `signature_delta` | 新增 streaming 测试断言输出包含 `signature_delta`，不包含 text block start，不包含 unopened stop |
| Gemini final event fallback | 同文件 final events 依赖 `usageMetadata.candidatesTokenCount` 存在 | 只有 `thoughtsTokenCount` 的 finish chunk 不会发出 `message_delta` | 新增两段流测试：先 thinking 内容，再 finish + thoughtsTokenCount，断言 `message_delta` 与 `message_stop` |
| Antigravity signature without `thought` | `internal/translator/antigravity/claude/antigravity_claude_response.go` streaming 签名处理在 `part.Get("thought").Bool()` 内 | signature-only carrier 缺少 `thought` 时不会缓存签名，也不会发 `signature_delta` | 新增 streaming 测试：先 thinking text，再 signature-only chunk without `thought` |
| Antigravity non-stream signature without `thought` | 同文件 non-stream 只在 `isThought` 为 true 时读取 `thoughtSignature` / `thought_signature` | non-stream signature-only carrier 会被忽略，thinking block 缺少 signature | 新增 non-stream 测试断言 thinking block signature 存在 |
| Codex Gemini `systemInstruction` fallback | `internal/translator/codex/gemini/codex_gemini_request.go` 只读取 `system_instruction.parts` | camelCase Gemini request 丢失 developer message | 新增 request translator 测试断言 developer message 写入 |

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260608-cliproxyapi-gemini-antigravity-signature-hardening`
- worktree：`../GetTokens-worktrees/20260608-cliproxyapi-gemini-antigravity-signature-hardening/`

## 相关链接

- intake plan：`docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/plans/v7153-incremental-intake-plan-v01.md`
- fork commit：`docs-linhay/references/CLIProxyAPI@gettokens/sidecar@54107735`

## 实施记录

- Gemini -> Claude streaming 增加 `thoughtSignature` / `thought_signature` carrier 分支：signature-only chunk 只在已打开 thinking block 时输出 `signature_delta`，不再生成空 text block；finish + `thoughtsTokenCount` 可发出一次 final `message_delta`。
- Antigravity -> Claude streaming 支持无 `thought:true` 的 signature carrier，并继续缓存 signature 到前序 thinking text。
- Antigravity -> Claude non-streaming 支持无 `thought:true` 的 signature-only part，为 thinking block 补 signature。
- Codex Gemini request translator 在 `system_instruction.parts` 缺失时 fallback 到 `systemInstruction.parts`；snake_case 旧行为保留。

## 验收记录

- 红灯测试：
  - `go test ./internal/translator/gemini/claude -run 'TestConvertGeminiResponseToClaude_(SignatureOnlyPart|FinalEventsWithThoughtsTokenOnly)' -count=1` 按预期失败。
  - `go test ./internal/translator/antigravity/claude -run 'TestConvertAntigravityResponseToClaude(_SignatureOnlyChunkWithoutThoughtFlag|NonStream_SignatureOnlyPartWithoutThoughtFlag)' -count=1` 按预期失败。
  - `go test ./internal/translator/codex/gemini -run TestConvertGeminiRequestToCodexSystemInstructionCamelCase -count=1` 按预期失败。
- 绿灯与回归：
  - `go test ./internal/translator/gemini/claude ./internal/translator/antigravity/claude ./internal/translator/codex/gemini -count=1` 通过。
  - `go test ./... -count=1` 在 `docs-linhay/references/CLIProxyAPI` 通过。
  - `git diff --check` 在 `docs-linhay/references/CLIProxyAPI` 通过。
- sidecar rebuild：
  - `./scripts/ensure-sidecar.sh darwin arm64` 通过。
  - `build/bin/cli-proxy-api.meta.json` 指向 `54107735:clean:72f993a714629f729bc6d4e17a28b9c01e8f20fc93c031209fc4ddb386959264:darwin:arm64`。
- 真实 dev App 验收：
  - 启动方式：`GETTOKENS_APP_PROFILE=dev ./scripts/wails-cli.sh dev`。
  - dev App 进程：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`。
  - dev sidecar 进程：`build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`。
  - dev `/healthz`：`http://127.0.0.1:18317/healthz` 返回 `{"status":"ok"}`。
  - 正式版未触碰确认：正式版仍为 `/Applications/GetTokens.app/Contents/MacOS/GetTokens`，正式 sidecar 仍使用 `/Users/linhey/.config/gettokens/config.yaml`；本轮未 kill、重启或替换正式版。
  - 截图：`docs-linhay/spaces/20260608-cliproxyapi-gemini-antigravity-signature-hardening/screenshots/20260608/dev-app/20260608-dev-app-sidecar-after-v01.png`，已遮挡账号身份。
  - 验收后已退出 Wails dev，会话结束后仅剩正式版进程。

## 当前状态
- 状态：implemented
- 最近更新：2026-06-08
