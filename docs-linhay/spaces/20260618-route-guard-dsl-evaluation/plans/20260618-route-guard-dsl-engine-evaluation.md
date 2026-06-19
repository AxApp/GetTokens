# Route Guard DSL Engine Evaluation Plan

日期：2026-06-18
状态：评估草案

## 结论

建议推进“内部 typed rule engine”，并把“用户对单个账号的路由守卫配置”作为第一类可视化规则入口。

不建议第一期开放自由 DSL。用户应该通过受限规则构建器配置规则，系统编译为 sidecar 可验证、可解释、可版本化的 typed rule schema。

补充要求：单账号规则必须支持更多场景，不能只做“block / cooldown”两个开关。schema 第一版就要保留 trigger、matcher、scope、action、ttl、recovery 和 explain label，否则后续扩展模型、渠道、项目、失败预算、drain 和自动恢复场景时会再次破坏规则边界。

第二个补充要求：规则引擎必须支持手动校准当前用量。账号可能在 GetTokens App 外部被调用，sidecar 观测到的 usage 不是全量事实；规则判断必须支持 observed usage + manual calibration 得到 effective usage。

## 当前事实快照

### 已有规则能力

| 规则族 | 当前来源 | 是否适合纳入引擎 |
| --- | --- | --- |
| 手动禁用账号 | account store / runtime auth synthesis | 是，但不应作为 persisted runtimeStates source |
| quota-empty | quota runtime state / resetAt TTL | 是，必须 source-scoped |
| quota-threshold | quota runtime window percentage threshold | 是，必须与 quota-empty 分离，并以 window resetAt 作为优先 TTL |
| usage-calibration | 用户手动校准外部流量 | 是，必须作为 ledger 叠加到 observed usage，不覆盖原始观测 |
| rate-limit / cooldown | rate-limit evaluator / request result | 是，必须与 quota-empty 分离 |
| auth-error | upstream result / credential state | 是，通常为 hard block |
| model-unavailable | model support / result hook | 是，scope 应支持 account+model |
| upstream-error | timeout / 5xx / network | 是，通常需要 TTL |
| project candidate pool | projectKey exact match + allowAccountIDs | 是，属于 PoolScope stage |
| sticky / session affinity | live session / cache | 是，但只能作为 Preference，不能复活 hard-blocked candidate |

### 当前分叉点

1. internal/wailsapp/channel_routing.go 仍保留本地 fallback explain 与 runtimeStates 兼容写回。
2. sidecar explain / decisions / live sessions 已逐步成为权威，但仍存在旧 sidecar fallback。
3. probe 代码仍有旧 X-GetTokens-Route-* header override，而历史文档已经将其标记为旧入口。
4. legacy relay routing config 与 channel routing config 需要继续保持产品语义分层。

## 推荐架构

    Account / Runtime / Channel / Project / Request facts
      -> RouteFactsSnapshot
      -> Typed Rule Engine
          Stage 0 Eligibility
          Stage 1 HardBlock
          Stage 2 PoolScope
          Stage 3 Preference
          Stage 4 Selection
          Stage 5 Effect
      -> RouteDecisionTrace
      -> Request executor / Explain / Probe / Decision ledger
      -> RouteEffect writer
      -> Runtime source store

## 用户配置形态

第一期支持多场景单账号规则构建器：

| 字段 | 含义 |
| --- | --- |
| accountKey | 目标账号，必须是稳定 acct_* 或统一 account id |
| channel | codex / claude / all |
| modelPattern | 可选，限定模型、模型族或 provider-native alias |
| projectKey | 可选，限定 workspace / project candidate context |
| sessionFamily | 可选，限定 Codex / Claude session family 或 sticky family |
| trigger | 受限触发器，例如 manual、quota-empty、quota-threshold、rate-limit、failure-budget、latency、schedule、upstream-error |
| matcher | 受限匹配器，不允许任意表达式 |
| action | block / cooldown / drain / degrade / prefer-lower / observe-only |
| ttl | 固定时长、resetAt、手动清理 |
| recovery | success-clear / ttl-expire / manual-clear / quota-refresh-clear / probe-clear |
| reason | 用户可读原因 |
| enabled | 是否启用 |

用量窗口类规则还需要补充：

| 字段 | 含义 |
| --- | --- |
| windowPolicy | daily / multi-day / rolling / bounded |
| resetPolicy | resetAt / duration / cron-like schedule |
| timezone | 日限额与 cron-like reset 必须指定时区 |
| limitMetric | tokens / requests / cost |
| limitValue | 当前窗口限额 |
| calibrationMode | delta / set-effective |

编译结果必须包含：

1. schema version
2. normalized account identity
3. stage
4. source
5. scope
6. ttl / expiresAt policy
7. explain label

## 单账号规则场景分层

| 分层 | 场景 | 示例 | 规则语义 |
| --- | --- | --- | --- |
| L1 硬阻断 | 维护、禁用、auth-error、quota-empty | 账号 A 今日不接 Codex 请求 | HardBlock drop |
| L2 范围阻断 | 模型、渠道、项目、session family | 账号 A 不接 gpt-5.5；账号 B 只避开项目 P | PoolScope / HardBlock |
| L3 时间、预算与额度窗口 | cooldown、failure budget、resetAt、quota threshold、usage calibration | 账号 A 连续 2 次 429 后冷却 10 分钟；账号 B 的 weekly token window 剩余低于 20% 后停止路由；账号 C 手动追加 App 外部消耗 | Effect 写 source，TTL 或 quota refresh 恢复 |
| L4 软策略 | prefer-lower、degrade、drain | 高延迟账号降权；维护前进入 drain | Preference reorder 或 no-new-session |
| L5 观测 | observe-only、shadow | 先记录命中，不改变路由 | Trace only |

第一期 MVP 至少覆盖 L1、L2、L3，其中 L3 必须包含 quota-threshold，因为用户明确需要“某个 token window 到某个百分比停止”。L4 可以先以 dry-run / preview 接入，真实请求切换前必须有 explain=request parity；L5 用于降低上线风险。

## Quota threshold 规则语义

用户可以指定某个 token/quota window 到某个百分比后停止某账号路由。该能力不应复用 quota-empty，而应新增独立 source：quota-threshold。

| 字段 | 语义 |
| --- | --- |
| windowID | sidecar quota runtime 的稳定 window id |
| metric | remaining-percent 或 used-percent |
| threshold | 0-100 |
| comparator | remaining-percent 默认 <=；used-percent 默认 >= |
| action | block / drain / prefer-lower，首期默认 block |
| ttl | 优先 window resetAt；无 resetAt 时只能 observe-only 或短 TTL |
| recovery | 默认 quota-refresh-clear + ttl-expire |

执行边界：

1. 只使用 sidecar quota runtime fact，不从前端展示值反推。
2. fresh quota window 才能创建或更新 quota-threshold block。
3. stale / degraded / unknown quota 不创建新强阻断。
4. quota-threshold recovery 只清理 quota-threshold source，不清 quota-empty / rate-limit。
5. explain 必须显示 windowID、metric、threshold、actualPercent、action、expiresAt。

## 手动用量校准

用户需要能手动修改当前窗口用量，因为一部分流量可能发生在 GetTokens App 外。

校准不能直接覆盖 observed usage。推荐使用 append-only ledger：

| 字段 | 语义 |
| --- | --- |
| accountKey | 目标账号 |
| windowID | 目标 quota / usage window |
| metric | tokens / requests / cost / percent |
| mode | delta 或 set-effective |
| value | 增量值或校准后的有效值 |
| reason | 用户填写，例如 App 外部消耗 |
| source | manual-calibration |
| createdAt | 写入时间 |
| expiresAt | 默认跟随 window resetAt |
| revokedAt | 可选，撤销时间 |

计算规则：

    observedUsage = sidecar 观测到的 GetTokens 内流量
    manualAdjustment = 当前 window 内未撤销校准项
    effectiveUsage = observedUsage + manualAdjustment
    effectiveRemaining = limit - effectiveUsage

