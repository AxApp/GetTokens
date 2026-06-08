# 第 8 轮第一修复包方案

## 状态

- 日期：2026-06-08
- 范围来源：`unfixed-backlog.md` 中用户指定的 `P15`、`R2`、`R3`、`P16/P17`、`P13/P14`
- 当前状态：待实现，先按 BDD/TDD 拆分方案
- 执行环境：仅 dev、本仓构建产物或对应 worktree；禁止触碰 `/Applications/GetTokens.app`、正式版进程和正式数据目录

## 修复包范围

本轮只处理已经有明确问题边界、能通过测试和 dev 验收闭环的问题：

1. `P15` 账号禁用错误归因：禁用/启用失败不能再复用删除错误状态。
2. `R2` Channel routing reason summary：路由历史事件需要展示过滤原因摘要，而不只是过滤数量。
3. `R3` Rate-limit legacy key 检测：只读检测旧 `auth-file:*`、`codex-api-key:*`、`openai-compatible:*` key，不做自动迁移。
4. `P16/P17` 账号用量失败态和 hook 测试：用量加载失败不能静默变成“无数据”，并补 hook 级异步失败/合并测试。
5. `P13/P14` 菜单栏真实入口和风险摘要：确认真实 macOS 菜单项 payload，补更完整的 quota 风险摘要与跳转目标。

非范围：

- 不实现 `R1 route-probe` management endpoint。
- 不迁移 rate-limit legacy key，只检测、提示和保留证据。
- 不改 usage attribution 的归因算法和 legacy key 聚合策略。
- 不调整菜单栏 residency、LaunchAgent、关闭窗口行为。
- 不触碰正式版 App、正式进程或正式配置数据。

## 推荐执行顺序

### Phase 1：P15 账号禁用错误归因

定位：

- 前端入口：`frontend/src/features/accounts/hooks/useAccountsActions.ts`
- 当前问题：`toggleAccountDisabled` 捕获禁用/启用失败后调用 `setDeleteError("SAVE ERROR: ...")`，用户看到的错误被归入删除/保存语义。

BDD 场景：

- Given 账号卡片处于启用状态，When 用户点击禁用且 Wails `SetAccountDisabled` 返回错误，Then 页面展示“禁用失败”语义，账号状态不被乐观改坏。
- Given 账号卡片处于禁用状态，When 用户点击启用且后端失败，Then 页面展示“启用失败”语义，不出现 `DELETE ERROR` 或删除确认相关错误。
- Given 浏览器 preview 无 Wails 绑定，When 用户切换禁用态，Then 仍允许本地 preview 状态变化，不展示错误。

TDD 入口：

- 新增或扩展 `frontend/src/features/accounts/tests/accountActions*.test.mjs`，优先抽出纯函数，例如 `buildAccountDisabledActionError(nextDisabled, error, t)`。
- 若现有 hook 不便直接测试，先把错误文案归因抽到 `frontend/src/features/accounts/model/` 下的纯模型，再在 hook 中调用。

实现方向：

- 新增独立 action notice 或错误分类，避免禁用失败进入 `deleteError`。
- 最小方案：保留现有 UI 承载，但文案必须是 `DISABLE ERROR` / `ENABLE ERROR` 或中文等价语义；中等方案：接入 `setAccountActionNotice({ tone: "error" })`，让错误出现在批量/账号动作通知区域。
- 推荐采用中等方案，因为 `setAccountActionNotice` 已存在，语义比 `deleteError` 更贴近账号动作。

验收：

- 单测证明禁用失败、启用失败、删除失败三类文案互不串扰。
- 手动 preview 或 dev 桌面中模拟 Wails 错误时，错误出现在账号动作区域，不出现删除语义。

风险：

- 如果只改文案不改状态承载，仍可能让后续维护者误用 `deleteError`；因此建议至少抽纯函数并命名为 account action error。

### Phase 2：R2 Channel routing reason summary

