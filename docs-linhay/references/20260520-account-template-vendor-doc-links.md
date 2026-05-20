# 账号模板厂商文档链接盘点

日期：2026-05-20

来源范围：`frontend/src/features/accounts/model/vendorPresets.ts`

## 判定原则

1. “应用模板支持”必须来自厂商官方文档、官方帮助中心或厂商明确维护的开发者文档。
2. “API 格式支持”只能说明底层可调用格式，不能直接推导为 Codex / Claude Code 应用模板。
3. Codex 动作要求厂商或 GetTokens 后续显式提供 Codex 应用模板；不能只因为存在 `openai_chat` / `openai_responses` 就自动启用。
4. Claude Code 动作要求厂商官方文档明确支持 Claude Code，或至少明确支持 Anthropic Messages API 兼容端点。
5. 找不到稳定官方文档的厂商先标记为 `needs-verification`，只保留官网或当前 preset 链接，不作为自动启用依据。
6. 未验证目标不允许在账号卡菜单中出现按钮，包括禁用态按钮；最多在详情或确认页用说明文字解释原因。

## 全局工具文档

| 工具 | 官方文档 | 用途 |
|------|----------|------|
| Claude Code settings | https://code.claude.com/docs/en/settings | `~/.claude/settings.json`、`env`、settings scope 与优先级 |
| Claude Code model configuration | https://code.claude.com/docs/en/model-config | `ANTHROPIC_MODEL`、默认模型族字段 |
| Codex config reference | https://developers.openai.com/codex/config-reference | `CODEX_HOME/config.toml`、`model_provider`、`model_providers.*`、custom provider |
| Codex auth storage source | https://github.com/openai/codex/blob/main/codex-rs/login/src/auth/storage.rs | `CODEX_HOME/auth.json` 结构：`auth_mode`、`OPENAI_API_KEY`、`tokens` |
| Codex provider auth source | https://github.com/openai/codex/blob/main/codex-rs/model-provider/src/auth.rs | provider auth 优先级：`env_key` API key、`experimental_bearer_token`、再回退 `auth.json` |
| Codex provider info source | https://github.com/openai/codex/blob/main/codex-rs/model-provider-info/src/lib.rs | `model_providers.*` schema、`wire_api = "responses"`、`requires_openai_auth`、custom provider merge |

## 厂商表

