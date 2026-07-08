# 20260609-account-card-401-status

## 背景

用户反馈：刷新 OAuth / auth-file 账号后，请求返回 `401`，但账号卡顶部状态仍显示“等待检测”。随后补充同类案例：上游返回 `402`，响应体为：

```json
{
  "detail": {
    "code": "deactivated_workspace"
  }
}
```

这类终态上游失败同样不应继续显示“等待检测”。

现有仓库证据表明：

1. Wails `GetCodexQuota` 在 auth-file usage 刷新遇到上游非 2xx 时，会把 quota runtime 写成 `status=stale`，并把上游错误提炼为 `degradedReason`。
2. 但现有后端 `quotaUpstreamErrorMessage()` 只解析 `message/code/error.*`，如果上游只返回 `detail.code`，`degradedReason` 会退化成只有状态码。
3. 账号卡顶部状态 `resolveAccountOperationalState()` 只把“usage 成功”或“auth-file quota success”视为可用，把“usage 有失败”视为异常；对于 `quota stale + degradedReason` 的终态上游失败没有稳定分支，最终会落回“可用”或“等待检测”。

## 目标

1. 修复账号卡顶部状态语义：auth-file quota 刷新返回真实报错时，不再显示“等待检测”。
2. 补齐后端错误提炼：`detail.code` 这类稳定字段必须进入 `degradedReason`。
3. 保持现有 quota runtime warning / stale banner 行为不回退。
4. 补齐前后端回归测试，防止后续再次把已知失败态展示成“等待检测”。

## 范围

1. `frontend/src/features/accounts/model/accountPresentation.ts` 的账号卡状态推导。
2. `internal/wailsapp/quota.go` 的上游错误提炼。
3. 对应前后端测试。
4. 本轮缺陷 space 与 memory 写回。

## 非目标

1. 不重做 accounts 页整体状态机。
2. 不改 Codex account list 的 requestability 语义；该列表的 `waiting-check` 属于另一条候选资格链路。
3. 不扩展到无关的 usage 统计或 route guard UI 改版。

## 证据矩阵

| 项目 | 内容 |
| --- | --- |
| 问题来源 | 用户反馈：“为什么刷新账号，请求 401，卡片还显示等待检测？” |
| 代码事实位置 1 | `internal/wailsapp/quota.go`：auth-file usage 上游非 2xx 时写 `status=stale` 和 `degradedReason` |
| 代码事实位置 2 | `internal/wailsapp/quota.go`：`quotaUpstreamErrorMessage()` 之前不解析 `detail.code` |
| 代码事实位置 3 | `internal/wailsapp/quota_test.go`：`TestGetCodexQuotaSurfacesAuthFileUsageUnauthorizedMessage` 已锁定 401 会写入 `token_invalidated` degraded reason |
| 代码事实位置 4 | `frontend/src/features/accounts/model/accountPresentation.ts`：`resolveAccountOperationalState()` 未稳定消费终态 quota stale 失败 |
| 当前现象 | 刷新 quota 后，卡片 quota 区可出现 stale/runtime warning，但卡片顶部状态标签仍显示“等待检测”或“可用” |
| 预期验收 | 对 OAuth / auth-file 账号，当 quota display 带有真实刷新失败证据（如 `401 token_invalidated`、`402 deactivated_workspace`、`management api-call failed`）时，卡片顶部状态显示“异常”而不是“等待检测”；只有“尚未观测到 runtime 状态”这类占位态继续显示“等待检测” |
| 反证条件 | 若后端已能把 `detail.code` 写入 `degradedReason`，且前端状态函数已经在终态 `quota stale + degradedReason` 时返回“异常”，则本次根因判断不成立，需要回头排查调用方是否传入了空 quotaDisplay |

## 验收标准

