# 2026-06-18 sub2api OpenAI quota reset intake

## 背景

用户要求更新 sub2api 参考代码，并把其新增的“重置相关功能”捞出来供 GetTokens 评估。

本轮已将本地参考项目 docs-linhay/references/sub2api/ 从 635ad81c 快进到 4a5665da（origin/main，v0.1.137）。相关上游提交主要是：

- b8169492 feat(openai-quota): query + reset rate-limit credits for OpenAI accounts
- de38d623 Merge pull request #3250 from WesleyZiwen/codex/anthropic-429-window-reset
- 16bc8769 fix(usage): sync 5h ResetsAt to SessionWindowEnd and zero expired window

## 证据矩阵

| 项 | 证据 |
| --- | --- |
| 问题来源 | 用户明确要求“更新 sub2api 代码，它新增了重置相关的功能，捞出来”。 |
| 上游事实位置 | docs-linhay/references/sub2api/backend/internal/service/openai_quota_service.go、backend/internal/handler/admin/openai_oauth_handler.go、frontend/src/components/account/OpenAIQuotaResetCell.vue。 |
| 当前 GetTokens 事实位置 | GetTokens 已有 quota-refresh / quota-status / route guard / quota fact 链路，但未发现“消费 OpenAI rate-limit reset credit”的等价 sidecar/Wails 动作。 |
| 可观察缺口 | GetTokens 可刷新/展示 quota 状态，但没有暴露 ChatGPT /wham/rate-limit-reset-credits/consume 这类一次性 reset credit 消费动作。 |
| 验收方式 | 若后续实现，应先用 fake upstream 覆盖 query/reset payload、header、错误映射和 no-token 分支，再接 sidecar management API、Wails DTO、前端动作。 |
| 非目标 | 本轮只完成参考源码更新和功能提取；不调用真实 chatgpt.com，不修改正式版 App，不把 sub2api 的整套 admin/backend 架构搬进 GetTokens。 |

## sub2api 新增能力摘要

### 1. Query usage / reset credits

上游新增 OpenAIQuotaService.QueryUsage(ctx, accountID)：

- 请求：GET https://chatgpt.com/backend-api/wham/usage
- 凭据：复用 OpenAI OAuth access token；缺失或过期时走既有 token provider 刷新。
- 关键账号字段：chatgpt_account_id，缺失时 fallback 到 organization_id。
- 返回核心字段：
  - rate_limit.primary_window
  - rate_limit.secondary_window
  - additional_rate_limits[]
  - rate_limit_reset_credits.available_count
  - fetched_at

### 2. Consume reset credit

上游新增 OpenAIQuotaService.ResetCredit(ctx, accountID)：

- 请求：POST https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume
- body：{redeem_request_id: uuid-v4-like}
- 返回核心字段：
  - code
  - credit.id
  - credit.reset_type
  - credit.status
  - credit.redeemed_at
  - windows_reset

### 3. Codex Desktop header set

两个请求共用 header 语义：

- authorization: Bearer access_token
- chatgpt-account-id: chatgpt_account_id
- originator: Codex Desktop
- oai-language: zh-CN
- accept: application/json
- sec-fetch-site: none
- sec-fetch-mode: no-cors
- sec-fetch-dest: empty
- priority: u=4, i
- reset POST 额外加 content-type: application/json

### 4. 代理与 TLS 指纹

sub2api 的实现使用其 PrivacyClientFactory，并读取账号绑定代理。对 GetTokens 而言，等价约束是：

- 请求必须在 sidecar 运行态边界内执行，不能由前端直接访问 chatgpt.com。
- 若账号绑定代理或系统代理策略存在，必须复用 GetTokens sidecar 当前账号请求路径的代理解析规则。
- 需要明确是否复用现有 Codex executor HTTP client/TLS 指纹策略；不能新增一个绕过 route guard / proxy / token refresh 的临时 client。

## GetTokens 移植建议

### 推荐最小切片

1. sidecar 新增 OpenAI reset credit service：
   - QueryOpenAIQuotaResetCredits(accountKey)
   - ConsumeOpenAIQuotaResetCredit(accountKey, redeemRequestID?)
2. sidecar management API：
   - GET /v0/management/gettokens/openai-quota-reset/:account_key
   - POST /v0/management/gettokens/openai-quota-reset/:account_key/consume
3. Wails client 只做透传和 DTO 映射。
4. 前端账号详情或 quota panel 增加两个动作：
   - “查询重置次数”
   - “消耗一次重置”
5. reset 成功后触发一次现有 quota refresh，更新 quota-status 与 route guard 视图。

### 必须先补的红灯测试

1. Given OAuth 账号缺 chatgpt_account_id 但有 organization_id，When query reset credits，Then 使用 fallback account id。
2. Given OAuth token 过期，When query/reset，Then 通过现有 token refresh 取得新 access token。
3. Given reset credits 为 0，When 前端请求 consume，Then sidecar 返回稳定错误，不发起上游 consume。
4. Given fake upstream 返回 401/403，Then 返回可解释的 re-auth required 状态。
5. Given fake upstream 返回 429，Then 返回 upstream rate limited，不写入 quota-empty 长阻断。
6. Given consume 成功，Then 返回 windows_reset 并触发或提示后续 quota refresh。
7. Given 非 OAuth / 非 OpenAI Codex 账号，Then 拒绝 reset 动作。

## 当前决策

本轮只把 sub2api 参考源码更新并提取 reset 功能边界，不直接进入 GetTokens 实现。原因：

1. 该能力会真实消耗用户 OpenAI reset credit，属于有副作用动作，不能在没有专门确认和测试门禁时顺手接入。
2. 当前 GetTokens 主仓已有大量未提交并行改动；直接改 sidecar/Wails/frontend 容易混入无关变更。
3. 正确落点应是 sidecar management API，而不是前端或 Wails 临时补偿。

后续如果确认要落地，应按上述最小切片单独开实现轮，先写 fake upstream 红灯测试，再移植 sidecar service。
