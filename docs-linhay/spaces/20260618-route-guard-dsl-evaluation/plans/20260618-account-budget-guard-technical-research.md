# Account Budget Guard 技术调研

日期：2026-06-18
状态：technical-research

## 结论

“单账号限额、外部用量校准、百分比停止、自动恢复”不应继续作为 route guard DSL 的细枝末节处理，而应上升为一个新领域对象：Account Budget Guard。

推荐产品与技术分层：

    Account Budget：用户定义这个账号允许怎么用
    Budget Runtime State：sidecar 计算当前窗口、有效用量、阈值动作
    Route Guard：只消费 BudgetRuntimeState 产出的 guard fact

前端可以让用户“直接修改当前有效用量”，但底层必须保存为 calibration adjustment，而不是覆盖 observed usage。

## 当前代码事实

### Quota window 已有字段

主仓已有 quota window DTO：

- app_types.go 中 CodexQuotaWindow 包含 ID、RemainingPercent、UsedTokens、LimitTokens、RemainingTokens、ResetAtUnix。
- internal/accounts/quota_builder.go 已从 Codex usage payload 构建 5H、7D、code-review 等窗口。
- internal/wailsapp/app_runtime_menubar_snapshot.go 已读取 QuotaRuntimeWindow 的 RemainingPercent 并展示状态。

这说明 token window / remaining percent / reset time 已经是系统现有概念，可以作为 Budget Window 的事实来源之一。

### Usage 与 rate-limit 已有基础

现有代码已经具备以下可复用边界：

- app_types.go 中 SidecarUsageAttributionResponse / SidecarUsageAttributionItem / SidecarUsageAttributionBucket，可作为 observed usage 的候选来源。
- frontend/src/features/accounts/UsageDeskFeature.tsx 与 hooks/useUsageDeskFeature.ts 已有 observed/projected usage 展示、range、resolution、tokens/requests metric 的前端模型。
- app_types.go 中 RateLimitRule / RateLimitState / RateLimitRuleState 已有 CurrentUsage、UsagePct、LimitValue、Window 等概念。

这些能力说明 Account Budget Guard 不需要从零发明“用量展示”和“窗口百分比”，但必须重新定义“预算窗口 + 手动校准 + 路由动作”的权威边界。

### Channel routing / route guard 边界

当前 channel routing 仍有本地 fallback explain 与 runtimeStates 兼容路径。长期目标应是 sidecar explain / decisions / live sessions 成为权威，Budget Guard 也必须在 sidecar 内计算并输出 route guard fact。

## 推荐领域模型

### AccountBudgetDefinition

用户保存的预算定义。

| 字段 | 说明 |
| --- | --- |
| id | 预算规则 ID |
| accountKey | 目标账号 |
| metric | tokens / requests，cost 后续扩展 |
| limitValue | 当前窗口限额 |
| windowPolicy | daily / multi-day / bounded / rolling |
| resetPolicy | resetAt / duration / cron-like schedule |
| timezone | 日限额、多日限额、cron-like reset 的时区 |
| enabled | 是否启用 |

### BudgetThreshold

一个预算可以有多个阈值动作。

| 字段 | 说明 |
| --- | --- |
| metric | remaining-percent / used-percent / absolute-remaining / absolute-used |
| comparator | <= / >= |
| thresholdValue | 阈值 |
| action | observe-only / prefer-lower / drain / block |
| priority | 同时命中时的优先级 |
| enabled | 是否启用 |

### UsageCalibrationEntry

用户手动修改当前有效用量时，底层写入校准项。

| 字段 | 说明 |
| --- | --- |
| id | 校准项 ID |
| accountKey | 目标账号 |
| budgetID | 目标预算 |
| windowID | 生效窗口 |
| metric | tokens / requests |
| mode | delta / set-effective |
| value | 增量值或目标有效值 |
| computedDelta | set-effective 时由 sidecar 计算出的差值 |
| reason | 用户填写原因 |
| createdAt | 创建时间 |
| expiresAt | 默认跟随 windowEnd |
| revokedAt | 撤销时间 |

前端可以显示“修改当前用量”，但 sidecar 保存为 calibration entry。

### BudgetRuntimeState

sidecar 计算出的预算事实。

| 字段 | 说明 |
| --- | --- |
| accountKey | 目标账号 |
| budgetID | 预算 ID |
| windowID | 当前窗口 |
| windowStart / windowEnd | 窗口边界 |
| observedUsage | GetTokens 观测用量 |
| manualAdjustment | 有效校准合计 |
| effectiveUsage | observedUsage + manualAdjustment |
| effectiveRemaining | limitValue - effectiveUsage |
| usedPercent / remainingPercent | 百分比 |
| activeActions | 当前命中的动作 |
| freshness | fresh / stale / degraded |
| evaluatedAt | 计算时间 |

### BudgetGuardFact

route engine 消费的事实。

