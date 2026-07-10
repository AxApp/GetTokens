# Codex refresh token singleflight

## 背景

正式环境中 `rf5gqn9grh@privaterelay.appleid.com` 的 Codex Plus 账号卡片显示异常。只读诊断显示 `/backend-api/wham/usage` 额度正常，但 sidecar `quota-status` 同时返回 `blocked=true`、source=`auth-error`，`block_reason` 为 OpenAI OAuth `refresh_token_reused`。

2026-07-10 09:54:54 重新登录成功写入 account store；09:57:44 sidecar 重启/重载后出现一批并发 `gettoken` / `api-call`；09:57:45 连续 5 次 token refresh 失败为 `refresh_token_reused`。当前 `sdk/cliproxy/auth.Manager.refreshAuth` 会直接调用 executor refresh，没有 per-auth in-flight 去重。

## 目标

- 同一个 auth/account 的 OAuth refresh 在同一时间只允许一个执行器调用。
- 等待中的并发 refresh 在首个 refresh 更新状态后应重新读取当前 auth；若当前 auth 已不再需要刷新，则直接退出。
- 成功刷新后仍通过现有 `Update` / store / hook 路径持久化新 token。

## 范围

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth` 的刷新调度。
- Focused 回归测试覆盖并发 refresh 去重。

## 非目标

- 不修改正式版 `/Applications/GetTokens.app`、正式 sidecar、正式配置或正式 SQLite 数据。
- 不改 OpenAI OAuth 协议或手动清理用户正式账号状态。
- 不调整前端“auth-error blocked 显示异常”的现有语义。

## 验收标准

- [x] 新增测试先能在当前实现下复现并发刷新多次调用。
- [x] 修复后 focused 测试通过：同一 auth 的并发 refresh 只调用一次 executor。
- [x] 受影响 package 测试通过。
- [x] fork 全量 `go test ./... -count=1` 通过。
- [x] sidecar 从 clean fork commit 重建。
- [x] 父仓文档门禁和 diff 空白检查通过。

## 实现记录

- Red test：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth -run TestManager_RefreshAuthDeduplicatesConcurrentRefreshForAuth -count=1`，失败为 `Refresh calls = 5, want 1`。
- 实现：`sdk/cliproxy/auth.Manager` 增加 per-auth `refreshLocks`；`refreshAuth` 进入执行器前先按 auth id 串行化。等待者拿到锁后重新读取 auth 状态；若状态已被前一个 in-flight refresh 更新且当前 `shouldRefresh` 为 false，则跳过执行器调用。
- 回归测试：`TestManager_RefreshAuthDeduplicatesConcurrentRefreshForAuth` 覆盖 5 个并发 refresh 只触发 1 次 executor 调用，并确认新 `refresh_token` 被写入 manager 状态。
- fork commit：`2443e76f19bd0f8b9e1f221a3f75dce6698f8a89` (`Deduplicate concurrent auth refreshes`)。
- sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指纹为 `2443e76f19bd0f8b9e1f221a3f75dce6698f8a89:clean:329aff8470e7a1951682c630ade8ccb7ef9958d36a9af75c25745c8cdfdf8bd2:darwin:arm64`。

## 验证记录

- `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth -run TestManager_RefreshAuthDeduplicatesConcurrentRefreshForAuth -count=1`：先红后绿。
- `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth -run 'TestManager_RefreshAuth(DeduplicatesConcurrentRefreshForAuth|UnauthorizedFailureStopsAutoRefreshRetry|TerminalOAuthFailureStopsAutoRefreshRetry|InvalidRefreshTokenStopsAutoRefreshRetry|InvalidRefreshTokenNotifiesAuthUpdatedHook|SuccessClearsStaleUnauthorizedState)$' -count=1`：通过。
- `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth -count=1`：通过。
- `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -count=1`：通过。
- `git diff --check`（fork）：通过。
- `./scripts/ensure-sidecar.sh darwin arm64`：通过，clean rebuild。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260710-codex-refresh-token-singleflight`
- worktree：`../GetTokens-worktrees/20260710-codex-refresh-token-singleflight/`

## 相关链接

- memory：`docs-linhay/memory/2026-07-10.md`
- 代码位置：`docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go`
- 测试位置：`docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor_scheduler_refresh_test.go`

## 当前状态
- 状态：implemented
- 最近更新：2026-07-10
