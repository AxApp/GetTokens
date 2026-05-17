# 账号限流策略中间件 — v5 内存缓存 + 定时评估

日期：2026-05-15

## 2026-05-16 实现闭环

- sidecar 已按 v5 落地：规则与事件复用 `usage-attribution-v1.sqlite`，评估层定时读取 attribution ledger，RoutePolicy 热路径只查内存 lookup map。
- management API 已覆盖策略列表、规则 CRUD、状态查询与事件查询；规则变更后可在下一次评估 tick 内更新 routing deny 状态。
- GetTokens Go/Wails 已补齐 client DTO、Wails facade、root `main.App` DTO/mapper 与绑定导出。
- 前端已在账号卡共享 `AttributionCard`、账号详情 `Route Guard Rules`、Codex 顺序卡完整/缩略模式中接入状态展示与规则编辑。
- 冒烟使用真实 Wails dev app 与本地 sidecar：对 `codex-api-key:26b1c3ff958f` 新增 `30d token-window limit=1 block` 测试规则，确认 `match_key=auth-id:codex:apikey:a6ba88c12cad`、status `blocked=true`、卡片显示 `ROUTE GUARD / 30D TOKENS 已满`。测试规则已在冒烟后清理。
- 追加多场景验证：sidecar 自动化测试已覆盖 token-window、request-window、warn、窗口恢复、disabled/unconfigured、注册式新策略、CRUD/event；live sidecar API 使用 synthetic account 跑通 strategies、empty status、block、events、warn、recovery、disabled、delete cleanup。

## v4 → v5 的设计修正

v4 在 `RoutePolicy.RewriteCandidates` 热路径上对每个候选账号逐条查 SQLite，不可接受。

v5 将**评估和执行分离**：
- **执行层（热路径）**：O(1) 查内存缓存 `map[accountKey]*RateLimitState`
- **评估层（定时器）**：ticker 每 30s 从 ledger 批量查询用量，调用策略纯函数评估，仅在状态变化时更新缓存和事件表
- **策略接口是纯函数**：`Evaluate(usage, rule) → Decision`，不碰 IO
- **usage attribution plugin 零改动**：评估层不依赖事件回调，只读 ledger 表

### 为什么定时器优于事件驱动

| | 事件驱动 | 定时器 |
|---|---|---|
| 高负载下 | 每请求触发评估 → 重复计算 | 固定频率, 天然去重 |
| usage plugin 耦合 | 需加 `UsageEventListener` 接口 | **零改动** |
| 窗口配额延迟 | <1s | ≤30s（小时/天级窗口无感） |
| 实现复杂度 | 事件注册 + 生命周期管理 | 一个 goroutine + ticker |

## 整体架构

```
┌── 请求热路径 (零 IO) ────────────────────────────┐
│                                                    │
│  外部客户端 relay 请求                              │
│    → sidecar routing 构建候选列表                   │
│    → RoutePolicy.RewriteCandidates()               │
│      → rateLimitPolicy                             │
│        → 查内存 sync.Map[accountKey]*RateLimitState│
│        → state.blocked? → 加入 DenyIDs             │
│        → O(1)                                      │
│    → routing 用过滤后的候选 relay                   │
│                                                    │
└────────────────────────────────────────────────────┘

┌── 定时评估层 (goroutine + ticker) ────────────────┐
│                                                    │
│  ticker 30s:                                        │
│    1. 加载所有 enabled 规则 (从 SQLite)             │
│    2. 按 (accountKey, window) 去重                 │
│    3. 批量查 ledger → UsageSnapshot               │
│    4. strategy.Evaluate(snapshot, rule) 纯函数     │
│    5. 构建新 RateLimitState                        │
│    6. 对比旧 state: 有变化才更新 sync.Map           │
│    7. blocked 状态变化时写 rate_limit_events 表     │
│                                                    │
│  启动时: 立即执行一次全量评估                       │
│  规则变更时: 立即执行一次全量评估 (CRUD 触发)       │
│                                                    │
│  并发计数器 (独立于策略接口)                        │
│    → atomic.Int64 维护每账号 in-flight 计数         │
│    → RoutePolicy 同时检查并发计数器                 │
│                                                    │
└────────────────────────────────────────────────────┘
```

