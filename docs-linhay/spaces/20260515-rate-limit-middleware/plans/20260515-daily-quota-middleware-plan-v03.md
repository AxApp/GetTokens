# Local ID 账号限额 — 客户端策略引擎方案 v3

日期：2026-05-15

## 架构洞察

sidecar 由 `internal/wailsapp/runtime.go:Startup()` 以 goroutine 启动，`Shutdown()` 时停止。两者完全同生命周期——sidecar 不独立于客户端存在。

这意味着 **不需要在 sidecar fork 中增加任何 enforcement 中间件**。策略逻辑全量放在 Go/Wails 客户端层，enforcement 走既有的 `SetAccountDisabled` 机制。

### 为什么这个方向优于 sidecar 中间件

| 维度 | sidecar 中间件 (v2) | 客户端策略引擎 (v3) |
|------|---------------------|---------------------|
| Sidecar fork 改动 | 需要新增 `quota_enforcement.go` + 注册逻辑 | **零改动**（attribution ledger 管理 API 已在 20260514 规划中） |
| Enforcement 实时性 | 请求级实时 | 准实时（sidecar 轮询间隔后生效，通常 <5s） |
| 策略复杂度 | 受限于 sidecar 内部 context | 完整的 Go 生态，可做复杂策略 |
| 窗口重置 | 需要 sidecar 内部 timer | Go `time.Ticker`，伴随 App 生命周期 |
| 测试 | 需要 sidecar 集成环境 | 纯 Go unit test |
| 客户端崩溃 | N/A（sidecar 也停止） | N/A（sidecar 也停止） |

唯一 trade-off 是 enforcement 从"请求级实时"降为"轮询后准实时"——但窗口限额（小时/天/周级）对秒级精度无需求，这个 trade-off 完全可接受。

## 整体架构

```
┌── Go/Wails 客户端 ──────────────────────────────┐
│                                                   │
│  ┌─ QuotaPolicyEngine ────────────────────────┐  │
│  │                                              │  │
│  │  quota_rules_v1.json ──> 内存规则表          │  │
│  │  timer (每30s) ──> 查询 attribution ledger   │  │
│  │                  ──> 逐规则对比用量 vs 限额   │  │
│  │                  ──> 超限: SetAccountDisabled │  │
│  │  timer (每60s) ──> 窗口重置检查               │  │
│  │                  ──> 已进入新窗口: re-enable  │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                   │
│  Wails Bindings: ListQuotaRules / UpdateQuotaRule  │
│  Wails Bindings: GetQuotaRuleStatus                │
│                                                   │
└──────────────────┬────────────────────────────────┘
                   │ 管理 API (127.0.0.1:8317)
                   v
┌── Sidecar ───────────────────────────────────────┐
│                                                    │
│  GET /v0/management/gettokens/usage-attribution    │
│    ← 查询每个账号在窗口内的用量 (20260514 规划)     │
│                                                    │
│  SetAccountDisabled (via existing mechanisms)       │
│    ← 客户端控制启用/禁用 (既有能力, 无需改动)       │
│                                                    │
│  Relay 路由 (既有)                                  │
│    ← 自动跳过 disabled 账号                        │
│                                                    │
└────────────────────────────────────────────────────┘
```

**关键：sidecar 完全不新增代码。** 所有新代码都在 `internal/wailsapp/` 下。

## 通用配额模型

```go
// 持久化到 ~/.config/gettokens-data/quota-rules-v1.json
// 由 QuotaPolicyEngine 加载到内存
type QuotaRule struct {
    ID          string `json:"id"`           // uuid
    AccountKey  string `json:"account_key"`  // "codex-api-key:<local-id>" 等
    Window      string `json:"window"`       // "1h" | "6h" | "12h" | "24h" | "7d" | "30d"
    LimitType   string `json:"limit_type"`   // "tokens" | "requests"
    LimitValue  int64  `json:"limit_value"`  // 0 = unlimited
    Action      string `json:"action"`       // "block" | "warn"
    Enabled     bool   `json:"enabled"`
    Label       string `json:"label"`        // 前端展示名
    CreatedAt   int64  `json:"created_at"`
    UpdatedAt   int64  `json:"updated_at"`
}

// 内存运行时状态 (不持久化)
type quotaRuleState struct {
    rule             QuotaRule
    currentUsage     int64            // 当前窗口用量 (tokens 或 requests)
    exceeded         bool
    disabledByQuota  bool             // 是否因限额被本 engine 禁用
    lastCheckAt      time.Time
}
```

