# Quota Intelligence Implementation Plan v01

日期：2026-06-16

## 范围与验收

本轮首批任务只建立证据门禁、当前代码事实图谱和最小模型切片，不进入 account card 布局重构。

验收目标：

1. quota fact schema 能表达 `no quota`、`unknown`、`stale`、`denied`。
2. sidecar 是 quota authority；Wails 只映射 DTO；frontend 只消费并展示。
3. implementation plan 覆盖 sidecar quota fact schema、Wails DTO、frontend consumption、tests。
4. 最小测试证明前端消费层不会把上述状态混成一种 empty/error。

## Evidence Matrix

| 证据来源 | 当前事实位置 | 现象 / 缺口 | 首批验收方式 |
|---|---|---|---|
| space README | `docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md` | 明确要求区分 `no quota`、`quota unknown`、`cached stale quota`、`provider denied quota check`，并补 source / freshness / confidence / risk / explanation。 | 本计划列出 schema 和测试切片。 |
| 总架构文档 | `docs-linhay/dev/20260615-omniroute-capability-architecture.md` | Quota Intelligence 定位为 sidecar 产出事实、Wails 聚合、frontend 产品化表达。 | 计划中保持 authority 边界，不让前端推导运行时 blocked。 |
| domain skill quota rules | `.agents/skills/gettokens-domain-engineering/SKILL.md` | Codex API key quota refresh 必须走 sidecar `quota-refresh`；UI quota display 和 route quota filtering 必须共享 sidecar quota runtime data；stale/degraded/unknown quota 不能创建 hard block。 | 不修改路由；最小切片只消费 DTO。 |
| sidecar quota runtime | `docs-linhay/references/CLIProxyAPI/internal/gettokenshooks/quota_runtime.go` | 已有 `QuotaRuntimeState`：`status`、`stale`、`degraded_reason`、`blocked`、`block_reason`、`sources`、`windows`；缺少一层面向产品解释的 fact status / freshness / confidence / risk / explanation。 | 后续 sidecar schema 扩展围绕 `QuotaRuntimeState` 增量兼容。 |
| Wails quota bridge | `internal/wailsapp/quota.go`、`internal/wailsapp/types.go`、`app.go` | Wails 将 sidecar snake_case runtime 状态映射为 `CodexQuotaResponse` camelCase；已有 read-only `GetQuotaStatuses` 与 batch refresh job。 | Wails DTO 后续只新增透传字段，不计算 quota fact authority。 |
| Wails bridge tests | `internal/wailsapp/quota_runtime_test.go` | 已测试 read-only status 不触发 refresh，batch refresh 不走单账号 refresh。 | 后续补 DTO 字段映射测试。 |
| frontend quota model | `frontend/src/features/accounts/model/accountQuota.ts`、`types.ts` | `buildQuotaDisplay` 能读 snake/camel quota runtime，但 UI 状态只有 `unsupported/loading/error/empty/success`，无法表达 unknown/stale/denied/no-quota 的产品语义。 | 本轮新增纯模型 `resolveQuotaFact` 和 focused tests。 |
| frontend tests | `frontend/src/features/accounts/tests/accountSelectors.test.mjs`、`accountQuotaRuntime.test.mjs` | 现有测试覆盖 stale reason、route guard explain、snake_case 读取；未覆盖 quota fact 状态分类。 | 新增 `accountQuotaFact.test.mjs`。 |

## 当前代码事实图谱

```text
sidecar
  QuotaRuntimeState
    status: success | error | stale | degraded
    windows / billing / source / updated_at / last_evaluated_at
    stale / degraded_reason
    blocked / block_reason / sources
    route guard sync: only fresh success can write quota-empty

Wails core
  internal/wailsapp.App.GetQuotaStatuses(accountKeys)
    -> management GET /v0/management/gettokens/quota-status?account_keys=...
    -> []cliproxyapi.QuotaRuntimeState
    -> CodexQuotaResponse camelCase DTO

root Wails binding
  app.go GetQuotaStatuses / GetAllQuotaStatuses / GetQuotaStatus
    -> frontend/wailsjs/go/main/App.js
    -> frontend/wailsjs/go/models.ts CodexQuotaResponse

frontend
  useAccountsQuotaState
    -> Wails quota status / refresh job
  accountQuota.buildQuotaDisplay
    -> normalizes runtime DTO for cards/detail
  account detail / usage/status/doctor future surfaces
    -> should consume shared quota fact model, not recompute authority
```

## Proposed Quota Fact Schema

Sidecar should extend quota runtime with an explicit `fact` object while preserving current `QuotaRuntimeState` fields for compatibility:

```json
{
  "account_key": "acct_...",
  "status": "success",
  "fact": {
    "state": "available|no_quota|unknown|stale|denied|unsupported",
    "source": "quota-runtime|provider-quota-curl|auth-file-usage|billing-only|cache",
    "freshness": "fresh|stale|unknown",
    "confidence": "high|medium|low|none",
    "risk": "none|warning|blocking|denied|unknown",
    "explanation": "human-readable sanitized summary",
    "observed_at": "2026-06-16T08:00:00Z",
    "expires_at": "2026-06-16T13:00:00Z",
    "evidence_refs": ["quota.window:five-hour", "route_guard:quota-empty"]
  }
}
```

