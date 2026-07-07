# Wails WebContent Memory Audit

## 背景
2026-07-07 用户在活动监视器中看到 `wails://wails` WebContent 行约 `981.0 MB`，对应 PID `12983`，要求查看该内存占用。

只读排查确认：
- PID `12983` 是 `/Applications/GetTokens.app` 的 `com.apple.WebKit.WebContent` 子进程，父应用 PID `12979`，sidecar PID `12985`。
- 当前观察对象是正式版 `GetTokens 1.2.12`，本轮不得 kill、重启、替换或修改正式版 App。
- `vmmap -summary 12983`：WebContent physical footprint 约 `812.4M`，peak `2.1G`；`WebKit Malloc` resident 约 `604.7M`，dirty 约 `410.4M`，swapped 约 `306.6M`。
- 30 秒采样中 WebContent RSS 从约 `442MB` 回落到约 `318MB`，更像高水位和大对象临时分配，不是采样窗口内持续上涨。
- `~/.config/gettokens/live-sessions-v1.sqlite` 约 `327M`，`live_session_requests` 约 `193k` 行；但当前 live sessions 前端历史保留已有上限，未发现一次性加载全表。
- `~/.config/gettokens/accounts-v1.sqlite` 约 `25M`，账号卡约 `3516` 个；账号页会持有全量账号状态，并拉取 quota / usage / rate-limit 补充状态。
- WebKit LocalStorage 下发现两个 Wails origin 目录约 `66M` 和 `166M`，`localstorage.sqlite3-wal` 分别约 `61M` 和 `144M`。其中 `gettokens.sessionManagement.snapshot` 约 `3MB`，`gettokens.accounts.list-cache` / `gettokens.accounts.quota-cache` 各约 `0.8MB`，重复写入会放大 WAL。
- sidecar 日志约 `431M`，只读 tail 看到 `GET /v0/management/gettokens/quota-status?account_keys=...` 会把大量账号 key 放入 query string 并被 Gin logger 记录，形成大日志行。

## 目标
- 降低 Wails WebView 内部大对象缓存和 query payload 造成的峰值内存压力。
- 保持账号页、会话管理页的浏览器 preview 可用，不破坏 Wails 运行态的数据来源。
- 给本轮定位留下可复核证据，避免误判为 Go sidecar 泄漏。

## 范围
- 前端 Wails 运行态的 session management snapshot 缓存策略。
- 账号 quota runtime status 同步的请求分批策略。
- 只记录正式版只读观察结果，不直接清理正式版 WebKit LocalStorage、sidecar 日志或 SQLite 数据。

## 非目标
- 不修改 `/Applications/GetTokens.app` 正式版二进制。
- 不 kill / restart 正式版 GetTokens、WebContent 或 sidecar 进程。
- 不在本轮重写账号页整体状态模型或 sidecar 日志系统。
- 不删除用户本地正式数据；如需清理缓存，必须另行明确授权。

## 验收标准
- 增加回归测试证明 Wails 运行态不会继续把完整 session management snapshot 写入 WebView localStorage，并能清理 legacy unsuffixed snapshot key。
- 增加回归测试证明 quota status 同步会把大量 account keys 分批，避免单次 `GetQuotaStatuses` 承载几千个 key。
- 运行相关前端测试和文档结构检查。
- 交付说明包含：根因判断、未触碰正式版的边界、已验证项、剩余风险。

## 证据门禁
| 候选问题 | 来源 | 当前事实位置 | 现象 | 预期验收 | 反证条件 |
| --- | --- | --- | --- | --- | --- |
| WebContent 高占用来自 WebKit 前端大对象/缓存高水位 | 用户活动监视器 + `vmmap` | `com.apple.WebKit.WebContent` PID `12983`；`WebKit Malloc` resident 约 `604.7M` | 30 秒 RSS 回落，非 sidecar 单进程常驻上涨 | 减少 WebView localStorage 大对象写入与超长 quota 请求 | 改动后仍有同样 query/localStorage 写入，或 WebContent RSS 在静止状态持续爬升 |
| session snapshot 被重复写入 WebView localStorage | LocalStorage SQLite 查询 + 代码阅读 | `frontend/src/features/session-management/cache.ts`、`useSessionManagementSnapshot.ts` | legacy key 约 `3MB`，WAL 数十到上百 MB | Wails 运行态跳过 localStorage snapshot 读写，保留浏览器 preview 缓存能力 | Wails 运行态仍调用 `localStorage.setItem(gettokens.sessionManagement.snapshot*)` |
| quota status 一次性 query 太大 | sidecar log tail + 代码阅读 | `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts` | 3516 个账号 key 被一次性传入 `GetQuotaStatuses(quotaKeys)`，Gin logger 写出超长 URL | quota keys 分批，单次请求 key 数固定上限 | 大账号池仍只发一次全量 `GetQuotaStatuses` |

