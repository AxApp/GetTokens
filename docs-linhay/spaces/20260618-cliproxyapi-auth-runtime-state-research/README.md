# CLIProxyAPI v7.2.16 auth runtime state research

## 背景

CLIProxyAPI upstream v7.2.16 包含多项 auth / scheduler / config / home runtime 变化。这些变化与 GetTokens sidecar 自治层高度重叠：账号 SQLite、route guard、quota/rate-limit、project candidate pool、live sessions、usage attribution、home refresh 和 Wails 管理面都已经由 GetTokens 定义语义。本 space 只做研究分类，不进入实现。

## 目标

- 记录 upstream v7.2.16 auth/runtime 候选来源。
- 判断哪些必须延后到 GetTokens 领域设计，避免上游逻辑绕过本地热路径。
- 给后续重新进入实现定义 evidence gate。

## 范围

- upstream commits：`8e52c403`、`f85768ee`、`b5da0887`、`2a050dc9`、`7f026e1a`、`a4756ab7`、`b9d024af`、`8fad0d03`。
- 当前 GetTokens/fork 事实位置：`internal/gettokenshooks/**`、`internal/wailsapp/**`、`internal/cliproxyapi/**`、`app.go` / `app_types.go`、`internal/runtime/executor/helps/home_refresh.go`。
- 本轮输出：研究结论与重新进入条件。

## 非目标

- 不修改 fork auth / scheduler / config / home runtime 代码。
- 不接入 upstream pluginhost/pluginstore。
- 不重写 GetTokens 账号选择、route guard、rate-limit、quota guard、usage attribution 或 live sessions。
- 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

- 每个 upstream 候选有明确分类：defer / reject / independent-design。
- 给出重新进入实现前必须补齐的测试与验收条件。
- 文档和 memory 写回，通过 docs gate。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260618-cliproxyapi-auth-runtime-state-research`
- worktree：`../GetTokens-worktrees/20260618-cliproxyapi-auth-runtime-state-research/`

## 相关链接

- intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`
- 研究记录：`plans/auth-runtime-state-research-v01.md`

## 当前状态
- 状态：research-complete
- 最近更新：2026-06-18
