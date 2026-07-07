# Request Speed Decay Investigation

## 背景

- 用户反馈：重启 GetTokens app 后请求速度会变快，但只持续几分钟，之后又变慢。
- 本轮只做定位与证据保留；不 kill、不重启、不替换 `/Applications/GetTokens.app` 正式版，也不修改正式配置目录数据。

## 目标

- 解释“重启后短暂变快，随后变慢”的本地机制。
- 区分 GetTokens sidecar 本地放大问题与上游请求本身耗时。
- 给出最小后续修复切片和验收方式。

## 范围

- 正式运行态只读观察：进程、端口、日志、SQLite schema/count、配置文件路径。
- 源码追踪：`docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/` 内 rate-limit、usage attribution、usage persistence 热路径。
- 不进入真实外部账号请求、不清理正式数据库、不调整正式版 app。

## 非目标

- 不在本轮直接修复 sidecar 二进制。
- 不用重启正式版来制造对照实验。
- 不把所有 `/v1/responses` 慢请求都归因到本地；上游并发和模型响应仍可能贡献 10s+ 底噪。

## 验收标准

- 能指出正式 sidecar 的慢路径代码位置。
- 能用正式日志量化“几分钟后变慢”对应的锁竞争、候选扫描或后台轮询放大。
- 能用正式 SQLite 数据说明当前 rate-limit 规则形态和账号池规模。
- 能说明后续补丁的最小行为边界与回归测试方向。

## 证据门禁

- 问题来源：用户在 2026-07-07 反馈“重启 app 后感觉请求速度变快；重启后只快几分钟，之后又慢”。
- 运行事实：
  - 正式 sidecar 使用 `/Users/linhey/.config/gettokens/config.yaml`，端口 `8317`。
  - 正式配置目录约 `1.1G`；其中 `sidecar.log` 约 `499M`、`live-sessions-v1.sqlite` 约 `332M`、`usage-attribution-v1.sqlite` 约 `113M`、`accounts-v1.sqlite` 约 `25M`。
  - `accounts-v1.sqlite` 当前活跃 `auth-file` 账号约 `1176` 个；账号池足够大，候选扫描被放大后会直接影响请求入场。
  - `usage-attribution-v1.sqlite` 当前 `usage_attribution_events` 约 `224097` 行，最近 1 小时约 `1092` 行。
- 规则事实：
  - `rate_limit_rules` 当前只有 `token-window/calendar-day/block` 规则：启用 2 条、禁用 1 条。
  - 当前没有 `request-window` 规则。
- 日志事实：
  - 当前正式 sidecar 在 `2026-07-07 18:51:31` 附近启动。
  - 启动后仍持续出现 `/v1/responses` 慢请求；例如 `19:06` 一分钟内 `30` 个 POST，平均约 `15.89s`，最大约 `57.51s`。
  - 重启后数分钟内出现明显 SQLite 锁竞争和候选扫描放大；例如 `18:56` 一分钟内 `25` 个 POST、`142` 次 route selected、`114` 次 `database is locked/SQLITE_BUSY`、`112` 次 `rate limit admission failed`；`18:57` 一分钟内 `123` 次锁竞争、`121` 次 admission failed。
  - 后台管理轮询稳定存在：每分钟约 `12` 次 quota-status chunk 请求、`2` 次 usage-attribution 请求；quota-status 单次约几十毫秒，usage-attribution 约数百毫秒，是贡献项但不是主因。
  - 用户重新安装 app 后继续观察，正式 sidecar 当前启动版本已到 `CLIProxyAPI v7.1.28-128-g5d2bdd27`。`2026-07-07 23:35:03..23:41:11` 窗口内新增日志 `737` 行，`/v1/responses` `100` 次，p50 `10.8s`、p95 `38.0s`、max `115.0s`、`502` `3` 次；同期 `context canceled` `170` 次、`SQLITE_BUSY` `5` 次。新增日志中 `raw_account_keys=0`、`redacted_account_keys=90`，说明 access log 脱敏已生效，但 usage/rate-limit 后处理仍在放大噪声和锁竞争。
  - 75 秒增量观察窗口 `2026-07-07 23:39:21..23:40:32` 内新增 `112` 行、`/v1/responses` `17` 次、`context canceled` `31` 次、`SQLITE_BUSY` `1` 次、quota-status chunk 请求 `12` 次；这是新安装后仍可复现的当前运行态证据。
  - 2026-07-08 继续追踪账号页 usage 链路时确认：`useAccountsPageState` 的 runtime sync 会复用当前 `AccountRecord[]` 并触发 `loadAccountUsage()`；旧调用默认 `resolveAccountKeys: options.resolveAccountKeys !== false`，导致初次/手动卡片 usage 刷新会要求 Wails 进入后端账号解析。Wails 解析路径 `resolveSidecarUsageAttributionAccountKeys()` 会读取账号列表/identity index；在 4000+ 账号下这是可避免的重复资源消耗。
