# Codex web_search_call 回译 Claude server tool blocks Tracer Bullet

## 背景

当前 fork 已有 Claude typed web_search 请求映射到 Codex `web_search` 的 request 侧逻辑，但 response 侧缺少上游 v7.2.16 新增的 `web_search_call` 回译。若 Codex 返回 `web_search_call`，Claude 兼容消费者需要看到 `server_tool_use` 和 `web_search_tool_result` blocks，而不是丢失 server tool 语义。

## 范围

- fork 代码目录：`docs-linhay/references/CLIProxyAPI/internal/translator/codex/claude/`
- 预期新增/修改：
  - `codex_claude_response.go`
  - `codex_claude_response_web_search.go`
  - `codex_claude_response_test.go`
- upstream 参考：v7.2.16 `codex_claude_response_web_search.go` 与相关 focused tests。

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 Codex web_search_call -> Claude server tool blocks |
| 当前代码事实 | fork request 侧已映射 typed web_search；response 侧缺 `codex_claude_response_web_search.go` 和 `web_search_call` 分支 |
| 预期红灯 | stream / non-stream `web_search_call` 不输出 `server_tool_use` 与 `web_search_tool_result` |
| 红灯命令 | `go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude.*WebSearch' -count=1` |
| 绿灯验收 | focused web_search tests、affected package test、full `go test ./... -count=1`、fork `git diff --check`、fork commit、clean sidecar rebuild |

## 实现记录

- 红灯结果：stream output 缺 `"type":"server_tool_use"`；non-stream content 缺 `server_tool_use`。
- 实现：新增 `codex_claude_response_web_search.go`，为 streaming `response.output_item.done item.type=web_search_call` 输出 Claude `server_tool_use` 与 `web_search_tool_result` blocks；non-stream `response.output[].type=web_search_call` 追加对应 content blocks，并对同 id 的空 `open_page` / populated `search` 做去重。
- fork commit：`7cc308d0 fix(translator): emit claude web search blocks`。
- sidecar rebuild fingerprint：`7cc308d01a0316972f69eeedb0c59d56f3f00e1e:clean:3a7da4886ce1407e366ee7ae5699c810963ffc4b80c1a48431b56b6c7ac82173:darwin:arm64`。
- dev App：本切片只改 translator response 结构，不改 Wails binding、native runtime、sidecar process lifecycle、management API、route guard、usage attribution 或 live sessions；按 AGENTS 第 26 条，本轮不启动真实 dev App。

## 验收命令

- `go test ./internal/translator/codex/claude -run 'TestConvertCodexResponseToClaude.*WebSearch' -count=1`
- `go test ./internal/translator/codex/claude -count=1`
- `git diff --check`
- `go test ./... -count=1`
- `git diff --cached --check`
- `./scripts/ensure-sidecar.sh darwin arm64`

## BDD 场景

1. 给定 Claude typed web_search 原始请求和 Codex streaming `web_search_call` output item，当输出 item done 带 search query 时，Claude SSE 必须出现 `server_tool_use`，随后出现 `web_search_tool_result`。
2. 给定 streaming added 阶段没有 id，但后续 completed/done 带 item id 时，结果 block 的 `tool_use_id` 必须复用后续可用 id，且只输出一组 server tool blocks。
3. 给定 non-stream completed response output 含 `web_search_call` 与 message text，Claude response content 必须包含 `server_tool_use`、`web_search_tool_result` 和 text。
4. 给定 non-stream response 同一 id 先出现空 `open_page`、后出现 populated search query，只保留 populated search item，不重复输出空结果。

## 非目标

- 不改 Codex WebSocket transport、compact response、route guard、usage attribution、live sessions 或 failure budget。
- 不改账号选择、auth refresh、management API、Wails 或前端。
- 不实现 Antigravity Google grounding 回译；那是另一个更大切片。
