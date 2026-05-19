# Account Detail Runtime Observability Plan v01

## 前置约束
1. 本计划只推进需求、数据契约和后端运行态观测，不提前改账号详情前端视觉。
2. 账号详情 UI 接入等待设计系统重构稳定后再进入独立实施项。
3. 所有 sidecar fork 改动仍遵守 CLIProxyAPI fork 维护规则：先在 fork 内提交，再重建 sidecar，再更新父仓库 gitlink。

## 分期
### P0 数据面闭环
1. 新增 sidecar runtime activity store：
   - key：request id
   - secondary index：auth id、auth index、session id
   - TTL：默认 5 分钟，完成态短保留 60 秒
2. 新增 GetTokens 请求 activity middleware：
   - 入口解析 `Session_id`、`X-Session-ID`、`conversation_id` 或 fallback request id
   - 写入 `pending_auth`
   - 响应结束时标记 `completed / failed`
3. 在 auth selection 路径接入 selected auth callback：
   - 选中账号后写 `auth_id / auth_index / provider / routed_model`
   - streaming 请求把状态置为 `streaming`
4. 扩展 usage attribution plugin：
   - completed event 关联 request id 或 activity id
   - 最近请求仍从 SQLite ledger 查询
5. Management API：
   - `GET /v0/management/gettokens/account-runtime?account_key=<key>`
   - 返回 active requests、recent requests、guard summary、session affinity summary 的首版结构
6. Wails：
   - `GetAccountRuntimeObservability(accountKey string)` 代理 management API
   - DTO 只读，不修改账号配置

### P1 守卫与会话证据
1. 接入 Route Guard 状态摘要：
   - 规则数量、blocked、最近 block event
   - 复用已有 rate-limit management API 或内部 store
2. 接入 session affinity 快照：
   - 按 session id 查询当前绑定 auth
   - 暴露 TTL / last seen
3. 记录 route policy evidence：
   - `allow / deny / order / fallback` 仅记录脱敏策略摘要
   - 不记录完整候选列表中的敏感来源

### P2 UI 接入准备
1. 前端仅新增 model mapper 与测试，不碰视觉实现。
2. 设计系统稳定后，在账号详情里接入模块：
   - `正在使用`
   - `最近请求`
   - `路由与守卫`
   - `会话亲和`
   - `出口与诊断`
3. Storybook / design-system story 由设计系统任务统一决定，本 space 不抢先新增。

## 数据结构草案
```go
type AccountRuntimeSnapshot struct {
    AccountKey       string
    GeneratedAt      string
    ActiveRequests   []AccountRuntimeRequest
    RecentRequests   []AccountRuntimeRequest
    Guard            AccountRuntimeGuardSummary
    SessionAffinity  []AccountRuntimeSessionBinding
}

type AccountRuntimeRequest struct {
    RequestID      string
    SessionID      string
    SessionKind    string
    Provider       string
    RequestedModel string
    RoutedModel    string
    AuthID         string
    AuthIndex      string
    Status         string
    StartedAt      string
    LastSeenAt     string
    CompletedAt    string
    StatusCode     int
    Failed         bool
    LatencyMs      int64
    TotalTokens    int64
    EvidenceID     string
}
```

## 测试策略
1. Sidecar Go 单测：
   - activity store TTL / status transition
   - selected auth callback 后 active request 能按 auth id / auth index 查询
   - completed / failed 清理语义
2. Management API 测试：
   - unknown account 返回空快照
   - active + recent 合并不重复
   - 敏感字段不会出现在 response JSON
3. GetTokens Wails 测试：
   - sidecar response -> root DTO 映射
   - sidecar unavailable 时返回可展示错误
4. 前端后续测试：
   - model mapper 只读映射
   - UI 视觉测试延后到设计系统接入期

## 验收门禁
1. sidecar fork：相关 package 单测 + `go test ./...`
2. GetTokens：`go test ./internal/wailsapp`，若 root binding 变动再跑 `./scripts/wails-cli.sh generate module`
3. 文档：`docs-linhay/scripts/check-docs.sh`
4. 本期若只做文档设计，不运行代码测试，必须明确说明原因。

## 当前状态
- 状态：backlog
- 说明：后续有空再做；实现前先确认设计系统与账号详情组件边界是否稳定。
- 最近更新：2026-05-19
