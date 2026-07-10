---
name: gettokens-codex-account-list
description: GetTokens Codex 账号列表：Codex Channel Routing、账号请求顺序、两模式路由、路由探测、模型映射、OAuth 透传语义、openai-compatible 映射保存与浏览器预览。
---

# GetTokens Codex Account List

当任务涉及 `frontend/src/features/codex/CodexAccountListFeature.tsx`、Codex Channel Routing、Codex 账号请求顺序、路由模式、路由探测、模型映射、OAuth/auth-file 映射、openai-compatible provider 映射，或后端 Codex route explain / probe / OAuth model alias 时使用本 skill。

## 1. 业务边界
- Codex 账号列表是 Codex Channel Routing 工作台，不是账号创建页，也不是总账号池。
- 总账号池只管理 Account Inventory；Codex 账号列表拥有 Codex 渠道顺序、渠道 route mode、渠道组状态、dry-run/explain 和 probe。
- Codex 渠道配置不得通过全局 `UpdateAccountPriority` 表达；渠道顺序必须保存到 Codex channel config。
- Codex runtime routing 的唯一主路径是 `channel-routing/config.json`；旧 `routing.strategy` 只保留作 relay / compatibility 边界，不再参与 Codex 候选排序、fallback 或 balanced 计数。balanced 模式应从 live-session tracker 读取活跃会话数，而不是从展示用 snapshot 反推。
- 排查 `balanced` 多项目不均分时，先区分“配置是否生效”和“均衡口径是否符合预期”：当前生产语义是剩余可路由候选池内按账号 active session 粗粒度均衡，同数时按渠道顺序 tie-break；它不是按 project、历史 request count 或 token usage 做公平分配。项目名属于 live sessions / route decision 观测字段，除非后续引入 `balanced-v2` / project-fair scorer，否则不得把 UI 项目列表解释为项目维度路由键。
- `balanced` 诊断证据优先读取 sidecar route decision 和 live sessions，而不是只看前端历史请求列表：核对 `routeMode`、trace reason、`candidateCount`、selected account 分布、filtered / guard 原因、账号 requestability / model support / disabled 状态。若多数决策候选池只有 1-2 个账号，先解释候选池收缩，再讨论均衡算法。
- 新 GetTokens route mode 主路径只允许 `sequential / balanced`。
- `project`、`projectBindings`、`projectModeFallbackRouteMode`、`fallbackMode` 已从 Codex / Claude Channel Routing 保存、执行、DTO 和 UI 中下线；旧配置读入时直接丢弃这些字段或把非法 route mode 降级为 `sequential`。
- `dedicated / prefer / ordered / weighted / canary` 不再作为上游兼容输入保留；它们只作为非法 route mode 进入 invalid mode 诊断，不进入 Codex 新 UI / Wails DTO / engine policy。
- `exclude` 不是 route mode，只能作为请求级 deny 或 pool filter。
- 旧 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback` 只作为请求级兼容 policy，不作为新页面主配置模型。
- 账号来源统一展示，但语义保持分离：
  - `auth-file` / OAuth Codex
  - `codex-api-key`
  - `openai-compatible`
- 禁用账号保留在排序中，但不参与运行时请求候选。
- Codex 请求资格不得只按 `configured` 判断：
  - `configured` 且没有 requestability evidence 的账号应标记为 `waiting-check`，继续显示在请求顺序列表，但不进入 requestable candidates / explain / probe 候选。
  - `active / local / ready / ok / verified / manual / usage / quota / configured-provider` 可作为请求资格证据；usage/quota 只是证据之一，不是唯一入口。
  - openai-compatible provider 使用 `configured-provider` 证据，不应因为没有 usage/quota 成功记录被误判为待检测。
  - 用户手动确认“我知道能用”应保存到 Codex `ChannelRoutingConfig.manualRequestableAccountIDs`，只作为 requestability evidence，不写入账号凭证本体。
  - 手动确认不得绕过 disabled、runtime guard、quota-empty、cooldown、auth-error、model-unavailable 等硬阻塞。
- 对 `codex-api-key`，禁用不能只停留在前端状态：账号池 SQLite / management account status 必须保存 `disabled:true`，CLIProxyAPI synthesizer 必须生成 disabled runtime auth；`manual-disabled` 只能作为当前进程内存 guard 辅助，不能写成持久 `runtimeStates` 事实。
- 禁用优先级高于 session sticky、失败降级和 retry；Codex WebSocket pinned auth 命中禁用后必须释放 pin、断开旧 upstream，并在下一请求边界重新进入 route engine。
- 激活账号只重新进入可路由账号池，等待下一轮 route / retry，不抢占当前 stream / sticky。
- 失败冷却状态必须持久化到运行态或 guard source；401/429/5xx/model-unavailable 后续请求和 explain 都应读取同一冷却状态。账号禁用/启用事实来自账号池 DB，历史 `runtimeStates.manual-disabled` 必须忽略并在保存时清理。

## 2. 前端结构
- `CodexAccountListFeature.tsx` 保持为 controller：
  - Wails/browser 数据加载
  - Codex channel config 读取和保存
  - 路由探测调度
  - dry-run/explain 调度
  - modal 打开/关闭与 hash 同步
  - 模型映射保存编排
- Account Routing Engine rollout 期间应新增共享领域：
  - `frontend/src/features/channel-routing/model/channelRouting.ts`
  - `frontend/src/features/channel-routing/model/channelRoutingValidation.ts`
  - `frontend/src/features/channel-routing/model/channelRoutingSelectors.ts`
  - `frontend/src/features/channel-routing/model/channelRoutingPreviewData.ts`
  - `frontend/src/features/channel-routing/components/ChannelRoutingWorkbench.tsx`
  - `frontend/src/features/channel-routing/components/RouteExplainPanel.tsx`
- UI 组件放在 `frontend/src/features/codex/components/`：
  - `CodexRouteProbeCard.tsx`
  - `CodexAccountOrderRow.tsx`
  - `CodexAccountDetailModal.tsx`
  - `ModelCombobox.tsx`
  - `codexAccountPresentation.ts`
- 纯模型逻辑放在 `frontend/src/features/codex/model/`：
  - `codexAccountList.ts`：账号合并、渠道展示排序、可请求状态
  - `codexModelMappings.ts`：OAuth/openai-compatible 模型映射归一
  - `codexRoutePolicy.ts`：旧请求级兼容 policy、探测日志、路由状态
- 不新增 catch-all helper 文件；按账号、映射、路由策略拆分。

## 3. 模型映射语义
- openai-compatible 映射方向固定为：真实模型 `models[].name` -> Codex 模型 `models[].alias || name`。
- openai-compatible 保存时按 `name + alias` 去重，允许同一个真实模型映射到多个 Codex alias。
- OAuth/auth-file 默认原样穿透模型名；保存语义上不把同名 `model -> model` 写成显式 alias，但账号详情仍应把已拉到的 OAuth/Web 模型作为只读透传列表展示，避免用户误以为没有模型。
- OAuth/auth-file 只有配置显式 alias 后才关闭默认透传；保存空映射应删除 channel alias。
- OAuth 映射按 provider/channel 生效，同一 `codex` channel 共享映射。
- OAuth/auth-file 的单账号模型探测必须使用该账号当前支持模型作为候选：Codex 详情用当前账号 `modelOptions` 与显式 alias，账号池详情用 `GetAuthFileModels` 拉到的 auth-file 模型目录；不得混入全局 Codex catalog、全局 relay 模型列表或仅按 `acct_` 前缀决定是否可测试。
- OAuth/auth-file 的管理模型目录不能只依赖当前进程 `ModelRegistry`。当 `/v0/management/accounts/:account_key/models` 通过 registry 查不到模型，但 account-store 中该账号是 Codex auth-file 且未禁用时，必须按 `plan_type` 回退到 Codex 静态模型集；该兜底只适用于 Codex auth-file，不扩展到 Claude/Gemini 等其他 auth-file。
- 模型选择使用项目自定义 combobox，不回退到原生 `datalist`。

## 3.1 Codex 模型路由语义
- Codex runtime 账号选择只以请求 body 中的 `model` 作为模型路由输入，不读取 `X-OpenAI-Subagent`、`thread_source` 或 role 作为候选账号选择条件。
- `X-OpenAI-Subagent` 只属于 Codex Responses client context 透传 header；可以继续转发给上游，但不得写入 GetTokens route context 或 metadata 作为路由判断。
- 普通用法：用户在 Codex 侧配置模型名，例如 `deepseek`；sidecar 按 `deepseek` 进入模型 registry / 账号能力过滤，命中声明支持该模型的账号。
- 进阶用法：账号卡模型映射把特殊 Codex 模型名暴露为 alias，例如 `models[].name = deepseek-chat`、`models[].alias = deepseek`；路由侧按 `deepseek` 选账号，执行侧发给上游 `deepseek-chat`。
- 多个真实模型可以映射到同一个 Codex alias；openai-compatible 账号内会形成 alias pool，并在支持的错误边界内做同账号内轮转或失败切换。
- SQLite account-store 启用后，openai-compatible runtime auth 必须自描述可注册模型，例如通过非敏感 `openai_compat_models` attribute 携带模型声明。旧 `config.OpenAICompatibility` 只作为迁移输入，不能在运行时 synthesis 或 `sdk/cliproxy` 模型注册阶段作为 fallback；缺少自描述模型时应暴露为回归，而不是反查旧 config 补洞。
- SQLite account-store 中的 `codex-api-key.models_json=[]` 表示未声明自定义模型，应按 Codex API key 的默认 Codex 模型集注册和查询，不能投影成“无可路由模型”。管理接口 `/v0/management/accounts/:account_key/models`、route explain/probe 候选池和真实请求调度必须保持一致。

## 3.2 Codex /model 本地目录投影语义
- Codex `/model` 展示与 GetTokens runtime route 是两条边界：runtime 真源仍是 sidecar / account store / channel routing；`model_catalog_json` 只是让本地 Codex TUI 稳定展示可选模型的 projection。
- GetTokens 只管理 `CODEX_HOME/gettokens-model-catalog.json`。写入 `config.toml` 顶层 `model_catalog_json` 时必须指向这个 GetTokens-owned 文件，不把 account store 或 provider preset 当成 catalog 真源。
- `model_catalog_json` 会完全替换 Codex 内置和远程 catalog；生成文件必须覆盖当前 relay 可选的完整模型集合，不能只写 DeepSeek 或某个单一账号模型。
- 生成 slug 使用 sidecar 可路由的 client-facing model：真正 route alias（例如 `models[].name = deepseek-chat`、`models[].alias = deepseek`）用 alias，否则用 name；这保证用户在 `/model` 里选到的值就是 sidecar route engine 的请求模型输入。
- 大小写/格式展示名不是 route alias：当 `OpenAICompatibleModel.Alias` 与 `Name` 仅大小写不同（例如 `name=gpt-5.5`、`alias=GPT-5.5` 或 `name=gpt-5.4-mini`、`alias=GPT-5.4-Mini`）时，catalog `slug` 必须保留真实模型 ID，`display_name` 才使用展示名；否则 Codex 会发送 `GPT-5.5` 并触发 sidecar `unknown provider for model GPT-5.5`。
- 如果用户已有外部 `model_catalog_json`，默认保留并返回冲突提示；除非用户明确确认接管，不得静默覆盖。
- Status 页 `/model` 同步开关必须双向立即写配置：打开时写入 GetTokens-owned `model_catalog_json` pointer，关闭时只移除指向 `gettokens-model-catalog.json` 的 pointer；不得删除或改写用户外部 catalog。
- Codex 只在启动时读取 static catalog；前端保存后必须提示重启 Codex 后生效。

## 4. 路由探测语义
- `ProbeCodexAccountRouting` 使用页面传入的候选约束发起最小 relay 请求。
- 新主路径应优先使用 Codex channel config + dry-run/explain，展示候选池、过滤原因、排序步骤和最终选择。
- 路由探测发真实 relay 请求前必须读取 runtime quota / route guard 状态；`quota-empty`、rate-limit、auth-error 等 transient blocked 账号不得进入 probe candidates，避免“已知不可用账号”被 probe 再次命中或消耗额度。`manual-disabled` 不从持久 `runtimeStates` 判定，禁用状态应直接来自账号池 DB / runtime auth disabled。
- 旧 `orderAccountIDs / allowAccountIDs / denyAccountIDs / allowFallback` 仅作为请求级兼容探测输入，不能回写为 Codex channel config。
- 探测结果需要同时展示：
  - 终端式流输出
  - 当前候选顺序
  - 最新命中账号
  - 对应账号行高亮
- 连续测试应逐次追加结果，避免等待全部完成后才刷新 UI。

## 5. 浏览器预览
- `#frame=codex&workspace=account-list` 必须可在普通浏览器预览。
- 缺少 `window.go.main.App` 时使用 `previewData.ts`，不能让页面空白。
- 浏览器预览中的渠道配置、排序、启停、模型映射保存是本地状态更新，并需要给出 preview-only 提示。
- 浏览器预览的高级诊断 explain、请求顺序列表和路由探测必须复用同一套 route policy preview 候选池；不要在 `runChannelExplain`、probe、row badge 里分别用 `orderedRows.filter(row.requestable)` 临时重算，否则会出现列表显示“候选”但高级诊断显示“候选 0 / 未命中”的同屏矛盾。
- 视觉或交互调整要优先用浏览器预览快速验证；涉及真实 sidecar、Wails 绑定或账号命中时，再用桌面环境补验。

