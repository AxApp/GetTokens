# 20260618-openai-quota-reset-credit

## 背景

sub2api v0.1.137 新增了 OpenAI OAuth 账号的 rate-limit reset credit 查询与消费能力。该能力对 GetTokens 有明确价值：当 ChatGPT/Codex 账号存在官方可用的 reset credit 时，用户可以在 GetTokens 内确认剩余次数并主动重置窗口，而不是只能等待自然 reset。

已完成参考 intake：

- sub2api 本地参考代码：docs-linhay/references/sub2api/，当前 4a5665da。
- 提取文档：docs-linhay/spaces/20260606-relay-vendor-support/plans/20260618-sub2api-openai-quota-reset-intake.md。
- 上游核心提交：b8169492 feat(openai-quota): query + reset rate-limit credits for OpenAI accounts。

## 目标

1. 为 GetTokens 规划 OpenAI quota reset credit 功能，明确是否做、做在哪里、如何验收。
2. 固定 sidecar / Wails / frontend 的职责边界，避免前端直连 chatgpt.com 或 Wails 临时补偿。
3. 给后续实现轮提供可执行的 BDD/TDD 入口、API 草案、测试命令和风险控制。

## 范围

纳入本 space：

1. OpenAI OAuth / Codex auth-file 账号的 reset credit 查询。
2. OpenAI OAuth / Codex auth-file 账号的 consume reset credit 动作。
3. sidecar management API、Wails 透传 DTO、前端账号详情 quota 区入口。
4. consume 成功后刷新现有 quota-status，并保持 route guard / quota-empty 状态可解释。
5. fake upstream 测试、sidecar focused tests、Wails client tests、frontend model/component tests。
6. 账号详情页必须显示 reset credit 相关按钮与信息，并在点击重置前弹出二次确认。

## 非目标

1. 不为 openai-compatible 第三方 relay 账号提供 reset credit。该能力依赖 chatgpt.com 官方 OAuth 语义。
2. 不把 sub2api 的 admin backend 架构搬进 GetTokens。
3. 不在前端直接调用 chatgpt.com。
4. 不在本规划轮调用真实 OpenAI / ChatGPT 账号，也不消耗真实 reset credit。
5. 不触碰正式版 /Applications/GetTokens.app。

## 证据矩阵

| 项 | 证据 |
| --- | --- |
| 需求来源 | 用户要求“开 space 规划这个功能”。 |
| 上游事实 | sub2api b8169492 新增 wham/usage 查询和 wham/rate-limit-reset-credits/consume 消费动作。 |
| 当前 GetTokens 事实 | 已有 quota-refresh / quota-status / quota-empty route guard，但没有 reset credit query/consume 动作。 |
| 代码事实位置 | internal/cliproxyapi/client.go、internal/wailsapp/quota.go、docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/quota_refresh.go、docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/quota_runtime.go。 |
| 预期验收 | fake upstream 下 query/consume 请求头、payload、错误映射、quota-status 刷新与 UI 状态均可验证。 |
| 反证条件 | 如果 OpenAI upstream 已移除 reset credit 接口或需要浏览器私有挑战状态，GetTokens 只能保留“可用时显示”的降级入口，不做默认承诺。 |

## 用户场景

### 场景 A：查询 reset credit

Given 用户有一个可用的 OpenAI OAuth / Codex auth-file 账号
When 用户在账号详情 quota 区点击“查询重置次数”
Then GetTokens 显示可用 reset credit 次数、上游窗口摘要和查询时间
And 不修改 quota-status 或 route guard 状态。

### 场景 B：消费 reset credit

Given 查询结果显示 available_count 大于 0
When 用户确认“消耗一次重置”
Then sidecar 发送 consume 请求并返回 windows_reset / credit metadata
And GetTokens 触发一次现有 quota-refresh
And 账号详情展示最新 quota-status 和 reset 结果。

### 场景 C：无可用次数

