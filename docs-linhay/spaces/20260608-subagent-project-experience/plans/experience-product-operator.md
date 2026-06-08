# 第 1 轮：体验 + 代码逻辑审核报告

## 报告定位

- 本报告属于 **第 1 轮：体验 + 代码逻辑审核**。
- 视角：产品/运营工作台体验者，同时审核已读源码、测试和文档中的状态流、数据契约、错误处理、测试缺口与维护性风险。

## 体验范围

- 角色：产品/运营工作台体验者，关注日常账号池巡检、用量判断、运行会话定位、菜单/状态栏入口、常见重复工作流和信息架构可理解性；代码逻辑审核关注这些体验背后的真实状态流和契约边界。
- 环境：仅使用仓库 dev / 浏览器预览与 `/Users/linhey/.config/gettokens-dev/` 数据目录；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改正式数据目录。
- 依据：
  - 本轮 space：`docs-linhay/spaces/20260608-subagent-project-experience/README.md`
  - dev 数据准备：`docs-linhay/spaces/20260608-subagent-project-experience/plans/dev-data-prep.md`
  - 账号入口：`frontend/src/features/accounts/AccountsFeature.tsx`
  - 账号状态流：`frontend/src/features/accounts/hooks/useAccountsPageState.ts`
  - 用量入口：`frontend/src/features/accounts/UsageDeskFeature.tsx`
  - live sessions 入口：`frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx`
  - live sessions 工作台：`frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx`
  - 侧边栏：`frontend/src/components/biz/Sidebar.tsx`
  - 菜单栏状态：`internal/wailsapp/app_runtime_menubar.go`、`internal/wailsapp/app_runtime_menubar_snapshot.go`
  - 账号动作/用量状态：`frontend/src/features/accounts/hooks/useAccountsActions.ts`、`frontend/src/features/accounts/hooks/useAccountsUsageState.ts`
  - 已读测试：`frontend/src/features/accounts/tests/accountUsage.test.mjs`、`frontend/src/features/accounts/tests/accountDisabledSync.test.mjs`、`frontend/src/features/codex-live-sessions/model.test.mjs`、`frontend/src/tests/menuBarNavigation.test.mjs`

## 方法

1. 读取 `AGENTS.md`、本轮 space README 与 dev 数据准备文档，确认 dev-only 与写入边界。
2. 用 `rg` / `rg --files` 定位账号池、Usage Desk、Codex Live Sessions、Wails binding、菜单栏状态相关实现。
3. 只读检查 dev SQLite：
   - `accounts-v1.sqlite`：未删除主卡约 11 个，其中 auth-file 4 启用/3 禁用，codex-api-key 2 启用/1 禁用，openai-compatible 1 禁用。
   - `usage-attribution-v1.sqlite`：约 42060 条 attribution event，时间范围 2026-05-29 到 2026-06-07，包含 codex/deepseek/xiaomi mimo provider。
   - `live-sessions-v1.sqlite`：约 41352 条 request、330 个 session，历史状态中存在大量 `streaming` / `active`。
4. 启动 `frontend` Vite dev server，以浏览器预览打开 `#frame=accounts`、`#frame=codex&workspace=usage-codex`、`#frame=codex&workspace=live-sessions` 做首屏和工作流观察；控制台仅见 `favicon.ico` 404。
5. 阅读账号动作 hook、账号用量 hook、live sessions model 测试与菜单栏导航测试，补充代码逻辑审核建议。

## 建议清单

### 1. [业务体验] 账号池空结果需要解释“真实为空”还是“筛选为空”

- 问题：账号池 header 显示账号总量，但列表区域只显示 `accounts.empty`。状态来源在 `useAccountsPageState` 中分开保存 `accounts`、`filteredAccounts`、`searchTerm`、`filters`，空态渲染却只看 `filteredAccounts.length === 0`，见 `frontend/src/features/accounts/AccountsFeature.tsx:1190`、`frontend/src/features/accounts/AccountsFeature.tsx:1296`。
- 影响：运营用户会误以为账号库为空，尤其本轮 dev 数据实际有账号记录。长期使用后，持久化筛选会让“账号消失”的误判反复出现。
- 建议改法：把空态拆成两类：`accounts.length === 0` 显示“暂无账号”；`accounts.length > 0 && filteredAccounts.length === 0` 显示当前搜索词、已启用筛选摘要、`清空搜索`、`重置筛选` 两个操作。
- 验收方式：构造有账号但搜索不匹配的状态，断言页面显示筛选空态、账号总数和重置操作；浏览器打开 `#frame=accounts`，输入不存在关键字后能一键恢复列表。

