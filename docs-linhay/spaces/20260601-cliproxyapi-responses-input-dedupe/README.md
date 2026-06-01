# CLIProxyAPI Responses Input Dedupe

## 背景
CLIProxyAPI 上游 `v7.1.30` 增加了 Responses WebSocket input item 按 `id` 去重，避免 compaction/replay 后重复的 function call 或 message item 污染后续请求。GetTokens 的 Codex WebSocket 热切会触发 transcript replay，因此该修复适合按本地边界移植。

## 目标
在 Responses WebSocket 请求标准化和 tool-call repair 后，按 input item `id` 保留最后一次出现的 item，避免旧 call 状态覆盖新 call 状态。

## 范围
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
- `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`

## 非目标
- 不改变 `previous_response_id` 是否允许增量输入的判断。
- 不改变 GetTokens request-boundary pinned auth release 与 full transcript replay 边界。
- 不对没有 `id` 的 input item 做额外去重。

## 验收标准
- 先补失败测试：合并 last request / last output / next input 后，重复 `id` 只保留最后一个。
- tool-call repair 之后再执行一次顶层 input 去重。
- 没有 `id` 的 item 原样保留。
- 相关 WebSocket normalization 测试通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260601-cliproxyapi-responses-input-dedupe`
- worktree：`../GetTokens-worktrees/20260601-cliproxyapi-responses-input-dedupe/`

## 相关链接
- 实现文件：
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/api/handlers/openai/openai_responses_websocket_test.go`

## 验证记录
- `go test -count=1 ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/translator/gemini/openai/responses ./internal/api/handlers/management ./internal/api/modules/amp ./internal/registry`
- `go test ./...`

## 当前状态
- 状态：done
- 最近更新：2026-06-01
