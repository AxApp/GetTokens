# Local ID 每日限额 — 中间件实施方案

日期：2026-05-15

## 调查结论

**后端当前完全不具备每日限额配置与 enforcement 能力。** 具体缺口：

- 无每日限额数据结构（`DailyTokenLimit`/`DailyRequestLimit`）
- 无配置持久化文件
- 无 pre-relay 用量检查逻辑
- 无按账号维度的当日用量统计（attribution ledger 在 [[20260514-sidecar-usage-account-attribution]] 中规划但尚未实施）

**关键架构约束：** LLM 请求由外部客户端直接访问 sidecar HTTP 端点，绕过 Go/Wails 层。因此 enforcement **必须**在 sidecar fork 中实现，Go 端只负责配置管理和用量查询。

## 整体架构

```
外部客户端 (Claude Code / Codex CLI / etc.)
    |
    v
sidecar HTTP 端点 (127.0.0.1:8317)
    |
    +-- [NEW] GetTokens DailyQuota Pre-Relay Middleware
    |     1. 从 gin context 读取本次请求匹配到的 account (由 upstream routing 注入)
    |     2. 查询 local daily quota config (from config file or management API)
    |     3. 查询 attribution ledger 当日用量
    |     4. 若超限: 返回 429 + X-GetTokens-Quota-Exceeded header, 触发 routing fallback
    |     5. 若未超限: 放行到 upstream relay
    |
    +-- CLIProxyAPI upstream routing / auth / retry / usage reporter
    |
    +-- [EXISTING-PLAN] GetTokens usage attribution plugin (记录用量到 ledger)
    |
    v
AI Provider API
```

## 三层中间件体系

参照 [[20260514-sidecar-usage-account-attribution]] 的架构决策，每日限额复用同一 middleware 体系，形成三层：

### Layer 1: 配置注入层 (Startup Hook)

在 sidecar 启动时加载每日限额配置，注入到 Gin context 或全局状态：

```
sidecar 启动
  -> 读取 ~/.config/gettokens-data/daily-quotas-v1.json
  -> 解析为 map[account_key]DailyQuotaConfig
  -> 注入到 sidecar runtime state
  -> [NEW] 注册 management endpoint: GET/PUT /v0/management/daily-quotas
```

**配置结构：**

```go
// persisted to ~/.config/gettokens-data/daily-quotas-v1.json
type DailyQuotaConfig struct {
    AccountKey       string `json:"account_key"`        // "codex-api-key:<local-id>"
    Enabled          bool   `json:"enabled"`
    DailyTokenLimit  int64  `json:"daily_token_limit"`  // 0 = unlimited
    DailyRequestLimit int64 `json:"daily_request_limit"` // 0 = unlimited
    ResetHourUTC     int    `json:"reset_hour_utc"`      // 0-23, default 0
    UpdatedAt        int64  `json:"updated_at"`
}

// top-level file: {"quotas": [...], "version": 1}
```

**Sidecar management API 新增：**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/management/daily-quotas` | 返回所有限额配置 |
| `PUT` | `/v0/management/daily-quotas` | 全量替换限额配置 |
| `PATCH` | `/v0/management/daily-quotas/<account-key>` | 更新单个账号限额 |
| `DELETE` | `/v0/management/daily-quotas/<account-key>` | 删除单个账号限额 |

### Layer 2: Pre-Relay Enforcement Middleware (Gin Middleware)

这是核心 enforcement 层，在 upstream routing 选定账号后、实际 relay 前执行：

```
relay request
  -> GetTokens ingress middleware (20260514: 生成 request_id, 记录 context)
  -> CLIProxyAPI upstream routing 选定 account
  -> [NEW] GetTokens DailyQuota middleware
      1. 读取 gin context 中被选中的 account attribution key
      2. 查询该 account 是否配置了每日限额
      3. 若已启用:
         a. 查询 attribution ledger: 该 account 当日已用 tokens/requests
         b. 计算: 本次请求预估 tokens + 当日已用 tokens > 限额?
         c. 若超限:
            - 写入 X-GetTokens-Quota-Exceeded: daily-limit 到 response header
            - 返回 429 Too Many Requests
            - 触发 upstream retry/fallback 到下一个候选账号
         d. 若未超限:
            - 放行
  -> relay 到 AI Provider
  -> usage attribution plugin 记录用量
```

**关键设计决策：**

1. **Check-before-relay（预估模式） vs check-after-relay（事后模式）：**
   - 首版选择 **check-before-relay with estimation**：
     - 请求次数限额：直接检查当日 count，超限即拒绝
     - Token 限额：因为无法预知本次请求的 token 消耗，使用"软限制"模式——
       当日已用 tokens 超限时拒绝，未超限则放行（即使本次请求可能导致超额）
   - 后续可升级为 check-after-relay 硬限：请求完成后检查，超额则标记次日扣减

2. **Middleware 注册位置：**
   - 在 CLIProxyAPI `WithMiddleware` 链中，排序在 ingress middleware 之后、auth selector 之前
   - 需要与 upstream routing 协商：middleware 如何获取"当前 routing 选中的 account"

3. **与 upstream routing retry 的协作：**
   - 429 返回后，upstream routing 的 retry 机制应自动尝试下一个候选账号
   - 若所有候选账号都超限，返回 429 给客户端

### Layer 3: Usage Tracking (复用 Attribution Ledger)

每日限额的当日用量查询直接复用 [[20260514-sidecar-usage-account-attribution]] 的 SQLite attribution ledger。

**查询接口：**

```sql
-- 查询某账号当日用量
SELECT
    COUNT(*) as request_count,
    COALESCE(SUM(input_tokens), 0) as total_input_tokens,
    COALESCE(SUM(output_tokens), 0) as total_output_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens
