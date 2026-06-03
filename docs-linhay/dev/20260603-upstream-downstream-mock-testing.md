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
