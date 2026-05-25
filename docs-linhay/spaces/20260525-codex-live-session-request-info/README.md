# Codex Live Session Request Info

## 背景
`#frame=codex&workspace=live-sessions` 当前运行会话列表依赖 sidecar live snapshot。sidecar 运行态能提供 session / request / transport 等信息，但部分场景没有 `projectName`，列表只能显示未知项目；详情页 Timeline 也偏事件流，不能像请求监控页一样快速看到某次请求的关键标识、模型、账号、链路、耗时和 token 信息。

## 目标
1. `SessionRow` 显示项目名称时，若 live snapshot 缺少 `projectName`，由 CLIProxyAPI sidecar 按本地 Codex 会话信息反查并补齐后返回。
2. `SessionDetail` 的 Timeline 区域改为请求级具体信息视图，参考 `http://cpa.host.dxy/user/monitor` 的监控信息密度，优先显示可用于排查的请求字段。

## 范围
- Sidecar：CLIProxyAPI live session tracker 在生成 snapshot 时，对缺失项目名的 live session 做本地 `.codex` 会话反查补全，并通过 `projectName` 返回。
- Wails：`GetCodexLiveSessionsSnapshot` 只透传 sidecar snapshot，不保留兼容旧 sidecar 的本地反查层。
- 前端：`CodexLiveSessionDetail.tsx` 的 `Timeline` 从事件列表改为请求列表，展示 request id、client/upstream request id、model、auth、transport、status、timing、usage、error 与关键事件摘要。
- 测试：补充 sidecar 项目名补全回归、Wails 透传回归和前端源码/模型约束测试。

## 非目标
- 不兼容旧 sidecar；`projectName` 主来源在 CLIProxyAPI fork。
- 不展示请求 payload、headers、API key、cookie 或任何未脱敏敏感内容。
- 不新增请求控制、重试、取消等操作。

## 验收标准
1. Given sidecar live tracker 内的 live session 没有 `projectName`，但 `sessionID`、`executionSessionID`、`downstreamSessionID`、`codexWindowID` 或 Codex conversation id 能匹配本地 Codex JSONL；When 打开 live sessions 页面；Then 列表显示 sidecar 反查到的项目名。
2. Given sidecar 已经提供 `projectName`；When GetTokens 请求 live snapshot；Then Wails/root/frontend 保留 sidecar 原值并透传，不执行二次本地扫描覆盖。
3. Given 选中某个 live session；When 查看详情 Timeline；Then 页面展示请求级字段和关键事件摘要，而不是只展示 `lane.kind + label` 的事件行。
4. Given 请求包含 error 或 timing / usage；When 查看 Timeline；Then 能看到状态、错误、耗时、速率和 token 用量，且不展示 payload 或密钥。
5. 自动化验证至少覆盖 CLIProxyAPI fork 的 `go test ./internal/gettokenshooks -run LiveSessions`、GetTokens 的 `go test ./internal/wailsapp -run CodexLive`、`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`npm --prefix frontend run typecheck`。

## 验收记录

- 2026-05-25：已完成 sidecar 项目名补全、Wails 透传、详情请求时间线改造和浏览器预览验收。
- 截图：`screenshots/20260525/codex-live-sessions/20260525-codex-live-sessions-request-info-after-v01.png`
- 自动化验证：
  - `go test ./internal/wailsapp -run CodexLive`
  - `go test ./internal/gettokenshooks -run LiveSessions`（CLIProxyAPI fork）
  - `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
  - `npm --prefix frontend run typecheck`
- 2026-05-26：请求时间线行补出首 token 指标，和总耗时、TTFT 并排显示，紧凑宽度下仍保留可读的三枚时间标签。
- 截图：`screenshots/20260526/codex-live-sessions/20260526-codex-live-sessions-timeline-row-after-v01.png`
- 自动化验证：
  - `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
  - `npm --prefix frontend run typecheck`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260525-codex-live-session-request-info`
- worktree：`../GetTokens-worktrees/20260525-codex-live-session-request-info/`

## 相关链接
- 本地页面：`http://127.0.0.1:34115/#frame=codex&workspace=live-sessions`
- 参考监控页：`http://cpa.host.dxy/user/monitor`
- 目标组件：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionFeed.tsx`
- 目标组件：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-26
