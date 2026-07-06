# 账号详情页 UI 改造

## 背景
`#frame=accounts` 已经有浏览器预览数据，但账号详情弹层仍存在两个问题：

1. API Key 详情的凭据编辑区被压在半宽卡片里，验证区和输入区显得拥挤。
2. 浏览器预览模式缺少部分详情级测试数据，例如 API Key 可选模型、auth-file 原文摘要和模型目录，导致 UI 验收无法覆盖真实详情状态。

## 目标
1. 改造账号详情页 UI，让关键编辑区更像稳定的工作台面板。
2. 在 `http://localhost:5173/#frame=accounts` 浏览器预览下补齐详情测试数据。
3. 保持现有账号详情 hash、保存、验证、限流规则和 quota/billing 业务闭环不变。

## 范围
1. `frontend/src/features/accounts/` 下的账号详情组件、preview data 与 focused tests。
2. 本 space 下的验收截图和文档记录。

## 非目标
1. 不改 sidecar / Wails 账号加载协议。
2. 不合并 OpenAI-compatible、Codex、Claude Code 三类详情 controller。
3. 不重做账号列表卡片视觉。

## 验收标准
1. 打开 `http://localhost:5173/#frame=accounts&detail=codex-api-key%3Astable-001`，API Key 详情展示全宽凭据/验证工作区，模型下拉有浏览器预览数据。
2. 打开 `http://localhost:5173/#frame=accounts&detail=auth-file%3Acodex-pro.json`，auth-file 详情展示预览内容状态和模型目录，不依赖 Wails。
3. 账号详情关闭仍清理 `detail` hash，不出现二次弹回。
4. Quota / Billing 的 curl 编辑弹窗中，默认变量按钮在 textarea 有光标时插入到光标处；无光标时显示复制并复制变量 token。
5. Quota / Billing 的 curl 编辑弹窗支持独立 URL 路由：`script=quota` / `script=billing` 可直接打开对应弹窗，关闭弹窗只回到账户详情页。
6. focused unit tests、`typecheck` 通过；浏览器截图落入本 space。

## 设计稿入口

- 本期设计稿：`account-detail-account-types-v27.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260529-account-detail-ui`
- worktree：`../GetTokens-worktrees/20260529-account-detail-ui/`

## 相关链接
- `screenshots/20260529/accounts/20260529-accounts-detail-web-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-detail-curl-modal-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-curl-editor-variable-insert-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-detail-authfile-after-v01.png`

## 当前状态
- 状态：v09-consolidated-ready-for-implementation
- 最近更新：2026-06-05


## 2026-06-04 Open Design 全量模块状态稿

- 新增/修正设计稿：`account-detail-full-module-state-board-v01.html`
- Open Design artifact：`gettokens/account-detail-existing-frontend-module-state-board-v01.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 纠偏：该稿不按线上截图复刻，而按仓库现有前端组件与业务流梳理账号详情页。
- 主板覆盖 `OpenAICompatibleDetailPanel`：Modal Frame、Header + Verify Summary、Endpoint、Model Fetch Credentials、Proxy Route、HTTP Headers、Model Catalog、Connection Verify、Rate Limit Rules、Error Notice、Footer / Save Gate。
- 附板覆盖 `UnifiedAccountDetailModal` 差异：API Key 的 Credential/Verify、Quota、Billing、Curl Modal，以及 Auth-file 的 actions/models/reauth。
- 组织方式：垂直方向为现有模块，横向方向为业务状态（空闲/已保存、编辑 dirty、拉取/验证中、成功/已应用、错误/受阻），便于后续设计修改与状态覆盖检查。

## 2026-06-04 账号详情页重新设计 v02

- 新增设计稿：`account-detail-redesign-v02.html`
- Open Design artifact：`gettokens/account-detail-redesign-v02.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 设计 brief：`plans/20260604-account-detail-redesign-brief.md`
- 设计方向：从长表单改为三栏 Provider Control Workbench。左侧 Identity Rail 负责账号身份与验证摘要，中间 Configuration Stack 负责 endpoint/headers/model catalog，右侧 Run Inspector 负责验证/proxy/rate-limit/evidence，底部 Command Bar 负责保存门禁。
- 状态覆盖：ready、dirty edit、loading、blocked error；HTML 内可用顶部状态按钮切换。
- 业务边界：验证读取当前 draft 但不自动保存；远端模型与本地模型必须标识来源；proxyRouteError 保持保存阻断最高优先级；rate-limit dirty 仍由 footerMessage 汇总。

## 2026-06-04 不同账号类型完整模拟稿 v03

- 新增设计稿：`account-detail-account-types-v03.html`
- Open Design artifact：`gettokens/account-detail-account-types-v03.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 在 v02 的 Provider Control Workbench 基础上，模拟不同账号类型的完整详情差异。
- 覆盖账号类型：OpenAI-compatible、Codex API Key、Codex Auth-file/OAuth、Claude Code、Token Plan split credential。
- 覆盖状态：ready、dirty、loading、error；HTML 顶部可组合切换账号类型与状态。
- 设计结论：保持统一的 Identity Rail / Configuration Stack / Run Inspector / Command Bar 骨架，不同账号类型只替换合法模块，避免每类账号形成完全不同的详情页。

## 2026-06-04 不同账号类型低嵌套模拟稿 v04

- 新增设计稿：`account-detail-account-types-v04.html`
- Open Design artifact：`gettokens/account-detail-account-types-v04.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 根据反馈“卡中卡太多、宽度不够触发压缩、文字太多”，将 v03 三栏工作台改为低嵌套宽行结构。
- 新结构：顶部摘要条 + 全宽 band row 分段 + 底部 Command Bar；不再常驻右侧 inspector，不再在窄列里放嵌套卡片。
- 覆盖账号类型仍为 OpenAI-compatible、Codex API Key、Codex Auth-file/OAuth、Claude Code、Token Plan；覆盖状态仍为 ready、dirty、loading、error。

