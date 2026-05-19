# Claude Code Account List

## 背景
- GetTokens 已经在 Codex 工作区完成 `账号列表`：统一展示可参与 Codex 请求链路的账号，支持请求顺序、启停、模型映射和路由探测。
- 早期 `Claude Code 功能对齐调研` 曾把“账号列表与路由探测”判为不适用，判断前提是 Claude Code 只读取单个 `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`，没有自身多账号轮换模型。
- 现在 GetTokens 的账号体系已经演进到统一账号卡片和多格式端点：账号可以声明 `supportedFormats` / `formatBaseUrls`，其中 `anthropic` 格式正是 Claude Code 请求协议的核心入口。因此本期不再把 Claude Code 账号列表理解为“直接编辑 Claude Code 本地单 key”，而是理解为“GetTokens relay 可供 Claude Code 使用的 Anthropic 格式账号请求工作台”。
- 官方 Claude Code 文档确认配置主要通过 `settings.json`、环境变量和命令行参数生效；本地 apply 已能写入 `~/.claude/settings.json` 的 `env` 字段。本期账号列表要和这个入口衔接，但不替代 settings / MCP / hooks 管理。

## 目标
1. 在 Claude Code 适配范围下建立一个等价于 `Codex - 账号列表` 的账号请求工作台。
2. 列出所有可供 Claude Code relay 请求使用的账号资产：核心筛选条件是账号可请求且支持 `anthropic` 格式，而不是 provider 名称等于 `claude`。
3. 支持请求顺序调整、启停、可请求/阻塞状态扫描，并保持“禁用或阻塞账号仍保留在排序中，但不参与运行时候选”的语义。
4. 支持 Claude Code 路由探测：使用 Anthropic Messages 形态的最小请求验证当前候选顺序实际命中的账号，并展示候选队列、命中账号和证据。
5. 支持 Claude Code 模型映射：用户可在账号详情中配置 Claude Code 请求模型 alias 到该账号真实 Anthropic 上游模型的映射。
6. 和现有 `应用到 Claude Code` local apply 打通：用户能从 Claude Code 账号列表理解当前 relay 入口、可请求候选、模型字段和本地 `settings.json` env 写入之间的关系。

## 范围
- 新增 Claude 顶级工作区入口，URL 形态为 `#frame=claude&workspace=account-list`；Claude 在侧边栏与 Codex 同级，不作为 Codex 子菜单。
- 前端复用 Codex 账号列表的分层模式：
  - feature controller 负责 Wails/browser 数据加载、顺序保存、探测调度、modal/hash 同步。
  - UI 组件复用账号归因卡、请求顺序列表、路由探测 modal 的现有模式。
  - 纯模型逻辑按 `claudeAccountList` / `claudeRoutePolicy` / `claudeModelMappings` 等职责拆分，避免 catch-all helper。
- 后端优先复用现有 `ListAccounts`、`UpdateAccountPriority`、`SetAccountDisabled`、账号使用量和限流状态；只有 Claude Code 路由探测缺少 Anthropic Messages 最小请求能力时才新增 Wails-facing 方法。
- 候选来源以统一 `AccountRecord` 为入口：
  - `supportedFormats` 包含 `anthropic`。
  - 存在可用于 relay 的凭证或 auth route id。
  - 优先使用 `formatBaseUrls.anthropic`，没有时回退到 `baseUrl`。
  - 保留不同来源语义：auth-file、api-key、openai-compatible / vendor preset，不混成一个“Claude key”概念。
- 模型映射进入本期范围：
  - UI 展示方向为：真实上游模型 `models[].name` -> Claude Code 请求模型 `models[].alias || name`。
  - 运行时解析方向为：Claude Code 请求模型 alias -> 真实上游模型 name。
  - API key / openai-compatible 账号优先复用账号配置内的 `models[]` 保存方式。
  - OAuth/auth-file 账号优先复用 sidecar `oauth-model-alias`，Claude Code 侧 channel 以 `claude` 为默认目标；若实现发现 provider-specific channel 更准确，需要在实现文档中写明映射规则。
  - 默认不展示或保存同名 `model -> model` 映射；没有显式映射时保持原模型名透传。
  - 保存时按 `name + alias` 去重，允许同一个真实模型映射到多个 Claude Code alias。
  - 模型输入使用项目自定义 combobox，真实模型选项来自账号远端模型、官方 profile、旧预设迁移提示或已保存映射；Claude Code alias 选项来自 local apply/model catalog/常用 Claude 模型集合。