## 6. UI 规则
- 保持 Swiss-industrial 风格：硬边框、黑白灰、紧凑高密度、monospace 辅助信息。
- 账号行固定为单一 Codex 渠道顺序列表，不再额外渲染重复策略账号列表。
- 账号行主体点击打开详情；嵌套按钮、switch、combobox、策略控件必须阻止冒泡。
- 新主控件应围绕 `sequential / balanced`、渠道组范围和 explain；旧“默认 / 允许 / 排除”只用于请求级兼容探测入口。
- 路由探测卡片独立于账号顺序卡片；测试流常驻显示，不使用卡中卡文本模块。
- 请求顺序列表模式用于高密度排序，不再做卡片式信息堆叠：
  - 左侧 rail 固定承载顺位与拖拽柄，顺位数字和拖拽柄横向排列。
  - 候选、跳过、阻塞状态必须在左侧状态竖条和右侧状态标签同时可见。
  - 状态色统一来自账号卡 tone 来源，不在 Codex 行内重新手写一套颜色。
  - 阻塞账号可被展示过滤隐藏，但真实排序数组和运行时请求顺序不能因此重排。
- 请求顺序 / 路由工作台默认要降噪：
  - `请求模式` 与 `参与账号` 放在同一 workbench 内连续展示，主路径优先回答“是什么模式”和“哪些账号会参与”。
  - `参与账号` 默认折叠，只显示数量；用户需要核对具体账号时再展开。
  - `更多操作` / 保存 / 过滤等控制放在标题右侧或同一 header band 内，不单独拉出一条说明栏。
  - 账号列表区域不再额外包一层大边框或大阴影，卡片只保留自身边界，避免再次出现卡中卡。