## 2026-06-04 不同账号类型对齐修正版 v05

- 新增设计稿：`account-detail-account-types-v05.html`
- Open Design artifact：`gettokens/account-detail-account-types-v05.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 根据反馈继续修正：左侧索引宽度统一，固定头部重新设计，验证与限制模块重新设计，身份与凭据模块重新设计，请求配置与其他模块对齐，余额/额度独立为第 05 分段并提供配置入口。
- Claude Code 不再作为本稿主账号类型；原因是它属于 Claude channel/local CLI/OAuth 账号域，和当前 OpenAI-compatible/Codex 账号详情不是同一组主编辑语义，后续可单独出 Claude channel 详情稿。
- 当前主类型：OpenAI-compatible、Codex API Key、Codex Auth-file/OAuth、Token Plan。

## 2026-06-04 头部不截断修正版 v06

- 新增设计稿：`account-detail-account-types-v06.html`
- Open Design artifact：`gettokens/account-detail-account-types-v06.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 针对反馈“Token Plan / Split Credential、Codex Auth-file / OAuth、Codex API Key Account、OpenAI-Compatible Provider 头部区域下方被截断”，重做固定头部。
- 新头部结构：第一行 `head-bar` 只放系统命令、detail hash、frame 和关闭；第二行 `head-context` 分区展示账号名、可换行类型名、短指标与最近验证。长类型名称不再单行截断。

## 2026-06-04 请求配置对齐修正版 v07

- 新增设计稿：`account-detail-account-types-v07.html`
- Open Design artifact：`gettokens/account-detail-account-types-v07.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 针对反馈“请求配置模块没和其他模块统一”，重做第 02 段请求配置。
- 新结构：请求配置使用和其他模块一致的 `fields` 网格；`Header Mode`、`Proxy Mode`、`Request Route`、`Headers`、`Proxy URL` 均为同级字段；模块操作统一沉到底部动作行，不再在 Proxy 字段内混排按钮组。

## 2026-06-04 请求配置左右结构修正版 v08

- 新增设计稿：`account-detail-account-types-v08.html`
- Open Design artifact：`gettokens/account-detail-account-types-v08.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 针对反馈“02 请求配置为什么是上下结构，其他模块都是左右结构”，将请求配置改为左右 split。
- 新结构：左侧为 Header Mode / Header Count / Request Route / Headers；右侧为 Proxy Mode / Proxy URL / Route Status / Actions。保持低嵌套，不恢复卡中卡。

## 2026-06-04 配色修正版 v09

- 当前打开文件 `account-detail-account-types-v08.html` 已直接更新为新配色，刷新 file URL 可查看。
- 另存归档稿：`account-detail-account-types-v09.html`
- Open Design artifact：`gettokens/account-detail-account-types-v09-palette-fixed.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正点：从偏米黄工业纸底改为 GetTokens 浅色工作台配色：`#ffffff` 主面、`#f9f9f9` 页面/工作区、`#f0f0f0` surface、黑色边框、`#666666` 弱文本，状态色使用项目 token 对应的 success/warning/danger/blue。
- 保留 v08 的低嵌套、头部不截断、请求配置左右结构。

## 2026-06-04 Split Credential 命名修正版 v10

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：顶部 `Token Plan` 标签改为 `Split Credential`。
- 另存归档稿：`account-detail-account-types-v10.html`
- Open Design artifact：`gettokens/account-detail-account-types-v10-split-credential-label.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 纠正原因：`Token Plan` 不是 GetTokens 通用账号类型，只是某些 provider 的订阅/计划形态示例；真正需要表达的是“对话凭据与模型拉取凭据分离”的 `Split Credential` 账号配置形态。

## 2026-06-04 代理池选择逻辑修正版 v11

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：请求配置右侧不再提供 `Inherit` / `Direct` / 自定义 proxy URL。
- 另存归档稿：`account-detail-account-types-v11.html`
- Open Design artifact：`gettokens/account-detail-account-types-v11-proxy-pool-only.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正点：代理配置只允许从代理池选择节点；展示 `Proxy Pool Node`、只读 `Resolved URL`、只读 `Pool Status`，动作只保留“刷新代理池”和“测试所选节点”。

## 2026-06-04 验证区移除限流摘要修正版 v12

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 04 段移除 RPM / TPM / Dirty / Route 摘要和“编辑规则”入口。
- 另存归档稿：`account-detail-account-types-v12.html`
- Open Design artifact：`gettokens/account-detail-account-types-v12-verify-only.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：当前业务稿没有该 rate-limit 摘要信息，第 04 段只保留测试模型和执行验证动作。

## 2026-06-04 余额额度测试结果修正版 v13

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 05 段“余额与额度”支持测试动作，并在本模块内展示测试结果。
- 另存归档稿：`account-detail-account-types-v13.html`
- Open Design artifact：`gettokens/account-detail-account-types-v13-quota-billing-test.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正点：新增 `测试 Quota`、`测试 Billing`；结果字段改为 `Quota Test Result`、`Billing Test Result`；下方展示 `Last Quota Test`、`Last Billing Test`，覆盖 success/loading/error。