### 通用化设计

| 维度 | 实现 |
|------|------|
| **窗口类型** | `1h` / `6h` / `12h` / `24h` / `7d` / `30d`，计算方式是"从现在往前 N 时间"的滑动窗口 |
| **限额类型** | `tokens` (total_tokens) / `requests` (request_count)，后续可扩展 `input_tokens` / `output_tokens` / `cost` |
| **超限行为** | `block` → 调用 `SetAccountDisabled(id, true)`；`warn` → 仅 emit event 通知前端 |
| **账号范围** | 任意 local ID 账号 (`auth-file:*` / `codex-api-key:*` / `openai-compatible:*`) |
| **多规则** | 同一账号可配多条规则（如 24h tokens + 1h requests 同时生效），任一 `block` 规则触发就禁用 |

## QuotaPolicyEngine 设计

### 核心结构

```go
// internal/wailsapp/quota_policy_engine.go

type QuotaPolicyEngine struct {
    mu       sync.RWMutex
    rules    map[string]*quotaRuleState  // keyed by rule.ID
    app      *App                        // 回调用 SetAccountDisabled / emit event
    
    checkTicker   *time.Ticker           // 用量检查 (30s)
    resetTicker   *time.Ticker           // 窗口重置检查 (60s)
    stopCh        chan struct{}
}
```

### 生命周期

```
App.Startup()
  -> engine := NewQuotaPolicyEngine(app)
  -> engine.Start()
     1. 加载 quota-rules-v1.json
     2. 等待 sidecar ready
     3. 启动 checkTicker (30s): 轮询用量 + enforcement
     4. 启动 resetTicker (60s): 检查窗口重置, 恢复已超限但进入新窗口的账号

App.Shutdown()
  -> engine.Stop()  // 停止所有 ticker
  -> sidecar.Stop()
```

### 用量查询循环 (每 30s)

```go
func (e *QuotaPolicyEngine) checkAllRules() {
    rules := e.getEnabledRules()
    if len(rules) == 0 {
        return
    }

    // 收集所有需要查询的 (accountKey, window)
    queries := uniqueQueries(rules)
    
    for _, q := range queries {
        // 调用 sidecar attribution ledger
        usage, err := e.queryAttributionUsage(q.accountKey, q.window)
        if err != nil {
            continue // skip on error, retry next tick
        }
        
        // 对使用这个 query 的每条规则做判断
        for _, rule := range rulesForQuery(rules, q) {
            e.evaluateRule(rule, usage)
        }
    }
}

func (e *QuotaPolicyEngine) evaluateRule(rule *quotaRuleState, usage AttributionUsage) {
    var currentUsage int64
    switch rule.rule.LimitType {
    case "tokens":
        currentUsage = usage.TotalTokens
    case "requests":
        currentUsage = usage.RequestCount
    }
    
    exceeded := rule.rule.LimitValue > 0 && currentUsage >= rule.rule.LimitValue
    
    if exceeded && !rule.exceeded {
        // 新触发超限
        rule.exceeded = true
        if rule.rule.Action == "block" {
            e.app.SetAccountDisabled(rule.rule.AccountKey, true)
            rule.disabledByQuota = true
        }
        e.emitQuotaExceeded(rule, currentUsage)
    }
}
```

### 窗口重置检查 (每 60s)

