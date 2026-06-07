# 20260606 Relay 厂商参考摘要

## 来源

- 上游仓库：`https://github.com/Wei-Shaw/sub2api`
- 本地参考目录：`docs-linhay/references/sub2api/`
- 上游仓库：`https://github.com/QuantumNous/new-api`
- 本地参考目录：`docs-linhay/references/new-api/`

## 本次调研目的

判断 `sub2api`、`new-api` 在 GetTokens 中应该按什么形态接入厂商模块，避免误把它们建模成新的账号主类型。

## 关键结论

1. `sub2api` 是一个 AI API gateway / relay 平台。
2. `new-api` 也是 next-generation LLM gateway / AI asset management gateway。
3. 它们都不是单一模型提供商，因此不适合在 GetTokens 中新增独立账号类型来承接。
4. 对 GetTokens 而言，更合理的接入方式是：
   - 先在统一厂商入口中增加 `vendor preset`
   - 是否还要同步进入 `openai-compatible provider preset`，需要按实际接线需求单独确认

## 证据摘录

### 1. 产品定位

`README.md` 明确描述：

- “AI API Gateway Platform for Subscription Quota Distribution”
- 平台负责 authentication、billing、load balancing、request forwarding

这说明 `sub2api` 是中继/网关平台，而不是单一上游厂商。

`new-api` 的 `README.md` 明确描述：

- “Next-Generation LLM Gateway and AI Asset Management System”
- 项目用于 lawful and authorized AI API gateway、multi-model management、usage analytics、cost accounting、private deployment

这说明 `new-api` 同样是中继/网关平台，而不是单一上游厂商。

### 2. 客户端入口形态

文档与前端文案中可见它对外暴露多种通用入口：

- `/v1/messages`
- `/v1/responses`
- `/v1/chat/completions`
- `/v1/models`

另有专门的：

- `/antigravity/v1/messages`

这进一步说明它是“承接多协议入口的 relay”，而不是固定单一路径的专有 provider。

`new-api` 路由与文档中也明确暴露：

- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/messages`
- `/v1beta`（Gemini）

且 README 明确列出 OpenAI Compatible、OpenAI Responses、Claude Messages、Google Gemini 等能力。

### 3. Claude / Codex 使用语义

文档里有 Claude Code 配置示例：

- `ANTHROPIC_BASE_URL="http://localhost:8080/antigravity"`
- `ANTHROPIC_AUTH_TOKEN="sk-xxx"`

同时又存在 `/v1/responses`、`/v1/chat/completions` 等 OpenAI 风格接口，说明它同时覆盖 `anthropic` 与 `openai-compatible` / `codex API` 接入面。

`new-api` 也同时覆盖：

- `openai-compatible`
- `codex API`
- `anthropic`

因此两者在 GetTokens 里都更像“可被选择的 relay 厂商预设”。

## 对 GetTokens 的建模建议

### 建议做法

1. 先按 `aggregator` 或 `third_party` 厂商预设接入。
2. 不新增 `AccountRecord.accountKind` 新值。
3. 优先修改：
   - `frontend/src/features/accounts/model/vendorPresets.ts`
4. 只有在 provider 编辑流确实需要时，才修改：
   - `frontend/src/features/accounts/model/openAICompatible.ts`

### 暂不建议

1. 不要把 `sub2api` 当成新的“官方上游厂商”。
2. 不要把 `new-api` 当成新的“官方上游厂商”。
3. 不要因为它们支持多协议入口，就立刻引入新的账号域模型。
4. 不要在未确认默认地址策略前，直接把 demo 地址或默认本地部署地址当成正式生产默认值。

## 后续实现前待确认

1. 分类放 `aggregator` 还是 `third_party`
2. `sub2api` 默认 base URL 是否使用 demo 地址，还是只给占位说明
3. `new-api` 是否只提供占位地址/本地部署语义，而不预填官方公网地址
4. `vendorPresets` 是否都需要新增这两个项目
5. `openAICompatibleProviderPresets` 是否也需要新增这两个项目