- 默认模型 profile / 映射表进入本期范围：
  - 厂商默认值不是硬编码兜底，而是带来源、更新时间和可信度的 `ProviderDefaultModelProfile`。
  - 来源优先级固定为：官网/官方文档最新配置 > 本地参考项目 `cc-switch` 的 Claude provider preset > GetTokens `vendorPresets` / `modelSuggestions` > 远端 `/models` 动态发现 > 用户手工输入。
  - profile 记录 `ANTHROPIC_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL` 及推荐 `ANTHROPIC_BASE_URL`。
  - profile 可用于两类动作：一键填充 Claude Code local apply 模型字段；或一键生成 relay 模型映射，把真实上游模型映射到用户选择的 Claude Code alias。
  - 用户已有显式映射优先级最高；默认 profile 更新不得自动覆盖用户编辑过的映射，只能提示“官方默认有更新，可重新套用”。
  - 如果官网和本地预设不一致，UI 必须展示来源差异，不能静默采用旧预设。
- 浏览器 preview 必须可用，缺少 Wails runtime 时使用稳定 preview 数据；排序、启停和探测结果以 preview-only 方式模拟，不抛 Wails 绑定错误。

## 非目标
- 不在本期实现 Claude Code Skills、MCP、hooks、permissions 或 CLAUDE.md 管理。
- 不把 Claude Code 本地配置扩展成通用 settings.json 编辑器；本期只展示和账号列表强相关的 local apply 状态与入口。
- 不引入第二套独立 provider 管理器；账号创建、厂商预设、API key 详情仍归账号池负责。
- 不把 Claude Code 的单机 `settings.json env` 当成多账号存储。Claude Code 本地仍只写一个 relay endpoint / relay key；多账号轮换发生在 GetTokens relay 内。
- 不在本期解决所有非 Anthropic 格式转换问题；`openai_chat` / `openai_responses` / `gemini_native` 是否可被 Claude Code 使用，取决于 sidecar translator 和账号 `supportedFormats`，本期只把 `anthropic` 作为明确 P0。

## 验收标准
1. Given 用户进入 Claude Code 账号列表，When sidecar ready 且存在支持 `anthropic` 的账号，Then 页面展示总账号数、可请求数、阻塞数和 Anthropic 格式账号数。
2. Given 账号池中存在官方 Anthropic、DeepSeek Anthropic 兼容端点、Kimi Anthropic 兼容端点以及禁用账号，When 打开列表，Then 支持 `anthropic` 的账号出现在同一请求顺序列表中，禁用账号保留排序但标记为不可请求。
3. Given 某账号同时支持 `openai_chat` 和 `anthropic`，When 查看列表或详情，Then Claude Code 账号列表使用 `formatBaseUrls.anthropic || baseUrl` 作为请求出口，并明确展示格式为 `ANTHROPIC`。
4. Given 用户拖动账号调整顺序，When 放下账号行，Then 页面自动写回优先级；刷新后仍按新顺序展示，运行时候选顺序也与列表从上到下一致。
5. Given 用户点击启停开关，When 账号被禁用，Then 它仍显示在列表原位置，但路由探测候选队列不包含该账号。
6. Given 用户点击 `路由探测`，When 输入 Claude 模型并测试一次，Then 页面通过 Anthropic Messages 最小请求识别实际命中账号，并在候选队列、测试流和账号行中展示命中状态。
7. Given 用户设置允许账号、排除账号和备用账号策略，When 执行路由探测，Then 后端把页面 row id 翻译为 sidecar route id，并仅对本次探测请求应用候选过滤，不改变持久化账号配置。
8. Given 某账号配置了模型 `{ name: "deepseek-chat", alias: "claude-sonnet-4-5" }`，When Claude Code 通过 relay 请求 `claude-sonnet-4-5` 且命中该账号，Then sidecar 实际转发给上游的模型为 `deepseek-chat`，页面详情显示 `deepseek-chat -> claude-sonnet-4-5`。
9. Given 某账号未配置显式模型映射，When Claude Code 请求 `claude-sonnet-4-5`，Then 默认按原模型名透传，不自动保存 `claude-sonnet-4-5 -> claude-sonnet-4-5`。
10. Given 用户在账号详情新增、删除或保存模型映射，When 保存成功并刷新页面，Then 映射仍保留；如果同一个真实模型映射到多个 Claude Code alias，所有 `name + alias` 组合都应保留。
11. Given 普通浏览器打开 Claude Code 账号列表 preview，When 缺少 `window.go.main.App`，Then 页面加载稳定 preview 账号，排序/启停/探测和模型映射保存交互可演示，并明确显示 preview-only 状态。
12. Given 用户已配置 relay local apply，When 查看 Claude Code 账号列表，Then 页面能显示当前推荐写入 Claude Code 的 relay base URL、relay API key 来源和模型字段入口；但不直接覆盖 settings.json，除非用户点击已有 local apply 动作。
13. Given sidecar 未 ready，When 打开页面，Then 页面显示等待状态，不提前请求真实账号、用量、模型目录或探测接口。
14. Given 某账号匹配到厂商默认 profile，When 用户打开模型映射编辑器，Then 页面展示官网/预设来源、检查日期和 main/haiku/sonnet/opus 默认值，并允许一键套用为 local apply 模型字段或 relay 映射草稿。
15. Given 厂商官网默认值和本地预设不一致，When 用户查看或套用默认映射，Then 页面显示差异来源；已保存的用户映射不被自动覆盖，只有用户确认后才按最新 profile 重建草稿。

