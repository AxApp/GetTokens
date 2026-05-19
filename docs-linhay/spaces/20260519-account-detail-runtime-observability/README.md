# Account Detail Runtime Observability

## 背景
账号池已经有统一账号卡片、账号详情弹窗、usage attribution ledger、Route Guard 限流状态、账号级代理配置和 Codex 请求顺序卡片。用户现在想回答一个更直接的问题：

> 某个账号现在有没有在工作？如果在工作，它当前服务的是哪个 Codex 会话？

这里的“项目归属”只用于查看，不进入后台统计主路径。核心不是按项目汇总，而是把 sidecar 运行时已经发生的账号选择、会话亲和、请求状态和最近请求证据暴露到账号详情页。

当前前端设计系统正在重构，本 space 先只定义需求、数据契约和验收边界，不提前介入详情页视觉实现，不新增 Storybook stories，不改现有账号详情布局。

## 目标
1. 在账号详情页补齐“运行态观测”模块边界，优先回答“这个账号当前是否正在被 CLIProxyAPI 使用”。
2. 建立 `Codex Session_id -> selected AuthID/AuthIndex -> AccountRecord` 的运行态关联。
3. 支持账号详情查看该账号的 in-flight 请求、最近请求、路由命中、限流/冷却、会话亲和和出口代理等相关中间件证据。
4. 复用现有 `usage-attribution-v1.sqlite` 与 GetTokens hooks，不扩展上游 CLIProxyAPI core usage DTO。
5. 前端设计系统稳定前，仅提供 Wails/API 数据面与文档契约；UI 只在后续设计系统收口后接入。

## 范围
### P0：当前活动与最近请求
1. Sidecar 维护轻量 in-flight runtime map：
   - request id
   - session id / session kind
   - selected auth id / auth index
   - provider / model
   - started at / last seen at
   - status：`pending_auth`、`active`、`streaming`、`completed`、`failed`、`expired`
2. 在账号详情数据查询中按账号稳定键返回：
   - 正在使用列表
   - 最近请求列表
   - 最近失败摘要
3. 最近请求继续以 usage attribution event 为事实源，in-flight map 只负责响应完成前的可见性。

### P1：路由与守卫证据
1. 展示 Route Policy 命中证据：
   - allow / deny / order / fallback 是否参与
   - 最终选中账号
   - fallback 或 retry 后是否改选其他账号
2. 展示 Route Guard / rate limit 状态：
   - 当前是否 blocked
   - 阻断规则与窗口
   - 最近一次阻断事件
3. 展示会话亲和状态：
   - `session_id -> auth_id` 绑定
   - TTL / last seen
   - 是否因失效、冷却或账号不可用而换绑

### P2：出口代理与诊断入口
1. 展示账号级出口代理最终语义：
   - account proxy
   - global proxy
   - system proxy
   - direct
2. 提供 request id / event id 复制入口，用于后续跳转请求日志或诊断工具。
3. 只展示脱敏诊断信息，不在账号详情直接展开 prompt、完整请求 body、完整响应 body 或明文密钥。

### GetTokens App / Wails
1. 新增或扩展 Wails 只读查询方法，按 `accountKey` 返回运行态观测快照。
2. root `app.go` / DTO / frontend generated binding 后续实现时必须同步。
3. 查询失败时详情页应降级显示“运行态暂不可用”，不影响原账号详情能力。

## 非目标
1. 不在本期提前修改账号详情 UI 布局、视觉样式或设计系统 story。
2. 不把项目归属作为后台统计维度；项目名只允许由前端或 Wails 从本地 Codex session 文件读取后做查看标签。
3. 不把 `project cwd`、prompt、完整 body、明文 API key 写入 sidecar runtime map 或 usage attribution ledger。
4. 不扩展上游 `sdk/cliproxy/usage.Record`、`internal/usage.RequestDetail` 或 `/usage` DTO。
5. 不改变现有账号选择、轮换、限流、代理优先级或 session affinity 语义。
6. 不把账号详情做成全局管理中心；全局策略配置仍留在对应页面或已有详情 section。
7. 不要求历史请求反推“当时正在使用”，历史只展示 completed usage attribution 事实。

## 验收标准
### 场景 1：Codex 会话开始请求时可见账号待选状态
Given Codex CLI 发起带 `Session_id` 的 relay 请求
When 请求进入 sidecar，但账号还未完成选择
Then 运行态 map 记录该请求为 `pending_auth`
And 记录 request id、session id、requested model、started at。

### 场景 2：账号选中后详情页显示正在使用
Given 请求已进入 AuthManager 并选中账号 A
When selected auth callback 写入运行态状态
Then 账号 A 的详情运行态快照包含该请求
And 状态变为 `active` 或 `streaming`
And 显示 selected auth id / auth index、模型、最近活跃时间。

### 场景 3：响应完成后转入最近请求
Given 账号 A 的 streaming 请求完成
When usage attribution plugin 收到 completed usage record
Then in-flight map 将请求标记为 `completed` 并在短保留期后移除
And 账号 A 的“最近请求”从 usage attribution ledger 可查到同一 request id 或等价事件证据。

### 场景 4：失败请求保留诊断证据
Given 账号 A 的请求因上游 401 / 429 / 5xx 失败
When 请求结束
Then 账号详情最近请求显示失败状态、状态码、耗时、模型和 event id
And 不展示敏感 body 或明文 token。

### 场景 5：同一 Codex session 的亲和关系可查看
Given sidecar 开启 session affinity
When 同一 `Session_id` 多次请求命中账号 A
Then 账号详情展示该 session 近期绑定到账号 A
And 显示 last seen 与 TTL 信息。

### 场景 6：账号被 Route Guard 阻断时可解释
Given 账号 A 因 token-window 规则被阻断
When 用户打开账号 A 详情
Then 详情页能展示当前 blocked 状态、规则摘要和最近阻断事件
And 不把阻断误展示为“正在使用”。

### 场景 7：项目名只作为查看标签
Given Wails 能从本地 Codex session 文件解析 `cwd` 或 git repository
When 账号详情展示某个 session
Then 可以显示项目名标签
And 该标签不参与 sidecar 路由、统计和账号归因。

### 场景 8：设计系统重构期间不提前接入 UI
Given 设计系统工作台和账号详情视觉规范仍在重构
When 本 space 进入技术实现
Then 首期只允许落数据契约、Wails 查询和测试
And 账号详情 UI 接入需等设计系统边界稳定后再开独立实施项。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：本期不产出前端设计稿；设计系统重构完成前不提前介入账号详情视觉实现。

## Worktree 映射

- branch：`feat/20260519-account-detail-runtime-observability`
- worktree：`../GetTokens-worktrees/20260519-account-detail-runtime-observability/`

## 相关链接
- 账号详情代理配置：[20260518 Account Detail Proxy Route](../20260518-account-detail-proxy-route/README.md)
- 限流中间件：[20260515 Rate Limit Middleware](../20260515-rate-limit-middleware/README.md)
- 账号归因架构：[20260514 Sidecar Usage Account Attribution](../20260514-sidecar-usage-account-attribution/README.md)
- Codex 账号列表：[20260511 Codex Account List Tab](../20260511-codex-account-list-tab/README.md)
- 技术边界：[20260519 Account Detail Runtime Observability Boundary](../../dev/20260519-account-detail-runtime-observability-boundary.md)
- 实施计划：[20260519 Account Detail Runtime Observability Plan v01](plans/20260519-account-detail-runtime-observability-plan-v01.md)

## 当前状态
- 状态：draft
- 最近更新：2026-05-19