### 2. [业务体验 + 代码逻辑] 账号池刷新入口没有区分“刷新列表”和“刷新额度/用量/限流”

- 问题：账号页 `强制刷新` 触发 `loadAccounts({ showSupplementalRefreshing: true })`，同时拉账号、quota、usage、rate-limit；分组刷新也同时 `refreshAccountUsage` 和 `refreshAccountRateLimits`，见 `frontend/src/features/accounts/AccountsFeature.tsx:1187`、`frontend/src/features/accounts/AccountsFeature.tsx:554`。
- 影响：运营用户只想确认账号是否新增/禁用时，会触发较重的补充数据刷新；反过来只想更新额度时，也不清楚是否真的刷新了额度。
- 建议改法：在账号页 header 或 toolbar 提供两个明确命令：`刷新账号列表` 与 `刷新运行指标`。后者再细分为额度、用量、限流的批量刷新状态，刷新中显示每类完成/失败计数。
- 验收方式：组件测试断言两个按钮分别调用 `loadAccounts({ refreshSupplementalData:false })` 和 supplemental refresh；浏览器预览验证按钮文案、loading 状态和失败提示不混淆。

### 3. [业务体验] 账号筛选偏能力字段，缺少运营巡检视图

- 问题：账号状态流已具备 `filters`、`groupMode`、`sortMode` 和 plan 类型持久化，见 `frontend/src/features/accounts/hooks/useAccountsPageState.ts:141` 到 `frontend/src/features/accounts/hooks/useAccountsPageState.ts:217`，但当前入口仍偏通用筛选。
- 影响：运营日常最常问的是“哪些账号可用、哪些额度危险、哪些被禁用、哪些近期失败”，需要多次组合筛选才能得到答案。
- 建议改法：增加 3 个可一键切换的巡检视图：`可用池`、`风险账号`、`需处理`。它们是筛选组合的命名预设，不改变底层 AND-style filter 规则。
- 验收方式：为 `accountFilters` 增加预设映射单测；浏览器验收切换预设后，toolbar 显示预设名和可清除状态，刷新/选择/详情操作保持可用。

### 4. [业务体验] 批量选择工具条只在进入选择模式后出现，发现成本偏高

- 问题：批量操作被包在 `isSelectionMode` 条件中，sticky 工具条在 `frontend/src/features/accounts/AccountsFeature.tsx:1222` 到 `frontend/src/features/accounts/AccountsFeature.tsx:1240` 渲染。
- 影响：运营用户面对几十个账号时，常见动作是批量禁用、批量刷新、批量导出；如果必须先理解“选择模式”，效率偏低。
- 建议改法：在账号 toolbar 常驻显示“批量”入口，点击后展开 sticky selection toolbar；同时在分组标题处提供 `选择本组`，减少从单卡逐个选择。
- 验收方式：组件测试覆盖批量入口默认可见、进入选择模式后 sticky toolbar 出现；浏览器验收选中本组后已选数量、导出/禁用/启用按钮状态正确。

### 5. [业务体验] 账号操作入口过于集中在菜单，新增/导入/登录路径缺少主次优先级

- 问题：账号 header 的导入、API key 新增、统一新增、Codex OAuth 都经 `AccountsHeader` 操作菜单触发，见 `frontend/src/features/accounts/AccountsFeature.tsx:1165` 到 `frontend/src/features/accounts/AccountsFeature.tsx:1185`。
- 影响：首次使用或运营补账号时，不知道应该选“统一新增”、API key、OAuth 还是导入；高频新增动作也需要额外打开菜单。
- 建议改法：保留菜单，但把一个主动作提升为 header primary，例如 `新增账号`；点击后进入统一 compose，菜单中保留 `导入`、`Codex OAuth 登录`、`API Key 快速新增` 等次级路径。
- 验收方式：源码/组件测试断言 header primary action 存在且打开 `UnifiedComposeModal`；菜单项仍可访问旧路径；浏览器验收首屏能直接发现新增入口。

