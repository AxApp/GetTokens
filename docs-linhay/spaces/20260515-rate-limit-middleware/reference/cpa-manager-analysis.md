# CPA-Manager 参考分析

项目：https://github.com/seakee/CPA-Manager（forked from router-for-me/Cli-Proxy-API-Management-Center）

## 项目定位

CPA-Manager 是 CLIProxyAPI (CPA) 的 Web 管理面板 + 独立 Go Usage Service。它不实现自己的限流或代理路由——这些属于 CPA 本身。但它通过 **usage collector + SQLite 持久化 + REST API** 三层架构，提供了完整的使用量采集、配置管理和数据查询能力。

与我们的限流中间件目标高度重合：
- 都需要从 sidecar/CPA 的 usage queue 消费数据
- 都需要 SQLite 持久化和查询
- 都需要 management REST API
- 都需要生命周期管理（Start/Stop）

## 可参考的架构模式

### 1. 生命周期控制

```go
// collector/collector.go
type Manager struct {
    mu     sync.Mutex
    cancel context.CancelFunc
    status Status
}

func (m *Manager) Start(ctx context.Context, cfg RuntimeConfig) {
    m.mu.Lock()
    defer m.mu.Unlock()
    if m.cancel != nil { m.cancel() }  // 先停旧实例
    runCtx, cancel := context.WithCancel(ctx)
    m.cancel = cancel
    go m.run(runCtx, cfg)
}

func (m *Manager) Stop() {
    m.mu.Lock()
    defer m.mu.Unlock()
    if m.cancel != nil { m.cancel() }
    m.status.Collector = "stopped"
}
```

**对我们 v5 的参考：** `RateLimitEvaluator.Start()` / `Stop()` 应复用此模式——context cancel 停止评估循环，Status 驱动前端状态展示。

### 2. 线程安全的状态更新

```go
func (m *Manager) setStatus(update func(*Status)) {
    m.mu.Lock()
    defer m.mu.Unlock()
    update(&m.status)  // 闭包内自由更新多个字段, 持有锁
}
```

比直接暴露 mutex 更安全，避免调用方忘记解锁。

### 3. SQLite 初始化模式

```go
// store/store.go
func Open(path string) (*Store, error) {
    os.MkdirAll(filepath.Dir(path), 0o755)  // 确保目录存在
    db, err := sql.Open("sqlite", path)
    store := &Store{db: db}
    store.init()  // schema + migration
    return store, nil
}

func (s *Store) init() error {
    statements := []string{
        `pragma journal_mode = WAL`,
        `pragma synchronous = FULL`,
        `pragma busy_timeout = 5000`,
        `pragma foreign_keys = ON`,
        // ... CREATE TABLE statements ...
    }
    for _, stmt := range statements {
        s.db.Exec(stmt)
    }
    s.ensureColumns() // migration
    return nil
}
```

**对我们 v5 的参考：**
- WAL mode + busy_timeout 保证并发读写安全（RoutePolicy 读 + 评估器写）
- `init()` 用 string slice，简洁无 ORM
- migration 用 `pragma table_info` 检测缺失列再 `ALTER TABLE ADD COLUMN`

### 4. Settings 表（Key-Value JSON 配置）

```go
// store/store.go
`create table if not exists settings (
    key text primary key,
    value text not null,
    updated_at_ms integer not null
)`

// 读
func LoadManagerConfig() (ManagerConfig, bool, error) {
    var raw string
    err := db.QueryRow(`select value from settings where key = ?`, key).Scan(&raw)
    if errors.Is(err, sql.ErrNoRows) { return cfg, false, nil }
    json.Unmarshal([]byte(raw), &cfg)
}

// 写
func SaveManagerConfig(cfg ManagerConfig) error {
    data, _ := json.Marshal(cfg)
    db.Exec(`insert into settings(key, value, updated_at_ms)
        values(?, ?, ?) on conflict(key) do update set ...`, key, string(data), now)
}
```

**对我们 v5 的参考：** `rate_limit_rules` 表可参考此模式——每条规则一行（不是 JSON blob），直接用 SQL 列查询和筛选。这比 JSON blob 更适合按 account_key 过滤的查询。

### 5. Usage Events 去重

