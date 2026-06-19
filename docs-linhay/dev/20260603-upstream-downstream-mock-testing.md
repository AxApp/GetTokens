# 上下游 Mock 流程测试方案

日期：2026-06-03

## 背景

后续测试流程类能力时，优先不要把真实上游、真实下游和当前流程混在一起验证。用户明确指定：通过 mock 上下游来测试这些流程，并把该方案作为后续同类测试的默认方案。

## 适用范围

适用于有清晰输入 / 输出边界的流程测试，例如：

- Wails App 调用 sidecar management API。
- sidecar 接收 Codex / Claude Code / OpenAI-compatible 请求后写入 runtime 状态。
- 前端 adapter 消费 Wails DTO 后投影为 UI model。
- 路由、账号池、quota、live sessions、配置 apply、导入导出等有外部依赖的流程。

## 标准测试形态

### 1. Mock 上游

用 fake server、stub function、fixture payload 或内存实现模拟上游输入：

- HTTP / WebSocket / management API 响应。
- 账号池快照、route guard 状态、quota 状态。
- CLI 配置文件、auth.json、settings.json。
- 时间、随机数、事件队列、并发信号。

要求：输入稳定、可读、可复现，覆盖正常、边界、异常和脏数据。

### 2. Mock 下游

不要在单元 / 流程测试里真实调用外部系统。用 spy / fake sink 记录下游行为：

- 校验调用次数、顺序和参数。
- 校验是否写入正确 payload。
- 校验失败、重试、降级、回滚或错误传播。
- 避免真实网络、真实 token、真实账号、真实第三方状态。

### 3. 只验证当前流程

测试断言聚焦当前被测流程的责任边界：

- 是否正确解析上游输入。
- 是否正确完成状态投影 / 路由决策 / DTO 映射。
- 是否正确调用下游。
- 是否对异常输入保持可诊断、可恢复或按预期失败。

## 推荐 Arrange / Act / Assert 模板

1. Arrange：构造 mock 上游输入和 fake 下游记录器。
2. Act：执行当前流程的唯一入口。
3. Assert：断言返回值、状态变化、下游调用记录、错误路径。

## 当前实践锚点

- Wails live sessions 测试通过 `app.sidecarRequest = func(...)` mock sidecar management API，上游 payload 固定，下游不触达真实 sidecar。
- 前端 live sessions adapter 测试直接喂入 Wails DTO fixture，只验证 UI model 投影，不依赖真实桌面运行态。
- 账号 cURL / quota 模板测试使用占位符和 fixture，不保存真实 Cookie / serviceToken。

## 后续执行规则

同类任务进入实现前，先判断上下游边界，并优先补一条失败测试证明：只要 mock 上游输入变化，当前流程能稳定给出预期下游行为或诊断结果。只有在单元 / 流程测试通过后，再补真实桌面、sidecar 或打包级 smoke。

每个实现 slice 开工前必须在计划或提交说明里点名本轮的 mock upstream facts 与 mock downstream / spy outputs。如果上下游 pair 说不清，说明 seam 还没打开，应停在调研或 space 计划补齐，不直接接真实服务、真实账号或真实外部请求。

## 2026-06-18 Account Budget Guard / Route Engine 应用

用户明确要求后续逐步围绕 mock upstream + mock downstream 的形式构造测试。该要求作为 Route Engine、Account Budget Guard、route guard source、quota threshold、usage calibration 等后续实现的默认测试方式。

执行要求：

1. 先用 mock upstream 固定输入事实：fake quota window、fake usage aggregator、injected clock、fake account inventory、fake live sessions、fixture request context。
2. 再用 mock downstream / spy 验证输出行为：route decision sink、fake executor、fake runtime source store、calibration ledger、Wails/frontend fixture DTO。
3. 第一批测试优先覆盖 daily / multi-day / bounded window、手动有效用量修改、quota threshold、stale/degraded 不强阻断、drain 不中断已有 stream、block 不调用 executor、calibration revoke、provider quota-empty 优先级。
4. 真实 dev App、真实账号、真实 OpenAI quota、真实 Codex 请求只作为后置 smoke，不作为第一验证路径。
5. sidecar 服务级测试必须隔离 HOME / profile / config path。优先使用 package-level TestMain、per-test 临时 profile config，或 helper 级 explicit path reset；测试不得读写真实 ~/.config/gettokens*，也不得让一个测试写入的 persisted runtime state 进入另一个测试的 mock evidence。

这一条不是只服务 Account Budget Guard。后续所有涉及 sidecar 热路径、路由决策、quota / usage、live sessions、route guard 回写的流程，都应优先按此方式先构造可复现测试。
