# Account Routing Quota Guard 技术方案

日期：2026-05-31

关联 space：`docs-linhay/spaces/20260531-account-routing-requirements-design/`

## 结论

账号“走额度但没有额度”必须在 sidecar 路由热路径处理，不能由前端账号池展示状态临时过滤。

推荐新增 sidecar-owned `quota-empty` route guard source，并把 quota reset time 映射为 guard 的自然 TTL：

```text
quota refresh / usage result / upstream quota error
  -> quota runtime snapshot
  -> quota guard evaluator
  -> AccountRouteGuardStore(source=quota-empty, expiresAt=resetAt)
  -> AccountRoutingEngine hard-filter
  -> selector / retry / websocket request-boundary
```

最终效果：

- UI 显示的 quota / reset 与路由过滤读取同一个 sidecar 状态。
- 构建候选池时已经排除 `quota-empty` 账号，sticky cache 不能把它拉回候选。
- reset time 到期后自动重新评估，不永久阻断。
- explain / route ledger / 账号详情能说明账号被过滤的原因和下一次恢复时间。

## 当前落地状态

阶段：Phase 3b sidecar-native quota refresh 已实现，自动化验证完成，等待真实桌面/真实账号流量用户验收。

已完成：

- CLIProxyAPI fork 新增 `AccountRouteGuardSourceQuotaEmpty = "quota-empty"`。
- 新增 `AccountQuotaRuntimeState` / `AccountQuotaWindowState` 与 `QuotaEmptyRouteGuardBlocks`，把 fresh 且耗尽的 quota window 转成 route guard block。
- `ExpiresAt` 使用耗尽窗口中最晚的未来 `resetAt`；stale、degraded、缺失 resetAt、resetAt 已过期的 quota 不强阻断。
- `AccountRouteGuardResultHook` 在 auth 注册/更新时同步 runtime `Auth.Quota`，并在明确 upstream quota error 且带 `RetryAfter` 时写入 `quota-empty`。
- `quota-empty` 进入现有 account route guard hard-filter；sticky order 不能把已过滤账号拉回候选。
- Codex WebSocket pinned auth 在 request boundary 命中 `quota-empty` 时会释放 pin，并在 timeline 中保留 source/reason。
- sidecar 新增 `quota-status` runtime store 与 management API：
  - `GET /v0/management/gettokens/quota-status?account_key=<acct_*>`
  - `GET /v0/management/gettokens/quota-status`
  - `PUT /v0/management/gettokens/quota-status/<acct_*>`
- Wails `GetCodexQuota` 对统一账号会把 quota refresh 结果写入 sidecar `quota-status`，再使用 sidecar 返回值映射给 UI。
- Wails/root/frontend DTO 已透传 sidecar quota runtime explain 字段：`accountKey/source/status/stale/degradedReason/blocked/blockReason/sources`。
- 账号卡只展示 sidecar 返回的 `blocked/sources`，不再从本地 quota bars 推断路由阻断。
- auth-file usage cache fallback 写入 `status=stale`；stale/error 不新增强阻断，也不会清除已有 fresh `quota-empty`，已有 block 由 `resetAt` 自然过期或下一次成功刷新清理。
- fresh success quota recovery 会按同一 source 的身份 lookup 清理 `quota-empty`。即使旧 block 是按 `authID` 写入，只要带有同一 `accountKey` lookup，也能被 `accountKey` 维度恢复清理；`manual-disabled` / `rate-limit` 不受影响。
- Codex API key quota curl / billing curl 的解析、provider-specific 映射、HTTP 执行与 runtime upsert 已迁入 sidecar-native management endpoint：
  - `POST /v0/management/gettokens/quota-refresh/:account_key`
  - `POST /v0/management/gettokens/quota-test`
  - `POST /v0/management/gettokens/billing-test`
- 已保存 `codex-api-key` 账号 refresh 从 sidecar account store 读取 `acct_*` credential，fresh success 通过 `QuotaRuntimeStore.Upsert` 写入 sidecar runtime，并同步 `quota-empty` guard。
- 草稿 `quota-test` / `billing-test` 只返回预览态 `QuotaRuntimeState`，不写 runtime、不生成 guard。
- Wails/root 现在只调用 sidecar `quota-refresh` / `quota-test` / `billing-test` 并映射 `QuotaRuntimeState`；root 侧 API key quota curl / billing parser 已移除，只保留 auth-file usage payload 所需解析。
- auth-file usage refresh 暂继续通过 sidecar `/v0/management/api-call` 做 token 注入，再写入 quota runtime。