### 6. [业务体验] Usage Desk 的数据源文案偏研发，运营用户难以判断该看哪一个

- 问题：用量页标题说明直接出现 `ObservedRequestUsage`、`LocalProjectedUsage`，按钮为 `真实请求量` / `本地投影用量`，见 `frontend/src/features/accounts/UsageDeskFeature.tsx:73` 到 `frontend/src/features/accounts/UsageDeskFeature.tsx:132`。
- 影响：运营用户关心“实际经过 GetTokens 的请求”和“本地 CLI 文件推算”，但当前名称需要理解内部数据管线。
- 建议改法：将主按钮改为业务语义：`经过代理的真实请求`、`本机会话估算`；副标题增加短状态标签：权威来源、覆盖范围、可能缺失原因。保留内部名到 tooltip 或调试详情。
- 验收方式：i18n 测试覆盖中英文文案；浏览器验收首屏不出现未解释的 `ObservedRequestUsage` / `LocalProjectedUsage`，并能看到数据源说明 tooltip。

### 7. [业务体验 + 数据契约] Usage Desk 缺少 provider / account / model 的运营分面入口

- 问题：`GetSidecarUsageAttribution` 返回 provider、accountKey、requestedModels、失败数和 token，但页面首层主要围绕时间范围、分钟/日粒度和 chart/detail row，见 `internal/wailsapp/usage_attribution.go` 的 DTO 与 `frontend/src/features/accounts/UsageDeskFeature.tsx:154` 到 `frontend/src/features/accounts/UsageDeskFeature.tsx:216`。
- 影响：本轮 dev 数据有 codex、deepseek、xiaomi mimo 多 provider，运营无法快速回答“哪个 provider/账号今天失败最多、哪个模型消耗最高”。
- 建议改法：在图表下方或右侧增加 `分面切换`：按账号、provider、模型、失败原因聚合。默认展示 Top 5，并支持点击分面反向过滤明细。
- 验收方式：使用 fixture 构造多 provider、多账号、多模型 attribution；断言 Top 分面排序、点击过滤、清除过滤；浏览器验收大数据量下表格不横向溢出。

### 8. [业务体验 + 错误处理] Usage Desk 的索引刷新/重建动作缺少影响范围说明

- 问题：本地投影支持 `refreshProjectedUsage`、`rebuildProjectedUsage`、`rebuildProjectedUsageDay`，并显示 `正在重建索引…` 等动作消息，见 `frontend/src/features/accounts/hooks/useUsageDeskFeature.ts:360` 后的重建逻辑。
- 影响：运营用户不知道刷新是增量扫描还是全量重扫，也不知道是否会读取大量本地 session 文件、耗时多久、是否影响真实代理请求。
- 建议改法：给本地投影增加一个轻量确认/说明条：显示将扫描的 provider、文件数估计、只读保证、预计耗时；全量重建按钮放到次级菜单，单日重建靠选中日期触发。
- 验收方式：mock `usage-local:progress` 事件，断言文件数、阶段、只读提示可见；浏览器验收全量重建不作为首屏最高优先级按钮。

### 9. [业务体验 + 数据契约] Live Sessions 的“清空会话”动作风险语义不够清楚

- 问题：live sessions header 直接提供 `ClearCodexLiveSessions`，前端会同时清空本地 snapshot/detail/overview 状态，见 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:93` 到 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:119` 和 `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx:217` 到 `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx:230`。
- 影响：运营用户容易把“清空实时内存视图”理解成“删除历史记录”或“停止会话”；尤其 dev 数据里有磁盘历史表 `live_session_requests`，语义更需要明确。
- 建议改法：按钮文案改成 `清空实时视图`，点击出现轻量确认，说明“不删除磁盘历史、不取消请求”；若 sidecar 后续支持历史清理，必须另设 `清理历史` 并带筛选条件。
- 验收方式：组件测试断言按钮文案和确认说明；Wails/dev 验收调用清空后实时列表为空，但 `/history` 或 SQLite 历史仍可查询。

