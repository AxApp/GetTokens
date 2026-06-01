# CLIProxyAPI WebSocket HTTP Fallback

## 背景
CLIProxyAPI 上游 `v7.1.32` 修复了 Codex Responses WebSocket 在首选 WebSocket auth 失败后 fallback 到 HTTP auth 时，`generate` 字段继续泄漏到 HTTP 请求的问题。GetTokens sidecar 已有 WebSocket pinned auth、route guard 与 fallback 热路径，需要按本地边界重新实现该行为。

## 目标
当下游 WebSocket 请求先尝试 WebSocket auth、再 fallback 到 HTTP auth 时，仅 HTTP fallback 请求移除 `generate` 字段；原始 WebSocket 尝试仍保持客户端 payload。

## 范围
- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
- WebSocket fallback 相关单元测试
- 必要的窄测试夹具

## 非目标
- 不合并 CLIProxyAPI 上游整包。
- 不改变 GetTokens route guard、rate-limit admission、usage attribution 或 pinned auth release 语义。
- 不移除客户端 payload 的其他未知字段。

## 验收标准
- 先补失败测试：WebSocket auth 收到原始 `generate`，HTTP fallback auth 收到已移除 `generate` 的 payload。
- 仅当 `cliproxyexecutor.DownstreamWebsocket(ctx)` 且目标 auth 不支持 websockets 时移除 `generate`。
- 所有已有 WebSocket pinned auth / route guard 相关测试继续通过。
- 代码改动不触碰账号 SQLite、quota guard、live sessions 或前端。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260601-cliproxyapi-websocket-http-fallback`
- worktree：`../GetTokens-worktrees/20260601-cliproxyapi-websocket-http-fallback/`

## 相关链接
- 实现文件：
  - `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
  - `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor_websocket_http_fallback_test.go`

## 验证记录
- `go test -count=1 ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/translator/gemini/openai/responses ./internal/api/handlers/management ./internal/api/modules/amp ./internal/registry`
- `go test ./...`

## 当前状态
- 状态：done
- 最近更新：2026-06-01
