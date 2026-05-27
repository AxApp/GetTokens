# Codex 账号列表 Tab

## 背景
- Codex 侧目前已有功能开关、会话管理、OpenAI 状态和用量统计，但“可被 Codex 请求轮动使用的账号”仍分散在账号池 `codex` 与 `openai-compatible` 两个子入口里。
- 用户希望在 Codex 工作区下新增账号列表 tab，直接查看能请求的账号、调整请求账号顺序，并把 openai-compatible provider 的模型别名映射展示清楚。

## 目标
1. 在 Codex 二级菜单新增 `账号列表`。
2. 列出 Codex 请求链路可用的账号资产：Codex OAuth auth-file、Codex API Key、本地 openai-compatible provider。
3. 在同一列表中支持调整请求优先级顺序，并复用现有 `UpdateAccountPriority` 写回 sidecar / 本地账号配置。
4. 对 openai-compatible 类型账号展示模型关联映射：上游真实模型 `name` 到 Codex 可请求模型 `alias || name`，无 alias 时显示同名映射。

## 范围
- 前端 Codex 工作区新增账号列表视图与二级导航入口。
- 复用现有 Wails 绑定：
  - `ListAccounts`
  - `ListOpenAICompatibleProviders`
  - `UpdateAccountPriority`
  - `SetAccountDisabled`
- 新增 Codex 账号列表纯模型：账号合并、可请求判定、排序、模型映射展示。
- 浏览器环境无 Wails runtime 时加载稳定 preview 数据，支持本地排序和启停预览，不调用桌面绑定。
- 新增前端单元测试覆盖列表合并、排序变更、openai-compatible 模型映射。

## 非目标
- 不恢复已移除的“请求编排”业务。
- 不在本期提供账号新增、删除、详情编辑；这些仍留在账号池入口。
- openai-compatible 与 codex-api-key 模型映射允许在 Codex 账号详情 modal 内新增、删除和保存；更完整的 provider 基础信息编辑仍留在账号池入口。
- 不把账号池路由策略持久化为新的全局配置；本期策略编辑用于单次路由探测与后续客户端 overlay 的交互基础。

## 验收标准
1. Given 用户进入 `Codex`，When 点击 `账号列表`，Then 页面展示 Codex 可请求账号总数、可用数量和 openai-compatible 数量。
2. Given 账号池中存在 Codex OAuth auth-file、Codex API Key 和 openai-compatible provider，When 打开账号列表，Then 三类账号都出现在同一请求顺序列表中。
3. Given 某账号被禁用或状态异常，When 查看列表，Then 该账号保留在顺序中但标记为不可请求。
4. Given 用户拖动账号调整顺序，When 放下账号行，Then 页面自动通过 `UpdateAccountPriority` 写回优先级，刷新后仍按新顺序展示，不再需要额外点击保存按钮。
5. Given openai-compatible provider 配置了模型 `{ alias, name }`，When 查看该账号详情，Then 模型映射显示为 `name -> alias || name`；当 alias 为空时显示 `name -> name`，并可新增、删除、保存映射。
6. Given 用户打开 Codex API Key 账号详情，When 查看模型映射模块，Then 右上角显示 `添加映射`，并且已保存的 `models[].name/alias` 会回填为可编辑映射；保存后通过 `UpdateCodexAPIKeyConfig(models)` 持久化。
7. Given sidecar 未 ready，When 打开账号列表，Then 页面显示等待 sidecar ready 的状态，不发起账号加载。
8. Given 在普通浏览器环境打开 `#frame=codex&workspace=account-list`，When 页面缺少 Wails runtime，Then 加载稳定预览账号并支持本地排序/启停交互，不抛出 Wails 绑定错误。
9. Given 用户打开 Codex 账号详情 modal，When URL hash 同步完成，Then 地址栏保留 `#frame=codex&workspace=account-list&detail=<account-id>`；When 关闭 modal，Then 只移除 `detail`，保留当前 Codex 账号列表 frame。
10. Given 用户保存请求顺序后，When 输入测试模型并点击 `测试一次` 或 `连续测试 3 次`，Then 页面通过真实 relay 请求识别命中的账号，并在结果区与对应账号行展示命中标记。
11. Given 用户打开 Codex OAuth/auth-file 账号详情，When 调整模型映射并保存，Then 页面写入 sidecar `oauth-model-alias[<provider>]`，支持将高等级 Codex 模型 alias 路由到低等级真实模型。
12. Given 用户在账号列表配置允许账号、排除账号、策略顺序和 fallback，When 点击路由测试按钮，Then 后端将页面 row id 翻译为 sidecar auth id，通过 `X-GetTokens-Route-*` loopback header 控制本次测试请求的候选账号与顺序，并在页面展示最终候选顺序和实际命中账号。

## 2026-05-26 请求模式标题区收口

- 决策：`ChannelRoutingWorkbench` 左上角不再用“当前模式”小字解释状态，改成黑底 `Split` 徽标 + `请求模式` 主标题 + 说明按钮；模式本身只交给右侧两个切换按钮表达。后续按用户反馈，浏览器 mock 也应与真实桌面显示一致，因此不再额外展示 `预览` chip。
- 体验：这次把“选中就是当前”的反馈落到视觉上，避免标题区再额外重复状态词，也让请求模式卡的身份更像工作台锁定区。
- 归档：验收截图保存为 `docs-linhay/spaces/20260511-codex-account-list-tab/screenshots/20260526/codex/20260526-codex-account-list-route-mode-header-after-v02.png`。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 2026-05-15 账号卡片样式统一要求

用户明确要求 `CodexAccountListFeature.tsx` 的账号顺序区统一到 `20260514-sidecar-usage-account-attribution` 这期新设计出的账号卡片体系。最新口径不是“完全复制同一张卡”，而是同一套账号归因母版按数据区域组合：

1. 每张 Codex 账号卡应共享本期账号归因卡的核心数据区域：
   - 左侧状态 rail。
   - 顶部 route tape：资产 key / 当前状态。
   - identity 区：账号主标题、邮箱或 endpoint、副标题、chip stack；Codex 请求顺序可以作为 identity 前置区域显示。
   - traffic attribution 区：请求经过数、24h token / 峰值 / 当前、持续前进的细曲线、用量节点。
   - usage token strip：input / cache / output / total。
   - quota windows：支持多个额度窗口；没有 quota 时显示空窗口。
   - evidence 区：归因证据来源与最后命中信息。
