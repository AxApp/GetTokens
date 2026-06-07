# Project Match Rule v01

日期：2026-06-07

## 目标

本文件只冻结“项目规则什么时候命中”，不重复定义命中后的账号候选池执行语义。

已冻结的执行语义仍是：

```text
RouteContext(project identity)
  -> CompiledRouteSnapshot(project account candidate pool rules)
  -> PolicyStagePoolScope(strict allow)
  -> P2 RequestPolicy
  -> P3 StickyPolicy
  -> P4 Selector
```

## 推荐结论

首版项目命中规则采用 **稳定 project key 精确命中**：

```text
request.projectIdentity.matchKeys
  intersect enabledRules[channel].projectKey
```

命中不是按 `projectName`，也不是按路径前缀、模糊项目名、repo 猜测或客户端任意 header。`projectName` 只负责展示和审计。

`matchKeys` 是 sidecar 从可信项目身份来源构造的 key 集合，不是用户可见项目名列表。首版 Codex 单 workspace 请求通常只有一个 key：

```text
matchKeys = ["workspace:<sha256(filepath.Clean(abs_workspace_path))>"]
```

未来如果加入 `git:*` 或 project alias，也只能把 sidecar 派生或用户确认过的稳定 key 放进 `matchKeys`；自由文本 `projectName`、外部请求 header、path prefix 或 fuzzy 结果都不能进入这个集合。

## 定稿：命中判定表

项目命中只回答“这条项目账号候选池规则是否适用于当前请求”。命中之后如何选账号，仍交给后续 `sequential / balanced` selector。

| 场景 | 判定 | 路由结果 |
| --- | --- | --- |
| `routeContext.channel` 与规则 `channel` 不一致 | 忽略该规则 | 继续查同渠道规则；没有同渠道命中时 `project-candidate-pool:not-matched` |
| 请求没有稳定 `projectKey` / `matchKeys` 为空 | 不评估项目规则 | 不 fail closed，保持现有 channel routing，trace 为 `project-candidate-pool:not-evaluated:no-project-key` |
| 请求项目身份为 `ambiguous` | 不评估项目规则 | 不 fail closed，保持现有 channel routing，trace 为 `project-candidate-pool:not-evaluated:ambiguous-project` |
| 只有 `projectName` 相同，`projectKey` 不同或为空 | 不命中 | `projectName` 只展示/审计，不参与 runtime match |
| 一条 enabled rule 精确命中 `channel + projectKey` | 命中 | 对当前候选池执行 strict allow，`AllowFallback=false`，trace 为 `project-candidate-pool:matched` |
| 命中规则的 `allowAccountIDs` 与当前可路由候选池没有交集 | 命中但无可路由账号 | fail closed，deny 当前候选，trace 为 `project-candidate-pool:no-routeable-account` |
| 多条 enabled rule 同时命中同一请求 | 冲突 | fail closed，deny 当前候选，trace 为 `project-candidate-pool:conflict` |
| 规则 disabled | 忽略 | 不参与冲突判定，也不影响候选池 |
| 外部请求自带 project key/header | 不接受 | 不进入 `matchKeys`，除非 sidecar 已从可信来源派生或用户确认 |

## 路由系统证据

这版命中规则按现有路由系统收口，而不是重新引入项目路由模式：

- `docs-linhay/dev/20260524-account-routing-engine.md` 已冻结主链路为 `RouteContext Normalize -> AccountRoutingEngine.Route() -> CandidateProvider -> CompiledRouteSnapshot -> PolicyPipeline -> SelectorAdapter -> DecisionTrace`。
- 同一文档的 policy 分层明确 `P1 PoolScopePolicy` 负责目标账号组、目标账号 ids 和 pool filter；项目账号候选池规则本质正是 pool filter。
- 同一文档明确 `project`、项目绑定、channel fallback 和 project fallback 不进入 Channel Routing 保存、执行或 UI 路径，旧配置中的 `projectBindings` 等字段只允许丢弃。
- sidecar `internal/gettokensrouting.Engine` 按 stage rank 执行：`hard-filter -> pool-scope -> request -> sticky`。因此项目规则放在 `PolicyStagePoolScope` 后，不能绕过 `P0 HardFilterPolicy`，也会先于 sticky 和 selector 收窄候选池。
- `DecisionStep` 已能承载 `Policy / Reason / Before / After / AllowIDs / DenyIDs / Activated`，项目命中、未评估、冲突和无可路由账号都应进入 explain trace。

## v01 伪代码

