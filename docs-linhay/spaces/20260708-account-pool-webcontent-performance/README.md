# Account Pool WebContent Performance

## 背景
- 2026-07-08 用户反馈生产版 Activity Monitor 中 `wails://wails` 内存回升到约 `1.00 GB`。
- 只读排查确认该行对应 `/Applications/GetTokens.app` 的 WebKit WebContent 进程，而不是 sidecar Go 进程：
  - WebContent pid `38725`：`vmmap -summary` 显示 Physical footprint `1.0G`，peak `1.8G`，主要驻留在 `WebKit Malloc`。
  - sidecar pid `38727`：RSS 约 `188 MB`。
  - Wails 主进程 pid `38530`：RSS 约 `730 MB`。
- 生产 sidecar 日志显示账号池页打开时仍按整池自动同步运行态：
  - 每约 30 秒请求 `rate-limit-strategies`、`rate-limit-status`。
  - 1179 个账号拆成 6 批 `quota-status?account_keys=[redacted:200]` 加 1 批 `[redacted:179]`。
  - 同步 `usage-attribution?bucket=1h&include_unresolved=true&window=24h`。
- WebKit 持久化目录 `~/Library/WebKit/com.wails.GetTokens` 总量约 `165 MB`，其中一个 LocalStorage WAL 文件达到 `144 MB`；key 本体只有数 MB，说明频繁整包写入被 SQLite WAL 放大。
- 已完成第一轮止血：
  - 大账号池自动 runtime sync 降频：`>500` 账号 120s，`>1000` 账号 300s。
  - `>500` 账号跳过加载后的重复即时 whole-pool sync。
  - 账号列表 cache 与 quota cache 内容未变不再写入 LocalStorage。

## 目标
- 把账号池 1000+ / 4000+ 账号规模下的 WebContent 内存、WebKit 存储、Wails bridge payload、React 派生状态和 sidecar runtime snapshot 开销拆成可验证的优化项。
- 建立账号池性能预算，后续每个修复都必须有可复跑的证据，而不是只靠 Activity Monitor 观察。
- 优先减少整池自动数据流、重复本地缓存写入和 WebView 内 retained state。
- 保留用户主动刷新语义：手动“同步运行状态”、组头刷新、卡片刷新仍然可触发明确的最新状态请求。

## 范围
- 账号池页 WebContent / React 内存与渲染。
- Wails bridge 账号列表、quota status、rate-limit status、usage attribution 数据流。
- WebKit LocalStorage / IndexedDB / WAL 持久化治理。
- sidecar runtime snapshot、usage attribution、rate-limit status 的批量/增量读取。
- 账号页性能打点、headless DOM 规模验收、dev App 运行态证据。
- 相关项目级 performance skill、memory、计划文档写回。

## 非目标
- 不触碰 `/Applications/GetTokens.app` 正式版二进制、正式版 sidecar 或正式版配置。
- 不为了降低内存删除用户账号、quota 数据或 usage ledger。
- 不把用户主动刷新降级成完全不刷新；只治理自动同步和后台补充态。
- 不做移动端适配或移动端截图。
- 不把 upstream/Codex 服务端限制伪装成本地可修复问题；只处理 GetTokens WebView/Wails/sidecar 自身放大链路。