```go
func (e *QuotaPolicyEngine) checkWindowResets() {
    for _, rule := range e.getExceededRules() {
        if !rule.exceeded || !rule.disabledByQuota {
            continue
        }
        
        // 查询最新用量——如果窗口已滑出超限区间，用量会自然下降
        usage, err := e.queryAttributionUsage(rule.rule.AccountKey, rule.rule.Window)
        if err != nil {
            continue
        }
        
        var currentUsage int64
        if rule.rule.LimitType == "tokens" {
            currentUsage = usage.TotalTokens
        } else {
            currentUsage = usage.RequestCount
        }
        
        // 用量降到限额以下 → 窗口已重置
        if currentUsage < rule.rule.LimitValue {
            rule.exceeded = false
            e.app.SetAccountDisabled(rule.rule.AccountKey, false)
            rule.disabledByQuota = false
            e.emitQuotaReset(rule, currentUsage)
        }
    }
}
```

### 关键细节：与手动禁用共存

```go
// 存储手动禁用的账号 (不在 engine 中管理, 而是记录 engine 的禁用)
// engine 恢复账号前检查:
//   1. 用户是否在 engine 禁用后手动重新启用了账号? → 短期不再禁用此规则
//   2. 用户是否在 engine 禁用前就已手动禁用? → engine 不应恢复
//
// 解决方案: engine 使用独立的标记 key，不直接操作 disable 字段。
// 或者更简单: engine 记录"我禁用了哪些账号"，恢复时只恢复 engine 禁用的。

// 但实际上，如果 engine 把超限账号 disable 后，
// 用户手动 enable，说明用户有意覆盖——engine 应尊重用户意愿。
// 实现: 在 evaluateRule 中，如果 rule.exceeded == true 但账号当前未 disabled，
// 说明用户手动恢复了，engine 不再自动禁用（等待下一窗口或用户手动重置规则）。
```

## 跨层改动：StatusMessage 贯通（限额禁用原因展示）

引擎调用 `SetAccountDisabled` 后，前端必须能区分"用户手动禁用"还是"24h token 超限自动禁用"。
`StatusMessage` 字段在 sidecar `Auth` 结构体（`auth/types.go:65`）和前端 `AccountRecord`（`types.ts:47`）**已存在**，但中间两层缺了。

### Sidecar Fork 改动

**1. `PATCH /v0/management/auth-files/status` — 接受 reason 参数**

`docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/auth_files.go:1059-1122`

当前 hardcode `StatusMessage = "disabled via management API"`，改为接受可选的 `reason` 字段：

```go
// 请求体从 {"name":"...", "disabled":true}
// 改为 {"name":"...", "disabled":true, "reason":"24h tokens: 1.2M/1.0M"}

if req.Disabled {
    targetAuth.Disabled = true
    targetAuth.Status = StatusDisabled
    if req.Reason != "" {
        targetAuth.StatusMessage = req.Reason
    } else {
        targetAuth.StatusMessage = "disabled via management API"
    }
} else {
    targetAuth.Disabled = false
    targetAuth.Status = StatusActive
    targetAuth.StatusMessage = ""
}
```

**2. codex-api-key 和 openai-compatible 管理端点 — 同理支持 status_message**

sidecar 的这些端点当前写回时是否保留 `StatusMessage` 需检查。若不存在，需要在对应的 `PUT/PATCH` handler 中保持已有值不被覆盖。

### CLIProxyAPI Go Client 改动

**`internal/cliproxyapi/types.go`**

```go
// CodexAPIKey (line 13), CodexAPIKeyInput (line 35), CodexAPIKeyPatch (line 48)
// 各增加:
StatusMessage string `json:"statusMessage,omitempty"`

// OpenAICompatibleProvider (line 80) 增加:
StatusMessage string `json:"statusMessage,omitempty"`
```

### Go/Wails 层改动

**`internal/wailsapp/app_types.go:63-84`** — Wails 暴露的 `AccountRecord` **缺少 StatusMessage**：