```text
if routeContext.projectKeyConfidence == "ambiguous":
  return not_evaluated("ambiguous-project")

matchKeys = routeContext.projectIdentity.matchKeys
if matchKeys is empty:
  return not_evaluated("no-project-key")

matches = enabledRules.filter(rule =>
  rule.channel == routeContext.channel
  AND rule.projectKey in matchKeys
)

if matches.length == 0:
  return not_matched()

if matches.length > 1:
  return fail_closed("conflict")

allowed = currentCandidates intersect matches[0].allowAccountIDs
if allowed is empty:
  return fail_closed("no-routeable-account")

return strict_allow(allowed, allowFallback=false)
```

## 核心规则

## M1：只用 projectKey 命中，不用 projectName 命中

`projectName` 可以是 `GetTokens`、`Overloaded-v2` 这类用户可读名称，但它不参与运行时匹配。

原因：

- 同名项目可能存在于不同目录或不同客户仓库。
- `projectName` 当前来自 workspace basename、session 文件或 repo name，都是展示级信号。
- 用展示名做强路由会把“看起来像同一个项目”误判成“确实是同一个项目”。

验收：

- 两个不同 workspace 都叫 `frontend` 时，不会因为同名而命中同一条规则。
- explain 中可以显示 `projectName`，但 trace 的命中字段必须是 `projectKey`。

## M2：projectKey 必须带来源前缀

首版 `projectKey` 不再使用裸 slug，例如不直接使用 `gettokens`。

推荐 key 形状：

```text
workspace:<sha256(normalized_abs_path)>      # 当前最可落地的 Codex runtime key
git:<normalized_host>/<owner>/<repo>         # 后续当 runtime 能稳定拿到 remote 时使用
manual:<stable_user_key>                     # 仅用于用户明确确认的手动 key
```

说明：

- `workspace:*` 不泄露本机完整路径，适合当前 `X-Codex-Turn-Metadata.workspaces` 已能提供 workspace path 的事实。
- `git:*` 可跨目录移动，但当前 Codex request context 尚未稳定提供 git remote；不能为了它在热路径同步执行 git 命令。
- `manual:*` 只能由用户确认后保存，不允许用自由文本自动启用强路由。

验收：

- UI 可以展示 `GetTokens`，但规则实际保存为 `workspace:<hash>` 或未来的 `git:github.com/linhey/gettokens`。
- route trace 展示 `projectKeySource`，敏感 path 不进入 ledger。

## M3：当前 Codex 首选来源是 turn metadata workspace

当前代码证据：

- `ExtractCodexLiveSessionIdentity()` 已从 `X-Codex-Turn-Metadata.workspaces` 派生 `ProjectName`。
- `parseCodexTurnMetadata()` 会读取 `workspaces` map，并从 workspace path 取 basename 作为 display project name。
- `gettokenscodex.RequestContext` 当前已有 `SessionID / ThreadID / TurnID / Sandbox` 等字段，但尚未包含 `ProjectKey / ProjectName / ProjectKeySource`。

因此首版实现建议：

1. 在 `gettokenscodex.RequestContext` 增加：
   - `ProjectKey`
   - `ProjectName`
   - `ProjectKeySource`
   - `ProjectKeyConfidence`
2. `parseTurnMetadata()` 解析 `workspaces`。
3. 当 `workspaces` 只有一个有效 workspace path 时：
   - `projectName = filepath.Base(workspacePath)`
   - `projectKey = workspace:<sha256(filepath.Clean(workspacePath))>`
   - `projectKeySource = codex-turn-workspace`
   - `projectKeyConfidence = strong`

验收：

- 单 workspace 请求可以稳定产生同一个 `workspace:*` key。
- 同一个 path 的多次请求命中同一条项目规则。
- path 原文不写入 route ledger、error body 或持久 audit。

## M4：多 workspace 默认不命中

如果一次请求的 `workspaces` 中存在多个有效 workspace path，首版默认 **不自动命中任何项目规则**。

例外只允许：

- 未来 Codex metadata 明确提供 primary / active workspace。
- 或所有 workspace 被用户显式绑定到同一项目规则，并形成同一个 confirmed project identity。

原因：

- 现有 live session 展示逻辑是排序后取第一个 basename；这可以用于展示，不能用于强路由。
- 多 workspace 场景随便选一个会导致请求被错误限制到无关项目账号池。

验收：

- 多 workspace 请求 trace 显示 `project-candidate-pool:not-evaluated:ambiguous-project`.
- 不 fail closed，不命中项目规则，保持现有 channel routing。
- UI 可提示用户该请求项目身份不唯一。

## M5：无 projectKey 时不命中，不 fail closed

如果请求上下文无法生成稳定 `projectKey`：

- 不命中项目规则。
- 不自动阻断请求。
- 保持现有 channel routing。
- trace 标记 `project-candidate-pool:not-evaluated:no-project-key`。

原因：

首版不做全局严格模式。没有 key 时无法知道请求属于哪个项目，强行 fail closed 会把没有项目信号的正常请求打断。

