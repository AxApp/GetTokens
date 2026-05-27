# Codex Live Session Controls

## 背景

Codex `live-sessions` 页面已经能看见运行中的会话、请求和耗时，但当前主要偏观测，缺少“直接控制”的入口。用户希望在这里补两类能力：

1. 对指定会话/请求指定切换账号。
2. 立即终止当前还活着的请求和连接，缓解卡顿。

重新评估后修正边界：浏览器里点选的 `ws_sess_7a91` 行来自 `localhost:5173` 的 browser preview/cache 数据，页面显示 `VERSION BROWSER` 与 `来源 CACHE`，并且没有 Wails binding。它不是 dev sidecar 的真实活跃会话，不能作为 kill 对象。

当前可验证事实：

1. `localhost:5173` 是前端 browser preview，页面内 `hasWails=false`。
2. dev sidecar `18317` 的 `/v0/management/gettokens/live-sessions` 返回 `activeSessions=0`。
3. 正式 sidecar `8317` 属于生产/正式 App，不作为本需求的止血或验证对象；后续只读观测也必须先确认用户同意。
4. CLIProxyAPI fork 当前已有 runtime optimization 方向的未提交改动：列表 row feed、详情 history 懒加载、projectName 后台补全、轮询日志降噪；但这不是账号切换或会话 kill 控制面。

## 目标

1. 明确这两个能力的业务边界和技术边界。
2. 判断哪些可以在 GetTokens 前端/UI 层推进，哪些必须先补 sidecar API。
3. 在不影响正式环境的前提下，给后续实现提供可落地的接口草案和验收标准。

## 范围

1. Codex live-sessions 页面上的账号指定切换入口设计。
2. Codex live-sessions 当前会话的 kill / stop / disconnect 能力评估。
3. 与现有 `codex-live-session-detail`、`codex-live-session-runtime-optimization` 的边界对齐。

## 非目标

1. 本期不直接改 sidecar 的 WebSocket 路由策略。
2. 本期不做请求重放或强制自动切号。
3. 本期不承诺已有接口就能精准终止单个活跃请求。
4. 不对正式 App / `8317` sidecar 做 stop、kill、restart 或清理类动作。

## 验收标准

1. 形成清晰的能力分层：`前端可做`、`需要新增 sidecar API`、`只能进程级停止`。
2. 对“指定账号切换”给出推荐落点和交互草案。
3. 对“kill 活跃请求/连接”给出可执行的后端能力草案。
4. 明确 browser preview/cache 行与真实 sidecar live session 的区别，避免误杀正式环境。
5. 结果可追溯，已写入 memory，并能被 qmd 检索。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260527-codex-live-session-controls`
- worktree：`../GetTokens-worktrees/20260527-codex-live-session-controls/`

## 相关链接

- [Codex 实时运行会话详情](../20260521-codex-live-session-detail/README.md)
- [Codex Live Session Runtime Optimization](../20260527-codex-live-session-runtime-optimization/README.md)

## 当前状态

- 状态：backlog
- 最近更新：2026-05-27
- 记录：本 space 仅记录后续需求与评估结论，本轮暂不进入实现。