2. Codex 专属内容不再混成一个大底栏，而是按数据结构拆成独立区域：
   - `RoutePolicy`：默认 / 允许 / 排除策略控件。
   - `Runtime`：启停 switch 与候选顺位。
   - `RouteTarget`：请求出口、模型映射、fallback 语义。
   - `ProbeResult`：最近路由测试命中和真实请求量证据。
3. 实现时需要组件化，不能在 `CodexAccountListFeature.tsx` 内复制整段账号卡 JSX。推荐拆分：
   - shared `AccountAttributionCard` / `AccountAttributionRegions`：按 region slot 渲染 identity、traffic、usage、quota、evidence 等区域。
   - `CodexAccountOrderCard`：组合账号归因 region + Codex route policy / runtime / route target / probe result 区域。
   - `CodexAccountOrderSection`：承载列表标题、刷新/保存、空态、消息与列表。
4. 上下区域都应可配置；一块数据结构对应一块可维护 UI 区域，避免“上方完全复制、下方再塞全部 Codex 状态”的不可维护结构。
5. 同一组 Codex 账号卡必须保持一致尺寸；quota 窗口数量、模型映射数量、probe 文案长短不能改变卡片宽高，应由固定 region 高度、留白或区域内部滚动承接。
6. Codex 账号卡必须与账号归因卡共享同一三列宽度轨道；不能因为 Codex 区域当前只有两张卡就改成两列半屏宽。
7. Codex 账号卡需要支持 `完整 / 缩略` 密度模式。完整模式显示 traffic、usage、quota、evidence 等归因区域；缩略模式隐藏这些账号归因区域，只保留 route tape、带顺序的 identity、Codex 路由配置和 actions。
8. 本轮不把 Codex 排序区做成独立“相似行样式”；它仍以本期账号归因卡片体系为母版，但允许按 Codex 数据结构调整 region 顺序、位置和可见性。

## Worktree 映射

- branch：`feat/20260511-codex-account-list-tab`
- worktree：`../GetTokens-worktrees/20260511-codex-account-list-tab/`

## 相关链接
- 历史请求编排实现边界：`../../dev/20260505-request-orchestration-implementation-start.md`
- 账号池总 space：`../account-pool/README.md`
- 请求编排移除 space：`../20260511-remove-request-orchestration/README.md`

## 实施结果
1. Codex 二级菜单新增 `账号列表`，URL 为 `#frame=codex&workspace=account-list`。
2. 页面在 Wails 桌面环境读取真实 `ListAccounts` 与 `ListOpenAICompatibleProviders`，并通过 `UpdateAccountPriority` / `SetAccountDisabled` 写回顺序与启停状态。
3. 页面在普通浏览器环境自动进入 preview 分支，加载稳定预览账号，不调用 Wails 绑定；排序保存和启停只更新本地页面状态。
4. openai-compatible provider 的模型映射按真实模型 `name` -> Codex 模型 `alias || name` 展示，alias 为空时展示 `name -> name`。
5. 新增 `frontend/src/features/codex/model/codexAccountList.ts` 与 `frontend/src/features/codex/previewData.ts`，测试覆盖真实数据归一、浏览器 preview、排序优先级和模型映射。
6. `AccountOrderRow` 已重设计为 Swiss-industrial 高密度行：整行左边缘承载请求状态色，左侧顺位轨只保留序号和拖拽柄，并且只有该顺位轨可拖拽；中间展示账号身份、来源和请求出口；右侧将请求状态和启停 switch 组合展示；整行主体点击打开详情。排序仅通过左侧拖拽柄调整，不再显示详情/上移/下移按钮。
7. 模型映射不再挤在排序行内，改到账号详情 modal 展示；映射方向按 openai-compatible 编辑页现有字段语义统一为真实模型 `models[].name` -> Codex 模型 `models[].alias || name`。
8. `CodexAccountDetailModal` 支持 openai-compatible 模型映射编辑：真实模型输入写回 provider `models[].name`，Codex 模型输入写回 `models[].alias`；浏览器 preview 只更新本地状态，桌面环境调用 `UpdateOpenAICompatibleProvider` 后刷新真实列表。
9. Codex API Key 账号详情的模型映射区域与 openai-compatible 保持同一交互：右上角展示 `添加映射`，初始值来自账号 `models`，桌面环境保存走 `UpdateCodexAPIKeyConfig(models)`。
10. Codex 账号详情 modal 已接入 hash detail 约定：打开详情写入 `detail=<account-id>`，直接打开带 detail 的 URL 可恢复 modal，全局导航 hash 同步不会误删当前页面的 modal detail。
11. OAuth/auth-file 账号详情已接入 `GetAuthFileModels`，在 Codex 账号详情 modal 内按同名透传展示 Web/OAuth 可用模型；openai-compatible 继续保留可编辑模型映射。
12. openai-compatible 模型映射编辑的真实模型列已接入账号池现有 `FetchOpenAICompatibleProviderModels` 拉取逻辑，并通过下拉候选辅助选择；Codex 模型/alias 列接入现有 `ListRelaySupportedModels` 模型目录，也使用可下拉、可自定义输入的 combobox。
13. 账号列表顶部新增路由探测区：模型输入支持自定义 combobox 候选，提供 `测试一次` 与 `连续测试 3 次` 两个按钮；存在未保存顺序时禁用测试并提示先保存，测试结果会显示 HTTP 状态、命中账号、recent request 证据，并高亮列表中刚命中的账号。
14. 后端新增 `ProbeCodexAccountRouting`：使用 relay API key 向 sidecar `/v1/chat/completions` 发送最小测试请求，通过请求前后 `auth-files` 与 `api-key-usage` 的 recent request 差量识别命中的 auth-file、codex-api-key 或 openai-compatible provider。
15. OAuth/auth-file 账号详情的模型区域已从只读兼容模型改为可编辑模型映射：加载时合并 `GetAuthFileModels` 与 `ListOAuthModelAliases(provider)`，保存时调用 `UpdateOAuthModelAliases` 写回 `oauth-model-alias`；该配置按 provider/channel 生效，同一 `codex` OAuth 通道共享映射。
16. 路由策略调试区按 Gemini 评审方案重构为“控制台 + 内联策略编辑”：默认先展示测试模型、测试按钮、候选顺序和最近路由命中；点击 `编辑策略` 后不再渲染第二套账号清单，而是在既有请求顺序账号行内直接显示默认/允许/排除与策略上移/下移控件；账号列表行同步显示 `路由 NN`、`跳过` 和策略模式，避免重复账号列表打断配置路径。
17. 请求顺序 section 去掉外层重卡阴影，改为 `bg-surface` 承载、`bg-main` 标题/消息带和内层账号卡的层级组合，减少“卡中卡”观感，但不改账号行本身的卡片交互与排序逻辑。

