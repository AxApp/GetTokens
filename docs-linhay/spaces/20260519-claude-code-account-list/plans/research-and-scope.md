# Claude Code 账号列表调研与范围

## 调研结论

本期要覆盖的不是 Claude Code 本地 `settings.json` 的“多 key 管理”，而是 GetTokens relay 为 Claude Code 提供的 Anthropic 格式账号候选工作台。

旧结论把账号列表判为 N/A，原因是 Claude Code 自身只消费 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`。这个判断对“直接编辑 Claude Code 本地配置”仍成立，但对 GetTokens 现在的 relay 形态已经不够：账号池已经有统一 `AccountRecord`、`supportedFormats`、`formatBaseUrls` 和多厂商 Anthropic 兼容端点，Claude Code 请求完全可以通过 relay 在这些账号之间排序和探测。

## 可复用资产

### Codex 账号列表

- 请求顺序列表、启停保留、阻塞过滤、详情 modal、路由探测 modal 的信息架构可复用。
- 模型层拆分方式可复用：账号合并排序、路由策略、模型映射和模型候选分别拆文件。
- 浏览器 preview 规则可复用：缺少 Wails runtime 时必须有稳定数据和 preview-only 操作。

### 统一账号体系

- `AccountRecord.supportedFormats` 已能表达账号支持 `anthropic`、`openai_chat`、`openai_responses`、`gemini_native`。
- `AccountRecord.formatBaseUrls` 已能表达同一账号不同格式的 endpoint。
- `resolveDefaultFormats` 已把主流 Anthropic 兼容厂商标记为 `anthropic` 可用。
- 账号卡 tone、usage、quota、billing、rate-limit 可沿用账号池共享组件，不为 Claude Code 新建视觉系统。

### Claude Code local apply

- 已有 Wails 方法 `ApplyClaudeCodeAPIKeyConfigToLocal`，写入 `~/.claude/settings.json` 的 env。
- 已覆盖 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL`、默认 Haiku/Sonnet/Opus、Small Fast、max output、timeout 和 nonessential traffic 开关。
- 本期只需要展示或链接该入口，不重复实现写入逻辑。

## 一期需求边界

### 必须做

- 新建 Claude Code 账号列表入口。
- 从 `ListAccounts` 读取统一账号，筛选 `supportedFormats` 包含 `anthropic` 的候选。
- 展示请求顺序、来源、格式、出口、模型映射、可请求状态、阻塞原因、用量和 quota/billing 概览。
- 支持账号详情内编辑模型映射：
  - 展示方向：真实上游模型 `name` -> Claude Code 请求模型 `alias || name`。
  - 运行时方向：Claude Code 请求模型 alias -> 真实上游模型 name。
  - 默认同名透传，不保存同名映射。
  - 按 `name + alias` 去重，允许同一个真实模型映射多个 Claude Code alias。
- 拖拽排序后复用 `UpdateAccountPriority` 自动保存。
- 启停复用 `SetAccountDisabled`，禁用账号保留排序但不进入候选。
- 浏览器 preview 覆盖列表、排序、启停和探测空跑。
- 增加前端模型单测，先红灯再实现。

### 建议同期开工但可拆分

- Claude Code 路由探测：新增 `ProbeClaudeCodeAccountRouting` 或泛化现有 probe，发起 Anthropic Messages 最小请求。
- 路由探测 modal 复用 Codex 的工作台结构：顶部状态、左侧控制、右侧候选队列和终端式测试流。
- 顶部展示 local apply summary：当前 relay base URL、relay key、模型字段入口。
- 模型候选下拉：真实模型候选从账号远端 `/models`、账号预设或本地已保存映射聚合；Claude Code alias 候选从 local apply 当前模型、常用 Claude 模型和 relay catalog 聚合。

### 暂不做

- settings.json 通用编辑器。
- Claude Code MCP / Skills / Hooks / Permissions。
- CLAUDE.md 管理。
- 账号创建流程重做。
- 非 Anthropic 格式强行纳入候选。

## 模型映射语义

Claude Code 账号列表必须支持模型映射，并且不能只做展示。

当前 sidecar 已有两类可复用机制：

- API key / openai-compatible 类账号：配置里的 `models[].alias` 是客户端请求模型，`models[].name` 是真实上游模型；运行时会按 alias 查找到 name。
- OAuth/auth-file 类账号：`oauth-model-alias` 支持 `claude` channel，运行时可以把请求模型解析到真实上游模型。