未完成：

- Channel Routing explain 过滤原因的 UI 汇总仍需单独接入 `quota-empty` 分组展示。
- reset 到期后的后台主动 quota refresh / 全量轮询未接入；当前依赖 route guard `ExpiresAt` 自然失效、账号池/详情按需刷新和后续 fresh success 清理。
- quota refresh debug record 持久化未单独建设；当前只保留 management endpoint 响应与日志。

## Phase 3b 详细技术方案

### 建设内容

Phase 3b 建设 sidecar-native quota refresh 执行器。它把 Codex API key 账号的 quota curl / billing curl 解析、HTTP 执行、provider-specific 响应映射和 `quota-status` upsert 全部收敛到 CLIProxyAPI fork 的 sidecar 边界内。debug record 持久化作为后续可观测性增强，不阻塞本期路由语义闭环。

完成后，Wails/root 不再解析 API key quota curl，也不再把 provider 响应转换成 quota DTO；Wails 只负责调用 sidecar endpoint，并把 sidecar 返回的 `QuotaRuntimeState` 映射给现有 UI。

### 不建设内容

- 不迁移 auth-file `chatgpt.com/backend-api/wham/usage` 刷新链路；它可继续通过 `/v0/management/api-call` 做 token 注入，再写入 `quota-status`。
- 不删除 `/v0/management/api-call`；它仍服务其他管理工具和 auth-file usage 请求。
- 不做 provider 定时轮询的全量调度器；本期依赖 `quota-empty.ExpiresAt` 自然失效和按需 refresh。
- 不把 quota-empty 合并进 `rate-limit`，也不恢复 legacy routing mode。
- 不要求前端新增本地 blocked 推断；前端继续展示 sidecar 返回值。

### 推荐方案

推荐把 quota 执行器放在 sidecar `gettokenshooks` 域内，并通过 management routes 暴露小范围 API：

```text
Wails GetCodexQuota / TestQuotaCurl / TestBillingCurl
  -> internal/cliproxyapi client
  -> sidecar management endpoint
  -> account store / draft input
  -> quota curl parser
  -> sidecar HTTP client with account/global/system proxy
  -> provider quota/billing parser
  -> QuotaRuntimeStore.Upsert(account_key)
  -> AccountRouteGuardStore(source=quota-empty)
  -> QuotaRuntimeState returned to Wails/UI
```

选择该方案的原因：

- 额度、reset time 和路由阻断同源，`quota-empty` 不再依赖 Wails/root 中间态。
- 可以复用 sidecar account store、proxy 选择和 route guard store，避免 root 与 sidecar 出现两套网络语义。
- 分期可独立合并：Phase 3a 已保证 HTTP 出网在 sidecar；Phase 3b 继续下沉解析和 orchestration，失败时可回退到 Phase 3a。

保留的最小替代方案是继续使用 Phase 3a `/api-call` 桥接，只把 reset 到期 reconcile 加在 root/Wails 侧。该方案改动更小，但会继续留下“UI 解析数据源”和“sidecar 路由真源”之间的语义分层，不推荐作为最终形态。

### 新增 sidecar API

新增三个 management endpoint，统一返回 sidecar-native DTO。

#### 1. 刷新已保存账号

```text
POST /v0/management/gettokens/quota-refresh/:account_key
```

语义：

- 从 sidecar account store 读取 `acct_*`。
- 仅支持 `kind=codex-api-key`。
- `quota_enabled=false` 或 `quota_curl` 为空时返回 400，不写入 runtime。
- 成功执行 quota curl 后解析为 `QuotaRuntimeState`，写入 `QuotaRuntimeStore.Upsert`，返回写入后的 state。
- 如果账号启用了 `billing_enabled` 且有 `billing_curl`，同一次 refresh 可顺带刷新 billing 并合并进同一个 state。
- 上游非 2xx、网络失败或解析失败时：
  - 若已有可展示 cache，返回 `status=stale` 或 `status=degraded` 的 state，并保留已有 active `quota-empty` 直到 `expiresAt`。
  - 若没有 cache，返回错误，不创建新的 `quota-empty`。

请求体：

