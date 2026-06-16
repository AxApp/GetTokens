# OmniRoute 借鉴机会清单 v01

## 结论摘要

`OmniRoute` 最值得 GetTokens 借鉴的不是“177 providers / 50+ free tiers”这种规模化包装，而是它把以下能力做成了产品化与工程化闭环：

1. 路由弹性
2. 配额与 free-tier 解释
3. 统一诊断入口
4. 运行态可观测性与治理文档
5. 多协议出口
6. 扩展边界设计

同时，不建议把 `OmniRoute` 整包作为内嵌插件服务并入 GetTokens，也不建议优先复制其通用 JS hook 插件系统。

## 证据与判断边界

### 问题来源

- 用户要求评估 `OmniRoute` 是否能作为插件服务直接集成到 GetTokens app 内，并进一步判断其值得借鉴的功能。

### 参考事实位置

- 本地参考仓库：`docs-linhay/references/OmniRoute/`
- 插件系统：
  - `src/lib/plugins/manifest.ts`
  - `src/lib/plugins/hooks.ts`
  - `src/lib/plugins/manager.ts`
- 路由与能力总览：
  - `README.md`
  - `docs/routing/AUTO-COMBO.md`
  - `docs/architecture/RESILIENCE_GUIDE.md`
- GetTokens 边界：
  - `AGENTS.md`
  - `docs-linhay/dev/20260524-account-routing-engine.md`

### 当前现象 / 缺口

- GetTokens 已有 sidecar、账号池、route guard、quota、live sessions、local apply 等关键积木，但还没有一份“外部产品能力借鉴映射清单”来判断什么值得吸收、什么应该排除。
- GetTokens 目前也没有统一的“扩展系统设计边界”，容易把“可借鉴能力”和“要不要做通用插件系统”混在一起讨论。

### 本轮验收方式

- 形成分层机会清单，明确优先级、落位边界与不建议事项，供后续独立 space 拆分。

## 最值得借鉴

### P1. 路由弹性模型

建议借鉴内容：

- provider 级熔断
- model 级 lockout
- quota / health / latency / success-rate 多因子评分
- fallback 不再只是线性主备，而是结构化 route resilience

借鉴理由：

- 这和 GetTokens 当前 sidecar 的 route guard、session affinity、quota-empty、manual-disabled、runtime state 边界天然贴合。
- 能直接增强运行时稳定性，不需要改变产品定位。

建议落位：

- sidecar 为主
- Wails 只负责配置与解释
- 前端负责观测与控制台呈现

建议后续 space：

- `route-resilience-v2`

### P1. 配额与 free-tier 解释面板

建议借鉴内容：

- 配额估算口径公开
- free-tier 来源、重置周期、ToS 风险分层展示
- “还能用多少”与“为什么这样算”并存

借鉴理由：

- GetTokens 当前已具备 quota、billing、runtime usage 和 account inventory 基础，但缺少一套可解释的产品层表达。
- 这会明显提升账号工作台和 status / usage desk 的信任感。

建议落位：

- sidecar 提供结构化 quota / source / risk 元数据
- Wails 负责 DTO 聚合
- 前端负责 dashboard/workbench 视图

建议后续 space：

- `quota-intelligence-dashboard`

### P1. 统一诊断入口

建议借鉴内容：

- 类似 `doctor` 的统一诊断命令 / 页面
- provider test、模型同步状态、proxy 可达性、auth 健康、sidecar readiness 一站式定位

借鉴理由：

- GetTokens 已经有不少单点观测能力，但问题定位仍分散在多个页面、日志和手工排查中。
- 统一诊断入口可以显著降低支持与自助排障成本。

建议落位：

- sidecar 和 Go core 提供探针
- 前端增加“诊断工作台”

建议后续 space：

- `doctor-workbench`

## 中期值得做

### P2. 协议出口统一

建议借鉴内容：

- 用统一能力面向外暴露 OpenAI-compatible / MCP / A2A 风格入口

借鉴理由：

- 若未来 GetTokens 要把账号池、模型选择、运行态诊断开放给外部 agent，这是自然演进方向。
- 但当前不应抢在 sidecar 核心稳定性之前。

建议落位：

- sidecar 或独立 bridge 层
- 不建议前端先行伪造协议能力

### P2. 扩展边界设计

建议借鉴内容：

- manifest
- 权限声明
- lifecycle
- install / enable / disable 语义

借鉴理由：

- 这套思想适合帮助 GetTokens 定义自己的扩展边界。
- 但实现形态不应直接复用 OmniRoute 的 JS hook 体系。

建议落位：

- 先做声明式 extension contract
- 第一阶段仅允许 provider adapter、model catalog source、account importer、quota probe 之类受控扩展

## 明确不建议照搬

### 不建议 1. 整包内嵌 OmniRoute 服务

原因：

- 会引入第二套运行态真源，与 GetTokens sidecar 自治边界冲突。
- 运行时路由、fallback、quota 解释和协议转换容易出现双重决策源。

### 不建议 2. 优先做通用 JS hook 插件系统

原因：

- OmniRoute 的 `onRequest/onResponse/onError` hook 很适合它自己的 Node 网关，但对 GetTokens 来说会把最敏感的热路径脚本化。
- 这会增加稳定性、权限控制和调试成本。

### 不建议 3. 优先复制大规模 provider catalog

原因：

- GetTokens 当前更需要高质量、可解释、与本地账号池强绑定的 provider 支持。
- 数量型 catalog 会稀释当前产品重心。

### 不建议 4. 先把 token compression 做成主线

原因：

- 这是 OmniRoute 的亮点，但对 GetTokens 当前主线价值不如 route resilience、quota intelligence、doctor workspace 直接。

## 推荐优先级

### 低成本高收益

1. `route-resilience-v2`
2. `quota-intelligence-dashboard`
3. `doctor-workbench`

### 中期可做

1. `extension-contract-v0`
2. `protocol-bridge-surfaces`

### 明确暂不做

1. `omniroute-embedded-service`
2. `generic-js-hook-marketplace`
3. `mass-provider-catalog-clone`

## 后续拆分建议

如果继续推进，建议按以下顺序独立开 space：

1. `route-resilience-v2`
2. `quota-intelligence-dashboard`
3. `doctor-workbench`
4. `extension-contract-v0`

每个后续 space 进入实现前，都应补齐：

- 问题来源
- 当前代码 / UI 事实位置
- 预期验收方式
- 不成立时的反证条件
