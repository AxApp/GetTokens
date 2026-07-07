# 20260608-account-pool-scale-optimization

## 背景
- `20260608-account-runtime-bulk-sync` 已修复账号池全局运行态刷新复用单账号主动刷新导致的请求风暴，并补充 1652 账号性能基线。
- 当前性能基线显示：
  - 批量读 `/v0/management/gettokens/quota-status` runtime snapshot 平均约 `5.70ms/op`。
  - 新 batch 主动刷新平均约 `52.14ms/op`。
  - 旧逐账号循环平均约 `102.91ms/op`。
- 仍可继续优化的方向包括：batch endpoint 内部避免全表扫描、账号页 1600+ 卡片渲染虚拟化、runtime snapshot 增量读取、真实上游刷新后台任务化。
- 2026-06-09 追加发现：账号页“批量删除”仍在前端循环逐个账号调用单删除接口，和“批量操作要批处理”的目标不一致。

## 目标
- 在 1600+ 账号规模下，让账号池列表、运行态刷新和选中批量刷新保持可预期响应。
- 降低 sidecar management API 的 SQLite/JSON/请求往返成本，避免小批量操作被全量账号规模拖慢。
- 降低前端账号卡片渲染和布局成本，避免数据接口已变快但 UI 仍卡顿。
- 建立可复跑性能基线，后续优化必须用同一量级数据证明收益。

## 范围
- sidecar accountstore 与 management handler 查询路径。
- GetTokens Wails/root client 与前端账号页数据流。
- 账号页卡片列表的桌面端虚拟化/分组渲染策略。
- runtime quota snapshot 增量读取或按 keys 读取。
- 账号批量删除、批量状态变更等 bulk mutation 的单请求批处理。
- 性能 benchmark、前端渲染检查和文档记录。

## 非目标
- 不修改正式版 `/Applications/GetTokens.app` 或正式版 sidecar。
- 不把全局运行态同步改回主动上游 quota curl 探测。
- 不为移动端做适配或截图验收。
- 不改变 quota curl 的用户语义：用户主动刷新仍代表真实刷新请求。
- 不在本 space 处理账号导入 ZIP 等无关改动。

## 验收标准
1. Given 用户选中少量账号批量刷新，When 前端调用 batch refresh，Then sidecar 不再读取完整账号表，只按目标 account keys 查询。
2. Given 1652 账号规模，When 跑 batch refresh benchmark，Then 小批量刷新耗时不随总账号数线性增长；全量刷新不比当前 `52.14ms/op` 性能基线退化。
3. Given 账号页渲染 1600+ 账号，When 用户进入账号池或滚动列表，Then DOM 中实际卡片节点数受可视窗口限制，不一次性渲染全部卡片。
4. Given 页面可见性恢复、interval sync 和手动全局刷新短时间连续触发，When runtime sync 执行，Then 重复请求被合并或跳过，不产生并发重复快照请求。
5. Given runtime quota 状态只有少量账号变化，When 前端同步 quota 状态，Then 可选择按 `account_keys` 或增量游标读取，避免每次全量序列化所有 runtime states。
6. Given 大批量真实上游 quota curl 可能耗时较长，When 用户触发全量主动刷新，Then UI 不被单个长请求阻塞，并能看到进度、失败汇总和完成状态。
7. Given 新增或调整性能优化，When 提交前验证，Then benchmark、focused Go tests、前端单测/typecheck、必要的无头浏览器 DOM 检查均通过。
8. Given 用户选中多个账号点击批量删除，When 前端发起删除，Then 只调用一次 batch delete 绑定，sidecar 在一次请求内处理多个 account keys，并返回逐账号成功/失败结果。

## 证据门禁

### 2026-06-08 后续优化候选

- 问题来源：用户要求继续优化账号池 stale/context deadline 问题，并在批量读写实现后追问“还有什么可以优化”。
- 当前事实位置：
  - `docs-linhay/spaces/20260608-account-runtime-bulk-sync/README.md` 已记录 1652 账号 benchmark。
  - sidecar batch handler 当前仍通过 `listAccountsWithReadRecovery` 获取全量账号后按 key 建 map。
  - 前端账号页仍需要确认是否一次性渲染所有账号卡片，当前没有明确虚拟列表验收基线。
