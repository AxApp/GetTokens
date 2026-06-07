# Project Account Candidate Pool Rule 需求设计 v01

日期：2026-06-06

## 一句话目标

让用户可以为某个项目配置一个固定账号集合；该项目的 Codex / Claude 请求只能在这些账号内路由，不能意外落到 channel 的全量账号池。

## 设计立场

本需求做的是 **Project Account Candidate Pool Rule（项目账号候选池规则）**，不是恢复 legacy `projectBindings`。

核心判断：

1. 规则对象是账号候选池：它只负责在 selector 之前收窄 account candidate pool。
2. 路由模式仍然只有 `sequential` / `balanced`。
3. 账号禁用、quota、route guard、session affinity、WebSocket request-boundary 热切仍归 sidecar route engine 统一处理。
4. `projectBindings` 是待删除 legacy 模型，后续实现不得继续以它为 DTO、配置或 UI 承载。

## 用户场景

## 场景 A：按项目隔离账号成本

团队有多个项目共用 GetTokens，一个项目只能使用团队 A 的账号，另一个项目只能使用团队 B 的账号，避免额度、成本和审计混在一起。

期望：

- 用户为项目 `GetTokens` 选择账号 `A / B`。
- 该项目请求只在 `A / B` 中轮转。
- `A / B` 都不可用时直接提示项目无可用账号，不使用其他项目账号。

## 场景 B：按客户或仓库隔离账号

一个 GetTokens 实例同时服务多个客户仓库。不同客户的请求必须走不同账号，避免跨客户凭证使用。

期望：

- 项目规则是强约束。
- 规则命中后不允许 fallback 到 channel 全池。
- explain / audit 能说明“当前项目规则限制了候选账号”。

## 场景 C：项目规则变更后下一请求生效

用户把项目 `GetTokens` 的账号集合从 `A / B` 改成 `C`。

期望：

- 已经开始 streaming 的响应不中途迁移。
- 下一条 downstream request 感知候选池变化。
- 原 sticky 到 `A` 的 session 被重新评估，若 `A` 不在新 allow set 中则释放并重新选路。

## 术语

| 名称 | 含义 |
|---|---|
| `projectName` | 给用户看的项目显示名，例如 `GetTokens`。可以来自 live session、历史会话或用户手动输入。 |
| `projectKey` | 路由使用的稳定项目键，例如 `workspace:<sha256(normalized_abs_path)>`。必须带来源前缀、可审计、可长期保存。 |
| `projectKeySource` | `projectKey` 的来源，例如 `codex-turn-workspace`、`git-remote`、`manual-confirmed`。 |
| `channel` | `codex` 或 `claude`。项目规则按 channel 隔离。 |
| `allowAccountIDs` | 当前项目在当前 channel 下允许参与路由的账号 ID 集合。 |
| Project Account Candidate Pool Rule | 本需求新增的项目账号候选池规则；按 `projectKey + channel` 命中后，用 `allowAccountIDs` 收窄进入 selector 的账号候选池。 |

## 核心需求

## R1：项目规则只使用 allow set

每条启用规则包含：

- `projectKey`
- `projectName`
- `projectKeySource`
- `projectKeyConfidence`
- `channel`
- `enabled`
- `allowAccountIDs`

首版只支持 `allowAccountIDs`，不支持 `denyAccountIDs`、权重、canary、prefer 或 route mode override。

验收：

- 启用规则的 `allowAccountIDs` 不能为空。
- `allowAccountIDs` 中的账号必须属于对应 channel 的可选账号资产。
- 同一 `projectKey + channel` 只允许一条启用规则。

## R2：命中项目规则后 fail closed

当请求命中项目规则时，候选池先被收窄到 `allowAccountIDs`。如果这些账号全部被过滤、禁用、限流、quota-empty、不可用或缺失，系统返回项目级无可用账号错误。

验收：

- 不回退到 channel 全池。
- 错误必须包含项目名、channel、允许账号数量、过滤原因摘要。
- explain 中展示 `project-candidate-pool:matched` 和 `project-candidate-pool:no-routeable-account`。

## R3：未命中项目规则时保持现有 channel routing

如果请求没有稳定 `projectKey`，或没有找到启用的项目规则，则不改变当前 channel routing。

验收：

- 未配置项目规则的请求仍按 channel 的 `sequential / balanced` 执行。
- unknown project 不自动套用任何默认规则。
- 首版不做“所有未知项目必须阻断”的全局严格模式。

