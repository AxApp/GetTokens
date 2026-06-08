# Sidecar / 路由运行态体验巡检报告

轮次：第 1 轮：体验 + 代码逻辑审核

## 体验范围

本报告从“sidecar / 路由运行态体验者”视角巡检 GetTokens dev 环境，重点覆盖：

- sidecar 热路径启动、配置目录、日志与管理接口体验
- Codex / Claude channel routing、账号候选选择、route guard、rate-limit / cooldown
- 模型映射、模型可用性与 WebSocket / HTTP fallback
- session affinity、WebSocket pinned auth、retry / fallback
- usage attribution、live sessions、运行态诊断与用户可解释性

本报告同时做代码逻辑审核，关注 sidecar 路由、账号选择、状态闭环、错误处理、测试缺口与维护性。建议清单中用 `类型` 标注业务体验、代码逻辑或混合问题。

本轮只读取仓库与 dev 数据目录 `/Users/linhey/.config/gettokens-dev/`，未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改正式数据目录 `/Users/linhey/.config/gettokens/`。

## 方法

- 读取并遵守 `AGENTS.md`、本 space `README.md`、`plans/dev-data-prep.md`。
- 读取项目级 skill：`gettokens-domain-engineering`、`gettokens-codex-account-list`。
- 只读检查核心代码：
  - `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/*`
  - `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/*`
  - `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/auth/*`
  - `internal/wailsapp/channel_routing.go`
  - `internal/wailsapp/codex_routing_probe.go`
  - `internal/wailsapp/codex_live_sessions.go`
  - `internal/wailsapp/usage_attribution.go`
- 只读检查 dev 数据：
  - `accounts-v1.sqlite`：58 张历史账号卡，当前未删除账号中 Codex auth-file / api-key / openai-compatible 均存在，且部分 channel order 账号处于 disabled。
  - `usage-attribution-v1.sqlite`：42060 条 usage attribution 事件，3 条 rate-limit 规则，其中 1 条仍绑定 legacy `codex-api-key:*`。
  - `live-sessions-v1.sqlite`：41352 条 live request history。
  - `channel-routing/config.json`：Codex 为 `balanced`，历史 explain events 多次出现 `candidateCount=0` / `filteredCount>0`。
  - `sidecar.log`：管理接口轮询高峰出现 1s-2.7s 延迟，并反复记录 `SQLITE_BUSY`。

代码逻辑审核依据：

- `internal/gettokensrouting/engine.go` 已按 hard-filter -> pool-scope -> request -> sticky 排序执行 policy，`account-route-guard` 注册在 hard-filter，`channel-routing` / `project-candidate-pool` 注册在 pool-scope。
- `sdk/cliproxy/auth/routing_policy.go` 已把 `SessionAffinitySelector` 作为 sticky policy 附加到 route engine，并把 rate-limit admission 放在选中 auth 后执行。
- `internal/gettokenshooks/rate_limit.go` 已实现 request-window admission reservation，但 dev 数据中仍存在 legacy `codex-api-key:*` rate-limit rule，说明迁移/诊断闭环仍有缺口。
- `internal/wailsapp/codex_routing_probe.go` 仍保留 `X-GetTokens-Route-*` 探测 header 和 usage delta 命中识别，和当前不恢复旧公共请求级调试入口的边界冲突。
- `internal/wailsapp/channel_routing.go` 本地实现 route explain，真实 sidecar 热路径则在 CLIProxyAPI fork 的 `internal/gettokensrouting` / `internal/gettokenshooks`，两套 explain 逻辑存在漂移风险。
- `internal/gettokenshooks/live_sessions.go` 和 `usage_attribution.go` 已有 runtime tracker / attribution ledger，但 request id、account key、route trace、错误日志之间缺少统一诊断索引。

## 建议清单

### 1. 路由探测仍依赖旧 `X-GetTokens-Route-*` header

类型：代码逻辑 + 业务体验

