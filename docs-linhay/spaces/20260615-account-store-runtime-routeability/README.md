# 账号池到运行时 Routeability 收口

## 背景

用户追问：为什么正式环境里 `公司 1` 这个账号在账号池中显示可用，但通过 GetTokens 正式 sidecar 发起 Codex 请求时无法连通；而把同一份 `apiKey + baseUrl` 直接配置到 Codex 后却可以正常使用。

现场只读证据表明，这不是上游凭证本身不可用，而是 GetTokens 当前允许出现“SQLite 账号池状态正常，但运行时不可路由”的分叉状态：

1. 正式 SQLite `accounts-v1.sqlite` 中，`公司 1` 是 active `codex-api-key`，`disabled=0`，`runtime_apply_status=applied`。
2. `channel-routing/config.json.runtimeStates` 中不存在该账号的 `manual-disabled`、`quota-empty` 等持久硬阻塞状态。
3. 正式 sidecar 请求日志连续报错 `auth_unavailable: no auth available (providers=codex, model=gpt-5.4/gpt-5.5)`，说明失败发生在 GetTokens 本地路由层，而非上游鉴权层。
4. 同一账号直接配置到 Codex 可用，说明上游 `apiKey + baseUrl` 组合本身可承接请求，问题出在 account-store -> runtime auth -> model registry 这一段。

## 目标

1. 把 `account-store`、运行态 `AuthManager`、`ModelRegistry`、explain/probe 和真实请求路由收口为单一真相链路。
2. 消除“账号卡可用 / explain 可候选 / 真实请求 `auth_unavailable`”这类口径分叉。
3. 让 `applied` 不再被误用为“可路由成功”的信号，而是把 `routeable` 提升为显式运行态状态。
4. 为正式环境提供可诊断、可自愈、可回归验证的闭环，避免类似 `公司 1` 的 `codex-api-key` 账号再次复发。

## 范围

- `docs-linhay/references/CLIProxyAPI/sdk/cliproxy/service.go`
- `docs-linhay/references/CLIProxyAPI/internal/watcher/synthesizer/config.go`
- `docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/auth_files.go`
- `docs-linhay/references/CLIProxyAPI/internal/gettokensrouting/` 与相关路由 explain/probe 入口
- `internal/wailsapp` 中 account detail / Codex account list / explain DTO 的状态呈现
- 对应 focused tests、space 文档、研发方案与 memory

本轮以技术方案与实施设计为主，不在当前 space 内直接改正式版二进制。

## 非目标

1. 不改变 `公司 1` 所在上游系统 `cpa.host.dxy` 的接口协议。
2. 不删除“直接配置到 Codex”的能力；该能力继续作为绕过账号池的独立路径存在。
3. 不通过前端补状态来伪造 routeability；热路径状态仍以 sidecar 为边界。
4. 不顺手重做账号池 UI、请求顺序 UI 或项目候选池视觉结构。
5. 不触碰正式版 `/Applications/GetTokens.app` 进程和二进制。

## 验收标准

