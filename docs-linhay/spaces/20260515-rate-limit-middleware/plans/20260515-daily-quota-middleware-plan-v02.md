# Local ID 账号限额 — 通用中间件实施方案 v2

日期：2026-05-15

## 与既有 gettokenshooks 模式的对齐

CLIProxyAPI fork 中已有三个 GetTokens hook，全部位于 `internal/gettokenshooks/`，采用统一注册模式：

| Hook | 注册方式 | 接口 |
|------|---------|------|
| `InstallUsageAttributionHook(opts)` | `coreusage.RegisterPlugin(plugin)` | `usage.Plugin.HandleUsage(ctx, record)` — 事后归因 |
| `InstallUsagePersistenceHook(opts)` | `coreusage.RegisterPlugin(plugin)` | `usage.Plugin.HandleUsage(ctx, record)` — 事后持久化 |
| `InstallRoutePolicyHook()` | `coreauth.RegisterRoutePolicy(policy)` | `RoutePolicy.RewriteCandidates(ctx, req)` — 事前路由控制 |

所有 hook 在 `cmd/server/main.go` 中被调用，通过 `WithManagementRouterConfigurator()` 注册管理路由。

**v1 方案的问题：**
1. 使用裸 Gin middleware (`WithMiddleware`)，但 gettokenshooks 中没有任何地方直接使用 Gin middleware — 全部走 domain 接口（`usage.Plugin`、`RoutePolicy`）
2. Enforcement 点选在 Gin middleware 返回 429，但 `RoutePolicy.RewriteCandidates` 已经提供了"在路由前过滤候选账号"的能力，这正是限额 enforcement 需要的
3. 配置模型只支持 "每日"，不够通用
4. 管理路由未采用 `Configure*Routes` 模式
5. 独立 JSON 文件而非与既有 SQLite 体系统一

## 通用配额模型

### 核心抽象：QuotaRule

```go
// QuotaRule 描述一条限额规则：某账号在某时间窗口内允许消耗的上限
type QuotaRule struct {
    ID           string `json:"id"`            // 稳定唯一 ID (uuid)
    AccountKey   string `json:"account_key"`   // "codex-api-key:<local-id>" 等
    Window       string `json:"window"`        // "1h", "6h", "12h", "24h", "7d", "30d"
    LimitType    string `json:"limit_type"`    // "tokens", "requests"
    LimitValue   int64  `json:"limit_value"`   // 窗口内上限, 0 = unlimited
    Action       string `json:"action"`        // "skip" | "warn"
    Enabled      bool   `json:"enabled"`
    Label        string `json:"label"`         // 前端展示名, e.g. "每日 token 上限"
    CreatedAt    int64  `json:"created_at"`
    UpdatedAt    int64  `json:"updated_at"`
}

// QuotaUsage 查询某账号在某窗口内的当前用量
type QuotaUsage struct {
    AccountKey    string `json:"account_key"`
    Window        string `json:"window"`
    WindowStart   int64  `json:"window_start_unix_ms"`
    WindowEnd     int64  `json:"window_end_unix_ms"`
    RequestCount  int64  `json:"request_count"`
    InputTokens   int64  `json:"input_tokens"`
    OutputTokens  int64  `json:"output_tokens"`
    TotalTokens   int64  `json:"total_tokens"`
}

// QuotaRuleStatus 某条规则的当前执行状态
type QuotaRuleStatus struct {
    Rule      QuotaRule `json:"rule"`
    Usage     QuotaUsage `json:"usage"`
    Exceeded  bool       `json:"exceeded"`
    UsagePct  float64    `json:"usage_pct"`   // 0.0-100.0+
}
```

### 设计原则

**与 v1 的关键区别：**

