# Account Store Runtime Routeability 技术方案

日期：2026-06-15

## 问题定义

当前 GetTokens 允许以下非法但可持续存在的分叉状态：

```text
SQLite account-store: applied / enabled
  !=
runtime AuthManager / ModelRegistry: routeable
```

一旦出现这个分叉，系统会同时出现三类误导性现象：

1. 账号池卡片或详情页显示账号“可用”。
2. explain / probe 仍可能把账号放进候选或至少不给出明确失败原因。
3. 真实 `/v1/responses` 请求直接返回 `auth_unavailable: no auth available (...)`。

`公司 1` 正是这类分叉的正式环境实例。

## 设计目标

1. 把 account-store、runtime auth、model registry、explain/probe、真实请求收口为单一真相链路。
2. 让“是否可路由”成为一等运行态状态，而不是从若干零散信号推断。
3. 保证 sidecar 启动、热刷新、状态变更后都不会留下 silent split-brain。
4. 让问题可观测、可自愈、可测试，而不是依赖重启或手动启停账号碰运气恢复。

## 非目标

1. 不改变 direct upstream 模式的产品语义。
2. 不重新设计 account-store schema 的账号资产模型。
3. 不重做 channel routing policy 本身的排序、balanced、session affinity 语义。
4. 不把 routeability 逻辑搬到前端或 Wails 内存态。

## 根因判断

当前问题更像是“账号库真源”和“运行时真源”没有被强制一致，而不是单个补丁失效。

从代码边界看：

1. `account-store` 保存了资产事实，但真实请求仍依赖 `coreManager` 与 `GlobalModelRegistry`。
2. `codex-api-key` 的默认模型集 fallback 存在，但分散在 synthesize、register、management models 等多个入口，缺少单点 materialize。
3. 启动链路和热刷新链路没有把“账号成功注册为 routeable runtime auth”定义成一个需要确认的完成条件。
4. explain/probe/detail 与真实请求之间仍有快照/配置级捷径，导致显示结果和真实 route 结果可能不一致。

## 推荐方向

推荐做“状态收口 + 启动期 reconcile + 单一候选池真源 + 自愈观察”四件事，一次把分叉定义为系统错误，而不是继续给每个入口补 fallback。

### 1. Routeability 状态机收口

新增显式运行态状态，至少包含：

- `pending`
- `applied_not_registered`
- `registered_routeable`
- `degraded`

语义：

- `pending`: account-store 已保存，但尚未完成运行态 reconcile。
- `applied_not_registered`: SQLite 已应用，但运行态 auth 或模型注册未完成。
- `registered_routeable`: 运行态 auth 已存在，且至少对声明/默认模型集可进入候选池。
- `degraded`: reconcile 已执行但失败，需暴露原因。

约束：

- `applied` 不再直接对 UI 暴露为“可用”。
- 详情页、列表、explain 和管理接口都必须消费同一运行态状态。

### 2. 启动期全量 reconcile 成为 ready 前置闭环

在 sidecar 启动后、ready 对外可见前执行一次全量流程：

```text
load account-store
-> synthesize runtime auths
-> register executors/models
-> verify routeability per account
-> persist runtime routeability state
-> expose ready
```

关键点：

- 不是只调用 `refreshAccountStoreAuths()`，而是把“注册结果校验”也纳入一个原子启动阶段。
- 对 active `codex-api-key`，若 `models_json=[]`，在这个阶段就 materialize 默认 Codex 模型集。
- 启动时允许部分账号进入 `degraded`，但不允许无状态失败。

### 3. 单一候选池真源

为 explain、probe、详情 models、真实请求引入统一的 runtime candidate snapshot：

```text
runtime candidate snapshot
  = active runtime auths
  + registered model support
  + route guard sources
  + channel/pool constraints
```

要求：

- `ExplainChannelRouting` 不能再只看 config / preview 拼接候选。
- `GetAccountModels` 不能只用 management store 视角，需要能反映 runtime materialized 结果。
- 真实路由和 explain 输出的 filtered reason 必须同源。