## 验收标准
1. Given 生产或 dev App 打开 1000+ 账号池，When 账号页保持可见 10 分钟，Then 自动 runtime sync 请求数量符合自适应频率预算，不再 30 秒整池轮询。
2. Given 账号列表与 quota 状态 payload 内容未变化，When runtime sync 多次执行，Then WebView LocalStorage 不发生 timestamp-only 全量重写，WAL 不持续线性增长。
3. Given Wails runtime 下已有后端 `ListCachedAccounts` / sidecar SQLite snapshot，When 账号池 first paint，Then WebView 不再长期保留重复的大型账号列表 localStorage cache，或该 cache 有明确大小/写入预算。
4. Given 账号池分组展开 1000+ 账号，When 页面首屏和滚动，Then `data-account-card` DOM 节点数仍受虚拟窗口限制，不一次性渲染全部卡片。
5. Given 自动 runtime sync 运行，When 只需要卡片补充态，Then quota/rate-limit/usage 数据流优先按可见账号、脏账号或增量游标读取，不默认整池全量 JSON 过 Wails bridge。
6. Given sidecar 正在处理高并发请求和 usage ledger 写入，When 账号页同步运行态，Then 不出现持续 `database is locked`，或有明确的 single-writer / busy timeout / 批量事务治理结论。
7. Given 新增性能打点，When 用户安装新包后观察日志，Then 日志只输出 counts、payload bytes、durations、cache skipped/written、rendered card count，不输出账号 key 列表或凭证。
8. Given 每个优化项完成，When 提交前验证，Then 至少包含 focused unit tests、`npm --prefix frontend run typecheck`、必要的 `npm --prefix frontend run build` / `./scripts/wails-cli.sh build`，以及对应 DOM / 日志 / vmmap / storage 证据。

## 证据门禁

### 2026-07-08 WebContent 1GB 回升

- 问题来源：用户提供 Activity Monitor 行：`wails://wails 1.00 GB ... pid 38725`。
- 当前事实位置：
  - WebContent 进程：`/System/Library/.../com.apple.WebKit.WebContent`，pid `38725`。
  - 生产 sidecar 日志：`/Users/linhey/.config/gettokens/sidecar.log`。
  - WebKit storage：`/Users/linhey/Library/WebKit/com.wails.GetTokens`。
  - 前端自动同步：`frontend/src/features/accounts/hooks/useAccountsPageState.ts`。
  - runtime sync 模型：`frontend/src/features/accounts/model/accountRuntimeSync.ts`。
  - 账号/quota cache：`frontend/src/features/accounts/model/accountListCache.ts`、`frontend/src/features/accounts/model/accountQuotaCache.ts`。
- 当前现象：
  - `vmmap` 显示 WebKit Physical footprint `1.0G`，peak `1.8G`，主要是 `WebKit Malloc`。
  - sidecar RSS 约 `188 MB`，不是本次 1GB 行的主因。
  - 1179 账号整池自动 runtime sync 每约 30 秒执行，产生 quota/status/usage/rate-limit 全量或近全量数据流。
  - LocalStorage key 本体数 MB，但 WAL 文件达到 `144 MB`。
- 已完成止血：
  - 大账号池自动 sync 降频。
  - 跳过大池加载后的重复即时 sync。
  - list/quota cache 内容未变不写。
- 验收路径：用 dev App + 生产数据副本或规模 preview 固定请求频率、DOM 节点、LocalStorage 写入、WAL 增长和 WebContent footprint 前后对比。
- 反证条件：若新包中自动 sync 已明显降频且 WAL 不再增长，但 WebContent 仍持续涨，则优先转向 React retained heap / WebKit image/layout / session-management storage 等其他 WebView 层调查。

### 候选 A：Wails runtime 下禁用重复 WebView cache

- 问题来源：LocalStorage WAL 放大，且 Wails 已有 `ListCachedAccounts` / SQLite snapshot。
- 当前事实位置：`accountListCache.ts`、`accountQuotaCache.ts`、`useAccountsPageState.ts`、`useAccountsQuotaState.ts`。
- 预期方向：浏览器 preview 保留 localStorage first-paint cache；Wails runtime 下禁用或只保留小型 manifest，并 best-effort 清理旧 `gettokens.accounts.list-cache` / `gettokens.accounts.quota-cache`。
- 验收路径：单测断言 Wails runtime 不写大型 cache；dev App 日志或 storage 检查证明 key 被清理或不再增长。
- 反证条件：若禁用后 first paint 明显退化且后端 snapshot 不可用，需要改为 bounded cache 而不是完全关闭。

### 候选 B：自动 runtime sync 可见/脏账号/增量化

