# 账号限流策略中间件 — 实施方案 v4

日期：2026-05-15

## 设计原则

1. **策略模式**：每种限流类型是实现 `RateLimitStrategy` 接口的独立策略，新增策略零侵入既有代码。
2. **遵循 gettokenshooks 模式**：安装函数 + 策略注册 + management API 路由注册。
3. **Enforcement 在 routing 层**：实现 `coreauth.RoutePolicy`，在 `RewriteCandidates` 中过滤超限账号。
4. **规则与事件分离**：规则表存储配置，事件表记录每次拦截，职责清晰。

## 核心接口

```go
// StrategyRequest 限流检查的输入
type StrategyRequest struct {
    AccountKey     string `json:"account_key"`
    AttributionKey string `json:"attribution_key"`
    AttemptIndex   int    `json:"attempt_index"`
}

// StrategyDecision 单次限流检查结果
type StrategyDecision struct {
    Blocked    bool   `json:"blocked"`
    Reason     string `json:"reason"`      // e.g. "24h tokens: 1,200,000/1,000,000"
    RuleID     string `json:"rule_id"`
    StrategyID string `json:"strategy_id"`
}

// RateLimitStrategy 限流策略接口
// 新增限流类型只需实现此接口并注册
type RateLimitStrategy interface {
    ID() string                                          // 唯一标识, e.g. "token-window"
    Name() string                                        // 展示名, e.g. "Token 窗口限流"
    Description() string                                 // 策略说明
    SupportedWindows() []string                          // 支持的窗口, e.g. ["1h","24h","7d","30d"]
    Check(ctx context.Context, req StrategyRequest, rule RateLimitRule, store *RateLimitStore) (StrategyDecision, error)
}

// StrategyRegistry 策略注册表
type StrategyRegistry struct {
    strategies map[string]RateLimitStrategy
}

func (r *StrategyRegistry) Register(s RateLimitStrategy) {
    r.strategies[s.ID()] = s
}

func (r *StrategyRegistry) Get(id string) (RateLimitStrategy, bool) {
    s, ok := r.strategies[id]
    return s, ok
}

func (r *StrategyRegistry) List() []RateLimitStrategy { ... }
```

## 数据模型

```sql
-- 限流规则表
CREATE TABLE IF NOT EXISTS rate_limit_rules (
    id TEXT PRIMARY KEY,              -- uuid
    account_key TEXT NOT NULL,        -- "codex-api-key:<local-id>" 等
    strategy TEXT NOT NULL,           -- "token-window" | "request-window"
    window TEXT NOT NULL,             -- "1h" | "24h" | "7d" | "30d"
    limit_value INTEGER NOT NULL,     -- 0 = unlimited
    action TEXT NOT NULL DEFAULT 'block',  -- "block" | "warn"
    enabled INTEGER NOT NULL DEFAULT 1,
    label TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rl_rules_account ON rate_limit_rules(account_key, enabled);

-- 限流事件表 (记录每次拦截)
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    account_key TEXT NOT NULL,
    strategy TEXT NOT NULL,
    window TEXT NOT NULL,
    limit_value INTEGER NOT NULL,
    current_usage INTEGER NOT NULL,
    reason TEXT NOT NULL,
    blocked_at_unix_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rl_events_account_time ON rate_limit_events(account_key, blocked_at_unix_ms);
```

```go
type RateLimitRule struct {
    ID         string `json:"id"`
    AccountKey string `json:"account_key"`
    Strategy   string `json:"strategy"`
    Window     string `json:"window"`
    LimitValue int64  `json:"limit_value"`
    Action     string `json:"action"`
    Enabled    bool   `json:"enabled"`
    Label      string `json:"label"`
    CreatedAt  int64  `json:"created_at"`
    UpdatedAt  int64  `json:"updated_at"`
}
```

## 内置策略

### 策略 1: TokenWindowStrategy