### 10. [业务体验 + 状态流] Live Sessions 历史中大量 streaming/active 状态容易误导当前健康度

- 问题：dev `live-sessions-v1.sqlite` 中历史 request 约 41352 条，其中有大量 `streaming` / `active`。前端 overview/detail 拉取 `window: 'all'`，limit 80/50，见 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:141` 到 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:214`。
- 影响：历史遗留的未完成状态可能被运营理解为当前仍在运行或卡住，导致误判系统健康。
- 建议改法：在 live sessions 增加 `实时`、`最近历史`、`异常历史` 三个视图语义；历史行显示 `历史快照` 标记和 last event 时间，超过保留窗口的 `streaming/active` 显示为 `历史未闭合`，不计入当前 active summary。
- 验收方式：fixture 覆盖过期 streaming/active；断言 summary 不计入当前 active，历史列表显示 `历史未闭合`；真实 dev SQLite 查询与 UI 计数一致。

### 11. [业务体验] Live Sessions 的项目/会话切换入口偏窄，缺少运营摘要

- 问题：live sessions 只有 `session/project` segmented control、搜索、筛选，主体是左 feed + 右 detail，见 `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx:176` 到 `frontend/src/features/codex-live-sessions/components/CodexLiveSessionsWorkbench.tsx:316`。
- 影响：运营用户需要先点进列表才能知道哪个项目异常、哪个账号被频繁使用、WebSocket 是否降级；没有一个“今天最该看哪里”的摘要。
- 建议改法：在 header 下加一条 compact operational strip：活跃项目数、异常项目数、HTTP fallback 数、失败请求数、最忙账号。点击 strip 项进入对应过滤。
- 验收方式：selector 测试从 `snapshot.sessions` 派生摘要；浏览器验收点击 `失败请求` 后筛选状态变为 failed，点击 `HTTP fallback` 后 transport/filter 同步。

### 12. [业务体验] 侧边栏二级菜单靠 hover/pin，Codex 高频入口排序不贴近日常运营

- 问题：Codex 二级入口顺序为 feature config、binary、skills、mcp、account-list、live-sessions、session-management、vendor-status、usage-codex，见 `frontend/src/components/biz/Sidebar.tsx:36` 到 `frontend/src/components/biz/Sidebar.tsx:46`；展开逻辑依赖 hover/focus/pinned，见 `frontend/src/components/biz/Sidebar.tsx:201` 到 `frontend/src/components/biz/Sidebar.tsx:319`。
- 影响：产品/运营高频入口通常是账号列表、live sessions、用量、状态；当前排序更像配置维护者视角，日常定位需要多次扫菜单。
- 建议改法：在 Codex 菜单内分组或调整顺序：`运营监控`（账号列表、运行会话、用量、厂商状态）、`本地工具`（session management、binary）、`扩展配置`（skills、mcp、feature config）。视觉上使用分隔标题，不新增顶级菜单。
- 验收方式：sidebar 单测断言新顺序和分组；浏览器验收展开 Codex 后无需滚动即可看到账号列表、运行会话、用量。

### 13. [业务体验 + 测试缺口] 菜单栏点击只回到账号池，缺少状态/用量/运行会话快捷入口

- 问题：菜单栏 `OpenWindow` 固定 emit `menubar:navigate` 到 accounts，见 `internal/wailsapp/app_runtime_menubar.go:23` 到 `internal/wailsapp/app_runtime_menubar.go:31`；前端监听后固定 `#frame=accounts`，见 `frontend/src/App.tsx` 的 `menubar:navigate` 处理。
- 影响：菜单栏已经展示 quota snapshot，却不能直接进入风险账号、用量或 live sessions；运营从菜单栏发现风险后还要再找入口。
- 建议改法：扩展菜单栏 callbacks，至少提供 `打开账号池`、`打开运行会话`、`打开用量` 三个导航 action；quota snapshot 中的风险账号项可带目标 hash。
- 验收方式：Go 测试覆盖不同 menu action payload；前端测试覆盖 `menubar:navigate` 可打开 `#frame=codex&workspace=live-sessions` 和 `#frame=codex&workspace=usage-codex`。