```json
{
  "include_billing": true,
  "force": false
}
```

响应体为现有 `QuotaRuntimeState`。

#### 2. 测试 quota curl 草稿

```text
POST /v0/management/gettokens/quota-test
```

语义：

- 用前端表单草稿 `api_key/base_url/prefix/quota_curl` 构造请求。
- 不读取 account store，不写入 `QuotaRuntimeStore`，不生成 `quota-empty`。
- 返回可映射为 UI 预览的 `QuotaRuntimeState`，`account_key` 可为空或使用请求体传入的临时 key；root 侧不得把测试结果当成路由状态。

请求体：

```json
{
  "api_key": "sk-...",
  "base_url": "https://api.example.com",
  "prefix": "",
  "quota_curl": "curl ...",
  "account_key": ""
}
```

#### 3. 测试 billing curl 草稿

```text
POST /v0/management/gettokens/billing-test
```

语义：

- 输入与 `quota-test` 相同，但字段为 `billing_curl`。
- 只解析 billing/balance 响应，不写入 runtime，不生成 guard。
- 返回 `QuotaRuntimeBilling` 或包含 billing 的 `QuotaRuntimeState`；root 侧继续映射成现有 `CodexQuotaBillingInfo`。

### sidecar 内部模块边界

本期实际落地在 management handler 层，复用已有 management transport 能力：

- `internal/api/handlers/management/quota_refresh.go`：结构化解析 curl，禁止 shell operators，支持 URL/method/header/body/cookie，占位符替换、ignored options、provider quota/billing 映射、account store 读取、HTTP 执行和 runtime upsert。
- `internal/api/handlers/management/quota_refresh_test.go`：覆盖已保存账号 refresh 写入 `quota-empty`、草稿 shell 拒绝不写 runtime、billing 草稿解析不写 runtime。
- `internal/api/server.go`：注册 `/gettokens/quota-refresh/:account_key`、`/gettokens/quota-test`、`/gettokens/billing-test`。

如果后续 parser 继续膨胀，再按稳定边界拆到 `internal/gettokenshooks/quota_curl.go`、`quota_provider_parser.go`、`quota_refresh.go`。当前先保持改动面集中，避免在 Phase 3b 同时做大规模包拆分。

HTTP transport 不在 quota 模块里重写一套代理规则。应复用或抽取 management `apiCallTransport(auth)` 的同等能力：

- 账号级 proxy 优先。
- 其次全局 `proxy-url`。
- 再其次 `use-system-proxy`。
- 最后直连。

当前 `quota_refresh.go` 直接调用 management handler 的 `apiCallTransport(auth)`，不要在 root/Wails 侧补偿代理语义。

### root / Wails 改造

`internal/cliproxyapi` 新增 client method：

- `RefreshQuota(accountKey string, includeBilling bool, force bool) (*QuotaRuntimeState, error)`
- `TestQuotaCurl(input QuotaCurlTestInput) (*QuotaRuntimeState, error)`
- `TestBillingCurl(input QuotaCurlTestInput) (*QuotaRuntimeState, error)`

`internal/wailsapp/quota.go` 改造：

- `getUnifiedCodexAPIKeyQuota` 调 `RefreshQuota(account.AccountKey, true, false)`，删除 API key quota refresh 的 Wails/root curl 解析和 provider 映射。
- `TestCodexAPIKeyQuotaCurl` 调 sidecar `quota-test`。
- `TestCodexAPIKeyBillingCurl` 调 sidecar `billing-test`。
- 保留 `mapQuotaRuntimeStateToCodexQuotaResponse`，作为 Wails UI 兼容层。
- auth-file quota 路径暂不改，继续通过 `/api-call` 和 `upsertAccountsdomainCodexQuotaRuntimeIfUnified` 写 runtime。

root `internal/accounts/quota_curl.go` 在 Phase 3b 后只保留 auth-file 或兼容需要的部分。若迁移后 root 已无 API key quota parser 调用，应删除对应未使用代码和测试，避免两套 parser 漂移。

### reset time 与 refresh 时机

Phase 3b 的 reset time 处理分两层：

1. route guard TTL：已由 `quota-empty.ExpiresAt = latest resetAt` 处理，是强阻断的恢复边界。
2. refresh trigger：当用户打开账号池、账号详情、手动测试或请求 explain 时，如果 `quota-status` 中 active `quota-empty` 已过期，sidecar 可先清理过期 block，并对该 account key 发起一次按需 refresh。

