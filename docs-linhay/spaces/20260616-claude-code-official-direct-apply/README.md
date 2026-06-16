# Claude Code 官方直连模板应用

## 背景

账号卡片的“应用模板到 Claude Code”原本默认写 GetTokens 本地 relay endpoint / relay key。用户反馈 Xiaomi MiMo Token Plan 截图中写成 `http://127.0.0.1:8317/v1` 不符合官方文档，后续又补充 Zhipu GLM Coding Plan 官方文档，并追问其他厂商是否同类处理。该需求只处理**已确认官方 Claude Code 配置文档**的厂商直连写入边界，不处理其他并行需求。

## 证据门禁

### Xiaomi MiMo API / Token Plan

- 问题来源：用户提供 `https://mimo.mi.com/docs/zh-CN/tokenplan/integration/claudecode` 与本机截图，指出 Xiaomi 类型账号应用到 Claude Code 时不应写本地 IP，而应直接应用小米官方远程配置。
- 官方事实：小米 Token Plan Claude Code 文档要求写 `ANTHROPIC_BASE_URL=https://token-plan-cn.xiaomimimo.com/anthropic`（或订阅页专属 Base URL）和 `ANTHROPIC_AUTH_TOKEN=MIMO_API_KEY`；按量 API 模式示例为 `https://api.xiaomimimo.com/anthropic`。
- 代码事实位置：`frontend/src/features/accounts/model/accountLocalCliMapping.ts` 中 `usesDirectAccountKeyForClaude` 仅允许 `openrouter` 直连；`resolveClaudeAuthField` 对非 OpenRouter 默认 `ANTHROPIC_API_KEY`。
- 当前现象：Xiaomi MiMo Token Plan 账号的 Claude Code preview 使用 `http://127.0.0.1:8317/v1` 和 `ANTHROPIC_API_KEY`，与官方文档不一致。
- 预期验收：Xiaomi MiMo API / Token Plan 官方模板写入当前账号 API Key 与 `formatBaseUrls.anthropic`，auth field 使用 `ANTHROPIC_AUTH_TOKEN`；不再依赖 GetTokens relay key。
- 反证条件：若账号是非官方/未验证的泛 Anthropic-compatible 账号，则仍按现有 relay local apply 边界处理，不扩大为通用直连。

### Zhipu GLM Coding Plan

- 问题来源：用户补充 `https://docs.bigmodel.cn/cn/coding-plan/tool/claude`，要求同类官方厂商也应纳入。
- 官方事实：Zhipu Claude Code 文档示例写 `ANTHROPIC_AUTH_TOKEN=your_zhipu_api_key`、`ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic`、`API_TIMEOUT_MS=3000000`；模型切换示例为 `ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.5-air`、`ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.2[1m]`、`ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.2[1m]`。
- 代码事实位置：Zhipu 旧 profile 在 `docs-linhay/spaces/20260519-claude-code-account-list/plans/official-model-profiles.md` 中标记为未确认；`frontend/src/features/accounts/model/vendorPresets.ts` 和 `openAICompatible.ts` 仍使用旧模型建议。
- 当前现象：Zhipu 账号没有 relay key 时 Claude Code apply 被禁用；即使启用也会按 relay 路径写本地 endpoint。
- 预期验收：Zhipu 官方模板写入账号自身 API Key、`formatBaseUrls.anthropic`、`ANTHROPIC_AUTH_TOKEN` 和 `API_TIMEOUT_MS=3000000`；默认模型 profile 使用官方 Coding Plan 示例。
- 反证条件：`z-ai` 等未确认官方 Claude Code env 页的厂商不得被顺带升级为直连。

### 其他已确认官方 Claude Code env 的厂商

- 问题来源：用户追问“其他厂商呢？”，需要避免只修 Xiaomi/Zhipu 而遗漏同类官方配置。
- 官方事实：
  - DeepSeek：`ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`，`ANTHROPIC_AUTH_TOKEN`，`main/sonnet/opus=deepseek-v4-pro[1m]`，`haiku=deepseek-v4-flash`。
  - Kimi：`ANTHROPIC_BASE_URL=https://api.moonshot.cn/anthropic`，`ANTHROPIC_AUTH_TOKEN`，`main/haiku/sonnet/opus=kimi-k2.7-code`。
  - MiniMax：国际 `https://api.minimax.io/anthropic`，中国区 `https://api.minimaxi.com/anthropic`，`ANTHROPIC_AUTH_TOKEN`，`main/haiku/sonnet/opus=MiniMax-M3`，`API_TIMEOUT_MS=3000000`。
  - Doubao：`ANTHROPIC_BASE_URL=https://ark.cn-beijing.volces.com/api/coding`，`ANTHROPIC_AUTH_TOKEN`，`ANTHROPIC_MODEL=ark-code-latest` 或控制台具体 `Model_Name`。
  - StepFun：`ANTHROPIC_BASE_URL=https://api.stepfun.com/step_plan`，`ANTHROPIC_AUTH_TOKEN`，模型示例包含 `step-3.7-flash`。
