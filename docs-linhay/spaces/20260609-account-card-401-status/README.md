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

### 2026-07-08 补充修正：auth-error 必须覆盖 registered_routeable

用户在 dev 账号页继续标注：同一张卡同时显示“可用”和【重新登录】。复核真实页面数据发现目标账号 quota runtime 已经是 `blocked=true`、`sources[].source=auth-error`，原因是 `401 token_expired / Provided authentication token is expired. Please try signing in again.`，但账号卡顶部仍可能显示“可用”。

根因：

1. `resolveAccountOperationalState()` 先判断 `runtimeStatus === "registered_routeable"` 并直接返回“可用”。
2. OAuth/auth-file quota `stale + degradedReason` 或 `blocked + auth-error` 的判断在其后，导致已失效账号只要仍保留 runtime 注册态，就会被错误显示为“可用”。
3. `isCodexReauthEligible()` 走另一条 quota reason/status 判断，所以底部【重新登录】已经出现，形成“可用 + 重新登录”的矛盾展示。

补充修复：

1. 将 auth-file quota refresh failure / route guard `auth-error` 判断提前到 `registered_routeable` 之前。
2. 将 `token_expired / authentication token is expired` 纳入重登证据。
3. 新增前端回归测试覆盖 `runtimeStatus=registered_routeable + blocked auth-error + token_expired` 时必须显示“异常”。

补充验证：

1. `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs`
2. `npm --prefix frontend run typecheck`
3. 当前 dev URL DOM 验收：目标卡 `acct_6822596a-519d-46fb-a048-637a62e511af` 显示“异常 ... unauthorized ... 重新登录”，不再包含“可用”。

### 2026-07-08 补充修正：异常文案必须同步驱动卡片 tint

用户继续标注：重启后异常卡片顶部文案已显示“异常”，底部也显示【重新登录】，但卡片左侧 tint / 背景仍是绿色。

根因：

1. `resolveAccountOperationalState()` 已经返回 `tone=danger` 和“异常”。
2. `AccountCard.tsx` 颜色派生却在 `operationalState.tone` 不是 positive/warning 时回退到 `resolveAccountStatusTone(account)`。
3. 对仍保留 `runtimeStatus=registered_routeable` 的 auth-file 账号，回退结果是 positive，导致“异常文字 + 绿色卡片”的矛盾 UI。

补充修复：

1. `AccountCard.tsx` 直接将 `operationalState.tone=danger` 映射为 `critical` tint，不再用账号 runtime 注册态覆盖异常展示。
2. 新增 `accountCardLayout.test.mjs` 静态回归测试，锁定卡片 tint 跟随 operational danger，而不是 routeable fallback。

### 2026-07-08 补充修正：同 OpenAI account_id 的 auth-error 需要组内传播

用户重启 dev app 后继续标注：K12 组只有 2 个账号显示异常，但同组多张卡实际使用同一个 OpenAI / ChatGPT `account_id`，应该一起不可用。

复核真实 dev 数据：

1. K12 组共 875 张 auth-file 账号。
2. 其中 675 张共享同一个 `auth_json.account_id = 7bf3a2ce-3298-40b0-ac9b-3c922a5a91a6`。
3. 已持久化的 `token_invalidated` `auth-error` 只绑定在 Abeb/Accola 两个 `acct_*` key 上，导致 sibling 账号重启后仍显示可用。

根因：

1. route guard lookup 只索引 `authID / acct_* / auth-file` 等单资产 key。
2. `quota-status` 查询 sibling `acct_*` 时不会命中同一 OpenAI `account_id` 上已经确认的终态失败。
3. 这些 sibling 账号当前 access token 尚未到自动刷新时间，不能依赖 auto-refresh 再逐个写入失败。

补充修复：

1. CLIProxyAPI sidecar 新增 account-store identity resolver，从 auth-file `auth_json.account_id / chatgpt_account_id` 派生 `openai-account-id:<id>` 与 `provider-account-id:openai:<id>` lookup key。
2. `normalizeAccountRouteGuardBlock()` 写入或水合 block 时按 `acct_*` 反查 provider identity，把历史已持久化的单卡 `auth-error` 索引到共享 OpenAI account identity。
3. `accountRouteGuardKeysForAuth()` / management `quota-status` 查询账号时也按同一 identity 扩展 lookup key，使 sibling 账号进入同一 route guard。
4. `QuotaRuntimeStore.withGuardState()` 对重复 `source/reason/expiresAt` 做展示去重，避免多个历史 block 让卡片 reason 重复。