本期不做后台全量定时轮询。当前实现采用轻量自然恢复：

- `QuotaRuntimeStore.StateForAccount` 和 route guard active lookup 会自然过滤已过期 block。
- 若调用方请求 `force=true` 或 UI 发起刷新，则立即执行 provider refresh。
- 若普通列表读取发现已过期但未刷新，不继续阻断；UI 显示 stale/degraded，等待下一次显式 refresh。

这样可以避免后台请求放大，同时保证 reset 到期不会永久卡住账号。

### 失败与降级语义

- curl parse 失败：返回 400，不写 runtime，不影响已有 guard。
- HTTP 网络失败：返回 502；若是已保存账号且存在旧 runtime，返回或保留 stale/degraded 状态，不创建新 guard。
- provider 非 2xx：测试 endpoint 返回错误；已保存账号 refresh 可把 runtime 标为 degraded，但不得用该结果新增 `quota-empty`，除非响应明确表达 quota exhausted 且带 reset time。
- provider 响应无法解析：返回解析错误；附带 ignored curl options hint。
- fresh success 且 remaining 恢复为正数：通过 `QuotaRuntimeStore.Upsert` 只清理 `quota-empty` source，不影响 `manual-disabled` / `rate-limit`。
- fresh success 且 remaining 仍为 0：写入或延长 `quota-empty`，`expiresAt` 取最晚未来 resetAt。
- fresh success 但缺 resetAt：只展示 zero quota，不创建长期 hard block。

### BDD / TDD

先补红灯测试，再实现。

sidecar 测试：

1. Given 已保存 Codex API key 账号配置 quota curl，When 调 `POST /gettokens/quota-refresh/:account_key`，Then sidecar 执行 upstream HTTP、解析 quota、写入 quota-status 并返回 `blocked=true/source=quota-empty`。
2. Given quota refresh 返回 remaining 正数，When 此前存在同 account key 的 `quota-empty`，Then 只清理 `quota-empty`，保留其他 guard source。
3. Given quota curl 含管道/重定向/多命令，When 调 quota-test，Then 返回 400 且不写 runtime。
4. Given quota curl 含安全但不支持的选项，When 上游响应无法解析，Then 错误包含 ignored options hint。
5. Given billing curl 返回 DeepSeek/OpenRouter/OpenAI/SiliconFlow/generic balance 格式，When 调 billing-test，Then 返回 normalized billing DTO。
6. Given upstream 网络失败且已有 fresh `quota-empty` 未过 reset，When refresh 失败，Then active block 保留并返回 degraded/stale explain。
7. Given `expiresAt <= now`，When 查询 active guard，Then 过期 `quota-empty` 不再阻断候选。

root/Wails 测试：

1. `GetCodexQuota(acct_*)` 不再调用 `/v0/management/api-call`，只调用 `/v0/management/gettokens/quota-refresh/:account_key`。
2. `TestCodexAPIKeyQuotaCurl` 调 `/v0/management/gettokens/quota-test`，不在 Wails/root 解析 curl。
3. `TestCodexAPIKeyBillingCurl` 调 `/v0/management/gettokens/billing-test`。
4. `mapQuotaRuntimeStateToCodexQuotaResponse` 继续保留 `blocked/sources/stale/degraded/billing/windows`。

frontend 本期只需要跑现有 focused tests；若 Wails DTO 字段不变，不新增前端用例。

### 验证命令

sidecar：

```text
go test ./internal/api/handlers/management -run 'TestQuotaRefresh|TestQuotaDraft|TestBillingDraft' -count=1
go test ./internal/api/handlers/management ./internal/gettokenshooks -count=1
go test ./... -count=1
```

root：

```text
go test ./internal/cliproxyapi ./internal/wailsapp -run 'Test.*Quota|Test.*Billing' -count=1
go test ./... -count=1
node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
git diff --check
git -C docs-linhay/references/CLIProxyAPI diff --check
qmd update
qmd embed
```

本次 Phase 3b 已执行结果：

