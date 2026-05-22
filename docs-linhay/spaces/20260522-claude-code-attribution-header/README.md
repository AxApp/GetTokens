# Claude Code Attribution Header 配置

## 背景

Claude Code 在请求 Anthropic API 时会在系统提示前面添加一个简短的归属块（attribution block），包含客户端版本和对话指纹。Anthropic 官方 API 在处理前会删除此块，不影响第一方 prompt cache。

但当用户通过自定义 LLM 网关（如 DeepSeek、百炼、MiniMax 等）使用 Claude Code 时，网关通常以完整请求体为键实现自己的 prompt cache。归属块会导致每次请求的请求体不同，**破坏网关侧的 prompt cache 命中率**。

Claude Code 提供了 `CLAUDE_CODE_ATTRIBUTION_HEADER=0` 环境变量来省略该归属块。

目前：
- 用户级 `~/.claude/settings.json` 的 `env` 字段里没有配置此项
- GetTokens 项目本身没有 `.claude/settings.json`（开发者依赖用户级配置）
- GetTokens 的 Claude Code Local Apply 流程不会写入此 key，导致通过 GetTokens 配置网关的用户 prompt cache 仍然被破坏

参考：[LLM Gateway 文档](https://code.claude.com/docs/zh-CN/llm-gateway#llm-gateway)

## 目标

确保所有使用 GetTokens relay + 非 Anthropic 网关的 Claude Code 用户（包括开发者自己），prompt cache 能正常工作。

## 范围

### 位置①：项目级 `.claude/settings.json`（面向 GetTokens 开发者）

- 新建 `.claude/settings.json`，写入 `CLAUDE_CODE_ATTRIBUTION_HEADER=0`
- 决定该文件是否提交到 git（团队共享）还是仅作为 `settings.local.json`（个人按需）
- 参照用户级 `~/.claude/settings.json` 中已有的 env 结构

### 位置②：应用层 Claude Code Local Apply env 模板（面向 GetTokens 终端用户）

- 在 Claude Code 官方默认模型 profile 中，为非 Anthropic 网关（DeepSeek、百炼、MiniMax、Mimo、Kimi、Doubao）增加 `CLAUDE_CODE_ATTRIBUTION_HEADER=0` 作为默认 extra env
- 前端 "Apply to Local Claude Code" 确认页需展示此 env key
- `~/.claude/settings.json` 的 patch 逻辑需确保该 key 被正确写入且不被后续覆盖

### 涉及资产

- `~/.claude/settings.json`（用户级，已有的 DeepSeek env 配置）
- `.claude/settings.json`（项目级，待新建）
- `.agents/skills/gettokens-claude-code-account-list/SKILL.md`（模型 profile 与 local apply）
- `.agents/skills/gettokens-domain-engineering/SKILL.md`（Claude Code Settings Semantics，第 3.1 节）
- `docs-linhay/spaces/20260519-claude-code-account-list/plans/official-model-profiles.md`（官方默认模型 profile 表）
- 前端 apply 确认页组件

## 非目标

- 不针对 Anthropic 官方 API 网关（官方的 attribution 删除机制已处理）
- 不改变 Codex 侧的 local apply 逻辑（Codex 没有此 header 问题）
- 不修改 CLIProxyAPI fork 或 sidecar

## 验收标准

1. GetTokens 开发者 clone 项目后，Claude Code 通过自定义网关发请求时 prompt cache 命中率正常
2. 通过 GetTokens UI 执行 "Apply to Local Claude Code" 后，`~/.claude/settings.json` 的 `env` 中包含 `CLAUDE_CODE_ATTRIBUTION_HEADER=0`
3. 各非 Anthropic 网关 profile（DeepSeek、百炼、MiniMax、Mimo、Kimi、Doubao）均默认包含此 key
4. 已有的 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、模型映射等 key 不受影响
5. 用户手动在 `~/.claude/settings.json` 中设置的该 key 不会被 GetTokens 覆盖（除非用户在 UI 中确认覆盖）

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260522-claude-code-attribution-header`
- worktree：`../GetTokens-worktrees/20260522-claude-code-attribution-header/`

## 相关链接

- [Claude Code LLM Gateway 文档](https://code.claude.com/docs/zh-CN/llm-gateway#llm-gateway)
- `gettokens-claude-code-account-list` skill
- `gettokens-domain-engineering` skill（Claude Code Settings Semantics / Account Template Local CLI Apply）

## 当前状态
- 状态：unimplemented
- 最近更新：2026-05-22
