# Codex live session account identity filtering

## 背景
运行会话列表 `#frame=codex&workspace=live-sessions` 出现已经删除或已经禁用的账号。现场排查确认，sidecar live-session tracker 记录的是请求发生时的 runtime `authID`，而统一账号池当前身份是 `acct_* accountKey`。账号迁移、删除或禁用后，live-session snapshot 仍可能保留旧 runtime auth 行，导致用户误以为这些账号仍在参与当前路由。

之前已处理过的边界是“禁用账号不能继续参与路由，必要时关闭 Codex WebSocket 上游会话”；本轮处理的是运行会话列表的账号身份归并与展示过滤。

## 目标
1. live-session 请求记录同时携带 `accountKey`，让运行会话能关联统一账号池身份。
2. 抽出 sidecar 运行态账号投影 `RuntimeAccountProjection`，由账号池热路径状态统一表达 `Present / Enabled / Requestable / CoarseAvailable / FilteredReasons / ActiveSessions`。
3. sidecar `GET /v0/management/gettokens/live-sessions` 默认消费 `RuntimeAccountProjection`，只展示当前 `accountCoarseAvailable=true` 的会话；不在 live-session 内自建第二套账号可用性判断。
4. 保留诊断能力：`include_detached=true` 可返回 detached/disabled/rate-limit 等 coarse-unavailable 行，并标记 `accountPresent/accountCoarseAvailable/accountFilteredReasons`。
5. Wails DTO 与前端模型同步 `accountKey/accountPresent/accountCoarseAvailable/accountFilteredReasons`，避免前端基于旧 `authID` 猜测账号状态。


## 升级后的方案口径

原会话在用户追问“账号池管理器/粗可用账号”后，方案已从“用 `AuthManager.List()` 做 detached/disabled 过滤”升级为：

1. live-session 是观测面，只记录请求事实和消费投影，不负责自建账号可用性判断。
2. `RuntimeAccountProjection` 是 sidecar 运行态账号粗可用投影，统一承载 present、enabled、requestable、route guard / rate-limit filtered reasons、active sessions 与 route order。
3. 默认运行会话列表只展示 `CoarseAvailable=true` 的会话；排障入口 `include_detached=true` 保留全集和隐藏原因。
4. `RouteSignal / RouteConstraint / RouteScoring` 仅作为后续 selector / sticky / header signal 的基础设施，本期不接入真实请求路由热路径，避免扩大行为风险。

## 范围
- CLIProxyAPI fork reference / sidecar hot path：
  - `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/account_projection.go`
  - `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/selector_signals.go`
  - `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/live_sessions.go`
  - `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_executor.go`
  - `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/codex_websockets_executor.go`
- GetTokens Wails DTO / 前端模型：
  - `internal/wailsapp/codex_live_sessions.go`
  - `app_codex_live_sessions.go`
  - `frontend/src/features/codex-live-sessions/model/*`
  - `frontend/wailsjs/go/models.ts`
- 回归测试：live-session snapshot 过滤、Wails DTO 透传、前端 adapter / diagnostic。

## 非目标
- 不改变真实请求的账号选择、sticky、header prefer/require、channel routing、rate-limit、route guard 执行动作；本轮先抽通用 projection / signal 基础设施，并把 runtime coarse availability 投影到 live-session snapshot 出口。
- 不删除 live-session history 磁盘历史。
- 不在前端伪造 sidecar 已处理状态；账号过滤由 sidecar snapshot 出口完成。
- 不做移动端验收。