## 核心接口

### 策略接口（纯函数）

```go
// UsageSnapshot 某个账号在某个窗口内的用量统计
type UsageSnapshot struct {
    AccountKey    string `json:"account_key"`
    Window        string `json:"window"`
    WindowStartMs int64  `json:"window_start_ms"`
    WindowEndMs   int64  `json:"window_end_ms"`
    RequestCount  int64  `json:"request_count"`
    FailedCount   int64  `json:"failed_count"`
    InputTokens   int64  `json:"input_tokens"`
    OutputTokens  int64  `json:"output_tokens"`
    TotalTokens   int64  `json:"total_tokens"`
    AvgLatencyMs  int64  `json:"avg_latency_ms"`
}

// StrategyDecision 纯函数的输出
type StrategyDecision struct {
    Blocked bool   `json:"blocked"`
    Reason  string `json:"reason"`
    RuleID  string `json:"rule_id"`
}

// RateLimitStrategy 限流策略接口 — 纯函数, 不依赖任何外部状态
type RateLimitStrategy interface {
    ID() string
    Name() string
    SupportedWindows() []string
    // Evaluate 纯函数: (用量快照, 规则) → 决策
    Evaluate(snapshot UsageSnapshot, rule RateLimitRule) StrategyDecision
}
```

### RateLimitState（内存缓存）

```go
// RateLimitState 账号的限流状态, 驻留内存, RoutePolicy 直接读取
type RateLimitState struct {
    AccountKey string              `json:"account_key"`
    Blocked    bool                `json:"blocked"`    // 是否有 block 规则生效
    BlockReason string             `json:"block_reason"` // 前端展示原因
    Rules      []RuleState         `json:"rules"`      // 每条规则的评估结果
    UpdatedAt  int64               `json:"updated_at"`
}

type RuleState struct {
    Rule       RateLimitRule       `json:"rule"`
    Exceeded   bool                `json:"exceeded"`
    Reason     string              `json:"reason"`
    UsagePct   float64             `json:"usage_pct"`
}
```

### RoutePolicy（热路径）

```go
type rateLimitPolicy struct {
    states    *sync.Map            // map[string]*RateLimitState, accountKey → state
    inFlight  *sync.Map            // map[string]*atomic.Int64, accountKey → 并发计数
}

func (p *rateLimitPolicy) RewriteCandidates(ctx context.Context, req coreauth.RoutePolicyRequest) coreauth.RoutePolicyDecision {
    denyIDs := []string{}

    for _, candidateID := range req.CandidateIDs {
        // 1. 检查并发限制 (原子计数器)
        if blocked := p.inFlight.check(candidateID); blocked {
            denyIDs = append(denyIDs, candidateID)
            continue
        }

        // 2. 检查限流状态缓存 (O(1))
        state, ok := p.states.Load(candidateID)
        if !ok {
            continue
        }
        if state.(*RateLimitState).Blocked {
            denyIDs = append(denyIDs, candidateID)
            continue
        }

        // 3. 放行, 增加并发计数
        p.inFlight.incr(candidateID)
    }

    return coreauth.RoutePolicyDecision{DenyIDs: denyIDs}
}
```

## 定时评估器