Given 查询结果显示 available_count 等于 0
When 用户尝试重置
Then 前端禁用 consume 动作或 sidecar 返回 reset_credit_unavailable
And 不向上游发送 consume 请求。

### 场景 D：凭据失效

Given OpenAI OAuth token 已失效且 refresh 失败
When 用户查询或消费 reset credit
Then sidecar 返回 reauth_required / token_unavailable 类错误
And 前端提示需要重新登录，不把该错误伪装成 quota 空。

## 推荐方案

推荐做 sidecar-native reset credit action。

理由：

1. reset credit consume 有外部副作用，必须由 sidecar 统一处理 token、proxy、TLS、审计和错误映射。
2. GetTokens 已有 quota-status / quota-refresh / quota-empty route guard 链路，reset 成功后可以复用这些状态，而不是新增前端临时状态。
3. Wails 和前端只做用户确认、DTO 展示和刷新动作编排，便于后续审计与回滚。

不推荐方案：

- 只做前端按钮加 quota curl 模板。原因是 consume reset credit 需要 OAuth token、chatgpt-account-id、Codex Desktop header 和副作用确认，不适合由用户自填 curl 或前端直连。

## 前端账号详情要求

入口位置：账号详情页的 quota / billing 相关区域，作为现有“刷新额度 / 额度状态”旁边的高风险动作，不新开独立页面。

确认弹框视觉参考：screenshots/20260618/reset-confirmation/20260618-reset-confirmation-baseline-v01.png。该弹框为居中 modal，包含顶部视觉区、右上关闭按钮、标题、说明文案和一个主操作按钮。

显示信息：

1. reset credit 可用次数：availableCount。
2. 查询时间：fetchedAtUnix，以本地时间展示。
3. 上游账号识别：只显示脱敏 account id 或“已绑定 OpenAI 账号”，不得展示 token、cookie、完整账号 id。
4. 窗口摘要：如果 sidecar 返回 primary / secondary / additional windows，显示窗口名、是否已触达限制、resetAt / resetAfter 信息。
5. 最近一次重置结果：windowsReset、redeemedAt、credit status，以及后续 quota refresh 是否成功。
6. 降级/错误原因：reauth_required、upstream_rate_limited、reset_credit_unavailable、sidecar_not_ready 必须有可读文案。

按钮与交互：

1. “查询重置次数”：普通 secondary action；点击后调用 query，不写 quota-status。
2. “重置额度窗口”：danger / warning action；仅在 availableCount 大于 0 且账号支持 reset 时可点击。
3. 点击“重置额度窗口”必须弹出二次确认 modal 或确认对话框。
4. 二次确认文案必须明确：
   - 这会消耗 1 次 OpenAI reset credit。
   - 操作不可撤销。
   - 成功后 GetTokens 会刷新当前账号额度状态。
5. 二次确认中主按钮文案使用“确认消耗 1 次重置”，取消按钮使用“取消”。
6. consume 请求进行中禁用 query / consume，避免重复消耗。
7. 0 credits 时不显示可点击 danger 按钮；展示“无可用重置次数”。
8. 401/403 时引导重新登录；429 时提示上游限流稍后重试；这些错误不得被渲染成 quota-empty。
9. 用户点击确认后，不关闭该弹框；同一弹框内切换到处理中、成功或失败结果态。
10. 成功态必须显示 windowsReset、redeemedAt 或本地完成时间、剩余 reset credit 次数刷新结果、quota refresh 是否成功；主按钮改为“完成”或“查看最新额度”。
11. 失败态必须显示稳定错误标题、可读原因、下一步动作；例如重新登录、稍后重试、返回账号详情。失败态不能只靠 toast，也不能关闭弹框后把错误丢到页面背景。
12. 失败后允许“再试一次”仅在错误可重试时出现；401/403 这类 reauth required 不应提供盲目重试。

前端状态矩阵：

