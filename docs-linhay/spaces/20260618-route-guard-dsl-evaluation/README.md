# Route Guard DSL Engine Evaluation

## 背景

本 space 用于评估“用户对单个账号配置路由守卫规则”是否应该升级为 DSL / 规则引擎能力。

当前上下文：

1. GetTokens 的账号选择、route guard、rate-limit、quota-empty、live sessions 与 usage attribution 属于 sidecar 热路径，不应由前端或 Wails 临时补偿。
2. 现有 channel routing 已经存在多类规则：账号启停、runtime routeability、runtime block sources、project candidate pool、sequential / balanced、sticky、probe / explain / decision ledger。
3. 用户希望梳理 route guard 配置规则，并评估单账号级规则是否可以升为更通用的规则引擎。

## 目标

1. 建立 route guard DSL / 规则引擎评估边界。
2. 判断“单个账号的路由守卫配置规则”是否值得提升为引擎级能力。
3. 给出可执行的分阶段重构计划，确保 explain / 真实请求 / probe / runtime state 回写同源。
4. 在进入实现前补齐证据门禁、验收标准和非目标。

## 评估结论

结论：建议升级为 sidecar-owned typed rule engine，但不建议第一期暴露“用户自由编写 DSL”。

更准确的产品形态应是：

    用户可视化配置单账号守卫规则
      -> 编译为受限 typed rule schema
      -> sidecar 规则引擎按固定 stage 执行
      -> explain / decision ledger 输出可读 trace
      -> result hook 按 source-scoped effect 回写 runtime state

也就是说，“DSL 引擎”可以作为内部表达与编译层，但用户界面第一期应该是受限表单 / 规则构建器，而不是开放表达式语言。

## 范围

本 space 覆盖：

1. 单账号级 route guard 规则的能力边界。
2. route guard source 与 runtime state 的 source-scoped 语义。
3. channel routing / project candidate pool / sticky / balanced 与单账号规则的优先级关系。
4. typed rule engine 的阶段拆分、输入 facts、输出 decision trace 与 result effect。
5. DSL 是否对用户开放、以什么形式开放、如何避免误配置。
6. 单账号规则需要覆盖的多场景：硬阻断、限时冷却、模型范围、渠道范围、项目范围、失败预算、软降权、drain 与观测型诊断规则。
7. 单账号用量规则需要支持外部流量校准：用户可手动修正当前窗口用量，用于覆盖发生在 GetTokens App 外的消耗。

## 非目标

1. 不在本评估轮直接实现规则引擎。
2. 不做通用脚本式 DSL，不支持用户输入任意表达式或代码。
3. 不恢复 legacy route mode，例如 weighted / canary / dedicated / project fallback。
4. 不让 Wails 或前端成为 route guard 真相源。
5. 不触碰正式版 GetTokens，不替换正式版 sidecar。

## 证据门禁

| 维度 | 当前事实 |
| --- | --- |
| 问题来源 | 用户提出“梳理路由守卫配置规则，实现新的规则引擎”，并进一步要求评估单账号路由守卫配置是否可升为 DSL 引擎。 |
| 当前代码位置 | internal/wailsapp/channel_routing.go 负责 channel routing DTO、fallback explain、runtimeStates 兼容写回；internal/wailsapp/routing_config.go 仍维护 legacy relay routing config；internal/wailsapp/codex_routing_probe.go / claude_code_routing_probe.go 仍有 probe header override。 |
| 当前文档位置 | docs-linhay/dev/20260524-account-routing-engine.md 定义 Account Routing Engine 边界；docs-linhay/dev/20260615-account-store-runtime-routeability.md 定义 runtime routeability 收口；docs-linhay/dev/20260531-account-routing-quota-guard.md 定义 quota-empty route guard source。 |
| 当前现象 | explain、probe、真实请求、runtime state 回写仍有多层兼容路径；单账号守卫规则已有多个 source 和 TTL 语义，但缺少统一 rule contract。 |
| 预期验收 | 输出本 space、评估计划、DSL 升级判断、分阶段重构计划；纯文档轮通过 docs-linhay/scripts/check-docs.sh 与 git diff --check。 |
| 可推翻证据 | 如果 sidecar 无法提供统一 runtime candidate snapshot，或真实请求无法与 explain 共享同一决策链，则不应推进 DSL engine，只能继续做局部 rule hardening。 |

