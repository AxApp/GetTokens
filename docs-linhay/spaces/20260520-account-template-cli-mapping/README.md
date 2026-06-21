# 账号应用模板映射本地 CLI 配置

## 背景
- 账号池已经完成统一账号卡片、多格式端点和厂商预设：`AccountRecord` 可携带 `supportedFormats`、`formatBaseUrls`、`models`，`vendorPresets` 可描述厂商的默认端点、模型建议和格式能力。
- Codex / Claude Code 已分别具备本地配置写入能力：
  - Codex local apply 支持三类语义：API Key 模式写入 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`；账号 OAuth / auth-file 模式写入所选账号的 OAuth `auth.json` 并让 Codex 走 ChatGPT/Codex OAuth backend；Status 页的保留 ChatGPT 登录态模式只读取校验本机 `auth.json`，实际只 patch `config.toml` 的 custom provider 字段。
  - Claude Code local apply 写入 `~/.claude/settings.json` 的受控 `env` 字段，覆盖 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、模型族字段和常用运行参数。
- 账号卡右上角操作菜单位于 `frontend/src/features/accounts/components/AccountCard.tsx` 的 actions menu 区域。当前菜单已有复制、复制内容、启停、删除等动作，但还没有把“已识别模板的账号”直接带入 Codex / Claude Code 配置流程。
- 用户提出：如果账号存在应用模板，应支持直接映射 Codex / Claude Code 配置。本期先开 space 讨论需求边界和细节，不直接进入实现。

## 目标
1. 为账号卡新增“模板映射到本地 CLI 配置”的产品边界：只有账号能匹配到稳定应用模板时才展示相关动作。
2. 支持从账号卡动作菜单快速生成 Codex 或 Claude Code local apply 草稿，减少用户在状态页重复选择 endpoint、provider、model 的步骤。
3. 复用现有 local apply 的 diff 预览、预检和保留式写入，不在账号卡内另写一套 `config.toml` / `settings.json` 写入逻辑。
4. 把账号模板、目标 CLI、API 格式和模型映射关系显式建模，避免用 provider 名称或 URL 字符串临时猜测。
5. 明确安全边界：Codex API key 账号应用到 Codex 时写入当前账号资产自身的 `apiKey` 与上游 `baseUrl`；OAuth/auth-file 账号写所选账号 OAuth；Claude Code 默认仍经由 GetTokens relay。
6. Codex 侧必须先读取用户当前 `CODEX_HOME/config.toml` 中的 root `model_provider`；优先沿用用户正在使用的 provider，只 patch 对应 `[model_providers.<current>]` 的受控字段，避免已有会话因为 provider id 变化需要批量迁移。

## 范围
- 入口：账号卡右上角三点菜单新增模板相关动作，建议分为：
  - `应用到 Codex`
  - `应用到 Claude Code`
  - 若两个目标都不可用，则不展示该分组。
- 可用性判定：
  - 账号已有显式模板标识，或可通过 `resolveVendorPresetID` / base URL / provider 解析到 `vendorPresets`。
  - 本需求的菜单按钮只允许来自“官方/已验证应用模板目标”白名单；没有官方支持的目标不渲染按钮，也不渲染可点击禁用态，避免用户以为配置后可用。
  - Codex 映射要求“应用模板”显式支持 Codex，并且模板或账号具备 `openai_responses` 或 `openai_chat` 能力；不能只因为厂商 API 支持 OpenAI-compatible 就自动生成 Codex 动作。
  - DeepSeek 当前按官方应用模板只开放 Claude Code 入口；即使底层 API 有 OpenAI-compatible 能力，P0 也不展示 DeepSeek 的 Codex 动作。
  - 如果只支持 `anthropic` 或只存在 Claude Code 官方模板，默认不提供 Codex 动作，除非后续 sidecar 或官方模板明确支持跨格式转换。
  - Claude Code 映射要求模板或账号支持 `anthropic`；优先使用 `formatBaseUrls.anthropic`，没有时回退 `baseUrl`。
  - 账号必须处于可请求状态；禁用或阻塞账号可展示禁用态菜单项和原因，但不执行写入。
- 映射产物：
  - Codex：生成 `CodexLocalTargetDraft`，包含 relay key、endpoint、model、provider id/name、wire API 和 auth strategy 建议。
  - Claude Code：生成 `ClaudeCodeLocalApplyDraft`，包含 relay key、base URL、`ANTHROPIC_MODEL`、`ANTHROPIC_DEFAULT_*` 模型族字段、`ANTHROPIC_SMALL_FAST_MODEL` 等。
  - 模型建议来自账号 `models`、模板 `modelSuggestions`、Claude 默认 profile 或 Codex relay model catalog；用户已有显式选择优先级最高。
- 交互路径：
  - P0 推荐方案：点击菜单项后先弹出新的配置确认页面或确认面板，用户确认修改信息后再进入或执行现有 local apply。
  - 确认页面必须展示目标 CLI、目标文件 diff、受控字段、保留字段、relay key 来源、base URL、模型字段、provider / auth strategy 建议和风险提示。
  - 确认页面只承载草稿确认和文件改动预览；最终 preview / apply 仍调用同一套 local apply 逻辑。
  - 确认页面采用文件预览器布局：左侧只列将写入或只读校验的目标文件，右侧展示选中文件 diff。`StatusApplyLocalSection` 只作为 diff builder、preflight 和 apply handler 的逻辑参考，不作为布局参考。
- 数据建模：
  - 优先在模板层增加 `localCliMappings` 或等价纯模型函数，而不是把 Codex / Claude Code 的判断散落到 `AccountCard.tsx`。
  - `AccountCard.tsx` 只负责渲染动作和派发 intent；实际映射逻辑放到 `frontend/src/features/accounts/model/` 或可被 status 复用的 model 模块。
- 文案和反馈：
  - 菜单动作需要区分“生成配置草稿”和“已经写入本机配置”。
  - 写入前必须展示目标文件、受控字段和保留字段。

## 非目标
- 不在账号卡内直接 patch `CODEX_HOME/config.toml`、`CODEX_HOME/auth.json` 或 `~/.claude/settings.json`。
- 不把账号卡变成完整 local apply 工作台；复杂 provider、auth strategy、模型族字段仍在 Status local apply 中完成。
- P0 不支持把上游账号 API Key 直写到 Claude Code；Claude Code 仍写 GetTokens relay 入口。Codex API key 账号是例外：API Key 模式必须写当前账号资产自身内容，不能用 relay key 代替。
- P0 不实现跨协议转换，例如仅 `anthropic` 账号直接映射到 Codex，或仅 `openai_chat` 账号直接映射到 Claude Code。
- 不新增第二套厂商模板系统；继续复用或扩展现有 `vendorPresets`。
- 不自动覆盖用户已有 Codex provider、Claude env、MCP、profiles、agents、permissions、hooks、statusLine 或未知字段。

## 验收标准
1. Given 账号卡匹配到应用模板且支持 Codex 目标格式，When 用户打开右上角菜单，Then 菜单展示 `应用到 Codex` 动作。
2. Given 账号卡匹配到应用模板且支持 Claude Code 目标格式，When 用户打开右上角菜单，Then 菜单展示 `应用到 Claude Code` 动作。
3. Given 用户已打开账号详情页，When 该账号匹配到可展示的本地 CLI 应用目标，Then 详情页 footer 同样展示 `应用到 Codex` / `应用到 Claude Code` 动作，disabled 状态和原因必须复用账号卡同一套 mapping。
4. Given 账号详情页同时存在关闭、本地 CLI 应用和保存类动作，When 用户扫描详情页，Then 关闭入口必须以内容区右上角低权重图标按钮呈现，footer 只保留本地 CLI 应用与保存类动作，避免关闭与写入/保存混在一起。
5. Given 账号没有可识别模板，When 用户打开右上角菜单，Then 不展示 Codex / Claude Code 映射动作，避免用户误以为可以安全套用未知配置。
6. Given DeepSeek 账号命中官方应用模板，When 用户打开右上角菜单，Then 只展示 `应用到 Claude Code`，不展示 `应用到 Codex` 按钮。
7. Given 账号被禁用或当前不可请求，When 用户查看模板映射动作，Then 动作不可执行并展示禁用原因；不会写入本机配置。
8. Given 用户点击 `应用到 Codex`，When 进入配置确认流程，Then 当前 Codex local apply 草稿包含正确的 relay key、base URL、provider id/name、model 和 auth strategy 建议。
9. Given 用户点击 `应用到 Claude Code`，When 进入配置确认流程，Then 当前 Claude Code local apply 草稿包含正确的 relay key、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL` 和可用的模型族字段建议。
10. Given 模板同时官方支持 Codex 与 Claude Code，When 用户分别应用到 Codex 和 Claude Code，Then Codex 使用 Codex 目标格式规则，Claude Code 使用 `formatBaseUrls.anthropic || baseUrl`，两者互不污染。
11. Given 用户已有本地 Codex ChatGPT 登录态且在 Status 页选择保留模式，When 执行 Status local apply，Then 仍需通过既有 preflight 校验，不因账号卡需求而绕过 `requires_custom_provider` / `missing_chatgpt_auth` 限制。
12. Given 用户从 OAuth / auth-file 账号点击 `应用到 Codex`，When 查看确认页，Then 页面必须展示 `CODEX_HOME/auth.json` 将写入所选账号的 OAuth tokens，`CODEX_HOME/config.toml` 将移除会让 Codex 走 API key / relay token 的 provider token 字段，并让请求进入 ChatGPT/Codex OAuth backend。
13. Given 单个 Codex 账号进入应用确认页，When 用户查看确认页，Then 应用模式必须由账号来源固定决定；API Key 账号只展示 API Key 写入方案，OAuth / auth-file 账号只展示 OAuth 写入方案，不允许在同一个账号确认页中切换 API Key 与 OAuth。
14. Given 用户已有 Codex `config.toml` 且 root `model_provider` 指向某个 provider，When 从账号卡生成 Codex 草稿，Then 确认页必须展示当前 provider，并默认 patch `[model_providers.<current>]`；不得默认改成 `gettokens` 或按账号新建 provider。
15. Given 用户当前 `model_provider = "openai"` 且账号为 OAuth / auth-file，When 生成 Codex 草稿，Then 可以复用内置 `openai` provider，但必须移除既有 `openai_base_url` override，让 Codex 根据 `auth_mode=chatgpt` 使用 ChatGPT/Codex backend。
16. Given 用户已有 Claude Code `settings.json` 中的 `permissions`、`hooks`、`statusLine` 或未知字段，When 最终执行 apply，Then 只 patch 受控 `env` 字段并保留其他内容。
17. Given 用户在确认页修改模型或 provider，When 返回账号卡或刷新页面，Then 不把临时修改反写到账号模板；模板只提供默认草稿。
18. Given 用户点击账号卡或账号详情页的 `应用到 Codex` / `应用到 Claude Code`，When 系统生成配置草稿，Then 必须先打开新的确认页面或确认面板；用户未确认前不得写入本机 CLI 配置。
19. Given 用户打开确认页面，When 查看修改信息，Then 页面展示目标文件 diff、将新增或修改的字段、明确保留不动的字段，以及可能的冲突 warning。
20. Given 用户在确认页面点击取消，When 返回账号卡或账号列表，Then 不写入任何本地 CLI 文件，也不改变账号模板或账号排序。
21. Given 普通浏览器 preview 环境缺少 Wails runtime，When 打开包含模板账号的账号卡或详情页，Then 动作可演示确认页面，不调用真实写入绑定。
22. Given 相关纯模型函数新增或修改，When 运行前端单测，Then 覆盖模板匹配、目标可用性、格式端点选择、模型默认值和禁用态原因。

