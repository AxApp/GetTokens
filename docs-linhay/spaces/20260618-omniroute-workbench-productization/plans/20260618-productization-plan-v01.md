# OmniRoute Workbench Productization Plan v01

日期：2026-06-18

## 推荐方向

把下一阶段定位为“OmniRoute Workbench v1”，主入口放在 Doctor Workbench 一侧，目标是让用户从一个地方理解请求失败、账号不可用、额度异常和扩展配置风险。

本计划只做产品化入口和用户故事闭环，不继续横向扩底层能力。

## Scope

1. 新增或改造一个明确入口：`OmniRoute Workbench` / `Doctor Workbench`。
2. 汇总四类用户可理解模块：
   - Route health：为什么 route 被挡、影响 account/auth/model/scope、最近 dropped reason、可否 recheck。
   - Quota health：quotaFact 是否存在、状态是否 authoritative、缺失 fact 的非权威提示。
   - Extension config impact：enabled extension 对 Skills/MCP config 的 dry-run diff、redaction、validation。
   - Evidence ledger：最近 route action / staged apply / diagnostics 结果。
3. 打通导航：
   - Doctor -> account detail；
   - Doctor -> channel route decisions；
   - Doctor -> extension registry；
   - Doctor -> status/quota section。
4. 保留现有安全边界：
   - sidecar 是 route/quota authority；
   - 前端只消费 typed evidence/helper；
   - config apply 默认只做 dry-run / temp staged transaction；
   - mutation action 必须可见、可追踪、可失败。

## Non-Scope

1. 不做真实 `~/.codex/config.toml` 写入。
2. 不做插件 marketplace。
3. 不执行任意 extension capability。
4. 不做自动修复 daemon。
5. 不新增外部 service 或 Node gateway。
6. 不把 Protocol Bridge 做成最终用户可配置产品面。

## Evidence Matrix

| 场景 | 问题来源 | 当前代码/文档事实 | 目标行为 | 验收方式 |
|---|---|---|---|---|
| 用户不知道账号为什么不可用 | Final Completion Wave 新会话入口 | Doctor / Route / Account detail 各有局部 evidence | Workbench 展示 route blocking reason、scope、target、latest evidence 和导航 | frontend model test + DOM/preview gate |
| 用户不知道额度结论是否可信 | Quota Intelligence space | `quotaFact` authority 已建立，但分散在 Status/Account/Doctor | Workbench 显示 explicit fact / missing fact / stale / denied，并标明 non-authoritative | quota helper tests + static gate |
| 用户不知道扩展配置会改什么 | Extension Contract space | dry-run、patch plan、staged temp transaction 已完成 | UI 展示 Skills/MCP diff、redaction、validation、确认状态，不写真实 config | extension model tests + Wails tests |
| 用户需要安全操作下一步 | Route action ledger / staged apply helper | `RunRouteResilienceAction` 与 staged temp apply 已有受控边界 | 只展示可执行的 recheck / dry-run / staged apply，失败原样可见 | focused Go + frontend action state tests |

## BDD Scenarios

1. Given 一个账号已应用但不可 routeable
   When 用户打开 OmniRoute Workbench
   Then 页面显示 blocking scope、account/auth/model、latest dropped reason、authority source，并提供跳到账户详情和 route decisions 的入口。

2. Given sidecar 返回 explicit `quotaFact`
   When Workbench 渲染 quota health
   Then 页面显示 authoritative quota 状态、freshness、confidence、risk 和 evidence refs。

3. Given payload 缺少 explicit `quotaFact` 但包含 windows / usage totals / block reason
   When Workbench 渲染 quota health
   Then 页面只能显示 non-authoritative missing fact，不得推导 no quota。

4. Given extension registry 中存在 enabled extension
   When 用户查看 config impact
   Then 页面展示 dry-run patch plan、redacted snippet 和 validation，不读取或写入真实 Codex config。

5. Given 用户执行 route recheck
   When sidecar 返回 applied / failed / not_implemented
   Then Workbench 把结果写入当前操作视图，并能看到 ledger/audit id 或失败原因。

6. Given staged config apply verify 失败
   When UI 展示结果
   Then 页面明确显示 rollback 结果，不把失败描述为已应用。

## Implementation Plan

### Phase 1：Information Architecture and View Model

目标：先定义 Workbench 聚合模型和页面结构，不新增真实 mutation。

改动范围：
- `frontend/src/features/doctor-workbench/model/**`
- `frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx`
- 必要时新增 `frontend/src/features/omniroute-workbench/**`，但优先复用 Doctor 现有 feature。

验收：
- route/quota/extension 三类 preview fixture 能生成同一个 workbench view model；
- missing quota fact 仍保持 non-authoritative；
- route evidence 继续复用 existing digest helper；
- extension impact 复用 dry-run view model，不复制 patch plan parser。

执行记录：

