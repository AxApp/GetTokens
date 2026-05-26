# 2026-05-19 Account Detail Runtime Observability Boundary

## 结论
账号详情可以补运行态观测能力，但实现边界应放在 GetTokens hooks 和只读查询 API 上，不要把项目统计、前端视觉重构或上游 CLIProxyAPI core DTO 混进来。

首期推荐链路：

```text
relay request
  -> GetTokens activity middleware
      - record request_id / session_id / requested_model
      - status = pending_auth
  -> AuthManager selects auth
      - selected auth callback records auth_id / auth_index
      - status = active or streaming
  -> usage attribution plugin receives completed usage.Record
      - writes completed evidence to usage-attribution-v1.sqlite
  -> management API exposes account runtime snapshot
  -> Wails account detail consumes read-only snapshot
```

## 为什么不是纯 middleware
普通 Gin middleware 在请求入口可以知道 header、path、body 和 request id，但不知道最终选中了哪个账号。账号选择发生在 `AuthManager.Execute` 内部，且可能经历 retry / fallback。

因此需要两段式：

1. middleware 记录“请求已进入”。
2. selected auth callback 或等价 hook 记录“实际选中的账号”。

完成后的事实继续以 usage attribution plugin 为准。这样避免 middleware 猜账号，也避免扩展上游 `usage.Record`。

## 核心对象
### In-flight activity
只保存短生命周期运行态，不作为长期统计真源。

字段边界：

1. 可以保存：request id、session id、auth id、auth index、provider、model、status、timestamps、status code、token 汇总。
2. 禁止保存：prompt、完整请求 body、完整响应 body、明文 API key、OAuth token、project cwd 原文。
3. project name 只允许后续在 Wails 或前端读取本地 Codex session 文件后作为显示标签，不写入 sidecar activity store。

### Recent requests
继续使用 `usage-attribution-v1.sqlite`，它是 completed request 的事实源。

运行态模块不替代 Usage Desk，也不改变账号卡片统计。账号详情只取该账号最近若干条，服务诊断和解释。

### Auth refresh recovery
refresh 成功后，auth 的运行态失败标记必须显式回收到 `active`，至少包含：

1. `Status = active`
2. `Unavailable = false`
3. `StatusMessage = ""`
4. `LastError = nil`

这样才能避免一次 refresh failure 后，内存里的旧异常态一直挂到下次重启才恢复。

## 账号关联
账号详情查询以 GetTokens 资产稳定键为入口：

1. `auth-file:<name>`
2. `codex-api-key:<local-id>`
3. `openai-compatible:<provider-name>`

sidecar 运行态可以持有 runtime evidence：

1. `auth-id:<auth_id>`
2. `auth-index:<auth_index>`
3. `source:<source_hash>`

Wails 负责把 runtime evidence join 回 `AccountRecord` 的稳定 `accountKey`。这延续 2026-05-14 usage attribution 的边界：runtime evidence 是中间键，前端资产 key 是产品键。

## 账号详情模块建议
后续 UI 接入时按模块消费数据，不提前规定视觉：

1. `正在使用`：active / streaming requests。
2. `最近请求`：completed / failed requests。
3. `路由与守卫`：route policy、rate limit、blocked event。
4. `会话亲和`：session id 绑定、TTL、last seen。
5. `出口与诊断`：账号代理语义、request id / event id。

## 与设计系统重构的关系
本需求当前不介入前端设计系统。允许先做：

1. DTO 与 mapper 测试。
2. Wails 只读方法。
3. sidecar hook 与 management API。

不允许先做：

1. 新账号详情视觉布局。
2. 新 Storybook stories。
3. 新 design-system component 收编。
4. 与现有 `UnifiedAccountDetailModal` 的大规模 JSX 改造。

UI 接入应等待设计系统工作台和账号详情组件边界稳定后再开独立任务。