- 请求顺序卡片必须直接复用账号池 `AccountCard`，不要再维护一个“像账号池”的分叉卡片：
  - Codex 页特有信息只通过 opt-in props 叠加，例如 `extraBadges`、`eyebrowPrefix`、`showDeleteAction=false`、`showFooterActions=false`。
  - 非列表模式通过拖动整张卡排序；激活/禁用继续使用账号池卡片菜单，不额外暴露独立 toggle 或置顶/置底按钮。
  - 同一 grid 行内保持账号池式等高卡片；状态行前可显示当前请求顺序前缀，例如 `#1 可用`，但该前缀只属于 Codex 请求顺序页。
- 请求模式说明入口：
  - `请求模式` 标题旁使用问号图标按钮打开说明，说明作为 modal 弹层出现，不替换当前工作台主内容。
  - 说明必须明确 sequential 只是“每次路由决策的账号排序”，不是账号独占；retry/failover、运行态 guard/cooldown、WebSocket pinned auth 释放、项目/组限定、多会话并发、路由探测与连续测试都可能命中后续账号。
  - Explain / dry-run 只解释候选和过滤原因，不请求上游；route probe / 连续测试会发真实 relay 请求，可能消耗额度。
  - modal 只保留常规关闭入口（右上角关闭、遮罩、Esc），不要在弹层底部再放“返回模式”之类的页面式返回按钮。