1. Given 一个 active `codex-api-key` 账号在 SQLite 中存在，When sidecar 启动完成并进入 ready，Then 它要么成功注册为可路由 runtime auth，要么被显式标记为 `applied_not_registered/degraded`，不得继续显示为单纯 `applied`。
2. Given `models_json=[]` 的 active `codex-api-key`，When runtime auth 合成与模型注册完成，Then explain、详情 models 与真实 `/v1/responses` 对 `gpt-5.4/gpt-5.5` 的可承接判断必须一致。
3. Given 真实请求无法为目标模型找到 runtime auth，When 操作者查看账号详情或 explain，Then UI 必须显示同一份运行态失败原因，而不是“候选/可用”。
4. Given sidecar 启动或热刷新过程中 registry 漏注册某个 active 账号，When 自检发现分叉，Then sidecar 应自动执行一次 bounded reconcile；若仍失败，必须落明确错误状态与日志。
5. 自动化验证至少覆盖：
   - 启动期 account-store 全量 reconcile
   - `codex-api-key models_json=[]` 的默认模型 materialize / 注册
   - explain/probe/真实路由共用同一 runtime candidate snapshot
   - `applied_not_registered` / `registered_routeable` 等状态流转

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260615-account-store-runtime-routeability`
- worktree：`../GetTokens-worktrees/20260615-account-store-runtime-routeability/`

## 相关链接

- [Account Routing Engine 技术边界](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md)
- [账号候选池状态持久化与打通](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260609-account-candidate-pool-state-persistence/README.md)
- [Codex model catalog projection plan](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260602-codex-model-catalog-projection-plan.md)
- [账号池到运行时 Routeability 技术方案](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-account-store-runtime-routeability.md)

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | 用户直接追问：“为什么正式环境公司 1 这个账号无法联通，但是公司 1 直接配置是可以使用的。” |
| 当前代码事实 1 | `codex-api-key` 即使 `models_json=[]`，运行态仍应按 Codex 默认模型集注册，而不是返回空模型。 |
| 当前代码事实 2 | sidecar 真实路由只看运行态 `AuthManager` / `ModelRegistry`，并不直接以 SQLite `applied` 状态作为可请求依据。 |
| 当前代码事实 3 | explain、probe、账号详情 models 与真实请求仍存在多处“先看配置/快照，再看运行态”的分叉入口。 |
| 当前现象 | 正式 sidecar 在 2026-06-15 连续返回 `auth_unavailable: no auth available (providers=codex, model=gpt-5.4/gpt-5.5)`；同一凭证直接配置到 Codex 可正常工作。 |
| 反证条件 | 如果后续抓到上游对 GetTokens 转发流量返回 401/403/模型不支持，而直连返回 200，则根因需转向执行器/鉴权差异，不能继续假设是纯 runtime registry 漏注册。 |
| 预期验收方式 | 方案评审 + focused Go tests + 必要的浏览器/管理接口状态验收；本轮不要求真实正式版手点。 |

## 方案摘要

1. 把 `routeable` 提升为显式状态，拆分 `pending / applied_not_registered / registered_routeable / degraded`。
2. sidecar 启动后强制执行一次 account-store 全量 reconcile，并以 registry 结果回写运行态状态。
3. explain/probe/详情 models/真实请求统一从同一份 runtime candidate snapshot 取数。
4. 对 `codex-api-key models_json=[]` 做显式默认模型 materialize，而不是分散在多处 fallback。
5. 增加启动后与热刷新期间的自检/自愈机制，但不偷偷修改用户账号数据。

## 当前状态
- 状态：phase-1-in-progress
- 最近更新：2026-06-15
- 本轮进展：
  - 已在主仓 DTO / Wails / 前端账号展示链路中补齐 `runtimeStatus`、`runtimeReason`、`routeable`、`registeredModelCount`。
  - 已让账号详情、状态 tone、可用性判断优先消费显式 routeability 状态，而不是只看旧 `status=active/configured`。
  - 已补 focused Go / frontend tests，锁住 routeability 状态映射与缓存投影。
  - 已在 `docs-linhay/references/CLIProxyAPI` sidecar 维护源中补齐 account-store 持久化字段：`runtime_routeability_status`、`runtime_routeability_reason`、`runtime_registered_models_count`、`last_runtime_reconcile_at_unix_ms`。
  - sidecar `refreshAccountStoreAuths()` 现在会在 runtime auth / model registry 刷新后执行 routeability reconcile：把启动期 `pending` 推进到 `applied`，并按真实 auth + model 注册结果回写 `applied_not_registered / registered_routeable / degraded`。
  - management `Create/Patch/ListAccounts` 路径已补 runtime 校验与短轮询，避免 apply 成功但返回体仍停在旧 `pending` 快照。
- 主仓 `ExplainChannelRouting`、Codex/Claude routing probe、Codex account list requestable 判定已开始优先消费 `runtimeStatus/routeable`，`applied_not_registered / degraded` 账号不会再被当成 requestable 候选。
- sidecar 已新增 `POST /v0/management/gettokens/channel-routing/explain`，用运行态 auth 快照、live sessions、project candidate pool 规则和 route guard 持久态生成 account-level candidate snapshot；主仓 `ExplainChannelRouting` 现优先消费该 sidecar explain，旧本地 explain 逻辑仅作为 404 兼容回退。
- Codex / Claude Code probe 现在也会优先调用同一个 sidecar explain 端点拿候选顺序；旧 sidecar 无该端点时再回退到本地候选构建。与此同时，probe 终于开始真实下发 `X-GetTokens-Route-Order`，不再只传 allow/deny。
- probe 命中证据已新增 sidecar `live-sessions` 优先链路：请求前后对比新增的 `requestID/accountKey`，命中时直接返回 live-session 证据；`api-key-usage` / attribution delta 仅作为回退。
- sidecar 现已新增最近真实路由决策快照：
  - `sdk/cliproxy/auth` 记录最近 route decisions ring buffer，包含真实候选集、命中账号、不可用错误与 routing trace
  - management 暴露 `GET /v0/management/gettokens/channel-routing/decisions`
  - 主仓 probe 命中识别现在优先对比这份 route-decision snapshot，再回退到 live sessions 与 usage delta
- sidecar routeability 自愈现已补第一版 bounded reconcile：
  - `sdk/cliproxy/service.go` 在 routeability reconcile 里遇到 `applied_not_registered` / `degraded` 时，会在单次流程内额外触发一次受限 repair，再给出最终状态
  - 当前 repair 覆盖 watcher refresh 与 no-watcher resynthesize 两条路径，能自动修复 registry 模型丢失和 stale degraded auth 两类 split-brain
- Codex / Claude Channel Routing workbench 现已接上 sidecar 最近真实路由决策：
  - 新增 `ListChannelRouteDecisions` Wails/root 绑定与前端模型
  - workbench 会在预演或真实 probe 后展示 sidecar 最近真实命中、未命中与 trace 摘要
  - 对旧 sidecar 版本仍保留空列表兼容，不把 404 直接暴露成 UI 错误
- 统一账号详情现已新增“运行态路由”段：
  - 放在各类账号详情最前面，先显示 routeability、注册模型数、requestable 与 runtime reason
  - 不恢复旧的大块 runtime evidence 墙，只保留排障 `公司 1` 这类 split-brain 所需的最小证据
  - 这样 workbench diagnostics 与账号详情形成互补：前者看最近真实路由决策，后者看该账号当前运行态真相
- 账号详情现又进一步补上账号级最近真实路由摘要：
  - 打开详情时会抓 Codex/Claude 两路最近 route decisions
  - 只保留与当前账号相关的 selected/candidate 决策，直接展示在“运行态路由”段下面
  - 对 `公司 1` 这类问题，操作者现在能同时看到“当前是 degraded / not registered”与“最近真实请求里它被命中还是被过滤”
- sidecar bounded reconcile 现在也开始产出账号级 repair diagnostics：
  - `account_runtime_apply_state` 新增 `repair_outcome / repair_action / repair_trigger_status / repair_trigger_reason / last_repair_at`
  - no-watcher repair 成功时会明确落 `recovered + resynthesize_refresh`；repair 后仍失败时会保留 `failed` 与原 trigger reason
  - 主仓 `UnifiedAccount -> AccountRecord -> Wails DTO -> frontend` 已贯通这组字段
  - 账号详情 `运行态路由` 段现在会单独显示 `Bounded Reconcile` 证据块，直接告诉操作者 sidecar 是否尝试过修、用哪条路径修、因为什么触发
- 本轮继续把 degraded 生命周期分类也收口为 sidecar 结构化字段，而不是前端按 `runtimeReason` 文本猜测：
  - `account_runtime_apply_state` 再新增 `failure_class / repair_trigger_class`
  - 首批 failure class 已覆盖：`runtime_apply_failed`、`runtime_auth_missing`、`runtime_auth_disabled`、`runtime_models_missing`、`runtime_auth_unavailable`、`runtime_auth_error`
  - repair trigger class 会记录触发 bounded reconcile 前的结构化原因，避免 `trigger_status=degraded` 但无法区分究竟是 auth unavailable 还是 models missing
  - 主仓 `UnifiedAccount -> AccountRecord -> Wails DTO -> frontend` 已继续贯通，账号详情 `运行态路由` 与 `Bounded Reconcile` 证据块现会分别显示 `Failure Class` / `Trigger Class`
- 随后继续把“正式旧库启动即 split-brain”这个更深一层根因钉住：
  - `internal/watcher/synthesizer/config.go` 的 `accountStoreAccounts()` 之前在旧 schema 上直接 `ListAccounts()`，没有先 `EnsureSchema()`；旧正式库缺少 `routeability_status / failure_class` 等列时，这一步会静默失败，导致 startup synth 把 SQLite 账号真源整段跳过
  - `sdk/cliproxy/service.go` 之前只在 management apply hook 上触发 `refreshAccountStoreAuths()`，sidecar 启动阶段并不会主动把 SQLite 账号打进 runtime auth manager
  - 这两点叠加后，正式环境就会出现“`management/accounts` 里能看到 `公司 1`，但 explain/真实请求里 runtime 仍然说 `no auth available`”的启动型 split-brain
- 已对隔离的正式数据副本做实证复现：
  - 复制正式 `accounts-v1.sqlite + config.yaml + channel-routing` 到 `/private/tmp/gettokens-repro-20260615/`
  - 用新 sidecar 启动后，旧库会自动迁移出 `routeability_status / routeability_reason / registered_models_count / failure_class / repair_*`
  - 同一份 `公司 1` 账号在迁移后落为 `runtime_routeability_status=registered_routeable`、`runtime_registered_models_count=10`
  - 这证明最初那层根因确实是“启动时 SQLite 账号真源没进 runtime”，而不是凭证本身失效
- 随后又把 explain 侧第二层筛选根因钉住并修掉：
  - `公司 1` 的当前 runtime auth id 实际是 `codex:apikey:3df2001c2d1b`
  - 隔离副本 `channel-routing/config.json.runtimeStates` 里残留了 `auth-id:codex:apikey:3df2001c2d1b -> auth-error`
  - 因为 explain 的 `Requestable` 会同时吃 runtime `status/unavailable` 和 route-guard blocks，所以即使 SQLite 已回写 `registered_routeable`，它仍会被这条陈旧持久化 block 过滤成 `account-unrequestable`
- 已在 reference sidecar 修复该层 split-brain：
  - `sdk/cliproxy/service.go` 在 runtime auth 被健康重建/更新为 active 且可请求时，会主动清理 `auth-error / upstream-rate-limit / upstream-error` 这类瞬态 route-guard 持久化残留
  - 不会顺手清理 `quota-empty`、`manual-disabled` 这类仍应保留的硬阻塞
- 隔离复现最新验收结果：
  - `channel-routing/config.json.runtimeStates["auth-id:codex:apikey:3df2001c2d1b"] == null`
  - `POST /v0/management/gettokens/channel-routing/explain` 已把 `公司 1` 恢复到 `candidates`
  - `routeIDs=["codex:apikey:3df2001c2d1b"]`，并且 `gpt-5.5` 仍在 `/v0/management/accounts/<account>/models` 中可见
- 随后又把这个旁支噪音也收掉了：
  - 根因不在 watcher synth，而在 `coreManager.Load() -> FileTokenStore.List() -> readAuthFile()` 这条旧读盘链
  - 这条链此前把所有 `.json` 都当 auth 读；即使没有 `type`，也会造出 `provider=unknown` 的 runtime auth
  - 因而 `channel-routing/config.json` 会在 sidecar 启动早期被加载成异常候选 `auth-id:channel-routing/config.json`
- 已在 reference sidecar 收口规则：只有显式带 `type` 的 JSON 才算 auth。当前已同步修到：
  - `sdk/auth/filestore.go`
  - `internal/store/gitstore.go`
  - `internal/store/objectstore.go`
  - `internal/store/postgresstore.go`
- focused tests 已补：
  - `sdk/auth/filestore_test.go -> TestFileTokenStoreListSkipsNonAuthJSONWithoutType`
- 最新隔离回归结果：
  - sidecar 启动日志已从 `4 clients (4 auth entries ...)` 收敛为 `3 clients (3 auth entries ...)`
  - `POST /v0/management/gettokens/channel-routing/explain` 候选只剩：
    - `Xiaomi MiMo Token Plan`
    - `公司 1`
    - `DeepSeek`
  - 异常候选 `auth-id:channel-routing/config.json` 已消失
- 主仓交付级验证也已补跑：
  - `go test ./internal/accounts ./internal/cliproxyapi ./internal/wailsapp`
  - `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/accounts/tests/accountListCache.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
  - `./scripts/wails-cli.sh build`
  - 说明当前 reference sidecar 修复没有把主仓现有 account / routing / Wails 工作台链路打回去
