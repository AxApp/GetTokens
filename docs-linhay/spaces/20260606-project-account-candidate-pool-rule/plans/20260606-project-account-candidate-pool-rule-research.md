# Project Account Candidate Pool Rule 调研

日期：2026-06-06

## 问题定义

目标需求是：

> 一个项目只能在固定的几个账号中进行路由。

这里的“项目”不是 channel，也不是账号组本身，而是请求上下文里的一个业务维度。它需要影响候选账号池，但不应该改变 GetTokens 已经定下来的两层模型：

1. channel routing 决定某个渠道有哪些账号、什么顺序、什么 route mode。
2. sidecar route engine 在可路由池内做 hard filter、pool scope、sticky 和 selector。

## 当前状态快照

### 已确认的现状

1. 当前 channel routing 只支持两种模式：`sequential` 和 `balanced`。
2. legacy `projectBindings`、`project fallback`、`project route mode` 已在前后端归一化逻辑里被明确丢弃。
3. sidecar route engine 的主链路已经固定为：
   - `RouteContext Normalize`
   - `AccountRoutingEngine.Route()`
   - `CandidateProvider`
   - `CompiledRouteSnapshot`
   - `PolicyPipeline`
   - `SelectorAdapter`
   - `DecisionTrace`
   - `Executor.Execute()`
   - `ResultRecorder.MarkResult()`
   - `RetryController`
4. policy 分层已经固定为：
   - `P0 HardFilterPolicy`
   - `P1 PoolScopePolicy`
   - `P2 RequestPolicy`
   - `P3 StickyPolicy`
   - `P4 Selector`
5. route guard、quota-empty、manual-disabled、session affinity、WebSocket pinned auth 都已经被设计为 sidecar 运行态自治，不应回退到前端补偿或旧 header 风格主路径。

### 对本需求最重要的约束

这条规则本质上是：

- 不让某个项目看到整个 channel 账号池；
- 只允许它进入一个被收窄后的 allow set；
- 在这个 allow set 内，仍沿用现有 `sequential / balanced`、sticky、guard、quota 等规则。

因此它是“账号候选池规则”，不是新的 route mode。

## 推荐结论

**推荐做法：新增 Project Account Candidate Pool Rule（项目账号候选池规则），进入 `CompiledRouteSnapshot`，并作为 sidecar route engine 的 `P1 PoolScopePolicy` 执行，不恢复 legacy `projectBindings`。**

并且，这里不只是“不恢复”，而是要把 `projectBindings` 视为需要继续清理的 legacy 模型：后续实现如果仍残留相关 DTO、配置字段、归档数据入口或前端表单语义，应一并删掉或阻断继续写入。

这条推荐的关键不是“P1”这个标签，而是贴合现有路由系统对象：

```text
RouteContext(projectKey)
  -> CompiledRouteSnapshot(project candidate pool rules)
  -> PolicyStagePoolScope(strict allow)
  -> DecisionTrace(project rule matched / filtered / fail closed)
  -> StickyPolicy(只能在收窄池内命中)
  -> Selector(sequential / balanced)
```

## 为什么要删除 legacy `projectBindings`

### 1. 旧模型和当前架构方向冲突

现有测试和归一化逻辑已经把 `projectBindings` 定义为 legacy 噪音，并主动丢弃。此时重新把它作为主配置写回，会直接打破最近一轮 channel routing 的收敛边界。

### 2. 旧模型会把“项目”误做成 route mode 分支

用户真正要的是“项目只能路由到这些账号”，而不是“项目拥有一套单独 route mode / fallback mode / project mode”。如果恢复旧模型，很容易把需求膨胀成另一套路由系统。

### 3. 旧模型和 session affinity / guard 的组合成本高

现有 sticky、quota-empty、manual-disabled、disabled immediate switch 都建立在统一候选池语义上。legacy project route 一旦单独成系，会让 explain、retry、WebSocket request-boundary 热切都重新分叉。

### 4. 保留残留字段会持续制造错误心智

哪怕运行时已经不消费，只要配置、前端或 DTO 里还挂着 `projectBindings`，后续实现者就会自然把新需求往旧字段里塞，最终又把“项目级作用域”误做成“项目级路由系统”。

