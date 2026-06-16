# 2026-06-15 方案对比

## 目的

把当前关于 Claude Code 与 open-response 的研究，收口成可供决策的方案对比，而不是只停留在“技术上可能”或“当前不支持”。

本次对比聚焦三条现实路径：

1. 保持现状：继续只支持 Claude Messages ingress，允许 Claude 走 `openai_chat` 类 compat，但不碰 `openai_responses`
2. 做 Claude Messages -> OpenAI Responses upstream compat
3. 明确不做，长期维持 Claude 仅 `anthropic` / `openai_chat` 边界

## 对比结论摘要

| 方案 | 结论 | 成本 | 风险 | 用户价值 | 推荐度 |
| --- | --- | --- | --- | --- | --- |
| A. 保持现状，继续只走 `messages -> chat` | 最稳妥 | 低 | 低 | 中 | 高 |
| B. 新增 `messages -> responses` compat | 能力最强 | 高 | 高 | 中高 | 中 |
| C. 明确不做，强化文档与产品边界 | 最省成本 | 很低 | 很低 | 低到中 | 中高 |

## 方案 A：保持现状，只维持 `messages -> chat`

### 定义

1. Claude Code 继续以 `/v1/messages` 作为 ingress。
2. sidecar 允许 Claude 请求通过现有 `Claude -> OpenAI Chat` translator 命中 openai-compatible chat upstream。
3. 不把 `openai_responses` 作为 Claude 的正式支持面。

### 当前证据

1. 已有 `internal/translator/openai/claude/`，说明 `Claude -> OpenAI Chat` 已存在基础能力。
2. `OpenAICompatExecutor` 当前默认就是 `/chat/completions`。
3. Claude handler / Wails probe / workbench 全都围绕 `/v1/messages` 和 `anthropic` 入口设计。

### 需要补的内容

1. 主要是文档与能力说明收口。
2. 若要提高确定性，可补一组 focused tests，证明当前 `Claude -> OpenAI Chat` 主路径在 openai-compatible 上确实可跑。
3. 不必触碰 `/responses` path。

### 优点

1. 与现有运行时和产品边界最一致。
2. 实现成本最低。
3. 不会引入新的 stream/tool call 兼容面。

### 缺点

1. 回答用户时只能说“不支持 open-response”。
2. 无法覆盖某些只提供 `/responses` 能力、没有稳定 chat 兼容的上游。

### 适用条件

1. 当前用户需求主要是“能用”，不是“协议能力最完整”。
2. 团队希望优先减少风险，而不是扩展支持面。

### 推荐度

- **高**

## 方案 B：新增 `messages -> responses` compat

### 定义

1. Claude 客户端仍然发送 `/v1/messages`。
2. GetTokens relay 内部把 Claude request 转成 OpenAI Responses request。
3. 命中 openai-compatible provider 时，上游真正收到 `/responses`。
4. 对外口径仍建议称为“Claude 通过 GetTokens relay 兼容 open-response upstream”，而不是“Claude 原生支持 open-response”。

### 当前证据

1. 反向 `OpenAI Responses -> Claude` translator 已存在，可作为部分参考。
2. `openai-response -> chat upstream` 当前已有 executor/tests，可作为 Responses 语义处理锚点。
3. 但正向 `Claude -> OpenAI Responses` 与 executor `/responses` path 当前都缺。

### 需要补的内容

1. `Claude -> OpenAI Responses` translator 注册与实现。
2. OpenAI-compatible executor `/responses` 非 compact path。
3. stream / tool call / usage / error focused tests。
4. Wails probe / explain / candidate policy。
5. UI / 文案能力标记。

### 优点

1. 协议支持面最完整。
2. 对某些更偏 Responses 的上游更友好。
3. 能把 Claude 入口和 Codex/Responses 能力部分拉平。

### 缺点

1. 实现面最广，P0 风险最多。
2. 最容易做出“文本回复能跑，但 agent/tool/stream 不稳定”的假支持。
3. 后续维护成本更高。

### 适用条件

1. 有明确用户或商业需求指向 `responses` upstream。
2. 团队愿意接受一轮较重的 runtime / translator / Wails / UI 联动改造。

### 推荐度

- **中**

## 方案 C：明确不做，强化边界

### 定义

1. 直接把当前结论产品化：
   - Claude Code 不支持 open-response
   - Claude 只认 `anthropic` ingress
   - 若要接第三方，优先走已有的 `openai_chat` / Anthropic-compatible 路线
2. 不进入 runtime 改造。

### 当前证据

1. 当前产品和 Wails 边界本来就是这么设计的。
2. 所有研究都支持这个结论。

### 需要补的内容

1. 文档、skill、前端文案、帮助说明统一口径。
2. 可选地补一份 FAQ 或内部说明，避免后续再重复研究。

### 优点

1. 成本最低。
2. 风险最低。
3. 对当前代码库几乎零扰动。

### 缺点

1. 无法满足后续若出现的真实 Responses upstream 需求。
2. 用户会继续被限制在当前协议边界内。

### 适用条件

1. 没有真实业务压力推动该能力。
2. 当前更重要的是稳定性和收口，而不是拓宽支持面。

### 推荐度

- **中高**

## 推荐方案

基于当前证据，推荐顺序是：

1. **短期推荐：方案 A**
   - 继续保持 `messages -> chat` 主路径
   - 把当前研究结论产品化
   - 若需要，再补少量 focused tests 验证现有 compat 主路径
2. **中期条件触发：方案 B**
   - 只有在出现明确用户/产品需求时才启动
   - 并且要按当前 space 里的函数级蓝图和风险评估分批做
3. **兜底方案：方案 C**
   - 如果短期完全不想投入 Claude 协议扩展，就直接强化“不支持 open-response”的稳定口径

## 不推荐的方案

### D. 直接把 Claude 也说成支持 open-response，但不改 runtime

不推荐原因：

1. 与当前证据矛盾。
2. 极易制造错误产品预期。
3. 会把后续排障成本抬高。

### E. 只改前端候选筛选，让 `openai_responses` 账号可选

不推荐原因：

1. 这会制造“UI 可选、运行时不可用”的假闭环。
2. 与当前风险评估结论冲突。

## 决策建议

如果现在就要给出决策，我建议：

1. **先采纳方案 A**
2. 把 space 现有研究作为未来方案 B 的启动包保留
3. 只有当用户明确提出“必须支持某个 Responses-only upstream”时，再进入方案 B
