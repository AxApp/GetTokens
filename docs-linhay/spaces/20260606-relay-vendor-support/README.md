# 20260606 relay vendor support

## 背景

用户希望把 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api) 和 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 作为参考项目引入 GetTokens，并在现有“统一厂商入口 / 厂商模块”中补充对应厂商类型，供后续创建第三方 relay 厂商账号时直接选择。

初步调研结论：

1. `sub2api` 本身不是单一上游模型厂商，而是一个 AI API gateway / relay 平台。
2. `new-api` 也是 next-generation LLM gateway / AI asset management gateway，而不是单一上游模型厂商。
3. 它们对客户端暴露的是通用 API 入口，而不是要求 GetTokens 为其新增独立账号域模型。
4. 结合当前 GetTokens 账号体系，这两类项目更适合作为新的 `vendor preset` 候选进入现有厂商选择体系，而不是新增第四种账号主类型。
5. 是否还要同步进入 `openai-compatible provider preset`，需要在实现前单独确认，不能先当成既定事实。

## 目标

1. 明确 `sub2api` 与 `new-api` 在 GetTokens 中的产品定位、建模边界和默认接入策略。
2. 为后续实现准备完整需求、验收标准和执行计划。
3. 归档参考项目，避免下次实现前重复调研。

## 范围

本期先完成需求与计划；在用户确认执行后，补齐账号详情页对多端配置的展示与保存链路，并对齐余额 / 额度管理接口。

纳入本期范围：

1. 建立 `space` 并写清需求背景、目标、边界和验收。
2. 将 `sub2api` 与 `new-api` 拉取到 `docs-linhay/references/` 作为本地参考项目。
3. 记录对这两类 relay/gateway 项目协议能力与产品定位的初步结论。
4. 输出后续实现计划，明确涉及的前端模块、测试入口和文档写回点。

后续实现阶段预计涉及：

1. `frontend/src/features/accounts/model/vendorPresets.ts`
2. 统一厂商选择相关测试
3. 如需求冻结确认需要，再涉及 `frontend/src/features/accounts/model/openAICompatible.ts`
4. 如本地 CLI 草稿支持需要，再补 `resolveAccountLocalCliMappings` 相关测试
5. 必要时补充参考摘要和 dev 文档
6. 账号详情页三端 endpoint 配置：
   - `openai-compatible`
   - `codex API`
   - `anthropic`
7. 余额 / 额度管理接口对齐：
   - 管理脚本的 `{{baseUrl}}` 优先解析 `formatBaseUrls.openai_chat`
   - 缺省时回落主 `baseUrl`
   - `platformCookie` 与 `curlVariables` 仅用于 quota / billing 管理调用，不进入运行态路由凭据
8. 创建流与详情页对齐：
   - 统一厂商创建入口选择 relay 预设后必须写入三端 `formatBaseUrls`
   - 账号详情页修改任一端 endpoint 后必须能保存并被本地 CLI 草稿读取
   - 复制、导入或恢复账号时不得丢失账号级多端配置
9. 本地 CLI 与管理接口对齐：
   - Codex direct 使用 `openai_responses`
   - Claude Code direct 使用 `anthropic`
   - OpenAI-compatible、`/models`、quota / billing 管理调用使用 `openai_chat`

## 非目标

1. 本期不修改任何业务代码、前端组件或 sidecar 逻辑。
2. 本期不新增账号类型，不调整 `AccountRecord.accountKind` 枚举。
3. 本期不做 Wails/浏览器验收截图。
4. 本期不对 `sub2api` 或 `new-api` 做联调或真实连通性验证。

## 验收标准

1. `docs-linhay/spaces/20260606-relay-vendor-support/README.md` 完整描述需求背景、目标、范围、非目标和验收。
2. `docs-linhay/spaces/20260606-relay-vendor-support/plans/` 下有可执行计划文档。
3. `docs-linhay/references/sub2api/` 与 `docs-linhay/references/new-api/` 已拉取参考项目，且仓库已有规则不会把该源码目录纳入 git。
4. 有一份可追踪的参考摘要，明确：
   - `sub2api` 与 `new-api` 都是 relay / gateway，不是单一模型厂商
   - 它们暴露 `/v1/messages`、`/v1/responses`、`/v1/chat/completions`、`/v1/models` 一类通用入口
   - GetTokens 后续应优先按“厂商预设”而不是“新账号类型”接入
5. 需求冻结前必须明确：
   - 两者是否都进入 `vendorPresets`
   - 两者是否都进入 `openAICompatibleProviderPresets`
   - 两者默认地址策略是否不同
6. 后续正式实现的 DoD 不得只停留在“能显示预设”或“能生成 draft”，至少要验证：
   - 一条 Claude 草稿的 `sourceFormat / baseUrl / authField`
   - 一条 Codex 草稿的 `sourceFormat / baseUrl / model/provider`
