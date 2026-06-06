# 账号级运行态自动同步

## 背景

账号池页面当前主账号列表是首屏快照模型：sidecar ready 后首次 `ListAccounts()`，之后主要依赖手动刷新或本页面内创建、删除、导入、OAuth 完成等 mutation 触发重新加载。用户观察到账号卡片不会自动更新，容易误判为账号池逻辑损坏。

排查结论是：列表加载逻辑没有坏，但前端把“读取账号级运行态”和“主动刷新远端额度”耦合得过紧。sidecar 已经维护账号级运行态面，例如 `quota-status`、`rate-limit-status`、usage attribution；账号池页面应同步这些运行态，而不是用页面级全量轮询去重复触发业务刷新。

## 目标

1. 账号池卡片自动同步 sidecar 已维护的账号级运行态。
2. 自动同步不得主动触发远端 quota curl、OAuth usage 探测或其他昂贵刷新。
3. 用户点击单卡、分组或顶部刷新时，才允许走显式刷新链路。
4. 运行态同步按 `accountKey` 合并到对应账号卡，避免重载整页列表和打断筛选、选择、详情 modal。
5. 当账号资产结构真的变化时，仍通过现有 `loadAccounts()` / `ListAccounts()` 路径刷新 inventory。
6. 形成可回归的 BDD/TDD 覆盖，防止后续把 runtime sync 退回成页面级全量刷新。

## 范围

### 前端

1. `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`
   - 拆分“同步 sidecar runtime quota 状态”和“用户显式刷新 quota”。
   - 自动同步只读 runtime status，不调用当前会触发 `RefreshQuota` 的 `GetCodexQuota`。
2. `frontend/src/features/accounts/hooks/useAccountsRateLimitState.ts`
   - 保持账号级 rate-limit status 同步语义。
   - 如有必要，将现有静默轮询统一纳入账号级 runtime sync 调度。
3. `frontend/src/features/accounts/hooks/useAccountsUsageState.ts`
   - 保持 usage attribution 静默同步。
   - 与 quota / rate-limit 的同步反馈区分：后台同步不显示扫光，用户显式刷新才显示。
4. `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 或 `AccountsFeature.tsx`
   - 接入账号级 runtime sync loop。
   - 只在 `ready && hasWailsBindings && accounts.length > 0` 时运行。
   - 页面隐藏时暂停，窗口重新可见时执行一次静默同步。
5. `frontend/src/features/accounts/model/`
   - 新增纯函数描述账号 runtime sync 的调度条件、签名与合并规则。

### Wails / 后端桥接

1. `internal/wailsapp/quota.go`
   - 新增只读 quota runtime status 方法，读取 sidecar `GetAllQuotaStatuses` / `GetQuotaStatus`。
   - 不触发 `RefreshQuota`。
2. `app.go` / `app_types.go` / `frontend/wailsjs`
   - root `main.App` 透出新增 Wails 方法并更新绑定。
3. 已有 rate-limit Wails bridge 继续复用：
   - `GetAllRateLimitStatuses`
   - `GetRateLimitStatus`
4. usage 继续复用已有 attribution / statistics bridge，优先使用 sidecar attribution。

### 文档与测试

1. 本 space README 与执行计划。
2. 前端模型测试、hook/source-level 回归测试。
3. Go bridge 测试。
4. 验收截图或桌面验收记录按需归档到 `screenshots/`。

## 非目标

1. 不做页面级 `ListAccounts()` 高频轮询。
2. 不把自动同步设计成远端 quota 刷新器。
3. 不新增 sidecar 主动推送事件，除非实现中确认现有只读 runtime status 无法满足需求。
4. 不改变账号创建、删除、导入、重登、禁用、排序等 inventory mutation 语义。
5. 不改动正式版 `/Applications/GetTokens.app`，验证默认在 dev 环境或本仓库构建产物中进行。
6. 不做移动端适配或移动端截图。

## 验收标准

### BDD 场景

1. Given 账号池页面已打开且 sidecar 为 ready，When sidecar 内某账号 quota runtime status 更新，Then 对应账号卡片在自动同步周期内展示新 quota 状态，且不触发远端 quota curl。
2. Given 账号池页面已打开，When sidecar 内某账号 rate-limit 状态变化，Then 对应卡片 Route Guard 区域自动更新。
3. Given 账号池页面已打开，When sidecar usage attribution 新增请求记录，Then 对应账号 usage 活动数据静默更新，不出现周期性扫光动画。
4. Given 用户点击单卡刷新，When 刷新执行，Then 可以显式触发 quota / usage / rate-limit 刷新，并显示对应刷新反馈。
5. Given 页面处于浏览器不可见状态，When runtime sync 到达调度时间，Then 自动同步暂停；When 页面重新可见，Then 执行一次静默账号级同步。
6. Given 外部新增或删除账号资产，When 账号 key 集合与页面快照不一致或本页面 mutation 完成，Then 通过 `loadAccounts()` 刷新 inventory。
7. Given sidecar 未 ready，When 进入账号池页面，Then 不发起账号 runtime sync 请求。

### 自动化门禁

1. 前端测试证明自动同步读取 runtime status，不调用 `GetCodexQuota`。
2. 前端测试证明后台 sync 不设置用户可见 refreshing 状态，显式刷新才设置。
3. Go 测试证明新增 Wails quota runtime status 方法只调用 management API 的只读 `quota-status`。
4. 现有 account snapshot、rate-limit、account inventory boundary 测试保持通过。

### 桌面验收

1. dev 环境启动后 sidecar 达到 `ready`。
2. 在账号池页面观察至少一个账号的 quota / rate-limit / usage 自动同步。
3. 手动刷新仍可触发显式刷新反馈。
4. 不出现整页 loading、筛选丢失、详情 modal 被关闭或选择状态被清空。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260606-account-runtime-sync`
- worktree：`../GetTokens-worktrees/20260606-account-runtime-sync/`
- 当前阶段：只写需求与执行计划，暂不创建 worktree；进入开发或并行执行时再创建。

