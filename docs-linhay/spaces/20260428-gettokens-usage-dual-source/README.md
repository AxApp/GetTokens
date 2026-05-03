# GetTokens Usage Dual Source Design

## 背景
GetTokens 当前已经存在两条彼此不同、但在产品语义上容易被混淆的数据链：

1. `sidecar /usage`
   - 表示真实经过 GetTokens sidecar/relay 的请求观测
   - 当前已用于账号卡片的近期稳定性、成功率、失败率、延迟
2. `quota`
   - 表示额度窗口或 cached usage snapshot
   - 当前用于展示 5H / 7D 剩余额度与重置时间

参考 `nolon` 的调研结果后，本轮希望把 GetTokens 的“用量统计”重新设计成双事实源：

1. `真实请求用量统计`
2. `本地用量统计`

并明确它们与 `quota` 不是同一件事。

## 目标
1. 明确 GetTokens 的双轨用量域边界。
2. 设计 `真实请求用量统计` 与 `本地用量统计` 的数据源、查询模型、缓存策略与 UI 呈现边界。
3. 明确 v1 的可交付范围，避免在当前实现和本机样本根本无法归因到 `auth-file` 的前提下承诺伪精确统计。
4. 为后续实现拆出可执行计划与测试门禁。

## 范围
- 当前 GetTokens 已有 sidecar `/usage` 链路
- 当前 GetTokens 已有 quota 链路
- 参考 `nolon` 的 `local usage / minute projection / sqlite index` 思路
- 面向 GetTokens 的设计讨论、方案裁定与 debate 记录
- 后续可扩展到 Wails DTO、前端 usage 面板、provider 本地索引器的实现计划

## 非目标
- 本轮不直接实现业务代码。
- 本轮不重写 sidecar 当前 `/usage` 统计实现。
- 本轮不把 `quota` 重新定义成 usage fact。
- 本轮不讨论 `Codex local usage` 的 `auth-file` 级归因落地；按当前实现与本机 `~/.codex` 样本，它没有可稳定连接到 `auth-file` 的标识。

## 验收标准
1. 至少形成 2 个以上有代码证据支撑的设计选项，并完成推荐裁定。
2. 明确 `真实请求`、`本地用量`、`quota` 三者边界。
3. 明确 v1 的数据模型、刷新路径、降级策略与测试面。
4. debate 结果、space README、memory 和 qmd 索引完成同步。

## 相关链接
- [GetUsageStatistics](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/usage.go)
- [sidecar config](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/sidecar/config.go)
- [account usage state](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/hooks/useAccountsUsageState.ts)
- [account usage model](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountUsage.ts)
- [quota builder](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/accounts/quota_builder.go)
- [Nolon / Codex 用量统计深挖](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-nolon-codex-usage/README.md)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-29
- 代码落地进度：
  - `Usage Desk` 已作为 `Accounts` 子 workspace 接入应用壳子
  - `ObservedRequestUsage` 已接上真实 `GetUsageStatistics`
  - `LocalProjectedUsage` 已新增独立 `GetCodexLocalUsage`，当前扫描 `~/.codex/sessions/**/*.jsonl` 与 `~/.codex/archived_sessions/**/*.jsonl`
  - `LocalProjectedUsage` 现已升级到可丢弃 SQLite 索引：保留 `cacheHit / deltaAppend / fullRebuild / fileMissing` 四个出口，当前索引落在 `~/.config/gettokens-data/codex-local-usage/usage-index-v1.sqlite`
  - 当前 SQLite 真源已从“事件级 usage details”收敛到“文件索引 + 分钟投影表”，`H5` 继续消费同一个 `GetCodexLocalUsage` DTO
  - `APP 层` 已补进程内 `LocalProjectedUsage` 快照缓存；`H5` 正常刷新页面时默认直接读取 `APP` 当前缓存，不再自动触发新一轮样本扫描
  - `APP 层` 已补后台分钟级增量刷新；只有点击 `刷新索引 / 重建索引` 才会显式触发前台刷新动作
  - 本地投影后台增量刷新间隔已进入 `Settings`，当前可选 `5 分钟 / 15 分钟 / 30 分钟 / 1 小时`
  - `H5` 已补本地投影的显式操作入口：支持 `刷新索引` 与 `重建索引`，并展示本次扫描的 `cacheHit / deltaAppend / fullRebuild / fileMissing` 统计
  - 当前 `LocalProjectedUsage` 仍只做 `codex / provider-global` 口径，未实现 `auth-file` 归因

## 当前裁定

### 共识结论
1. GetTokens 不应再把“用量”当成单一概念，而应拆成三条并列信息：
   - `ObservedRequestUsage / 真实请求用量统计`
   - `LocalProjectedUsage / 本地用量统计`
   - `QuotaSnapshot / 配额快照`
2. `ObservedRequestUsage`
   - 真源是 sidecar `/usage`
   - 当前口径保留
   - 本质是请求观测与稳定性，不是 provider 全量消耗
