# 20260617 Round 12 Enable State Contract

日期：2026-06-17

## 1. 目标

在现有 `Extension Registry` 只读 management UI 上补一层 v0 `enable state` 解释合约：

1. 定义前端只读 `enable state` 词汇。
2. 定义只读 `action availability` 与 reason 文案。
3. 固化 schema/example artifact，并让 contract validator 对 README/plan/artifact 做一致性 gate。
4. 仅展示 affordance，不接 mutation，不写任何配置。

## 2. 边界

明确不做：

1. 不改 Go / Wails / root binding。
2. 不写 enable / disable，不读写 Codex config。
3. 不执行 capability，不接 marketplace。
4. 不新增 runtime DTO；只基于现有 snapshot 的 `state`、`compatibility`、`diagnostics`、`readOnly` 做前端派生。

## 3. 证据门禁

### 3.1 问题来源

- 当前 space README 已记录 registry 页面仍为 read-only snapshot 浏览。
- 用户要求本轮只定义并展示 enable-state contract，不进入真实 mutation。

### 3.2 代码 / UI 事实位置

- `frontend/src/features/gettokens-extension-registry/model.ts`
  - 仅输出 summary、registry state label、diagnostic flatten 结果。
- `frontend/src/features/gettokens-extension-registry/GetTokensExtensionRegistryFeature.tsx`
  - 仅显示 registry `state` badge，没有 enable-state badge、action availability 或原因。
- `frontend/src/features/gettokens-extension-registry/featureSource.test.mjs`
  - 当前只守护“无 mutation binding / marketplace”，未校验 enable-state affordance。

### 3.3 当前缺口

1. `readonly-compatible` 无法被解释成“当前 active view 等价 enabled，但本轮仍只读”。
2. `invalid` / `readonly-incompatible` 无法区分为 blocked 还是 disabled。
3. 后续若 runtime 引入 `disabled` / `pending`，页面没有稳定展示语义。

### 3.4 本轮验收路径

1. `model.test.mjs`
   - 证明 extension state、compatibility、diagnostics 可映射到 enable state 与 action availability。
2. `featureSource.test.mjs`
   - 证明页面只展示 read-only affordance，没有 enable/disable handler、mutation binding 或 marketplace。
3. `check-omniroute-contract-artifacts.mjs`
   - 证明 enable-state schema/example 与 README/round12 plan/Phase 1 计划词汇一致。
   - 对 `enable-state-v0.valid.json` 执行本地 schema-level validation。
   - 对 invalid fixture 证明以下变更会失败：状态枚举漂移、`actionAvailability` 枚举漂移、必填字段缺失。
4. 运行：
   - `node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs`
   - `node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs`
   - `node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`
   - 如涉及 TS 类型：`npm --prefix frontend run typecheck`
   - `docs-linhay/scripts/check-docs.sh`
   - `git diff --check`

## 4. v0 合约草案

### 4.1 Enable State

| Derived state | 触发条件 | 含义 |
| --- | --- | --- |
| `enabled` | `state = readonly-compatible` 且无阻塞诊断 | 当前只读 active view 可见，语义上等价已启用。 |
| `disabled` | `state = disabled` 或显式 disabled 类诊断 | 已登记但未进入 active view。 |
| `blocked` | `invalid`、`readonly-incompatible`、error 级阻塞诊断 | 当前不能启用，需先修复契约/兼容性/冲突。 |
| `pending` | `state = pending` 或 pending 类诊断 | 等待外部条件完成，本轮不允许操作。 |
| `readonly-unsupported` | 无法从 snapshot 判定真实启停，或仅能确认“此切片不支持修改” | 作为保守兜底状态。 |

### 4.2 Action Availability

| Availability | 含义 |
| --- | --- |
| `read-only` | 理论上有启停语义，但本轮切片只允许查看原因。 |
| `disabled` | 当前不存在可执行动作，因为状态被阻塞、待定或语义不支持。 |

### 4.3 Reason 输出

reason 至少包含：

1. 稳定 `code`
2. 简短 `label`
3. 用户可见 `message`

首轮 reason 来源只允许：

1. extension/capability diagnostics
2. compatibility status
3. read-only slice 限制

### 4.4 Artifact Gate

本轮固定 artifact：

1. `schemas/gettokens-extension-enable-state-v0.schema.json`
2. `examples/enable-state-v0.valid.json`
3. `examples/enable-state-v0.invalid-enum.json`
4. `examples/enable-state-v0.invalid-action-availability.json`
5. `examples/enable-state-v0.invalid-missing-required.json`

artifact 必须完整覆盖：

1. `enabled`
2. `disabled`
3. `blocked`
4. `pending`
5. `readonly-unsupported`
6. `action availability = read-only | disabled`

变更这些词汇时，README、本文档和 validator 必须同轮同步。
invalid fixture 必须持续证明 schema gate 会拒绝未知 state / availability 和缺失 required fields。

## 5. 实施顺序

1. 先补失败测试，固化 mapping 和 source 守护。
2. 再在 model 中派生 enable-state / action-availability / reasons。
3. 最后在 feature 中加 badge 与 disabled affordance，不新增任何 mutation handler。
