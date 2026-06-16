# Claude Code Open Responses M1 决策门

## 目的

当前 space 已经有：

1. 现状结论
2. 代码证据
3. 官方外部证据
4. 方案对比
5. 推荐路线
6. 后续 technical spike 的实施清单

但还缺一个“现在是否值得立刻做 M1”的明确判断门。

本文件专门回答：

1. M1 到底是不是现在就该开做
2. 如果开做，范围应该收在哪
3. 什么情况说明现在不该开，继续停留在 research 即可

## M1 的定义

这里的 M1 专指：

1. 统一产品 / 文档 / UI 口径
2. 为现有 `Claude -> OpenAI Chat` compat 主路径补最小 focused tests
3. 不进入 `messages -> responses` runtime 改造

换句话说，M1 不是“做出 open-response 支持”，而是把当前已经研究清楚的边界产品化、测试化。

## 结论先行

基于当前证据，**M1 是值得做的，但只值得按窄范围做。**

更具体地说：

1. **值得做**
   - 因为当前最现实的风险不是“少了一个新能力”，而是“边界已经存在，但口径不一致、测试不够硬”
2. **不值得扩做**
   - 不值得借 M1 名义顺手进入 `messages -> responses` compat
   - 不值得先改候选池或能力标记，把 `openai_responses` 暴露给 Claude 用户

## 为什么 M1 值得做

## 原因 1：当前误解成本已经足够高

这轮 research 里已经反复出现同一类误解：

1. 看到 translator 代码，就以为已经支持
2. 看到 local draft 能生成配置，就以为 runtime 已闭环
3. 看到 Responses 相关目录，就以为 Claude 也能走 Responses upstream

如果 M1 不做，这些误解后续还会反复出现，而且每次都要重新解释。

## 原因 2：当前产品口径和 runtime 事实之间需要一层更稳的绑定

现在我们已经能明确说：

1. Claude Code 正式入口仍是 `anthropic` / `/v1/messages`
2. 当前最多只能视为存在 `messages -> chat` compat 技术基础
3. `messages -> responses` 尚未交付

但这份结论主要沉淀在 research 文档里。
如果不进入 M1，后续产品说明、帮助文案、UI 能力解释和 focused tests 仍然可能各说各话。

## 原因 3：M1 的投入小，收益稳定

和 M3 那种 runtime spike 相比，M1 的投入面明显更窄：

1. 不改协议主链路
2. 不改 executor `/responses`
3. 不改 translator 方向
4. 主要收口文档、说明和当前 compat 基线测试

这类投入的收益不是“新增能力”，而是“减少误判、减少后续重复研究、降低沟通噪音”。

## 为什么 M1 不该扩做

## 原因 1：一旦扩到候选池或 UI 能力开放，就会越过 runtime 证据门

如果在 M1 里先让 `openai_responses` 账号出现在 Claude 候选里，会立刻制造假闭环：

1. 用户看到候选
2. 用户以为功能可用
3. 实际 runtime 仍然没有 `Claude -> OpenAI Responses` 的主链路 proof

这会直接破坏当前 research 已经建立的证据门禁。

## 原因 2：M1 的目标是“收口”，不是“偷跑 M3”

只要改动开始触碰以下任一项，就已经不再属于 M1：

1. `Claude -> OpenAI Responses` translator
2. `OpenAICompatExecutor` `/responses` path
3. Claude 候选池放开 `openai_responses`
4. UI 正式暴露 Responses compat 能力

这些都应该回到 M3/M4 处理，而不是夹带在 M1 里。

## M1 启动判断矩阵

| 判断项 | 当前状态 | 是否支持启动 M1 | 说明 |
| --- | --- | --- | --- |
| 当前正式口径是否已明确 | 是 | 是 | research + 官方外部证据都已收口到“不支持 open-response 正式能力” |
| 当前是否已有 runtime 主链路要改 | 否 | 是 | M1 不要求改 runtime 主链路 |
| 当前是否存在重复误解或重复解释成本 | 是 | 是 | 这轮已多次出现 |
| 当前是否需要先有 Responses-only 业务需求 | 否 | 是 | 这是 M3 触发条件，不是 M1 前置条件 |
| 当前是否已经有最小 focused tests 兜住 `messages -> chat` compat | 不充分 | 是 | 这正是 M1 应补的部分 |
| 当前是否应开放 `openai_responses` 给 Claude 用户 | 否 | 否 | 这不属于 M1 |

## M1 推荐范围

如果决定开做，建议只包含以下三类工作：

## 1. 口径统一

需要统一的地方：

1. Claude Code 相关 research / dev / skill 文案
2. 可能会误导的前端说明文字
3. 对外/对内答复模板

统一后的目标表达应是：

1. Claude 入口是 `anthropic` / `/v1/messages`
2. 当前不支持 `openai_responses` 作为正式能力
3. 若第三方账号可用，只解释成 compat，不解释成原生支持

## 2. focused tests 补强现有 compat 基线

优先级建议：

1. `Claude -> OpenAI Chat` non-stream smoke
2. `Claude -> OpenAI Chat` stream smoke
3. `Claude -> OpenAI Chat` tool_result 基本顺序回归

这里的目标不是证明 Responses 支持，而是给当前“最多只存在 chat compat 技术基础”的说法补一层更硬的回归证据。

## 3. UI / workbench 文案核查

只做核查和必要收口，不做能力扩展。

检查目标：

1. UI 没有把 compat 说成 responses 支持
2. 候选筛选仍然与当前运行时边界一致
3. probe / explain 不会误导成 Claude 已原生支持新协议

## M1 不应包含的内容

以下内容一旦出现，就说明任务越界了：

1. 新增 `Claude -> OpenAI Responses` translator
2. 修改 `OpenAICompatExecutor` 让 Claude compat 走 `/responses`
3. 放宽 Claude 候选池以接纳仅 `openai_responses` 账号
4. 在 UI 中新增“Responses upstream compat 已可用”的正式能力标记

## M1 的最小完成信号

如果后续真的执行 M1，至少要满足：

1. 用户再次提问时，仓库内外口径都能稳定给出同一句结论
2. 现有 Claude 相关 UI / 文案 / 文档之间没有互相打架的表述
3. `messages -> chat` compat 至少有最小 focused tests 作为回归基线
4. 不引入任何“看起来像支持 open-response”的假能力暴露

## 什么时候不该开 M1

以下情况说明当前可以继续保持 research 状态，不急着开做：

1. 团队短期完全不准备动 Claude Code 相关口径或测试
2. 当前已有更高优先级问题，且这类口径误解不会立刻造成产品/支持成本
3. 后续计划直接跳到更大的 Claude 产品调整，M1 会马上被覆盖

即便如此，也不应把这解读成“改做 M3”。
如果不做 M1，默认仍应停留在 research 结论态，而不是直接扩协议。

## 当前推荐

基于 2026-06-15 现有证据，当前最稳妥的建议是：

1. **建议开 M1**
2. **但把 M1 严格限制在口径统一 + compat 基线测试补强**
3. **不要借 M1 偷跑任何 Responses runtime 改造**

## 与其他文档的关系

1. 若要理解为什么当前结论成立，先看 `20260615-official-external-evidence.md` 与 `20260615-code-evidence-and-test-matrix.md`
2. 若要理解为什么 M1 不是 M3，先看 `20260615-recommended-rollout-v1.md`
3. 若要真的开始做更深的 compat 实现，再看 `20260615-implementation-checklist-v0.md`

## 当前状态

- 状态：research
- 最近更新：2026-06-15
