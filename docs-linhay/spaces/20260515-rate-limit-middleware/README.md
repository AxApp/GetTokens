# 账号限流策略中间件

## 背景
当前 GetTokens 账号体系已有稳定的 local ID 标识（`auth-file:*` / `codex-api-key:*` / `openai-compatible:*`），sidecar 也已具备 attribution ledger 记录每次 relay 请求的用量（20260514 规划）。

但用户无法对某个账号施加本地限流——例如"这个 key 每小时最多 100 次请求"或"这个账号每天最多 100 万 token"。

我们需要一个**通用的限流中间件框架**：支持多种限流策略，每种策略可独立配置规则，并在 relay 路由阶段自动跳过超限账号。框架本身可扩展——后期新增策略只需实现接口并注册，不碰既有代码。

## 目标
1. 在 sidecar fork 中设计一个可扩展的限流中间件框架，采用策略模式（Strategy Pattern）。
2. 首期内置两种策略：**Token 窗口限流**（某时间窗口内 token 上限）和**请求窗口限流**（某时间窗口内请求次数上限）。
3. 策略接口统一：`RateLimitStrategy.Check(ctx, req) → Decision`，后期新增策略只需实现此接口。
4. 限流规则持久化到 SQLite（与 attribution ledger 同 DB），通过 management API CRUD。
5. Enforcement 在 sidecar routing 阶段生效——超限账号从候选列表中剔除，路由自动 fallback 到下一账号。
6. 前端显示每个账号的限流状态：哪些规则生效、当前用量、是否超限、超限原因。

## 2026-05-22 Route Guard v2 补充

本期追加把“手动禁用账号”和“自动限流阻断”收敛为同一类路由守卫需求：账号不应继续参与新请求候选。

落地边界：
1. sidecar fork 新增 `AccountRouteGuardStore`，按 `manual-disabled` 与 `rate-limit` 两个 source 维护内存阻断状态。
2. `accountRouteGuardPolicy` 作为 `RoutePolicy` 安装，热路径只读内存 deny list，不查 DB。
3. 手动禁用账号时，`sdk/cliproxy.Service.applyCoreAuthAddOrUpdate` 写入 `manual-disabled` source；重新启用时只清理该 source，不影响限流 source。
4. 限流 `RateLimitEvaluator` 每次评估后同步写入 `rate-limit` source；窗口恢复或规则删除只清理限流 source，不会误恢复用户手动禁用的账号。
5. Codex auth 从可路由状态切到 disabled 时，立即调用现有 `CloseCodexWebsocketSessionsForAuthID(authID, "auth_disabled")` 关闭受影响上游 WebSocket session，让客户端重连后重新选账号。

P0 行为选择：本轮不做同一个 downstream WebSocket 内的无感热迁移；禁用/限流先保证新请求不会再命中旧账号，Codex WebSocket 已有 upstream session 在手动禁用时立即断开，触发客户端重连到其他可用账号。

## 2026-05-22 P2 WebSocket 热切补充

P2 已把同一个 downstream WebSocket 内的账号切换做到“请求轮次边界”：
1. downstream 连接不因 Route Guard 命中而主动关闭。
2. 每次收到新的 `response.create` / `response.append` 后，handler 先检查当前 `pinnedAuthID` 是否已被 `AccountRouteGuardStore` 阻断；如果阻断，则释放 pin，并要求下一轮使用完整 transcript replay。
3. 释放 pin 时会关闭当前 execution session 的旧 upstream 资源，但保留 downstream WebSocket，随后本轮请求重新进入 AuthManager 选路。
4. Codex WebSocket executor 在同一个 execution session 内发现新选中的 `authID` 或 `wsURL` 与旧 upstream conn 不一致时，会以 `auth_rotated` 关闭旧 upstream 并重新握手，避免新账号请求仍写入旧连接。
5. P2 不承诺在一条正在输出的 response 中途切换账号；切换边界固定为下一条 downstream request。

## 范围

### Sidecar Fork（`internal/gettokenshooks/`）
1. **策略接口** `RateLimitStrategy`：定义 `ID() / Name() / Check(ctx, req) Decision`。
2. **内置策略实现**：
   - `TokenWindowStrategy` — 按窗口统计 `total_tokens`，超限即拦截。
   - `RequestWindowStrategy` — 按窗口统计 `request_count`，超限即拦截。
