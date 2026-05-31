# Account Routing Engine 前端重做范围 v01

日期：2026-05-25

## 结论

本期前端可以推翻重做 `Codex 账号列表` 与 `Claude Code 账号列表` 两个页面，把它们从“账号顺序/探测页面”升级为“渠道路由工作台”。

总账号池页面不做整页重写，但必须移除账号轮动编排入口，只保留 `Account Inventory` 能力：账号资产、账号组、启停、弃用、基础排序和状态展示。

## 当前冲突点

代码现状中存在三类与新模型冲突的入口：

1. `frontend/src/features/accounts/AccountsFeature.tsx` 仍渲染 `AccountRotationModal`。
2. `frontend/src/features/accounts/hooks/useAccountRotation.ts` 仍读写 `GetRelayRoutingConfig`、`UpdateRelayRoutingConfig`、`UpdateAccountPriority` 和 `SetAccountDisabled`，把轮动编排放在总账号池内。
3. `frontend/src/features/codex/CodexAccountListFeature.tsx` 与 `frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx` 仍通过 `UpdateAccountPriority` 保存请求顺序，等价于用全局账号优先级承载渠道顺序。

这些入口必须被新边界替换，不能在新路由上线后继续作为主路径。

## 页面级范围

### 1. Account Inventory / 总账号池

保留：

- 账号增删改查。
- 账号启用 / 禁用 / 弃用。
- 账号组增删改查。
- 全局账号组启用 / 禁用 / 排序。
- 账号基础状态、quota、balance、错误状态展示。
- 账号详情、导入、模板应用和本地 CLI apply 入口。

移除或降级：

- 移除 `AccountRotationModal` 的主入口。
- 移除总账号池内的 route mode、fallback、渠道请求顺序、项目绑定、路由探测。
- `useAccountRotation` 不再作为总账号池 hook；如仍需兼容旧配置读取，只能迁移为只读迁移工具或删除。

验收：

- 总账号池保存账号或账号组后，不创建、不修改 Codex / Claude 渠道路由配置。
- 总账号池禁用账号或全局账号组后，渠道 explain 能显示该账号或组被全局状态过滤。

### 2. Codex 账号列表 / Codex Channel Routing

允许整页重做。

新职责：

- Codex 渠道账号顺序。
- Codex route mode：`sequential / balanced`。
- Codex 渠道组启停与渠道组排序 override。
- Codex 项目名绑定账号组或账号。
- Codex fallback：`fail-closed / fallback-default / fallback-global`。
- Codex dry-run / explain / probe。
- Codex 路由 trace：候选池、过滤原因、排序步骤、最终选择。

旧逻辑处理：

- 不再用全局 `UpdateAccountPriority` 表达 Codex 渠道顺序。
- 旧 `allowAccountIDs / denyAccountIDs / orderAccountIDs / allowFallback` 只作为请求级兼容 policy，不作为新页面的主配置模型。
- `dedicated / prefer / ordered / weighted / canary` 不出现在新页面配置项中。

### 3. Claude Code 账号列表 / Claude Channel Routing

允许整页重做，并与 Codex 共享渠道路由组件，但保持渠道配置独立。

新职责：

- Claude Code 渠道账号顺序。
- Claude route mode：`sequential / balanced`。
- Claude 渠道组启停与渠道组排序 override。
- Claude 项目名绑定账号组或账号。
- Claude fallback：`fail-closed / fallback-default / fallback-global`。
- Claude dry-run / explain / probe。
- Claude Anthropic 格式账号池说明和过滤结果。

旧逻辑处理：

- 不再用全局 `UpdateAccountPriority` 表达 Claude 渠道顺序。
- 不再直接复用 Codex route policy 语义作为 Claude 页面主模型。
- Claude 官方模型 profile 和 local apply 继续保留在 Claude 领域内，不并入路由引擎配置。

## 推荐前端结构

新增共享领域：

```text
frontend/src/features/channel-routing/
  components/
    ChannelRoutingWorkbench.tsx
    ChannelRouteModeControl.tsx
    ChannelAccountOrderList.tsx
    ChannelGroupScopePanel.tsx
    RouteExplainPanel.tsx
    RouteProbePanel.tsx
  model/
    channelRouting.ts
    channelRoutingPreviewData.ts
    channelRoutingSelectors.ts
    channelRoutingValidation.ts
  tests/
    channelRouting.test.mjs
```

Codex / Claude 页面只负责装配渠道差异：

```text
frontend/src/features/codex/CodexAccountListFeature.tsx
frontend/src/features/claude-code/ClaudeCodeAccountListFeature.tsx
```

页面 controller 保留：

