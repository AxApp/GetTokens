# Codex Account Inventory Projection

## 背景
- 线上 bug 暴露出账号池与 `Codex -> 账号列表` 的账号识别逻辑存在分叉：账号池 `ListAuthFiles` 能从 `auth_json` 推断 `provider=codex`，但 Codex 账号列表通过 `ListAccounts + ListOpenAICompatibleProviders + buildCodexAccountRows()` 自行拼装和筛选，曾在 `provider=unknown` 时把真实 Codex auth-file 过滤掉。
- 当前止血已把 auth-file provider 推断下沉到 `internal/accounts/account_records.go`，但 Codex 页面仍然承担“哪些账号属于 Codex 请求链路”的领域判断。后续继续累加 sourceKind、requestability、模型映射和 quota metadata 时，仍容易和账号池、路由探测、channel routing 产生多套事实。
- 本期目标是把 Codex 账号列表的数据入口重构为后端统一投影，前端只消费 `ListCodexAccountInventory` 返回的统一账号记录，不再自行合并账号池和 openai-compatible provider 列表。

## 目标
1. 新增后端 Codex 账号资产投影，统一返回 Codex auth-file、Codex API Key、openai-compatible 三类账号。
2. 投影层负责“哪些账号属于 Codex 路由链路”的账号归属判断，并保留 requestability、models、quota/billing metadata、disabled/status、priority、provider/baseUrl 等统一账号事实。
3. Wails/root 暴露 `ListCodexAccountInventory`，前端 Codex 账号列表优先使用该 API。
4. 保留现有账号池创建、编辑、删除、启停等职责；Codex 页面继续只管理 channel routing、请求顺序、探测和模型映射编排。
5. 回归覆盖 `provider=unknown` 但 `auth_json.type=codex` 的 auth-file，证明账号池与 Codex 账号列表消费同一统一识别结果。

## 范围
- 后端：
  - `internal/wailsapp` 新增 Codex account inventory 方法。
  - root `app.go` 补 Wails-facing mirror，并复用既有 `AccountRecord` DTO。
  - 复用 `internal/accounts` 统一账号映射，不复制 auth-file provider 推断逻辑。
  - openai-compatible 仍以 account-store unified account 为真源，必要时复用现有 provider mapper。
- 前端：
  - `CodexAccountListFeature.tsx` 的真实 Wails 分支从 `ListAccounts + ListOpenAICompatibleProviders` 迁移到 `ListCodexAccountInventory`。
  - `buildCodexAccountRows()` 保留为 preview / 纯模型兼容层，但真实数据入口不再在页面里组合 provider。
  - 类型与 Wails 绑定同步更新。
- 文档：
  - 本 `space` 记录清单、证据门禁、验收。
  - 完成后写回 `docs-linhay/memory/2026-06-10.md`。

## 非目标
- 不重做账号池 UI。
- 不迁移账号创建/编辑/删除 API 到 Codex 页面。
- 不改变 Codex channel routing config 的保存语义。
- 不做正式版 App 手点；本期是普通后端/Wails/前端数据契约重构，优先用自动化测试、类型检查和必要的浏览器预览验收。
- 不修改 `/Applications/GetTokens.app` 或正式版配置。

## 验收标准
1. Given account-store 返回 auth-file `provider=unknown`、`auth_type=unknown`，但 `auth_json.type=codex`，When 调用 `ListCodexAccountInventory`，Then 返回的账号包含该 auth-file 且统一账号记录中 `provider=codex`。
2. Given account-store 中存在 Codex API Key，When 调用 `ListCodexAccountInventory`，Then 返回的账号包含该账号且保留 `models` 到模型映射。
3. Given account-store 中存在 openai-compatible 账号，When 调用 `ListCodexAccountInventory`，Then 返回的账号包含该账号且映射方向为真实模型 `name` -> Codex 模型 `alias || name`。
4. Given Codex 页面在 Wails 真实环境加载，When sidecar ready，Then 前端只调用 `ListCodexAccountInventory` 获取账号列表，不再并行调用 `ListAccounts` 与 `ListOpenAICompatibleProviders` 来拼装 Codex rows。
5. Given 浏览器 preview 环境，When 打开 `#frame=codex&workspace=account-list`，Then 仍使用稳定 preview data，不依赖 Wails 绑定。
6. Given 修改完成，When 运行定向 Go 测试、Codex 前端单测、typecheck 和 docs 校验，Then 全部通过，或明确记录阻塞原因。

## 任务清单
- [x] 建立后端 `ListCodexAccountInventory()` 投影 API，返回统一 `AccountRecord` 列表。
- [x] 新增 `internal/wailsapp.ListCodexAccountInventory()`，复用统一账号映射生成三类账号投影。
- [x] root `app.go` 暴露 Wails-facing 方法，复用既有 `AccountRecord` DTO。
- [x] 补 Go 回归测试：unknown auth-file、Codex API Key、openai-compatible 三类账号都进入投影。
- [x] 前端真实 Wails 分支迁移到 `ListCodexAccountInventory`。
- [x] 更新前端模型转换测试，锁定 Codex 页面不再用 `ListAccounts + ListOpenAICompatibleProviders` 拼真实列表。
- [x] 重新生成/同步 `frontend/wailsjs` 绑定。
- [x] 跑定向测试、typecheck、Wails build、docs 自检。

## 实施结果
- 后端新增 `ListCodexAccountInventory()`：
  - `internal/wailsapp/accounts.go` 从 `ListAccounts()` 的统一映射结果中过滤 Codex 路由相关账号。
  - auth-file 只接受 `provider=codex`；Codex API Key 与 openai-compatible 按 `accountKind` 纳入。
  - 继续复用 `internal/accounts/account_records.go` 的 auth-file provider 推断，不复制 `auth_json` 解析逻辑。
- Root/Wails：
  - `app.go` 暴露 `ListCodexAccountInventory()`。
  - `frontend/wailsjs/go/main/App.{d.ts,js}` 已由 `./scripts/wails-cli.sh build` 重新生成并包含新导出。
- 前端：
  - `CodexAccountListFeature.tsx` 真实 Wails 分支只调用 `ListCodexAccountInventory`。
  - `buildCodexAccountRows()` 支持从 unified inventory 中的 `accountKind=openai-compatible` 记录直接生成 Codex row。

## 验证记录
- `go test ./internal/accounts -run 'TestBuildUnifiedAuthFileAccountRecordInfersCodexProviderFromAuthJSONWhenStoreMetadataUnknown'`
- `go test ./internal/wailsapp -run 'TestListCodexAccountInventoryProjectsAllCodexRoutableAccountKinds|TestListAccountsInfersCodexAuthFileProviderFromUnifiedAuthJSON|TestListAccountsDoesNotFallbackToLegacyWhenAccountStoreErrors'`
- `node --test frontend/src/features/codex/codexAccountList.test.mjs`
- `npm --prefix frontend run typecheck`
- `./scripts/wails-cli.sh build`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260610-codex-account-inventory-projection`
- worktree：`../GetTokens-worktrees/20260610-codex-account-inventory-projection/`

## 相关链接
- `../20260511-codex-account-list-tab/README.md`
- `../../memory/2026-06-10.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-10