## 验证记录
1. `npm run typecheck`
2. `npm run test:unit`（228 项）
3. `npm run build`
4. `go test ./...`
5. `docs-linhay/scripts/check-docs.sh`
6. `qmd update && qmd embed`
7. 浏览器验证：`agent-browser open 'http://127.0.0.1:5173/#frame=codex&workspace=account-list'` 后 DOM snapshot 显示 5 个 preview 账号、3 个可请求账号、2 个 openai-compatible 账号，并验证下移 + 保存顺序交互无控制台错误。
8. 截图说明：本轮 `agent-browser screenshot` 在本机 Chrome 自动启动阶段报 `DevToolsActivePort`，未产出截图文件；已用 browser snapshot 与 console error 检查替代本轮浏览器验收。
9. 重设计验收：`agent-browser --session codex-account-list-drag-handle open 'http://127.0.0.1:5173/#frame=codex&workspace=account-list'` 后，列表行内不再出现详情/上移/下移按钮，只保留 switch；DOM 验证 `article.draggable = false`、左侧顺位轨 `draggable = true`；点击顺位轨不打开详情，点击行主体打开详情，点击 switch 只切换启停且不打开 modal；拖动第二行左侧顺位轨到第一行前方可调整顺序并出现未保存提示；详情 modal 展示 `deepseek-chat -> codex-deepseek` 与 `deepseek-reasoner -> codex-reasoner`；控制台无 error。
10. 视觉密度验收：`agent-browser --session codex-account-list-row-density open 'http://127.0.0.1:5174/#frame=codex&workspace=account-list'` 后，DOM 验证 5 个预览账号行高度约 96-98px、三列为 `58px / 686px / 168px`、整行不可拖拽、左侧顺位轨可拖拽、每行保留 switch；点击拖拽柄不打开详情，点击行主体打开详情，点击 switch 不打开详情，拖动第二行到第一行前可重排；截图已归档到 `screenshots/20260512/codex/20260512-codex-account-list-row-density-after-v01.png`。
11. 模型映射编辑验收：`agent-browser --session codex-account-mapping-edit open 'http://127.0.0.1:5173/#frame=codex&workspace=account-list'` 后打开 deepseek 详情，点击 `新增模型`，填入 `deepseek-coder -> codex-coder` 并保存；modal 内映射输入值保留 3 组，页面提示 `模型映射已保存`，控制台无 error。
12. 详情 URL 验收：`npm run test:unit -- src/utils/pagePersistence.test.mjs` 通过 237 项；`npm run typecheck` 通过；`agent-browser` 验证点击账号行后 URL 为 `#frame=codex&workspace=account-list&detail=openai-compatible%3Adeepseek`，直接打开该 URL 可恢复 `deepseek` 详情 modal，关闭 modal 后 URL 回到 `#frame=codex&workspace=account-list`，浏览器 errors 为空。
13. OAuth/Web 模型展示验收：打开 `http://localhost:34115/#frame=codex&workspace=account-list&detail=auth-file%3Aauth.json` 后，详情 modal 显示 `兼容模型`，列出 8 个模型并按 `model -> model` 同名透传展示；`npm run typecheck` 与 `npm run test:unit -- src/features/codex/codexAccountList.test.mjs` 通过。控制台仅有既有 `favicon.ico` 404。
14. openai-compatible 模型下拉验收：打开 `http://localhost:34115/#frame=codex&workspace=account-list&detail=openai-compatible%3AMI` 后，真实模型输入与 Codex 模型输入均渲染为自定义 combobox；当前 MI 配置的远端模型拉取返回 401，真实模型候选为空并显示 `模型拉取失败`；Codex 模型列来自 `ListRelaySupportedModels`，有 8 个候选。控制台无 error。
15. 路由探测按钮验收：打开 `http://localhost:34115/#frame=codex&workspace=account-list&detail=auth-file%3Aauth.json` 后，页面顶部显示 `测试模型`、`测试一次`、`连续测试 3 次`；当前真实数据存在未保存顺序时两个测试按钮禁用并提示先保存后测试。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-routing-probe-after-v01.png`。
16. OAuth 模型映射验收：`go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases|TestProbeCodexAccountRouting|TestDetectCodexRoutingProbeHit|TestSidecarRelayRequest'`、`go test ./...`、`npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs` 通过；前端纯函数测试覆盖 OAuth alias 覆盖 Web/OAuth 模型列表。Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list&detail=auth-file%3Aauth.json` 后确认 OAuth 详情模型区渲染为可编辑 combobox、显示 `新增模型` 与 `保存更改`；截图归档：`screenshots/20260513/codex/20260513-codex-account-list-oauth-model-mapping-after-v01.png`。
17. 模型映射下拉样式验收：将 modal 内模型映射输入从浏览器原生 `datalist` 改为自定义 combobox；点击箭头进入浏览模式展示完整候选，键盘输入时进入过滤模式。Chrome DevTools 验证 OAuth 详情中下拉弹层为自定义 `listbox`，未被 modal/table 容器裁剪；截图归档：`screenshots/20260513/codex/20260513-codex-account-list-model-combobox-after-v01.png`。
18. 模型选择下拉样式二次修正：模型映射与顶部测试模型输入统一使用自定义 combobox，不再使用浏览器原生 `datalist`；下拉候选改为 monospace、normal-case，保留 `gpt-5.4-mini` 等模型 ID 原始大小写；弹层允许宽于表格单元格但不撑开布局，继续保持 Swiss-industrial 硬边框与投影。Chrome DevTools 可访问树确认 `listbox` option 文案不再被 CSS 强制大写；截图归档：`screenshots/20260513/codex/20260513-codex-account-list-model-combobox-after-v02.png`。
19. 路由策略调试区验收：页面在账号顺序列表上方新增 `允许账号 / 排除账号 / 策略顺序 / 允许回退` 调试区，测试按钮不再要求先保存排序；后端 `ProbeCodexAccountRouting` 接收 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback`，并将 auth-file、codex-api-key、openai-compatible row id 映射为 sidecar 可识别的 auth id。已验证 `go test ./internal/wailsapp`、`go test ./...`、`npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器打开 `http://localhost:34115/#frame=codex&workspace=account-list` 确认策略区布局无溢出，截图归档：`screenshots/20260513/codex/20260513-codex-account-list-route-policy-after-v03.png`。
20. 路由策略 UI 重构验收：按 Gemini 方案将策略区从三列重复账号改为控制台 summary 与单一账号清单，Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list` 验证策略编辑器默认收起、展开后只保留一份账号清单、排除账号会同步刷新候选顺序与账号行 `跳过/排除` 标记、`测试一次` 可触发真实 Wails 路由探测；375px 窄屏下该桌面工作台保持 54rem 最小画布并由外层滚动承接，不再把控件挤压到不可读。Gemini 二轮评审结论为“可以交付”，并建议的小幅视觉与可访问性微调已落实。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-route-policy-redesign-after-v03.png`。
21. openai-compatible 模型映射保存修复验收：用户在 MI 账号中需要同时保存 `mimo-v2.5 -> gpt-5.5` 与 `mimo-v2.5 -> gpt-5.4`。根因是前端 `normalizeCodexModelMappingsForProvider`、账号池 `normalizeProviderModels` 与 Wails `normalizeProviderModels` 都按真实模型 `name` 去重，导致同一个真实模型映射多个 Codex alias 时后续 alias 被丢弃。已改为按 `name + alias` 去重，并用回归测试覆盖同一真实模型多 alias 场景。Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list&detail=openai-compatible%3AMI` 后新增 `mimo-v2.5 -> gpt-5.4` 并保存，刷新后两条映射仍保留；随后在账号列表用测试模型 `gpt-5.4` 点击 `测试一次`，路由命中显示 `MI · HTTP 200 · recent requests +1`。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-model-mapping-save-after-v01.png`。
22. 路由探测卡片重构验收：用户指出原 `section:714` 仍像文本模块卡片，且无法动态知道正在测试哪些账号。已将路由探测从请求顺序列表内拆成独立 Swiss-industrial 卡片，卡片内保留模型输入、测试按钮、策略编辑入口和候选指标；结果区改为 terminal 风格 `测试流`，显示 `$ probe --model ...`、候选账号顺序、每次 attempt 的命中结果。`连续测试 3 次` 改为逐次调用 `ProbeCodexAccountRouting(attempts=1)` 并逐条追加日志，避免等 3 次全部结束后才更新。Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list`，点击 `测试一次` 后测试流显示 `01 MI`、`02 公司` 和 `#01 MI · HTTP 200 · recent requests +1`；控制台无 error。375px 窄屏下按既有桌面工作台最小画布横向滚动，卡片内容不被挤压。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-probe-terminal-card-after-v01.png`。
23. 路由探测卡片控件清理验收：用户指出 `RouteProbeCard:div:863` 内部控件太乱、`RouteProbeCard:div:926` 仍是卡中卡。已将左侧控制区整理为单列流程：标题、测试模型、主按钮 `测试一次`、次级按钮 `连续测试 3 次 / 重置`、策略编辑；右侧 `测试流` 去掉外层重边框和独立背景，直接作为同一卡片内的终端区域。Chrome DevTools 新页面打开 `http://localhost:34115/#frame=codex&workspace=account-list` 验证无控制台 error。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-probe-controls-cleanup-after-v01.png`。
24. 路由策略编辑合并验收：用户指出 `RoutePolicyEditor` 内的账号策略列表与请求顺序列表视觉重复。已移除独立 `RoutePolicyEditor` 渲染，保留顶部 `编辑策略` 作为开关；展开后策略模式与策略上移/下移控件直接出现在既有 `AccountOrderRow` 内，回退开关留在路由探测卡片控制区。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`，并用 Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list` 确认点击 `排除` 不会打开账号详情，候选顺序实时刷新。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-policy-inline-editor-after-v01.png`。
25. 路由策略备用账号文案验收：用户指出 `RouteProbeCard` 中原 `允许回退` 行语义不清。该控件实际对应 `allowFallback`，只在设置“允许账号”后决定是否继续尝试其他未排除账号；已改为 `候选范围 / 备用账号`，并补充“设置允许账号后，首选不可用时继续尝试其他未排除账号”。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`，Chrome DevTools 展开策略后可见新文案。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-policy-fallback-label-after-v01.png`。
26. OAuth 模型映射语义修正验收：用户明确 OAuth 默认原样穿透模型名，不应把 Web 模型自动展示成 `model -> model` 映射；只有配置了显式映射才关闭穿透。已将 Codex OAuth 详情改为默认 0 条映射并显示“未配置映射；OAuth 默认按原始模型名穿透”，Web/OAuth 模型列表只作为真实模型下拉候选；保存空映射会删除 channel alias。sidecar fork 同步调整 `/v1/models` 的 OAuth alias 语义：某 channel 一旦配置 alias，默认只暴露映射后的 alias，未映射原始模型不再穿透，除非单条配置 `fork: true`。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`、`go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases'`、sidecar `go test ./...`；Chrome DevTools 打开 `detail=auth-file%3Aauth.json` 确认默认 0 条映射并可新增映射。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-oauth-passthrough-mapping-after-v01.png`。
27. 路由策略备用账号常驻验收：用户指出 `编辑策略` 按钮只控制 `备用账号` 区块显示隐藏太浪费。已将 `候选范围 / 备用账号` 开关改为路由探测卡片内常驻展示，`编辑策略` 仅负责展开或收起账号行里的默认/允许/排除与策略上移/下移控件。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`；Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list` 确认未展开策略时备用账号开关可见，展开策略后行内策略控件出现且控制台无 error。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-fallback-always-visible-after-v01.png`。
28. 请求顺序与测试候选同步修复验收：用户反馈拖动调整账号排序后，点击测试仍执行排序前的账号。根因是列表拖拽只更新 `orderedRows`，路由探测仍使用独立的 `routePolicyOrderIDs`，且旧的 reconcile 逻辑会保留旧策略顺序。已新增 `syncCodexRoutePolicyOrderForBaseOrderChange`：当可请求账号的基础列表顺序变化时，测试策略顺序同步为新的从上到下顺序；当基础顺序未变时，保留用户通过策略上/下移做出的自定义策略顺序。拖拽事件内也会同轮同步 `routePolicyOrderIDs`，避免刚拖完立即测试时仍读到旧顺序。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`，回归测试覆盖基础顺序变化时同步、基础顺序不变时保留策略自定义。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-route-order-sync-after-v01.png`。
29. 账号行策略控件常驻验收：用户要求 `AccountOrderRow` 编辑模式内容固定显示，并让 Gemini 重新设计账号行。已按 Gemini 的“四段式行结构”方案重构为 `拖拽/顺位 | 账号身份与请求出口 | 路由策略 | 启停开关`，移除 `routePolicyEditing` 与路由探测卡片中的无效 `编辑策略` 开关；默认/允许/排除、策略上移/下移在每行常驻显示。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`；Chrome DevTools 打开 `http://localhost:34115/#frame=codex&workspace=account-list` 确认点击 `排除` 只刷新候选顺序且不打开详情，点击账号主体仍打开详情，控制台无 error。截图归档：`screenshots/20260513/codex/20260513-codex-account-list-row-policy-always-visible-after-v01.png`。
30. 路由策略顺序收敛验收：用户要求移除账号行内策略上/下移，只保留拖拽顺序作为测试顺序来源。已移除 `AccountOrderRow` 内策略上/下移按钮、`routePolicyOrderIDs` 独立状态和 `syncCodexRoutePolicyOrderForBaseOrderChange` helper；`ProbeCodexAccountRouting` 的 `orderAccountIDs` 现在直接来自当前拖拽排序后的可请求账号列表。已验证 `npm run typecheck`、`npm run test:unit -- src/features/codex/codexAccountList.test.mjs`；因 `localhost:34115` 与 `localhost:5173` 当前被 TritonKit 占用，本轮临时启动 `http://127.0.0.1:5174/#frame=codex&workspace=account-list` 验收，确认行内只剩默认/允许/排除控件，点击 `排除` 不打开详情且候选顺序按列表顺序过滤刷新。截图归档：`screenshots/20260514/codex/20260514-codex-account-list-drag-order-only-after-v01.png`。
31. 收尾整理：本期施工结束后进入结构整理，已将原大体量 `CodexAccountListFeature.tsx` 拆为页面 controller、组件层和模型层：UI 组件放入 `frontend/src/features/codex/components/`，模型映射与路由策略分别放入 `frontend/src/features/codex/model/codexModelMappings.ts`、`frontend/src/features/codex/model/codexRoutePolicy.ts`。同时新增项目级 skill `.agents/skills/gettokens-codex-account-list/SKILL.md`，并在 `AGENTS.md` 只补充 skill 路由规则。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`、`go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases|TestProbeCodexAccountRouting|TestDetectCodexRoutingProbeHit|TestSidecarRelayRequest'`；临时启动 `http://127.0.0.1:5175/#frame=codex&workspace=account-list`，确认探测卡、账号行、详情 modal 与模型 combobox 均正常渲染。截图归档：`screenshots/20260514/codex/20260514-codex-account-list-refactor-after-v01.png`。整理方案记录在 `../../dev/20260514-codex-account-list-refactor-session.md`。
32. 请求顺序列表模式与自动保存验收：用户要求账号排序区上下卡片间距收紧、新增列表模式、显示模式持久化，并且改变排序即保存。已移除额外“保存顺序”按钮，拖拽放下后自动保存；请求顺序显示模式扩展为 `完整 / 缩略 / 列表`，选择会写入 `localStorage` 并同步到 `density` hash；列表模式改为真正单行排序行，仅保留拖拽柄、顺位、账号、来源、出口和状态，方便高密度排序。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；临时启动 `http://127.0.0.1:5174/#frame=codex&workspace=account-list`，刷新后列表模式仍恢复，初始加载不再误报未保存。控制台仅有既有 `favicon.ico` 404。
33. 请求顺序列表行二次排版验收：用户反馈 `AccountOrderRow` 列表模式行内排版仍然混乱。已将列表行从多列平铺改为 `拖拽/序号 rail | 账号身份区 | 路由状态区` 三段式结构：左侧 rail 固定宽度并承载拖拽柄和序号，中间身份区按账号名与 `来源 + 出口` 两层展示，右侧状态区独立分隔，减少来源、endpoint、状态互相抢宽。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览 `http://127.0.0.1:5173/#frame=codex&workspace=account-list&density=list` 下首行布局为 `64px / 862px / 144px`，控制台无 error。截图归档：`../../screenshots/20260518/codex/20260518-codex-account-list-row-layout-after-v01.png`。
34. 路由探测入口 modal 化验收：用户要求 `RouteProbeCard` 原页面区域改为 modal 页面，并把入口放到导航区右侧按钮。已将 `WorkspacePageHeader` 右侧新增 `路由探测` 按钮，原路由探测区不再常驻占用请求顺序列表上方空间；点击后打开 `MODAL_CODEX_ROUTE_PROBE`，保留测试模型、测试一次、连续测试、重置、备用账号和测试流，支持点击遮罩与 Esc 关闭。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览临时端口 `http://127.0.0.1:5174/#frame=codex&workspace=account-list`，桌面与 375px 宽度均可打开并滚动 modal，控制台仅有既有 `favicon.ico` 404。截图归档：`screenshots/20260518/codex/20260518-codex-route-probe-web-after-v01.png`、`screenshots/20260518/codex/20260518-codex-route-probe-web-after-v02.png`。
35. 请求顺序默认缩略与状态边色统一验收：用户要求账号顺序区默认显示 `缩略`，并指出列表行左侧状态边颜色与账号池不一致。已将 `DEFAULT_CODEX_ACCOUNT_ORDER_DISPLAY_MODE` 改为 `compact`，无 hash、无 localStorage 或无效值时默认进入缩略模式；`density=compact` 作为默认值不再写入 URL，选择 `full/list` 时才写入 hash。列表模式左侧状态边不再手写颜色，改为复用账号池 `AttributionCard` 导出的 `ATTRIBUTION_CARD_TONE_BORDER_CLASS`，保证 neutral/positive/warning/critical 与账号池同源。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览清除 `gettokens.codex.account-order-display-mode` 后打开 `http://127.0.0.1:5174/#frame=codex&workspace=account-list`，确认 `缩略` 按钮激活且首张卡高度约 455px，切换列表后首行左侧状态边为 6px、颜色来自账号池 neutral tone。
36. 账号卡 tone 来源单一化：用户继续要求“用一套来源”。已新增 `frontend/src/features/accounts/components/attributionCardTone.ts`，集中导出 `AttributionCardTone`、`ATTRIBUTION_CARD_TONE_BORDER_CLASS`、`ATTRIBUTION_CARD_TONE_FILL_CLASS`、`ATTRIBUTION_CARD_BADGE_TONE_CLASS`。账号池 `AttributionCard` 与 Codex `AccountOrderRow` 都从该模块读取 tone 色值，避免从组件内部借常量或在 Codex 行内复制颜色。已验证 `npm --prefix frontend run typecheck` 与 `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`。
37. 路由候选标签去数字：用户指出列表已经按请求顺序排列，不需要在行内再显示 `路由 03` 这类数字。已将 `AccountOrderRow` 的 `policyRankLabel` 从 `路由/候选 + previewRank` 改为只显示状态标签；中文文案从 `路由` 改为 `候选`，英文从 `Route` 改为 `Candidate`。列表中参与测试候选显示 `候选`，被策略过滤显示 `跳过`，阻塞账号仍显示 `阻塞`。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览 `http://127.0.0.1:5173/#frame=codex&workspace=account-list&density=list` 确认 `ORDER 03` 行只显示 `候选`，页面不存在 `候选 03` / `路由 03`。
38. 请求顺序列表 rail 与阻塞筛选验收：用户要求列表模式中数字和拖拽手柄横向排列、数字放大，并且主候选与阻塞状态要在左侧竖条中更明显区分；同时要求 `InlineActionControls` 增加过滤项隐藏阻塞账号。已将列表行左侧 rail 改为 `序号 + GripVertical` 横向排列，序号字号提升到 14px；候选、跳过、阻塞状态复用账号卡 tone 来源，将 fill/border/badge 同步映射到左侧竖条、行左边框和右侧状态标签。新增 `全部 / 隐藏阻塞` 过滤控件，默认显示全部，切换后只隐藏 `requestable=false` 的阻塞账号，不改变真实请求顺序数组。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览 `http://127.0.0.1:5173/#frame=codex&workspace=account-list&density=list` 确认候选 rail 为绿色、阻塞 rail 为红色，隐藏阻塞后只剩 5 个可请求账号，控制台无新增 warning/error。截图归档：`screenshots/20260518/codex/20260518-codex-account-list-order-filter-after-v01.png`。
39. 路由探测 modal 页面重新规划：用户指出 `RouteProbeCard:section:67` 页面规划随意。已将路由探测 modal 重排为明确的工作台结构：顶部标题与状态条显示测试模型、候选数量、路由命中状态；左侧为测试参数、一次/连续测试、重置和备用账号开关；右侧上半区为可扫描的候选队列，按当前请求顺序展示序号、账号、出口和来源；右侧下半区为全宽测试流终端。该调整只重构展示层，不改变 `routePolicyPreviewRows`、`routingProbeStreamLines` 和 Wails 探测调用。已验证 `npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`；浏览器预览 `http://127.0.0.1:5173/#frame=codex&workspace=account-list` 打开 modal 后，桌面 1440 宽度下 5 个候选完整可见，375px 宽度下标题、关闭按钮、控制区、候选区与终端区纵向滚动可用，控制台无新增 warning/error。截图归档：`screenshots/20260518/codex/20260518-codex-route-probe-redesign-after-v02.png`、`screenshots/20260518/codex/20260518-codex-route-probe-redesign-mobile-after-v01.png`。
40. 请求顺序卡片自适应网格修复：用户指出 `AccountOrderRow` 在并不窄的屏幕上仍只显示一张卡。根因是请求顺序区非列表模式写死为 `xl:grid-cols-3`，`xl` 以下始终单列。已将 `完整 / 缩略` 卡片模式改为 Codex 专用 `auto-fit + minmax` 自适应网格，缩略卡最小轨道 288px，完整卡最小轨道 320px；列表模式仍保持单列排序行。已验证 `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build`；浏览器预览 `http://127.0.0.1:5173/#frame=codex&workspace=account-list` 在 1100px 视口下主内容宽度约 782px，`缩略` 与 `完整` 模式都渲染为两列 `367px 367px`。截图归档：`screenshots/20260519/codex/20260519-codex-account-order-grid-after-v01.png`。
41. 请求顺序顶部控件纳入已有设计系统组件：用户指出 `CodexAccountOrderSection.tsx:InlineActionControls:div` 仍是手写控件。已将显示模式 `完整 / 缩略 / 列表` 与账号过滤 `全部 / 隐藏阻塞` 两组手写 `div + DensityButton` 替换为通用 `SegmentedControl`，删除局部 `DensityButton` 实现，保留刷新按钮和响应式更多菜单逻辑。已验证 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run build`；`npm --prefix frontend run typecheck` 当前被既有 `accountLocalCliMapping.ts` 类型错误阻塞。
42. 请求顺序卡片复用账号页卡片样式：用户要求 `#frame=codex&workspace=account-list` 直接复用 `#frame=accounts` 账号卡样式，Codex 特殊操作叠加到底部操作栏或右上角菜单。已移除非列表密度下 `AccountOrderRow` 的大块 `customBody` 工作台布局，改为直接使用账号池共享 `AttributionCard` 的头部、指标、quota 与 tone 体系；拖拽、运行时启停、路由、模型映射摘要和默认/允许/排除策略收敛到 `CodexAccountSpecialActionBar` footer。已补源码结构回归测试，防止后续重新引入 `customBody` 分叉。已验证 `npm --prefix frontend run test:unit -- src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；Playwright CLI 无头截图验证桌面 1440x1000 与移动 390x900 均可渲染，截图归档：`screenshots/20260522/codex/20260522-codex-account-list-card-reuse-after-v01.png`、`screenshots/20260522/codex/20260522-codex-account-list-card-reuse-mobile-after-v01.png`。
43. 请求顺序卡片共享账号具体信息修复：用户反馈复用账号页卡片后 Codex 页没有显示额度模块。根因是 `CodexAccountRow` 转回账号卡所需 `AccountRecord` 时只保留了 id/provider/status/baseUrl/quotaKey 等少量字段，丢失 `quotaCurl`、`quotaEnabled`、`billingCurl`、`billingEnabled`、email、plan、proxy、models 等账号页额度/账单判断所需信息；因此卡片主体虽然复用了 `AttributionCard`，但 `buildQuotaDisplay` 会判断为 unsupported。已让 `buildCodexAccountRows` 保留账号原始元数据，`buildCodexQuotaSummaryAccount` 回填完整账号信息，Codex controller 与行组件统一走该转换，并把 `extractBilling` 结果传给 `AttributionCard`。已验证 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；Playwright CLI 打开 `http://127.0.0.1:34115/#frame=codex&workspace=account-list` 并等待 `text=BALANCE` 后截图，归档：`screenshots/20260522/codex/20260522-codex-account-list-shared-quota-after-v01.png`。
44. 请求顺序筛选同步账号池维度：用户要求 `#frame=codex&workspace=account-list` 同步账号页更多筛选项，并把 `CodexAccountOrderSection` 原 `ActionControlCluster` 的 view/scope 控制归到同一工具栏。已将筛选从 `all/requestable` enum 改为对象状态，覆盖来源、可请求、已禁用、异常、有余额、最长窗口额度；来源区分 OAuth、Codex API Key、openai-compatible。筛选是 AND 条件叠加，只隐藏展示行，不改变 `orderedRows`、ORDER 编号或运行时请求顺序。顶部工具条现在统一承载刷新、显示筛选菜单和完整/缩略/列表密度切换，删除独立 `ActionControlCluster`。已验证 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；Playwright 打开 `http://127.0.0.1:34115/#frame=codex&workspace=account-list` 后确认“显示”菜单包含余额筛选，勾选有余额后只保留满足该条件的账号且原 ORDER 05 不被重排。
45. 请求顺序筛选补齐阻塞与勾选框样式：用户要求 Codex 账号编排继续补充阻塞、勾选等筛选项，并明确“不要 only，要 AND”，随后要求不再兼容 only 口径。已将模型字段全面迁移为 `requiresRequestable` / `requiresBlocked` / `requiresDisabled` / `requiresError`，表达勾选后必须同时满足的条件；筛选入口不再接受旧兼容口径或 `'requestable'` 字符串入口。筛选菜单改为状态、资源、来源三组，全部使用同一种勾选框行样式，来源筛选也不再使用按钮格子；筛选按钮摘要同步按状态、资源、来源排序。已验证 `node --test src/features/codex/codexAccountList.test.mjs`、`npm run typecheck`（工作目录：`frontend/`）。
46. Codex 套餐徽章补齐：用户指出 `AttributionCard` badge 区可用于显示 Codex 套餐。已将账号卡 badge 构建收敛到 `buildAccountAttributionBadges(account, quotaDisplay)`，优先取 quota 返回的 `planType`，再回退账号记录的 `planType`，并继续保留格式徽章；Codex 请求顺序卡片也通过同一 `buildCodexQuotaSummaryAccount` 结果解析套餐，将 `PLUS` / `PRO` / `TEAM` 等标签显示在 badge 区。后续又把 badge 文案收敛为“短名显示 + title 全名”，格式 badge 以 `ANTH` / `OAI CHAT` / `OAI RESP` / `GEM` 形式展示，悬浮保留完整 label。已验证 `node --test frontend/src/features/accounts/tests/accountPresentation.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`。
47. 账号筛选菜单重设计：用户要求把 `AccountsToolbar` 的筛选菜单改为四组对象状态。已将来源重做为 `全部 / AUTH FILE / API KEY`，资源重做为 `存在额度 / 存在余额`，状态重做为 `全部 / 异常 / 禁用 / 可请求`，套餐重做为 `全部 / free / plus / pro`；四组默认全选，筛选摘要按来源、资源、状态、套餐稳定展示。套餐选项根据当前账号数据中实际存在的 `availablePlanTypes` 显示和禁用，空数据时保留默认全选逻辑。已同步更新 `accountFilters`、`accountSelectors`、`AccountsFeature`、`AccountsListWorkbenchView`、本地化文案与回归测试，`npm run typecheck` 与 `npm run test:unit` 通过。
48. 请求模式说明入口：用户反馈顺序模式下仍可能同时消耗多个账号，需要把原因写进产品说明。已在 `ChannelRoutingWorkbench` 的 `请求模式` 标题旁新增问号按钮，点击弹出 `请求模式说明` 弹层；说明明确顺序模式不是账号独占，retry / failover、运行态 guard、WebSocket pinned auth 释放、项目/组限定、多会话并发、路由探测与连续测试都可能导致后续账号被命中。该入口同时覆盖 Codex 与 Claude 共用路由工作台。已验证 `npm --prefix frontend run test:unit`、`npm --prefix frontend run typecheck`；in-app browser 打开 `http://localhost:5173/?preview=codex#frame=codex&workspace=account-list` 后确认问号入口、说明弹层、右上角关闭按钮与底层模式区域保留可见，弹层底部不再显示冗余返回按钮，375px 无横向溢出。截图归档：`screenshots/20260526/codex/20260526-codex-account-list-route-mode-help-after-v03.png`。
49. 启停同步收口：`#frame=accounts` 与 `#frame=codex&workspace=account-list` 现在共用 canonical account id 的启停通道，成功写入后会广播 `auth-file:` / `codex-api-key:` / `openai-compatible:` 状态变化；浏览器 preview 还会把禁用覆盖写入同源 localStorage，确保两个页面切换后仍保持同一启停状态，不再依赖旧业务的 bare name 兼容路径。已验证 `node --test frontend/src/features/accounts/tests/accountDisabledSync.test.mjs frontend/src/features/codex/codexAccountList.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs`、`npm --prefix frontend run typecheck`、browser preview 交互验收。
50. 请求顺序工具栏自适应展开：用户指出标题右侧 `更多操作` 在有空间时不应默认收起，随后补充搜索框应左对齐并拉伸补齐剩余宽度、按钮按内容自适应。已把 `CodexAccountOrderSection` 工具栏从布尔收起改为 `inline / wrapped / menu` 三态布局：标题与工具栏同排可放下时直接展开；同排放不下但整行可承接时换到标题下方展开；空间不足时再收进 `更多操作` 菜单。展开态工具栏改为 flex：搜索框 `flex` 拉伸吃掉剩余空间，刷新、筛选和密度按钮保持内容宽度。已补 `chooseCodexOrderSectionActionLayout` 与结构回归测试，并验证 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 在 1600px / 1280px / 720px 三档确认同排、换行、菜单状态，并在 1148px 视口确认搜索框左边缘与请求顺序区域对齐、按钮不拉伸。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-toolbar-adaptive-after-v02.png`。
51. Codex 卡片 footer 去卡中卡：用户指出请求出口 / 模型映射 / 运行态这块仍像卡中卡，且上方区域被撑大；后续又指出 footer 区存在重复分割线。中途曾尝试把 `CodexAccountSpecialActionBar` 扁平化，但最终按用户要求收敛为直接复用账号池 `AccountCard`，Codex 请求顺序卡不再渲染自定义 footer 区，因此请求出口、模型映射、运行态不再以卡中卡形式出现在请求顺序卡里，也避免了 footer 内外分割线叠加。已验证 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 1148px 视口确认 deepseek footer 内部 dashed 分割线计数为 0，仅保留共享账号卡自身结构。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-footer-flat-after-v01.png`、`screenshots/20260527/codex/20260527-codex-account-list-footer-lines-after-v01.png`。
52. 刷新按钮组件化：用户指出 `强制刷新` 应复用其他页面已有的刷新图标模式，不应在 Codex 工具栏单独手写；随后明确工具栏展开态只需要图标，不需要文字。已新增 `frontend/src/components/ui/RefreshActionButton.tsx`，统一 `RefreshCw` 图标、loading 旋转、Swiss button 尺寸和禁用态，并支持 `iconOnly`；Codex 请求顺序工具栏展开态使用 icon-only，保留 `aria-label/title=强制刷新`，菜单态仍显示文字便于扫描。Channel Routing 最近路由、Codex live sessions、Codex binary、Codex extensions、Vendor Status 的刷新入口也已改为复用该组件。已补源码结构回归测试，确保 Codex 工具栏不再回到纯文字刷新按钮。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 1148px 视口确认 `强制刷新` 可见文字为空、带 svg 图标、按钮宽度收敛为约 42px。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-refresh-button-component-after-v01.png`、`screenshots/20260527/codex/20260527-codex-account-list-refresh-icon-only-after-v01.png`。
53. Codex 请求顺序卡保持账号池共享卡片头部：用户指出 Codex 卡片既然与账号池共享样式，就不应把 `拖动 / 置顶 / 置底` 塞进账号卡 header 主布局。已移除 `AttributionCard.leadingAction` 用法，改为通过 `topActions` 渲染右上角 icon-only 操作组；拖动、置顶、置底仍可用，但不再产生可见文字，也不再挤占账号名称、endpoint 和 badge 区域。已补回归测试锁定 Codex 卡不再使用 `leadingAction`，且置顶/置底不渲染文字 span。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 1148px 视口确认 deepseek 卡 header 文本从 `候选 deepseek...` 开始，`headerHasLeadingActionText=false`，右上角 action 可见文字为空。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-shared-card-actions-after-v01.png`。
54. Codex 卡头排序操作降噪：用户反馈右上角竖排 `拖动 / 置顶 / 置底` 图标组仍然破坏共享账号卡头部观感，甚至不如最初版本。已将非列表模式的排序动作进一步收敛为单个账号卡同款 `更多操作` 图标按钮，默认态只保留账号身份、endpoint、ORDER 与来源 badge；置顶、置底放入下拉菜单，拖拽仍可从同一个图标发起。回归测试改为锁定 `OrderCardActionMenu`、`MoreVertical`、`aria-haspopup="menu"` 与 `role="menu"`，防止再出现竖排按钮组。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 1231px 视口确认 deepseek 卡默认文本仍从 `候选 deepseek...` 开始，默认态不含 `拖动 / 置顶 / 置底` 可见文字，只保留 `账号操作` 图标。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-card-actions-menu-after-v01.png`。
55. Codex 请求顺序卡直接复用账号池 `AccountCard`：用户进一步要求这块不要自己做“账号池相似组件”，而是直接复用账号池卡片，激活/禁用也走账号池菜单，拖动则拖整张卡。已将非列表模式的 `AccountOrderRow` 从自定义 `AttributionCard + CodexAccountSpecialActionBar + ToggleSwitch` 改为直接渲染 `AccountCard`，仅通过 `extraBadges` 补充 `ORDER xx` 与 Codex 来源 badge；`AccountCard` 新增可选 `extraBadges`、`showDeleteAction`、`showFooterActions`，默认不影响账号池，Codex 页关闭删除和底部详情/刷新动作，让启用/禁用保留在账号菜单内。排序不再暴露置顶/置底按钮，外层整卡设置 `draggable`，拖整张卡即可调整请求顺序；Claude Code 共享调用也同步移除旧置顶/置底 props。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser 1106px 视口确认 deepseek 卡只有账号池菜单按钮、无 Codex footer 标签、无独立 toggle 文案，外层整卡可拖。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-account-card-reuse-after-v01.png`。
56. 参与账号迁移到请求顺序筛选：用户指出上方请求模式区的 `参与账号 5 个账号` 与下方账号列表重复。已移除 `ChannelRoutingWorkbench` 内的参与账号折叠区，把参与范围下沉到请求顺序工具栏的 `显示` 菜单，在新增 `路由` 分组中提供 `参与账号` / `跳过账号` 两个 AND-style 展示筛选项。筛选只影响下方账号列表展示，不改变真实 `orderedRows`、ORDER 编号或运行时请求顺序。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs`、`npm --prefix frontend run typecheck`；Playwright 打开 `http://localhost:5173/#frame=codex&workspace=account-list` 确认上方不再存在 `参与账号 5 个账号`，`显示` 菜单可见 `路由 / 参与账号 / 跳过账号`。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-participant-filter-after-v01.png`。
57. 浏览器 mock 不暴露预览标识：用户确认 `localhost:5173` 虽然使用 mock 数据，但账号列表界面应与真实桌面环境显示一致。已移除请求模式标题旁的 `预览` chip，Codex browser mock 下的请求顺序说明、加载/保存/启停提示复用真实环境文案；mock 数据加载、本地排序和启停覆盖逻辑保持不变。验证通过 `node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app browser / Playwright 打开 `http://localhost:5173/#frame=codex&workspace=account-list` 确认 `hasPreviewChip=false`、`hasBrowserHint=false`，请求顺序说明为真实环境文案。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-preview-chrome-hidden-after-v01.png`。
58. Codex 请求顺序卡片同行等高：用户指出请求顺序卡片同一行高度应一致，不应让短卡片露出一大片行背景。已撤回 Codex 单独的 `fillHeight={false}` 高度分叉，恢复共享 `AccountCardFrame` 的固定 `h-full` 行为，让请求顺序区继续复用账号池同源等高卡片；`AccountCard` 仍只通过 `extraBadges`、`showDeleteAction=false`、`showFooterActions=false` 做 Codex 页必要差异。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`；in-app Browser 在 `http://localhost:5173/#frame=codex&workspace=account-list` 确认第一行 `deepseek / ops-pro / Stable 001` 高度均为 `371px`，第二行 `team-routing / Gray Canary / openrouter` 高度均为 `371px`。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-card-equal-height-after-v01.png`。
59. Codex 请求顺序卡片状态前置序号：用户要求只在 Codex 请求顺序页把序号叠加到 `可用` 前面。已给共享 `AccountCard` / `AttributionCard` 增加可选 `eyebrowPrefix`，默认空，不影响账号池；Codex 请求顺序卡按当前展示索引传入 `#1`、`#2` 等前缀，渲染为 `#1 可用`、`#6 已禁用`。验证通过 `node --test frontend/src/features/codex/codexAccountList.test.mjs`、`npm --prefix frontend run typecheck`；in-app Browser 在 `http://localhost:5173/#frame=codex&workspace=account-list` 确认前 6 张卡 eyebrow 为 `#1可用`、`#2可用`、`#3可用`、`#4可用`、`#5可用`、`#6已禁用`，视觉上由 flex gap 分隔序号与状态。截图归档：`screenshots/20260527/codex/20260527-codex-account-list-order-prefix-after-v01.png`。

## 当前状态
- 状态：implemented
- 最近更新：2026-05-27
