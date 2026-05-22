# 多格式自动检测转 CPA 上传实施计划 v01

日期：2026-05-23

## BDD 场景

### 场景 1：上传 ChatGPT Web session JSON

Given 用户选择一个包含 `accessToken`、`sessionToken`、`user.email`、`account.id`、`account.planType` 的 ChatGPT Web session JSON
When GetTokens 执行 auth-file 上传
Then 上传到 sidecar 前应自动转换为 `type: "codex"` 的 CPA auth JSON
And 保留 access token、session token、邮箱、账号 ID、套餐和过期时间
And 缺少 `id_token` 时应生成 CPA 可解析的 synthetic id token

### 场景 2：上传 9router Codex OAuth JSON

Given 用户选择一个包含 `accessToken`、`refreshToken`、`expiresAt`、`providerSpecificData.chatgptAccountId` 和 `providerSpecificData.chatgptPlanType` 的 9router JSON
When GetTokens 执行 auth-file 上传
Then 上传内容应转换为 CPA auth JSON
And refresh token、账号 ID、套餐、过期时间应映射到 CPA 字段

### 场景 3：上传已有 CPA / Codex auth JSON

Given 用户选择一个已有 `type: "codex"` 或 legacy Codex auth JSON
When GetTokens 执行 auth-file 上传
Then 继续沿用现有 `NormalizeAuthFileForSidecar` 规范化逻辑
And 不破坏已有 Codex auth-file 上传行为

### 场景 4：上传无法识别的 JSON

Given 用户选择一个合法 JSON 但不包含可识别 OAuth token
When GetTokens 执行 auth-file 上传
Then 不应误判为 CPA
And 维持现有上传/错误处理边界

## 技术方案

1. 在 `internal/accounts` 域层扩展 `NormalizeAuthFileForSidecar`。
2. 自动检测 ChatGPT Web session 与 9router Codex OAuth JSON，转换为 CPA/Codex auth JSON。
3. 继续让 `internal/wailsapp.UploadAuthFiles` 作为上传前统一入口，不在前端重复转换 token。
4. 保留现有 legacy Codex auth-file 规范化逻辑，新增字段只限 CPA 必需字段。

## 测试门禁

1. `go test ./internal/accounts`
2. `go test ./internal/wailsapp`
3. 必要时跑 `npm --prefix frontend run typecheck`，确认没有前端类型回归。

## 参考项目结论

`yynxxxxx/GPTSession2CPAandSub2API` 的 README 和 `docs/index.html` 表明：

1. 支持 ChatGPT Web session JSON。
2. 支持 9router Codex OAuth JSON。
3. CPA 输出使用 `type: "codex"`，并包含 `access_token`、`session_token`、`id_token`、`email`、`account_id`、套餐与过期时间。
4. 缺少真实 `id_token` 时会构造带 OpenAI auth claims 的 synthetic JWT。

本轮只实现 GetTokens 上传前转换到 CPA auth JSON，不实现 sub2api、Cockpit 或 9router 输出。
