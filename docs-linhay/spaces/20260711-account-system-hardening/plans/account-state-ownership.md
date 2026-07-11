# Account State Ownership

## 结论

账号体系拆成三层：

1. 资产态：sidecar account-store 是唯一真源。
2. 运行态：sidecar runtime 是唯一真源。
3. 展示态：Wails/frontend 只消费 read model 和 evidence。

App 可以共享账号契约、DTO、fixture、validation 规则，但不能直接共享主 SQLite 连接或运行态状态机。

## 当前事实

| 链路 | 当前代码事实 | 风险 |
| --- | --- | --- |
| Wails 正常列表 | `internal/wailsapp/accounts.go` 的 `ListAccounts()` 调 management client | 正确方向 |
| Wails 首屏缓存 | `internal/wailsapp/account_store_snapshot.go` 的 `ListCachedAccounts()` 直接 `sql.Open` 主库 | App 与 sidecar 共享主库 schema，绕过 sidecar owner |
| 前端首屏 | `useAccountsPageState.ts` 在 Wails 环境调用 `ListCachedAccounts()` | 首屏展示可能来自 App 自行推断的 SQLite snapshot |
| sidecar GET 详情 | `GetAccount()` 对 pending 调 `applyAccountStoreRuntime()` | read path 有 runtime 写入 |
| sidecar GET 列表 | `ListAccounts()` 发现 pending 调 `applyPendingAccountStoreRuntime()` | 普通列表读取可触发 apply/reconcile |
| sidecar startup | `initializeAccountStoreRuntime()` 调 `refreshAccountStoreAuths()` | 正确：启动 reconcile 属于 runtime owner |
| OAuth refresh | `refreshAuthWithOptions()` 用 `auth.ID` 加锁 | 同 provider identity 多资产仍可能并发 refresh |
| route guard identity | `route_guard.go` 已从 `account_id/chatgpt_account_id/openai_account_id` 建 lookup key | 可复用为 provider identity evidence |
| 模型注册 | `registerModelsForAuth()` 依赖 provider/auth attributes；openai-compatible 无自描述 models 时 unregister | 需要统一 resolver 让 read/probe/route 一致 |

## 字段所有权

| 字段/概念 | Owner | 写入者 | 读取者 |
| --- | --- | --- | --- |
| `account_key` | sidecar account-store | create/import/migration command | Wails/frontend/route runtime |
| `kind` | sidecar account-store | create/import/migration command | Wails/frontend/runtime synthesis |
| `provider` | sidecar account-store | normalization | Wails/frontend/model resolver |
| `credential_source` | sidecar account-store | normalization | frontend presentation |
| `disabled` | sidecar account-store | status command | runtime synthesis/route guard/UI |
| `priority` | sidecar account-store | priority command | route ordering/UI |
| `auth_json` / OAuth payload | sidecar account-store | import/OAuth writeback | runtime synthesis/token store |
| `plan_type` | sidecar account-store credential metadata | import/OAuth writeback | model fallback/UI |
| configured models | sidecar account-store credential metadata | create/patch/model save | model resolver/runtime synthesis |
| `runtime_apply_status` | sidecar runtime | command/reconcile/startup | management read evidence |
| `runtime_routeability_status` | sidecar runtime | command/reconcile/model refresh | management read evidence |
| route guard blocks | sidecar runtime | request result/auth refresh/quota job/status command | route engine/quota-status/UI |
| quota/rate-limit | sidecar runtime | quota jobs/upstream facts | UI/route policy |
| model registry | sidecar runtime | synthesis/model refresh | model resolver/route engine |
| live sessions | sidecar runtime | request lifecycle | route policy/UI |
| localStorage account cache | frontend | last management read response | first paint only |

## 目标读写矩阵

| 操作 | DB write | runtime write | upstream call | 允许入口 |
| --- | --- | --- | --- | --- |
| list accounts | no | no | no | GET read |
| get account detail | no | no | no | GET read |
| get account models | no | no | no | GET read |
| create/update account | yes | yes | no | POST/PATCH command |
| enable/disable account | yes | yes | no | PATCH command |
| delete account | yes | yes | no | DELETE/POST batch command |
| reconcile pending/runtime | maybe | yes | no | POST reconcile |
| quota refresh | maybe | yes | yes | POST refresh job |
| OAuth refresh | yes, credential writeback | yes | yes | scheduler/request refresh, guarded by lease |
| route probe | no asset write | yes evidence may update | yes | POST probe |
| doctor read | no | no | no | GET diagnostics |

## 违反目标的现状

### 1. GET 列表会 apply pending

`ListAccounts()` 在读出 accounts 后，如果存在 pending，会调用 `applyPendingAccountStoreRuntime()`，该函数会触发 `accountStoreApply`，再 `MarkPendingRuntimeApplyResults` 和 routeability reconcile。

目标：GET 只返回 pending evidence；pending 修复移动到 startup、command 或显式 `POST /accounts/reconcile`。

### 2. GET 详情会 apply pending

`GetAccount()` 对 pending 账号调用 `applyAccountStoreRuntime()`。这比之前每次详情都 apply 已收窄，但仍然让 read path 具备写入能力。

目标：GET 详情不写入；pending 通过按钮/doctor/startup reconcile。

### 3. App 直接读主 SQLite

`ListCachedAccounts()` 读取 sidecar config 解析 `account-store-db`，再以 `mode=ro` 打开主库。

目标：迁移到 sidecar `accounts/snapshot` read endpoint；sidecar 未 ready 时只用 frontend view cache。

### 4. refresh singleflight identity 不够稳定

`refreshLocks.LoadOrStore(id, ...)` 只按 runtime auth id 去重。重复账号资产共享同一 OpenAI `account_id` 时，不能保证本地只发一次 refresh。

目标：按 `provider + provider_identity` 加 lease；`auth_id` 只作为参与者日志字段。

## Phase 切分

### Phase 1

收敛 read path purity。目标是让“打开列表/详情/模型”不会改变 DB 或 runtime。

### Phase 2

OAuth refresh provider identity lease。目标是让重复资产不会并发 refresh 同一上游账号。

### Phase 3

移除 App 主库读取。目标是 sidecar 成为主 SQLite 唯一 reader/writer。

### Phase 4

统一 model catalog resolver 与 command/reconcile trace。目标是模型列表、route explain/probe、真实请求候选一致。

## 证据要求

进入每个实现 slice 前，测试必须明确：

- mock upstream facts：OAuth refresh 响应、model registry 状态、quota/route guard 输入。
- mock downstream/spy outputs：apply hook 调用次数、DB runtime state、model count、API response。
- 可证伪条件：例如 GET 后 apply hook count > 0 即失败。

## 当前状态

- 状态：investigated
- 最近更新：2026-07-11