因此本期 UI 用同一套表达方式：

| 字段 | 含义 |
|------|------|
| 真实模型 `name` | 账号上游实际接受的模型名 |
| Claude Code 模型 `alias` | Claude Code / local apply / 用户请求时使用的模型名 |
| 空映射 | 默认透传，不写入配置 |

与 Codex 账号列表的差异：

- Codex 页面常强调 `真实模型 -> Codex 模型`，主要服务 OpenAI/Codex 模型 alias。
- Claude Code 页面需要额外强调运行时解析方向：`Claude Code 请求模型 alias -> 真实模型 name`。
- Claude Code 默认模型字段来自 `settings.json env` / local apply，但映射配置保存在 relay 账号或 oauth alias 配置中，不能写进 `settings.json`。

## 默认模型 profile / 映射表调研

用户明确要求不能凭空手写默认映射表。本期默认模型能力分两层建模：

- `ProviderDefaultModelProfile`：来自官网或参考项目的厂商默认 Claude Code 模型字段，记录 main / haiku / sonnet / opus / base URL / 来源 / 检查日期。
- `RelayModelMappingDraft`：由 profile 生成的可编辑草稿，保存时仍走 sidecar 现有 `models[].name + alias` 或 `oauth-model-alias[channel=claude]`。

官方默认值、官方可切换模型和旧预设差异统一维护在 [official-model-profiles.md](./official-model-profiles.md)。本文件只保留建模和实现规则。

默认 profile 的来源优先级：

1. 官网/官方文档最新 Claude Code 配置。
2. 本地参考项目 `docs-linhay/references/cc-switch/src/config/claudeProviderPresets.ts`。
3. GetTokens 当前 `frontend/src/features/accounts/model/vendorPresets.ts` / `modelSuggestions`。
4. 账号远端 `/models` 动态发现。
5. 用户手工输入。

保存规则：

- 默认 profile 只能生成草稿或填充 local apply，不能静默覆盖用户已保存映射。
- 用户确认套用时，按 `name + alias` 去重，允许同一个真实模型生成多个 Claude alias。
- 如果官网和本地预设不一致，UI 必须显示 source badge 和 diff；已给出官网来源的厂商以官网默认值为准，旧预设只进入迁移提示，不参与默认值决策。
- Claude Code 官方文档已经支持 `ANTHROPIC_CUSTOM_MODEL_OPTION` 和网关 `/v1/models` discovery，因此静态默认 profile 只负责官方默认值与首屏填充，不是最终模型目录真相。