1. 新增后端红灯测试，覆盖上游仅返回 `detail.code` 时 `degradedReason` 仍保留稳定 code。
2. 新增前端红灯测试，覆盖 auth-file quota `stale + degradedReason` 时返回 `{ tone: 'danger', label: '异常' }`，至少包括 `401 token_invalidated`、`402 deactivated_workspace` 与通用刷新失败。
3. 新增前端回归测试，锁定“Quota runtime status has not been observed yet.” 仍走等待检测。
4. 实现后这些测试转绿，且原有“无 usage / 无 quota 证据时显示等待检测”的测试继续通过。
5. 运行聚焦 Go 测试、前端测试、`typecheck` 与 `docs-linhay/scripts/check-docs.sh`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260609-account-card-401-status`
- worktree：`../GetTokens-worktrees/20260609-account-card-401-status/`

## 相关链接

- [quota.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/quota.go:109)
- [quota_test.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/quota_test.go:30)
- [accountPresentation.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountPresentation.ts:184)

## 实现结果

1. `quotaUpstreamErrorMessage()` 现在会解析 `detail.message / detail.code / detail.type`，当 message 缺失但 code 存在时，`degradedReason` 仍保留稳定 code。
2. `resolveAccountOperationalState()` 新增 auth-file quota 刷新失败分支：
   - 当 quota display 为 `stale`
   - 且 `degradedReason` 属于真实报错，而不是“Quota runtime status has not been observed yet.” 这类占位文案
   - 账号卡顶部状态直接显示“异常”，不再走“可用”或“等待检测”。
3. 新增前后端回归测试，锁定 `detail.code` 提炼、终态 quota stale 场景、通用刷新失败和占位态豁免。

## 验证结果

1. `go test ./internal/wailsapp -run 'TestQuotaUpstreamFailureReasonIncludesDetailCodeWhenMessageMissing|TestGetCodexQuotaSurfacesAuthFileUsageUnauthorizedMessage' -count=1`
2. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs`
3. `npm --prefix frontend run typecheck`
4. `docs-linhay/scripts/check-docs.sh`

## 沉淀结果

1. 已更新 `.agents/skills/gettokens-domain-engineering/SKILL.md`：
   - OAuth/auth-file quota `stale + degradedReason` 属于真实刷新报错时，账号卡顶部状态必须显示异常；占位态仍显示等待检测。
   - Codex account-list requestability 仍是独立资格链路，不被本次账号卡展示规则替代。
2. 本规则是账号领域展示边界，不升级到 `AGENTS.md`。

## 当前状态
- 状态：implemented / verified
- 最近更新：2026-06-09

## 2026-07-08 追加：token_invalidated 重登与路由剔除

### 背景

用户提供 ChatGPT usage endpoint 响应：

```json
{
  "error": {
    "message": "Your authentication token has been invalidated. Please try signing in again.",
    "type": "invalid_request_error",
    "code": "token_invalidated",
    "param": null
  },
  "status": 401
}
```

该状态不是普通 quota stale，也不是 usage-limit。它表示 OAuth 凭证已经失效，用户需要重新登录；在恢复前，该账号也不能继续进入 sidecar 路由候选池。

### 证据矩阵

| 项目 | 内容 |
| --- | --- |
| 问题来源 | 用户要求：`/backend-api/wham/usage` 对 OAuth 账号返回 `401 token_invalidated` 时显示“重新登录”，并移除出路由账号直到恢复正常 |
| 代码事实位置 1 | `internal/wailsapp/quota.go` 已把 auth-file usage 非 2xx 转成 stale/degraded quota runtime 并携带 `token_invalidated` |
| 代码事实位置 2 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/quota_runtime.go` 的 `QuotaRuntimeStore.Upsert` 是 quota runtime -> route guard 的 sidecar 真源 |
| 代码事实位置 3 | `frontend/src/features/accounts/model/accountPresentation.ts` 的 `isCodexReauthEligible()` 决定账号卡底部是否展示可见重登 CTA |
| 当前现象 | ACTIVE auth-file 账号即使 quota runtime 已带 `token_invalidated`，底部重登 CTA 不一定出现；sidecar quota runtime stale denied reason 不会写 `auth-error` route guard |
| 预期验收 | `401 token_invalidated` 写入 account-scoped `auth-error` guard，候选池排除该 OAuth 账号；下一次 fresh success 清理该 guard；账号卡显示“重新登录”并按原文件名回填 OAuth |

### 实现结果

1. CLIProxyAPI sidecar `QuotaRuntimeStore.syncGuard()` 识别 denied/auth invalidated quota runtime，写入 account-scoped `auth-error` route guard；fresh success 会清理同账号 `auth-error`、`quota-empty`、`quota-threshold`。
2. 账号卡 `isCodexReauthEligible(account, quotaDisplay)` 读取 quota runtime `degradedReason`，当 ACTIVE OAuth/auth-file 账号出现 `token_invalidated / invalid_grant / authentication token has been invalidated` 时显示可见“重新登录”按钮。
3. OAuth 启动流程用当前账号的 quota runtime 证据判断是否回填 `existingName`，避免 token invalidated 场景走成新增登录。
4. `402 deactivated_workspace` 保持异常展示，不自动作为重登 CTA。

### 验证结果

1. `go test ./internal/gettokenshooks -run 'TestQuotaRuntimeStoreTokenInvalidatedFeedsAuthErrorGuardUntilRecovery|TestQuotaRuntimeStoreRecoveryClearsAuthScopedQuotaEmptyByAccountKey' -count=1`（CLIProxyAPI）
2. `go test ./internal/wailsapp -run 'TestGetCodexQuotaSurfacesAuthFileUsageUnauthorizedMessage|TestQuotaUpstreamFailureReasonIncludesDetailCodeWhenMessageMissing' -count=1`
3. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs`
4. `node --test frontend/src/features/accounts/tests/accountCardLayout.test.mjs`
5. `npm --prefix frontend run typecheck`
6. `docs-linhay/scripts/check-docs.sh`