```go
type TokenWindowStrategy struct{}

func (s *TokenWindowStrategy) ID() string          { return "token-window" }
func (s *TokenWindowStrategy) Name() string        { return "Token 窗口限流" }
func (s *TokenWindowStrategy) SupportedWindows() []string { return []string{"1h", "6h", "12h", "24h", "7d", "30d"} }

func (s *TokenWindowStrategy) Check(ctx context.Context, req StrategyRequest, rule RateLimitRule, store *RateLimitStore) (StrategyDecision, error) {
    // 1. 从 attribution ledger 查询窗口内用量
    windowStart := windowBoundary(rule.Window)
    usage, err := store.queryAttributionUsage(req.AccountKey, windowStart)
    if err != nil {
        return StrategyDecision{}, err
    }

    // 2. 对比阈值
    if rule.LimitValue > 0 && usage.TotalTokens >= rule.LimitValue {
        return StrategyDecision{
            Blocked:    true,
            Reason:     fmt.Sprintf("%s tokens: %s/%s", rule.Window, formatNumber(usage.TotalTokens), formatNumber(rule.LimitValue)),
            RuleID:     rule.ID,
            StrategyID: s.ID(),
        }, nil
    }

    return StrategyDecision{Blocked: false}, nil
}
```

### 策略 2: RequestWindowStrategy

与 `TokenWindowStrategy` 结构一致，统计维度改为 `request_count`。
`ID()` 返回 `"request-window"`，`Name()` 返回 `"请求窗口限流"`。

## 中间件注册 (gettokenshooks 模式)

```go
// internal/gettokenshooks/rate_limit.go

type RateLimitOptions struct {
    DBPath string // SQLite DB 路径 (与 attribution ledger 共享)
}

// InstallRateLimitHook 安装限流中间件
// 应在 attribution ledger 和 usage persistence 之后调用
func InstallRateLimitHook(opts RateLimitOptions) error {
    store, err := newRateLimitStore(opts.DBPath)
    if err != nil {
        return fmt.Errorf("rate limit store init: %w", err)
    }

    registry := NewStrategyRegistry()
    registry.Register(&TokenWindowStrategy{})
    registry.Register(&RequestWindowStrategy{})

    policy := &rateLimitPolicy{
        store:    store,
        registry: registry,
    }

    // 注册为 RoutePolicy — 在路由前过滤候选账号
    coreauth.RegisterRoutePolicy(policy)

    // 保存引用供 management API 使用
    defaultRateLimitStore = store
    defaultStrategyRegistry = registry

    return nil
}
```

## Enforcement 流程

```
外部客户端 relay 请求
    |
    v
sidecar routing 构建候选账号列表
    |
    +-- RoutePolicy.RewriteCandidates() 链式调用
    |     |
    |     +-- gettokensRoutePolicy (既有: allow/deny/order)
    |     |
    |     +-- [NEW] rateLimitPolicy
    |           1. 遍历候选账号 (candidateIDs)
    |           2. 对每个账号, 加载所有 enabled 规则
    |           3. 对每条规则, 找到对应 Strategy, 调用 Check()
    |           4. 若某条 block 规则返回 Blocked=true:
    |              - 将账号加入 DenyIDs
    |              - 写入 rate_limit_events 表
    |              - break (不再检查该账号的其他规则)
    |           5. 若所有规则通过或只有 warn 规则触发: 保留账号
    |           6. 返回 DenyIDs 给 routing
    |
    v
routing 使用过滤后的候选列表继续 relay
```

```go
type rateLimitPolicy struct {
    store    *rateLimitStore
    registry *StrategyRegistry
}

func (p *rateLimitPolicy) RewriteCandidates(ctx context.Context, req coreauth.RoutePolicyRequest) coreauth.RoutePolicyDecision {
    rules := p.store.loadEnabledRules()
    if len(rules) == 0 {
        return coreauth.RoutePolicyDecision{}
    }

    // 按账号分组规则
    rulesByAccount := groupRulesByAccount(rules)

    denyIDs := []string{}
    for _, candidateID := range req.CandidateIDs {
        accountRules := rulesByAccount[candidateID]
        if len(accountRules) == 0 {
            continue
        }

        for _, rule := range accountRules {
            strategy, ok := p.registry.Get(rule.Strategy)
            if !ok {
                continue
            }

            decision, err := strategy.Check(ctx, StrategyRequest{
                AccountKey:     candidateID,
                AttributionKey: rule.AccountKey,
            }, rule, p.store)
            if err != nil {
                continue
            }

            if decision.Blocked && rule.Action == "block" {
                denyIDs = append(denyIDs, candidateID)
                // 异步写事件, 不阻塞路由
                go p.store.recordEvent(rule, decision)
                break
            }
        }
    }

    return coreauth.RoutePolicyDecision{DenyIDs: denyIDs}
}
```