| 维度 | v1 | v2 |
|------|----|----|
| 时间窗口 | 仅 daily | 1h / 6h / 12h / 24h / 7d / 30d（可扩展） |
| 限额类型 | tokens + requests 硬编码 | `LimitType` 字符串，首期支持 `tokens`/`requests`，后续可扩展 `cost`/`concurrent` |
| 超限行为 | 硬编码 skip | `Action` 字段：`skip`（跳过账号）或 `warn`（只通知不拦截） |
| 多规则 | 每账号一条 | 每账号可配多条规则（如同时有 24h token 限额 + 1h request 限额） |
| 注册方式 | 裸 Gin middleware | `RoutePolicy` 接口（与 `route_policy.go` 一致） |
| 管理路由 | 独立路径 | `ConfigureQuotaEnforcementRoutes` 模式 |
| 持久化 | 独立 JSON 文件 | SQLite（与 attribution ledger 同 DB） |

## 实施架构

### 整体数据流

```
外部客户端 (Claude Code / Codex CLI)
    |
    v
sidecar HTTP 端点
    |
    +-- GetTokens ingress middleware (request_id, model context)
    |
    +-- CLIProxyAPI upstream routing
    |     |
    |     +-- RoutePolicy.RewriteCandidates()  ← [NEW] QuotaEnforcementPolicy
    |     |     1. 从 attribution ledger 查询每个候选账号的当前窗口用量
    |     |     2. 对比已配置的 QuotaRule
    |     |     3. 从候选列表中剔除超限账号 (action=skip)
    |     |     4. 对 action=warn 的规则记录超标事件但不剔除
    |     |
    |     +-- 选定最终账号, 发起 relay
    |
    +-- upstream usage reporter 发布 usage.Record
    |
    +-- usage attribution plugin 写入 ledger (20260514)
    |
    v
AI Provider API
```

### 关键设计决策：为什么用 RoutePolicy 而非 Gin middleware

1. **RoutePolicy.RewriteCandidates** 本身就接收"候选账号列表"，返回修改后的列表——这正是限额 enforcement 的语义：从候选列表中移除超限账号。
2. **不与 upstream routing retry 冲突** — 如果返回 429 再由 retry 处理，需要修改 upstream 的 retry 逻辑；而 RoutePolicy 在路由选择阶段就过滤了候选，upstream 无需感知。
3. **与 `route_policy.go` 模式一致** — 已有的 `InstallRoutePolicyHook` 就是通过 `RegisterRoutePolicy` 控制路由的，限额 enforcement 是同一模式的第二个 policy。
4. **RegisterRoutePolicy 支持多 policy 链** — 查看 SDK 源码，`RegisterRoutePolicy` 返回 `func()` 用于取消注册，说明支持注册多个 policy 形成链式调用。

### 子模块设计

#### Module 1: `InstallQuotaEnforcementHook` (sidecar fork)

新增文件：`internal/gettokenshooks/quota_enforcement.go`

```go
package gettokenshooks

// QuotaEnforcementOptions 配置选项
type QuotaEnforcementOptions struct {
    DBPath string  // SQLite DB 路径
}

// InstallQuotaEnforcementHook 安装限额 enforcement hook
// 应在 attribution ledger 初始化后调用
func InstallQuotaEnforcementHook(opts QuotaEnforcementOptions) error {
    // 1. 打开 SQLite, 建表
    store, err := newQuotaRuleStore(opts.DBPath)
    if err != nil {
        return err
    }
    
    // 2. 注册 RoutePolicy (事前过滤)
    coreauth.RegisterRoutePolicy(&quotaEnforcementPolicy{store: store})
    
    // 3. 注册 usage.Plugin (事后用量更新通知, 可选)
    //     实际用量已由 attribution plugin 写入 ledger,
    //     本 plugin 可监听用量变化以实时更新缓存
    coreusage.RegisterPlugin(&quotaUsagePlugin{store: store})
    
    return nil
}

// ConfigureQuotaEnforcementRoutes 注册管理 API 路由
func ConfigureQuotaEnforcementRoutes(router gin.IRouter) {
    group := router.Group("/v0/management/gettokens/quota-rules")
    group.GET("", handleListQuotaRules)
    group.PUT("", handlePutQuotaRules)
    group.POST("", handleCreateQuotaRule)
    group.DELETE("/:id", handleDeleteQuotaRule)
    
    router.GET("/v0/management/gettokens/quota-usage", handleGetQuotaUsage)
    router.GET("/v0/management/gettokens/quota-status", handleGetQuotaStatus)
}
```

