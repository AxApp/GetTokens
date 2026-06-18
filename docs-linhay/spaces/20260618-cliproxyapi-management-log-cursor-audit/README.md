# 20260618-cliproxyapi-management-log-cursor-audit

## 背景

本 space 承接 CLIProxyAPI v7.2.16 intake 的 Phase 3：Management log cursor / observability 审计。

upstream 在 `internal/api/handlers/management/logs.go` 新增 cursor-based log tail 能力，用于避免 management logs 页面每次 tail 都全量扫描旧日志，并支持基于 cursor 读取新增完整行、跨 rotation 延续、truncate / missing rotated file 时 reset 到 tail。

GetTokens fork 当前也有 `internal/api/handlers/management/logs.go`，但只支持 `after` timestamp 与 `limit` 的全量扫描；没有 `next-cursor`、`cursor-reset` 或 cursor 解码 / rotation helper。该候选属于 management API observability 能力，不直接触碰 account selection、route guard、rate-limit、live sessions 或 usage attribution 热路径。

## 目标

1. 先用 focused tests 证明 fork 缺少 cursor tail / incremental log read 行为。
2. 在 GetTokens sidecar fork 内窄实现 management logs cursor，不照搬其他 upstream management UI / pluginhost / auth runtime 变更。
3. 保持 legacy `after` timestamp 行为兼容：全量 scan 路径的 `line-count` 仍表示扫描到的总行数。
4. 对 cursor / tail 路径提供稳定 `next-cursor`，只返回新增完整行；遇到 truncate 或 cursor 文件丢失时 reset 到 tail，并标记 `cursor-reset=true`。
5. 完成 focused tests、affected package tests、fork diff check、fork commit 和 clean sidecar rebuild。

## 范围

- fork 文件：
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/logs.go`
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/logs_test.go`
- upstream 参考：
  - `TestGetLogsTailLimitReturnsRecentLinesWithCursor`
  - `TestGetLogsCursorReturnsOnlyNewCompleteLines`
  - `TestGetLogsCursorResetAfterTruncateTailsLimit`
  - `TestGetLogsCursorReadsAcrossRotation`
  - `TestDecodeLogCursorRejectsUnsafeFiles`
- 子计划：
  - `plans/management-log-cursor-tracer-bullet-v01.md`
- fork commit：
  - `8d1ef22c fix(management): add log cursor tailing`
- sidecar rebuild：
  - `8d1ef22c967ae0ae9ca9c149584dadc15e9aa7ef:clean:a58339be04eb235743f7649d337710700bc82c5cbd9b0b9a3d1b06d887b1d3af:darwin:arm64`
  - binary sha256：`ab3258e112116b8893d67fd7c45542268906544d08ba684bafcc9bd221a675ae`

## 非目标

- 不改 management UI 静态资源、pluginhost、pluginstore 或 TUI。
- 不改 auth scheduler、remote management 鉴权、config migration 或账号 SQLite。
- 不改 GetTokens Doctor Workbench / Wails 前端消费契约；本切片只补 sidecar management API 能力。
- 不触碰正式版 `/Applications/GetTokens.app`。

## 验收标准

### BDD 场景

1. 给定日志文件包含多行完整日志，当请求 `/v0/management/logs?limit=2` 时，只返回最新 2 行，`line-count=2`，并返回非空 `next-cursor`。
2. 给定第一次 tail 返回 cursor，当主日志追加一条完整新行后，用该 cursor 读取时只返回新增行，不回放旧行。
3. 给定 cursor 指向的 active log 被 truncate，当继续读取 cursor 时应 reset 到最新 tail，并返回 `cursor-reset=true`。
4. 给定 cursor 指向 `main.log` 末尾，随后日志 rotation 到 `main.log.1` 且新 `main.log` 写入新行，cursor 读取应能跨 rotation 返回新行。
5. cursor payload 不得包含绝对路径，且必须拒绝 `../secret`、嵌套路径、空文件名等 unsafe 文件名。

### Evidence gate

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream `internal/api/handlers/management/logs.go` / `logs_test.go` 新增 cursor tail 与 rotation tests |
| 当前代码事实 | fork `GetLogs` 只解析 `after` / `limit`，响应只含 `lines`、`line-count`、`latest-timestamp`；没有 `next-cursor` / `cursor-reset` |
| 可复现缺失 | 加入 upstream focused cursor tests 后初始 build failed 或响应缺少 `next-cursor`，cursor helper 未定义 |
| 红灯命令 | `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogsTailLimitReturnsRecentLinesWithCursor|GetLogsCursorReturnsOnlyNewCompleteLines|GetLogsCursorResetAfterTruncateTailsLimit|GetLogsCursorReadsAcrossRotation|DecodeLogCursorRejectsUnsafeFiles)' -count=1 -timeout 60s` |
| 绿灯验收 | focused tests、affected package tests、fork `git diff --check`、fork commit、clean sidecar rebuild |

### 实现记录

- 红灯：focused tests 初始 build failed，缺 `logCursor`、`logCursorVersion`、`decodeLogCursor` 等 cursor helper，证明 fork 无 cursor tail 入口。
- 实现：`GetLogs` 新增 `cursor` 分支与 `tail limit` 快路径；补 `logCursor` encode/decode、safe file validation、complete-line boundary、tail read、cursor continuation、truncate / missing cursor file reset、rotation continuation helper。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogsTailLimitReturnsRecentLinesWithCursor|GetLogsCursorReturnsOnlyNewCompleteLines|GetLogsCursorResetAfterTruncateTailsLimit|GetLogsCursorReadsAcrossRotation|DecodeLogCursorRejectsUnsafeFiles)' -count=1 -timeout 60s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -run 'Test(GetLogs|DecodeLogCursor)' -count=1 -timeout 120s`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -run 'Test(GetLogs|DecodeLogCursor)' -count=1 -timeout 180s`
  - fork `git diff --check` 与 staged `git diff --cached --check`
- 环境限制：`GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/api/handlers/management -count=1 -timeout 120s` 在当前 sandbox 失败于既有 `openai_quota_reset_test.go` 的 `httptest.NewServer`：`listen tcp6 [::1]:0: bind: operation not permitted`，不是本切片实现失败。
- dev App：本切片只改 sidecar management logs API，不改 Wails binding、native runtime、App lifecycle、菜单栏、LaunchServices 或前端；按 AGENTS 第 26 条，自动化 tests + sidecar rebuild 为主要验收，真实 dev App 手点不作为硬门槛。
- 正式版：未触碰 `/Applications/GetTokens.app`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260618-cliproxyapi-management-log-cursor-audit`
- worktree：`../GetTokens-worktrees/20260618-cliproxyapi-management-log-cursor-audit/`

## 相关链接

- Parent intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`
- Parent plan：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-intake-plan-v01.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-18