- CLIProxyAPI fork：`go test ./internal/api/handlers/management -run 'TestQuotaRefresh|TestQuotaDraft|TestBillingDraft' -count=1` 通过。
- CLIProxyAPI fork：`go test ./internal/api/handlers/management ./internal/gettokenshooks -count=1` 通过。
- CLIProxyAPI fork：`go test ./... -count=1` 通过。
- GetTokens root：`go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp -count=1` 通过。
- GetTokens root：`node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs frontend/src/features/accounts/tests/accountConfig.test.mjs` 通过。
- GetTokens root：`npm --prefix frontend run typecheck` 通过。
- GetTokens root：`npm --prefix frontend run build` 通过，仅有既有 chunk size warning。
- GetTokens root：`./scripts/ensure-sidecar.sh darwin arm64` 通过，已重建 `build/bin/cli-proxy-api`。
- GetTokens root：`go test ./... -count=1` 通过；此前出现过一次 `internal/codexbinary` 本地 mock release binary 版本识别为 `unknown` 的环境失败，本轮复跑已恢复。

### 发布与回滚

Phase 3b 可独立发布。回滚方式：

- root/Wails 回滚到 Phase 3a `/api-call` 桥接调用。
- sidecar 保留已新增 endpoint 不影响旧客户端；如果 endpoint 有缺陷但未被 root 调用，不影响路由热路径。
- `quota-status` 数据结构不做破坏性迁移，因此无需数据回滚。
- 已存在的 `quota-empty` block 仍按 `expiresAt` 自然过期；必要时可通过后续 fresh success refresh 清理。

### 最脆弱假设

本方案假设 Codex API key 账号已经统一进入 sidecar account store，并能从 `acct_*` 读取 `api_key/base_url/prefix/quota_curl/billing_curl/proxy_url`。如果这个假设不成立，Phase 3b 不能直接从 sidecar 自治刷新，只能继续用 Wails/root 传入完整 draft credential；这会削弱“已保存账号 runtime 自治”的目标，但不影响草稿测试 endpoint。

## 设计原则

1. **sidecar 是真源**：quota 是否阻断由 sidecar 决定，前端只展示 sidecar 状态。
2. **source 独立**：`quota-empty` 不复用 `rate-limit`，也不写成笼统 `Requestable=false`。
3. **resetAt 即 TTL**：有可靠 reset time 时，`AccountRouteGuardBlock.ExpiresAt = resetAt`。
4. **fresh 才强阻断**：quota 数据过期、探测失败或来源不可信时默认不强阻断，只标记 stale / degraded。
5. **缺失 quota 不阻断**：账号没有 quota 能力或未配置 quota 脚本时保持 optimistic，不因 unknown 被排除。
6. **不恢复 legacy route mode**：继续保持 Channel Routing 两模式 `sequential / balanced`。

## 领域模型

新增 guard source：

```go
const AccountRouteGuardSourceQuotaEmpty = "quota-empty"
```

新增 quota runtime snapshot，建议放在 sidecar-owned hooks / account runtime 层，而不是前端状态：

```go
type AccountQuotaRuntimeState struct {
    AccountKey      string
    AuthIDs         []string
    Source          string // quota-script | usage-error | provider-api
    Fresh           bool
    Stale           bool
    Degraded        bool
    DegradedReason  string
    EvaluatedAt     time.Time
    ExpiresAt       time.Time // freshness TTL, not quota reset
    Windows         []AccountQuotaWindowState
}

type AccountQuotaWindowState struct {
    Key         string // e.g. requests_5h | tokens_week | billing_balance
    Kind        string // request | token | credit | balance
    Remaining   float64
    Limit       float64
    ResetAt     time.Time
    Exhausted   bool
}
```

生成 guard block：

```go
type AccountRouteGuardBlock struct {
    Source     string    // quota-empty
    AuthID     string
    AccountKey string
    LookupKeys []string
    Reason     string    // "quota empty: requests_5h reset at ..."
    ExpiresAt  time.Time // max exhausted resetAt
    UpdatedAt  time.Time
}
```

`AccountKey` 优先使用统一账号卡 `acct_*`。如果某些运行时 auth 暂时没有 account key，才通过 `AuthID` / lookup keys 做兼容定位，但新写入路径应继续向 `acct_*` 收敛。

## 阻断语义

### 强阻断

满足以下条件时写入 `quota-empty`：

1. quota 数据 `Fresh=true`。
2. 至少一个参与路由的 quota window 已耗尽：`remaining <= 0`。
3. 该 window 有可靠未来 `resetAt`，或被明确标记为“人工恢复前不可用”。