7. 账号详情页必须体现三端配置：能展示、编辑并保存每个能力对应的 endpoint；保存后本地 CLI 草稿读取详情页保存值。
8. 余额与额度脚本必须与三端配置对齐：模板、变量展示、显式测试和刷新额度都使用同一管理 base URL 解析规则；账号详情保存只持久化数据库字段，不做网络预检。
9. 账号资产级多端能力必须贯穿新建、编辑、复制、导入、恢复、本地 CLI apply、`/models`、quota/billing 管理接口；不能只在 `sub2api/new-api` 预设或详情页展示层生效。
10. 实现完成后需运行聚焦测试、类型检查和文档结构检查。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260606-relay-vendor-support`
- worktree：`../GetTokens-worktrees/20260606-relay-vendor-support/`

## 相关链接

- 参考项目：`docs-linhay/references/sub2api/`
- 参考项目：`docs-linhay/references/new-api/`
- 上游仓库：[Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)
- 上游仓库：[QuantumNous/new-api](https://github.com/QuantumNous/new-api)
- 需求设计：`plans/20260606-relay-vendor-support-requirements-design-v01.md`
- 执行计划：`plans/implementation-plan-v02.md`
- 系统接线审计：`plans/20260607-system-connection-audit-v01.md`
- 参考摘要：`docs-linhay/references/20260606-relay-vendor-reference-summary.md`

## 当前状态
- 状态：system-audited / runtime-gap-identified
- 最近更新：2026-06-07

## 当前判断

1. `sub2api` 与 `new-api` 在 GetTokens 中都优先按 `aggregator` vendor preset 建模。
2. 多端 endpoint 应上升为账号资产通用能力，而不是两个 relay 厂商的特殊字段；`baseUrl` 只做默认入口和旧数据回退，`supportedFormats + formatBaseUrls` 是账号支持哪些端、每端请求哪个 endpoint 的事实源。
3. 路由和本地直连配置必须以下游请求协议为优先匹配键：OpenAI-compatible -> `openai_chat`，Codex / Responses -> `openai_responses`，Claude Code / Anthropic Messages -> `anthropic`；不能用账号主 `apiFormat` 静默覆盖下游协议。
4. `sub2api` 与 `new-api` 首期都应进入统一 `vendorPresets`；旧的 `openAICompatibleProviderPresets` 若仍作为独立入口存在，必须与统一入口保持同源或薄别名一致。
5. 若后续实现要兼顾 Claude Code 与 Codex，需求冻结时应先按三类外部能力评估，并在账号详情页提供对应 endpoint 配置：
   - `openai-compatible`
   - `codex API`
   - `anthropic`
6. GetTokens 内部再把这三类能力映射为具体 `sourceFormat / baseUrl / authField / provider` 产物，不应在需求阶段直接把外部能力偷换成单一内部格式枚举；其中 `codex API` 当前落到 `openai_responses`，`openai-compatible` 落到 `openai_chat`。
7. 后续实现前需要再确认：
   - `openAICompatibleProviderPresets` 是复用 `vendorPresets`，还是增加薄别名
   - `sub2api` 普通 Claude 账户是否需要除 `/antigravity` 外的第二个推荐 Anthropic endpoint
   - 是否为两个 relay 预设提供专用 logo alias

## 2026-06-07 系统接线审计

本轮重新按 GetTokens 现有系统读取了账号、Wails、Channel Routing、account-store、sidecar synthesizer 与 executor 链路，结论是：

1. `supportedFormats / formatBaseUrls` 已经存在于账号 DTO 和 UI / management 层，但运行态还没有完整消费三端 endpoint。
2. 账号详情页和 quota / billing 管理调用的部分能力已完成，不能把这等同于 sidecar 已经按三端请求。
3. 当前关键断点在 CLIProxyAPI runtime synthesis：account-store 已持久化 `format_base_urls_json`，但合成 runtime auth 时只写主 `base_url`，executor 也仍主要读取 `auth.Attributes["base_url"]`。
4. Codex Channel Routing 对 `openai-compatible` 账号仍存在过宽放行；后续应要求 Codex / Responses 请求优先匹配 `openai_responses`，是否允许 `openai_chat` fallback 必须显式设计。
5. `supportedFormats` 目前主要按 provider 名推断；后续要么显式持久化能力集合，要么从非空 `formatBaseUrls` keys 派生，再用 provider 默认值兜底。
6. 后续实现优先级应调整为：账号能力事实源 -> sidecar runtime projection -> route / executor endpoint 解析 -> 厂商预设和创建流。

详细审计见：`plans/20260607-system-connection-audit-v01.md`。

## 2026-06-06 实现进展

1. 已补齐账号详情页三端配置展示与保存链路：
   - `openai-compatible` -> `openai_chat`
   - `codex API` -> `openai_responses`
   - `anthropic` -> `anthropic`
2. 已对齐余额 / 额度管理接口：
   - 新增 `resolveManagementBaseUrl`，优先使用 `formatBaseUrls.openai_chat`，否则回落主 `baseUrl`
   - 额度和余额脚本模板、变量面板、测试调用、刷新额度都使用同一管理 base URL；保存动作不触发 quota/billing 网络请求
   - Codex API Key 根层 Wails DTO 到 internal DTO 的 `platformCookie` / `curlVariables` 透传已补齐
3. 尚未完成：
   - `sub2api` 与 `new-api` 厂商预设落地
   - 创建流是否已把三端 `formatBaseUrls` 与预设完全对齐的测试收敛
   - 账号复制 / 导入 / 恢复链路是否完整往返 `supportedFormats` 与 `formatBaseUrls`
   - 本地 CLI apply、`/models` 模型拉取与三端 endpoint 的聚焦验证
   - 旧 `openAICompatibleProviderPresets` 入口是否复用统一预设或增加同源薄别名
   - 两个参考项目的真实联调
   - sidecar runtime auth 是否投影并消费三端 endpoint
   - Channel Routing / route explain 是否按下游协议精确过滤目标 format