定位：

- 前端模型：`frontend/src/features/channel-routing/model/channelRouting.ts`
- 前端组件：`frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
- Wails DTO：`internal/wailsapp/channel_routing.go`
- 现有测试：`frontend/src/features/channel-routing/tests/channelRouting.test.mjs`、`internal/wailsapp/channel_routing_test.go`

BDD 场景：

- Given route event 带有 filtered reasons，When 用户查看最近路由事件，Then 能看到 `account-disabled x2`、`runtime-rate-limit x1` 这类原因摘要。
- Given route event 因脱敏只提供 filtered count，When 无原因明细，Then 仍展示原本的“过滤 N 个”，不误造原因。
- Given shadow routing 有差异，When 展开事件，Then reason summary 与 shadow summary 并列存在，不互相覆盖。

TDD 入口：

- 扩展 `buildChannelRouteAuditEventSummary` 单测，输入 `filteredReasons` 或 `filtered` 明细后断言 meta 包含 top reasons。
- 后端若已有 event ledger 明细，补 `channel_routing_test.go` 确认 DTO 透出 reason counts；若没有明细，第一阶段仅前端从已有 `filtered` 结构派生 preview/explain summary。

实现方向：

- 优先增加 `reasonCounts` 纯模型：输入 `event.filteredReasons`、`event.filtered` 或后端新增 `filteredReasonCounts`，输出稳定排序的 `{ reason, count }[]`。
- UI 只展示前 3 个原因，超出显示 `+N`，避免 route ledger 被长列表撑开。
- Reason 文案先保留机器可读 key，例如 `account-disabled`、`runtime-rate-limit`，不在本轮扩展完整 i18n 字典。

验收：

- 最近 5 条 route events 中，有明细的事件展示原因摘要；无明细事件仍回退数量。
- Preview route event 由 explain 生成时，也能显示原因摘要。

风险：

- 真实 sidecar event ledger 可能暂不返回 filtered 明细；本阶段需要允许“前端 preview/explain 已支持，真实事件待后端字段存在后自动显示”，不能因此阻塞整个修复包。

### Phase 3：R3 Rate-limit legacy key 检测

定位：

- 前端模型：`frontend/src/features/accounts/model/rateLimit.ts`
- 前端 UI：`frontend/src/features/accounts/components/RateLimitRulesSection.tsx`
- Wails：`internal/wailsapp/rate_limit.go`
- 现有测试：`frontend/src/features/accounts/tests/rateLimit.test.mjs`、`internal/wailsapp/rate_limit_test.go`

BDD 场景：

- Given 当前账号 id 为 `acct_*`，When rate-limit rules/status/events 返回 `auth-file:*`、`codex-api-key:*` 或 `openai-compatible:*` key，Then UI 展示“旧账号键，不会命中当前运行态账号”的诊断提示。
- Given legacy key 只出现在历史 events，When 用户查看详情，Then 提示为历史风险，不阻断当前规则编辑。
- Given 新建或保存规则，When payload 发送到后端，Then 必须使用当前 `acct_*` account key，不新增 legacy key。

TDD 入口：

- 在 `rateLimit.test.mjs` 中增加 `detectLegacyRateLimitAccountKeys` 纯函数测试。
- 在 `rate_limit_test.go` 中保持保存 payload 使用传入 `acct_*` 的断言；如后端新增 DTO 字段，补解析测试。

实现方向：

- 增加纯函数 `isLegacyRateLimitAccountKey` 和 `collectLegacyRateLimitBindings(status, rules, events, currentAccountKey)`。
- 前端 `RateLimitRulesSection` 在检测到 legacy binding 时展示 warning strip，内容包含 legacy key 数量、来源 rules/status/events 和“不自动迁移”说明。
- 后端不做迁移，不删除历史事件；只确保 Wails DTO 不丢 `accountKey`。

验收：

- legacy rules/status/events 三种来源都能被检测。
- 当前账号为 `acct_*` 且规则也是 `acct_*` 时不误报。
- 保存规则后 payload 仍为当前 account key。

风险：

- 如果 sidecar 仍返回 legacy key 但当前账号没有 `acct_*` 映射，本轮只提示，不承诺恢复命中；迁移需要单独技术方案。

### Phase 4：P16/P17 账号用量失败态和 hook 测试

定位：

- Hook：`frontend/src/features/accounts/hooks/useAccountsUsageState.ts`
- 模型：`frontend/src/features/accounts/model/accountUsage.ts`
- 现有测试：`frontend/src/features/accounts/tests/accountUsage.test.mjs`

当前问题：

- `loadAccountUsage` catch 后调用 `buildAccountUsageSummaryMap(accounts, null)`，失败会被渲染成“无数据/none”，用户无法区分无用量与加载失败。

BDD 场景：

- Given 账号有旧用量摘要，When 刷新用量失败且 `merge=true`，Then 保留旧摘要并标记 `stale/error`，显示失败原因。
- Given 首次加载用量失败且无旧数据，When 页面渲染账号卡片，Then 展示“用量加载失败”或降级态，而不是“无数据”。
- Given attribution 返回空 items 且 fallback disabled，When 这是成功响应，Then 可以显示无数据，不误判为失败。
- Given attribution 失败但 legacy fallback 成功，When fallback 未关闭，Then 展示 fallback 结果并标记来源，不显示失败态。

TDD 入口：

- 先给 `accountUsage.ts` 增加 `failAccountUsageSummaryMap(accounts, prev, error)` 或类似纯函数测试。
- 再补 hook 级异步测试，建议使用 `@testing-library/react` 的 `renderHook` 或项目现有 React 测试方式；若当前测试栈没有 hook runner，则先抽 `loadAccountUsageEffect` 纯 async orchestrator。

实现方向：

- 扩展 `AccountUsageSummary` 增加轻量状态字段，例如 `loadState: "ready" | "empty" | "stale" | "error"`、`errorMessage?: string`。
- catch 分支在 `merge=true` 时保留旧值并置 `stale`，无旧值时生成 `error` summary。
- UI 复用现有 usage status bar/mini metrics，新增错误 tone 和 tooltip，不扩展新页面。

验收：

- 单元测试覆盖首次失败、合并失败保留旧值、空成功、fallback 成功。
- 账号卡片不会把异常吞成“0 tokens / no data”。

风险：

- `AccountUsageSummary` 被多个 story 和卡片组件使用；字段必须可选且向后兼容，避免一次性改大量 mock。

### Phase 5：P13/P14 菜单栏真实入口和风险摘要

定位：

- 菜单栏控制：`internal/wailsapp/app_runtime_menubar.go`
- quota snapshot：`internal/wailsapp/app_runtime_menubar_snapshot.go`
- macOS bridge：`internal/menubar/*`
- Hash resolver：`frontend/src/utils/pagePersistence.ts`
- 现有测试：`internal/wailsapp/app_runtime_menubar_test.go`、`internal/wailsapp/app_runtime_menubar_snapshot_test.go`、`frontend/src/tests/menuBarNavigation.test.mjs`

BDD 场景：

- Given 用户点击菜单栏“打开窗口”，When dev App 窗口显示，Then 跳转到真实运营入口，而不是只打开默认账号页。
- Given quota snapshot 有超过 3 个低额度/阻断/过期账号，When 菜单栏只展示前三条资源，Then summary 明确显示总风险数，并提供“更多风险”跳转到账号或 usage/codex 相关 workspace。
- Given snapshot 同时有 quota 与 billing 风险，When 用户查看菜单栏，Then summary 可区分最低额度、风险账号数、余额摘要和刷新时间。

TDD 入口：

- 扩展 `app_runtime_menubar_test.go`：断言菜单栏 open payload 包含 `page`、`workspace`、必要时 `view` 或 `filter`。
- 扩展 `menuBarNavigation.test.mjs`：新增 payload 到 hash 的映射，例如 `#frame=accounts&workspace=all` 或 `#frame=codex&workspace=usage-codex`。
- 扩展 `app_runtime_menubar_snapshot_test.go`：覆盖风险账号多于展示资源数量时 `RiskAccounts`、新增 summary 字段和排序。

实现方向：

- P13：把 `OpenWindow` payload 从 `{ page: "accounts" }` 升级为真实入口 payload。推荐第一阶段跳到 `accounts`，附带 `workspace=all` 和 `filter=risk` 或等价字段；若当前 hash resolver 不支持 filter，则先跳 `accounts/all` 并通过菜单栏 summary 指向“风险账号数”。
- P14：`menuBarQuotaSnapshot.Summary` 增加 `RiskSummary` 或 `MoreRiskLabel`，保留兼容字段 `RiskAccounts`；资源列表仍限制 3 条，summary 显示总风险账号数。
- macOS bridge 如需新增菜单项，先只增加“打开账号风险”或“查看更多风险”，payload 仍由 Wails emit 统一处理。

桌面验收：

- 必须使用 dev 构建或 `wails dev`，不触碰正式版 App。
- 验收真实 macOS 菜单栏状态项存在、点击菜单项能让 dev 窗口显示并跳转到预期 hash。
- 截图归档到 `docs-linhay/spaces/20260608-subagent-project-experience/screenshots/`，文件名建议 `20260608-menubar-risk-entry-dev-v01.png`。

风险：

- macOS 菜单栏桥接依赖 AppKit，浏览器测试不能替代真实桌面验收。
- 若当前 `internal/menubar` Swift/ObjC bridge 没有动态菜单项能力，本轮可以先完成 payload 与 summary DTO，真实“更多风险”菜单项拆到下一阶段。

## 总体验证命令

按阶段最小验证：

```bash
cd frontend && node --test src/features/accounts/tests/accountUsage.test.mjs
cd frontend && node --test src/features/accounts/tests/rateLimit.test.mjs
cd frontend && node --test src/features/channel-routing/tests/channelRouting.test.mjs
cd frontend && node --test src/tests/menuBarNavigation.test.mjs
go test ./internal/wailsapp -run 'Test(MenuBar|BuildMenuBar|ChannelRouting|RateLimit|Account)'
docs-linhay/scripts/check-docs.sh
```

整包收敛验证：

```bash
go test ./...
cd frontend && npm run test:unit
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

若 Phase 5 改 Go/Wails bindings 或 macOS bridge，还需要：

```bash
./scripts/wails-cli.sh build
```

并完成 dev 桌面菜单栏验收。

## Subagent 分工建议

- Subagent A：`P15 + P16/P17`，专注账号前端状态、错误模型和 hook 测试。
- Subagent B：`R2 + R3`，专注 routing/rate-limit 诊断模型、DTO 透传和 focused tests。
- Subagent C：`P13/P14`，专注 menu bar Go 层、hash resolver 和 macOS 桌面验收。
- 主控 agent：先审测试红灯，再集成实现，最后统一跑整包验证、截图、space 文档和 memory 写回。

## 完成定义

- 每个问题都有至少一个失败测试先落地，再完成最小实现。
- `P15` 错误归因不再串到删除语义。
- `R2` route event 能在有明细时展示原因摘要，无明细时保留原数量展示。
- `R3` legacy rate-limit key 被只读检测并提示，不做隐式迁移。
- `P16/P17` 用量失败态可见，hook/模型测试覆盖异步失败和 merge 保留旧值。
- `P13/P14` 至少完成 payload/hash/snapshot 自动化测试；若改真实菜单项，完成 dev macOS 桌面验收和截图归档。
- 全部验证结果写回本 space，若未运行某项验证，明确原因和风险。
