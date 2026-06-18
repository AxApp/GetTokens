# OmniRoute Capability Final Completion Wave

日期：2026-06-18

## 当前定位

OmniRoute 参考项目已经完成“可借鉴能力 -> GetTokens 架构方案 -> 多轮 subagent 实现 -> 主控聚合验证”的第一阶段闭环。当前状态不是 release-ready，也不是完整插件平台成品；更准确的定位是：五条借鉴方向已经形成可运行的 GetTokens 内部能力切片，并具备可重复验证的脚本、测试、space 计划和 memory 记录。

Final Completion Wave 的目标不是继续扩业务能力，而是把当前大脏树压缩成可 review、可回归、可提交切片的最终交付视图，并明确主控最后必须验证的命令矩阵。

本阶段坚持的边界：

1. 不把 OmniRoute 作为外部插件服务直接嵌入运行态。
2. 不触碰正式版 /Applications/GetTokens.app。
3. 不读取或写入真实 ~/.codex/config.toml。
4. 不替换 app bundle sidecar。
5. sidecar / Wails / frontend / docs 的证据优先通过自动化测试、preview、smoke manifest 和 gate 脚本证明。
6. Final Completion Wave 不再拆后续 Round；所有剩余风险一次性并行收敛，主控最后做总体验收。

## 已完成能力视图

| 能力面 | 当前完成事实 | 仍非目标 / 残余边界 |
| --- | --- | --- |
| Route Resilience | route evidence / dropped reason 已贯穿 account detail、doctor workbench、Wails binding 和 frontend view model；action ledger、bounded reconcile、profile-aware path wiring、startup ledger path wiring 已形成 route guard 证据链。 | 当前偏诊断与证据链可见，不是全自动 scheduler 或 repair daemon。 |
| Quota Intelligence | quota fact 已从弱文本/usage windows 推断收敛到 typed explicit fact；Status、Account、Doctor 通过共享 helper 或 canonical parser 消费；static gate 当前 exceptionFiles=0、knownTypedConsumerExceptions=[]。 | scanner 仍是 lexical-light-ast，不是完整 TypeScript AST / 跨函数数据流分析。 |
| Doctor Workbench | read-only doctor workbench 已具备 preview fixture、archived preview gate、sidecar diagnostics chain、typed route evidence、typed quota evidence；Doctor 不做 mutation / repair CTA，不把 preview 当 runtime truth。 | 尚未做真实 dev App 手点验收；当前阶段未触发必须手点的 native/runtime 门槛。 |
| Protocol Bridge | scoped auth、canonical operation schema、MCP mapping、stdio preflight、in-process JSON-RPC handler、external stdio lifecycle、sidecar HTTP executor 已形成切片；默认 package test 已排除 localhost listener。 | 4 个 protocolbridge_unrestricted_listener tests 需要非受限 localhost 环境显式 smoke。 |
| Extension Contract | manifest schema、enable-state schema、read-only registry、local enable state、dry-run config patch planner、redaction gate、temp-file apply engine、staged local apply transaction helper/DTO/tests 已完成。 | staged transaction 已可接 UI confirmation；剩余仅限真实 TOML AST writer 与真实 `~/.codex/config.toml` wiring，且必须另走明确授权和写入前 diff confirmation。 |
| Verification Governance | Wails binding surface gate、Wails generator JSON report、sidecar smoke manifest v2、contract artifact validator、preview archived fallback、docs-check 已可重复运行。 | Wails CLI v2.12.0 不支持 generate bindings；sidecar latest smoke 仍来自 dirty CLIProxyAPI reference，但 manifest 已记录 same-commit clean comparison；两者都只能作为 test-only evidence。 |

## Final Completion Wave 交付清单

Final Completion Wave 只做收口，不再新增横向业务范围。每个完成项必须产出“代码/文档事实 + 可运行命令 + 结果分类 + 残余风险”。

