# Bug 修复集中处理

## 背景
本轮目标不是 UI 改造，而是集中处理 GetTokens 当前积累的 bug。为了避免修复记录、复现路径、测试和截图散落到多个临时位置，本 space 作为 2026-05-31 开始的 bug 修复集中入口。

后续每个 bug 必须先明确复现条件、影响范围、期望行为和回归方式，再进入代码修改。涉及 UI 的 bug 可以保留截图，但截图用于说明缺陷和验证修复，不作为设计改造任务。

## 目标
1. 建立 bug 修复集中工作区，统一归档缺陷清单、复现步骤、修复计划、截图、辩论和交付记录。
2. 对每个 bug 执行可追踪闭环：复现 -> 定位 -> 红灯测试 -> 最小修复 -> 回归验证 -> 记录结论。
3. 优先处理影响账号、sidecar、路由、配置保存、会话观测、导入/删除/刷新、打包发布等关键链路的问题。
4. 把重复出现的排障路径或修复模式沉淀到项目级 skills；只有长期稳定的 repo-wide 规则才更新 `AGENTS.md`。

## 范围
1. GetTokens 主仓库内可复现的功能缺陷、回归问题、构建/测试失败、Wails binding 缺口、sidecar 运行态异常、前端状态不一致和发布验收问题。
2. 与 bug 直接相关的最小 UI 修正，例如文字溢出、按钮状态错误、错误提示缺失、交互入口失效。
3. bug 修复所需的测试补齐：Go tests、前端 `node --test`、typecheck/build、Storybook catalog、浏览器脚本或 Wails 桌面验收。
4. 截图和日志归档：用于证明复现、失败状态、修复后状态或不可复现结论。

## 非目标
1. 不在本 space 做无明确缺陷来源的大规模 UI 改造、视觉重设或设计系统重构。
2. 不把产品需求扩展、功能增强或技术债重构混入 bug 修复；若定位后确认不是 bug，应新开或链接对应 feature / refactor space。
3. 不为了快速修复绕过 sidecar、Wails binding 或业务模型边界。
4. 不接受“只改代码不验证”；无法验证时必须写明阻塞和风险。

## 验收标准
### 场景 1：集中归档
Given 本轮 bug 修复开始
When 新增缺陷清单、复现材料、修复计划、截图、辩论或交付记录
Then 文档应优先归档到 `docs-linhay/spaces/20260531-bug-fix/`
And 每个 bug 至少记录复现条件、实际行为、期望行为和回归方式。

### 场景 2：先复现再修复
Given 收到一个 bug
When 开始写实现代码前
Then 应先确认复现路径或给出不可复现结论
And 能写测试的缺陷应先补失败测试。

### 场景 3：最小修复
Given bug 根因已经定位
When 修改代码
Then 修改应限制在修复所需的最小范围
And 不顺手引入无关 UI 改造、功能增强或大规模重构。

### 场景 4：关键链路回归
Given 修复触及账号、路由、sidecar、配置保存、会话观测、Wails binding 或发布链路
When 交付修复
Then 必须运行对应自动化测试
And 需要真实 runtime 的问题必须完成 Wails/桌面验收，或明确写出未验收风险。

### 场景 5：修复记录可检索
Given bug 修复完成或确认阻塞
When 写回文档和 memory
Then 结论应能通过 `qmd query --collection GetTokens` 检索到。

## 设计稿入口

- 本期设计稿：不适用。
- 说明：本 space 是 bug 修复集中入口；只有 UI 缺陷复现或修复验收需要时才归档截图。

## Worktree 映射

- branch：`fix/20260531-bug-fix`
- worktree：`../GetTokens-worktrees/20260531-bug-fix/`

## 相关链接
- 当前实施计划：[plans/20260531-bug-fix-plan-v01.md](plans/20260531-bug-fix-plan-v01.md)
- 历史 bug 周期：[20260514-bug-week](../20260514-bug-week/README.md)
- 业务页面目录：`frontend/src/pages/`
- 功能模块目录：`frontend/src/features/`
- Wails 根绑定：`app.go`、`app_types.go`
- sidecar 维护边界：`CLIProxyAPI#gettokens/sidecar`