- 问题来源：降频只是止血，仍然是整池 JSON 过桥。
- 当前事实位置：`useAccountsPageState.ts` 的 `runtimeSyncAccounts`、`syncCodexQuotaStatuses()`、`loadAccountUsage()`、`loadAccountRateLimits()`。
- 预期方向：自动同步只针对可见窗口、展开组、近期活跃或 dirty epoch 账号；手动 header / group / card refresh 维持用户意图的广度。
- 验收路径：headless DOM 或 dev bridge 输出 total accounts、rendered accounts、sync target count、payload bytes；1000+ 账号下自动 sync target count 明显低于整池。
- 反证条件：如果产品要求所有卡片在后台实时更新，则改为 sidecar 增量 summary，而不是前端可见窗口策略。

### 候选 C：usage attribution sidecar 摘要/增量读取

- 问题来源：账号卡片 usage 已复用前端账号快照，但仍周期性取 24h attribution。
- 当前事实位置：`useAccountsUsageState.ts`、`accountUsage.ts`、Wails `GetSidecarUsageAttribution`、sidecar usage ledger。
- 预期方向：sidecar 按请求完成维护 per-account summary，前端按 `changed_since` / epoch 拉增量摘要。
- 验收路径：mock usage ledger 服务级测试固定上游请求事实，断言前端卡片同步不再拉完整 24h bucket；日志输出 items/bytes/duration。
- 反证条件：如果 Usage Desk 仍需要 30D 明细，不得降低 Usage Desk 保留窗口；卡片 summary 与 Usage Desk 明细分接口处理。

### 候选 D：rate-limit status batch/filter endpoint

- 问题来源：当前 `GetAllRateLimitStatuses()` 全量拉取后前端过滤。
- 当前事实位置：`useAccountsRateLimitState.ts`、`internal/cliproxyapi/client.go`、`internal/wailsapp/rate_limit.go`。
- 预期方向：新增按 `account_keys` 批量读取 rate-limit status，和 quota-status 一样 chunk。
- 验收路径：mock management API 断言自动 sync 不调用全量 rate-limit status；大池请求数和 payload bytes 有预算。
- 反证条件：若 sidecar rate-limit status 本体极小且全量成本低于多批请求，保持全量但加 payload/耗时预算。

### 候选 E：账号 summary/detail 分层

- 问题来源：账号列表卡片只需要 summary，但 `ListAccounts` 可能携带详情字段、模型、配置等。
- 当前事实位置：Wails `ListAccounts`、`mapBackendAccountRecord()`、`AccountRecord`、统一详情 modal。
- 预期方向：列表页只取 summary DTO；详情页打开时懒加载模型、curl、配置、长错误原文。
- 验收路径：DTO 测试和 payload size 预算，打开详情前 list payload 不含大型 detail-only 字段。
- 反证条件：如果当前 backend 已经只返回 summary，则把该项降级为字段审计和测试守护。

## Wise Council 裁决

- 顾问来源：
  - Antigravity CLI `agy`：实际外部顾问回复。
  - GitHub Copilot CLI `copilot --model auto`：实际外部顾问回复；第一次默认模型调用失败，第二次用 `--model auto` 成功。
- 一致结论：第一刀从候选 B 开始，即自动 runtime sync 改为可见/展开/脏账号/增量候选集合；候选 A 的 LocalStorage/WAL 治理保留为第二刀或并行低风险项，但不作为证明 WebContent 1GB 修复的主证据。
- 采纳：
  - 自动同步只缩窄候选集合，手动 header refresh 和组头/card refresh 保留明确的全量/组内/单卡用户意图。
  - 离屏账号状态必须中心化保留，离屏只停止订阅或渲染，不丢 `lastSyncAt / stale / quota / usage / rate-limit`。
  - 每次自动同步需要记录触发原因，例如 `visible / expanded / dirty / manual`，便于日志和验收归因。
  - 第一阶段验收预算采用现实门槛：1179 账号静置 30 分钟 WebContent Physical Footprint P95 `<500MB`，自动 sync bridge payload P95 `<150KB`，CPU spike P95 `<20%`；`<350MB / <100KB / <15%` 作为第二阶段目标。
- 拒绝：
  - 拒绝把 LocalStorage WAL 缩小单独作为 WebContent 内存修复成功证据；它只能证明 storage 写放大被控制。
  - 拒绝第一刀引入 sidecar 新契约、usage changed-since、完整 summary/detail 重构或新虚拟滚动库。