- 当前现象：batch 已明显减少请求数量，但小批量刷新仍可能被全表读取拖累；接口变快后，大账号池 UI 渲染可能成为下一瓶颈。
- 验收路径：先补可复跑 benchmark/DOM 检查，再分期落地 sidecar 查询、前端虚拟化、增量 runtime snapshot 和后台任务化。
- 反证条件：若实测前端 DOM 已受限、batch 查询耗时不受账号总数影响、或真实使用瓶颈来自上游 quota curl 网络而非本地读取/渲染，则对应优化降级或取消。

### 2026-06-09 批量删除仍逐个请求

- 问题来源：用户反馈“批量删除的时候为什么是一个一个删的？批量操作要批处理”。
- 当前事实位置：`frontend/src/features/accounts/hooks/useAccountsActions.ts` 的 `runSelectedBulkDelete` 遍历 `selectedAccounts`，每项调用 `executeDeleteAccount`；后者按类型调用单个 `DeleteCodexAPIKey` / `DeleteOpenAICompatibleProvider` / `DeleteAuthFiles([one])`。
- 当前现象：选中 N 个账号删除会产生 N 次 Wails/management 删除请求，并且每次单删后还要处理类型分支。
- 验收路径：新增 sidecar batch delete endpoint、父仓 client、Wails/root 绑定和前端 batch delete 接入；源码守护验证 `runSelectedBulkDelete` 不再遍历目标逐个删除。
- 反证条件：如果批量删除路径仍出现 `for selectedAccounts -> executeDeleteAccount`，或 batch delete 只是在 Wails 层循环调用单删管理接口，均视为未完成。

### 2026-06-10 线上 sidecar 缺批量删除路由导致分组删除 404

- 问题来源：用户在正式版账号池点击“移除本组”后反馈“组和账号都没消失”，并提供错误截图：`SIDECAR 请求失败 (404): 404 NOT FOUND`。
- 当前事实位置：
  - 前端分组删除与 selected bulk delete 统一走 `frontend/src/features/accounts/hooks/useAccountsActions.ts` 的 `runAccountsBulkDelete()`。
  - Wails `internal/wailsapp/accounts.go` 的 `DeleteAccountsBatch()` 直接调用 `managementClient().DeleteAccountsBatch(...)`。
  - `internal/cliproxyapi/client.go` 将批量删除固定发到 `POST /v0/management/accounts/batch-delete`。
- 当前现象：若正式版 bundle 中 sidecar 仍是旧版本、没有 `batch-delete` 路由，则分组删除和批量删除都会直接报 404，既不会删除账号，也不会清理分组本地状态。
- 验收路径：在 Wails/management client 边界为 `DeleteAccountsBatch` 增加旧 sidecar 404 降级，自动回退到逐账号 `DELETE /v0/management/accounts/:id`，并补回归测试锁定“新 sidecar 走 batch、旧 sidecar 404 走 fallback”。
- 反证条件：若 404 时仍直接把错误透传给前端、没有删除任何账号，或 fallback 误吞非 404 错误并继续执行，均视为未完成。

### 2026-06-09 删除账号后刷新任务仍继续请求

- 问题来源：用户反馈“点全部刷 1000+ 账号，但已经删除账号后，被删除账号还是会发送请求；关闭 app 因为请求还在 sidecar 没有退出”。
- 当前事实位置：
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/quota_refresh.go` 的 `runAccountQuotaBatchRefreshJob` 使用 `context.Background()` resolve targets 和执行 `refreshAccountQuotaBatch`，后台 job 与启动请求和 service shutdown 生命周期脱钩。
  - 同文件 `refreshAccountQuotaBatch` 在 job 启动时拿到账号快照后直接逐个刷新，执行前没有重新确认账号仍未删除。
  - `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/accounts_store.go` 的 `DeleteAccount` / `DeleteAccountsBatch` 删除成功后只触发 account-store apply，没有取消命中被删账号的刷新 job。
- 当前现象：全量刷新提交 job 后，即使账号随后 soft delete，job 仍可能继续对已经删除的账号发 quota curl；App 关闭时，后台 job 使用 detached context，慢上游请求不会随 sidecar shutdown 被取消。
- 验收路径：为 job 增加 cancelable context；删除账号时取消包含被删 account keys 的 pending/running job；server Stop 时取消全部 pending/running quota refresh job；worker 执行单账号前复核账号仍存在；测试覆盖删除取消、shutdown 取消和 frontend complete 状态。
- 反证条件：如果 `runAccountQuotaBatchRefreshJob` 仍使用 `context.Background()` 执行刷新，或删除账号后 job 仍保持 `running` 并继续请求 deleted account，则视为未完成。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260608-account-pool-scale-optimization`
- worktree：`../GetTokens-worktrees/20260608-account-pool-scale-optimization/`