## 需求细节草案

### 1. 应用模板定义

本期先把“应用模板”理解为可稳定映射到本地 CLI 目标的厂商/工具模板，而不是一次性的 UI 模板。这里必须区分两类能力：

1. API 格式能力：账号或厂商是否具备 `openai_chat`、`openai_responses`、`anthropic` 等请求格式。
2. 应用模板能力：官方或项目内模板是否明确适配某个本地 CLI，例如 DeepSeek 当前只作为 Claude Code 官方模板处理。

候选来源：

1. `vendorPresets`：当前最接近应用模板的数据结构，已经包含厂商、格式、端点和模型建议。
2. `AccountRecord`：运行时账号事实源，包含 `supportedFormats`、`formatBaseUrls`、`models`、`disabled`、`status`。
3. 后续如引入独立 `appTemplates`，也应由统一 resolver 输出同一份映射结果，不让 UI 关心来源。

按钮渲染硬规则：

1. `supportedFormats` 只参与 endpoint / draft 生成，不直接决定按钮是否出现。
2. `localCliTemplateTargets` 或等价 resolver 输出必须来自官方/已验证模板白名单。
3. 未验证目标不展示按钮；最多在详情或确认页中以说明文字解释原因，不提供可点击入口。

建议新增纯模型输出：

```ts
interface AccountLocalCliMapping {
  accountID: string;
  templateID: string;
  target: 'codex' | 'claude';
  enabled: boolean;
  disabledReason?: string;
  format: 'openai_responses' | 'openai_chat' | 'anthropic';
  baseUrl: string;
  modelSuggestions: string[];
}
```