route guard、quota threshold 和 usage limit 判断必须使用 effectiveUsage / effectiveRemaining。explain 必须同时展示 observed、manualAdjustment、effective 三个值。

校准恢复：

1. window reset 后，校准项按 expiresAt 自动失效。
2. 用户可以撤销单条校准项，撤销产生 audit trace。
3. provider fresh quota fact 可以生成 reconcile suggestion，但不能静默删除用户校准，除非规则显式设置 provider-fact-clear。

## 单日、多日、起止时间限额与 cron

cron-like 表达式只能作为 reset / refresh / recompute 的调度描述，不能单独表达完整限额窗口。

必须拆成 windowPolicy 与 resetPolicy：

| 类型 | 例子 | windowPolicy | resetPolicy |
| --- | --- | --- | --- |
| 单日限额 | 每天最多 100k tokens | daily + timezone | daily reset time，或 cron-like |
| 多日限额 | 每 7 天最多 500k tokens | multi-day fixed 或 rolling duration | anchorStart + durationDays |
| 起止时间限额 | 6/18 10:00 到 6/20 18:00 共 300k tokens | bounded startAt/endAt | endAt expire |
| 高级周期 | 每周一 08:00 重置 | fixed-calendar | cron-like + timezone |

结论：支持 cron 能覆盖“高级重置调度”这个子问题，但不能覆盖“用量属于哪个窗口、如何计算 effective usage、何时自动恢复”这三个核心问题。

## 自动恢复策略

自动恢复必须进入 rule schema 与 effect writer，而不是 UI 层临时清理。

| recovery | 适用 source | 清理条件 | 约束 |
| --- | --- | --- | --- |
| ttl-expire | cooldown、quota-threshold、rate-limit | expiresAt <= now | active lookup 不阻断；cleanup 可异步物理删除 |
| quota-refresh-clear | quota-threshold、quota-empty | fresh quota refresh 显示超过阈值或额度恢复 | 只清 quota 相关同 source |
| success-clear | upstream-error、transient rate-limit | 后续请求成功 | 不清 manual disabled / quota-empty |
| probe-clear | model-unavailable、可恢复 auth-error | sidecar probe / refresh 证明恢复 | 需要结构化 evidence |
| manual-clear | 手动维护、无 resetAt 规则 | 用户显式清理 | 不自动恢复 |

所有自动恢复动作必须：

1. source-scoped，只清自己的 source。
2. bump pool epoch，让 sticky / session affinity 下一轮重新评估。
3. 写入 decision / audit trace，说明恢复原因。
4. 遇到 stale / degraded / unknown fact 时保持保守：不创建新强阻断，也不触发强恢复。

## 分阶段计划

### Phase 1：规则 schema 与 dry-run engine

目标：先建立 typed schema、stage contract 和 dry-run 输出，不影响真实请求。

交付：

1. sidecar 内部新增 rule schema 与 validator。
2. 新增 dry-run engine，读取 fixture snapshot 输出 trace。
3. 新增 management dry-run endpoint，用于后续 UI 预览。
4. 本仓扩展 cliproxyapi / Wails DTO 映射。

验收：

1. schema 校验拒绝未知 source、未知 action、空 accountKey、非法 ttl。
2. dry-run 对 quota-empty、rate-limit、auth-error、project pool 输出稳定 trace。
3. 不改变真实请求路由。

### Phase 2：Explain 切到 engine，保留请求旧路径

目标：先让 explain 使用新 engine，建立 explain parity。

交付：

1. sidecar /gettokens/channel-routing/explain 由 engine 产出。
2. Wails 继续优先消费 sidecar explain。
3. 本地 fallback explain 只保留旧 sidecar 兼容，标记为 legacy。

验收：

1. explain 覆盖 disabled、quota-empty、rate-limit、project pool、sticky invalidate。
2. explain 输出 stage trace、snapshot version、policy version。
3. Codex / Claude channel 隔离。

### Phase 3：多场景单账号规则构建器接入 dry-run

目标：允许用户创建多场景单账号规则，但先只 dry-run / preview，不进入真实请求。

交付：

1. management API 增删改查单账号 guard rule。
2. Wails DTO 与前端模型支持 trigger / matcher / scope / action / ttl / recovery 的受限表单。
3. UI 显示 compiled preview、冲突风险和 explain 结果。
4. 首批场景覆盖维护阻断、模型范围阻断、渠道范围阻断、quota threshold、手动用量校准、单日/多日/起止时间限额、限时冷却、failure budget、observe-only。

验收：

1. 用户规则能保存、禁用、删除。
2. dry-run 能展示该规则会过滤哪些候选。
3. 不允许用户写任意表达式。
4. observe-only 只写 trace，不改变候选。
5. drain 只影响新 session，不中断已 commit 的 stream。
6. 手动校准项进入 effectiveUsage，不覆盖 observedUsage。
7. daily / multi-day / bounded window 均能计算 active window 与 reset / expire 时间。

### Phase 4：真实请求切到 engine

目标：真实请求与 explain 共用同一 route decision。

交付：

1. 请求热路径调用 engine。
2. sticky / balanced / project pool 变为 engine stage。
3. selector 退化为执行器适配层。
4. decision ledger 记录 engine trace。

验收：

1. explain=request 一致性测试通过。
2. sticky 不绕过 hard block。
3. 所有候选被 block 时 fail closed，并输出完整 dropped reasons。
4. 可通过开关回滚旧路径。

### Phase 5：Effect writer 与 runtime state 收口

目标：统一结果回写，不再由多个路径各自改 runtime state。

交付：

1. request result 映射为 RouteEffect。
2. source-scoped runtime store 统一写入和清理。
3. success 只清 transient source，不影响 manual disabled。
4. quota-empty / rate-limit / upstream-error 分 source 共存。
5. 自动恢复策略在 effect writer 中执行：ttl-expire、quota-refresh-clear、success-clear、probe-clear、manual-clear 分开处理。

验收：

1. 清理 quota-empty 不误清 rate-limit。
2. success 不恢复 disabled account。
3. TTL 到期后 active lookup 不再阻断。
4. account enable / disable / delete bump pool epoch。
5. fresh quota refresh 恢复后只清 quota-threshold，不清其他 active source。
6. 自动恢复写入 audit / decision trace。

### Phase 6：删除旧入口与文档收口

目标：清理长期分叉点。

交付：

1. probe header override 改为显式 diagnostic-only 能力，或删除。
2. legacy Wails fallback explain 只保留版本兼容，并从主产品路径退出。
3. 文档明确 relay routing config 与 channel routing config 分层。
4. 更新 space、dev docs、memory。

验收：

1. 没有常规请求依赖 X-GetTokens-Route-*。
2. probe 通过 decision ledger / live sessions 识别命中账号。
3. docs-check 与 diff-check 通过。

## BDD 场景

