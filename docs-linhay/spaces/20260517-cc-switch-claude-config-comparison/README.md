# cc-switch vs GetTokens: Claude 配置切换对比

## 背景

cc-switch 是多 CLI 供应商配置管理器，GetTokens 是账号池/relay/workbench 定位的工具。两者都有 Claude Code 配置写入能力，但模型和覆盖范围不同。

本 space 聚焦一个具体问题：**有厂商直接适配了 Anthropic Messages API，是不是不走格式转换？**

简答：**是。** 绝大多数已适配 Claude Code 的厂商（DeepSeek、智谱、百炼、Kimi、MiniMax、豆包等）都提供了 Anthropic Messages API 兼容端点，cc-switch 和 Claude Code 直接透传请求，不做格式转换。

---

## cc-switch 的格式转换模型

### apiFormat 字段

cc-switch 在 `ProviderMeta.apiFormat` 中定义 4 种 API 格式：

| apiFormat | 含义 | 是否需要转换 |
|-----------|------|-------------|
| `"anthropic"` (默认) | 原生 Anthropic Messages API 格式 | **否，直接透传** |
| `"openai_chat"` | OpenAI Chat Completions 格式 | **是，需要 Anthropic↔OpenAI 转换** |
| `"openai_responses"` | OpenAI Responses API 格式 | **是，需要 Anthropic↔Responses 转换** |
| `"gemini_native"` | Gemini generateContent API 格式 | **是，需要 Anthropic↔Gemini 转换** |

### 格式判定优先级

`get_claude_api_format()` (`src-tauri/src/proxy/providers/claude.rs:25`):

1. **Codex OAuth 强制定**: 如果 providerType 是 `codex_oauth`，强制返回 `"openai_responses"`
2. **meta.apiFormat** (SSOT，不写入 Claude Code 配置): 最优先的自定义值
3. **settings_config.api_format** (旧字段兼容): 次优先
4. **settings_config.openrouter_compat_mode** (旧 OpenRouter 兼容): 布尔值，true→`"openai_chat"`
5. **默认**: `"anthropic"` — 直接透传

### 转换函数

`claude_api_format_needs_transform()` 返回 true 仅当 apiFormat 为:
- `"openai_chat"`
- `"openai_responses"`
- `"gemini_native"`

这些转换由 cc-switch 的内置代理层完成：
- openai_chat → `transform::` + `streaming::create_anthropic_sse_stream`
- openai_responses → `transform_responses::` + `streaming_responses::create_anthropic_sse_stream_from_responses`
- gemini_native → `transform_gemini::` + `streaming_gemini::create_anthropic_sse_stream_from_gemini`

---

## 哪些厂商实际走格式转换？

### 不走转换（apiFormat 默认或缺失，即 "anthropic"）

这些厂商在 Anthropic 兼容端点（通常 `/anthropic` 子路径）提供原生 Anthropic Messages API：

| 厂商 | Base URL | 路径特征 |
|------|----------|---------|
| Anthropic 官方 | `https://api.anthropic.com` | 原生 |
| DeepSeek | `https://api.deepseek.com/anthropic` | Anthropic 兼容层 |
| 智谱 GLM | `https://open.bigmodel.cn/api/anthropic` | Anthropic 兼容层 |
| 百炼 | `https://dashscope.aliyuncs.com/apps/anthropic` | Anthropic 兼容层 |
| Kimi | `https://api.moonshot.cn/anthropic` | Anthropic 兼容层 |
| StepFun | `https://api.stepfun.com/step_plan` | Anthropic 兼容层 |
| MiniMax | `https://api.minimaxi.com/anthropic` | Anthropic 兼容层 |
| 豆包 | `https://ark.cn-beijing.volces.com/api/coding` | Anthropic 兼容层 |
| 百灵 | `https://api.tbox.cn/api/anthropic` | Anthropic 兼容层 |
| Longcat | `https://api.longcat.chat/anthropic` | Anthropic 兼容层 |
| 小米 MiMo | `https://api.xiaomimimo.com/anthropic` | Anthropic 兼容层 |
| OpenRouter | `https://openrouter.ai/api` | Anthropic 兼容层 |
| 胜算云 | `https://router.shengsuanyun.com/api` | 代理/聚合 |
| AiHubMix | `https://aihubmix.com` | 代理/聚合 |
| SiliconFlow | `https://api.siliconflow.cn` | 代理/聚合 |
| 各中继/聚合商 | 多种 | 代理/聚合，上游已兼容 |

**结论：厂商做了 Anthropic API 兼容适配，Claude Code 发送的是标准 Anthropic Messages API 请求，这些端点原生理解并响应，无需中间层转换。**

### 走转换（apiFormat 非 anthropic）

| 厂商 | apiFormat | 原因 |
|------|-----------|------|
| **Gemini Native** | `"gemini_native"` | Gemini 只有 generateContent API，无 Anthropic 兼容端点 |
| **GitHub Copilot** | `"openai_chat"` | Copilot API 只支持 OpenAI Chat 格式 |
| **OpenAI Codex (OAuth)** | `"openai_responses"` | Codex 后端是 OpenAI Responses API |
| **Nvidia** | `"openai_chat"` | Nvidia NIM 只提供 OpenAI Chat 兼容 |

---

## GetTokens 现状

### 当前能力