## 当前状态
- 状态：completed
- 最近更新：2026-05-31

## 收尾结论
本期 bug-fix space 已完成集中修复与验收，覆盖 Codex live sessions TimingTrendChart、accounts preview mock 数据、账号详情动作入口和布局一致性、Codex 账号详情代理路由合并、账号激活/禁用路由语义、运行证据合并和账号卡统一宽度。

会话沉淀结论：本轮新增的长期可复用模式是 `#frame=codex&workspace=live-sessions` preview timing 数据必须模拟真实请求历史。completed 请求应按稳定 request 身份生成 timing，live preview 只能让当前样本变化，避免 mock 动画导致全部 waveform bars 每秒重绘。该规则已写入 `.agents/skills/gettokens-domain-engineering/SKILL.md` 和 `docs-linhay/dev/20260523-session-distillation-codex-live-sessions-ui.md`，不升级到 `AGENTS.md`。

## Bug 001：Codex live sessions TimingTrendChart 不显示
### 复现
1. 打开 `#frame=codex&workspace=live-sessions`。
2. 进入有 preview 请求数据的会话详情。
3. `TimingTrendChart` 区域应显示请求耗时波形图，但实际可能只看到空白区域；用户指出位置在 `frontend/src/features/codex-live-sessions/components/CodexLiveSessionDetail.tsx` 的 `TimingTrendChart` SVG 附近。

### 根因
`TimingTrendChart` 已经在未测量宽度时使用 320px fallback 渲染 SVG，但同一状态下又把 chart shell 设置为 `visibility: hidden`。如果 `ResizeObserver` 或初始 `clientWidth` 没有及时给出正数，SVG 节点存在但整块图表持续不可见。

### 修复
1. 新增 `timingTrendChartFallbackWidthPx`，让未测量宽度时继续用稳定 fallback viewport。
2. 移除未测量时的 `visibility: hidden`，避免 fallback 渲染被隐藏。
3. 更新 `frontend/src/features/codex-live-sessions/model.test.mjs` 的回归断言，禁止重新引入 hidden fallback。

### 视觉补强
1. `TimingTrendChart` 不再按 dashboard chart 渲染：移除外框、Y 轴大标签、纵横网格、悬浮数值标注和大虚线 live 圈。
2. 图形主体改为 audio waveform strip：只保留一条轻量中线，每个请求是一条围绕中线的垂直 amplitude bar。
3. 历史样本降低对比度；当前或 live 样本使用轻微呼吸 ring；sequence 信息只放到底部小刻度，不压在波形上。
4. 样本数不足以填满视口时，仍保持最新样本贴近右侧；bars 不再被硬撑满整宽，避免横向间距过大。
5. 5173 preview 数据改为更接近真实请求：历史 completed 请求按 sequence 生成稳定耗时，保留少量慢请求 spike；live 请求只在当前样本内增长，避免每秒拖动全部历史 bars 的比例。

### 验证
1. `node --test frontend/src/features/codex-live-sessions/model.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build`
4. Chrome headless 打开 `http://127.0.0.1:5173/?preview=codex-live-sessions#frame=codex&workspace=live-sessions`，DOM 检查结果：`timingSvg=true`、`hiddenTimingShell=false`、`waveformLines=109`、`waveformCircles=49`。
5. 截图：`screenshots/20260531/codex-live-sessions/20260531-codex-live-sessions-timing-trend-after-v01.png`。
6. Waveform 视觉补强后，Playwright headless DOM 检查结果：`hasStrip=true`、`hasSvg=true`、`barCount=50`、`centerlineCount=1`、`tickCount=5`、`dashed=0`、`borderTopWidth=0px`、`boxShadow=none`。
7. Waveform 截图：`screenshots/20260531/codex-live-sessions/20260531-codex-live-sessions-timing-waveform-after-v02.png`，本版平均 bar gap 约 `6.65px`。
8. 真实 preview 数据补强后，Playwright headless 连续采样 `1.5s`，检查结果：`barCount=50`、`changedCount=1`、`changedIndexes=[49]`、`dashed=0`，即只有最后一个 live 样本变化。
9. 真实 preview 截图：`screenshots/20260531/codex-live-sessions/20260531-codex-live-sessions-timing-waveform-realistic-preview-after-v01.png`。

