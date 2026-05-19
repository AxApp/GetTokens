---
name: gettokens-claude-code-account-list
description: GetTokens Claude Code 账号列表：Anthropic 格式账号筛选、请求顺序、路由探测、模型映射、官方默认模型 profile 与 local apply 边界。
---

# GetTokens Claude Code Account List

当任务涉及 Claude Code 账号列表、Claude Code relay 账号请求顺序、Anthropic 格式账号筛选、Claude Code 模型映射、官方默认模型 profile、`~/.claude/settings.json` local apply 或 Claude Code 路由探测时使用本 skill。

## 1. 业务边界

- Claude Code 账号列表不是 `settings.json` 多 key 管理器。
- 它是 GetTokens relay 可供 Claude Code 使用的 Anthropic 格式账号请求工作台。
- P0 账号筛选条件：`AccountRecord.supportedFormats` 包含 `anthropic`。
- Claude Code 本地仍只写一个 relay endpoint / relay key；多账号轮换发生在 GetTokens relay 内。
- 不把 provider 名称等于 `claude` 作为筛选条件。

## 2. 账号列表语义

- 候选来源以统一 `AccountRecord` 为入口：
  - `supportedFormats` 包含 `anthropic`
  - 存在可用于 relay 的凭证或 auth route id
  - 请求出口优先 `formatBaseUrls.anthropic`，没有时回退 `baseUrl`
- 请求顺序复用 Codex 账号列表模式：
  - 禁用或阻塞账号保留在排序中
  - 运行时请求候选只包含当前可请求账号
  - 拖拽排序写回 `UpdateAccountPriority`
  - 启停写回 `SetAccountDisabled`
- 浏览器 preview 必须在缺少 Wails runtime 时稳定显示 preview 数据。

## 3. 模型映射语义

- UI 展示方向：真实上游模型 `name` -> Claude Code 请求模型 `alias`。
- 运行时解析方向：Claude Code 请求模型 alias -> 真实上游模型 name。
- API key / openai-compatible 账号优先复用账号配置内的 `models[]`：
  - `models[].name` 是真实上游模型
  - `models[].alias` 是 Claude Code 请求模型
- OAuth/auth-file 账号优先复用 sidecar `oauth-model-alias`，Claude Code channel 默认为 `claude`。
- 默认同名透传，不展示或保存 `model -> model`。
- 保存时按 `name + alias` 去重，允许同一个真实模型映射到多个 Claude Code alias。

## 4. 官方默认模型 profile

- 官网给出的默认值就是 `ProviderDefaultModelProfile` 的权威值。
- 官网列出的其他模型只叫“官方可切换模型”，不叫默认候选。
- 本地 `cc-switch` / GetTokens 旧预设只用于迁移差异提示，不参与已有官网来源厂商的默认值决策。
- 远端 `/models` 只能刷新可切换模型集合，不能覆盖官网默认值或用户已保存映射。
- profile 可一键填充 Claude Code local apply 字段，也可生成 relay 映射草稿；保存仍走 `models[]` 或 `oauth-model-alias`。
- 已保存的用户映射优先级最高；profile 更新只能提示，不能自动覆盖。
- 官方默认值表维护在 `docs-linhay/spaces/20260519-claude-code-account-list/plans/official-model-profiles.md`。

## 5. 当前官方校准结论

- DeepSeek：`deepseek-v4-pro[1m]` 为 main/sonnet/opus，`deepseek-v4-flash` 为 haiku；`CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_EFFORT_LEVEL` 只属于 local apply extra env。
- 百炼：按 Token Plan / Coding Plan / Pay-as-you-go 分 profile，默认模型为 `qwen3.6-plus`，haiku 视官方场景为 `qwen3.6-plus` 或 `qwen3.6-flash`。
- MiniMax：`MiniMax-M2.7`。
- Xiaomi MiMo：默认值为 `mimo-v2.5-pro`；`mimo-v2.5-pro[1m]` 是官方长上下文变体，`mimo-v2.5` / `mimo-v2.5-tts` 是官方可切换模型。
- Kimi：当前已确认官方 Claude Code env 示例为 `kimi-k2.5`；本地 `kimi-k2.6` 只作旧预设差异提示。
- Doubao：默认按官网 `ark-code-latest` 或用户选择的具体 `Model_Name`；本地 `doubao-seed-2-0-code-preview-latest` 只作迁移提示。

## 6. 验证

- 文档或需求调整后运行：
  - `docs-linhay/scripts/check-docs.sh`
  - `qmd update`
  - `qmd embed`
- 前端实现后至少覆盖：
  - Anthropic 格式筛选
  - 禁用保留排序但不参与运行候选
  - `formatBaseUrls.anthropic` 优先级
  - 模型映射同名透传
  - 同一真实模型多个 Claude alias
  - 官方默认 profile 不覆盖用户映射