- 源码事实：
  - `RateLimitEvaluator.admitRequestWindow()` 在入场时调用 `createRequestWindowReservations()`；错误时返回 active deny，导致路由继续尝试其他候选账号。
  - `createRequestWindowReservations()` 当前先执行 `store.expireReservations()` 写 `rate_limit_reservations`，再查询 `listEnabledRequestWindowBlockRulesForAccount()`；在没有 request-window 规则时，这个写锁完全不产生业务价值。
  - `expireReservations()` 是 SQLite `UPDATE`；`newRateLimitStore()` 与 `newUsageAttributionStore()` 对同一 `usage-attribution-v1.sqlite` 分别 `sql.Open("sqlite", path)`，当前未看到统一连接、busy timeout 或 WAL 配置。
  - `usageAttributionPlugin.HandleUsage()` 在写入 usage attribution 后调用 `completeRateLimitAfterUsage(ctx, event)`；旧实现释放 reservation 使用 `context.Background()`，但随后 `EvaluateAccountNow(ctx, accountKey)` 继续使用请求上下文。请求结束或客户端取消后，rate-limit 状态刷新会直接返回 `context canceled`，对应日志中的高频 `refresh rate limit after usage failed`。

## 定位结论

主要本地根因是 sidecar rate-limit 入场路径缺少无规则 fast path：

1. 用户当前只有 `token-window` 规则，没有 `request-window` 规则。
2. 但每个候选账号入场仍先执行 request-window reservation 过期写入。
3. 大账号池和并发 `/v1/responses` 会把这类无效 SQLite 写入放大。
4. 写锁与 usage attribution 写入、usage summary 读取、后台 30 秒管理轮询竞争后，产生 `database is locked/SQLITE_BUSY`。
5. `admitRequestWindow()` 遇到锁错误会返回 active deny，路由继续扫描更多候选账号，进一步放大 route selected 与 DB 写入。
6. 重启后短时间连接、后台轮询、并发请求尚未重新叠加，所以体感更快；几分钟后并发和轮询恢复，锁竞争与候选扫描重新出现。

同时需要保留一个边界：最新尾部日志里即使锁竞争下降，`/v1/responses` 仍有大量 10s+ 请求和 `refresh rate limit after usage failed error=context canceled`。因此本地 SQLite 竞争是“变慢放大器”，不是全部上游耗时的唯一来源。

## 修复记录

