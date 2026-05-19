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

默认 profile 的来源优先级：

1. 官网/官方文档最新 Claude Code 配置。
2. 本地参考项目 `docs-linhay/references/cc-switch/src/config/claudeProviderPresets.ts`。
3. GetTokens 当前 `frontend/src/features/accounts/model/vendorPresets.ts` / `modelSuggestions`。
4. 账号远端 `/models` 动态发现。
5. 用户手工输入。

保存规则：

- 默认 profile 只能生成草稿或填充 local apply，不能静默覆盖用户已保存映射。
- 用户确认套用时，按 `name + alias` 去重，允许同一个真实模型生成多个 Claude alias。
- 如果官网和本地预设不一致，UI 必须显示 source badge 和 diff；未核实官网的厂商默认值标记为 `preset-fallback`。
- Claude Code 官方文档已经支持 `ANTHROPIC_CUSTOM_MODEL_OPTION` 和网关 `/v1/models` discovery，因此静态默认表只是首屏体验，不是最终模型目录真相。

### 官网与参考项目核对表（2026-05-19）

| 厂商 | 官网/官方文档当前默认 | 本地参考/预设 | 需求处理 |
|------|----------------------|---------------|----------|
| Anthropic | Claude Code 支持 `opus` / `sonnet` / `haiku` 族选择，`ANTHROPIC_DEFAULT_*_MODEL` 可 pin 具体模型；官方示例出现 `claude-opus-4-7`、`claude-sonnet-4-5`，网关场景支持 `/v1/models` discovery。 | GetTokens `vendorPresets` 建议 `claude-sonnet-4-6`、`claude-opus-4-7`、`claude-haiku-4-5`。 | 官方模型目录和 relay `/models` 优先；本地建议只作为 alias 候选。 |
| DeepSeek | 中文官方 Claude Code 文档推荐 `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`，main/sonnet/opus 为 `deepseek-v4-pro[1m]`，haiku 为 `deepseek-v4-flash`，并给出 `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash` 与 `CLAUDE_CODE_EFFORT_LEVEL=max`。 | `cc-switch` 与 GetTokens 当前为 `deepseek-v4-pro` / `deepseek-v4-flash`，缺少 `[1m]` 变体和 subagent/effort 字段。 | profile 保留官网 `[1m]` 主模型，同时把无 `[1m]` 作为 preset fallback / 可选候选；subagent/effort 作为 local apply 扩展字段候选，不写入 relay 映射。 |
| 阿里云百炼 | 官方 Claude Code / Token Plan 文档已推荐 `qwen3.6-plus`，haiku 为 `qwen3.6-flash`；Token Plan、Coding Plan、按量付费有不同 base URL，如 `token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic`、`coding.dashscope.aliyuncs.com/apps/anthropic`、`dashscope.aliyuncs.com/apps/anthropic`。用户补充的控制台文档入口为 `url=2949529` 与 `url=3031966`。 | `cc-switch` Bailian/Bailian For Coding 只填 base URL，GetTokens 仍有 `qwen3.5-plus` / `qwen3.5-flash` 建议。 | 需要更新默认 profile 到 `qwen3.6-*`，并按 base URL 区分百炼 Token Plan / Coding Plan / Pay-as-you-go。控制台 hash 链接作为官方来源保留，但实现时应优先使用可公开抓取的 help 页面或后台文档 API 校准。 |
| Kimi / Moonshot | Moonshot agent-support 文档展示 Claude Code 配置为 `kimi-k2.5`；页面导航同时有 K2.6 quickstart，但本次未确认 K2.6 的 Claude Code env 示例。 | `cc-switch` 与 GetTokens 当前为 `kimi-k2.6`，OpenAI-compatible 旧预设有 `kimi-k2.5`。 | 标记为 source-conflict：实现时先用官网 agent-support 的 `kimi-k2.5`，保留 `kimi-k2.6` 作为 preset candidate，后续若找到 K2.6 Claude Code 官方页再提升。 |
| MiniMax | 官方 coding tools 文档推荐国际 `https://api.minimax.io/anthropic`、中国 `https://api.minimaxi.com/anthropic`，main/haiku/sonnet/opus 均为 `MiniMax-M2.7`。 | `cc-switch` 与 GetTokens 均为 `MiniMax-M2.7`。 | 官网与预设一致，可作为 high-confidence 默认 profile。 |
| 火山方舟 Doubao | 官方 Claude Code 文档推荐 `https://ark.cn-beijing.volces.com/api/coding`，`ANTHROPIC_MODEL` 可填具体 `Model_Name` 或 `ark-code-latest`；列出 `doubao-seed-2.0-code`、`doubao-seed-2.0-pro`、`doubao-seed-2.0-lite`、`doubao-seed-code`。 | `cc-switch` 与 GetTokens 当前为 `doubao-seed-2-0-code-preview-latest`。 | 不把本地 `preview-latest` 当官网默认；profile 默认提供 `ark-code-latest` / 具体模型候选，真实模型优先从远端或用户选择。 |
| Xiaomi MiMo | 官方 Claude Code 文档推荐 Anthropic 兼容 `https://api.xiaomimimo.com/anthropic`；Token Plan 可使用专属 Base URL。CLI 与 VS Code 示例均把 main/haiku/sonnet/opus 配为 `mimo-v2.5-pro`，并说明可使用 `mimo-v2.5-pro[1m]` 扩展上下文。Token Plan 总览还列出可手动切换到 `mimo-v2.5-pro`、`mimo-v2.5`、`mimo-v2.5-tts` 等小写模型。 | GetTokens 当前 MiMo preset 是 `mimo-v2-pro`，且已配置 `https://api.xiaomimimo.com/anthropic`；`cc-switch` 本次未见 MiMo Claude provider 默认项。 | 新增 high-confidence MiMo profile：默认 `mimo-v2.5-pro`，候选包含 `mimo-v2.5-pro[1m]`、`mimo-v2.5`、`mimo-v2.5-tts`；同时标记 GetTokens 现有 `mimo-v2-pro` 需要更新。 |
| Zhipu / Z.ai | Z.ai 模型页显示 GLM 当前有 `glm-5.1`、`glm-5`、`glm-5-turbo` 等；本次未确认官方 Claude Code env 页。 | `cc-switch` 与 GetTokens 当前为 `glm-5`。 | 保持 `glm-5` preset fallback；不自动升级到 `glm-5.1`，除非找到官方 Claude Code 配置或远端 `/models` 验证账号可用。 |
| StepFun / ModelScope / KAT-Coder / Longcat / BaiLing / SiliconFlow | 本次未确认到比参考项目更权威的 Claude Code env 官方页。 | `cc-switch` 给出默认值：`step-3.5-flash-2603`、`ZhipuAI/GLM-5`、`KAT-Coder-Pro V1` / `KAT-Coder-Air V1`、`LongCat-Flash-Chat`、`Ling-2.5-1T`、`Pro/MiniMaxAI/MiniMax-M2.7`。 | 全部标记为 `preset-fallback`，UI 显示“来自参考项目，建议用远端模型刷新确认”。 |

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
  candidates?: string[];
  notes?: string[];
};
```

从 profile 生成 relay 映射草稿时，默认 alias 不应固定写死为某一代 Claude 模型，而应来自当前 local apply / Claude Code alias 候选。例如用户选择把 `sonnet` alias 固定为 `claude-sonnet-4-6` 时，DeepSeek 草稿生成：

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
And 默认只把两者都加入候选，不自动覆盖已有映射

## 技术风险

- sidecar 的 route policy hook 是通用的，但 Claude Code 探测请求需要确认走哪条 Anthropic relay path 才能经过同一候选改写链路。
- `supportedFormats` 是当前最稳定的筛选入口，但历史账号可能缺字段；实现时需要对老数据做 fallback 推断。
- `formatBaseUrls.anthropic` 与 `baseUrl` 的优先级必须前后一致，否则 UI 显示出口和实际请求出口可能不一致。
- 模型映射的展示方向和运行时方向相反，UI copy 必须明确，避免用户误以为 `alias` 是上游真实模型。
- 默认模型 profile 与 relay 映射不是同一层数据；实现时不能把 `ANTHROPIC_DEFAULT_*_MODEL` 直接误写成所有账号的持久 alias。
- 厂商官网变化快，静态 profile 必须展示 `checkedAt` 和 source，并允许远端 `/models` 刷新覆盖候选。
- 账号使用量归因当前已有 Claude Code billing header 解析能力，但本期是否能实时用于探测证据，需要在实现时验证 sidecar recent request 数据结构。
- 如果未来要把 `openai_responses` 或 `gemini_native` 账号纳入 Claude Code，需要先定义 translator 能力和模型映射，不能在账号列表里只靠 UI 标签放行。

## 初始验证计划

- 前端模型测试：`npm --prefix frontend run test:unit -- src/features/claude-code/claudeAccountList.test.mjs` 或同等新测试文件；覆盖候选筛选、排序、模型映射归一、同一真实模型多 alias、默认透传。
- 前端类型检查：`npm --prefix frontend run typecheck`。
- 后端探测测试：新增 Wails probe 后跑 `go test ./internal/wailsapp -run 'TestProbeClaudeCodeAccountRouting|TestDetectClaudeCodeRoutingProbeHit|TestListOAuthModelAliases|TestUpdateOAuthModelAliases'`。
- 浏览器 preview：打开目标 hash，验证无 Wails runtime 也能展示稳定账号、排序、启停、模型映射保存和 preview-only 探测。
- 涉及真实 sidecar 探测后，补 Wails 桌面验收与截图归档到本 space。
