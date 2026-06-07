# Relay 厂商接入执行计划 V02

日期：2026-06-06
更新：2026-06-07
状态：system-audited / runtime-gap-identified

## 需求摘要

在 GetTokens 现有厂商模块中增加 `sub2api`、`new-api` 这类 relay/gateway 厂商类型，并补齐账号详情页对三端 endpoint 的展示与保存，同时对齐余额 / 额度管理接口。本计划用于约束正式实现的边界、步骤与验证顺序。

需求设计入口：`20260606-relay-vendor-support-requirements-design-v01.md`

系统接线审计：`20260607-system-connection-audit-v01.md`

需求整理与新建议：`20260608-requirements-review-and-recommendations-v02.md`

可行性评估：`20260608-feasibility-assessment-v01.md`

## 当前结论

1. `sub2api` 是 AI API gateway / relay 平台，不是单一上游模型提供商。
2. `new-api` 也是 LLM gateway / AI asset management gateway，不是单一上游模型提供商。
3. 现阶段最合理的接入方式是新增统一 `vendor preset`，而不是新增账号主类型。
4. 多端 endpoint 必须上升为账号资产通用能力：`baseUrl` 是默认入口和旧数据回退，`supportedFormats + formatBaseUrls` 才是每端能力与端点的事实源。
5. 路由与本地直连配置必须以下游请求协议为优先匹配键：OpenAI-compatible -> `openai_chat`，Codex / Responses -> `openai_responses`，Claude Code / Anthropic Messages -> `anthropic`。
6. `openAICompatibleProviderPresets` 不作为独立事实源；若旧入口仍存在，必须复用统一预设或以薄别名保持字段一致。
7. 账号底层已有 `formatBaseUrls`，详情页和管理接口已经部分体现三端配置；但运行态 sidecar synthesis / executor 仍未完整消费三端 endpoint，这是当前最大缺口。
8. 余额 / 额度接口是管理端能力，不是运行态第四端；它们的 `{{baseUrl}}` 解析应复用三端配置里的 `openai-compatible` endpoint，即 `formatBaseUrls.openai_chat`，缺省再回落主 `baseUrl`。
9. `/models` 模型拉取默认也是管理调用：优先使用 `modelFetchBaseUrl/modelFetchApiKey`，否则使用 `formatBaseUrls.openai_chat/apiKey`。
10. 后续实现必须先补账号能力事实源和 sidecar runtime projection，再新增 `sub2api` / `new-api` 预设；否则会形成“UI 可配置三端、运行态仍走单一 base_url”的假完成。

## 待确认问题

1. **分类**
   - 冻结：`aggregator`
   - 原因：这两者的产品定位都更接近多上游聚合网关，不是单一上游模型厂商

2. **默认地址**
   - 冻结：使用自部署本地默认，不使用公开 demo / 赞助商 / 商业站点作为生产默认
   - `sub2api`:
     - `openai_chat`: `http://localhost:8080/v1`
     - `openai_responses`: `http://localhost:8080/v1`
     - `anthropic`: `http://localhost:8080/antigravity`
   - `new-api`:
     - `openai_chat`: `http://localhost:3000/v1`
     - `openai_responses`: `http://localhost:3000/v1`
     - `anthropic`: `http://localhost:3000`

3. **预设入口范围**
   - 冻结：必须进入 `vendorPresets`
   - 约束：如果 `openAICompatibleProviderPresets` 仍是可见入口，不能维护第二套不同事实源；应复用统一预设或增加同源薄别名

4. **能力边界**
   - 初步依据参考项目文档，若进入可直连草稿范围，需求冻结时应先按三类外部能力评估：
     - `openai-compatible`
     - `codex API`
     - `anthropic`
   - 实现前再核对 GetTokens 应如何把这三类能力映射成具体本地产物，例如 `sourceFormat / baseUrl / authField / provider`
   - 账号详情页用用户语义展示三端：
     - `openai-compatible` -> `openai_chat`
     - `codex API` -> `openai_responses`
     - `anthropic` -> `anthropic`
   - 本地 CLI apply 用三端 endpoint 作为真实配置来源：
     - Codex direct -> `openai_responses`
     - Claude Code direct -> `anthropic`
     - OpenAI-compatible runtime / management -> `openai_chat`