## 验收标准
1. sidecar 存在统一 `RuntimeAccountProjection`，输入来自 `AuthManager.List()`、`AccountRouteGuardStore`、账号 attributes 与 live-session active auth counts，输出包含 `Present / Enabled / Requestable / CoarseAvailable / FilteredReasons / ActiveSessions / RouteOrder`。
2. live-session 不保留 `liveSessionCurrentAuthInventory()` 这类临时 inventory 判断；默认过滤只消费 `RuntimeAccountProjection`。
3. 默认 `GET /v0/management/gettokens/live-sessions` 不返回当前账号池投影中 `accountCoarseAvailable=false` 的账号行，包括 detached、disabled、status-error、unavailable、rate-limit / route guard blocked。
4. `GET /v0/management/gettokens/live-sessions?include_detached=true` 返回诊断全集，并通过 `accountPresent=false` 标记脱离账号，通过 `accountCoarseAvailable=false` 和 `accountFilteredReasons` 标记禁用、rate-limit 等 coarse-unavailable 账号。
5. 新的 Codex HTTP / WebSocket live request 记录包含 `accountKey`。
6. Wails 和前端模型保留 `accountKey/accountPresent/accountCoarseAvailable/accountFilteredReasons`，诊断摘要输出 `account_key` 和过滤原因。
7. `RouteSignal / RouteConstraint / RouteScoring` 基础类型可编译并有测试，用于后续 sticky/header/channel score 接入；本期不改变真实路由选择行为。
8. 定向测试通过；若 sidecar reference 不能在主 module 直接测试，需说明原因，并在真正 sidecar fork 或构建产物中完成验证。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（主工作区短修，未创建独立分支）`
- worktree：`（未创建；当天可闭环小范围改动）`

## 相关链接
- 相关历史：`docs-linhay/spaces/20260531-bug-fix/README.md` Bug 006 账号激活/禁用路由语义
- 领域规则：`.agents/skills/gettokens-domain-engineering/SKILL.md`

## 验证记录
- 2026-06-03：已复现本机发布版 sidecar 的默认 live-session snapshot 仍返回旧 runtime `authID` 行；这些行缺少 `accountKey`，无法与当前 `acct_*` 账号池身份归并。
- 2026-06-03：新增/更新前端和 Wails DTO 定向测试，修复后通过：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`、`go test ./...`、`npm run typecheck`。
- 2026-06-03：`go test ./docs-linhay/references/CLIProxyAPI/internal/gettokenshooks ...` 在主仓失败，原因是 `docs-linhay/references/CLIProxyAPI` 是独立 fork reference，不属于当前 `github.com/linhay/gettokens` Go module；需要在 sidecar fork/module 内补跑。
- 2026-06-03：在 sidecar fork module 内补跑通过：`go test ./internal/gettokenshooks ./internal/gettokensrouting`；覆盖 `RuntimeAccountProjection`、detached、disabled、rate-limit / route guard coarse-unavailable，以及 `RouteSignal / RouteConstraint / RouteScoring` 基础设施。
- 2026-06-03：接管会话 `019e8c55-90c6-7140-914a-35873fe47412` 后复核“给我更好的方案”后的升级要求，补齐停在半路的 Wails 生成类型与 Wails DTO 测试，并把 space 从旧 `authDetached/authDisabled` 口径修正为 `RuntimeAccountProjection` / coarse availability 口径。
- 2026-06-03：按“mock 上下游”方案补充流程验收：sidecar 侧用 fake `AuthManager`、`AccountRouteGuardStore` 和 tracker 事件覆盖 upstream/runtime 状态；Wails 侧用 `sidecarRequest` stub 固定 management API payload；前端 adapter 用 Wails DTO fixture 验证投影。
- 2026-06-03：收尾验证通过：`go test ./...`、`cd frontend && npm run typecheck`、`cd frontend && npm run test:unit`、`cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks ./internal/gettokensrouting`、`bash docs-linhay/scripts/check-docs.sh`。
- 2026-06-03：未直接替换或重启用户当前 `/Applications/GetTokens.app`，因此发布版 App 内正在运行的旧 sidecar 仍可能显示旧 snapshot；需在后续 App 重启/打包后做真实桌面验收。

## 当前状态
- 状态：completed-dev-mock-verified
- 最近更新：2026-06-03

## 2026-06-04 复发排查：前端 live merge 重新保留已过滤行

### 现场现象
- 用户反馈正式环境最新代码中，运行会话列表仍显示 `78cline.murals+gzu@icloud.com`。
- 用户确认账号池中已经没有该账号，但列表仍出现 1 个会话行。

