# 20260522-unified-account-detail-system

## 背景
账号详情目前分散在三套弹窗中：

- `UnifiedAccountDetailModal`：承载 auth-file / API key 账号详情。
- `OpenAICompatibleDetailModal`：承载 OpenAI-compatible provider 配置、模型与验证。
- `CodexAccountDetailModal`：承载 Codex / Claude Code 请求顺序详情与模型映射。

三者都在表达“账号资产详情”，但壳层、字段排布、footer 行为和模块语言不一致。后续账号类型继续增加时，重复弹窗会放大维护成本。

## 目标
1. 统一账号详情的视觉语言：同一壳层、同一 section 标题、同一字段网格、同一状态提示与 footer 风格。
2. 保留业务 controller 边界：Accounts / Codex / Claude Code 页面继续负责数据加载、保存、验证、模型拉取和错误处理。
3. 先通过共享 primitives 收敛 UI，再逐步演进到按 capability 组装模块，避免一次性大组件。

## 范围
1. 抽取账号详情共享 UI primitives。
2. 调整 `UnifiedAccountDetailModal`、`OpenAICompatibleDetailModal` / `OpenAICompatibleDetailPanel`、`CodexAccountDetailModal` 使用统一设计语言。
3. 保持 OpenAI-compatible provider、Codex route row、Claude Code route row 的原有保存和验证语义。
4. 详情页补齐卡片模式已有的运行信息：近期请求、总 token、cached token、平均延迟、quota 窗口、balance。
5. 更新相关设计系统收编记录与研发说明。

## 非目标
1. 不合并 Accounts / Codex / Claude Code 的页面 controller。
2. 不改 Wails 绑定、后端 DTO、sidecar 行为。
3. 不重做账号列表、路由探测、账号卡片。
4. 不引入新的弹窗导航层或跨页面全局状态。

## 验收标准
### 场景 1：普通账号详情
- Given 用户从账号池打开 auth-file 或 API key 账号详情
- When 弹窗展示
- Then 头部、内容 section、证据区和 footer 使用统一详情语言
- And API key 的保存、验证、额度、余额、限流能力保持可用
- And auth-file 的内容查看、sanitize、compatible models、重新授权保持可用
- And 详情页显示卡片模式已有的近期统计、额度窗口与 balance 信息
- And 失败态账号详情会直接展示 sidecar 返回的 `statusMessage`；若 sidecar 未返回具体原因，显示明确兜底提示
- And 运行快照与证据模块在顶部概览区并排展示，额度与余额在运行快照内部并排展示
- And 顶部运行快照与 evidence 模块在宽屏并排时保持等高
- And 详情 body 内的模块头部统一使用标准 eyebrow / title / meta / actions 结构
- And 宽屏详情弹窗内的编辑模块以卡片式多列展示，不退化为浪费空间的单列堆叠

### 场景 2：OpenAI-compatible provider 详情
- Given 用户打开 OpenAI-compatible provider 详情
- When 编辑名称、baseUrl、apiKey、headers、models 或 proxy
- Then 信息结构与账号详情一致
- And 拉取远程模型、应用模型、验证模型、限流规则、保存动作保持原语义
- And Endpoint、HTTP、连接验证等短模块可并列展示，模型列表和限流规则这类宽模块跨列展示

### 场景 3：Codex / Claude Code route row 详情
- Given 用户从 Codex 或 Claude Code 请求顺序列表打开详情
- When row 为可映射来源
- Then 模型映射区使用统一详情 section 与操作行
- And real model -> codex/claude model 的保存、空映射语义、错误提示保持不变
- And 被阻塞账号显示统一但醒目的阻塞原因
- And Codex 账号详情与排序卡片使用同一 quota 适配语义展示近期统计、额度和余额
- And Codex 账号详情的路由、状态、优先级和启用状态进入顶部 evidence 模块，与运行快照并排展示
- And Codex 模型映射的新增动作位于模块头部右上角，不再占用底部编辑区