## 2026-06-04 模型两列列表修正版 v14

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 03 段模型列表从单列表格改为两列模型条目。
- 另存归档稿：`account-detail-account-types-v14.html`
- Open Design artifact：`gettokens/account-detail-account-types-v14-model-two-columns.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：模型较多时单列表格过高，会把后续验证和余额模块挤出首屏；两列布局保留模型名、alias/route、删除/只读动作，同时降低高度。

## 2026-06-04 顶部关闭按钮移除修正版 v15

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：移除头部 actions 区的重复 `Close` 按钮。
- 另存归档稿：`account-detail-account-types-v15.html`
- Open Design artifact：`gettokens/account-detail-account-types-v15-no-header-close.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：底部命令栏已有“放弃操作/关闭语义”，头部不再重复提供关闭按钮，避免操作分散。

## 2026-06-04 请求配置字段收窄修正版 v16

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 02 段左侧移除 `Header Mode`、`Header Count`、`Request Route`。
- 另存归档稿：`account-detail-account-types-v16.html`
- Open Design artifact：`gettokens/account-detail-account-types-v16-supported-request-fields.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：当前支持的是 `headersText` 自定义请求头和代理池节点选择；Header Count 是派生信息，Request Route 属于转发/sidecar 运行语义，不应作为账号详情可编辑字段展示。

## 2026-06-04 余额额度左右分栏修正版 v17

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 05 段“余额与额度”改为左右两栏，中间有明确分割线。
- 另存归档稿：`account-detail-account-types-v17.html`
- Open Design artifact：`gettokens/account-detail-account-types-v17-quota-billing-split.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 新结构：左侧 `Quota / 额度`，右侧 `Billing / 余额`；每侧各自包含 source、test result、配置、测试、last test log。

## 2026-06-04 头部紧凑重设计修正版 v18

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：头部从两行调试式信息区改为 74px 紧凑业务摘要。
- 另存归档稿：`account-detail-account-types-v18.html`
- Open Design artifact：`gettokens/account-detail-account-types-v18-compact-header.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正点：移除 `ACCOUNT DETAIL`、`detail=<account-id>`、`FRAME=ACCOUNTS`、`ACTIONS`、`Close` 等实现/重复文本；只保留账号名、类型、状态、Credential/Verify/Route/Balance 指标和最近验证。

## 2026-06-04 余额额度卡片模式修正版 v19

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 05 段“余额与额度”回到卡片模式。
- 另存归档稿：`account-detail-account-types-v19.html`
- Open Design artifact：`gettokens/account-detail-account-types-v19-balance-cards.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 设计指导：余额/额度不适合做 Source/Test Result 表单字段；应使用两张业务卡片：Quota 卡展示 remaining/percent/reset/test log，Billing 卡展示 total/granted/topped/test log。

## 2026-06-04 代理功能按现有支持收窄 v21

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：请求配置右侧只保留已支持的代理池节点选择与只读 resolved URL。
- 另存归档稿：`account-detail-account-types-v21.html`
- Open Design artifact：`gettokens/account-detail-account-types-v21-proxy-supported-only.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：现有 `AccountProxyRouteSection` 可读取已存 proxy pool 节点并选择保存其 URL；不在账号详情内提供刷新代理池、测速、增删节点。

## 2026-06-04 Custom Headers 高度自适应修正版 v22

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：`Custom Headers` textarea 使用真实换行与 autosize，高度按内容自适应。
- 另存归档稿：`account-detail-account-types-v22.html`
- Open Design artifact：`gettokens/account-detail-account-types-v22-headers-autosize.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：headers 内容少时固定高度造成请求配置左侧大面积空白；现在默认两行，内容增加时自动撑高。

## 2026-06-04 账号类型与模型映射整理 v23

- 当前打开文件 `account-detail-account-types-v08.html` 已直接整理：头部类型区改为通用 `账号类型 + 当前类型`，不再显示 `PROVIDER / OpenAI-Compatible Provider` 的重复表达。
- 模型区从普通两列列表改为 `Source Model → Alias / Route` 映射卡，强调模型映射关系，并将“新增模型”改为“新增映射”。
- 另存归档稿：`account-detail-account-types-v23.html`
- Open Design artifact：`gettokens/account-detail-account-types-v23-type-and-mapping.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）

## 2026-06-04 模型映射错位修正版 v24

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：第 03 段模型映射卡错位问题。
- 另存归档稿：`account-detail-account-types-v24.html`
- Open Design artifact：`gettokens/account-detail-account-types-v24-model-mapping-alignment.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正原因：类型切换规则 `.type-compatible .t-compatible { display:block }` 覆盖了映射卡的 grid 布局，导致 Source → Alias 卡片错位。v24 用更高优先级规则强制可见映射卡为三段式 grid，并在窄视口下回退单列。

