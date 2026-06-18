# Quota Intelligence Dashboard

## 背景

本 space 承接 OmniRoute 借鉴能力评估中的近期方向：`quota intelligence`。

GetTokens 当前已有 quota、billing、usage、account runtime status 和 account detail 展示，但 quota 事实分散在多个模块中。用户很难区分“真没额度”“额度未知”“缓存陈旧”“上游拒绝校验”“本地估算”。

## 目标

1. 建立统一 quota fact schema。
2. 让 account detail、usage/status、doctor workbench 消费同一类 quota DTO。
3. 给 quota 结论补充 source、freshness、confidence、risk 和 explanation。

## 范围

- sidecar quota fact / quota status 输出结构。
- GetTokens Wails 聚合 DTO。
- account detail / usage / status / doctor 的前端消费模型。
- focused tests 与 preview fixtures。

## 非目标

- 不在本期实现完整 free-tier marketplace。
- 不把 ToS 风险做成法律判断。
- 不让前端根据局部字段自行推导 quota authority。

## 验收标准

- UI 能区分 `no quota`、`quota unknown`、`cached stale quota`、`provider denied quota check`。
- 同一账号在列表、详情、诊断页中的 quota 口径一致。
- quota 字段带 source / freshness / confidence / risk / explanation。
- focused backend/frontend tests 通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-quota-intelligence-dashboard`
- worktree：`../GetTokens-worktrees/20260616-quota-intelligence-dashboard/`

## 相关链接

- 总架构：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)

## 当前状态
- 状态：round26-doctor-quota-helper-convergence
- 最近更新：2026-06-18
- 当前输出：sidecar `QuotaRuntimeState.fact`、sidecar status/runtime JSON `quotaFact`、doctor diagnostics `quotaFact`、main repo Wails/root `quotaFact`、frontend `resolveQuotaFact()` fact 优先消费；第十轮新增 `coerceQuotaFactDisplay()` + `buildQuotaFactEvidenceView()`，把 `state/source/freshness/confidence/risk/explanation/observedAt/expiresAt/evidenceRefs` 收敛为同一前端 quota evidence view model；第十二轮抽出 `resolveQuotaStatusEvidenceFromPayload()`，锁死只信显式 `quotaFact/quota_fact/fact`；第十三轮已在 Status 页接入只读 quota evidence section，使用 `GetAllQuotaStatuses()` 读取 payload；第十四轮补 `buildStatusQuotaEvidenceSectionState()` 和 doctored payload tests，明确在无显式 fact 时只展示 non-authoritative 提示，不从 `windows`、`blockReason`、usage totals 回退本地推导；第十五轮继续 harden mixed payload，让 section 在“部分账号有 fact、部分账号无显式 fact”时仍显示缺失账号摘要，但不把缺失方误判为 authoritative；第十六轮补齐 unknown-account 缺口，让 section state/UI 同时暴露无 `accountKey` 的 unscoped missing fact count，例如 `2 unscoped payloads missing explicit fact`；第十七轮为 unscoped missing fact payload 增加只读 sample labels；第十八轮在 CLIProxyAPI 参考实现证明：当 sidecar runtime 持有 fact 时，`/gettokens/quota-status` 和 `/gettokens/doctor-diagnostics` 都输出显式 `quotaFact`，doctor 拷贝 fact/evidence refs，raw no-fact 状态不从 `windows/blockReason/usage totals` 推导 authority
- 第十九轮：main side `QuotaRuntimeState` decode 接受 `quotaFact`、`quota_fact` 和 legacy `fact`，优先消费显式 `quotaFact`；`QuotaRuntimeFact` 内部兼容 `observedAt/evidenceRefs` 与 `observed_at/evidence_refs`；Wails quota DTO 继续透传 `quotaFact` 并深拷贝 `evidenceRefs`；Status helper 测试证明 camelCase/snake/legacy fact 都是 explicit fact，缺 fact 的 `windows/blockReason` payload 仍保持 non-authoritative。
- 第二十轮：Account `resolveQuotaFact()` 也收窄为 explicit-fact-only；无 `quotaFact/quota_fact/fact` 时，即使 payload 有 exhausted `windows`、`blockReason`、`degradedReason` 或 usage totals，也只返回 `unknown` / `confidence=none`，不生成 `no-quota/stale/denied/available` authority。`buildQuotaDisplay()` 仍展示 quota bars/windows/block 状态，但 `display.fact` 不从这些局部字段推导。Doctor workbench 文件由并行 Doctor agent 负责，本轮只在 plan 中记录 doctor fixtures 必须携带 explicit `quotaFact` 才能展示 authority。
- 第二十一轮：Status section 增加 quota-shaped bait 反回归，证明无 `quotaFact/quota_fact/fact` 的 payload 即使携带 `windows`、`blockReason`、`usageTotals`、`totalTokens` 或伪 `authority/factLike` 字段，也只进入 `NON-AUTHORITATIVE` missing notice；Usage Desk 增加 `missing-quota-fact` 状态和 UI 分支，缺 explicit fact 时显示 `Missing explicit quotaFact / Non-authoritative`，已有 explicit fact 仍走 `Quota runtime authority` 展示。
- 第二十二轮：将 Account / Status / Usage Desk 的 explicit-fact-only 读取收敛到 `resolveExplicitQuotaFactDisplay(payload)`；`resolveQuotaFact()` 与 `resolveQuotaStatusEvidenceFromPayload()` 均复用该 helper。新增统一矩阵测试覆盖 `quotaFact`、`quota_fact`、legacy `fact`，并继续证明 `windows.authority`、`usageTotals.state`、`factLike` 等 bait payload 不能升级为 authority。
- 第二十三轮：新增 `docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs` 静态门禁，并接入 `quotaStatusEvidence.test.mjs`；唯一 direct parser 入口限定为 `frontend/src/features/accounts/model/accountQuota.ts` 的共享 helper，accounts/status tests 与 preview fixture 允许构造 payload，未授权新 feature 直接读取 `payload.quotaFact` / `payload['quota_fact']` / `payload.fact` 会失败并报告文件行号。Doctor Workbench 现有 typed consumer 保留为本轮 scope 外已知例外，不在本轮改动。
- 第二十四轮：将 `check-quota-no-direct-fact-parser.mjs` 纳入 `docs-linhay/scripts/check-docs.sh`，主控和后续 agents 运行常规 docs check 时会自动执行 quota static gate；新增 `check-quota-static-gate-integration.test.mjs` 锁定 docs-check 集成和 tests/preview fixture allowlist，避免后续调整把 fixture payload 误判为违规。
- 第二十五轮：将 quota no-direct parser gate 从逐行正则升级为无依赖词法 / 轻 AST 扫描；跳过注释和字符串，新增 property/bracket/destructuring/raw alias/`JSON.parse` 形态检测，覆盖 `originalMessage`、`rawPayload` 与 `quotaFact/quota_fact/fact` direct parser；`check-quota-static-gate-integration.test.mjs` 用临时 fixture 证明旧 gate 的注释/字符串误报和 raw alias 漏报边界，当前实际扫描 `335` 个 feature 文件无 findings。
- 第二十六轮：收敛 Doctor Workbench typed consumer 例外，`knownTypedConsumerExceptions` 从整个 `doctor-workbench` 目录缩到 `model/quotaEvidenceAdapter.ts` 单文件；新增 gate integration fixture 证明普通 Doctor model 直接访问 `payload.quotaFact` 会失败，adapter 单文件允许消费 typed explicit fact；Doctor 主模型改为经 adapter 取得 quota evidence view，继续不从 `summary/windows/blockReason/usageTotals` 推导 authority。
- Round26 plan：`plans/20260618-round26-doctor-quota-helper-convergence.md`
- 下一步：若后续把 quota evidence 推广到更多 quota 诊断入口，继续复用 `resolveExplicitQuotaFactDisplay()` / `resolveQuotaStatusEvidenceFromPayload()` 和同一 section state，并维持 “显式 fact 才有 authority；无 fact 账号仅显示 non-authoritative hint / count / safe trace sample，不从局部 payload 字段推导” 的只读消费边界；当前 unscoped sample labels 仍不能定位具体账号，只用于追踪数据来源；sidecar 兼容期内会同时暴露 legacy `fact` 与显式 `quotaFact`，下游应优先消费 `quotaFact`；Doctor Workbench 只允许通过 `quotaEvidenceAdapter.ts` 消费 typed explicit `quotaFact`。