### 沉淀结果

已更新 `.agents/skills/gettokens-domain-engineering/SKILL.md`，明确 ChatGPT usage `401 token_invalidated` 同时是展示失败和路由失败：sidecar 必须写 `auth-error` route guard，前端必须展示重登入口，fresh success 才恢复候选资格。

### 2026-07-08 补充修正：消费 route guard source

用户反馈仍显示“等待检测”。复核发现上一轮只让账号卡状态消费 `stale + degradedReason`，但 sidecar 也可能只返回 `blocked=true` 与 `sources[].source=auth-error`，尤其是 quota runtime 没有窗口或没有 degradedReason 的时候。这个状态已经代表账号不可路由，不应再落到等待检测。

补充修复：

1. `resolveAccountOperationalState()` 对 OAuth/auth-file 账号优先消费 quota runtime `auth-error` route guard source，显示“异常”。
2. `isCodexReauthEligible()` 同时读取 `blockReason` 和 `sources[].reason/source`，让无 `degradedReason` 但带 `auth-error token_invalidated` 的账号仍显示【重新登录】。
3. 新增前端回归测试覆盖 `blocked=true + sources=[auth-error]` 时不显示等待检测。

补充验证：

1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs`
2. `npm --prefix frontend run typecheck`

### 2026-07-08 补充扩展：OAuth token refresh invalid_refresh_token

用户继续提供 OpenAI OAuth token endpoint 响应：

```json
{
  "error": {
    "code": "invalid_refresh_token",
    "message": "Could not validate your refresh token. Please try signing in again.",
    "param": null,
    "type": "invalid_request_error"
  }
}
```

智者咨询结论：这不是单个 endpoint 的特例，应归入“终态 OAuth 凭证失效 / 需要重登”统一治理类。纳入边界是明确证明凭证不可自恢复的 code/message，例如 `token_invalidated`、`invalid_refresh_token`、`invalid_grant`、`refresh_token_reused`、`app_session_terminated`、`Could not validate your refresh token`、`please try signing in again`、`please log in again`。排除边界是 workspace/billing/quota/rate-limit、网络、5xx、泛化 `refresh_failed`。

本轮实现：

1. `internal/auth/codex/openai_auth.go` 将 `invalid_refresh_token` 与明确重登文案识别为 non-retryable refresh error，避免刷新失败继续重试 3 次。
2. `sdk/cliproxy/auth/conductor.go` 将同类错误识别为 unauthorized terminal OAuth credential error，写入 `LastError`、`Unavailable=true`，停止 auto-refresh 调度，使运行时候选不再继续选择该 auth。
3. `internal/gettokenshooks/quota_runtime.go` 将同类 quota/runtime evidence 映射为 account-scoped `auth-error` route guard，fresh success 后清理。
4. `frontend/src/features/accounts/model/accountPresentation.ts` 将同类 runtime evidence 纳入 `isCodexReauthEligible()`，账号卡显示【重新登录】。

本轮验证：

1. 红灯确认：新增 `invalid_refresh_token` 聚焦测试后，refresh 曾继续重试 3 次、quota runtime 未写 `auth-error`、manager 未写 unauthorized、前端不显示重登。
2. `go test ./internal/auth/codex ./internal/gettokenshooks ./sdk/cliproxy/auth -run 'TestRefreshTokensWithRetry_InvalidRefreshTokenOnlyAttemptsOnce|TestQuotaRuntimeStoreInvalidRefreshTokenFeedsAuthErrorGuardUntilRecovery|TestManager_RefreshAuthInvalidRefreshTokenStopsAutoRefreshRetry' -count=1`
3. `go test ./internal/auth/codex ./internal/gettokenshooks ./sdk/cliproxy/auth -count=1`
4. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs`
5. `npm --prefix frontend run typecheck`