## R4：项目账号候选池规则属于 route engine 的 P1 PoolScopePolicy

项目账号候选池规则在 sidecar route engine 中作为池范围策略执行：

```text
CandidateProvider / CompiledRouteSnapshot
  -> channel route configs
  -> account / group / runtime state
  -> project account candidate pool rules
P0 HardFilter
  -> disabled / manual-disabled / rate-limit / unavailable / cooldown
P1 PoolScope
  -> channel account pool
  -> channel group state
  -> project account candidate pool rule
P2 RequestPolicy
  -> request deny / order, if any
P3 Sticky
  -> session affinity / pinned auth
P4 Selector
  -> sequential / balanced
```

验收：

- 项目账号候选池规则不能把 P0 已过滤账号放回候选。
- P2 request policy 即使后续存在，也不能把项目 allow set 外账号加回候选。
- sticky 账号不属于 allow set 时必须 invalidated。
- selector 只能在项目收窄后的候选池内执行。
- 请求热路径只读 `CompiledRouteSnapshot`，不能在 handler、Wails 或前端临时读取项目规则并补偿候选池。

## R5：项目标识必须拆分显示名与稳定 key

现有 live sessions 已有 `projectName`，但它是显示字段，不能直接作为运行时强约束。

需求：

- sidecar route context 应提供稳定 `projectKey / projectName / projectKeySource / projectKeyConfidence`。
- `projectName` 只用于展示和审计。
- `projectKey` 必须带来源前缀，不保存裸 slug。
- 首版 Codex runtime 推荐使用单 workspace path 派生的 `workspace:<sha256(normalized_abs_path)>`。
- UI 可以从 `projectName` 辅助发现项目，但不能直接把 `projectName` 当作运行时命中 key。

推荐首版 key：

```text
workspace:<sha256(filepath.Clean(abs_workspace_path))>
```

验收：

- 同一个 workspace path 多次请求产生同一个 `workspace:*` key。
- 两个不同路径但 display name 都是 `frontend` 的项目不会命中同一条规则。
- 空值或无法生成稳定 key 时不参与项目规则匹配。
- 不用 `projectName`、path prefix、repo autodetect、模糊匹配作为首版运行时依据。

## R5.1：项目命中只做 exact match

命中条件：

```text
rule.enabled == true
AND rule.channel == routeContext.channel
AND rule.projectKey in routeContext.projectIdentity.matchKeys
```

首版不支持：

- `projectName` contains / equals
- path prefix
- repo fuzzy match
- wildcard project
- fallback project
- 外部 header 指定 project key

验收：

- `workspace:abc` 不命中 `workspace:abcd`。
- `GetTokens` 不命中 `GetTokens-old`，除非二者拥有同一个 confirmed `projectKey`。
- 外部客户端不能通过自造 header 把自己伪装成某个项目。

## R5.2：无 key 与多 workspace 默认不命中

如果请求没有稳定 `projectKey`：

- 不命中项目规则。
- 不 fail closed。
- 继续现有 channel routing。
- trace 输出 `project-candidate-pool:not-evaluated:no-project-key`。

如果 Codex `X-Codex-Turn-Metadata.workspaces` 中有多个有效 workspace path：

- 首版默认不自动选第一个。
- 不命中项目规则。
- 不 fail closed。
- trace 输出 `project-candidate-pool:not-evaluated:ambiguous-project`。

原因：

- 当前 live session 展示逻辑可以对多个 workspace 排序取第一个 basename，但这只能用于展示，不能用于强路由。
- 多 workspace 强行命中任意一个项目，比不命中更危险。

## R5.3：规则冲突 fail closed

同一个 `channel + projectKey` 正常只允许一条 enabled rule。

如果因为导入、迁移、alias 或数据损坏导致同一个请求命中多条 enabled rule：

- 不选择其中任意一条。
- 返回项目规则冲突错误。
- trace 输出 `project-candidate-pool:conflict`。

原因：

项目账号候选池规则是强隔离能力。冲突时继续路由比失败更危险。

## R6：规则变更推进候选池 epoch

新增、删除、启用、禁用或修改项目 allow set 都属于候选池变化。

验收：

- 项目规则保存成功后推进 route snapshot / pool epoch。
- 下一条请求重新评估 session affinity。
- 已经 commit 的 streaming response 不被中途迁移。

## R7：WebSocket pinned auth 在请求边界重新评估

当 WebSocket session 当前 pinned auth 不再属于项目 allow set 时：