## 2026-06-04 头部类型摘要整理 v25

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：头部中区从“账号类型 + 指标表格”改为上方标签组、下方文字描述。
- 另存归档稿：`account-detail-account-types-v25.html`
- Open Design artifact：`gettokens/account-detail-account-types-v25-header-tags-description.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 新结构：上方标签组显示类型、凭据、验证、路由、余额/额度；下方用一行描述当前账号类型的能力边界，并用分割线区分。

## 2026-06-04 头部真实标签样式修正版 v26

- 当前打开文件 `account-detail-account-types-v08.html` 已直接修正：头部摘要标签改成与 `READY` 一致的 pill/tag 视觉，而不是表格格子。
- 另存归档稿：`account-detail-account-types-v26.html`
- Open Design artifact：`gettokens/account-detail-account-types-v26-real-header-tags.html`（project `ec611e2c-8675-4375-b4f1-cd444ea6826e`）
- 修正点：`类型 / 凭据 / 验证 / 路由 / 余额额度` 使用独立边框 pill；下方仍保留文字描述与分割。


## 2026-06-05 v09 收敛稿与重构启动

- 新收敛设计稿：`account-detail-account-types-v09.html`。
- 执行计划：`plans/20260605-account-detail-v09-implementation-plan.md`。
- 本轮方向：按浏览器评论收敛账号详情页，不再继续在 v08 上叠加补丁；真实前端从低风险结构开始分片落地。
- 今日先做：Header 移除状态 pill、Auth-file 头部不显示文件名、验证区收窄为短消息验证、Footer 单行状态说明。
- 待确认事项已记录到执行计划，明天继续与用户对齐。

## 2026-06-05 真实前端 Balance 内部 rail 收敛

- 用户在真实预览 `http://localhost:5173/#frame=accounts&detail=codex-api-key%3Abilling-usd` 批注：`QUOTA / 额度追踪` 不应在 Quota pane 内单独占一列，应与测试按钮处于同一内容行。
- 已修改真实前端 `AccountDetailPrimitives`：band section 的右侧内容区会重置嵌套 module layout 为 `flow`，避免 Quota/Billing 作为子模块时继续继承 band 左侧 rail。
- Balance 区现在只保留外层 `Balance / 余额与额度` rail；内部 Quota 与 Billing 各自使用普通 header，标题与 `测试` / `测试余额` 按 pane header 对齐。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-balance-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过；Playwright DOM 断言确认 Balance 内 `data-account-detail-band-index` 只剩外层 1 个。

## 2026-06-05 账号详情页唯一页面收敛

- 用户明确要求：移除旧组件，全部切到新的组件上；账号详情页只能有一个页面，页面内允许按账号类型拼装不同组件。
- 已执行生产入口收敛：`AccountsFeature` 不再挂载 `OpenAICompatibleDetailModal -> OpenAICompatibleDetailPanel`；`acct_*` provider 详情也先解析为对应 `AccountRecord`，再统一打开 `UnifiedAccountDetailModal`。
- 已删除旧独立详情组件文件：`ApiKeyDetailModal.tsx`、`OpenAICompatibleDetailModal.tsx`、`OpenAICompatibleDetailPanel.tsx`。Storybook 和 design-system manifest 也不再注册这些旧详情页。`useOpenAICompatibleState` 同步剪掉旧 detail draft/save/verify 状态，只保留 provider 列表投影。
- 新增稳定 DOM 标记：真实账号详情 dialog 带 `data-account-detail-modal="unified"`，便于后续浏览器巡检确认没有第二套详情页混入。
- 无头 DOM 巡检代表：`codex-api-key:stable-001`、`codex-api-key:billing-usd`、`acct_doubao`、`acct_deepseek`、`acct_openrouter`。
  - 所有代表均为 1 个 `role="dialog"`。
  - 所有代表均为 1 个 `data-account-detail-modal="unified"`。
  - 所有代表均有 1 个 `data-account-detail-header="v09-compact"`。
  - 所有代表旧 marker `data-openai-compatible-detail` 均为 0。
  - 所有代表 footer 状态均为 1 行状态节点。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-unified-only-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/rateLimit.test.mjs src/features/design-system/storyCatalog.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Balance 子模块线条收敛

- 用户在 `acct_doubao` 详情页批注：Balance 内 `Quota / 额度追踪 / 测试` 子模块不需要上方实线，也不需要下方虚线。
- 已修正：`AccountDetailSection` 支持 `topBorder={false}` 与 `headerDivider={false}`；Balance split 内 Quota/Billing 子模块均关闭这两类线条。
- Quota/Billing 空态同步改为无边框轻量提示，避免空态 dashed box 顶边贴在 header 下方。
- 浏览器 DOM 验收：Quota/Billing 的 section top、header bottom、empty top border width 均为 `0px`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-balance-lines-removed-after-v03.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。


## 2026-06-05 Header 标签区间距收敛

- 用户在 `http://192.168.204.254:5173/#frame=accounts&detail=claude-relay.json` 批注：header 类型/凭据/验证/路由/余额标签行下方分割线不显示，并重新调整间距。
- 已修正：`AccountDetailHeader` 中部移除 description 行的 `border-t`，改用中部容器统一 `gap-1` 与上下 padding 控制间距。
- 浏览器 DOM 验收：`data-account-detail-header-description` 的 `borderTopWidth=0px`，中部 `gap=4px`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-header-spacing-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Header 账号名换行与左列对齐