## 实施步骤

### 阶段 1：需求冻结

1. 确认 `sub2api`、`new-api` 在产品里的命名、分类、默认地址策略，以及是否支持：
   - `openai-compatible`
   - `codex API`
   - `anthropic`
2. 分别确认它们是否需要进入：
   - 统一厂商选择卡片
   - openai-compatible provider 预设
3. 明确“仅新增预设，不新增账号类型”是否作为正式约束写入 dev 文档。
4. 以需求设计 v01 为实现准绳，冻结：
   - 两个预设均为 `aggregator`
   - 两个预设均支持 `openai_chat / openai_responses / anthropic`
   - 默认地址采用自部署本地语义
   - 多端能力属于账号资产通用模型，不是 relay 厂商特例
   - `openAICompatibleProviderPresets` 不再作为第二事实源

### 阶段 2：测试先行

1. 为账号能力事实源增加红灯测试：
   - account-store 能持久化或派生 `supportedFormats`
   - `formatBaseUrls` 的非空 key 能参与能力判断
   - 旧账号无多端配置时仍回退主 `baseUrl`
2. 为 sidecar runtime projection 增加红灯测试：
   - `synthesizeAccountStoreOpenAICompat` 不只写主 `base_url`
   - runtime auth attributes 能表达 `openai_chat / openai_responses / anthropic` endpoint
   - executor 能按下游协议选择对应 endpoint
3. 为 Channel Routing / route explain 增加红灯测试：
   - Claude channel 要求 `anthropic`
   - Codex / Responses channel 优先要求 `openai_responses`
   - 缺少目标格式时输出明确过滤原因
4. 为 `vendorPresets` 增加预设存在性测试：
   - `id`
   - `name`
   - `category`
   - 能力声明或对应配置入口
   - 三端 `formatBaseUrls`
5. 为账号详情页三端配置增加红灯测试：
   - `buildApiKeyConfigDraft` 保留 `formatBaseUrls`
   - `hasApiKeyConfigChanges` 能检测三端 endpoint 编辑
   - `AccountCredentialVerifySection` 渲染三端配置区域
   - `UpdateOpenAICompatibleProvider` 和 `UpdateCodexAPIKeyConfig` 能保存 `formatBaseUrls`
   - 复制 / 导入 / 恢复账号时往返 `supportedFormats` 与 `formatBaseUrls`
6. 为创建流增加测试：
   - 选择 `Sub2API` / `New API` 后表单写入三端 endpoint
   - 提交 payload 保留三端 `formatBaseUrls`
   - 旧 OpenAI-compatible provider 入口若仍存在，则与统一预设字段一致
7. 若本地 CLI 草稿会受影响，再补：
   - `resolveAccountLocalCliMappings` 对 `sub2api`
   - `resolveAccountLocalCliMappings` 对 `new-api`
   的映射测试，覆盖 `openai-compatible / codex API / anthropic` 到本地草稿字段的投影
   - 下游目标为 Codex 时不能落到 `openai_chat`，下游目标为 Claude 时不能落到 `openai_chat` 或 `openai_responses`
8. 为余额 / 额度管理接口增加测试：
   - `resolveManagementBaseUrl` 优先使用 `openai_chat`
   - `buildApiKeyConfigDraft` 用管理 endpoint 生成通用 quota 模板和厂商 billing 模板
   - 保存配置时直接通过 `UpdateCodexAPIKeyConfig` 持久化 quota / billing curl；网络可用性只在显式测试或刷新额度时验证
   - Wails root DTO 到 internal DTO 透传 `platformCookie / curlVariables`
9. 为模型拉取增加测试：
   - `/models` 优先使用 `modelFetchBaseUrl/modelFetchApiKey`
   - 缺省时回落 `formatBaseUrls.openai_chat`
   - 不误用 `anthropic` 或 `openai_responses`

