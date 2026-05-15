# Sidecar Usage Account Attribution Architecture

日期：2026-05-14

## 结论

本期方案调整为：**用 GetTokens 专属中间件做流量截取、账号归因和持久化，CLIProxyAPI 上游 core usage 结构保持一致**。

这意味着不再把 `usage_attribution_key` 加进上游 `sdk/cliproxy/usage.Record` 或 `internal/usage.RequestDetail`。如果 fork 里已经存在这类 core 结构改动，应作为本期清理项撤回，优先回到 upstream 形态。

## 背景

当前 sidecar `/v0/management/usage` 是真实请求用量真源，但它的 usage detail 更适合表达“请求观测”，不适合承载 GetTokens 的账号资产归因语义。把 GetTokens 的账号键写进上游 usage record 会增加 fork 冲突面，也会把产品级 join key 下沉到通用代理 core。

CLIProxyAPI 已提供 Gin server option：

1. `internal/api.WithMiddleware(...)`
2. `sdk/api.WithMiddleware(...)`

因此 GetTokens 可以在 sidecar 启动时安装自己的 middleware，用旁路表记录“某次请求最终对应哪个账号资产”，再由 GetTokens 查询这个旁路表完成账号级统计。

## 方案选型

### 方案 A：修改 `usage.Record / RequestDetail`

摘要：在 upstream usage core 里增加归因字段，并随 `/usage` snapshot 持久化。

优点是实现直观；缺点是污染上游结构、提高 merge 成本，也让通用 usage payload 承担 GetTokens 账号资产语义。

结论：撤回，不作为本期方案。

### 方案 B：GetTokens middleware + 独立 attribution ledger

摘要：通过 Gin middleware 包住 relay 请求，在请求前采集入口信息，在请求后读取已知上下文、响应状态和现有 usage 差量，写入 GetTokens 专属 SQLite 表。

优点是 CLIProxyAPI core 可保持上游一致，GetTokens 归因逻辑集中在 `internal/gettokenshooks/` 或等价 hook 目录；缺点是需要设计好 middleware 可获得的命中证据。

结论：推荐。

### 方案 C：只在 GetTokens App 层轮询 `/usage` 和 `/api-key-usage`

摘要：不改 sidecar，通过 App 层定时读 sidecar 管理 API 做差量。

优点是 sidecar 改动最少；缺点是请求级时序与并发场景容易错配，且 App 退出时无法可靠记录。

结论：仅作为降级方案，不作为主方案。

## 推荐方案

选择方案 B：新增 GetTokens 专属 middleware 与 SQLite attribution ledger。

### 2026-05-15 具体施工结论

本期把“middleware 实现”拆成两层，避免在 Gin 响应层重复解析 token 或猜测最终命中账号：

1. **入口 middleware**：只负责请求级上下文，例如 `request_id`、请求路径、客户端请求模型、客户端 relay key hash。它不直接决定账号归因。
2. **usage attribution plugin**：注册到 CLIProxyAPI 现有 `sdk/cliproxy/usage` plugin 链路，消费 `usage.Record` 后写入 ledger。`usage.Record` 已包含 `Provider / Model / Alias / APIKey / AuthID / AuthIndex / AuthType / Source / RequestedAt / Latency / Failed / Fail / Detail`，更适合作为真实命中后的归因事实源。

这样仍满足“在流量侧加入中间键并持久化”的要求，同时最大限度复用上游 usage reporter，不把 GetTokens 字段写入 `usage.Record` 或 `/usage` payload。

最终数据流：

```text
relay request
  -> GetTokens ingress middleware
      - 生成 request_id
      - 记录 requested_model / route path / client key hash 到 gin context
  -> CLIProxyAPI upstream routing / auth selection / retry
  -> upstream usage reporter publishes usage.Record
  -> GetTokens usage attribution plugin
      - 从 usage.Record + context 解析 runtime attribution evidence
      - 写入 usage-attribution-v1.sqlite
  -> GetTokens management endpoint exposes attribution summary
  -> Wails GetSidecarUsageAttribution resolves account_key to local-id
  -> frontend AccountCard renders request count / token curve / quota windows
  -> frontend UsageDesk observed source renders real request volume from the same ledger
```

关键边界：