多个 window 耗尽时：

- `Reason` 列出被耗尽的窗口摘要。
- `ExpiresAt` 取所有耗尽 window 中最晚的 `resetAt`。
- `NextReset` / UI 恢复时间也取最晚 reset，避免某个窗口恢复后账号仍因另一个窗口没恢复而被提前放回。

### 不强阻断

以下情况不写入 `quota-empty`，只展示诊断：

- quota 数据 stale。
- quota 探测失败，且没有上一份 fresh exhausted 状态。
- 没有 quota 脚本或 provider 不支持 quota。
- resetAt 缺失且无法判断恢复窗口。
- billing/balance unknown。

如果已有 `quota-empty` 且刷新失败：

- 若仍未到 `ExpiresAt`：保留 block，标记 `degraded_reason=refresh_failed`。
- 若已到 `ExpiresAt`：先清理强阻断，触发异步 quota refresh；刷新失败时保持 warning，不继续无限期阻断。

## reset time 处理

reset time 是本方案的关键：

```text
remaining <= 0 && resetAt > now
  -> source=quota-empty
  -> expiresAt=resetAt
  -> route hard-filter deny
  -> resetAt reached
  -> clear expired block or refresh quota
  -> recovered: clear quota-empty
  -> still empty: extend block to new resetAt
```

补充规则：

- `resetAt <= now`：不得直接创建长时间 block；应立即触发刷新或短退避。
- `resets_in_seconds` / `retry_after` 可转换为 `resetAt = now + duration`。
- provider 返回多个 reset 字段时优先级：明确绝对时间 `resetAt/resets_at` > 相对时间 `resets_in_seconds/retry_after` > window 推导。
- 所有时间写入 UTC RFC3339，前端只做本地显示格式化。

## 数据流

### quota refresh

1. 账号 quota 脚本或 provider API 刷新成功。
2. Wails/root 将刷新结果写入 sidecar quota runtime snapshot；后续应把刷新执行器也迁入 sidecar。
3. quota guard evaluator 计算 `quota-empty` blocks。
4. sidecar 只对 `status=success` 且 fresh 的 quota 状态清理或写入 `quota-empty`。
5. management API / Wails / UI 读取同一份 snapshot 与 guard source。

当前桥接链路：

```text
GetCodexQuota(accountKey)
  -> quota curl parse / auth-file usage refresh
  -> sidecar /v0/management/api-call executes HTTP request
  -> PUT /v0/management/gettokens/quota-status/<accountKey>
  -> QuotaRuntimeStore.Upsert
  -> AccountRouteGuardStore(source=quota-empty)
  -> sidecar returns QuotaRuntimeState
  -> Wails maps it back to CodexQuotaResponse for existing UI
```

如果刷新失败但能读到 auth-file usage cache，Wails 写入 `status=stale`。sidecar 不用 stale 数据创建新 block，也不清掉尚未到 `resetAt` 的 fresh `quota-empty` block。

如果刷新成功并恢复为正数，sidecar 清理同 source 的 `quota-empty` lookup。这个清理按身份 lookup 而不是只按 block key 精确删除，因此可以处理“upstream 结果先按 authID 写入、后续 quota refresh 按 accountKey 恢复”的混合路径。

### upstream quota error

真实请求返回 quota 类错误时：

1. executor / result hook 提取 quota error、resetAt 或 retryAfter。
2. 写入 `quota-empty` 或 `upstream-rate-limit` 的选择需要按语义区分：
   - 明确账号额度耗尽：`quota-empty`。
   - 上游临时限流但额度未耗尽：`upstream-rate-limit`。
3. 有 resetAt 时设置 `ExpiresAt`。
4. 触发该账号 quota refresh，补齐 UI 展示数据。

### usage attribution

usage 成功写入后不直接推断 quota 空，除非有本地可计算 quota window。若有可计算窗口，usage 后立即评估对应 account key；否则仍以 quota refresh / upstream error 为准。

## 路由热路径

`quota-empty` 进入现有 hard-filter，不新增 Gin middleware：

```text
auth candidates
  -> channel routing pool scope
  -> account route guard hard-filter
       deny: manual-disabled / rate-limit / quota-empty / auth-error / upstream-rate-limit / upstream-error
  -> session affinity sticky
  -> selector
```

这样保证：

