# Claude Code Open Responses Compatibility

## 背景

用户追问：GetTokens 现在到底支不支持 Claude Code 对接 OpenAI Responses / open-response 格式。

现有仓库信息显示，这件事目前存在“底层可能具备部分协议转换能力”和“产品当前明确支持边界”两套口径，容易让后续实现或对外表述混淆：

1. Claude Code 账号工作台的当前 P0 明确以 `anthropic` 作为主协议入口，而不是 `openai_responses`。
2. sidecar / translator 参考代码中已经存在 Anthropic 与 OpenAI 之间的部分转换能力，理论上可继续扩展。
3. 当前项目缺少一份专门回答“Claude Code 是否支持 open-response、如果不支持卡在哪、如果要支持需要补哪些边界”的独立研究 space。

因此本期先立项研究，不直接承诺实现。

## 目标

1. 明确 GetTokens 当前对 Claude Code + `openai_responses` 的真实支持口径：已支持、部分支持、未支持，还是仅有底层能力储备。
2. 梳理产品边界、运行时路由边界和 sidecar translator 边界，避免把“可转换”误说成“正式支持”。
3. 给出后续是否值得进入实现的判断依据，包括缺口、风险、测试门槛和验收方式。
4. 如果确认不做当前期实现，也要沉淀成明确结论，避免后续重复调研。

## 范围

- Claude Code 相关需求与已有结论：
  - `docs-linhay/spaces/20260519-claude-code-account-list/README.md`
  - `.agents/skills/gettokens-claude-code-account-list/SKILL.md`
- 账号格式与渠道筛选实现：
  - `internal/accounts/account_records.go`
  - `internal/wailsapp/channel_routing.go`
- sidecar / translator 参考实现与技术文档：
  - `docs-linhay/references/CLIProxyAPI/internal/translator/`
  - `docs-linhay/dev/20260531-codex-deepseek-cc-switch-comparison.md`
  - `docs-linhay/dev/20260519-cliproxyapi-upstream-sync-session-distillation.md`
- Claude Code local apply、路由探测、账号工作台与 supportedFormats 相关 DTO / model

本轮以研究、证据整理和方案判断为主，不在当前 space 内直接承诺代码实现。

## 非目标

1. 不在本轮直接修改 Claude Code 路由、translator 或 local apply 逻辑。
2. 不把 Codex 的 `responses` 支持结论直接套用到 Claude Code。
3. 不因为参考仓库里存在转换代码，就默认 GetTokens 已经完成产品级支持。
4. 不顺手扩写 Claude Code Skills、MCP、hooks 或通用 settings 管理。

## 验收标准

