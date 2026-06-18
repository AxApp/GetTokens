# OpenAI Responses completed output_text 省略 Tracer Bullet

## 背景

v7.2.16 upstream 给 OpenAI Chat Completions -> OpenAI Responses 转换补了 completed response 的 `output_text` 省略测试。native Responses 风格下，最终文本应出现在 `response.output[].content[].text`；顶层 `response.output_text` / `output_text` 不应由兼容转换器额外暴露。

## 范围

- fork 代码位置：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/openai/responses/openai_openai-responses_response.go`
- fork 测试位置：`docs-linhay/references/CLIProxyAPI/internal/translator/openai/openai/responses/openai_openai-responses_response_test.go`
- upstream 参考：v7.2.16 `openai_openai-responses_response_test.go`

## 证据门禁

| 项目 | 证据 |
| --- | --- |
| 问题来源 | v7.2.16 upstream 新增 OpenAI Responses output_text 省略覆盖 |
| 当前事实位置 | fork 目前没有 `CompletedOmitsTopLevelOutputText`、`ToolCallCompletedOmitsTopLevelOutputText`、`NonStream_OmitsTopLevelOutputText` 覆盖 |
| 当前现象 | 待 focused tests 判定；不得在未红灯前实现 |
| 红灯命令 | `go test ./internal/translator/openai/openai/responses -run 'TestConvertOpenAIChatCompletionsResponseToOpenAIResponses.*OutputText' -count=1` |
| 预期验收 | 若红灯，修到绿灯并跑 affected package、full suite、diff check、clean sidecar rebuild；若直接绿灯，记录为 fork 已满足并撤销候选测试 |

## 验证结果

- 结果：already-satisfied-no-port。
- 操作：临时加入 upstream 三个 output_text 省略场景。
- focused 命令：`go test ./internal/translator/openai/openai/responses -run 'TestConvertOpenAIChatCompletionsResponseToOpenAIResponses.*OutputText' -count=1`。
- 输出：`ok github.com/router-for-me/CLIProxyAPI/v7/internal/translator/openai/openai/responses 0.450s`。
- 决策：没有红灯证据，按 reference-port 门禁不进入实现；临时测试已撤回，fork 无代码改动、无新 commit、无需 sidecar rebuild。

## BDD 场景

1. 给定 Chat Completions streaming 文本输出，当转换为 Responses `response.completed` 时，不应出现 `response.output_text`，但 `response.output.0.content.0.text` 保留完整文本。
2. 给定 Chat Completions streaming 混合文本与 function_call，当转换为 Responses `response.completed` 时，不应出现 `response.output_text`，文本和 function_call arguments 保留在 `response.output` 数组中。
3. 给定 non-stream Chat Completions response，当转换为 Responses object 时，不应出现顶层 `output_text`，但 `output.0.content.0.text` 保留文本。

## 非目标

- 不改变账号选择、route guard、rate-limit、live sessions、usage attribution、system proxy 或 management API。
- 不引入 pluginhost/pluginstore/interceptor。
- 不触碰正式版 `/Applications/GetTokens.app`。
