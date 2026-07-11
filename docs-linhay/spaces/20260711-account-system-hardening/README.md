# Account System Hardening

## 背景

GetTokens 账号体系已经从文件账号、配置项、API key 列表迁移到 SQLite account-store，但当前运行链路仍同时存在多份状态：

- 资产态：SQLite account-store、auth-file payload、codex-api-key/openai-compatible credential。
- 运行态：sidecar auth manager、model registry、route guard、quota/rate-limit、live sessions、usage attribution。
- 展示态：Wails DTO、前端 account cache、Codex/Claude channel routing rows、账号详情 modal。

近期问题反复暴露同一类结构性脆弱点：读接口带副作用、App 与 sidecar 各自推断账号语义、OAuth refresh 被多路径放大、模型目录依赖当前进程内存、运行态失败污染账号基础展示。单点修补可以止血，但不能保证后续不再出现“DB 正常、卡片异常、模型列表为空、路由候选被清空”的同类问题。

## 目标

1. 建立账号体系的状态所有权模型：明确资产态、运行态、展示态分别由谁读写。
2. 收敛 App 与 sidecar 的账号契约：共享 API schema、DTO/read model、validation/normalization，避免重复推断；sidecar 独占主 SQLite。
3. 固化 sidecar runtime authority：运行态写入和 reconcile 只在 sidecar 内闭环，App 不直接写 runtime 状态。
4. 拆分 management API 的 read / command / reconcile / probe 边界，禁止读接口无条件修改运行态。
5. 建立 OAuth refresh 单飞、租约和追踪日志，降低 `refresh_token_reused` 被本地多进程/多路径放大的概率。
6. 统一模型目录来源和 fallback：模型能力不能只依赖某个当前进程 registry。
7. 建立跨层回归测试矩阵，覆盖 mock upstream facts、mock downstream/spy outputs、SQLite 持久化、Wails DTO、前端展示。

## 范围

- SQLite account-store schema、migration、read model、runtime apply state 的边界审计与必要重构。
- sidecar management API：账号详情、账号列表、账号模型、禁用/启用、刷新、apply/reconcile、probe。
- Wails App 与 sidecar 的数据访问边界：App 通过 sidecar API 读取资产 snapshot；如需只读加速，只允许 sidecar 导出的版本化只读投影，不允许 App 直连主 SQLite。
- Codex OAuth/auth-file、Codex API key、openai-compatible、Claude auth-file 的统一账号语义。
- Codex/Claude Channel Routing、route guard、quota/rate-limit、model registry 与账号资产的同步链路。
- dev profile 复制正式数据复现流程、正式环境只读诊断流程、日志追踪字段。

## 非目标

- 不重做账号卡视觉设计，除非展示态字段拆分需要最小 UI 调整。
- 不在本 space 内直接迁移所有历史 auth-file 格式；只处理影响统一账号库和运行态稳定性的路径。
- 不把上游 OAuth 服务端限制伪装成本地可完全修复的问题；本地只负责避免重复刷新、错误放大和状态误写。
- 不让 App 直连主 SQLite DB。共享账号契约不等于共享数据库访问权；主库文件由 sidecar 独占。
- 不触碰正式版二进制、正式 sidecar 或正式配置；正式环境只做只读诊断，验证默认在 dev profile 或测试 DB。

## 证据门禁

每个候选修复进入实现前，必须在本 space 或 `plans/` 中补齐以下证据：

| 维度 | 必填内容 |
| --- | --- |
| 问题来源 | 用户反馈、线上日志、测试失败、可复现命令或 UI 截图 |
| 事实位置 | 相关代码路径、API、SQLite 表、runtime 组件、前端消费点 |
| 当前现象 | 具体异常字段、接口响应、日志片段或状态差异 |
| 预期行为 | 哪一层是权威真源，哪些字段应保持稳定 |
| mock upstream facts | 上游返回、OAuth/token、model catalog、quota/route guard 输入 |
| mock downstream/spy outputs | 应写入的 DB 状态、runtime auth/model registry、API 响应、UI view model |
| 可证伪条件 | 哪些结果说明当前候选根因不成立 |
| 验收方式 | 单元测试、服务级测试、Wails DTO 测试、前端测试、dev profile smoke |

## 目标架构原则

### 1. 账号资产态