| Completion item | 必须完成的收口动作 | 验收证据 |
| --- | --- | --- |
| Wails/runtime/generator completion | 确认当前项目可支持的 Wails 生成命令；如果 generate bindings 不存在，保留支持版本/替代命令/不可用证明；补充 Wails build readiness 的最低 smoke，不碰正式版。 | check-wails-generated-drift JSON report、binding surface gate、必要时 scripts/wails-cli.sh build 或不可用分类。 |
| Extension local apply completion | 从 temp writer 推进到 staged local apply transaction 设计和实现，覆盖 preview -> confirm -> backup/temp write -> verify -> rollback；禁止写真实用户 config。 | temp profile / temp file transaction tests；Wails DTO/binding tests；明确 rollback 和 redaction 证据。 |
| Protocol unrestricted completion | 在当前 full-access 环境显式运行 protocolbridge_unrestricted_listener tests；通过则更新验收记录，失败则给出非沙箱根因。 | check-protocolbridge-unrestricted-smoke.mjs 分类与 tagged Go test 结果。 |
| Sidecar smoke completion | 让 sidecar manifest 区分 clean source、dirty source、volatile binary；dirty test binary 不得进入 app bundle 或 release pipeline。 | sidecar build smoke、manifest checker latest/fixture、sourceStateComparison clean result、CLIProxyAPI diff-check。 |
| Integration hardening completion | 输出 review slicing map、regression matrix、final acceptance checklist、commit/PR slicing 建议，并压缩入口文档。 | 本文档、memory 记录、docs-check、diff-check。 |

## Review slicing map

建议按 review 风险边界切片，不按产生时间或历史 Round 切片。