- sequential 会跳过 quota-empty 后继续下一个账号。
- balanced 只在剩余候选中计算 active sessions。
- sticky cache 命中 quota-empty 账号时失效重选。
- WebSocket pinned auth 在 request boundary 命中 `quota-empty` 时释放 pin、关闭旧 upstream、重新进入 route engine。

## API / DTO

扩展 route guard status / account runtime status：

```json
{
  "accountKey": "acct_xxx",
  "blocked": true,
  "sources": [
    {
      "source": "quota-empty",
      "reason": "quota empty: requests_5h, tokens_week",
      "usage": 0,
      "limit": 100,
      "windowStart": "2026-05-31T00:00:00Z",
      "windowEnd": "2026-05-31T05:00:00Z",
      "nextReset": "2026-05-31T05:00:00Z",
      "expiresAt": "2026-05-31T05:00:00Z",
      "lastEvaluatedAt": "2026-05-31T03:12:00Z",
      "stale": false,
      "degradedReason": ""
    }
  ]
}
```

Wails/root/frontend 需要透传：

- `source`
- `reason`
- `nextReset`
- `expiresAt`
- `lastEvaluatedAt`
- `stale`
- `degradedReason`
- quota windows 摘要

前端不得用本地 quota bars 重新计算 `blocked`。

## UI 呈现

账号池与 Codex / Claude 账号列表显示同一状态口径：

- `可请求`：无 active guard，quota fresh 且未耗尽，或 quota unknown optimistic。
- `无额度阻断`：`quota-empty` active，显示 next reset。
- `额度未知`：quota stale / degraded / unsupported，不阻断但显示提示。
- `限流阻断`：`rate-limit` active，显示规则和 next reset。
- `手动禁用`：`manual-disabled` active。

Channel Routing 的“参与账号”只统计路由可参与账号；被 `quota-empty` 过滤的账号进入过滤原因列表，而不是参与账号列表。

## BDD 验收

1. Given 账号 quota fresh 且 remaining 为 0，When 构建候选池，Then 该账号被 `quota-empty` hard-filter 排除。
2. Given 账号 quota fresh 且 resetAt 在未来，When 生成 guard block，Then `expiresAt` 等于 resetAt。
3. Given 多个 quota window 都耗尽，When 生成 guard block，Then next reset 使用最晚 resetAt。
4. Given resetAt 已到期，When 周期 reconcile 运行，Then 清理过期 `quota-empty` 并触发 quota refresh。
5. Given quota refresh 后 remaining 恢复为正数，When evaluator 刷新 guard source，Then 只清理 `quota-empty`，不影响 `manual-disabled` / `rate-limit`。
6. Given quota 数据 stale，When 构建候选池，Then 默认不因 stale quota 排除账号，UI 显示 stale / degraded。
7. Given sticky cache 绑定到 quota-empty 账号，When 同 session 新请求进入路由，Then sticky 失效并选择其他候选。
8. Given Codex WebSocket pinned auth 命中 `quota-empty`，When 下一条 downstream request 到达，Then 释放 pin、关闭旧 upstream，并重选账号。
9. Given 所有账号都 `quota-empty`，When 请求进入路由，Then 返回无可用账号错误，并在 explain/status 中列出每个账号的 quota-empty 和 next reset。
10. Given upstream 返回 usage_limit_reached 且带 resets_at，When result hook 处理，Then 写入 `quota-empty` 并设置 expiresAt。

## TDD 覆盖

已覆盖 sidecar：

- `QuotaGuardEvaluatorBuildsBlockFromFreshEmptyWindow`
- `QuotaGuardUsesLatestResetAtAcrossExhaustedWindows`
- `QuotaGuardDoesNotBlockStaleQuota`
- `QuotaGuardClearsOnlyQuotaEmptySourceOnRecovery`
- `AccountRouteGuardPolicyDeniesQuotaEmptyCandidate`
- `SessionAffinityCacheCannotResurrectQuotaEmptyAuth`
- `WebSocketPinnedAuthReleaseIncludesQuotaEmptySource`
- `QuotaRuntimeStoreUpsertFeedsQuotaEmptyGuard`
- `QuotaRuntimeStoreRecoveryClearsOnlyQuotaEmpty`
- `QuotaRuntimeStoreRecoveryClearsAuthScopedQuotaEmptyByAccountKey`
- `QuotaRuntimeStoreStaleStateDoesNotClearFreshQuotaEmptyGuard`
- `QuotaRuntimeRoutesPutAndGetStatus`