问题：`internal/wailsapp/codex_routing_probe.go` 中 `ProbeCodexAccountRouting` 仍通过 `X-GetTokens-Route-Allow / Deny / Fallback` 影响请求，并用 `/v1/chat/completions` 加 usage delta 推断命中账号。这与当前“路由 registry 收敛到 `internal/gettokensrouting`、不恢复旧请求级调试入口”的边界不一致。

影响：用户在 Codex 请求顺序页做探测时，看到的是旧 header 注入口和 usage 侧面证据，而不是 route engine 的真实决策链。遇到 route guard、project candidate pool、session sticky、WebSocket pinned auth 时，探测结果可能与实际 `/v1/responses` 热路径不一致。

建议改法：新增 sidecar management debug endpoint，例如 `POST /v0/management/gettokens/route-probe`，输入 channel、model、候选约束、project context、transport intent，由 sidecar 内部调用 `internal/gettokensrouting` explain + 可选最小真实请求。Wails `ProbeCodexAccountRouting` 改为调用该 endpoint；旧 `X-GetTokens-Route-*` header 只保留为迁移测试 fixture，不再作为 UI 探测入口。

验收方式：新增 Wails 测试确认 `ProbeCodexAccountRouting` 不再设置 `X-GetTokens-Route-*`；新增 sidecar 测试覆盖 channel routing + route guard + project candidate pool explain；真实 dev 探测中返回 `selectedAuthID`、过滤原因、policy trace，并能与 live sessions 的 request row 对齐。

### 2. Channel routing 历史事件只有数量，缺少过滤原因摘要

类型：业务体验 + 诊断闭环

问题：`channel-routing/config.json` 的历史事件只记录 `candidateCount` / `filteredCount`，dev 数据里多次出现 `candidateCount=0`、`filteredCount=6/18/19`，但事件本身不记录主要过滤原因分布。

影响：当用户看到“没有可路由账号”时，只能知道“全被过滤了”，无法判断是 disabled、waiting-check、model unavailable、runtime-rate-limit、project pool 冲突还是 group disabled。运行态体验上，排障需要再打开多个页面或查日志。

建议改法：扩展 `ChannelRouteEvent`，记录 redacted 的 `filteredReasonCounts`、`topFilteredReasons`、`selectedAccountPresent`、`projectCandidatePool.reason`。保持不记录账号敏感明细，最多记录 reason -> count 和当前 selected id 是否为空。

验收方式：针对 `appendChannelRouteEvent` 增加单测，输入多个 filtered reasons 后事件能保存 reason counts；前端 recent route events 能显示“候选为空：account-disabled 4、waiting-check 2”等摘要；dev 数据里再次 explain 后无需查日志即可判断 candidateCount=0 的主因。

### 3. Rate-limit 规则仍有 legacy account key，运行态会静默失效

类型：代码逻辑 + 状态闭环

问题：dev `usage-attribution-v1.sqlite` 中 3 条 rate-limit rule 里有 1 条绑定 `codex-api-key:26b1c3ff958f`，但当前规则要求新写入必须使用 `acct_*` account key。代码的 rule validator 会阻止新 legacy 写入，但已有 legacy 规则仍可能留在库里。

影响：用户以为某个账号有 token-window 限流，实际 evaluator 只按 `account_key = ?` 查 usage，legacy key 与当前 attribution 的 `acct_*` 不能稳定匹配，导致规则不触发或诊断显示与账号卡不一致。

建议改法：在 rate-limit store 初始化或 management list 时做只读诊断：标记 legacy-bound rules 为 `unresolvedLegacyAccountKey`，并提供显式迁移动作，把 `codex-api-key:* / auth-file:* / openai-compatible:*` 经 `account_runtime_identities` 或 account store 解析到 `acct_*`。无法解析时禁用规则并显示原因，不要静默参与 evaluator。

验收方式：用 fixture 建 legacy rule，`GET /gettokens/rate-limit-rules` 返回诊断字段；迁移动作后 rule.account_key 变为 `acct_*` 且 evaluator 能命中 usage；无法解析的 legacy rule 不会产生 route guard block，并在 UI 中显示“需重新绑定账号卡”。

### 4. Usage attribution 仍存在未归因和 legacy key 聚合