1. Given 单账号存在 active quota-empty，When 构建 Codex 候选池，Then 该账号在 HardBlock stage 被过滤，并输出 source=quota-empty。
2. Given 单账号同时存在 quota-empty 与 rate-limit，When quota refresh 恢复，Then 只清 quota-empty，rate-limit 仍阻断。
3. Given 用户禁用账号，When sticky 命中该账号，Then sticky invalidated，下一请求重新选择。
4. Given project candidate pool 命中但 allowAccountIDs 均不可路由，When 请求进入 route engine，Then fail closed 并输出 project-candidate-pool:no-routeable-account。
5. Given 用户创建单账号 custom-cooldown rule，When dry-run explain，Then 候选被过滤但真实请求不受影响，直到规则启用进入 runtime path。
6. Given 旧 sidecar 不支持 engine explain，When Wails 调用 explain，Then 使用 legacy fallback 并标记 source=legacy-fallback。
7. Given 用户创建 account+model 范围规则，When 请求模型匹配，Then 该账号被过滤；When 请求其他模型，Then 账号仍可参与候选。
8. Given 用户创建 account+channel 范围规则，When Codex 请求进入，Then 只影响 Codex；When Claude 请求进入，Then 不受该规则影响。
9. Given 用户创建 drain 规则，When 新 session 进入，Then 不选择该账号；When 既有 sticky session 仍在 streaming，Then 不做中途迁移。
10. Given 用户创建 observe-only 规则，When 条件命中，Then decision trace 记录命中，但 candidates 与 selected account 不改变。
11. Given failure budget 规则设置为 2，When 同账号同 session family 连续两次 terminal error，Then 写入 cooldown source 并在下一次请求过滤该账号。
12. Given 用户配置 weekly token window remaining-percent <= 20% 时 block，When sidecar fresh quota fact 显示该 window 剩余 18%，Then 写入 quota-threshold source，TTL 取该 window resetAt，并在下一次 route decision 中过滤该账号。
13. Given 已有 quota-threshold block，When 下一次 fresh quota refresh 显示 remaining-percent 恢复到 35%，Then 只清理 quota-threshold source，不影响 quota-empty / rate-limit。
14. Given quota window 状态为 stale 或 degraded，When 规则阈值看起来已命中，Then 不创建新的 quota-threshold hard block，只在 explain 中展示 unknown/stale 无法强阻断。
15. Given quota-threshold 使用 ttl-expire，When resetAt 到期，Then active lookup 不再阻断该账号，并在下一次 cleanup 中删除过期 source。
16. Given upstream-error 使用 success-clear，When 后续同账号请求成功，Then 只清 upstream-error，不清 quota-threshold 或 manual-clear source。
17. Given model-unavailable 使用 probe-clear，When sidecar probe 证明该模型恢复，Then 清理对应 account+model source，并 bump pool epoch。
18. Given 用户为 daily token window 手动追加 20k 外部消耗，When observedUsage 为 60k 且 limit 为 100k，Then effectiveUsage 为 80k，threshold / limit 判断使用 80k。
19. Given 用户撤销一条 manual calibration，When route engine 重新计算，Then effectiveUsage 移除该校准项并写入 audit trace。
20. Given 多日限额 window 为 anchorStart + 7 days，When 当前时间仍在窗口内，Then 校准项继续有效；When 窗口过期，Then 校准项不再参与 effectiveUsage。
21. Given bounded window 有 startAt/endAt，When 当前时间早于 startAt 或晚于 endAt，Then 该 window 不参与当前 route decision。
22. Given resetPolicy 使用 cron-like schedule，When cron 触发 reset，Then 只用于生成下一 window / expiresAt，不直接替代 windowPolicy。

## 不采用自由 DSL 的理由

1. 当前需求需要可解释、安全、可回滚，不需要任意可编程。
2. 用户自由表达式会扩大误配置面，尤其容易导致全账号不可路由。
3. typed schema 更适合迁移、版本化和 UI 构建器。
4. 将来如果规则族稳定且用户确实需要高级表达，可在 typed schema 之上增加只读表达式预览，而不是第一期直接开放。

## 需要后续确认的问题

1. L4 软策略是否第一期真实生效，还是只 dry-run：degrade / prefer-lower / drain 的运行态影响比 block 更复杂，需要 explain=request parity 后再切真实请求。
2. custom-cooldown 是否允许用户手动清理，还是只允许 TTL 过期。
3. 规则 UI 放在账号详情 route guard 区，还是独立 Route Resilience 工作台。
4. projectKey / sessionFamily matcher 的首版输入来源：只读当前 route context，还是允许用户手动选择历史项目。
5. 手动校准的 set-effective 模式是否允许小于 observedUsage：建议默认不允许，以免用户把已观测真实消耗改低；如允许，必须标记为 override-risk。
6. cron-like schedule 是否第一期开放给用户输入：建议第一期只提供 daily / multi-day / bounded 表单，高级 cron 放到 expert mode 或后续版本。

这些问题不阻塞评估结论，但会影响 Phase 3 的 UI 和 API 设计。

## 验收命令

纯文档评估轮：

    docs-linhay/scripts/check-docs.sh
    git diff --check

进入实现后按阶段增加 sidecar focused tests、Wails DTO tests、frontend model tests 和 explain/request parity tests。

## 2026-06-19 实现切片 1：quota-threshold runtime block

范围：先实现最窄 typed rule tracer-bullet，不做用户自由 DSL，不做前端编辑，不接真实账号。

mock upstream facts：

1. fake `AccountQuotaRuntimeState`：fresh、非 stale/degraded、指定 `AccountKey` / `AuthIDs`。
2. fake token window：`Key=tokens_5h`、`Remaining=18`、`Limit=100`、`ResetAt=now+2h`。
3. typed `AccountQuotaThresholdRule`：`metric=remaining-percent`、`comparator=<=`、`ThresholdPercent=20`。

mock downstream / spy outputs：

1. `QuotaThresholdRouteGuardBlocks` 生成 `AccountRouteGuardBlock{Source: quota-threshold}`。
2. block `ExpiresAt` 绑定 window `ResetAt`，用于自动恢复边界。
3. block reason 输出 rule/window/metric/actual/threshold trace。
4. 现有 `accountRouteGuardPolicy` 读取该 source 后 deny 命中 auth candidate。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaThresholdGuard|TestAccountRouteGuardPolicyDeniesQuotaThresholdCandidate' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaGuard|TestAccountRouteGuard|TestRouteGuard|TestQuotaThreshold' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

尚未完成：

1. 从持久化 Account Budget / Route Guard rule config 加载 rule。
2. quota refresh recovery writer：fresh quota 恢复到阈值外时只清 `quota-threshold` source。
3. manual calibration ledger 接入 effective usage。
4. management API / Wails DTO / 前端编辑器。

## 2026-06-19 实现切片 2：quota-threshold config -> runtime upsert

范围：把切片 1 的 typed runtime block 接入现有 quota runtime 更新路径，仍不接真实账号、不开放自由 DSL。

mock upstream facts：

1. `channel-routing/config.json` 顶层 `quotaThresholdRules`，包含 `accountKey`、`windowKey`、`metric`、`thresholdPercent`、`enabled`。
2. fake `QuotaRuntimeState` upsert，包含 `RemainingTokens`、`LimitTokens`、`ResetAtUnix`。

mock downstream / spy outputs：

1. `QuotaRuntimeStore.Upsert` 返回的 `QuotaRuntimeState.Sources` 包含 `quota-threshold`。
2. `AccountRouteGuardStore.DenyIDsForCandidates` 对对应 auth 返回 deny。
3. fresh recovery 到阈值外时清理 `quota-threshold`，但保留已存在的 `rate-limit` source。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaRuntimeStore(UpsertFeedsQuotaThresholdGuardFromConfig|FreshRecoveryClearsOnlyQuotaThreshold)' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成原计划中的：

1. 从持久化 typed rule config 加载 quota-threshold rule 的首版路径。
2. fresh quota 恢复时只清 `quota-threshold` source，不影响其他 active source。

仍未完成：

1. management API / Wails DTO / 前端编辑器。
2. Account Budget 领域对象与 quota-threshold rule 的长期存储契约。
3. manual calibration ledger 接入 `effectiveUsage`。

## 2026-06-19 实现切片 3：manual calibration -> effective usage

范围：先完成 sidecar runtime 层的手动用量校准计算，不做持久化 ledger 和 UI。

mock upstream facts：

1. observed quota window：`Remaining=45`、`Limit=100`、`ResetAt=now+2h`。
2. manual calibration entry：`mode=delta`、`value=30`、`windowKey=tokens_5h`。
3. typed quota-threshold rule：`remaining-percent <= 20`。

mock downstream / spy outputs：