- 已实现 read-only `OmniRoute Workbench v1` summary model：`deriveOmniRouteWorkbenchProductizationView`。
- 已在 Doctor Workbench 顶部增加四类 signals：Route health、Quota health、Extension impact、Evidence ledger。
- 已新增 preview quota facts，覆盖 explicit quotaFact 与 missing explicit quotaFact 的非权威提示。
- Extension impact 只使用现有 dry-run preview 和 `deriveGetTokensExtensionCodexConfigDryRunView`，不读取或写入真实 `~/.codex/config.toml`。
- 页面只渲染导航和证据摘要，不新增 mutation action。

### Phase 2：User-Facing Entry and Navigation

目标：让用户能稳定进入页面，并从异常卡片跳转到对应细节。

改动范围：
- Codex / Status / Account sidebar 或 workspace route；
- hash persistence；
- Doctor navigation cards。

验收：
- `#frame=codex&workspace=doctor` 或最终选定入口可稳定打开；
- route item 可跳 account detail / route decisions；
- quota item 可跳 status/account detail；
- extension item 可跳 extension registry；
- hash canonicalizer 不丢 modal/detail 参数。

### Phase 3：Safe Action Surface

目标：把现有受控 action 暴露成可理解操作，不新增自动修复。

改动范围：
- route recheck / bounded reconcile action state；
- extension dry-run / staged temp transaction result display；
- action pending / success / failure / rollback UI。

验收：
- action 不在缺 stable target 时出现；
- sidecar `not_implemented` 原样可见；
- route action history 按 target 绑定；
- staged apply 只允许 explicit temp/test target；
- UI 不出现真实 Codex config 写入入口。

### Phase 4：Acceptance and Screenshots

目标：形成可重复验收证据。

改动范围：
- `docs-linhay/scripts/check-doctor-workbench-preview.mjs` 或新增 workbench preview gate；
- screenshots 归档到本 space；
- README / memory 更新。

验收：
- headless DOM 或 archived fallback 检查四类核心场景；
- 截图路径固定在 `docs-linhay/spaces/20260618-omniroute-workbench-productization/screenshots/`；
- docs-check 和 diff-check 通过。

## Test Plan

Focused tests:

```bash
npm --prefix frontend run test:unit -- --run frontend/src/features/doctor-workbench/tests
npm --prefix frontend run test:unit -- --run frontend/src/features/channel-routing/tests/channelRouting.test.mjs frontend/src/features/accounts/tests/accountPresentation.test.mjs
npm --prefix frontend run test:unit -- --run frontend/src/features/gettokens-extension-registry
node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
node docs-linhay/scripts/check-wails-binding-surface.mjs
CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs
```

本次 read-only slice 已运行：

```bash
npm --prefix frontend run test:doctor-workbench
npm --prefix frontend run typecheck
node --test frontend/src/features/gettokens-extension-registry/model.test.mjs frontend/src/features/gettokens-extension-registry/featureSource.test.mjs
node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs
node docs-linhay/scripts/check-wails-binding-surface.mjs
CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs
bash docs-linhay/scripts/check-docs.sh
git diff --check
```

本 slice 已扩展 Doctor preview gate：在无 Chrome 环境下继续使用 archived snapshot/screenshot fallback，同时通过源码与 fixture 检查锁住 `data-omniroute-workbench-*` summary markers、explicit quotaFact fixture 与 Extension dry-run 接线。

后续进入 Safe Action Surface 前仍需补真实 action result 状态、pending/failure/rollback UI 和对应测试；本 slice 仅完成 read-only summary。

Broader validation before handoff:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./internal/wailsapp ./internal/cliproxyapi ./internal/gettokensextensions
node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs
bash docs-linhay/scripts/check-docs.sh
git diff --check
```

## Review Slicing

1. `docs: define omniroute workbench productization requirements`
2. `feat(doctor): add workbench summary model and preview states`
3. `feat(doctor): wire route and quota explanation cards`
4. `feat(extensions): expose dry-run impact review in workbench`
5. `feat(doctor): add safe action result surface`
6. `test: add workbench preview gate and screenshots`

Each slice must be independently mergeable. After slice 2, the page should already be useful as read-only diagnostics. Later slices add navigation, impact review, and action surfaces.

## Open Decisions

1. 页面命名：推荐用户可见名为 `Doctor Workbench`，内部需求名保留 `OmniRoute Workbench Productization`。理由是用户不需要理解 OmniRoute 来源。
2. 入口位置：推荐先放在 Codex workspace 的诊断入口，再视使用频率升级到全局 sidebar。
3. 真实 config 写入：本计划不做。后续如果要做，必须单独建立 `codex-config-local-apply` 类 space，先做 diff confirmation 与 explicit authorization。

## Rollback

本阶段默认只改前端展示、Wails DTO 消费和 temp/staged test target。若产品化方向不成立，可回滚页面入口和 view model，不影响底层 Route / Quota / Doctor / Protocol / Extension 能力底座。

## 沉淀判断

本计划复用既有 GetTokens 规则：sidecar authority、explicit fact、read-only diagnostics、staged temp apply、preview gate。未产生新的 repo-wide 硬约束；暂不更新 AGENTS.md 或项目 skill。

本次 read-only summary slice 继续复用上述规则，未新增项目级 skill；后续若形成稳定的 Workbench summary pattern，再考虑补入 `gettokens-frontend-design-quality` 或单独 OmniRoute frontend workflow。