类型：业务体验 + 状态闭环

问题：dev usage ledger 中存在 650 条空 `account_key` 事件，也有 `auth-file:*`、`codex-api-key:*` 等 legacy account key 聚合。`account_runtime_identities` 目前主要看到 legacy/source-key 映射，未体现所有运行时 auth id 到 `acct_*` 的覆盖。

影响：Usage Desk、rate-limit、live sessions 之间很难形成同一账号卡视角。用户看到额度或请求数时，可能同一个真实账号拆成 `acct_*`、`auth-id:*`、`auth-file:*` 多组，导致限流判断和账单归因都不可靠。

建议改法：新增 attribution reconciliation job：按 `auth_id`、`auth_index`、runtime identity、source-key 逐步回填 `account_key`，并生成 `unresolved_reason` 统计。管理 API 返回 `resolvedCount / unresolvedCount / legacyKeyCount`，前端只展示汇总诊断，不暴露 token/source 原文。

验收方式：构造含 `auth-id`、`auth-index`、legacy source-key 的 usage fixture，运行 reconciliation 后同一账号聚合到 `acct_*`；无法解析的事件保留 unresolved reason；usage summary 中 legacy key 分组下降，rate-limit 规则按 `acct_*` 能统计到历史使用量。

### 5. Sidecar 管理接口轮询会放大 SQLite 锁竞争

类型：代码逻辑 + 性能体验

问题：dev `sidecar.log` 中同一时间段密集出现 `/quota-status`、`/rate-limit-status`、`/usage-attribution`、`/rate-limit-rules` 调用，部分接口耗时 1s-2.7s，并反复记录 `periodic usage snapshot persist failed error=database is locked (5)`。

影响：用户打开账号详情或运行态页面时，诊断面板本身会加重 SQLite 读写竞争，导致页面慢、快照旧、rate-limit/usage 状态延迟更新。体验上像 sidecar 不稳定，但根因是管理接口和持久化任务没有足够调度。

建议改法：为 usage/rate-limit/quota 管理接口引入短 TTL 只读快照缓存和请求合并：同一 1-2 秒窗口内复用结果；写入端设置 SQLite `busy_timeout`、WAL 模式和有限重试；周期性 usage persistence 遇到 busy 时记录 degraded counter，不每次都打普通 warn。

验收方式：增加并发测试模拟 usage summary 查询 + periodic persistence，确认不会持续 `SQLITE_BUSY`；dev 打开账号详情 30 秒内 sidecar log 不再出现连续 busy warn；接口 P95 明显低于 500ms，且前端显示 `cache/live/degraded` 来源。

### 6. Route explain 与真实 sidecar engine 仍有两套实现

类型：代码逻辑 + 维护性

问题：Wails `ExplainChannelRouting` 在 `internal/wailsapp/channel_routing.go` 中用前端/账号列表 DTO 自己实现了 candidate pool、runtime state、sticky、project pool explain；真实 sidecar 热路径则在 `internal/gettokensrouting` + `gettokenshooks` 中执行。

影响：UI explain 可能解释的是 Wails 当前账号快照，而真实请求使用 sidecar AuthManager、model registry、route guard 和 admission policy。两边在 requestability、model support、active sessions、guard source 上任何轻微差异都会造成“解释说 A，实际选 B”。

建议改法：让 sidecar 暴露 route explain management endpoint，返回真实 `RouteResult.Trace`、candidate projection、admission dry-run 和 model registry 过滤原因。Wails `ExplainChannelRouting` 保留 browser preview 纯模型实现，但 desktop mode 以 sidecar explain 为准。

验收方式：新增集成测试注册真实 auth、route guard、channel config 后调用 management explain，断言 trace 顺序为 hard-filter -> pool-scope -> sticky；Wails desktop 测试 mock sidecar explain，确认不会走本地解释；browser preview 仍可用 mock 数据。

### 7. Session affinity 失败预算缺少可视化诊断

类型：业务体验 + 错误处理可解释性

问题：代码已经有 `FailureBudget`、`RecordRouteFailure`、`BumpPoolEpoch`，但用户侧看不到某 session 当前绑定账号、失败次数、pool epoch、何时会释放 sticky。

