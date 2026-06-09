# 账号池规模优化实施计划 v01

## 目标
- 在 `1652` 账号基线下继续降低账号池运行态同步、批量刷新和页面渲染成本。
- 每一期独立可合并，不依赖后续阶段才能可用。
- 所有优化先有可复跑性能或 DOM 证据，再进入实现。

## 基线
- 批量读 runtime snapshot：`5.70ms/op`。
- batch 主动刷新：`52.14ms/op`。
- 旧逐账号循环：`102.91ms/op`。
- batch 相比旧逐账号循环：约 `1.97x` 更快，分配约下降 `56%`。
- 2026-06-09 复测：`BenchmarkQuotaRefreshBatch1652Accounts` 为 `31.55ms/op`，旧逐账号 loop 为 `74.88ms/op`。

## Phase 0.5：批量 mutation 请求收敛（已完成）

### 范围
- 选中批量删除从前端循环单删改成一次 Wails/root 调用。
- sidecar 新增 `POST /v0/management/accounts/batch-delete`，在 account store 内单事务处理多个 `account_keys`。
- 批量删除返回 `deleted_account_keys / errors / succeeded / failed`，前端只 reload accounts 一次。

### 验收
1. `runSelectedBulkDelete` 不再调用 `executeDeleteAccount` 循环。
2. Wails/root 绑定存在 `DeleteAccountsBatch` 和 `DeleteAccountsBatchInput`。
3. sidecar handler 只触发一次 account-store apply。
4. 部分失败时成功项仍被删除，失败项进入错误汇总。

### 已验证
- `go test ./internal/gettokens/accountstore -run 'TestDeleteAccounts' -count=1`
- `go test ./internal/api/handlers/management -run 'TestAccountsBatchDelete|TestAccountsCRUD' -count=1`
- `go test ./internal/wailsapp -run 'TestDeleteAccountsBatchUsesBatchManagementAPI|TestUnifiedCodexAPIKeyMutationsDoNotFallbackToLegacyOnAccountStoreErrors' -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
- `npm --prefix frontend run typecheck`

## Phase 1：sidecar 按 keys 查询账号（已完成）

### 范围
- 在 `accountstore.Store` 增加 `GetAccounts(ctx, accountKeys []string)` 或同等按 keys 批量查询能力。
- `RefreshAccountQuotaBatch` 改为按请求中的 `account_keys` 查询目标账号，不再 `ListAccounts` 全表扫描。
- 保留去重、部分失败、顺序稳定和 `items/errors` 语义。

### 验收
1. 小批量 batch benchmark 覆盖：总账号数 `1652`，目标账号数 `1/10/100/1652`。
2. 小批量目标 `1/10` 的耗时不随总账号数线性增长。
3. 全量目标 `1652` 不低于当前 batch 基线，或若略有退化必须说明原因并保留当前方案。
4. `GetAccounts` 单测覆盖缺失 key、重复 key、不同账号类型、损坏 sibling credential 不影响目标查询。

### 测试命令
- `go test ./internal/gettokens/accountstore -run 'Test.*GetAccounts' -count=1`
- `go test ./internal/api/handlers/management -run 'TestQuotaRefresh.*Batch' -count=1`
- `go test ./internal/api/handlers/management -run '^$' -bench 'BenchmarkQuotaRefresh.*Accounts' -benchtime=10x -count=5`

### 实施记录

- `accountstore.Store.GetAccounts(ctx, accountKeys)` 已落地，`RefreshAccountQuotaBatch` 使用按 keys 查询替代全表读取后过滤。
- 已新增 `quota_refresh_benchmark_test.go`，覆盖 `1 / 10 / 100 / 1652` 目标账号规模。
- 2026-06-09 性能 smoke：
  - target 1: `178750 ns/op`
  - target 10: `628542 ns/op`
  - target 100: `1938333 ns/op`
  - target 1652: `39769167 ns/op`
  - batch 1652: `26017875 ns/op`
  - old single loop 1652: `59085541 ns/op`
- 已验证：`go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`

## Phase 2：账号页虚拟化和渲染基线（已完成）

### 范围
- 先补无头浏览器 DOM/性能检查：1652 账号 preview 数据下统计账号卡片节点数量、首屏渲染时间、滚动后节点复用情况。
- 引入桌面端虚拟列表或按分组折叠/窗口化渲染，保留搜索、过滤、分组、选择、批量操作、详情 hash 恢复。
- 只做桌面 Wails/浏览器预览验收，不做移动端适配。

### 验收
1. 1652 账号数据下，DOM 中 `data-account-card` 节点数量受可视窗口和 overscan 限制，不一次性等于账号总数。
2. 滚动到 TEAM/PLUS/API KEY 分组后，分组标题、卡片操作、选择状态和详情 modal 仍可用。
3. 搜索/过滤/排序后虚拟列表索引和选中状态不串位。
4. 无头浏览器截图和 DOM 断言写入本 space `screenshots/`。

### 测试命令
- `node --test frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- 新增 `docs-linhay/scripts/accounts-scale-browser-check.mjs`