1. `ApplyQuotaUsageCalibrations` 将 observed used 55 + calibration delta 30 计算为 effective used 85、effective remaining 15。
2. `QuotaThresholdRouteGuardBlocks` 基于 effective remaining 15% 生成 `quota-threshold` block。
3. `QuotaRuntimeStore.Upsert` 通过 `SetUsageCalibrations` 接收 calibration 后，返回的 runtime window 展示 effective remaining tokens，并触发 route guard source。

已覆盖边界：

1. `delta` 累加外部用量。
2. `set-effective` 默认不能把 effective usage 调低到 observed usage 以下。
3. revoked / expired calibration 不参与 effective usage。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaRuntimeStoreAppliesManualCalibrationBeforeQuotaThreshold|TestQuotaThresholdGuardUsesManualCalibration|TestQuotaUsageCalibration' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

仍未完成：

1. calibration 持久化 ledger。
2. add / revoke management API。
3. Wails DTO 与前端“修改当前用量”入口。
4. calibration audit trace 与列表展示。

## 2026-06-19 实现切片 4：calibration ledger management API

范围：先把内存 calibration ledger 通过 sidecar management API 暴露，仍不做 Wails 和前端。

mock upstream facts：

1. management API `POST /gettokens/quota-calibrations` 提交 `account_key/window_key/metric/mode/value/expires_at`。
2. `GET /gettokens/quota-calibrations?account_key=<accountKey>` 查询同账号 ledger。
3. `POST /gettokens/quota-calibrations/:id/revoke` 撤销指定 entry。

mock downstream / spy outputs：

1. add 后 `QuotaRuntimeStore.Upsert` 使用该 calibration 触发 `quota-threshold`。
2. list 返回刚创建的 calibration id。
3. revoke 后下一次 `QuotaRuntimeStore.Upsert` 不再受该 calibration 影响，`quota-threshold` 恢复。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaRuntimeCalibrationRoutesAddListAndRevoke' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成原计划中的：

1. add / revoke management API 的 sidecar 首版。
2. ledger list 基础读取。

仍未完成：

1. calibration 文件 / SQLite 持久化。
2. Wails DTO 与前端“修改当前用量”入口。
3. audit trace 展示与用户可见的校准历史。

## 2026-06-19 实现切片 5：calibration Wails bridge + frontend callable entry

范围：把 sidecar calibration management routes 接到 GetTokens App 与账号域前端调用面；先不做完整可见编辑器。

mock upstream facts：

1. sidecar management API 返回 `QuotaUsageCalibration` JSON：`id/account_key/window_key/metric/mode/value/created_at/expires_at/revoked_at`。
2. root App 输入使用 camelCase `QuotaUsageCalibrationInput`，Wails 绑定生成 `main.QuotaUsageCalibrationInput`。

mock downstream / spy outputs：

1. `internal/cliproxyapi.Client` 对 add/list/revoke 发出正确 method/path/query/body。
2. root mapper 保留 manual calibration 的窗口、模式、数值和生命周期字段。
3. 前端账号域 hook 明确调用 Wails `ListQuotaCalibrations` / `AddQuotaCalibration` / `RevokeQuotaCalibration`，不是直接绕过 App bridge。

当前验证：

    go test ./internal/cliproxyapi -run 'TestQuota(RuntimeClientStatus|UsageCalibrationClientEndpoints)' -count=1
    go test . -run 'TestMap(CodexQuotaResponsePreservesBilling|QuotaUsageCalibrationPreservesManualCalibrationFields)' -count=1
    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    go test ./internal/cliproxyapi ./internal/wailsapp . -count=1
    npm --prefix frontend run typecheck
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成原计划中的：

1. Wails DTO / root App / generated bindings 首版。
2. 前端“修改当前用量”的可调用 API 入口。

仍未完成：

1. calibration 文件 / SQLite 持久化。
2. 可见编辑 UI、历史列表、撤销按钮与审计文案。
3. quota-threshold typed rule 的正式 management CRUD 与前端规则编辑器。

## 2026-06-19 实现切片 6：typed quota-threshold rule CRUD + App bridge

范围：把用户“指定某个 Token 窗口到某个百分比停止”的 typed rule 从静态 config 能力升级为可管理 API 和 App/前端可调用入口。

mock upstream facts：

1. management API rule payload 使用 snake_case：`account_key/window_key/metric/comparator/threshold_percent/enabled`。
2. 旧 `channel-routing/config.json` 可能已有 camelCase：`accountKey/windowKey/thresholdPercent`。

mock downstream / spy outputs：

1. sidecar CRUD 保存到 `channel-routing/config.json` 顶层 `quotaThresholdRules`，`loadQuotaThresholdRulesFromChannelRoutingConfig` 能读取更新后的 rule。
2. 主仓 client 对 list/create/update/delete 发出正确 path/query/body。
3. root mapper 和前端 Wails bindings 保留 rule fields，accounts hook 只能通过 App bridge 调用，不绕过 sidecar。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaThresholdRuleManagementRoutes|TestQuotaRuntimeStoreUpsertFeedsQuotaThresholdGuardFromConfig' -count=1
    go test ./internal/cliproxyapi -run 'TestQuota(RuntimeClientStatus|UsageCalibrationClientEndpoints|ThresholdRuleClientEndpoints)' -count=1
    go test . -run 'TestMap(CodexQuotaResponsePreservesBilling|QuotaUsageCalibrationPreservesManualCalibrationFields|QuotaThresholdRulePreservesRuleFields)' -count=1
    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    npm --prefix frontend run typecheck
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1
    go test ./internal/cliproxyapi ./internal/wailsapp . -count=1

已完成原计划中的：

1. typed quota-threshold rule 的正式 management CRUD 首版。
2. Wails/root/frontend 可调用入口。
3. 旧 camelCase config 兼容读取。

仍未完成：

1. 可见前端规则编辑器。
2. rule 变更后立即重算已有 quota runtime / guard state。
3. calibration 持久化 ledger 与用户可见审计列表。

## 2026-06-19 实现切片 7：calibration file ledger persistence

范围：把 manual calibration 从进程内存升级为 profile 文件 ledger，仍不触碰当前未归类 UI 改动。

mock upstream facts：

1. management API `POST /gettokens/quota-calibrations` 创建 calibration。
2. sidecar restart / new store 使用同一 ledger path。
3. management API `POST /gettokens/quota-calibrations/:id/revoke` 撤销 calibration。

mock downstream / spy outputs：

1. created calibration 写入 `<profile-dir>/quota-calibrations/config.json`。
2. new `QuotaRuntimeStore` 设置同一路径后能 list 到 created entry。
3. revoke 后再次 new store 能读取到 `revoked_at`。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaRuntimeCalibrationLedgerPersistsAcrossStores|TestQuotaRuntimeCalibrationRoutesAddListAndRevoke|TestQuotaRuntimeStoreAppliesManualCalibrationBeforeQuotaThreshold' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成原计划中的：

1. calibration 文件 ledger 持久化。
2. add/revoke 持久化回写。
3. restart/new store 后恢复 calibration ledger。

仍未完成：

1. 用户可见编辑 UI、历史列表和撤销按钮。
2. rule 变更后立即重算已有 quota runtime / guard state。
3. calibration audit trace 的文案与展示。

## 2026-06-19 实现切片 8：runtime immediate re-evaluation

范围：让 rule CRUD 与 manual calibration 变更立即影响当前账号 route guard 状态，不等待下一次 quota refresh。

mock upstream facts：

1. 已缓存的 fresh quota runtime state，包含 raw token window：remaining=45、limit=100、window=tokens_5h。
2. manual calibration delta=30，代表 app 外部已经消耗 30 tokens。
3. management API 新增 quota-threshold rule：remaining-percent <= 20。

mock downstream / spy outputs：

