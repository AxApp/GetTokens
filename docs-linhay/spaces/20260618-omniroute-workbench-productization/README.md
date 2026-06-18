# OmniRoute Workbench Productization

## 背景

OmniRoute 借鉴能力第一阶段已经完成内部能力底座：Route Resilience、Quota Intelligence、Doctor Workbench、Protocol Bridge、Extension Contract 均已有 sidecar / Wails / frontend / docs gate 的切片和自动化验收。

当前缺口不在底层能力，而在用户感知层：用户遇到账号不可用、路由失败、额度异常或扩展配置风险时，仍需要在多个页面、日志和内部证据之间跳转。下一阶段应把这些能力收敛成一个可理解、可导航、可安全操作的工作台。

## 目标

1. 将 Doctor Workbench 打造成 OmniRoute 能力的主入口，而不是孤立诊断页。
2. 将 route / quota / extension evidence 翻译成用户可理解的状态、原因、证据和下一步动作。
3. 打通从“请求失败或账号异常”到“定位原因、查看证据、执行受控 recheck、看到 ledger 结果”的完整用户故事。
4. 为 Extension Registry 增加 config impact review 与确认体验，但默认仍不写真实 `~/.codex/config.toml`。
5. 保持 sidecar authority：前端只消费 typed evidence，不本地推导 route/quota 真相。

## 范围

- Doctor Workbench 页面入口、信息架构、筛选和摘要。
- Route Resilience evidence 的用户语言展示：阻塞范围、原因、影响账号/模型、最近证据、可执行安全动作。
- Quota Intelligence evidence 的用户语言展示：显式 quotaFact、缺失 fact、缓存陈旧、上游拒绝、非权威提示。
- Extension Registry 的 dry-run / staged apply 体验：展示影响、风险、redaction、确认 token、rollback 结果。
- 页面间导航：Doctor -> account detail / route decisions / extension registry / status。
- 自动化验收：frontend model tests、DOM/preview gate、Wails binding surface、focused Go tests、docs gate。

## 非目标

- 不直接集成 OmniRoute 外部服务。
- 不做完整插件 marketplace 或远程安装。
- 不默认读取或写入真实用户 `~/.codex/config.toml`。
- 不做自动 repair daemon、自动 scheduler 或后台静默修复。
- 不把 Protocol Bridge 暴露成完整 MCP 产品面；本期只消费其已完成的安全边界作为后续能力基础。
- 不触碰 `/Applications/GetTokens.app` 正式版。

## 验收标准

- 用户能从一个明确入口进入 OmniRoute Workbench，并看到账号/路由/额度/扩展配置风险摘要。
- 对于 `applied but not routeable`、`stale route guard`、`missing explicit quotaFact`、`extension config impact` 四类核心场景，页面必须展示：
  - 当前状态；
  - 用户可理解原因；
  - authority/source；
  - 最近证据；
  - 下一步动作或不可操作原因。
- Route / Quota 展示必须只消费现有 typed evidence/helper，不从文本、usage totals、windows 或 summary 本地推导 authority。
- 受控操作只允许使用现有 sidecar-owned route action / staged temp transaction；失败、not implemented、rollback 都要原样可见。
- Extension config 写入链路默认停留在 dry-run / staged temp apply；真实 `~/.codex/config.toml` local apply 必须另行授权。
- Browser/DOM preview 截图或 archived fallback 可复现；涉及 Wails binding 的改动必须通过 binding surface gate。
- 相关 space、memory 和计划文档更新完成。

## 证据门禁

| 项 | 证据 |
|---|---|
| 问题来源 | OmniRoute Final Completion Wave 新会话交接入口明确要求进入用户感知层产品化。 |
| 当前事实位置 | `docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260618-current-progress-and-next-plan.md`、`docs-linhay/memory/2026-06-18.md`、五个 OmniRoute 能力 space。 |
| 当前现象 | 底层能力已完成，但用户还缺少统一入口和可理解的诊断/操作闭环。 |
| 预期验收 | 新工作台能把 Doctor、Route、Quota、Extension 的 typed evidence 汇总成一个用户故事，并保持安全边界。 |
| 反证条件 | 如果现有底座 gate 大面积失败，先回到底层能力修复；如果用户要求真实写入 Codex config，则单独建立写入授权 space。 |

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 验收产物