## Management API

```
GET    /v0/management/gettokens/rate-limit/rules
        → 返回所有限流规则

POST   /v0/management/gettokens/rate-limit/rules
        → 创建新规则 { account_key, strategy, window, limit_value, action, enabled, label }

PUT    /v0/management/gettokens/rate-limit/rules/:id
        → 更新规则

DELETE /v0/management/gettokens/rate-limit/rules/:id
        → 删除规则

GET    /v0/management/gettokens/rate-limit/strategies
        → 返回所有已注册策略的元信息 (ID, Name, Description, SupportedWindows)

GET    /v0/management/gettokens/rate-limit/status?account_key=<key>
        → 返回某账号所有规则的当前执行状态 { rule, current_usage, exceeded, usage_pct }

GET    /v0/management/gettokens/rate-limit/events?account_key=<key>&limit=20
        → 返回最近限流事件
```

路由注册（跟随 `ConfigureUsageAttributionRoutes` 模式）：

```go
func ConfigureRateLimitRoutes(router gin.IRouter) {
    group := router.Group("/v0/management/gettokens/rate-limit")
    group.GET("/rules", handleListRules)
    group.POST("/rules", handleCreateRule)
    group.PUT("/rules/:id", handleUpdateRule)
    group.DELETE("/rules/:id", handleDeleteRule)
    group.GET("/strategies", handleListStrategies)
    group.GET("/status", handleGetStatus)
    group.GET("/events", handleGetEvents)
}
```

## cmd/server/main.go 注册

```go
// 在 usage attribution + persistence 注册之后
if cfg.UsageStatisticsEnabled {
    // ... 既有 attribution + persistence hook ...

    // 安装限流中间件
    if err := gettokenshooks.InstallRateLimitHook(
        gettokenshooks.RateLimitOptions{
            DBPath: filepath.Join(dataDir, "usage-attribution-v1.sqlite"),
        },
    ); err != nil {
        log.WithError(err).Warn("rate limit hook install failed")
    }
}

// 注册管理路由
serverOpts = append(serverOpts,
    api.WithManagementRouterConfigurator(
        gettokenshooks.ConfigureRateLimitRoutes,
    ),
)
```

## 新增策略示例（后期扩展）

以后要加"并发请求上限"策略，只需：

```go
type ConcurrencyStrategy struct{}

func (s *ConcurrencyStrategy) ID() string                { return "concurrency" }
func (s *ConcurrencyStrategy) Name() string              { return "并发请求限流" }
func (s *ConcurrencyStrategy) SupportedWindows() []string { return nil } // 无窗口概念

func (s *ConcurrencyStrategy) Check(ctx context.Context, req StrategyRequest, rule RateLimitRule, store *RateLimitStore) (StrategyDecision, error) {
    inFlight, err := store.queryInFlightCount(req.AccountKey)
    if err != nil {
        return StrategyDecision{}, err
    }
    if inFlight >= rule.LimitValue {
        return StrategyDecision{
            Blocked:    true,
            Reason:     fmt.Sprintf("concurrency: %d/%d in-flight", inFlight, rule.LimitValue),
            RuleID:     rule.ID,
            StrategyID: s.ID(),
        }, nil
    }
    return StrategyDecision{Blocked: false}, nil
}
```

然后在 `InstallRateLimitHook` 中加一行：

```go
registry.Register(&ConcurrencyStrategy{})
```

`RewiteCandidates`、management API、前端策略列表全部自动适配——零额外改动。

## Go/Wails 端

Go 端通过 management API 代理限流规则管理：

### 新增文件

- `internal/wailsapp/rate_limit_rules.go` — Wails 绑定 + 限流事件 poller