### 14. [业务体验 + 状态摘要] 菜单栏 quota snapshot 只取最低 3 个 quota 和 4 个余额，缺少“更多风险”入口

- 问题：`buildMenuBarQuotaSnapshot` 排序后只保留 3 个资源、4 个余额，见 `internal/wailsapp/app_runtime_menubar_snapshot.go:196` 到 `internal/wailsapp/app_runtime_menubar_snapshot.go:212`。
- 影响：账号数增长后，菜单栏只展示极少数风险，运营无法判断是否还有更多低额度/异常账号。
- 建议改法：保留紧凑展示，但 summary 增加 `+N 更多风险`，并提供点击进入账号池风险筛选；资源项展示对应 accountKey 或可跳转目标。
- 验收方式：Go 单测构造 6 个风险账号，断言 summary 包含更多数量；菜单栏交互验收点击后打开账号池并应用风险筛选。

### 15. [代码逻辑] 账号禁用失败提示复用 deleteError，错误归因会串到删除语义

- 问题：`toggleAccountDisabled` 捕获保存失败后调用 `setDeleteError("SAVE ERROR: ...")`，见 `frontend/src/features/accounts/hooks/useAccountsActions.ts:118` 到 `frontend/src/features/accounts/hooks/useAccountsActions.ts:125`。页面渲染层又把 `deleteError` 作为独立错误条展示，见 `frontend/src/features/accounts/AccountsFeature.tsx:1263`。
- 影响：运营用户禁用/启用失败时会看到和删除同一条错误通道；后续如果删除确认、批量删除和状态切换同时发生，错误归因容易混淆，测试也难以区分是哪类动作失败。
- 建议改法：把账号动作错误拆成 `accountActionNotice` 或独立 `statusMutationError`，删除错误只服务删除确认链路；禁用/启用失败应显示账号名、目标状态、是否已本地回滚。
- 验收方式：为 `useAccountsActions` 或页面状态补测试：mock `SetAccountDisabled` 失败时不设置 `deleteError`，而设置状态变更错误；浏览器验收禁用失败提示不出现 `DELETE ERROR`/删除语义。

### 16. [代码逻辑] 账号用量加载失败会静默落成“无数据”，缺少降级态

- 问题：`useAccountsUsageState` 在 `GetSidecarUsageAttribution` / `GetUsageStatistics` 失败时只 `console.error`，然后用 `buildAccountUsageSummaryMap(accounts, null)` 覆盖用量状态，见 `frontend/src/features/accounts/hooks/useAccountsUsageState.ts:70` 到 `frontend/src/features/accounts/hooks/useAccountsUsageState.ts:73`。
- 影响：运营用户会把“读取失败”误判成“过去 24 小时没有请求”；这会直接影响账号健康判断和故障追踪。
- 建议改法：为 `accountUsageByID` 增加 `source/error/stale` 或单独 `accountUsageErrorByID`，失败时保留旧值并标记 stale；账号卡和详情显示“用量读取失败/上次成功时间”，而不是空数据。
- 验收方式：补 hook/model 测试：请求失败时保留旧 summary 且标记 stale；页面组件测试断言失败态文案可见；真实 dev sidecar 断开时账号卡不显示为正常无用量。

### 17. [代码逻辑 + 测试缺口] 账号用量测试覆盖模型充分，但缺少 hook 级异步失败/合并测试

- 问题：`frontend/src/features/accounts/tests/accountUsage.test.mjs` 覆盖了 `buildAccountUsageSummaryMap`、attribution item、openai-compatible 等纯模型逻辑，见 `frontend/src/features/accounts/tests/accountUsage.test.mjs:227` 到 `frontend/src/features/accounts/tests/accountUsage.test.mjs:339`；但没有覆盖 `useAccountsUsageState` 的异步路径、`merge`、refreshing set 和 fallback 行为。
- 影响：用量状态流未来改动容易让 loading 卡住、merge 覆盖旧账号、失败误清空等问题漏过测试。
- 建议改法：把 `loadAccountUsage` 的异步决策抽成纯函数或可注入 API 的小 hook 测试 harness，覆盖 attribution 成功、空 attribution fallback、失败保留旧值、merge=true、showRefreshing 最短反馈时长。
- 验收方式：新增测试文件或扩展现有测试，至少断言 `merge=true` 不清掉未刷新账号，失败时不会把已有 usage summary 改成普通无数据。