```go
// store/store.go
`create table if not exists usage_events (
    ...
    event_hash text not null unique,  // ← 去重键
    ...
)`

// 插入用 INSERT OR IGNORE
stmt.Prepare(`insert or ignore into usage_events (...) values (...)`)
affected, _ := res.RowsAffected()
if affected > 0 { result.Inserted++ } else { result.Skipped++ }
```

**对我们 v5 的参考：** `rate_limit_events` 表可加 `event_hash` 唯一约束，防止因 ticker 重复评估产生重复事件。

### 6. Dead Letter 模式

```go
func (s *Store) AddDeadLetter(ctx context.Context, payload string, parseErr error) error {
    db.ExecContext(ctx,
        `insert into dead_letter_events(payload, error, created_at_ms) values(?, ?, ?)`,
        payload, parseErr.Error(), time.Now().UnixMilli(),
    )
}
```

**对我们 v5 的参考：** 评估器查询 ledger 失败时，不应静默跳过——应写 dead letter 事件供诊断。对于限流场景，query 失败时应保守处理（放行？还是拦截？）。建议：query 失败时保持上一次的 RateLimitState 不变，直到下次成功查询。

### 7. API 路由组织

```go
// httpapi/server.go
func (s *Server) Handler() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("/health", s.withCORS(s.handleHealth))
    mux.HandleFunc("/status", s.withCORS(s.handleStatus))
    // ...
    return mux
}
```

CPA-Manager 使用 Go 标准库 `http.ServeMux`，而我们是在 sidecar fork 中使用 Gin。路由组织方式不同，但 URL 命名规范可以参考：
- `/v0/management/gettokens/rate-limit/rules` 规则 CRUD
- `/v0/management/gettokens/rate-limit/status` 限流状态
- `/v0/management/gettokens/rate-limit/events` 限流事件

### 8. 环境变量覆盖配置

```go
// 优先级: env vars → DB manager config → DB legacy setup → defaults
func resolveSetupWithSource(ctx) (Setup, source, bool, error) {
    if s.cfg.CPAUpstreamURL != "" && s.cfg.ManagementKey != "" {
        return setupFromEnv(), "env", true, nil  // env 最高优先级
    }
    if cfg, ok := loadFromDB(); ok { return cfg, "db", true, nil }
    return defaults, "none", false, nil
}
```

**对我们 v5 的参考：** 限流规则目前只从 SQLite 加载。如果后续需要环境变量设置全局默认限额（如所有账号默认 24h 1M tokens），可参考此优先级链。

## 不能直接用的部分

| CPA-Manager 特性 | 为什么不适合我们的限流中间件 |
|------------------|---------------------------|
| HTTP/RESP queue consumer | 我们已有 usage attribution plugin 直接写 ledger，不需要 queue |
| `http.ServeMux` 路由 | 我们在 sidecar Gin 环境中，用 `gin.IRouter` |
| 管理面板嵌入 | 我们的前端是 Wails SPA，不是嵌入 HTML |
| Setup 向导 | 我们不需要首次配置引导 |
| Reverse proxy to CPA | sidecar 本身就在 CPA 进程中，不需要代理 |
| Model prices / LiteLLM sync | 不相关 |
| API key aliases | 不相关 |

## 直接可用的模式总结

| 模式 | CPA-Manager 文件 | v5 对应 |
|------|-----------------|---------|
| Start/Stop 生命周期 | `collector.go:Start()/Stop()` | `RateLimitEvaluator.Start()/Stop()` |
| 线程安全状态更新 | `collector.go:setStatus(update)` | evaluator 的 state swap |
| SQLite WAL + busy_timeout | `store.go:init()` | rate limit tables 建表 |
| Settings key-value | `store.go:settings` 表 | `rate_limit_rules` 表 |
| INSERT OR IGNORE 去重 | `store.go:InsertEvents` | `rate_limit_events` 去重 |
| Dead letter 事件 | `store.go:AddDeadLetter` | 评估失败诊断记录 |
| Column migration | `store.go:ensureColumns()` | 后续新增策略字段时的迁移 |
| 配置合并/defaults | `server.go:mergeConfig` | 规则创建时的默认值填充 |