## 相关链接
- 前置 space：`docs-linhay/spaces/20260608-account-runtime-bulk-sync/README.md`
- 计划：`plans/implementation-plan-v01.md`

## 当前状态
- 状态：in-progress
- 最近更新：2026-06-09

## 2026-06-09 批量删除修复记录

- sidecar 新增 `POST /v0/management/accounts/batch-delete`，一次请求接收多个 `account_keys`，在 `accountstore.Store.DeleteAccounts` 内用单事务 soft delete，并返回 `deleted_account_keys / errors / succeeded / failed`。
- GetTokens 父仓新增 `cliproxyapi.DeleteAccountsBatch`、`wailsapp.DeleteAccountsBatch`、root `main.App.DeleteAccountsBatch` 和生成后的 Wails 绑定。
- 账号页 `runSelectedBulkDelete` 改为一次调用 `DeleteAccountsBatch(main.DeleteAccountsBatchInput.createFrom({ accountIDs }))`；不再遍历 `selectedAccounts` 调用 `executeDeleteAccount`。批量路径只处理统一 `acct_*` 账号 ID，旧 legacy 删除兼容仍保留在单卡删除路径。
- 批量删除成功后只 reload accounts 一次；本地先按 `deletedAccountIDs` 移除成功项，并按 skipped / failed 汇总提示。

### 已验证

- `go test ./internal/gettokens/accountstore -run 'TestDeleteAccounts' -count=1`
- `go test ./internal/api/handlers/management -run 'TestAccountsBatchDelete|TestAccountsCRUD' -count=1`
- `go test ./internal/api -count=1`
- `go test ./internal/api/handlers/management -run '^$' -bench 'BenchmarkQuotaRefresh' -benchtime=100ms -count=1`
  - `BenchmarkQuotaRefreshBatch1652Accounts`: `31.55ms/op`, `8.71MB/op`, `158783 allocs/op`
  - `BenchmarkQuotaRefreshSingleLoop1652Accounts`: `74.88ms/op`, `19.81MB/op`, `275433 allocs/op`
- `go test ./internal/cliproxyapi -run 'TestUnifiedAccountsClientCRUDStatusAndPriority' -count=1`
- `go test ./internal/wailsapp -run 'TestDeleteAccountsBatchUsesBatchManagementAPI|TestUnifiedCodexAPIKeyMutationsDoNotFallbackToLegacyOnAccountStoreErrors' -count=1`
- `go test . -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

## 2026-06-09 Phase 1：sidecar 按 keys 查询账号（已完成）

- CLIProxyAPI `accountstore.Store` 新增 `GetAccounts(ctx, accountKeys)`，支持按目标账号 key 批量读取，保持请求顺序、去重、缺失 key 和 per-account error 语义。
- `RefreshAccountQuotaBatch` 改为按请求 `account_keys` 查询目标账号，不再先读取完整账号表再过滤，少量目标刷新不再被 1652 全表扫描拖慢。
- 新增 benchmark `internal/api/handlers/management/quota_refresh_benchmark_test.go`，覆盖目标账号数 `1 / 10 / 100 / 1652`。

### Phase 1 性能数据

- `BenchmarkQuotaRefreshTarget1Of1652Accounts`: `178750 ns/op`
- `BenchmarkQuotaRefreshTarget10Of1652Accounts`: `628542 ns/op`
- `BenchmarkQuotaRefreshTarget100Of1652Accounts`: `1938333 ns/op`
- `BenchmarkQuotaRefreshTarget1652Of1652Accounts`: `39769167 ns/op`
- `BenchmarkQuotaRefreshBatch1652Accounts`: `26017875 ns/op`
- `BenchmarkQuotaRefreshSingleLoop1652Accounts`: `59085541 ns/op`

### Phase 1 已验证

- `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`

## 2026-06-09 Phase 2：账号页虚拟化和渲染基线（已完成）

- 账号页已有窗口化渲染基线，核心文件为 `frontend/src/features/accounts/components/AccountGroupSectionView.tsx` 和 `frontend/src/features/accounts/model/accountListLayout.ts`。
- 新增无头浏览器验收脚本 `docs-linhay/scripts/accounts-scale-browser-check.mjs`，使用 `?preview=accounts&accountsPreviewCount=1652#frame=accounts` 检查 1652 账号下的 DOM 节点数量、内部滚动容器和 virtual window 变化。
- DOM 验收结果：
  - preview 总账号数：`1652`
  - 首屏实际渲染账号卡片：`41`
  - 滚动后实际渲染账号卡片：`53`
  - virtual window：`plan:pro 0:15 -> 1071:1098`
  - 内部滚动容器：`scrollTop=161730`