```go
// RateLimitEvaluator 定时批量评估所有规则的限流状态
type RateLimitEvaluator struct {
    store    *rateLimitStore
    registry *StrategyRegistry
    states   *sync.Map
    ticker   *time.Ticker
    stopCh   chan struct{}
}

func NewRateLimitEvaluator(store *rateLimitStore, registry *StrategyRegistry, states *sync.Map) *RateLimitEvaluator {
    return &RateLimitEvaluator{
        store:    store,
        registry: registry,
        states:   states,
        ticker:   time.NewTicker(30 * time.Second),
        stopCh:   make(chan struct{}),
    }
}

// Start 启动定时评估循环
func (e *RateLimitEvaluator) Start() {
    // 启动时立即评估一次 (阻塞, 确保首次状态就绪)
    e.evaluateAll()

    go func() {
        for {
            select {
            case <-e.ticker.C:
                e.evaluateAll()
            case <-e.stopCh:
                e.ticker.Stop()
                return
            }
        }
    }()
}

// Stop 停止定时器
func (e *RateLimitEvaluator) Stop() {
    close(e.stopCh)
}

// EvaluateNow 规则 CRUD 后立即触发 (非定时)
func (e *RateLimitEvaluator) EvaluateNow() {
    e.evaluateAll()
}

// evaluateAll 全量批量评估
func (e *RateLimitEvaluator) evaluateAll() {
    // 1. 加载所有 enabled 规则
    allRules := e.store.loadAllEnabledRules()
    if len(allRules) == 0 {
        // 清空所有 state (规则全部删除的情况)
        e.states.Range(func(key, _ interface{}) bool {
            e.states.Delete(key)
            return true
        })
        return
    }

    // 2. 按 (accountKey, window) 去重, 收集所有需要查询的 snapshot
    type snapshotKey struct {
        accountKey string
        window     string
    }
    queries := make(map[snapshotKey]bool)
    for _, rule := range allRules {
        queries[snapshotKey{rule.AccountKey, rule.Window}] = true
    }

    // 3. 批量查询 ledger 获取 usage snapshot
    snapshots := make(map[snapshotKey]UsageSnapshot)
    for q := range queries {
        snapshot, err := e.store.queryUsageSnapshot(q.accountKey, q.window)
        if err != nil {
            continue
        }
        snapshots[q] = snapshot
    }

    // 4. 按 accountKey 分组规则, 评估每个账号的状态
    rulesByAccount := groupRulesByAccount(allRules)
    for accountKey, rules := range rulesByAccount {
        decisions := make(map[string]StrategyDecision)
        for _, rule := range rules {
            strategy, ok := e.registry.Get(rule.Strategy)
            if !ok {
                continue
            }
            key := snapshotKey{accountKey, rule.Window}
            snapshot, ok := snapshots[key]
            if !ok {
                continue
            }
            decisions[rule.ID] = strategy.Evaluate(snapshot, rule)
        }

        // 5. 构建新 state, 仅在变化时更新 + 写事件
        newState := e.buildState(accountKey, rules, decisions)
        oldValue, existed := e.states.Swap(accountKey, newState)

        if !existed {
            if newState.Blocked {
                e.store.recordEvent(accountKey, "blocked", newState.BlockReason)
            }
            continue
        }

        oldState := oldValue.(*RateLimitState)
        if oldState.Blocked != newState.Blocked {
            if newState.Blocked {
                e.store.recordEvent(accountKey, "blocked", newState.BlockReason)
            } else {
                e.store.recordEvent(accountKey, "recovered", "")
            }
        }
    }

    // 6. 清理已无规则的账号的 state
    for accountKey := range rulesByAccount {
        // 已处理, 不在清理范围内
    }
    e.states.Range(func(key, value interface{}) bool {
        accountKey := key.(string)
        if _, ok := rulesByAccount[accountKey]; !ok {
            e.states.Delete(key)
        }
        return true
    })
}

func (e *RateLimitEvaluator) buildState(accountKey string, rules []RateLimitRule, decisions map[string]StrategyDecision) *RateLimitState {
    state := &RateLimitState{
        AccountKey: accountKey,
        UpdatedAt:  time.Now().UnixMilli(),
        Rules:      make([]RuleState, 0, len(rules)),
    }
    for _, rule := range rules {
        decision, ok := decisions[rule.ID]
        if !ok {
            continue
        }
        rs := RuleState{
            Rule:     rule,
            Exceeded: decision.Blocked,
            Reason:   decision.Reason,
        }
        if rule.LimitValue > 0 {
            // usagePct 由调用方在执行 snapshot 查询时填充
        }
        state.Rules = append(state.Rules, rs)
        if decision.Blocked && rule.Action == "block" {
            state.Blocked = true
            state.BlockReason = decision.Reason
        }
    }
    return state
}
```

