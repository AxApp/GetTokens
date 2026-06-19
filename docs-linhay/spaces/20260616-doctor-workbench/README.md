# Doctor Workbench

## 背景

本 space 承接 OmniRoute 借鉴能力评估中的近期方向：`doctor workbench`。

当前 GetTokens 的排障信息分散在账号详情、channel routing、live sessions、sidecar log、status、模型目录与本地配置应用入口中。需要一个统一诊断工作台，把 sidecar readiness、account-store、runtime auth、model registry、routeability、quota 和 local apply 一起汇总。

## 目标

1. 设计并实现 doctor snapshot API。
2. 建立结构化 doctor checks。
3. 前端提供可跳转的诊断工作台。

## 范围

- sidecar / Wails doctor snapshot。
- checks：account-store startup reconcile、runtime auth registration、route guard stale block、model registry empty、provider health、local apply mismatch。
- frontend doctor workspace。
- 自动化验证与必要的 headless browser screenshot。

## 非目标

- 不替代账号详情和 route workbench。
- 不做真实桌面手点作为默认硬门槛，除非涉及 native/Wails runtime 可见性。
- 不让 doctor 直接修改运行时状态；修复动作必须显式且受控。

## 验收标准

- `applied but not routeable`、`catalog visible but no provider backing`、`stale route guard` 能在 doctor workbench 直接定位。
- 每个 check 至少返回 status、reason、repairability、evidence。
- 前端能从 check 跳到账户详情、route decisions 或 local apply 相关页面。
- focused tests 与浏览器/DOM 验收通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-doctor-workbench`
- worktree：`../GetTokens-worktrees/20260616-doctor-workbench/`

## 相关链接

- 总架构：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)

## 当前状态
- 状态：round27-sidecar-manifest-docs-gate；并行记录 round26-doctor-quota-helper-convergence
- 最近更新：2026-06-18
- 当前输出：Doctor preview UI、`GetDoctorSnapshot` Wails/root/frontend 只读闭环、runtime-first / preview-fallback、headless DOM / screenshot 验收；主仓新增对 CLIProxyAPI reference sidecar 只读 `GET /v0/management/gettokens/doctor-diagnostics` 的消费，sidecar not ready / `404` / `501` 时回退既有 `wails-aggregate`；第十轮把 quota-related evidence/source label 对齐到共享 `QuotaFactEvidenceView`；第十二轮把 Doctor `route_guard_dropped_reasons` / route 类 evidence 收敛为只读结构化 view，在仅消费 `label/refID/summary/source` 的前提下归一化 stable target identity、reason summary、route blocking label，并在 reason 文案变化时按 stable target 聚合展示；第十三轮把这些结构化 route 字段显式渲染进 Doctor evidence card，仅当 `targetKey` 存在时展示 target/account/auth/model/scope/routeBlocking 只读 block，缺字段继续保守 fallback；第十四轮把 Doctor route evidence identity/digest 改为尽量复用 Route Resilience 的 digest/helper 语义或窄 adapter，保证 Doctor 与 route/account detail 对同一 dropped reason target 的 identity 一致，reason 文案变化不再导向独立 Doctor target；第十五轮补了 stronger preview/DOM gate：preview snapshot 同屏覆盖 structured route target 与 partial identity fallback，页面显式标记 read-only / mutation surface none，`docs-linhay/scripts/check-doctor-workbench-preview.mjs` 对 structured markers、partial fallback、无 repair handler 做 headless 检查，并支持归档 snapshot/screenshot fallback；第十六轮进入 typed route evidence adapter：Doctor 前端将优先消费可选 typed route fields / `routeEvidence` payload，并继续保留文本 fallback 与 partial identity fallback；第十七轮补齐 Wails/root DTO passthrough：`DoctorEvidenceRef` 只读透传 `accountKey/accountID/authId/model/scope/reason/routeBlocking/routeEvidence`，aggregate `doctorRouteDecisionCheck` 从 route dropped reasons 填 typed payload，root mapper 和 generated binding 不再丢字段，且仍不新增 repair/mutation handler；第十九轮增强 CLIProxyAPI reference sidecar doctor diagnostics：route evidence 顶层与 nested `droppedReason` 均输出 typed `accountKey/accountId/authId/source/scope/reason/model/expiresAt/updatedAt/routeBlocking`，quota evidence 输出防御性脱敏与深拷贝后的 typed `quotaFact`，缺 fact 时保持 `not_ready`，不从 `windows/blockReason` 推导 authority truth；第二十轮在 main/Wails/root/frontend consumer 中透传 nested `droppedReason`，Doctor Workbench 只从 `droppedReason` 或 legacy `routeEvidence` 生成结构化 route target，缺 typed evidence 时显示 unknown/non-authoritative，不把顶层字段、summary、label、refID 文本升级成 route/quota truth；第二十二轮把 browser-preview fixture 的 structured route evidence 改成 nested `droppedReason` 权威载荷，并保留冲突文本字段，focused gate 证明预览/桥接路径也不会丢 nested payload；第二十三轮把 `docs-linhay/scripts/check-doctor-workbench-preview.mjs` 扩展为同时读取 `previewData.ts`，在 archived/headless gate 中检查 nested `droppedReason` fixture、冲突文本和无 legacy `routeEvidence`；第二十五轮补强 CLIProxyAPI reference sidecar smoke provenance manifest，记录 source commit/dirty 状态、binary path、sha256、commands、timestamp 与 test-only / not-release-artifact release 边界；第二十六轮并行补强 sidecar smoke reproducibility manifest，把 `deterministicSourceMetadata` 与 `volatileBuildMetadata` 分离，并新增 manifest checker，明确 binary sha 因 `BuildDate` timestamp 等 volatile 字段预期变化；第二十七轮把 manifest checker 收敛成 docs gate：新增 stable fixture manifest，`docs-linhay/scripts/check-docs.sh` 只校验 fixture，不重建 sidecar；checker 额外锁定 `binarySha256Volatile=true` 与 `dirtyStatusEvidenceOnly=true`，同时保留 `latest` / 显式路径模式校验 `/private/tmp` 最新 smoke manifest；2026-06-20 UI 迁移追加：Doctor Workbench 主 summary、safe action surface、ledger、source boundary、filter、check list、route evidence 和 core acceptance rail 统一到 `--gt-*` quiet shell，新增源码门禁锁住 `data-doctor-workbench-shell="quiet"`、`data-doctor-workbench-check-list`、`data-doctor-workbench-core-acceptance`，并禁止旧粗边框、hard shadow、`bg-main/bg-surface` 和 heavy uppercase 回退
- 预览验收产物：
  - preview hash：`#frame=codex&workspace=doctor-workbench`
  - 脚本：`docs-linhay/scripts/check-doctor-workbench-preview.mjs`
  - DOM 归档：`plans/20260617-round15-doctor-workbench-preview-snapshot-v01.md`
  - 截图：`screenshots/20260617/workbench/20260617-doctor-workbench-baseline-v01.png`