FROM attribution_events
WHERE account_key = ?
  AND requested_at >= ?  -- 当日 0:00 UTC (根据 reset_hour_utc 计算)
  AND requested_at <  ?  -- 次日 0:00 UTC
```

**Sidecar management API 新增：**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v0/management/daily-quotas/usage?account_key=<key>` | 返回单账号当日用量 |
| `GET` | `/v0/management/daily-quotas/usage-summary` | 返回所有已配置限额账号的当日用量摘要 |

## Go/Wails 端变更

Go 端不参与 enforcement，只负责配置管理：

### 新增文件

- `internal/wailsapp/daily_quota_config.go` — 配置读写、Wails 绑定

### 新增 Wails 绑定

```go
// GetDailyQuotaConfigs 返回所有已配置的每日限额
func (a *App) GetDailyQuotaConfigs() ([]DailyQuotaConfig, error)

// UpdateDailyQuotaConfig 创建或更新单个账号的每日限额
func (a *App) UpdateDailyQuotaConfig(input DailyQuotaConfig) error

// DeleteDailyQuotaConfig 删除单个账号的每日限额
func (a *App) DeleteDailyQuotaConfig(accountKey string) error

// GetAccountDailyUsage 查询单个账号当日用量（从 sidecar management API）
func (a *App) GetAccountDailyUsage(accountKey string) (*DailyUsage, error)

// GetDailyQuotaUsageSummary 查询所有已配置限额账号的当日用量摘要
func (a *App) GetDailyQuotaUsageSummary() ([]DailyQuotaUsageSummary, error)
```

### 配置持久化

复用 [[20260514-sidecar-usage-account-attribution]] 中确认的 evidence mapping 持久化路径模式：

- 文件：`~/.config/gettokens-data/daily-quotas-v1.json`
- 格式：单文件 JSON，以 account local ID 为 key
- 导入导出直接使用该文件

### 与 sidecar 同步

Go 端通过 `PUT /v0/management/daily-quotas` 将配置同步到 sidecar。同步时机：
1. App 启动时（sidecar ready 后）
2. 用户修改限额配置后
3. sidecar 重启后（在 health check 通过后自动重新同步）

## 前端变更

### 新增类型

```typescript
// frontend/src/types.ts
interface DailyQuotaConfig {
  accountKey: string;
  enabled: boolean;
  dailyTokenLimit: number;   // 0 = unlimited
  dailyRequestLimit: number; // 0 = unlimited
  resetHourUTC: number;      // 0-23
}

interface DailyUsage {
  accountKey: string;
  requestCount: number;
  totalTokens: number;
  resetAtUnix: number;  // 下次重置时间
}
```

### 组件变更

| 组件 | 变更 |
|------|------|
| `AccountCard.tsx` | 新增每日限额进度条，与 Codex 计划额度并列 |
| `ApiKeyDetailModal.tsx` | 新增 "每日限额" 配置 section |
| `AccountOrderRow.tsx` | 超限时显示 `限额已满` chip |
| `UsageDeskFeature.tsx` | 新增 `每日限额` 观察源 |

## 实施顺序

每日限额与 [[20260514-sidecar-usage-account-attribution]] 有依赖关系，推荐按以下顺序实施：

1. **Phase 1** — Attribution ledger (20260514 space)
   - 实施 usage attribution plugin + SQLite ledger
   - 实施 sidecar management endpoint 暴露 attribution summary

2. **Phase 2** — 配额配置层 (本期)
   - `daily-quotas-v1.json` 持久化
   - Sidecar management API: CRUD 限额配置
   - Go/Wails 绑定: 限额配置 CRUD

3. **Phase 3** — Enforcement 中间件 (本期)
   - sidecar pre-relay Gin middleware (check-before-relay)
   - 超限 429 响应 + routing fallback
   - 用量查询集成 attribution ledger

4. **Phase 4** — 前端 (本期)
   - 每日限额进度条
   - 配置 UI
   - Usage Desk 观察源

## 与既有 quota 的关系

| | 每日限额 (新) | Codex 计划额度 (既有) |
|---|---|---|
| 配置来源 | 用户本地配置 | Codex API 远程只读 |
| 存储位置 | `daily-quotas-v1.json` | 无本地存储，每次实时拉取 |
| Enforcement | sidecar middleware 主动拦截 | sidecar `quota-exceeded` 行为（switch-project 等） |
| UI 展示 | 进度条 + 剩余量 | 百分比窗口 (5H/7D) |
| 重置周期 | 每日 UTC 固定时间 | 跟随 Codex 计划窗口 |
| 对所有账号类型 | 是 | 仅 Codex auth-file + codex-api-key |

## 验证计划

1. `internal/wailsapp/daily_quota_config_test.go` — 配置 CRUD 与序列化
2. sidecar middleware 单元测试 — mock attribution ledger，验证超限拒绝与放行
3. sidecar integration test — 完整 relay 流 + 超限 fallback
4. Wails DTO 映射测试
5. 前端 unit test — 进度条计算、超限状态展示
6. `npm run typecheck` + `npm run build`