- 截图归档：
  - `docs-linhay/spaces/20260608-account-pool-scale-optimization/screenshots/20260609/accounts-scale/20260609-accounts-scale-initial-baseline-v01.png`
  - `docs-linhay/spaces/20260608-account-pool-scale-optimization/screenshots/20260609/accounts-scale/20260609-accounts-scale-scrolled-baseline-v01.png`

### Phase 2 已验证

- `node --test frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

## 2026-06-09 Phase 3：runtime quota snapshot 按 keys 读取（已完成）

- sidecar `/v0/management/gettokens/quota-status` 新增多 key 读取路径：
  - `account_key=<single>` 保持旧单对象响应，兼容旧调用方。
  - `account_keys=a,b` 或多值 `account_key=a&account_key=b` 返回 `{"items":[...]}`。
  - 返回顺序跟请求 key 顺序一致；缺失 key 返回 `status=stale` 的空窗口状态。
- GetTokens 父仓新增 `cliproxyapi.GetQuotaStatuses(accountKeys)`、`wailsapp.GetQuotaStatuses(accountKeys)`、root `main.App.GetQuotaStatuses(accountKeys)` 和 Wails 生成绑定。
- 前端 `syncCodexQuotaStatuses` 改为优先调用 `GetQuotaStatuses(quotaKeys)`，失败时回退 `GetAllQuotaStatuses()`；返回结果仍按当前目标 key set 过滤，兼容老 sidecar 忽略 `account_keys` 时返回全量 `items` 的行为。

### Phase 3 性能数据

命令：`go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatus' -benchmem -count=3`

- `BenchmarkQuotaRuntimeStatusSnapshot1652Accounts`: `2.452-2.731 ms/op`, `~2.14-2.20 MB/op`, `4994 allocs/op`
- `BenchmarkQuotaRuntimeStatusTarget1Of1652Accounts`: `3.722-4.644 us/op`, `8210 B/op`, `32 allocs/op`
- `BenchmarkQuotaRuntimeStatusTarget10Of1652Accounts`: `17.125-17.943 us/op`, `~19.96 KB/op`, `75 allocs/op`
- `BenchmarkQuotaRuntimeStatusTarget100Of1652Accounts`: `108.413-194.758 us/op`, `~146.6-147.1 KB/op`, `440 allocs/op`
- `BenchmarkQuotaRuntimeStatusTarget1652Of1652Accounts`: `1.655-1.762 ms/op`, `~3.28 MB/op`, `6673-6674 allocs/op`

### Phase 3 已验证

- `go test ./internal/gettokenshooks -run 'TestQuotaRuntime' -count=1`
- `go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatus' -benchmem -count=3`
- `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
- `go test ./internal/cliproxyapi -count=1`
- `go test ./internal/wailsapp -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `./scripts/wails-cli.sh build`

## 2026-06-09 Phase 4：主动刷新后台任务化（已完成）

- sidecar 新增 quota batch refresh job API：
  - `POST /v0/management/gettokens/quota-refresh-batch/jobs`：提交任务后立即返回 `job_id`、`pending/running` 进度字段。
  - `GET /v0/management/gettokens/quota-refresh-batch/jobs/:job_id`：读取 `pending/running/succeeded/failed`、逐账号 `items/errors`、时间戳。
  - job 状态为 sidecar 进程内 runtime 状态；sidecar 重启后旧 job 不恢复，查询返回 `404`，不假装完成。