- 随后继续拿真实 `gettokens-dev` profile 做最终验证：
  - 启动修复后 sidecar 指向 `/Users/linhey/.config/gettokens-dev/accounts-v1.sqlite`，旧 `account_runtime_apply_state` 已自动迁移到新 schema，确认新增 `routeability_status / registered_models_count / failure_class / repair_*` 等列。
  - `POST /v0/management/gettokens/channel-routing/explain` 最初在 dev profile 上暴露了最后一处真实阻塞：`internal/gettokenshooks/channel_routing_explain.go` 把 persisted blocks merge 结果当成必非空 map，在“无持久化 block、但有内存态 transient block”时触发 `assignment to entry in nil map` panic。
  - 已在 reference sidecar 修复 explain nil map 写入，并补回归测试 `TestBuildChannelRoutingRuntimePoolDoesNotPanicWhenOnlyInMemoryRouteGuardsExist`。
  - 修复后二次验证结果：
    - `POST /v0/management/gettokens/channel-routing/explain` 返回 `200`
    - `candidates` 中明确包含 `acct_dd2172ea-9dd9-458a-88bd-590cc55a468c (公司 1)`
    - `GET /v0/management/accounts/<公司1>/models` 仍返回 8 个模型，其中包含 `gpt-5.4`、`gpt-5.5`、`gpt-5.3-codex-spark`、`codex-auto-review`
    - 真实 `gettokens-dev` SQLite `account_runtime_apply_state` 已落库：`applied | registered_routeable | 10`