### 场景 4：验证
- TypeScript 类型检查通过。
- Codex account list 单测通过。
- 账号相关纯模型单测通过。
- 文档结构校验通过，memory 与 qmd 已同步。

### 场景 5：路由守卫规则行内编辑
- Given 用户在账号详情或 OpenAI-compatible 详情中编辑路由守卫规则
- When 添加、修改、禁用或删除规则
- Then 限流模块与其他详情模块边距一致，不再绘制独立卡片或卡中卡
- And 每条规则的策略、窗口、限额、行为、启用状态、使用量和删除操作在同一行展示
- And 规则标签不再提供单独输入框，改为由窗口与策略自动生成
- And 每条规则不再有独立保存按钮，改动跟随页面 footer 保存
- And 窗口选项支持自然日 `00:00-23:59`

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260522-unified-account-detail-system`
- worktree：`../GetTokens-worktrees/20260522-unified-account-detail-system/`

## 相关链接
- 研发说明：`docs-linhay/dev/20260522-unified-account-detail-system.md`

## 实施记录
1. 新增 `AccountDetailPrimitives`，统一账号详情 section、section density、body、module grid、module stack、stat grid、field grid、pill、notice、empty state、evidence grid。
2. `UnifiedAccountDetailModal`、`OpenAICompatibleDetailModal` / `OpenAICompatibleDetailPanel`、`CodexAccountDetailModal` 已接入统一详情 primitives。
3. `CodexAccountDetailModal` 改为使用 `AccountDetailModalFrame`，因此 Codex 与 Claude Code 复用入口同步获得统一弹窗壳层。
4. `AccountProxyRouteSection` 作为三类详情共享模块，已统一到同一 section 语言。
5. 设计系统 manifest 已收编 `AccountDetailPrimitives`。
6. `RateLimitRulesSection` 改为 `AccountDetailSection` 内的单层横向规则表，不再自带分区边距、卡片容器、标签输入框或行内保存按钮。
7. 限流规则保存接入账号详情页面 footer：`UnifiedAccountDetailModal`、旧 `ApiKeyDetailModal` 与 `OpenAICompatibleDetailModal` 均通过同一保存入口提交规则草稿。
8. 前端与 CLIProxyAPI 本地参考源均加入 `calendar-day` 窗口，展示为 `00:00-23:59`，sidecar evaluator 按本地自然日 00:00 起计算请求/token 用量。
9. 新增 `AccountRuntimeSnapshotSection` 与 `accountDetailRuntime`，将卡片模式中的近期统计、quota、balance 以详情页 section 展示；`UnifiedAccountDetailModal`、`OpenAICompatibleDetailModal`、`CodexAccountDetailModal` 均接入。
10. Codex 排序卡片与 Codex 详情共用 `buildCodexQuotaSummaryAccount`，避免 quota 展示适配在卡片和详情中分叉。
11. `OpenAICompatibleDetailPanel` 改为 `AccountDetailBody` 单一内容流，并拆分 leading/trailing sections：运行快照优先展示，evidence 与限流规则保持详情模块化接入。
12. `CodexAccountDetailModal` 的模型映射保存从 section 内移到弹窗 footer，section 内只保留添加/删除行等局部动作。
13. `AccountModalComponents.stories.tsx` 的详情 section 示例改为运行快照 + module grid/side evidence 布局，并更新 manifest required states 覆盖 `runtime-snapshot` 与 `module-layout`。
14. `AccountDetailModuleStack` 新增 `layout="cards"`，详情弹窗宽屏下可用卡片式多列模块布局；`span="wide"` 用于限流规则、额度、余额、模型目录、auth content 等宽模块。
15. `UnifiedAccountDetailModal`、`OpenAICompatibleDetailPanel`、`CodexAccountDetailModal` 已接入 card-mode 布局，避免详情页主区域长期单列浪费空间。
16. 补齐 `CodexLiveSessionDetail`、`CodexLiveSessionFeed`、`CodexLiveSessionSummary` 的设计系统 manifest 记录，使新增 feature 组件不再沉默缺席。
17. `AccountDetailSectionHeader` 成为详情模块的标准头部渲染路径，`AccountDetailBody` 内不再按 flow/card 分别拼 header。
18. `AccountDetailOverviewGrid` 将 `AccountRuntimeSnapshotSection` 与 evidence 模块放到顶部并排；`AccountRuntimeSnapshotSection` 内部新增 `quota-balance` 资源网格，让额度与余额在宽屏并排。
19. `CodexAccountDetailModal` 新增 `CodexAccountEvidenceSection`，把原独立字段网格迁入顶部 overview evidence，与普通账号和 OpenAI-compatible 详情保持一致。
20. `AccountDetailOverviewGrid` 新增 equal-height 标记与 stretch slot，确保 `AccountRuntimeSnapshotSection` 与 `CodexAccountEvidenceSection` 等顶部 evidence 模块在宽屏并排时等高。
21. `CodexModelRoutingSection` 的新增模型按钮移入 section header actions，显示在模块右上角；底部只保留错误提示。
22. `UnifiedAccountDetailModal` 接入 `buildAccountDetailStatusMessage`，失败态账号在详情弹窗显示 `statusMessage` 或明确兜底原因，正常 / 禁用 / 本地草稿不显示错误条。
23. 2026-05-25 补齐 root Wails DTO 透传链路：`accountsdomain.AccountRecord.StatusMessage -> main.AccountRecord.statusMessage -> frontend/wailsjs -> AccountRecord`，修复账号详情只能显示“sidecar 未返回具体原因”的问题。

## 验证记录
- `node --test frontend/src/features/design-system/storyCatalog.test.mjs`：通过。
- `npm --prefix frontend run typecheck`：通过。
- `npm --prefix frontend run test:unit`：394 个测试通过。
- `npm --prefix frontend run build-storybook`：通过。
- `go test ./internal/gettokenshooks`（CLIProxyAPI）：通过。
- `git diff --check`：通过。
- `git -C docs-linhay/references/CLIProxyAPI diff --check`：通过。
- `docs-linhay/scripts/check-docs.sh`：通过。
- `qmd update`：GetTokens collection 新增 2 个文档、更新 1 个文档。
- `node --test src/features/accounts/tests/accountPresentation.test.mjs`：通过。
- `npm --prefix frontend run typecheck`：通过。
- `qmd embed`：完成 3 个文档的 embedding。
- 浏览器预览：`http://127.0.0.1:5173/#frame=accounts` 与 `#frame=codex&workspace=account-list` 已验证详情弹窗可打开；唯一 console error 为本地 `favicon.ico` 404，与本次改动无关。
- Storybook 静态预览：`AccountDetailSections` story 已验证 `AccountDetailOverviewGrid`、标准模块头部与 `quota-balance` 资源网格均渲染；唯一 console error 为本地 `favicon.ico` 404，与本次改动无关。
- Storybook 静态预览：`CodexAccountOrder Detail` story 已验证 `AccountDetailOverviewGrid`、`CodexAccountEvidenceSection`、`AccountRuntimeSnapshotSection` 均渲染；1440px 宽度下 runtime slot 与 evidence slot 并排且高度均为 `327.8515625px`，新增模型按钮位于 `CodexModelRoutingSection` 头部右上角，console 无错误。
- 2026-05-25：`go test ./...`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run test:unit -- src/features/accounts/tests/accountConfig.test.mjs src/features/accounts/tests/accountPresentation.test.mjs` 通过；新增 root mapper 回归测试和 generated Wails `AccountRecord.statusMessage` 断言。

## 截图归档
- `screenshots/20260522/accounts/20260522-accounts-detail-api-key-after-v01.png`
- `screenshots/20260522/accounts/20260522-accounts-detail-openai-compatible-after-v01.png`
- `screenshots/20260522/codex/20260522-codex-detail-route-row-after-v01.png`
- `docs-linhay/spaces/20260522-unified-account-detail-system/screenshots/20260522/accounts/20260522-account-detail-overview-header-after-v01.png`

## 当前状态
- 状态：implemented
- 最近更新：2026-05-22