3. **策略注册表** `StrategyRegistry`：注册/查找策略。
4. **限流 RoutePolicy** `rateLimitPolicy`：实现 `coreauth.RoutePolicy`，在 `RewriteCandidates` 中调用所有已注册策略，剔除超限账号。
5. **规则存储**：SQLite 表 `rate_limit_rules`，与 attribution ledger 同 DB。
6. **限流事件记录**：SQLite 表 `rate_limit_events`，记录每次拦截的账号、策略、用量、规则 ID。
7. **Management API**：CRUD 规则 + 查询限流事件 + 查询账号限流状态。

### Go/Wails 端
1. 通过 management API 代理限流规则 CRUD，对前端暴露 Wails 绑定。
2. 提供 `GetRateLimitStatus(accountKey)` 查询某账号所有规则的当前状态。
3. 轻量 poller：读取最近的限流事件，将超限原因写入账号 `StatusMessage`，恢复时清除。

### 前端
1. 账号卡片展示限流进度条（按策略类型 + 窗口分组）。
2. 账号详情新增限流规则配置区：策略选择、窗口选择、阈值输入、启用开关。
3. 账号行超限时显示策略标签 chip（如 `24h tokens 已满`）。

### 测试
1. 策略接口 + 内置策略单元测试。
2. `rateLimitPolicy.RewriteCandidates` 超限过滤逻辑测试。
3. Management API CRUD 测试。
4. 前端进度条 / 状态展示测试。

## 非目标
1. 不修改 CLIProxyAPI upstream core（路由、retry、usage record 等）。
2. 不在首期实现 `cost`（费用）策略和 `concurrency`（并发）策略——但接口设计支持后续新增。
3. 不把限流规则写入 sidecar config TOML；使用独立 SQLite 表。
4. 不改变 `GetCodexQuota`（Codex 计划额度）的现有逻辑；两套额度独立展示。
5. 不在首期做分布式限流（多实例共享限额）。

## 验收标准
### 场景 1：配置 Token 窗口限流
Given 用户在 `codex-api-key:<id>` 详情中新增规则：策略 = Token 窗口限流、窗口 = 24h、上限 = 1,000,000 tokens、行为 = 拦截  
When 保存规则  
Then 规则写入 sidecar `rate_limit_rules` 表  
And 账号卡片显示限流进度条（当前用量 / 1,000,000 tokens）。

### 场景 2：超限自动跳过
Given 账号 A 已配置 24h token 上限 500,000，当日用量已达 500,000  
When 外部客户端发起 relay 请求，sidecar routing 在候选列表中包含账号 A  
Then `rateLimitPolicy.RewriteCandidates` 从候选列表中移除账号 A  
And routing 自动尝试下一个候选账号  
And 前端账号行显示 `24h tokens 已满`。

### 场景 3：窗口滑过后恢复
Given 账号 A 配置 1h 请求上限 10 次，最近 1 小时内已用 10 次  
When 最近一次请求距离现在超过 1 小时，窗口内用量降到 9 次  
Then 下一次 routing 中账号 A 重新出现在候选列表  
And 前端账号行限流标记消失。

### 场景 4：未配置限流的账号不受影响
Given 账号 B 无任何限流规则  
When routing 选中账号 B  
Then 正常放行，不做任何限流检查。

### 场景 5：多策略并存
Given 账号 A 同时配置：Token 窗口 24h=1M + 请求窗口 1h=100  
When Token 用量未超限但请求次数已达 100  
Then 请求窗口策略触发拦截，Token 策略不触发  
And 前端显示 `1h requests 已满`。

### 场景 6：新增策略类型
Given 后期需要新增"并发请求上限"策略  
When 实现 `RateLimitStrategy` 接口并注册到 `StrategyRegistry`  
Then 新策略自动参与 `RewriteCandidates` 的限流检查  
And 前端规则编辑器自动展示新策略为可选类型（通过 management API 查询支持的策略列表）。

### 场景 7：限流事件可追溯
Given 账号 A 的 24h token 策略触发了拦截  
When 查询 `GET /v0/management/gettokens/rate-limit-events?account_key=...`  
Then 返回最近拦截事件列表，包含策略类型、窗口、当前用量、限额、触发时间。