### 实施记录

- 确认账号页已有窗口化渲染：`AccountGroupSectionView.tsx` + `accountListLayout.ts`。
- 新增 `docs-linhay/scripts/accounts-scale-browser-check.mjs`，以 1652 preview 账号执行无头浏览器 DOM 验收并归档截图。
- 2026-06-09 DOM 验收：
  - 总账号数：`1652`
  - 首屏卡片节点：`41`
  - 滚动后卡片节点：`53`
  - virtual window：`plan:pro 0:15 -> 1071:1098`
  - 内部滚动容器：`scrollTop=161730`
- 截图：
  - `../screenshots/20260609/accounts-scale/20260609-accounts-scale-initial-baseline-v01.png`
  - `../screenshots/20260609/accounts-scale/20260609-accounts-scale-scrolled-baseline-v01.png`
- 已验证：
  - `node --test frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`

## Phase 3：runtime quota snapshot 增量读取（已完成）

### 范围
- sidecar `/v0/management/gettokens/quota-status` 支持 `account_key` 多值或 `account_keys` 参数。
- 可选：引入 `generation` / `updated_since`，前端只拉变化项。
- 前端 `syncCodexQuotaStatuses` 根据可见/目标账号 keys 拉取局部状态；全局同步保留 fallback。

### 验收
1. 按 keys 读取返回顺序稳定，缺失账号返回 stale empty state 或明确缺失语义。
2. 1652 账号全量读取性能不退化，小范围 keys 读取明显低于全量 snapshot。
3. 老 sidecar 不支持新参数时，前端可回退到全量 `GetAllQuotaStatuses`。