- 推迟：
  - A：Wails runtime cache 清理，作为第二刀或 B 完成后的并行低风险项。
  - C：usage attribution per-account summary / changed-since。
  - D：rate-limit status batch/filter endpoint。
  - E：账号 summary/detail 分层。
- 升级触发：若 B 完成后自动 sync payload 已降到预算内、WAL 不再增长，但 WebContent P95 仍 `>500MB` 或继续阶梯式上涨，则下一刀转向 E；如果 payload 仍大或 rate-limit/usage 仍全量，则先补 D/C。

## Phase 1 执行记录

### 2026-07-08 自动 runtime sync 目标收窄

- 问题来源：Wise Council 裁决第一刀为候选 B；现有自动 sync 即使已降频，仍用 `runtimeSyncAccounts` 整池拉 quota status、usage attribution 和 rate-limit status。
- 代码事实：
  - `frontend/src/features/accounts/hooks/useAccountsPageState.ts` 原自动 sync 使用整池 `runtimeSyncAccounts`。
  - `frontend/src/features/accounts/components/AccountGroupSectionView.tsx` 已有大组虚拟窗口，可作为 visible targets 来源。
- 实现：
  - `AccountGroupSectionView` 上报当前展开组的虚拟窗口账号 id，折叠或卸载时清空该组 targets。
  - `useAccountsPageState` 聚合各组 visible targets，自动 sync 使用 `automaticRuntimeSyncAccounts`。
  - `resolveAutomaticAccountRuntimeSyncTargets()` 对大账号池无 targets 时跳过自动 sync，小账号池保留兼容的整池行为。
  - 手动“同步运行状态”仍使用完整 `runtimeSyncAccounts`，组头刷新和卡片刷新不受自动策略收窄影响。
- 验证：
  - `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountListLayout.test.mjs frontend/src/context/debugPayload.test.mjs`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run build`
  - `./scripts/wails-cli.sh build`
  - 本轮触达文件 `git diff --check -- ...` 通过；全局 `git diff --check` 仍被既有 `frontend/wailsjs/go/models.ts` trailing whitespace 卡住。
- 剩余风险：初始 `loadAccounts(... refreshSupplementalData=true)` 仍可能拉一轮 supplemental 数据；如果新包静置后 WebContent 仍高，下一刀需要把 first-load supplemental 也拆成 summary/visible 或后端 snapshot。

### 2026-07-08 Debug retained-state 有界化

- 问题来源：实现 Phase 1 时发现 `DebugProvider.trackRequest()` 会把 Wails 请求和响应完整放入 React state 且没有条数上限；账号页 `ListAccounts`、quota status、usage attribution、rate-limit status 都经过该链路。
- 实现：
  - 新增 `frontend/src/context/debugPayload.ts`，对 debug request/response 做摘要：数组只保留类型和长度，敏感字段脱敏，长字符串截断，嵌套深度和对象 key 数有上限。
  - `DebugProvider` 只保留最近 80 条 debug entries，避免调试页 state 长期保留大账号池 payload。
- 验证：
  - `frontend/src/context/debugPayload.test.mjs` 覆盖 4000 项数组不保留原始 items、敏感字段脱敏、entries 上限。
  - 同上前端测试、typecheck、build、Wails build 均通过。
- 剩余风险：外部 `debug:inject-entries` DEV 注入仍接受调用方传入的 entries；该入口仅 DEV 使用，后续如发现 preview 内存异常再加同样摘要。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260708-account-pool-webcontent-performance`
- worktree：`../GetTokens-worktrees/20260708-account-pool-webcontent-performance/`

## 相关链接
- 前置性能治理：`docs-linhay/spaces/20260608-account-pool-scale-optimization/README.md`
- 前置 runtime 批处理：`docs-linhay/spaces/20260608-account-runtime-bulk-sync/README.md`
- 当天 memory：`docs-linhay/memory/2026-07-08.md`
- 项目性能规则：`.agents/skills/gettokens-performance-governance/SKILL.md`
- 计划：`plans/performance-governance-plan-v01.md`

## 当前状态
- 状态：phase-1-implemented
- 最近更新：2026-07-08