### 4. 自检与自愈

触发点：

- sidecar 启动后
- account create / update / enable / disable / delete 后
- 周期性轻量巡检

检查规则：

1. active account-store 账号是否存在对应 runtime auth。
2. `codex-api-key` 是否注册了至少一组有效模型。
3. UI 标记为 requestable 的账号是否真实能进入 runtime candidate snapshot。

恢复动作：

- 第一次发现：自动执行一次 bounded reconcile。
- 二次失败：打 `degraded` 状态并记录结构化原因。
- 不自动修改用户账号内容、排序、enable/disable 决策。

## 数据与接口调整

### 管理接口

建议新增或扩展以下字段：

- `runtime_routeability_status`
- `runtime_routeability_reason`
- `runtime_registered_models_count`
- `last_runtime_reconcile_at`

适用接口：

- `/v0/management/accounts`
- `/v0/management/accounts/:account_key`
- `/v0/management/accounts/:account_key/models`
- explain / probe DTO

### Wails DTO

前端只消费 root `main.App` 暴露后的稳定 DTO，不直接解释 sidecar 内部状态字符串。

建议在 Wails DTO 上统一提供：

- `runtimeStatus`
- `runtimeReason`
- `routeable`
- `registeredModelCount`

## 实施分期

### Phase 1: 状态语义收口

目标：

- 新增 `applied_not_registered / registered_routeable / degraded` 语义。
- 列表/详情/explain 统一展示运行态状态，而不是 `applied`。

输出：

- sidecar management DTO 扩展
- Wails/root DTO 映射
- focused tests 覆盖状态映射

### Phase 2: 启动期 reconcile + 显式 materialize

目标：

- sidecar 启动时强制全量 reconcile。
- `codex-api-key models_json=[]` 显式生成默认模型集并注册。

输出：

- startup hook / ready gating 调整
- runtime registry verification
- focused tests 覆盖启动后 `codex-api-key` routeable

2026-06-15 当前进展：

- 已在 CLIProxyAPI sidecar 维护源实现 runtime routeability 持久化字段，并把 reconcile 挂到 `refreshAccountStoreAuths()` 后。
- 当前实现会在 refresh 成功后把 `account_runtime_apply_state.status=pending` 推进为 `applied`，随后基于真实 `AuthManager + ModelRegistry` 回写：
  - `applied_not_registered`
  - `registered_routeable`
  - `degraded`
- 已补两个 focused 场景：
  1. management create 成功但 runtime auth 缺失时，返回 `applied_not_registered`；
  2. no-watcher refresh 为 `codex-api-key models_json=[]` 注册默认 Codex 模型后，SQLite 中持久化为 `registered_routeable` 且带 `registered_models_count`。
- 尚未做的部分是 watcher / ready gating 级别的更强同步语义；当前 management 路径通过短轮询降低 watcher 异步派发造成的旧快照返回风险，但还没有把 “ready 前 reconcile 完成” 变成硬门槛。

### Phase 3: 单一候选池真源

目标：

- explain/probe/detail/request 全部复用 runtime candidate snapshot。

输出：

- 共用 helper / service
- explain 与真实请求一致性测试
- 浏览器 preview 与真实运行时口径一致性测试

2026-06-15 当前进展：

- 主仓 `ExplainChannelRouting` / Codex routing probe / Claude Code routing probe / Codex account list requestable 判定已先完成第一层收口：开始优先消费 `AccountRecord.runtimeStatus` 与 `routeable`。
- 当前语义：
  - `registered_routeable` => requestable
  - `pending` => `waiting-check`
  - `applied_not_registered` / `degraded` => 不可请求