## 一期交付建议
1. P0 先做 Claude Code 账号列表读模型与 UI：筛选 `anthropic` 候选、请求顺序、启停、详情、模型映射、browser preview。
2. P0 同步做纯模型单测：候选筛选、排序更新、禁用保留、`formatBaseUrls.anthropic` 回退、模型映射归一、同一真实模型多 alias、preview 数据。
3. P1 再做 Claude 路由探测 Wails 方法：以 Anthropic Messages 请求验证命中账号，复用 `X-GetTokens-Route-*` loopback header 或 executor metadata。
4. P1 打通 local apply 状态展示：从 Status 页抽出可复用的 Claude local apply summary，不重复实现 settings 写入。
5. P2 再补非 Anthropic 格式转换扩展：只有当非 Anthropic 账号需要参与 Claude Code 候选时，再定义转换入口和跨格式映射 UI。

## 待确认问题
- Claude 顶级工作区后续是否继续扩展 Skills、MCP、hooks、permissions 或 CLAUDE.md 管理；本期只落账号列表。
- 路由探测 endpoint：实现时需要以 sidecar 当前 Claude Code relay 接入路径为准，确认使用 `/v1/messages`、provider-scoped Anthropic path，还是 local apply 已写入的 relay base URL。
- route id 覆盖：Codex 探测已覆盖 `auth-file:<name>`、`codex-api-key:<id>`、`openai-compatible:<name>`；Claude Code 需补齐 Anthropic OAuth/auth-file、统一 API key 多格式端点和 openai-compatible 的 route id 映射。
- 账号模型目录：Claude Code 模型候选应优先来自账号 `modelSuggestions` / relay model catalog 里的 Claude 模型，还是从实际 Anthropic `/models` 能力拉取。
- 模型映射保存入口：API key / openai-compatible 可复用 `models[]` 字段；OAuth/auth-file 是否直接复用 `UpdateOAuthModelAliases(channel=claude)`，还是需要新增更明确的 Claude-facing Wails 方法。
- 是否需要“应用到 Claude Code”快捷入口常驻在本页面顶部，还是只链接到 Status 页已有 local apply 面板。
- 官方默认模型 profile 的维护入口：[official-model-profiles.md](./plans/official-model-profiles.md)。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 设计系统入口

- Storybook：`Design System/业务组件/Claude Code 账号列表`
- Story 文件：`frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.stories.tsx`
- 纯展示组件：`frontend/src/features/claude-code/components/ClaudeCodeAccountListWorkbench.tsx`
- 覆盖状态：`ready`、`source-conflict`、`disabled-blocked`、`profile-draft`
- 业务语义：只用 mock 数据展示 Anthropic 格式账号筛选、请求顺序、官方默认 profile、模型映射草稿和路由探测；不依赖 Wails、sidecar 或真实网络请求。

## 2026-05-20 落地实现

