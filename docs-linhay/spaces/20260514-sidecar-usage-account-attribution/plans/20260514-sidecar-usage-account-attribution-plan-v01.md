# Sidecar Usage Account Attribution Plan v01

日期：2026-05-14

## 目标

通过 GetTokens 专属 middleware 和旁路 SQLite ledger，让 GetTokens 能按具体账号统计 sidecar 真实请求流量，同时让 CLIProxyAPI core usage 结构尽量保持上游一致。

## BDD 场景

1. auth-file 命中后，attribution ledger 记录 `account_key = auth-file:<name>`，账号卡片请求数增加。
2. codex-api-key 命中后，attribution ledger 记录 `account_key = codex-api-key:<local-id>`，编辑配置后归因不漂移。
3. openai-compatible 命中后，attribution ledger 至少归因到 `openai-compatible:<provider-name>`。
4. middleware / ledger 不可用时，GetTokens 回退旧 `/usage` health 逻辑。
5. ledger 不暴露完整 API key 或 OAuth token。

## 先撤回的方向

如果 CLIProxyAPI fork 中已经做过以下相关改动，本期先撤回：

1. `sdk/cliproxy/usage.Record` 的 GetTokens 账号归因字段。
2. `internal/usage.RequestDetail` 的 `usage_attribution_key` / `usage_credential_key`。
3. `/v0/management/usage` payload 中的 GetTokens 专属账号归因字段。
4. 围绕这些字段建立的 snapshot schema 或测试。

保留 upstream usage snapshot 的原始语义。账号归因进入新的 middleware ledger。

## TDD 顺序

### 1. sidecar attribution plugin 红灯

先在 CLIProxyAPI fork 中补测试：

1. 注册 GetTokens usage attribution plugin 后，消费一条 `usage.Record` 能写入一条 ledger event。
2. 成功请求写 `failed = 0`，失败请求写 `failed = 1`。
3. ledger event 包含 `request_id / attribution_key / auth_index / api_key_hash / latency_ms / requested_model / token detail`。
4. ledger 不包含明文 API key、access token、refresh token。

预期红灯：当前只有 usage snapshot persistence hook，没有 attribution ledger。

### 2. 账号归因红灯

补三类归因测试：

1. `AuthIndex` 能生成 `attribution_key = auth-index:<auth_index>`。
2. `APIKey` 只能生成 hash，不能把明文 key 写入 DB。
3. `Provider` fallback 能生成 `attribution_key = provider:<provider>`。

预期红灯：当前路由探测只做一次性 recent request 差量，没有持久化 attribution event。

### 3. sidecar 最小实现

1. 在 `internal/gettokenshooks/` 新增 `usage_attribution.go`、store、query service 和测试。
2. 复用 `usage.Plugin` 消费 `usage.Record`，从 `AuthIndex / APIKey / Source / Provider` 生成 `attribution_key`。
3. 通过 `WithRouterConfigurator` 注册 `GET /v0/management/gettokens/usage-attribution`。
4. 如需要请求入口信息，再用 `WithMiddleware` 写 `request_id / requested_model` 到 gin context；不从响应体重复解析 token。
5. 如现有 context 信息不足，只加极薄 `gin.Context.Set("gettokens.attribution_key", "...")` 类 metadata hook；不改 `usage.Record`。

### 4. GetTokens backend 红灯

补 Go 测试：

1. Wails core 能读取 sidecar attribution summary。
2. root `app.go / app_types.go` 暴露 summary DTO。
3. Wails 能把 sidecar `attribution_key` join 到 `AccountRecord` 资产 key。
4. ledger endpoint 不可用时返回明确错误，前端可 fallback。

预期红灯：当前只有 `GetUsageStatistics`，没有 attribution summary API。

### 5. GetTokens backend 最小实现

1. 新增 `GetSidecarUsageAttribution(window string)` Wails 方法。
2. DTO 使用 `accountKey -> summary` 的 map，同时保留 unresolved items。
3. join 规则：
   - `auth-index:<value>` -> auth-file account
   - `api-key-hash:<hash>` -> codex-api-key local id
   - `provider:<name>` -> openai-compatible provider
4. root `app.go / app_types.go` 与 `frontend/wailsjs` 同步。

### 6. Frontend 红灯

补前端单测：

1. 账号页优先使用 attribution summary 更新 `AccountUsageSummary`。
2. attribution 不可用时回退旧 `/usage` 归因。
3. 账号卡片主指标展示请求经过次数。
4. token 分解字段存在但为空时不显示错误值。
5. 多个 quota window 能在同一张卡内稳定展示。
6. `UsageDeskFeature workspace="codex"` 的真实请求量优先使用 attribution response。
7. `buildUsageDeskObservedSnapshot` 能从 attribution buckets 聚合日级 / 分钟级请求量，并保留旧 `/usage` fallback。

预期红灯：当前 `useAccountsUsageState` 只读 `GetUsageStatistics`。

