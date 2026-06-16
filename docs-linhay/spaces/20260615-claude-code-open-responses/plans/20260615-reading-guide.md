# Claude Code Open Responses 研究导读

## 这份导读解决什么问题

当前 space 已经沉淀了“结论、代码证据、运行时链路、风险、测试、实施切片、沟通口径”几层材料。为了避免后续每次都从头翻文档，这里按问题类型给出最短阅读路径。

## 如果你只想知道“现在到底支不支持”

先看：

1. `README.md`
2. `plans/20260615-decision-faq.md`

你会得到当前最稳妥的结论：

- Claude Code 当前正式支持边界仍是 `anthropic` / `/v1/messages`
- 不应对外宣称“支持 open-response”
- 最多只能说当前存在部分 `messages -> chat` compat 线索，不等于 `messages -> responses`

## 如果你想看“这个结论是被哪些代码证明的”

先看：

1. `plans/20260615-code-evidence-and-test-matrix.md`
2. `plans/20260615-runtime-chain-trace.md`

这两份分别回答：

- 哪些仓库文件与测试直接支撑“当前未支持”的判断
- Claude 请求进入 sidecar 后，为什么默认更容易落到 chat，而不是 responses

如果你还想确认“这和 Claude Code 官方当前口径是否一致”，继续看：

3. `plans/20260615-official-external-evidence.md`

## 如果你想理解“为什么不能直接把参考代码当成已支持”

先看：

1. `plans/20260615-decision-faq.md`
2. `plans/20260615-counterfactual-implementation-spec.md`

重点看这几个误区：

1. local draft / DTO 映射不等于 runtime 支持
2. `responses/compact` 不能直接算 Claude compat 路径
3. 反方向 `OpenAI Responses -> Claude` translator 不能证明正方向 `Claude -> OpenAI Responses` 已经跑通
4. Claude Code 官方 gateway contract 当前也没有把 OpenAI Responses 列为正式客户端接入格式

## 如果你想决定“这事值不值得做、应该怎么排优先级”

先看：

1. `plans/20260615-options-comparison.md`
2. `plans/20260615-recommended-rollout-v1.md`
3. `plans/20260615-m1-decision-gate.md`
4. `plans/20260615-m1-file-test-mapping.md`
5. `plans/20260615-risk-assessment.md`

推荐阅读顺序是：

1. 先看方案对比，明确 A/B/C 三种路径
2. 再看推荐路线，确认为什么当前最推荐先把“不支持”的口径产品化
3. 接着看 M1 决策门，判断现在是不是值得立刻开做窄范围收口
4. 再看 M1 文件与测试映射，确认首批真正会动到哪些文件
5. 最后看风险评估，理解若进入更深实现，哪些技术点最容易炸

## 如果你准备真的开做 technical spike

先看：

1. `plans/20260615-counterfactual-implementation-spec.md`
2. `plans/20260615-test-design-table.md`
3. `plans/20260615-risk-test-evidence-mapping.md`
4. `plans/20260615-implementation-checklist-v0.md`

这组材料的分工是：

- 实现规格：先改哪里，不建议先改哪里
- 测试设计：第一批 failing tests 怎么布
- 风险映射：每个 P0/P1 风险至少用什么测试兜住
- 实施清单：按 commit 切片怎么推进、每步做到什么程度才继续

## 如果你只是要一段能发给别人看的结论

先看：

1. `plans/20260615-communication-draft.md`
2. `plans/20260615-decision-faq.md`

前者给现成话术，后者给支撑这些话术的边界解释。

## 推荐阅读路径总表

| 你的问题 | 第一份该看什么 | 第二份该看什么 |
| --- | --- | --- |
| 现在支不支持？ | `README.md` | `plans/20260615-decision-faq.md` |
| 代码证据在哪？ | `plans/20260615-code-evidence-and-test-matrix.md` | `plans/20260615-runtime-chain-trace.md` |
| 官方口径怎么说？ | `plans/20260615-official-external-evidence.md` | `plans/20260615-decision-faq.md` |
| 现在要不要立刻开 M1？ | `plans/20260615-m1-decision-gate.md` | `plans/20260615-recommended-rollout-v1.md` |
| M1 真开做会改哪些文件？ | `plans/20260615-m1-file-test-mapping.md` | `plans/20260615-m1-decision-gate.md` |
| 为什么不能说“已经支持”？ | `plans/20260615-decision-faq.md` | `plans/20260615-counterfactual-implementation-spec.md` |
| 值不值得做？ | `plans/20260615-options-comparison.md` | `plans/20260615-recommended-rollout-v1.md` |
| 真要做先从哪开始？ | `plans/20260615-counterfactual-implementation-spec.md` | `plans/20260615-implementation-checklist-v0.md` |
| 怎么对外回复？ | `plans/20260615-communication-draft.md` | `plans/20260615-decision-faq.md` |

## 当前建议

如果只是要拿到一个能指导后续讨论的稳定结论，优先读完：

1. `README.md`
2. `plans/20260615-reading-guide.md`
3. `plans/20260615-decision-faq.md`
4. `plans/20260615-recommended-rollout-v1.md`

读完这四份，基本就能回答：

- 现在支不支持
- 为什么不能把现有参考代码当成已支持
- 这件事短期该不该做
- 如果后续真做，第一步应该落在哪