- Round20 plan：`plans/20260617-round20-typed-diagnostics-consumer.md`
- Round21 plan：`plans/20260617-round21-typed-binding-regression-gate.md`
- Round22 plan：`plans/20260617-round22-dev-bridge-snapshot-fixture-gate.md`
- Round23 plan：`plans/20260617-round23-preview-gate-typed-route-check.md`
- Round24 binding plan：`plans/20260617-round24-wails-binding-generated-surface-consistency.md`
- Round25 smoke provenance plan：`plans/20260617-round25-sidecar-smoke-provenance-manifest.md`
- Round26 smoke reproducibility plan：`plans/20260618-round26-sidecar-smoke-reproducibility-manifest.md`
- Round26 quota helper convergence plan：`plans/20260618-round26-doctor-quota-helper-convergence.md`
- Round27 manifest docs gate plan：`plans/20260618-round27-sidecar-manifest-docs-gate.md`
- Final Completion Wave sidecar clean source comparison plan：`plans/20260618-final-completion-wave-sidecar-clean-source-comparison.md`
- Round21 输出：新增 root / Wails DTO JSON contract 与 `frontend/wailsjs` generated binding source gate，确认 nested `droppedReason` 在 `internal/wailsapp`、root `main.App` DTO、root mapper、generated `models.ts`、Doctor frontend typed model 中保持同步；本轮仍只读，不新增 repair mutation。
- Round22 输出：browser-preview snapshot fixture 直接携带 nested `droppedReason`，并通过 `doctorWorkbench.test.mjs` 证明派生 target/reason/blocking 来自 nested typed payload，不来自冲突文本；本轮仍只读，不新增 repair mutation，不启动 dev App。
- Round23 输出：preview gate 脚本不再只依赖 DOM marker；即使走 archived snapshot fallback，也会读取 browser-preview fixture 源文件并检查 nested `droppedReason.accountKey/authId/model/source/scope/reason/routeBlocking`、冲突文本和该 fixture 上没有 legacy `routeEvidence`；本轮仍只读，不新增 repair mutation，不启动 dev App。
- Round24 binding 输出：补强 generated surface binding gate，持续检查 `internal/wailsapp`、root `app_types.go`、root mapper、`frontend/wailsjs/go/models.ts` 与 Doctor frontend model 对 nested `droppedReason` 的 typed passthrough；本轮不运行 Wails generator、不启动 dev App、不新增 repair mutation。
- Round25 smoke provenance 输出：`docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 生成 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round25-smoke-provenance.json`，manifest 只作为 dirty reference rebuild smoke 的测试证据，不能进入 release pipeline 或 app bundle。
- Round26 smoke reproducibility 输出：`docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh` 生成 `/private/tmp/gettokens-cliproxyapi-sidecar-smoke/cli-proxy-api-round26-smoke-manifest.json`，manifestVersion=2 并把 deterministic source metadata 与 volatile build metadata 分开；`scripts/check-sidecar-smoke-manifest.mjs` 持续断言字段分类、test-only / not-release-artifact / releasePipelineEligible=false 与 binary non-deterministic 边界。
- Round26 quota helper 输出：新增 `model/quotaEvidenceAdapter.ts` 作为 Doctor typed explicit `quotaFact` 唯一消费入口；`doctorWorkbench.ts` 不再直接访问 `evidence.quotaFact`；quota static gate 只允许 adapter 单文件例外，普通 Doctor model 直接读取 `payload.quotaFact` 会失败；Doctor tests 覆盖无 typed fact 时不从 `summary/windows/blockReason/usageTotals` 推导 authority。
- Round27 manifest docs gate 输出：新增稳定 fixture `docs-linhay/references/CLIProxyAPI/fixtures/sidecar-smoke/cli-proxy-api-round26-smoke-manifest.fixture.json` 供 docs gate 使用；`docs-linhay/scripts/check-docs.sh` 新增 fixture mode 校验，不再要求先 build sidecar；checker 同时支持 `fixture`、`latest` 和显式路径，并强制 `reproducibilityBoundary.binarySha256Volatile=true` 与 `releaseBoundary.dirtyStatusEvidenceOnly=true`。
- Final Completion Wave sidecar clean comparison 输出：`gettokens-sidecar-build-smoke.sh` 在 dirty primary smoke 后会尝试为同 commit 创建 `/private/tmp` detached clean worktree 并生成 clean comparison manifest；latest manifest 通过 `sourceState.classification=dirty-source`、`sourceState.artifactClass=volatile-test-binary`、`sourceStateComparison.cleanComparisonAvailable=true` 区分 dirty source evidence、clean source smoke result 与 volatile binary。`check-sidecar-smoke-manifest-gate-integration.test.mjs` 已改为备份/恢复 `/private/tmp` latest，避免 fixture gate 覆盖真实 smoke evidence。
- 下一步：主控聚合测试可继续确认 Wails binding generation 后 `droppedReason` 字段不被移除；若后续 route evidence block 继续增密，可再补文本截断与桌面宽度下的密度快照断言；是否把同一 typed diagnostics evidence model 扩到 usage / status 相关 workspace，留给对应 space 单独评估；Doctor 侧继续保持只读展示模型，不回退到本地伪造 route/quota authority；Doctor route evidence 若只有 partial identity 或缺 nested typed payload，仍保守 fallback，不把缺失 model/source/scope 的文本或顶层字段提升成 route truth；Doctor quota evidence 只通过 `quotaEvidenceAdapter.ts` 消费 typed explicit `quotaFact`