### 默认 profile 数据形状建议

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
  officialAlternatives?: string[];
  legacyPresetValues?: string[];
  notes?: string[];
};
```

从 profile 生成 relay 映射草稿时，默认 alias 不应固定写死为某一代 Claude 模型，而应来自当前 local apply / Claude Code alias 选项。例如用户选择把 `sonnet` alias 固定为 `claude-sonnet-4-6` 时，DeepSeek 草稿生成：

| 真实上游模型 `name` | Claude Code alias |
|---------------------|-------------------|
| `deepseek-v4-pro[1m]` | `claude-sonnet-4-6` |
| `deepseek-v4-pro[1m]` | `claude-opus-4-7` |
| `deepseek-v4-flash` | `claude-haiku-4-5` |

如果用户选择直接把 local apply 模型字段写成厂商真实模型，则可以不生成 relay alias，保持同名透传。

## BDD 场景

### 场景 1：按 Anthropic 格式筛选账号

Given 账号池包含 DeepSeek、Kimi、Gemini、Copilot 和禁用 Anthropic 账号
When 用户打开 Claude Code 账号列表
Then DeepSeek、Kimi、Anthropic 出现在列表
And Gemini、Copilot 不作为 P0 候选出现
And 禁用 Anthropic 保留在列表但标记为不可请求

### 场景 2：多格式账号使用 Anthropic endpoint

Given DeepSeek 账号同时有 `openai_chat` 和 `anthropic` endpoint
When 用户查看 Claude Code 账号详情
Then 请求出口显示 `formatBaseUrls.anthropic`
And 格式标签显示 `ANTHROPIC`

### 场景 3：排序即运行时候选顺序

Given 用户把 Kimi 拖到 DeepSeek 前面
When 保存完成并打开路由探测
Then 候选队列按 Kimi、DeepSeek 的顺序展示
And 探测请求使用该顺序，不维护第二套策略顺序

### 场景 4：探测命中账号

Given 当前候选顺序为 Kimi、DeepSeek
When 用户用 `claude-sonnet-*` 模型测试一次
Then 测试流展示本次 Anthropic Messages 探测
And 页面高亮实际命中账号
And 失败时展示 HTTP 状态、错误摘要和候选队列

### 场景 5：local apply 边界清晰

Given 用户已经在 Status 页写入 Claude Code local apply
When 打开 Claude Code 账号列表
Then 页面展示当前 relay endpoint 入口说明
And 不自动修改 `~/.claude/settings.json`
And 用户需要主动点击 local apply 相关动作才写入本地配置

### 场景 6：模型映射生效

Given DeepSeek Anthropic 兼容账号配置 `deepseek-chat -> claude-sonnet-4-5`
When Claude Code 通过 relay 请求 `claude-sonnet-4-5` 并命中该账号
Then sidecar 转发给 DeepSeek 的真实模型为 `deepseek-chat`
And 页面测试流保留用户请求模型和真实上游模型证据

### 场景 7：同一真实模型多个 Claude alias

Given 账号需要把 `deepseek-chat` 同时映射为 `claude-sonnet-4-5` 和 `claude-opus-4-5`
When 用户保存模型映射并刷新页面
Then 两条映射都保留
And 保存逻辑不按真实模型名单独去重

### 场景 8：套用厂商默认 profile

Given DeepSeek 账号没有显式模型映射
And 默认 profile 来源为官方文档
When 用户点击“套用默认模型映射”并选择 Claude alias 目标集
Then 页面生成 `deepseek-v4-pro[1m] -> sonnet/opus alias` 与 `deepseek-v4-flash -> haiku alias` 草稿
And 保存前允许用户逐条编辑
And 保存后不再被后续 profile 更新自动覆盖

### 场景 9：官网与预设冲突

Given Kimi 账号命中本地预设 `kimi-k2.6`
And 官网 agent-support 文档当前展示 `kimi-k2.5`
When 用户打开模型映射编辑器
Then 页面显示 source-conflict 提示
And 默认值以官网 `kimi-k2.5` 为准
And `kimi-k2.6` 只作为旧预设差异提示，不自动写入映射

## 技术风险

- sidecar 的 route policy hook 是通用的，但 Claude Code 探测请求需要确认走哪条 Anthropic relay path 才能经过同一候选改写链路。
- `supportedFormats` 是当前最稳定的筛选入口，但历史账号可能缺字段；实现时需要对老数据做 fallback 推断。
- `formatBaseUrls.anthropic` 与 `baseUrl` 的优先级必须前后一致，否则 UI 显示出口和实际请求出口可能不一致。
- 模型映射的展示方向和运行时方向相反，UI copy 必须明确，避免用户误以为 `alias` 是上游真实模型。
- 默认模型 profile 与 relay 映射不是同一层数据；实现时不能把 `ANTHROPIC_DEFAULT_*_MODEL` 直接误写成所有账号的持久 alias。
- 厂商官网变化快，静态 profile 必须展示 `checkedAt` 和 source；远端 `/models` 只能刷新可切换模型集合，不能覆盖官网默认值或用户已保存映射。
- 账号使用量归因当前已有 Claude Code billing header 解析能力，但本期是否能实时用于探测证据，需要在实现时验证 sidecar recent request 数据结构。
- 如果未来要把 `openai_responses` 或 `gemini_native` 账号纳入 Claude Code，需要先定义 translator 能力和模型映射，不能在账号列表里只靠 UI 标签放行。

## 初始验证计划

- 前端模型测试：`npm --prefix frontend run test:unit -- src/features/claude-code/claudeAccountList.test.mjs` 或同等新测试文件；覆盖候选筛选、排序、模型映射归一、同一真实模型多 alias、默认透传。
- 前端类型检查：`npm --prefix frontend run typecheck`。
- 后端探测测试：新增 Wails probe 后跑 `go test ./internal/wailsapp -run 'TestProbeClaudeCodeAccountRouting|TestDetectClaudeCodeRoutingProbeHit|TestListOAuthModelAliases|TestUpdateOAuthModelAliases'`。
- 浏览器 preview：打开目标 hash，验证无 Wails runtime 也能展示稳定账号、排序、启停、模型映射保存和 preview-only 探测。
- 涉及真实 sidecar 探测后，补 Wails 桌面验收与截图归档到本 space。

## 2026-05-20 设计系统收编

- 新增 `ClaudeCodeAccountListWorkbench` 纯展示组件，用固定 mock 覆盖 Claude Code 账号列表首屏业务信息。
- Storybook 入口为 `Design System/业务组件/Claude Code 账号列表`，统一放入设计系统 `feature-components` catalog。
- 已在 `componentManifest.ts` 登记为 admitted 业务组件，要求覆盖 `ready`、`source-conflict`、`disabled-blocked`、`profile-draft`。
- 设计系统展示坚持官方默认 profile 语义：官网默认值是权威默认；其他模型只标记为“官方可切换模型”，不再写成默认候选。
- 已验证 `node --test frontend/src/features/design-system/storyCatalog.test.mjs` 与 `npm --prefix frontend run typecheck` 通过。

## 2026-05-20 实现切片与冒烟

- 已落地 Claude 顶级 workspace，入口为 `#frame=claude&workspace=account-list`；旧 `#frame=codex&workspace=claude-account-list` 自动迁移。
- 已实现 `buildClaudeCodeAccountRows`、`buildClaudeCodeModelMappings`、`normalizeClaudeCodeModelMappingsForProvider`、`buildClaudeCodeProfileMappingDraft` 等模型函数。
- 当前页面已能在浏览器 preview 中展示 4 个 Anthropic 格式账号、3 个可请求账号、1 个禁用保留账号、7 条显式模型映射和 4 个官方默认 profile。
- 当前桌面端读取边界为 `ListAccounts` + `AccountRecord.supportedFormats`，并已接入 `UpdateAccountPriority`、`SetAccountDisabled`、模型映射保存和真实 Anthropic Messages 探测。
- 模型映射保存路径：
  - OAuth/auth-file：`UpdateOAuthModelAliases(channel="claude")`。
  - openai-compatible：`UpdateOpenAICompatibleProvider(models)`。
  - codex-api-key：`UpdateCodexAPIKeyConfig(models)`，后端已补 `Models []OpenAICompatibleModel` 并持久化到本地 codex api key store，再同步 sidecar。
