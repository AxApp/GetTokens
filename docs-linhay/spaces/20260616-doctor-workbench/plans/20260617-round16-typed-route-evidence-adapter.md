## Round 16 Typed Route Evidence Adapter

日期：2026-06-17

### 背景

- 问题来源：用户要求推进 Doctor Workbench 第十六轮切片，让 Doctor route evidence 优先消费 sidecar 已下发的 typed route fields，而不是继续依赖文本解析。
- 前置事实：
  - `internal/cliproxyapi/types.go` 的 `DoctorDiagnosticEvidence` 已包含 `accountKey/authId/model/source/scope/reason/routeBlocking` 等结构化字段。
  - `internal/wailsapp/doctor.go` 当前在 diagnostics 映射阶段仍把这些字段压缩成 `DoctorEvidenceRef{label,summary,refID,source}`。
  - `frontend/src/features/doctor-workbench/model/doctorWorkbench.ts` 当前 route evidence digest 只从 `label/refID/summary` 文本解析 identity。
- 当前缺口：
  - sidecar 若直接把 typed route evidence 透传到前端对象，Doctor shared digest helper 仍不会读取。
  - 现有测试覆盖了文本 fallback 与 partial text identity fallback，但没有覆盖 typed route evidence 优先路径。
  - 不能新增 repair action，也不能把 partial typed identity 升格为 route truth。

### 代码 / UI 事实位置

- Doctor evidence adapter：`frontend/src/features/doctor-workbench/model/doctorWorkbench.ts`
- Doctor preview 数据：`frontend/src/features/doctor-workbench/model/previewData.ts`
- focused tests：`frontend/src/features/doctor-workbench/tests/doctorWorkbench.test.mjs`
- entry/source guard：`frontend/src/features/doctor-workbench/tests/doctorWorkbenchEntry.test.mjs`

### 本轮目标

1. 为 `DoctorEvidenceRef` 增加只读 typed route evidence 消费面：
   - 支持顶层 typed `accountKey/authId/model/source/scope/reason/routeBlocking`；
   - 支持可选 `routeEvidence` payload；
   - typed 字段优先进入 shared digest helper。
2. 保持既有安全边界：
   - 文本解析 fallback 不退化；
   - partial typed identity 只标记 fallback，不伪造成 structured route truth；
   - 不新增 repair mutation，不伪造 route/quota authority。
3. 补失败测试并覆盖：
   - typed route evidence 优先于文本；
   - 文本 fallback 不回归；
   - partial typed identity fallback。

### BDD / 红灯场景

1. Given Doctor route evidence 同时含有误导性文本和完整 typed route payload
   When Doctor 派生 route evidence digest
   Then digest 必须优先使用 typed account/auth/model/source/scope/reason/routeBlocking。

2. Given Doctor route evidence 只有完整文本 identity
   When typed payload 缺席
   Then 仍保持既有 structured digest 与 summary 聚合结果。

3. Given Doctor route evidence 只有 partial typed identity
   When 缺失 model/source/scope 任一关键字段
   Then 只保留 fallback evidence，并标记 `partial-identity`。

### 实现边界

- 允许修改：
  - `frontend/src/features/doctor-workbench/**`
  - Doctor tests
  - `docs-linhay/spaces/20260616-doctor-workbench/README.md`
  - 本计划文件
- 不允许修改：
  - accounts/status/extension/protocol
  - dispatch/memory/AGENTS
  - repair actions / route truth / quota truth

### 验收

1. `npm --prefix frontend run test:doctor-workbench`
2. `npm --prefix frontend run typecheck`
3. `docs-linhay/scripts/check-docs.sh`
4. `git diff --check`

### 沉淀审计

- 本轮是 Doctor evidence adapter 的窄增强，优先复用已有 Route Resilience digest helper 语义。
- 若只形成 Doctor 领域内的稳定 adapter 模式，可留在 Doctor space 文档，不升级 repo-wide 规则。
