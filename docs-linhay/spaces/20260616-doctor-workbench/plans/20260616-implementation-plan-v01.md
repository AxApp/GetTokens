# Doctor Workbench Implementation Plan v01

日期：2026-06-16

## 范围与原则

本计划只覆盖 Doctor Workbench 首批任务：建立 evidence matrix、入口设计、doctor snapshot API 边界、doctor checks、Wails/root binding、frontend workspace、preview/browser 验收路径。

本期不修改 sidecar runtime 决策，不让前端重新推导 requestable、selected、fallback、quota truth。Doctor 只消费 sidecar/Wails 暴露的 diagnostics 与现有本地配置状态，并把证据组织成可跳转的诊断工作台。

## Evidence Matrix

| 场景 | 问题来源 | 当前事实位置 | 需要证明的现象 | 首批验收方式 | 本期处理 |
|---|---|---|---|---|---|
| applied but not routeable | Doctor Workbench README 验收标准 | 本地 apply 入口：`app.go` `ApplyRelayServiceConfigToLocalV2`；route 状态来自 sidecar diagnostics / channel routing | 本地配置已应用，但 sidecar route guard 或 account runtime 不可请求 | doctor check 返回 `status/reason/repairability/evidence/navigation`；前端显示并跳到账户详情或 route decisions | P1 |
| catalog visible but no provider backing | Doctor Workbench README 验收标准；OmniRoute 架构的 model registry / provider health | model catalog diagnostics：`app.go` `mapCodexModelCatalogDiagnostics`；provider/relay catalog status 测试已存在 | 模型目录可见，但 provider backing 缺失或 provider 不健康 | doctor check 聚合 model registry 与 provider health evidence，导航到 provider/catalog 相关 workspace | P1 |
| stale route guard | Doctor Workbench README 验收标准；Route resilience 共享 Route Decision Ledger | channel routing decisions：`app.go` `ListChannelRouteDecisions`、`ListChannelRouteEvents` | route guard 仍阻塞已经恢复的账号或模型 | doctor check 展示 guard age、last decision、blocked reason、repairability | P1 |
| account-store startup reconcile | README checks 列表；Status 已有 account store diagnostics 测试 | `frontend/src/features/status/tests/accountStoreDiagnostics.test.mjs` 与对应 model | 账号 SQLite 启动 reconcile / recovery 可被单独诊断 | 复用 account-store diagnostics 证据，不展示完整路径，只展示 basename 和恢复摘要 | P1 |
| runtime auth registration | README checks 列表；OmniRoute 架构 sidecar-owned runtime auth state | Codex/Claude account runtime state、channel account runtime mapping | 账号存在但 runtime auth 未注册或 provider 不可用 | doctor check 输出账号、provider、runtime source、last checked | P1 |
| provider health | README checks 列表；Quota/Provider catalog 既有状态页能力 | status provider/catalog model 和 future provider health diagnostics | provider 不健康导致 candidate pool 空或模型不可用 | doctor check 输出 provider、affected models/accounts、confidence | P2 |
| local apply mismatch | README checks 列表；Status local apply / relay local state | `frontend/src/features/status/tests/relayLocalState.test.mjs`、local apply Wails API | UI 展示的 local apply 与本地文件/sidecar 实际视图不一致 | doctor check 输出 expected/current/diff summary，导航到 local apply workspace | P1 |

证据不足的候选只允许进入调研或 backlog；进入代码实现前，每个 check 必须能指出权威来源和验收路径。

## Entry Design

首批入口采用独立工作台，不嵌入账号详情内：

- Sidebar 一级入口建议为 `doctor`，位置在 `Status` 之后或开发阶段标记为 developer-only，最终由主控按产品节奏决定是否默认开放。
- URL/hash 建议：`#doctor/workbench`，后续 detail 使用 `detail=<check-id>` 或 `modal=doctor-check:<id>`，遵守全应用 modal hash 保留规则。
- 页面主结构：
  - 顶部 `WorkspacePageHeader`：标题、snapshot freshness、刷新动作、sidecar readiness chip。
  - 左侧/顶部 filter rail：全部、Critical、Warning、Repairable、Degraded、Stale。
  - 主列表：check group、status、reason、evidence count、repairability、last checked。
  - 右侧 detail panel 或 modal：evidence refs、authority source、jump targets、safe next action。
- 视觉约束：复用 Swiss-industrial 工作台密度；不做营销 hero、不做大块 summary card、不用前端状态掩盖 sidecar readiness。

## Doctor Snapshot API

首批 Wails/root binding 设计为只读 snapshot：

```go
func (a *App) GetDoctorSnapshot(input DoctorSnapshotInput) (*DoctorSnapshot, error)
```

建议 DTO：

- `DoctorSnapshotInput`
  - `Scope string`：`all | codex | claude | accounts | routing | local_apply`
  - `IncludeEvidence bool`
  - `MaxEvidencePerCheck int`
- `DoctorSnapshot`
  - `GeneratedAtUnixMs int64`
  - `Source string`：`sidecar | wails-aggregate | preview`
  - `SidecarReady bool`
  - `Status string`：`ok | warning | critical | degraded | not_ready`
  - `Checks []DoctorCheck`
  - `Summary DoctorSummary`
