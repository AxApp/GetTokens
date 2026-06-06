# 账号级运行态自动同步执行计划 v01

## 目标边界

本计划交付账号池页面的账号级 runtime sync：前端自动读取 sidecar 已维护的账号运行态，并按账号合并到卡片展示。自动同步不得主动触发远端 quota curl；只有用户显式刷新动作才允许走主动刷新链路。

## 当前事实

1. 账号 inventory 当前由 `useAccountsPageState.loadAccounts()` 调用 `ListAuthFiles` + `ListAccounts` 获取。
2. 首屏加载由 `shouldEnsureAccountSnapshot({ ready, loaded, loading })` 控制，加载过后不会自动重新 `ListAccounts()`。
3. `useAccountsQuotaState.loadCodexQuotas()` 当前调用 `GetCodexQuota`，Wails 后端对统一账号会进一步调用 sidecar `RefreshQuota`，这不是纯同步。
4. sidecar management client 已有只读接口：
   - `GetAllQuotaStatuses`
   - `GetQuotaStatus`
   - `GetAllRateLimitStatuses`
   - `GetRateLimitStatus`
5. Wails root 当前尚未透出 quota runtime status 的只读方法；rate-limit 已有 bridge。

## 设计决策

1. **runtime sync 与 inventory reload 分离**
   - runtime sync 更新 quota、rate-limit、usage 等账号级状态。
   - inventory reload 只处理账号资产集合变化、账号基础字段变化、用户 mutation 后回读。
2. **自动同步只读 sidecar runtime**
   - 自动任务调用只读 status API。
   - 不调用 `GetCodexQuota`。
   - 不调用 sidecar `RefreshQuota`。
3. **用户显式刷新保留主动刷新能力**
   - 单卡刷新、分组刷新、顶部刷新可继续触发用户可见刷新反馈。
   - 具体刷新链路仍可调用现有 `refreshCodexQuota`、`refreshAccountUsage`、`refreshAccountRateLimits`。
4. **调度条件收窄**
   - 仅在 `ready && hasWailsBindings && accounts.length > 0` 时调度。
   - 页面不可见时暂停。
   - 页面恢复可见时静默同步一次。
5. **最小新增后端面**
   - 只补 Wails bridge，不新增 sidecar endpoint。
   - 如果实现中发现 sidecar 已有 endpoint 信息不足，再单独评估 sidecar schema 扩展。

## BDD 场景

### 场景 1：quota runtime 自动同步

Given 账号池页面已加载账号 A  
And sidecar `quota-status` 中账号 A 的状态已更新  
When runtime sync 触发  
Then 账号 A 卡片展示最新 quota 窗口、余额或 stale 状态  
And 不触发远端 quota curl  
And 不显示整页 loading

### 场景 2：rate-limit runtime 自动同步

Given 账号池页面已加载账号 A  
And sidecar rate-limit status 中账号 A 进入 blocked 或 usage 增长  
When runtime sync 触发  
Then 账号 A 的 Route Guard 区域展示最新状态  
And 不重新加载账号列表

### 场景 3：usage 静默同步

Given 账号池页面已加载账号 A  
And sidecar usage attribution 产生新请求记录  
When runtime sync 触发  
Then 账号 A 的 usage 活动数据更新  
And 不出现周期性扫光动画

### 场景 4：显式刷新仍有反馈

Given 账号池页面已加载账号 A  
When 用户点击账号 A 的刷新按钮  
Then quota、usage、rate-limit 均可显式刷新  
And 对应区域显示刷新反馈

### 场景 5：页面可见性控制

Given 账号池页面已加载账号  
When 浏览器页面不可见  
Then runtime sync 暂停  
When 页面重新可见  
Then 立即执行一次静默 runtime sync

### 场景 6：inventory 变化走回读

Given 页面账号集合为 A、B  
When 外部新增账号 C 或删除账号 B  
Then 运行态同步不负责伪造账号资产  
And 通过现有 `loadAccounts()` / mutation 回读刷新 inventory

## TDD 切片

### Slice 1：模型与测试先行

新增或扩展前端纯函数测试：

1. `shouldScheduleAccountRuntimeSync`
   - ready=false 不调度
   - 无 Wails binding 不调度
   - accounts 为空不调度
   - document hidden 不调度
2. `shouldRunRuntimeSyncOnVisibilityRestore`
   - 从 hidden 回到 visible 时允许一次同步
3. `buildRuntimeSyncAccountKeys`
   - 只收集有 `id/accountKey/quotaKey` 的账号
   - 去重且保持稳定顺序

建议测试文件：

```bash
frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs
```

### Slice 2：Wails quota runtime 只读桥接

后端新增：

1. `internal/wailsapp/quota.go`
   - `GetAllQuotaStatuses() ([]cliproxyapi.QuotaRuntimeState, error)`
   - `GetQuotaStatus(accountKey string) (*cliproxyapi.QuotaRuntimeState, error)`
2. `app.go`
   - root `main.App` 透出同名方法。