补充验证：

1. `go test ./internal/gettokenshooks -run 'TestHydratedAuthErrorBlocksSiblingAccountWithSharedOpenAIAccountID|TestAccountRouteGuardResultHookBlocksTerminalOAuthRefreshFailureOnAuthUpdated|TestSetChannelRoutingPolicyConfigPathHydratesPersistedRuntimeStatesForQuotaStatus' -count=1`
2. `go test ./internal/gettokenshooks -count=1`
3. `go test ./sdk/cliproxy/auth -count=1`
4. `./scripts/ensure-sidecar.sh darwin arm64`
5. 重启 `./scripts/wails-cli.sh dev` 后，dev sidecar `BuiltAt: 2026-07-08T07:54:52Z`；真实 API 验收：K12 `total=875`、`blocked=675`、`authError=675`、共享 OpenAI `account_id` 分组 `675/675` blocked，截图里的 `AcocellaStfort067 / AdsideBurak7077 / AgleBooher238 / AhlbergLinderholm146` 均返回 `blocked=true`、`sources[0].source=auth-error`。

补充验证：

1. `node --test frontend/src/features/accounts/tests/accountCardLayout.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs`
2. `npm --prefix frontend run typecheck`
3. 当前 dev URL DOM 验收：`jchrb770@...` 与 `AbebSuell275@outlook.com` 异常卡均为 `account-card-status-tint-critical`，不再包含 `account-card-status-tint-positive`。

### 2026-07-08 补充修正：可请求筛选必须排除 operational auth-error

用户继续标注：工具栏激活【可请求】筛选时，列表仍显示“异常”红色卡片与【重新登录】入口。

智者咨询结论：

1. 第一刀做语义修复，不做大 UI 文案/布局重设计。
2. 【可请求】应表示账号 active/registered 且没有 auth-error 这类操作性阻塞。
3. 【异常】应包含需要重登或修配置的账号。
4. 【已禁用】仍然表示用户或系统显式关闭，继续和异常分离。

根因：

1. `filterAccounts()` 的状态筛选只看 `AccountRecord.status / disabled / rawAuthFile.unavailable`。
2. `isAccountRequestable()` 走 `!isAccountUnavailable(account)`，没有消费 quota runtime `blocked=true`、`stale + degradedReason` 或 `sources[].source=auth-error`。
3. 账号卡 operational state 已经把这些证据显示为“异常”，但筛选 status bucket 仍把它们归为 requestable。

补充修复：

1. 将 `hasAccountOperationalFailure(account, quotaDisplay)` 抽为账号展示/筛选共享的纯判断。
2. `matchesStatusSelection()`、状态分组和状态排序都消费 `CodexQuotaState`，让 `auth-error` 账号进入【异常】，并从【可请求】/ available preset 中排除。
3. 保持【已禁用】独立，不把 disabled 与 operational error 合并。

补充验证：

1. 新增红灯测试确认 `registered_routeable + blocked auth-error` 曾被【可请求】选中，并归到 `status:requestable`。
2. `node --test frontend/src/features/accounts/tests/accountSelectors.test.mjs`
3. 当前 dev URL DOM 验收：`可请求` 筛选下不再出现 `AbebSuell275@outlook.com` 异常卡；`异常` 筛选下出现该卡和其他重登卡。

### 2026-07-08 补充修正：重启后 persisted auth-error 必须水合回 management quota-status

用户继续反馈：异常账号在重启 app 后又被重置为“可用”。复核 dev sidecar 证据：

1. `~/.config/gettokens-dev/channel-routing/config.json.runtimeStates` 中仍存在 `AbebSuell275@outlook.com` 和 `AccolaPallazzo3379@outlook.com` 的 `auth-error token_invalidated`。
2. 重启后 `/v0/management/gettokens/quota-status?account_keys=acct_b094...,acct_8df...` 返回 `blocked=false`、`sources=[]`。
3. 实际请求路由的 `account-route-guard` 会懒加载 persisted runtimeStates，但账号页 management quota-status 只看内存 `AccountRouteGuardStore`，所以卡片展示和请求路由分裂。

补充修复：