### 2. Codex 映射规则

1. 先要求应用模板显式支持 Codex，再优先匹配 `openai_responses`，其次 `openai_chat`。
2. Codex API key 账号写入当前账号资产自身的 `apiKey` 与匹配到的格式化上游 `baseUrl`；缺少 GetTokens relay key 不应禁用该路径。Codex OAuth/auth-file 账号写所选账号 OAuth auth-file；Claude Code 仍写 GetTokens relay 入口。
3. 源码校准依据为 OpenAI Codex `codex-rs/login/src/auth/storage.rs`、`codex-rs/model-provider/src/auth.rs`、`codex-rs/model-provider-info/src/lib.rs`：
   - `auth.json` 是 Codex 一方读取 API key / ChatGPT tokens 的结构化文件；API Key 模式必须写 `auth_mode=apikey` 与 `OPENAI_API_KEY`，OAuth / auth-file 账号必须写 `auth_mode=chatgpt` 与所选账号的 `tokens`。
   - Codex 读取 `auth.json` 时先解析 `auth_mode`，再 fallback 到 `OPENAI_API_KEY`：`auth_mode=apikey` 只读 `OPENAI_API_KEY`，`auth_mode=chatgpt` / `chatgptAuthTokens` 走 `tokens`；只有缺失 `auth_mode` 时，存在 `OPENAI_API_KEY` 才 fallback 为 API Key 模式。
   - API Key 模式对齐 Codex CLI `login_with_api_key` 行为：写入时重建最小 `auth.json`，只保留 `auth_mode` 与 `OPENAI_API_KEY`；必须清理旧 OAuth `tokens`、`last_refresh`、`agent_identity`、`user` 等字段，避免同一文件同时表现为 API key 与 OAuth。
   - provider auth 会先取 provider 的 `env_key` API key，再取 `experimental_bearer_token`，最后才回退到 `auth.json` 的 OpenAI / ChatGPT auth。
   - `auth_mode=chatgpt` 且 provider 没有 base URL override 时，Codex 会使用 `https://chatgpt.com/backend-api/codex`，这是账号 OAuth 应用到 Codex 的目标请求路径。
   - `wire_api = "chat"` 已被源码拒绝，custom provider 应写 `wire_api = "responses"`。
