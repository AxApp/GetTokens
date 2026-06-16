# 2026-06-15 决策 FAQ

## 目的

把这轮研究中最容易被反复问歪的几个问题，沉淀成一份标准 FAQ。

这份文档不替代前面的证据文档、实现规格或测试设计，而是服务于两个场景：

1. 后续讨论时快速统一口径
2. 避免再次因为“某段代码看起来像支持”而从头争论

## Q1：我们现在支持 Claude Code 对接 open-response 吗？

**短答案：不支持，至少不能当作正式能力来描述。**

### 为什么

1. 当前产品边界下，Claude Code 入口仍然是 `anthropic` / `/v1/messages`
2. 没有找到 `Claude -> OpenAI Responses` 的主链路注册与 focused tests
3. OpenAI-compatible executor 默认仍走 `/chat/completions`

### 更准确的说法

当前最多只能说：

1. 仓库里存在 `messages -> chat` compat 的技术基础
2. `messages -> responses` 仍处在“可研究、可实现，但未交付”的状态

## Q2：既然仓库里已经有 Responses 相关 translator，为什么还不能算支持？

**因为方向不对。**

### 当前能找到的注册

1. `Claude -> OpenAI`
2. `OpenAI Responses -> Claude`

### 当前缺的注册

1. `Claude -> OpenAI Responses`

### 核心差别

response translator 存在，不等于 request translator 也存在。
而当前链路真正缺的是：

1. Claude request 如何被翻成 Responses request
2. executor 如何真的打到 `/responses`

## Q3：既然 local CLI draft 能给 Claude 生成配置，为什么还不能说明 runtime 支持 open-response？

**因为 local draft 只是“生成配置草稿”，不是“运行时协议闭环证明”。**

### 当前真实情况

1. 同一个账号如果同时有：
   - `openai_responses`
   - `anthropic`
2. 前端可以：
   - 为 Codex 生成 `openai_responses` draft
   - 为 Claude 生成 `anthropic` draft

### 这能证明什么

1. 同一个账号可能同时暴露多种格式
2. 不同 CLI target 会各自选自己的 source format

### 这不能证明什么

1. Claude runtime 会自动把 `/v1/messages` 转成 `/responses`
2. Claude probe / relay / executor 已经存在 Responses upstream 闭环

## Q4：为什么不能只改 UI，让 `openai_responses` 账号先出现在 Claude 列表里？

**因为这样最容易制造“UI 可选，运行时不可用”的假闭环。**

### 当前风险

如果先改 UI 而不改 runtime，会得到一种很糟的状态：

1. 用户能看到候选账号
2. 用户会以为 Claude 可以用这个能力
3. 实际请求仍然可能：
   - 打到 `/chat/completions`
   - 或根本跑不通
   - 或 tool / stream 行为错误

### 正确顺序

1. 先补 translator
2. 再补 executor `/responses` path
3. 再补 focused tests
4. 最后才开放 Wails / probe / UI

## Q5：`responses/compact` 不是已经存在了吗？为什么不能直接拿来当 Claude compat path？

**因为 `responses/compact` 是另一个旁路，不等于普通 `/responses` upstream。**

### 当前事实

1. `responses/compact` 通过 `opts.Alt == "responses/compact"` 进入
2. 它是 OpenAI Responses 的特殊压缩路径
3. 它不是“Claude `/messages` -> OpenAI Responses upstream”的正式语义

### 不能直接复用的原因

1. 它会混淆“客户端入口 path”与“upstream protocol”
2. 它不天然覆盖普通 `/responses` stream / tool / usage 闭环
3. 它的存在只能说明 executor 已经认识某种 responses 模式，不能说明 Claude compat 已成立

## Q6：为什么不能把 `alt` 继续扩展一下，直接表达 Claude compat responses？

**可以硬做，但不推荐。**

### 不推荐原因

1. `alt` 当前已经带有 `responses/compact` 既有语义
2. 如果继续往里塞：
   - `claude-responses`
   - `responses-upstream`
   之类的新含义
3. 后续就会很难区分：
   - 请求入口语义
   - 上游协议语义
   - 特殊压缩模式语义

### 更推荐的方式

通过 `opts.Metadata` 注入显式标记，告诉 executor：

1. 这次 ingress 仍是 Claude Messages
2. 但目标 upstream protocol 是 Responses

## Q7：为什么说当前更像 `messages -> chat`，而不是 `messages -> responses`？

**因为整条运行时链上有三个连续决策都站在 chat 这一边。**

### 第一处：ingress

1. Claude 入口仍是 `/v1/messages`
2. handlerType 仍是 `claude`

### 第二处：executor 默认目标

1. `OpenAICompatExecutor` 默认：
   - `to = openai`
   - path = `/chat/completions`

### 第三处：translator 注册现状

1. 有 `Claude -> OpenAI`
2. 没有同等级的 `Claude -> OpenAI Responses`

这三处叠加，默认链路自然更偏：

- `messages -> chat`

而不是：

- `messages -> responses`

## Q8：如果后续真要做，这件事最小的技术 spike 到底应该做到什么程度？

**最小 spike 不需要产品化，但必须证明 runtime 主链路成立。**

### 最小 DoD

1. 存在 `Claude -> OpenAI Responses` request translator
2. `OpenAICompatExecutor` 在指定 compat 条件下真正打 `/responses`
3. 至少一条 non-stream focused test 通过
4. 至少一条 stream focused test 通过
5. 至少一条 tool round-trip proof 成立

### 不要求

1. 不要求第一轮就改 Wails 候选池
2. 不要求第一轮就改前端文案
3. 不要求第一轮就宣称“支持 open-response”

## Q9：如果现在要给别人一句最不容易误导的话，应该怎么说？

建议统一成这句：

**GetTokens 目前不支持 Claude Code 以 open-response 作为正式上游协议；当前最多只具备 `messages -> chat` compat 的技术基础，`messages -> responses` 仍需新增 translator、executor `/responses` path 和 focused tests。**