### 测试命令
- `go test ./internal/gettokenshooks -run 'TestQuotaRuntimeRoutes' -count=1`
- `go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatus.*Accounts' -benchtime=30x -count=5`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`

### 实施记录

- sidecar `/v0/management/gettokens/quota-status` 支持 `account_keys=a,b` 和多值 `account_key=a&account_key=b`，批量响应为 `{"items":[...]}`。
- 单个 `account_key` 保持旧单对象响应，避免破坏已有 `GetQuotaStatus` 调用。
- 父仓新增 `GetQuotaStatuses(accountKeys)`，使用 `account_keys` 参数统一拿 `items`；前端 `syncCodexQuotaStatuses` 优先按当前目标 `quotaKeys` 读取，失败时回退全量 `GetAllQuotaStatuses`。
- 2026-06-09 benchmark：
  - full 1652 snapshot: `2.452-2.731 ms/op`
  - target 1: `3.722-4.644 us/op`
  - target 10: `17.125-17.943 us/op`
  - target 100: `108.413-194.758 us/op`
  - target 1652: `1.655-1.762 ms/op`
- 已验证：
  - `go test ./internal/gettokenshooks -run 'TestQuotaRuntime' -count=1`
  - `go test ./internal/gettokenshooks -run '^$' -bench 'BenchmarkQuotaRuntimeStatus' -benchmem -count=3`
  - `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
  - `go test ./internal/cliproxyapi -count=1`
  - `go test ./internal/wailsapp -count=1`
  - `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
  - `./scripts/wails-cli.sh build`

## Phase 4：主动刷新后台任务化（已完成）

### 范围
- 新增 sidecar batch refresh job API：提交任务立即返回 `job_id`，读取进度和结果。
- 前端批量刷新展示进度、成功/失败汇总和可取消/可重试策略。
- 单卡刷新仍可保持同步单账号请求，除非实测也需要 job 化。

### 验收
1. 真实上游 quota curl 慢请求不会阻塞 Wails 单次调用直到整批结束。
2. 任务进度可展示 `pending/running/succeeded/failed` 和逐账号错误摘要。
3. app 关闭或 sidecar 重启后的 job 状态语义明确：丢弃、恢复或标记 stale，不能假装完成。

### 测试命令
- `go test ./internal/api/handlers/management -run 'TestQuotaRefresh.*Job' -count=1`
- `go test ./internal/wailsapp -run 'TestRefreshCodexQuotas.*Job' -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs`

### 实施记录

- sidecar 新增 `POST /v0/management/gettokens/quota-refresh-batch/jobs` 和 `GET /v0/management/gettokens/quota-refresh-batch/jobs/:job_id`。
- job 状态字段包括 `pending/running/succeeded/failed`、`items/errors`、`created_at/updated_at/completed_at`；状态为进程内 runtime，不跨 sidecar 重启恢复。
- 父仓新增 job client、Wails/root 绑定和生成后的前端绑定。
- 前端 selected bulk refresh 优先提交 job 并轮询结果；旧同步 batch 仅作为 job 提交失败时的兼容 fallback。
- 慢上游验收 `TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream` 证明 job 提交不会等待 quota curl 完成。
- 2026-06-09 性能复测：
  - batch 1652: `52.71 ms/op`
  - target 1: `76.18 us/op`
  - target 10: `837.40 us/op`
  - target 100: `4.09 ms/op`
  - target 1652: `45.82 ms/op`
  - old single loop 1652: `138.24 ms/op`
- 已验证：
  - `go test ./internal/api/handlers/management -run 'TestQuotaRefreshBatchJobCompletesWithErrors|TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream' -count=1`
  - `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
  - `go test ./internal/cliproxyapi ./internal/wailsapp . -count=1`
  - `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSelection.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
  - `./scripts/wails-cli.sh build`

## Phase 4.1：刷新任务取消与账号生命周期绑定（已完成）

### 范围
- quota batch refresh job 必须有 cancelable context，不能用 detached `context.Background()` 执行真实刷新。
- 删除账号后取消所有命中该 `account_key` 的 pending/running job。
- sidecar shutdown 时取消全部 pending/running quota refresh job。
- worker 发起单账号 quota curl 前复核账号仍存在且未删除。
- 前端轮询把 `canceled` 当终态处理。

### 验收
1. 删除账号后，包含该账号的刷新 job 进入 `canceled`，不会继续请求已删除账号。
2. sidecar shutdown 能取消阻塞中的刷新请求，后台 job 不阻止进程退出。
3. 已启动 worker 在每个账号请求前重新确认账号存在，账号池快照不会成为“删除后仍请求”的依据。
4. 前端遇到 `canceled` job 不继续轮询。

### 实施记录
- `quotaRefreshBatchJobStore` 新增 job context/cancel 和 `canceled` 终态。
- `DeleteAccount` / `DeleteAccountsBatch` 在删除成功后调用 `cancelQuotaRefreshBatchJobsForAccountKeys`。
- `Server.Stop` 调用 management handler 的 `CancelQuotaRefreshBatchJobs`。
- `refreshAccountQuotaBatch` 使用 job context，并在 `refreshAccountQuotaRecord` 前调用 `ensureQuotaRefreshAccountStillActive`。
- `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts` 将 `canceled` 纳入 complete 状态。

### 已验证
- `go test ./internal/api/handlers/management -run 'TestQuotaRefreshBatchJobCancelsWhenTargetAccountIsDeleted|TestQuotaRefreshBatchJobStoreCancelAllStopsRunningJobs|TestQuotaRefreshBatchJobStartDoesNotWaitForSlowUpstream|TestQuotaRefreshBatchJobCompletesWithErrors' -count=1`
- `go test ./internal/api/handlers/management -run 'TestQuotaRefresh|TestAccountsBatchDelete|TestAccountsCRUD' -count=1`
- `go test ./internal/api -count=1`
- `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./internal/gettokenshooks -count=1`
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
- `go test ./internal/cliproxyapi -run 'TestUnifiedAccountsClientCRUDStatusAndPriority|TestQuota' -count=1`
- `go test ./internal/wailsapp -run 'Test.*Quota|TestDeleteAccountsBatchUsesBatchManagementAPI' -count=1`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

## 风险和取舍
- `GetAccountsByKeys` 可能需要小心保持不同 credential 表的 join/缺失错误语义，避免重新引入“损坏 sibling 影响目标账号”的问题。
- 虚拟化可能影响卡片高度测量、分组 sticky、批量选择和详情 hash 恢复，必须先用 DOM 检查锁住行为。
- 增量 snapshot 会增加前后端兼容分支，必须保留老 sidecar fallback。
- 后台任务化会引入状态生命周期，只有真实上游刷新耗时仍影响 UX 时再做。

## 推荐执行顺序
1. Phase 1：sidecar 按 keys 查询账号。
2. Phase 2：账号页虚拟化和渲染基线。
3. Phase 3：runtime quota snapshot 增量读取。
4. Phase 4：主动刷新后台任务化。