## Bug 002：localhost accounts 预览需要模拟数据
### 复现
1. 启动 Vite dev server。
2. 打开 `http://localhost:5173/#frame=accounts`。
3. 账号池页面应在普通浏览器无 Wails runtime 时显示模拟账号数据，便于 UI 和交互验收。

### 结论
账号页已有 preview 数据源，普通浏览器路径会通过 `hasWailsAppBindings() === false` 走 `getAccountsPreviewAuthFiles()` 与 `getAccountsPreviewAPIKeyRecords()`。本轮未改业务加载逻辑，而是补齐可回归门禁，防止模拟数据被后续改动清空或入口失效。

### 补强
1. 新增 `frontend/src/features/accounts/tests/accountPreviewData.test.mjs`，锁定 preview 数据至少覆盖 auth file、Codex API key 和 OpenAI-compatible provider。
2. 新增 `docs-linhay/scripts/accounts-browser-check.mjs`，直接验收 `http://localhost:5173/#frame=accounts` 是否渲染 `codex-pro.json`、`Stable 001`、`OPENAI-COMPATIBLE` 和 `ops-pro@example.com`。
3. 将新测试纳入 `frontend/package.json` 的 `test:unit`，并同步 `frontend/package.json.md5`。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountPreviewData.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build`
4. `node docs-linhay/scripts/accounts-browser-check.mjs`
5. 截图：`screenshots/20260531/accounts/20260531-accounts-browser-preview-mock-data-after-v01.png`。

## Bug 003：账号详情动作入口与余额空状态
### 复现
1. 打开 `http://localhost:5173/#frame=accounts`，进入 Codex API Key 账号详情。
2. `AccountQuotaSection` 与 `AccountBillingSection` 的测试按钮出现在模块正文中，和 section header action 区域不一致。
3. 未配置余额脚本的账号详情缺少明确空状态；余额 header 不应出现“编辑”入口，未配置时应只提供“添加”。
4. 打开 Codex 账号列表详情的 `CodexModelRoutingSection`，模型映射区缺少手动拉取模型入口。

### 修复
1. 将 quota / billing 的测试按钮移动到 `AccountDetailSection` 的 `actions`，即模块右上角；无测试回调或脚本为空时保持禁用。
2. `AccountBillingSection` 新增空状态：未配置脚本时显示“暂无余额脚本，添加后可测试并展示余额”，header action 显示“添加”和禁用的“测试余额”；已配置脚本时继续在正文显示启用开关与编辑脚本入口。
3. `CodexModelRoutingSection` 新增拉取远端模型按钮，并从 `CodexAccountListFeature` 透传已有 `GetAuthFileModels` / `FetchOpenAICompatibleProviderModels` 拉取逻辑，覆盖 auth-file、openai-compatible 和 codex-api-key 详情。
4. 补充 source-level 回归测试，锁定 action 放置、billing 空状态和 Codex 模型拉取入口。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
2. `npm --prefix frontend run test:unit`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`
5. `agent-browser` headless 验收：
   - `#frame=accounts&detail=codex-api-key%3Amanual-disabled`：余额区显示“添加 / 测试余额 / 暂无余额脚本，添加后可测试并展示余额”。
   - `#frame=codex&workspace=account-list` 打开 deepseek 详情：模型映射区显示“拉取远端模型”和“新增模型”。
6. 截图：
   - `screenshots/20260531/accounts/20260531-accounts-billing-empty-after-v01.png`
   - `screenshots/20260531/accounts/20260531-codex-model-routing-fetch-after-v01.png`

## Bug 004：Codex 账号详情代理路由与 Header 元信息布局
### 复现
1. 打开 `#frame=codex&workspace=account-list`，进入 Codex API Key 账号详情。
2. `AccountProxyRouteSection` 作为独立模块展示，但内容较单一，和凭据编辑、连接验证属于同一配置链路。
3. `CodexAccountDetailHeader` 的元信息区使用卡片式上下文字结构，占用高度较多；期望按内容横向自适应排列。