- Wails / browser preview 数据加载。
- 渠道配置保存。
- dry-run / probe 调度。
- 详情 modal 与 hash 同步。
- 渠道特有模型映射或 local apply 编排。

共享模型必须保持纯函数优先，方便先写单测再接 UI。

## 新前端配置模型

```ts
type ChannelRouteMode = 'sequential' | 'balanced';

interface ChannelRoutingConfig {
  channel: 'codex' | 'claude';
  routeMode: ChannelRouteMode;
  orderedAccountIDs: string[];
  channelGroupStates: Record<string, {
    enabled: boolean;
    routeOrder?: number;
  }>;
}
```

`ChannelRouteMode` 只允许两种值。`project`、项目绑定、fallback 和上游兼容模式作为旧输入进入前端时必须被丢弃或降级为 invalid mode 诊断，不得保存为新配置，也不得显示为可编辑兼容项。

## UI 信息架构

推荐页面布局：

1. 顶部渠道状态条：渠道、配置来源、快照版本、preview/live 状态。
2. 左侧主区：可路由账号池与渠道顺序。
3. 右侧配置区：route mode、渠道组范围。
4. 底部或右侧抽屉：dry-run / explain / probe trace。

关键原则：

- 不做卡片堆叠式说明页，页面第一屏就是可操作的路由工作台。
- explain 面板用事实状态：候选数、过滤原因、排序依据、最终选择。
- 账号行展示“配置存在但不可请求”的原因，禁用、异常、限流、组禁用要分开。
- Codex / Claude 同一套组件可以复用，但保存接口和配置 key 必须按渠道隔离。

## BDD 验收场景

1. Given 用户在总账号池打开账号列表，When 查看页面操作，Then 不出现账号轮动、route mode、项目绑定或渠道 fallback 设置。
2. Given 用户在 Codex 账号列表调整 route mode，When 保存成功，Then 只更新 Codex 渠道路由配置，不改变 Claude 配置和总账号池排序。
3. Given 用户在 Claude 账号列表调整渠道组启停，When 保存成功，Then 只影响 Claude 渠道，不影响 Codex 使用同一全局组。
4. Given 全局账号组被禁用，When Codex / Claude explain 路由，Then 两个渠道都显示该组被 `inventoryGroup.enabled=false` 过滤。
5. Given Codex 渠道组被禁用，When Codex explain 路由，Then Codex 不产生该组候选；When Claude explain 同一组，Then Claude 仍可使用自身启用的渠道组。
6. Given 旧配置包含项目绑定或 fallback，When 页面归一化配置，Then 这些字段不出现在草稿、保存 payload 或可编辑 UI 中。
7. Given 页面读取到上游兼容模式 `weighted`，When 渲染新配置 UI，Then 不把它作为可编辑 route mode，并把 route mode 降级到 `sequential`。
8. Given 普通浏览器没有 Wails runtime，When 打开 Codex / Claude 账号列表 preview，Then 页面可显示 preview 数据、编辑草稿、运行 mock explain，不空白。

## TDD 优先级

P0 模型测试：

- `ChannelRouteMode` 只接受 `sequential / balanced`。
- `project` / `dedicated` / `prefer` / `ordered` / `weighted` / `canary` 被识别为 invalid mode，不进入配置保存。
- 旧项目绑定和 fallback 字段归一化后被丢弃。
- Codex / Claude 配置对象互不污染。

P1 页面行为测试：

- Account Inventory 不渲染 `AccountRotationModal` 入口。
- Codex 页面保存只调用 Codex channel config mutation。
- Claude 页面保存只调用 Claude channel config mutation。
- browser preview 无 Wails runtime 时稳定渲染。

P2 集成测试：

- Wails DTO 与 generated binding smoke。
- dry-run 不请求上游。
- explain trace 展示过滤原因和最终选择。

## 迁移步骤

1. 新增 `features/channel-routing/model`，先写纯模型和单测。
2. 移除总账号池的 rotation modal 入口，把旧 hook 标记迁移或删除。
3. 重做 Codex 账号列表页面，先接 preview 数据和本地草稿保存，再接 Wails 配置。
4. 重做 Claude 账号列表页面，复用共享组件但保留 Claude 筛选、模型 profile 和 local apply 边界。
5. 接入 sidecar dry-run / explain API。
6. 用浏览器 preview 截图做视觉与交互验收；涉及真实路由命中时再做 Wails 桌面验收。

## 非目标

- 不在本期重做账号创建、导入、详情、模板应用、本地 CLI apply。
- 不把 Claude 官方模型 profile 合并到共享 channel routing 模型。
- 不把上游 `weighted/canary/prefer` 等模式重新包装成 GetTokens 新路由模式。
- 不把 dry-run/explain 做成只读说明页；它必须服务真实排障和配置验证。
