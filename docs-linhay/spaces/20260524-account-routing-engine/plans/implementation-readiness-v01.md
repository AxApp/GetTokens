# Account Routing Engine 实施准备清单 v01

日期：2026-05-25

## 实施入口

本 space 已进入 implementation-ready 状态。实施时以本文件作为每日入口，详细设计分别引用：

- [README](../README.md)：需求范围与验收标准。
- [实施计划 v01](./implementation-plan-v01.md)：sidecar / Wails / 前端总体阶段。
- [既有逻辑清理清单](./legacy-routing-cleanup-v01.md)：旧路由路径清理和兼容边界。
- [前端重做范围 v01](./frontend-rewrite-scope-v01.md)：前端页面重做范围。
- [技术边界](../../../dev/20260524-account-routing-engine.md)：架构边界与上游合并约束。

## 当前基线

已确认的产品边界：

1. `Account Inventory` 只管理账号、账号组、启停、弃用、基础排序和状态展示。
2. `Channel Routing` 由 Codex / Claude 账号列表分别负责，两个渠道配置互不影响。
3. `Routing Engine` 是 sidecar 执行层，读取账号池快照和渠道配置，产出 `RouteDecision + Trace`。
4. 新 GetTokens 路由模式只保留 `sequential / balanced / project`。
5. `dedicated / prefer / ordered / weighted / canary` 只作为上游兼容输入，不进入新 UI / Wails DTO / engine policy。
6. `exclude` 不是 route mode，只是请求级 deny 或 pool filter。
7. 项目模式只限定目标账号或账号组；命中组后仍通过 `sequential` 或 `balanced` 做组内选择。
8. 账号或有效组禁用立即生效，高于 session sticky、失败降级和 retry；已有流式连接在最近可控边界断开。
9. 账号或有效组激活只重新进入可路由账号池，等待下一轮 route / retry 选择，不抢占当前 stream / sticky。
10. 失败冷却状态必须持久化到运行态或 guard source；自动恢复只清对应 source，不清用户禁用。

## 分支与工作区

推荐执行环境：

```text
space: docs-linhay/spaces/20260524-account-routing-engine/
branch: feat/20260524-account-routing-engine
worktree: ../GetTokens-worktrees/20260524-account-routing-engine/
```

如果当前主仓已有同名 branch 或 worktree，先检查状态，避免覆盖用户工作。

## 实施顺序

### Phase 0：红灯测试与旧行为锁定

目标：先证明旧行为被测试锁住，再开始迁移。

任务：

- 为 `RoutePolicy` allow / deny / order / fallback 补兼容测试。
- 为 hard guard 优先级补测试：manual-disabled / rate-limit / disabled / cooldown 不可被 allow/order 放回。
- 为启停实时性补测试：禁用清理 sticky / pinned auth 并断开当前流；激活只进入下一轮候选池，不抢占当前连接。
- 为失败冷却持久化补测试：429/5xx 写入运行态后，后续 route explain 和真实 route 都能过滤该账号。
- 为 hook 安装点补测试：route policy、usage attribution、rate-limit hook 必须在生产启动链路安装。
- 为前端模型补测试：`ChannelRouteMode` 只接受 `sequential / balanced / project`。
- 为前端边界补测试：Account Inventory 不渲染 rotation orchestration 入口。

通过标准：

- 关键测试先红灯或明确证明现有缺口。
- 测试名称使用 `route engine / policy pipeline / guard source / channel routing` 语义。

### Phase 1：sidecar seam 与 engine 骨架

目标：建立唯一路由决策入口，不改变生产行为。

任务：

- 新增 GetTokens-owned 路由包，例如 `internal/gettokensrouting`。
- 定义 `RouteContext / RouteDecision / RouteTrace / CompiledRouteSnapshot`。
- 在 scheduler / selector 选路点接入最小 seam。
- 将旧 `RoutePolicy` 映射为 engine `RequestPolicy` 兼容层。
- 将 `AccountRouteGuardStore` 映射为 `HardFilterPolicy`。
- 输出基础 trace，先用于测试和 debug。

通过标准：

- 空策略时选择结果与旧逻辑一致。
- 旧 loopback header / metadata 探测入口行为不变。
- hard guard trace 位于所有 request policy 之前。

### Phase 2：旧逻辑一次性清理

目标：避免新 endpoint routing 上线后同时存在两套路由系统。

任务：

- 补齐 hook 安装点并保证幂等。
- 收敛 rate-limit 双路径：evaluator 只刷新 guard source，热路径 deny 只从 guard policy 出口产生。
- 将 session affinity wrapper 迁移为 `StickyPolicy`，或确保 fast path 仍进入 engine。
- WebSocket request-boundary 保留，但重新选择必须通过 engine。
- 更新旧 route policy / rate-limit 文档中的新旧关系说明。

通过标准：

- route trace 中 rate-limit 只出现一次过滤步骤。
- manual-disabled 与 rate-limit source 独立。
- sticky auth 被 guard 命中后失效重选。
- sticky / pinned auth 对应账号或有效组被禁用后立即失效；当前流式连接在最近可控边界断开，不进入失败降级继续使用原账号。
- 账号或账号组激活后只进入下一轮候选池，不抢占已有 stream / sticky。
- Codex WebSocket pinned auth 被 guard 命中后释放 pin、关闭旧 upstream、重新进入 engine。