1. Given 阅读当前项目 README、space、skill 和相关代码，When 完成本轮研究，Then 能用一句明确口径回答“Claude Code 是否支持 open-response 格式”。
2. Given 存在底层 translator 代码，When 梳理边界，Then 能区分“代码可扩展能力”和“当前产品正式支持面”。
3. Given 用户后续决定实现，When 进入开发，Then space 中已经有证据门禁、缺口清单和可执行的下一步计划。
4. Given 用户后续决定不做，When 回看 space，Then 仍能看到为什么当前不做、阻塞点在哪、哪些文件支撑了这个结论。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260615-claude-code-open-responses`
- worktree：`../GetTokens-worktrees/20260615-claude-code-open-responses/`

## 相关链接

- [Claude Code 账号列表 space](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260519-claude-code-account-list/README.md)
- [账号模板映射本地 CLI 配置](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260520-account-template-cli-mapping/README.md)
- [GetTokens Claude Code Account List skill](/Users/linhey/Desktop/linhay-open-sources/GetTokens/.agents/skills/gettokens-claude-code-account-list/SKILL.md)
- [Codex DeepSeek / cc-switch 对比研究](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260531-codex-deepseek-cc-switch-comparison.md)
- [后续研究计划](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-research-and-scope.md)
- [资料导读](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-reading-guide.md)
- [官方外部证据](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-official-external-evidence.md)
- [M1 决策门](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-m1-decision-gate.md)
- [M1 文件与测试映射](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-m1-file-test-mapping.md)
- [函数级实现蓝图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-function-level-implementation-blueprint.md)
- [实现风险评估](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-risk-assessment.md)
- [方案对比](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-options-comparison.md)
- [推荐落地路线 v1](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-recommended-rollout-v1.md)
- [代码证据与测试覆盖矩阵](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-code-evidence-and-test-matrix.md)
- [运行时链路追踪](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-runtime-chain-trace.md)
- [反事实实现规格](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-counterfactual-implementation-spec.md)
- [测试设计表](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-test-design-table.md)
- [风险-测试-验收映射表](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-risk-test-evidence-mapping.md)
- [决策 FAQ](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-decision-faq.md)
- [实施清单 v0](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-implementation-checklist-v0.md)
- [沟通稿模板](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-claude-code-open-responses/plans/20260615-communication-draft.md)

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | 用户直接追问：“我们支持 claude code 对接 open-response 格式吗？”随后要求“开 space 研究这事”。 |
| 当前代码事实 1 | `accountSupportsChannel(..., "claude")` 只接受 `anthropic` 格式，不接受 `openai_responses`。 |
| 当前代码事实 2 | `resolveDefaultFormats()` 中多数第三方 provider 默认是 `anthropic + openai_chat`，而 `openai_responses` 主要落在 `codex/openai` 侧。 |
| 当前文档事实 1 | Claude Code account-list space 明确写了“本期只把 `anthropic` 作为明确 P0”。 |
| 当前文档事实 2 | 账号模板映射 space 明确写了 “P0 不实现跨协议转换”，不会把仅 `openai_chat/openai_responses` 的账号直接映射为 Claude Code 原生入口。 |
| 当前现象 | 仓库中存在 `translator/claude/openai` 与 `translator/openai/claude` 参考代码，说明底层可能存在转换能力储备，但尚未证明 GetTokens 当前产品面已接入并验收。 |
| 反证条件 | 如果后续在 GetTokens 当前主链路中找到已落地、已测试、已接入 Claude Code runtime 的 `openai_responses -> claude` 或等价通路，则需把当前“未正式支持”判断下调为“已部分支持”。 |
| 预期验收方式 | 先完成文档研究与代码证据矩阵；若进入实现，再补 focused tests、route probe 和真实请求链路验证。 |

## 当前判断

基于 2026-06-15 当前只读证据，现阶段结论已经可以收口为：

1. Claude Code 的明确产品边界仍是 `anthropic`，入口固定在 `/v1/messages`。
2. `openai_responses` 不是 Claude Code 当前正式支持口径，也没有找到 Claude `/messages` 直连 open-response upstream 的主链路证据。
3. 运行时存在 `Claude -> OpenAI Chat Completions` 的 translator / executor 线索，因此“Claude 请求转 OpenAI Chat 上游”属于可能已部分接线的技术能力。
4. 但“Claude 请求转 OpenAI Responses 上游”当前没有同等级证据，反而看到的是反方向 `OpenAI Responses -> Claude` translator。

## 运行时主链路结论

### 1. Claude Code ingress 仍然是 Anthropic Messages

已确认以下链路：

1. sidecar server 在 `/v1/messages` 挂载 `claudeCodeHandlers.ClaudeMessages`。
2. Wails `ProbeClaudeCodeAccountRouting` 构造的探测请求也是 `POST /v1/messages`。
3. Claude 渠道筛选条件仍然是 `supportedFormats` 包含 `anthropic`。

这说明“Claude Code 对接 GetTokens”在 ingress 层仍然是 Anthropic Messages 语义，不是 Responses 语义。

### 2. Claude handler 固定把 `SourceFormat` 设为 `claude`

`ClaudeMessages` 最终通过 `ExecuteWithAuthManager(..., handlerType=\"claude\")` / `ExecuteStreamWithAuthManager(..., handlerType=\"claude\")` 进入 auth manager。

这会把运行时 `SourceFormat` 固定为 `claude`。后续如果命中的是第三方 executor，本质上是“把 Claude 请求翻译到目标上游协议”，而不是让 Claude 客户端自己改说 OpenAI Responses。

### 3. 已找到 `Claude -> OpenAI Chat` 的接线

以下证据同时成立：

1. `internal/translator/openai/claude/init.go` 注册的是 `Claude -> OpenAI`。
2. `OpenAICompatExecutor` 默认 `to := openai`，endpoint 也是 `/chat/completions`。
3. `OpenAICompatExecutor` 直接调用 `TranslateRequest(from, to, ...)`，并未限制 `from=claude`。

因此，若模型 registry 把某个模型路由到 openai-compatible provider，技术上更像是：

`Claude /v1/messages` -> `SourceFormat=claude` -> translator -> OpenAI Chat Completions upstream

### 4. 没有找到 `Claude -> OpenAI Responses` 的主链路

当前看到的相反证据是：

1. `internal/translator/claude/openai/responses/init.go` 注册的是 `OpenaiResponse -> Claude`，不是 `Claude -> OpenaiResponse`。
2. `OpenAICompatExecutor` 只有在 `opts.Alt == \"responses/compact\"` 时才把 `to` 切到 `openai-response`；普通执行与流式执行都固定走 `/chat/completions`。
3. Claude handler 当前没有 `responses` 或 `responses/compact` 入口，也没有给 `Execute*WithAuthManager` 传入对应 `Alt`。
4. 没有搜到覆盖 `OpenAICompatExecutor + SourceFormat=claude` 的 focused tests，更没有搜到覆盖 “Claude -> OpenAI Responses upstream” 的 handler / executor tests。

因此目前更合理的判断是：

- **Claude Code 当前不支持“以 open-response 作为上游主协议”**
- **Claude Code 最多可能通过 translator 复用 openai_chat 类上游**
- **open-response 相关代码更多是在服务 Codex / OpenAI Responses 客户端，或服务 `OpenAI Responses -> Claude` 方向**

## 研究分层结论矩阵

| 层级 | 当前结论 | 说明 |
| --- | --- | --- |
| 产品口径 | 未支持 | Claude Code 明确口径仍是 `anthropic`，未宣称 `openai_responses`。 |
| 客户端 ingress | 未支持 | Claude 入口固定 `/v1/messages`，不是 `/v1/responses`。 |
| Translator 能力 | 部分存在 | 已有 `Claude -> OpenAI Chat` 与 `OpenAI Responses -> Claude`，但未见 `Claude -> OpenAI Responses` 主路径注册被运行时消费。 |
| Executor 接线 | 未完成 | OpenAI-compatible executor 对 Claude 源格式未见 focused coverage，且常规 path 只打 `/chat/completions`。 |
| 测试与验收 | 不足 | 未找到“Claude 请求打 open-response upstream” 的 focused tests 或真实链路证据。 |

## 文件级实现缺口表

如果后续决定支持“Claude `/messages` 经 GetTokens relay 转到 open-response 上游”，至少要补以下缺口：

| 层级 | 当前事实 | 缺口 | 可能涉及文件 |
| --- | --- | --- | --- |
| Ingress | Claude handler 只暴露 `/v1/messages` | 不一定需要新入口，但必须明确继续复用 `/v1/messages` 还是新增兼容入口 | `internal/api/server.go`、`sdk/api/handlers/claude/code_handlers.go` |
| 渠道路由 | Claude 候选只认 `anthropic` | 若要让仅 `openai_responses` 账号参与 Claude，需决定是否修改候选筛选与缺省文案 | `internal/wailsapp/channel_routing.go`、`internal/wailsapp/claude_code_routing_probe.go`、`frontend/src/features/claude-code/model/claudeCodeAccountList.ts` |
| Translator 注册 | 已有 `Claude -> OpenAI Chat`，没有主链路 `Claude -> OpenAI Responses` | 需要新增或确认 `Claude -> OpenAI Responses` 注册方向、request/response transformer | `internal/translator/openai/...`、`internal/translator/claude/openai/responses/`、`internal/translator/init.go` |
| Upstream executor | OpenAI-compatible executor 默认走 `/chat/completions`；只在 `responses/compact` 走 `openai-response` | 需要为 Claude 源格式新增 `/responses` 非 compact path，而不只是 chat path | `internal/runtime/executor/openai_compat_executor.go` |
| Probe / Explain | Claude probe 固定 `POST /v1/messages` 且只筛 `anthropic` | 若支持 compat 模式，要决定 probe 如何识别“消息入口 + responses upstream”并给出证据 | `internal/wailsapp/claude_code_routing_probe.go`、相关前端 Feature |
| UI / 文案 | Claude 页面明确写“只收 anthropic” | 需要改账号列表、workbench 文案和能力标记，避免把 compat 能力说成原生支持 | `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx`、`previewData.ts`、tests |
| 测试 | 现有测试只证明 Claude probe 打 `/v1/messages`，没有证明 responses upstream | 需要补 handler / executor / translator focused tests，以及至少一条主链路 smoke | `internal/wailsapp/claude_code_routing_probe_test.go`、`internal/runtime/executor/*test.go`、translator tests |

## 建议的最小实现顺序

1. 先做架构决策：
   - 是否允许 Claude channel 接纳仅 `openai_responses` 的账号
   - 是否对外只宣称“relay compat”，不宣称“Claude 原生支持 open-response”
2. 再补运行时主路径：
   - `Claude -> OpenAI Responses` translator 注册
   - OpenAI-compatible executor `/responses` path
3. 再补 focused tests：
   - non-stream
   - stream
   - tool call / tool_result
   - usage
   - error mapping
4. 最后再改 Wails probe / explain / UI 文案与能力标记。

## 验收清单草稿

若后续进入实现，至少需要以下证据才可宣称支持：

1. Claude 客户端仍以 `/v1/messages` 请求 GetTokens。
2. sidecar 命中 openai-compatible auth 后，上游实际收到 `/responses`，不是 `/chat/completions`。
3. 非流式响应能正确回到 Claude Messages 语义。
4. 流式响应事件顺序、收尾事件和 usage 字段正确。
5. tool call / tool_result 能双向闭环。
6. Wails probe / explain 能识别命中的是 responses upstream compat 路径。
7. Claude 账号列表和详情不会再把该能力描述成仅 `anthropic`。

## 下一步问题清单

1. 如果产品真要做，应决定目标是：
   - A. “Claude Code 客户端仍说 `/messages`，GetTokens 代转 open-response upstream”
   - B. “Claude Code 直接拥有 open-response 能力标记”
2. 若走 A，需要补：
   - `Claude -> OpenAI Responses` translator 注册与实现
   - OpenAI-compatible executor 的 Responses 非 compact path
   - streaming / tool call / usage / error 兼容测试
3. 需要决定 Claude channel 候选筛选是否允许仅 `openai_responses` 账号进入，还是仍要求 `anthropic` 作为入口格式。
4. 需要决定 UI 如何表达这是一条“兼容转换能力”，而不是“Claude 原生支持格式”。
5. 需要补一组 focused tests 证明该能力真在主链路上，而不是参考 translator 代码存在。

## 当前状态
- 状态：research
- 最近更新：2026-06-15
