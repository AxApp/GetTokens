# 2026-06-15 实施清单 v0

## 目的

把这份 research space 最后再往前推半步，形成一个可以直接用于未来 implementation spike 的实施清单。

这份文档不直接要求现在开做，而是回答：

1. 如果后续要做，建议按哪几个切片提交。
2. 每个切片主要动哪些文件。
3. 每个切片结束时应该跑什么验证。
4. 哪一步如果没过，就应该停下来，不要继续往后堆改动。

## 一、适用前提

只有在满足以下任一条件时，才建议进入本清单：

1. 已触发 `recommended-rollout-v1` 中的 M2/M3 条件
2. 团队已经明确决定要做 `Claude /messages -> openai-compatible /responses upstream` technical spike

如果还没有触发，就继续停留在当前 research 状态，不进入实现。

## 二、实施切片总览

| 切片 | 目标 | 主要文件 | 结束门槛 |
| --- | --- | --- | --- |
| C1 | 建立 translator request 基线 | `translator/<new-dir>/` tests + impl | Claude request 能稳定转成 Responses request |
| C2 | 建立 executor `/responses` 路径基线 | `openai_compat_executor.go` + tests | non-stream / stream 真打 `/responses` |
| C3 | 建立 tool / usage / error 闭环 | translator/executor tests | tool round-trip、usage、error 至少有 focused proof |
| C4 | 补 Wails / probe / evidence | `internal/wailsapp/*` + tests | compat 路径能被展示和解释 |
| C5 | 补前端能力标记与文案 | `frontend/src/features/claude-code/*` + tests | UI 不误导、可解释 compat |

## 三、切片明细

## C1：translator request 基线

### 目标

先证明 Claude Messages request 本身可以被翻成 OpenAI Responses request。

### 建议改动文件

1. 新增 `Claude -> OpenAI Responses` translator 注册目录
2. 新增或修改：
   - `init.go`
   - request transformer 实现
   - request tests

### 优先测试

1. `TestConvertClaudeRequestToOpenAIResponses_BasicMessageRoundTrip`
2. `TestConvertClaudeRequestToOpenAIResponses_ThinkingMapping`
3. `TestConvertClaudeRequestToOpenAIResponses_ToolUseAndToolResult`

### 建议验证命令

以 reference sidecar 工作目录为准，建议至少跑相关 translator package tests。
当前 round 不直接执行这些命令，这里只是为后续实施准备：

```bash
go test ./internal/translator/...
```

或更聚焦到新增目录。

### 通过门

1. request 结果变成 Responses `input` 结构
2. 不再生成 chat `messages`
3. thinking / tool_result 至少各有一条 focused test 变绿

### 停止条件

如果这一切片结束后，request translator 仍然无法稳定产出 Responses request，就不要进入 C2。

## C2：executor `/responses` 路径基线

### 目标

证明 executor 在 Claude compat 条件下会真实命中 `/responses`。

### 建议改动文件

1. `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/openai_compat_executor.go`
2. 对应 executor tests 文件

### 重点改动

1. 抽出 `resolveOpenAICompatTargetFormat(...)` 之类的 helper
2. non-stream path 从默认 chat 中分出 compat responses 分支
3. stream path 同样分出 compat responses 分支

### 优先测试

1. `TestOpenAICompatExecutorClaudeResponsesRequestUsesResponsesUpstream`
2. `TestOpenAICompatExecutorClaudeResponsesStreamUsesResponsesUpstream`

### 建议验证命令

```bash
go test ./internal/runtime/executor/...
```

### 通过门

1. mock upstream path 明确是 `/v1/responses`
2. non-stream / stream 两条测试都变绿
3. 不破坏现有 `responses -> chat upstream` 测试基线

### 停止条件

如果这一切片结束后：

1. stream 只能打 `/chat/completions`
2. 或 `/responses` 分支破坏了现有 compact / chat 基线

就应该停下来先整理设计，而不是继续加 Wails / UI。

## C3：tool / usage / error 闭环

### 目标

