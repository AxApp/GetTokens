# Claude Code 官方默认模型 Profile

## 目的

本文件只记录 Claude Code 账号列表的一期官方默认模型来源。

边界：

- 官网给出的默认值就是 `ProviderDefaultModelProfile` 的权威值。
- 官网列出的其他模型只叫“官方可切换模型”，不叫默认候选。
- 本地 `cc-switch` / GetTokens 旧预设只用于迁移差异提示，不参与已有官网来源厂商的默认值决策。
- 远端 `/models` 只能刷新可切换模型集合，不能覆盖官网默认值或用户已保存映射。

## Profile 结构

```ts
type ProviderDefaultModelProfile = {
  providerId: string;
  providerName: string;
  source: 'official' | 'cc-switch' | 'gettokens-preset' | 'remote-models' | 'user';
  sourceUrl?: string;
  checkedAt: string;
  confidence: 'high' | 'medium' | 'fallback' | 'conflict';
  baseUrl?: string;
  apiKeyField?: 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY';
  models: {
    main?: string;
    haiku?: string;
    sonnet?: string;
    opus?: string;
  };
  localApplyExtraEnv?: Record<string, string>;
  officialAlternatives?: string[];
  legacyPresetValues?: string[];
  notes?: string[];
};
```

保存规则：

- profile 可一键填充 Claude Code local apply 字段。
- profile 可生成 relay 模型映射草稿，保存时仍走 `models[].name + alias` 或 `oauth-model-alias[channel=claude]`。
- 已保存的用户映射优先级最高；profile 更新只能提示，不自动覆盖。
- `localApplyExtraEnv` 只写 Claude Code 本地 env，不写 relay 模型映射。

## 官方默认值表（2026-06-16）

