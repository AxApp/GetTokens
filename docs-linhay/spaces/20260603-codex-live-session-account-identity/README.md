# Codex live session account identity filtering

## 背景
运行会话列表 `#frame=codex&workspace=live-sessions` 出现已经删除或已经禁用的账号。现场排查确认，sidecar live-session tracker 记录的是请求发生时的 runtime `authID`，而统一账号池当前身份是 `acct_* accountKey`。账号迁移、删除或禁用后，live-session snapshot 仍可能保留旧 runtime auth 行，导致用户误以为这些账号仍在参与当前路由。

之前已处理过的边界是“禁用账号不能继续参与路由，必要时关闭 Codex WebSocket 上游会话”；本轮处理的是运行会话列表的账号身份归并与展示过滤。

## 目标
1. live-session 请求记录同时携带 `accountKey`，让运行会话能关联统一账号池身份。
2. sidecar `GET /v0/management/gettokens/live-sessions` 默认过滤已脱离当前 runtime inventory 或已禁用的账号行。
3. 保留诊断能力：`include_detached=true` 可返回 detached/disabled 行，并标记 `authDetached/authDisabled`。
4. Wails DTO、前端模型和诊断摘要同步 `accountKey`，避免前端基于旧 `authID` 猜测账号状态。

## 范围
- CLIProxyAPI fork reference / sidecar hot path：
  - `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/live_sessions.go`
  - `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_executor.go`
  - `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
- GetTokens Wails DTO / 前端模型：
  - `internal/wailsapp/codex_live_sessions.go`
  - `app_codex_live_sessions.go`
  - `frontend/src/features/codex-live-sessions/model/*`
  - `frontend/wailsjs/go/models.ts`
- 回归测试：live-session snapshot 过滤、Wails DTO 透传、前端 adapter / diagnostic。

## 非目标
- 不改变账号选择、rate-limit、route guard 的路由决策逻辑。
- 不删除 live-session history 磁盘历史。
- 不在前端伪造 sidecar 已处理状态；账号过滤由 sidecar snapshot 出口完成。
- 不做移动端验收。

## 验收标准
1. 默认 `GET /v0/management/gettokens/live-sessions` 不返回当前 runtime inventory 中不存在的 `authID/accountKey` 行。
2. 默认 snapshot 不返回当前 runtime inventory 中 `Disabled=true` 或 `StatusDisabled` 的账号行。
3. `GET /v0/management/gettokens/live-sessions?include_detached=true` 返回诊断全集，并对脱离账号标记 `authDetached=true`，对禁用账号标记 `authDisabled=true`。
4. 新的 Codex HTTP / WebSocket live request 记录包含 `accountKey`。
5. Wails 和前端模型保留 `accountKey/authDetached/authDisabled`，诊断摘要输出 `account_key`。
6. 定向测试通过；若 sidecar reference 不能在主 module 直接测试，需说明原因，并在真正 sidecar fork 或构建产物中完成验证。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（主工作区短修，未创建独立分支）`
- worktree：`（未创建；当天可闭环小范围改动）`

## 相关链接
- 相关历史：`docs-linhay/spaces/20260531-bug-fix/README.md` Bug 006 账号激活/禁用路由语义
- 领域规则：`.agents/skills/gettokens-domain-engineering/SKILL.md`

## 验证记录
- 2026-06-03：已复现本机发布版 sidecar 的默认 live-session snapshot 仍返回旧 runtime `authID` 行；这些行缺少 `accountKey`，无法与当前 `acct_*` 账号池身份归并。
- 2026-06-03：新增前端和 Wails DTO 定向测试，修复后通过：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`go test ./internal/wailsapp -run 'TestGetCodexLiveSessionsSnapshotReadsSidecarManagementAPI|TestGetCodexLiveSessionHistoryReadsSidecarManagementAPI'`。
- 2026-06-03：`go test ./docs-linhay/references/CLIProxyAPI/internal/gettokenshooks ...` 在主仓失败，原因是 `docs-linhay/references/CLIProxyAPI` 是独立 fork reference，不属于当前 `github.com/linhay/gettokens` Go module；需要在 sidecar fork/module 内补跑。
- 2026-06-03：在 sidecar fork module 内补跑通过：`go test ./internal/gettokenshooks -run 'TestLiveSessionsRouteReturnsWebsocketRequestSnapshot|TestLiveSessionsRouteFiltersDetachedAndDisabledRuntimeAccounts|TestLiveSessionsObserveUsageRecordCreatesHTTPCompletedSession'`、`go test ./internal/runtime/executor -run 'TestCodex'`。
- 2026-06-03：`scripts/ensure-sidecar.sh darwin arm64` 确认 `build/bin/cli-proxy-api` 已匹配当前 dirty 指纹；临时配置启动 `127.0.0.1:18317` 后，`GET /v0/management/gettokens/live-sessions` 与 `?include_detached=true` 均返回 200，`source=live`、`sidecarReady=true`。
- 2026-06-03：未直接替换或重启用户当前 `/Applications/GetTokens.app`，因此发布版 App 内正在运行的旧 sidecar 仍可能显示旧 snapshot；需在后续 App 重启/打包后做真实桌面验收。

## 当前状态
- 状态：implemented-pending-desktop-runtime-check
- 最近更新：2026-06-03