1. AddUsageCalibration 后当前 state 立即变为 effective remaining=15，并触发 quota-threshold block。
2. RevokeUsageCalibration 后基于 raw state 恢复 remaining=45，并立即清除 quota-threshold block。
3. quota-threshold-rules create 后 guard 立即 deny 当前账号；delete 后 guard 立即恢复。
4. internal/gettokenshooks 测试运行时隔离 HOME 和 channel-routing explicit path，避免服务级 mock 测试读写真实用户配置。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaThresholdRuleManagementRoutesRefreshRuntimeGuard|TestQuotaRuntimeStoreRefreshesCurrentStateWhenCalibrationChanges' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成原计划中的：

1. rule 变更后立即重算已有 quota runtime / guard state。
2. calibration add/revoke 后立即重算当前 effective usage。
3. raw/effective state 分层，避免 calibration 重复叠加。
4. sidecar 服务级测试隔离真实配置目录。

仍未完成：

1. 用户可见规则编辑 UI。
2. calibration 历史列表、撤销按钮和 audit trace 展示。
3. 完整 DSL AST / 表达式引擎；当前仍是 typed quota-threshold rule。

## 2026-06-19 实现切片 9：account quota visible editors

范围：把已经完成的 sidecar/App 调用能力接入账号详情 Quota 区，形成最小可见编辑闭环。

mock upstream facts：

1. 账号详情已有 quota window display，可提供 window id / label。
2. App bridge 暴露 calibration CRUD 与 quota-threshold rule CRUD。

mock downstream / spy outputs：

1. QuotaCalibrationPanel 调用 useQuotaCalibrations，支持 add/revoke。
2. QuotaThresholdRulePanel 调用 useQuotaThresholdRules，支持 create/update/delete。
3. AccountQuotaSection 在非只读且存在 quota windows 时展示两个编辑 panel。

当前验证：

    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    npm --prefix frontend run typecheck

已完成原计划中的：

1. 前端“修改当前用量”的可见入口。
2. 前端“Token 窗口到指定百分比停止”的 typed rule 可见入口。
3. 规则启用/停用、删除和校准撤销的基础操作入口。

仍未完成：

1. calibration 历史 / audit trace 的完整体验。
2. rule 冲突、重复规则、后端错误的细粒度引导。
3. 完整 DSL AST 编辑器；当前只暴露 typed quota-threshold 主场景。

## 2026-06-19 实现切片 10：DSL AST / editor hardening / audit surface

范围：补齐用户要求的完整 DSL AST / 表达式引擎、增强前端规则编辑器、校准历史/audit 展示，以及规则冲突和错误引导。

mock upstream facts：

1. fresh quota runtime window：tokens_5h remaining=18、used=82、limit=100、resetAt=+2h。
2. DSL condition AST：all(remaining-percent <= 20, used-percent >= 80)。
3. 重复启用规则：同 account/window/metric 或同 condition AST。
4. calibration ledger 同时存在 active、revoked、expired entries。

mock downstream / spy outputs：

1. DSL condition 命中时输出 quota-threshold block，reason 包含 trace=all(...) 和阈值比较明细。
2. management API 对冲突规则返回 409 和 conflicts payload；非法 AST 返回 400。
3. cliproxyapi/root/Wails/frontend DTO 保留 condition 字段。
4. QuotaThresholdRulePanel 支持结构化编辑和高级 DSL JSON；QuotaCalibrationPanel 展示历史/audit。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaThresholdGuardEvaluatesDSLConditionAST|TestQuotaThresholdRuleManagementRoutesRejectConflictingEnabledRules|TestQuotaThresholdRuleManagementRoutesRejectInvalidRules|TestQuotaThresholdRuleManagementRoutesRefreshRuntimeGuard' -count=1
    go test ./internal/cliproxyapi -run 'TestQuotaThresholdRuleClientEndpoints' -count=1
    go test . -run 'TestMapQuotaThresholdRulePreservesRuleFields' -count=1
    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    npm --prefix frontend run typecheck
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1
    go test ./internal/cliproxyapi ./internal/wailsapp . -count=1

已完成原计划中的：

1. 完整 DSL AST / 表达式引擎首版。
2. 更完整的前端规则编辑器：结构化阈值 + 高级 JSON AST。
3. calibration 历史 / audit trace 展示首版。
4. 冲突、重复规则、错误引导首版。

仍可后续增强：

1. 更多 DSL fact 类型，例如 session、rate-limit、model、project scope。
2. 将高级 JSON AST 进一步表单化为可视化 all/any/not builder。
3. 更精细的冲突解释和规则模拟器。

## 2026-06-19 实现切片 11：runtime/simulator shared evaluator gate

范围：不再扩展规则表达力，先把“同一 facts 下 runtime guard 与 simulator 得出同一决策”做成 sidecar 硬验收口。

mock upstream facts：

1. `SimulationFacts`：固定 `now`、request channel/model/project、accounts。
2. `AccountFacts`：accountId、quotaWindow、calibrationLedger。
3. quota window 状态覆盖 fresh / stale / missing；fresh 场景中 remaining=48、used=52、limit=100，通过 active calibration delta=34 变成 effective used=86、remaining=14。
4. calibration ledger 同时包含 active、revoked、expired entries。

mock downstream / spy outputs：

1. simulator 输出 `SimulationResult`：summary、account decision、matchedRule、reasonTrace、recoveryAt/expiresAt。
2. runtime guard 使用同一 evaluator 输出 `quota-threshold` block。
3. 同一 facts 转换为 runtime state 后，runtime block 的 source/reason/expiresAt 必须与 simulator decision 一致。
4. stale / missing quota fact 只输出 diagnostic/missing trace，不创建 hard block。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run <focused-simulator-runtime-api-tests> -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1

已完成：

1. 新增 sidecar `SimulationFacts` / `SimulationResult` / `AccountDecisionTrace` / `ReasonTraceStep` contract。
2. 抽出 quota-threshold shared evaluator；runtime guard 与 simulator 复用同一判断链。
3. simulator trace 固定 code + data，不只输出自然语言。
4. 新增 `POST /v0/management/route-guard/rules/simulate`，读取已持久化 quota-threshold rules，并按 ruleIds 过滤。
5. stale / missing quota window 不 hard block；fresh + matched 才 block；calibration active/ignored 进入 trace。

仍未完成：

1. 主仓 `internal/cliproxyapi` / Wails DTO / 前端“模拟当前规则”入口尚未接入。
2. simulator 目前只覆盖 quota-threshold；不宣称完整 route guard engine。
3. 后续扩单日、多日、起止时间 window 前，必须继续复用本 evaluator/simulator 证明口。

## 2026-06-19 实现切片 12：Simulator Visible Loop

范围：不继续扩 DSL、时间窗或 rule builder，只把 Slice 11 的 quota-threshold simulator trace 从 sidecar 接到 App/frontend，让用户在账号详情规则面板里看到“当前规则为什么会 allow / block / diagnostic”。

mock upstream facts：

1. 当前账号 quota window：accountKey、windowId、observedUsed、observedLimit、observedRemaining、startsAt、endsAt、status。
2. 当前账号 calibration ledger：active / revoked / expired entries，作为 simulator facts 输入，不在模拟时写入 ledger。
3. 当前规则草稿或已保存 rule：legacy threshold rule / condition AST 均作为请求输入，不触发持久化。
4. 固定 now 与 request metadata：channel / model / project 只作为 facts metadata 透传。

mock downstream / spy outputs：

