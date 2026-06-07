# Project Account Candidate Pool Rule

## 背景

用户希望新增一条路由规则：同一个项目只能在固定的几个账号中进行路由，而不是进入某个 channel 的整个账号池。

当前 GetTokens 路由内核已经完成一次收敛：`projectBindings`、`project fallback`、`project route mode` 等 legacy 语义已从 channel routing 主路径移除，现有执行模型明确为：

1. 先构建可路由账号池。
2. 再在账号池内执行 `sequential` 或 `balanced`。

因此这次需求不能简单恢复旧 `projectBindings` 字段，而应重新定义为 sidecar route engine 的“账号候选池规则”：规则对象是进入 selector 之前的 account candidate pool，不是 project route mode，也不是一套独立项目路由系统。

同时，这轮需求要把 `projectBindings` 明确定义为待删除的 legacy 模型：后续方案、实现、DTO、配置存储、前端表单和 explain 语义都不再以它为承载形式。

## 目标

1. 调研“项目仅允许固定账号集合参与路由”在当前账号候选池架构中的合理落点。
2. 明确该能力与 legacy `projectBindings` 的区别，避免把已删除的旧模型重新带回主路径。
3. 把“删除 `projectBindings` 作为需求约束”写入本 space，作为后续实现的明确边界。
4. 产出一份可执行的推荐方案，供后续实现前拍板。

## 需求冻结摘要

1. 主概念命名为 `Project Account Candidate Pool Rule`，中文为“项目账号候选池规则”。
2. 规则对象是进入 selector 前的 account candidate pool，不是 project route mode，不是 project scope 模型，也不是 legacy `projectBindings` 复活。
3. 首版规则只支持 `projectKey + channel + allowAccountIDs + enabled`，不支持 deny、weight、canary、prefer、fallback 或 route mode override。
4. 命中规则后执行 strict allow：只保留 allow set 内账号；如果 allow set 内没有可路由账号，默认 fail closed，不回退到 channel 全池。
5. route mode 仍只有 `sequential / balanced`，selector 只能在候选池收窄之后执行。
6. `projectName` 只用于展示和审计；运行时匹配必须依赖稳定 `projectKey`。若首版只能派生 key，必须标记来源并允许用户确认或修正。
7. 规则变更属于候选池变化，必须推进 route snapshot / pool epoch，让 sticky 在下一条请求重新评估。
8. `projectBindings` 是待删除 legacy 模型：可写入口必须消失，历史输入只允许丢弃或迁移，不能继续写回。

## 项目命中规则冻结

首版项目命中采用 **source-prefixed stable project key exact match**：

```text
rule.enabled == true
AND rule.channel == routeContext.channel
AND rule.projectKey in routeContext.projectIdentity.matchKeys
```

冻结规则：

- 不按 `projectName` 命中；`projectName` 只用于展示和审计。
- `projectKey` 必须带来源前缀，不保存裸 slug。首版 Codex 推荐 `workspace:<sha256(normalized_abs_path)>`。
- Codex 单 workspace 请求可生成 strong `projectKey`；多 workspace 默认不命中，不 fail closed。
- 无稳定 `projectKey` 时不命中，不 fail closed，继续现有 channel routing。
- 冲突命中多条 enabled rule 时 fail closed，返回项目规则冲突错误。
- 不支持 path prefix、fuzzy match、wildcard、fallback project，也不接受外部 header 指定 project key。

## 执行进展

2026-06-07 已完成后端与 Wails bridge 首段实现：