- 当前正在 streaming 的 response 不迁移。
- 下一条 downstream request 到达时释放 pin。
- 关闭旧 upstream，重新进入 route engine 选路。

验收：

- 不出现同一条 response 中途跨账号拼接。
- 下一条请求能从新 allow set 中选择账号。
- explain / audit 能看到 pinned auth 被 project candidate pool rule invalidated。

## R8：项目规则必须可 explain / audit

explain 输出需要展示项目规则参与决策的证据，并且应来自 route engine 的 `DecisionTrace` 或等价 sidecar trace，而不是前端二次推导。

最低字段：

- `projectKey`
- `projectName`
- `projectCandidatePoolRuleMatched`
- `projectCandidatePoolRuleID`
- `allowedAccountCount`
- `candidateCountBeforeProjectRule`
- `candidateCountAfterProjectRule`
- `filteredByProjectRule`
- `selectedAccountID`

审计事件需要写入：

- 命中的 project rule
- selected account
- fail closed 时的过滤原因摘要
- 是否触发 sticky invalidation

验收：

- 用户能从 Codex / Claude 账号列表的 explain 面板看懂项目规则为什么命中。
- trace 中必须能区分 `project-candidate-pool:matched`、`project-candidate-pool:not-matched`、`project-candidate-pool:no-routeable-account`。
- trace 中必须能区分 `project-candidate-pool:not-evaluated:no-project-key`、`project-candidate-pool:not-evaluated:ambiguous-project`、`project-candidate-pool:conflict`。
- 错误和审计不泄露凭证、token、cookie、原始请求体。

## R9：删除 legacy projectBindings

本需求的实现范围必须包含 legacy 清理。

删除要求：

- 不再有任何可写 `projectBindings` 配置入口。
- Wails DTO、前端模型、保存接口不以 `projectBindings` 为字段。
- 前端表单、preview data、文案和 explain 不把 `projectBindings` 展示为受支持能力。
- 归一化逻辑可以临时容忍历史 JSON 输入，但只能丢弃或迁移，不能继续写回。

验收：

- 新项目规则不写入 `ChannelRoutingConfig.projectBindings`。
- 保存 channel routing 后，历史 `projectBindings` 不会被保留。
- 代码中只允许在 legacy negative tests、迁移注释或历史文档中出现 `projectBindings`。

## R10：规则存储独立于 ChannelRoutingConfig

推荐新增 Project Account Candidate Pool Rule 独立存储，而不是塞回 channel routing 配置。

建议结构：

```json
{
  "version": 1,
  "rules": [
    {
      "id": "candidate_pool_gettokens_codex",
      "projectKey": "workspace:8f6e0f4c2e7a...",
      "projectName": "GetTokens",
      "projectKeySource": "codex-turn-workspace",
      "projectKeyConfidence": "strong",
      "channel": "codex",
      "enabled": true,
      "allowAccountIDs": [
        "auth-file:team-a.json",
        "openai-compatible:deepseek-team"
      ],
      "updatedAt": "2026-06-06T00:00:00Z"
    }
  ]
}
```

验收：

- Codex 和 Claude 规则互相隔离。
- 删除 channel routing 配置不应误删项目规则，除非用户明确删除对应项目规则。
- 账号删除后，规则保留缺失账号诊断，但运行时不把缺失账号放回候选。
- 规则 store 是管理面事实源；保存或运行态状态变化后必须重建 `CompiledRouteSnapshot`，真实路由只读快照。

## UI 需求

## U1：入口

建议入口放在 Codex / Claude 的账号列表工作台中，作为 channel routing 的相邻面板，而不是总账号池页面。

理由：

- 项目规则按 channel 生效。
- 账号顺序、route mode、explain 都在 channel routing 工作台。
- 总账号池只负责账号资产，不负责编排路由。

## U2：项目规则列表

列表字段：

- 项目名
- channel
- 启用状态
- 允许账号数量
- 当前可用账号数量
- 最近命中时间
- 最近 selected account
- 诊断状态

## U3：规则编辑

编辑内容：

- 项目显示名
- 项目 key
- 项目 key 来源
- channel
- 启用开关
- 允许账号多选

交互要求：

- 默认从 live sessions 发现的项目创建规则。
- 手动输入项目名只能创建 draft；启用前必须绑定 observed 或 confirmed `projectKey`。
- 保存前展示候选账号预览。
- 空 allow set 禁止保存启用规则。
- 缺失账号显示为诊断，不静默删除用户选择。

## U4：Explain 面板