## 删除要求

后续进入实现时，应把下面这些点列为显式清理范围：

1. 不再新增或保留任何可写 `projectBindings` 配置入口。
2. 前端表单、预览数据、Wails DTO、保存接口不再以 `projectBindings` 为承载。
3. 归一化逻辑仍可临时容忍历史数据输入，但只能用于丢弃和迁移，不能继续写回。
4. explain、audit、文档和测试都不再把 `projectBindings` 当成受支持模型。

## 推荐设计

## 1. 抽象层次

新增一个项目账号候选池规则模型：

```text
Project Account Candidate Pool Rule
  project key
  channel
  allow account ids
  optional enabled flag
```

它不定义 route mode，也不定义 fallback mode，只定义“这个项目在某个 channel 下的允许账号集合”。

## 2. 执行位置

放在 `P1 PoolScopePolicy`，顺序应为：

```text
CandidateProvider / CompiledRouteSnapshot
  -> channel route configs
  -> account/group/runtime lookup
  -> project candidate pool rules
P0 HardFilter
  -> disabled / manual-disabled / rate-limit / unavailable / cooldown
P1 PoolScope
  -> channel account pool
  -> group enabled state
  -> project account allow set
P2 RequestPolicy
  -> request deny / order, if any
P3 Sticky
  -> session affinity / pinned auth
P4 Selector
  -> sequential / balanced
```

原因：

1. 项目限制属于“池范围”，早于 selector。
2. 它不能绕过 hard filter。
3. request policy 即使后续存在，也只能在项目收窄后的池子里继续 deny/order，不能把项目规则挡掉的账号加回候选。
4. sticky 命中前就必须知道 sticky 账号是否仍属于当前项目 allow set。

实现上不要让请求热路径直接读配置文件或 DB。规则应该在配置变更时编译进 `CompiledRouteSnapshot`，请求进入时只用 `RouteContext.projectKey + channel` 做快照查找。

## 3. 规则语义

推荐只支持一种核心语义：

- `allowAccountIDs`

不建议首版就引入：

- `denyAccountIDs`
- `project fallback`
- `project route mode override`
- `project group inheritance`

理由是：用户需求非常清晰，就是“固定几个账号”。首版用 allow set 足够直接，也最容易 explain。

## 4. 未命中策略

当项目配置了 allow set，但该集合里的账号全都被 `P0 HardFilter` 挡掉时，推荐默认：

- **fail closed**

也就是直接返回“该项目当前无可用账号”，而不是回退到 channel 全池。

这是本方案里最关键的产品判断。因为用户的原始诉求是“一个项目只能在固定的几个账号中进行路由”，如果在账号都不可用时又回退全池，规则就名存实亡。

如后续要放开，也应该作为显式配置：

- `fallbackToChannelPool = false`（默认）

但不建议首版就暴露。

## 与现有能力的边界

## 1. 与 channel routing 的关系

channel routing 仍然是真正的账号池编排源：

- 账号顺序
- account groups
- `sequential / balanced`

项目规则只是从 channel pool 里再裁一刀，不单独保存 route mode。

## 2. 与 session affinity 的关系

session affinity 仍然可以存在，但必须受项目 allow set 约束：

- sticky 账号若仍在 allow set 且未被 guard，则继续命中；
- sticky 账号若不在 allow set，必须 invalidated；
- 项目 allow set 变化应视为 pool epoch 变化的一种来源。

## 3. 与 route guard / quota 的关系

项目规则不绕过 guard：

- allow set 只决定“理论允许”；
- route guard 决定“当前可请求”。

最终 explain 应能同时展示：

- 该账号属于项目 allow set；
- 但被 `manual-disabled` / `quota-empty` / `rate-limit` / `cooldown` 等原因过滤。

## 4. 与 WebSocket pinned auth 的关系

项目账号候选池规则变化与账号禁用类似，应该在 request boundary 生效：

- 已建立的 response 中途不迁移；
- 下一条 downstream request 到达时，若 pinned auth 已不属于当前项目 allow set，则释放 pin、关闭旧 upstream、重新选路。

## 项目标识来源

这是目前最脆弱的前提。

