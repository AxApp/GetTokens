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
- openai-compatible 模型映射允许在 Codex 账号详情 modal 内新增、删除和保存；更完整的 provider 基础信息编辑仍留在账号池入口。
- 不把账号池路由策略持久化为新的全局配置；本期策略编辑用于单次路由探测与后续客户端 overlay 的交互基础。

## 验收标准
1. Given 用户进入 `Codex`，When 点击 `账号列表`，Then 页面展示 Codex 可请求账号总数、可用数量和 openai-compatible 数量。
2. Given 账号池中存在 Codex OAuth auth-file、Codex API Key 和 openai-compatible provider，When 打开账号列表，Then 三类账号都出现在同一请求顺序列表中。
3. Given 某账号被禁用或状态异常，When 查看列表，Then 该账号保留在顺序中但标记为不可请求。
4. Given 用户拖动账号调整顺序并保存，When 保存成功，Then 通过 `UpdateAccountPriority` 写回优先级，刷新后仍按新顺序展示。
5. Given openai-compatible provider 配置了模型 `{ alias, name }`，When 查看该账号详情，Then 模型映射显示为 `name -> alias || name`；当 alias 为空时显示 `name -> name`，并可新增、删除、保存映射。
6. Given sidecar 未 ready，When 打开账号列表，Then 页面显示等待 sidecar ready 的状态，不发起账号加载。
7. Given 在普通浏览器环境打开 `#frame=codex&workspace=account-list`，When 页面缺少 Wails runtime，Then 加载稳定预览账号并支持本地排序/启停交互，不抛出 Wails 绑定错误。
8. Given 用户打开 Codex 账号详情 modal，When URL hash 同步完成，Then 地址栏保留 `#frame=codex&workspace=account-list&detail=<account-id>`；When 关闭 modal，Then 只移除 `detail`，保留当前 Codex 账号列表 frame。
9. Given 用户保存请求顺序后，When 输入测试模型并点击 `测试一次` 或 `连续测试 3 次`，Then 页面通过真实 relay 请求识别命中的账号，并在结果区与对应账号行展示命中标记。
10. Given 用户打开 Codex OAuth/auth-file 账号详情，When 调整模型映射并保存，Then 页面写入 sidecar `oauth-model-alias[<provider>]`，支持将高等级 Codex 模型 alias 路由到低等级真实模型。
11. Given 用户在账号列表配置允许账号、排除账号、策略顺序和 fallback，When 点击路由测试按钮，Then 后端将页面 row id 翻译为 sidecar auth id，通过 `X-GetTokens-Route-*` loopback header 控制本次测试请求的候选账号与顺序，并在页面展示最终候选顺序和实际命中账号。

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
9. Codex 账号详情 modal 已接入 hash detail 约定：打开详情写入 `detail=<account-id>`，直接打开带 detail 的 URL 可恢复 modal，全局导航 hash 同步不会误删当前页面的 modal detail。
10. OAuth/auth-file 账号详情已接入 `GetAuthFileModels`，在 Codex 账号详情 modal 内按同名透传展示 Web/OAuth 可用模型；openai-compatible 继续保留可编辑模型映射。
11. openai-compatible 模型映射编辑的真实模型列已接入账号池现有 `FetchOpenAICompatibleProviderModels` 拉取逻辑，并通过下拉候选辅助选择；Codex 模型/alias 列接入现有 `ListRelaySupportedModels` 模型目录，也使用可下拉、可自定义输入的 combobox。
12. 账号列表顶部新增路由探测区：模型输入支持自定义 combobox 候选，提供 `测试一次` 与 `连续测试 3 次` 两个按钮；存在未保存顺序时禁用测试并提示先保存，测试结果会显示 HTTP 状态、命中账号、recent request 证据，并高亮列表中刚命中的账号。
13. 后端新增 `ProbeCodexAccountRouting`：使用 relay API key 向 sidecar `/v1/chat/completions` 发送最小测试请求，通过请求前后 `auth-files` 与 `api-key-usage` 的 recent request 差量识别命中的 auth-file、codex-api-key 或 openai-compatible provider。
14. OAuth/auth-file 账号详情的模型区域已从只读兼容模型改为可编辑模型映射：加载时合并 `GetAuthFileModels` 与 `ListOAuthModelAliases(provider)`，保存时调用 `UpdateOAuthModelAliases` 写回 `oauth-model-alias`；该配置按 provider/channel 生效，同一 `codex` OAuth 通道共享映射。
15. 路由策略调试区按 Gemini 评审方案重构为“控制台 + 内联策略编辑”：默认先展示测试模型、测试按钮、候选顺序和最近路由命中；点击 `编辑策略` 后不再渲染第二套账号清单，而是在既有请求顺序账号行内直接显示默认/允许/排除与策略上移/下移控件；账号列表行同步显示 `路由 NN`、`跳过` 和策略模式，避免重复账号列表打断配置路径。

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

## 当前状态
- 状态：implemented
- 最近更新：2026-05-14