## 设计稿入口

- 本期设计稿：[rate-limit-design-v01.html](rate-limit-design-v01.html)
- 约束：单期只保留一个 HTML 文件。
- 端约束：桌面 Wails 工作台，不做移动端适配。

设计方向：
1. 限流状态进入当前共享 `AttributionCard` 母版，作为 `Route Guard` 区域放在 quota 后、evidence 前；它表达路由候选是否被剔除，而不是另一条平台 quota。
2. 超限账号同时影响左侧状态 rail、guard summary 与策略 chip；Codex 顺序卡在完整 / 缩略模式下都必须保留超限 chip 和 route policy 语义。
3. 限流规则配置区在账号详情 modal 内独立为 `Route Guard Rules` section，位于 `Management` 与 `Verification` 之间，并展示 evaluator 快照时间与保存后立即评估语义。
4. Usage Desk 若新增 `限流状态` 观察源，必须作为第三个 source 数据面接入，而不是复用现有 `真实请求量 / 本地投影用量` 的文案。
5. 设计稿已经按 2026-05-15 后的账号归因卡母版重做；旧稿中“仅在旧账号卡上插入 Rate Limits 进度条”的口径不再作为实现依据。

## Worktree 映射

- branch：`feat/20260515-rate-limit-middleware`
- worktree：`../GetTokens-worktrees/20260515-rate-limit-middleware/`

## 相关链接
- 实施方案 v5：[plans/20260515-rate-limit-middleware-plan-v05.md](plans/20260515-rate-limit-middleware-plan-v05.md)（**当前方案：内存缓存 + 定时评估**）
- 前端展示设计：[plans/20260515-rate-limit-frontend-design.md](plans/20260515-rate-limit-frontend-design.md)
- 冒烟截图：[screenshots/20260516/rate-limit/20260516-rate-limit-route-guard-blocked-after-v03.png](screenshots/20260516/rate-limit/20260516-rate-limit-route-guard-blocked-after-v03.png)
- 真实 Wails 复验截图：[screenshots/20260516/rate-limit/20260516-rate-limit-wails-route-guard-blocked-after-v04.png](screenshots/20260516/rate-limit/20260516-rate-limit-wails-route-guard-blocked-after-v04.png)
- Wails 绑定保存复验截图：[screenshots/20260516/rate-limit/20260516-rate-limit-wails-binding-save-after-v05.png](screenshots/20260516/rate-limit/20260516-rate-limit-wails-binding-save-after-v05.png)
- Wails 绑定删除复验截图：[screenshots/20260516/rate-limit/20260516-rate-limit-wails-binding-delete-after-v06.png](screenshots/20260516/rate-limit/20260516-rate-limit-wails-binding-delete-after-v06.png)
- OpenAI-compatible 详情复验截图：[screenshots/20260516/rate-limit/20260516-rate-limit-openai-compatible-route-guard-detail-after-v01.png](screenshots/20260516/rate-limit/20260516-rate-limit-openai-compatible-route-guard-detail-after-v01.png)
- CPA-Manager 参考分析：[reference/cpa-manager-analysis.md](reference/cpa-manager-analysis.md)
- 历史方案 v4：[plans/20260515-rate-limit-middleware-plan-v04.md](plans/20260515-rate-limit-middleware-plan-v04.md)（已废弃：热路径查 DB）
- 历史方案 v3（已废弃）：[plans/20260515-daily-quota-middleware-plan-v03.md](plans/20260515-daily-quota-middleware-plan-v03.md)
- 账号归因（attribution ledger）：[20260514-sidecar-usage-account-attribution](../20260514-sidecar-usage-account-attribution/README.md)
- 既有 quota 实现：`frontend/src/features/accounts/model/accountQuota.ts` / `internal/wailsapp/quota.go`
- Codex 账号列表：[20260511-codex-account-list-tab](../20260511-codex-account-list-tab/README.md)