### 阶段 3：最小实现

1. 明确 `supportedFormats` 的事实源：优先显式持久化；若首版暂不加字段，至少从非空 `formatBaseUrls` keys 派生，再用 provider 默认值兜底。
2. 在 CLIProxyAPI account-store synthesis 中投影 `format_base_urls_json` 到 runtime auth attributes。
3. executor 按下游协议选择 endpoint：
   - OpenAI Chat -> `openai_chat`
   - Codex / Responses -> `openai_responses`
   - Claude / Anthropic Messages -> `anthropic`
4. 收窄 Channel Routing / route explain 的候选过滤，不让只支持 `openai_chat` 的账号静默进入 Codex / Claude 目标协议。
5. 在 `ApiKeyConfigDraft` 中加入 `formatBaseUrls`，让详情页编辑状态可承载三端 endpoint。
6. 在账号详情页凭据区新增三端配置面板，默认展示 `openai-compatible / codex API / anthropic` 与对应 Base URL。
7. 在 Wails root DTO、`internal/wailsapp` DTO 和更新实现中补齐 `FormatBaseURLs`，保存时写入 account-store。
8. 新增 `resolveManagementBaseUrl`，让 quota / billing 脚本模板、变量面板、测试调用、刷新额度使用统一管理 base URL；保存动作不触发 quota/billing 网络请求。
9. 在 Wails root DTO mapper 中补齐 Codex API Key 的 `platformCookie / curlVariables` 透传。
10. 在 `frontend/src/features/accounts/model/vendorPresets.ts` 新增 `sub2api`、`new-api` 厂商预设。
11. 对齐旧 OpenAI-compatible provider 入口：优先复用 `vendorPresets`，若必须保留旧 preset 列表，则只增加从统一预设派生的薄别名。
12. 若 logo 需要稳定展示，再在 `vendorIcons.ts` 中决定：
   - 是否新增 alias
   - 或退回 initials 展示
13. 对齐 `/models` 拉取：缺省管理 base URL 使用 `formatBaseUrls.openai_chat`，专用 `modelFetchBaseUrl` 仍优先。
14. 对齐账号结构化流转：账号复制、导入、剪贴板恢复、详情缓存 patch 都必须保留 `supportedFormats` 与 `formatBaseUrls`。
15. 对齐 route / apply 选择逻辑：候选过滤和 endpoint 解析先看下游请求协议，再查账号的 `supportedFormats + formatBaseUrls`。

### 阶段 4：回归验证

1. 运行相关前端单测。
2. 至少运行：
   - `npm --prefix frontend run test:unit`
   - `npm --prefix frontend run typecheck`
3. 至少验证一条 Claude 草稿与一条 Codex 草稿的产物字段，不接受只验证“预设出现”或“draft 不报错”：
   - Claude：`sourceFormat / baseUrl / authField`
   - Codex：`sourceFormat / baseUrl / model / provider`
4. 至少验证一条 `/models` 拉取请求使用 `openai_chat` 管理 endpoint。
5. 至少验证一条 sidecar runtime 请求或 executor 单测，证明 `openai_responses / anthropic / openai_chat` 不同 endpoint 会被各自下游协议读取。
6. 若统一厂商入口文案或分类有变化，再做一次浏览器预览核对，但这属于实现回合，不属于当前 planning 回合。

## 已完成实现项（2026-06-06）

1. `ApiKeyConfigDraft` 已承载 `formatBaseUrls`。
2. 账号详情页已展示三端配置：
   - `openai-compatible`
   - `codex API`
   - `anthropic`
3. Codex API Key 与 openai-compatible provider 更新链路已保存 `formatBaseUrls`。
4. 余额 / 额度管理接口已对齐：
   - `resolveManagementBaseUrl` 优先使用 `formatBaseUrls.openai_chat`
   - quota / billing 模板、变量按钮、测试调用、刷新额度均使用该管理 base URL
   - Codex API Key 保存只写入数据库字段；启用的 quota curl 与 billing curl 只在显式测试/刷新中请求网络
   - 根层 App 到 internal Wails DTO 的 `platformCookie / curlVariables` 透传已锁测试