| 字段 | 说明 |
| --- | --- |
| source | budget-threshold / budget-exceeded |
| accountKey | 目标账号 |
| action | observe-only / prefer-lower / drain / block |
| routeBlocking | block 时为 true |
| noNewSession | drain 时为 true |
| reason | 可读原因 |
| expiresAt | windowEnd / resetAt |
| evidenceRefs | 指向 BudgetRuntimeState 与 calibration entries |

## Window policy 设计

### daily

单日限额。

输入：

- timezone
- resetTime，例如 00:00

输出：

- 当前 local day windowStart / windowEnd
- resetAt = windowEnd

### multi-day

多日限额。

输入：

- anchorStart
- durationDays
- timezone

输出：

- 从 anchorStart 开始按 durationDays 切分窗口

### bounded

起止时间限额。

输入：

- startAt
- endAt

语义：

- now < startAt：规则未开始
- startAt <= now < endAt：active
- now >= endAt：失效并自动恢复

### rolling

滚动窗口。建议第二期再做，因为它需要按时间范围扫描 usage events，不适合作为第一期 MVP。

### cron-like reset

cron-like schedule 只能作为高级 resetPolicy，不能替代 windowPolicy。

结论：

- daily / multi-day / bounded 是第一期必做。
- cron-like schedule 放到 expert mode 或第二期。

## 手动修改当前用量的前端语义

用户看到的是“修改当前有效用量”，不是“校准记录”。

推荐交互：

1. 当前预算状态展示 observed / manual / effective。
2. 用户点击“修改当前用量”。
3. 弹窗显示 GetTokens 观测值、当前有效值、输入新的目标有效值、原因。
4. sidecar 计算 computedDelta = targetEffectiveUsage - observedUsage。
5. 保存 UsageCalibrationEntry。

默认限制：

1. targetEffectiveUsage 不得小于 observedUsage。
2. 如果后续开放小于 observedUsage，必须二次确认并标记 override-risk。
3. 所有校准项必须可撤销，但撤销写 revokedAt，不物理删除。

## 前端编辑模型

入口放在账号详情 modal 的“预算与守卫”模块。

布局：

    顶部：当前预算状态 summary
    左侧：预算规则列表 + 修正历史
    右侧：规则详情 / 编辑器 / dry-run

编辑器分段：

1. 预算窗口：daily / multi-day / bounded。
2. 预算指标：tokens / requests。
3. 当前用量：observed + manual = effective，提供“修改当前用量”。
4. 阈值动作：observe-only / drain / block，多级阈值。
5. 自动恢复：window reset / endAt / fresh quota recovery / manual clear。
6. Dry-run：保存前展示当前 route impact。

前端 draft 只做本地校验；保存、dry-run、runtime state 全部以 sidecar 为权威。

## Route engine 接入

Budget Guard 不直接改 account disabled。

预算命中后只生成 runtime guard source：

- budget-threshold
- budget-exceeded

动作映射：

| action | route engine 阶段 | 语义 |
| --- | --- | --- |
| observe-only | Trace only | 不改变候选 |
| prefer-lower | Preference | 降权，后续实现 |
| drain | Preference / Session boundary | 不接新 session，不中断已 commit stream |
| block | HardBlock | 过滤候选 |

Provider quota-empty 的优先级高于本地 Budget。Budget 可以更保守，但不能复活真实 quota-empty 账号。

## API 草案

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /v0/management/gettokens/account-budgets?account_key=... | 列出账号预算 |
| POST | /v0/management/gettokens/account-budgets | 创建预算 |
| PUT | /v0/management/gettokens/account-budgets/:id | 更新预算 |
| DELETE | /v0/management/gettokens/account-budgets/:id | 删除预算 |
| GET | /v0/management/gettokens/account-budgets/:id/state | 获取 runtime state |
| POST | /v0/management/gettokens/account-budgets/:id/dry-run | dry-run |
| POST | /v0/management/gettokens/account-budgets/:id/calibrations | 添加手动校准 |
| POST | /v0/management/gettokens/account-budgets/:id/calibrations/:calibration_id/revoke | 撤销校准 |

## Mock 上下游测试方案

本能力必须优先用 mock upstream + mock downstream 测试，作为最快、最稳定的服务验证路径。该策略沿用 docs-linhay/dev/20260603-upstream-downstream-mock-testing.md 的流程规则。

### Mock upstream

用于稳定构造 sidecar / budget evaluator 的输入事实。

| 上游输入 | Mock 方式 | 覆盖点 |
| --- | --- | --- |
| quota runtime window | fixture payload / fake quota store | remaining percent、token windows、resetAt、stale/degraded |
| usage attribution | fake usage aggregator | observedUsage、tokens/requests、窗口内外数据 |
| account inventory | in-memory account fixture | accountKey、disabled、routeable、provider |
| live sessions | fake live session tracker | drain 对新 session / 已有 sticky 的差异 |
| time source | injected clock | daily、multi-day、bounded、reset/recovery |
| project/channel request context | fixture RouteRequestContext | Codex/Claude、model、projectKey、session family |

要求：所有时间、窗口、usage、quota、session 输入都必须可复现，不能依赖真实账号、真实 OpenAI quota、真实 Codex 请求或本机当前时间。

