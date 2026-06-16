# OmniRoute 借鉴能力技术方案 v01

## 背景

在 `OmniRoute` 借鉴能力评估基础上，GetTokens 确认近期优先推进：

1. `route resilience`
2. `quota intelligence`
3. `doctor workbench`

并将以下两项列为中期方向：

4. `protocol bridge`
5. `extension contract`

本文件给出可执行的阶段化技术方案。

## 方案总览

### 近期三项的目标

- 让 sidecar 的运行时路由更稳、更可恢复。
- 让 quota / requestability / degraded 状态更可解释。
- 让操作者有一个统一的排障入口，而不是在多个页面和日志之间跳转。

### 中期两项的目标

- 让 GetTokens 能把自己已有能力以稳定协议向外暴露。
- 让未来外部能力接入有受控的声明式边界。

## 统一前提

### 真相边界

- sidecar 是 routeability、quota、route decision 的 authority。
- Wails 负责桌面集成、配置 patch 与 DTO 聚合。
- frontend 负责 workbench，不负责重新决定运行时真相。

### 交付顺序

每一项都遵循：

1. 先补 sidecar / backend 结构化事实
2. 再补 Wails/root DTO
3. 再补 frontend workbench
4. 最后补 explain / screenshot / operator copy

## A. Route Resilience

### 要解决的问题

- 当前 routeability、degraded、bounded reconcile、route guard 虽已有积木，但还缺少统一“弹性路由层”口径。
- 失败隔离粒度还不够系统化，operator 能看见的解释和 sidecar 真决策之间仍有收口空间。

### 目标

把现有 route guard / session affinity / repair / candidate filtering 上升为统一的 resilience pipeline。

### 范围

- account / provider / model 粒度的 failure classification
- circuit breaker / lockout / cooldown
- candidate scoring
- fallback trace
- route decision ledger

### Phase A1：Resilience State Model

sidecar：

- 新增或收敛统一 resilience state：
  - `health_state`
  - `lock_scope`
  - `cooldown_until`
  - `failure_budget_used`
  - `recovery_hint`
- 明确 account、provider、model 三层失败作用域。

建议文件范围：

- reference sidecar `sdk/cliproxy/auth`
- `internal/gettokenshooks`
- routeability / runtime apply 相关状态文件

验证：

- failing tests 覆盖 account-level、provider-level、model-level 三类阻断与恢复。

### Phase A2：Route Decision Ledger

sidecar：

- 扩展最近真实路由决策记录：
  - 选中对象
  - 被排除对象及原因
  - fallback chain
  - 最终结果

Wails：

- 补 `ListChannelRouteDecisions` 的 resilience 字段映射。

frontend：

- 在 routing workbench 中展示“为什么它没被选中”而不只是“谁被选中”。

### Phase A3：Operator Controls

frontend / Wails：

- 增加有限控制动作：
  - clear transient lockout
  - re-run bounded reconcile
  - routeability recheck

限制：

- 不提供任意手工修改 candidate pool 的入口。

### 验收

- explain / probe / recent decisions 三处看到同一套 dropped reasons。
- 某个模型被 lockout 时，不会错误拖垮整个 provider。
- 某个 provider 短暂失败恢复后，可通过 bounded repair 回归可路由状态。

## B. Quota Intelligence

### 要解决的问题

- 现有 quota 信息分散在 billing、quota bars、runtime status、provider 模型能力之间。
- operator 很难区分“真没额度”“估算额度”“陈旧缓存”“上游不可验证”。

### 目标

把 quota 变成结构化、可解释、可追溯的产品能力。

### Phase B1：Quota Fact Schema

sidecar：

- 统一 quota fact：
  - `source_type`
  - `window_type`
  - `remaining`
  - `limit`
  - `confidence`
  - `freshness`
  - `risk_level`
  - `explanation`

要求：

- 支持 `observed / projected / estimated / cached / stale` 分类。

### Phase B2：Quota Aggregation DTO

Wails：

- 增加聚合视图，把 account detail、usage desk、status 需要的 quota 统一出同一种 DTO。

frontend：

- 减少各页面自己拼 quota 文案的逻辑。

### Phase B3：Quota Intelligence Views

frontend：

- 账号详情：显示 quota 真相来源与 freshness。
- usage/status：显示整体剩余额度与风险。
- 若后续需要 free-tier intelligence，则在单独区域显示方法论说明与 ToS 风险。