后续如果要做强隔离，可以新增显式配置：

```text
requireKnownProjectKey = true
```

但它不是首版默认行为。

## M6：匹配只做 exact match

命中条件：

```text
rule.enabled == true
AND rule.channel == routeContext.channel
AND rule.projectKey in routeContext.projectIdentity.matchKeys
```

不支持：

- projectName contains
- path prefix
- repo fuzzy match
- wildcard project
- fallback project
- request header 指定 project key

验收：

- `workspace:abc` 不会命中 `workspace:abcd`。
- `GetTokens` 不会命中 `GetTokens-old`。
- 外部客户端不能通过自造 header 把自己伪装成某个项目。

## M7：规则冲突时 fail closed

正常情况下，同一个 `channel + projectKey` 只允许一条 enabled rule。

如果因为导入、迁移、alias 或数据损坏导致同一个请求同时命中多条 enabled rule：

- 不选择其中任意一条。
- 返回项目规则冲突错误。
- trace 标记 `project-candidate-pool:conflict`.

原因：

账号候选池规则是强隔离规则。冲突时继续路由比失败更危险。

## M8：规则发现和手动创建分开

UI 创建规则时应优先从 observed project identity 创建：

- observed `projectKey`
- observed `projectName`
- observed `projectKeySource`
- lastSeenAt

手动输入项目名只能创建 draft，不应直接启用强路由；启用前必须确认或绑定一个稳定 `projectKey`。

验收：

- 用户从 live sessions 的 `GetTokens` 创建规则时，保存的是 observed `workspace:<hash>`，不是 `GetTokens` 字符串。
- 用户手动输入 `GetTokens` 但没有稳定 key 时，规则不能 enabled。

## M9：Codex 与 Claude 分渠道命中

项目规则按 `channel` 隔离：

- Codex 请求只查 `channel=codex` 的规则。
- Claude 请求只查 `channel=claude` 的规则。

如果 Claude runtime 暂时无法提供稳定 project key：

- Claude 项目规则可以在 UI 中规划或草稿保存。
- 真实路由不应假装命中。
- explain 显示 `not-evaluated:no-project-key`。

## 推荐数据形状调整

在既有规则模型基础上补 project identity 元数据：

```json
{
  "id": "candidate_pool_gettokens_codex",
  "channel": "codex",
  "projectKey": "workspace:8f6e0f4c2e7a...",
  "projectName": "GetTokens",
  "projectKeySource": "codex-turn-workspace",
  "projectKeyConfidence": "strong",
  "enabled": true,
  "allowAccountIDs": ["auth-file:team-a.json"],
  "lastSeenAt": "2026-06-07T00:00:00Z",
  "updatedAt": "2026-06-07T00:00:00Z"
}
```

`CompiledRouteSnapshot` 中可以只保留热路径需要的字段：

```text
channel
projectKey
ruleID
enabled
allowAccountIDs
projectName
projectKeySource
```

## Trace 语义

命中相关 trace 建议统一为：

```text
project-candidate-pool:not-evaluated:no-project-key
project-candidate-pool:not-evaluated:ambiguous-project
project-candidate-pool:not-matched
project-candidate-pool:matched
project-candidate-pool:no-routeable-account
project-candidate-pool:conflict
```

## 保存校验

管理端保存 enabled rule 时应先做校验，避免把运行时 fail closed 当作正常配置体验：

1. `channel` 只能是当前支持的渠道，例如 `codex` 或 `claude`。
2. enabled rule 必须有非空 `projectKey`，且 `projectKey` 必须带来源前缀，例如 `workspace:`、`git:` 或 `manual:`。
3. enabled rule 必须有非空 `allowAccountIDs`，去空白和去重后仍至少保留一个账号。
4. 同一个 `channel + projectKey` 同时只能有一条 enabled rule；导入或数据损坏造成的重复，运行时仍按 conflict fail closed。
5. 只有 `projectName`、没有稳定 `projectKey` 的规则只能作为 draft/discovery 信息，不能启用强路由。

## 首版冻结项

1. exact match only。
2. projectName 不参与运行时匹配。
3. 当前 Codex 以单 workspace path hash 作为首版稳定 key。
4. 多 workspace 默认不命中。
5. 无 key 默认不命中，不 fail closed。
6. 冲突 fail closed。
7. 不接受外部 header 指定 project key。
8. 不做 path prefix、fuzzy、wildcard、fallback project。

## 后续可扩展但不进入首版

- `git:*` key：当 sidecar 能用非阻塞缓存稳定拿到 repo remote 时启用。
- project key alias：用于从 `workspace:*` 平滑迁移到 `git:*`。
- `requireKnownProjectKey` 全局严格模式。
- 多 workspace primary selection。
- 用户可配置的 project identity merge / split 工具。