- GetTokens 父仓新增 `StartQuotaRefreshBatchJob` / `GetQuotaRefreshBatchJob` client 方法、`StartCodexQuotasBatchRefreshJob` / `GetCodexQuotaBatchRefreshJob` Wails/root 绑定和生成后的前端绑定。
- 前端 selected bulk refresh 改为 job 优先：先 `StartCodexQuotasBatchRefreshJob`，再轮询 `GetCodexQuotaBatchRefreshJob`；只有 job 提交失败时才 fallback 到旧 `RefreshCodexQuotasBatch` 同步路径，避免 job 已启动后重复刷新。
- 慢上游验收：`TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream` 用阻塞的 `httptest` upstream 验证提交 job 在 `500ms` 内返回 `202/job_id`，后台 job 继续运行，释放 upstream 后完成为 `succeeded`。

### Phase 4 性能与回归数据

- `BenchmarkQuotaRefreshBatch1652Accounts`: `52.71 ms/op`, `8.68 MB/op`, `162286 allocs/op`
- `BenchmarkQuotaRefreshBatchTargetAccounts/targets_1_total_1652`: `76.18 us/op`, `14.21 KB/op`, `177 allocs/op`
- `BenchmarkQuotaRefreshBatchTargetAccounts/targets_10_total_1652`: `837.40 us/op`, `58.45 KB/op`, `1091 allocs/op`
- `BenchmarkQuotaRefreshBatchTargetAccounts/targets_100_total_1652`: `4.09 ms/op`, `519.53 KB/op`, `9939 allocs/op`
- `BenchmarkQuotaRefreshBatchTargetAccounts/targets_1652_total_1652`: `45.82 ms/op`, `8.67 MB/op`, `162261 allocs/op`
- `BenchmarkQuotaRefreshSingleLoop1652Accounts`: `138.24 ms/op`, `19.85 MB/op`, `275653 allocs/op`

### Phase 4 已验证

- `go test ./internal/api/handlers/management -run 'TestQuotaRefreshBatchJobCompletesWithErrors|TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream' -count=1`
- `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
- `go test ./internal/cliproxyapi ./internal/wailsapp . -count=1`
- `go test ./internal/api/handlers/management -run '^$' -bench 'BenchmarkQuotaRefresh' -benchmem -benchtime=100ms -count=1`
- `go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatus' -benchmem -count=3`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `./scripts/wails-cli.sh build`

## 2026-06-09 Phase 4.1：删除与关闭时取消刷新任务（已完成）

- sidecar quota batch refresh job 新增 `canceled` 终态，并为每个 job 保存 cancelable context。
- 单账号删除和批量删除成功后，会取消包含被删 `account_key` 的 pending/running quota refresh job，避免已经删除的账号继续发 quota curl。
- `Server.Stop` 会调用 `CancelQuotaRefreshBatchJobs("server shutdown", ...)` 取消所有 pending/running job，避免关闭 App 时 sidecar 被后台刷新请求拖住。
- `refreshAccountQuotaBatch` 在每个账号发起真实刷新前会重新读取 account store，确认账号仍存在且未 soft delete；已删除账号会变成 per-account error，不再继续请求上游。
- 前端 `isQuotaBatchRefreshJobComplete` 把 `canceled` 视为终态，轮询不会卡在已取消任务上。
- 2026-06-09 dev 验收追加发现：`wails dev` 会重新打包 `build/bin/GetTokens.app`，但原脚本只在 `build` 命令后安装 sidecar，可能导致 dev bundle 内 `cli-proxy-api` 与 `build/bin/cli-proxy-api` 不一致。已在 `scripts/wails-cli.sh` 的 dev watcher 中同步安装 sidecar，避免本仓 dev App 误加载旧 sidecar。

### Phase 4.1 已验证