- 用户在 `claude-relay.json` 详情页批注：header 左侧账号名需要支持换行，但宽度要和下方左侧模块 rail 对齐。
- 已修正：`AccountDetailHeader` 左列统一为 `10.5rem`，与 `AccountDetailSection` band rail 保持同宽；账号名移除 `truncate`，改为自然换行与 `overflow-wrap: break-word`。
- 浏览器 DOM 验收：header account width 与下方 band rail width 均为 `168px`；账号名 `white-space=normal`、`text-overflow=clip`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-header-name-wrap-after-v02.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Auth File 配置区 action bar 收敛

- 用户在 `claude-relay.json` 详情页批注：配置管理区右上角按钮放同一行，上方分割线取消。
- 已修正：`预览配置 / 下载配置 / 应用配置` 三个按钮统一进入 `AuthFileSummarySection` 的 section actions；内容区不再单独放应用按钮。
- `AccountDetailSection` band layout 增加 `bandActionDivider` 开关；该配置区关闭 action bar dashed divider。
- 浏览器 DOM 验收：三个按钮同一行，action bar `borderBottomWidth=0px`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-auth-config-actions-after-v02.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Quota/Billing 脚本控件提升到模块头部

- 用户在 `acct_116260d8-1996-4079-9e02-1c0d28b11a33` 详情页批注：Quota 脚本卡片中的 `启用额度 / 编辑脚本` 也放到模块头部。
- 已修正：Quota 有脚本时，`启用额度 / 编辑脚本 / 测试` 统一出现在 Quota header actions；脚本卡片只保留 curl 预览文本。
- 同步统一 Billing：有脚本时 `启用余额 / 编辑脚本 / 测试余额` 也在模块头部；无脚本仍显示 `添加`。
- 浏览器 DOM 验收：Quota header actions 三个控件同一行，body 中不再包含 `启用额度` 或 `编辑脚本`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-quota-actions-header-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Route Guard 规则行左右对齐

- 用户在账号详情页批注：Route Guard 规则行 `TOKEN 窗口限流 / 1H / 1M / 阻断` 的左右间距要和上方 dashed 线对齐。
- 已修正：`RateLimitRulesSection` 的规则行 surface 移除水平 padding，规则行外边界与上方 action divider 共用同一内容宽度。
- 浏览器 DOM 验收：actionBar 与 listitem 均为 `left=210/right=1222/width=1012`，listitem `paddingLeft=0px`、`paddingRight=0px`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-route-guard-row-align-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/rateLimit.test.mjs src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Credential/Connection 模块恢复左右布局

- 用户在账号详情页批注：Credential / Connection / Route 区域应该是左右布局，不应继续纵向堆叠。
- 已修正：`AccountCredentialVerifySection` 改为 `v09-split` 两栏；左栏 Credential，右栏 Connection + Route，右栏保留内部上下分隔。
- 浏览器 DOM 验收：两栏各 `498px`，left/right 同 top，右栏 `borderLeftWidth=2px`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-credential-split-after-v01.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 账号详情页模型映射模块补齐

- 用户追问“我的模型映射模块呢？”，确认此前真实账号详情的 module plan 只给 auth-file/OAuth 展示 `models`，API key / OpenAI-compatible 账号详情被漏掉。
- 已修正：`buildAccountDetailModulePlan({ credentialSource: 'api-key' })` 改为 `credentials -> models -> rate-limit -> quota -> billing`，模型映射位于凭据模块之后、Route Guard 之前。
- `CompatibleModelsSection` 从只读“模型目录”改为统一“模型映射”：
  - auth-file/OAuth 仍从 `GetAuthFileModels` / preview auth-file models 读取并只读展示；
  - API key / OpenAI-compatible 读取 `AccountRecord.models`，并在可保存账号中渲染 Source Model / Alias Route 两列输入；
  - 点击“添加映射”、编辑输入或删除行会更新账号详情 `ApiKeyConfigDraft.models`，底部保存统一提交。
- 保存链路同步补齐：`ApiKeyConfigDraft` 增加 `models`，Codex API key 通过 `UpdateCodexAPIKeyConfigInput.models` 保存；OpenAI-compatible 账号在同一 `UnifiedAccountDetailModal` 内通过 `UpdateOpenAICompatibleProviderInput.models` 保存，不再只是只读旧目录。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/rateLimit.test.mjs src/features/design-system/storyCatalog.test.mjs` 通过；`npm run typecheck` 与 `npm run build` 通过；`docs-linhay/scripts/check-docs.sh` 通过。

## 2026-06-05 Quota 脚本预览两行高度

- 用户在账号详情页 Balance / Quota 区批注：额度 curl 脚本预览不要压成单行，应显示 2 行高度。
- 已修正：`AccountQuotaSection` 的脚本预览从单行 `truncate` 改为固定两行容器，增加 `data-account-quota-script-preview="two-line"`，使用 `min-h-[2.75rem]`、`line-clamp-2`、`break-all` 保持长 curl 可读且不撑爆布局。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs` 通过；`npm run typecheck` 通过。

## 2026-06-05 Credential 模块内 Connection 归位