## 相关链接

- 执行计划：`plans/implementation-plan-v01.md`
- 相关现状文件：
  - `frontend/src/features/accounts/hooks/useAccountsPageState.ts`
  - `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`
  - `frontend/src/features/accounts/hooks/useAccountsRateLimitState.ts`
  - `frontend/src/features/accounts/hooks/useAccountsUsageState.ts`
  - `internal/wailsapp/quota.go`
  - `internal/cliproxyapi/client.go`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-06

## 实施记录

2026-06-06 已完成第一版账号级 runtime sync：

1. Wails 新增只读 quota runtime bridge：
   - `GetAllQuotaStatuses()`
   - `GetQuotaStatus(accountKey)`
2. 前端 `useAccountsQuotaState` 已拆分：
   - `syncCodexQuotaStatuses`：自动/后台路径，只读 sidecar `quota-status`。
   - `refreshCodexQuota`：用户显式刷新路径，保留主动刷新能力。
3. `useAccountsPageState` 统一调度账号级 runtime sync：
   - 30 秒周期。
   - 浏览器预览页面隐藏时跳过请求；Wails 桌面运行态不被 WebView visibility 误判阻断。
   - 页面重新可见时立即静默同步一次。
   - 同步 quota、usage、rate-limit。
4. usage 后台同步增加 `resolveAccountKeys=false` 与 `fallbackUsageStatistics=false` 路径，自动 tick 只消费 sidecar 已有 attribution，不触发账号解析 `/accounts` 或旧 `/usage` fallback。
5. 移除 `useAccountsRateLimitState` 内部独立 30 秒轮询，避免重复调度。
6. 补充 `accountRuntimeSync` 模型与测试，锁定自动同步不调用 `GetCodexQuota`。
7. 同步调整账号详情 action source-level 断言冲突，保持只读模式不显示脚本 action。

## 验证记录

2026-06-06 已通过：

```bash
node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs
go test ./internal/wailsapp -run TestQuotaRuntimeBridgeCallsReadOnlyManagementAPI
go test ./internal/wailsapp ./internal/cliproxyapi
node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountSnapshot.test.mjs frontend/src/features/accounts/tests/rateLimit.test.mjs frontend/src/features/accounts/tests/accountInventoryBoundary.test.mjs
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
```

2026-06-06 已完成 dev Wails 桌面冷启动验收：

1. dev app 使用 `/Users/linhey/.config/gettokens-dev/config.yaml` 与 sidecar `18317`，正式版 `/Applications/GetTokens.app` 未被修改或停止。
2. 账号池页面进入 `#frame=accounts` 后显示 13 个账号，卡片 quota bar、Route Guard、usage 区域正常渲染。
3. sidecar log 连续出现 30 秒周期的只读请求：
   - `/v0/management/gettokens/quota-status`
   - `/v0/management/gettokens/rate-limit-status`
   - `/v0/management/gettokens/rate-limit-strategies`
   - `/v0/management/gettokens/usage-attribution?bucket=1h&include_unresolved=true&window=24h`
4. 冷启动首屏会做 inventory 初始化请求；后续自动 tick 未出现页面级 `/v0/management/accounts` 高频轮询，也未出现旧 `/v0/management/usage` fallback。
5. 顶部/卡片显式刷新仍显示用户可见扫光反馈，并保留主动刷新能力。