1. sidecar `gettokenscodex.RequestContext` 与 `gettokensrouting.RouteContext` 已补齐 `ProjectKey / ProjectName / ProjectKeySource / ProjectKeyConfidence / ProjectMatchKeys`。
2. Codex `X-Codex-Turn-Metadata.workspaces` 已作为首版项目身份来源：单 workspace 生成 `workspace:<sha256(filepath.Clean(abs_workspace_path))>`，置信度为 `strong`；多 workspace 标记 `ambiguous`，不触发 fail closed。
3. sidecar 已新增 `project-candidate-pool` 路由 policy，并安装在 `PolicyStagePoolScope`：命中后 strict allow，冲突或无可路由交集 fail closed；无 key / ambiguous / 未命中只记录 not-evaluated 或 not-matched。
4. sidecar 已新增项目候选池规则管理 API：`GET / POST / PUT / DELETE /v0/management/gettokens/project-candidate-pool-rules`，保存 enabled rule 时校验 channel、source-prefixed `projectKey`、非空 `allowAccountIDs`、同一 `channel + projectKey` 唯一。
5. GetTokens 主仓已补 `internal/cliproxyapi` client、`internal/wailsapp` bridge、root `main.App` DTO / mapper，并重新生成 `frontend/wailsjs` 绑定，前端已有可调用方法与类型。
6. sidecar 路由热路径已改为读取项目候选池运行态快照：首次加载规则后不再每次请求读取 JSON 文件；管理 API 成功写入后刷新运行态快照。
7. 管理 API 的 create / update / delete 成功后会调用 `AuthManager.BumpSessionAffinityPoolEpoch()`，让 session affinity 在下一条请求重新评估候选池。
8. route explain / audit 已补项目候选池可见性：前端诊断区可展示 `matched / not-matched / no-project-key / ambiguous-project / no-routeable-account / conflict`，过滤原因也会显示项目候选池相关状态。
9. Codex 与 Claude Channel Routing 账号列表已接入 `ProjectCandidatePoolRulesPanel`：真实模式通过 Wails 生成绑定调用 `List/Create/Update/DeleteProjectCandidatePoolRule`，浏览器预览模式使用本地示例规则并支持点击规则预演。
10. 前端项目池规则模型已补 `projectKey` source-prefix 校验、allow account set 归一化、缺失账号展示和入口源码断言，避免后续只保留 bridge 却丢失可编辑入口。
11. 前端入口已调整为账号列表的独立 modal 页面：`请求模式` header 提供 `项目配置` 按钮，打开 `modal=project-config`；直接访问 `#frame=codex&workspace=account-list&modal=project-config` 或 `#frame=claude&workspace=account-list&modal=project-config` 可恢复同一项目候选池规则编辑页。
12. 项目配置 modal 已收敛为“从历史项目选择”：`projectKey` 是内部稳定路由键，`projectName` 只用于展示和审计，用户不再手填 `项目 key` 或 `显示名`。前端项目选项主来源改为会话历史与运行会话定期同步：Codex / Claude 会话管理从 `cwd` 派生 `workspace:<sha256(filepath.Clean(cwd))>` 稳定 key，Codex 项目配置打开时同时读取 live sessions 与 session history，Claude 项目配置打开时读取 session history；最近 route event 只作为兜底观测来源。没有可识别历史项目时显示空态并禁止创建规则。

当前实现已经进入真实路由执行链路，并补齐了“运行态快照 + pool epoch bump + explain 可见性 + 前端规则编辑入口”的核心闭环。后续如需继续加固，应优先做一次 dev Wails 桌面冒烟，确认真实 sidecar 下规则创建、规则预演和下一请求 sticky 重评估的端到端体验。

## 验证记录

2026-06-07 已通过以下聚焦验证：

```bash
go test ./internal/cliproxyapi ./internal/wailsapp -run 'TestProjectCandidatePool|TestRateLimitBridge|TestProjectCandidatePoolRuleClientCRUD' -count=1
go test . -run 'TestMapProjectCandidatePoolRule|TestMapChannelRoutingExplain|TestMapRateLimitState|TestChannelRoutingRootMapping' -count=1
go test ./internal/wailsapp -run 'TestExplainChannelRoutingProjectCandidatePool|TestExplainChannelRouting|TestChannelRouteEventLedger' -count=1
go test ./internal/wailsapp -run 'TestExplainChannelRoutingProjectCandidatePool|TestExplainChannelRoutingLoadsProjectCandidatePoolRulesFromManagementAPI|TestProjectCandidatePoolRuleBridgeCallsManagementAPI' -count=1
cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenscodex ./internal/gettokensrouting ./internal/gettokenshooks ./sdk/cliproxy/auth -count=1
cd docs-linhay/references/CLIProxyAPI && go test ./internal/gettokenshooks -run 'TestProjectCandidatePool|TestChannelRoutingPolicy|TestRateLimitManagementRoutes' -count=1
./scripts/wails-cli.sh generate module
node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs
npm run typecheck（frontend/）
rg -n 'ProjectCandidatePool|CreateProjectCandidatePoolRule|UpdateProjectCandidatePoolRule|DeleteProjectCandidatePoolRule|ListProjectCandidatePoolRules' frontend/wailsjs/go/main/App.d.ts frontend/wailsjs/go/main/App.js frontend/wailsjs/go/models.ts
./docs-linhay/scripts/check-docs.sh
```

