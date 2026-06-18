# Route Resilience v2

## 背景

本 space 承接 OmniRoute 借鉴能力评估中的近期最高优先级方向：`route resilience`。

当前 GetTokens 已具备 route guard、session affinity、runtime routeability、bounded reconcile、route decision ledger 等能力，但这些能力还没有统一收敛为一套明确的 resilience pipeline。后续需要把 account / provider / model 粒度的失败隔离、恢复提示、fallback trace 和 operator 控制动作统一起来。

## 目标

1. 建立 sidecar-owned route resilience state model。
2. 统一 account / provider / model 三层 failure scope。
3. 扩展 route decision ledger，使 explain / probe / recent decisions 共享同一套 dropped reasons。
4. 设计最小 operator controls：清 transient lockout、重跑 bounded reconcile、重查 routeability。

## 范围

- CLIProxyAPI reference sidecar：`sdk/cliproxy/auth`、`internal/gettokenshooks`、runtime routeability 相关状态。
- GetTokens 主仓：Wails DTO、`ListChannelRouteDecisions` 映射、channel routing workbench 展示。
- 测试：focused sidecar tests、Wails mapper/client tests、前端纯模型测试。

## 非目标

- 不开放任意自定义 selector 脚本。
- 不允许前端手工改写 candidate pool。
- 不把 route engine 移到 Wails 或 frontend。

## 验收标准