5. 已补齐需求设计 v01，冻结 relay 预设默认分类、三端 endpoint 默认值、创建流/详情页/本地 CLI/管理接口对齐口径。

## 2026-06-07 系统审计追加结论

1. 上述“已完成实现项”主要覆盖 UI / Wails / management 层，不能视为 runtime 多端支持已经完成。
2. account-store 已有 `format_base_urls_json`，但 sidecar runtime auth synthesis 当前只投影主 `base_url`。
3. executor 当前主要读取 `auth.Attributes["base_url"]`，尚未按下游协议读取 per-format endpoint。
4. `supportedFormats` 当前仍主要由 provider 名推断，需补能力事实源或从 `formatBaseUrls` 派生。
5. 后续实现必须先补 P0-P2 后端链路，再落 `sub2api` / `new-api` 预设，避免形成只在表单层支持三端的假完成。

## 2026-06-08 建议调整

本计划后续执行采用 runtime-first 顺序：

1. 首期不先新增 `sub2api/new-api` 预设，而是先补 endpoint resolver、能力派生规则、sidecar runtime projection 和 executor endpoint selection。
2. `supportedFormats` 首期建议从非空 `formatBaseUrls` keys 派生；旧账号无多端配置时才使用 provider 默认能力兜底。暂缓独立 `supported_formats_json`，直到 UI 需要“端点存在但能力禁用”的单独状态。
3. Codex / Responses 不默认 fallback 到 `openai_chat`。如果 relay 同一个 `/v1` 支持 Chat 和 Responses，必须显式让 `openai_chat` 与 `openai_responses` 指向同一 URL。
4. route explain 需要输出缺失目标 format 的原因，例如 `missing_format:openai_responses` 或 `missing_format:anthropic`。
5. 首期验收增加 endpoint matrix smoke：用不同 mock server 验证 Chat、Responses、Anthropic 请求分别命中正确 endpoint。
6. `vendorPresets` 和旧 OpenAI-compatible provider 入口在 P3 才落地，且旧入口只作为统一 preset 的过滤视图或薄别名。

## 2026-06-08 可行性评估追加

评估结论：可行性高，实现风险中等，推荐小步切片。

已具备：

1. 主仓 AccountRecord / Wails DTO 已有 `supportedFormats` 与 `formatBaseUrls`。
2. 前端详情页、创建流、变更检测和保存 payload 已承载 `formatBaseUrls`。
3. CLIProxyAPI account-store 已有 `format_base_urls_json`，并有旧 schema 补列和往返测试。
4. local CLI apply 已有按目标选择 `openai_responses / anthropic / openai_chat` 的模型函数。
5. Channel Routing 已有 filtered reason 结构。

主要缺口：

1. `supportedFormats` 仍主要按 provider 名推断，需从 `formatBaseUrls` 派生。
2. synthesizer 未把 `format_base_urls_json` 投影到 runtime auth attributes。
3. executor 仍读取单一 `base_url`。
4. Codex Channel Routing 对 openai-compatible 账号仍过宽。

下一步建议直接执行 Slice 1：能力派生与 route explain 精确过滤。

## 当前验证结果（2026-06-06）

已通过：

1. `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `go test .`

已执行但存在非本需求阻塞：

1. `npm --prefix frontend run test:unit -- src/features/accounts/tests/accountConfig.test.mjs` 会运行项目全量前端单测；账号配置相关用例已通过，但既有 `frontend/src/features/codex/codexAccountList.test.mjs` 中 `buildCodexAccountRows separates waiting check from verified requestability evidence` 仍失败。
2. `go test ./internal/wailsapp` 当前被 `internal/wailsapp/channel_routing_test.go` 中仍引用已移除字段 `ManualRequestableAccountIDs` 阻塞。

## 当前验证结果（2026-06-08）

已通过：

1. `go test ./internal/accounts`
2. `go test ./internal/wailsapp -run 'TestExplainChannelRouting|TestNormalizeChannelRouting|TestChannelRouting'`
3. `go test ./internal/watcher/synthesizer -run 'TestConfigSynthesizer_UsesAccountStoreForCodexAndOpenAICompatible'`
4. `go test ./internal/runtime/executor`
5. `node --test frontend/src/features/accounts/tests/accountConfig.test.mjs frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
6. `npm --prefix frontend run typecheck`
7. `docs-linhay/scripts/check-docs.sh`