- 权威真源：SQLite account-store。
- 内容：账号 identity、credential metadata、provider、plan、models config、disabled、priority、proxy/quota/billing 配置。
- App 只能通过 sidecar API 读取资产 snapshot，用于列表和详情基础展示；不得直接打开主 SQLite DB。
- 资产写入必须经过统一 validation/normalization，不允许前端或 Wails 私自拼 legacy 语义。
- 如果未来需要 App 本地只读加速，只能读取 sidecar 生成的版本化投影库/快照，且该投影不能参与任何状态机决策。

### 2. 运行态

- 权威真源：sidecar runtime。
- 内容：auth manager、model registry、route guard、quota/rate-limit、live sessions、usage attribution、runtime apply/routeability。
- 运行态写入只允许 sidecar 的 command/reconcile/probe 路径触发。
- 读接口不得无条件 apply/reconcile/refresh。需要恢复 pending 状态时必须显式、有界、可追踪。

### 3. 展示态

- 权威输入：资产 snapshot + 运行态 evidence。
- UI 基础身份、provider、plan、source、disabled 来自资产态。
- routeability、quota、rate-limit、model registration、last error 作为 evidence 展示，不得覆盖资产身份。
- 前端 cache 只能缓存 view model，不能成为状态真源。

### 4. 模型目录

- Codex OAuth/auth-file：优先 runtime registry；registry 缺失时按 account-store `plan_type` 回退 Codex 静态模型集。
- Codex API key：显式 models 优先；空 models 表示默认 Codex 模型集，不表示无模型。
- openai-compatible：account-store 自描述 `models_json` / runtime auth attributes 是真源，不回查旧 config。
- 模型映射保存只保存显式 alias；OAuth/auth-file 同名透传不写成显式 alias。

### 5. OAuth refresh

- 同一个 account/auth source 同一时刻只能有一个本地 refresh 执行者。
- refresh 结果要带 trace：source、account_key、auth_id、refresh lease、old/new expiry、error class、是否写回。
- `refresh_token_reused` 属于上游不可重试错误，但本地必须能判断是否由重复本地 refresh 放大。
- dev 复制正式数据验证时必须隔离 profile，并在验证后恢复 dev DB。

## 分期计划

### Phase 0：现状地图与状态机

- 梳理 account-store 表、runtime apply state、sidecar auth manager、model registry、route guard、quota/rate-limit、Wails DTO、前端 cache 的读写矩阵。
- 输出状态所有权图和 API 分类表：read / command / reconcile / probe。
- 标记所有读接口副作用、重复 provider 推断、runtime 写入路径。
- 验收：文档 + 现状测试基线，不改运行逻辑。

调查结论：

- 当前 Wails 正常账号列表通过 sidecar management API 读取，但首屏 `ListCachedAccounts()` 仍直接 read-only 打开主 `accounts-v1.sqlite`。
- sidecar `GET /accounts` 会对 pending 账号触发 `applyPendingAccountStoreRuntime()`；`GET /accounts/:account_key` 仍会对 pending 调用 `applyAccountStoreRuntime()`。
- OAuth refresh 已有 per `auth.ID` 锁和 `OnAuthUpdated` route guard 写入，但重复资产共享 OpenAI/ChatGPT `account_id` 时还缺 provider-identity 级 singleflight。
- 模型能力需要统一 resolver：Codex OAuth/auth-file、Codex API key、openai-compatible 不能各自用一套 registry/fallback 逻辑。

### Phase 1：读写边界止血

- 禁止读接口无条件触发 runtime apply/refresh。
- 将账号详情、模型列表、quota/status 类接口拆出无副作用 read path。
- 对必要的 pending recovery 使用显式 command 或 bounded reconcile。
- 增加轻量 diagnostics/trace，能证明状态迁移来自 command/reconcile/probe，而不是 GET。
- 验收：服务级测试断言读详情不改变 applied/registered 状态；模型接口缺 registry 时仍能返回正确 fallback。

实现进展：

- sidecar `GET /v0/management/accounts` 不再对 pending 账号调用 `applyPendingAccountStoreRuntime()`。
- sidecar `GET /v0/management/accounts/:account_key` 不再对 pending 账号调用 `applyAccountStoreRuntime()`。
- 新增显式 `POST /v0/management/accounts/reconcile` 与 `POST /v0/management/accounts/:account_key/reconcile`，用于 pending runtime apply。
- 测试覆盖 pending GET 纯读、snapshot GET 纯读、显式 reconcile apply、Codex 模型 fallback。

### Phase 2：OAuth refresh 单飞与追踪