1. `internal/cliproxyapi` 对 `POST /v0/management/route-guard/rules/simulate` 发出 sidecar-shaped payload，保留 ruleIds、draft rule、facts.accounts、quotaWindow、calibrationLedger。
2. root/Wails DTO 透明映射 `SimulationResult`，保留 `reasonTrace[].code` 与任意 `data` object，不 stringify。
3. 前端 `QuotaThresholdRulePanel` 展示 decision、matched rule、recovery / expiry、account decision、trace code/message/data、diagnostics；模拟失败显示为 unknown/error，不得暗示 allow/safe。
4. sidecar draft simulation 不写入 `quotaThresholdRules`。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestRouteGuardRuleSimulationRouteAcceptsDraftQuotaThresholdRule|TestRouteGuardRuleSimulationRouteUsesPersistedQuotaThresholdRules|TestQuotaThresholdSimulatorMatchesRuntimeGuardForSameFacts' -count=1
    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -count=1
    go test ./internal/cliproxyapi -run 'TestRouteGuardSimulationClientPreservesTraceData|TestQuotaThresholdRuleClientEndpoints' -count=1
    go test . -run 'TestMapSimulationResultPreservesTraceData|TestMapQuotaThresholdRulePreservesRuleFields' -count=1
    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    npm --prefix frontend run typecheck
    go test ./internal/cliproxyapi ./internal/wailsapp . -count=1

已完成：

1. 主仓新增 `SimulateRouteGuardRule` client / Wails / root App / generated bindings。
2. DTO 覆盖 request facts、quotaWindow、calibrationLedger、matchedRule、accountTrace、reasonTrace、diagnostics，并保持 trace data 为结构化对象。
3. 前端新增 `routeGuardSimulation.ts` model 和 `useRouteGuardSimulation` hook。
4. `QuotaThresholdRulePanel` 新增“模拟当前规则”和单条规则“模拟”入口，可用当前账号 quota window 与 calibration ledger 组装 facts。
5. simulation preview 明确展示 block / diagnostic / allow，不把调用失败当成安全放行。
6. sidecar simulate route 支持 draft rule / rules 输入，模拟草稿不会写入持久化规则。

仍未完成：

1. 单日、多日、起止时间 window 仍未扩展；本 slice 只验证 quota-threshold 可见闭环。
2. 高级 AST 的可视化 all/any/not builder 仍是后续增强。
3. 当前前端 quota window status 主要来自已有账号详情可见字段；更细的 stale/degraded fact 需要后续把完整 quota runtime fact 暴露给面板。

## 2026-06-19 实现切片 13：Multi-window Budget Facts Contract

范围：支持一个账号在 simulator facts 中携带多个 budget/quota window，让单日、多日、起止时间窗口先以 typed window facts 进入 shared evaluator。仍不引入 cron，不扩自由 DSL，不做新的可视化 builder。

mock upstream facts：

1. 同一账号包含多个窗口：
   - `tokens_1d`：daily window，带 startsAt / endsAt。
   - `tokens_7d`：multi-day window，带 startsAt / endsAt。
   - `tokens_campaign`：bounded window，带明确起止时间。
2. 每个 window 提供 observedUsed / observedLimit / observedRemaining / status。
3. 规则仍通过 `window_key` 选择目标窗口，可使用 legacy threshold 字段或 condition AST。

mock downstream / spy outputs：

1. simulator 对 daily / multi-day / bounded window 分别能 block，并在 reason 中保留命中的 window key。
2. 同一 facts 转为 runtime state 后，runtime guard 的 reason / expiresAt 与 simulator decision 一致。
3. 主仓 client/root/frontend DTO 透明透传 `quotaWindows[]`，旧 `quotaWindow` 字段继续兼容。
4. persisted condition-only AST 规则不能因为缺少 legacy `windowKey` 被 runtime loader 过滤掉。

当前验证：

    cd docs-linhay/references/CLIProxyAPI && GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/gettokenshooks -run 'TestQuotaThresholdSimulatorSupportsMultipleBudgetWindows|TestLoadQuotaThresholdRulesKeepsConditionOnlyRuntimeRule|TestQuotaThresholdSimulatorMatchesRuntimeGuardForSameFacts' -count=1
    go test ./internal/cliproxyapi . -run 'TestRouteGuardSimulationClientPreservesTraceData|TestMapSimulateRouteGuardRuleRequestPreservesMultipleQuotaWindows|TestMapSimulationResultPreservesTraceData' -count=1
    node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
    npm --prefix frontend run typecheck

已完成：

1. sidecar `AccountFacts` 新增 `quotaWindows[]`，保留旧 `quotaWindow` 单窗口兼容。
2. `QuotaWindowFacts` 增加 `kind`，可标记 daily / multi-day / bounded / tokens 等窗口来源。
3. `accountQuotaRuntimeStateFromSimulationFacts` 会把多个窗口转为 runtime windows，并继续让 calibration ledger 按 windowKey 生效。
4. 新增 same-facts 测试覆盖 daily / multi-day / bounded 三类窗口。
5. 修复 runtime loader 对 condition-only AST 持久化规则的过滤条件。
6. 主仓 client/root/frontend DTO 与前端模拟请求构造已透传 `quotaWindows[]`。

仍未完成：

1. 真实 usage aggregator 尚未生成 daily / multi-day / bounded window facts；当前 slice 先锁 facts contract 和 evaluator 行为。
2. cron 仍不作为规则表达主路径；后续如果需要周期规则，应先转成显式 bounded window facts。
3. 前端还没有多窗口选择/创建 UI；当前仅保证模拟链路可接收多窗口。

## 2026-06-19 智者裁决后的执行计划：Budget Facts First

背景：Slice 11-13 已经证明 quota-threshold typed rule、condition AST、shared evaluator、simulator visible loop 与 `quotaWindows[]` facts contract 可以工作。但 `quotaWindows[]` 目前仍主要是模拟输入，不是由真实 usage attribution store 生成的系统事实。

裁决：下一步必须先做事实生产线，不扩 DSL、不做 UI、不接 cron。

最终依赖排序固定为：

1. Slice 14：Usage Aggregator -> Budget Window Facts
2. Slice 15：Aggregator Facts -> Simulator/Runtime Same-Facts Gate
3. Slice 16：Window Definition Management API
4. Slice 17：Frontend Multi-window UI
5. Slice 18：Recurring/Cron 编译层评估

这不是偏好排序，而是依赖排序。规则引擎可信度来自 sidecar facts，不来自规则 UI。

### 全局硬边界

1. Route hot path 只消费 materialized facts：

   ```json
   {
     "windowId": "tokens_7d",
     "kind": "multi-day",
     "startsAt": "...",
     "endsAt": "...",
     "observedUsed": 12345,
     "observedLimit": 100000,
     "observedRemaining": 87655,
     "status": "fresh"
   }
   ```

2. Route hot path 不知道也不解析：
   - cron expression
   - recurrence rule
   - timezone expansion
   - DST transition
   - business calendar
   - weekday/weekend/holiday
3. Cron / recurring 只能在 management/config 层编译成 explicit window definitions 或 active bounded windows。
4. Cron 将来若要进入产品，必须满足 preview / audit / replay：
   - preview：用户能看到展开后的具体窗口。
   - audit：系统能解释 bounded window 来自哪个 recurrence。
   - replay：相同 config、timezone、now 生成相同窗口。
5. 前端不能计算 used / remaining / blocked，只展示 sidecar facts 与 simulator trace。
6. `not blocked` 不等于 `safe`：missing/stale facts 在 simulator/UI 上必须是 inconclusive / diagnostic。

### Window Definition 首版 schema

第一版只支持 daily、multi-day calendar、bounded。不支持 rolling，不支持 cron，不支持 business calendar。

```ts
type BudgetWindowDefinition =
  | {
      id: string
      kind: "daily"
      metric: "tokens" | "requests" | "cost"
      limit: number
      timezone: string
      enabled: boolean
    }
  | {
      id: string
      kind: "multi-day"
      semantics: "calendar"
      days: number
      metric: "tokens" | "requests" | "cost"
      limit: number
      timezone: string
      enabled: boolean
    }
  | {
      id: string
      kind: "bounded"
      metric: "tokens" | "requests" | "cost"
      limit: number
      startsAt: string
      endsAt: string
      enabled: boolean
    }
```

语义：

1. daily：definition 指定 timezone 下的自然日。
   - `startsAt = local date 00:00:00` 转 UTC。
   - `endsAt = next local date 00:00:00` 转 UTC。
   - 不默认机器时区、provider 时区或浏览器时区。
