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

- 本期设计稿：`（待产出）`
- 约束：单期只保留一个 HTML 文件。
- 端约束：桌面 Wails 工作台，不做移动端适配。

设计方向：
1. 限流进度条与既有 Codex 计划额度在同卡片内上下并列，使用 amber 色轨区分。
2. 超限账号行显示策略 chip（如 `24h tokens 已满`），左侧状态 rail 红色。
3. 限流规则配置区在账号详情 modal 内为独立 section，每条规则一行：策略下拉 / 窗口下拉 / 阈值输入 / 行为下拉 / 启用开关。
4. Usage Desk 新增 `限流状态` 观察源，按超限状态排序。

## Worktree 映射

- branch：`feat/20260515-rate-limit-middleware`
- worktree：`../GetTokens-worktrees/20260515-rate-limit-middleware/`

## 相关链接
- 实施方案 v5：[plans/20260515-rate-limit-middleware-plan-v05.md](plans/20260515-rate-limit-middleware-plan-v05.md)（**当前方案：内存缓存 + 定时评估**）
- 前端展示设计：[plans/20260515-rate-limit-frontend-design.md](plans/20260515-rate-limit-frontend-design.md)
- CPA-Manager 参考分析：[reference/cpa-manager-analysis.md](reference/cpa-manager-analysis.md)
- 历史方案 v4：[plans/20260515-rate-limit-middleware-plan-v04.md](plans/20260515-rate-limit-middleware-plan-v04.md)（已废弃：热路径查 DB）
- 历史方案 v3（已废弃）：[plans/20260515-daily-quota-middleware-plan-v03.md](plans/20260515-daily-quota-middleware-plan-v03.md)
- 账号归因（attribution ledger）：[20260514-sidecar-usage-account-attribution](../20260514-sidecar-usage-account-attribution/README.md)
- 既有 quota 实现：`frontend/src/features/accounts/model/accountQuota.ts` / `internal/wailsapp/quota.go`
- Codex 账号列表：[20260511-codex-account-list-tab](../20260511-codex-account-list-tab/README.md)

## 当前状态
- 状态：draft
- 最近更新：2026-05-15
