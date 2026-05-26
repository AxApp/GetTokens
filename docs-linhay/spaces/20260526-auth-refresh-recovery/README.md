# Auth Refresh Recovery

## 背景

用户反馈：账号卡先出现“异常”，但重启 app 后恢复正常。排查后确认，这不是前端误渲染，而是 sidecar 的 auth 运行态在 refresh 失败后留下了 `StatusError / Unavailable / StatusMessage`，成功 refresh 没有显式清掉这些标记。

## 目标

1. 固定这条恢复边界：refresh 成功后，auth 必须回到 `active`。
2. 把“重启后恢复”的现象解释为内存运行态被重建，而不是用户误操作。
3. 为后续同类排障留一个可检索的需求入口。

## 范围

1. sidecar `refreshAuth` 成功分支的状态回收。
2. 对应回归测试，覆盖先失败、后恢复的状态迁移。
3. 相关开发文档与记忆写回。

## 非目标

1. 不改账号卡视觉。
2. 不扩展新的运行态字段。
3. 不把这次修复上升为 repo-wide 通用状态机规则。

## 验收标准

1. 发生一次 refresh failure 后，再次 refresh 成功时，auth 状态恢复为 `active`。
2. `Unavailable`、`StatusMessage`、`LastError` 等失败标记被清空。
3. `go test ./sdk/cliproxy/auth` 通过。
4. 相关 dev / memory 已写回并可检索。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260526-auth-refresh-recovery`
- worktree：`../GetTokens-worktrees/20260526-auth-refresh-recovery/`

## 相关链接

- 代码修复：[conductor.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor.go:4235)
- 回归测试：[conductor_scheduler_refresh_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/conductor_scheduler_refresh_test.go:106)
- 技术边界：[20260519 Account Detail Runtime Observability Boundary](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260519-account-detail-runtime-observability-boundary.md:47)
- 记忆：[2026-05-26](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/memory/2026-05-26.md:3)

## 当前状态
- 状态：done
- 最近更新：2026-05-26