### 修复
1. Codex 账号详情模块计划移除独立 `proxy-route`，将代理路由统一折叠进 `AccountCredentialVerifySection`。
2. `AccountCredentialVerifySection` 明确为垂直排列：Credential -> Connection -> Route。
3. `CodexAccountDetailHeader` 的 `dl` 改为 `flex-wrap` 横向布局；单项 meta 改为 `dt/dd` 同行 `inline-flex`，按内容自适应宽度。
4. 补充 source-level 回归测试，防止重新出现独立 `AccountProxyRouteSection` 模块或 header grid 卡片结构。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
2. `npm --prefix frontend run test:unit`
3. `npm --prefix frontend run typecheck`
4. `npm --prefix frontend run build`
5. `agent-browser` headless 验收 `#frame=codex&workspace=account-list&detail=codex-api-key%3Astable-001`：
   - 主模块列表不再包含 `AccountProxyRouteSection`。
   - `AccountCredentialVerifySection` 内存在 `data-account-credential-list-item="proxy-route"`。

   - `data-account-credential-verify-layout="vertical"`。
   - Header summary computed display 为 `flex`，grid template 为 `none`。
6. 截图：`screenshots/20260531/accounts/20260531-codex-detail-credential-proxy-header-after-v01.png`。

## Bug 005：账号详情 Quota / Billing / 凭据布局一致性
### 复现
1. 打开 `#frame=accounts&detail=codex-api-key%3Amanual-disabled`。
2. `AccountQuotaSection` 和 `AccountBillingSection` 的空状态、脚本卡片和 header actions 不一致；Billing 的“添加”按钮需要放在右侧。
3. `AccountCredentialVerifySection` 不应限制为半屏宽度；凭据输入框标题应像 `VerifyConnectionPanel` 一样显示在输入框上方，而不是嵌入输入框内。
4. 打开 `#frame=codex&workspace=account-list&detail=codex-api-key%3Astable-001`，Codex 详情里的凭据模块也应跨两列展示，避免代理路由合并后仍被半屏宽度限制。

