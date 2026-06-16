# OmniRoute 借鉴能力架构文档

日期：2026-06-15

## 背景

基于本地参考项目 `diegosouzapw/OmniRoute` 的能力评估，GetTokens 确认值得继续推进以下五条能力线：

1. `route resilience`
2. `quota intelligence`
3. `doctor workbench`
4. `protocol bridge`
5. `extension contract`

其中前 3 项属于近期高价值能力，后 2 项属于中期建设方向。

本文件不讨论是否“整包集成 OmniRoute”。该问题已经定性为否：GetTokens 不引入第二套运行态真源，也不把 OmniRoute 的 Node 网关或 JS hook 插件系统直接嵌入现有桌面架构。

## 目标

1. 统一这 5 条能力线的架构边界。
2. 明确 sidecar、Wails core 和 frontend workbench 的职责分工。
3. 给后续每条能力开独立 space 时提供稳定的上位设计基线。

## 非目标

- 不实现 OmniRoute 风格的 provider 大市场。
- 不开放请求热路径的任意脚本 hook。
- 不把路由真相放到前端或 Wails 本地推演为主。
- 不为“协议出口”牺牲 sidecar 自治边界。

## 总体判断

GetTokens 应借鉴 OmniRoute 的方式，而不是借鉴它的包装。

应该吸收的是：

- 更强的运行时弹性
- 更可解释的配额与风险表达
- 更完整的诊断入口
- 更清晰的协议出口层
- 更受控的扩展边界

不应吸收的是：

- 第二套运行时路由中心
- 通用 JS hook 热路径插件体系
- 以 provider 数量驱动的产品方向

## 核心原则

### 1. sidecar 是唯一运行时真源

账号选择、route guard、session affinity、quota、requestability、live sessions、fallback 结果都必须优先在 sidecar 边界内闭环。

frontend 和 Wails 可以：

- 展示
- 配置
- explain
- probe
- 聚合 diagnostics

但不能重新定义运行时事实。

### 2. 诊断与控制分离

可观测性面板可以比运行时决策更丰富，但不得反向成为热路径真源。

例如：

- Doctor workbench 可以展示“某账号为什么不可请求”
- Quota intelligence 可以展示“这条额度结论来自哪个 provider”

但真正的 requestable / selected / fallback 决策仍由 sidecar 输出。

### 3. 扩展先声明式，后执行式

GetTokens 若做扩展系统，第一阶段只允许声明式、受控型扩展：

- provider adapter metadata
- model catalog source
- quota probe
- account importer

不允许第一阶段就引入：

- onRequest/onResponse 任意脚本 hook
- 外部代码直接插入 sidecar 热路径
- 运行时可变更的自定义 selector 执行代码

### 4. 协议出口是桥，不是第二运行时

OpenAI-compatible / MCP / A2A 等协议出口只负责把 GetTokens 自己的能力暴露出去，不能在桥层重新做一套候选池、quota 判定或 fallback 策略。

### 5. 每一条能力都必须独立可上线

这五条能力必须能拆成互不依赖的可合并阶段：

- Route resilience 先增强 sidecar，不等 doctor workbench。
- Doctor workbench 可先消费已有 diagnostics，不等 protocol bridge。
- Extension contract 可先只支持 manifest 与 registry，不等 marketplace。

## 目标架构

```text
                         +----------------------+
                         |   Frontend Workbench |
                         |----------------------|
                         | Accounts / Status    |
                         | Codex / Claude       |
                         | Usage / Doctor       |
                         +----------+-----------+
                                    |
                                    | Wails bindings / DTOs
                                    v
                         +----------------------+
                         |     Wails / Go Core  |
                         |----------------------|
                         | Config patch         |
                         | DTO aggregation      |
                         | Local CLI apply      |
                         | Diagnostics bridge   |
                         | Protocol bridge ctrl |
                         +----------+-----------+
                                    |
                                    | management API / runtime queries
                                    v
                         +----------------------+
                         |   GetTokens Sidecar  |
                         |----------------------|
                         | Route resilience     |
                         | Quota truth          |
                         | Runtime auth/model   |
                         | Live sessions        |
                         | Route diagnostics    |
                         | Bridge backend       |
                         | Extension registry   |
                         +----------+-----------+
                                    |
                                    | upstream providers / local runtimes
                                    v
                    +---------------------------------------+
                    | Providers / Local Files / Bridge Peers|
                    +---------------------------------------+
```

