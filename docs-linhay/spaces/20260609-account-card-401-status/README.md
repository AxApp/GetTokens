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