2. multi-day：第一版只做 calendar N days，不做 true rolling N days。
   - 例如 7 个自然日：`startsAt = 今天本地 00:00 - 6 days`，`endsAt = 明天本地 00:00`。
   - `expiresAt = window.endsAt`。
   - 后续真 rolling 另加 `kind: "rolling"` 或等价新语义，不能混入 multi-day calendar。
3. bounded：半开区间 `[startsAt, endsAt)`。
   - `eventAt == startsAt` 计入。
   - `eventAt == endsAt` 不计入。
   - 相邻窗口不能双计。
4. facts 不表达优先级；daily / multi-day / bounded 都只是不同 `windowId`。最终 block 原因由规则/decision aggregation 决定。
5. usage budget windows 的恢复时间使用 `window.endsAt`；provider quota windows 可使用 provider resetAt。trace 必须区分 `recoverySource`。

### QuotaWindowFacts 目标字段

现有 `QuotaWindowFacts` 需要升级为可解释的 budget facts：

```ts
type QuotaWindowFacts = {
  windowId: string
  kind: "daily" | "multi-day" | "bounded"
  metric: "tokens" | "requests" | "cost"
  startsAt: string
  endsAt: string
  timezone?: string
  observedUsed: number
  observedLimit: number
  observedRemaining: number
  observedUsedPercent: number
  observedRemainingPercent: number
  rawUsed: number
  calibrationDelta: number
  calibratedUsed: number
  status: "fresh" | "stale" | "missing" | "invalid"
  generatedAt: string
  source: "usage-aggregator"
  recoverySource?: "window-end" | "provider-reset" | "manual" | "unknown"
}
```

保留 `rawUsed / calibrationDelta / calibratedUsed` 的原因：trace 必须解释为什么被 block，例如 raw committed usage + external calibration = effective used。

### Slice 14：Usage Aggregator -> Budget Window Facts

目标：让 sidecar 从 deterministic usage attribution store 生成 daily / multi-day / bounded `QuotaWindowFacts[]`。

mock upstream facts：

1. `usageAttributionEvent` fixtures：
   - committed events
   - failed events
   - cancelled events
   - pending / reserved-but-not-committed events
2. injected `now`
3. explicit timezone：至少 `Asia/Shanghai` 与 `America/Los_Angeles`
4. budget window definitions：daily / multi-day calendar / bounded
5. calibration ledger：delta、set-effective、window 外 adjustment

mock downstream / spy outputs：

1. `BuildBudgetWindowFacts(accountKey, definitions, now)` 返回 `QuotaWindowFacts[]`。
2. 每个 fact 包含 UTC `startsAt/endsAt`、timezone、raw/calibrated/effective usage、limit、remaining、percent、status、generatedAt、source。
3. 不写 route guard，不调用真实账号，不依赖机器 timezone。

必测边界：

1. daily window：
   - timezone 显式传入。
   - 今日内 committed event 计入。
   - 昨日 event 不计入。
   - `eventAt == startsAt` 计入。
   - `eventAt == endsAt` 不计入。
   - 同一个 UTC now 下，`Asia/Shanghai` 与 `America/Los_Angeles` 生成不同 local day window。
2. multi-day calendar window：
   - N 个自然日内 committed event 计入。
   - 窗口外 event 不计入。
   - `endsAt = 下一自然日 00:00 local time`。
   - 不做 true rolling N days。
3. bounded window：
   - `startsAt <= eventAt < endsAt`。
   - start 边界计入。
   - end 边界不计入。
4. event status：
   - committed 计入。
   - failed / cancelled / pending / reserved-but-not-committed 不计入。
   - streaming usage 第一版不引入 estimated / reconciled，只认 committed。
5. calibration：
   - delta 在 raw observedUsed 上加减。
   - set-effective 若实现，语义必须是“某时间点外部校准基线 + 该时间点之后 committed usage”；若本轮讲不清楚，Slice 14 先只做 delta。
   - multiple adjustments 顺序可解释。
   - window 外 calibration 不影响该 window。
6. deterministic：
   - 全部 injected clock。
   - 不依赖系统 timezone。
   - 不依赖真实账号。

完成定义：上述测试全部通过后，才能说 Slice 14 完成。真实账号 smoke 不算主证据。

执行结果（2026-06-19）：

1. 已在 sidecar 新增 `BuildBudgetWindowFacts`，从 `usage_attribution_events` 聚合生成 `QuotaWindowFacts[]`。
2. 支持窗口：
   - `daily`：按 definition 显式 timezone 的 local natural day 生成 UTC `[startsAt, endsAt)`。
   - `multi-day`：第一版只支持 `calendar` N 个自然日，不做 true rolling。
   - `bounded`：直接使用显式 `[startsAt, endsAt)`。
3. 支持 metric：
   - `tokens`：统计 committed `total_tokens`。
   - `requests`：统计 committed request count。
4. committed-only 语义：只统计 `completed_at_unix_ms > 0` 且 `failed = 0` 的 usage attribution events；窗口边界使用 `completed_at_unix_ms >= startsAt && completed_at_unix_ms < endsAt`。
5. facts trace 字段已扩展：`metric`、`timezone`、`observedUsedPercent`、`observedRemainingPercent`、`rawUsed`、`calibrationDelta`、`calibratedUsed`、`generatedAt`、`source`、`recoverySource`。
6. calibration 只落地 `delta`：仅当 calibration 的 account/window/metric 匹配、未 revoked/expired、createdAt 落入当前 window 时参与计算；`set-effective` 暂不在 facts builder 中实现，避免语义未闭合。
7. recovery source 对 usage budget window 固定为 `window-end`，供后续 Slice 15 runtime/simulator same-facts gate 复用。
8. 顺手修复 quota-threshold / calibration 旧测试的时间基准：这些测试原来固定 `2026-06-19T10:00Z`，而 active guard lookup 使用真实当前时间；当真实时间超过测试 `resetAt` 后会误判 block 过期。现在改为使用当前时间之后的稳定小时，保持测试语义不变。

验证结果：

```bash
go test ./internal/gettokenshooks -run 'TestBuildBudgetWindowFacts' -count=1
go test ./internal/gettokenshooks -run 'TestBuildBudgetWindowFacts|TestQuotaRuntimeStoreAppliesManualCalibrationBeforeQuotaThreshold|TestQuotaRuntimeCalibrationRoutesAddListAndRevoke|TestQuotaRuntimeStoreRefreshesCurrentStateWhenCalibrationChanges|TestQuotaThresholdRuleManagementRoutesRefreshRuntimeGuard' -count=1
go test ./internal/gettokenshooks -count=1
go test ./...
```

状态：Slice 14 完成。下一步进入 Slice 15：Aggregator Facts -> Simulator/Runtime Same-Facts Gate。

### Slice 15：Aggregator Facts -> Simulator/Runtime Same-Facts Gate

目标：证明 Slice 14 生成的同一个 facts object 同时喂给 simulator 与 runtime guard state，得到一致决策。

最小链路：

```text
mock committed usage events
-> BuildBudgetWindowFacts()
-> SimulationFacts.quotaWindows
-> simulate current rule
-> runtime state using same quotaWindows
-> same source / reason / expiresAt
```

关键点：Slice 15 不能让 runtime 和 simulator 各自重新查 store。必须使用同一个 `BuildBudgetWindowFacts` 输出，否则证明的是“两套读取路径碰巧一致”，不是 shared evaluator 一致。

验收：

1. daily：`tokens_1d remaining-percent <= 10` blocks。
2. multi-day：`tokens_7d used-percent >= 80` blocks。
3. bounded：`tokens_campaign remaining <= N` blocks。
4. missing facts：diagnostic only。
5. stale facts：diagnostic only。
6. 核心断言：
   - `simulator.decision.source == runtime.block.source`
   - `simulator.decision.reason == runtime.block.reason`
   - `simulator.decision.expiresAt == runtime.block.expiresAt`