1. 归因事件以 **provider attempt** 为粒度，而不是前端一次请求为粒度。发生 retry / fallback 时，经过哪个账号就给哪个账号记一条事件。
2. `account_key` 是 GetTokens 前端资产 key；`attribution_key` 是流量侧中间键。对于 `codex-api-key`，Wails 返回给前端的最终 `account_key` 必须是 `codex-api-key:<local-id>`；sidecar ledger 可保留 runtime `auth_id / source_hash / api_key_hash` 作为证据键。
3. `quota` 不进入 attribution ledger。quota 继续由 `GetCodexQuota` 与 `QuotaSnapshot` 管理，账号卡片只是把多个 quota window 并列展示。

### 结构

```text
client request
  -> GetTokens attribution middleware enters
      - capture request_id
      - capture path / method / requested model / client api key hash
  -> upstream CLIProxyAPI routes normally
      - upstream core usage remains unchanged
      - upstream auth selector / handlers remain upstream compatible
  -> upstream usage reporter publishes usage.Record
  -> GetTokens usage attribution plugin consumes usage.Record
      - observe provider / auth_index / api_key hash / source / status / latency / tokens
      - write attribution event to SQLite
  -> GetTokens Wails queries attribution ledger
  -> frontend joins ledger account_key to AccountRecord
```

### 存储

SQLite 文件继续放在 sidecar config 同级或 writable base 下，建议命名：

```text
usage-attribution-v1.sqlite
```

路径解析优先级：

1. `GETTOKENS_USAGE_ATTRIBUTION_SQLITE_PATH`
2. `filepath.Dir(configFilePath)/usage-attribution-v1.sqlite`
3. `writableBase/usage-attribution-v1.sqlite`
4. `~/.config/gettokens/usage-attribution-v1.sqlite`

首版只建事件表，不建 rollup 表；聚合通过 SQL 按窗口查询，后续数据量上来再加物化 rollup。

```sql
CREATE TABLE IF NOT EXISTS usage_attribution_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL DEFAULT '',
  attempt_index INTEGER NOT NULL DEFAULT 0,
  started_at_unix_ms INTEGER NOT NULL,
  completed_at_unix_ms INTEGER NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  routed_model TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  attribution_key TEXT NOT NULL,
  attribution_kind TEXT NOT NULL,
  account_key TEXT NOT NULL DEFAULT '',
  credential_key TEXT NOT NULL DEFAULT '',
  auth_id TEXT NOT NULL DEFAULT '',
  auth_index TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL DEFAULT '',
  api_key_hash TEXT NOT NULL DEFAULT '',
  status_code INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  evidence_kind TEXT NOT NULL,
  evidence_ref TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_usage_attribution_account_time
  ON usage_attribution_events(account_key, completed_at);

CREATE INDEX IF NOT EXISTS idx_usage_attribution_key_time
  ON usage_attribution_events(attribution_key, completed_at_unix_ms);

CREATE INDEX IF NOT EXISTS idx_usage_attribution_model_time
  ON usage_attribution_events(requested_model, completed_at_unix_ms);

CREATE INDEX IF NOT EXISTS idx_usage_attribution_auth_index_time
  ON usage_attribution_events(auth_index, completed_at_unix_ms);
```

`attribution_key` 是流量侧稳定中间键，按优先级生成：

1. `auth-index:<auth_index>`：OAuth/auth-file 命中时优先使用。
2. `auth-id:<auth_id>`：API key / openai-compatible 命中时优先使用 sidecar runtime auth id，不写明文密钥。
3. `source:<normalized_source_hash>`：当 `usage.Record.Source` 可稳定代表配置项时使用。
4. `api-key-hash:<sha256(upstream_api_key)>`：仅当能明确取得上游账号 key 时作为 fallback；不能使用入口 relay key。
5. `provider:<provider>`：openai-compatible 或多 key provider 最低精度回退。

`account_key` 是 GetTokens 资产级 key，能在 sidecar 内直接解析时写入；不能直接解析时保持空字符串，由 Wails 读取 summary 后根据账号清单补齐：

1. `auth-file:<name>`
2. `codex-api-key:<local-id>`
3. `openai-compatible:<provider-name>`

`codex-api-key` 的最终归因必须落到 `codex-api-key:<local-id>`。Wails 需要维护 `local-id -> historical auth_id/source_hash/api_key_hash` 映射，使用户编辑 `apiKey / baseUrl / prefix` 后，旧 ledger 事件仍能归到同一个 local-id。

