# Phase 0 Current State Map

## 目的

在动代码前先把账号体系的真源、读写路径和副作用点画清楚，避免继续用局部补丁叠状态。

## 输出物

1. `docs-linhay/spaces/20260711-account-system-hardening/plans/account-state-ownership.md`
   - 资产态、运行态、展示态的所有权矩阵。
   - 每个字段的 canonical owner：account-store、sidecar runtime、Wails DTO、frontend view model。
2. `docs-linhay/spaces/20260711-account-system-hardening/plans/management-api-boundary.md`
   - management API 分类：read / command / reconcile / probe。
   - 标记所有读接口副作用和应迁移的 command。
3. `docs-linhay/spaces/20260711-account-system-hardening/plans/runtime-consistency-fixtures.md`
   - Codex OAuth plus/pro/free/team fixture。
   - Codex API key empty models fixture。
   - openai-compatible explicit models/alias fixture。
   - Claude auth-file fixture。
4. `docs-linhay/spaces/20260711-account-system-hardening/plans/wise-council-verdict.md`
   - 外部 advisor 裁决：sidecar 独占主 SQLite，App 共享账号契约而不是共享主库访问。
5. 第一批红灯测试清单。

## 调研清单

- [x] account-store 表结构与 migration：`auth_file_accounts`、`codex_api_key_accounts`、`openai_compatible_accounts`、`account_cards`、`account_runtime_apply_state`。
- [x] sidecar runtime apply：创建、更新、删除、启动刷新、watcher 刷新、management hook。
- [x] model registry：注册、清理、`/accounts/:id/models`、`/v1/models`、route explain/probe。
- [x] route guard 与 quota/rate-limit：哪些错误会写 runtime block，哪些只应是 evidence。
- [x] OAuth refresh：启动自动刷新、手动刷新、watcher、account-store token store 写回、并发路径。
- [x] Wails DTO：`ListAccounts`、`ListCodexAccountInventory`、`ListAuthFiles`、账号详情和模型目录。
- [x] App/sidecar DB 访问：确认 App 当前是否直接打开主 `accounts-v1.sqlite`；若存在，标记为 Phase 3 迁移候选。
- [x] 前端 cache：账号池首屏 localStorage 与 `ListCachedAccounts()` 读取路径已确认；Codex/Claude 细节进入后续实现 slice 时再补专项证据。

## 已产出

- `technical-design.md`：总体技术方案与分期落地。
- `account-state-ownership.md`：资产态、运行态、展示态所有权矩阵。
- `management-api-boundary.md`：management API read / command / reconcile / probe 边界。
- `runtime-consistency-fixtures.md`：后续红灯测试 fixture 与 mock/spy 输出。
- `wise-council-verdict.md`：外部 advisor 裁决与采纳/拒绝项。

## 首批候选测试

### Read path purity

- `GET /v0/management/accounts/:account_key` 对 `applied / registered_routeable` 账号连续读取，不调用 apply hook，不改变 runtime state。
- `GET /v0/management/accounts` 列表读取不触发 refresh/apply，不写 routeability。

### Model catalog fallback

- Codex auth-file plus 在 registry 为空时 `/accounts/:id/models` 返回 plus 模型。
- Codex API key `models_json=[]` 返回默认 Codex 模型。
- openai-compatible 无自描述 models 时 fail closed，不回查旧 config。

### Runtime consistency

- 创建账号 command 写 DB 后触发 runtime apply，并在 registry 中能查到模型。
- 禁用账号 command 写 DB 后清理 route candidates、WebSocket pin、session affinity。
- 删除账号 command soft delete 后只清理目标 runtime auth，不影响其他账号。

### OAuth refresh singleflight

- 同一账号并发 refresh，mock upstream 只收到一次 token refresh 请求。
- `refresh_token_reused` 只写运行态 evidence，不清空模型目录，不改资产 provider/plan。

## 验收门禁

- Phase 0 不要求代码改动，但必须产出 ownership/API/fixture 三份计划文档。
- Phase 0 的架构红线：sidecar 独占主 SQLite；App 不直接打开主库。若需要 App 本地只读，只能在 Phase 3 设计 sidecar 导出的版本化只读投影。
- 如果 Phase 0 发现可直接修复的 P0 读接口副作用，只能先补红灯测试，再进入 Phase 1。
- 文档变更至少运行：
  - `docs-linhay/scripts/check-docs.sh`
  - `git diff --check -- docs-linhay/spaces/20260711-account-system-hardening docs-linhay/memory/2026-07-11.md`

## 当前状态

- 状态：completed
- 最近更新：2026-07-11

## Phase 1-3 实现证据

- Phase 1：`docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/accounts_store.go` 已移除 GET pending implicit apply，新增 explicit reconcile endpoint。
- Phase 1 测试：`TestGetAccountDoesNotApplyPendingRuntime`、`TestListAccountsDoesNotApplyPendingRuntime`、`TestGetAccountsSnapshotDoesNotApplyPendingRuntime`、`TestReconcileAccountsAppliesPendingRuntime`。
- Phase 2：`sdk/cliproxy/auth/conductor.go` 的 refresh lease key 使用 provider identity，新增并发窗口 lease result 复用。
- Phase 2 测试：`TestManager_RefreshAuthDeduplicatesConcurrentRefreshForProviderIdentity`。
- Phase 3：`internal/wailsapp/account_store_snapshot.go` 仅调用 management snapshot API；旧 SQLite parser 已删除。
- Phase 3 测试：`TestListCachedAccountsReadsSidecarSnapshotWithoutSecrets`、`TestListCachedAccountsWithoutManagementClientReturnsEmptySnapshot`。

## Phase 4-6 实现证据

- Phase 4：App/Wails 首屏读取已通过 sidecar snapshot API，sidecar runtime apply 保留在 command/reconcile/login callback 路径；GET 读路径只返回 evidence。
- Phase 5：新增 `internal/gettokens/modelcatalog`，`GET /accounts/:account_key/models`、auth manager legacy route filter、scheduler fast path 共用 resolver。
- Phase 5 测试：`TestResolveRuntimeCodexPlanFallbackSupportsRouteModel`、`TestResolveAccountRecordOpenAICompatibleUsesSelfDescribedModels`、`TestResolveAccountRecordOpenAICompatibleWithoutModelsFailsClosed`、`TestManager_PickNextUsesCodexPlanFallbackWhenRegistryMissing`。
- Phase 6：新增 `GET /v0/management/gettokens/account-system-doctor`，只读汇总 DB/runtime/model catalog 一致性，不返回 credential secret。
- Phase 6 测试：`TestAccountSystemDoctorReportsModelCatalogAndRuntimeAlignment`。
- 全量验证：sidecar `go test ./...`、父仓 `go test ./internal/cliproxyapi ./internal/wailsapp ./cmd/gettokens`、前端 `npm --prefix frontend run test:unit -- src/features/accounts/tests/accountListCache.test.mjs` 均通过。