执行结果（2026-06-19）：

1. 已把 simulator/runtime 的 window facts 转换收口到共享 seam：`accountQuotaRuntimeStateFromQuotaWindowFacts`。
2. `accountQuotaRuntimeStateFromSimulationFacts` 不再单独解释 `quotaWindow / quotaWindows`，而是委托共享 seam 后再应用 legacy `CalibrationLedger`。
3. 已新增 aggregator same-facts gate：
   - mock upstream：temp sqlite `usage_attribution_events`、daily window definition、Asia/Shanghai timezone、injected `now`、delta calibration。
   - facts producer：`BuildBudgetWindowFacts()`。
   - simulator input：同一份 `QuotaWindowFacts[]` 进入 `SimulationFacts.Accounts[].QuotaWindows`。
   - runtime input：同一份 `QuotaWindowFacts[]` 通过共享 seam 转成 `AccountQuotaRuntimeState`。
   - spy outputs：simulator decision 与 runtime guard block 的 `source / reason / expiresAt` 必须完全一致。
4. 已覆盖未触发阈值场景：同一份 aggregator facts 下 simulator 返回 allow，runtime guard 不产生 block。
5. 本 slice 不接真实账号、不读真实 quota runtime、不让 simulator/runtime 重新查 store。

验证结果：

```bash
go test ./internal/gettokenshooks -run 'TestBudgetWindowFactsDriveSimulatorAndRuntimeGuardWithSameDecision|TestBudgetWindowFactsDoNotBlockSimulatorOrRuntimeWhenThresholdNotMet' -count=1
go test ./internal/gettokenshooks -count=1
go test ./...
```

状态：Slice 15 完成。下一步进入 Slice 16：Window Definition Management API。

### Slice 16：Window Definition Management API

目标：先有 sidecar API，再做前端 UI。前端不直接拼 definition 语义。

API 至少包括：

1. list definitions
2. create definition
3. update definition
4. delete/disable definition
5. preview active facts for account

第一版删除策略：优先 disable / soft-delete，不硬删。因为规则可能引用旧 `windowId`。

必须防止：

1. 删除 window definition 后，已有规则引用悬空。
2. update 改变 `windowId` 导致旧规则失效。
3. invalid timezone / invalid start-end / missing limit 被静默保存。

执行结果（2026-06-19）：

1. sidecar 新增 budget window definition ledger，默认路径 `<profile-dir>/budget-window-definitions/config.json`。
2. management API 已完成：
   - `GET /v0/management/gettokens/budget-window-definitions`
   - `POST /v0/management/gettokens/budget-window-definitions`
   - `PUT /v0/management/gettokens/budget-window-definitions/:id`
   - `DELETE /v0/management/gettokens/budget-window-definitions/:id`
   - `POST /v0/management/gettokens/budget-window-definitions/preview`
3. delete 是 soft-disable：definition 保留但 `enabled=false`，避免已存在规则的 `windowId` 立刻悬空。
4. update 不允许改变 `id/windowId`。
5. validation 已拒绝 invalid timezone、invalid bounded start/end、missing/zero limit、unsupported metric、unsupported kind、unsupported multi-day semantics。
6. preview 使用 `BuildBudgetWindowFacts`，只返回 sidecar 生成的 facts，不写 route guard。
7. 主仓已接入 client / Wails / root App / generated binding surface。

验证结果：

```bash
go test ./internal/gettokenshooks -run 'TestBudgetWindowDefinition' -count=1
go test ./internal/cliproxyapi -run 'TestBudgetWindowDefinitionClientEndpoints' -count=1
go test . -run 'TestMapBudgetWindowDefinitionsAndPreviewFacts' -count=1
```

状态：Slice 16 完成。

### Slice 17：Frontend Multi-window UI

目标：前端只做选择 window、创建最小 definition、展示 preview/trace。

必须做：

1. 选择 window。
2. 创建最小 daily / multi-day calendar / bounded definition。
3. 展示 sidecar preview facts。
4. 保存规则后调用 simulator trace。
5. 缺失或 stale facts 显示“无法确认该规则会生效”，不得显示绿色安全。

明确不做：

1. all/any/not visual builder。
2. 复杂 cron 表达式。
3. 前端计算 remaining。
4. 前端判断 blocked。

核心提示：规则是否有效，以 sidecar simulator trace 为准。

执行结果（2026-06-19）：

1. 前端账号 Quota 规则区新增 budget window definition 面板。
2. 支持创建最小 definition：
   - daily
   - multi-day calendar
   - bounded
3. 支持刷新 sidecar preview facts，并展示 raw / calibration delta / recovery boundary。
4. 规则窗口选择现在优先使用 sidecar preview facts；没有 preview facts 时才回退到现有 runtime quota window。
5. `SimulateRouteGuardRule` request builder 已支持直接携带 sidecar preview 生成的 `QuotaWindowFact[]`，避免前端把 preview facts 重新解释成另一套窗口。
6. 缺失 preview facts 时，UI 明确显示 inconclusive 文案：“无法确认规则会生效，也不能显示为绿色安全。”
7. 前端仍不计算 used / remaining / blocked；这些只来自 sidecar preview facts 与 simulator trace。

验证结果：

```bash
node --test frontend/src/features/accounts/tests/quotaCalibrationBindings.test.mjs
npm --prefix frontend run typecheck
```

状态：Slice 17 完成。

### Slice 18：Recurring/Cron 编译层评估

现在不讨论、不实现 cron。

升级触发条件：

1. 用户确实需要复杂周期，例如工作日 9:00-18:00。
2. daily / multi-day calendar / bounded 无法表达。
3. 已有 preview 能展示 cron 编译出的具体 windows。
4. 有测试证明 timezone / DST / replay 边界稳定。

进入条件满足后，cron 也只能作为 management 层 recurrence intent，编译为 explicit bounded windows；route hot path 仍只看 materialized facts。

评估结论（2026-06-19）：

1. 当前需求“单日限额、多日限额、起止时间限额”已由 daily / multi-day calendar / bounded 三类 explicit definitions 覆盖，不需要引入 cron。
2. cron / recurring 不能进入 route hot path；热路径只消费 `QuotaWindowFacts[]` 和 `AccountQuotaRuntimeState`。
3. 如果后续出现工作日、节假日、固定时段等复杂周期，正确形态是：
   - management 层保存 recurrence intent；
   - 编译层在给定 timezone + now 下展开为 explicit bounded window definitions / active windows；
   - preview 展示展开后的具体窗口；
   - audit 记录每个 bounded window 的 recurrence source；
   - replay 测试证明相同 config/timezone/now 输出相同 windows。
4. 当前 API 已通过负向测试拒绝 `kind=cron` 与 `multi-day semantics=rolling`，避免把未完成语义混入现有规则引擎。
5. 前端不暴露 cron 输入，也不根据 cron 推导窗口状态。

验证结果：

```bash
go test ./internal/gettokenshooks -run 'TestBudgetWindowDefinitionManagementRoutesRejectInvalidDefinition' -count=1
```

状态：Slice 18 完成；后续若要做 cron，需要新建独立 recurrence compiler 设计，不复用当前 route hot path。

### 假进展清单

以下都不能作为完成证据：

1. 先做漂亮 UI，但没有 aggregator facts。
2. 前端推导 window 状态、remaining 或 block。
3. 真实账号 smoke 通过。
4. cron 能保存但不能 preview / audit / replay。
5. simulator 和 runtime 各自查库后结果一样。

### 下一步执行令

直接进入 Slice 14：Usage Aggregator -> Budget Window Facts。

第一版只做：

1. daily
2. multi-day calendar
3. bounded
4. committed usage
5. calibration delta
6. set-effective 只有在语义一次讲清楚时才做；否则先不做
7. injected clock
8. explicit timezone
9. `[start, end)` window boundary