### 修复
1. `AccountQuotaSection` 对齐 `AccountBillingSection`：增加 `hasQuotaScript`、空状态、条件脚本卡片和 header action；未配置脚本时显示“添加”，已配置时正文显示“编辑脚本”。
2. `AccountBillingSection` 的 header actions 调整为“测试余额”在前、“添加”在后，使“添加”位于右侧。
3. `CredentialInputField` 改为上方 label + `input-swiss` 输入行，移除 embedded label 结构。
4. `CodexAccountDetailModal` 为 `AccountCredentialVerifySection` 传入 `span="wide"`，与统一账号详情保持跨列布局。
5. 扩展 `docs-linhay/scripts/accounts-browser-check.mjs`，覆盖账号列表 mock 数据、账号详情 Quota/Billing/凭据布局、Codex 详情 wide credentials 和 proxy 合并三类浏览器验收。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs frontend/src/features/codex/codexAccountList.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run test:unit`
4. `npm --prefix frontend run build`
5. `node docs-linhay/scripts/accounts-browser-check.mjs`
6. 截图：
   - `screenshots/20260531/accounts/20260531-accounts-credential-quota-billing-after-v01.png`
   - `screenshots/20260531/accounts/20260531-codex-detail-credential-proxy-wide-after-v01.png`

## Bug 006：账号激活/禁用误触发 runtime apply
### 复现
1. 在账号列表或账号详情中点击统一账号卡的激活/禁用。
2. 当前账号记录实际只需要切换是否参与账号池路由，但 status PATCH 会进入账号 runtime apply。
3. 当 runtime apply 失败或返回异常时，前端会展示类似“激活失败”的错误，误导用户以为激活是在验证账号可用性。

### 期望
1. 激活/禁用只写账号卡对应 SQLite 记录的 `account_cards.disabled`。
2. 激活/禁用不代表账号是否可用，也不触发凭证/配置 runtime apply。
3. 禁用只表示从账号池路由中排除；激活只表示后续路由可重新选择。
4. 如果被禁用账号当前有 Codex WebSocket 会话，应立即关闭受影响上游会话，让后续请求重新走账号池选择。

### 根因
sidecar `PatchAccountStatus` 在调用 `SetAccountStatus` 后继续执行 `applyAccountStoreRuntime`；同时 `SetAccountStatus` 复用了会递增 `revision` 并写 `account_runtime_apply_state=pending` 的 card 更新路径。状态变更被错误建模成账号凭证/配置变更，因此 apply 失败会冒泡成激活/禁用失败。

### 修复
1. `accountstore.SetAccountStatus` 改为只更新 `account_cards.disabled` 和 `updated_at_unix_ms`，保持 `revision` 和上一轮 `runtime_apply_status` 不变。
2. management `PatchAccountStatus` 不再调用 `applyAccountStoreRuntime`，改为触发轻量 status hook。
3. sidecar service 注册 status hook：按 `account_key` 同步 runtime route disabled 状态；禁用时写入 `manual-disabled` route guard 并关闭 Codex WebSocket 会话，激活时清除 manual-disabled guard。
4. 新增 `coreauth.Manager.SetRouteDisabled`，只更新内存路由池成员状态和 scheduler，不持久化 auth credential payload。

### 验证
1. `go test ./internal/gettokens/accountstore -run TestSetAccountStatusOnlyUpdatesDisabledWithoutRuntimeApply -count=1`
2. `go test ./internal/api/handlers/management -run TestAccountsCRUDEndpointsPreserveAccountKeyOnPatch -count=1`
3. `go test ./sdk/cliproxy -run TestServiceApplyAccountStoreStatusChangeGuardsRouteAndClosesWebsocket -count=1`
4. `go test ./internal/gettokens/accountstore ./internal/api/handlers/management ./sdk/cliproxy ./sdk/cliproxy/auth -count=1`
5. `scripts/ensure-sidecar.sh darwin arm64`

## Bug 007：账号详情运行快照与证据区割裂
### 复现
1. 打开统一账号详情或 OpenAI-compatible 账号详情。
2. `AccountRuntimeSnapshotSection` 与 `AccountEvidenceSection` 作为两个并排模块展示。
3. 两个模块都描述“当前账号运行态依据”，但被拆成两个标题、两个边框和两个半屏区域，视觉上显得重复且信息关系不清。

### 期望
1. 运行快照与证据合并为一个账号详情顶部诊断面板。
2. 面板内按“实时运行态 / 审计证据”分区展示，保持桌面宽度下可扫描，窄宽度下自然纵向排列。
3. 统一账号详情和 OpenAI-compatible 账号详情都使用同一合并组件。
4. 不改变底层 usage、quota、billing、evidence 数据模型，只调整呈现结构和样式。

### 验收
1. 账号详情顶部只出现一个运行证据 section。
2. `AccountEvidenceSection` 不再作为统一账号详情的独立 section 使用。
3. 回归测试覆盖合并组件、调用位置和 source-level 样式结构。

### 修复
1. 新增 `AccountRuntimeEvidenceSection`，将 runtime snapshot 与 audit evidence 合并到一个 section。
2. 统一账号详情直接挂载合并 section，不再通过 `AccountDetailOverviewGrid` 做 50/50 split。
3. OpenAI-compatible 详情复用同一个合并 section，并通过 `evidenceRows` 注入 provider 证据行。
4. 更新 Storybook 示例和 browser check，覆盖合并后的 DOM 标记。

### 补充调整（2026-05-31）
1. 按最新要求直接移除 `AccountRuntimeEvidenceSection`。
2. 统一账号详情和 OpenAI-compatible 详情不再挂载顶部运行证据 overview。
3. Storybook 示例、source-level 测试、设计系统 manifest 与 browser check 改为锁定该 section 不再出现。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `ACCOUNTS_PREVIEW_BASE_URL=http://localhost:5173 node docs-linhay/scripts/accounts-browser-check.mjs`