影响：当账号短时 429、401 或 stream closed 后，用户只能看到下一次请求换没换账号，无法判断是 failure budget 尚未耗尽、route guard 命中、还是 pool epoch 未 bump。尤其 balanced 模式下，这会被误解成排序失效。

建议改法：在 live session detail 或 route explain 中加入 `affinity` 小节：`sessionKey`（脱敏）、`boundAuthID/accountKey`、`failureCount/failureBudget`、`poolEpoch`、`lastFailureReason`、`nextDecision`。只暴露脱敏 session key，不暴露 payload。

验收方式：单测模拟同 session 两次 429，explain 显示第一次仍 sticky、第二次释放；禁用账号后 pool epoch 增加并显示 sticky invalidated；live session detail 能看到当前请求为何继续使用原账号。

### 8. WebSocket pinned auth 的释放原因没有形成用户可读链路

类型：代码逻辑 + 业务体验

问题：代码中有 pinned auth metadata、WebSocket transport failure 分类和 no route guard 回归，但用户界面侧没有完整展示“当前 WS pinned 到哪个 auth、因为什么释放、下一请求是否 HTTP fallback”。

影响：遇到 `408 stream closed before response.completed`、DeepSeek HTTP fallback、禁用账号热切时，用户只能看到 WebSocket 断开或 HTTP 请求失败，难以判断 GetTokens 是否正确释放 pin、是否避免了全局 auth_unavailable。

建议改法：在 live sessions timeline 增加 pinned-auth lifecycle event：`pinned_auth_set`、`pinned_auth_released`、`ws_circuit_open`、`http_fallback_requested`，并在 route explain 中标注 `transportIntent=websocket/http` 与 pinned auth 是否参与候选。

验收方式：mock WebSocket 408 测试中，live session history 记录 `ws_circuit_open` 且没有 route guard block；禁用 pinned 账号后下一请求 explain 显示 pin released by manual-disabled；DeepSeek WS 首包关闭后 timeline 显示 retry over HTTP。

### 9. 模型可用性失败与账号可用性失败还不够分层

类型：代码逻辑 + 错误处理

问题：Wails runtime state 中 `model-unavailable`、`auth-error`、`rate-limit` 都以 account runtime source 存储；sidecar route guard 中 404/model unavailable 与 auth/account guard 的边界不完全显式。dev live history 里 `deepseek-v4-flash` 既有 failed、active、streaming 记录，大小写模型如 `GPT 5.5` / `GPT-5.5` 也出现 active。

影响：某个模型不可用时，用户可能看到整个账号被排除；模型大小写或 alias 错误时，诊断也容易落到“无账号可用”，而不是“该账号没有声明这个 client-facing model”。

建议改法：把 model availability guard 拆成 accountKey + model 的 runtime state，不直接等同于 account-level guard。route explain 输出模型过滤原因：`model-not-declared`、`alias-case-mismatch`、`upstream-model-404`、`websocket-not-supported-for-model`。

验收方式：创建同账号支持 `deepseek-v4-flash` 但不支持 `GPT-5.5` 的 fixture，explain 只过滤对应模型，不影响其他模型；模型 alias 大小写测试能提示 slug/display_name 差异；404 model unavailable 不生成全账号 cooldown。

### 10. Live session history 体量大，但排查入口仍偏实时快照

类型：业务体验 + 诊断闭环

问题：dev `live-sessions-v1.sqlite` 已有 41352 条历史 request。当前 snapshot 默认只保留内存实时窗口，history endpoint 支持分页，但用户常见排障入口仍是实时列表，缺少“从某个错误、request id、account key、model 反查历史”的工作流。

影响：当用户复盘“某个账号为什么刚才被跳过”或“某个模型什么时候开始失败”时，需要在 usage、日志、live sessions 间人工拼 request id。数据有，但体验没有形成可追溯链路。

建议改法：扩展 live session history 查询过滤：`account_key`、`auth_id`、`model`、`status`、`transport`、`request_id`、`since/until`。在 route events / usage details / error logs 中提供跳转到 live history 的 request id 链接。