| 状态 | UI 行为 |
| --- | --- |
| sidecar-not-ready | 显示不可用提示，按钮禁用。 |
| unsupported-account | 不显示 reset 区，或显示“该账号不支持 OpenAI reset credit”。 |
| idle | 显示“查询重置次数”按钮，未知次数不显示危险动作。 |
| querying | query 按钮 loading，consume 禁用。 |
| available | 显示 availableCount 与“重置额度窗口”按钮。 |
| zero-credit | 显示 0 次与说明，consume 禁用。 |
| confirming | 显示二次确认，不发请求。 |
| consuming | 同一弹框内显示处理中，确认按钮 loading，关闭重复提交。 |
| consumed | 同一弹框内显示成功结果，并刷新 quota-status。 |
| failed-retryable | 同一弹框内显示失败原因，提供再试一次和关闭。 |
| failed-reauth | 同一弹框内提示需要重新登录，提供去重新登录或关闭。 |
| degraded | 同一弹框或详情区显示 sidecar 返回的 degradedReason，不本地猜测原因。 |

## 系统边界

- Account detail quota panel
- Wails root App DTO / method
- internal/wailsapp quota/reset client
- internal/cliproxyapi management client
- CLIProxyAPI gettokens sidecar management API
- OpenAI reset credit service
- chatgpt.com wham usage / consume
- existing quota-refresh / quota-status / route guard

## API 草案

### Sidecar management API

1. GET /v0/management/gettokens/openai-quota-reset/:account_key
   - 返回 reset credit 查询结果。
   - 不写 quota-status。

2. POST /v0/management/gettokens/openai-quota-reset/:account_key/consume
   - body 可选 redeem_request_id；缺省由 sidecar 生成。
   - 成功后返回 consume 结果，并建议或直接触发 quota refresh。

### Wails 方法草案

1. GetOpenAIQuotaResetCredit(accountKey string)
2. ConsumeOpenAIQuotaResetCredit(accountKey string)

Wails root App 必须暴露对应方法，并同步 root DTO、internal DTO、generated frontend bindings。

### DTO 草案

Query response：

- accountKey
- availableCount
- rateLimitWindows
- additionalRateLimits
- fetchedAtUnix
- upstreamAccountIDRedacted
- source
- degradedReason

Consume response：

- accountKey
- code
- windowsReset
- creditID
- resetType
- status
- redeemedAt
- quotaRefreshState
- degradedReason

## 实施计划

详细执行计划见 plans/implementation-plan-v01.md。

阶段切分必须保持独立可合并：

1. Phase 1：sidecar fake upstream query/consume 服务与 management API。
2. Phase 2：Wails / cliproxyapi client 透传与 root binding。
3. Phase 3：前端账号详情 quota 区 UI 与确认交互。
4. Phase 4：dev App / sidecar smoke 验收与文档收口。

## 验收标准

1. sidecar focused tests 覆盖 query/consume happy path、0 credits、401/403、429、非 OAuth 账号、missing account id、token refresh failure。
2. Wails client tests 覆盖 management endpoint path、DTO casing、错误透传。
3. 前端 tests 覆盖按钮可见性、0 credits 禁用、二次确认、consume success 后刷新 quota、错误提示。
4. 前端 tests 必须覆盖确认后同一弹框内显示成功/失败结果，而不是依赖 toast 或关闭弹框。
5. docs-linhay/scripts/check-docs.sh 通过。
6. sidecar 改动实现后必须运行 CLIProxyAPI focused tests、go test ./...、./scripts/ensure-sidecar.sh darwin arm64，并确认 meta 指向 clean fork commit。
7. 不触碰正式版 GetTokens；真实 OpenAI 账号验证只在用户明确授权后进行。

## 设计稿入口

- 本期设计稿：无。首版使用现有账号详情 quota 区，不新开独立页面。
- 约束：单期只保留一个 HTML 文件；若后续需要视觉稿，落在本 space 根目录。

## Worktree 映射

- branch：feat/20260618-openai-quota-reset-credit
- worktree：../GetTokens-worktrees/20260618-openai-quota-reset-credit/

## 相关链接