- 请求顺序页顶部筛选要和账号池筛选维度保持同步，但只作为展示过滤：
  - 筛选状态使用对象和 AND-style requirement 字段，不退回单一 enum，也不兼容 `*Only` 字段；至少覆盖 `source`、`requiresRequestable`、`requiresBlocked`、`requiresDisabled`、`hasBalance`、`hasLongestQuota`、`requiresError`。
  - `source` 必须区分 `codex-auth-file`、`codex-api-key`、`openai-compatible`。
  - `hasBalance` 基于 quota response 中的 billing/balance 信息判断；`hasLongestQuota` 基于最长 quota window 判断。
  - 阻塞、手动禁用和错误/不可用分开筛选；`requiresError` 不包含已禁用账号。
  - 刷新、筛选和显示密度属于同一个请求顺序工具栏；不要再拆成独立 `View / Scope` cluster。
- 路由探测 modal 是调试工作台，不是说明卡片：
  - 顶部显示标题与运行摘要，例如测试模型、候选数、当前命中/空闲状态。
  - 左侧固定承载可操作控制：模型、测试一次、连续测试、重置、备用账号。
  - 右侧先展示当前候选队列，再展示终端式测试流。
  - 候选队列必须按当前请求顺序逐行展示序号、账号、出口和来源，不用一行长文本表达。
  - 桌面宽度下至少让常见 5 个候选完整可见；窄屏下改为纵向滚动，而不是把控件压扁。

