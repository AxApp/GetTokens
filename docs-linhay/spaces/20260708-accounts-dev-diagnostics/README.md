# 20260708-accounts-dev-diagnostics

## 背景
- 用户在 `./scripts/wails-cli.sh dev` 下打开 `http://127.0.0.1:34115/#frame=accounts`，反馈“app 内的卡片和 web 的卡片显示不一致”。
- 只读证据显示本机同时运行 dev 与正式版 GetTokens：dev sidecar 使用 `/Users/linhey/.config/gettokens-dev/config.yaml`、端口 `18317`；正式版 sidecar 使用 `/Users/linhey/.config/gettokens/config.yaml`、端口 `8317`。
- `127.0.0.1:34115` 是 dev app 监听端口，页面存在 Wails 绑定，账号页读取 `ListAccounts()` 与 `GetQuotaStatuses()`，不是纯 preview fixture。
- 同一账号池规模为 883 个账号；大账号池自动 runtime sync 已按可见账号目标收窄，不同窗口的筛选、展开组、滚动位置和 localStorage cache 可能让卡片显示阶段性不同。

## 目标
- 在 DEV 账号页提供一个只读诊断面板，直接展示当前窗口的数据源、Wails 绑定、sidecar/profile、账号数、localStorage cache 摘要、自动 runtime sync 目标账号，以及指定账号的 React runtime 状态与 quota-cache 状态对比。
- 用可执行证据区分三类问题：
  - profile/sidecar 不同导致的数据不一致；
  - 不同窗口本地 UI 状态、缓存、可见同步目标不同导致的显示差异；
  - 同一账号在同一 sidecar 下 backend truth 与前端显示确实不一致。

## 范围
- `frontend/src/features/accounts/model/accountDiagnostics.ts`：构建诊断快照与 localStorage cache 摘要。
- `frontend/src/features/accounts/components/AccountsDiagnosticsPanel.tsx`：DEV only 诊断 UI。
- `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 与 `AccountsFeature.tsx`：暴露最近 runtime sync 时间和自动 sync 目标，并在 DEV 账号页挂载诊断面板。
- 聚焦诊断与证明，不改账号卡片业务展示、不合并 WebView/Chrome localStorage、不改变 sidecar 路由或 quota 语义。

## 非目标
- 不统一 App WebView 与外部 Chrome 的 localStorage。
- 不把窗口筛选、滚动、展开组等 UI view-state 升级为 sidecar truth。
- 不修改正式版 `/Applications/GetTokens.app`、正式版 sidecar 或正式版配置。
- 不在本轮引入新的账号卡片状态机改造。

## 验收标准
- DEV 构建下账号页出现 `Accounts Dev Diagnostics` 只读面板；生产构建不显示。
- 面板显示：
  - `origin`、`wails bindings`、`sidecar`；
  - `accounts` 总数与过滤后数量；
  - React runtime quota 数量、quota cache 数量、account list cache 数量与更新时间；
  - 当前自动 runtime sync 的 visible account ids；
  - 用户输入账号 id 后，显示该账号的 React runtime 与 localStorage quota-cache 对比。
- 当前 `http://127.0.0.1:34115/#frame=accounts` DOM 验收通过：存在 Wails 绑定，面板存在，账号数 883，quota cache 882，visible runtime sync ids 可见。
- 自动化验证通过：
  - `node --test frontend/src/features/accounts/tests/accountDiagnostics.test.mjs frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs`
  - `npm --prefix frontend run typecheck`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：当前主工作区短改动
- worktree：未创建；本轮为当天可完成的 dev 诊断小切片

## 相关链接
- Wise Council 外部顾问：`agy` 建议按“backend truth / window view-state / cache”分层治理，第一刀做 DEV 诊断面板，不做缓存统一。

## 当前状态
- 状态：implemented
- 最近更新：2026-07-08