### 验收

- operator 能区分 `no quota`、`quota unknown`、`cached stale quota`、`provider denied quota check`。
- 同一账号在列表、详情、诊断页中看到的 quota 结论口径一致。

## C. Doctor Workbench

### 要解决的问题

- 现在很多问题要在 account detail、channel routing、sidecar.log、healthz、模型目录之间来回跳。

### 目标

形成一个统一诊断工作台。

### Phase C1：Doctor Snapshot API

sidecar / Wails：

- 增加统一 doctor snapshot：
  - sidecar ready
  - profile / config path
  - account-store schema state
  - runtime auth summary
  - routeability summary
  - model registry summary
  - quota subsystem summary
  - latest failures

### Phase C2：Doctor Checks

sidecar：

- 增加一组结构化 checks：
  - account-store startup reconcile
  - runtime auth registration
  - route guard stale block
  - model registry empty
  - provider health probe
  - local apply config mismatch

每个 check 至少返回：

- status
- reason
- repairability
- evidence

### Phase C3：Workbench UI

frontend：

- 新增 doctor 页面或 workspace。
- 支持从 check 跳转到账户详情、route decisions、local apply、status 相关页面。

### 验收

- 对 `applied but not routeable`、`catalog visible but no provider backing`、`stale route guard` 这类问题，能在 doctor 页面直接看到。

## D. Protocol Bridge

### 要解决的问题

- 未来如果需要把 GetTokens 能力开放给外部 agent，目前没有统一协议出口层。

### 目标

提供桥接而不重造运行时。

### Phase D1：Capability Surface Definition

定义第一批可桥接能力：

- list accounts summary
- list supported models
- get route diagnostics
- get quota summary
- trigger explicit safe actions

### Phase D2：Scoped Auth & Audit

bridge 层需要：

- scope model
- call audit
- safe read/write 分级

### Phase D3：Transport Adapters

按需求选择：

- MCP
- OpenAI-compatible admin surface
- A2A style task surface

限制：

- bridge 不维护独立 candidate pool。
- bridge 不拥有独立 route state。

### 验收

- 任一 bridge 调用的事实都能追溯回 sidecar authority。

## E. Extension Contract

### 要解决的问题

- 未来若要接第三方 provider 元数据、导入器或模型目录源，目前没有稳定契约。

### 目标

定义受控声明式扩展，而不是通用执行型插件。

### Phase E1：Manifest & Registry

定义 manifest：

- `kind`
- `name`
- `version`
- `compatibility`
- `permissions`
- `capabilities`
- `source`

第一批 `kind`：

- `provider-metadata`
- `model-catalog-source`
- `account-importer`
- `quota-probe`

### Phase E2：Activation Rules

sidecar / Wails：

- enable / disable
- conflict detection
- version mismatch warning

### Phase E3：Workbench Management

frontend：

- 仅提供安装状态、来源、兼容性、启停管理
- 不提供 arbitrary code 编辑器

### 验收

- 扩展冲突不会悄悄覆盖主能力。
- 未启用扩展不会影响运行时真相。

## 推荐执行顺序

1. `route-resilience-v2`
2. `quota-intelligence-dashboard`
3. `doctor-workbench`
4. `extension-contract-v0`
5. `protocol-bridge-surfaces`

## 测试门禁

### 后端

- focused unit tests
- request-path integration tests
- routeability / registry / quota 结构化字段回归

### 前端

- 纯模型测试
- detail / list / workbench 展示测试
- preview fixtures 补齐

### 验收证据

- explain / probe / doctor snapshot
- 必要时 browser headless 截图
- 对关键 runtime 改动保留 sidecar response 证据

## 停止条件

以下情况不应继续推进到下一 phase：

1. sidecar authority 还未明确，前端已经开始拼装最终事实。
2. bridge 层出现独立 route state。
3. extension contract 开始承载热路径执行代码。
4. quota intelligence 仍主要依赖前端猜测而不是结构化来源。

## 与架构文档的关系

本方案遵循总架构文档：

- [docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)

## 建议下一步

下一轮若进入实现，应只选择一个近期方向开独立 space，不要五项并行施工。

推荐首选：

1. `route-resilience-v2`
2. `quota-intelligence-dashboard`

其中 `route-resilience-v2` 优先级最高，因为它会直接增强 sidecar 真运行时，并为后续 doctor / quota 两条线提供更稳定的事实底座。
