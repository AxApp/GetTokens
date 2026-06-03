# Codex Payload Too Large / 413 修复

## 背景

2026-06-03 运行 Codex CLI 通过 GetTokens sidecar 调用 `http://127.0.0.1:8317/v1/responses` 时出现：

```text
unexpected status 413 Payload Too Large: Invalid request: request body too large: limit is 10485760 bytes
```

本地错误日志显示下游 Codex TUI 请求体约 `11,741,837` bytes，sidecar 转发到 Codex upstream 后收到 upstream `413`，错误码被归类为 `context_too_large`。

## 目标

- 避免大型但仍可被模型处理的 Codex Responses JSON 因 HTTP 请求体字节数超过 10 MiB 被 upstream 拒绝。
- 修复必须在 sidecar / CLIProxyAPI hot path 内闭环，不通过前端或 Wails 临时补偿。
- 保留现有 Responses 语义、路由和错误分类。

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

- 大于阈值的 Codex Responses upstream 请求会使用 `Content-Encoding: zstd` 压缩后发送。
- 小请求不额外压缩，避免影响普通请求链路。
- upstream 错误分类仍保留 `413 -> context_too_large` 兜底。
- 重建 sidecar 并让运行中的 GetTokens 使用新二进制。
- 修复后本地 `/v1/models` 可访问，sidecar 日志显示新进程继续处理 `/v1/responses`。

## 实现记录

- 在 `CodexExecutor.cacheHelper` 中增加大请求 zstd 压缩：当 translated Codex upstream JSON 大于 `9 MiB` 时，尝试 zstd 压缩；压缩后确实更小才设置 `Content-Encoding: zstd` 并以压缩 body 构造 upstream HTTP request。
- 新增回归测试 `TestCodexExecutorCompressesLargeResponsesPayloadBeforeUpstream`：用 `httptest` upstream 捕获请求，断言大 payload 带 `Content-Encoding: zstd`，并可成功解压回原始 JSON。
- 使用 `./scripts/ensure-sidecar.sh darwin arm64` 重建 sidecar，并复制到 `/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api`。
- 运行中的 sidecar 已重启，新进程：`/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens/config.yaml`。

## 验证记录

- `go test ./internal/runtime/executor -run TestCodexExecutorCompressesLargeResponsesPayloadBeforeUpstream -count=1`
- `go test ./internal/runtime/executor ./sdk/api/handlers/openai -count=1`
- `./scripts/ensure-sidecar.sh darwin arm64`
- `curl http://127.0.0.1:8317/v1/models -H 'Authorization: Bearer ...'` 返回模型列表。
- 重启后 `~/.config/gettokens/sidecar.log` 出现新的 `/v1/responses` 处理记录；18:47 后检索 API response 未再发现新的 `request body too large` upstream 响应。

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
- 状态：done
- 最近更新：2026-06-03
