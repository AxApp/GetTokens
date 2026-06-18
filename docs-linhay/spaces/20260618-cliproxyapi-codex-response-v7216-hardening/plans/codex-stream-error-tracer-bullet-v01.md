# Codex stream error -> Claude SSE error Tracer Bullet

## 背景

v7.2.16 upstream 为 Codex -> Claude response translator 增加了 stream error 映射：Codex 可能直接返回 `data: {"type":"error", ...}`，Claude SSE 客户端期望看到 `event: error` 和 Claude error payload。当前 fork 的 `ConvertCodexResponseToClaude` 只处理 `response.*` 分支，缺少 `type=error` 的专用转换。

## 范围

- fork 代码：`docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go`
- fork 测试：`docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response_test.go`
- upstream 参考：v7.2.16 `TestConvertCodexResponseToClaude_StreamCyberPolicyError` 与 `TestConvertCodexResponseToClaude_StreamErrorTypeFallbackMessage`

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 Codex stream error -> Claude error tests |
| 当前代码事实 | fork stream converter 没有 `type=error` 分支 |
| 预期红灯 | cyber_policy / overloaded_error focused tests 初始缺 `event: error` |
| 红灯命令 | `go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude_Stream.*Error' -count=1` |
| 绿灯验收 | focused test、affected package test、full `go test ./... -count=1`、fork `git diff --check`、fork commit、clean sidecar rebuild |

## 实现记录

- 红灯结果：`expected Claude SSE error event, got: ""` 与 `missing error event payload: ""`。
- 实现：在 `ConvertCodexResponseToClaude` 中处理 `type=error`，输出 Claude SSE `event: error`；新增 `codexStreamErrorToClaudeError`，处理 `error.type`、顶层 `error_type`、`code`、`message` fallback，并把 `cyber_policy` / `invalid_request` 规范为 `invalid_request_error`。
- fork commit：`de947e0f fix(translator): map codex stream errors to claude`。
- sidecar rebuild fingerprint：`de947e0ff3954574ef9e830f15a681c4a2f4a209:clean:7e28b2eaf7d577b61f2ef7967bc20643784d3a7619dca7219c906f2b14465b22:darwin:arm64`。
- dev App：本切片只改 translator response 结构，不触碰 dev/prod App runtime；用自动化测试与 clean sidecar rebuild 验收。

## 验收命令

- `go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude_Stream.*Error' -count=1`
- `go test ./internal/translator/codex/claude -count=1`
- `git diff --check`
- `go test ./... -count=1`
- `git diff --cached --check`
- `./scripts/ensure-sidecar.sh darwin arm64`

## BDD 场景

1. Codex stream 返回 `error.code=cyber_policy` 或 `error.type=invalid_request` 时，Claude error type 必须规范成 `invalid_request_error`。
2. Codex stream error message 为空时，必须 fallback 到 code；code 也为空时 fallback 到 error type / error_type。
3. 输出必须是 Claude SSE `event: error`，payload 顶层 `type=error`。

## 非目标

- 不改 Codex WebSocket transport、compact response、pending tool call、route guard、failure budget 或 usage attribution。
- 不改账号、auth、scheduler、management API、Wails 或前端。
