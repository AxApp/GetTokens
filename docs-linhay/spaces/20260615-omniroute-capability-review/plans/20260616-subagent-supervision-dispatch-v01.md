# Subagent Supervision Dispatch v01

日期：2026-06-16

## 主控职责

本轮按 `gettokens-subagent-supervision` 执行。

主控 agent 只负责：

- 范围与验收定义
- subagent 调度
- 结果集成与冲突处理
- 审核
- 自动化验证
- docs / memory 写回
- 最终完成判断

主控 agent 不直接承担各能力的主要实现。

## 当前任务拆分

| 能力 | space | subagent 角色 | 交付类型 | 优先级 |
|---|---|---|---|---|
| Route Resilience v2 | `20260616-route-resilience-v2` | `gettokens_routing_engineer` | 实现优先 | P1 |
| Quota Intelligence Dashboard | `20260616-quota-intelligence-dashboard` | `gettokens_observability_analyst` | 方案 + 首批实现切片 | P1 |
| Doctor Workbench | `20260616-doctor-workbench` | `gettokens_ui_integrator` | 方案 + 前端/Wails 切片 | P1 |
| Extension Contract v0 | `20260616-extension-contract-v0` | `gettokens_codex_extensions_maintainer` | 契约设计 | P2 |
| Protocol Bridge Surfaces | `20260616-protocol-bridge-surfaces` | `gettokens_domain_engineer` | 协议面设计 | P2 |

## Agent Assignments

| 能力 | agent | agent id | 状态 |
|---|---|---|---|
| Route Resilience v2 | Compass | `019ecf87-c3fc-76a2-aa00-f2345c467979` | accepted |
| Quota Intelligence Dashboard | Pulse | `019ecf87-c636-7d83-a71e-a3a1848db418` | accepted |
| Doctor Workbench | Vista | `019ecf87-c77d-78c0-b731-c28fa0722825` | accepted |
| Extension Contract v0 | Patch | `019ecf87-cae5-7350-ae33-8c78335a98a5` | accepted |
| Protocol Bridge Surfaces | Kernel | `019ecf87-cc53-79d1-a949-bc40b6fb1e25` | accepted |

## 写入边界

### Route Resilience v2

允许写入：

- `docs-linhay/spaces/20260616-route-resilience-v2/**`
- `docs-linhay/references/CLIProxyAPI/**`
- 必要时主仓 route decision / Wails DTO / frontend channel-routing 相关文件

禁止：

- 改动无关 Claude local apply 文件
- 修改正式版 app 或正式版配置

### Quota Intelligence Dashboard

允许写入：

- `docs-linhay/spaces/20260616-quota-intelligence-dashboard/**`
- quota / usage / account detail 相关模型与测试

禁止：

- 重构无关 account card 布局
- 把 quota authority 放到前端推断

### Doctor Workbench

允许写入：

- `docs-linhay/spaces/20260616-doctor-workbench/**`
- doctor workspace 相关 Wails / frontend 文件

禁止：

- 直接修改 sidecar runtime 决策
- 默认启动真实桌面手点验收

### Extension Contract v0

允许写入：

- `docs-linhay/spaces/20260616-extension-contract-v0/**`
- 必要时 `docs-linhay/dev/**` 中的契约文档

禁止：

- 引入任意执行型插件系统
- 修改 Codex Skills / MCP 现有行为

### Protocol Bridge Surfaces

允许写入：

- `docs-linhay/spaces/20260616-protocol-bridge-surfaces/**`
- 必要时 `docs-linhay/dev/**` 中的协议设计文档

禁止：

- 创建独立 route state
- 暴露绕过 sidecar authority 的 mutate API

## 审核门禁

每个 subagent 交付必须包含：

1. 修改文件列表
2. 核心决策摘要
3. 已运行验证
4. 未运行验证与原因
5. 风险与后续项

主控审核重点：

- 是否遵守 sidecar authority
- 是否有证据门禁
- 是否污染无关 dirty files
- 是否有 focused tests 或明确未测原因
- 是否需要更新 memory / skill / AGENTS

## Main Review

### 接受结果

1. Route Resilience v2：接受 Phase A1。实现只落在 CLIProxyAPI `internal/gettokenshooks`，新增 `RouteResilienceState` 与 account/provider/model scope 骨架，不改 selector 语义、不接 Wails/frontend。
2. Quota Intelligence Dashboard：接受首批前端纯模型切片。`resolveQuotaFact()` 只做展示消费，计划明确 sidecar 后续仍是 quota authority。
3. Doctor Workbench：接受首批计划与 preview model。未接 runtime binding，未伪造 sidecar truth。
4. Extension Contract v0：接受契约设计。范围保持声明式 capability registry，未引入 JS hook / marketplace / hot-path execution。
5. Protocol Bridge Surfaces：接受协议设计。bridge 只作为 adapter，未创建独立 route state。

### 主控集成修正

- 将 `frontend/src/features/accounts/tests/accountQuotaFact.test.mjs` 接入 `frontend/package.json` 的 `test:unit`，避免只在 focused command 中覆盖。

### 验证结果

已通过：

- CLIProxyAPI：`go test ./internal/gettokenshooks`
- Frontend focused：`node --test src/features/accounts/tests/accountQuotaFact.test.mjs src/features/accounts/tests/accountQuotaRuntime.test.mjs src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- Wails focused：`go test ./internal/wailsapp -run 'TestQuotaRuntimeBridgeCallsReadOnlyManagementAPI|TestRefreshCodexQuotasBatchCallsBatchManagementAPI|TestRefreshCodexQuotasBatchJobBridge'`
- Frontend：`npm run typecheck`
- Docs：`docs-linhay/scripts/check-docs.sh`
- Whitespace：`git diff --check` 与 `git -C docs-linhay/references/CLIProxyAPI diff --check`

未通过：

- Frontend full unit：`npm run test:unit` 目前 `853 pass / 1 fail`。
- 失败项是 `frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs` 的 `Claude draft uses relay endpoint instead of upstream anthropic format URL`，实际值为 `https://api.deepseek.com/anthropic`，期望为 `http://127.0.0.1:8317/v1`。
- 该失败属于当前工作区已有 Claude local apply 方向改动，不是本轮 OmniRoute 借鉴 subagent 交付引入；主控本轮未修复该无关 dirty work。

### 后续建议

1. Route Resilience v2 下一步进入 A2：把 `RouteResilienceState` 接入 `channel_routing_explain.go` 与 `RouteDecisionSnapshot`。
2. Quota Intelligence 下一步进入 sidecar `QuotaFact` builder，再补 Wails DTO 透传。
3. Doctor Workbench 下一步先定 `GetDoctorSnapshot` DTO，再接 Wails / frontend workspace。
4. Extension Contract v0 首个实现切片建议从静态 `provider-metadata` 或 `model-catalog-source` 开始。
5. Protocol Bridge 后续从 canonical schema + sidecar authority map 开始，不先接 transport。

## 当前状态

- 状态：accepted-with-external-test-blocker
- 已返回：Route Resilience v2、Quota Intelligence Dashboard、Doctor Workbench、Extension Contract v0、Protocol Bridge Surfaces。
- 主控下一步：若继续实现，优先派发 Route Resilience v2 A2；另行处理当前工作区 Claude local apply full-unit blocker。

## Second Dispatch

日期：2026-06-16

用户约束：本阶段只推进以下五个 space，其他 dirty work 属于其他需求，不纳入本轮修复或回滚范围。

### 第二轮任务拆分

| 能力 | agent | agent id | 目标 | 写入面 |
|---|---|---|---|---|
| Route Resilience v2 A2 | Circuit | `019ecf9c-8c59-7be2-8ffb-10149d60d9e1` | 将 `RouteResilienceState` 接入 explain / recent decisions 的结构化 dropped reasons | CLIProxyAPI route diagnostics / gettokenshooks + route space |
| Quota Intelligence sidecar fact | Relay | `019ecf9c-8d36-7a91-b595-a3175f699976` | 在 sidecar quota runtime 输出 `QuotaFact` authority | CLIProxyAPI quota runtime / refresh + quota space |
| Doctor Workbench preview UI | Frame | `019ecf9c-8e8e-7231-9544-6ac6538ffe97` | 建立可浏览的 Doctor preview workspace，不新增 mutate / Wails binding | doctor frontend feature + doctor space |
| Extension Contract artifacts | Socket | `019ecf9c-9112-7d11-8889-b24f4507dd2a` | 将 v0 契约固化为 JSON Schema、examples、conflict matrix | extension contract space |
| Protocol Bridge contract artifacts | Forge | `019ecf9c-920b-7f23-aef6-2c0467b88a29` | 将 bridge surfaces 固化为 canonical operation/schema/examples | protocol bridge space |
| Protocol Bridge contract artifacts retry | Kernel the 2nd | `019ecfa3-eb4b-7c53-972e-2ee4c3d71433` | Forge 因模型容量失败后重派同一纯文档/schema/examples 任务 | protocol bridge space |

### 第二轮主控审核门禁

1. Route / quota 的事实源必须继续保持 sidecar-owned，Wails/frontend 只能透传或展示。
2. Doctor preview 必须显式标记 `source=preview`，不得伪造 runtime truth。
3. Extension contract 仍为声明式 registry，不得引入 JS hook、marketplace、任意执行或 Codex Skills/MCP 保存链路变更。
4. Protocol bridge 只做 adapter contract，不保存 candidate pool、route state 或独立 quota truth。
5. full `npm run test:unit` 的 Claude local apply 既有失败不作为本轮修复对象；本轮只做 focused validation 与五个 space 范围内的回归。

### 第二轮运行记录

- Socket 已完成 Extension Contract artifacts，主控初审通过写入面与 JSON parse 校验；后续 runtime validator / registry / conflict detector 仍未实现。
- Forge 因模型容量失败，无有效产出；已关闭并重派 Kernel the 2nd 执行同一 Protocol Bridge contract artifact 任务。

### 第二轮主控验收

已通过：

- Route A2 focused：`go test ./internal/gettokenshooks -run 'TestRouteResilience|TestChannelRoutingExplain|TestChannelRoutingDecisions|TestAccountRouteGuard'`
- Route diagnostics focused：`go test ./sdk/cliproxy/auth -run 'TestRouteDecision'`
- Quota sidecar focused：`go test ./internal/gettokenshooks -run 'TestQuotaRuntime|TestQuotaEmptyRouteGuard'`
- Quota management focused：`go test ./internal/api/handlers/management -run 'TestQuota'`
- Doctor focused：`npm run test:doctor-workbench`
- Frontend typecheck：`npm run typecheck`
- Extension / Protocol JSON artifacts parse：8 个 JSON artifact 通过 `JSON.parse`
- Docs：`docs-linhay/scripts/check-docs.sh`
- Whitespace：`git diff --check` 与 `git -C docs-linhay/references/CLIProxyAPI diff --check`

主控修正：

- Doctor screenshot 从 `doctor-workbench-preview.png` 重命名为 `20260616-doctor-workbench-preview-baseline-v01.png`，满足截图命名门禁。

## Third Dispatch

日期：2026-06-16

第三轮只推进近期最高依赖的透传层，不让 Doctor 先写假 runtime 集成：

| 能力 | agent | agent id | 目标 | 写入面 |
|---|---|---|---|---|
| Route Resilience v2 A3 | Relay the 2nd | `019ecfac-11e1-7e20-a810-6351864964dd` | 将 sidecar structured `droppedReasons` 透传到 main repo Wails/root/frontend channel-routing model | route decision DTO / mapping / frontend channel routing model |
| Quota Intelligence A3 | Forge the 2nd | `019ecfac-d23c-7540-ab9c-dd061d3c0b39` | 将 sidecar `QuotaRuntimeState.fact` 透传到 main repo Wails/root/frontend quota model | quota DTO / Wails mapping / frontend quota model |

第三轮约束：

1. 只做字段透传和消费模型，不在 Wails/root/frontend 重新推导 sidecar truth。
2. 不运行 Wails binding generator；若需要前端 generated model 同步，只做最小手工类型对齐。
3. Doctor Workbench 等 route/quota DTO 稳定后再接真实 snapshot，当前 preview 继续显式标记 `preview-only`。

### 第三轮主控验收

已接受：

1. Route Resilience v2 A3：structured `droppedReasons` 已从 `internal/cliproxyapi` 透传到 Wails/root DTO，并进入 frontend `ChannelRouteDecisionSnapshot`；frontend route decision summary 优先展示 `source/scope: reason`，旧 trace fallback 保留。
2. Quota Intelligence A3：sidecar `QuotaRuntimeState.fact` 已进入 main repo `QuotaRuntimeState.Fact`、Wails/root `quotaFact`、frontend `resolveQuotaFact()`；`no_quota` 兼容为 UI `no-quota`，`observedAt/expiresAt/evidenceRefs` 已透传。

已通过：