把“能打通文本回复”推进到“基本具备 agent 级可用性”。

### 建议改动文件

1. 新 translator response tests
2. executor tool / error tests
3. 必要时补 translator response 实现

### 优先测试

1. `TestOpenAICompatExecutorClaudeResponsesToolCallRoundTrip`
2. `TestConvertOpenAIResponsesToClaude_StreamUsageAndFinishReason`
3. `TestOpenAICompatExecutorClaudeResponsesErrorMapping`

### 建议验证命令

```bash
go test ./internal/translator/... ./internal/runtime/executor/...
```

### 通过门

1. tool_use / tool_result round-trip 有 focused proof
2. usage 收尾有 focused proof
3. `/responses` upstream error 能映射回 Claude 错误 envelope

### 停止条件

如果这里还没有压住：

1. tool 闭环
2. usage 对齐
3. error envelope

就不要进入 C4/C5，因为那时 UI 展示出来仍然是半成品能力。

## C4：Wails / probe / evidence

### 目标

runtime 主链路成立后，再让产品层能够解释这条 compat 路径。

### 建议改动文件

1. `internal/wailsapp/claude_code_routing_probe.go`
2. `internal/wailsapp/channel_routing.go`
3. probe tests

### 优先测试

1. `TestProbeClaudeCodeAccountRoutingAllowsResponsesCompatCandidates`
2. `TestProbeClaudeCodeAccountRoutingEvidenceMarksResponsesUpstream`

### 建议验证命令

```bash
go test ./internal/wailsapp/...
```

### 通过门

1. compat 候选策略符合产品决定
2. probe evidence 不再伪装成原生 Anthropics 直连

### 停止条件

如果仍不能把 compat 路径解释清楚，就不要进入 C5 文案收口。

## C5：前端能力标记与文案

### 目标

最终把能力暴露给用户时，不造成误解。

### 建议改动文件

1. `frontend/src/features/claude-code/model/claudeCodeAccountList.ts`
2. `frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx`
3. preview / tests / story

### 优先测试

1. `claudeCodeAccountList.test.mjs` compat case
2. workbench preview / story case

### 建议验证命令

```bash
node --test frontend/src/features/claude-code/*.test.mjs
```

必要时再加 typecheck/build。

### 通过门

1. UI 能区分：
   - 原生 anthropic
   - responses upstream compat
2. 文案不误写成“Claude 原生支持 open-response”

### 停止条件

如果这一步还需要靠大量解释才能让人看懂，说明能力标记设计还没收口，不应急着宣称支持。

## 四、推荐的 commit 节奏

为了后续回滚和 review 更清晰，建议按以下节奏切 commit：

1. `commit 1`
   - translator request + translator tests
2. `commit 2`
   - executor target/path helper + non-stream/stream tests
3. `commit 3`
   - tool / usage / error tests 与实现补齐
4. `commit 4`
   - Wails probe / evidence
5. `commit 5`
   - frontend capability label / copy / preview

## 五、每一切片的最低交付纪律

每个切片结束前都至少要做：

1. focused tests
2. `git diff --check`
3. 如涉及文档/space 变化，更新对应 space 与 memory

如果只是技术 spike，不要求每个切片都跑全量大回归；但至少要保证当前切片自己的 focused tests 和结构校验成立。

## 六、何时应该暂停而不是继续堆改动

以下任一情况出现，建议暂停，回到 research / 设计：

1. `Claude -> OpenAI Responses` request 结构始终不稳定
2. executor `/responses` path 与现有 `responses -> chat` compat 相互打架
3. tool round-trip 长时间无法闭环
4. UI 需要靠大量特殊说明才能避免误解

这说明问题已经不再是“补几条测试”的量级，而可能需要重新界定协议边界。

## 七、结论

到这一步，这个 space 已经不仅能回答“现在支不支持”，也能回答“如果决定做，第一天该怎么拆、每一步跑什么、什么时候该停”。
后续若真的进入 M3 technical spike，建议直接以这份实施清单为执行底稿。