## 单账号规则是否值得升为 DSL 引擎

判断：值得升为“规则引擎”，但不应第一期升为“用户自由 DSL”。

原因：

1. 规则族已经超过单点 if/else 能承载的规模：manual disabled、quota-empty、rate-limit、cooldown、auth-error、upstream-error、model-unavailable、project candidate pool、sticky invalidate 都需要统一优先级和 trace。
2. 用户对单账号的配置需求天然需要 explain：为什么这个账号被阻断、什么时候恢复、哪个 source 生效、是否影响当前 session。
3. source-scoped recovery 是核心价值：清理 quota-empty 不能误清 rate-limit；成功请求不能误恢复 manual disabled。
4. 若没有统一 engine，单账号规则会分散到前端、Wails explain、sidecar selector、result hook，最终形成多套真相。

不建议开放自由 DSL 的原因：

1. 用户误写规则可能把全部账号 fail closed，且很难解释。
2. 表达式语言会引入版本兼容、调试、迁移和安全边界问题。
3. 当前真正需要的是固定事实源 + 固定 stage + 可解释 trace，不是任意可编程能力。

推荐形态：

| 用户字段 | 含义 |
| --- | --- |
| account | 目标账号 |
| trigger | quota-empty / rate-limit / model-unavailable / upstream-error / latency / failure-budget / schedule / manual 等受限触发器 |
| matcher | model、channel、projectKey、transport、session family 等可选匹配条件 |
| scope | account / account+model / account+channel / account+project / account+session-family |
| ttl | resetAt / duration / manual |
| recovery | ttl-expire / quota-refresh-clear / success-clear / manual-clear / probe-clear |
| action | block / cooldown / drain / degrade / prefer-lower / observe-only |
| reason | 用户可读原因 |

## 单账号多场景规则矩阵

| 场景 | 用户意图 | 推荐 action | 执行阶段 |
| --- | --- | --- | --- |
| 手动维护 | 临时不让某账号接新请求 | block 或 drain | HardBlock / Preference |
| 模型不可用 | 某账号只对特定模型不可用 | block，scope=account+model | HardBlock |
| 渠道隔离 | 某账号只禁 Codex 或只禁 Claude | block，scope=account+channel | PoolScope |
| 项目固定或排除 | 某项目必须避开某账号或只用某账号 | block / allow-pool，scope=account+project | PoolScope |
| 临时冷却 | 上游 429、网络抖动、手动暂停一段时间 | cooldown | HardBlock |
| 失败预算 | 同账号连续 N 次 terminal error 后切走 | cooldown 或 block-until-success | Effect -> HardBlock |
| quota / reset | 额度耗尽直到 resetAt | block，ttl=resetAt | HardBlock |
| quota threshold | 指定某个 token/quota window 达到阈值后停止该账号路由 | block 或 drain，ttl=window resetAt | HardBlock |
| usage calibration | App 外部发生流量后，用户手动校准当前窗口用量 | effective usage 参与 threshold / limit 计算 | Effect / Runtime fact |
| 成本或余额保护 | 低余额账号降权或停用 | prefer-lower 或 block | Preference / HardBlock |
| 性能退化 | 高延迟账号暂时少用 | prefer-lower 或 cooldown | Preference / HardBlock |
| Drain 模式 | 不接新 session，但允许已有 sticky 完成 | drain | Preference |
| 观测规则 | 只记录、不影响路由，用于验证规则效果 | observe-only | Trace only |

这些场景说明单账号规则不应设计成单一 block 开关。规则 schema 必须同时表达 trigger、matcher、scope、action、ttl 和 recovery，否则后续会再次退化为散落在不同 handler 里的 if/else。

### Token / quota window 百分比阈值规则

新规则应支持用户指定某个 token/quota window 到达某个百分比后停止该账号路由。

推荐语义：