## Bug 008：账号卡宽度被 grid 等分拉伸
### 复现
1. 打开 `#frame=accounts`。
2. 账号卡所在 `account-card-grid-full / compact` 使用 `repeat(auto-fit, minmax(..., 1fr))`。
3. 每列会按剩余页面宽度等分拉伸，导致 `AccountCardFrame` 显示宽度随当前列数变化，而不是使用整个页面统一的账号卡宽度。

### 期望
1. 账号卡宽度由页面级统一 token 控制。
2. grid 只决定一行能放几张卡，不把剩余空间平分给每张卡。
3. `AccountCardFrame` 继续填满自己的 grid track，但 track 本身使用统一固定卡宽。

### 修复
1. 在 `frontend/src/style.css` 增加 `--account-card-grid-full-width` 和 `--account-card-grid-compact-width`。
2. `.account-card-grid-full / compact` 改为 `repeat(auto-fit, minmax(min(100%, var(--...)), var(--...)))`，并设置 `justify-content: start`。
3. 更新 `accountCardLayout.test.mjs`，锁定账号卡 grid 不能再使用 `1fr` 等分列宽。

### 验证
1. `node --test frontend/src/features/accounts/tests/accountCardLayout.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `ACCOUNTS_PREVIEW_BASE_URL=http://localhost:5173 node docs-linhay/scripts/accounts-browser-check.mjs`

## Bug 009：Codex Live Sessions 行点击与耗时图 SVG 拉伸
### 复现
1. 打开 `#frame=codex&workspace=live-sessions`。
2. 会话列表项目名在窄左栏内被右侧 session id 挤压，点击 session id 文本会直接进入复制状态；预期点击行切换详情，右侧 session id 可压缩为“会话”按钮并执行复制。
3. 请求耗时趋势图在 SVG fallback 宽度阶段使用非等比 `preserveAspectRatio="none"`，导致 y 轴文字、底部序号、圆点和选中环被横向压扁或拉伸。

### 修复
1. `CodexLiveSessionFeed` 改为整行 `role="button"` 负责选择与键盘 Enter/Space 切换，session id 不再常驻占宽，复制动作收敛为右侧“会话”按钮。
2. 会话行 grid 改为 `minmax(0,1fr)_auto`，减少右侧固定宽度对项目名的挤压。
3. `TimingTrendChart` 的 SVG 改为 `preserveAspectRatio="xMinYMin meet"`；宽度未测量时使用固定 fallback px，测量后再切换为 `100%`，避免文字和圆点非等比缩放。

### 验证
1. `node --test src/features/codex-live-sessions/model.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `agent-browser` 打开 `http://127.0.0.1:5173/?preview=codex-live-sessions#frame=codex&workspace=live-sessions`：
   - 会话行只有 1 个“会话”复制按钮，点击行主体切换 `aria-expanded`。
   - 项目文本 `clientWidth === scrollWidth`，不再被截断。
   - 图表 SVG 为 `preserveAspectRatio="xMinYMin meet"`，圆点宽高一致。
4. 截图：`screenshots/20260602/codex/20260602-codex-live-sessions-after-v01.png`。

## Bug 010：Codex Live Sessions 有请求但无耗时图表
### 复现
1. 打开 `#frame=codex&workspace=live-sessions`，选中有请求记录的会话。
2. 详情页 Timeline 能看到请求行，但请求耗时趋势图可能显示空态。
3. 请求行右侧未显示 `TTFT`、首 token、流式耗时等 timing pills。

### 根因
1. 前端趋势图只在 request timing 至少存在一个大于 0 的耗时值时显示数据；有 request 行不代表已有 timing。
2. Codex HTTP 请求的 `UsageReporter` 已采集 `usage.Record.TTFT` 和 `Latency`，但 live session tracker 的 `ObserveCodexLiveUsage` 只把 token detail 传给 `fillTiming`。
3. `fillTiming` 不读取 `usage.Record.TTFT`，因此 HTTP 请求只可能得到粗略总耗时，`firstEventMs` / `firstTokenMs` / `streamDurationMs` 为空；历史请求或极快完成请求会表现为“有请求但图表无数据”。