3. `LocalProjectedUsage`
   - 若落地，应参考 `nolon` 的 `delta reducer + minute projection + disposable sqlite index`
   - 必须按 `provider` 分域统计，不能把不同 provider 的本地 usage 混成一个总桶
   - 按当前实现与本机样本，无法归因到 `auth-file`
   - 这不是“v1 暂不支持”，而是当前本地事实源里不存在可稳定连接到 `auth-file` 的 join key，因此该归因目标本身不可实现
   - v1 只做 `provider` 级与其内部 `global` 视图
4. `QuotaSnapshot`
   - 继续独立域
   - 即使底层读取 cached usage snapshot，最终语义仍只是额度窗口，不属于 usage fact

### v1 推荐边界
1. 保留现有 `GetUsageStatistics`
2. 保留现有 `GetCodexQuota`
3. 新增一条只服务 `Codex local usage` 的独立后端链路
4. 首版不回写账号卡片，只做独立 usage 面板或详情区
5. 即使首版只实现 `Codex local usage`，数据模型、Wails API 和前端状态也必须保留 `provider` 维度

### 前端页面裁定
1. v1 前端入口仍放在 `Accounts`，不新开到 `Status` 或 `Settings`。
2. 在 `Accounts` 下新增独立的 `Usage Desk` 子工作区或等价的页面级分析区，承接双轨用量，而不是继续扩张账号卡片和账号详情模态。
3. 账号卡片继续只展示资产级信息：
   - 状态 / 失败原因
   - `recent health`
   - `quota remaining/reset`
4. `ObservedRequestUsage / LocalProjectedUsage / QuotaSnapshot` 放进 `Usage Desk` 的独立分析面，不回写账号卡片。
5. `provider`、`sourceKind`、`time range` 是 `Usage Desk` 自己的过滤条，不并入当前 `AccountsToolbar` 的账号来源筛选。
6. `provider` 和 `sourceKind` 必须在后端 usage DTO 收口，前端不再从松散 usage payload 中自行推断。

### HTML 设计稿
- [usage-dashboard-design-v01.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/usage-dashboard-design-v01.html)

### 主要风险
1. 当前账号归因依赖 `authIndex` / `apiKey` / `prefix` 启发式匹配，而本机 `~/.codex` rollout 样本只有 `cwd / git / model_provider / source / turn_context` 等信息，没有 `auth-file` 相关标识，因此本地 usage 当前无法归因到 `auth-file`。
2. 上述 `auth-file` 归因不是“后续补做一个映射层”就能解决的问题；在当前本地 session 事实源不增加新标识的前提下，它是不可实现约束，不应继续作为产品待办承诺。
3. 当前前端按账号重复扫描 usage 明细，不适合作为本地 usage 的 10x 扩展路径。
4. 若不先按 `provider` 分域，本地 usage 后续接入多 provider 时会把 `Codex / Claude / Gemini` 的事件口径混在一起，导致请求定义、时间桶和聚合语义失真。
5. 把 quota 混进 usage summary 会制造长期语义债务，回滚成本高。

### 注意事项
1. `LocalProjectedUsage` 的产品语义必须固定为 `provider/global` 本地投影，不允许在文案、设计稿、接口字段或 H5 展示里暗示“账号级 / auth-file 级精确归因”。
2. 若未来产品确实要求 `auth-file` 级归因，前提不是继续加工现有 rollout，而是先改变本地事实源写入协议，让 session 事件显式携带可稳定映射到账号资产的标识。
3. `H5` 不负责本地投影的定时刷新编排；正常页面刷新默认只读取 `APP 层` 当前内存快照，后台分钟级增量刷新由 `APP 层` 自己按设置间隔驱动。

### Provider 边界
本地 usage 的最小建模单元应是 `provider`，不是“全局本地总量”：

1. `ObservedRequestUsage`
   - 可以继续按账号近似归因
   - 但查询时也应保留 `provider` 过滤能力
2. `LocalProjectedUsage`
   - 必须先按 `provider` 分开建链路
   - 每个 provider 再决定是否支持其内部 `global` 趋势、日内桶和请求数口径
3. `QuotaSnapshot`
   - 仍是账号/凭证额度域
   - 不参与 provider 级本地 usage 汇总

### 环境确认
本机 `~/.codex` 样本已确认：

1. `session_meta` 里可见字段是 `cwd / git / id / model_provider / originator / source / timestamp`，见 [rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:1>)。
2. `turn_context` 里可见字段是 `cwd / approval_policy / sandbox_policy / model / effort / summary`，见 [rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:5>)。
3. 当前样本中没有可稳定映射到 GetTokens `auth-file` 的 `authIndex / account_id / email / plan_type / access_token / refresh_token` 一类字段。

### Debate 归档
- [20260428-gettokens-usage-dual-source-debate-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260428-gettokens-usage-dual-source/debate/20260428/gettokens-usage-dual-source-debate/20260428-gettokens-usage-dual-source-debate-v01.md)