4. `providerID` 默认来自用户当前 `config.toml` 的 root `model_provider`；不要按模板 slug 生成 `gettokens-<templateID>`，也不要默认改成固定 `gettokens`。
   - 账号 OAuth / auth-file 模式下，`auth.json` 是写入目标，来源为用户选中的账号 auth-file；`config.toml` 的 custom provider 应移除 `env_key` 与 `experimental_bearer_token`，并把 `base_url` 指向 ChatGPT/Codex backend，避免 Codex 继续走 API key / relay token。
   - Status 页保留 ChatGPT 登录态模式下，`auth.json` 是只读 preflight 输入，不是写入目标；`config.toml` 必须使用非 `openai` 的 custom provider，并写入 `experimental_bearer_token = <relay key>`。
   - 不同账号切换时优先更新当前 provider section 下的 `base_url` / `experimental_bearer_token` / 受控字段；root `model_provider` 只在用户明确选择或当前配置不可用于目标模式时才变化。
   - 如果当前 root `model_provider` 缺失，API Key 模式可按既有 local apply 默认策略写入；OAuth / preserve 模式必须选择或创建一个 custom provider，不能静默使用内置 `openai`。
5. `model` 默认来自账号显式映射 alias 或模板第一个 Codex 可用模型；没有可靠建议时回退当前 Status local apply 已选模型。
6. `model_reasoning_effort` 不由账号模板强制覆盖；除非模板未来提供明确支持矩阵，否则保留当前用户选择或 Codex 默认值。
7. DeepSeek 这类“API 可 OpenAI-compatible，但官方应用模板当前只适配 Claude Code”的厂商，不生成也不展示 Codex 动作。