- 为 Codex OAuth refresh 增加 per-account singleflight / lease，避免多 goroutine、多 watcher、多进程路径同时刷新同一 token。
- 增加 refresh trace 日志与 management diagnostics。
- 将 `refresh_token_reused` 分类为不可重试上游错误，同时记录本地重复执行证据。
- 验收：mock OAuth upstream 只收到一次 refresh；并发刷新只一个写回；错误不污染模型目录基础展示。

实现进展：

- sidecar auth manager refresh lease 从 runtime `auth.ID` 扩展到 `provider + provider identity`。
- Codex OAuth/auth-file provider identity 优先读取 `account_id` / `chatgpt_account_id` / `openai_account_id`。
- 并发同身份刷新会复用同一轮 lease result，mock upstream 只收到一次 refresh。
- refresh 日志新增脱敏 `refresh_lease_hash`。

### Phase 3：IPC 契约与数据库隔离

- 评估把账号 API schema、DTO/read model、validation/normalization 抽成共享契约或生成物，而不是共享主 DB 访问。
- sidecar 独占主 SQLite；App 通过 management API 获取账号 snapshot。
- 如确需只读投影，先设计 sidecar 导出的版本化投影库/快照：TTL、schema version、字段范围、禁止状态机决策。
- 验收：Wails DTO 与 sidecar management API 对同一 fixture 输出一致；`lsof`/测试证明 App 不打开主 `accounts-v1.sqlite`。

实现进展：

- sidecar 新增 `GET /v0/management/accounts/snapshot?allow_stale=1`，复用纯读账号列表逻辑。
- Wails `ListCachedAccounts()` 改为调用 sidecar snapshot API，不再直接打开主 `accounts-v1.sqlite`。
- 删除 Wails 侧 `account_store_snapshot.go` 中的 SQLite schema parser / `sql.Open` / read-only DSN。
- 前端首屏变量从 `sqliteSnapshot` 收敛为 `accountSnapshot`。

### Phase 4：runtime authority 与 command bus

- 明确 App 写操作统一走 sidecar command：create/update/disable/enable/delete/refresh/apply/probe。
- sidecar command 负责 DB mutation、runtime reconcile、model registry、route guard、quota job cancel/refresh。
- App 不直接写 runtime apply state，不绕过 sidecar 更新运行态。
- 验收：spy sidecar command 测试 + SQLite 状态 + runtime auth/model registry 同步断言。

实现进展：

- App 首屏快照已改为 sidecar `GET /v0/management/accounts/snapshot?allow_stale=1`；静态检查确认 Wails `ListCachedAccounts()` 不再 `sql.Open` 主 `accounts-v1.sqlite`。
- runtime apply 仍保留在 sidecar command / reconcile / login callback 路径，不再由账号列表或账号详情 GET 隐式触发。
- `GET /v0/management/gettokens/account-system-doctor` 提供只读 command/reconcile 结果证据，便于后续定位 DB/runtime 是否对齐。

### Phase 5：模型目录与路由候选一致性

- 统一 `/models`、route explain/probe、真实请求的模型能力来源。
- 对 Codex OAuth/API key/openai-compatible 建立同一组 fixture。
- 验收：同一个账号在 `/accounts/:id/models`、`/v1/models`、route explain/probe、前端详情的模型目录中表现一致。

实现进展：

- sidecar 新增 `internal/gettokens/modelcatalog`，统一 registry、Codex plan fallback、Codex API key default、openai-compatible self-described models 与 fail-closed 规则。
- `GET /v0/management/accounts/:account_key/models` 改用统一 resolver，并返回 `source`、`routeable`、`reason` 追踪字段。
- auth manager legacy route filter 与 scheduler fast path 均改用统一 resolver；Codex OAuth registry 缺失时仍能按 `plan_type` 参与模型路由。
- openai-compatible 只使用 account-store/runtime 自描述模型；缺失模型时 fail closed，不回退旧 config。

### Phase 6：dev/正式诊断与迁移护栏

- 固化正式环境只读诊断脚本和 dev profile 数据复制/恢复脚本。
- 增加 account-system doctor：检查 DB、runtime registry、routeability、models、quota/rate-limit 的一致性。
- 验收：在 dev profile 中可用复制的正式 DB 复现并生成脱敏报告；不写正式路径。

实现进展：