已覆盖 Wails/root：

- `cliproxyapi.Client` 的 quota-status GET/PUT DTO。
- 统一 Codex API key quota refresh 会写入 sidecar quota-status，并返回 sidecar 响应。
- auth-file usage refresh 失败但有 cache 时写入 `status=stale`。
- auth-file quota refresh 使用统一账号 `accountKey` 作为 sidecar `api-call` 和 quota-status key。
- Codex API key quota curl 测试和实际 refresh 都通过 sidecar `/api-call` 执行 HTTP 请求，不再在 Wails/root 直连目标 URL。
- Codex API key billing curl 测试通过 sidecar `/api-call` 执行 HTTP 请求。
- root mapper 保留 sidecar quota runtime explain 字段。

已覆盖 frontend：

- account quota display 保留 sidecar `blocked/sources/stale/degraded` explain 字段。
- generated Wails models 暴露 `CodexQuotaSourceState` 与 `CodexQuotaResponse.sources/blocked`。

后续仍需补：

- Channel Routing explain 过滤原因包含 `quota-empty` 的 UI 断言。
- sidecar-native quota curl / billing curl 执行器迁移后的集成测试。

## 分期

### Phase 1：sidecar guard 基线（已完成）

- 增加 `quota-empty` source 常量和 route guard store 测试。
- 增加 quota evaluator 纯函数测试，不接真实脚本。
- 接入 hard-filter 与 Codex WebSocket request-boundary release。

### Phase 2：sidecar quota runtime 与 Wails 桥接（已完成）

- 建立 quota runtime snapshot 与 management API。
- 从 Wails quota refresh 写入 sidecar quota-status。
- evaluator 生成 `quota-empty` blocks。
- stale/cache 写入不创建新 block，也不提前清除已有 fresh block。

### Phase 2.5：UI explain 透传（已完成）

- Wails/root/frontend DTO 透传 sidecar quota runtime `blocked/sources/stale/degraded` 字段。
- 账号池展示 sidecar 返回的阻断原因与 next reset，不在前端本地推断 blocked。
- root/frontend focused tests 锁定 generated models、mapper 和 account display 行为。

### Phase 3a：sidecar HTTP execution bridge（已完成）

- Codex API key quota curl / billing curl 仍由 Wails/root 解析为 method/url/headers/body。
- HTTP 请求统一通过 sidecar management `/api-call` 执行，复用 sidecar proxy/system proxy 语义。
- quota refresh 结果继续写入 sidecar `quota-status`，UI 与路由过滤共享 sidecar runtime 状态。

### Phase 3b：sidecar-native quota 执行器（已完成）

- 把 API key quota curl / billing curl 解析、provider-specific 响应映射和 refresh orchestration 从 Wails/root 迁入 sidecar。
- sidecar 已保存账号 refresh 自行读取 account store、执行 HTTP、写入 `QuotaRuntimeStore.Upsert` 并同步 `quota-empty`。
- 草稿 quota/billing 测试 endpoint 不写 runtime、不生成 guard。
- Wails/root 不再保留 API key quota/billing parser；auth-file usage 路径暂留 `/api-call`。
- debug record 持久化、后台主动 reset refresh 调度未纳入本期。

### Phase 4：Channel Routing explain 展示（待做）

- 账号详情、账号列表、Channel Routing explain 展示一致。
- 浏览器 preview 增加 quota-empty/stale/unknown 三种状态。

## 风险

1. quota 脚本或 provider API 质量不稳定，可能误杀账号；必须坚持 fresh 才强阻断。
2. resetAt 缺失时不能猜长时间阻断；只能短退避或提示 unknown。
3. 多窗口 quota 容易提前恢复；必须取最晚 resetAt。
4. 前端若继续本地推断 blocked，会再次出现 UI 与路由不一致。
5. request-window rate-limit 与 quota-empty 都可能阻断同一账号；source 必须并存，恢复时只清自己的 source。

## 不做

- 不把 quota-empty 合并进 `rate-limit`。
- 不把 quota-empty 写成全局 `Requestable=false`。
- 不因没有 quota 数据阻断账号。
- 不做 mid-response 迁移。
- 不恢复 `project` / fallback / upstream compat route mode。