1. CLIProxyAPI sidecar 新增 `hydrateAccountRouteGuardStoreFromPersistedRuntimeStates()`，把 `channel-routing/config.json.runtimeStates` 中仍有效的 route-blocking sources 水合回 `AccountRouteGuardStore` 内存索引。
2. `SetChannelRoutingPolicyConfigPathFromConfig()` 设置 profile-local channel routing 配置路径后立即执行水合。
3. 水合不调用 `MarkBlocked()`，不会在启动时重写配置文件；真实恢复仍由 fresh success 触发既有 `ClearAuth()` 清理。

补充验证：

1. 新增回归测试：`TestSetChannelRoutingPolicyConfigPathHydratesPersistedRuntimeStatesForQuotaStatus`，断言 persisted `auth-error` 在配置路径加载后通过 `QuotaRuntimeStore.StatesForAccounts()` 返回 `blocked=true` 与 `sources=[auth-error]`。
2. `go test ./internal/gettokenshooks -run 'TestSetChannelRoutingPolicyConfigPathHydratesPersistedRuntimeStatesForQuotaStatus|TestAccountRouteGuardPolicyDeniesCandidatesFromPersistedRuntimeStates|TestAccountRouteGuardStorePersistsRuntimeStateToChannelRoutingConfig' -count=1`
3. `go test ./internal/gettokenshooks -count=1`
4. `./scripts/ensure-sidecar.sh darwin arm64` 已重建本仓 dev sidecar 二进制；当前运行中的 dev sidecar 进程仍需重启 app 后加载新二进制。

### 2026-07-08 补充修正：auto-refresh 终态 OAuth 失败必须写入 route guard

用户重启 dev app 后继续反馈：K12 组只有 2 个账号被标记为异常，但预期这组都应异常。复核证据：

1. K12 组共有 875 个 `auth_file.plan_type=k12` 账号。
2. `channel-routing/config.json.runtimeStates` 中只有 2 个 K12 `acct_*` 有 `auth-error`。
3. `/v0/management/gettokens/quota-status?account_keys=<875 K12 keys>` 只返回 2 个 `blocked=true`。
4. sidecar 启动日志中存在批量 `invalid_refresh_token`、`refresh_token_reused`、`refresh_token_invalidated` auto-refresh 失败，但这些失败没有进入 `runtimeStates`。

根因：

1. `Manager.refreshAuth()` 在 refresh 失败时只更新 auth manager 内存状态，没有触发 `OnAuthUpdated` hook。
2. `AccountRouteGuardResultHook.OnAuthUpdated()` 只同步 quota-empty，没有把 `auth.LastError=unauthorized` 的终态 OAuth refresh failure 转成 route guard `auth-error`。
3. 因此账号页只能看到历史已持久化的 2 个异常，重启后启动期新发现的 K12 refresh 失败不会驱动卡片状态。

补充修复：

1. `sdk/cliproxy/auth.Manager.refreshAuth()` 在 refresh 失败更新 `LastError / Unavailable / StatusError` 后，发出 `OnAuthUpdated` hook。
2. `AccountRouteGuardResultHook.OnAuthUpdated()` 对 `LastError` 为 `401 / unauthorized` 的 auth state 写入 account-scoped `auth-error` route guard，并保留原有 quota-empty 同步。
3. 新增回归测试覆盖 `invalid_refresh_token` refresh failure 必须通知 hook，以及 hook 必须让 `QuotaRuntimeStore.StatesForAccounts()` 返回 `blocked=true sources=[auth-error]`。

补充验证：

1. 红灯确认：新增测试前，refresh failure 不通知 hook，hook 也不会写 guard。
2. `go test ./sdk/cliproxy/auth -run 'TestManager_RefreshAuthInvalidRefreshTokenNotifiesAuthUpdatedHook|TestManager_RefreshAuthInvalidRefreshTokenStopsAutoRefreshRetry' -count=1`
3. `go test ./internal/gettokenshooks -run 'TestAccountRouteGuardResultHookBlocksTerminalOAuthRefreshFailureOnAuthUpdated|TestSetChannelRoutingPolicyConfigPathHydratesPersistedRuntimeStatesForQuotaStatus' -count=1`
4. `go test ./sdk/cliproxy/auth -count=1`
5. `go test ./internal/gettokenshooks -count=1`
6. `./scripts/ensure-sidecar.sh darwin arm64` 已重建 dev sidecar；当前正在运行的 dev sidecar 进程仍需重启后加载本轮新逻辑。