- 新增 `GET /v0/management/gettokens/account-system-doctor` 只读诊断端点，汇总 total/disabled/pending/failed/missing runtime auth/unrouteable catalog/runtime orphan/model source counts。
- doctor per-account evidence 返回账号 key、kind、provider、runtime apply/routeability、auth id、model catalog source/count/routeable/reason，不返回 secret。
- 服务级测试覆盖 Codex OAuth plan fallback 与 openai-compatible 空模型 fail-closed 的 doctor 输出。

### Phase 7：route guard evidence 展示投影

- 问题来源：dev profile 按正式数据重建后，目标 Codex OAuth 账号在 snapshot/detail 中仍是 `applied / registered_routeable`，但 sidecar 日志和 doctor diagnostics 同时显示 active route guard `auth-error`，原因是上游返回 `refresh_token_reused`。
- 事实位置：sidecar management `GET /v0/management/accounts`、`GET /v0/management/accounts/:account_key`、route guard store、Wails `BuildUnifiedAccountRecords()`、前端账号卡状态。
- 当前现象：卡片可显示“可用”，但真实请求/refresh 已被 route guard 阻断，用户看到“可用/异常”摇摆。
- 预期行为：账号资产态和 SQLite runtime apply state 不被读接口改写；management 读响应要叠加 active route guard evidence，输出 degraded reason/failure class，让卡片和详情能展示真实阻断。
- mock upstream facts：route guard store 已存在 `auth-error` block，block 绑定同一 account key/auth id，reason 包含 `refresh_token_reused`。
- mock downstream/spy outputs：detail 和 snapshot JSON 投影 `runtime_routeability_status=degraded`、`runtime_failure_class=auth-error`、`runtime_routeability_reason` 包含 `refresh_token_reused`；SQLite 中原始 runtime routeability 仍为 `registered_routeable`。
- 可证伪条件：若 route guard block 清除后响应仍 degraded，或读接口把 SQLite 持久状态写成 degraded，说明实现越界。
- 验收方式：sidecar management 服务级测试 + dev profile API smoke。

## 验收标准

- 账号详情 read path 连续读取不会改变 runtime apply/routeability 状态。
- App 与 sidecar 对同一账号 fixture 输出一致的 provider、kind、plan、models、disabled、source。
- App 不直接打开主 `accounts-v1.sqlite`；所有主库读取和写入由 sidecar 负责。
- Codex OAuth/auth-file 模型列表在 runtime registry 缺失时仍能按 plan 显示模型，不显示为空。
- OAuth refresh 并发测试中，同一账号同一时间只有一次 upstream refresh。
- `refresh_token_reused` 不会把账号资产态改坏，不会清空模型目录，只会作为运行态 evidence 展示。
- openai-compatible 的模型能力完全来自 account-store 自描述，不回退旧 config。
- route explain/probe 与真实请求使用同一模型能力判断。
- dev profile 复制正式 DB 验证后能自动恢复原 dev DB。
- 相关测试覆盖：sidecar 服务级测试、account-store 测试、Wails DTO 测试、前端 view-model 测试、必要时 dev API smoke。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：本 space 以架构和运行态治理为主；只有涉及诊断 UI 或 account-system doctor 页面时才新增设计稿。单期只保留一个 HTML 文件。

## Worktree 映射

- branch：`feat/20260711-account-system-hardening`
- worktree：`../GetTokens-worktrees/20260711-account-system-hardening/`

## 相关链接

- `docs-linhay/spaces/20260711-account-system-hardening/plans/technical-design.md`
- `docs-linhay/spaces/20260711-account-system-hardening/plans/account-state-ownership.md`
- `docs-linhay/spaces/20260711-account-system-hardening/plans/management-api-boundary.md`
- `docs-linhay/spaces/20260711-account-system-hardening/plans/runtime-consistency-fixtures.md`
- `docs-linhay/spaces/20260711-account-system-hardening/plans/wise-council-verdict.md`
- `docs-linhay/dev/account-credential-sqlite-store-design.md`
- `docs-linhay/dev/20260615-account-store-runtime-routeability.md`
- `docs-linhay/dev/20260616-gettokens-domain-glossary.md`
- `docs-linhay/spaces/20260710-codex-refresh-token-singleflight/README.md`
- `docs-linhay/spaces/20260511-codex-account-list-tab/README.md`
- `.agents/skills/gettokens-domain-engineering/SKILL.md`
- `.agents/skills/gettokens-codex-account-list/SKILL.md`

## 当前状态

- 状态：implemented
- 最近更新：2026-07-11