State rules:

| state | sidecar criteria | route guard effect |
|---|---|---|
| `available` | fresh successful quota with at least one positive display window or billing-only evidence that does not prove exhaustion | no new quota guard |
| `no_quota` | fresh successful quota with all known quota windows exhausted and a future reset boundary | sidecar may write `quota-empty` |
| `unknown` | no runtime state, missing provider quota capability, or no displayable windows with no denial evidence | no quota guard |
| `stale` | cached state or refresh failed while preserving old payload | no new quota guard and must not clear fresh quota-empty early |
| `denied` | provider refused quota check, e.g. 401/402/403, invalid auth, deactivated workspace, or quota probe permission denied | route decision depends on auth/route guard class, not frontend |
| `unsupported` | account type has no quota/billing probe configured | no quota guard |

Privacy rule: `explanation` must be sanitized. It may include provider status code, normalized reason code, source, and timestamp, but not prompt, request body, credential, cookie, bearer token, raw curl output, or raw upstream error body.

## Wails DTO Plan

1. Add optional DTO fields to `internal/cliproxyapi.QuotaRuntimeState` and `internal/wailsapp.CodexQuotaResponse` only after sidecar emits `fact`.
2. Keep Wails mapping one-to-one:
   - `fact.state` -> `quotaFact.state`
   - `fact.source` -> `quotaFact.source`
   - `fact.freshness` -> `quotaFact.freshness`
   - `fact.confidence` -> `quotaFact.confidence`
   - `fact.risk` -> `quotaFact.risk`
   - `fact.explanation` -> `quotaFact.explanation`
   - `fact.observed_at/expires_at/evidence_refs` -> camelCase fields
3. Do not compute `no_quota` or `denied` from local quota bars inside Wails.
4. Add focused Go tests:
   - sidecar snake_case `fact` maps to Wails camelCase.
   - missing `fact` keeps backward compatibility.
   - stale cache fallback keeps `fact.state=stale` when sidecar provides it.

## Frontend Consumption Plan

1. Introduce a shared pure model function for current and future surfaces:
   - Input: `AccountRecord`, optional `CodexQuotaState`.
   - Output: `QuotaFactDisplay`.
2. Prefer sidecar-provided `quotaFact` when present.
3. Until sidecar emits `quotaFact`, fallback classification may only describe display semantics from existing DTO fields:
   - unsupported account -> `unsupported`
   - no quota state / loading -> `unknown`
   - stale/degraded cached state -> `stale`
   - denied-looking degraded reason/status/source -> `denied`
   - fresh exhausted known windows -> `no-quota`
   - positive known windows -> `available`
4. The fallback must not drive route eligibility or `blocked`; it only prevents UI copy from flattening states.
5. Account list, account detail, usage/status, and doctor workbench should consume this same model.

## Tests

首批：

- `frontend/src/features/accounts/tests/accountQuotaFact.test.mjs`
  - unsupported/no quota capability -> `unsupported`
  - missing runtime payload -> `unknown`
  - fresh exhausted windows -> `no-quota`
  - stale cached state -> `stale`
  - provider denied check -> `denied`

后续：

- `internal/wailsapp/quota_runtime_test.go` 增加 `quotaFact` DTO 映射。
- sidecar quota runtime tests 增加 fact builder：
  - fresh exhausted writes fact `no_quota`
  - stale/degraded does not write quota-empty
  - provider denied keeps sanitized explanation
- frontend browser preview fixtures 增加四类状态样本，供 account detail / doctor surfaces 验收。

## 首批实现切片

本轮已选择前端纯模型切片作为最小安全落点：

1. 新增 `QuotaFactDisplay` 类型。
2. 新增 `resolveQuotaFact(account, state)`。
3. 新增 focused test 覆盖 `no-quota / unknown / stale / denied` 的区分。

该切片不改变现有 UI，不改变 sidecar/Wails API，不参与 runtime route guard。

## 风险与下一步

风险：

1. fallback 分类只能作为旧 DTO 兼容显示，不是最终 authority。
2. denied 识别基于 sanitized reason/status/source，容易受 provider 文案变化影响；最终应由 sidecar fact builder 输出结构化 reason code。
3. 当前 `unsupported` 与 `unknown` 仍依赖 frontend 的 quota capability 判断；后续 doctor/workbench 应优先消费 sidecar account capability。

下一步：

1. 在 sidecar fork 中实现 `QuotaFact` builder，并给 management `quota-status` 输出 `fact`。
2. Wails DTO 增量透传 `quotaFact`，补 Go 映射测试。
3. 前端 `resolveQuotaFact` 改为优先读 sidecar `quotaFact`，fallback 保留兼容旧 sidecar。
4. 更新 account detail / usage/status / doctor workbench 统一消费入口和 preview fixtures。