`internal/wailsapp/claude_local_apply.go` — 仅写入 3 个 env 字段到 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "...",
    "ANTHROPIC_BASE_URL": "...",
    "ANTHROPIC_MODEL": "..."
  }
}
```

**格式转换由 relay 侧处理**：GetTokens 的 relay 服务 (`internal/cliproxyapi/`) 作为中间层，在上游和 Claude Code 之间做协议转换。直接本地写入（`claude_local_apply.go`）不涉及格式转换。

### 与 cc-switch 的关键差异

| 维度 | cc-switch | GetTokens |
|------|-----------|-----------|
| **env 字段覆盖** | 7+ 字段（含 AUTH_TOKEN/API_KEY 变体、DEFAULT_*_MODEL、MAX_OUTPUT_TOKENS、TIMEOUT 等） | 已覆盖 API_KEY、BASE_URL、MODEL、DEFAULT_*_MODEL、SMALL_FAST、MAX_OUTPUT_TOKENS、TIMEOUT、DISABLE_NONESSENTIAL_TRAFFIC |
| **非 env 配置** | 支持 settings.json 顶层字段（includeCoAuthoredBy、enabledPlugins 等） | 不支持 |
| **ANTHROPIC_AUTH_TOKEN vs API_KEY** | 按供应商选择字段名 | 仅写 API_KEY，检测到 AUTH_TOKEN 时报冲突警告 |
| **格式转换** | 内置代理做 Anthropic↔OpenAI/Gemini 双向转换 | 不内置，由 relay 服务负责 |
| **多供应商管理** | SSOT 数据库 + 一键切换 | 通过 accounts 页管理 relay keys |
| **配置 preservative patch** | 保留未知字段 | 保留未知字段（仅操作 env object） |
| **模板变量** | 支持 `${VAR}` 模板（如 AWS_REGION、ENDPOINT_ID） | 无 |
| **端点候选/测速** | 支持多 endpoint 测速自动选择 | 不支持 |

### GetTokens 缺失的关键 env 字段

从 cc-switch 预设中提取的常用 env 字段，GetTokens 当前覆盖情况：

```go
// 当前只设置这 3 个
"ANTHROPIC_API_KEY"    // ← 已支持
"ANTHROPIC_BASE_URL"   // ← 已支持
"ANTHROPIC_MODEL"      // ← 已支持

// 2026-05-18 已补充支持
"ANTHROPIC_DEFAULT_HAIKU_MODEL"
"ANTHROPIC_DEFAULT_SONNET_MODEL"
"ANTHROPIC_DEFAULT_OPUS_MODEL"
"ANTHROPIC_SMALL_FAST_MODEL"
"CLAUDE_CODE_MAX_OUTPUT_TOKENS"
"API_TIMEOUT_MS"
"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"

// 仍未支持
"ANTHROPIC_AUTH_TOKEN"              // 部分厂商要求 auth token 而非 api key
"CLAUDE_CODE_USE_BEDROCK"           // AWS Bedrock 模式
```

---

## 结论

### 1. 格式转换不是普遍需求

绝大多数 Claude Code 供应商已提供 Anthropic Messages API 兼容端点，**不需要格式转换**。cc-switch 的 `apiFormat` 默认值就是 `"anthropic"`（直接透传），只有 Gemini、Copilot、Codex OAuth、Nvidia 这 4 个例外需要转换。

GetTokens 当前不内置格式转换是合理的——relay 服务已处理转换场景，本地直接写入面向的是已提供 Anthropic 兼容端点的供应商。

### 2. GetTokens 应扩展 env 字段覆盖

当前仅 3 个 env 字段明显不足。建议补充：

- **P0 已完成**：`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_SMALL_FAST_MODEL` — Claude Code 核心模型选择，用户高频使用
- **P1**：`ANTHROPIC_AUTH_TOKEN`（替代 API_KEY 的认证方式）— 部分中继/聚合商使用
- **P2 已部分完成**：`CLAUDE_CODE_MAX_OUTPUT_TOKENS`、`API_TIMEOUT_MS`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`

### 3. 不需要引入 apiFormat 概念

GetTokens 的定位不是 cc-switch 的多供应商代理管理器，不需要像 cc-switch 那样内置格式转换。格式转换由 relay 服务层处理，这是合理的架构分工。

### 4. 值得借鉴的 cc-switch 能力

- **Preset 系统的模板变量**（`${ENDPOINT_ID}`、`${AWS_REGION}`）— 适用于需要用户填入特定参数的供应商
- **端点候选/测速** — 提高中继连接可靠性
- **非 env 字段写入**（`includeCoAuthoredBy`、`enabledPlugins` 等）— 扩展 settings.json 覆盖

---

## 参考

- [cc-switch ProviderMeta.apiFormat 定义](../../references/cc-switch/src/types.ts#L155)
- [cc-switch get_claude_api_format 实现](../../references/cc-switch/src-tauri/src/proxy/providers/claude.rs#L25)
- [cc-switch Claude 供应商预设](../../references/cc-switch/src/config/claudeProviderPresets.ts)
- [GetTokens claude_local_apply.go](../../../internal/wailsapp/claude_local_apply.go)
- [Claude Code 功能对齐调研](../20260517-claude-code-feature-parity/README.md)
- [cc-switch 业务覆盖路线](../20260505-cc-switch-coverage-roadmap/README.md)

## 当前状态

- 状态：analysis-complete
- 创建时间：2026-05-17
- 更新：2026-05-18 已落地 Claude Code local apply env 字段扩展。
