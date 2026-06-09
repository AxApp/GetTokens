# 20260608-account-runtime-bulk-sync

## 背景
- 用户在账号池看到大量账号卡片黄色 `STALE Get "http://127.0.0.1:81317/v0/management/accounts": context deadline exceeded` 提示。
- 当前账号池有 1600+ 项资产，全局运行态刷新若逐账号触发主动 quota refresh，会放大为大量 sidecar management 请求并拖慢 `/v0/management/accounts`。

## 目标
- 账号页常规运行态同步采用批量读快照，不主动刷新上游 quota curl。
- 选中账号的批量刷新采用单次 sidecar batch 请求，由 sidecar 内部限并发执行，并返回逐账号成功/失败结果。
- 卡片失败时保留旧 quota 并展示 `stale/degradedReason`，避免把旧数据伪装成新数据。

## 范围
- sidecar fork：新增 `/v0/management/gettokens/quota-refresh-batch`。
- GetTokens Wails/root：新增 `RefreshCodexQuotasBatch` 绑定和 DTO。
- 账号页前端：全局“刷新运行态”改为批量读 `/gettokens/quota-status`；选中批量刷新改为 batch 写。
- 测试：覆盖 sidecar batch、父仓 client、Wails bridge、前端运行态守护。

## 非目标
- 不把页面进入、可见性恢复或全局运行态刷新变成主动上游 quota curl 探测。
- 不修改正式版 `/Applications/GetTokens.app` 或正式版 sidecar。
- 不处理本轮之外的账号导入 ZIP 改动。

## 验收标准
1. Given 账号页进入或点击全局刷新运行态，When 页面同步额度/usage/rate-limit，Then quota 只调用 `GetAllQuotaStatuses` 批量读 runtime snapshot，不逐账号调用 `GetCodexQuota`。
2. Given 用户选中多个支持 quota 的账号点击批量刷新，When 前端发起刷新，Then 只调用一次 `RefreshCodexQuotasBatch`，请求体包含去重后的 `accountKeys`。
3. Given sidecar batch 内某个账号 quota 配置缺失或刷新失败，When 返回结果，Then 成功账号进入 `items`，失败账号进入 `errors`，整体 HTTP 仍返回可解析结果。
4. Given batch endpoint 不可用或整批请求失败，When 前端捕获错误，Then 所有目标账号保留旧 quota 并标记 stale/degraded reason。
5. Given Wails 绑定生成，When 前端 typecheck，Then `RefreshCodexQuotasBatch` 和 `CodexQuotaBatchRefreshInput/Result` 为真实生成绑定。

## 证据门禁

### 2026-06-08 批量运行态读写

- 问题来源：用户截图中多张账号卡片同时展示 `STALE Get ".../v0/management/accounts": context deadline exceeded`，并追问是否可以批量读取。
- 当前事实位置：`frontend/src/features/accounts/hooks/useAccountsPageState.ts` 的 `refreshAccountsRuntime` 原先对 `runtimeSyncAccounts` 跑 `refreshCodexQuota`；`internal/wailsapp/quota.go` 的 `GetCodexQuota` 对统一账号会触发 sidecar 单账号 quota refresh。
- 当前现象：1600+ 账号时，全局运行态刷新可能形成大量单账号主动刷新和 management 请求，导致账号列表接口超时，UI 只能展示 stale cache。
- 验收路径：源码守护验证全局运行态只读 `syncCodexQuotaStatuses`；sidecar/Wails/client 测试验证 batch refresh 单请求、部分失败可返回；前端 typecheck 验证真实 Wails 绑定。
- 反证条件：若全局运行态仍出现 `runAccountRuntimeRequestPool(runtimeSyncAccounts, refreshCodexQuota)`，或选中批量刷新仍 `for resolution.targets` 逐账号调用单刷新，则视为未完成。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260608-account-runtime-bulk-sync`
- worktree：`../GetTokens-worktrees/20260608-account-runtime-bulk-sync/`

## 相关链接

## 当前状态
- 状态：implemented
- 最近更新：2026-06-08

## 验证记录
- `go test ./internal/api/handlers/management -run 'TestQuotaRefresh.*Batch|TestQuotaRefreshCodexAPIKeyAccountWritesRuntimeGuard|TestQuotaRefreshOpenAICompatibleAccountWritesBillingRuntime' -count=1` 通过。
- `go test ./internal/api/handlers/management -count=1` 通过。
- `go test ./internal/cliproxyapi ./internal/wailsapp -run 'TestQuotaRefreshClientEndpoints|TestQuotaRuntimeBridgeCallsReadOnlyManagementAPI|TestRefreshCodexQuotasBatchCallsBatchManagementAPI' -count=1` 通过。
- `go test ./internal/cliproxyapi ./internal/wailsapp -count=1` 通过。
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs frontend/src/features/accounts/tests/accountSelectors.test.mjs` 通过，`43 pass / 0 fail`。
- `npm --prefix frontend run typecheck` 通过。
- `npm --prefix frontend run build` 通过；仅保留既有 Vite chunk size warning。

## 性能测试

测试环境：macOS arm64，Apple M5，本地 `go test` benchmark；账号规模固定为 `1652`。测试只覆盖本地 handler / SQLite / runtime store / JSON 序列化开销，不包含真实上游 quota curl 网络耗时。

### 批量读 runtime snapshot

- 命令：`go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatusSnapshot1652Accounts' -benchtime=30x -count=5`
- 结果：平均约 `5.70ms/op`，单次结果为 `5.03ms`、`4.62ms`、`4.25ms`、`3.96ms`、`10.66ms`。
- 分配：约 `2.06-2.34MB/op`，约 `4992-4996 allocs/op`；一次 GC/序列化波动样本为 `10.66ms`。

### 批量主动刷新 vs 旧逐账号循环

- 命令：`go test ./internal/api/handlers/management -run '^$' -bench 'BenchmarkQuotaRefresh(Batch|SingleLoop)1652Accounts' -benchtime=10x -count=5`
- 新 batch：平均约 `52.14ms/op`，单次结果为 `63.69ms`、`91.47ms`、`37.17ms`、`30.74ms`、`37.65ms`；约 `8.6MB/op`、`158.8k allocs/op`。
- 旧逐账号循环：平均约 `102.91ms/op`，单次结果为 `111.13ms`、`106.84ms`、`94.70ms`、`104.99ms`、`96.88ms`；约 `19.8MB/op`、`275.6k allocs/op`。
- 结论：在不含真实上游网络的本地开销上，batch 约 `1.97x` 更快，内存分配约下降 `56%`，分配次数约下降 `42%`；真实 App 中还会额外少掉前端到 sidecar 的 `1651` 次 Wails/HTTP 往返。

### 回归测试

- 新增 benchmark：`BenchmarkQuotaRuntimeStatusSnapshot1652Accounts`、`BenchmarkQuotaRefreshBatch1652Accounts`、`BenchmarkQuotaRefreshSingleLoop1652Accounts`。
- 回归命令：`go test ./internal/gettokenshooks ./internal/api/handlers/management -count=1` 通过。
