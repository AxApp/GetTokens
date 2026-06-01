# CLIProxyAPI OAuth Callback Hardening

## 背景
CLIProxyAPI 上游 `v7.1.31` 增加 OAuth callback 写入时自动创建缺失 auth-dir，并在持久化失败时记录错误。GetTokens 桌面 OAuth bridge 依赖 sidecar 管理接口，缺失目录时应由 sidecar 自愈。

## 目标
OAuth callback 文件写入前确保 `auth-dir` 存在；写入失败时保留现有 API 错误响应，并记录可排查日志。

## 范围
- `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/oauth_sessions.go`
- `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/oauth_callback.go`
- 对应 management 单元测试

## 非目标
- 不重做 OAuth 协议和桌面桥接流程。
- 不改变 callback 文件格式、pending session 校验或 provider 白名单。
- 不改 Wails/root OAuth 调用。

## 验收标准
- 先补失败测试：`auth-dir` 不存在时，pending OAuth callback 能写入 `.oauth-<provider>-<state>.oauth`。
- 覆盖当前支持 callback 文件写入的 provider。
- 非 pending session 仍返回现有 conflict 语义。
- 写入失败日志不泄露 token 或完整 redirect secret。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260601-cliproxyapi-oauth-callback-hardening`
- worktree：`../GetTokens-worktrees/20260601-cliproxyapi-oauth-callback-hardening/`

## 相关链接
- 实现文件：
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/oauth_callback.go`
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/oauth_sessions.go`
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/oauth_callback_test.go`

## 验证记录
- `go test -count=1 ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/translator/gemini/openai/responses ./internal/api/handlers/management ./internal/api/modules/amp ./internal/registry`
- `go test ./...`

## 当前状态
- 状态：done
- 最近更新：2026-06-01