## 7. 后端 / Wails 边界
- Codex 账号列表真实 Wails 数据入口必须优先使用 `ListCodexAccountInventory`：
  - `internal/wailsapp.ListCodexAccountInventory()` 从统一 `ListAccounts()` / `AccountRecord` 映射结果中过滤 Codex 路由相关账号。
  - 前端 `CodexAccountListFeature.tsx` 不应再用 `ListAccounts + ListOpenAICompatibleProviders` 自行拼装真实 Codex rows；浏览器 preview 可继续使用本地 preview data。
  - auth-file provider/type 推断必须留在 `internal/accounts` 统一账号映射层，不在 Codex 页面、账号池页面或 Wails feature 各自解析 `auth_json`。
  - openai-compatible 应作为 `accountKind=openai-compatible` 的统一账号记录进入 Codex inventory；页面模型层只做 presentation row 转换，不拥有“哪些账号属于 Codex 路由链路”的最终判定。
- 新增 Wails-facing 方法时必须同时检查：
  - `internal/wailsapp`
  - `cmd/gettokens/app.go`
  - `cmd/gettokens` DTO / mapper
  - `frontend/wailsjs`
- 账号 row id 到 sidecar auth id 的转换必须覆盖：
  - `auth-file:<name>`
  - `codex-api-key:<id>`
  - `openai-compatible:<name>`
- 路由探测用的 loopback header 是调试口子；不要把它和持久化账号配置混在一起。
- Management 账号详情读取是 read path：`GET /v0/management/accounts/:account_key` 只能在 runtime apply 状态为 `pending` 时补做 apply，不能每次打开详情都重新 apply。否则 apply hook 的瞬时失败会把已经 `applied / registered_routeable` 的账号冲成 `failed / degraded`，造成账号卡异常和模型列表被清空。

