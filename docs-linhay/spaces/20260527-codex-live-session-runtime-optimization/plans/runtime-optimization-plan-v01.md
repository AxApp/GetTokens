# Runtime Optimization Plan v01

## 诊断结论

当前风险不是单点内存泄漏，而是观测面设计过重：

1. `/v0/management/gettokens/live-sessions` 返回完整 realtime snapshot，列表轮询会反复序列化 `sessions -> requests -> timeline`。
2. 前端 live workspace 高频轮询导致 access log 快速增长。
3. `projectName` 补全在 snapshot 热路径上，缓存 TTL 只有 10 秒，缺失名称时可能反复扫 `.codex` JSONL。
4. realtime tracker 和 disk history 职责已有边界，但列表接口仍把详情级数据混入默认响应。
5. Gin access log 对高频 2xx management polling 没有降噪策略。

## 优化面清单

### 1. API Shape

- 新增或调整列表接口为轻量 row feed：
  - `summary`
  - `sessions[]` row fields：`sessionID / projectName / status / model / authID / authLabel / provider / downstreamTransport / upstreamTransport / startedAt / lastEventAt / durationMs / requestCount / activeRequestID / lastRequestID / fallback flags`
  - 不包含 `requests[]`
  - 不包含 request `timeline[]`
- 保留详情接口：
  - 优先复用 `/gettokens/live-sessions/history?session_id=...&limit=...&offset=...`
  - 如前端需要 active request 的最新投影，可新增 `/gettokens/live-sessions/:session_id/detail`
- 支持轻量变更检测：
  - `etag` 或 `snapshotVersion`
  - `since` / `last_event_at` 查询
  - 无变化返回极小 payload 或 `304`

### 2. Frontend Polling

- workspace 可见且有 active session：2s 轮询。
- workspace 可见但无 active session：5-10s 轮询。
- workspace 不可见、窗口 hidden、切到非 live workspace：暂停或 30s 低频。
- 详情面板独立刷新：
  - 列表刷新不带详情。
  - 详情打开时按 `session_id` 拉 requests/timeline。
  - 切换详情时取消上一个 pending request。
- 浏览器 preview 保持 mock/live/cache 来源标识，不依赖真实 sidecar。

### 3. Project Name Enrichment

- 首选：记录 request/session 时从 Codex metadata/header/context 直接注入 `projectName`。
- 次选：按 session id 精准查候选 JSONL，而不是全量 walk。
- 后台缓存：
  - snapshot 不同步触发全盘扫描。
  - 全局 lookup TTL 从 10 秒提高到 5-10 分钟。
  - 缓存刷新放 goroutine，并有 singleflight 防止并发重复扫。
- fallback：项目名缺失时前端显示 `未知项目`，不要为了补全阻塞列表。

### 4. Realtime Memory

- tracker 内拆分 row 与 detail：
  - row 常驻：小字段、最新状态、最近时间。
  - detail 只保留 active request + 最近 N 条摘要。
- completed request 瘦身：
  - 完成后将 timeline 压成摘要，完整历史写入 SQLite。
  - request detail 通过 history endpoint 查询。
- prune 策略：
  - 保留 30m realtime window。
  - session cap 与 request cap 继续生效，但完成态可更激进。
  - prune 不删除 disk history。

### 5. Logging

- 对 `/v0/management/gettokens/live-sessions` 成功 2xx access log 降噪：
  - 默认 debug 级别
  - 只记录慢请求，例如 `>500ms`
  - 或按 N 次采样
  - 仍记录 4xx/5xx
- 对 `rate-limit-status / strategies` 等管理轮询同样考虑慢请求/异常优先。
- 保留 request id、状态码、耗时的诊断能力，但避免每 2 秒刷一行 info。

### 6. Observability Diagnostics

- 增加轻量 runtime metrics endpoint 或 debug panel 字段：
  - realtime session count
  - active request count
  - retained request count
  - estimated snapshot bytes
  - project lookup cache age
  - last project lookup duration
  - history DB write error count
- 这些指标只用于诊断，不显示敏感 payload。

### 7. Disk History

- 确认 `live_session_requests` history store 的分页查询覆盖详情页需要。
- 历史库写入失败时只暴露脱敏错误与计数，不在 hot path 重试放大。
- 若需要清理历史，单独设计 disk cleanup API，不能复用 realtime `DELETE /live-sessions`。

## 分阶段计划

### Phase 0：基线与失败测试

1. 固化当前问题的 BDD 场景。
2. 增加 endpoint 测试：列表 snapshot 不应包含 `requests`。
3. 增加 tracker 测试：snapshot 不触发项目名全盘扫描。
4. 增加 frontend source 测试：隐藏或非 workspace 时停止轮询。
5. 记录当前 baseline：
   - snapshot payload bytes
   - 轮询频率
   - `sidecar.log` 每分钟增长量
   - RSS 与 retained request count

### Phase 1：列表接口瘦身

1. 新增 `LiveSessionRow` DTO。
2. 将 `/gettokens/live-sessions` 改为 row feed。
3. 保持旧详情字段从 history/detail endpoint 获取。
4. 更新 Wails/root DTO 与 generated bindings。
5. 前端列表消费 row feed，详情按需拉取。

### Phase 2：轮询与日志降噪

1. 前端按 workspace visibility 和 active session 调整轮询。
2. 页面 hidden 时暂停。
3. Sidecar 对 live-session 2xx access log 采样或慢请求记录。
4. 添加测试覆盖 polling policy。

### Phase 3：ProjectName 热路径移除

1. 从请求 metadata/header/context 优先写入 projectName。
2. 将全盘 `.codex` lookup 移出 snapshot 同步路径。
3. 增加缓存 TTL 与 singleflight。
4. 添加测试：snapshot 在缺失 projectName 时不阻塞、不触发全盘 scan。

### Phase 4：Realtime 内存留存

1. completed request 写入 disk history 后在内存瘦身。
2. tracker 中保留 active request + 最近摘要。
3. history endpoint 补齐详情分页。
4. 添加测试：大量 completed request 不使 row snapshot 膨胀。

### Phase 5：验收与写回

1. `go test` 覆盖 CLIProxyAPI fork 相关包。
2. GetTokens root/Wails binding 测试。
3. Frontend focused tests、typecheck、build。
4. 本地 sidecar smoke：
   - 打开 live-session 页面
   - 观察 snapshot payload size
   - 观察 `sidecar.log` 增长速度
   - 验证详情仍可打开 request timeline
5. 更新本 space、必要 dev 文档、memory，并执行 `qmd update && qmd embed`。

## 风险与取舍

1. 兼容性：如果前端旧逻辑依赖列表中直接存在 `requests[]`，需要一次性迁移到 detail source。
2. 诊断完整性：列表瘦身不能丢失历史；详情必须能从 disk history 找回。
3. 项目名准确性：异步补全可能短时间显示 `未知项目`，但这是可接受的性能取舍。
4. 日志降噪：不能静默吞掉 4xx/5xx 和慢请求，否则排障会变难。
5. 内存瘦身：active streaming request 仍需要实时 timing 投影，不能像 completed request 一样过早压缩。

## 推荐优先级

1. P0：列表接口瘦身 + 前端轮询暂停 + access log 降噪。
2. P1：projectName 补全移出 snapshot 热路径。
3. P2：completed request 内存瘦身 + history detail 分页完善。
4. P3：etag/since 与 runtime metrics endpoint。