**SQLite schema（与 attribution ledger 同 DB）：**

```sql
CREATE TABLE IF NOT EXISTS quota_rules (
    id TEXT PRIMARY KEY,
    account_key TEXT NOT NULL,
    window TEXT NOT NULL,
    limit_type TEXT NOT NULL,
    limit_value INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL DEFAULT 'skip',
    enabled INTEGER NOT NULL DEFAULT 1,
    label TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quota_rules_account ON quota_rules(account_key, enabled);
```

#### Module 2: `quotaEnforcementPolicy` (实现 RoutePolicy)

```go
type quotaEnforcementPolicy struct {
    store *quotaRuleStore
}

func (p *quotaEnforcementPolicy) RewriteCandidates(
    ctx context.Context, 
    req coreauth.RoutePolicyRequest,
) coreauth.RoutePolicyDecision {
    // 1. 加载所有 enabled 的规则
    rules := p.store.loadEnabledRules()
    if len(rules) == 0 {
        return coreauth.RoutePolicyDecision{} // 无规则, 不做任何过滤
    }
    
    // 2. 从 req 中提取候选账号 ID 列表
    candidateIDs := req.CandidateIDs
    
    // 3. 对每个候选账号, 检查是否有超限规则
    denyIDs := []string{}
    for _, id := range candidateIDs {
        accountRules := filterRulesByAccount(rules, id)
        if len(accountRules) == 0 {
            continue
        }
        for _, rule := range accountRules {
            if rule.Action != "skip" {
                continue
            }
            usage := p.store.queryUsage(rule.AccountKey, rule.Window, rule.LimitType)
            if isExceeded(rule, usage) {
                denyIDs = append(denyIDs, id)
                emitQuotaExceededEvent(rule, usage)
                break // 任意一条 skip 规则触发就移除
            }
        }
    }
    
    // 4. 返回被过滤的候选
    return coreauth.RoutePolicyDecision{
        DenyIDs: denyIDs,
    }
}
```

#### Module 3: 用量查询

用量数据来源是 attribution ledger（20260514 space），查询窗口由 `QuotaRule.Window` 决定：

```sql
-- 查询某账号在窗口内的用量
SELECT
    COUNT(*) as request_count,
    COALESCE(SUM(input_tokens), 0) as input_tokens,
    COALESCE(SUM(output_tokens), 0) as output_tokens,
    COALESCE(SUM(total_tokens), 0) as total_tokens
FROM usage_attribution_events
WHERE account_key = ?
  AND completed_at_unix_ms >= ?  -- now - window duration
  AND completed_at_unix_ms <  ?  -- now
  AND failed = 0                 -- 只统计成功的请求
```

**窗口计算：**

```go
func windowBoundary(now time.Time, window string) (int64, int64) {
    switch window {
    case "1h":   return now.Add(-1*time.Hour).UnixMilli(), now.UnixMilli()
    case "6h":   return now.Add(-6*time.Hour).UnixMilli(), now.UnixMilli()
    case "12h":  return now.Add(-12*time.Hour).UnixMilli(), now.UnixMilli()
    case "24h":  return now.Add(-24*time.Hour).UnixMilli(), now.UnixMilli()
    case "7d":   return now.Add(-7*24*time.Hour).UnixMilli(), now.UnixMilli()
    case "30d":  return now.Add(-30*24*time.Hour).UnixMilli(), now.UnixMilli()
    default:     return now.Add(-24*time.Hour).UnixMilli(), now.UnixMilli()
    }
}
```

#### Module 4: `cmd/server/main.go` 注册