- 这一步还不是最终的 “single runtime candidate snapshot service”，但已经把主仓过去那种 `status=configured + requestability evidence/manual` 的误判面缩小，避免 sidecar 已明确不可路由时 UI 仍继续把账号放进 probe / explain 候选。
- 2026-06-15 新增了一步真正的 sidecar-owned explain 收口：
  - CLIProxyAPI `internal/gettokenshooks` 新增 `POST /v0/management/gettokens/channel-routing/explain`
  - 该端点直接读取 runtime auth snapshot、live session active counts、channel routing config、project candidate pool 规则，以及 route guard / persisted runtime blocks，产出 account-level candidate/filtered/selected 结果
  - 主仓 `internal/wailsapp/ExplainChannelRouting` 已优先调用此端点；若 sidecar 仍是旧版本返回 404，则自动回退到本地 explain 逻辑
- 2026-06-15 同轮继续把 probe 往同一真相源推进：
  - `ProbeCodexAccountRouting` 与 `ProbeClaudeCodeAccountRouting` 在构建候选列表时会先请求 sidecar explain，按 sidecar 返回的 candidate 顺序和 account id 收敛本地 route metadata；旧 sidecar 仍保留 404 回退
  - probe header 现在会真正带上 `X-GetTokens-Route-Order`，修掉之前 `OrderAccountIDs` 只存在于输入 DTO、没有真正下发到 sidecar 的漏口
- 2026-06-15 本轮再继续推进一层命中证据：
  - probe 请求前后会抓取 sidecar `GET /v0/management/gettokens/live-sessions`
  - 若在 live snapshot 中发现新的 `requestID + accountKey + model` 组合，则直接把该账号认定为 probe 命中账号，并标记 `evidence=live-session request`
  - 旧的 `api-key-usage` / usage-attribution recent delta 仍保留为兼容回退，只在 live sessions 没给出足够证据时使用
- 2026-06-15 本轮继续补齐了真正的 route trace / diagnostics 轻量面：
  - CLIProxyAPI `sdk/cliproxy/auth` 新增最近路由决策 ring buffer，记录真实调度阶段的：
    - provider/channel、model、project identity
    - 最终候选集、命中账号、不可用错误
    - `gettokensrouting.RouteResult.Trace`
  - CLIProxyAPI `internal/gettokenshooks` 新增 `GET /v0/management/gettokens/channel-routing/decisions?channel=<codex|claude>&limit=N`
  - 主仓 `internal/cliproxyapi` 已接入该端点，probe 请求前后会先比较新的 route-decision snapshot；只有旧 sidecar 不支持或没有捕获到新决策时，才回退到 live sessions，再回退到 usage delta