- 新增 Claude 顶级工作区：`#frame=claude&workspace=account-list`，侧边栏中 Claude 与 Codex 同级，子项为 `账号列表`。
- 旧入口 `#frame=codex&workspace=claude-account-list` 自动迁移到 Claude 顶级工作区，避免历史链接失效。
- 新增模型层：`frontend/src/features/claude-code/model/claudeCodeAccountList.ts`，覆盖 Anthropic 格式筛选、`formatBaseUrls.anthropic || baseUrl`、禁用保留顺序、模型映射去重、官方默认 profile 和 mapping draft。
- 新增页面入口：`frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx`，桌面端读取 `ListAccounts`，浏览器端使用稳定 preview 数据；页面复用 Codex 请求顺序、账号详情和路由探测组件。
- 真实交互已接入：
  - 拖拽排序写回 `UpdateAccountPriority`。
  - 启停写回 `SetAccountDisabled`。
  - OAuth/auth-file 映射写回 `UpdateOAuthModelAliases(channel="claude")`。
  - openai-compatible 映射写回 `UpdateOpenAICompatibleProvider(models)`。
  - codex-api-key 映射写回 `UpdateCodexAPIKeyConfig(models)`。
- 后端新增 `ProbeClaudeCodeAccountRouting`，通过 Anthropic Messages 最小请求 `POST /v1/messages` 执行路由探测，并复用 `X-GetTokens-Route-*` 策略 header 和 recent request 使用量归因识别命中账号。
- `AccountRecord` 已透出 `apiKeys`、`headers`、`models`，API key 与 openai-compatible 账号详情可以读取并保存模型映射。
- 新增测试：`frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`，并纳入 `npm --prefix frontend run test:unit`。
- 新增后端测试：`internal/wailsapp/claude_code_routing_probe_test.go` 覆盖 `/v1/messages` 请求、route policy header、Anthropic 格式筛选和 model 必填；`internal/wailsapp/accounts_test.go` 覆盖 `UpdateCodexAPIKeyConfig(models)` 持久化与 sidecar 同步。
- 浏览器 smoke：`http://127.0.0.1:5173/#frame=claude&workspace=account-list` 已验证 preview 正常渲染、路由探测弹层可打开、preview 探测可显示命中账号，页面错误为空；旧 Codex hash 会自动迁移。
- Smoke 截图：
  - `docs-linhay/spaces/20260519-claude-code-account-list/screenshots/20260520/claude-code/20260520-claude-code-account-list-top-nav-after-v01.png`
  - `docs-linhay/spaces/20260519-claude-code-account-list/screenshots/20260520/claude-code/20260520-claude-code-account-list-web-preview-after-v02.png`
  - `docs-linhay/spaces/20260519-claude-code-account-list/screenshots/20260520/claude-code/20260520-claude-code-account-list-route-probe-after-v02.png`
- 已通过验证：
  - `go test ./...`
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test:unit`
  - `npm --prefix frontend run build`

## Worktree 映射

- branch：`feat/20260519-claude-code-account-list`
- worktree：`../GetTokens-worktrees/20260519-claude-code-account-list/`

## 相关链接
- [Codex 账号列表 Tab](../20260511-codex-account-list-tab/README.md)
- [Claude Code 功能对齐调研](../20260517-claude-code-feature-parity/README.md)
- [cc-switch vs GetTokens: Claude 配置切换对比](../20260517-cc-switch-claude-config-comparison/README.md)
- [统一账号卡片 + 多格式端点 + 厂商预设](../20260517-unified-account-cards/README.md)
- [Codex 账号列表 UI 会话沉淀](../../dev/20260518-codex-account-list-ui-session-distillation.md)
- [Claude Code settings 官方文档](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Claude Code environment variables 官方文档](https://docs.anthropic.com/en/docs/claude-code/settings#environment-variables)
- [Claude Code model configuration 官方文档](https://code.claude.com/docs/en/model-config)
- [Claude Code LLM gateway 官方文档](https://code.claude.com/docs/en/llm-gateway)
- [DeepSeek Claude Code 官方文档](https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code)
- [阿里云百炼 Claude Code 官方文档](https://help.aliyun.com/zh/model-studio/claude-code)
- [阿里云百炼 Token Plan 文档入口](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2949529)
- [阿里云百炼模型文档入口](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3031966)
- [MiniMax coding tools 官方文档](https://platform.minimax.io/docs/guides/text-ai-coding-tools)
- [火山方舟 Claude Code 官方文档](https://www.volcengine.com/docs/82379/1928262)
- [Xiaomi MiMo Claude Code 官方文档](https://platform.xiaomimimo.com/docs/zh-CN/integration/claudecode)

## 当前状态
- 状态：implementation-complete-smoked
- 最近更新：2026-05-20