### 7.1 Codex WebSocket relay failure boundary
- GetTokens-managed local Codex provider 默认必须写 `supports_websockets=false`，WebSocket 只能作为高级 opt-in；显式开启时必须对齐 Codex `Provider.websocket_url_for_path()` 语义：`http://` 转 `ws://`、`https://` 转 `wss://`，`ws://` / `wss://` 原样保留。Status 页应检测当前本地 GetTokens relay provider 的存量 `supports_websockets=true` 并提示显式修复，不静默改用户配置。
- Codex upstream WebSocket 的 `408 stream closed before response.completed`、`session_closed`、abnormal close、timeout 属于 WebSocket transport failure，只能熔断该 auth 的 WebSocket 能力，不能创建 auth/model 全局 route guard，也不能把后续 HTTP Responses 放大成 `503 auth_unavailable`。覆盖范围必须同时包括 stream chunk 错误、bootstrap error、handshake `408/5xx`、dial 失败、send/retry-send 失败；这些错误都要带 `TransportFailureKindWebsocket`，并在 auth manager 直接错误分支和 stream chunk 分支都被识别。
- Codex auth 显式 `websockets=false` 或 WebSocket circuit 命中时，downstream WebSocket 应关闭并提示 retry over HTTP；openai-compatible provider 继续走 HTTP fallback。
- 不能把所有 408 都跳过 route guard；只有带 WebSocket transport failure 标记的错误才跳过 auth 全局不可用更新。
- 相关回归至少覆盖 mock upstream 408 后 no route guard、WS circuit open、后续不返回 `auth_unavailable`，以及 Codex `websockets=false` 会 force HTTP fallback。

## 8. 验证
- 前端结构或 UI 调整：
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`
  - 浏览器打开 `#frame=codex&workspace=account-list` 检查账号行、探测卡、详情 modal 和 combobox。
- 后端、Wails 或 sidecar 探测调整：
  - `go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases|TestProbeCodexAccountRouting|TestDetectCodexRoutingProbeHit|TestSidecarRelayRequest'`
  - 涉及公共 DTO 或绑定时重新生成 `frontend/wailsjs` 并跑类型检查。
- Account Routing Engine rollout 额外覆盖：
  - Codex channel config 保存不影响 Claude channel config。
  - `ChannelRouteMode` 只接受 `sequential / balanced`；`project` 输入必须降级或标记为旧兼容输入。
  - 上游兼容模式不进入 Codex 新配置保存。
- Codex + openai-compatible 真实进程冒烟：
  - 当改动涉及 Codex model catalog、openai-compatible alias、Responses <-> Chat/SSE 桥接或 DeepSeek 等上游协议适配时，mock smoke 通过后再补一次真实 Codex CLI 进程冒烟。
  - 使用临时 CLIProxyAPI dev config 和隔离 `CODEX_HOME`，只把真实上游 key 复制到临时 sidecar config；Codex `auth.json` 只写本地 relay client key，不写真实 provider key。
  - Codex config 指向本地 relay provider，保持 `wire_api = "responses"`，模型使用 client-facing 名称，例如无 alias 时的 `deepseek-v4-flash`。
  - 冒烟命令优先使用 `codex -a never exec --skip-git-repo-check --ephemeral --sandbox read-only --model <model> --output-last-message <tmp-file> "<prompt>"`。
  - 验收至少确认：`/v1/models?client_version=<codex-version>` 返回目标模型、Codex CLI exit code 为 `0`、最后消息符合预期、sidecar 收到 `/responses` 请求、临时目录和含 key 配置已删除。
  - 不打印 API key/token；失败时只输出脱敏 stderr/stdout 尾部和 sidecar 关键错误。
- 视觉截图放到 `docs-linhay/spaces/20260511-codex-account-list-tab/screenshots/<YYYYMMDD>/codex/`。

## 9. 文档
- 需求、验收与截图写入 `docs-linhay/spaces/20260511-codex-account-list-tab/README.md`。
- 技术拆分、沉淀结论写入 `docs-linhay/dev/`。
- 稳定决策和用户偏好写入 `docs-linhay/memory/YYYY-MM-DD.md`。
- 文档或记忆写回后运行 `docs-linhay/scripts/check-docs.sh`。