验收方式：后端 history fixture 覆盖 account/model/status 过滤；前端从 usage detail 点击 request id 能打开对应 live history；查询结果不返回 raw payload，只返回 redacted timeline、status、timing、account/model。

### 11. Sidecar 诊断缺少“当前 dev 真源路径”总览

类型：业务体验 + 运维诊断

问题：sidecar 启动和日志会打印 usage/rate-limit store path，但工作台没有一个集中位置显示当前使用的 config path、account store path、channel routing path、usage ledger path、live history path、profile、binary git hash。

影响：本轮数据准备明确把正式数据复制到 `/Users/linhey/.config/gettokens-dev/`，但体验者仍需要查日志和代码确认每个运行态 store 是否真的走 dev。后续排查很容易误以为读到了正式数据或旧 `.config/gettokens-data`。

建议改法：新增只读 diagnostics endpoint `/v0/management/gettokens/runtime-diagnostics`，返回 profile、configFile、writableBase、store paths、sidecar git hash、registry policy names、admission policy names、SQLite health counters。前端状态页提供“运行态真源”面板。

验收方式：dev 启动后 diagnostics 全部路径指向 `gettokens-dev`；prod 启动显示 `gettokens` 且不泄露 API key；测试断言返回 policy names 包含 `account-route-guard`、`channel-routing`、`project-candidate-pool`、`rate-limit-admission`。

### 12. 运行态日志有错误文件，但缺少按 request id 的统一索引

类型：代码逻辑 + 诊断闭环

问题：dev `logs/` 中有多份 `error-v1-responses-*` 文件，内容包含 `auth_unavailable: no auth available`，但与 usage attribution、live session history、route events 的 request id 关联不明显。`sidecar.log` 又以管理接口日志为主，排查一次失败需要跨文件 grep。

影响：用户遇到 “Codex 请求失败” 时，无法从一个请求 id 一路追到 route decision、auth selection、upstream error、usage attribution、live timeline。体验上需要熟悉内部文件布局，不适合普通操作员。

建议改法：建立 request diagnostics index：每个 request id 记录 route trace hash、selected auth/account、status、error log file、usage event id、live request key。管理 API `GET /gettokens/request-diagnostics/:request_id` 返回脱敏汇总和相关链接。

验收方式：制造一次 mock 500 和一次 mock 429，请求完成后能通过 request id 查询到 route trace、error file、usage event、live request；响应不包含 Authorization、payload 原文或 API key；前端错误 toast 可跳转到该诊断详情。

## 优先候选

1. **替换 Codex 路由探测旧 header 入口**：这是最直接的边界风险，当前 Wails probe 还在使用 `X-GetTokens-Route-*`，会持续制造“旧 RoutePolicy 已删除但 UI 仍像在用旧系统”的误解。修复范围中等：新增 sidecar explain/probe endpoint，Wails 改调用，补测试即可。

2. **修复 rate-limit legacy key 诊断和迁移**：dev 数据已经出现 legacy `codex-api-key:*` rule，属于真实体验问题。修复范围中等：不需要重构 evaluator，只需要 rule list 诊断、迁移/禁用动作和回归测试。

3. **管理接口快照缓存 + SQLite busy 治理**：日志中反复出现 `SQLITE_BUSY` 且管理接口延迟明显，会直接影响账号详情、Usage Desk、rate-limit 和 quota 体验。修复范围可控：加 busy timeout、短 TTL 快照、请求合并和 degraded counter。

## 风险 / 未覆盖

- 本轮未对真实上游发请求，未消耗额度；WebSocket / HTTP fallback 结论来自代码、测试和 dev 历史数据。
- 未启动或重启 dev sidecar；日志为 dev 目录既有日志，按时间和路径做体验归因，不能视作全新复现。
- 未检查正式版 `/Applications/GetTokens.app` 和正式数据目录。
- 未运行自动化测试；本任务是只读巡检和文档写入，后续进入修复阶段时应按候选分别补 Go / Wails / 前端回归测试。