- 用户在账号详情页凭据区批注：短消息验证 `CONNECTION` 应属于左侧凭据模块，不应与右侧 `ROUTE` / 出口代理混在一起。
- 已修正：`AccountCredentialVerifySection` 的 v09 split 改为左侧 `credential-connection`、右侧 `route`；左侧包含 Credential 字段与 Connection 短消息验证，右侧只包含代理/出口路由。
- Connection 在左侧模块内部增加上分割线与 `pt-4`，保持 Credential 与短消息验证的层级分隔。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs` 通过；`npm run typecheck` 通过。

## 2026-06-05 Header 左侧显示账号类型

- 用户在账号详情页 header 左侧批注：该位置应显示账号类型，而不是账号名称（例如“公司 1”）。
- 已修正：`AccountDetailHeader` 左侧主块改为 `data-account-detail-header-account-type="true"`，固定展示账号类型：`CODEX API KEY`、`CODEX OAUTH` 或 `OPENAI COMPATIBLE`。
- 左侧主块不再调用 `resolveAccountPrimaryLabel(account)`，也不再作为账号名编辑入口；账号名称修改应落在配置/名称字段内。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs` 通过；`npm run typecheck` 通过。

## 2026-06-05 Credential 模块新增账号名称编辑

- 用户在真实账号详情页 Credential 区批注：`API 密钥 / 基础 URL / 前缀` 之前需要添加名称编辑输入框。
- 已修正：`AccountCredentialVerifySection` 在 Credential 字段组首位新增 `账号名称` 输入框，保持在左侧 Credential 模块内，位于 API 密钥之前。
- 保存链路同步：`ApiKeyConfigDraft` 增加 `label` 并纳入 dirty check；Codex API key 保存时先调用 `UpdateCodexAPIKeyLabel`，再保存凭据/路由/quota/billing/models；OpenAI-compatible 统一详情保存时将 `label` 作为 provider `name` 提交。
- 浏览器 preview fallback 同步更新 `displayName` / `provider`，避免无 Wails 预览中编辑名称后 UI 状态不一致。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/accountConfig.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/rateLimit.test.mjs src/features/design-system/storyCatalog.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 模型映射模块移除额外 dashed 分割线

- 用户在真实账号详情页模型映射模块批注：`添加映射` action 下方多了一条虚线分割。
- 已修正：`CompatibleModelsSection` 关闭 band action divider，保留模块空态自身的虚线边框，避免 header action 与空态之间出现双重 dashed 线。
- 回归测试：`auth-file compatible model catalog renders source-to-route mapping cards` 锁住模型映射 section 使用 `bandActionDivider={false}`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 Header 移除运行态摘要模块

- 用户在真实账号详情页 header 右侧批注：`LAST / RUNTIME / LATENCY` 模块需要移除。
- 已修正：`AccountDetailHeader` 从三栏改为两栏，仅保留左侧账号类型 rail 与中部类型/凭据/验证/路由/余额标签区；删除 `data-account-detail-header-last` 运行态摘要块，并移除中部右侧分割线。
- 回归测试：`real account detail header uses v09 compact two-column summary` 锁住两栏 grid，并断言不再渲染 `Last/runtime` 与 `Latency` 文案。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 模型映射补齐拉取与默认模型入口

- 用户在真实账号详情页模型映射模块批注：空态只有 `添加映射`，缺少拉取模型按钮与默认模型列表。
- 已修正：`CompatibleModelsSection` 的 header actions 补齐 `拉取模型 / 默认模型 / 添加映射` 三个入口：
  - `拉取模型` 使用当前账号详情 draft 的 `apiKey/baseUrl/headers` 调用 `FetchOpenAICompatibleProviderModels`，成功后把远端模型写入 `ApiKeyConfigDraft.models`；
  - `默认模型` 使用当前 `modelNames`、账号已有模型、vendor preset 建议模型以及 Codex API key fallback，填充可编辑模型映射；
  - 空态不再只显示“暂无模型映射”，会展示 `默认模型列表`，让用户能看到可快速应用的模型。
- 保存边界保持不变：拉取或默认填充都只更新详情 draft，仍由底部 `保存改动` 统一提交到 Codex API key / OpenAI-compatible 账号配置。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 默认模型列表收窄为当前映射源模型

- 用户在模型映射模块批注：默认模型列表里显示了 `CODEX-AUTO-REVIEW / GPT-*` 等全局 relay/Codex 模型，但这里应显示映射本身模型。
- 已修正：`resolveDefaultModelMappingNames` 不再读取传入的全局 `modelNames`，也不再给 Codex API key 硬编码 GPT fallback；默认列表只取当前账号已有 `models` 与当前 `baseUrl` 命中的 vendor preset `modelSuggestions`。
- 效果：当前账号是 MiMo / Token Plan 类映射时，默认列表只展示 MiMo source models；需要真实远端列表时使用 `拉取模型`，成功后写入当前 draft。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`npm run typecheck` 通过。

## 2026-06-05 模型映射行改为自然高度与双下拉输入