### 3. Claude Code 映射规则

1. 必须支持 `anthropic` 格式。
2. `ANTHROPIC_BASE_URL` 使用 GetTokens relay 的 Claude Code 入口；账号模板的 `formatBaseUrls.anthropic` 用于构建 relay 内部候选和展示来源，不直接写给 Claude Code，除非后续明确进入 direct upstream 模式。
3. `ANTHROPIC_MODEL` 优先来自账号模型 alias，其次 Claude 默认 profile，其次模板 `modelSuggestions`。
4. `ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_SMALL_FAST_MODEL` 可由默认 profile 填充；没有可信来源时保持空，不伪造。
5. 如果检测到 `ANTHROPIC_AUTH_TOKEN` 冲突，沿用现有 Claude local apply warning，不在账号卡吞掉风险提示。

### 4. 推荐一期路径

1. 先做纯模型：从 `AccountRecord + VendorPreset + 当前 relay 状态` 推导 Codex / Claude Code 可用动作和草稿。
2. 再接账号卡菜单：在 `AccountCard.tsx` actions menu 中按 resolver 结果渲染动作。
3. 再接确认页面：点击动作后打开独立确认页面或确认面板，使用左侧文件列表 + 右侧 diff 预览展示受控字段、保留字段和 warning。
4. 再接 local apply：用户确认后复用现有 Status local apply 的 preview / apply 能力，避免新增第二套写入逻辑。
5. 最后补 browser preview 和单测，确认无 Wails runtime 时不会误调用真实写入。

### 5. 确认页面实现参考

`frontend/src/features/status/StatusFeature.tsx` 当前在状态页根容器下渲染 `StatusApplyLocalSection`，可作为本需求确认页面的结构参考：

1. `StatusFeature` 负责持有全局状态和 apply handler，并把 `relayKeyItems`、`visibleRelayEndpoints`、`relayProviderOptions`、`selectedRelayModel`、`localCodexAuthState` 等传入 section。
2. `StatusApplyLocalSection` 内部用 `activeTarget` 区分 `Codex / Claude Code`，可复用其 `buildCodexLocalApplyDiff` 或 `buildClaudeCodeSettingsDiff` 生成 diff。
3. Codex 侧已有 preflight：`getCodexLocalApplyPreflight` 与 `resolveCodexLocalApplyState` 控制是否可应用，并展示 recovery action。
4. Claude Code 侧已有 `ClaudeCodeLocalApplyDraft` 状态和 settings diff，最终调用 `onApplyClaude({ ...claudeDraft, baseUrl: selectedEndpointBaseUrl })`。
5. 本需求不直接复刻整段状态页 JSX；建议新增账号确认组件，由账号模板 resolver 提供初始草稿，组件继续复用 diff builder、preflight 和 apply handler，并按文件预览器布局展示。
6. 确认页面按钮语义应从“应用到 Codex / Claude Code”细化为“确认并应用”，并提供“取消”回到账号卡，不允许在进入确认页前写文件。

## 后续问题
1. “直接映射”的当前边界已经收敛：Codex API key 模式写当前账号资产；Claude Code 仍走 relay。未来若要让 Claude Code 或其他 CLI 支持 direct upstream，需要单独设计回滚、密钥来源和 UI 风险提示。
2. 应用模板是否就等于 `vendorPresets`，还是需要新增独立 `appTemplates` 概念？当前建议先扩展 `vendorPresets` 或增加 resolver，避免过早拆新系统。
3. 如果一个账号支持多个模板或多个格式端点，菜单是否让用户选目标模板，还是使用 resolver 的最高置信匹配？当前建议 P0 使用最高置信匹配并在确认页允许调整。
4. Codex 映射是否需要把选中账号固定为单账号候选？当前账号列表已有路由策略雏形，但 local apply 尚未持久化单账号 pin，P0 建议只生成 CLI 配置草稿，不修改请求顺序或候选策略。