| Slice | Review 范围 | 重点看点 | 不应混入 |
| --- | --- | --- | --- |
| 1. Route resilience evidence | internal/wailsapp/channel_routing*、route action ledger、account detail route evidence、相关 frontend model/test。 | sidecar action contract 是否原样透传；dropped reason 是否不被前端/Wails 重推导；错误状态是否可见。 | quota parser、extension apply、protocol executor。 |
| 2. Quota explicit fact | internal/wailsapp/quota*、frontend/src/features/accounts/model/accountQuota*、quotaStatusEvidence、Status/Doctor quota consumers、quota static gate。 | typed explicit fact 是否唯一 authority；共享 helper 是否消除直接 payload 解析；gate exception 是否仍为 0。 | route ledger、extension registry UI。 |
| 3. Doctor read-only diagnostics | internal/wailsapp/doctor*、Doctor frontend/model/preview/test、doctor preview script。 | Doctor 是否保持 read-only；preview/runtime 标记是否清晰；typed route/quota evidence 是否不伪造 sidecar truth。 | mutation CTA、repair flow、local apply。 |
| 4. Protocol bridge authority boundary | internal/protocolbridge/**、protocol scripts、protocol space schemas/examples。 | authorize-before-executor；no-network suite 和 unrestricted listener quarantine 是否边界清晰；sidecar HTTP executor 是否不保存 route/quota truth。 | Wails binding 生成、frontend layout。 |
| 5. Extension contract and local apply | internal/gettokensextensions/**、internal/wailsapp/gettokens_extensions*、Extension registry frontend/model/test/schema/examples。 | manifest/enable-state contract；dry-run vs transaction apply 是否分层；是否从不读写真实 ~/.codex/config.toml。 | Protocol MCP transport、quota facts。 |
| 6. Wails binding and generated surface | root app.go / app_types.go / mappers、frontend/wailsjs/**、binding gate scripts/tests。 | root App binding 是否覆盖 internal DTO；generated surface 是否与 frontend imports 一致；generator unavailable 是否被结构化分类。 | 真实 dev App 手点结论，除非本轮触发 native/runtime 验收。 |
| 7. Preview / contract / docs governance | docs-linhay/scripts/**、space plans、memory、contract schemas/examples、preview archived snapshots。 | 脚本是否可重复；preview 是否显式 fallback；docs-check 是否覆盖新 gate；memory 是否只记录稳定结论。 | 业务实现代码。 |
| 8. CLIProxyAPI sidecar smoke | docs-linhay/references/CLIProxyAPI 中 GetTokens sidecar smoke scripts/manifest。 | dirty/clean provenance、test-only/non-release 标记、manifest checker、diff-check。 | app bundle sidecar 替换、release pipeline 产物。 |

## Regression matrix

| 风险面 | 必跑命令 | 通过判定 | 失败时处理 |
| --- | --- | --- | --- |
| Wails binding surface | node docs-linhay/scripts/check-wails-binding-surface.mjs | 关键 Wails DTO / method surface 均存在。 | 停止合并，先修 root binding / mapper / generated imports。 |
| Wails generator availability | node docs-linhay/scripts/check-wails-generated-drift.mjs --report /private/tmp/gettokens-wails-generated-drift-final.json | 当前允许分类为 binding-generation-unavailable，但必须 restored=true、acceptedGeneratedDiff=false。 | 若产生 drift 且未恢复，先还原生成副作用并确认是否升级 Wails CLI。 |
| Wails build readiness | bash scripts/wails-cli.sh build | 构建通过且只使用本仓 dev/build 产物。 | 不触碰正式版；记录阻塞命令、日志和是否需要主控做桌面验收。 |
| Protocol no-network | node docs-linhay/scripts/check-protocolbridge-no-network.mjs | no-network allowlist 全通过，unrestricted tests 被正确分类。 | 修正 suite 分类或被误纳入的 listener test。 |
| Protocol unrestricted | node docs-linhay/scripts/check-protocolbridge-unrestricted-smoke.mjs；必要时 GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 -tags protocolbridge_unrestricted_listener ./internal/protocolbridge | full-access 下 listener tests 通过；若失败，分类必须不是旧沙箱误报。 | 主控判断是环境限制还是真实 listener bug；真实 bug 才进入修复。 |
| Sidecar smoke | bash docs-linhay/references/CLIProxyAPI/scripts/gettokens-sidecar-build-smoke.sh；node docs-linhay/references/CLIProxyAPI/scripts/check-sidecar-smoke-manifest.mjs latest | manifest 标明 test-only / non-release，`sourceState.classification` 区分 dirty/clean source，`sourceStateComparison` 记录 clean comparison result 或 unavailable reason。 | 不复制进 app bundle；先修 manifest 或 clean-state 对比。 |
| Extension transaction | focused Go tests for internal/gettokensextensions and internal/wailsapp extension apply surface | preview/confirm/backup/temp write/verify/rollback 语义可在 temp profile 复现。 | 不写真实 config；补 DTO/helper/test 后再考虑 UI 暴露。 |
| Quota gate | node docs-linhay/scripts/check-quota-static-gate-integration.test.mjs；node docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs | exceptionFiles=0、knownTypedConsumerExceptions=[]。 | 修正直接 fact parser 或先登记明确例外，不允许静默降级。 |
| Frontend aggregate | npm --prefix frontend run typecheck；npm --prefix frontend run test:unit | typecheck 与 unit 全通过。 | 先定位新增失败是否属于当前切片；不要为过测改弱断言。 |
| Go aggregate | GOCACHE=/private/tmp/gettokens-go-cache go test -count=1 ./... | 非 quarantine package 全通过。 | protocol listener 环境限制必须通过专用 classifier 说明，不能混入普通失败。 |
| Contract artifacts | node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs | schemas/examples/plans 一致。 | 先修文档/fixture/schema 不一致，再跑业务测试。 |
| Preview gates | CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs；CHROME_EXECUTABLE_PATH=/nonexistent/chrome node docs-linhay/scripts/check-doctor-workbench-preview.mjs | live Chrome 不可用时 archived snapshot/PNG fallback 仍通过，且 preview-only 标记存在。 | 不把 preview 失败解释成 Wails runtime 失败；先修 preview fixture 或 archived evidence。 |
| Docs / diff | bash docs-linhay/scripts/check-docs.sh；git diff --check；git -C docs-linhay/references/CLIProxyAPI diff --check | docs 结构、内置 gates、父仓和 reference diff whitespace 均通过。 | 先修文档结构/空白，不做 stage/commit。 |

## Final acceptance checklist

主控最终验收必须逐项勾选：

1. git status --short 已按 review slicing map 解释所有 remaining dirty files，没有把他人改动混入单一提交。
2. Wails binding surface gate 通过。
3. Wails generator JSON report 已生成；若仍 unavailable，报告包含不可用证明且工作树恢复。
4. Wails build readiness 已跑或明确记录无法跑的原因；未触碰正式版 app。
5. Protocol no-network gate 通过。
6. Protocol unrestricted smoke 在 full-access 环境显式运行并记录通过/失败分类。
7. Sidecar smoke manifest latest/fixture gate 通过，`sourceStateComparison` 记录同 commit clean comparison 或明确 unavailable reason；dirty binary 只作为 test-only evidence。
8. Extension local apply transaction 只使用 temp profile/temp file 证明，不读写真实 ~/.codex/config.toml。
9. Quota direct parser gate 仍为 0 exception。
10. Frontend typecheck 和 unit aggregate 通过。
11. Go aggregate 通过；任何 quarantine/环境限制均有专用 classifier 证据。
12. Contract artifacts validator 通过。
13. Extension 和 Doctor preview gates 通过，并保留 preview-only / archived fallback 边界。
14. check-docs.sh、父仓 git diff --check、CLIProxyAPI git diff --check 通过。
15. memory 记录已写入，且没有新增 repo-wide 规则时不修改 AGENTS.md。

## Commit / PR slicing 建议

当前 dirty tree 不建议一次性压成一个 mega commit。建议按以下顺序 staging，逐片可 review、可回滚：

1. docs: capture omniroute final completion governance
   - 只包含当前入口文档、memory、必要 docs scripts gate wiring。
2. test: add verification gates for wails protocol quota sidecar
   - 只包含可执行 gate scripts、fixture gate tests、generated binding surface tests。
3. feat(route): expose route resilience evidence surfaces
   - route evidence、action ledger、Wails/frontend consumers 和 focused tests。
4. feat(quota): converge explicit quota fact consumers
   - quota helper、Status/Account/Doctor quota consumers、quota tests。
5. feat(doctor): add read-only diagnostics workbench
   - Doctor Wails/root/frontend/preview/tests/docs，不混入 mutation。
6. feat(protocol): harden protocol bridge authority boundary
   - protocolbridge Go package、schemas/examples、no-network/unrestricted classifier。
7. feat(extensions): add extension registry and staged apply boundary
   - extension schema/registry/apply preview/transaction/Wails/frontend/tests。
8. chore(sidecar): record sidecar smoke provenance manifest
   - CLIProxyAPI reference smoke scripts/manifest checker/docs gate；不得包含 app bundle sidecar。

每个 commit 前至少运行该 slice 的 focused tests；最终 PR 前运行 Final acceptance checklist 全量命令。若某片需要依赖上一片 generated type 或 DTO，提交说明必须写明依赖关系，避免 review 时误以为可独立 cherry-pick。

## 持久治理归属建议

本轮发现的可复用模式是“machine-readable gate classifier + known environment limitation + fixture/latest smoke 双入口”。它已经在 Wails generator、Protocol unrestricted、Sidecar smoke 中重复出现，但当前仍与 OmniRoute 收口强相关。

归属建议：

1. 暂不直接修改 AGENTS.md：现有 repo-wide 规则已经覆盖 subagent 监督、docs/memory 写回、正式版保护、测试门禁和 sidecar 边界。
2. 若 Final Completion Wave 后该模式仍跨 Wails、Protocol、Sidecar、Release 复用，优先新增 docs-linhay/dev/20260618-machine-readable-verification-gates.md，把 classifier 字段、exit code 语义、fixture/latest 双入口和 failure taxonomy 固化为跨领域 workflow。
3. 若后续成为所有 GetTokens 任务的默认门禁，再在 .agents/skills/gettokens-ops-governance/SKILL.md 增加入口；只有当它变成 repo-wide 长期硬约束时，才同步升级 AGENTS.md。

## 沉淀审计

本轮是 Final Completion Wave 的集成硬化收口，产物是文档入口、review 切片、回归矩阵和最终验收清单；未新增业务代码。

沉淀结论：

1. subagent dispatch -> accepted table -> aggregate validation -> memory writeback 已由 gettokens-subagent-supervision 和 gettokens-ops-governance 覆盖，不新增 skill。
2. machine-readable gate classifier + known environment limitation 暂记录在本文档和 memory；若 Final Completion Wave 结束后仍跨领域复用，再提炼为 dev workflow。
3. fixture/latest smoke 双入口 当前仍以 sidecar smoke 和 preview archived fallback 为主，暂不升级 AGENTS。
4. 本轮不更新 AGENTS.md，原因是没有发现新的 repo-wide 持久硬约束缺口。

## 新会话交接入口

新会话不需要再重新评估 OmniRoute 是否值得直接集成。本期结论已经固定：不把 OmniRoute 作为外部插件服务嵌入；只吸收 route resilience、quota intelligence、doctor workbench、protocol bridge、extension contract 这五类能力，并按 GetTokens sidecar / Wails / frontend / docs gate 边界继续产品化。

新会话应直接从以下问题开始：

1. 用户感知层：把 Doctor Workbench、Extension Registry、Route/Quota evidence 从内部切片整理成可用页面和明确入口。
2. 写入授权层：若要启用真实 ~/.codex/config.toml local apply，必须先做目标 diff confirmation、真实 TOML AST writer 或等价保真方案，并获得用户明确授权。
3. 路由执行层：Route Resilience 当前偏证据链和操作面，不是自动 scheduler；后续若做自动切换，需要先定义 sidecar authority 和回滚策略。
4. 发布边界：sidecar smoke manifest 只证明 test-only evidence，不得直接作为 release artifact；Wails build-readiness 只证明本仓构建链路，不代表正式版 app 已更新。

后续产品化需求与计划已独立落位到 `docs-linhay/spaces/20260618-omniroute-workbench-productization/`，避免与本 Final Completion Wave 的底座收口记录混在一起。

本期可对外表达的用户价值是：GetTokens 后续不会只告诉用户“失败了”，而是能解释失败原因、额度状态、可切换路径、插件写入影响，并通过统一诊断台给出可复现证据。