- Route Wails/client：`go test ./internal/wailsapp -run 'TestListChannelRouteDecisions' && go test ./internal/cliproxyapi -run 'TestListChannelRoutingDecisionsClient'`
- Route frontend：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs`
- Quota client/Wails/root：`go test ./internal/cliproxyapi -run TestQuotaRuntimeClientStatus && go test ./internal/wailsapp -run 'TestQuotaRuntime|TestRefreshCodexQuotasBatch|TestCodexQuota' && go test . -run TestMapCodexQuotaResponsePreservesBilling`
- Quota frontend：`node --test src/features/accounts/tests/accountQuotaFact.test.mjs src/features/accounts/tests/accountQuotaRuntime.test.mjs`
- Frontend typecheck：`npm run typecheck`
- Docs/whitespace：`docs-linhay/scripts/check-docs.sh && git diff --check && git -C docs-linhay/references/CLIProxyAPI diff --check`

剩余主线：

1. Doctor Workbench 从 preview-only 进入 read-only `GetDoctorSnapshot` DTO / Wails/root/frontend 消费。
2. Route Resilience 后续仍需 probe 面 structured dropped reasons 与 operator controls。
3. Quota Intelligence 后续需要把 fact evidence 展示到 account detail / doctor / usage 状态面。

## Fourth Dispatch

日期：2026-06-16

| 能力 | agent | agent id | 目标 | 写入面 |
|---|---|---|---|---|
| Doctor Workbench A2 | Frame the 2nd | `019ecfb8-9cd1-7713-8aa0-9c7ca3d8315a` | 从 preview-only 推进到只读 `GetDoctorSnapshot` Wails/root/frontend 最小闭环 | doctor Wails/root DTO、frontend doctor feature、doctor space |

## Sixth Dispatch

日期：2026-06-16

本轮继续保持主控只做编排、审核与门禁，主要实现交给 subagent。

| 能力 | agent | agent id | 目标 | 写入面 |
|---|---|---|---|---|
| Extension Contract v0 Phase 1 | Kernel | `019ed0df-0662-7150-aaa9-f15ea785c7fb` | 实现只读 extension registry loader core，输出 valid / invalid / duplicate 状态，不读取 Codex config | `internal/gettokensextensions/**`、extension space |
| Protocol Bridge scoped auth/audit | Kernel the 2nd | `019ed0df-444b-7522-b784-55213502e5b2` | 实现 scoped authorize/audit core，证明缺 scope / transport / idempotency 时不会触达 sidecar | `internal/protocolbridge/**`、protocol bridge space |
| Route Resilience operator controls | 主控计划，不做实现 | 本线程 | 固定 operator controls 契约、证据门禁与 TDD 列表，供后续 routing subagent 实现 | route resilience space |

### 第六轮约束

1. Extension Contract 仍然只能做声明式、只读 registry，不接任意执行、marketplace 或 Codex config 保存链路。
2. Protocol Bridge 只做 scoped authorization 与 redacted audit，不创建 sidecar 外的 route/quota state。
3. Route operator controls 当前只落契约计划；后续实现必须先补 CLIProxyAPI 失败测试，且只能由 sidecar 执行动作。

### 第六轮主控审核

初次 reviewer 发现 2 个阻断项和 1 个中风险项：

1. Protocol Bridge 的 `Client.LoopbackOnly` 已建模但未在 `Runtime.Authorize` 执行。
2. Extension registry loader 只做宽松 struct decode，可能把缺少 capability 必填结构或夹带 runtime hook 的 manifest 标为 `readonly-compatible`。
3. Protocol request schema / spec 对 request-side `actor` 的表达容易被后续 adapter 误用为外部权限输入。

主控处理：

1. 重派 Forge the 2nd 修复 Protocol Bridge：新增 caller / peer context，`LoopbackOnly=true` 且缺 caller 或非 loopback 时 fail closed；`actor.scopes` 只投影未禁用、未过期 grant；request schema 明确不接受外部 actor。
2. 重派 Socket the 2nd 修复 Extension Contract：新增 schema-aligned capability 白名单和必填结构校验，覆盖 `provider-metadata`、`model-catalog-source`、`quota-probe` 的 runtime hook、inline secret、非法 source / credential ref 等负向路径。
3. Route operator controls 计划经 reviewer 复核未发现允许清 `manual-disabled`、`quota-empty` 或持久 `rate-limit` 的阻断问题。

已通过：

- Extension runtime core：`go test -count=1 ./internal/gettokensextensions`
- Protocol runtime core：`go test -count=1 ./internal/protocolbridge`
- Contract artifacts：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- Docs：`docs-linhay/scripts/check-docs.sh`
- Whitespace：`git diff --check`

剩余风险：

1. Extension runtime core 仍是 Phase 1 轻量结构校验，不是完整 JSON Schema 2020-12 等价实现；进入 enable/runner 前必须补更完整 contract tests。
2. Protocol Bridge 仍未实现 MCP/A2A/HTTP adapter；后续 adapter 必须传入可信 caller / peer context，否则 loopback-only client 会按设计拒绝。
3. Route operator controls 仍是契约计划，未实现 sidecar action handler。

第四轮约束：

1. `GetDoctorSnapshot` 只能聚合 read-only 事实，不能新增 repair/mutate action。
2. route/quota 事实只消费第三轮已稳定的 droppedReasons / quotaFact DTO，不在 Doctor 内重新推导 authority。
3. 浏览器无 Wails 时继续走 explicit preview，并清晰标记 `source=preview`；runtime 路径不得伪造 preview truth。

### 第四轮主控验收

已接受：

- Doctor Workbench A2：新增只读 `GetDoctorSnapshot`，覆盖 Wails core、root binding、root mapper、frontend runtime-first/preview-fallback 路径。
- Runtime 边界：sidecar 未 ready 只返回 `not_ready` readiness check；read-only route/quota surface 读取失败返回 `degraded`，不抛整页失败；route dropped reasons / quota facts 只作为 sidecar evidence 展示。
- 主控修正：将 Doctor runtime/preview navigation hash 统一到当前 App frame hash 规范，避免继续使用草案期 `#status/all`、`#codex/channel-routing?...`。

已通过：

- `go test ./internal/wailsapp -run 'TestDoctor'`
- `go test . -run 'TestGetDoctorSnapshot|TestMapDoctor'`
- `npm run test:doctor-workbench`
- `npm run typecheck`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

剩余主线：

1. Route Resilience：probe 面 structured dropped reasons 与 operator controls 尚未实现。
2. Quota Intelligence：account detail / doctor / usage 的 fact evidence 展示还可继续增强，但 DTO 已透传。
3. Doctor Workbench：下一阶段可接更完整 sidecar unified diagnostics endpoint 和 headless screenshot 验收。
4. Extension Contract / Protocol Bridge：当前为 schema/artifacts，runtime registry / bridge adapters 尚未实现。

## Fifth Dispatch

日期：2026-06-16

第五轮目标是把剩余主线拆成更小且互不重叠的切片，继续保持 sidecar authority 与 bridge/extension 的受控边界。

证据门禁：[20260616-fifth-round-evidence-matrix-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260616-fifth-round-evidence-matrix-v01.md:1)

### 第五轮首次派发状态

| 能力 | agent | agent id | 目标 | 状态 |
|---|---|---|---|---|
| Route Resilience A4 | Compass | `019ed025-b5ac-76b2-bd5d-f64656fa4024` | probe / dry-run diagnostics 输出 structured `droppedReasons` | failed: service high demand，无产出 |
| Quota + Doctor evidence UI | Frame | `019ed026-197c-7522-a637-fec1249e3698` | quota fact evidence 展示与 Doctor headless 验收 | failed: service high demand，无产出 |
| Extension Contract Phase 1 plan | Patch | `019ed0c9-570d-7d62-9043-386730c2db6f` | 只读 registry 实现计划 | accepted |
| Protocol Bridge scoped auth / audit plan | Relay | `019ed0c9-80c8-7001-8015-25c4eebab1ff` | scoped auth / audit runtime model 计划 | accepted |
| Route Resilience A4 implementation | Circuit | `019ed0d1-be5e-7fd3-b5e6-bbdcb09672c8` | probe / dry-run diagnostics structured `droppedReasons` | accepted |
| Extension / Protocol contract validator | Forge | `019ed0d1-fa5a-7880-983b-229a8e56e2e6` | contract artifact validator | accepted |

### 第五轮主控验收

已接受：

1. Route Resilience A4：CLIProxyAPI reference 在 route guard hard-filter 与 explain/dry-run 诊断链路中加入 model-scope filter，`scope=model` 且 requested model 不匹配时不再扩大为 account/provider block；recent diagnostics 继续保留 structured dropped reasons。
2. Quota Intelligence evidence UI：`buildQuotaDisplay()` 挂载 sidecar `quotaFact` 到 `QuotaDisplay.fact`，`QuotaBars` 展示 `observedAt/expiresAt/evidenceRefs`，UI 不重新推导 quota authority。
3. Doctor Workbench headless acceptance：新增 headless Chrome DOM/screenshot 脚本，验证 browser preview 明确标记 `source=preview` / `preview-only`，且无草案期 hash。
4. Extension / Protocol contract validator：新增 `docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，对 extension schema/examples 与 protocol schema/manifest/examples 执行 20 项一致性检查。

已通过：

- Route sidecar focused：`go test ./internal/gettokenshooks -run 'TestRouteResilience|TestChannelRoutingExplain|TestChannelRoutingDecisions|TestRoute.*Probe|Test.*Diagnostics'`
- Route diagnostics focused：`go test ./sdk/cliproxy/auth -run 'TestRouteDecision|Test.*Probe|Test.*Diagnostics'`
- Quota / Doctor frontend focused：`node --test frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/accounts/tests/accountCardLayout.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Doctor headless：`node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Contract artifacts：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`

剩余主线：

1. Route：真实 route probe endpoint / builder 与 operator controls 尚未实现。
2. Quota / Doctor：更完整 unified diagnostics endpoint 尚未实现；browser screenshot 不替代真实 Wails runtime binding 验收。
3. Extension：Phase 1 read-only registry runtime 尚未实现。
4. Protocol：scoped auth / audit runtime 与 MCP adapter 尚未实现。

### 第五轮重派策略

1. 重派时缩小每个 subagent 的写入面，避免等待大任务导致主线停滞。
2. Route A4 仍限定在 CLIProxyAPI reference 的 route diagnostics/probe 与 route space plan。
3. Quota / Doctor 切片只消费已有 `quotaFact` 与 `GetDoctorSnapshot`，不重新推导 quota authority 或 route truth。
4. Extension Contract 先做只读 registry 骨架或实现计划，不进入 JS hook、marketplace、任意执行。
5. Protocol Bridge 先做 canonical scope / audit runtime model，不接 MCP/A2A transport，不保存 candidate pool、route state 或 quota truth。

## Seventh Dispatch

日期：2026-06-16

第七轮继续保持主控只做编排、审核与门禁；实现由 bounded subagent 完成，主控只补跑验收和文档写回。

| 能力 | agent id | 目标 | 结果 |
|---|---|---|---|
| Route Resilience operator controls action handler | `019ed0fb-9c71-7c12-9352-2b522b9e1471` | 在 CLIProxyAPI reference 中新增受控 management action endpoint，先只实现可证明安全边界的 transient lockout cleanup | accepted |
| Extension Contract read-only Wails/root bridge | `019ed0fb-e1b1-7ef2-aed0-aac4fdf3bce1` | 将只读 extension registry core 接到 Wails/root snapshot，保持 app-owned root、read-only、no capability execution | accepted |
| Protocol Bridge MCP adapter mapping fixture | `019ed0fc-27ba-7503-a828-11008a346256` | 固化 MCP adapter mapping fixture 与 Go validator，并扩大 OmniRoute contract artifact validator 覆盖面 | accepted |

### 第七轮主控验收

已接受：

1. Route Resilience：CLIProxyAPI reference 新增 `POST /v0/management/gettokens/route-resilience/actions`；当前只实现 `clear_transient_lockout`，`rerun_bounded_reconcile` 与 `recheck_routeability` 返回 `not_implemented`，避免在 hook 层越权触达 Service / routeability projection。
2. Extension Contract：只读 extension registry core 已接 Wails/root `GetGetTokensExtensionRegistrySnapshot`；默认扫描 GetTokens app-owned root，缺 root 返回 read-only empty snapshot + warning；不读取 Codex config，不执行 capability，不写 enable/disable。
3. Protocol Bridge：新增 MCP adapter mapping fixture 与 Go validator；artifact validator 从 20 项扩展到 28 项检查，覆盖 mapping 与 canonical operation / bridge schema 对齐。

已通过：

- Route sidecar focused：`go test -count=1 ./internal/gettokenshooks -run 'TestRouteResilienceAction|TestAccountRouteGuard'`
- CLIProxyAPI diff check：`git -C docs-linhay/references/CLIProxyAPI diff --check`
- Extension focused：`go test -count=1 ./internal/gettokensextensions ./internal/wailsapp -run 'TestGetTokensExtension|TestExtension'`
- Extension root / doctor mapper focused：`go test -count=1 . -run 'TestGetTokensExtension|TestMapGetTokensExtension|TestGetDoctorSnapshot|TestMapDoctor'`
- Extension frontend binding：`node --test frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
- Protocol focused：`go test -count=1 ./internal/protocolbridge`
- Contract artifacts：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- 主控 Wails focused：`go test -count=1 ./internal/wailsapp -run 'TestGetTokensExtension|TestExtension|TestDoctor|TestQuotaRuntime|TestListChannelRouteDecisions'`
- Frontend focused：66/66 通过
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check` 均通过

剩余风险：

1. Route Resilience：当前 action handler 只覆盖 transient lockout 清理；bounded reconcile 与 routeability recheck 仍待具备 Service / projection 权限的后续切片实现。
2. Extension Contract：当前是 read-only snapshot bridge；尚未接 frontend management UI、enable/disable 写入、capability runner 或完整 JSON Schema 等价校验。
3. Protocol Bridge：MCP adapter 仍停留在 mapping fixture / validator；真实 MCP transport、handler、sidecar 调用与 audit runtime 串联仍待后续。
4. 主控沉淀审计：第七轮复用的是既有 subagent 监督、sidecar authority、只读 extension bridge、adapter contract 前置门禁；未形成新的跨领域流程或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Eighth Dispatch

日期：2026-06-16

第八轮继续保持主控只做编排、审核与门禁；实现由 bounded subagent 完成。本轮刻意避开 Extension frontend management UI，避免与 Route 主仓 Wails/root bridge 同时争抢 root binding 和 Codex workspace 大页面。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience main bridge | `019ed10c-a469-7832-95fb-8f2be3df599d` | 将 CLIProxyAPI `route-resilience/actions` 接入主仓 client / Wails / root / WailsJS，只透传 sidecar action response | `internal/cliproxyapi`、`internal/wailsapp`、root App DTO/mapper、WailsJS、route space | accepted |
| Quota + Doctor sidecar diagnostics | `019ed10c-f262-7220-a242-19c56832a088` | 在 CLIProxyAPI reference 内新增只读 unified diagnostics endpoint，复用 quota fact 与 route dropped reasons | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks`、quota/doctor spaces | accepted |
| Protocol Bridge MCP adapter handler | `019ed10d-33f5-77f2-a5a0-cb0e9c618e12` | 将 MCP mapping fixture 推进到 adapter handler contract，继续不实现 stdio server 或 sidecar execution | `internal/protocolbridge`、protocol bridge space | accepted |

### 第八轮边界

1. Route main bridge 只能透传 sidecar action contract，不在 Wails/frontend 推导 route truth，也不能把 `not_implemented` 伪装成成功。
2. Quota / Doctor diagnostics endpoint 只能读 sidecar-owned runtime facts，不刷新 quota、不清 guard、不新增 repair mutation。
3. Protocol MCP adapter handler 只能基于 mapping fixture、`Runtime.Authorize` 和 executor interface 输出 canonical envelope，不保存 route / quota / model truth。
4. Extension Contract 本轮不并发实现 frontend management UI；后续单独排期，避免把 UI 接线、enable/disable 和 root binding 混在一起。

### 第八轮主控验收

已接受：

1. Route Resilience main bridge：主仓新增 `RunRouteResilienceAction`，从 `internal/cliproxyapi` 到 `internal/wailsapp`、root `main.App`、`frontend/wailsjs` 全链路透传 sidecar action response；501 `not_implemented` 保留 response body 和 `httpStatus`，不伪造成成功。
2. Quota + Doctor sidecar diagnostics：CLIProxyAPI reference 新增只读 `GET /v0/management/gettokens/doctor-diagnostics`，输出 `authority=sidecar` / `source=sidecar-diagnostics`，checks 复用 active route dropped reasons 与 `QuotaRuntimeState.fact`，不刷新 quota、不清 guard、不新增 repair mutation。
3. Protocol Bridge MCP adapter handler：`internal/protocolbridge.MCPAdapter` 已从 mapping fixture 进入 handler contract；unknown tool/resource、missing scope、safe action missing idempotency key 均在 adapter boundary 拒绝，executor 不被调用；safe action 只返回 operation ref。

已通过：

- Route main bridge：`go test -count=1 ./internal/cliproxyapi -run 'TestRouteResilienceAction|TestRunRouteResilienceAction'`
- Route Wails/root：`go test -count=1 ./internal/wailsapp -run 'TestRouteResilienceAction|TestRunRouteResilienceAction|TestListChannelRouteDecisions'`
- Route root mapper：`go test -count=1 . -run 'TestRouteResilienceAction|TestMapRouteResilienceAction|TestGetDoctorSnapshot|TestMapDoctor'`
- Route WailsJS binding：`node --test frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
- Quota / Doctor sidecar：`go test -count=1 ./internal/gettokenshooks -run 'TestDoctorDiagnostics|TestQuotaRuntime|TestRouteResilience|TestChannelRouting'`
- Protocol bridge：`go test -count=1 ./internal/protocolbridge`
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract artifacts：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Route Resilience：UI 还未消费 `RunRouteResilienceAction`；sidecar 仍只实现 `clear_transient_lockout`，`rerun_bounded_reconcile` / `recheck_routeability` 继续返回 `not_implemented`。
2. Quota / Doctor：主仓 Wails/root/frontend 还未消费 `doctor-diagnostics` endpoint；当前 Doctor Workbench 仍是已有 `GetDoctorSnapshot` 聚合路径。
3. Protocol Bridge：真实 MCP stdio transport、sidecar execution binding、operation runner、audit persistence 仍待后续切片。
4. Extension Contract：本轮刻意不并发接 UI；下一轮可单独做 read-only management UI，避免与 root binding 和 Codex workspace 大页面冲突。

## Ninth Dispatch

日期：2026-06-17

第九轮继续保持主控只做编排、审核与门禁；实现由 bounded subagent 完成。本轮把第八轮留下的“已有 bridge 但未被 UI / runtime 消费”的尾部切开，避免一个 agent 同时改 root binding、Doctor UI、Extension UI 和 Protocol runtime。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience UI action consumption | `019ed37e-b3ab-7d82-a797-bc928ddf2bf0` | 前端 channel-routing 开始消费 `RunRouteResilienceAction`，展示 sidecar action response | `frontend/src/features/channel-routing/**`、route WailsJS binding test、route space | running |
| Doctor / Quota unified diagnostics consumption | `019ed37e-b448-7b41-9f94-0d4a2f3d114f` | 主仓 client / Wails / root / frontend 消费只读 `doctor-diagnostics` endpoint，并保留 fallback | `internal/cliproxyapi`、`internal/wailsapp/doctor*`、root doctor DTO/mapper、doctor frontend、doctor/quota spaces | running |
| Extension Contract read-only management UI | `019ed37e-b5f8-70a0-a8e6-a1a77481ea45` | 基于只读 registry snapshot bridge 做最小 management UI / model / tests | extension frontend feature、extension WailsJS binding test、extension space | running |
| Protocol Bridge sidecar execution binding contract | `019ed37e-b77d-7073-b78f-e729583915db` | 将 MCP adapter fakeable executor 推进到 sidecar execution binding contract / stub runner / tests | `internal/protocolbridge/**`、protocol bridge space、必要的 contract artifact validator | running |

### 第九轮边界

1. Route UI 只能消费 sidecar action response；`not_implemented` 必须原样展示为未实现/不可执行状态，不能伪装为修复成功。
2. Doctor / Quota diagnostics 只能读取 sidecar-owned facts；endpoint 不可用时保留现有 `GetDoctorSnapshot` 聚合 fallback，不允许新增 repair mutation。
3. Extension UI 只能展示 read-only registry snapshot；不做 enable/disable、不执行 capability、不读取或保存 Codex Skills/MCP 配置。
4. Protocol executor binding 继续遵守先 `Runtime.Authorize` 后 executor；safe action 只返回 accepted operation ref，不在 bridge 层保存 route / quota / model truth。

### 第九轮主控验收

已接受：

1. Route Resilience UI：`ChannelRoutingWorkbench` 已直接消费 `RunRouteResilienceAction`，从真实 route decision 的 structured dropped reasons 生成最小 action target；`clear_transient_lockout` 只在 sidecar 支持的 transient source 下可执行，`rerun_bounded_reconcile` / `recheck_routeability` 只透传 `not_implemented` 等 sidecar response。
2. Doctor / Quota diagnostics：主仓新增 `GetDoctorDiagnostics` client 与 Wails/root 消费路径；`GetDoctorSnapshot` 在 sidecar ready 时优先读取 `GET /v0/management/gettokens/doctor-diagnostics`，将 `route_guard_dropped_reasons` / `quota_facts` 映射为 Doctor checks；旧 sidecar `404/501` 或 unsupported 时回退现有 `wails-aggregate`，不让页面崩。
3. Extension Contract UI：新增独立 read-only extension registry feature / model / preview data / tests，只展示 registry roots、extension、capability kinds、source 和 diagnostics；未接 enable/disable、capability runner、Codex Skills/MCP 配置保存或 marketplace。
4. Protocol Bridge execution binding：`MCPAdapter` 的 executor contract 收紧为 read sidecar envelope 或 safe action accepted operation ref；新增 stub executor 与可选 audit persister interface，继续先 authorize 后 executor，拒绝路径不触达 executor。

已通过：

- Main client：`go test -count=1 ./internal/cliproxyapi -run 'TestDoctorDiagnostics|TestGetDoctor|TestRouteResilienceAction|TestRunRouteResilienceAction'`
- Wails core：`go test -count=1 ./internal/wailsapp -run 'TestDoctor|TestDoctorDiagnostics|TestQuotaRuntime|TestRouteResilienceAction|TestRunRouteResilienceAction|TestGetTokensExtension|TestExtension|TestListChannelRouteDecisions'`
- Root app：`go test -count=1 . -run 'TestGetDoctorSnapshot|TestMapDoctor|TestDoctorDiagnostics|TestRouteResilienceAction|TestMapRouteResilienceAction|TestGetTokensExtension|TestMapGetTokensExtension'`
- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI reference：`go test -count=1 ./internal/gettokenshooks -run 'TestDoctorDiagnostics|TestQuotaRuntime|TestRouteResilience|TestChannelRouting|TestRouteResilienceAction|TestAccountRouteGuard'`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / docs / whitespace：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`、`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Route Resilience：UI 当前只基于最近真实 decision 选第一个可定位 dropped reason，仍不是完整 operator workbench；sidecar 仍只实现 `clear_transient_lockout`，另外两个 action 继续依赖后续 hook/service 权限。
2. Doctor / Quota：真实 sidecar 进程端到端 smoke 尚未做；本轮通过 focused tests 证明 404/501 fallback 和 diagnostics mapping。
3. Extension Contract：read-only feature 还未挂到现有 workspace / hash 入口，后续需要单独做宿主接线和截图验收。
4. Protocol Bridge：`sidecar_invoked=true` 目前表示进入 execution binding contract/stub，不代表真实 stdio / HTTP sidecar runner 已打通；audit persistence 仍是 interface/no-op。
5. 主控沉淀审计：本轮仍复用既有 subagent supervision、sidecar authority、read-only extension 和 bridge contract 门禁；没有新增跨领域流程或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Tenth Dispatch

日期：2026-06-17

第十轮继续只推进五个 OmniRoute space。主控仍只做编排、审核、验证和文档写回；实现由 bounded subagent 完成。本轮重点把第九轮“独立 feature / stub / focused consumer”推进到更接近可用闭环，但继续避免跨 space 大范围改动。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Extension Contract workspace entry | `019ed38f-8147-7bf0-8c31-a95d0ad0bfa0` | 将 read-only extension registry feature 挂到现有 workspace/hash 入口，并补 headless/DOM 或 focused render 验收 | extension frontend feature、宿主入口的最小接线、extension space/screenshots、必要的检查脚本 | running |
| Protocol Bridge sidecar runner contract | `019ed38f-81f2-7c82-92c8-d7927ea40d81` | 在 `internal/protocolbridge` 内新增真实 sidecar runner contract / fake HTTP transport tests，替代纯 stub 的下一层契约 | `internal/protocolbridge/**`、protocol bridge space、必要的 artifact validator | running |
| Doctor / Quota usage-status evidence | `019ed38f-830d-78d3-ab3a-a45af3436960` | 将 `sidecar-diagnostics` quota evidence model 扩到 usage/status 相关前端模型或计划，继续不在前端推导 quota authority | doctor/quota frontend model/tests、quota/doctor spaces | running |
| Route Resilience operator surface refinement | `019ed38f-848c-7862-b9bf-644b20812f72` | 把 route action result 复用为更明确的 operator result/history model，避免只显示最近第一条 dropped reason | channel-routing route resilience model/tests、route space | running |

### 第十轮边界

1. Extension 入口只接 read-only registry，不做 enable/disable、不执行 capability、不接 Codex Skills/MCP 保存链路。
2. Protocol runner 可以定义 sidecar-bound executor contract 和 fake transport tests，但不得实现真实 MCP stdio server，不得在 bridge 层保存 route / quota / model truth。
3. Doctor / Quota usage/status 只消费 `sidecar-diagnostics` / `quotaFact` evidence，不能由前端拼装新的 quota authority。
4. Route operator surface 只能展示 sidecar action response / history，不得把 `not_implemented` 或失败 action 当成已修复。

### 第十轮主控验收

已接受：

1. Extension Contract workspace entry：`extension-registry` 已成为合法 Codex workspace/hash，`CodexPage` 可进入 read-only registry feature，sidebar 增加 `Extension Registry` 子入口；验收产物包含 PNG baseline 与 Playwright 文本快照。主控修正：文本快照移出 `screenshots/` 到 `plans/`，并将 preview 脚本改为 Chrome 失败时使用归档 Playwright snapshot/PNG fallback，避免保留不可运行门禁。
2. Protocol Bridge sidecar runner contract：新增 `SidecarHTTPExecutor` / `SidecarTransport` / request-response contract 和 fake transport tests；read operation 只返回 sidecar-authority data envelope，safe action 只返回 accepted operation ref；safe action header 只传 idempotency hash，不传明文 key / Authorization / Cookie。
3. Doctor / Quota usage-status evidence：新增 `coerceQuotaFactDisplay()` 与 `buildQuotaFactEvidenceView()`，把 sidecar `quotaFact` 收敛为 usage/status 可复用 evidence view model；Doctor 侧复用该 helper 对齐 source/summary label，不在前端重新推导 quota authority。
4. Route Resilience operator surface：route resilience UI 不再只取第一条 dropped reason；新增 selectable target list、per-target action history 与 latest result lookup，sidecar `not_implemented` / failure 继续按原始语义展示。

已通过：

- Extension preview：`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`（当前本机 Chrome headless 失败，脚本使用归档 Playwright snapshot/PNG fallback 通过）
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs`
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Contract / docs / whitespace：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`、`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Extension Contract：入口已接，但仍是 read-only；enable/disable、runner、Codex Skills/MCP 保存链路和 marketplace 仍不属于当前阶段。
2. Protocol Bridge：`SidecarHTTPExecutor` 仍是 contract/fake transport 层，不证明真实 sidecar endpoint、auth、timeout、retry 或 MCP stdio server。
3. Doctor / Quota：usage/status 还未接完整 UI；本轮先固化可复用 evidence view model，后续 usage desk / status summary 应直接消费该模型。
4. Route Resilience：target 去重 key 仍包含 reason 文本，语义相同但文案变化的 dropped reason 可能分裂为多个 target；action history 仍是前端会话内状态，未持久化。
5. 主控沉淀审计：本轮仍是五个 space 的 feature-local 推进，没有新增跨领域流程或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Eleventh Dispatch

日期：2026-06-17

第十一轮继续只推进五个 OmniRoute space。主控仍只做编排、审核、验证和文档写回；实现由 bounded subagent 完成。本轮针对第十轮剩余风险做更窄的质量切片。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience stable target identity | `019ed39d-e375-7c73-b26f-b863c5e21b74` | 让 route resilience action target 去重不再依赖 `reason` 文案，保留 reason 聚合展示 | channel-routing route resilience model/tests、route space | running |
| Protocol Bridge HTTP failure taxonomy | `019ed39d-e560-7ee2-b83b-b72d4dde0875` | 为 `SidecarHTTPExecutor` 增加 HTTP status / timeout / malformed response 分类契约和 tests | `internal/protocolbridge/**`、protocol bridge space | running |
| Quota Intelligence usage/status consumer | `019ed39d-e781-7b41-b57b-d07f319099d8` | 让 usage/status 相关可测试前端面实际消费 `QuotaFactEvidenceView`，而不只是 helper/计划 | accounts usage/status model/tests、quota space | running |
| Extension Contract preview gate hardening | `019ed39d-ecf1-75e3-b2c7-5887efc22484` | 去掉 Chrome-only 脆弱门禁，固化 extension registry read-only preview check 与产物引用 | extension registry check script、feature tests、extension space | running |

### 第十一轮边界

1. Route target identity 可以重构前端 view model，但不能改 Go bridge 或 sidecar action contract；`not_implemented` / failure 仍必须原样展示。
2. Protocol 只能补 executor failure taxonomy contract，不实现 MCP stdio server，不保存 runtime truth，不触碰 CLIProxyAPI reference。
3. Quota usage/status 只能消费 sidecar-owned `QuotaFactEvidenceView`，不能由 UI 从 window / blockReason 重新推导 quota authority。
4. Extension preview gate 只能增强 read-only page 验收，不做 enable/disable、runner、marketplace 或 Codex Skills/MCP 保存链路。

### 第十一轮主控验收

已接受：

1. Route Resilience stable target identity：route resilience action target 的 stable id 已从 `account/auth/model/source/scope/reason` 收敛为 `account/auth/model/source/scope`，reason 仅作为聚合展示与计数；action history 继续按 stable target 绑定，`not_implemented` / failure 不被成功化。
2. Protocol Bridge HTTP failure taxonomy：`SidecarHTTPExecutor` 已覆盖 HTTP non-2xx、transport/timeout、malformed JSON、sidecar rejected envelope 的 canonical 分类；adapter 将 typed error 投影为 canonical rejected envelope，并只暴露安全的 `sidecar_error_code`，不泄露 Authorization / Cookie / 明文 idempotency key。
3. Quota Intelligence usage/status consumer：Usage Desk 已实际消费 `QuotaFactEvidenceView`，通过 `resolveUsageDeskStatusEvidence()` 只读取显式 `quotaFact/quota_fact/fact`，不从 quota windows 或 `blockReason` 反推 authority；observed/projected 两路都接入现有 `UsageChartCard.status` 槽位。
4. Extension Contract preview gate hardening：`check-gettokens-extension-registry-preview.mjs` 已从 Chrome-only 字符串检查升级为 live Chrome / archived snapshot 双路径同语义检查，校验 workspace hash、read-only markers、root/diagnostic/capability/source markers、无 mutation binding / marketplace，并校验 README 对脚本、snapshot、screenshot 的引用一致性。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/accounts/tests/accountQuotaRuntime.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/usageDeskClaudeLocalSource.test.mjs frontend/src/features/accounts/tests/previewData.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs`
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Extension preview：`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`（当前本机 Chrome headless 仍失败，脚本走 archived Playwright snapshot/PNG fallback）
- Contract / docs / whitespace：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`、`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Route Resilience：reason 已不再影响 target identity，但 reason 聚合较长时 UI 仍可能截断；history 仍是前端会话内状态，尚未持久化或复用到 doctor/detail surface。
2. Protocol Bridge：failure taxonomy 仍基于 fake transport contract；真实 sidecar HTTP client、timeout/retry 策略、MCP stdio server 与 CLIProxyAPI endpoint 对接仍待后续。
3. Quota Intelligence：Usage Desk 只在 payload 显式携带 `quotaFact/fact` 时展示 evidence；如果运行时链路未下发该字段，UI 会按设计不显示，不会本地推导。
4. Extension Contract：preview gate 的 live Chrome 路径当前不可用，已验证 archived fallback 和 artifact 一致性；后续有可用 Chrome/Chromium 时应刷新同一路径产物。
5. 主控沉淀审计：本轮仍是五个 space 的 feature-local 推进，没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twelfth Dispatch

日期：2026-06-17

第十二轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮目标是把第十一轮留下的“可用但仍局部”的结果推进到可复用 surface / 合约层，仍然不进入真实 runner、marketplace 或本地推导 authority。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience account detail reuse | `019ed3ac-f20d-79a2-a490-abe001399992` | 将 stable route resilience target / reason aggregation 复用到账户详情运行态路由面，作为只读 operator evidence，不新增 action mutation | `frontend/src/features/accounts/model/accountPresentation.ts`、`frontend/src/features/accounts/components/AccountDetailSections.tsx`、相关 accounts tests、route space | accepted |
| Doctor Workbench route evidence normalization | `019ed3ac-f2fb-7662-a524-5f5cd12d4097` | Doctor 对 `route_guard_dropped_reasons` 证据增加结构化 route evidence view，复用 stable identity 语义，不拼装新 route truth | `frontend/src/features/doctor-workbench/model/**`、doctor tests、doctor space | accepted |
| Quota Intelligence status evidence boundary | `019ed3ac-f415-7851-8d39-4d7593b6763f` | 把 usage/status quota evidence 的“只信显式 quotaFact/fact”边界抽为更通用 helper / tests，避免后续 status 面回退到 windows/blockReason 推导 | `frontend/src/features/accounts/model/usageDesk.ts` 或邻近纯模型/tests、quota space | accepted |
| Extension Contract enable state plan | `019ed3ac-f522-7172-aa07-aa34dda6d912` | 定义 enable/disable state contract 与 read-only UI 提示，仍不写配置、不执行 capability、不接 marketplace | extension registry model/UI/tests、extension space schemas/plans | accepted |
| Protocol Bridge real HTTP client boundary | `019ed3ac-f604-77c3-b6b3-f08b42a79f9f` | 为真实 sidecar HTTP client 增加可注入 endpoint/auth/timeout 边界与 contract tests，但不实现 MCP stdio server 或保存 runtime truth | `internal/protocolbridge/**`、protocol bridge space | accepted |

### 第十二轮边界

1. Route / Doctor 只能复用 route decision / dropped reason 证据；不得把前端 evidence 当成 sidecar route truth，也不得新增 repair mutation。
2. Quota 只能信显式 `quotaFact/fact`；缺字段时按设计不显示 authority，不从 quota windows、blockReason 或 usage 数字反推。
3. Extension 只定义 enable state contract 与 read-only disabled affordance；不得写 Codex config、不得保存 enable/disable、不得执行 capability、不得引入 marketplace。
4. Protocol 可以推进真实 HTTP client 的构造边界和 fake server/transport tests；不得实现 MCP stdio server、不得落 audit persistence、不得保存 route / quota / model truth。
5. 每个 subagent 必须更新对应 space 的计划或 README，列明证据门禁、验收命令和剩余风险。

### 第十二轮主控验收

已接受：

1. Route Resilience account detail reuse：账户详情 `AccountRuntimeRouteSection` 的 recent route decisions 已复用 stable target identity + reason aggregation，展示只读 route resilience evidence；同一 `account/auth/model/source/scope` 下 reason 文案变化不会分裂 target，不调用 action mutation。
2. Doctor Workbench route evidence normalization：Doctor 对 `route_guard_dropped_reasons` / route 类 evidence 增加结构化 view，输出 stable target、reason summary、route blocking label；主控修正为必须具备 account/auth、model、source、scope 才结构化，partial identity 保守 fallback，不编造 route truth。
3. Quota Intelligence status evidence boundary：新增通用 `resolveQuotaStatusEvidenceFromPayload()`，Usage Desk 改为复用该 helper；只读取显式 `quotaFact` / `quota_fact` / `fact`，缺字段或仅有 windows / blockReason / usage totals 时不展示 authority evidence。
4. Extension Contract enable state plan：Extension Registry 增加 `enabled/disabled/blocked/pending/readonly-unsupported` 只读 enable-state 解释层和 action availability UI，仍只消费 snapshot，不写配置、不执行 capability、不接 marketplace。
5. Protocol Bridge real HTTP client boundary：新增 `NewSidecarHTTPTransport()` 真实 HTTP transport 构造边界，支持 loopback base URL 校验、timeout、bearer token 注入、redirect 禁止和 forbidden header 防线；`httptest` 覆盖 request contract 与第十一轮 failure taxonomy。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，251/251 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`、`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`（当前本机 Chrome headless 仍失败，脚本使用 archived Playwright snapshot / screenshot fallback）
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，解除全仓 `git diff --check` 阻塞。
2. 收窄 Doctor route evidence normalization：partial identity 不能生成 stable target；新增 `doctor route evidence falls back when route identity is only partial` 测试。

剩余风险：

1. Route Resilience：account detail evidence 只来自 recent decisions 的 `droppedReasons`，不持久化 action history，也不代表 sidecar route truth。
2. Doctor Workbench：route evidence normalization 只能消费现有扁平字段；上游若没有完整 `account/auth/model/source/scope`，页面会按设计 fallback。
3. Quota Intelligence：status helper 已抽出，但真实 status page 尚未接入；标题策略仍暂用 Usage Desk workspace。
4. Extension Contract：enable state 仍是 read-only 解释层；真实 enable/disable state storage、runner 和 Codex Skills/MCP 保存链路未实现。
5. Protocol Bridge：real HTTP client boundary 不证明真实 sidecar endpoint 已存在；retry、proxy、mTLS、profile-aware transport factory 仍是后续。
6. 主控沉淀审计：本轮继续是五个 space 内 feature-local 推进；除 memory 和 space 文档外，没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Thirteenth Dispatch

日期：2026-06-17

第十三轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮目标是把第十二轮的局部 surface 继续推向可复用合约与真实页面消费，但仍不引入热路径真源、不实现 runner 执行、不写 enable/disable 配置。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience evidence digest helper | `019ed3bb-2403-7570-aae9-fe769938ce76` | 把 account detail 当前 route resilience evidence 里的 stable id / reason aggregation 收敛成可复用 digest helper，避免后续 surface 回到 reason 文案 key | `frontend/src/features/channel-routing/model/channelRouting.ts`、`frontend/src/features/channel-routing/tests/channelRouting.test.mjs`、必要的 accounts model/tests、route space | accepted |
| Doctor Workbench structured route evidence UI | `019ed3bb-24b7-73f1-a9fd-a14eb9d7e240` | 将第十二轮 Doctor model 产出的 `targetKey/account/auth/model/scope/routeBlocking` 明确渲染到 Doctor UI，并补 source test | doctor feature/tests、doctor space | accepted |
| Quota Intelligence status page consumer | `019ed3bb-25b0-76d1-8b28-d1b17b30adca` | 让 Status 页实际消费 `resolveQuotaStatusEvidenceFromPayload()`，只展示显式 quota fact evidence，不从 windows/blockReason 推导 | status feature/model/tests、quota space | accepted |
| Extension Contract enable-state artifact gate | `019ed3bb-2775-71a0-85e0-e601617f2506` | 为 enable state v0 补 schema / examples / artifact validator 检查，仍不做 mutation 或 marketplace | extension schemas/examples/plans、contract validator、extension space | accepted |
| Protocol Bridge transport factory boundary | `019ed3bb-2892-7bf1-a8f3-d8f6e874932d` | 在 real HTTP transport 上层补 profile/authority-aware executor factory contract，仍不实现 MCP stdio server、不保存 runtime truth | `internal/protocolbridge/**`、protocol bridge space | accepted |

### 第十三轮边界

1. Route / Doctor 只能复用 route decision / dropped reason evidence；不得新增 repair mutation，不得把 UI digest 当 sidecar route truth。
2. Quota Status 页只能消费显式 `quotaFact` / `quota_fact` / `fact`；如果 Wails/status payload 没有该字段，UI 必须不展示 authority evidence，不能从 windows、blockReason、usage totals 推导。
3. Extension 只补 enable-state 合约 artifact 与 validator；不得写 enable/disable state，不读写 Codex config，不执行 capability，不引入 marketplace。
4. Protocol 只能补 executor factory / transport wiring boundary；不得实现 MCP stdio server，不落 audit persistence，不保存 route / quota / model truth。
5. 每个 subagent 必须更新对应 space 的计划或 README，列明证据门禁、验收命令和剩余风险。

### 第十三轮主控验收

已接受：

1. Route Resilience evidence digest helper：`buildRouteResilienceEvidenceDigests()` 已成为 stable route evidence 的共享入口，`buildRouteResilienceActionTargets()` 和账户详情只读 evidence 均复用同一 digest helper；stable id 继续基于 `account/auth/model/source/scope`，reason 只做聚合展示，不重新参与 key。
2. Doctor Workbench structured route evidence UI：Doctor 列表项在存在完整 `targetKey` 时明确渲染 route evidence 结构化字段，包含 target、account、auth、model、source/scope 和 blocking label；partial identity 仍沿用第十二轮 fallback，不编造 route truth。
3. Quota Intelligence status page consumer：Status 页在 sidecar ready 后读取 `GetAllQuotaStatuses()`，只通过 `resolveQuotaStatusEvidenceFromPayload(status, 'codex')` 投影显式 quota fact evidence；无 `quotaFact/quota_fact/fact` 时不展示 authority evidence，不从 windows、blockReason 或 usage totals 推导。
4. Extension Contract enable-state artifact gate：新增 enable-state v0 schema 与 valid example，并把 artifact validator 扩展到 41 项检查；schema 覆盖 `enabled/disabled/blocked/pending/readonly-unsupported` 和 read-only / disabled action availability，但仍只是合约 artifact，不写配置、不执行 capability。
5. Protocol Bridge transport factory boundary：新增 profile/authority-aware executor factory，复用 real HTTP transport 构造边界，在 executor 创建前做 sidecar authority precheck；token provider 只在 authorize 之后解析，bearer token 不进入 canonical body、audit 或 error。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，263/263 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`、`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`（当前本机 Chrome headless 仍失败，脚本使用 archived Playwright snapshot / screenshot fallback）

剩余风险：

1. Route Resilience：digest helper 仍消费 recent decisions 的 dropped reasons；它是 UI 证据摘要，不是 sidecar route truth，也不持久化 action history。
2. Doctor Workbench：结构化 UI 依赖完整 route identity；缺字段时按设计 fallback。
3. Quota Intelligence：Status 页只在 Wails payload 显式携带 quota fact 时展示 evidence；运行时未下发该字段时会保持空态。
4. Extension Contract：enable-state 仍停留在 schema/example/validator；真实 storage、enable/disable mutation、runner、Codex config 保存链路和 marketplace 均未实现。
5. Protocol Bridge：factory boundary 不等于真实 MCP stdio server 或完整 sidecar endpoint；retry、proxy、mTLS、profile resolver 和 audit persistence 仍待后续。
6. 主控沉淀审计：本轮继续是五个 space 内 feature-local 推进，复用既有 subagent supervision、quota explicit-fact、read-only extension artifact 和 protocol authority 门禁；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Fourteenth Dispatch

日期：2026-06-17

第十四轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮继续把已落地的 read-only evidence / contract surface 往可复用和可验证方向推进，但仍不引入未证明的热路径真源、不实现任意 runner、不写 enable/disable 配置。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience digest recency metadata | `019ed3c8-64ba-7f71-ab1e-df60edc95eed` | 在不改变 stable target id 的前提下，为 route evidence digest 增加 latest/first observed metadata，让 detail/Doctor 后续可区分最新证据 | `frontend/src/features/channel-routing/model/channelRouting.ts`、route tests、必要的 account presentation tests、route space | accepted |
| Doctor Workbench route digest reuse | `019ed3c8-6585-75f3-a2e1-78c1af95ed50` | 让 Doctor route evidence 复用 Route Resilience digest / stable identity 语义，避免 Doctor 自己维护一套易分叉的 target key 逻辑 | doctor feature/tests、必要的 route helper 导出、doctor space | accepted |
| Quota Intelligence Status evidence preview / empty-state | `019ed3c8-6697-72b2-8f1b-2a52ea6b7134` | 为 Status 页 quota evidence 补 doctored fixtures / tests，证明显式 quota fact 才展示 authority，windows/blockReason/usage totals 不触发本地推导 | status feature/tests、quota evidence helper/tests、quota space | accepted |
| Extension Contract enable-state schema validation gate | `019ed3c8-678b-7af0-875d-d3a8b79a64b6` | 将 enable-state artifact validator 从解析+语义断言推进到 schema-level 校验，覆盖 invalid fixture / required fields / enum drift | extension schemas/examples/plans、contract validator、extension space | accepted |
| Protocol Bridge MCP stdio transport preflight | `019ed3c8-6899-7a91-9b58-6093db531e8d` | 增加 stdio transport contract/preflight 层或测试，验证只允许 mapping fixture 内 tool/resource、先 authorize 后 executor、拒绝 credential-bearing input | `internal/protocolbridge/**`、protocol bridge plans/README、必要的 artifact validator | accepted |

### 第十四轮边界

1. Route / Doctor 只能复用 route decision / dropped reason evidence；不得新增 repair mutation，不得把 UI digest 或 Doctor evidence 当 sidecar route truth。
2. Quota Status 只能消费显式 `quotaFact` / `quota_fact` / `fact`；缺字段时必须空态或 non-authoritative，不得从 windows、blockReason、usage totals 推导。
3. Extension 只增强 enable-state artifact validation；不得写 enable/disable state，不读写 Codex config，不执行 capability，不引入 marketplace。
4. Protocol 只推进 MCP stdio preflight / contract；不得实现完整 MCP stdio server，不接真实 sidecar runtime endpoint，不落 audit persistence，不保存 route / quota / model truth。
5. 每个 subagent 必须更新对应 space 的计划或 README，列明证据门禁、验收命令和剩余风险；主控最终统一跑聚合验证和沉淀审计。

### 第十四轮主控验收

已接受：

1. Route Resilience digest recency metadata：`RouteResilienceEvidenceDigest` 在保持 `account/auth/model/source/scope` stable id 不变的前提下，新增 `firstObservedDecisionID` / `firstObservedAt` / `lastObservedDecisionID` / `lastObservedAt`；兼容字段 `decisionID` / `recordedAt` 收敛为最新证据 metadata，reason 文案变化仍不分裂 target。
2. Doctor Workbench route digest reuse：Doctor route evidence 通过窄 adapter 复用 `buildRouteResilienceEvidenceDigestsFromDroppedReasons()`，target identity 与 route/account detail 对齐；partial identity 继续 fallback，不从 Doctor 文本编造 route truth。
3. Quota Intelligence Status evidence preview / empty-state：新增 `buildStatusQuotaEvidenceSectionState()`，显式 `quotaFact/quota_fact/fact` 才渲染 authoritative cards；仅有 windows、blockReason、usage totals 时渲染 `NON-AUTHORITATIVE` 空态说明，不做本地 authority 推导。
4. Extension Contract enable-state schema validation gate：`check-omniroute-contract-artifacts.mjs` 增加轻量 schema validation runner；valid enable-state example 必须过 schema，invalid enum / actionAvailability / missing required fixtures 必须被拒绝。
5. Protocol Bridge MCP stdio transport preflight：新增 `MCPStdioPreflight` 和 adapter 接线；tool 路径保持 authorize 后、executor 前 preflight，resource 只允许 mapping fixture 内 URI，credential-bearing input 被 canonical reject，response/audit 不回显 token/header/cookie。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，267/267 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，49 checks；`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`（当前本机 Chrome headless 仍失败，脚本使用 archived Playwright snapshot / screenshot fallback）
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，解除全仓 `git diff --check` 阻塞。
2. 复核 Route / Doctor 同改 `channelRouting.ts` 后的共享 helper 最终形态，确认没有恢复 reason 文案 key，也没有新增 mutation 或 sidecar truth。

剩余风险：

1. Route Resilience：recency metadata 依赖 `recordedAt` 可比较字符串；若上游未来给非 ISO 风格时间，first/latest 边界需要显式 parser。
2. Doctor Workbench：仍从 `label/refID/summary` 解析 route 字段后再交给共享 helper；后续 sidecar 若提供 typed route evidence，应直接切 typed input。
3. Quota Intelligence：non-authoritative 提示当前是 section 级别；混合 payload 中有 authoritative item 时，不逐条提示无 fact 的账号。
4. Extension Contract：轻量 schema runner 只覆盖当前 schema 子集，不是完整 Draft 2020-12 引擎；manifest 主 schema 仍主要靠解析/语义断言。
5. Protocol Bridge：preflight 是 stdio contract，不覆盖真实 stdio server lifecycle、session/client binding 或真实 sidecar endpoint 存在性。
6. 主控沉淀审计：本轮继续是五个 space 内 feature-local 推进，已写入各 space plan / README 和 memory；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Fifteenth Dispatch

日期：2026-06-17

第十五轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮针对第十四轮剩余风险继续收窄 read-only evidence / contract gate，不引入真实 mutation、runner、marketplace、sidecar endpoint 或 bridge truth storage。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience account detail recency surface | `019ed3d4-e89c-76b1-b08b-ec5bc125a429` | 在账户详情运行态路由 evidence 中展示 digest latest/first observed metadata，不新增 action mutation | account detail components/model/tests、route space | accepted |
| Doctor Workbench structured route evidence DOM gate | `019ed3d4-e961-7102-9faa-e03d6dae356b` | 增强 Doctor preview / DOM 验收，验证 structured route block markers、partial fallback、无 mutation handler | doctor feature/tests、doctor preview script/artifacts、doctor space | accepted |
| Quota Intelligence mixed payload non-authoritative hints | `019ed3d4-eb33-75d1-8808-923e8fc5751c` | 混合 payload 下仍提示哪些账号缺显式 quota fact，保持不从 windows/blockReason/usage totals 推导 authority | status quota evidence model/components/tests、quota space | accepted |
| Extension Contract manifest schema validation gate | `019ed3d4-eceb-76a3-8af0-3701ce5b02f7` | 将 manifest v0 valid/invalid examples 纳入 schema-level validator，证明未知 capability / 禁用权限 / 缺字段会失败 | extension schemas/examples/plans、contract validator、extension space | accepted |
| Protocol Bridge stdio query schema allowlist | `019ed3d4-ede6-7681-b20f-dce1f331aaed` | 让 MCP stdio preflight 基于 mapping/canonical query schema 拒绝 schema 外 query key，继续 authorize-before-executor | `internal/protocolbridge/**`、protocol README/plans | accepted |

### 第十五轮边界

1. Route 只展示已有 digest recency metadata；不得新增 repair mutation，不得把 UI evidence 当 sidecar route truth。
2. Doctor 只增强结构化 route evidence 的浏览器/DOM 验收；不得新增 doctor repair action，不得伪造 route/quota authority。
3. Quota 只增强 Status section 的 mixed payload 提示；显式 fact 仍是唯一 authority 来源，windows/blockReason/usage totals 只能作为 non-authoritative。
4. Extension 只增强 manifest artifact validation；不得写 enable/disable state，不读写 Codex config，不执行 capability，不引入 marketplace。
5. Protocol 只增强 stdio query preflight；不得实现真实 MCP stdio server，不接真实 sidecar runtime endpoint，不落 audit persistence，不保存 route / quota / model truth。
6. 每个 subagent 必须更新对应 space README 或 plan，并列明验证命令与剩余风险；主控最终统一跑聚合验证和沉淀审计。

### 第十五轮主控验收

已接受：

1. Route Resilience account detail recency surface：账户详情 `Route Resilience Evidence` 现在展示 `Latest Evidence`、`First Seen`、`Last Seen`，字段来自第十四轮共享 digest recency metadata；同一 stable target 跨多个 decision / reason 文案变化时仍复用同一个 digest。
2. Doctor Workbench structured route evidence DOM gate：Doctor preview gate 增强到校验 target/account/auth/model/scope/blocking markers、partial identity fallback、read-only mode、无 repair/mutation handler，并归档 round15 snapshot / screenshot。
3. Quota Intelligence mixed payload non-authoritative hints：Status quota evidence section 在 mixed payload 中保留 authoritative fact cards，同时列出缺显式 quota fact 的账号；无 `quotaFact/quota_fact/fact` 时仍只展示 non-authoritative 提示，不从 windows/blockReason/usage totals 推导 authority。
4. Extension Contract manifest schema validation gate：contract artifact validator 对 manifest valid example 执行 schema-level validation，并新增 invalid forbidden permission / missing required fixtures；主 manifest schema gate 与 enable-state schema gate 同时纳入 validator。
5. Protocol Bridge stdio query schema allowlist：MCP stdio preflight 基于 mapping `query_schema_ref` 的 canonical query key allowlist 拒绝 schema 外 top-level query key，继续保持 `Runtime.Authorize -> preflight -> executor`，不实现真实 stdio server。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，270/270 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，54 checks；`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`node docs-linhay/scripts/check-doctor-workbench-preview.mjs`（当前本机 Chrome headless 仍失败，两个 preview gate 均使用 archived Playwright snapshot / screenshot fallback）
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，解除全仓 `git diff --check` 阻塞。
2. 复核 Doctor 新截图命名，确认 `screenshots/20260617/workbench/20260617-doctor-workbench-baseline-v01.png` 通过 docs check。

剩余风险：

1. Route Resilience：同一 stable target 在多条 decision 卡片下会重复展示相同 latest/first/last metadata；后续若要降密度，可做 digest 级去重展示。
2. Doctor Workbench：live Chrome preview 分支仍未在本机跑通，本轮验证走 archived fallback；该证据不替代真实 Wails 桌面壳层验收。
3. Quota Intelligence：缺失账号提示只能列出带 `accountKey` 的 payload；无 account key 的 payload 只能保留 section 级 non-authoritative 提示。
4. Extension Contract：本地 schema runner 仍是项目内轻量实现，只覆盖当前 manifest / enable-state schema 关键特性。
5. Protocol Bridge：query allowlist 只校验 top-level query key，不做完整 JSON Schema 类型和 required 校验；真实 stdio server、sidecar endpoint、audit persistence 仍待后续。
6. 主控沉淀审计：本轮仍是五个 space 内 feature-local 推进，已写入各 space plan / README 和 memory；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Sixteenth Dispatch

日期：2026-06-17

第十六轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮针对第十五轮剩余风险继续收窄 UI density、typed evidence、non-authoritative quota hints、extension artifact validation 和 protocol preflight，不进入真实 mutation、runner、marketplace、sidecar endpoint 或 bridge truth storage。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience account detail digest-level dedupe | `019ed3e2-7450-7d42-a7b1-a29e911dd0b3` -> replacement `019ed409-10fa-7c02-8d0c-b53668a2f6fc` | 在账户详情中避免同一 stable target 的 latest/first/last metadata 重复展示，同时保留 decision 追溯 | account detail model/components/tests、route space | accepted |
| Doctor Workbench typed route evidence adapter | `019ed3e2-7553-7a63-bb78-4eb2069c82af` | 支持 DoctorEvidenceRef 的可选 typed route evidence 输入，优先走 shared digest helper，文本解析保持 fallback | doctor model/tests、doctor space | accepted |
| Quota Intelligence unknown-account missing fact count | `019ed3e2-76f7-7041-aeff-53dbdd53070e` | Status mixed payload 中对无 accountKey 且缺显式 fact 的 payload 计数提示，不推导 authority | status quota evidence model/components/tests、quota space | accepted |
| Extension Contract manifest negative schema coverage | `019ed3e2-7876-7ac3-bf10-71eea603289a` | 为 manifest schema gate 增加 additionalProperties / invalid source / missing required source 等负例覆盖 | extension examples/plans/validator、extension space | accepted |
| Protocol Bridge stdio query type / required preflight | `019ed3e2-7992-7ca3-b5d9-03847a29d8a6` | 在 stdio preflight 中增加当前 canonical query schema 的最小 type / required validation，继续 executor 前拒绝 | `internal/protocolbridge/**`、protocol README/plans | accepted |

### 第十六轮边界

1. Route 只降低 account detail evidence 重复密度；不得新增 repair mutation，不得把 UI evidence 当 sidecar route truth。
2. Doctor 只增加 typed route evidence 的只读消费入口；文本 fallback 与 partial identity fallback 必须保留，不得新增 repair action。
3. Quota 只增强 unknown/unscoped missing fact 提示；显式 fact 仍是唯一 authority 来源。
4. Extension 只增强 manifest artifact validation；不得写 enable/disable state，不读写 Codex config，不执行 capability，不引入 marketplace。
5. Protocol 只增强 stdio query preflight 的类型/必填检查；不得实现真实 MCP stdio server，不接真实 sidecar runtime endpoint，不落 audit persistence。
6. 每个 subagent 必须更新对应 space README 或 plan，并列明验证命令与剩余风险；主控最终统一跑聚合验证和沉淀审计。

### 第十六轮主控验收

已接受：

1. Route Resilience account detail digest-level dedupe：原 Route agent `019ed3e2-7450-7d42-a7b1-a29e911dd0b3` 因 502 中断；replacement `019ed409-10fa-7c02-8d0c-b53668a2f6fc` 复核并收敛其半成品。账户详情对同一 stable target digest 改为首次完整展示、后续 reference 展示；reference 卡保留 current decision、shared digest coverage、blocking/observe 计数与 `matchedRouteBlocking`，不静默丢失 per-decision explainability。
2. Doctor Workbench typed route evidence adapter：Doctor evidence 现在优先消费可选 typed route fields / nested `routeEvidence` payload，并继续保留文本解析 fallback；partial typed identity 仍只进入 fallback，不作为 route truth。
3. Quota Intelligence unknown-account missing fact count：Status quota evidence section 在 mixed payload 中继续只信显式 `quotaFact/quota_fact/fact`，并新增无 `accountKey` payload 的 unscoped missing fact count UI，不从 windows、blockReason 或 usage totals 推导 authority。
4. Extension Contract manifest negative schema coverage：manifest artifact validator 新增 unknown top-level field、invalid `source.type`、capability missing required `source` 三类负例，artifact gate 扩展到 57 checks；仍只校验 artifact，不读写配置、不执行 capability。
5. Protocol Bridge stdio query type / required preflight：MCP stdio preflight 基于当前 canonical query schema 增加最小 `required` 与 `boolean/string/array[string]` 类型校验；`routesDiagnosticsInput` 缺 `protocol/model` 或类型错误会在 executor 前以 `invalid_request` 拒绝，authorize-before-preflight 顺序保持不变。

已通过：

- Protocol / Extension core：`go test -count=1 ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，276/276 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，57 checks；`node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`node docs-linhay/scripts/check-doctor-workbench-preview.mjs`（当前本机 Chrome headless 仍失败，两个 preview gate 均使用 archived Playwright snapshot / screenshot fallback）
- Docs / whitespace：`docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，解除全仓 `git diff --check` 阻塞。
2. 复核 Route replacement 输出，确认 digest-level dedupe 只在 account detail presentation 层生效，不修改 shared digest truth、不新增 route repair mutation。

剩余风险：

1. Route Resilience：`matchedRouteBlocking` 已保留当前 decision 状态，但同一 decision 内多条 dropped reason 的 blocking/observe 明细尚未细分到每条 reason。
2. Doctor Workbench：live Wails/Go `DoctorEvidenceRef` 仍只映射基础字段；runtime typed payload 需要后续 backend DTO/mapper 切片。
3. Quota Intelligence：无 `accountKey` payload 只能计数，不能精确定位具体账号。
4. Extension Contract：本地 schema runner 仍非完整 Draft 2020-12 引擎，`if/then` 内部更复杂约束仍待后续增强。
5. Protocol Bridge：query preflight 只覆盖当前 canonical schema 的最小类型/必填，不是完整 JSON Schema；真实 MCP stdio server、sidecar endpoint 与 audit persistence 仍未实现。
6. 主控沉淀审计：本轮仍是五个 space 内 feature-local 推进，已写入各 space plan / README 和 memory；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Seventeenth Dispatch

日期：2026-06-17

第十七轮继续只推进五个 OmniRoute space。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮沿第十六轮剩余风险继续补可解释性和 contract gate，不进入真实 runner、marketplace、sidecar truth storage、正式 App 或任意未授权 mutation。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience per-reason blocking detail | `019ed510-8fa7-7fb1-a5ec-c02ffa8015da` | 在 account detail digest dedupe 的基础上，保留同一 decision 内每条 dropped reason 的 blocking/observe 明细，不改变 stable digest truth | account detail model/components/tests、route space | accepted |
| Doctor Workbench Wails typed route DTO passthrough | `019ed510-9022-7ba0-ab4d-015b0dee198a` | 将 Doctor typed route evidence 从前端 adapter 推进到 Wails/root DTO 与 aggregate mapper 只读透传，保持 text fallback | `internal/wailsapp/doctor*`、`internal/wailsapp/types.go`、root DTO/mappers/tests、doctor frontend binding/source tests、doctor space | accepted |
| Quota Intelligence unscoped payload trace labels | `019ed510-90a7-7ad2-b38d-d5db04722ade` | 为无 accountKey 且缺显式 fact 的 status payload 增加只读 trace label / sample labels，仍不推导账号或 authority | status quota evidence model/components/tests、quota space | accepted |
| Extension Contract conditional source schema gate | `019ed510-912d-7ed2-8358-f3c4a8816518` | 增强 manifest artifact validator，让 `declared-endpoint` 必须带 endpoint、`static-json` 必须带 path 的负例被拒绝 | extension schemas/examples/plans、contract validator、extension space | accepted |
| Protocol Bridge stdio enum preflight | `019ed510-91bb-7700-8876-ddb5fb22ca61` | 在 stdio preflight 的最小 query contract 中增加当前 canonical query 的 enum 校验，例如 protocol / probe_mode / detail_level | `internal/protocolbridge/**`、protocol README/plans | accepted |

### 第十七轮边界

1. Route 只增强 account detail presentation explainability；不得改 sidecar digest truth，不新增 repair mutation，不回退到 reason 文案级 target key。
2. Doctor 只做 Wails/root DTO 与只读 mapper 透传 typed route evidence；不得新增 repair action，不伪造 route/quota authority，不触碰正式版 App。
3. Quota 只给 unscoped missing fact payload 增加可读 trace/sample label；显式 fact 仍是唯一 authority 来源，不得从 windows/blockReason/usage totals 推导账号或 quota truth。
4. Extension 只增强 schema/example/artifact validator；不得写 enable/disable state，不读写 Codex config，不执行 capability，不引入 marketplace。
5. Protocol 只增强 stdio preflight 的当前 canonical enum gate；不得实现真实 MCP stdio server，不接真实 sidecar runtime endpoint，不落 audit persistence。
6. 每个 subagent 必须先补/更新测试，再最小实现，并更新对应 space README 或 plan，列明验证命令与剩余风险；主控最终统一跑聚合验证和沉淀审计。

### 第十七轮主控验收

已接受：

1. Route Resilience per-reason blocking detail：account detail route resilience evidence 新增 `matchedReasonDetails`，同一 decision / 同一 stable digest 下的每条 dropped reason 都保留 `BLOCKING` / `OBSERVE` 明细；stable digest id 仍由 `account/auth/model/source/scope` 组成，不包含 reason 文案，不改变 sidecar truth。
2. Doctor Workbench Wails typed route DTO passthrough：`DoctorEvidenceRef` 在 Wails/root DTO 中透传 `accountKey/accountID/authId/model/scope/reason/routeBlocking/routeEvidence`；aggregate `doctorRouteDecisionCheck` 从 dropped reasons 填 nested typed payload，root mapper 保留字段，前端继续只读消费。
3. Quota Intelligence unscoped payload trace labels：Status quota evidence notice 新增 `unscopedMissingFactSamples`，只用 payload index 与 `source/status/updatedAt/provider` 生成最多 5 条 non-authoritative trace label；不从 windows、blockReason、usageTotals 推导账号或 quota authority。
4. Extension Contract conditional source schema gate：contract artifact validator 增加 declared-endpoint missing endpoint、static-json missing path 两个 invalid fixtures，并增强本地 schema runner 对 `if/then` object keywords 的最小支持；artifact gate 扩展到 59 checks。
5. Protocol Bridge stdio enum preflight：MCP stdio preflight 在 type/required 基础上增加手写 enum allowlist，覆盖当前 canonical query 的 `protocol`、`detail_level`、`probe_mode`、`kinds[]`；非法 enum 在 executor 前以 canonical `invalid_request` 拒绝，authorize-before-preflight 顺序保持不变。

已通过：

- Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/protocolbridge ./internal/gettokensextensions`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，279/279 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 对本轮 Go 文件执行 `gofmt`，覆盖 Doctor DTO/mapper/tests 与 Protocol preflight/tests。
2. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，恢复全仓 `git diff --check`。
3. 常规 preview gate 直接调用本机 Chrome 时无输出卡住；主控中断后通过设置 `CHROME_EXECUTABLE_PATH=/nonexistent/chrome` 强制走脚本内 archived snapshot / screenshot fallback，并保留该风险说明。

剩余风险：

1. Route Resilience：per-reason 明细目前只落 account detail presentation，Doctor 等其它只读 surface 还未复用。
2. Doctor Workbench：typed route evidence 已打通 Wails/root aggregate path，但真实 sidecar `doctor-diagnostics` typed payload 的更完整字段仍取决于后续 sidecar 输出。
3. Quota Intelligence：unscoped payload trace label 只能帮助定位 payload 来源，不能定位具体账号。
4. Extension Contract：本地 schema runner 仍不是完整 Draft 2020-12 引擎，只补当前 conditional source gate 所需最小能力。
5. Protocol Bridge：enum 集合仍是手写 contract；后续 schema 新增 enum 时需要同步更新或引入受控 schema 编译步骤；真实 MCP stdio server、sidecar endpoint、audit persistence 仍未实现。
6. 主控沉淀审计：本轮继续是五个 space 内 feature-local 推进，已写入各 space plan / README 和 memory；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Eighteenth Dispatch

日期：2026-06-17

第十八轮开始补真实上下游 tracer-bullet。主控只负责编排、边界、审核、验证和文档写回；实现由 bounded subagent 完成。本轮不再继续做纯展示层增量，而是每个 OmniRoute space 选一个最窄真实链路证明：route action 能触发 sidecar-owned 状态变化、Doctor 能从 sidecar diagnostics 进入 Wails/root、Protocol 有最小 stdio server 入口、Quota 在 sidecar runtime 输出显式 fact、Extension 有本地 enable-state 存储闭环。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience routeability repair hook tracer | `019ed549-a268-7a41-a513-86194470ce0d` | 将 `recheck_routeability` 从 `not_implemented` 推进到一个真实 sidecar-owned tracer action：对目标账号/模型执行受限 routeability recheck 或产生可审计的 applied/dry-run 状态变化 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions*`、必要的 route action tests、route space | accepted |
| Doctor Workbench sidecar diagnostics client chain | `019ed549-a3cd-78e3-9f22-4fbde49cc8e1` | 将真实 sidecar `/v0/management/gettokens/doctor-diagnostics` typed payload 接入 GetTokens `internal/cliproxyapi` client 与 Wails/root doctor aggregate 链路 | `internal/cliproxyapi/**`、`internal/wailsapp/doctor*`、root DTO/mappers/tests、doctor space | accepted |
| Quota Intelligence sidecar explicit fact stability | `019ed549-a4d6-71a3-8174-d6787bdd172d` | 在 CLIProxyAPI quota runtime/status/doctor 侧证明有 runtime fact 时必须输出显式 `quotaFact`，防止下游只能看到 windows/blockReason/usage totals | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/quota_runtime*`、doctor diagnostics tests、quota space | accepted |
| Extension Contract enable-state storage tracer | `019ed549-a6e9-72e1-92f1-b32ce42e5e27` | 在 core registry 中实现本地 enable-state 文件读写/merge tracer，证明 enable/disable 状态可持久化但不执行 capability、不改 Codex config | `internal/gettokensextensions/**`、extension tests、extension space | accepted |
| Protocol Bridge minimal MCP stdio server | `019ed549-a820-7ea3-b9c0-5e6d923388a5` | 在现有 adapter/preflight/executor 基础上实现最小 in-process JSON-RPC stdio server 入口，覆盖 `tools/call` / `resources/read` tracer，不接真实外部进程 | `internal/protocolbridge/**`、protocol tests、protocol space | accepted |

### 第十八轮主控验收

已接受：

1. Route Resilience routeability repair hook tracer：CLIProxyAPI reference `recheck_routeability` 从纯 `not_implemented` 变为 sidecar-owned tracer action；要求 `accountKey` 或 `authId`，支持 `dry_run` / `applied`，返回 `before/after`、`droppedReasons`、`tracerOnly=true`、`reconcileRuns=0`，非 dry-run 生成 `auditId`。`rerun_bounded_reconcile` 继续保持 `not_implemented`。
2. Doctor Workbench sidecar diagnostics client chain：GetTokens `internal/cliproxyapi` 增加真实 `/v0/management/gettokens/doctor-diagnostics` client decode，Wails/root Doctor aggregate 优先消费 sidecar typed route / quota evidence；`404/501` 或不可用时保留既有 `wails-aggregate` fallback。
3. Quota Intelligence sidecar explicit fact stability：CLIProxyAPI `QuotaRuntimeState` JSON 在 legacy `fact` 外新增 `quotaFact`；有 runtime fact 时 status/doctor 输出显式 fact，缺 fact 的 raw state 不再从 windows、blockReason、usage totals 旁路推导 authority。
4. Extension Contract enable-state storage tracer：`internal/gettokensextensions` 新增本地 enable-state JSON 读写/规范化/merge；registry snapshot 可合并 manifest 与 enabled/disabled state，但不读写用户 Codex config、不执行 capability、不接 marketplace。
5. Protocol Bridge minimal MCP stdio server：`internal/protocolbridge` 新增 in-process JSON-RPC stdio handler；`tools/call` 进入现有 `MCPAdapter.HandleTool` 并保持 authorize -> stdio preflight -> executor，`resources/read` 只允许 mapping fixture 内 URI，错误响应不回显 token/header/cookie。

已通过：

- Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI reference：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend focused：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/accounts/tests/usageDesk.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/src/utils/pagePersistence.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`，279/279 通过。
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 删除错位插入的第十八轮 dispatch 段落，并将第十八轮验收段落收敛到第十七轮后，恢复 dispatch 文档时间顺序。
2. 清理 `frontend/wailsjs/go/models.ts` 生成物 trailing whitespace / EOF blank line，恢复全仓 `git diff --check`。

剩余风险：

1. Route Resilience：`recheck_routeability` 目前是 sidecar-owned tracer，不执行真实 bounded reconcile；action history 仍未持久化。
2. Doctor Workbench：sidecar diagnostics client/Wails/root 链路已打通，但真实 dev App 桌面壳层尚未在本轮启动验收。
3. Quota Intelligence：上游显式 fact 输出稳定性已增强，下游仍必须坚持只信显式 fact，不得恢复本地推导。
4. Extension Contract：enable-state 仅在 core registry 层持久化；UI mutation、Codex config 保存、capability runner 和 marketplace 仍未实现。
5. Protocol Bridge：stdio handler 仍是 in-process JSON-RPC tracer；尚未做外部进程 lifecycle、audit persistence 或真实 sidecar endpoint 运行验收。
6. 发布准备：第十八轮通过自动化门禁，但正式发布还需要完整 release preflight、版本号确认、提交、tag、CI 和官方 DMG 验收。
7. 主控沉淀审计：本轮形成的是真实上下游 tracer-bullet 分项，仍落在五个 OmniRoute space 内；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Nineteenth Dispatch

日期：2026-06-17

第十九轮按用户要求采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终集成审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是把第十八轮 tracer-bullet 往产品化缺口推进：route action history / bounded reconcile 边界、doctor diagnostics 字段完整度、quota fact 兼容解码、extension enable/disable UI、本地 stdio lifecycle/audit 骨架。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience sidecar action history and bounded reconcile boundary | `019ed562-8c16-71a2-bed8-387fec1c65b1` | 在 CLIProxyAPI reference 内补 sidecar-owned action history 查询/记录，并把 `rerun_bounded_reconcile` 从纯未实现推进到受限、可审计、不会无限运行的 bounded tracer boundary | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions*`、route space | accepted |
| Doctor Workbench sidecar diagnostics field completeness | `019ed562-8d4b-7613-9366-539b3cca9d7e` | 在 CLIProxyAPI `doctor-diagnostics` 输出中补完整 typed route dropped reason / quota fact evidence 字段，保证 main side 不需要文本解析补真相 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/doctor_diagnostics*`、doctor space | accepted |
| Quota Intelligence main quotaFact compatibility chain | `019ed562-8e11-7c53-bf14-9122e02b49d2` | GetTokens main side 对 sidecar `quotaFact` camelCase 与 legacy `fact` 都能 decode 并透传到 Wails/status consumers，缺 fact 时继续 non-authoritative | `internal/cliproxyapi/**`、`internal/wailsapp/quota*`、status/quota tests、quota space | accepted |
| Extension Contract enable/disable UI and Wails state mutation | `019ed562-8f7b-7d21-934b-a84cc0c5f1be` | 在 GetTokens extension registry 工作台接入本地 enable-state mutation：Wails/root 读写 state file，前端提供 enable/disable 操作；不写 Codex config、不执行 capability | `internal/gettokensextensions/**`、`internal/wailsapp/gettokens_extensions*`、root DTO/mappers、extension frontend/tests、extension space | accepted |
| Protocol Bridge stdio lifecycle and audit persistence skeleton | `019ed562-907b-7033-812d-46690dde5ad2` | 在 protocol bridge 内补 in-process/exec stdio lifecycle wrapper 与 injectable audit persistence，证明 request lifecycle、shutdown 和 audit write 受控；不启动真实外部 sidecar | `internal/protocolbridge/**`、protocol space | accepted |

### 第十九轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Route 可以补 bounded reconcile boundary，但必须受限、可 dry-run、可审计，不得做无限循环、全局重试或调用未证明外部服务。
3. Doctor 只增强 sidecar diagnostics 输出字段，不新增 repair mutation，不伪造 route/quota authority。
4. Quota 只增强 main side 显式 fact decode/透传兼容，不恢复从 windows/blockReason/usage totals 推导 authority。
5. Extension 可以写本地 enable-state 文件并提供 UI 操作，但不得读写用户 Codex config、不得执行 capability、不得接 marketplace。
6. Protocol 可以实现 lifecycle/audit skeleton，但不得启动真实外部进程作为验收依赖，不接真实 sidecar endpoint，不持久化 route/quota/model truth。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第十九轮主控验收

已接受：

1. Route Resilience sidecar action history and bounded reconcile boundary：CLIProxyAPI reference 新增 sidecar-owned action history store 与 `GET /v0/management/gettokens/route-resilience/actions/history`；`clear_transient_lockout`、`recheck_routeability`、`rerun_bounded_reconcile` 都写入 history。`rerun_bounded_reconcile` 不再纯 501，而是 bounded tracer boundary：要求目标、支持 dry-run、非 dry-run 写 audit/history、`reconcileRuns=1`，不循环、不调用外部服务、不清 store block。
2. Doctor Workbench sidecar diagnostics field completeness：CLIProxyAPI `doctor-diagnostics` route evidence 输出顶层 `accountId` 和 nested `droppedReason` typed DTO，覆盖 `accountKey/accountId/authId/source/scope/reason/model/expiresAt/updatedAt/routeBlocking`；quota evidence 深拷贝并脱敏 typed `quotaFact`，缺 fact 时保持 `not_ready`。
3. Quota Intelligence main quotaFact compatibility chain：GetTokens main side `QuotaRuntimeState` decode 支持 `quotaFact`、`quota_fact`、legacy `fact`，并兼容 `observedAt/evidenceRefs` 与 snake case；Wails/status consumer 继续只认 explicit fact，缺 fact 时 non-authoritative。
4. Extension Contract enable/disable UI and Wails state mutation：core/Wails/root/frontend 接入 `SetGetTokensExtensionEnabled`，snapshot 默认读取 GetTokens app-local `extension-enable-state.json`，registry UI 提供 local-only enable/disable 操作；不写 Codex config、不执行 capability、不接 marketplace。
5. Protocol Bridge stdio lifecycle and audit persistence skeleton：新增 `MCPStdioLifecycleWrapper` 与 injectable audit persistence skeleton；`Serve` / `Shutdown` / context cancel 受控，successful tool call、preflight rejection、resource rejection 都有 audit write 尝试，且不持久化 token/header/cookie/raw query/raw URI。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，903/903 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused correction check：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 更新 Extension preview gate，把旧的 `noMutationBindings` 改成允许 `SetGetTokensExtensionEnabled` 的 local enable-state mutation，同时继续禁止 Codex config save、capability runner 和 marketplace。
2. 收敛 extension README 的历史只读描述，明确 Round 19 后 registry UI 可写 GetTokens app-local state file，但仍不读写 Codex config、不执行 capability。
3. 清理 `frontend/wailsjs/go/models.ts`、`frontend/wailsjs/go/main/App.d.ts`、`frontend/wailsjs/go/main/App.js` 生成物 trailing whitespace / EOF blank line。

剩余风险：

1. Route Resilience：bounded reconcile 仍是 tracer boundary，不是真实外部 repair service；action history 是 sidecar 内存/管理层历史，还不是长期持久化 ledger。
2. Doctor Workbench：sidecar diagnostics 字段完整度已增强，但真实 dev App 桌面壳层未在本轮启动验收。
3. Quota Intelligence：main side casing 兼容已补；下游仍必须保持 explicit fact-only authority，不得恢复本地推导。
4. Extension Contract：local enable/disable 只写 GetTokens app-local state file；Codex config save、capability runner、marketplace 仍未实现。
5. Protocol Bridge：lifecycle/audit 是 skeleton；真实外部 stdio process、sidecar runner 和 durable audit persistence 仍待后续切片。
6. 主控沉淀审计：本轮是五个 OmniRoute space 内产品化切片，复用既有 subagent supervision、sidecar authority、explicit-fact、app-local extension state、protocol preflight/lifecycle 边界；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twentieth Dispatch

日期：2026-06-17

第二十轮继续采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是补第十九轮留下的真实通路缺口：route action ledger 持久化、doctor typed evidence 下游消费、quota explicit-fact 反回归门禁、extension config apply dry-run 边界、protocol 外部 stdio / audit persistence。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience durable action ledger | `019ed562-8c16-71a2-bed8-387fec1c65b1` | 在 CLIProxyAPI reference 内把 route action history 从内存推进到 sidecar-owned durable JSONL/file ledger，并保持 bounded reconcile 不做真实外部 repair | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions*`、route space | accepted |
| Doctor Workbench typed diagnostics consumer | `019ed5ff-2abf-7a22-b754-b19601f3ac10` | 在 GetTokens main/frontend doctor workbench 消费第十九轮 sidecar nested `droppedReason` / `quotaFact` typed evidence，避免文本解析补真相 | `internal/cliproxyapi/*doctor*`、`internal/wailsapp/doctor*`、doctor frontend/tests、doctor space | accepted |
| Quota Intelligence explicit fact anti-regression | `019ed562-8e11-7c53-bf14-9122e02b49d2` | 强化 status / account / doctor 相关 quota consumer 的 explicit-fact-only 门禁，证明缺 fact 时不从 windows/blockReason/usage totals 推导 authority | quota frontend model/tests、quota/status space | accepted |
| Extension Contract config apply dry-run boundary | `019ed5ff-2b5b-79d2-a487-32c0890e602d` | 在 local enable-state 基础上补 Codex config apply dry-run / diff preview 边界；本轮不得写真实 `~/.codex/config.toml`、不得执行 capability、不得接 marketplace | `internal/gettokensextensions/**`、Wails/root extension DTO、extension frontend/tests、extension space | accepted |
| Protocol Bridge external stdio and durable audit | `019ed562-907b-7033-812d-46690dde5ad2` | 在 protocol bridge 内补 fake external stdio process wrapper 测试与 durable audit sink；不得依赖真实 sidecar endpoint 或用户机器外部命令 | `internal/protocolbridge/**`、protocol space | accepted |

### 第二十轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Route ledger 必须归 sidecar/reference 管理，支持测试临时路径；不得写用户正式配置目录，不得扩大为全局 repair scheduler。
3. Doctor 只能消费 typed diagnostics evidence，不新增 repair mutation，不把文本字段重新解释为 authority。
4. Quota 必须保持 explicit fact-only；缺 `quotaFact` / `quota_fact` / legacy `fact` 时只能渲染 non-authoritative / missing evidence。
5. Extension 只允许 dry-run / diff preview / validation，不允许写真实 Codex config，不允许启用 capability runner。
6. Protocol external stdio 只能用受控 fake command / in-test process 验证 lifecycle；audit persistence 必须脱敏，不落 raw token/header/cookie/query/URI。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十轮主控验收

已接受：

1. Route Resilience durable action ledger：CLIProxyAPI reference 将 action history 推进为 sidecar-owned JSONL/file ledger；`clear_transient_lockout`、`recheck_routeability`、`rerun_bounded_reconcile` 都 append ledger，history endpoint 优先从 ledger newest-first 读回，读失败回退内存副本。bounded reconcile 仍保持受限 tracer，不调外部 repair service、不循环。
2. Doctor Workbench typed diagnostics consumer：GetTokens Wails/root/frontend DTO 透传 nested `droppedReason`；Doctor route target 只从 nested typed payload 或 legacy typed `routeEvidence` 生成，不再把顶层 `label/summary/refID` 升级为 authority。`quotaFact` 继续只消费 typed payload，缺 fact 时保持 non-authoritative。
3. Quota Intelligence explicit fact anti-regression：account quota consumer 收紧为 explicit-fact-only；只有 `quotaFact` / `quota_fact` / legacy `fact` 才返回 authority fact，缺 fact 时即使存在 exhausted windows、`blockReason`、`degradedReason`、usage totals，也只返回 `unknown` / `confidence=none`。
4. Extension Contract config apply dry-run boundary：新增 Codex config dry-run preview / validation boundary，基于 enabled extensions 生成 blocked sections、summary、validation errors 和可扩展 operations；本轮不写真实 `~/.codex/config.toml`、不执行 capability、不接 marketplace。主控派回修复 `previewData.ts` generated model `convertValues` 类型缺口。
5. Protocol Bridge external stdio and durable audit：新增受控 fake external stdio process wrapper，覆盖 start、JSON-RPC stdin/stdout 往返、context shutdown、stderr/exit error 脱敏；新增 JSONL audit sink，写入前脱敏 `TargetRefs` 和 `Authority.SourceNotes`，不落 raw token/header/cookie/query/URI。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，907/907 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused Extension correction：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. 历史 Doctor / Extension agent 在本轮 wait 时返回 `not_found`，主控重新派发 `019ed5ff-2abf-7a22-b754-b19601f3ac10` 与 `019ed5ff-2b5b-79d2-a487-32c0890e602d` 接手剩余写入面。
2. Extension dry-run preview 首轮导致 `npm --prefix frontend run typecheck` 失败，主控派回 Extension agent 做最小集成修复：为 preview fixture 补 generated model 要求的 `convertValues`，并补 focused test。

剩余风险：

1. Route ledger 仍是 append-only JSONL，没有 rotation、compaction、size cap 或 profile-aware runtime path。
2. Doctor typed consumer 已进入 Wails/root/frontend，但真实 dev App 桌面壳层未在本轮启动验收。
3. Quota explicit-fact-only 已加反回归，但后续 Doctor/Status 新消费面仍需继续沿用同一 authority 边界。
4. Extension dry-run 目前因 v0 schema 未声明 Codex Skills/MCP 写入而返回 `operationCount=0` + validation errors；真实 save/apply 仍未实现。
5. Protocol external stdio 和 JSONL audit 仍是 skeleton；未实现 MCP initialize/capabilities、并发 request、audit rotation/query API 或真实 sidecar runner。
6. 主控沉淀审计：本轮继续复用既有 subagent supervision、sidecar authority、explicit-fact、dry-run config preview、protocol audit redaction 边界；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twenty-First Dispatch

日期：2026-06-17

第二十一轮继续采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是在第二十轮基础上补“可控增长、可防回归、可预览操作、可查询审计”的下一层，不进入真实写入/执行。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience ledger bounds and query filters | `019ed613-7e38-7fe3-9bd2-94b4850bb1ae` | 为 durable action ledger 增加测试可控的 max entries / truncation 或 rotation 边界，并让 history endpoint 支持 bounded query filter，防止 JSONL 无限增长不可控 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions*`、route space | accepted |
| Doctor Workbench typed binding regression gate | `019ed613-7ed5-7343-a1f8-06419cf4d698` | 补 Doctor typed evidence Wails/generated binding 防回归门禁，证明 `droppedReason` 不会在 root/Wails/frontend 模型同步时丢失 | Doctor root/Wails/frontend binding tests、doctor space | accepted |
| Quota Intelligence status explicit-fact gate | `019ed613-7f3e-7593-bc32-35372521d1c7` | 强化 Status/Usage 侧 explicit-fact-only 反回归，证明缺 fact 时 UI 只显示 missing/non-authoritative，不从 block/windows/usage 推导 quota truth | status/account quota frontend model/tests、quota space | accepted |
| Extension Contract dry-run operation projection | `019ed613-7fa6-7ea1-ac49-9d8c2bccec20` | 在不写真实 Codex config 的前提下，让 dry-run preview 能从 v0 manifest capabilities 生成 Skills/MCP 候选 operations 与 validation，避免长期只有 `operationCount=0` | extension core/Wails/root/frontend/tests、extension space | accepted |
| Protocol Bridge MCP initialize and audit query | `019ed613-8028-7d82-8a7a-a9a0b9e1f595` | 为 external stdio / MCP handler 增加 minimal initialize/capabilities 响应和 JSONL audit query API/reader，仍只用 fake process 与本地临时文件测试 | `internal/protocolbridge/**`、protocol space | accepted |

### 第二十一轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Route ledger bounds 必须可测试、可配置；不得写用户正式配置目录，不得新增后台 scheduler。
3. Doctor 只补 typed evidence binding / model 防回归，不新增 repair mutation，不把文本 evidence 升级为 authority。
4. Quota 只补 Status/Usage 消费门禁，不改 sidecar truth，不恢复本地推导。
5. Extension dry-run 可以生成候选 operations，但不得写 `~/.codex/config.toml`、不得执行 capability、不得接 marketplace 或网络。
6. Protocol initialize/audit query 只能在本地 fake process / temp JSONL 范围验证；不得启动真实 sidecar endpoint。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十一轮主控验收

已接受：

1. Route Resilience ledger bounds and query filters：CLIProxyAPI reference 的 action ledger 增加 `maxEntries` 默认 200，append 后同步截断 JSONL，只保留最新 N 条；history endpoint 支持 `action/status/target/account/auth/model/limit` filter，`limit=0` 有测试覆盖。未新增 scheduler、未调用外部 repair service。
2. Doctor Workbench typed binding regression gate：新增 root DTO JSON contract、Wails DTO JSON roundtrip、frontend generated binding gate，覆盖 internal/root DTO tag、root mapper、`GetDoctorSnapshot` binding、generated `DoctorEvidenceRef` constructor、Doctor frontend typed model，证明 `droppedReason` 不会在链路同步中丢失。
3. Quota Intelligence status explicit-fact gate：Status/Usage 侧缺 `quotaFact` / `quota_fact` / legacy `fact` 时只显示 missing / non-authoritative，不从 `windows`、`blockReason`、`usageTotals`、`totalTokens` 或伪 authority 字段推导 quota truth；有 explicit fact 时继续展示 `Quota runtime authority`。
4. Extension Contract dry-run operation projection：dry-run preview 现在从 v0 manifest capabilities 投影候选 operations；`provider-metadata` -> `skills.config` preview-only operation，`model-catalog-source` -> `mcp_servers` preview-only operation，`action=preview`，成功投影产生 `codex-config-projection-only` warning，不计入 blocking validation error。没有新增 save/apply 方法，没有读写真实 Codex config。
5. Protocol Bridge MCP initialize and audit query：`MCPStdioJSONRPCServer` 增加 minimal `initialize` 响应，返回 `protocolVersion`、`serverInfo`、`tools/resources` capabilities 且不调用 executor；`JSONLAuditReader` 支持 `limit/kind/status` 查询本地 JSONL，读取时继续脱敏并统计 malformed line skip。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，909/909 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused binding gates：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Route ledger 有 max entries 截断，但仍没有 profile-aware runtime path、rotation metadata 或 compaction policy。
2. Doctor typed binding gate 已覆盖生成物防回归，但本轮未运行 Wails binding generator 或真实 dev App 桌面壳层。
3. Quota explicit-fact gate 已覆盖 Status/Usage，但未来新增消费面仍需同样显式 fact 门禁。
4. Extension dry-run operation projection 仍是 preview-only candidate diff，不是 Codex config 局部 patch 计划；真实保存链路还需要 TOML 局部 patch、MCP 一级 table 解析、raw/structured editor 重读同步。
5. Protocol initialize/audit query 仍是 minimal skeleton，不含 `notifications/initialized`、`tools/list`、`resources/list`、并发 request、progress/cancel、audit rotation/compaction/fsync/query API 分页。
6. 主控沉淀审计：本轮继续复用既有 subagent supervision、sidecar authority、explicit-fact、dry-run config preview、protocol audit redaction / local JSONL query 边界；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twenty-Second Dispatch

日期：2026-06-17

第二十二轮继续采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是把第二十一轮剩余风险推进到更可落地的 preview / query / runtime-safe 形态，同时继续禁止真实用户配置写入、正式 App 验收和外部服务执行。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience profile-aware ledger path and append error surface | `019ed61f-7290-7a62-8bfa-902daf290e8f` | 为 durable ledger 增加 profile-aware/test-overridable path 解析和 append/truncate error surface，让 action response 可观察 ledger failure 而不是静默吞掉 | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/route_resilience_actions*`、route space | accepted |
| Doctor Workbench dev bridge snapshot fixture gate | `019ed61f-fc81-77d0-9e22-2c43e7074b03` | 为 Doctor typed evidence 增加 dev-bridge/browser-preview runtime snapshot fixture gate，证明真实 Wails binding 之外的预览/桥接路径也不会丢 `droppedReason` | doctor frontend/dev-bridge tests、doctor space | accepted |
| Quota Intelligence explicit-fact shared helper consolidation | `019ed61f-fd28-7770-a700-e7b3cd61054b` | 将 Status/Usage/Account 的 explicit-fact-only 判定收敛到共享 helper 或统一测试矩阵，减少后续新消费面绕过门禁 | quota/status/account frontend model/tests、quota space | accepted |
| Extension Contract TOML patch-plan dry-run | `019ed61f-fdea-7640-8694-b16e641a13b1` | 在 dry-run operation projection 基础上生成 Codex config TOML patch plan 预览，不写真实文件，只输出目标 section、operation、before/after snippet 和 validation | extension core/Wails/root/frontend/tests、extension space | accepted |
| Protocol Bridge tools/list resources/list and audit pagination | `019ed61f-fed1-7c22-9532-a59862f48ed5` | 为 MCP stdio handler 增加 minimal `tools/list` / `resources/list`，并为 JSONL audit reader 增加 cursor/offset pagination；仍只用 fake process/temp file | `internal/protocolbridge/**`、protocol space | accepted |

### 第二十二轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Route ledger path 只能使用 sidecar/reference profile 或测试临时路径；不得写正式 GetTokens 配置目录，不得引入 scheduler。
3. Doctor 只补预览/桥接路径防回归，不新增 repair mutation，不启动 dev App。
4. Quota 只做 explicit-fact 判定收敛和测试矩阵，不改变 sidecar truth 或 UI 视觉大改。
5. Extension patch plan 只能 preview/dry-run，不得写 `~/.codex/config.toml`、不得执行 capability、不得接 marketplace/network。
6. Protocol list/pagination 只能服务本地 manifest/fake/temp JSONL；不得启动真实 sidecar endpoint。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十二轮主控验收

已接受：

1. Route Resilience profile-aware ledger path and append error surface：`RouteResilienceActionResponse` 新增 `ledgerError`，append/truncate failure 会随 action response 返回且内存 history fallback 保留；ledger path 支持从 `<profile>/config.yaml` 推导到 `<profile>/route-resilience/actions.jsonl`，测试覆盖 append failure、truncate failure、profile-aware path 写入。
2. Doctor Workbench dev bridge snapshot fixture gate：browser-preview fixture 改为 nested `droppedReason`，并保留冲突 `label/summary/refID/source`；新增 fixture gate 证明 preview snapshot 本身保留 `droppedReason`，派生 view 的 target/reason/blocking 来自 nested payload，不靠文本补 truth。
3. Quota Intelligence explicit-fact shared helper consolidation：新增 `resolveExplicitQuotaFactDisplay(payload)`，`resolveQuotaFact()` 与 Status/Usage evidence resolver 复用同一 explicit fact helper；统一矩阵覆盖 `quotaFact`、`quota_fact`、legacy `fact`，并验证 bait payload 不升级 authority。
4. Extension Contract TOML patch-plan dry-run：`CodexConfigDryRunOperation` 新增 `patchPlan`，包含 `targetSection/operation/beforeSnippet/afterSnippet/validation`；dry-run 生成 Skills `[[skills.config]]` 和 MCP `[mcp_servers.<id>]` 父 table 预览，不投影 nested `tools/oauth` 为 server，不输出 `bearer_token`，不写真实 Codex config。
5. Protocol Bridge tools/list resources/list and audit pagination：MCP stdio handler 新增 minimal `tools/list` / `resources/list` JSON-RPC 分支，从本地 MCP mapping fixture 投影 manifest 且不调用 executor；`JSONLAuditQuery` 新增 `Offset/Cursor`，结果返回 `NextCursor/HasMore`，保持 latest-first 语义。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，911/911 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused gates：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Route profile-aware setter 已存在，但启动 hook 是否接线仍需后续聚合；`ledgerError` 只做可观察 surface，不改变 action HTTP/status。
2. Doctor 本轮覆盖 browser-preview/dev-bridge fixture path，不替代真实 Wails runtime / dev App 验收。
3. Quota 现有 Account/Status/Usage 已收敛到共享 helper，但未来新消费面仍可能手写解析，需要继续用矩阵测试约束。
4. Extension patch plan 仍不是 TOML 保存器；真实局部 patch、注释/未知字段保留、raw/structured editor 保存后重读同步仍待后续切片。
5. Protocol `tools/list` / `resources/list` 仍是 minimal manifest 投影，不含完整 MCP annotations、list pagination 或 dynamic `listChanged`；audit cursor 是 numeric offset cursor，不具备 rotation/compaction 后稳定语义。
6. 主控沉淀审计：本轮继续复用既有 sidecar authority、explicit-fact shared helper、dry-run TOML patch preview、protocol local JSONL pagination 边界；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twenty-Third Dispatch

日期：2026-06-17

第二十三轮继续采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是把第二十二轮的 preview / query / runtime-safe 能力推进到“接线可证、反绕过可查、patch planner 更真实、协议分页更稳定”的下一层。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Route Resilience startup ledger path wiring | `019ed634-977b-7ab3-b1b5-39d5b7d0e35b` | 在 CLIProxyAPI reference 内把 profile-aware ledger path 接入 action store 初始化/启动路径，证明 runtime config path 会驱动 ledger 目录，同时保留测试 override | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/**`、route space | accepted |
| Doctor Workbench preview gate script typed route check | `019ed634-98b7-77a1-8f65-d4018189092d` | 更新 Doctor preview check 脚本，让 archived/headless gate 也检查 nested `droppedReason` fixture，不只检查渲染后的结构字段 | `docs-linhay/scripts/check-doctor-workbench-preview.mjs`、doctor frontend fixtures/tests、doctor space | accepted |
| Quota Intelligence no-direct-fact-parser gate | `019ed634-99d3-7050-9855-b73937e57462` | 增加静态/测试门禁，防止 Status/Usage/Account 之外的新代码直接手写 `quotaFact/quota_fact/fact` 解析绕过共享 helper | quota frontend tests/scripts、quota space | accepted |
| Extension Contract read-only TOML patch planner | `019ed634-9aa5-79a0-a860-b79104b00d74` | 在 dry-run patchPlan 基础上加入只读 TOML input parser/planner，基于输入文本生成 before/after patch snippets，但不写文件、不保留 token | extension core/Wails/root/frontend/tests、extension space | accepted |
| Protocol Bridge list pagination and stable audit cursor | `019ed634-9b95-7d33-9e11-b02a50037dd5` | 为 `tools/list` / `resources/list` 增加 cursor/limit 分页，并把 audit cursor 从裸 offset 收敛为稳定 token 格式 | `internal/protocolbridge/**`、protocol space | accepted |

### 第二十三轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Route 只接 reference/sidecar 启动配置路径，不写正式 GetTokens 配置目录，不新增 scheduler。
3. Doctor 只升级 preview/check gate，不启动 dev App，不新增 repair mutation。
4. Quota 静态门禁必须允许共享 helper 内部解析，但阻止新消费面绕过；不得做 UI 大改。
5. Extension TOML planner 只能接收测试/preview 输入文本并返回 dry-run snippets，不读取或写入真实 `~/.codex/config.toml`。
6. Protocol list/audit cursor 仍只服务本地 mapping fixture/temp JSONL，不接真实 sidecar endpoint。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十三轮主控验收

已接受：

1. Route Resilience startup ledger path wiring：CLIProxyAPI reference 的 `InstallRoutingPoliciesWithConfigPath(configPath)` 会驱动 route action ledger 写到 `<profile>/route-resilience/actions.jsonl`；测试 override 仍可覆盖到 `t.TempDir()`，未新增 scheduler 或外部 repair service。
2. Doctor Workbench preview gate script typed route check：`check-doctor-workbench-preview.mjs` 现在读取 `frontend/src/features/doctor-workbench/model/previewData.ts`，检查 nested `droppedReason.accountKey/authId/model/source/scope/reason/routeBlocking`，并确认冲突文本仍存在且 fixture 不用 legacy `routeEvidence` 作为 authority。
3. Quota Intelligence no-direct-fact-parser gate：新增 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` 扫描 `frontend/src/features`；唯一 direct parser 入口限定为 `frontend/src/features/accounts/model/accountQuota.ts`，tests / preview fixtures 允许构造 payload，未授权新 feature 直接读 `payload.quotaFact` / `payload['quota_fact']` / `payload.fact` 会失败。
4. Extension Contract read-only TOML patch planner：read-only `configText` TOML input planner 只解析调用方传入文本，不读取/写入真实 `~/.codex/config.toml`；可提取 `[[skills.config]]` 和精确 `[mcp_servers.<id>]` 父 table，nested `tools/oauth` 不作为 server，`bearer_token` literal 在 snippets 中 redacted，after 只提示 `bearer_token_env_var` 边界。
5. Protocol Bridge list pagination and stable audit cursor：`tools/list` / `resources/list` 增加 `limit` + stable cursor 分页，cursor 形如 `pb-list-v1:<tools|resources>:<offset>`；malformed/wrong-kind/negative limit 返回 invalid params 且不调用 executor。audit cursor 从裸数字收敛为 `pb-audit-v1:<offset>`，`Offset` 仍保留本地兼容入口，`Cursor:"2"` 已拒绝。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，911/911 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Quota static gate：`node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`
- Focused gates：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- Focused Extension correction：`node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs`
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check`

主控修正：

1. Extension `GetTokensExtensionRegistryFeature.tsx` 首轮导致 `npm --prefix frontend run typecheck` 失败：构造 `PreviewGetTokensExtensionCodexConfigDryRunInput` 时缺 generated class 要求的 `convertValues`。主控派回 Extension agent，用 `main.PreviewGetTokensExtensionCodexConfigDryRunInput.createFrom(...)` 构造实例并保持 `configText` preview-only 边界后通过。

剩余风险：

1. Route 已接 startup config path，但仍未重建 sidecar 或启动 dev App 验证真实运行态路径。
2. Doctor preview gate 覆盖 archived/headless fixture source，不替代真实 Wails runtime / dev App 验收。
3. Quota 静态扫描是形态门禁，不是完整 AST parser；Doctor typed quota consumer 仍作为当前例外，后续需评估是否也收敛到共享 helper。
4. Extension planner 仍是 snippet planner，不是真实 TOML AST writer；局部 patch、注释/未知字段/排序保留、raw/structured editor 重读同步仍待后续切片。
5. Protocol list/audit stable cursor 仍映射 offset，不解决 JSONL rotation / compaction 后跨文件稳定语义。
6. 主控沉淀审计：本轮复用既有 sidecar startup path、preview fixture gate、quota shared-helper/static gate、read-only TOML planner、protocol cursor boundary；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twenty-Fourth Dispatch

日期：2026-06-17

第二十四轮继续采用“一次性写完再整体测试”的推进方式。主控只负责编排、边界、最终审查、一次性聚合测试和文档/memory 写回；subagents 并行完成实现。本轮目标是把 Round19-23 的实现向 release-readiness 证据推进：生成物一致性、sidecar reference rebuild smoke、门禁脚本纳入文档检查、敏感字段防回归、协议包级验证稳定化。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Wails binding generated surface consistency | `019ed642-11b7-7e52-9179-7a32895960cd` | 校准 Round20-23 新增 root/Wails DTO 与 frontend generated binding tests，必要时通过安全方式更新 generated binding 断言，证明 `droppedReason`、extension dry-run input/patchPlan 不会丢 | root/Wails/frontend binding tests、generated binding fixtures、doctor/extension spaces | accepted |
| CLIProxyAPI sidecar rebuild smoke evidence | `019ed642-1297-7c01-a7f6-f8454573368d` | 在 reference 内增加或更新 bounded build/smoke doc/script，证明当前 gettokenshooks/management 能构建测试侧 sidecar reference，不发布、不替换正式 sidecar | `docs-linhay/references/CLIProxyAPI` tests/docs、route/doctor spaces | accepted |
| Quota static gate docs-check integration | `019ed642-13f5-7f12-b358-438e14955897` | 将 no-direct-fact-parser gate 纳入 docs/check 或独立聚合脚本，确保主控和后续 agents 不会忘跑该门禁 | `docs-linhay/scripts/**`、quota space | accepted |
| Extension TOML planner sensitive-field regression gate | `019ed642-154e-7a30-8a51-f7d7a5643398` | 强化 read-only TOML planner 对 bearer_token/token/header/cookie 等敏感字段的 redaction 测试和前端展示门禁 | extension core/frontend/tests、extension space | accepted |
| Protocol package-level no-network verifier | `019ed642-163d-7532-87ac-b442c4b93306` | 为 protocol bridge 增加 package-level verifier 或测试标签/脚本，能在沙箱中绕开既有 httptest 监听限制并覆盖 list/audit cursor 关键路径 | `internal/protocolbridge/**`、protocol space | accepted |

### 第二十四轮边界

1. 主控不在 subagents 返回前跑逐项验收；所有实现返回后再做一次整体测试和集成修正。
2. Wails binding 校准不得直接覆盖未理解的生成物；如果不运行 generator，必须以测试证明当前 generated surface 一致。
3. CLIProxyAPI smoke 只能构建/测试 reference，不替换 GetTokens app bundle sidecar，不触碰正式版。
4. Quota gate 可以接 docs/check，但不得把测试 fixtures 误判为违规。
5. Extension redaction gate 不得读取真实 `~/.codex/config.toml`，只能用测试/preview 输入文本。
6. Protocol verifier 不得启动真实 sidecar endpoint；如需规避沙箱监听限制，只能收敛到 no-network focused verifier。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十四轮主控验收

已接受：

1. Wails binding generated surface consistency：新增/强化 Go DTO/mapping tests 与 frontend generated source tests，证明 Doctor `droppedReason`、Extension dry-run `configText` / typed `patchPlan` 在 root/Wails/frontend generated surface 中不丢；未运行 Wails generator，采用最小手动同步 `frontend/wailsjs/go/models.ts` 并用测试覆盖。
2. CLIProxyAPI sidecar rebuild smoke evidence：新增 `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 和 `SIDECAR_BUILD_SMOKE.md`；脚本 focused `go test ./internal/gettokenshooks`、`go build ./cmd/server` 到 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke`，并运行 binary `-h` smoke，未发布、未替换 app bundle sidecar。
3. Quota static gate docs-check integration：`docs-linhay/scripts/check-docs.sh` 现在自动运行 `check-quota-no-direct-fact-parser.mjs`；新增集成测试证明 docs-check 接入与 fixture allowlist 不误报。
4. Extension TOML planner sensitive-field regression gate：read-only TOML planner 对 `token`、`api_token`、`headers`、`Authorization`、`cookie`、`secret` 类 key 做 RHS redaction，保留 `bearer_token_env_var` 可见并继续禁止 `bearer_token` literal；前端 dry-run view model 在展示前二次 redaction。
5. Protocol package-level no-network verifier：新增 `docs-linhay/scripts/check-protocolbridge-no-network.mjs` 和 `protocolbridge_no_network` 测试标签，覆盖 list/audit cursor 关键路径，规避当前沙箱下既有 `httptest.NewServer` 监听限制。

一次性聚合验证已通过：

- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，911/911 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Docs + quota gate：`bash docs-linhay/scripts/check-docs.sh`
- Sidecar smoke：`docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`，构建测试侧 binary 到 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round24-smoke`，sha256 为 `7e76f226786fd96f7707bcd8817943fa28c12095e15ee8604a80b86a0e604e16`
- Protocol no-network verifier：`node docs-linhay/scripts/check-protocolbridge-no-network.mjs`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，59 checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused gates：`node --test frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/accounts/tests/accountQuotaFact.test.mjs frontend/src/features/status/tests/quotaStatusEvidence.test.mjs frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- Docs / whitespace：父仓 `git diff --check`、CLIProxyAPI `git diff --check`

剩余风险：

1. Wails generator 本轮未运行；一致性由 Go DTO/mapping tests、frontend generated source tests 和最小手动同步证明。
2. Sidecar smoke binary 来自 `91dd8d8e+dirty` reference，只能作为测试侧证据，不能作为 release artifact；未启动真实 sidecar HTTP endpoint 或 dev App ready。
3. Quota static gate 仍是正则形态扫描，不是完整 AST parser；Doctor typed quota consumer 仍保留已知例外。
4. Extension redaction 是 read-only preview/snippet 行级门禁，不是完整 TOML AST writer。
5. Protocol no-network verifier 不替代非受限环境下的完整 protocolbridge 包测试；当前沙箱下既有 `httptest.NewServer` 监听限制仍存在。
6. 主控沉淀审计：本轮复用既有 Wails binding hygiene、CLIProxyAPI reference build smoke、quota static gate、extension redaction、protocol no-network verifier 边界；没有新增跨领域 workflow 或 repo-wide 硬约束，因此不更新 skill / AGENTS。

## Twenty-Fifth Dispatch

日期：2026-06-18

第二十五轮继续采用“subagents 一次性实现，主控最后整体测试”的推进方式。本轮不继续扩大功能面，优先补 Round20-24 已落地能力的防漂移和验收链：Wails generated surface、Extension dry-run 副作用边界、Quota 静态门禁精度、Protocol no-network suite、CLIProxyAPI sidecar smoke provenance。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Wails binding drift gate | `019ed688-7d3f-7bf1-8d8a-6fcd7bbb49c2` | 增加不依赖真实 dev App 的 generated binding surface drift 门禁，覆盖 Doctor typed evidence、Extension dry-run input/patchPlan、Route action binding 关键字段 | `docs-linhay/scripts/**`、`frontend/wailsjs/**`、doctor/extension spaces | accepted |
| Extension dry-run no-side-effect gate | `019ed688-7de0-7e90-b957-f43e20edaaa0` | 固化 dry-run planner 只消费 caller-supplied `configText` / registry input、不读写真实配置，并补 idempotent/noop 分类证据 | `internal/gettokensextensions/**`、`internal/wailsapp/gettokens_extensions_test.go`、extension space | accepted |
| Quota AST/static gate | `019ed688-7ea6-7bf1-840d-f361a2c2ffac` | 将 quota direct fact parser gate 从正则形态升级为词法/轻 AST 级扫描，减少注释/字符串/别名场景误判，继续允许 fixtures | `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`、gate tests、quota space | accepted |
| Protocol no-network suite split | `019ed688-808f-7241-9218-74cf8d66729f` | 把 no-network verifier 扩展成稳定 suite split，明确沙箱可跑清单与需 unrestricted httptest 的边界 | `docs-linhay/scripts/check-protocolbridge-no-network.mjs`、`internal/protocolbridge/**`、protocol space | accepted |
| CLIProxyAPI sidecar smoke provenance manifest | `019ed688-81fc-73d3-a7b6-855aceca3441` | 让 sidecar smoke 生成 test-only JSON manifest，记录 commit/dirty/source/binary/sha256/commands/timestamp/not-release-artifact | `docs-linhay/references/CLIProxyAPI/**`、doctor space | accepted |

### 第二十五轮边界

1. 第一批 Round25 subagents 因 `http://cpa.host.dxy/v1/responses` stream disconnected 全部失败，主控已关闭失败实例；该问题属于外部响应流中断，不代表实现失败。
2. 主控只做派发、边界、集成审核、最终聚合测试与文档/memory 写回；subagents 负责具体实现。
3. 不启动真实 dev App，不触碰正式版 GetTokens，不读取或写入真实 `~/.codex/config.toml`，不替换 app bundle sidecar。
4. 本轮所有实现必须先有 focused red/green evidence；如果因当前实现已满足而无法红灯，必须在 plan 中记录“当前缺口固定为回归门禁”。
5. Wails binding gate 不直接覆盖未理解的 generated files；若不运行 generator，必须由测试证明 generated surface 一致。
6. Extension dry-run gate 的输入只能来自测试或 preview DTO，不允许访问真实用户配置。
7. Quota gate 升级不得把 tests、preview data、fixtures 误判为违规。
8. Protocol no-network suite 不删除现有需要 `httptest.NewServer` 的测试；只拆分沙箱可跑与 unrestricted env 应跑的边界。
9. CLIProxyAPI smoke manifest 只能作为测试证据，不能作为 release artifact。
10. Subagents 全部返回后，主控再一次性运行 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十五轮主控验收

已接受：

1. Wails binding drift gate：新增 `docs-linhay/scripts/check-wails-binding-surface.mjs` 与 `frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`，覆盖 Doctor `droppedReason`、Extension dry-run `configText` / typed `patchPlan`、Route action generated surface、`limit` / `truncated`；未运行 generator，未启动 dev App，门禁只证明关键 generated surface 不漂移。
2. Extension dry-run no-side-effect gate：`PreviewCodexConfigDryRun` 的 patch plan operation 细分为 `add` / `update` / `noop`，新增测试证明 planner 只使用 caller-supplied `configText`，不读取也不写入 `targetPath` 或真实 `~/.codex/config.toml`。
3. Quota AST/static gate：`check-quota-no-direct-fact-parser.mjs` 升级为 lexical-light-ast 扫描，忽略注释/字符串，覆盖 property/bracket/destructuring/raw payload alias/`JSON.parse` 形式；当前扫描 `335` 个 frontend feature 文件、`49` 个 fixture、`1` 个 canonical parser，`findings=[]`。
4. Protocol no-network suite split：`check-protocolbridge-no-network.mjs` 现在强制分类 `internal/protocolbridge` 测试，沙箱内运行 `64` 个 no-network tests，明确 `4` 个 `httptest.NewServer` 测试需要 unrestricted localhost 端口绑定环境。
5. CLIProxyAPI sidecar smoke provenance manifest：`gettokens-sidecar-build-smoke.sh` 生成 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json`，包含 source commit/dirty 状态、binary path、sha256、commands、timestamp，并显式 `testOnly=true`、`notReleaseArtifact=true`、`releasePipelineEligible=false`。

一次性聚合验证已通过：

- Round25 gates：`node docs-linhay/scripts/check-wails-binding-surface.mjs`；`node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs`；`node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs`；`node docs-linhay/scripts/check-protocolbridge-no-network.mjs`
- GetTokens Go aggregate：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions`
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management`
- Frontend unit：`npm --prefix frontend run test:unit`，`911/911` 通过
- Frontend typecheck：`npm --prefix frontend run typecheck`
- Sidecar smoke：`docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh`，主控重跑后 binary sha256 为 `b7d2af99bc793e3396bdfe08c9190058955e303185c98b021e38dca31554c236`，manifest 校验通过且 `commit=91dd8d8e+dirty`
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，`59` checks；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`；`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs`
- Focused binding tests：`node --test frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs frontend/wailsjs/routeResilienceActionBinding.test.mjs`
- Docs / manifest / whitespace：`bash docs-linhay/scripts/check-docs.sh`；manifest required-field assertion；父仓 `git diff --check`；CLIProxyAPI `git diff --check`

剩余风险：

1. Wails binding drift gate 不替代真实 Wails generator；未来运行 generator 后仍需检查 generated diff。
2. Extension TOML patch planner 仍是 dry-run preview/snippet planner，不是真实 TOML AST writer 或保存器。
3. Quota gate 是 lexical-light-ast，不是完整 TypeScript AST 和跨函数数据流分析；Doctor typed consumer 例外仍保留为已知后续项。
4. Protocol no-network suite 不替代 unrestricted 环境下完整 `go test ./internal/protocolbridge`；4 个 `httptest.NewServer` 用例仍需允许 localhost 监听的环境验证。
5. Sidecar smoke binary 来自 dirty CLIProxyAPI reference，只能作为测试证据，不能进入 release pipeline 或 app bundle。
6. 主控沉淀审计：本轮新模式已沉淀到可执行 gate、space plan 和 memory；其中 Wails binding drift gate、Protocol no-network split、sidecar smoke manifest 后续如跨需求复用，再升级到项目 skill 或治理文档；当前不更新 AGENTS。

## Twenty-Sixth Dispatch

日期：2026-06-18

第二十六轮继续采用“subagents 一次性实现，主控最后整体测试”的推进方式。本轮从 Round25 剩余风险出发，把验证链从“有独立脚本”推进到“更接近真实边界”：Wails generator 实证、Extension temp-file apply engine、Doctor quota 例外收敛、Protocol unrestricted smoke 证据、sidecar smoke manifest 可复现边界。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Wails generator smoke / drift verifier | `019ed6cf-535d-7762-8a8d-85146a175a9b` | 增加安全的 Wails generated binding smoke：优先用脚本证明 generator 是否可运行、是否产生未预期 generated diff；不得覆盖未理解的 generated files | `docs-linhay/scripts/**`、`frontend/wailsjs/**` tests、doctor/extension spaces | accepted |
| Extension temp-file apply engine | `019ed6cf-5437-7661-8d72-92cb41cf7977` | 在 read-only dry-run planner 后补 temp-file only apply engine，证明 patch plan 可作用到临时 config 并保留未知字段/注释边界；不得读写真实 `~/.codex/config.toml` | `internal/gettokensextensions/**`、`internal/wailsapp/gettokens_extensions_test.go`、extension space | accepted |
| Doctor quota shared-helper convergence | `019ed6cf-559f-70d0-930d-ff5aeb77f728` | 收敛 `doctor-workbench` 直接消费 `evidence.quotaFact` 的 gate 例外，改为共享 helper / adapter 入口，并移除或缩窄 static gate exception | `frontend/src/features/doctor-workbench/**`、quota gate script/tests、doctor/quota spaces | accepted |
| Protocol unrestricted test smoke boundary | `019ed6cf-56ed-7693-9366-1695d7b19366` | 增加可在当前环境尝试完整 `internal/protocolbridge` unrestricted tests 的 smoke 脚本/文档，成功时记录通过，失败时必须识别是否仅为 localhost listen restriction | `docs-linhay/scripts/**`、protocol space | accepted |
| Sidecar smoke reproducibility manifest | `019ed6cf-5806-7130-8d9c-89e35d60af29` | 强化 sidecar smoke manifest：拆分 deterministic source metadata 与 volatile build timestamp，增加 manifest schema/checker，避免 sha 变化导致证据不可追踪 | `docs-linhay/references/CLIProxyAPI/**`、doctor space | accepted |

### 第二十六轮边界

1. 主控只做派发、边界、集成审核、最终聚合测试与文档/memory 写回；subagents 负责具体实现。
2. Wails generator smoke 不得直接覆盖 generated files；如 generator 产生 diff，必须保存证据并让脚本报告 drift，不由 subagent 擅自重写业务代码。
3. Extension apply engine 只能写 temp file 或测试目录；不得读取或写入真实用户 Codex config，不得执行 capability。
4. Doctor quota 收敛必须保持“只信 typed explicit quota fact，不从 summary/windows/blockReason 推导 authority”的语义。
5. Protocol unrestricted smoke 不得删除或跳过真实 `httptest.NewServer` 用例；只能把环境限制识别为结构化证据。
6. Sidecar smoke manifest 仍是 test-only，不得替换 app bundle sidecar，不得进入 release pipeline。
7. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十六轮主控验收

已接受：

1. Wails generator smoke / drift verifier：新增 `docs-linhay/scripts/check-wails-generated-drift.mjs`，脚本快照 `frontend/wailsjs` 后运行 `bash scripts/wails-cli.sh generate bindings`，再比较 drift 并恢复文件。当前 Wails CLI v2.12.0 不支持 `generate bindings`，脚本结构化报告 `bindingGenerationAvailable=false`；同时识别 wrapper 对 `frontend/wailsjs/go/models.ts` 的可恢复 whitespace side effect，未接受任何 generated diff。
2. Extension temp-file apply engine：新增 `ApplyCodexConfigDryRunPreviewToTempFile`，只把调用方提供的 `ConfigText` 与 dry-run preview operation 应用到 `TempDir/config-preview-*.toml`，支持 `[[skills.config]]` add/noop 与 `[mcp_servers.<id>]` add/update/noop，保留未知字段、注释、非目标 section 和 nested tools；不读取或写入真实 `~/.codex/config.toml`。
3. Doctor quota shared-helper convergence：Doctor Workbench 主模型不再直接读取 `evidence.quotaFact`；typed quota authority 收敛到 `quotaEvidenceAdapter.ts`，静态 gate 只保留这一个 Doctor 例外，并新增测试证明缺少 typed quota fact 时不会从 summary/windows/blockReason/usageTotals 推导 authority。
4. Protocol unrestricted test smoke boundary：新增 `check-protocolbridge-unrestricted-smoke.mjs`，尝试运行完整 `go test -count=1 ./internal/protocolbridge` 并分类结果。当前沙箱分类为 `localhost_listen_restriction_only`，失败点是 `httptest` 监听 `[::1]:0` 被拒；`check-protocolbridge-no-network.mjs` 仍稳定通过 64 个 no-network tests 并列出 4 个 unrestricted listener tests。
5. Sidecar smoke reproducibility manifest：sidecar smoke manifest 升级为 v2，拆分 deterministic source metadata 与 volatile build metadata，并新增 `check-sidecar-smoke-manifest.mjs` 校验 test-only / non-release / non-deterministic binary 边界；主控重跑生成 binary sha256 `43fcbea176cd349ea112035b64957b0c7b16cbd4a1ddd5ba9396db39505ab792`，sourceStateHash `391453c57dfa6a4f7763beb05590ce9f26217c866fe378bacc879b3642cf849c`，reference dirty=true。

主控集成修正：

1. 修正 `check-wails-generated-drift.mjs` 中本地 `git diff --label` 不兼容问题，改用 `--src-prefix` / `--dst-prefix`，并把 generator unavailable 时的 wrapper side effect 文案改为结构化风险。
2. 校准 `frontend/wailsjs/doctorTypedEvidenceBinding.test.mjs` 与 `frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`，使 generated DTO 断言匹配当前 Wails optional field 事实。
3. 清理 `frontend/wailsjs/go/models.ts` 的 generated whitespace drift 与 EOF 空行，使父仓 `git diff --check` 重新通过；随后重跑 focused generated binding tests 确认行为断言未变。

一次性聚合验证：

- Wails：`node docs-linhay/scripts/check-wails-generated-drift.mjs` 已执行并按预期非零退出，分类为 generator unavailable + restored=true；`node docs-linhay/scripts/check-wails-binding-surface.mjs` 通过。
- GetTokens Go：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/gettokensextensions` 通过；`go test -count=1 ./internal/protocolbridge` 在当前沙箱仅因 localhost listener restriction 失败，并由 unrestricted smoke 脚本分类。
- Extension focused Go：`go test -count=1 ./internal/gettokensextensions ./internal/wailsapp -run 'GetTokensExtension|PreviewCodexConfigDryRun|Apply'` 通过。
- Frontend focused + typecheck：focused Wails/Doctor/Quota tests 与 `npm --prefix frontend run typecheck` 通过。
- Frontend unit：`npm --prefix frontend run test:unit`，`912/912` 通过。
- CLIProxyAPI aggregate：`go test -count=1 ./internal/gettokenshooks ./internal/api/handlers/management` 通过。
- Protocol：`node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` 通过并分类 `localhost_listen_restriction_only`；`node docs-linhay/scripts/check-protocolbridge-no-network.mjs` 通过。
- Sidecar smoke：`docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 与 `node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs /private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json` 通过。
- Contract / preview：`node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`，`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`，`CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs` 通过；preview 在无 Chrome 环境下使用 archived snapshot/screenshot 证据。
- Docs / whitespace：`bash docs-linhay/scripts/check-docs.sh`、父仓 `git diff --check`、CLIProxyAPI `git diff --check` 通过。

剩余风险：

1. Wails generator 真实 binding 入口在当前 wrapper/Wails CLI 下不可用；脚本只能捕获不可用与 wrapper 副作用，不能证明未来 generator 输出无漂移。
2. Protocol 完整 `internal/protocolbridge` 包在当前沙箱未获得 unrestricted localhost 监听环境，只能由 classifier 证明失败属于环境限制，并由 no-network suite 覆盖可跑路径。
3. Extension temp apply 仍是 preview/temp-file string-level engine，不是真实用户 config 保存器或完整 TOML AST writer。
4. Sidecar smoke binary 来自 dirty CLIProxyAPI reference，只能作为 test-only evidence，不得进入 app bundle、正式版或 release pipeline。
5. 本轮未启动真实 dev App；按当前风险面，自动化测试、preview、Wails binding source gate、sidecar smoke 和 protocol classifier 足够作为本轮验收证据。
6. 主控沉淀审计：本轮新增的是可执行验证脚本、space plan 与 memory 事实，未形成 repo-wide 新硬约束；暂不更新 AGENTS。若 Wails generator smoke、protocol classifier 或 sidecar manifest v2 后续跨需求复用，再升级到项目 skill / dev workflow。

## Twenty-Seventh Dispatch

日期：2026-06-18

第二十七轮继续采用“subagents 一次性实现，主控最后整体测试”的推进方式。本轮不扩展产品 UI 范围，专门处理 Round26 仍然偏弱的验证链和实现边界：让 Wails generator smoke 产物可消费、让 Extension TOML apply 更接近真实保存器、继续压缩 Doctor quota 例外、把 Protocol listener 限制隔离成明确测试边界、把 sidecar manifest checker 纳入长期门禁。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Wails generator smoke report contract | `019ed892-3345-7692-9f73-737d4b4bd95d` | 将 Round26 的 Wails generator smoke 从“大量 diff 文本 + 非零退出”升级为结构化 report：支持 machine-readable JSON / concise stdout / artifact path，保留 restored=true 与 wrapper side-effect 证据；不得接受 generated diff | `docs-linhay/scripts/check-wails-generated-drift.mjs`、`frontend/wailsjs/generatedBindingSurfaceDrift.test.mjs`、doctor/extension space plans | accepted |
| Extension TOML temp writer fidelity | `019ed892-3447-7613-862c-47758fedf6d7` | 在 temp-file apply engine 基础上补更强的 TOML 保真测试与实现：重复 apply 幂等、目标 section update 不破坏 sibling/nested tables、注释和未知字段保留；仍只写 temp file | `internal/gettokensextensions/**`、extension space plan | accepted |
| Quota exception removal path | `019ed892-3518-7bf1-a06e-e0390aff97de` | 评估并实现 Doctor quota typed fact 例外进一步收敛：优先让 Doctor adapter 复用 canonical/shared helper，使 static gate exception 数量降到 0；如不能降为 0，必须写出代码事实和下一步 | `frontend/src/features/accounts/model/accountQuota.ts`、`frontend/src/features/doctor-workbench/model/quotaEvidenceAdapter.ts`、quota gate scripts/tests、doctor/quota plans | accepted |
| Protocol listener tests quarantine | `019ed892-364e-75f1-a81d-e1c77e80dc48` | 把当前需要 localhost listener 的 protocol tests 与 no-network suite 边界显式化，避免普通 `go test ./internal/protocolbridge` 在受限沙箱误报；不得删除真实 unrestricted 测试语义 | `internal/protocolbridge/**`、`docs-linhay/scripts/check-protocolbridge-*.mjs`、protocol space plan | accepted |
| Sidecar manifest checker docs gate | `019ed892-3777-7080-9154-d35b8ba4c384` | 将 sidecar smoke manifest v2 checker 接入可复用门禁或 docs-check 子门禁，使用 fixture/latest manifest 方式证明必填字段不会漂移；不得要求每次 docs-check 都重新 build sidecar | `docs-linhay/references/CLIProxyAPI/**`、`docs-linhay/scripts/check-docs.sh`、doctor space plan | accepted |

### 第二十七轮边界

1. 主控只做派发、边界、集成审核、最终聚合测试与文档/memory 写回；subagents 负责具体实现。
2. 不启动真实 dev App，不触碰正式版 GetTokens，不读取或写入真实 `~/.codex/config.toml`，不替换 app bundle sidecar。
3. Wails generator smoke 不得把 wrapper side effect 当作可接受 generated diff；只能结构化报告、恢复文件、给主控判定。
4. Extension writer 只能对 caller-supplied config text 和 temp file 生效；不得增加真实 apply 按钮或 capability 执行。
5. Quota 收敛不得回退“只信 typed explicit quota fact”的语义，不允许从 summary/windows/blockReason/usageTotals 推导 authority。
6. Protocol quarantine 不能简单跳过失败测试；必须保留 unrestricted 语义并让 no-network / restricted sandbox / unrestricted smoke 三者边界可验证。
7. Sidecar manifest gate 不得把 volatile binary sha 固定为稳定值；只能校验 schema、字段、边界语义和 fixture/latest manifest 格式。
8. 每个 subagent 必须直接改文件并更新对应 space plan；最终由主控统一跑 Go / frontend / contract / preview / docs / diff 聚合验证。

### 第二十七轮主控验收

已接受：

1. Wails generator smoke report contract：`check-wails-generated-drift.mjs` 现在输出单行 JSON report，并支持 `--report` 安全落盘；report 包含 `bindingGenerationAvailable`、`unavailableReason`、`wrapperCommand`、`restored`、`changedFiles`、`driftKind`、`sideEffectFiles`、`acceptedGeneratedDiff=false`、`exitClassification`。当前分类为 `binding-generation-unavailable`，不再打印巨大 diff，不接受 generated diff。
2. Extension TOML temp writer fidelity：temp-file apply engine 会按当前传入 TOML 重新判定 add/update/noop；重复 apply 保持文本稳定；目标 MCP parent update 不破坏 sibling tables、nested `tools/oauth`、注释、未知字段、非目标 server 和多个 `[[skills.config]]`；输出仍只写 temp file，并保持敏感字段 redaction。
3. Quota exception removal path：Doctor quota typed fact 解析改为复用 `accountQuota.ts` canonical helper，`knownTypedConsumerExceptions=[]`、`exceptionFiles=0`；仍保持“不从 summary/windows/blockReason/usageTotals 推导 authority”的语义。
4. Protocol listener tests quarantine：4 个必须 `httptest.NewServer` / localhost listener 的测试迁移到 `protocolbridge_unrestricted_listener` build tag；默认 `go test -count=1 ./internal/protocolbridge` 在当前沙箱通过，unrestricted smoke 仍显式分类为 `localhost_listen_restriction_only`。
5. Sidecar manifest checker docs gate：`check-docs.sh` 接入 sidecar manifest fixture gate，不触发 sidecar rebuild；checker 支持 `fixture`、`latest`、显式路径三种入口，并校验 `binarySha256Volatile=true` 与 `dirtyStatusEvidenceOnly=true`。

主控聚合验证已通过：

- Wails：`node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-smoke-round27-main.json` 预期 `exit=1`，JSON 分类 `binding-generation-unavailable`、`restored=true`、`acceptedGeneratedDiff=false`；`node docs-linhay/scripts/check-wails-binding-surface.mjs` 通过；generated binding focused tests 7/7 通过。
- Quota：`node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs` 与 `node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` 通过，输出 `exceptionFiles=0`、`knownTypedConsumerExceptions=[]`。
- Protocol：`node docs-linhay/scripts/check-protocolbridge-no-network.mjs` 通过并输出 default 63 / no-network tag 1 / unrestricted listener 4；`node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs` 通过并分类 `localhost_listen_restriction_only`。
- Sidecar manifest：`node docs-linhay/scripts/check-sidecar-smoke-manifest-gate-integration.test.mjs` 通过；`gettokens-sidecar-build-smoke.sh` 通过；`node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest` 通过，latest sha256 `f3dda25a678c2acbd52daa7ba9f8d0561822b87793baabdce1c1de7a2c898100`，sourceStateHash `3bb47bb46f49681be8af9661476c207db0fe97cb58c257c7d79f6eac7bcaa148`，dirtyStatusEntries=9。
- Go / frontend：`go test -count=1 . ./internal/wailsapp ./internal/cliproxyapi ./internal/protocolbridge ./internal/gettokensextensions` 通过；Extension focused Go 通过；frontend focused quota/doctor 42/42 通过；`npm --prefix frontend run typecheck` 通过；`npm --prefix frontend run test:unit` 913/913 通过。
- CLIProxyAPI / contract / preview / docs：CLIProxyAPI aggregate 通过；contract artifact 59 checks 通过；extension / doctor archived preview gates 通过；`bash docs-linhay/scripts/check-docs.sh` 通过；父仓 `git diff --check` 与 CLIProxyAPI `git diff --check` 通过。

剩余风险：

1. Wails CLI v2.12.0 仍不支持 `generate bindings`；本轮只是把失败信号结构化并降噪，没有让真实 generator smoke 变绿。
2. Extension temp writer 仍是 preview/temp-file 字符串级 writer，不是正式 TOML AST 保存器；redacted temp output 不能直接作为真实保存结果。
3. Quota static gate 已做到 0 exception，但仍是 lexical-light-ast，不是完整 TypeScript AST / 跨函数数据流分析。
4. Protocol 默认 package test 不再覆盖 4 个 listener tests；非受限环境必须显式跑 unrestricted smoke。
5. Sidecar fixture gate 只锁 schema 和边界；latest smoke 仍来自 dirty CLIProxyAPI reference，只能作为 test-only evidence，不得进入 app bundle 或 release pipeline。
6. 主控沉淀审计：本轮新增模式已落到可执行脚本、space plan、docs-check 和 memory；Protocol listener quarantine 是局部测试治理，暂不升级 AGENTS。Sidecar manifest fixture gate 已接入 docs-check，后续若扩展到更多 release-like smoke，再提炼到项目 skill / dev workflow。

## Final Completion Wave

日期：2026-06-18

用户明确要求“不再分这么多轮，直接一次性完成”。本节作为唯一的最终收敛入口：主控一次性派发所有剩余风险，subagents 并行实现，最终由主控做一次总体验收。

| 能力 | agent id | 目标 | 写入面 | 状态 |
|---|---|---|---|---|
| Wails/runtime/generator completion | 019ed8d1-9805-7232-844a-05c79ca62d76 | 校准 Wails 生成/构建/最低 dev readiness 边界；如果真实 generate bindings 不存在，给出替代命令或不可用证明；不得触碰正式版 | Wails scripts/tests、doctor/extension/progress docs | accepted |
| Extension local apply completion | 019ed8d1-994d-76e0-b05c-0dbba2afd604 | 从 temp writer 推进到 staged local apply transaction：preview、confirm、backup/temp write、verify、rollback；禁止写真实用户 config | internal/gettokensextensions、internal/wailsapp、extension docs/tests | accepted |
| Protocol unrestricted completion | 019ed8d1-9b6a-78a1-a6fc-738913374bf0 | 在当前 full-access 环境运行 tagged unrestricted listener tests；通过则记录真实通过，不通过则修正代码或给出非沙箱证据 | internal/protocolbridge、protocol scripts/docs | accepted |
| Sidecar smoke completion | 019ed8d1-9ce2-75e0-8b85-b8444922e542 | 实现 clean-state 或 dirty-state comparison smoke，区分 clean/dirty source 与 volatile binary，不把 dirty binary 当 release artifact | docs-linhay/references/CLIProxyAPI、sidecar scripts/docs | accepted |
| Integration hardening completion | 019ed8d1-9e54-7c01-b42f-dc0a67fecb33 | 生成 review slicing map、regression matrix、最终验收清单和提交建议，压缩当前状态入口 | docs-linhay/spaces、docs-linhay/dev、memory | accepted |

### Final Completion Wave 边界

1. 这是一次性最终收敛 wave，不再拆后续轮次。
2. subagents 直接实现和更新文档；主控不抢实现，负责边界、冲突处理、最终验证和写回。
3. 仍不得触碰正式版 /Applications/GetTokens.app，不得替换 app bundle sidecar，不得读取或写入真实 ~/.codex/config.toml。
4. 如果某个目标受上游工具或环境限制无法“变绿”，必须给出可执行证明、替代门禁和最终残余风险，不得只写待办。
5. 最终主控必须跑 Go / frontend / protocol unrestricted / sidecar smoke / contract / preview / docs / diff 聚合验证。

### Final Completion Wave：Wails/runtime/generator completion 验收

已接受：

1. 当前 Wails CLI v2.12.0 没有 standalone `generate bindings` 子命令；`bash scripts/wails-cli.sh generate bindings` 返回 0 但只打印 `generate` help，可用子命令只有 `module/template`。
2. `docs-linhay/scripts/check-wails-generated-drift.mjs` schema v3 已把该事实固化为终态 classifier：默认 report 在 `surfaceCheck.status=pass`、`changedFiles=[]` 时输出 `exitClassification=standalone-generator-unavailable-surface-pass` 并退出 0，不再作为无限待办失败。
3. 可用替代 readiness 路径为 `bash scripts/wails-cli.sh build`；显式 `--build-readiness` smoke 已通过，Wails 输出 `Generating bindings: Done.`，产物为本仓 `build/bin/GetTokens.app`，`changedGeneratedFiles=[]`，wrapper 管理的 build bundle sidecar 为 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`，`formalApplicationsPathTouched=false`、`formalBundleSidecarTouched=false`。
4. focused binding gates 通过：`check-wails-binding-surface.mjs` 与 7 个 generated binding Node tests 均绿。
5. 项目级沉淀已写入 `.agents/skills/gettokens-ops-governance/SKILL.md` 的 Wails v2.12 generator boundary；不升级 AGENTS。

本项详细证据落位：`docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260618-final-wave-wails-runtime-generator-completion.md`。

### Final Completion Wave：Sidecar smoke completion 验收

已接受：

1. `docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 保留 primary latest dirty smoke，同时在 dirty source 下为同 commit 创建 `/private/tmp` detached clean worktree，生成 `cli-proxy-api-round26-smoke-clean-comparison-manifest.json` 后移除临时 worktree。
2. latest manifest 新增 `sourceState.classification` / `sourceState.artifactClass=volatile-test-binary` / `sourceStateComparison`，明确 dirty source 只是 source-state evidence，clean comparison 只是 smoke evidence，二者都不是 release artifact。
3. `check-sidecar-smoke-manifest.mjs latest` 通过，记录 primary sha256=`5b6b7a71e2a9758a2b26943f789ba13dc634f41e712e98129f05b5ffdf757ec1`、dirtyStatusEntries=9、cleanComparisonAvailable=true、sameCommit=true。
4. `check-sidecar-smoke-manifest-gate-integration.test.mjs` 已改为备份/恢复 `/private/tmp` latest manifest，fixture/latest gate 不再覆盖真实 latest smoke evidence。
5. 本项未触碰 `/Applications/GetTokens.app`，未替换 app bundle sidecar，未读取或写入真实 `~/.codex/config.toml`。

本项详细证据落位：`docs-linhay/spaces/20260616-doctor-workbench/plans/20260618-final-completion-wave-sidecar-clean-source-comparison.md`。

### Final Completion Wave：主控最终总体验收

主控最终验收已通过：

1. Wails/runtime：默认 generated drift gate 通过，分类为 standalone-generator-unavailable-surface-pass；build-readiness gate 通过，Wails build 输出 Generating bindings: Done，产物为本仓 build/bin/GetTokens.app，未触碰正式版 /Applications/GetTokens.app。
2. Extension local apply：staged transaction helper/DTO/tests 通过，覆盖 preview、confirm token、backup、temp write、target write、verify、rollback；Wails 层拒绝真实 HOME 下 Codex config target。
3. Protocol unrestricted：默认 package、protocolbridge_unrestricted_listener tagged tests、no-network script、unrestricted smoke 均通过；smoke 输出 classification=passed、real_unrestricted_pass=true。
4. Sidecar smoke：dirty primary latest smoke + same-commit clean comparison 通过；latest manifest 记录 sourceStateClassification=dirty-source、artifactClass=volatile-test-binary、cleanComparisonAvailable=true。
5. Integration hardening：当前进度入口已收敛为 Final Completion Wave，包含 review slicing map、regression matrix、final acceptance checklist 和 commit/PR slicing 建议。

最终命令矩阵已通过：Wails drift/build-readiness/binding gates，Extension transaction focused Go tests，Protocol default/unrestricted/no-network/smoke，Sidecar clean comparison/smoke/latest/fixture，GetTokens Go aggregate，CLIProxyAPI aggregate，Quota gates，frontend typecheck，frontend unit 913/913，contract artifact 59 checks，extension/doctor archived preview，docs-check，父仓与 CLIProxyAPI diff-check。

最终残余风险：

1. 真实 ~/.codex/config.toml 写入仍未启用；当前只完成 staged transaction 与 temp/test target，正式写入必须另行授权并先展示 diff confirmation。
2. Wails 本轮完成 build readiness，不启动真实 dev App；因未触及菜单栏、LaunchServices、status item、窗口生命周期，不触发真实手点硬门槛。
3. Sidecar clean comparison 与 dirty latest smoke 均为 /private/tmp test-only evidence，不是 release artifact。
4. 工作区仍包含大量既有未提交/未跟踪改动；提交前按 Final Completion Wave review slicing map 分能力域切片审查。

主控沉淀审计：本次已更新 gettokens-ops-governance 的 Wails v2.12 generator boundary，并更新 gettokens-cliproxyapi-reference-port 的 Sidecar Smoke Evidence Boundary；没有新增 repo-wide 硬约束，因此不更新 AGENTS.md。