- sub2api reset intake：../20260606-relay-vendor-support/plans/20260618-sub2api-openai-quota-reset-intake.md
- reset 二次确认截图：screenshots/20260618/reset-confirmation/20260618-reset-confirmation-baseline-v01.png
- relay vendor support space：../20260606-relay-vendor-support/README.md
- sub2api 参考摘要：../../references/20260606-relay-vendor-reference-summary.md
- quota guard 设计：../../dev/20260531-account-routing-quota-guard.md
- sidecar route guard / rate-limit：../../dev/20260531-sidecar-route-guard-rate-limit.md

## 实现记录（2026-06-18）

本轮已完成第一版实现与自动化验收：

1. sidecar fork `docs-linhay/references/CLIProxyAPI` 新增 OpenAI quota reset management API：
   - `GET /v0/management/gettokens/openai-quota-reset/:account_key`
   - `POST /v0/management/gettokens/openai-quota-reset/:account_key/consume`
2. sidecar 实现边界：
   - 仅支持 `auth-file` / OpenAI OAuth 语义账号。
   - 从 account store `auth_json` 解析 `access_token`、`chatgpt-account-id` / `organization_id` fallback、plan type。
   - query 调用 `wham/usage` 并解析 `rate_limit_reset_credits.available_count`。
   - consume 前先查询可用次数；0 次时返回 `reset_credit_unavailable`，不调用 consume 上游。
   - consume 自动生成 uuid-v4-shaped `redeem_request_id`，成功后再次查询 usage，并把 quota state 作为返回值带给 Wails/frontend。
   - 401/403/429/5xx 按稳定错误状态映射，不写成 quota-empty。
3. 父仓新增 `cliproxyapi` / `internal/wailsapp` / root `main.App` 方法与 DTO：
   - `GetOpenAIQuotaResetCredit(accountKey string)`
   - `ConsumeOpenAIQuotaResetCredit(accountKey string)`
4. 前端账号详情页：
   - auth-file 账号详情现在包含 quota 模块。
   - quota 模块显示“查询重置次数”和“重置额度窗口”按钮，以及可用次数、查询时间、plan。
   - “重置额度窗口”必须先查询且 availableCount > 0 才可点击；未知次数或 0 次时只允许查询，不允许进入 consume 确认。
   - 点击重置后显示参考截图风格的二次确认 modal。
   - 用户确认后，同一 modal 内切换为处理中、成功或失败；成功态显示 `windowsReset`、credit status、`redeemedAt`、剩余次数和 quota refresh 状态；失败态在同一 modal 内显示错误并允许重试。
5. sidecar fork commit：`f2910e97 feat: add openai quota reset management api`。
6. dev sidecar 已重建：reset commit 初始 fingerprint 为 `f2910e9714b704ccb3b3f4cb3dc0dd517562cd61:clean:c411b48ac789834bd583cba4fcebccaa41db13fee7b0ef9a9da6c224d1c584d3:darwin:arm64`；当前本地 sidecar HEAD 还包含后续 translator commit，build meta 为 `803ab64c1407d35957e032910468d40499cbb484:clean:bae625d209e5004d93648d013cfe82d6ccadeb414bb2925cb46392ed0b4e670f:darwin:arm64`，该 commit 包含本 reset 功能。
7. 验收截图已补充：
   - `screenshots/20260618/reset-confirmation/20260618-reset-confirmation-confirm-after-v02.png`
   - `screenshots/20260618/reset-confirmation/20260618-reset-confirmation-success-after-v02.png`
   - `screenshots/20260618/reset-confirmation/20260618-reset-confirmation-error-failed-v02.png`

未做真实 OpenAI 账号消费验证；原因是 consume 会消耗用户真实 reset credit，本轮未获得真实账号授权。也未触碰正式版 `/Applications/GetTokens.app`。

## 当前状态

- 状态：implemented / automated acceptance passed / awaiting user real-account opt-in if needed
- 最近更新：2026-06-18