- 2026-07-07 第一刀已在 `CLIProxyAPI#gettokens/sidecar` 落地，fork commit：`054ea68f fix(gettokens): skip request-window reservations without rules`。
- 行为变更：`createRequestWindowReservations()` 先读取当前账号启用的 `request-window/block` 规则；`len(rules)==0` 时直接 no-op 返回，不进入 `reservationMu`，不调用 `expireReservations()`，不写 `rate_limit_reservations`。
- 回归测试：新增 `TestRateLimitAdmissionNoopsWithoutRequestWindowRulesBeforeReservationWrite`。红灯证据为只有 `token-window` 规则且第二 SQLite 连接持有写锁时，旧实现返回 `rate limit admission failed` active deny；绿灯后 admission no-op，reservation 数量保持 `0`。
- 已重建本地 dev/build sidecar：`./scripts/ensure-sidecar.sh darwin arm64`，`build/bin/cli-proxy-api.meta.json` 记录 commit `054ea68f958bb6df42414f7df57ffe4ce8255072`、`dirty=clean`。
- 2026-07-07 第二刀处理 usage 后处理上下文：`completeRateLimitAfterUsage()` 不再复用可能已取消的客户端请求上下文，而是使用 `5s` bounded background context 完成 reservation release 与 `EvaluateAccountNow()`；fork commit：`fb059d8b872940c7f56cf89133f832fc2ea6ef20`。
- 回归测试：新增 `TestUsageAttributionPluginRefreshesRateLimitGuardWithCanceledRequestContext`。红灯复现旧实现同样打印 `refresh rate limit after usage failed error="context canceled"`，且 route guard 没有刷新；绿灯后即使 usage hook 收到已取消 ctx，token-window 规则也会立即刷新为 blocked，并更新 route guard。
- 验证：`go test -count=1 ./internal/gettokenshooks -run TestUsageAttributionPluginRefreshesRateLimitGuardWithCanceledRequestContext`、`go test -count=1 ./internal/gettokenshooks ./internal/gettokensrouting` 通过。
- 已重建本地 dev/build sidecar：`./scripts/ensure-sidecar.sh darwin arm64`，`build/bin/cli-proxy-api.meta.json` 记录 commit `fb059d8b872940c7f56cf89133f832fc2ea6ef20`、`dirty=clean`。
- 2026-07-08 第三刀处理账号页 usage 资源复用：账号页卡片 usage 刷新默认不再让 Wails/sidecar 重新解析账号池，改为 `resolveAccountKeys: false`、`includeUnresolved: true`，并在前端对 sidecar attribution 构建一次性索引，再用当前 `AccountRecord.id / quotaKey / authIndex` 做本地 join。同一账号命中的多个 attribution 分片会在前端合并后再喂给卡片，避免逐账号重复扫描 usage items。
- 回归测试：新增 `buildAccountUsageSummary reuses local auth index to consume unresolved attribution items`，并加固 `background usage sync skips backend account resolution`，锁住默认跳过后端解析和 unresolved 本地 join。
- 验证：`node --test src/features/accounts/tests/accountUsage.test.mjs`、`node --test src/features/accounts/tests/accountRuntimeSync.test.mjs`、`npm --prefix frontend run typecheck` 通过。
- 2026-07-08 第四刀补安装包观测打点：`internal/wailsapp/usage_attribution.go` 在 `GetSidecarUsageAttribution` 边界输出 `usage attribution bridge complete ... resolve_account_keys=<bool> ... sidecar_items=<n> sidecar_unresolved=<n> returned_items=<n> returned_unresolved=<n> sidecar_ms=<n> resolve_ms=<n> total_ms=<n>`；仅在后端解析开启时额外输出 `usage attribution account resolution complete ... auth_index_entries=<n> identity_entries=<n> provider_entries=<n> ... *_ms=<n>`。
- 安装后验收方式：账号页后台/手动卡片 usage 刷新应主要出现 `resolve_account_keys=false`；如果账号页路径出现 `resolve_account_keys=true` 或 `usage attribution account resolution complete` 高频日志，说明又触发了后端账号池解析。所有打点只记录计数、布尔值和耗时，不记录账号 key 列表或凭证。
- 验证：`go test ./internal/wailsapp -run 'TestGetSidecarUsageAttribution|TestCodexAttributionIdentityStore'` 通过。
- 2026-07-08 第五刀修正账号卡片 usage-limit 语义：用户安装新包后在账号池看到 `{"type":"usage_limit_reached", ...} after bounded reconcile` 被显示为通用“异常”并露出“重新登录”。该 payload 是上游用量已达上限/等待重置，不是安装错误或 OAuth 登录失效。前端模型层新增 `usage_limit_reached` 识别，将卡片状态显示为“用量已达上限”，把 raw JSON 摘要为“用量已达上限，等待额度重置。 · K12 · 约 2h 后重置”一类文案，并禁止该状态触发 footer 重登录 CTA。
- 回归测试：新增 `usage-limit runtime failures render as quota exhaustion instead of reauth errors`，覆盖 failure reason 摘要、卡片 operational state、详情标题和 `isCodexReauthEligible=false`。
- 验证：`node --test src/features/accounts/tests/accountPresentation.test.mjs`、`npm --prefix frontend run typecheck` 通过。

## 后续修复候选

- 后续再评估同库多连接的 `busy_timeout`、WAL、usage summary 索引/聚合、usage/live-session retention 与 sidecar log rotation。
- 前端/管理轮询仍可优化：当前账号页 30 秒同步会并行触发 quota-status chunk、rate-limit strategies/status、usage-attribution；在 4000+ 账号池下应继续评估 visibility、active frame、dirty-on-demand、usage/rate-limit 合并接口或缓存 TTL。卡片 usage 的后端账号解析放大已在 2026-07-08 收窄为显式 opt-in。
- 上游/模型慢底噪仍需单独归因；本次补丁只消除“无 request-window 规则仍写 reservation”的本地放大器。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260707-request-speed-decay-investigation`
- worktree：`../GetTokens-worktrees/20260707-request-speed-decay-investigation/`

## 相关链接

## 当前状态
- 状态：fixed-frontend-usage-reuse-and-usage-limit-card-state
- 最近更新：2026-07-08