## 五条能力的落位

### A. Route Resilience

定位：

- sidecar 主能力

职责：

- candidate scoring
- circuit breaker / model lockout
- quota-empty / auth-error / upstream-error 分层
- bounded repair 与 routeability 恢复
- route decision ledger

Wails / frontend 只做：

- explain
- probe
- recent decisions
- operator controls

### B. Quota Intelligence

定位：

- sidecar 产出事实
- Wails 聚合
- frontend 产品化表达

职责：

- quota source normalization
- reset window / remaining / confidence / risk
- free-tier / paid-tier / local projection 标记
- stale / degraded / estimated 分类

### C. Doctor Workbench

定位：

- Wails + frontend 主能力
- sidecar 提供探针与结构化 diagnostics

职责：

- 统一排查入口
- sidecar readiness
- provider health
- model registration
- routeability split-brain
- proxy / auth / local apply consistency

### D. Protocol Bridge

定位：

- sidecar 或 Go core 边界能力

职责：

- 统一向外暴露 GetTokens 自己的能力
- 协议适配
- scope / auth / audit

限制：

- 不在桥层新建 route engine
- 不在桥层保存独立 candidate state

### E. Extension Contract

定位：

- sidecar registry + frontend 管理界面

职责：

- manifest
- capability type
- permission boundary
- enable / disable
- version / compatibility

限制：

- 第一阶段不运行任意热路径执行代码

## 共享基础设施

这五条能力后续应尽量复用一套共享底座：

### 1. Runtime Diagnostics Schema

统一 sidecar 输出的诊断结构：

- status
- reason
- source
- confidence
- repairable
- lastCheckedAt
- evidenceRefs

它应服务：

- account runtime detail
- quota intelligence
- doctor workbench
- protocol bridge diagnostics

### 2. Route Decision Ledger

统一记录最近真实路由决策：

- request id
- provider
- channel
- model
- selected account
- candidate pool summary
- dropped reasons
- final outcome

它应服务：

- route resilience explain
- doctor workbench
- protocol bridge auditing

### 3. Capability Registry

统一保存本地声明式扩展和协议能力注册：

- capability type
- source
- enabled state
- compatibility version
- schema / metadata

它应服务：

- extension contract
- protocol bridge discovery

## 数据边界

### sidecar-owned

- routeable truth
- candidate pools
- runtime auth state
- registry model availability
- quota raw facts
- route guard facts
- route decisions
- extension registry runtime view

### Wails-owned

- local file patching
- desktop integration state
- UI-facing aggregation DTO
- local preview / draft mapping

### frontend-owned

- workbench interaction state
- filters
- sorting
- panel layout
- preview fixtures

frontend 不拥有：

- requestability 真相
- runtime selection truth
- quota authority

## 安全边界

### 不做脚本热插拔路由

任何可修改请求热路径的扩展能力都必须延后，除非后续明确引入沙箱、签名、回滚与审计机制。

### 桥接能力最小授权

Protocol bridge 必须支持最小 scope：

- 只读诊断
- 只读模型目录
- 只读账号状态
- 显式允许的本地 apply / mutate

### 扩展契约先白名单能力

第一阶段 capability type 应采用白名单，不支持任意自定义 hook 名称。

## 推荐演进顺序

1. `route resilience`
2. `quota intelligence`
3. `doctor workbench`
4. `extension contract`
5. `protocol bridge`

原因：

- 前 3 项直接增强现有核心价值。
- `extension contract` 可以为后续桥接和外部能力接入打基础。
- `protocol bridge` 最后做，可以复用前面已经稳定的 diagnostics / registry / route truth。

## 验收基线

后续任何一条能力线立项，都必须回答以下问题：

1. 运行时真相落在哪一层？
2. 哪些字段是 sidecar authority？
3. Wails 只是搬运，还是有本地聚合逻辑？
4. 前端是否错误地重新推导了运行时真相？
5. 若 sidecar 失败，这条能力如何降级？

## 与本轮 space 的关系

对应调研与机会清单见：

- [docs-linhay/spaces/20260615-omniroute-capability-review/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/README.md:1)
- [docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-opportunity-list-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-opportunity-list-v01.md:1)