`credential_key` 只在可稳定识别具体 credential 时写入，例如 `sha256:<first16>`；不得写明文 API key。

保留字段说明：

1. `auth_index`：用于 `auth-file` 与现有 quota / auth-files 管理面 join。
2. `auth_id`：用于 Wails 把 runtime sidecar auth 命中映射回本地 `codex-api-key:<local-id>`。
3. `source_hash`：用于兼容旧 `/usage` source 语义，但避免把疑似密钥原文写入 ledger。
4. `api_key_hash`：仅用于 fallback 与诊断，且必须确认来源是上游账号 key，不得用入口 relay key。
5. `evidence_kind`：记录归因来源，枚举值建议为 `auth_index`、`auth_id`、`source_hash`、`api_key_hash`、`provider_fallback`、`unresolved`。

保留期：

1. 默认保留 30 天事件。
2. 单库事件数超过 100000 时按 `completed_at_unix_ms` 删除最旧数据。
3. 清理在 plugin 写入后异步节流执行，不能阻塞 relay 请求。

### 归因证据来源与解析规则

usage attribution plugin 按以下优先级解析：

1. `record.AuthIndex` 非空：写 `attribution_key = auth-index:<auth_index>`，`evidence_kind = auth_index`。
2. `record.AuthID` 非空：写 `attribution_key = auth-id:<auth_id>`，`auth_id = <auth_id>`，`evidence_kind = auth_id`。
3. `record.Source` 非空：先做 secret 检测；安全时 hash 后写 `source_hash`，`evidence_kind = source_hash`。
4. `record.APIKey` 非空且确认是上游账号 key：只计算 hash，写 `attribution_key = api-key-hash:<hash16>`，`api_key_hash = <hash16>`，`evidence_kind = api_key_hash`。当前 CLIProxyAPI `usage.Record.APIKey` 来自入口 relay key，不能作为账号归因主证据。
5. `record.Provider` 非空：写 `attribution_key = provider:<provider>`，`evidence_kind = provider_fallback`。
6. 都不可用：写 `attribution_key = unresolved:<request_id>`，`evidence_kind = unresolved`，但不丢事件。

首版不要求 sidecar 直接解析 `codex-api-key:<local-id>`，因为 local id 属于 GetTokens 本地资产，不一定存在于 CLIProxyAPI runtime config。Wails 负责把 `auth_id/source_hash/api_key_hash` 等证据键 join 回本地账号，并确保对前端暴露的 `accountKey` 是 `codex-api-key:<local-id>`。

如果本期发现 `usage.Record` 缺少某类必要证据，只允许增加**极薄 context metadata hook**：

```text
gin.Context.Set("gettokens.attribution_key", "auth-index:<value>")
gin.Context.Set("gettokens.attribution_kind", "auth_index")
```

这个 hook 只能写不含密钥的中间键，不能扩展 `usage.Record`、`RequestDetail` 或 `/usage` DTO。

### 查询 API

不扩展上游 `/usage` payload。新增 GetTokens 专属 management API 或通过 Wails sidecar call 读取：

```text
GET /v0/management/gettokens/usage-attribution?window=24h&bucket=1h
```

返回结构：

```json
{
  "window": "24h",
  "bucket": "1h",
  "generatedAt": "2026-05-15T06:00:00Z",
  "items": [
    {
      "attributionKey": "auth-index:abc123",
      "attributionKind": "auth_index",
      "accountKey": "auth-file:auth.json",
      "credentialKey": "",
      "provider": "codex",
      "requestedModels": ["gpt-5.4"],
      "requestCount": 12,
      "failedCount": 1,
      "latencyAverageMs": 812,
      "inputTokens": 12000,
      "cachedInputTokens": 3400,
      "outputTokens": 8056,
      "totalTokens": 23456,
      "lastActivityAt": "2026-05-15T05:40:00Z",
      "buckets": [
        {
          "start": "2026-05-15T05:00:00Z",
          "requestCount": 3,
          "totalTokens": 6400
        }
      ]
    }
  ]
}
```

### 2026-05-15 前端已落地链路

