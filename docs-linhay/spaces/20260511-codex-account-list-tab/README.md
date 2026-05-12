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
- 不新增新的 sidecar 路由策略。
- 不恢复已移除的“请求编排”业务。
- 不在本期提供账号新增、删除、详情编辑；这些仍留在账号池入口。
- openai-compatible 模型映射允许在 Codex 账号详情 modal 内新增、删除和保存；更完整的 provider 基础信息编辑仍留在账号池入口。

## 验收标准
1. Given 用户进入 `Codex`，When 点击 `账号列表`，Then 页面展示 Codex 可请求账号总数、可用数量和 openai-compatible 数量。
2. Given 账号池中存在 Codex OAuth auth-file、Codex API Key 和 openai-compatible provider，When 打开账号列表，Then 三类账号都出现在同一请求顺序列表中。
3. Given 某账号被禁用或状态异常，When 查看列表，Then 该账号保留在顺序中但标记为不可请求。
4. Given 用户拖动账号调整顺序并保存，When 保存成功，Then 通过 `UpdateAccountPriority` 写回优先级，刷新后仍按新顺序展示。
5. Given openai-compatible provider 配置了模型 `{ alias, name }`，When 查看该账号详情，Then 模型映射显示为 `name -> alias || name`；当 alias 为空时显示 `name -> name`，并可新增、删除、保存映射。
6. Given sidecar 未 ready，When 打开账号列表，Then 页面显示等待 sidecar ready 的状态，不发起账号加载。
7. Given 在普通浏览器环境打开 `#frame=codex&workspace=account-list`，When 页面缺少 Wails runtime，Then 加载稳定预览账号并支持本地排序/启停交互，不抛出 Wails 绑定错误。
8. Given 用户打开 Codex 账号详情 modal，When URL hash 同步完成，Then 地址栏保留 `#frame=codex&workspace=account-list&detail=<account-id>`；When 关闭 modal，Then 只移除 `detail`，保留当前 Codex 账号列表 frame。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

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

## 当前状态
- 状态：implemented
- 最近更新：2026-05-12