### 修复
1. 新增 `fillTimingFromUsageRecord`，在 `ObserveCodexLiveUsage` 更新既有 request 或创建 HTTP completed session 时统一接入。
2. `record.Latency` 映射为 `totalDurationMs`，`record.TTFT` 同步映射为 `firstEventMs` 和 `firstTokenMs`，并补算 `streamDurationMs`。
3. 输出速率和总 token 速率基于修正后的 `totalDurationMs` 重新计算，避免继续使用 wall-clock 误差。

### 验证
1. `go test ./internal/gettokenshooks -run 'TestLiveSessions(ObserveUsageRecordCreatesHTTPCompletedSession|TimingSummary|RouteReturns|ObserveUsageRecordUpdates)' -count=1`
2. `go test ./internal/gettokenshooks -count=1`
3. `go build -o test-output ./cmd/server`
4. `./scripts/ensure-sidecar.sh darwin arm64`

## Bug 011：sync_model_catalog 把展示名写成请求模型
### 复现
1. 在 Status 页开启 `sync_model_catalog` 并应用到本地 Codex。
2. 重启 Codex 后选择 GPT 系列模型，例如 `GPT 5.5 high`。
3. 请求失败为 `unknown provider for model GPT 5.5`；本地 `~/.codex/gettokens-model-catalog.json` 中 `slug` 被写成 `GPT 5.5` 这类展示名。

### 根因
`OpenAICompatibleModel.Alias` 同时承载 route alias 和 display alias。catalog projection 无条件使用 `Alias` 作为 Codex static catalog `slug`，把 sidecar / `models_cache.json` 来源的 `display_name` 当成请求模型发送；sidecar registry 注册的是 `gpt-5.5` 等真实 model id，因此返回 unknown provider。

### 修复
1. `internal/wailsapp/codex_model_catalog_projection.go`：带空白字符的 alias 只作为 `display_name`，`slug` 使用 `Name`；不带空白的 alias 继续作为 Codex-facing route alias。
2. `frontend/src/features/status/model/relayModelCatalog.ts` 和 `StatusPanels.tsx`：`sync_model_catalog` 预览使用相同 slug 规则。
3. 新增 Go / Node 回归测试，覆盖 `GPT 5.5` 展示名不再成为请求 slug，并保留 `deepseek` route alias。

### 验证
1. `go test ./internal/wailsapp -run 'TestBuildGetTokensCodexModelCatalog|TestApplyRelayServiceConfigToLocalV2.*ModelCatalog|TestEnableGetTokensCodexModelCatalogProjection|TestDisableGetTokensCodexModelCatalogProjection' -count=1`
2. `go test ./internal/wailsapp -count=1`
3. `node --test frontend/src/features/status/tests/relayModelCatalog.test.mjs frontend/src/features/status/tests/statusTypography.test.mjs`
4. `npm --prefix frontend run typecheck`

### 运行态提示
既有 `~/.codex/gettokens-model-catalog.json` 不会自动热刷新。修复版本生效后，需要重新执行本地 Codex apply 或关闭再开启 `sync_model_catalog`，然后重启 Codex；临时回滚可移除 `~/.codex/config.toml` 顶层 `model_catalog_json`。

## Bug 012：openai-compatible account-store alias 未还原为上游模型名
### 复现
1. 创建 active openai-compatible DeepSeek 账号，模型配置为 `name=deepseek-v4-flash`、`alias=ds-test-flash`。
2. 通过 GetTokens relay 发起 `/v1/responses`，请求体 `model=ds-test-flash`。
3. sidecar 能选中 DeepSeek auth，但 DeepSeek 上游返回 400：只支持 `deepseek-v4-pro` 或 `deepseek-v4-flash`，不接受 `ds-test-flash`。

### 根因
进入 SQLite account-store 运行态后，openai-compatible 模型定义已经写入 `auth.Attributes["openai_compat_models"]`，但请求执行前的 alias pool 仍只读 `config.OpenAICompatibility`。因此 account-store openai-compatible alias 只参与路由选择，没有在传给 executor / 上游前还原成真实模型名。