| 字段 | 语义 |
| --- | --- |
| trigger | quota-threshold |
| windowID | sidecar quota runtime 中稳定的 window id，不使用 UI 展示 label 作为匹配键 |
| metric | remaining-percent 或 used-percent，UI 必须明确文案，避免“到 20%”歧义 |
| threshold | 0-100 的百分比 |
| comparator | remaining-percent 默认 <=；used-percent 默认 >= |
| action | block / drain / prefer-lower，首期默认 block |
| ttl | 优先使用该 window 的 resetAt；没有 resetAt 时只能 observe-only 或使用短 TTL，不能永久阻断 |
| recovery | 默认 quota-refresh-clear + ttl-expire；fresh quota 恢复到阈值外时立即清理，resetAt 到期后自然失效 |
| source | quota-threshold，必须与 quota-empty 分离 |

默认产品文案建议使用“剩余额度低于 X% 时停止路由”，而不是“到 X% 停止”，因为后者无法区分 remaining percent 与 used percent。

运行规则：

1. 只消费 sidecar quota runtime fact，不从前端 quota bar 反推。
2. fresh quota window 才能创建或更新 quota-threshold block。
3. stale / degraded / unknown quota 不能新建强阻断；如果已有 active block，按原 expiresAt 或下一次 fresh recovery 处理。
4. fresh recovery 超过阈值后只清理 quota-threshold，不清理 quota-empty / rate-limit / auth-error。
5. explain / decision ledger 必须展示 windowID、metric、threshold、actualPercent、action 和 nextReset。

### 自动恢复策略

单账号规则必须支持自动恢复，且恢复策略必须和 source 绑定，不能用一个全局“解除阻断”按钮处理所有原因。

| recovery | 适用场景 | 清理条件 |
| --- | --- | --- |
| ttl-expire | cooldown、quota-threshold、rate-limit | expiresAt 到期后 active lookup 不再阻断；后续 cleanup 可物理删除过期 source |
| quota-refresh-clear | quota-threshold、quota-empty | fresh quota refresh 显示额度恢复或超过阈值 |
| success-clear | upstream-error、部分 transient rate-limit | 后续请求成功后只清理 transient source |
| probe-clear | model-unavailable、auth-error 的可恢复变体 | sidecar probe / refresh 证明模型或凭证恢复 |
| manual-clear | 用户手动维护、长期禁用、无 resetAt 的规则 | 只能由用户显式清理或启用账号 |

恢复约束：

1. 自动恢复只清理自己的 source。
2. 恢复动作必须 bump pool epoch，使 sticky / session affinity 下一轮重新评估。
3. stale / degraded 事实不能触发强恢复，也不能创建新强阻断。
4. 如果同一账号同时有多个 active sources，任一 source 恢复都不能让账号绕过其他 active block。

### 手动用量校准

单账号规则必须支持手动校准当前窗口用量。原因是账号可能在 GetTokens App 外部被使用，sidecar 只观察本 App 内流量会低估真实消耗。

推荐设计不是直接覆盖原始观测值，而是维护一条可审计的 usage calibration ledger：

| 字段 | 语义 |
| --- | --- |
| accountKey | 目标账号 |
| windowID | 被校准的 token/quota window |
| metric | tokens / requests / cost / percent |
| mode | delta 或 set-effective |
| value | 增量值或校准后的有效值 |
| reason | 用户填写原因，例如“App 外部消耗” |
| source | manual-calibration |
| createdAt | 校准时间 |
| expiresAt | 默认跟随 window resetAt |

计算语义：

    observedUsage = sidecar 观测到的 App 内用量
    manualAdjustment = 当前 window 内所有有效校准项
    effectiveUsage = observedUsage + manualAdjustment
    effectiveRemaining = limit - effectiveUsage

规则判断必须基于 effectiveUsage / effectiveRemaining，而不是只基于 observedUsage。原始 observedUsage 不被覆盖，以便排障时能区分“实际观测”和“用户校准”。

校准恢复：

1. window reset 后，过期校准项自动失效。
2. 用户可手动撤销某条校准项，撤销同样需要 audit trace。
3. fresh provider quota 如果能给出权威 remaining / used，可生成 reconcile 建议，但不应静默删除用户校准，除非规则明确允许 provider-fact-clear。

### 限额窗口与 cron 的边界

cron 只能表达“何时触发重算或 reset”，不能单独表达完整限额语义。

需要单独建模 quota / usage window：