2026-06-07 收尾审计补充：

- 自动化门禁已重新跑通：root mapper、Wails bridge、cliproxyapi client、sidecar policy / management routes、Codex workspace project identity、前端 channel-routing 模型与入口源码断言、TypeScript typecheck、docs-linhay 结构检查均通过。
- `projectBindings` 当前只保留在 legacy 丢弃测试、历史研发文档和 memory 中：前端 `normalizeChannelRoutingConfig` 会删除该字段，Wails explain 测试确认 project route mode 与 `projectBindings` 不再影响选择结果，sidecar `run_test.go` 仅把旧字段作为输入验证安装 hooks 后仍按新 channel routing 执行。
- 未发现新的 `projectBindings` 可写入口、Wails DTO、前端表单或 sidecar 管理 API；新规则独立存储在 `project-candidate-pool-rules/config.json`。

2026-06-07 dev Wails / dev sidecar 冒烟补充：

- 使用 `./scripts/wails-cli.sh dev` 启动仓库构建产物，进程归因为 `/Users/linhey/Desktop/linhay-open-sources/GetTokens/build/bin/GetTokens.app` 与 `/Users/linhey/Desktop/linhay-open-sources/GetTokens/build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`；正式版 `/Applications/GetTokens.app` 未被停止、修改或用于本次验证。
- dev sidecar `http://localhost:18317/healthz` 返回 `{"status":"ok"}`；未带 management key 访问管理 API 会返回 `missing management key`，管理鉴权仍生效。
- 对 dev sidecar 管理 API 完成临时规则 CRUD 冒烟：创建 `channel=codex`、`projectKey=manual:smoke-project-candidate-pool-*`、`allowAccountIDs=["smoke-account-non-routeable"]` 的 enabled rule 后，`GET ?channel=codex` 能查到目标规则；删除后 `afterDeleteHasTarget=false` 且规则数量恢复。
- 本次运行态 smoke 证明 dev Wails 启动的 dev sidecar 具备规则创建、查询、删除和清理闭环。真实上游请求命中项目规则、trace 观察、以及 sticky 下一请求重评估仍建议作为后续更高阶端到端场景。

2026-06-07 Wails explain bridge 加固补充：

- 新增 `TestExplainChannelRoutingLoadsProjectCandidatePoolRulesFromManagementAPI`，用 `sidecarRequest` stub 模拟真实 Wails management API：`ExplainChannelRouting` 先读取 `/accounts` 构建账号候选池，再读取 `/gettokens/project-candidate-pool-rules?channel=codex` 加载已保存规则。
- 验证项目上下文 `workspace:abc` 命中 enabled rule 后，explain 结果只保留 allow set 内账号，其他候选被标记为 `project-candidate-pool`，`ProjectCandidatePool` 输出 `matched / ruleID / before=3 / after=1`，并写入 steps。
- 这条测试补齐“规则 CRUD 已可用”和“纯函数 strict allow 已可用”之间的 Wails bridge 证据；仍未打真实上游模型请求。

2026-06-07 项目配置 modal 历史选择补充：