- `DoctorCheck`
  - `ID string`
  - `Kind string`
  - `Title string`
  - `Status string`：`ok | warning | critical | skipped | not_ready`
  - `Reason string`
  - `Repairability string`：`none | manual | guided | automatic_candidate`
  - `Authority string`：`sidecar | wails | local_file | preview`
  - `Confidence string`：`high | medium | low`
  - `LastCheckedAtUnixMs int64`
  - `Evidence []DoctorEvidenceRef`
  - `Navigation []DoctorNavigationTarget`
- `DoctorEvidenceRef`
  - `Kind string`：`account | provider | model | route_decision | local_file | sidecar_status | log_ref`
  - `Label string`
  - `Summary string`
  - `RefID string`
  - `Source string`
- `DoctorNavigationTarget`
  - `Kind string`：`account_detail | route_decisions | local_apply | model_catalog | status | logs`
  - `Label string`
  - `Hash string`

首批不提供 mutate API。修复动作若后续需要，应另开显式 `PreviewDoctorRepair` / `ApplyDoctorRepair`，并且只能调用已有受控 Wails 能力。

## Doctor Checks

首批 checks 按只读聚合实现：

1. `account-store-startup-reconcile`
   - 权威：Wails 聚合 sidecar account-store diagnostics。
   - 验收：不泄露完整 DB path；recovery count、last endpoint、last error 摘要可见。
2. `runtime-auth-registration`
   - 权威：sidecar runtime auth state / channel account runtime state。
   - 验收：账号存在但 runtime auth 缺失时为 warning/critical。
3. `route-guard-stale-block`
   - 权威：sidecar route guard facts + route decision ledger。
   - 验收：stale guard 输出 blocked reason、age、last decision ref。
4. `model-registry-empty`
   - 权威：sidecar registry model availability / Wails model diagnostics。
   - 验收：catalog visible but no provider backing 可以定位 provider/model。
5. `provider-health`
   - 权威：sidecar provider health diagnostics。
   - 验收：provider unhealthy 关联 affected accounts/models。
6. `local-apply-mismatch`
   - 权威：Wails local file read/patch state + sidecar observed config。
   - 验收：expected/current diff summary 可见，跳转到 local apply。

## Wails / Root Binding Plan

1. 在 Wails core 内新增 doctor 聚合服务，不直接改 sidecar runtime 决策。
2. root `app_types.go` 定义 Doctor DTO，`app.go` 只做 input/output 映射。
3. 若 sidecar management API 尚无统一 diagnostics，首批 Go core 可以聚合既有只读 API，但字段必须标 `Authority` 和 `Source`。
4. 生成并归一化 `frontend/wailsjs` 后，前端只消费 `GetDoctorSnapshot`。
5. not-ready / partial failure 不抛成整页失败；snapshot 内以 `not_ready/degraded` check 表达，除非 Wails binding 本身不可用。

## Frontend Workspace Plan

首批实现顺序：

1. 纯模型：
   - `deriveDoctorWorkbenchView(snapshot)`：排序、summary、filter counts、navigation target 规范化。
   - preview data 覆盖 3 个核心验收场景。
   - 单测先固定 status order、evidence count、跳转 hash、preview 不污染 runtime source。
2. Workspace shell：
   - 新增 Doctor feature，复用 `WorkspacePageHeader`、`RefreshActionButton`、Swiss list row。
   - Wails runtime fallback：浏览器 preview 使用 explicit preview snapshot；Wails 不可用时显示 preview/source 标签。
3. Sidebar/hash：
   - 入口只在主控确认后接入 sidebar 和 page router。
   - detail/modal hash 遵守现有 canonicalizer，不能丢当前 frame 内的 `detail`/`modal` 参数。
4. Detail:
   - check detail 用右侧 panel 或全应用 modal，展示 authority、evidence、navigation、repairability。
   - 不在 detail 内直接做修复 mutate。

## Preview / Browser 验收

首批自动化验收：

- Unit：doctor pure model / preview data tests。
- Typecheck：`npm run typecheck`。
- Build：`npm run build` 或至少 focused frontend build。
- Headless browser：Vite preview 或 dev server，打开 `#doctor/workbench`，DOM 断言：
  - 三个验收场景可见。
  - source/freshness 可见。
  - check 行可跳转目标存在。
  - Wails unavailable 时使用 preview snapshot 且明确标记 preview。
- Screenshot：落到 `docs-linhay/spaces/20260616-doctor-workbench/screenshots/20260616/workbench/`。

本轮不启动真实桌面手点。只有接入 Wails binding 可见性、native 菜单、窗口生命周期或主控明确要求时，才做 dev App 实体验收。

## 当前最小切片

本轮可安全落地的最小切片：

- 新增纯前端 doctor model 与 preview data。
- 新增 focused test 固定：
  - `critical > warning > not_ready > ok > skipped` 排序。
  - summary 不把 preview source 当 runtime truth。
  - `applied but not routeable`、`catalog visible but no provider backing`、`stale route guard` 三个 preview checks 都有 evidence 和 navigation。

不做：

- 不接真实 sidebar 入口。
- 不新增 root Wails binding。
- 不生成 `wailsjs`。
- 不实现 UI。

## 风险与后续

- 风险：其他 subagent 可能同时改 channel routing / quota diagnostics DTO。Doctor API 应等主控集成后统一对齐，避免重复 DTO。
- 风险：若 sidecar 没有 route decision ledger 或 provider health diagnostics，首批 Doctor 只能 degraded 展示已有证据，不能伪造结论。
- 下一步：主控审核本计划后，按 DTO 边界拆 Go/Wails 与 frontend UI 子任务；先合并 pure model test，再接 Wails snapshot。