1. 账号卡片状态读取改为：`GetSidecarUsageAttribution(window=24h,bucket=1h)` 优先，`GetUsageStatistics` fallback。
2. `usage-codex` 的 observed source 改为同一 attribution summary 真源：
   - `range -> window`：`7D/14D/30D/全部 => 7d/14d/30d/all`
   - `resolution -> bucket`：`1M/5M/15M/30M/60M => 1m/5m/15m/30m/1h`
3. Usage Desk observed 主图按 `requestCount` 渲染，不再假设“一条 detail = 一次请求”。
4. token 不进 observed 主图，而是进入摘要与分钟明细表；明细行保留 `accountKey / unresolved attributionKey` 备注，便于核对归因缺口。
5. sidecar attribution summary 已新增 `window=all` / `window=unbounded` 语义，`全部` 视图不再依赖前端的 365 天近似值。

实现方式建议通过 `WithRouterConfigurator` 注册 GetTokens 专属 management route，而不是塞进上游 management handler 文件。这样 route 和 ledger 都留在 `internal/gettokenshooks/` 边界内。

Wails 层新增方法建议使用 options DTO，避免账号卡片固定 24h 与 Usage Desk resolution 共用时再次改签名：

```text
internal/wailsapp.App.GetSidecarUsageAttribution(input SidecarUsageAttributionInput) (*SidecarUsageAttributionResponse, error)
main.App.GetSidecarUsageAttribution(input SidecarUsageAttributionInput) (*SidecarUsageAttributionResponse, error)
```

首版 input 字段：

```text
window string
bucket string
includeUnresolved bool
```

Wails 返回给前端时完成账号 join：

1. `auth-index:<auth_index>` -> 当前账号清单中的 `auth-file:<name>`。
2. `auth-id:<auth_id>` -> 本地 Codex API key store 的 `codex-api-key:<local-id>`，并兼容 historical evidence mapping。
3. `provider:<provider>` -> `openai-compatible:<provider-name>`。
4. 未能 join 的 item 保留在 `unresolved` 列表，前端不挂到账号卡片，但可进入后续 Usage Desk 调试面板。

前端新增数据结构：

```ts
interface AccountAttributionSummary {
  hasAttribution: boolean;
  requestCount: number;
  failedCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  averageLatencyMs: number | null;
  lastActivityAt: number | null;
  buckets: Array<{ start: string; requestCount: number; totalTokens: number }>;
}
```

`AccountUsageSummary` 继续保留旧 health 字段，但扩展 attribution 字段。账号卡片主指标改读 `requestCount`；旧 `statusBar` 只作为 fallback 或详情诊断。

前端加载顺序：

1. `useAccountsUsageState` 调用 `GetSidecarUsageAttribution({ window: "24h", bucket: "1h" })`。
2. 成功时用 attribution summary 构建 `accountUsageByID`。
3. attribution endpoint 不可用或为空时，再调用 `GetUsageStatistics()` 并走当前 `buildAccountUsageSummaryMap`。
4. quota 仍由 `useAccountsQuotaState` 独立加载，卡片渲染多个 `QuotaWindow`。

### Usage Codex 真实请求量接入

`http://localhost:34115/#frame=codex&workspace=usage-codex` 当前由 `UsageDeskFeature workspace="codex"` 承载。该页的“真实请求量”按钮当前直接调用 `GetUsageStatistics()`，并通过 `buildUsageDeskObservedSnapshot` 聚合 success / failure / request count。本期需要一起切到 attribution ledger：

1. `source === "observed"` 时优先调用 `GetSidecarUsageAttribution({ window, bucket })`，不再把 `/usage` 作为主真源。
2. `UsageDeskObservedDetail` 扩展 token 与归因字段：
   - `requestCount`
   - `inputTokens`
   - `cachedInputTokens`
   - `outputTokens`
   - `totalTokens`
   - `accountKey`
   - `attributionKey`
3. `buildUsageDeskObservedSnapshot` 支持两类输入：
   - 新 attribution response：从 `items[].buckets` 聚合每日 / 分钟桶。
   - 旧 `/usage` response：作为 fallback 继续走现有 details 解析。
4. 图表首版仍以“请求次数”为主单位，保证 `真实请求量` 的既有语义不跳变；摘要和明细表补充 token 分解。
5. minute detail row 从旧的 `成功 / 失败` 单行摘要升级为：
   - `requests`
   - `inputTokens`
   - `cachedInputTokens`
   - `outputTokens`
   - `totalTokens`
   - dominant `provider / model / accountKey`