- 用户在模型映射模块批注：映射列表内部不应滚动，高度应由内部撑开；行内不需要显示 `SOURCE MODEL / ALIAS ROUTE` 文案；source model 侧应显示当前账号支持的模型，alias model 侧应显示本地全部模型列表并支持搜索和自定义输入。
- 已修正：模型映射 grid 移除 `max-h-40` 与 `overflow-auto`，列表自然撑高；移除每行可见 `Source Model` / `Alias / Route` 标签，仅保留可输入控件与箭头关系。
- 候选池拆分：
  - `sourceModelOptionNames` 来自当前账号已有模型、当前 draft 模型和当前映射源默认模型；
  - `aliasModelOptionNames` 来自 `localModelNames`，由 Accounts 页面传入本地全部 relay/model 列表；
  - 两侧仍使用 `datalist`，保留搜索建议和自定义输入能力。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 模型映射下拉触发修复

- 用户反馈：模型映射行的 source / alias 下拉框无法触发。
- 根因：该模块使用原生 `input + datalist` 实现下拉候选；原生 datalist 没有稳定的显式展开按钮，在当前 in-app/Wails 浏览器里点击输入框不一定打开候选面板，表现为“下拉框无法触发”。
- 已修正：模型映射行改用项目已有 `Combobox` 组件替代原生 datalist。`Combobox` 使用 portal 渲染下拉层，有明确 toggle 按钮，支持聚焦展开、输入过滤、点击选择和自定义输入。
- 候选边界保持：source 侧传 `sourceModelOptionNames`，alias 侧传 `aliasModelOptionNames`；仍然保持 source=当前账号支持模型、alias=本地全部模型列表。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 模型映射按钮反馈与左对齐修正

- 用户反馈：模型映射下拉文字需要左对齐；`默认模型 / 添加映射` 点击无明显反应，且“默认模型”概念不清。
- 根因：alias Combobox 继承了 `align="right"`，导致输入与菜单右对齐；`默认模型` 实际语义是“把当前账号支持模型写入映射 draft”，但按钮命名过抽象，且默认模型为空时 disabled 没有任何反馈；`添加映射` 新增空行时视觉反馈也弱。
- 已修正：
  - alias Combobox 移除右对齐，source / alias 下拉与输入统一左对齐；
  - `默认模型` 改名为 `填入支持模型`，空列表时不禁用，点击后提示“暂无当前账号支持模型，可先拉取模型或手动添加映射”；
  - `添加映射` 会优先填入当前账号支持模型中尚未使用的一项，并显示 `已新增映射：<model>`，没有候选时才新增空映射并提示可手动输入。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 Quota 测试窗口回显与单模块 Balance

- 用户在真实账号详情页 Quota 区批注：额度脚本测试成功后只显示 `OK - ... windows` 文本，没有把返回窗口渲染出来；同时无有效 Billing 时不应保留右侧空模块和添加入口，单模块状态下输入/脚本内容应回到左侧铺满。
- 已修正：`AccountQuotaSection` 将 `onTestQuotaCurl` 返回的 `windows` 归一化为 `QuotaDisplay`，测试成功时复用 `QuotaBars` 渲染 `QUOTA (TEST)` 窗口条；轻量 OK 状态文本保留为辅助反馈，但不再替代窗口显示。
- Balance 外壳改为条件布局：仅当存在实时 Billing 或已配置 `billingCurl` 时展示 `quota-billing` 左右等分；没有 Billing 时切为 `data-account-balance-panel="quota-only"`，只渲染 `quota-full`，不输出右栏和 full-height 分割线。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-quota-balance-after-v01.png`、`screenshots/20260605/account-detail/20260605-account-detail-quota-test-after-v02.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过；无头浏览器在 `#frame=accounts&detail=acct_116260d8-1996-4079-9e02-1c0d28b11a33` 上确认 `panel=quota-only`、无 divider，点击 `测试` 后出现 `QUOTA (TEST)` 与 5H/7D 窗口。

## 2026-06-05 Quota 单模块内部恢复左右区域与 Billing 添加入口

- 用户继续在真实账号详情页 Quota 脚本预览处批注：Balance 这一行仍应按左右两个区域组织，额度窗口在左侧，curl 脚本/配置预览放右侧；隐藏 Billing 后也必须有明确入口添加另一个模块。
- 已修正：`AccountQuotaSection` 内部新增 `data-account-quota-layout="split"`，左侧 `data-account-quota-pane="windows"` 渲染额度窗口/测试结果，右侧 `data-account-quota-pane="script"` 渲染两行高度的 curl 脚本预览。
- 已修正：无实时 Billing 且无 `billingCurl` 时，Balance header 展示 `添加余额模块`；点击后走现有 `billing` script route，临时恢复 `quota-billing` 左右布局并打开 `余额脚本` 编辑器，保存后由底部统一提交。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-quota-script-right-after-v03.png`、`screenshots/20260605/account-detail/20260605-account-detail-add-billing-module-after-v04.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过；无头浏览器确认脚本 pane 位于窗口 pane 右侧，点击 `添加余额模块` 后出现 Billing pane 与 `CURL EDITOR / 余额脚本`。

## 2026-06-05 Balance 左侧 rail 改为额度/余额模块勾选