### 7. Frontend 最小实现

1. 扩展 `useAccountsUsageState`：并行或顺序读取 attribution summary + `/usage` fallback。
2. 扩展 `AccountUsageSummary`：`requestCount / totalTokens / inputTokens / cachedInputTokens / outputTokens / buckets`。
3. 账号卡片 recent health 区改为请求数 + 24h token 曲线。
4. `AccountHealthBar` 保留给 fallback 或详情，不作为归因曲线的成功/失败表达。
5. 扩展 `useUsageDeskFeature`：`source === "observed"` 时优先调用 `GetSidecarUsageAttribution(resolveWindowFromRange(range))`，失败后再调用 `GetUsageStatistics`。
6. 扩展 `usageDesk.ts`：新增 attribution parser，把 ledger buckets 转成 `UsageDeskObservedSnapshot`。
7. `usage-codex` 真实请求量主图首版继续展示请求次数；摘要和分钟明细补充 token 分解。

## 接口与文件清单

### CLIProxyAPI fork

1. `internal/gettokenshooks/usage_attribution.go`
2. `internal/gettokenshooks/usage_attribution_store.go`
3. `internal/gettokenshooks/usage_attribution_query.go`
4. `internal/gettokenshooks/usage_attribution_test.go`
5. `cmd/server/main.go`：安装 hook 和 route configurator。

### GetTokens backend / Wails

1. `internal/wailsapp/usage_attribution.go`
2. `internal/wailsapp/usage_attribution_test.go`
3. `app.go`
4. `app_types.go`
5. `frontend/wailsjs/go/main/App.*`

### Frontend

1. `frontend/src/features/accounts/hooks/useAccountsUsageState.ts`
2. `frontend/src/features/accounts/model/accountUsage.ts`
3. `frontend/src/features/accounts/components/AccountCard.tsx`
4. `frontend/src/features/accounts/components/AccountHealthBar.tsx` 或新增 `AccountAttributionFlow.tsx`
5. `frontend/src/features/accounts/tests/accountUsage.test.mjs`
6. 必要时新增 `frontend/src/features/accounts/tests/accountAttribution.test.mjs`
7. `frontend/src/features/accounts/hooks/useUsageDeskFeature.ts`
8. `frontend/src/features/accounts/model/usageDesk.ts`
9. `frontend/src/features/accounts/tests/usageDesk.test.mjs`

## 已收敛决定

1. `codex-api-key` 最终对前端暴露的 `accountKey` 直接落到持久化 `LocalID`；当前 `LocalID` 本身就是完整账号 ID，例如 `codex-api-key:stable-001`。sidecar ledger 只保留 `auth_id / source_hash / api_key_hash` 等证据键，由 Wails join 回 `LocalID`。
2. openai-compatible 多 key provider 首版按 `openai-compatible:<provider>` 聚合；credential 级 hash 仅用于诊断，不在卡片上拆分。
3. attribution ledger 保留策略采用 30 天 / 100000 events 上限。
4. 账号卡片主图按设计稿落地为 24h token 曲线；成功/失败不在曲线节点表达。
5. Wails 方法签名收敛为 options DTO：`GetSidecarUsageAttribution({ window, bucket, includeUnresolved })`，不使用单字符串签名。
6. `usage-codex` 真实请求量首版保持请求次数为主图单位，token 分解进入摘要和明细表，不单独新增 token/request 切换控件。
7. historical evidence mapping 独立落盘到 `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`。

### 8. 验证与回归

必须运行：

1. sidecar fork：`go test ./...`
2. GetTokens：`go test ./...`
3. frontend：`npm --prefix frontend run typecheck`
4. frontend：`npm --prefix frontend run test:unit`
5. 文档：`docs-linhay/scripts/check-docs.sh`

如涉及真实 sidecar binary 更新，再执行：

1. 从 CLIProxyAPI fork 构建 sidecar。
2. 替换 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`。
3. 重启 Wails app，确认 sidecar ready。
4. 发起一次测试请求，确认 ledger event 和账号卡片请求数更新。

## 文件范围预估

预计超过 8 个文件，必须小步推进：

1. CLIProxyAPI fork middleware / ledger / tests。
2. GetTokens Go Wails DTO / mapper / tests。
3. Wails bindings。
4. Frontend account usage hook / model / card / tests。
5. 文档与 memory。

## 回滚策略

1. 移除 middleware 安装即可回到 upstream sidecar 行为。
2. SQLite ledger 是旁路数据，可直接丢弃。
3. GetTokens 前端保留旧 `/usage` fallback，可单独回滚新展示。

## 完成定义

1. CLIProxyAPI core usage DTO 与 upstream 保持一致。
2. 三类账号都有可测试的 middleware 归因路径。
3. 账号卡片能展示请求经过次数。
4. 敏感信息测试通过。
5. docs、memory、qmd 索引完成同步。