### 修复
1. `sdk/cliproxy/auth/oauth_model_alias.go` 新增 `openai_compat_models` JSON 解码入口。
2. `sdk/cliproxy/auth/conductor.go` 在 `resolveOpenAICompatUpstreamModelPool` 中优先消费 auth attribute 的模型映射，再回退 config。
3. 新增 `TestManagerExecute_OpenAICompatAccountStoreAliasResolvesUpstreamModel`，覆盖 `ds-test-flash -> deepseek-v4-flash`。

### 验证
1. `go test ./sdk/cliproxy/auth -run TestManagerExecute_OpenAICompatAccountStoreAliasResolvesUpstreamModel -count=1`
2. `go test ./sdk/cliproxy/auth ./sdk/cliproxy ./internal/watcher/synthesizer -count=1`
3. `go test ./... -count=1`
4. `./scripts/ensure-sidecar.sh darwin arm64`
5. 临时 sidecar + 临时 account-store 真实 DeepSeek 请求：`model=ds-test-flash` 返回 HTTP 200，响应 `model=deepseek-v4-flash`，文本“DeepSeek alias 修复成功。”

## Bug 013：DeepSeek 不支持 Codex WebSocket，必须触发 HTTP fallback
### 复现
1. Codex TUI 在 `/model` 中选择 `deepseek-v4-flash high`。
2. 发起 prompt 后，Codex 仍保持 `/v1/responses` WebSocket transport。
3. Proxyman 看不到 `api.deepseek.com` 请求；sidecar 日志显示 downstream WebSocket 仍在运行。

### 根因
DeepSeek openai-compatible 只支持 HTTP Chat Completions，不支持 Codex WebSocket。sidecar 之前允许 downstream WebSocket 连接后再内部转 SSE/HTTP，这会阻止 Codex 客户端触发自己的 HTTP fallback，也会让用户误以为 DeepSeek 已经通过 WSS 路由。

### 修复
1. WebSocket handler 在首条 `response.create` 模型可识别后，若该模型对应可用 openai-compatible auth 且 auth 不允许 WebSocket，主动关闭 downstream WebSocket。
2. close code 使用 `1003`，原因包含 `retry over HTTP`，让 Codex 客户端切换到 HTTP `/v1/responses`。
3. Codex OAuth / Codex API key 的 WSS 能力保持不变。

### 验证
1. `go test ./sdk/api/handlers/openai -run TestResponsesWebsocketClosesForOpenAICompatibleHTTPFallback -count=1`
2. `go test ./sdk/api/handlers/openai ./sdk/cliproxy/auth ./sdk/cliproxy ./internal/watcher/synthesizer -count=1`
3. `go test ./... -count=1`
4. dev 临时 sidecar + 临时 openai-compatible DeepSeek 账号：带 Authorization 的 WSS 首包 close `1003`；随后 HTTP `/v1/responses` 返回 HTTP 200，文本“DeepSeek HTTP fallback 成功。”

## Bug 014：添加第三方厂商账号配置页仍像旧表单

### 现象
账号池右上角主添加入口文案过泛，配置页进入厂商账号配置态后 endpoint 在凭据前方，API Key 使用密码输入，额度/余额配置仍是裸 textarea，和账号详情页的 cURL 配置体验不一致。

### 修复
1. `accounts.add_account` 文案调整为“添加第三方厂商账号”，英文为 `Add Third-Party Provider Account`。
2. `UnifiedComposeModal` 配置态模块顺序改为：凭据 -> endpoint -> 额度 cURL -> 余额 cURL。
3. API Key 输入使用明文输入，并增加测试标记锁定不回退为 password。
4. 额度/余额配置复用账号详情的 `AccountCurlEditorModal`、empty state 和 script-card 结构；添加页只配置 curl，不在此处做实时额度/余额测试。

### 验证
```bash
node --test frontend/src/features/accounts/tests/accountHeaderMenu.test.mjs frontend/src/features/accounts/tests/accountDetailLayout.test.mjs
npm --prefix frontend run typecheck
npm --prefix frontend run build
```
