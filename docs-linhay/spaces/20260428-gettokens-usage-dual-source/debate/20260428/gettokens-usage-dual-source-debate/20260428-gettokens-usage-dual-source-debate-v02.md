# GetTokens Usage Dual Source Debate

**日期**：20260428  
**模式**：合作型  
**主题**：双轨用量统计的前端页面规划与 HTML 设计稿裁定  
**参与者**：Codex（主持人） / Meitner（前端 IA） / Archimedes（领域 API） / Euler（风险审查）  
**总轮次**：1 / 60  
**结束原因**：第 1 轮收敛到页面规划结论

## 辩论背景
> 用户追加约束：不仅要有双轨用量统计的领域边界，还要注意前端页面规划，并在当前 space 内产出 `HTML` 设计稿。

## 第 1 轮观点

**[Meitner]** 论点：首版不应把 usage 扔到 `Status` 或 `Settings`，最稳的入口仍是 `Accounts`，但页面需要新增独立 usage 详情区，而不是继续扩张账号卡片。  
引用：[frontend/src/features/accounts/AccountsFeature.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/AccountsFeature.tsx:41)、[frontend/src/features/accounts/components/AccountCard.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/AccountCard.tsx:137)、[docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md:77)

**[Archimedes]** 论点：当前 `GetUsageStatistics -> accountUsageByID` 这条链把 usage 绑定成“账号卡片活跃度”，必须提升成后端类型化 usage 域；`provider/sourceKind` 应在 Go usage DTO 收口，不应继续由前端从松散 payload 现算。  
引用：[internal/wailsapp/usage.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/usage.go:8)、[frontend/src/features/accounts/hooks/useAccountsUsageState.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/hooks/useAccountsUsageState.ts:17)、[frontend/src/features/accounts/model/accountUsage.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountUsage.ts:189)

**[Euler]** 论点：`local usage` 不能直接塞回账号卡片；当前卡片里的 `usageSummary` 被解释成健康度和可用性，而本地 usage 既无法归因 `auth-file`，也存在 `accounts × details` 的前端扫描风险。  
引用：[frontend/src/features/accounts/model/accountPresentation.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountPresentation.ts:99)、[frontend/src/features/accounts/model/accountUsage.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountUsage.ts:339)、[docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md:84)

## 结论与裁定

1. v1 前端入口仍放在 `Accounts`，不新开到 `Status` 或 `Settings`。
2. 在 `Accounts` 内新增独立的 `Usage Desk` 子工作区或等价页面级分析区，承接 `ObservedRequestUsage / LocalProjectedUsage / QuotaSnapshot`。
3. 账号卡片继续只回答资产与稳定性问题：
   - 状态 / 失败原因
   - `recent health`
   - `quota remaining/reset`
4. `provider`、`sourceKind`、`time range` 是 `Usage Desk` 自己的过滤条，不并入当前 `AccountsToolbar` 的账号来源筛选。
5. `LocalProjectedUsage` 首版只做 `provider/global` 视图，不做 `auth-file` 归因，不写回账号卡片。
6. 设计稿采用 `HTML` 静态稿，落位到当前 space 根目录，作为后续前端实现的 IA 参考。

## 落地产物

- [usage-dashboard-design-v01.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/usage-dashboard-design-v01.html)
- [space README](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/README.md)