## 内置策略实现

### TokenWindowStrategy

```go
type TokenWindowStrategy struct{}

func (s *TokenWindowStrategy) ID() string                  { return "token-window" }
func (s *TokenWindowStrategy) Name() string                { return "Token 窗口限流" }
func (s *TokenWindowStrategy) SupportedWindows() []string   { return []string{"1h", "6h", "12h", "24h", "7d", "30d"} }

func (s *TokenWindowStrategy) Evaluate(snapshot UsageSnapshot, rule RateLimitRule) StrategyDecision {
    if rule.LimitValue <= 0 {
        return StrategyDecision{Blocked: false}
    }
    if snapshot.TotalTokens >= rule.LimitValue {
        return StrategyDecision{
            Blocked: true,
            Reason:  fmt.Sprintf("%s tokens: %s/%s", rule.Window, formatNum(snapshot.TotalTokens), formatNum(rule.LimitValue)),
            RuleID:  rule.ID,
        }
    }
    return StrategyDecision{Blocked: false}
}
```

### RequestWindowStrategy

```go
type RequestWindowStrategy struct{}

func (s *RequestWindowStrategy) ID() string                { return "request-window" }
func (s *RequestWindowStrategy) Name() string              { return "请求窗口限流" }
func (s *RequestWindowStrategy) SupportedWindows() []string { return []string{"1h", "6h", "12h", "24h"} }

func (s *RequestWindowStrategy) Evaluate(snapshot UsageSnapshot, rule RateLimitRule) StrategyDecision {
    if rule.LimitValue <= 0 {
        return StrategyDecision{Blocked: false}
    }
    if snapshot.RequestCount >= rule.LimitValue {
        return StrategyDecision{
            Blocked: true,
            Reason:  fmt.Sprintf("%s requests: %d/%d", rule.Window, snapshot.RequestCount, rule.LimitValue),
            RuleID:  rule.ID,
        }
    }
    return StrategyDecision{Blocked: false}
}
```

### ErrorRateStrategy（质量限流示例）

```go
type ErrorRateStrategy struct{}

func (s *ErrorRateStrategy) ID() string                { return "error-rate" }
func (s *ErrorRateStrategy) Name() string              { return "错误率限流" }
func (s *ErrorRateStrategy) SupportedWindows() []string { return []string{"5m", "15m", "1h"} }

func (s *ErrorRateStrategy) Evaluate(snapshot UsageSnapshot, rule RateLimitRule) StrategyDecision {
    if rule.LimitValue <= 0 || snapshot.RequestCount < 10 {
        return StrategyDecision{Blocked: false} // 样本不足, 不判断
    }
    errorRate := float64(snapshot.FailedCount) / float64(snapshot.RequestCount) * 100
    threshold := float64(rule.LimitValue) // LimitValue 表示错误率百分比上限
    if errorRate >= threshold {
        return StrategyDecision{
            Blocked: true,
            Reason:  fmt.Sprintf("%s error rate: %.1f%%/%.1f%%", rule.Window, errorRate, threshold),
            RuleID:  rule.ID,
        }
    }
    return StrategyDecision{Blocked: false}
}
```

## 并发限流（独立于策略接口）

并发请求上限不依赖 ledger，用 `atomic.Int64` 在请求进出时计数。不走 `RateLimitStrategy` 接口——它是另一类限流。