6. `Gemini Usage Desk` 不在本期接入 attribution ledger，继续保留独立页面边界。

前端加载策略调整：

```text
UsageDeskFeature source=observed
  -> GetSidecarUsageAttribution({ window: resolveWindowFromRange(range), bucket: resolution })
      success: buildUsageDeskObservedSnapshot(attributionResponse)
      error/empty: GetUsageStatistics() fallback
```

为了避免请求量页面和账号卡片重复转换，建议新增纯函数：

```text
buildAccountUsageSummaryMapFromAttribution(accounts, attributionResponse)
buildUsageDeskObservedSnapshotFromAttribution(attributionResponse, selectedDayKey, resolution)
```

`buildUsageDeskObservedSnapshot` 可保留为兼容入口，内部根据 payload shape 分发到 attribution 或 legacy usage parser。

## 与现有 `/usage` 的关系

1. `/usage` 继续保持上游语义，用于全局请求观测、现有 health bar 兼容和历史 snapshot restore。
2. 新 attribution ledger 负责账号级 join。
3. 前端归因顺序调整为：
   - 优先使用 attribution ledger。
   - attribution ledger 不可用时，回退旧 `/usage` 启发式归因。
4. `usage-codex` 的“真实请求量”也优先使用 attribution ledger；旧 `/usage` 仅作为页面 fallback。
5. 不把 attribution ledger 反写进 `/usage` snapshot。

## 需要撤回或避免的改动

如果 fork 中已有以下改动，按本期方向撤回：

1. `sdk/cliproxy/usage.Record` 新增 GetTokens 账号归因字段。
2. `internal/usage.RequestDetail` 新增 `usage_attribution_key` / `usage_credential_key`。
3. `/v0/management/usage` payload 为 GetTokens 账号页新增专属字段。
4. 任何把 GetTokens 账号资产语义写入 upstream core usage snapshot 的改动。

保留或允许的改动：

1. `internal/gettokenshooks/` 下的 GetTokens 专属 middleware / SQLite ledger。
2. sidecar 启动时安装 middleware 的一行式接入。
3. 极薄 context metadata hook，前提是不改 upstream usage DTO，不暴露密钥。

## 测试策略

### sidecar fork

1. middleware 能为 `/v1/chat/completions` 生成一条 attribution event。
2. 成功 / 失败请求都能落 ledger。
3. 并发请求不会互相串账号。
4. 旧 `/usage` schema 与 snapshot 测试保持上游一致。
5. ledger 中不包含明文 API key、access token、refresh token。

### GetTokens backend

1. 新增 Wails 方法读取 attribution summary。
2. root `app.go` / `app_types.go` / mapper 同步。
3. sidecar endpoint 不可用时，前端回退旧 usage 归因。

### Frontend

1. `AccountUsageSummary` 优先消费 attribution summary。
2. 账号卡片展示请求经过次数。
3. 旧 `/usage` health bar 仍兼容。
4. `UsageDeskFeature workspace="codex"` 的 observed source 优先消费 attribution summary。
5. `usageDesk.ts` 能把 attribution buckets 聚合为日级和分钟级真实请求量，旧 `/usage` parser 保持 fallback。

## 风险检查

### 依赖失败

middleware 或 ledger endpoint 不可用时，GetTokens 回退现有 `/usage` 逻辑，不影响账号页基本展示。

### 规模放大

事件表比 snapshot blob 更适合 10x 请求量。首版需要加时间与账号索引，并保留后续按时间清理或归档策略。

### 回滚成本

删除 GetTokens middleware 与 endpoint 即可回到上游 sidecar 行为；SQLite ledger 是旁路数据，可丢弃。

### 脆弱前提

最脆弱的前提是 middleware 是否能稳定拿到最终命中的账号。如果现有上下文不足，应先补极薄 context metadata hook，而不是退回修改 usage core。

## 本期不变量

1. CLIProxyAPI core usage DTO 尽量保持 upstream 一致。
2. GetTokens 账号归因逻辑集中在 GetTokens hook / middleware。
3. 不记录明文密钥。
4. 不把 quota 当 usage。
5. 不把 Codex local rollout usage 强行归因到 auth-file。