### 根因结论
- 2026-06-03 的 sidecar 修复已经让默认 `GET /v0/management/gettokens/live-sessions` 通过 `RuntimeAccountProjection` 过滤 detached / disabled / rate-limit 等粗不可用账号。
- 但前端 `mergeCodexLiveSessionsSnapshot()` 存在旧策略：同为 `source=live` 的后续轮询如果缺少某个 session，会把当前浏览器状态里的缺失行重新 append 回去。
- 因此 sidecar 下一轮即使已经不返回已删除账号的会话，前端仍可能把上一轮残留的 `authLabel` 行保留下来，造成“账号池没有该账号但运行会话仍显示”的假象。

### 修复口径
- `source=live` 的 sidecar poll 视为权威快照；后续 live poll 省略的行不再由浏览器保留。
- cache/failure 场景仍由 `buildCodexLiveSessionsLoadFailureSnapshot()` 负责保留上一轮真实 live 行，用于明确的 `source=cache` 状态；不得在正常 live merge 中保留 sidecar 已过滤行。

### 验证
- 新增/更新前端回归：`mergeCodexLiveSessionsSnapshot treats a later live poll as authoritative and drops omitted rows`，fixture 覆盖 `78cline.murals+gzu@icloud.com` detached 行被后续 live poll 删除。
- 已通过：`node --test frontend/src/features/codex-live-sessions/model.test.mjs`。
- `cd frontend && npm run typecheck` 未通过，失败来自当前工作区既有 OpenAI-compatible billing 改动的类型缺口（`OpenAICompatibleProvider` 缺少 `quotaCurl/quotaEnabled/billingCurl/billingEnabled/platformCookie/curlVariables`），与本次 live sessions 修复无关。

### 状态
- 状态：frontend-fix-verified-unit
- 最近更新：2026-06-04

## 2026-06-04 深层修复：账号删除/禁用时清理 sidecar live tracker

### 为什么前一版还不够
仅修前端 live merge 仍属于展示层兜底：它可以避免浏览器把已过滤行加回来，但如果 sidecar 内存 tracker 本身继续保留已删除/已禁用账号的 session，后续任何新入口、诊断入口或非前端调用仍可能再次看到旧账号身份。

### 根本原因收敛
账号池变更与 live-session tracker 缺少运行态联动：
- account-store 删除账号后会触发 runtime auth removal，但旧 live-session tracker 只依赖快照出口过滤，没有主动删除该账号的当前会话行。
- account-store 禁用账号后会 route guard + 关闭 Codex WebSocket，但旧 live-session tracker 同样保留账号行，直到 retention/clear 或前端过滤。

### 本次深层修复
- sidecar 新增 `PruneCodexLiveSessionsForAccount(authID, accountKey, reason)`，从 live-session tracker 内存态删除匹配 `authID` 或 `accountKey` 的当前会话，并同步清理 `requestMap` / active auth counts。
- `Service.applyCoreAuthRemoval()` 在 Codex auth 被删除/移除时调用 live tracker prune，再关闭 Codex WebSocket。
- `Service.applyAccountStoreStatusChange()` 在 Codex 账号禁用时调用 live tracker prune，再执行 WebSocket 关闭；重新启用只清 route guard，不恢复旧 tracker 行。
- 前端仍保留“live poll 权威快照”修复，作为 UI 层不抵消 sidecar 过滤的防线。

### 新增回归
- `TestPruneCodexLiveSessionsForAccountRemovesDeletedAccountRows`：删除 auth/account 后，只保留无关 session，active auth counts 不再含目标账号。
- `TestPruneCodexLiveSessionsForAccountMatchesAccountKeyWhenAuthIDChanged`：即使 runtime authID 已变化，只要 accountKey 命中，也能清理旧会话行。
- 继续保留前端 `78cline.murals+gzu@icloud.com` fixture，确保 UI 不再保留后续 live poll 省略的 detached 行。

### 验证
- `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
- `cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks ./internal/gettokensrouting ./sdk/cliproxy`
- `bash docs-linhay/scripts/check-docs.sh`
- `./scripts/ensure-sidecar.sh darwin arm64`，dev sidecar 已重建到 `build/bin/cli-proxy-api`；未触碰正式版 `/Applications/GetTokens.app`。

### 状态
- 状态：sidecar-root-fix-and-frontend-guard-verified
- 最近更新：2026-06-04