- 用户确认 `项目 key / 显示名` 不应由人手输：`projectKey` 属于内部稳定路由键，`projectName` 属于展示/审计字段，规则配置入口应从观测历史中选择项目。
- 前端新增 `buildProjectCandidatePoolProjectOptions`，合并已配置规则与最近 `ListChannelRouteEvents` 中的项目身份；同一项目已配置规则的身份信息优先，历史事件只刷新最近出现时间。
- Codex / Claude 账号列表均把 `channelRouteEvents` 与已配置规则传入 `ProjectCandidatePoolRulesModal`，modal 中项目控件改为 `请选择历史项目` 下拉；没有可识别历史项目时显示空态，不再允许手填 `项目 key` 或 `显示名`。
- route event ledger 已保留 `ProjectKey / ProjectName / ProjectKeySource / ProjectKeyConfidence`，用于支撑“从历史选择项目”的前端数据源。
- 验证通过：`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/codex/codexAccountList.test.mjs frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`、`npm run typecheck`、`go test ./internal/wailsapp -run 'TestChannelRouteEventLedgerStoresRedactedShadowSummary|TestExplainChannelRouting' -count=1`、`git diff --check`、`./docs-linhay/scripts/check-docs.sh`。in-app browser 验证 `#frame=codex&workspace=account-list&modal=project-config`：无 `项目 key` / `显示名` 输入，项目下拉为空态时禁用。

2026-06-07 项目配置 modal 会话同步补充：

- 用户确认项目候选池下拉应从“会话历史和运行会话中获取，定期同步”，不能只依赖 route event。当前决策为：运行中 / 历史会话是主来源，route event 仅作为兜底项目身份来源。
- `internal/wailsapp/session_management.go` 已把 Codex `session_meta.cwd / turn_context.cwd` 与 Claude `cwd` 投影为稳定 `projectKey`，并同步到 project、session、detail DTO；`projectID` 仍只作为会话管理分组 slug，不进入项目候选池路由匹配。
- Codex 项目配置 modal 打开时每 15 秒同步 `GetCodexLiveSessionsSnapshot + GetCodexSessionManagementSnapshot`；live session 只有展示名时，会用同名历史会话的稳定 key 增强，无法找到稳定 key 的 live-only 项目不会进入可配置候选。Claude 项目配置 modal 打开时每 15 秒同步 `GetClaudeCodeSessionManagementSnapshot`。
- 前端 `buildProjectCandidatePoolProjectOptions` 排序调整为：已配置规则优先，其次运行会话、会话历史、route event；下拉会标注 `运行会话 / 会话历史 / 路由记录 / 已配置`，保存规则仍只写稳定 `projectKey`、展示 `projectName` 和 allow account set。
- 验证通过：`go test ./internal/wailsapp -run 'TestGetCodexSessionManagementSnapshotGroupsProjectsAndStatuses|TestGetCodexSessionDetailMasksSensitiveTextAndKeepsMessageRows|TestGetClaudeCodeSessionManagementSnapshotScansMainSessionsAndSkipsSubagents|TestGetClaudeCodeSessionDetailMasksMessagesAndToolPayloads' -count=1`、`go test . -run 'Test.*SessionManagement|TestMap.*SessionManagement|TestMapProjectCandidatePoolRule|TestMapChannelRoutingExplain' -count=1`、`node --test frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/codex/codexAccountList.test.mjs frontend/src/features/claude-code/claudeCodeAccountList.test.mjs`、`npm --prefix frontend run typecheck`、`git diff --check`。

## 路由系统校准后的推荐

这条需求必须沿用现有 `AccountRoutingEngine` 主链路：

```text
RouteContext Normalize
  -> AccountRoutingEngine.Route()
       -> CandidateProvider
       -> CompiledRouteSnapshot
       -> PolicyPipeline
       -> SelectorAdapter
       -> DecisionTrace
  -> Executor.Execute()
  -> ResultRecorder.MarkResult()
  -> RetryController
```

因此推荐不是“项目路由系统”，而是：