- 路由探测路径：
  - 新增 Wails 方法 `ProbeClaudeCodeAccountRouting`。
  - 请求形态为 `POST /v1/messages`，body 包含 `model`、`max_tokens: 1` 和最小 user message。
  - 候选只取 `supportedFormats` 包含 `anthropic` 且运行态可请求的账号；禁用或阻塞账号保留列表排序但不进入 probe 候选。
  - route policy 复用 `X-GetTokens-Route-Allow`、`X-GetTokens-Route-Deny`、`X-GetTokens-Route-Order`、`X-GetTokens-Route-Fallback`。
  - route id 映射：auth-file 使用文件名；codex-api-key 使用 `buildStableRouteAuthID("codex:apikey", apiKey, formatBaseUrls.anthropic || baseUrl)`；openai-compatible 使用 `buildStableRouteAuthID("openai-compatibility:"+provider, apiKey, formatBaseUrls.anthropic || baseUrl, proxyURL)`。
- `AccountRecord` 已补 `apiKeys`、`headers`、`models`，用于前端详情页读取 API key / openai-compatible 的已保存模型映射和远端模型查询参数。
- 路由探测弹层复用 Codex 组件，并补了命中状态展示：已有命中后顶部状态栏显示最近命中账号，不再停留在 idle 文案。
- 已跑验证：
  - `go test ./...`
  - `node --test frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`
  - `npm --prefix frontend run test:unit`
  - `npm --prefix frontend run typecheck`
  - `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
  - `npm --prefix frontend run build`
  - `agent-browser` smoke：页面文本包含 `Claude Code 账号列表`、`DeepSeek Claude Code`、`路由探测`；preview 探测可显示 `DeepSeek Claude Code · HTTP 200 · browser preview`，浏览器错误为空。
- Smoke 截图归档：
  - `docs-linhay/spaces/20260519-claude-code-account-list/screenshots/20260520/claude-code/20260520-claude-code-account-list-web-preview-after-v02.png`
  - `docs-linhay/spaces/20260519-claude-code-account-list/screenshots/20260520/claude-code/20260520-claude-code-account-list-route-probe-after-v02.png`
