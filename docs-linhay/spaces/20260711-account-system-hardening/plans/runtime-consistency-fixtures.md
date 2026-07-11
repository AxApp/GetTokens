# Runtime Consistency Fixtures

> 状态：v1 regression baseline。Fixture C 中 provider identity 级共享阻断只用于证明旧事故和止血，不是 v2 目标行为。v2 必须按 generation ownership 隔离，完整 BDD 以 `account-runtime-authority-v2.md` 为准。

## 目的

后续治理不能只靠真实账号复现。每个 slice 都必须有 mock upstream facts 和 mock downstream/spy outputs，证明 DB、runtime、management API、Wails DTO、frontend view model 对同一 fixture 的解释一致。

## Fixture A：Codex OAuth Plus，registry 正常

### Account-store facts

- `kind=auth-file`
- `provider=codex`
- `auth_json.type=codex`
- `auth_json.account_id=chatgpt_acct_001`
- `plan_type=plus`
- `disabled=false`
- `runtime_apply_status=applied`
- `runtime_routeability_status=registered_routeable`

### Runtime facts

- AuthManager 存在同 `account_key` auth。
- ModelRegistry 对 auth id 返回 plus 模型。
- RouteGuard 无 `auth-error`。

### Expected

- `GET /accounts/:key` 不调用 apply hook。
- `GET /accounts/:key/models` 返回 registry 模型，source=`registry`。
- route explain 可将该账号作为候选。
- frontend card 为 requestable/available。

## Fixture B：Codex OAuth Plus，registry 缺失

### Account-store facts

同 Fixture A，但 ModelRegistry 为空。

### Expected

- `GET /accounts/:key/models` 按 `plan_type=plus` 返回 Codex plus static models，source=`codex-plan-fallback`。
- 不写 ModelRegistry。
- 不写 `runtime_routeability_status`。
- route explain 是否可候选由 runtime routeability 决定，不能因 read fallback 直接放行。

## Fixture C：Codex OAuth duplicate provider identity

### Account-store facts

两个 auth-file account：

- `acct_a` 与 `acct_b` 的 `auth_json.account_id` 都是 `chatgpt_acct_same`。
- 两者 runtime auth id 不同。
- refresh token 指向同一上游会话。

### Mock upstream facts

- OAuth refresh endpoint 允许成功一次。
- 第二次并发 refresh 返回 `refresh_token_reused`。

### Expected

- Phase 2 后并发 refresh 只发一次 upstream call。
- refresh lease key 基于 `provider + openai-account-id:chatgpt_acct_same`。
- route guard 写 identity-scoped `auth-error` 时，两个资产的 quota-status/presentation 都能看到 evidence。
- 资产态 `provider/plan/models_json` 不被 refresh error 修改。

## Fixture D：Codex API key empty models

### Account-store facts

- `kind=codex-api-key`
- `models_json=[]`
- `disabled=false`

### Expected

- `GET /accounts/:key/models` 返回默认 Codex model set，source=`codex-api-default`。
- runtime model registration 也按默认 Codex model set。
- route explain/probe 与 management models 对模型能力判断一致。

## Fixture E：OpenAI-compatible explicit models

### Account-store facts

- `kind=openai-compatible`
- `provider=deepseek`
- `models_json=[{"name":"deepseek-chat","alias":"deepseek"}]`
- runtime auth attribute `openai_compat_models` 来自 account-store。

### Expected

- management models 返回 `deepseek` client-facing alias，同时保留真实模型元数据。
- route explain 对请求 `model=deepseek` 命中该账号。
- 不回查 legacy `config.OpenAICompatibility`。
- 保存 alias 去重按 `name + alias`。

## Fixture F：OpenAI-compatible missing models

### Account-store facts

- `kind=openai-compatible`
- `models_json=[]`
- 无 runtime `openai_compat_models`。

### Expected

- model resolver source=`empty-fail-closed`。
- management models 为空但带 reason。
- route explain 不把该账号作为支持任意模型的候选。
- 不从旧 config fallback。

## Fixture G：Pending account read purity

### Account-store facts

- 任意 active account。
- `runtime_apply_status=pending`

### Spy facts

- fake `accountStoreApply` 记录调用次数。

### Expected

- `GET /accounts` apply count = 0。
- `GET /accounts/:key` apply count = 0。
- DB runtime state 不变。
- `POST /accounts/reconcile` apply count = 1，并返回 event summary。

## Fixture H：App first-paint snapshot

### Sidecar facts

- sidecar ready，management snapshot endpoint 可用。
- account-store 包含 auth-file、codex-api-key、openai-compatible 三类账号。

### Expected

- Wails `ListCachedAccounts` 或替代方法不 `sql.Open` 主 `accounts-v1.sqlite`。
- Wails 调 sidecar snapshot API。
- 输出与 `ListAccounts` 共享同一 sanitizer，不含 API key、headers、platform cookie、raw auth。
- sidecar 未 ready 时只使用 frontend localStorage view cache。

## 测试矩阵

| Fixture | sidecar handler | auth manager | model registry | Wails | frontend |
| --- | --- | --- | --- | --- | --- |
| A | yes | yes | yes | optional | optional |
| B | yes | yes | yes | optional | yes detail models |
| C | yes | yes | no | no | quota/status view |
| D | yes | yes | yes | optional | Codex model test |
| E | yes | yes | yes | optional | Codex mapping |
| F | yes | yes | yes | optional | error state |
| G | yes | spy | no | no | optional |
| H | sidecar snapshot | no | no | yes | yes first paint |

## 当前状态

- 状态：proposed
- 最近更新：2026-07-11