### Wails 绑定

```go
func (a *App) ListRateLimitRules() ([]RateLimitRule, error)
func (a *App) CreateRateLimitRule(input RateLimitRuleInput) (*RateLimitRule, error)
func (a *App) UpdateRateLimitRule(input RateLimitRuleInput) (*RateLimitRule, error)
func (a *App) DeleteRateLimitRule(id string) error
func (a *App) ListRateLimitStrategies() ([]StrategyMeta, error)
func (a *App) GetRateLimitStatus(accountKey string) ([]RuleStatus, error)
```

### StatusMessage 同步 (轻量 poller)

```
每 30s:
  1. GET /v0/management/gettokens/rate-limit/events?since=<lastCheck>
  2. 对每个新拦截事件 → SetAccountDisabled(id, true, event.Reason)
  3. GET /v0/management/gettokens/rate-limit/status?account_key=<每个被禁用的账号>
  4. 对所有规则均未超限的账号 → SetAccountDisabled(id, false, "")
```

**关键：** `SetAccountDisabled` 的 reason 参数（v3 中设计的跨层改动）在此处被 poller 消费——poller 传入具体限流原因如 `"24h tokens: 1.2M/1.0M"`，前端直接展示。

## 前端变更

| 组件 | 变更 |
|------|------|
| `AccountCard.tsx` | 限流进度条组件 `RateLimitBar`：按 strategy+window 分组展示 |
| `ApiKeyDetailModal.tsx` | 限流规则编辑器 `RateLimitRuleEditor`：策略下拉(从 API 获取)、窗口下拉、阈值输入、行为下拉 |
| `AccountOrderRow.tsx` | 超限 chip：`24h tokens 已满` / `1h requests 已满` |
| `RateLimitRuleEditor.tsx` | 新增通用组件，策略列表从 `ListRateLimitStrategies` 动态获取 |
| `UsageDeskFeature.tsx` | 新增 `限流状态` 观察源 |

### 关键前端设计

策略下拉的候选列表通过 Wails 调用 `ListRateLimitStrategies()` 动态获取，而非前端硬编码。后期新增策略，前端无需改动。

```typescript
// 策略列表从后端动态获取
const strategies = await ListRateLimitStrategies();
// strategies = [
//   { id: "token-window", name: "Token 窗口限流", windows: ["1h","24h","7d","30d"] },
//   { id: "request-window", name: "请求窗口限流", windows: ["1h","24h","7d","30d"] },
// ]
```

## 实施顺序

1. **Phase 1** — Attribution ledger (20260514)
   - SQLite ledger + `usage_attribution_events` 表
   - `GET /v0/management/gettokens/usage-attribution` 查询接口

2. **Phase 2** — 限流中间件 (本期 sidecar fork)
   - `rate_limit.go` — 策略接口 + 注册表
   - `token_window_strategy.go` / `request_window_strategy.go`
   - `rate_limit_policy.go` — RoutePolicy 实现
   - `rate_limit_store.go` — SQLite 规则/事件存储
   - `rate_limit_routes.go` — Management API
   - `cmd/server/main.go` — 注册

3. **Phase 3** — StatusMessage 贯通 (本期 sidecar + Go/Wails)
   - sidecar `PATCH /auth-files/status` 接受 `reason`
   - `app_types.go` / `app_mappers.go` 加 `StatusMessage`
   - `SetAccountDisabled(id, disabled, reason)` 签名变更
   - 限流事件 poller 写 StatusMessage

4. **Phase 4** — 前端 (本期)
   - `RateLimitRuleEditor` 组件
   - 账号卡片限流进度条
   - Usage Desk 限流观察源

## 验证计划

1. `token_window_strategy_test.go` — 窗口计算、超限判断
2. `request_window_strategy_test.go` — 同上
3. `rate_limit_policy_test.go` — RewriteCandidates 过滤逻辑、多策略并存、多账号并发
4. `rate_limit_routes_test.go` — Management API CRUD
5. Go/Wails unit test — poller 逻辑
6. 前端 unit test — 进度条、策略下拉动态获取
7. `go test ./...` + `npm run typecheck` + `npm run build`
