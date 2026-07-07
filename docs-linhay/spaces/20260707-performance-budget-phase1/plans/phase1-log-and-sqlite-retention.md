# Phase 1: Log and SQLite Retention

## 决策

采用混合方案：

- 采纳 Antigravity 审稿的优先级：`sidecar.log` 先行，其次 SQLite retention。
- 保留 Codex 主控的证据门槛：所有实现先补 focused 红灯测试，不直接按预算猜测改代码。
- 第一预算只作为 seed，后续用 dev 运行数据校准，不写入 `AGENTS.md`。

## 执行顺序

1. Wails sidecar log rotation
   - 文件：`internal/sidecar/manager.go`、`internal/sidecar/manager_test.go`
   - 预算：active `sidecar.log <= 10MB`，备份最多 `2` 个。
   - 红灯：构造超过阈值的 `sidecar.log`，调用 log 打开 helper 后应轮转为 `.1`，并删除超额 `.3`。
   - 绿灯：`go test ./internal/sidecar -run 'TestPrepareSidecarLog' -count=1`

2. Live sessions SQLite retention
   - 文件：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/live_session_history.go`
   - 预算：保留最近 `14d` 的 `live_session_requests`。
   - Mock upstream facts：插入一条 20 天前请求、一条 1 小时内请求。
   - Mock downstream / spy outputs：`prune` 后旧行不可查，新行仍可被 `history` 返回。
   - 红灯：新增 `live_session_history_test.go` focused retention case。
   - 绿灯：CLIProxyAPI focused Go test 通过。

3. Usage attribution SQLite retention
   - 文件：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/usage_attribution.go`
   - 预算：保留最近 `30d` 的 `usage_attribution_events`，保持 Usage Desk `30D` 查询语义。
   - Mock upstream facts：插入一条 45 天前 usage event、一条当前 usage event。
   - Mock downstream / spy outputs：`summary(30d)` 不再包含过期行，当前事件仍聚合。
   - 红灯：新增 / 扩展 `usage_attribution_test.go` retention case。
   - 绿灯：CLIProxyAPI focused Go test 通过。

## 暂缓项

- Wails LocalStorage account list / quota cache：第二期处理，需要前端缓存 contract 与 browser/Wails 行为一起验收。
- `accounts runtime sync` hidden 策略：暂不改。只有出现 CPU、电池或 profile 证据后，再决定是否引入 Wails native window lifecycle signal。
- SQLite `VACUUM`：本期先做 DELETE retention。物理回收策略需评估阻塞风险，可在后续做 idle / incremental vacuum。

## 验证命令

```bash
go test ./internal/sidecar -run 'TestPrepareSidecarLog' -count=1
go test ./internal/sidecar -count=1
go test ./... -count=1
go test ./internal/gettokenshooks -run 'TestLiveSessionsHistoryPrunesRequestsOlderThanRetention|TestUsageAttributionStorePrunesEventsOlderThanRetention|TestRateLimitEvaluatorCalendarDayWindowStartsAtLocalMidnight' -count=1
go test ./internal/gettokenshooks -count=1
go test ./... -count=1
CLI_PROXY_SOURCE_DIR=/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI ./scripts/ensure-sidecar.sh darwin arm64
CLI_PROXY_SOURCE_DIR=/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI ./scripts/wails-cli.sh build
docs-linhay/scripts/check-docs.sh
git diff --check
```

注：前三个 Go 命令在 GetTokens worktree 执行；CLIProxyAPI focused / full Go tests 在 `/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI` 执行；sidecar rebuild / Wails build 在本 worktree 执行，并显式传入 `CLI_PROXY_SOURCE_DIR`。

## 执行结果

- `sidecar.log` 打开 helper 会在 active log 超过 `10MB` 时把最新尾部截入 `.1`，保留旧 `.1` 为 `.2`，删除 `.3+`，新 active log 从空文件继续写入。
- `live_session_requests` 在 store open 时强制 prune，写入后按 5 分钟节流 prune；保留最近 `14d`。
- `usage_attribution_events` 在 store open 时强制 prune，生产 usage attribution 写入后按 5 分钟节流 prune；保留最近 `30d`。
- `rateLimitStore` 的测试/模拟写入禁用 wall-clock prune，避免破坏已有 rate-limit 模拟时钟测试；生产 usage plugin 不受影响。
- 本期不执行 SQLite `VACUUM`，避免在桌面运行期引入阻塞式 I/O；物理文件回收放入后续 idle / incremental vacuum 方案。