```go
type ConcurrencyLimiter struct {
    counters *sync.Map // map[accountKey]*atomic.Int64
    limits   *sync.Map // map[accountKey]int64
}

func (c *ConcurrencyLimiter) Check(accountKey string) (blocked bool, reason string) {
    limit, hasLimit := c.limits.Load(accountKey)
    if !hasLimit {
        return false, ""
    }
    counter, _ := c.counters.LoadOrStore(accountKey, &atomic.Int64{})
    current := counter.(*atomic.Int64).Load()
    if current >= limit.(int64) {
        return true, fmt.Sprintf("concurrency: %d/%d in-flight", current, limit.(int64))
    }
    return false, ""
}

func (c *ConcurrencyLimiter) Incr(accountKey string) {
    if counter, ok := c.counters.Load(accountKey); ok {
        counter.(*atomic.Int64).Add(1)
    }
}

func (c *ConcurrencyLimiter) Decr(accountKey string) {
    if counter, ok := c.counters.Load(accountKey); ok {
        counter.(*atomic.Int64).Add(-1)
    }
}
```

请求完成后在 `usage.Plugin.HandleUsage` 中调用 `Decr`——不需要新增接口，复用既有 plugin 链路。

## 注册流程 (cmd/server/main.go)

```go
if cfg.UsageStatisticsEnabled {
    // 1. Attribution ledger
    attributionOpts := gettokenshooks.UsageAttributionOptions{DBPath: dbPath}
    gettokenshooks.InstallUsageAttributionHook(attributionOpts)

    // 2. Rate limit middleware (依赖 attribution ledger)
    rateLimitOpts := gettokenshooks.RateLimitOptions{DBPath: dbPath}
    gettokenshooks.InstallRateLimitHook(rateLimitOpts)
}

// 注册管理路由
serverOpts = append(serverOpts,
    api.WithManagementRouterConfigurator(gettokenshooks.ConfigureRateLimitRoutes),
)
```

## Management API

```
GET    /v0/management/gettokens/rate-limit-strategies
        → [{ id, name, supported_windows }]

GET    /v0/management/gettokens/rate-limit-rules
POST   /v0/management/gettokens/rate-limit-rules
PUT    /v0/management/gettokens/rate-limit-rules/:id
DELETE /v0/management/gettokens/rate-limit-rules/:id

GET    /v0/management/gettokens/rate-limit-status?account_key=<key>
        → { account_key, blocked, block_reason, rules: [{rule, exceeded, reason, usage_pct}] }

GET    /v0/management/gettokens/rate-limit-status
        → { items: [{ account_key, blocked, block_reason, rules: [...] }] }  // 所有有规则的账号

GET    /v0/management/gettokens/rate-limit-events?account_key=<key>&limit=20
        → { items: [{ rule_id, account_key, strategy, window, reason, triggered_at }] }
```

## Go/Wails 端

### 新增文件

- `internal/wailsapp/rate_limit.go` — core Wails 绑定
- `app.go` / `app_types.go` / `app_mappers.go` — root `main.App` 暴露给 Wails 前端的 DTO 与方法

### Wails 绑定

```go
func (a *App) ListRateLimitStrategies() ([]RateLimitStrategyMeta, error)
func (a *App) ListRateLimitRules(input RateLimitRulesInput) ([]RateLimitRule, error)
func (a *App) CreateRateLimitRule(input RateLimitRule) ([]RateLimitRule, error)
func (a *App) UpdateRateLimitRule(input RateLimitRule) ([]RateLimitRule, error)
func (a *App) DeleteRateLimitRule(input DeleteRateLimitRuleInput) error
func (a *App) GetRateLimitStatus(input RateLimitStatusInput) (*RateLimitState, error)
func (a *App) GetAllRateLimitStatuses() ([]RateLimitState, error)
func (a *App) ListRateLimitEvents(input RateLimitEventsInput) ([]RateLimitEvent, error)
```