这套方案依赖一个稳定、可解释的 `project key` 来源。没有它，项目级路由规则无法可靠命中。

推荐优先级：

1. 优先在 sidecar `RouteContext` 中提供 `ProjectKey / ProjectName / ProjectKeySource`，让 route engine、explain 和 audit 读取同一份请求上下文。
2. 使用现有 live sessions / request context 里已经存在、且对用户可见的项目名字段作为发现来源，但不能把 UI 派生 ID 当成运行时强约束。
3. 首版 Codex 优先使用单 workspace path 派生 `workspace:<sha256(filepath.Clean(abs_workspace_path))>`，并把 `projectName` 保留为展示/审计字段。
4. 首版不做模糊匹配、不做 path prefix 规则、不做 repo autodetect，也不把自由文本项目名规范化后当作强路由 key。

**本方案的最脆弱假设是：请求上下文里存在稳定 project key。若该假设不成立，整个能力都只能停留在 UI 配置层，不能进入真实运行时。**

## 数据模型建议

建议新增独立配置存储，而不是塞回 `ChannelRoutingConfig`：

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
      ]
    }
  ]
}
```

原因：

1. 这是一套新的账号候选池规则，不是 channel route mode 本体。
2. 和 `ChannelRoutingConfig` 分开，更容易保持 Codex / Claude 隔离。
3. 未来如果要支持 explain、审计、冲突检测，单独存储更清晰。

## 验收场景

## 场景 1：项目命中固定账号集合

Given 显示名为 `GetTokens` 的项目已观测到稳定 key `workspace:8f6e0f4c2e7a...`
And 该 key 配置 `codex` 渠道账号候选池规则，允许账号 `A,B`
When 携带同一 `workspace:*` key 的 Codex 请求到达
Then 候选池只包含 `A,B`
And selector 只在 `A,B` 内执行

## 场景 2：集合外 sticky 账号失效

Given session 当前 sticky 到账号 `C`
And 当前请求命中 `workspace:8f6e0f4c2e7a...` 的 allow set `A,B`
When 下一条请求到达
Then `C` 被判定为不属于该项目的账号候选池 allow set
And sticky 失效并重新选路

## 场景 3：allow set 内账号都被 guard

Given 项目 key `workspace:8f6e0f4c2e7a...` 的 allow set 为 `A,B`
And `A,B` 都被 `quota-empty` 或 `manual-disabled` 阻断
When 发起请求
Then 返回“项目无可用账号”
And 不回退到 channel 全池

## 场景 4：未配置项目规则

Given 请求没有稳定 `projectKey` 或其 `projectKey` 没有启用的项目规则
When 发起请求
Then 仍走普通 channel routing

## 场景 5：规则变更触发 epoch

Given session 正在使用 allow set 中的账号 `A`
When 项目规则修改为只允许 `B`
Then 下一请求感知规则版本变化
And `A` 不再继续 sticky

## 实施建议

建议按三步走：

1. **先验证 project key 真源**
   - 先查清当前请求上下文里到底有哪些稳定 project 字段；
   - 没有稳定字段前，不建议开始实现。
2. **再做 explain-only**
   - 先做 dry-run / explain，把项目账号候选池规则作为 `DecisionTrace` / explain 过滤步骤输出；
   - 先验证用户能否理解命中逻辑。
3. **最后接入真实执行**
   - 把项目账号候选池规则纳入 `P1 PoolScopePolicy`；
   - 再补 sticky invalidation、epoch bump、审计事件。

## 不建议现在做的事

- 不恢复 `projectBindings` 到 `ChannelRoutingConfig`
- 不把项目规则做成第三种 route mode
- 不引入 `prefer / weighted / canary / ordered` 变体
- 不让项目规则绕过 `manual-disabled / quota-empty / rate-limit`
- 不在前端本地实现项目到账号的假路由

## 最终建议

**Keep the new route engine shape. Add project account candidate pool rules as a pool-scope policy, not as a legacy project routing system.**

换成中文更直白一点：

这需求值得做，但应该做成“项目账号候选池规则”：按 `projectKey + channel` 命中后，用 allow set 收窄账号候选池，再交给 `sequential / balanced` 选择器；不应该回头恢复 legacy `projectBindings` 那一整套。