- 在 `RouteContext` 中补齐可审计的 `projectKey / projectName / projectKeySource`。
- 在 `CompiledRouteSnapshot` 中加入启用的项目账号候选池规则，让热路径不查 DB、不临时解析配置。
- 在 `PolicyPipeline` 的 `PolicyStagePoolScope` 执行 strict allow，输出 `DecisionStep` / explain / audit。
- 后续 `P2 RequestPolicy`、`P3 StickyPolicy`、`P4 Selector` 都只能在已经收窄后的候选池内工作。
- 规则保存后触发 snapshot / pool epoch 更新，交给 sticky 在下一条请求重新评估。

## 范围

- 调研现有 channel routing、route engine、session affinity、route guard 边界。
- 调研项目维度信号目前在产品中的可用来源。
- 给出推荐的数据模型、执行阶段、验收场景和风险边界。
- 明确列出需要删除或禁止回流的 `projectBindings` 残留语义。
- 首期执行覆盖 sidecar runtime policy、管理 API、Wails/root bridge、生成绑定、route explain/audit 可见性与 Codex / Claude 前端规则编辑入口。

## 非目标

- 不恢复 legacy `projectBindings`、`project fallback`、`weighted/canary/prefer` 等旧模式。
- 不允许把新需求包装成 `projectBindings` 字段改名或局部复活。
- 不触碰 `/Applications/GetTokens.app` 正式版或正式版运行数据。
- 本期不做移动端适配、不做用户可见设计稿、不触碰正式版应用或正式版配置。

## 验收标准

1. `README.md` 明确记录需求背景、目标、范围与非目标。
2. `plans/` 下至少有一份调研文档和一份需求设计文档，说明推荐方向、反对方向、用户场景、规则语义和关键风险。
3. 明确回答下面三个问题：
   - 项目级账号候选池规则应该落在 route engine 哪一层？
   - 应该使用“allow account set”还是恢复旧 `projectBindings`？
   - 它与 session affinity、route guard、channel routing 的交互边界是什么？
4. 明确把 `projectBindings` 写成待删除/禁止回流的 legacy 模型，而不是“可选兼容路径”。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 流程图与截图

- [项目账号候选池规则流程图 PNG](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/screenshots/20260606/project-account-candidate-pool-rule/20260606-project-account-candidate-pool-rule-flowchart-baseline-v01.png)
- [项目账号候选池规则流程图 SVG 源文件](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260606-project-account-candidate-pool-rule-flowchart.svg)
- 生成方式：确定性 SVG 绘制后导出 PNG，便于后续按需求变更继续维护和 diff；未使用随机图片生成。

## Worktree 映射

- branch：`feat/20260606-project-account-candidate-pool-rule`
- worktree：`../GetTokens-worktrees/20260606-project-account-candidate-pool-rule/`

## 下一步执行入口

1. 做一次真实请求端到端验收：发起带 Codex workspace metadata 的请求，命中项目规则，观察 sidecar route trace，并确认 sticky 下一请求重新评估。
2. 若后续运行会话仍无法提供稳定 `projectKey`，优先在 live session identity 中补 cwd-derived key，而不是恢复手填 `projectKey`。

## 相关链接

- [Account Routing Engine 技术边界](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md)
- [Sidecar Route Policy（历史文档）](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260513-sidecar-route-policy.md)
- [Codex Model Catalog Projection Plan](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260602-codex-model-catalog-projection-plan.md)
- [Channel Routing 前端测试](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/channel-routing/tests/channelRouting.test.mjs)
- [Project Account Candidate Pool Rule 调研](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260606-project-account-candidate-pool-rule-research.md)
- [Project Account Candidate Pool Rule 需求设计 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260606-project-account-candidate-pool-rule-requirements-v01.md)
- [Project Account Candidate Pool Rule 技术证据 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260606-project-account-candidate-pool-rule-technical-evidence-v01.md)
- [Project Match Rule v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260607-project-match-rule-v01.md)
- [项目账号候选池规则流程图](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/screenshots/20260606/project-account-candidate-pool-rule/20260606-project-account-candidate-pool-rule-flowchart-baseline-v01.png)

## 当前状态
- 状态：frontend-session-project-sync-tested
- 最近更新：2026-06-07