### 18. [代码逻辑] Live Sessions history 每次用 `window: all` 拉取固定 limit，缺少偏移/分页交互契约

- 问题：overview 调 `GetCodexLiveSessionHistory({ window:'all', limit:80, offset:0 })`，detail 调 `limit:50`，见 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:141` 到 `frontend/src/features/codex-live-sessions/CodexLiveSessionsFeature.tsx:214`。后端 DTO 支持 `limit/offset/session_id`，见 `internal/wailsapp/codex_live_sessions.go`。
- 影响：dev 历史已有约 4.1 万条 request，但 UI 只能看到前 50/80 条窗口；运营想追一个项目或会话的深层历史时会误以为“没有更多”。
- 建议改法：在 overview/detail 增加 `hasMore` 推断或后端返回 total/nextOffset；UI 提供“加载更多历史”，并明确当前窗口是最近 50/80 条。
- 验收方式：mock history 返回 80 条和下一页数据，断言“加载更多”出现且 offset 递增；后端/Wails 测试覆盖 query 参数透传；浏览器验收滚动详情不会丢失已加载行。

### 19. [代码逻辑 + 维护性] 菜单栏导航测试把单一路由写死，后续扩展会先撞测试

- 问题：`frontend/src/tests/menuBarNavigation.test.mjs` 明确断言 `payload?.page !== 'accounts'`、`setActivePage('accounts')` 和 `window.location.hash = '#frame=accounts'`，见 `frontend/src/tests/menuBarNavigation.test.mjs:5` 到 `frontend/src/tests/menuBarNavigation.test.mjs:11`。
- 影响：如果按第 13 条扩展菜单栏到 live sessions/usage，这个测试会强制维持单一路由。测试本身不是错，但它当前锁住的是实现细节而不是“菜单栏 payload 能安全导航”的行为。
- 建议改法：先抽 `resolveMenuBarNavigationHash(payload)` 纯函数，测试覆盖 accounts、codex live sessions、codex usage、非法 payload fallback；App 只调用该函数更新页面和 hash。
- 验收方式：替换现有源码字符串断言测试为纯函数测试；新增非法 payload 不导航或 fallback 的用例；菜单栏 Go 侧 payload 与前端 resolver 的 page/workspace 字段保持一致。

## 优先候选

1. **账号池筛选空态拆分**：实现面小，直接解决“有账号但看起来为空”的高频误判；候选涉及 `AccountsFeature.tsx`、`AccountsToolbar` 与 `accountFilters` 测试。
2. **账号用量失败态/stale 态**：这是代码逻辑和体验同时受益的修复，能避免把 sidecar 读取失败误报成无用量；候选涉及 `useAccountsUsageState.ts`、`accountUsage` model 和组件展示。
3. **Live Sessions 历史未闭合状态标记**：dev 数据已显示大量历史 `streaming/active`，这会直接影响运行健康判断；候选涉及 live sessions selector/model 和 workbench 文案，不必先改 sidecar 写入。

## 风险/未覆盖

- 本轮未启动 Wails 桌面 dev app，也未连接真实 sidecar management API；Wails 绑定和菜单栏真实交互需主控或修复 agent 后续在 dev app 内验收。
- 浏览器预览使用 mock/preview 数据，真实数据体验判断主要来自 dev SQLite 只读聚合，不读取账号 JSON 或敏感请求原文。
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/dev-data-prep.md` 已说明 SQLite WAL 复制不是严格事务快照；本报告仅用于体验改进建议，不作为数据迁移正确性结论。
- 运行期间曾生成临时浏览器截图文件到仓库根目录，已立即删除；最终只保留本报告文件。