| providerId | 官方默认值 | 官方来源 | 旧预设差异与处理 |
|------------|------------|----------|------------------|
| `anthropic` | 官方 Claude Code 支持 `opus` / `sonnet` / `haiku` 别名，`ANTHROPIC_DEFAULT_*_MODEL` 可 pin 具体模型；官方示例包括 `claude-opus-4-7`、`claude-sonnet-4-5`。 | https://code.claude.com/docs/en/model-config | GetTokens 旧建议 `claude-sonnet-4-6`、`claude-opus-4-7`、`claude-haiku-4-5` 只作为旧配置对比。 |
| `deepseek` | `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`；`main/sonnet/opus=deepseek-v4-pro[1m]`；`haiku=deepseek-v4-flash`；额外 local apply：`CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash`、`CLAUDE_CODE_EFFORT_LEVEL=max`。 | https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code | `cc-switch` / GetTokens 旧值为 `deepseek-v4-pro`，缺少 `[1m]` 和 subagent/effort；旧值只作迁移提示。 |
| `bailian-token-plan` | `ANTHROPIC_BASE_URL=https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic`；`main/haiku/sonnet/opus=qwen3.6-plus`。 | https://help.aliyun.com/zh/model-studio/claude-code 与控制台文档 `url=2949529` | 旧预设没有 Token Plan 独立 profile；需新增。 |
| `bailian-coding-plan` | `ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic`；`main/sonnet/opus=qwen3.6-plus`；`haiku=qwen3.6-flash`。 | https://help.aliyun.com/zh/model-studio/claude-code 与控制台文档 `url=2949529` | `cc-switch` 只填 base URL；GetTokens 旧模型建议为 `qwen3.5-*`，需要迁移提示。 |
| `bailian-payg` | `ANTHROPIC_BASE_URL=https://dashscope.aliyuncs.com/apps/anthropic`；`main/sonnet/opus=qwen3.6-plus`；`haiku=qwen3.6-flash`。 | https://help.aliyun.com/zh/model-studio/claude-code | 旧模型建议为 `qwen3.5-*`，需要迁移提示。 |
| `kimi` | `ANTHROPIC_BASE_URL=https://api.moonshot.cn/anthropic`；`ANTHROPIC_AUTH_TOKEN=${YOUR_MOONSHOT_API_KEY}`；`main/haiku/sonnet/opus=kimi-k2.7-code`；官方额外建议 `ENABLE_TOOL_SEARCH=false`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW=262144`。 | https://platform.moonshot.cn/docs/guide/agent-support | GetTokens 旧值 `kimi-k2.6` / `kimi-k2.5` 只作迁移提示；当前默认值以官网 K2.7 Code 为准。 |
| `minimax` | 国际 `https://api.minimax.io/anthropic`，中国 `https://api.minimaxi.com/anthropic`；`ANTHROPIC_AUTH_TOKEN=$MiniMax_API_KEY`；`main/haiku/sonnet/opus=MiniMax-M3`；`API_TIMEOUT_MS=3000000`。 | https://platform.minimax.io/docs/token-plan/claude-code | 旧值 `MiniMax-M2.7` 只作迁移提示；中国区账号默认使用 `api.minimaxi.com`。 |
| `doubao` | `ANTHROPIC_BASE_URL=https://ark.cn-beijing.volces.com/api/coding`；`ANTHROPIC_MODEL` 可填 `ark-code-latest` 或具体 `Model_Name`。 | https://www.volcengine.com/docs/82379/1928262 | 本地 `doubao-seed-2-0-code-preview-latest` 不作为官网默认，只作旧预设迁移提示。 |
| `xiaomimimo` | `ANTHROPIC_BASE_URL=https://api.xiaomimimo.com/anthropic`，Token Plan 可使用专属 Base URL；`main/haiku/sonnet/opus=mimo-v2.5-pro`。 | https://platform.xiaomimimo.com/docs/zh-CN/integration/claudecode | GetTokens 当前为 `mimo-v2-pro`，需要迁移提示。 |
| `zhipu` | `ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic`；`ANTHROPIC_AUTH_TOKEN=your_zhipu_api_key`；推荐 `API_TIMEOUT_MS=3000000`；模型切换示例为 `haiku=glm-4.5-air`、`sonnet/opus=glm-5.2[1m]`，1M 上下文需要 `[1m]` 后缀。 | https://docs.bigmodel.cn/cn/coding-plan/tool/claude | 已从未确认升级为官方 Coding Plan profile；local apply 可直连账号自身 API Key 与 Anthropic Base URL。 |
| `stepfun` | `ANTHROPIC_BASE_URL=https://api.stepfun.com/step_plan`；`ANTHROPIC_AUTH_TOKEN=<STEPFUN_API_KEY>`；模型填 StepFun 模型 ID，当前默认采用 `step-3.7-flash`。 | https://platform.stepfun.com/docs/llm_tools/claude_code | 已从 `cc-switch` fallback 升级为官方 Step Plan profile；local apply 可直连账号自身 API Key 与 Anthropic Base URL。 |
| `z-ai` | 未确认官方 Claude Code env 示例；只确认模型页存在 `glm-5.1`、`glm-5`、`glm-5-turbo` 等模型。 | https://docs.z.ai/guides/llm/glm-5.1 | 继续使用 `glm-5` 作为 `preset-fallback`，直到找到 Claude Code 官方配置或账号 `/models` 验证。 |
| `modelscope` / `kat-coder` / `longcat` / `bailing` / `siliconflow` | 未确认到比 `cc-switch` 更权威的 Claude Code env 官方页。 | 本地参考项目 `cc-switch` | 标记 `preset-fallback`，UI 显示“来自参考项目，建议刷新远端模型确认”。 |

## 官方可切换模型

这些模型来自官网说明，但不是默认值。

| providerId | 官方可切换模型 | 说明 |
|------------|----------------|------|
| `doubao` | `doubao-seed-2.0-code`、`doubao-seed-2.0-pro`、`doubao-seed-2.0-lite`、`doubao-seed-code` | 火山方舟文档列出的可用 `Model_Name`。 |
| `xiaomimimo` | `mimo-v2.5-pro[1m]`、`mimo-v2.5`、`mimo-v2.5-tts` | `mimo-v2.5-pro[1m]` 是长上下文变体；`mimo-v2.5` / `mimo-v2.5-tts` 是 Token Plan 总览列出的可手动切换模型。 |

## 实现注意

- `ANTHROPIC_DEFAULT_*_MODEL` 是 Claude Code local apply 字段，不等同于 relay 持久模型映射。
- relay 映射草稿的 alias 目标来自用户当前选择的 Claude Code alias 集，例如 `claude-sonnet-4-6` / `claude-opus-4-7` / `claude-haiku-4-5`。
- 若用户选择把 local apply 直接写成厂商真实模型，可以不生成 relay alias，保持同名透传。
- 控制台 hash 文档链接作为官方来源保留，但实现时优先使用可公开抓取页面或后台文档 API 校准正文。