## 已定交互形态

- 从账号卡右上角菜单进入账号池内确认 overlay / modal，不跳转到 Status 页，也不复用 Status 页整段 JSX。
- 确认页必须先于本机写入出现；取消或关闭不写任何文件。
- 确认页使用文件预览器布局：左侧文件列表，右侧选中文件 diff；顶部用短摘要展示来源账号、目标 CLI、固定应用模式和当前 Codex provider。

## 设计稿入口

- 本期设计系统体验：`Design System / 业务组件 / 账号卡片 / Account Template Apply Menu`
- Storybook URL：`http://localhost:6007/?path=/story/design-system-业务组件-账号卡片--account-template-apply-menu`
- 实现边界：当前只在设计系统 story 内演示账号卡右上角菜单、DeepSeek 已验证 Claude Code 模板动作和确认页；确认按钮只输出 `PREVIEW ONLY`，不调用 Wails 写入。
- 体验调整：确认页从“来源/配置/受控字段”多面板改为文件预览器布局，左侧只列将改动的文件，右侧只展示选中文件 diff。
- Codex 设计稿：同一 story 增加两个 Codex 账号样例，模式由账号来源固定，不在弹页内提供 API Key / OAuth 切换：
  - `OpenAI API Key Relay`：API Key 账号，确认页左侧文件列表包含 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`，右侧分别预览 `OPENAI_API_KEY` 与 provider/model 配置 diff；设计稿模拟当前用户 provider 为 `team-codex-relay`，root `model_provider` 只读展示，不作为本次改动。
  - `OpenAI Codex OAuth`：OAuth / auth-file 账号，确认页只展示固定的 OAuth 写入方案；左侧文件列表包含 `CODEX_HOME/auth.json` 与 `CODEX_HOME/config.toml`，右侧预览 `auth_mode=chatgpt`、所选账号 tokens、移除 `OPENAI_API_KEY` / provider token 字段，并让 provider 指向 ChatGPT/Codex backend。
- 截图归档：
  - `screenshots/20260520/account-card/20260520-account-card-template-menu-after-v01.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-confirm-after-v02.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-mobile-after-v02.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-codex-apikey-after-v01.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-codex-config-after-v01.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-codex-preserve-after-v01.png`
  - `screenshots/20260520/account-card/20260520-account-card-template-codex-apikey-mobile-after-v01.png`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260520-account-template-cli-mapping`
- worktree：`../GetTokens-worktrees/20260520-account-template-cli-mapping/`

## 相关链接
- `frontend/src/features/accounts/components/AccountCard.tsx`
- `frontend/src/features/accounts/model/vendorPresets.ts`
- `frontend/src/features/status/StatusFeature.tsx`
- `frontend/src/features/status/components/StatusPanels.tsx`
- `frontend/src/features/status/model/relayLocalState.ts`
- `internal/wailsapp/relay_local_apply.go`
- `internal/wailsapp/claude_local_apply.go`
- [账号模板厂商文档链接盘点](../../references/20260520-account-template-vendor-doc-links.md)
- [详细设计：账号模板到本地 CLI 配置确认页](plans/20260520-template-cli-mapping-detail.md)
- [实施前整理：账号模板映射本地 CLI 配置](plans/20260520-implementation-readiness.md)
- [实施报告：账号模板映射本地 CLI 配置](plans/20260520-implementation-report.md)
- [账号卡右上角操作菜单](../20260502-account-card-actions-menu/README.md)
- [Codex 账号列表 Tab](../20260511-codex-account-list-tab/README.md)
- [Claude Code Account List](../20260519-claude-code-account-list/README.md)
- [统一账号卡片 + 多格式端点 + 厂商预设](../20260517-unified-account-cards/README.md)

## 当前状态
- 状态：implemented-browser-verified
- 最近更新：2026-05-20