### Phase 3：Routeable Account Pool 与三模式

目标：实现用户可理解的可路由账号池和核心路由模式。

任务：

- 建立账号状态模型：`activation` 与 `requestability` 分离。
- 建立账号组模型：全局 `inventoryGroup.enabled / routeOrder`。
- 建立渠道组状态：`channelGroup.enabled / routeOrder override`。
- 建立渠道路由配置：`routeMode / orderedAccountIDs / channelGroupStates / projectBindings / fallbackMode`。
- 实现 `sequential`：有效排序从低到高，retry 排除已尝试账号。
- 实现 `balanced`：当前会话数或 in-flight 最少优先，同负载按有效排序。
- 实现 `project`：项目名绑定账号或账号组，组内委托 `sequential / balanced`。

通过标准：

- 总账号池 CRUD 不创建或修改 Codex / Claude 渠道路由配置。
- Codex 保存不影响 Claude，Claude 保存不影响 Codex。
- 全局组禁用影响所有渠道，渠道组禁用只影响当前渠道。
- 上游兼容模式不会改变三模式决策，只出现在 trace 兼容说明中。

### Phase 4：Wails / Management API

目标：让桌面端能读写渠道路由配置，并执行 dry-run/explain。

任务：

- CLIProxyAPI management API：list / save channel route config、dry-run/explain、route event summary。
- Wails：`internal/wailsapp` method、root `main.App` facade、root DTO / mapper、generated `frontend/wailsjs`。
- 服务端校验：route mode、fallback、account id、group id、project binding、上游兼容字段。

通过标准：

- dry-run 不请求上游。
- generated binding smoke 通过。
- Wails 方法不直接暴露 `internal/wailsapp` 未映射 DTO。

### Phase 5：前端重做

目标：交付可操作、可解释的渠道路由工作台。

任务：

- 新增 `frontend/src/features/channel-routing/` 共享模型和组件。
- 移除 Account Inventory 中的 `AccountRotationModal` 主入口。
- 重做 Codex 账号列表为 Codex Channel Routing。
- 重做 Claude 账号列表为 Claude Channel Routing。
- browser preview 支持 Codex / Claude 两个渠道，不依赖 `window.go.main.App`。
- 接入 dry-run / explain / probe trace。

通过标准：

- Account Inventory 页面没有 route mode、项目绑定、渠道 fallback 入口。
- Codex / Claude 页面保存配置互不污染。
- 页面展示候选池、过滤原因、排序依据和最终选择。
- `dedicated / prefer / ordered / weighted / canary` 不作为可编辑模式出现。

### Phase 6：Shadow Mode 与观测

目标：让策略发布可灰度、可解释、可回滚。

任务：

- 支持 production decision 与 shadow decision 并行计算。
- route event 只记录安全摘要，不写 payload、凭证、token、cookie、完整错误体。
- 前端展示 shadow diff 和 snapshot / policy version。

通过标准：

- shadow 不影响真实执行。
- event redaction 测试通过。
- explain 可定位 snapshot version 与 policy version。

## 测试门禁

sidecar fork：

```bash
go test ./internal/gettokenshooks ./sdk/cliproxy ./sdk/cliproxy/auth ./sdk/api/handlers/openai ./internal/runtime/executor
```

GetTokens：

```bash
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
npm --prefix frontend run build
```

文档：

```bash
docs-linhay/scripts/check-docs.sh
qmd update
qmd embed
```

## 首轮可执行任务

建议第一批 PR / commit 只做红灯测试和模型骨架：

1. 新增前端 `channel-routing` 纯模型测试。
2. 新增 sidecar route engine 空策略兼容测试。
3. 新增 hook 安装点测试。
4. 新增 hard guard 优先级测试。
5. 将 Codex / Claude account-list skill 更新到新 Channel Routing 边界。

这批完成后，再进入真实实现，避免一开始就改 UI 和 sidecar 热路径导致回归面失控。

## 新增优先级决策

2026-05-25 确认：

- `manual-disabled`、账号 `disabled`、`inventoryGroup.enabled=false`、`channelGroup.enabled=false` 是硬状态。
- 硬禁用优先级高于 `StickyPolicy`、失败降级、retry 和 selector。
- 已经绑定 sticky / pinned auth 的长连接被禁用命中时，不做无缝续流；执行器需要在 request-boundary 或管理控制可达的最近边界主动断开，然后让下一次请求重新进入路由引擎。
- 激活账号或账号组只让它回到可路由账号池，等待下一轮 route / retry，不主动抢占当前 stream / sticky。
- 失败冷却需要持久化，至少覆盖 401、429、5xx、timeout、model-unavailable；冷却恢复不能清理用户禁用。

## 本次整理的沉淀结论

沉淀到项目级 skill：

- Codex / Claude 账号列表从“请求顺序页面”升级为“渠道路由工作台”。
- 渠道顺序不再写全局 `UpdateAccountPriority`。
- 旧 allow / deny / order / fallback 只作为请求级兼容 policy。
- 新模式只接受 `sequential / balanced / project`。

暂不升级到 `AGENTS.md`：

- 这些规则属于账号路由领域，不是 repo-wide 通用治理规则。
- 当前放入 domain / account-list skills 和本 space 文档即可支撑后续实施。
