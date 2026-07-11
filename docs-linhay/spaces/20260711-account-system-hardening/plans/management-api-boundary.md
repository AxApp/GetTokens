# Management API Boundary

## 结论

management API 必须按 `read / command / reconcile / probe` 四类收敛。当前最大问题是 read path 中混入了 runtime apply/reconcile。

## 分类规则

| 类型 | HTTP | 允许 DB 写 | 允许 runtime 写 | 允许 upstream call | 示例 |
| --- | --- | --- | --- | --- | --- |
| read | GET | no | no | no | list/detail/models/status/diagnostics |
| command | POST/PATCH/DELETE | yes | yes | normally no | create/patch/disable/delete |
| reconcile | POST | bounded | yes | no | pending/runtime/model routeability sync |
| probe/refresh | POST | bounded | yes | yes | quota refresh/OAuth refresh/route probe |

例外：历史 OAuth auth-url 当前是 GET 但会启动 auth flow/callback forwarder，应作为 legacy command-style GET 记录，后续迁移时改 POST 或至少标注 side-effect endpoint，不能纳入普通 read purity 门禁。

## 当前 read path 副作用

| Endpoint | 当前行为 | 结论 |
| --- | --- | --- |
| `GET /v0/management/accounts` | `ListAccounts()` 发现 pending 后调用 `applyPendingAccountStoreRuntime()` | 必须改为纯读 |
| `GET /v0/management/accounts/:account_key` | `GetAccount()` 对 pending 调 `applyAccountStoreRuntime()` | 必须改为纯读或迁到 explicit reconcile |
| `GET /v0/management/accounts/:account_key/models` | 读 registry，空时按 account-store 做 Codex fallback | 可以保留，但 fallback 不能写 DB/registry |
| quota status GET | 读 runtime evidence | 保持只读 |
| diagnostics GET | 读诊断状态 | 保持只读 |

## 目标 endpoints

### Read endpoints

```text
GET /v0/management/accounts
GET /v0/management/accounts/:account_key
GET /v0/management/accounts/:account_key/models
GET /v0/management/accounts/snapshot?allow_stale=1
GET /v0/management/accounts/diagnostics
GET /v0/management/gettokens/quota-status
```

要求：

- 不调用 `accountStoreApply`。
- 不调用 OAuth refresh。
- 不调用 route probe。
- 不写 `account_runtime_apply_state`。
- 不写 route guard/runtimeStates。
- 可以返回 `pending/failed/degraded` evidence 和 repair suggestion。

### Command endpoints

```text
POST   /v0/management/accounts
POST   /v0/management/accounts/batch
PATCH  /v0/management/accounts/:account_key
PATCH  /v0/management/accounts/:account_key/status
PATCH  /v0/management/accounts/:account_key/priority
DELETE /v0/management/accounts/:account_key
POST   /v0/management/accounts/batch-delete
```

要求：

- command 可以触发 account-store apply。
- expensive follow-up 只执行一次，batch command 不在 Wails/frontend 循环里放大。
- 返回 mutation event id 或 runtime apply summary。

### Reconcile endpoints

新增建议：

```text
POST /v0/management/accounts/reconcile
POST /v0/management/accounts/:account_key/reconcile
```

请求：

```json
{
  "scope": "pending",
  "reason": "startup|doctor|user-action|test",
  "dryRun": false
}
```

响应：

```json
{
  "event_id": "acctrec_...",
  "scope": "pending",
  "changed_account_keys": ["acct_..."],
  "apply_count": 1,
  "repair_count": 0,
  "errors": [],
  "duration_ms": 42
}
```

### Probe / refresh endpoints

必须显式 POST。可外呼的动作不能藏在详情读取或模型读取里。

```text
POST /v0/management/accounts/:account_key/probe
POST /v0/management/gettokens/quota-refresh
POST /v0/management/gettokens/quota-refresh-batch/jobs
POST /v0/management/auth/:auth_id/refresh
```

## Phase 1 迁移方案

1. 给 current handlers 加 spy tests，先固定红灯。
2. `ListAccounts()` 删除 pending apply 分支，仅返回 accounts。
3. `GetAccount()` 删除 pending apply 分支，仅返回 account。
4. 新增 explicit reconcile endpoint，复用现有 `applyPendingAccountStoreRuntime()`，但 trace 到 command/reconcile event。
5. UI 对 pending/degraded 状态展示“同步运行态”动作，调用 reconcile，而不是靠打开详情隐式修复。
6. startup init 保留 `initializeAccountStoreRuntime()`，作为 sidecar owner 的启动收敛动作。

## Phase 1 验收测试

### Handler spy tests

- pending account + fake apply hook；`GET /accounts` 后 apply count 为 0。
- pending account + fake apply hook；`GET /accounts/:key` 后 apply count 为 0。
- registry empty + Codex auth-file plus；`GET /accounts/:key/models` 返回 fallback models，apply count 为 0。
- repeated GET 前后 `account_runtime_apply_state` 行不变。

### Reconcile tests

- `POST /accounts/reconcile` 对 pending 账号调用 apply hook 一次。
- apply 成功后 pending 变 applied，并写 routeability。
- apply 失败只影响目标 pending set，返回 structured error。

### Regression tests

- mock OAuth refresh upstream call count 在 GET 详情/列表/models 路径为 0。
- model fallback 不清空 registry，不写 account-store models。

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| 历史 pending 账号不再因打开页面自动恢复 | startup init + explicit reconcile |
| UI 短期多一个 pending 状态 | 展示 repair suggestion，不伪装成已修复 |
| 老 App 期待 GET 自动修复 | Wails/root 侧加兼容提示，不保留读副作用 |
| 诊断需要读后立即修复 | doctor 分 read report 与 POST fix 两步 |

## 当前状态

- 状态：proposed
- 最近更新：2026-07-11