```go
type AccountRecord struct {
    // ... existing fields ...
    Status        string `json:"status"`
    StatusMessage string `json:"statusMessage,omitempty"` // ADD
    Disabled      bool   `json:"disabled,omitempty"`
    // ...
}
```

**`internal/wailsapp/app_mappers.go:24-47`** — mapper 未复制 StatusMessage：

```go
func mapAccountRecord(src accountsdomain.AccountRecord) AccountRecord {
    return AccountRecord{
        // ... existing ...
        Status:        src.Status,
        StatusMessage: src.StatusMessage, // ADD
        Disabled:      src.Disabled,
        // ...
    }
}
```

**`internal/accounts/account_records.go`** — 构建函数补充 StatusMessage：

```go
// BuildCodexAPIKeyAccountRecord (line 155): 当前不设 StatusMessage
// BuildOpenAICompatibleProviderAccountRecord (line 84): 当前不设 StatusMessage
// 需要从 CodexAPIKey.StatusMessage / OpenAICompatibleProvider.StatusMessage 读取
```

**`internal/wailsapp/accounts.go`** — Setter 加 reason 参数：

```go
// 旧签名
func (a *App) SetAccountDisabled(id string, disabled bool) error
// 新签名
func (a *App) SetAccountDisabled(id string, disabled bool, reason string) error

// 三个 dispatch 方法同步加 reason:
func (a *App) SetAuthFileStatus(name string, disabled bool, reason string) error
func (a *App) SetCodexAPIKeyStatus(id string, disabled bool, reason string) error
func (a *App) SetOpenAICompatibleProviderStatus(name string, disabled bool, reason string) error
```

涉及 `SetAccountDisabled` 调用的现有位置需适配新签名：
- `frontend/src/features/codex/CodexAccountListFeature.tsx:563` — 手动切换传 `""`
- `frontend/src/features/accounts/hooks/useAccountRotation.ts:132` — 手动切换传 `""`

### 前端改动

**`frontend/src/features/accounts/model/accountPresentation.ts:74-83`** — 当前 `resolveAccountFailureReason` **排除** DISABLED 状态：

```typescript
// 当前: DISABLED 被显式排除 (line 78), statusMessage 不展示
// 改为: DISABLED + 有 statusMessage → 展示 statusMessage (即限额禁用原因)
//       DISABLED + 无 statusMessage → 不展示（手动禁用）
```

**`frontend/src/features/accounts/components/AccountCard.tsx:181-185`** — 对 disabled 状态渲染 reason text。

## 类型定义

```go
// internal/wailsapp/quota_rules.go — Wails 绑定

type QuotaRuleInput struct {
    ID         string `json:"id,omitempty"`          // 创建时可选，更新时必填
    AccountKey string `json:"account_key"`
    Window     string `json:"window"`
    LimitType  string `json:"limit_type"`
    LimitValue int64  `json:"limit_value"`
    Action     string `json:"action"`
    Enabled    bool   `json:"enabled"`
    Label      string `json:"label"`
}

type QuotaRuleStatus struct {
    Rule          QuotaRule `json:"rule"`
    CurrentUsage  int64     `json:"current_usage"`
    Exceeded      bool      `json:"exceeded"`
    UsagePct      float64   `json:"usage_pct"`
}
```

### Wails 绑定

```go
func (a *App) ListQuotaRules() ([]QuotaRule, error)
func (a *App) CreateQuotaRule(input QuotaRuleInput) (*QuotaRule, error)
func (a *App) UpdateQuotaRule(input QuotaRuleInput) (*QuotaRule, error)
func (a *App) DeleteQuotaRule(id string) error
// GetQuotaRuleStatuses 返回所有规则的状态 (用量 + 超限标记)
func (a *App) GetQuotaRuleStatuses() ([]QuotaRuleStatus, error)
```

## 持久化