- 用户在真实账号详情页 Balance 左侧 rail 批注：添加另一个 Balance 模块不需要放右上角按钮，应该直接在 `BALANCE / 余额与额度` 左侧区域添加两个勾选框。
- 已修正：`AccountDetailSection` 的 band rail 增加 `railControls` 插槽；`AccountBalanceSplitSection` 在左侧 rail 中渲染两个 checkbox：`额度模块` 与 `余额模块`。
- `额度模块` 勾选状态绑定 `configDraft.quotaEnabled`，勾选且无额度脚本时打开 `quota` 脚本编辑；取消勾选会关闭当前 quota 编辑路由。
- `余额模块` 勾选状态绑定实时 Billing 或 `configDraft.billingEnabled`；勾选时通过现有 `billing` script route 挂载 Billing pane 并打开 `余额脚本` 编辑器；右上角 `添加余额模块` 按钮已移除。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-balance-rail-checkboxes-after-v05.png`、`screenshots/20260605/account-detail/20260605-account-detail-balance-checkbox-add-billing-after-v06.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过；无头浏览器确认 rail controls 存在、右上角添加按钮为 false，勾选余额后 `panel=quota-billing` 且出现 `余额脚本` 编辑器。

## 2026-06-05 Balance rail checkbox 不触发脚本弹窗

- 用户在 Balance 左侧 `额度模块 / 余额模块` checkbox 批注：勾选时不要触发脚本弹窗，只显示模块即可。
- 已修正：`handleQuotaModuleToggle` 与 `handleBillingModuleToggle` 只更新 `quotaEnabled / billingEnabled` draft 状态；不再调用 `onOpenScriptEditor`。取消勾选时仍会关闭当前对应脚本路由，避免隐藏模块后保留悬挂编辑器。
- 结果：勾选 `余额模块` 只把 Balance 从 `quota-only` 切到 `quota-billing` 并显示右侧 Billing pane；如需配置脚本，用户再点击 Billing 模块内的 `添加 / 编辑脚本`。
- 验收截图：`screenshots/20260605/account-detail/20260605-account-detail-balance-checkbox-no-modal-after-v07.png`。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过；无头浏览器确认勾选余额后 `panel=quota-billing`、`billingPane=true`、`curlEditor=false`。

## 2026-06-05 Balance Quota split 细节收口

- 用户在真实账号详情页 Balance / Quota 区继续批注：
  - 单模块左右布局时，额度窗口下方不应再出现 `QuotaBars` 继承自账号卡的虚线分隔；
  - 右侧脚本预览框高度需要与左侧额度窗口区对齐；
  - `启用额度` 已被左侧 rail 的 `额度模块` checkbox 替代，模块 header 内不再重复显示。
- 已修正：
  - `QuotaBars` 增加 `showDivider`，账号卡默认保留分隔线，账号详情 Quota 明确传 `showDivider={false}`；
  - `AccountQuotaSection` split 布局下右侧 script pane 改为自伸展 grid，脚本卡片使用 `h-full min-h-[8.75rem]`，与左侧窗口区形成等高感；
  - Quota / Billing 模块 header 内移除 `启用额度 / 启用余额` checkbox，只保留 `编辑脚本 / 测试 / 添加`，模块显隐统一由 Balance 左 rail 控制。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/accounts/tests/accountCardLayout.test.mjs src/features/accounts/tests/openAICompatible.test.mjs src/features/accounts/tests/accountConfig.test.mjs`、`npm run typecheck`、`npm run build` 通过。

## 2026-06-05 Balance 模块三态与子模块 header 收口

- 用户继续批注 Balance 区：取消 `额度模块` 时 Quota 整块都不应显示；若只剩 `余额模块`，Billing 应按单模块形态展示，而不是保留左侧 Quota 空壳。同时 Quota 子模块 header 的 `QUOTA / 额度追踪 / 实时窗口 / 编辑脚本 / 测试` 排列过散。
- 已修正：Balance 内容拆为三态：
  - `quota-billing`：额度与余额都开启时左右等分；
  - `quota-only`：只开额度时显示 Quota 单模块；
  - `billing-only`：取消额度但保留余额时只显示 Billing 单模块，不再渲染 Quota section。
- 已修正：嵌套子模块 header 改为 compact title/action row，左侧标题组紧凑排列，右侧操作组统一右对齐，避免标题、meta、按钮分散成杂乱三行。
- 验证：`node --test src/features/accounts/tests/accountDetailLayout.test.mjs src/features/design-system/storyCatalog.test.mjs`、`npm run typecheck`、`npm run build`、`./docs-linhay/scripts/check-docs.sh` 通过。

## 2026-07-06 前端重构剩余项收口

- Auth-file 配置应用从占位 copy 改为真实 Wails 契约：新增 `ApplyAuthFileConfig(name, content)`，前端通过 `trackRequest('ApplyAuthFileConfig')` 写回账号数据库并刷新 auth-file metadata；配置区文案改为“写回账号数据库并刷新运行时配置”。
- Quota / Billing / Verify 区继续收窄内部嵌套：移除已失效的 `topBorder` / `headerDivider` 旧 props，避免后续误以为模块内部还保留 legacy band divider 控制。
- 新增浏览器巡检脚本 `docs-linhay/scripts/check-account-detail-preview.mjs`，覆盖 API key 凭据、API key 模型、auth-file 配置、auth-file 模型四条预览路径；截图落位 `screenshots/20260706/accounts/`。
- 验证：`go test ./internal/wailsapp -run 'TestApplyAuthFileConfig|TestUpdateAuthFilePriority'`、`node --test src/features/accounts/tests/accountDetailLayout.test.mjs`、`node docs-linhay/scripts/check-account-detail-preview.mjs`、`npm --prefix frontend run typecheck` 通过。