追加通过：

1. `node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/openAICompatible.test.mjs`
2. `go test ./internal/wailsapp -run 'TestListRelaySupportedModels(FallsBackToOpenAIChatEndpointWhenModelFetchCredentialsMissing|UsesDedicatedModelFetchCredentials|FallsBackToRuntimeCredentialsWhenModelFetchCredentialsMissing)'`

红灯到绿灯覆盖：

1. Codex Channel Routing 缺少 `openai_responses` 时输出 `missing_format:openai_responses`，不再把只有 `openai_chat` 的账号当作 Codex 可用账号。
2. Claude Channel Routing 缺少 `anthropic` 时输出 `missing_format:anthropic`。
3. account-store synthesis 投影 `format_base_url:<format>` runtime attributes。
4. OpenAI-compatible / Codex / Claude executor 分别命中 `openai_chat / openai_responses / anthropic` 专用 endpoint，而不是主 `base_url`。
5. `sub2api/new-api` vendor preset 和 local CLI apply 草稿按下游目标选择对应 endpoint。
6. 账号复制 payload 与导入解析保留 `supportedFormats / formatBaseUrls`；导入恢复时把 `formatBaseUrls` 写回 Codex API Key / OpenAI-compatible provider 创建更新 payload。
7. 账号详情页模型拉取和 relay model catalog 缺省使用 `formatBaseUrls.openai_chat`，不误用 Codex / Anthropic endpoint。
8. 旧 `openAICompatibleProviderPresets` 对 `sub2api/new-api` 从统一 `vendorPresets` 派生薄别名。

### 阶段 5：文档写回

1. 更新本 `space` README 的状态与实现结果。
2. 若形成稳定规则，再补 `docs-linhay/dev/`。
3. 将关键判断写入 `docs-linhay/memory/2026-06-06.md`。

## 风险

1. 这两者都是网关，不是单厂商，若预设默认值给得太“像官方厂商”，可能误导用户理解。
2. `sub2api` 与 `new-api` 的默认地址策略不等价，若复用同一模板，容易把 `new-api` 错做成带公网默认值的伪官方厂商。
3. `vendorPresets` 与 `openAICompatibleProviderPresets` 当前并未完全统一，后续可能出现两边字段不一致的问题。
4. 只验证“能显示预设”会产生假阳性，必须验证本地 CLI 草稿关键字段。
5. 当前存在与本需求无关的 channel routing / Codex account list 测试漂移，后续合并前需要单独收敛，避免全量门禁被旧需求残留阻塞。
6. 只验证账号详情页可保存 `formatBaseUrls` 会产生运行态假阳性；必须验证 sidecar auth attributes 和 executor 最终请求 URL。

## 完成定义

后续真正进入实现时，至少满足：

1. 用户可以在厂商选择中看到 `sub2api`、`new-api`。
2. 它们能按既定能力边界生成可审计的 provider/local CLI draft。
3. `sub2api` 与 `new-api` 的默认地址策略按冻结结论分别落地，不混用。
4. 不引入新的账号类型。
5. 账号详情页能查看、编辑并保存三端 endpoint。
6. 账号复制、导入、恢复链路不丢失账号级多端配置。
7. 下游 Codex / Claude / OpenAI-compatible 请求分别优先走账号支持的 `openai_responses / anthropic / openai_chat`，不被账号主 `apiFormat` 静默改道。
8. `/models`、quota、billing 等管理调用读取管理 base URL，不误用 Codex / Anthropic endpoint。
9. 相关测试通过，文档与 memory 已同步。