```
~/.config/gettokens-data/quota-rules-v1.json

{
  "version": 1,
  "updated_at": 1715779200,
  "rules": [
    {
      "id": "uuid-1",
      "account_key": "codex-api-key:abc123",
      "window": "24h",
      "limit_type": "tokens",
      "limit_value": 1000000,
      "action": "block",
      "enabled": true,
      "label": "每日 token 上限",
      "created_at": 1715770000,
      "updated_at": 1715770000
    }
  ]
}
```

## Startup 集成

```go
// internal/wailsapp/runtime.go

func (a *App) Startup(ctx context.Context) {
    a.ctx = ctx
    a.startLocalUsageRefreshLoop(ctx)

    // ... sparkle, updater ...

    go func() {
        a.sidecar.Start(ctx, func(status sidecar.Status) {
            if status.Code == sidecar.StatusReady {
                go func() {
                    if err := a.syncStoredCodexAPIKeysToSidecar(); err != nil {
                        log.Printf("sync codex api keys to sidecar failed: %v", err)
                    }
                }()
                // NEW: 启动限额策略引擎
                go func() {
                    if err := a.quotaEngine.Start(); err != nil {
                        log.Printf("quota policy engine start failed: %v", err)
                    }
                }()
            }
            wailsRuntime.EventsEmit(ctx, "sidecar:status", status)
        })
    }()
}

func (a *App) Shutdown() {
    a.quotaEngine.Stop()
    a.sidecar.Stop()
}
```

## 依赖关系

| 依赖 | 状态 | 改动 |
|------|------|------|
| Sidecar `PATCH /auth-files/status` | 已存在 | 增加可选 `reason` 字段（hardcode → 参数化） |
| Sidecar codex-api-key / openai-compatible 端点 | 已存在 | 确认 StatusMessage 写回时不丢失 |
| CLIProxyAPI Go 类型 (`types.go`) | 已存在 | 增加 `StatusMessage` 字段到 4 个 struct |
| Wails `AccountRecord` (`app_types.go`) | 已存在 | 增加 `StatusMessage` |
| Wails mapper (`app_mappers.go`) | 已存在 | 映射 `StatusMessage` |
| `SetAccountDisabled` 签名 | 已存在 | 增加 `reason string` 参数 |
| Attribution ledger 查询 API | 20260514 规划 | 需支持 `account_key` + `window` 查询 |
| `EventsEmit` | 已存在 | 无需改动 |

**总计：sidecar fork 改动 3 处（handler 接受 reason + 确认两个端点保留字段），Go/Wails 改动 6 处，前端改动 2 处。**

## 前端变更

与 v2 相同：

| 组件 | 变更 |
|------|------|
| `AccountCard.tsx` | 通用限额进度条，按 window 分组展示多条规则 |
| `ApiKeyDetailModal.tsx` | `QuotaRuleEditor` section |
| `AccountOrderRow.tsx` | 超限 chip（如 `24h tokens 已满`） |
| `QuotaRuleEditor.tsx` | 新增通用组件 |
| `UsageDeskFeature.tsx` | 新增 `本地限额` 观察源 |

## 实施顺序

1. **Phase 1** — Attribution ledger (20260514)
   - SQLite ledger + 管理 API 查询接口（需要支持 account_key + window 参数）

2. **Phase 2** — QuotaPolicyEngine (本期)
   - `quota_policy_engine.go` — 策略引擎核心
   - `quota-rules-v1.json` 持久化
   - Wails 绑定: 规则 CRUD + 状态查询
   - `runtime.go` 集成: Start/Stop

3. **Phase 3** — 前端 (本期)
   - 通用 `QuotaRuleEditor` 组件
   - 账号卡片限额进度条
   - Usage Desk 观察源

## 验证计划

1. `quota_policy_engine_test.go` — 滑动窗口计算、超限/恢复逻辑、多规则并发、手动禁用冲突
2. `quota_rules_test.go` — 配置 CRUD + 序列化/反序列化
3. 集成测试 — mock attribution API, 验证 SetAccountDisabled 调用
4. 前端 unit test
5. `npm run typecheck` + `npm run build` + `go test ./...`