- 当前现象：这些账号即使已有官方 Anthropic Base URL，也会因无 GetTokens relay key 禁用，或写成 `http://127.0.0.1:8317/v1`。
- 预期验收：上述 provider 与 Xiaomi/Zhipu 一样走官方远程配置直连；Longcat、百炼多 profile 等未完成准确拆分的厂商继续保留 relay/fallback 边界。

## 目标

1. 已验证官方 Claude Code 配置的 Xiaomi MiMo API / Token Plan、Zhipu GLM Coding Plan、DeepSeek、Kimi、MiniMax、Doubao、StepFun 可直接写官方远程 Anthropic Base URL 与账号自身 API Key。
2. 未验证的 Anthropic-compatible 账号继续走 GetTokens relay local apply，不扩大直连范围。
3. 官方模型 profile、账号模板模型建议、local apply draft 和 preview diff 保持一致。
4. 本轮文档、memory、skill 沉淀和测试只覆盖此需求，不处理其他并行需求。

## 范围

- `frontend/src/features/accounts/model/accountLocalCliMapping.ts`
- `frontend/src/features/claude-code/model/claudeCodeAccountList.ts`
- `frontend/src/features/accounts/model/vendorPresets.ts`
- `frontend/src/features/accounts/model/openAICompatible.ts`
- 相关前端模型测试
- Claude Code 官方 profile 文档与项目级 skill / memory 写回

## 非目标

- 不改变 Claude channel routing 的多账号轮换语义。
- 不把所有 `supportedFormats: anthropic` 的账号自动改成直连。
- 不处理 `.codex/config.toml`、其他未跟踪 space 或其他并行需求改动。
- 不做真实桌面手点验收；本轮属于前端模型/配置 draft 修复，自动化测试和类型检查足够覆盖。

## 验收标准

1. Xiaomi MiMo Token Plan 无 relay key 时仍可生成 Claude Code action，写 `ANTHROPIC_AUTH_TOKEN`、账号 `tp-*` 和 `https://token-plan-cn.xiaomimimo.com/anthropic` 或账号专属 Anthropic URL。
2. Xiaomi MiMo API 使用账号 `sk-*` 和 `https://api.xiaomimimo.com/anthropic`。
3. Zhipu 无 relay key 时仍可生成 Claude Code action，写 `ANTHROPIC_AUTH_TOKEN`、账号 key、`https://open.bigmodel.cn/api/anthropic` 和 `API_TIMEOUT_MS=3000000`。
4. Zhipu official profile 为 `main/sonnet/opus=glm-5.2[1m]`、`haiku=glm-4.5-air`。
5. Zhipu 账号模板模型建议优先包含 `glm-5.2[1m] / glm-5.2 / glm-4.5-air`。
6. DeepSeek、Kimi、MiniMax、Doubao、StepFun 无 relay key 时仍可生成 Claude Code action，写官方远程 Anthropic Base URL 与 `ANTHROPIC_AUTH_TOKEN`；MiniMax 额外写 `API_TIMEOUT_MS=3000000`。
7. Longcat 等未纳入本轮直连白名单的既有 relay 行为不被改变。
8. 聚焦测试、`typecheck`、`check-docs.sh`、`git diff --check` 通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-claude-code-official-direct-apply`
- worktree：`../GetTokens-worktrees/20260616-claude-code-official-direct-apply/`

## 相关链接

- Xiaomi MiMo Token Plan Claude Code：https://mimo.mi.com/docs/zh-CN/tokenplan/integration/claudecode
- Zhipu GLM Coding Plan Claude Code：https://docs.bigmodel.cn/cn/coding-plan/tool/claude
- DeepSeek Claude Code：https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code
- Kimi Agent Support：https://platform.moonshot.cn/docs/guide/agent-support
- MiniMax Token Plan Claude Code：https://platform.minimax.io/docs/token-plan/claude-code
- Doubao Claude Code：https://www.volcengine.com/docs/82379/1928262
- StepFun Claude Code：https://platform.stepfun.com/docs/llm_tools/claude_code
- 官方模型 profile：`docs-linhay/spaces/20260519-claude-code-account-list/plans/official-model-profiles.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-06-16

## 实现记录

- Xiaomi MiMo API / Token Plan、Zhipu GLM Coding Plan、DeepSeek、Kimi、MiniMax、Doubao、StepFun 已加入 Claude Code 官方直连例外，写账号自身 API Key、`formatBaseUrls.anthropic` 与 `ANTHROPIC_AUTH_TOKEN`，不写 GetTokens relay URL。
- Zhipu、MiniMax local apply 额外写 `API_TIMEOUT_MS=3000000`。
- `resolveClaudeCodeProviderProfile` 增加 `xiaomimimo` / `xiaomimimo-token-plan` 到 `mimo` 的 profile alias。
- Zhipu、Kimi、MiniMax、Doubao、StepFun official profile 与账号模板模型建议已按官方 Claude Code 文档同步。
- 沉淀已写入 `gettokens-claude-code-account-list`、`gettokens-domain-engineering` 与 `docs-linhay/memory/2026-06-16.md`；不升级 `AGENTS.md`。