- 这样 explain、候选顺序、probe 命中识别、以及最近真实路由决策四个面都开始优先消费 sidecar 原生运行态观测；剩余缺口主要是更系统的 degraded/self-heal 闭环，以及把这份 diagnostics 进一步抬到前端可直接查看的调试视图。
- 同轮最后又暴露并修掉了一处 explain 自身的运行态分叉：
  - 在真实 `gettokens-dev` profile 验证时，`POST /v0/management/gettokens/channel-routing/explain` 一度返回 `500`
  - 直接根因是 `internal/gettokenshooks/channel_routing_explain.go` 里 `blockedByAuthID := mergeAccountRouteGuardBlocks(nil, persisted)` 可能返回 `nil`，随后在只有内存态 route guard blocks 的场景中执行 `blockedByAuthID[id] = ...`，触发 `assignment to entry in nil map`
  - 修复方式很窄：只在写入内存态 blocks 前保证 map 已初始化，不改变既有 explain/filter 语义
  - 已补 focused 回归测试：`internal/gettokenshooks/channel_routing_explain_test.go -> TestBuildChannelRoutingRuntimePoolDoesNotPanicWhenOnlyInMemoryRouteGuardsExist`
  - 真实 `gettokens-dev` profile 复验结果：
    - explain 已从 `500` 变成 `200`
    - `公司 1` 已稳定出现在 `candidates`
    - `GET /v0/management/accounts/<account>/models` 仍返回 `gpt-5.4` / `gpt-5.5` / `gpt-5.3-codex-spark` 等模型
    - `account_runtime_apply_state` 实际落库为 `applied | registered_routeable | 10`
  - 随后继续做主仓产物一致性验证，而不只停留在 reference repo：
    - `./scripts/ensure-sidecar.sh darwin arm64` 已用最新 dirty source 重建 `build/bin/cli-proxy-api`
    - `./scripts/wails-cli.sh build` 已再次把 sidecar 带进 `build/bin/GetTokens.app`
    - `build/bin` 裸 sidecar 与 app bundle 内 sidecar 的 SHA256 不同，但后者是 `adhoc` 签名 Mach-O；版本头、commit、build time 一致，因此差异来源可解释为打包/签名态而非源码分叉
    - 两份产品二进制都已直接在同一份 `gettokens-dev` 临时验证配置上复验通过：`channel-routing/explain=200`、`公司 1` 在 `candidates`、models 正常、runtime 表保持 `registered_routeable`
  - 再往前补了真实 dev App 接入证据：
    - 不是只跑 `cli-proxy-api -config ...`，而是直接启动 `GETTOKENS_APP_PROFILE=dev ./build/bin/GetTokens.app/Contents/MacOS/GetTokens`
    - 实际拉起的 sidecar 进程路径为 `build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`
    - `/healthz` 在 18317 返回 `{"status":"ok"}`
    - clean rebuild 后的最终产物版本以 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json` 为准：`commit=688f2972...`、`dirty=clean`
    - `~/.config/gettokens-dev/sidecar.log` 在本机是追加历史，不应用来判断“当前 build 版本号”；它更适合作为 runtime 证据，证明当前 dev sidecar 确实在 `:18317` 启动并收到真实产品请求
    - 窗口级截图已补到 `screenshots/20260615/dev-app/20260615-dev-app-sidecar-ready-after-v04.png`，采用顶部安全区域裁切版，避免把 dev 账号邮箱继续当作可复用验收图
    - 同时确认正式版 `/Applications/GetTokens.app` 与正式 sidecar 在启动前已存在，验收期间未 kill、重启或替换正式版进程

### Phase 4: 自愈与观测

目标：

- 加入 bounded reconcile、自愈、结构化日志和 diagnostics。

输出：

- account-store runtime diagnostics
- 结构化日志/trace
- degraded lifecycle tests

2026-06-15 当前进展：

- 已先落第一版 bounded reconcile 到 sidecar `sdk/cliproxy/service.go`：
  - `refreshAccountStoreAuths()` 末尾的 routeability reconcile 不再只是“看一眼然后记账”
  - 当评估结果命中 `applied_not_registered` 或 `degraded` 时，会在单次 reconcile 内最多额外触发一次 bounded repair：
    - watcher 模式：`RefreshAuthState(true)` + bounded wait
    - no-watcher 模式：重新 synthesize account-store auths、刷新 coreManager/registry，再 bounded wait
  - repair 后再做最终 routeability 判定；若仍失败，会在 reason 中明确追加 `after bounded reconcile`
- 已补 focused 场景，锁住两类关键自愈：
  1. runtime auth 还在，但 global model registry 丢了模型注册时，bounded reconcile 能补回并恢复 `registered_routeable`
  2. stale degraded runtime auth 残留旧 `Unavailable / StatusError / LastError` 时，bounded reconcile 能清理并恢复 `registered_routeable`
- 2026-06-15 本轮继续把 diagnostics 接到桌面工作台：
  - root `main.App` / `internal/wailsapp` / `frontend/wailsjs` 已新增 `ListChannelRouteDecisions`
  - Codex / Claude Channel Routing workbench 现在会在运行预演或真实 probe 后展示 sidecar 最近真实路由决策
  - 该视图直接消费 `GET /v0/management/gettokens/channel-routing/decisions`，展示命中账号、候选规模、项目信息、trace 摘要与 unresolved 状态
- 2026-06-15 同轮又把 runtime routeability 证据收口到账号详情：
  - `AccountDetailModulePlan` 新增 `runtime` 模块，所有统一账号详情都先展示“运行态路由”
  - 该段只保留排障最关键的三类事实：routeability 状态、已注册模型数、requestable 判断，以及 sidecar 返回的 `runtime_status / runtime_reason`
  - 这让操作者不必先跳到 Codex/Claude workbench，也能在 `公司 1` 账号详情页直接看到是 `registered_routeable / pending / applied_not_registered / degraded` 中哪一种
- 2026-06-15 本轮继续把账号级证据补完整：
  - `AccountsFeature` 在账号详情打开时会并行抓取 Codex/Claude 最近 route decisions
  - 详情页 `运行态路由` 模块会按当前账号过滤，只展示该账号最近被真实命中或进入候选的决策摘要
  - 这样一个账号现在同时具备“当前运行态真相”和“最近真实路由轨迹”两层证据，能更快区分是当前 still degraded，还是历史上曾 routeable 但最近被项目池/guard/filter 排除
- 这让“公司 1 为什么 direct 可用、账号池却不通”第一次在桌面 UI 上拥有 sidecar 原生证据面：操作者不需要只看日志或 usage delta，就能直接判断是候选池收窄、项目池 fail-closed、还是 runtime 无可路由账号。
  2. runtime auth 被 stale `Unavailable / StatusError / LastError` 卡成 degraded 时，bounded reconcile 会用 synthesize 后的 clean auth 覆盖旧脏状态并恢复 `registered_routeable`
- 这一步意味着 sidecar 现在不仅会把 split-brain 标出来，还会在一个受限窗口内先尝试拉回；剩余缺口主要是：
  - 为持续失败的 degraded 生命周期补更细的分类与长期观测
- 2026-06-15 本轮又把 bounded reconcile 从“行为存在”推进到“结果可追”：
  - `account_runtime_apply_state` 现新增 repair 诊断字段：
    - `repair_outcome`
    - `repair_action`
    - `repair_trigger_status`
    - `repair_trigger_reason`
    - `last_repair_at_unix_ms`
  - reconcile 第一轮命中 `applied_not_registered / degraded` 时会先记录 trigger；repair 完成后二次判定：
    - 恢复到 `registered_routeable` => `repair_outcome=recovered`
    - 仍未恢复 => `repair_outcome=failed`
  - action 目前区分两条 sidecar 自愈路径：
    - `watcher_refresh`
    - `resynthesize_refresh`
  - 主仓账号详情已把这组字段展示为独立 `Bounded Reconcile` 证据块，因此像 `公司 1` 这类 direct 可用但 account-store 不通的问题，现可直接区分：
    1. sidecar 尚未尝试修
    2. sidecar 已尝试并成功恢复
    3. sidecar 已尝试但失败，且失败前的 trigger 是 `applied_not_registered` 还是 `degraded`
- 2026-06-15 本轮继续把“失败原因”本身从自由文本提升为结构化分类：
  - reference sidecar `account_runtime_apply_state` 新增：
    - `failure_class`
    - `repair_trigger_class`
  - 当前 failure class 语义：
    - `runtime_apply_failed`: 账号配置 apply 阶段已经失败
    - `runtime_auth_missing`: 运行态根本没有合成出该账号 auth
    - `runtime_auth_disabled`: runtime auth 存在，但已被 disabled
    - `runtime_models_missing`: runtime auth 存在，但模型注册为空
    - `runtime_auth_unavailable`: runtime auth 存在，但 `Unavailable=true`
    - `runtime_auth_error`: runtime auth 存在，但 `StatusError/LastError` 持续阻塞
  - bounded reconcile 的 `repair_trigger_class` 会在发起 repair 前一刻落盘，避免后续 reason 被恢复后的新状态覆盖
  - 主仓账号详情现会直接展示：
    - `Failure Class`: 当前坏在哪一层
    - `Trigger Class`: sidecar 决定触发 repair 时观察到的失败类别
  - 这让 `公司 1` 一类 split-brain 首次可以稳定回答成“凭证可用，但 sidecar 当前坏在 runtime auth / model registry / apply 哪一层”，而不是继续依赖排障者读 `runtime_reason` 文本自行归因
- 2026-06-15 随后的隔离正式数据复现又暴露出一个更底层的 startup 缺口：
  - `internal/watcher/synthesizer/config.go` 的 `accountStoreAccounts()` 在 `AccountStoreDB` 已配置时，会直接 `Open(path) -> ListAccounts()`；但 `ListAccounts()` 已升级为依赖 `routeability_status / failure_class / repair_trigger_class` 等新列
  - 正式旧库仍停留在老 schema 时，这一步因为缺列而返回错误，随后被 synth 当成“account store 不可用”，于是 startup config synth 继续只保留 auth-dir / 旧 runtime 视角
  - 同时 `sdk/cliproxy/service.go` 的 `refreshAccountStoreAuths()` 之前只挂在 management apply hook 上，sidecar 启动本身没有主动执行 account-store runtime refresh
  - 二者叠加，就是这次正式环境 `公司 1` 问题的真正 startup 级根因：SQLite 卡片存在，但 runtime auth manager 启动后没有被这份 SQLite 真源刷新
- 针对这层根因，本轮已补两处 reference sidecar 修复：
  1. `accountStoreAccounts()` 在 `ListAccounts()` 前先执行 `store.EnsureSchema(context.Background())`
  2. `Service.Run()` 在 watcher 启动后新增 `initializeAccountStoreRuntime()`，启动期主动做一次 `refreshAccountStoreAuths()`
- focused tests 已新增并通过：
  - `internal/watcher/synthesizer/config_test.go`
    - `TestConfigSynthesizer_UsesLegacyAccountStoreSchemaAfterEnsureSchema`
  - `sdk/cliproxy/service_stale_state_test.go`
    - `TestServiceInitializeAccountStoreRuntimeMigratesLegacySchemaAndRegistersRuntimeAuths`
- 用隔离的正式数据副本 `/private/tmp/gettokens-repro-20260615/` 复跑后，已得到当前最关键的修复证据：
  - 旧 `account_runtime_apply_state` 会自动迁移出：
    - `routeability_status`
    - `routeability_reason`
    - `registered_models_count`
    - `failure_class`
    - `repair_*`
  - `公司 1` 对应账号落盘为：
    - `runtime_apply_status=applied`
    - `runtime_routeability_status=registered_routeable`
    - `runtime_registered_models_count=10`
  - 因而最初“runtime 根本没有这张 SQLite 账号卡”的 split-brain 已被消除
- 复现里剩余的下一层问题也已定位：
  - `channel-routing/explain` 不再报 `no auth available`，但仍把 `公司 1` 过滤成 `account-unrequestable`
  - 这表明 account-store startup refresh 问题已修平，剩余工作已收窄为 requestability / route-guard / runtime stale-status 的第二层筛选，不再是 SQLite 真源没有进入 runtime 的第一层故障
- 随后第二层筛选也已在隔离副本中闭环：
  - `公司 1` 的 runtime auth id 计算结果是 `codex:apikey:3df2001c2d1b`
  - `channel-routing/config.json.runtimeStates["auth-id:codex:apikey:3df2001c2d1b"]` 残留了一条历史 `auth-error`
  - explain 的 `Requestable` 会同时受 runtime `status/unavailable` 与 route-guard blocks 影响，所以即使 store 已回写 `registered_routeable`，账号仍会被过滤成 `account-unrequestable`
- 已补修复：
  - `sdk/cliproxy/service.go` 在 runtime auth 被健康重建/更新为 active 且可请求时，会主动清理 `auth-error / upstream-rate-limit / upstream-error` 这类瞬态 route-guard 残留
  - 不会误清 `quota-empty`、`manual-disabled` 这类仍应保留的硬阻塞
- 最新隔离验收结果：
  - `runtimeStates["auth-id:codex:apikey:3df2001c2d1b"] == null`
  - `POST /v0/management/gettokens/channel-routing/explain` 中 `公司 1` 已恢复到 `candidates`
  - `routeIDs=["codex:apikey:3df2001c2d1b"]`，`/v0/management/accounts/<account>/models` 仍可看到 `gpt-5.5`

## 旁支噪音治理

这轮又确认了 `auth-id:channel-routing/config.json` 的真实来源并顺手修掉：

- 问题不在 `internal/watcher/synthesizer/file.go`，因为 file synth 本来就要求 JSON 内有 `type`
- 真正漏口在 sidecar 启动前半段：
  - `coreManager.Load()`
  - `sdk/auth/FileTokenStore.List()`
  - `readAuthFile()`
- 这条链此前会把所有 `.json` 都当 auth 读；若缺 `type`，会回退成 `provider=unknown`
- 因而 `channel-routing/config.json` 会在 watcher refresh 之前先混进 runtime，形成 explain 里的异常候选

修复策略：

- 收口为统一硬规则：没有显式 `type` 的 JSON 不是 auth，直接跳过
- 为了让多种 token store 行为一致，这条规则同步落在：
  - `sdk/auth/filestore.go`
  - `internal/store/gitstore.go`
  - `internal/store/objectstore.go`
  - `internal/store/postgresstore.go`

回归结果：

- sidecar 启动日志已从 `4 clients (4 auth entries ...)` 收敛为 `3 clients (3 auth entries ...)`
- 隔离 explain 中异常候选 `auth-id:channel-routing/config.json` 已消失
- `公司 1` 仍保持在候选池，说明这次治理只清了噪音，没有把主修复打回去
- 主仓 focused 验证与打包也已通过：
  - `go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp`
  - `node --test ...accounts... ...channel-routing... ...codexAccountList...`
  - `./scripts/wails-cli.sh build`
  - 因此当前状态已经不是“reference sidecar 单点修复未接主仓”，而是主仓主要账户/路由/Wails 面的回归也在绿灯

## 验证策略

自动化至少覆盖：

1. `codex-api-key` 启动后自动注册 runtime auth。
2. `models_json=[]` 时默认模型 materialize 与 registry 注册。
3. explain/probe/request 对同一账号给出一致 routeability 结论。
4. 账号 enable/disable 后 routeability 状态正确流转。
5. runtime auth 丢失时 bounded reconcile 能恢复；无法恢复时进入 `degraded`。

文档与治理验证：

- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 风险与取舍

### 主要风险

1. 启动期增加 reconcile 可能放大 ready 时间。
2. 旧逻辑可能默认把 `applied` 当成功，改状态后会暴露更多历史脏状态。
3. 若 direct upstream 和 relay executor 的鉴权/transport 行为不同，后续仍需补 executor 侧排障。

### 当前取舍

- 优先保证状态一致和可诊断，不优先追求启动阶段最短时间。
- 宁可把脏状态显式暴露成 `degraded`，也不继续让 UI 误报“可用”。

## 不选的方案

### 方案 A：只补一轮 `refreshAccountStoreAuths()`

不选原因：

- 只能修“这次没触发”。
- 无法阻止未来继续出现 `applied != routeable` 分叉。
- explain / probe / request 仍可能各走各路。

### 方案 B：前端/Wails 侧根据日志或 models 接口推断 routeability

不选原因：

- 违反 sidecar 热路径闭环边界。
- 只会制造新的真相源。

## 建议落点

方案主文档放在本文件，需求与验收跟随对应 space：

- [space README](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-account-store-runtime-routeability/README.md)

后续实现计划建议在该 space 的 `plans/` 下继续拆：

- `phase-1-runtime-status.md`
- `phase-2-startup-reconcile.md`
- `phase-3-runtime-candidate-snapshot.md`
- `phase-4-diagnostics-self-heal.md`