### Mock downstream

用于验证 Account Budget Guard 对下游的影响，不触达真实外部服务。

| 下游行为 | Fake / Spy | 断言 |
| --- | --- | --- |
| Route engine decision | fake decision sink | BudgetGuardFact 是否进入 trace、stage、droppedReasons |
| request executor | spy executor | block 时不调用 executor；drain 新 session 不选该账号 |
| runtime source store | fake store | source-scoped 写入、清理、expiresAt、pool epoch bump |
| calibration persistence | in-memory ledger | add/revoke/expire 后 effectiveUsage 正确 |
| Wails DTO / frontend adapter | fixture DTO | 前端只展示 sidecar 返回的 observed/manual/effective/routeImpact |

### 必测 mock 场景

1. daily window：fake clock 在同一天内，observed=60k、manual set-effective=90k、limit=100k，dry-run 命中 drain。
2. multi-day window：anchorStart + 7 days，fake clock 分别在窗口内和窗口外，校准项只在窗口内生效。
3. bounded window：startAt 前不生效，窗口内生效，endAt 后自动恢复。
4. quota-threshold：fake quota window remaining=18%、threshold=20%，写出 budget-threshold；fresh quota 恢复到 35% 后只清 budget-threshold。
5. stale/degraded quota：不创建新的强阻断，不触发强恢复，只输出诊断 trace。
6. drain：fake live session 中已有 sticky session，断言新 session 不选账号，已 commit stream 不被中断。
7. block：断言 executor 不被调用，decision ledger 有 HardBlock + budget evidence。
8. calibration revoke：撤销后 effectiveUsage 回落，audit trace 保留撤销事实。
9. provider quota-empty 优先级：即使 Budget 未 block，真实 quota-empty mock fact 仍阻断；Budget 不得复活该账号。

### 分层测试顺序

1. WindowResolver 单测：只 mock clock，不接 usage / route。
2. CalibrationLedger 单测：只测 add / set-effective / revoke / expire。
3. BudgetEvaluator 单测：mock observed usage + calibration + threshold，输出 BudgetRuntimeState。
4. BudgetGuardFact 单测：BudgetRuntimeState -> action / expiresAt / evidenceRefs。
5. RouteEngine 集成测试：mock facts + fake executor，验证 explain/request parity。
6. Wails / frontend adapter 测试：fixture DTO -> UI model，不启动真实 sidecar。

真实 dev App 或真实账号只作为后置 smoke，不作为第一验证路径。

## 实施分期

### Phase A：模型与 dry-run

1. sidecar 增加 BudgetDefinition、BudgetThreshold、UsageCalibrationEntry、BudgetRuntimeState。
2. 实现 daily / multi-day / bounded WindowResolver。
3. 实现 manual calibration delta 与 set-effective 计算。
4. 提供 dry-run API，不影响真实路由。

### Phase B：前端预算编辑器

1. 账号详情加入“预算与守卫”模块。
2. 支持 daily / multi-day / bounded 表单。
3. 支持 tokens / requests limit。
4. 支持修改当前有效用量。
5. 支持 dry-run preview。

### Phase C：route engine observe-only 接入

1. BudgetRuntimeState 输出 BudgetGuardFact。
2. route decision trace 展示预算命中。
3. observe-only 不影响路由，用于验证。

### Phase D：drain / block 生效

1. drain 只影响新 session。
2. block 进入 HardBlock。
3. 自动恢复 bump pool epoch。
4. explain/request parity tests 通过后切真实路径。

## BDD 场景

1. Given daily budget limit=100k，observed=60k，manual set-effective=90k，When dry-run，Then effectiveUsage=90k 且 manualAdjustment=30k。
2. Given targetEffectiveUsage 小于 observedUsage，When 用户保存，Then 默认拒绝并提示不能低于已观测用量。
3. Given multi-day window anchorStart=6/18 duration=7，When now=6/20，Then active window 是 6/18 ~ 6/25。
4. Given bounded window 已过 endAt，When route engine 读取 BudgetGuardFact，Then 不再输出 active block。
5. Given threshold used-percent >= 90 action=drain，When effectiveUsage/limit=91%，Then 新 session 不选择该账号，已有 session 不被中断。
6. Given threshold used-percent >= 95 action=block，When effectiveUsage/limit=96%，Then HardBlock 过滤该账号。
7. Given 校准项被撤销，When state 重新计算，Then effectiveUsage 不再包含该 calibration。

## 风险与取舍

1. 不建议第一期做 rolling window，避免 usage event scan 与性能问题提前进入热路径。
2. 不建议第一期开放 cron-like 输入，先用 daily / multi-day / bounded 解决主要场景。
3. 不建议第一期开放 cost metric，避免 pricing 与 model attribution 混入基础预算能力。
4. 不允许 Budget 修改 account.disabled，避免用户状态和系统临时守卫混淆。
5. set-effective 需要谨慎，第一期应禁止把 effective 设置低于 observed。

## 验收命令

本调研为文档轮，验收：

    docs-linhay/scripts/check-docs.sh
    git diff --check