- explain / probe / recent decisions 三处可看到一致的 dropped reasons。
- model-level lockout 不会错误拖垮整个 provider。
- provider 或 account 短暂失败后，bounded repair / recheck 能恢复 routeable 状态并留下结构化证据。
- sidecar focused tests、主仓 Wails tests、前端 route workbench tests 通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-route-resilience-v2`
- worktree：`../GetTokens-worktrees/20260616-route-resilience-v2/`

## 相关链接

- 总架构：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)
- 路由技术边界：[docs-linhay/dev/20260524-account-routing-engine.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md:1)

## 当前状态
- 状态：round23-startup-ledger-path-wiring
- 最近更新：2026-06-17
- 当前输出：A1 state model、A2 sidecar structured dropped reasons、A3 main repo Wails/root/frontend `droppedReasons` 透传、A4 model-scope diagnostics filter、operator controls contract plan、sidecar `clear_transient_lockout` action handler、主仓 `RunRouteResilienceAction` client/Wails/root/WailsJS bridge、channel-routing workbench operator surface 第十轮收窄（从 recent decisions 提取可选 action target list、按 target 保留 action response history、继续原样展示 sidecar `not_implemented` / failure）、第十一轮 stable target identity 收敛（target 去重 key 改为 account/auth/model/source/scope 稳定身份，不再依赖 `reason` 文案；同 target 下保留 multiple reasons 聚合展示与命中计数；action history 继续按稳定 target 绑定）、第十二轮 account detail route evidence 复用（账户详情 `运行态路由 -> 最近真实路由` 基于 recent decisions `droppedReasons` 只读展示 stable target identity、reason aggregation、routeBlocking、source/scope/model；缺 droppedReasons 时保持现有 UI，不触发任何 action）、第十三轮 route evidence digest helper 收敛（新增 `buildRouteResilienceEvidenceDigests()` 作为公共只读 helper，输出 stable target id、reason aggregation、routeBlocking、source/scope/model、detail、occurrenceCount；`buildRouteResilienceActionTargets()` 改为基于 digest 包装 operator target，account detail 直接消费 digest，不再手工复制 target 映射）、第十四轮 digest recency metadata（digest 在 stable target id 不变的前提下新增 first/last observed metadata，并把兼容字段 `decisionID` / `recordedAt` 收敛为 latest evidence metadata；同 target 下 reason 文案变化不分裂 target，但 detail/doctor 可定位最近一次证据来自哪个 decision / recordedAt）、第十五轮 account detail recency surface（账户详情 route resilience evidence 改为先按当前账户 recent decisions 共享构建 digest，再按 decision 命中的 stable target 回填同一 digest；UI 只读展示 `Latest Evidence`、`First Seen`、`Last Seen`，显式暴露 latest decision/recordedAt 与 first/last observed metadata，不新增 action mutation、不改 sidecar truth）、第十六轮 account detail digest-level dedupe（账户详情对同一 digest 改为“首次完整展示 + 后续引用”；reference 卡显式标明共享 digest 与相关 decision 数量，presentation 层补 `Digest Coverage` 与 per-decision `matchedRouteBlocking`，避免把 blocking/observe 混成静默丢信息）、第十七轮 account detail per-reason blocking detail（presentation 层在同一 decision / 同一 stable digest 下保留 `matchedReasonDetails`，账户详情用 `Reason Details` 展示每条 reason 的 `BLOCKING` / `OBSERVE` 状态；stable digest id 仍只由 account/auth/model/source/scope 构成，reason 文案只作为只读展示明细）、第十八轮 `recheck_routeability` sidecar tracer（action 需要 accountKey/authId，dry-run 返回 `dry_run` 且不写 audit，非 dry-run 返回 `applied` + `auditId`；before/after 重新采样 in-memory guard 与 persisted runtimeStates，输出 droppedReasons、`tracerOnly=true`、`reconcileRuns=0`，证明没有进入无限 reconcile）、第十九轮 sidecar-owned action history 与 bounded reconcile tracer（新增 action history 查询/记录；`clear_transient_lockout`、`recheck_routeability`、`rerun_bounded_reconcile` 写入 action/target/status/auditId/before/after block counts/createdAt/tracerOnly/reconcileRuns；`rerun_bounded_reconcile` 不再 501，改为 target-scoped 单次采样 `reconcileRuns=1`，不循环、不调用外部服务）、第二十轮 durable action ledger（action history 从纯内存推进为 sidecar-owned JSONL/file ledger；history endpoint 从 ledger 读回 newest-first 记录；测试使用 `t.TempDir()` 覆盖 ledger path，默认 runtime path 落在 user cache 或系统临时目录，不写 `~/.config/gettokens` 正式配置目录；bounded reconcile dry-run/非 dry-run 边界保持不变）、第二十一轮 ledger bounds/query filters（action JSONL ledger 增加测试可控 max entries 截断边界，写入后同步压缩为最新 N 条；history endpoint 增加 `status`、`target` 与既有 action/account/auth/model/limit 组合过滤，`limit=0` 可显式返回空集；不新增 scheduler、不写正式配置目录、不调用外部 repair service）、第二十二轮 profile-aware ledger path 与 append/truncate error surface（新增从 profile config path 推导 `<profile>/route-resilience/actions.jsonl` 的解析函数与 setter；测试仍可覆盖临时 path；action response 新增 `ledgerError` 暴露 append/truncate failure，同时保留原 action status/audit，不引入 scheduler、不调用外部 repair service）
- Round23 输出：CLIProxyAPI reference 的 `InstallRoutingPoliciesWithConfigPath(configPath)` 已接入 `SetRouteResilienceActionLedgerPathFromConfig(configPath)`；focused tests 证明 runtime config path 会写 `<profile>/route-resilience/actions.jsonl`，且测试 helper 覆盖后仍写入 `t.TempDir()` ledger，不回写 profile ledger。
- 下一步：继续把同一套 recency-aware digest helper、dedupe presentation 与 per-reason current-decision 明细语义复用到 doctor/detail 相关只读 surfaces；若后续需要进一步压缩信息密度，可优先研究更紧凑的 relevant-decision 展示，但仍需保留 source/scope/model 边界、shared digest 提示、per-decision blocking/observe 与 per-reason blocking/observe explainability；`recheck_routeability` 当前已是 sidecar-owned 只读 tracer，后续若要升级为真实 routeability evaluator，必须保持 target-scoped、bounded、无外部服务调用默认值，并延续 `reconcileRuns` 或等价计数；`rerun_bounded_reconcile` 当前是 bounded tracer boundary，不是真实 repair evaluator，后续若接入 hook 层 repair 权限，必须保留 target scope、history/audit、durable ledger 和有限运行次数；后续若继续收窄 operator/detail surface，优先复用现有 digest helper，而不是回退到 reason 文案级 target key