```go
// 在 usage attribution hook 之后（因为依赖同一個 SQLite DB）
if cfg.UsageStatisticsEnabled {
    // ... 现有 attribution + persistence hook ...
    
    // NEW: 安装限额 enforcement hook
    if err := gettokenshooks.InstallQuotaEnforcementHook(
        gettokenshooks.QuotaEnforcementOptions{
            DBPath: filepath.Join(dataDir, "usage-attribution-v1.sqlite"),
        },
    ); err != nil {
        log.WithError(err).Warn("quota enforcement hook install failed")
    }
}

// 注册管理路由
serverOpts = append(serverOpts, 
    api.WithManagementRouterConfigurator(
        gettokenshooks.ConfigureQuotaEnforcementRoutes,
    ),
)
```

## Go/Wails 端变更

Go 端通过 sidecar management API 操作限额规则：

### 新增文件

- `internal/wailsapp/quota_rules.go` — Wails 绑定，代理到 sidecar management API

### Wails 绑定

```go
// ListQuotaRules 获取所有限额规则
func (a *App) ListQuotaRules() ([]QuotaRule, error)

// CreateQuotaRule 创建限额规则
func (a *App) CreateQuotaRule(input QuotaRule) (*QuotaRule, error)

// UpdateQuotaRule 更新限额规则
func (a *App) UpdateQuotaRule(input QuotaRule) (*QuotaRule, error)

// DeleteQuotaRule 删除限额规则
func (a *App) DeleteQuotaRule(id string) error

// GetQuotaRuleStatus 查询某账号所有规则的执行状态
func (a *App) GetQuotaRuleStatus(accountKey string) ([]QuotaRuleStatus, error)

// GetAllQuotaStatus 查询所有已配置限额账号的执行状态
func (a *App) GetAllQuotaStatus() ([]QuotaRuleStatus, error)
```

## 前端变更

### 新增类型

```typescript
// frontend/src/types.ts
interface QuotaRule {
  id: string;
  accountKey: string;
  window: '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
  limitType: 'tokens' | 'requests';
  limitValue: number;    // 0 = unlimited
  action: 'skip' | 'warn';
  enabled: boolean;
  label: string;
}

interface QuotaUsage {
  accountKey: string;
  window: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface QuotaRuleStatus {
  rule: QuotaRule;
  usage: QuotaUsage;
  exceeded: boolean;
  usagePct: number;
}
```

### 组件变更

| 组件 | 变更 |
|------|------|
| `AccountCard.tsx` | 通用限额进度条组件，按 window 分组展示多条规则进度 |
| `ApiKeyDetailModal.tsx` | 新增 `QuotaRuleEditor` section：多规则列表 + 新增/编辑/删除 |
| `AccountOrderRow.tsx` | 超限时显示窗口标签 chip（如 `24h tokens 已满`） |
| `QuotaRuleEditor.tsx` | 新增通用组件：window 选择器、limitType 选择器、value 输入、action 选择 |
| `UsageDeskFeature.tsx` | 新增 `本地限额` 观察源：所有规则进度一览 |

## 实施顺序

1. **Phase 1** — Attribution ledger (20260514 space)
   - 实施 `usageAttributionPlugin` + SQLite ledger schema
   - `usage_attribution_events` 表就绪

2. **Phase 2** — 限额 enforcement hook (本期)
   - `internal/gettokenshooks/quota_enforcement.go`
   - `quota_rules` SQLite 表 + `quotaEnforcementPolicy`
   - Management API routes
   - `cmd/server/main.go` 注册

3. **Phase 3** — Go/Wails 绑定 (本期)
   - `internal/wailsapp/quota_rules.go`
   - DTO 类型同步

4. **Phase 4** — 前端 (本期)
   - 通用 `QuotaRuleEditor` 组件
   - 账号卡片限额进度条
   - Usage Desk 观察源

## 验证计划

1. sidecar `quota_enforcement_test.go` — Policy 超限过滤逻辑
2. sidecar integration test — 完整 relay + 多规则超限 fallback
3. `internal/wailsapp/quota_rules_test.go` — CRUD 代理
4. 前端 unit test — 进度条计算、超限状态、多规则展示
5. `npm run typecheck` + `npm run build`
6. `go test ./...`