### 前端同步

账号池进入 `ready` 后拉取 `GetAllRateLimitStatuses` 与 `ListRateLimitStrategies`，并每 30s 刷新一次。浏览器 preview 无 Wails bindings 时使用显式 preview 数据；真实 Wails 仍以 sidecar `ready` 为账号数据加载门槛。

## 能力边界总结

| 策略类型 | 首期内置 | 依赖 | 实现方式 |
|---------|---------|------|---------|
| Token 窗口 | 是 | `UsageSnapshot.TotalTokens` | `RateLimitStrategy.Evaluate` |
| 请求窗口 | 是 | `UsageSnapshot.RequestCount` | `RateLimitStrategy.Evaluate` |
| 错误率 | 示例代码 | `UsageSnapshot.FailedCount` | `RateLimitStrategy.Evaluate` |
| 并发上限 | 框架支持 | `atomic.Int64` 计数器 | `ConcurrencyLimiter` (独立逻辑) |
| 延迟阈值 | 可扩展 | `UsageSnapshot.AvgLatencyMs` | `RateLimitStrategy.Evaluate` |
| 费用窗口 | 需扩展 ledger | `UsageSnapshot.Cost` | `RateLimitStrategy.Evaluate` |
| 时间段/工作日 | 可扩展 | 当前时间 | 纯函数, 不依赖用量 |
| 分组配额 | 可扩展 | 按 group 聚合 usage | `RateLimitStrategy.Evaluate` + 对应查询 |

## 实施顺序

1. **Phase 1** — Attribution ledger (20260514)
   - `usage_attribution_events` 表 + 查询接口

2. **Phase 2** — 限流中间件核心 (本期 sidecar fork)
   - 策略接口 + 注册表 + 内置 `TokenWindowStrategy` / `RequestWindowStrategy`
   - `RateLimitState` 内存缓存 (`sync.Map`)
   - `rateLimitPolicy` RoutePolicy（热路径 O(1)）
   - `RateLimitEvaluator` 定时评估器（ticker 30s）
   - `rate_limit_rules` + `rate_limit_events` SQLite 表
   - Management API（CRUD + status + events + snapshot）
   - `cmd/server/main.go` 注册
   - **usage attribution plugin 零改动**（评估直接读 ledger 表, 不走事件回调）

3. **Phase 3** — Go/Wails bridge (本期)
   - `internal/cliproxyapi` client 接入 strategies / rules / status / events。
   - root `main.App` 暴露 Wails DTO，前端通过生成 bindings 调用。

4. **Phase 4** — 前端 (本期)
   - 账号池共享 `AttributionCard` 增加 `Route Guard` 状态。
   - Codex API Key 与 OpenAI-compatible 详情复用 `Route Guard Rules` 规则编辑区。
   - Codex 顺序卡完整 / 缩略模式都展示 blocked chip。
   - Usage Desk 限流观察源本期不做，若后续新增必须作为第三个 source 数据面接入。

## 验证计划

1. `strategy_test.go` — 每种策略的 Evaluate 纯函数测试（构造 UsageSnapshot 输入，验证 Decision 输出）
2. `evaluator_test.go` — `evaluateAll` 批量评估：给定 mock ledger 数据，验证 sync.Map 状态变换（blocked → recovered）
3. `rate_limit_policy_test.go` — RewriteCandidates O(1) 查表、状态不存在时放行、blocked 时拒绝
4. `concurrency_limiter_test.go` — 并发计数递增/递减/上限检查正确性
5. `evaluator_dedup_test.go` — 同状态不触发重复事件写表，状态变化才写
6. Management API CRUD 测试
7. 集成测试 — 完整 relay 流 + mock ledger + 验证 DenyIDs 正确
8. 前端单元测试
9. `go test ./...` + `npm run typecheck` + `npm run build`
