# Quota Token 进度展示会话沉淀

## 背景

本轮需求要求账号卡 `QuotaBars` 支持点击切换显示 token 进度。实现过程暴露出一个可复用边界：这不是单纯的前端展示切换，而是 quota window 计数字段需要从解析、Wails/root DTO、generated bindings 到前端 display model 全链路保留。

## 沉淀模式

1. `remainingPercent` 仍是默认展示和最长窗口筛选的主语义。
2. `usedTokens / limitTokens / remainingTokens` 是附加遥测字段，只在上游或自定义 quota 响应真实提供 token 计数时展示。
3. `QuotaBars` 可提供点击切换百分比与 token 进度，但点击目标必须是独立交互元素，并阻止账号卡整卡详情点击冒泡。
4. 百分比-only 的 ChatGPT quota window 不反推 token 总量，避免制造伪精度。
5. 回归测试需要覆盖四层：解析保留、DTO 映射、前端 normalization、账号卡交互结构。

## 执行入口

- 项目级 skill：`.agents/skills/gettokens-domain-engineering/SKILL.md` 的 `Quota Rules / Token Progress Display Boundary`
- 关键实现路径：
  - `internal/accounts/quota_types.go`
  - `internal/accounts/quota_builder.go`
  - `internal/accounts/quota_curl.go`
  - `internal/wailsapp/quota.go`
  - `app_types.go`
  - `app_mappers.go`
  - `frontend/wailsjs/go/models.ts`
  - `frontend/src/features/accounts/model/accountQuota.ts`
  - `frontend/src/features/accounts/components/CardSections.tsx`

## 不纳入

- 不把所有 quota window 都改成 token-first 展示。
- 不为百分比-only payload 估算 token limit。
- 不升级 `AGENTS.md`。本模式属于账号 quota 领域规则，不是 repo-wide 长期治理规则。

## 验证

- `go test . ./internal/accounts ./internal/wailsapp`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run typecheck`
- `git diff --check`
