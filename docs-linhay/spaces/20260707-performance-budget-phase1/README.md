# 20260707-performance-budget-phase1

## 背景
用户连续反馈 Wails WebContent / `wails://wails` 内存与资源占用偏高。前置审计显示，这不是单一 React heap 问题，而是日志、SQLite 历史表、WebKit LocalStorage 多条路径缺少明确性能预算。

本轮按 `gettokens-performance-governance` 执行，先落地证据最硬、收益最高、实现边界最清楚的第一期治理：Wails 管理层 `sidecar.log` 上限，以及 sidecar fork 内 live sessions / usage attribution SQLite 事件历史 retention。

## 目标
1. 给 `sidecar.log` 建立可测试的 rotation / size cap，避免 Wails 管理层无限追加 stdout/stderr。
2. 给 `live_session_requests` 建立持久化 retention，避免只在查询窗口限制但 SQLite 文件长期累积。
3. 给 `usage_attribution_events` 建立持久化 retention，避免 usage ledger append-only 导致 DB 持续膨胀。
4. 形成可回归的第一期 performance budget seed，后续再扩展到 LocalStorage 和统一 budget gate。

## 范围
- Wails 管理层：`internal/sidecar/manager.go` 及其 focused Go 测试。
- sidecar fork：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/` 内 live session history 与 usage attribution 的 SQLite retention。
- 文档：本 space、memory，以及必要的性能治理说明。

## 非目标
- 不触碰 `/Applications/GetTokens.app` 正式版二进制、进程或正式配置数据。
- 不在本轮清理用户正式数据目录；只实现后续版本运行时的预算机制。
- 不修改 `accounts runtime sync` 的 Wails visibility 归一逻辑；该逻辑已有测试说明是有意规避 Wails visibility quirks，需 CPU/电池/profile 证据后再评估。
- 不在本轮治理 Wails LocalStorage 的 account list / quota cache；它进入第二期。
- 不做 UI 视觉改动，不启动可见浏览器验收。

## 验收标准
### 证据门禁
- 问题来源：用户 Activity Monitor / `wails://wails` 资源占用反馈，以及 2026-07-07 性能治理审计。
- 当前现象：正式配置目录约 `1.0G`，`sidecar.log` 约 `498M`、`live-sessions-v1.sqlite` 约 `330M`、`usage-attribution-v1.sqlite` 约 `113M`；dev 配置目录也有同类增长。
- 代码事实：
  - Wails `internal/sidecar/manager.go` 直接 append `configDir/sidecar.log`。
  - sidecar fork `live_session_requests` 查询有窗口，但未见持久化 DELETE。
  - sidecar fork `usage_attribution_events` 查询有窗口，但写入侧为 append-only。
- 预期验收：focused Go tests 先红后绿；不依赖真实账号、不触碰正式版。
- 反证条件：若测试或代码复核发现已有等价 rotation / retention 机制且能覆盖当前文件增长，本轮对应实现项应停止并只记录证据。

### 第一预算 seed
- `sidecar.log`：单个 active log 目标不超过 `10MB`，历史备份最多 `2` 个，总预算 seed 为 `30MB`。
- `live-sessions-v1.sqlite`：保留最近 `14d` 的 `live_session_requests`，预算 seed 为 `100MB`。
- `usage-attribution-v1.sqlite`：保留最近 `30d` 的 `usage_attribution_events`，预算 seed 为 `100MB`；前端 Usage Desk 已有 `30D` 视图，本轮不破坏该产品语义。
- 预算是第一期 seed，不升级为 `AGENTS.md` 硬规则；后续需用 dev 数据校准。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260707-performance-budget-phase1`
- worktree：`../GetTokens-worktrees/20260707-performance-budget-phase1/`

## 相关链接
- 计划：`plans/phase1-log-and-sqlite-retention.md`
- memory：`docs-linhay/memory/2026-07-07.md`

## 验证结果
- `go test ./internal/sidecar -run 'TestPrepareSidecarLog' -count=1` 通过。
- `go test ./internal/sidecar -count=1` 通过。
- GetTokens 根工作树 `go test ./... -count=1` 通过。
- CLIProxyAPI fork `go test ./internal/gettokenshooks -run 'TestLiveSessionsHistoryPrunesRequestsOlderThanRetention|TestUsageAttributionStorePrunesEventsOlderThanRetention|TestRateLimitEvaluatorCalendarDayWindowStartsAtLocalMidnight' -count=1` 通过。
- CLIProxyAPI fork `go test ./internal/gettokenshooks -count=1` 通过。
- CLIProxyAPI fork `go test ./... -count=1` 通过。
- `CLI_PROXY_SOURCE_DIR=/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI ./scripts/ensure-sidecar.sh darwin arm64` 通过，fingerprint 为 `c3cdb270eff39a6c968c3123b3e74245df0ec3b5:dirty:276e1e0db994903300dcf91e150d8b3d3d371064e8a2d8c37fc6610055ae845d:darwin:arm64`。
- `CLI_PROXY_SOURCE_DIR=/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI ./scripts/wails-cli.sh build` 通过，产物为本 worktree 内 `build/bin/GetTokens.app`。

## 当前状态
- 状态：validated
- 最近更新：2026-07-07