explain 需要有单独的“项目账号候选池规则”段落，展示：

- 当前请求 project key
- 命中的规则
- allow set
- 被项目规则排除的账号
- 被 guard / quota / disabled 过滤的 allow set 内账号
- 最终选择账号或 fail closed 原因

## 非目标

首版不做：

- 不做 `denyAccountIDs`
- 不做 project route mode override
- 不做 project fallback 到 channel 全池
- 不做 weighted / canary / prefer / ordered
- 不做 path prefix / repo autodetect / fuzzy project matching
- 不做远端客户端自定义 header 直接指定 project key
- 不做移动端适配
- 不做前端本地假路由

## 风险

## 风险 1：project key 真源不稳定

如果 runtime 只拿到自由文本 `projectName`，规则可能误命中或漏命中。

缓解：

- 首先验证 sidecar route context 是否能提供稳定 `projectKey`。
- 派生 key 必须标记来源。
- UI 允许用户确认和修正。

## 风险 2：用户误以为 allow set 是可用集合

allow set 只是允许集合，不代表当前可请求。

缓解：

- UI 同时展示允许账号数量和当前可用账号数量。
- explain 区分 `allowed` 与 `routeable`。

## 风险 3：fail closed 可能导致请求突然失败

这是强隔离的必要结果，但需要明确提示。

缓解：

- 错误文案必须说明是项目规则导致候选池为空。
- 规则编辑页展示“全部不可用时不会回退到其他账号”。

## 验收故事

## Story 1：创建项目固定账号规则

Given Codex channel 中有账号 `A / B / C`
And live sessions 观测到项目显示名 `GetTokens` 与稳定 key `workspace:8f6e0f4c2e7a...`
When 用户基于该 observed project identity 创建规则并选择 `A / B`
Then 保存后规则显示为启用
And explain 里该 `workspace:*` 项目候选池只包含 `A / B`

## Story 2：项目不能路由到集合外账号

Given 项目 key `workspace:8f6e0f4c2e7a...` 的 allow set 为 `A / B`
And 账号 `C` 在 channel routing 中排序第一
When 携带同一 `workspace:*` key 的 `GetTokens` 项目请求到达
Then route engine 不选择 `C`
And explain 显示 `C` 被项目账号候选池规则排除

## Story 3：allow set 全部不可用时 fail closed

Given 项目 key `workspace:8f6e0f4c2e7a...` 的 allow set 为 `A / B`
And `A / B` 都被 route guard 阻断
When 请求进入 route engine
Then 返回项目无可用账号
And 不选择 `C`

## Story 4：sticky 被项目规则变更打断

Given session sticky 到账号 `A`
And 项目 allow set 从 `A / B` 改成 `B`
When 下一条请求到达
Then sticky 到 `A` 失效
And route engine 在 `B` 中重新选择

## Story 5：legacy projectBindings 不再保存

Given 历史 channel routing JSON 中包含 `projectBindings`
When 用户保存 channel routing 或项目规则
Then 新配置不再包含 `projectBindings`
And 新项目规则只写入 Project Account Candidate Pool Rule 存储

## 推荐下一步

1. 验证 sidecar request context / live tracker 能否提供稳定 `projectKey`。
2. 列出当前代码中 `projectBindings` 残留点，区分必须删除、只保留 negative test、只保留历史文档。
3. 进入技术设计：Project Account Candidate Pool Rule store、Wails DTO、sidecar policy 接入、explain/audit shape、前端入口。

## 技术证据补充

本需求已补充独立技术证据文档：

- [Project Account Candidate Pool Rule 技术证据 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260606-project-account-candidate-pool-rule/plans/20260606-project-account-candidate-pool-rule-technical-evidence-v01.md)

证据结论：

1. 当前 sidecar 已有 `hard-filter -> pool-scope -> request -> sticky` 的 policy stage 排序，项目账号候选池规则应落在 `PolicyStagePoolScope`。
2. hard filter 不能被后续 allow 绕过，项目 allow set 不能把 `manual-disabled / quota-empty / cooldown / unavailable` 账号加回候选。
3. 前后端 channel routing 均只接受 `sequential / balanced`，`project` route mode 与 `projectBindings` 已由测试定义为 legacy 删除对象。
4. session affinity 已有 pool epoch 机制，项目规则变更应 bump epoch 并在下一请求重新评估 sticky。
5. 现有 `projectName` 是展示/派生字段，不是运行时强 key，必须设计独立 `projectKey`。
