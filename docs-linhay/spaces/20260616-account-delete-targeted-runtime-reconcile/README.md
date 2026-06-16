# 账号删除单点运行态收口

## 背景

用户指出：单个账号删除从产品语义上应是单点操作，不应因为删除后的全局 account-store reconcile 抖动而影响其他账号。

当前 sidecar 删除链路是：

```text
DELETE /v0/management/accounts/:account_key
-> SQLite soft delete
-> triggerAccountStoreApply()
-> refreshAccountStoreAuths()
-> 全量读取 account-store 并同步 AuthManager / ModelRegistry / scheduler
```

2026-06-16 现场问题已经证明：删除触发全局刷新时，如果 SQLite 短读 / I/O 错误被处理不当，会把其他 Codex runtime auth 一起打掉，最终所有 Codex 会话返回：

```text
503 auth_unavailable: no auth available (providers=codex, model=gpt-5.5)
```

上一轮止血已修复“读失败不得当空库 prune”。本轮进一步收口产品语义：单个删除主路径必须先按被删 `account_key` 做 targeted runtime removal；全局 reconcile 继续保留，但只能作为后台校准 / 自愈，不再承担删除即时生效的唯一职责。

## 目标

1. 新增 account-store delete targeted hook，让 management 删除接口把被删 `account_key` 传给 runtime 层。
2. sidecar runtime 层按 `account_key` 找到并移除/禁用对应 account-store auth，清理其模型注册、live sessions、websocket pin，并推进 session affinity pool epoch。
3. 保留全局 reconcile，但降级为删除后的校准步骤；它失败不得阻止 SQLite soft-delete 已成功的用户操作。
4. 用 focused tests 覆盖单删和批量删除主路径。

## 范围

- CLIProxyAPI sidecar management delete handlers。
- CLIProxyAPI embedded/no-watcher runtime auth removal。
- 删除后 Codex routeability / scheduler / model registry 的 focused regression。
- 项目文档、memory 与领域 skill 沉淀。

## 非目标

- 不改变 SQLite soft-delete 语义。
- 不触碰正式版 `/Applications/GetTokens.app`。
- 不在前端/Wails 层伪造删除完成状态。
- 不重做 account-store cleanup worker 或 hard-delete retention。

## 证据门禁

- 问题来源：用户追问“单个账号删除不是单点操作吗？”并要求开 space 修复。
- 代码事实位置：
  - `internal/api/handlers/management/accounts_store.go`：`DeleteAccount` / `DeleteAccountsBatch` 只触发全量 `accountStoreApply` hook。
  - `sdk/cliproxy/service.go`：`refreshAccountStoreAuthsWithoutWatcher` 负责按 account-store 全量 desired 集合同步 runtime auth。
  - `sdk/cliproxy/service.go`：已有 `applyCoreAuthRemoval(ctx, id)`，但删除 handler 当前不知道被删账号对应的 runtime auth id。
- 当前现象：删除单个账号后依赖全量 refresh 才能移除 runtime；全量 refresh 出错时曾影响其他账号。
- 预期验收：删除一个账号后，被删账号的 runtime auth / model registry / session affinity / Codex websocket/live session 立即按单点移除；其他账号 runtime auth 和模型注册保持不变。全局 reconcile 失败只能产生诊断，不得改变其他账号可路由状态。
- 反证条件：若删除 A 后 B 的 `gpt-5.5` registry 消失、B 被 disabled，或删除主路径只能靠全量 `refreshAccountStoreAuths()` 才能生效，均视为未满足。

## BDD 场景

### 场景 1：删除单个 Codex 账号只移除该账号 runtime

Given 运行态存在两个 account-store Codex API key 账号 A 与 B，二者都注册了 `gpt-5.5`
When 用户删除账号 A
Then sidecar 应立即移除 A 的 runtime auth 与模型注册
And B 的 runtime auth 保持 active
And B 仍支持 `gpt-5.5`
And session affinity pool epoch 被推进

### 场景 2：删除后全局 reconcile 失败不影响其他账号

Given 删除账号 A 后 targeted runtime removal 已完成
When 后续全局 account-store reconcile 因 SQLite 读失败返回错误
Then 删除接口仍不应把 B 清空或禁用
And B 的模型 registry 保持可路由
And 错误只作为 account-store 诊断/日志暴露

### 场景 3：批量删除只移除成功删除的账号

Given 运行态存在 A、B、C 三个 account-store auth
When 批量删除请求中 A、B 删除成功，C 不在成功列表
Then targeted removal 只处理 A、B
And C 保持 active / routeable

## 验收标准

- sidecar 新增 targeted account-store delete hook，并被 `DeleteAccount` / `DeleteAccountsBatch` 调用。
- `Service` 新增按 `account_key` 的 targeted removal，覆盖多个 runtime auth 映射同一账号的情况。
- 删除 targeted removal 会清理模型 registry、Codex live sessions / websocket sessions，并推进 pool epoch。
- focused Go tests 覆盖删除 targeted removal 与 account-store 读失败不清空其他账号。
- 文档与 memory 写回，`docs-linhay/scripts/check-docs.sh` 通过。

## 实施记录

2026-06-16：

- `internal/api/handlers/management` 新增 `accountStoreDelete` hook 与 server setter。
- `DeleteAccount` 在 SQLite soft-delete 成功后先触发 targeted delete hook，再触发原有全量 apply。
- `DeleteAccountsBatch` 只对成功删除的 account keys 触发 targeted delete hook；无成功项时不触发。
- `sdk/cliproxy.Service.applyAccountStoreDelete()` 按 `account_key` 只移除命中的 account-store runtime auth，保留其他账号的 runtime auth 与模型注册。
- 全量 account-store apply / reconcile 仍保留为删除后的校准路径，但不再承担单个删除即时生效的唯一职责。

## 验证结果

- `go test ./sdk/cliproxy -run 'TestServiceApplyAccountStoreDeleteRemovesOnlyTargetAccounts' -count=1`
- `go test ./internal/api/handlers/management -run 'TestAccountsCRUDEndpointsPreserveAccountKeyOnPatch|TestAccountsBatchDeleteEndpointDeletesMultipleAccountsWithOneApply' -count=1`
- `go test ./sdk/cliproxy -run 'TestServiceRefreshAccountStoreAuthsWithoutWatcherRegistersCodexAPIKeyModels|TestServiceRefreshAccountStoreAuthsWithoutWatcherPreservesRuntimeOnStoreReadError|TestServiceApplyAccountStoreDeleteRemovesOnlyTargetAccounts|TestServiceReconcileAccountStoreRouteabilityRepairsMissingRegistryModels|TestServiceReconcileAccountStoreRouteabilityRepairsDegradedRuntimeAuth' -count=1`
- `go test ./internal/watcher/synthesizer ./internal/gettokens/accountstore ./internal/api/handlers/management -count=1`
- `./scripts/ensure-sidecar.sh darwin arm64`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- 本轮为当天可闭环的短修复，使用主工作区完成，未创建独立 feature worktree。
- 若后续继续扩展删除后的 cleanup worker 或 ready gating，可使用推荐映射：
  - branch：`feat/20260616-account-delete-targeted-runtime-reconcile`
  - worktree：`../GetTokens-worktrees/20260616-account-delete-targeted-runtime-reconcile/`

## 相关链接

- 技术主线：[Account Store Runtime Routeability](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-account-store-runtime-routeability.md)

## 当前状态

- 状态：implemented
- 最近更新：2026-06-16