## 当前状态
- 状态：implemented-verified
- 最近更新：2026-05-22
- 实现摘要：
  - sidecar fork 已接入 `RateLimitStrategyRegistry`、`rate_limit_rules` / `rate_limit_events`、定时 `RateLimitEvaluator`、`rateLimitPolicy` 和 `/gettokens/rate-limit-*` management API。
  - sidecar fork 已追加 `AccountRouteGuardStore` / `accountRouteGuardPolicy`：`manual-disabled` 与 `rate-limit` 共用 RoutePolicy deny 机制，但 source 独立清理。
  - 手动禁用 Codex auth 会关闭该 auth 关联的上游 WebSocket session，避免已有 `pinnedAuthID` 长期继续复用旧上游。
  - Codex WebSocket P2 已支持同 downstream 连接内在下一轮请求释放 guarded pinned auth、重放 transcript，并按新 auth 重新建立 upstream conn。
  - GetTokens Go/Wails 已暴露策略、规则、状态与事件查询/保存方法，root `main.App` 绑定已同步。
  - 前端首期收敛在账号池、Codex 顺序卡与 OpenAI-compatible 账号：共享 `AttributionCard` 增加 `Route Guard` 区域，Codex API Key 与 OpenAI-compatible 详情均复用 `Route Guard Rules` 配置区。
- 验收记录：
  - 2026-05-22 自动化：sidecar fork `go test ./internal/gettokenshooks ./internal/runtime/executor ./sdk/cliproxy ./sdk/api/handlers/openai` 与 `go test ./...` 均已通过。
  - 2026-05-22 回归新增：覆盖手动禁用 deny、手动/限流 source 互不误清、限流评估写入统一 guard、Codex auth 禁用触发 WebSocket close 且不误伤同 provider 其他账号。
  - 2026-05-22 P2 回归：覆盖同 execution session auth 变化时重新 upstream 握手；覆盖 WebSocket handler 在 pinned auth 被 Route Guard 阻断后，同一个 downstream 连接内切到新 auth 且不泄漏旧 `previous_response_id`。
  - 自动化：sidecar `go test ./...`、主仓库 `go test ./...`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run build` 均已通过。
  - 多场景回归：已补 sidecar 场景测试，覆盖 token-window 阻断、request-window 阻断、warn 只告警不 deny、窗口滑过恢复、disabled/unconfigured 放行、注册式新策略、CRUD/event。
  - Live sidecar API：Wails dev `VERSION 2026.05.16.15` 使用最新 sidecar binary 重新启动；用 synthetic account `smoke-rate-limit:20260516:api` 验证 strategies、空状态、token block、event 记录、warn、窗口恢复、disabled、delete cleanup 全链路通过。
  - 桌面冒烟：Wails dev app `VERSION 2026.05.16.15` 已启动，sidecar management API ready；通过 UI 新增 `token-window limit=1 block` 规则后，SQLite `match_key` 写入 `auth-id:codex:apikey:a6ba88c12cad`，status 返回 `blocked=true / 7d tokens 已满`，账号卡显示 `ROUTE GUARD` 阻断状态。
  - Subagent 体验修复：浏览器预览发现账号池因只等待 Wails `ready` 而显示 `0 UNITS`，已改为无 Wails 绑定时加载 preview 数据；另修复 API Key 详情未透传 `rateLimitStatus` / `rateLimitStrategies` 导致 `Route Guard Rules` 空白的问题；最后一轮体验又补齐 preview 下规则保存/删除不再误触 Wails binding，而是本地更新并提示 `BROWSER PREVIEW ONLY`。
  - 主控追加修复：真实 Wails 体验发现 `Route Guard Rules` 编辑中会被后台 `rateLimitStatus` 刷新覆盖 draft，已增加 dirty draft 保护；Subagent 第二轮发现 OpenAI-compatible 详情缺少 `Route Guard Rules`，已抽出共享规则编辑区并接入 provider 详情。
  - 复验确认：账号池 preview、Codex API Key 详情、OpenAI-compatible 详情、Codex 顺序卡 blocked chip、真实 Wails UI 保存/刷新/blocked 状态均可见；本机测试规则已通过 management API 删除，`rules_len=0`、`blocked=false`，避免污染 dev 环境。
  - 追加 Wails binding 复验：dev app `VERSION 2026.05.16.16` 通过 UI 新增 `ui-smoke-20260516` 规则，API 确认 `match_key=auth-id:codex:apikey:a6ba88c12cad`、`limit_value=1`；随后通过 UI 删除，API 查询该 label 数量为 `0`。