- Preview gate：`docs-linhay/scripts/check-omniroute-workbench-productization-preview.mjs`
- DOM snapshot：`plans/20260618-omniroute-workbench-preview-snapshot-v01.md`
- 截图：`screenshots/20260618/workbench/20260618-omniroute-workbench-preview-baseline-v01.png`

## Worktree 映射

- branch：`feat/20260618-omniroute-workbench-productization`
- worktree：`../GetTokens-worktrees/20260618-omniroute-workbench-productization/`

## 相关链接

- OmniRoute 总入口：[docs-linhay/spaces/20260615-omniroute-capability-review/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/README.md:1)
- Final Completion Wave：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260618-current-progress-and-next-plan.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260618-current-progress-and-next-plan.md:1)
- Route Resilience：[docs-linhay/spaces/20260616-route-resilience-v2/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-route-resilience-v2/README.md:1)
- Quota Intelligence：[docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-quota-intelligence-dashboard/README.md:1)
- Doctor Workbench：[docs-linhay/spaces/20260616-doctor-workbench/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-doctor-workbench/README.md:1)
- Protocol Bridge：[docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-protocol-bridge-surfaces/README.md:1)
- Extension Contract：[docs-linhay/spaces/20260616-extension-contract-v0/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/README.md:1)
- 产品化计划：[plans/20260618-productization-plan-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260618-omniroute-workbench-productization/plans/20260618-productization-plan-v01.md:1)

## 当前状态
- 状态：phase7-doctor-check-filters-accepted
- 最近更新：2026-06-19

## 本轮执行记录

- Doctor Workbench 已增加 `OmniRoute Workbench v1` safe action surface。
- Route recheck 只在 Wails runtime 可用且 Doctor typed route evidence 提供 stable target 时启用；pending / success / not_implemented / failure 都在当前视图内原样展示。
- Doctor Workbench 内的 Extension staged apply 卡片仍只展示 dry-run impact review 与 Review 入口，不在 Doctor 页面接入 `PrepareGetTokensExtensionCodexConfigApply` / `ApplyGetTokensExtensionCodexConfigTransaction`，避免从诊断页发起配置写入。
- Extension Registry 已增加 `/tmp/gettokens-extension-codex-config-staged-preview.toml` 测试目标的 staged temp apply 预演：prepare 生成 confirmation token / diff preview，apply 只写 `/tmp` 测试文件并展示 result / rollback；真实 `~/.codex/config.toml` 写入仍需单独授权。
- Preview gate 已扩展 `data-omniroute-workbench-action-*` 源码检查和 no-real-apply 检查；产品化截图与 DOM snapshot 固定归档在本 space。
- 2026-06-18 headless Chrome preview gate 已通过；截图目视确认包含 summary、四类 signals、Safe actions、blocked route recheck、blocked extension staged apply 和 source boundary。
- 2026-06-19 已补齐 summary signal 多入口导航：Route -> account detail / route decisions，Quota -> status / related account detail，Extension -> extension registry；产品化 preview gate 新增 `signalActionLinks=true` 断言。
- 2026-06-19 已补齐 Extension Registry staged temp apply UI 与 preview gate：`Staged Temp Apply` 只允许显式 `/tmp` 测试目标，preview/browser 无 Wails runtime 时 blocked，真实 `~/.codex/config.toml` local apply 仍 blocked。
- 2026-06-19 已补齐 Doctor Workbench Evidence ledger surface：safe action surface 内新增 diagnostics snapshot、route action ledger、extension config ledger 三类 entry；route action 返回 `auditId` 时 ledger 直接显示 audit 结果，产品化 preview gate 新增 `evidenceLedgerSurface=true`。
- 2026-06-19 已补齐 Doctor check filters：页面提供 All / Actionable / Route / Quota / Critical 过滤入口，只筛选已有 Doctor typed evidence，不改变 sidecar authority 或在前端推导 route/quota 真相；产品化 preview gate 新增 `checkFilterSurface=true`。
