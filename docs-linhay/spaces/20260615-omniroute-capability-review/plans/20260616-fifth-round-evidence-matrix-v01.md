# Fifth Round Evidence Matrix v01

日期：2026-06-16

## 范围

本矩阵只覆盖五个 OmniRoute-derived space：

1. `20260616-route-resilience-v2`
2. `20260616-quota-intelligence-dashboard`
3. `20260616-doctor-workbench`
4. `20260616-extension-contract-v0`
5. `20260616-protocol-bridge-surfaces`

其他工作区 dirty change 属于其他需求，不作为本轮实现、回滚或验收对象。

## Evidence Matrix

| Space | 问题来源 | 当前事实位置 | 当前缺口 | 下一切片验收 | 反证条件 |
|---|---|---|---|---|---|
| Route Resilience v2 | README 要求 explain / probe / recent decisions 共享 dropped reasons | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/channel_routing_explain.go`、`channel_routing_decisions.go`、主仓 channel-routing A3 plan | recent decisions 与 explain 已有 structured reasons；probe / dry-run diagnostics 尚未证明消费同一结构 | sidecar focused test 覆盖 probe 输出 `droppedReasons`，且 model scope 不扩大成 provider/account scope | probe 仍只输出 trace 字符串，或从 trace 前端推导 structured truth |
| Route Resilience v2 | README 要求 operator controls | `route_guard.go`、A1/A2/A3 plans | clear transient lockout / bounded reconcile / routeability recheck 尚未设计成受控 action | A4 先记录 operator controls 的 bounded API 与权限，不实现 mutate | 直接新增无权限的前端清理按钮或绕过 sidecar 修改候选池 |
| Quota Intelligence | README 要求同一账号在列表、详情、诊断页 quota 口径一致 | `frontend/src/features/accounts/model/accountQuota.ts`、A3 quota fact plan | `observedAt`、`expiresAt`、`evidenceRefs` 已透传但未在 account/detail/doctor/usage 面形成稳定展示标准 | focused frontend tests 证明 UI 消费 sidecar fact evidence，缺字段时保持兼容 fallback | 前端根据 `windows/status` 重新生成 authority fact，或把缺失 evidence 当成无额度结论 |
| Doctor Workbench | README 要求 frontend 可跳转诊断工作台与浏览器/DOM 验收 | `internal/wailsapp/doctor.go`、`frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`、Doctor A2 plan | `GetDoctorSnapshot` 已只读闭环；缺 headless screenshot / DOM 验收脚本 | headless browser 脚本打开 preview/runtime fallback surface，截图归档到 doctor space，DOM 断言 `source=preview` 不伪造 runtime | 可见浏览器抢焦点，或浏览器 preview 被当作 Wails runtime 绑定验收 |
| Extension Contract v0 | artifacts plan Phase 1 要求只读 registry | `schemas/gettokens-extension-v0.schema.json`、`examples/*.json`、extension spec | 已有 schema/examples；缺 Phase 1 read-only registry 实现计划与验收输入 | plan 固化 registry snapshot DTO、validation/conflict 状态、focused tests 与不做项 | 进入 JS hook / marketplace / Codex Skills-MCP 保存链路，或让 extension 代码进入 hot path |
| Protocol Bridge Surfaces | README 下一步为 scoped auth / audit runtime 与 MCP adapter | `schemas/bridge-surface-v1.schema.json`、`canonical-operations-v01.json`、bridge spec | 已有 canonical schema；缺 scoped auth / audit runtime model 与 adapter 前置门禁 | plan 固化 scope grant、audit envelope、authority map、contract tests；MCP adapter 仍不实现 | bridge 层保存 candidate pool、route state、quota truth，或 transport adapter 自创字段成为事实标准 |

## 第五轮执行顺序

1. 先完成 Extension / Protocol 的纯方案补齐，因为两者不影响当前 route/quota/doctor DTO。
2. Route A4 只在 CLIProxyAPI reference 内推进 probe structured reasons，不改主仓 Wails/frontend。
3. Quota / Doctor UI evidence 与 screenshot 切片共享前端写入面，应串行处理，避免和其他 frontend dirty work 冲突。
4. 每个切片收尾都必须更新对应 space README / plan，并跑 `docs-linhay/scripts/check-docs.sh` 与 `git diff --check`。

## 本轮不做

1. 不触碰正式版 `/Applications/GetTokens.app`。
2. 不把 browser preview 当作 native/Wails runtime 绑定验收。
3. 不在 extension / protocol bridge 中引入任意执行、JS hook、marketplace 或新 route/quota truth。
4. 不处理五个 space 之外的 dirty change。
