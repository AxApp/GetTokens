# 2026-06-15 推荐落地路线 v1

## 目的

在已经完成现状判断、函数级蓝图、风险评估和方案对比之后，把这次 research 收口成一条可执行的后续路线，避免下次重启时又从“支不支持”重新讨论。

本路线默认遵循当前推荐结论：

1. 短期不把 “Claude Code 支持 open-response” 当成已交付能力。
2. 短期优先固化现有 `messages -> chat` compat 主路径和产品口径。
3. 只有出现明确业务需求时，才启动 `messages -> responses` compat 的技术 spike 与实现。

## 总体建议

### 推荐主线

1. **立即采用方案 A**
   - 保持 Claude Code 当前正式边界不变
   - 把 “当前不支持 open-response” 的产品与文档口径统一
   - 若担心现有 compat 可靠性不足，再补 `messages -> chat` focused tests
2. **把方案 B 作为条件触发项保留**
   - 不删除本次 research 产物
   - 后续一旦出现 Responses-only upstream 需求，直接按本路线进入技术 spike

### 不建议的动作

1. 不建议先改前端候选筛选，把 `openai_responses` 账号放进 Claude 列表。
2. 不建议只因为仓库里存在 translator 代码，就对外宣称已支持。
3. 不建议跳过 focused tests 直接做 runtime 改造。

## 里程碑拆分

## M1：研究结论产品化与现有 compat 收口

### 目标

把当前“未正式支持 open-response”的结论稳定下来，同时确认现有 `Claude -> OpenAI Chat` compat 主路径是否足够可依赖。

### 建议范围

1. 文档与口径统一
   - Claude Code 相关 space / skill / help 文案统一写明：
     - 当前正式入口是 `anthropic` / `/v1/messages`
     - 不支持 `openai_responses` 作为正式能力
     - 如第三方账号可用，也只应解释为 compat，不是原生支持
2. focused tests 补强现有主路径
   - 重点验证 `Claude -> OpenAI Chat` 的 non-stream、stream、tool_result 基本闭环
3. Wails / workbench 口径排查
   - 确认现有 UI 没有把 compat 说成 responses 支持

### 推荐测试清单

1. 现有 Claude probe 与候选筛选测试继续保持只认 `anthropic`
2. 新增或补强：
   - `Claude -> OpenAI Chat` non-stream smoke
   - `Claude -> OpenAI Chat` stream smoke
   - `Claude -> OpenAI Chat` tool_result 顺序回归

### 完成信号

1. 用户再问“支不支持 open-response”，可以稳定回答“不支持正式能力”。
2. 仓库内没有互相冲突的文档或 UI 文案。
3. 现有 compat 主路径有最小 focused test 兜底。

### 风险

1. 如果 M1 不做，后续仍会反复出现“参考代码看起来能做，所以是不是已经支持”的误判。

## M2：是否启动 Responses compat spike 的决策门

### 触发条件

以下任一条件成立，再进入 M3：

1. 出现明确用户需求，且目标上游只能稳定提供 `/responses`，不能接受 `/chat/completions`
2. 某个重要模型或服务只能通过 Responses 语义提供关键能力
3. 当前 `messages -> chat` compat 在目标场景里确认不可用，且不能通过文档边界解决

### 若未触发

1. 继续停留在 M1 完成态
2. 不进入 runtime 改造
3. 只维护现有 research 文档与测试基线

## M3：Responses compat 技术 spike

### 目标

先证明 `Claude /v1/messages -> openai-compatible /responses upstream` 在技术上能成立，再决定是否产品化。

### 建议范围

1. translator spike
   - 新增 `Claude -> OpenAI Responses` request/response transformer
2. executor spike
   - 给 `OpenAICompatExecutor` 补 `/responses` 非 compact path
3. focused tests
   - non-stream
   - stream
   - tool call / tool_result
   - usage
   - error mapping

### 强约束

1. 这一阶段先不改 Wails 候选池与前端产品文案。
2. 只有 runtime 主链路通过 focused tests，才允许进入下一阶段。

### 最小验收

1. Claude 仍从 `/v1/messages` 发请求
2. upstream 实际命中 `/responses`
3. 文本回复、stream、tool 闭环至少各有一条 focused proof

## M4：Wails / Probe / UI 产品化

### 前提

M3 已证明 runtime 主链路成立，并且团队决定把该 compat 能力暴露给用户。

### 建议范围

1. 明确 Claude channel 候选策略
   - 是否允许仅 `openai_responses` 账号进入 Claude 候选池
2. 更新 probe / explain evidence
   - 让证据能说明是 `messages ingress + responses upstream compat`
3. 更新前端能力标记与文案
   - 保持 “compat” 与 “原生支持” 的语义区分

### 最小验收

1. UI 可解释为什么某个账号能或不能用于 Claude
2. probe 证据与真实 runtime 路由一致
3. 文案不会误导为 “Claude 原生支持 open-response”

## 推荐排期视角

如果按最保守的工程节奏，推荐这样看：

1. **本期 / 1-2 天**
   - 完成 M1
2. **后续仅在需求触发时**
   - 先做 M2 决策
   - 再开 M3 technical spike
3. **只有 spike 成立后**
   - 才进入 M4 产品化

## 对当前用户问题的最终影响

按这条路线执行后，当前用户问题的稳定回答会是：

1. **现在不支持 Claude Code 对接 open-response 作为正式能力**
2. **当前最多只应视为存在 `messages -> chat` compat 的潜在线路**
3. **如果未来要支持 `messages -> responses`，已经有一套可执行的后续路线，不需要重新从零调研**