## 实现记录
- `frontend/src/features/session-management/cache.ts` 增加可禁用 cache options 与 `cleanupSessionManagementSnapshotStorage()`。
- `frontend/src/features/session-management/useSessionManagementSnapshot.ts` 在 Wails bindings 存在时跳过 WebView localStorage snapshot 读写，并清理 legacy / suffixed session snapshot keys；浏览器 preview 仍保留缓存。
- `frontend/src/features/session-management/useSessionManagementProviderMerge.ts` 在 Wails 运行态禁用 provider merge 后的 snapshot localStorage 写入。
- `frontend/src/features/accounts/model/accountRuntimeSync.ts` 增加 `ACCOUNT_RUNTIME_QUOTA_STATUS_CHUNK_SIZE=200` 与 `chunkRuntimeSyncAccountKeys()`。
- `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts` 将 `GetQuotaStatuses(quotaKeys)` 改为按 chunk 顺序读取并合并结果，fallback `GetAllQuotaStatuses()` 保持不变。

## 验证记录
- 红灯：新增测试后，旧实现分别因缺少 `cleanupSessionManagementSnapshotStorage` 和 `ACCOUNT_RUNTIME_QUOTA_STATUS_CHUNK_SIZE` 导出而失败。
- 聚焦测试：`node --test src/features/session-management/cache.test.mjs`，4 pass。
- 聚焦测试：`node --test src/features/accounts/tests/accountRuntimeSync.test.mjs`，14 pass。
- 类型检查：`npm run typecheck` 通过。
- 前端全集：`npm run test:unit`，1095 pass / 0 fail。
- 前端构建：`npm run build` 通过；仅保留既有 Vite chunk-size warning。
- 文档检查：`docs-linhay/scripts/check-docs.sh` 通过。
- 空白检查：`git diff --check` 通过。

## 剩余风险
- 本轮没有清理正式版 WebKit LocalStorage / sidecar.log / SQLite 数据，也没有重启正式版进程；正式版只有安装包含本修复的新构建后才会停止继续写入这些 session snapshot key。
- `sidecar.log` 的超长 quota-status URL 仍需要后续在 sidecar logger 或 management API 形态上继续治理；本轮先通过前端分批降低单行放大。
- 账号 list/quota localStorage cache 仍存在，后续如果 WebContent 高水位仍明显，可在不破坏首屏体验的前提下继续评估 Wails 运行态禁写或 write-if-changed。

## 后续切片：sidecar access log query 限幅
| 候选问题 | 来源 | 当前事实位置 | 现象 | 预期验收 | 反证条件 |
| --- | --- | --- | --- | --- | --- |
| sidecar access log 展开大量 `account_key/account_keys` | sidecar log 只读 tail + logger 代码阅读 | `docs-linhay/references/CLIProxyAPI/internal/logging/gin_logger.go` 调用 `util.MaskSensitiveQuery()`；`internal/gettokenshooks/quota_runtime.go` 接受 `account_key/account_keys` | `GET /v0/management/gettokens/quota-status?account_keys=...` 在日志中写出大量账号 key，放大 `sidecar.log` | `MaskSensitiveQuery` 对 `account_key/account_keys` 输出 bounded placeholder，保留参数名和数量，不展开账号 key | access log 或 request logger 仍能写出完整 `acct_*` 列表 |

### 实现记录
- CLIProxyAPI fork commit：`c3cdb270 Redact account keys in access logs`。
- `internal/util/provider.go` 的 `MaskSensitiveQuery()` 对 `account_key` / `account_keys` 输出 `[redacted:N]`，其中 `N` 是逗号分隔 value 的非空 key 数。
- `internal/logging/gin_logger_test.go` 新增 Gin access log 集成测试，确认 `/v0/management/gettokens/quota-status?account_keys=...` 不再把 `acct_*` 写入日志，仍保留 `window=24h` 等无关 query。
- `internal/util/provider_test.go` 新增逗号形式与重复参数形式的 query redaction 回归测试。

### 验证记录
- 红灯：`go test ./internal/util -run 'TestMaskSensitiveQueryRedacts' -count=1` 在旧实现下失败，日志/掩码结果仍包含 `acct_*`。
- 聚焦测试：`go test ./internal/util -run 'TestMaskSensitiveQueryRedacts' -count=1` 通过。
- 相关包：`go test ./internal/util ./internal/logging ./internal/api/middleware -count=1` 通过。
- fork 全量：`go test ./... -count=1` 通过。
- fork 空白检查：`git diff --check` 通过。
- sidecar rebuild：`./scripts/ensure-sidecar.sh darwin arm64` 报告 `c3cdb270eff39a6c968c3123b3e74245df0ec3b5:clean:b2204c3c123938a42aef3e1e4bc365da5afe89b5df266b20dde2821090f242c7:darwin:arm64`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260707-wails-webcontent-memory-audit`
- worktree：`../GetTokens-worktrees/20260707-wails-webcontent-memory-audit/`

## 相关链接
- `frontend/src/features/session-management/cache.ts`
- `frontend/src/features/session-management/useSessionManagementSnapshot.ts`
- `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`
- `frontend/src/features/accounts/model/accountRuntimeSync.ts`

## 当前状态
- 状态：verified
- 最近更新：2026-07-07