| preset | 厂商 | 当前格式 | 官方文档链接 | 应用模板结论 |
|--------|------|----------|--------------|--------------|
| `anthropic` | Anthropic | `anthropic` | https://docs.anthropic.com/en/api/messages / https://code.claude.com/docs/en/settings | Claude Code 官方；可作为 Claude Code 模板基线 |
| `deepseek` | DeepSeek | `openai_chat` + `anthropic` | https://api-docs.deepseek.com/guides/anthropic_api / https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code | 官方明确 Claude Code；未发现 Codex 官方模板。P0 只启用 Claude Code |
| `zhipu` | Zhipu GLM | `openai_chat` + `anthropic` | https://docs.bigmodel.cn/cn/coding-plan/tool/claude / https://docs.bigmodel.cn/cn/coding-plan/tool/others / https://docs.bigmodel.cn/cn/coding-plan/faq | 官方明确 GLM Coding Plan + Claude Code；未发现 Codex 官方模板。P0 只启用 Claude Code |
| `kimi` | Kimi / Moonshot | `openai_chat` + `anthropic` | https://platform.moonshot.cn/docs/guide/kimi-k2-5-quickstart / https://platform.moonshot.cn/docs/intro / https://platform.moonshot.cn/blog/posts/kimi-k2-0905 | 官方文档明确 OpenAI-compatible；K2 文档提到 Claude Code / Roo Code / Cline 使用入口。Codex 不自动启用，Claude Code 需以官方 Anthropic endpoint 文档或模板补齐后再启用 |
| `stepfun` | StepFun | `openai_chat` + `anthropic` | https://platform.stepfun.com/docs/zh/stepplan/integrations/claude-code / https://platform.stepfun.ai/docs/en/step-plan/integrations/claude-code / https://platform.stepfun.ai/docs/en/step-plan/quick-start | 官方明确 Claude Code 与 Step Plan 专用 Anthropic endpoint；未发现 Codex 官方模板。P0 只启用 Claude Code |
| `bailian` | Bailian / DashScope | `openai_chat` + `anthropic` | https://help.aliyun.com/zh/model-studio/claude-code / https://help.aliyun.com/zh/model-studio/anthropic-api-messages / https://help.aliyun.com/zh/model-studio/claude-code-coding-plan | 官方明确 Claude Code 与 Anthropic API 兼容；未发现 Codex 官方模板。P0 只启用 Claude Code |
| `minimax` | MiniMax | `openai_chat` + `anthropic` | https://platform.minimaxi.com / https://www.minimaxi.com/document | needs-verification：当前仅保留官网/文档入口；需补官方 Claude Code 或 Anthropic-compatible 具体页 |
| `doubao` | Doubao / Ark | `openai_chat` + `anthropic` | https://www.volcengine.com/docs/82379 / https://www.volcengine.com/product/doubao | needs-verification：preset 有 coding endpoint，但需补火山官方 Claude Code / Anthropic-compatible 具体页 |
| `longcat` | Longcat | `openai_chat` + `anthropic` | https://longcat.chat/platform | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `xiaomimimo` | Xiaomi MiMo | `openai_chat` + `anthropic` | https://platform.xiaomimimo.com | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `bailing` | BaiLing | `openai_chat` + `anthropic` | https://api.tbox.cn/api/anthropic | needs-verification：只保留当前 endpoint；未找到稳定官网文档页 |
| `openrouter` | OpenRouter | `openai_chat` + `anthropic` | https://openrouter.ai/docs / https://openrouter.ai/docs/guides/claude-code-integration | 官方文档存在 Claude Code integration；Codex 不自动启用，除非补 Codex 模板 |
| `siliconflow` | SiliconFlow | `openai_chat` + `anthropic` | https://docs.siliconflow.cn/cn/usercases/use-siliconcloud-in-ClaudeCode / https://docs.siliconflow.cn | 官方明确 Claude Code；Codex 不自动启用 |
| `aihubmix` | AiHubMix | `openai_chat` + `anthropic` | https://docs.aihubmix.com/en/api/Claude-Code / https://docs.aihubmix.com | 官方文档存在 Claude Code；Codex 不自动启用 |
| `shengsuanyun` | Shengsuanyun | `openai_chat` + `anthropic` | https://docs.router.shengsuanyun.com/claude-code / https://www.shengsuanyun.com | 官方文档存在 Claude Code；Codex 不自动启用 |
| `modelscope` | ModelScope | `openai_chat` + `anthropic` | https://modelscope.cn/docs / https://modelscope.cn | needs-verification：需补 ModelScope 官方 Anthropic-compatible / Claude Code 具体页 |
| `compshare` | Compshare | `openai_chat` + `anthropic` | https://www.compshare.cn / https://api.modelverse.cn | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `therouter` | TheRouter | `openai_chat` + `anthropic` | https://therouter.ai/docs / https://therouter.ai | 文档入口提到 coding tools，需要后续打开具体 Claude Code section 校准；Codex 不自动启用 |
| `novita` | Novita AI | `openai_chat` + `anthropic` | https://novita.ai/docs/guides/claude-code / https://novita.ai/docs/guides/llm-anthropic-compatibility | 官方明确 Claude Code 与 Anthropic compatibility；Codex 不自动启用 |
| `openai` | OpenAI | `openai_chat` + `openai_responses` | https://platform.openai.com/docs / https://developers.openai.com/codex/config-reference | OpenAI / Codex 官方；可作为 Codex 模板基线 |
| `groq` | Groq | `openai_chat` | https://console.groq.com/docs/openai / https://console.groq.com/docs/api-reference | OpenAI-compatible API；无 Codex 官方模板，不自动启用 Codex |
| `together` | Together AI | `openai_chat` | https://docs.together.ai/docs/openai-api-compatibility / https://docs.together.ai/reference/chat-completions-1 | OpenAI-compatible API；无 Codex 官方模板，不自动启用 Codex |
| `nvidia` | NVIDIA NIM | `openai_chat` | https://docs.api.nvidia.com/nim/reference/ / https://build.nvidia.com | OpenAI-compatible API；无 Codex 官方模板，不自动启用 Codex |
| `gemini` | Gemini Native | `gemini_native` | https://ai.google.dev/gemini-api/docs / https://ai.google.dev/gemini-api/docs/openai | Gemini native / OpenAI compatibility；不属于 Claude Code / Codex 模板，除非后续明确转换 |
| `copilot` | GitHub Copilot | `openai_chat` | https://docs.github.com/en/copilot / https://docs.github.com/en/copilot/github-copilot-chat | Copilot OAuth/产品能力；当前不作为 Codex / Claude Code 本地配置模板 |
| `aws-bedrock` | AWS Bedrock | `anthropic` | https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html / https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html | Anthropic Messages via Bedrock；Claude Code 支持需要凭证和 region 策略，不直接用普通 API key 模板 |
| `packycode` | PackyCode | `anthropic` | https://www.packyapi.com | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `cubence` | Cubence | `anthropic` | https://cubence.com | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `aigocode` | AIGoCode | `anthropic` | https://aigocode.com | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `dmxapi` | DMXAPI | `anthropic` | https://www.dmxapi.cn | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `aicodemirror` | AICodeMirror | `anthropic` | https://www.aicodemirror.com / https://api.aicodemirror.com/api/claudecode | needs-verification：只保留官网和当前 endpoint；未找到稳定官方文档页 |
| `pipellm` | PIPELLM | `anthropic` | https://code.pipellm.ai / https://cc-api.pipellm.ai | needs-verification：需补官方 Claude Code / Anthropic-compatible 具体页 |
| `katcoder` | KAT-Coder / StreamLake | `anthropic` | https://console.streamlake.ai / https://vanchin.streamlake.ai/api/gateway/v1/endpoints/EP_ID/claude-code-proxy | needs-verification：只保留控制台和当前 endpoint；需补官方文档页 |

## 当前结论

1. DeepSeek、Zhipu、StepFun、Bailian、SiliconFlow、AiHubMix、Shengsuanyun、Novita 均有明确 Claude Code 或 Anthropic-compatible 相关文档，可作为 Claude Code 模板候选。
2. OpenAI 是当前唯一明确可作为 Codex 官方模板基线的厂商。
3. OpenRouter / Kimi / TheRouter 等需要在实现前再补一轮具体页面校准，避免把“支持 OpenAI-compatible”误判成“支持 Codex 应用模板”。
4. `needs-verification` 厂商只能在 UI 中作为 preset / endpoint 预填，不应自动生成或展示本地 CLI 应用动作按钮。
5. 后续实现 resolver 时，应新增类似 `localCliTemplateTargets` 的显式字段，值由本表或后续厂商文档维护，而不是从 `supportedFormats` 反推。
6. Codex 源码校准结论：API Key 默认模式必须写 `CODEX_HOME/auth.json` 的 `auth_mode=apikey` 与 `OPENAI_API_KEY`，同时写 `CODEX_HOME/config.toml` 的 provider/model；保留 ChatGPT 登录态模式只在已有 tokens 可保留时成立，不改写 `auth.json`，只写 custom provider 的 `experimental_bearer_token` 等配置。