- 之后继续完成主仓产物级验证：
  - 已先在 reference sidecar 提交 fork commit：`688f2972 fix(gettokens): close account store routeability split-brain`
  - 随后重新运行 `./scripts/ensure-sidecar.sh darwin arm64`，`build/bin/cli-proxy-api.meta.json` 已更新为 clean fingerprint：`688f2972...:clean:f79fb363...:darwin:arm64`
  - 已再次运行 `./scripts/wails-cli.sh build`，确保 app bundle 使用同一个 clean sidecar commit 重建
  - `build/bin/cli-proxy-api` 与 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api` 的 SHA256 不同，但 bundle 内 sidecar `codesign -dv --verbose=4` 显示为 `adhoc` 签名，且 `cli-proxy-api.meta.json` 已与 `build/bin` 裸二进制对齐到同一 clean commit
  - 已分别直接启动两份产品二进制（`build/bin/cli-proxy-api` 与 `.app/Contents/MacOS/cli-proxy-api`）指向同一份 `gettokens-dev` 临时验证配置，二者都满足：
    - `POST /v0/management/gettokens/channel-routing/explain` 返回 `200`
    - `公司 1` 出现在 `candidates`
    - `GET /v0/management/accounts/<公司1>/models` 返回 `gpt-5.4 / gpt-5.5 / gpt-5.3-codex-spark / codex-auto-review`
    - SQLite `account_runtime_apply_state` 仍保持 `applied | registered_routeable | 10`
- 最后继续补了真实 dev App 验收，而不是只停在 sidecar 裸进程：
  - 启动方式：`GETTOKENS_APP_PROFILE=dev ./build/bin/GetTokens.app/Contents/MacOS/GetTokens`
  - 启动前确认正式版仍在运行：`/Applications/GetTokens.app/Contents/MacOS/GetTokens` 与 `/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens/config.yaml`
  - 验收过程中新增的 dev 进程为：
    - `./build/bin/GetTokens.app/Contents/MacOS/GetTokens`
    - `/Users/linhey/Desktop/linhay-open-sources/GetTokens/build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`
  - dev sidecar `/healthz`：`http://127.0.0.1:18317/healthz -> {"status":"ok"}`
  - 当前 clean build 的版本真相以 app bundle 旁边的 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json` 为准：
    - `commit=688f29726719e01e1206d23db47017dea8028253`
    - `dirty=clean`
    - `fingerprint=688f2972...:clean:f79fb363...:darwin:arm64`
  - `~/.config/gettokens-dev/sidecar.log` 在本机是追加历史文件，不适合作为“当前 build 版本号”的唯一证据；本轮只用它证明：
    - dev sidecar 确实在 `:18317` 启动成功
    - 启动后真实收到 `/v0/management/accounts`、`/v0/management/model-definitions/codex`、`/v0/management/gettokens/quota-status` 等产品请求
  - 窗口验收截图已归档：
    - 安全裁切版：`screenshots/20260615/dev-app/20260615-dev-app-sidecar-ready-after-v04.png`
  - 说明：首次单窗截图包含 dev 账号邮箱，仅保留为本地临时产物，不作为归档引用；最终使用裁切后的 `v04` 作为可复用验收证据
- 当前剩余缺口继续收窄为：reference sidecar 代码与主仓方案已经在隔离副本和真实 `gettokens-dev` profile 双重闭环；剩余只差后续 release/正式环境复验。
