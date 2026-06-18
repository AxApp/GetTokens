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