- `go test ./internal/api/handlers/management -run 'TestQuotaRefreshBatchJobCancelsWhenTargetAccountIsDeleted|TestQuotaRefreshBatchJobStoreCancelAllStopsRunningJobs|TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream|TestQuotaRefreshBatchJobCompletesWithErrors' -count=1`
- `go test ./internal/api/handlers/management -run 'TestQuotaRefresh|TestAccountsBatchDelete|TestAccountsCRUD' -count=1`
- `go test ./internal/api -count=1`
- `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
- `go test ./internal/cliproxyapi -run 'TestUnifiedAccountsClientCRUDStatusAndPriority|TestQuota' -count=1`
- `go test ./internal/wailsapp -run 'Test.*Quota|TestDeleteAccountsBatchUsesBatchManagementAPI' -count=1`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- 2026-06-09 追加：`./scripts/ensure-sidecar.sh darwin arm64` 确认 `build/bin/cli-proxy-api` 为 `6cb40578`；手动同步 dev bundle 后 `shasum` 一致；重启 dev 后 `~/.config/gettokens-dev/sidecar.log` 显示 `CLIProxyAPI Version: v7.1.28-98-g6cb40578, Commit: 6cb40578`。
- 2026-06-09 追加：`bash -n scripts/wails-cli.sh scripts/ensure-sidecar.sh scripts/build-sidecar.sh`、`go test ./internal/sidecar -run 'TestResolveBinaryCandidatesPrefersFreshBuildBinInDev|TestReadBinaryGitHashReadsAdjacentMetadata'`、`go test ./internal/api/handlers/management -run 'TestQuotaRefreshBatchJobCancelsWhenTargetAccountIsDeleted|TestQuotaRefreshBatchJobStoreCancelAllStopsRunningJobs'` 均通过。
- 2026-06-09 追加：Browser/Playwright 打开 `http://localhost:34115/#frame=accounts`，账号页渲染 `226 UNITS`，DOM 中 `data-account-card=20`，窗口化渲染仍生效；console 仍有一个 usage sync `404`，已记录为非本轮问题。

## 2026-07-07 Phase 2.1：2000+ 账号滚动 CPU 热路径收窄（已完成）

### 主流方案调研

- 主流虚拟列表方案优先从“只渲染可视窗口 + overscan”入手，典型库包括 TanStack Virtual 与 react-window；React 官方性能建议则要求用 `useMemo`/`memo` 避免昂贵计算和无意义重渲染；CSS `content-visibility` 只能作为浏览器布局/绘制辅助，不替代 React 侧窗口化。
- GetTokens 账号页已有 `AccountGroupSectionView` 自研分组窗口化，本轮不新增依赖，先沿用当前虚拟窗口模型，收窄滚动时仍会反复执行的分组头部聚合计算。

参考：
- https://tanstack.com/virtual/latest/docs/framework/react/react-virtual
- https://react-window.vercel.app/
- https://react.dev/reference/react/useMemo
- https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility

### 证据

- 2026-07-07 复跑 2000 preview：`ACCOUNTS_PREVIEW_COUNT=2000 ACCOUNTS_SCALE_MAX_RENDERED_CARDS=220 node docs-linhay/scripts/accounts-scale-browser-check.mjs`。
- 结果：首屏实际渲染 `41` 张账号卡，滚动后 `56` 张，`totalPreviewAccounts=2000`，`virtualizedGroups=2`，说明 DOM 节点数量没有退化成 2000。
- 代码热路径：`AccountGroupSectionView` 在每次虚拟窗口滚动更新时重新执行 `group.accounts.every(...)`、`resolveBulkQuotaRefreshTargets(group.accounts)`、`resolveBulkSetDisabledTargets(group.accounts, ...)` 和 `resolveBulkDeleteTargets(group.accounts)`。在 2000+ 大分组下，这些分组头部动作可用性扫描与滚动位置无关，却会跟着 `renderMetrics` state 重算。

### 修复

- 新增 `resolveAccountGroupActionAvailability()`，用一次模型扫描汇总 `hasAccounts / allGroupSelected / canRefreshGroup / canEnableGroup / canDisableGroup / canDeleteGroup`。
- `AccountGroupSectionView` 用 `useMemo(() => resolveAccountGroupActionAvailability(group.accounts, selectedAccountIDSet), [group.accounts, selectedAccountIDSet])` 缓存分组动作状态，滚动窗口变化时不再重复扫全组账号。
- 保持原有虚拟窗口和分组动作语义：删除、刷新、启用/禁用仍按 `group.accounts` 作为操作范围。

### 已验证

- 红灯：新增源码守护后，旧代码缺少 `resolveAccountGroupActionAvailability`，`node --test frontend/src/features/accounts/tests/accountListLayout.test.mjs` 失败。
- 绿灯：`node --test frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
- `npm --prefix frontend run typecheck`
- `ACCOUNTS_PREVIEW_COUNT=2000 ACCOUNTS_SCALE_MAX_RENDERED_CARDS=220 node docs-linhay/scripts/accounts-scale-browser-check.mjs`