3. 必要时 `app_types.go`
   - 若不能直接复用生成类型，则增加 DTO 映射。

测试：

```bash
go test ./internal/wailsapp ./internal/cliproxyapi
```

测试重点：

1. 只读方法调用 `GET /v0/management/gettokens/quota-status`。
2. 不调用 `POST /v0/management/gettokens/quota-refresh/:account_key`。
3. 空 items 返回空数组而非 nil 语义漂移。

### Slice 3：前端 quota sync 拆分

修改 `useAccountsQuotaState`：

1. 新增 `syncCodexQuotaStatuses(accounts, options?)`。
2. 自动同步路径使用 `GetAllQuotaStatuses`。
3. 将 sidecar `QuotaRuntimeState` 映射为现有 `CodexQuotaState` / `CodexQuotaResponse` 展示结构。
4. `refreshCodexQuota(account)` 保持显式刷新语义，仍可调用 `GetCodexQuota`。
5. 后台 sync 不进入 `beginQuotaRefreshState`，避免周期性扫光。

测试重点：

1. 自动 sync source 中不得出现 `GetCodexQuota`。
2. 显式 refresh 路径仍保留 `GetCodexQuota`。
3. stale / error runtime state 能保留诊断信息。

### Slice 4：账号级 runtime sync loop

接入位置二选一：

1. 若只涉及账号页 UI，放在 `AccountsFeature.tsx`。
2. 若要共享给 import page / detail context，放在 `useAccountsPageState.ts` 并由 provider 管理。

推荐先放在 `AccountsFeature.tsx`，因为当前 usage sync loop 已在该文件，变更面更小。

同步内容：

1. `syncCodexQuotaStatuses(accounts)`
2. `loadAccountUsage(accounts, { merge: true })`
3. `loadAccountRateLimits(accounts)`

调度：

1. interval：30 秒。
2. document hidden 时不执行。
3. `visibilitychange` 回到 visible 时立即执行一次。
4. sync 失败只记录 console/debug，不清空已有卡片状态。

### Slice 5：显式刷新链路回归

确认以下路径仍显示刷新反馈：

1. 单卡刷新。
2. 分组刷新。
3. 顶部刷新。
4. 详情页内刷新或规则保存后刷新。

现有 source-level 测试需要继续覆盖：

```bash
node --test frontend/src/features/accounts/tests/rateLimit.test.mjs
```

### Slice 6：桌面验收与文档写回

1. 运行自动化门禁。
2. 启动 dev app，确认 sidecar ready。
3. 打开账号池页面，观察 runtime sync。
4. 手动刷新对比自动同步反馈差异。
5. 将验收记录写回本 README。
6. 如产生可复用模式，更新项目 skill；仅当形成 repo-wide 长期规则时才更新 `AGENTS.md`。

## 验证命令

前端 focused tests：

```bash
node --test \
  frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs \
  frontend/src/features/accounts/tests/accountSnapshot.test.mjs \
  frontend/src/features/accounts/tests/rateLimit.test.mjs \
  frontend/src/features/accounts/tests/accountInventoryBoundary.test.mjs
```

Go focused tests：

```bash
go test ./internal/wailsapp ./internal/cliproxyapi
```

绑定或共享类型变化后：

```bash
./scripts/wails-cli.sh generate module
npm --prefix frontend run typecheck
```

最终建议门禁：

```bash
go test ./...
npm --prefix frontend run test:unit
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
```

## 风险与回滚

1. **风险：自动同步频率过高**
   - 缓解：只读 runtime status，30 秒间隔，页面隐藏暂停。
   - 回滚：移除 runtime sync loop，保留 Wails 只读方法不影响现有刷新链路。
2. **风险：quota runtime state 到现有 quota display 映射不完整**
   - 缓解：先覆盖 success / stale / empty / billing 四类最小展示；保留原始 sources 作为诊断。
   - 回滚：自动 sync 只更新 rate-limit / usage，quota 继续手动刷新。
3. **风险：inventory 变化被误当 runtime 变化**
   - 缓解：runtime sync 不创建/删除账号卡；账号集合变化继续由 `loadAccounts()` 处理。
   - 回滚：禁用 inventory fallback，只保留本页面 mutation 后回读。

## 当前状态

- 状态：implemented
- 最近更新：2026-06-06

## 完成记录

2026-06-06 已按 Slice 1-5 完成实现，并完成自动化门禁：

1. Slice 1：新增 `accountRuntimeSync` 模型与测试。
2. Slice 2：新增 Wails quota runtime 只读桥接与 Go 测试。
3. Slice 3：拆分 quota 自动同步与显式刷新。
4. Slice 4：`useAccountsPageState` 接入统一账号级 runtime sync loop。
5. Slice 5：显式刷新链路回归保持通过。
6. Slice 6：已完成自动化验证、dev Wails 桌面冷启动验收与文档写回。
7. 后台 usage sync 已收窄为 sidecar attribution 只读同步，不做账号解析 `/accounts`，也不 fallback 旧 `/usage`。
