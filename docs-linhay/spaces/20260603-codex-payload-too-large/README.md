# Codex Payload Too Large / 413 定位

## 背景

2026-06-03 运行 Codex CLI 通过 GetTokens sidecar 调用 `http://127.0.0.1:8317/v1/responses` 时出现：

```text
unexpected status 413 Payload Too Large: Invalid request: request body too large: limit is 10485760 bytes
```

本地错误日志显示下游 Codex TUI 请求体约 `11,741,837` bytes，sidecar 转发到 Codex upstream 后收到 upstream `413`，错误码被归类为 `context_too_large`。

## 目标

- 定位 `413 Payload Too Large` 的真实发生层级。
- 明确 GetTokens sidecar 是否应承担修复边界。
- 若根因属于 Codex CLI / Codex upstream 的请求体限制或协议行为，不在 GetTokens 侧做隐式兼容 patch，只记录结论与规避建议。

## 范围

- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_executor.go`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_executor_payload_test.go`
- `build/bin/cli-proxy-api`
- `/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api`（本机运行态替换）

## 非目标

- 不改变 Codex CLI 下游请求格式。
- 不引入前端截断或 UI 层上下文裁剪。
- 不改变 token/context 语义；本次只处理 HTTP body byte limit。

## 验收标准

- 明确 413 来自 Codex upstream 的 HTTP body byte limit，而不是 GetTokens 本地 Gin server 主动拒绝。
- 不在 GetTokens sidecar 默认加入 `Content-Encoding: zstd` 或其他隐式 upstream 兼容 patch。
- 保留定位证据和风险说明，避免把上下游协议/限制问题错误归因给 GetTokens。
- 后续只有当证据表明 GetTokens 转发层引入了重复、放大、错误转换或本地 body limit，才进入 GetTokens 侧修复。

## 定位记录

- 错误日志显示 downstream 请求 `Content-Length: 11741837`，上游响应 `413`：`request body too large: limit is 10485760 bytes`。
- 该错误发生在 sidecar 转发到 Codex upstream 后，属于 upstream HTTP body byte limit；不是本地 `127.0.0.1:8317` handler 直接拒绝。
- 曾短暂验证过“sidecar 对大 upstream request 做 zstd 请求体压缩”的可行性，但该方案属于对 upstream 限制的隐式兜底，可能扩大兼容风险；按用户确认的边界，不作为 GetTokens 默认修复。

## 验证记录

- `go test ./internal/runtime/executor ./sdk/api/handlers/openai -count=1`
- `docs-linhay/scripts/check-docs.sh`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260603-codex-payload-too-large`
- worktree：`../GetTokens-worktrees/20260603-codex-payload-too-large/`
- 本次为紧急本地 hotfix，直接在主工作区处理，未创建独立 worktree。

## 相关链接

- 错误日志样例：`~/.config/gettokens/logs/error-v1-responses-2026-06-03T183907-4b24bc71.log`
- sidecar 源码：`docs-linhay/references/CLIProxyAPI/`

## 当前状态
- 状态：定位完成 / 不在 GetTokens 侧修复
- 最近更新：2026-06-03