| 窗口类型 | 示例 | 推荐建模 |
| --- | --- | --- |
| 单日限额 | 每天 00:00 重置 100k tokens | fixed-calendar window，timezone + daily reset time |
| 多日限额 | 每 7 天 500k tokens | fixed-calendar 或 rolling-duration window，durationDays + anchorStart |
| 起止时间限额 | 2026-06-18 10:00 到 2026-06-20 18:00 共 300k tokens | bounded window，startAt + endAt |
| 高级重置调度 | 每周一 08:00 重置 | reset schedule 可使用 cron-like 表达式，但仍需 window bounds 与 timezone |

结论：支持 cron-like reset schedule 是有价值的，但不能只靠 cron。正确模型应是 windowPolicy + resetPolicy：

1. windowPolicy 描述用量归属窗口：daily、multi-day、rolling、bounded。
2. resetPolicy 描述何时过期、何时重算、何时自动恢复：resetAt、duration、cron-like schedule。
3. rule engine 每次决策读取当前 active window 的 effectiveUsage，再决定是否触发 quota-threshold / quota-limit block。

## 建议方案

采用“内部 typed rule engine + 用户规则构建器”的二层方案。

第一层是 sidecar 内部引擎：

1. RouteFactsSnapshot：账号、模型、channel、runtime state、project、session counters。
2. RouteRequestContext：本次请求的 channel、model、project identity、tried、sticky。
3. RouteRule：受限、typed、可版本化的规则定义。
4. RouteDecisionTrace：每个 stage 的 keep/drop/order/effect 记录。
5. RouteEffect：结果回写时对 runtime source 的新增、更新、清理。

第二层是用户配置入口：

1. 第一阶段提供多场景单账号规则构建器，不提供文本 DSL。
2. 规则构建器生成 typed schema，由 sidecar 校验并保存。
3. UI 展示 compiled preview、dry-run explain 和冲突风险。
4. 所有规则必须能被 explain / decision ledger 解释。

## 固定执行阶段

| Stage | 职责 |
| --- | --- |
| Stage 0 Eligibility | channel support、model support、runtime registered_routeable |
| Stage 1 HardBlock | account disabled、manual-disabled、auth-error、quota-empty、rate-limit、cooldown、model-unavailable、upstream-error |
| Stage 2 PoolScope | inventory group enabled、channel group enabled、project candidate pool strict allow、account-level user guard rules |
| Stage 3 Preference | orderedAccountIDs、sticky hit / invalidate、balanced active session count |
| Stage 4 Selection | selected account、no routeable account failure、decision trace |
| Stage 5 Effect | request result -> source-scoped runtime mutation |

## 风险

1. 双真相风险：如果 Wails fallback explain 长期存在，规则引擎会变成两套实现。
2. 误配置风险：用户自由 DSL 可能导致所有账号被阻断。
3. 迁移风险：旧 probe header override 与新 rule engine 语义冲突，需要收口为诊断能力。
4. 观测风险：没有 decision trace 的规则引擎不可运营，也不可排障。
5. 回滚风险：真实请求切换到新 engine 前必须保留旧路径开关。

## 验收标准

1. 本 space 明确评估结论、范围、非目标、证据门禁和风险。
2. plans/20260618-route-guard-dsl-engine-evaluation.md 给出可执行的分阶段计划。
3. 文档明确回答：单账号守卫规则可以升为 typed rule engine，但第一期不开放自由 DSL。
4. 纯文档检查通过：
   - docs-linhay/scripts/check-docs.sh
   - git diff --check

## 设计稿入口

- 本期设计稿：未产出
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：feat/20260618-route-guard-dsl-evaluation
- worktree：../GetTokens-worktrees/20260618-route-guard-dsl-evaluation/

## 相关链接

- docs-linhay/dev/20260524-account-routing-engine.md
- docs-linhay/dev/20260531-account-routing-quota-guard.md
- docs-linhay/dev/20260615-account-store-runtime-routeability.md
- docs-linhay/dev/20260616-gettokens-domain-glossary.md
- plans/20260618-route-guard-dsl-engine-evaluation.md
- plans/20260618-account-budget-guard-technical-research.md

## 当前状态

- 状态：technical-research
- 最近更新：2026-06-18
