# Codex 账号列表收尾整理与会话沉淀

日期：2026-05-14

## 背景

本期 `20260511-codex-account-list-tab` 已完成账号请求顺序、路由探测、模型映射、OAuth 透传语义和 openai-compatible 映射保存修复。进入收尾阶段后，重点从继续加功能切换为：

1. 整理大文件。
2. 拆分大数据结构。
3. 优化后续维护边界。
4. 提取本期可复用 skill 与 AGENTS 路由规则。
5. 记录用户偏好和工作流。

## 拆分结果

`frontend/src/features/codex/CodexAccountListFeature.tsx` 从大体量页面实现收敛为页面 controller，保留 Wails/browser 数据加载、顺序保存、路由探测调度、detail hash 同步和模型映射保存编排。

新增或明确的组件边界：

- `frontend/src/features/codex/components/CodexRouteProbeCard.tsx`
- `frontend/src/features/codex/components/CodexAccountOrderRow.tsx`
- `frontend/src/features/codex/components/CodexAccountDetailModal.tsx`
- `frontend/src/features/codex/components/ModelCombobox.tsx`
- `frontend/src/features/codex/components/codexAccountPresentation.ts`

新增或明确的模型边界：

- `frontend/src/features/codex/model/codexAccountList.ts`：账号合并、排序、优先级更新。
- `frontend/src/features/codex/model/codexModelMappings.ts`：OAuth/auth-file 与 openai-compatible 模型映射归一。
- `frontend/src/features/codex/model/codexRoutePolicy.ts`：路由候选过滤、账号行策略状态、终端式探测流。

## 稳定设计决策

1. 请求测试顺序只来自当前拖拽排序后的可请求账号列表。
2. 行内 `默认 / 允许 / 排除` 只过滤候选，不维护第二套排序。
3. OAuth/auth-file 默认按原始模型名透传；只有配置显式映射后才关闭透传。
4. openai-compatible 允许同一个真实模型映射多个 Codex alias，去重键为 `name + alias`。
5. 模型选择使用项目自定义 combobox，不使用原生 `datalist`。
6. 账号行主体负责打开详情；行内交互控件必须阻止冒泡。
7. 浏览器预览必须可用，缺少 Wails runtime 时不能空白。

## 本次沉淀

新增项目级 skill：

- `.agents/skills/gettokens-codex-account-list/SKILL.md`

该 skill 负责承载 Codex 账号列表的业务边界、前端结构、模型映射语义、路由探测语义、浏览器预览、UI 规则、Wails 边界、验证与文档写回要求。

已更新：

- `.agents/skills/gettokens-domain-engineering/SKILL.md`：在 Codex workspace 章节增加指向账号列表专用 skill 的路由说明。
- `AGENTS.md`：只新增项目级 skill 路由规则，不把账号列表细节写入全仓治理文件。

## 未纳入 AGENTS 的内容

以下内容是功能域细节，只写入 skill，不升级为 repo-wide 规则：

1. OAuth 映射默认透传。
2. 路由探测终端式日志。
3. 账号列表的具体组件文件名。
4. `gpt-5.4` 作为当前测试模型默认值。
5. 本期截图、端口和临时验收环境。

## 验证

本轮结构拆分后的验证门禁：

1. `npm run typecheck`
2. `npm run test:unit -- src/features/codex/codexAccountList.test.mjs`
3. `go test ./internal/wailsapp -run 'TestListOAuthModelAliases|TestUpdateOAuthModelAliases|TestProbeCodexAccountRouting|TestDetectCodexRoutingProbeHit|TestSidecarRelayRequest'`

文档和索引门禁：

1. `docs-linhay/scripts/check-docs.sh`
2. `qmd update`
3. `qmd embed`
