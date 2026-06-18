# Extension Contract v0

## 背景

本 space 承接 OmniRoute 借鉴能力评估中的中期方向：`extension contract`。

GetTokens 后续可能需要接入第三方 provider metadata、model catalog source、account importer 或 quota probe。第一阶段目标不是做通用插件 marketplace，而是定义受控声明式扩展契约。

## 目标

1. 定义 extension manifest v0。
2. 定义 capability kind 白名单。
3. 明确 enable / disable / compatibility / conflict detection 语义。
4. 输出可供后续实现的 schema 与管理界面范围。

## 范围

- manifest 字段与 schema。
- capability kind：`provider-metadata`、`model-catalog-source`、`account-importer`、`quota-probe`。
- sidecar registry 与 Wails/frontend 管理边界。
- 安全限制与后续扩展门槛。

## 非目标

- 不运行任意热路径代码。
- 不做 JS hook 插件系统。
- 不做 marketplace 或远程安装。

## 验收标准

- 形成 v0 manifest/schema 方案。
- 明确每种 capability 的输入、输出、权限和冲突规则。
- 明确哪些能力本期不开放。
- 文档能直接作为后续实现 space 的输入。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260616-extension-contract-v0`
- worktree：`../GetTokens-worktrees/20260616-extension-contract-v0/`

## 相关链接

- 总架构：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)
- v0 契约：[plans/20260616-extension-contract-v0-spec.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260616-extension-contract-v0-spec.md:1)
- v0 artifact 计划：[plans/20260616-extension-contract-v0-artifacts-plan.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260616-extension-contract-v0-artifacts-plan.md:1)
- Phase 1 只读 registry 实现计划：[plans/20260616-phase1-readonly-registry-implementation-plan.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260616-phase1-readonly-registry-implementation-plan.md:1)
- 第十八轮 enable-state core registry tracer：[plans/20260617-round18-enable-state-core-registry-tracer.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round18-enable-state-core-registry-tracer.md:1)
- 第十九轮 local enable-state mutation：[plans/20260617-round19-local-enable-state-mutation.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round19-local-enable-state-mutation.md:1)
- 第二十轮 config apply dry-run boundary：[plans/20260617-round20-config-apply-dry-run-boundary.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round20-config-apply-dry-run-boundary.md:1)
- 第二十二轮 TOML patch-plan dry-run：[plans/20260617-round22-toml-patch-plan-dry-run.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round22-toml-patch-plan-dry-run.md:1)
- 第二十三轮 read-only TOML patch planner：[plans/20260617-round23-readonly-toml-patch-planner.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round23-readonly-toml-patch-planner.md:1)
- 第二十四轮 sensitive-field redaction gate：[plans/20260617-round24-sensitive-field-redaction-gate.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round24-sensitive-field-redaction-gate.md:1)
- 第二十五轮 dry-run no-side-effect gate：[plans/20260617-round25-dry-run-no-side-effect-gate.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260617-round25-dry-run-no-side-effect-gate.md:1)
- 第二十六轮 temp-file apply engine：[plans/20260618-round26-temp-file-apply-engine.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-round26-temp-file-apply-engine.md:1)
- Final Completion Wave local apply completion：[plans/20260618-final-completion-wave-extension-local-apply.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/plans/20260618-final-completion-wave-extension-local-apply.md:1)
- v0 JSON Schema：[schemas/gettokens-extension-v0.schema.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/schemas/gettokens-extension-v0.schema.json:1)
- enable-state artifact schema：[schemas/gettokens-extension-enable-state-v0.schema.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/schemas/gettokens-extension-enable-state-v0.schema.json:1)
- v0 examples：[examples/provider-metadata-model-catalog.valid.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/examples/provider-metadata-model-catalog.valid.json:1)、[examples/js-hook-unknown-capability.invalid.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/examples/js-hook-unknown-capability.invalid.json:1)、[examples/provider-metadata-model-catalog.invalid-forbidden-permission.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/examples/provider-metadata-model-catalog.invalid-forbidden-permission.json:1)、[examples/provider-metadata-model-catalog.invalid-missing-required.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/examples/provider-metadata-model-catalog.invalid-missing-required.json:1)、[examples/enable-state-v0.valid.json](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260616-extension-contract-v0/examples/enable-state-v0.valid.json:1)

## 当前状态
- 状态：phase1-staged-local-apply-transaction-ready-for-ui-confirmation
- 最近更新：2026-06-18
- 已落地：`internal/gettokensextensions` 提供 Phase 1 只读 registry runtime core，可从 manifest path 列表或 extension root 扫描 `gettokens.extension.json`，输出 read-only snapshot，并诊断 unknown capability、forbidden permission、duplicate extension id、parse error，以及 provider metadata / model catalog source / quota probe 的 schema-aligned 必填字段、白名单字段、source 类型和 runtime hook 夹带问题。
- 已接线：Wails core 与 root `main.App` 暴露 `GetGetTokensExtensionRegistrySnapshot`、`SetGetTokensExtensionEnabled` 与 `PreviewGetTokensExtensionCodexConfigDryRun`；无输入时只扫描 GetTokens app-owned root `~/.config/gettokens(-dev)/extensions`，并只读写 GetTokens app-local `extension-enable-state.json`。Codex config preview 只返回 dry-run diff/validation，不读取或写入 `~/.codex/config.toml`，不执行 capability，不发网络请求，不引入 marketplace。
- 本轮切片：`frontend/src/features/gettokens-extension-registry/` 已从 local enable-state mutation 推进到 Codex config dry-run preview UI/model/tests；前端消费 registry snapshot、diagnostics、capability kinds、source/root 信息，并显示 Skills/MCP sections 与 validation errors。enable/disable 只写 GetTokens app-local state file，config preview 只做 dry-run，不写 Codex Skills/MCP 配置，不执行 capability，不引入 marketplace。
- 第十轮入口切片目标与证据门禁：
  - 问题来源：当前 `space` README 已记录“前端 feature 已落地但未接页面”，因此仍无法从现有 codex workspace/hash 进入。
  - 代码事实位置：`frontend/src/features/gettokens-extension-registry/` 已存在只读 feature；`frontend/src/pages/CodexPage.tsx`、`frontend/src/types.ts`、`frontend/src/utils/pagePersistence.ts`、`frontend/src/components/biz/Sidebar.tsx` 仍未将其纳入宿主入口。
  - 当前现象：`#frame=codex&workspace=extension-registry` 不被识别为合法 workspace，sidebar 也没有现成入口。
  - 预期验收：workspace/hash 能稳定进入只读 registry 页；页面只展示 snapshot/diagnostics/capability/source/root；补 focused tests 与 headless preview 截图脚本。
- 当前限制：受本轮“禁止修改 Route/Doctor/Protocol 文件”约束，入口接线只允许落在 codex 宿主最小文件与当前 feature，不扩散到其他业务面。
- 第十二轮 enable state contract 目标与证据门禁：
  - 问题来源：Phase 1 registry 页面当前仍是纯 read-only snapshot 浏览器，只能看到 runtime `state`，无法表达后续 enable/disable 合约里的“为何可启用、为何被阻塞、为何本轮不能操作”。
  - 代码事实位置：`frontend/src/features/gettokens-extension-registry/model.ts` 只映射 registry `state`；`GetTokensExtensionRegistryFeature.tsx` 只渲染 state badge、capability 和 diagnostics，没有 enable-state / action-availability 视图。
  - 当前现象：用户无法区分 `readonly-compatible` 是“当前视图下等价 enabled”还是“未来可操作但本轮只读”；也无法区分 `invalid`、`incompatible`、`pending` 等状态对后续 enable action 的影响。
  - 预期验收：前端模型把 extension state、compatibility、diagnostics 映射成 v0 enable state 与只读 action availability；页面只展示 disabled/read-only affordance 与原因，不出现 enable/disable handler、mutation binding 或 marketplace 入口。
- 本轮产物：
  - `#frame=codex&workspace=extension-registry` 作为合法 workspace/hash 入口。
  - Codex sidebar 增加只读 `Extension Registry` 子入口。
  - headless 预览校验脚本：`docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs`
  - gate 先尝试本地 headless Chrome；若当前环境不可用，则回退到归档 snapshot `plans/20260617-extension-registry-playwright-snapshot-v01.md` 与同路径截图 `screenshots/20260617/extension-registry/20260617-extension-registry-playwright-baseline-v01.png`，继续校验 registry page、workspace/hash、root/diagnostic/capability/source markers，以及“不写 Codex config、不执行 capability、不接 marketplace”的边界。Round 19 后允许 app-local enable-state mutation。
  - 验收产物：`screenshots/20260617/extension-registry/20260617-extension-registry-playwright-baseline-v01.png`、`plans/20260617-extension-registry-playwright-snapshot-v01.md`
- 本轮新增：只读 `enable state` v0 合约展示切片，定义 `enabled / disabled / blocked / pending / readonly-unsupported` 与 `action availability = read-only | disabled` 的前端解释层，不写配置、不执行 capability。
- artifact gate：`enable-state` 词汇已固化到独立 schema/example，validator 会同时检查 README、round12 plan 与 artifact 枚举一致；任何新增/改名都必须同步更新三处。
- schema-level gate：validator 还会对 `examples/enable-state-v0.valid.json` 执行本地 schema validation，并要求 invalid fixtures 证明状态枚举、`actionAvailability` 枚举、必填字段缺失会被拒绝。
- 本轮新增：manifest 主 schema 进入同一条 schema-level gate。validator 会对 `examples/provider-metadata-model-catalog.valid.json` 执行本地 schema validation，并要求 invalid fixtures 持续证明未知 capability、禁用权限、缺 required 字段，以及顶层 unknown field、非法 `source.type`、capability 缺失必填 `source` 字段都会被 manifest schema / validation gate 拒绝。
- schema-level gate 还必须持续锁住本地 runner 对 `additionalProperties`、enum 与 capability required gate 的支持，避免后续 schema 调整后这些拒绝路径悄悄退化。
- Round 17 条件 source gate：`model-catalog-source.source.type = declared-endpoint` 必须带 `endpoint`，`static-json` 必须带 `path`；本轮只新增 schema artifact invalid fixtures 与 validator 断言，不实现 runtime runner、enable/disable、marketplace 或 Codex config 保存。
- Round 18 core registry tracer：`internal/gettokensextensions` 新增本地 enable-state JSON 读写与 `LoadOptions.StatePath` merge；已证明缺省读取、enable/disable 持久化重读、manifest snapshot 合并、非法 id / 未知 state 拒绝与 state 规范化。不执行 capability，不读写用户 Codex config，不接 marketplace。
- Round 19 local mutation：Wails/root/前端已接入 `SetGetTokensExtensionEnabled`，snapshot 默认读取 GetTokens app-local `extension-enable-state.json`，registry UI 可执行 enable/disable 本地状态切换；仍不写 Codex config、不执行 capability、不接 marketplace。
- Round 20 config dry-run：core/Wails/root/前端已接入 `PreviewGetTokensExtensionCodexConfigDryRun`，基于 enabled extensions 输出 `dryRun=true`、Skills/MCP diff preview sections、summary 与 validation；由测试证明 target config path 不会被创建或写入。
- Round 21 dry-run operation projection：dry-run preview 可从 v0 manifest capability 投影 Skills/MCP 候选 operations。`provider-metadata` 生成 `skills.config` candidate，`model-catalog-source` 生成 `mcp_servers` candidate；这些 operation 仅用于 preview/diff 和 validation，不暴露 save/apply 真写入口，不读取或写入 `~/.codex/config.toml`，不执行 capability，不接 marketplace 或网络。
- Round 22 TOML patch-plan dry-run：每个 preview operation 增加 `patchPlan`，输出 `targetSection`、`operation`、`beforeSnippet`、`afterSnippet` 与 validation。MCP 只预览 `[mcp_servers.<id>]` 父 server table，不把 nested `tools` / `oauth` 当作 server；token 边界只允许未来使用 `bearer_token_env_var`，本轮不写 `~/.codex/config.toml`、不执行 capability、不接 marketplace/network。
- Round 23 read-only TOML patch planner：`PreviewGetTokensExtensionCodexConfigDryRunInput.configText` 作为唯一 TOML 输入，planner 可从输入文本生成 before/after snippets；`[[skills.config]]` 与精确 `[mcp_servers.<id>]` 父 table 会被提取，nested `tools` / `oauth` 保持父 server 子配置语义，`bearer_token` literal 会在 snippet 中 redacted。仍不读取或写入真实 `~/.codex/config.toml`、不保留 token、不执行 capability、不接 marketplace/network。
- Round 24 sensitive-field redaction gate：read-only TOML planner 新增 `token`、`api_token`、`headers`、`Authorization`、`cookie`、`secret` 类键的 RHS redaction 测试；前端 dry-run view model 增加展示前二次 redaction，防止 Wails DTO 或 preview fixture 漏出敏感 literal。`bearer_token_env_var` 保留为允许的 env-var 引用。仍只使用测试/preview `configText`，不读取真实 `~/.codex/config.toml`、不执行 capability、不接 marketplace/network。
- Round 24 Wails binding generated surface consistency：新增 `plans/20260617-round24-wails-binding-generated-surface-consistency.md`；补强 root/Wails/frontend generated binding tests，并最小手动同步 `frontend/wailsjs/go/models.ts`，证明 dry-run `configText` input 与 operation `patchPlan` typed conversion 不会在 generated surface 中丢失。本轮不运行 Wails generator、不启动 dev App。
- Round 25 dry-run no-side-effect gate：新增 `plans/20260617-round25-dry-run-no-side-effect-gate.md`；core 测试用 targetPath 诱饵真实配置与 caller-supplied `configText` 证明 planner 只消费输入 TOML，不读取或写入真实 Codex config；Wails handler 测试补充 target 文件不泄漏、不变断言。`patchPlan.operation` 细分为 `noop-existing-array-table-preview`、`add-parent-table-preview`、`update-parent-table-preview` 等，证明已存在 generated action 不重复添加，缺失项才 add，已有 MCP parent table 走 update。
- Round 26 temp-file apply engine：新增 `plans/20260618-round26-temp-file-apply-engine.md` 与 core helper `ApplyCodexConfigDryRunPreviewToTempFile`；只把 preview operations 应用到 caller-supplied `ConfigText` 并写入 `t.TempDir()` 生成的 `config-preview-*.toml`，真实 target path 只作为 preview context 回显，不读取、不写入。最小支持 `[[skills.config]]` add/noop 与 `[mcp_servers.<id>]` add/update/noop；update MCP parent table 时保留未知字段、注释、非目标 section 和 nested `tools`，仍不执行 capability、不接真实保存链路。
- Round 27 TOML temp writer fidelity：新增 `plans/20260618-round27-toml-temp-writer-fidelity.md`；temp apply engine 改为按当前 caller-supplied TOML 实际状态重判 add/update/noop，保证重复 apply 文本稳定，避免 stale preview 再次追加 generated block。temp output / `AppliedText` 在写盘前继续执行敏感字段 redaction，阻断 `bearer_token` literal 泄漏，同时保留 `bearer_token_env_var`；目标 `[mcp_servers.<id>]` parent update 继续保留 sibling tables、nested `tools`/`oauth`、注释、未知字段、非目标 server 与多个 `[[skills.config]]`。
- Final Completion Wave Extension local apply：新增 `plans/20260618-final-completion-wave-extension-local-apply.md`；core helper 已支持 `PrepareCodexConfigStagedApply` 与 `ApplyCodexConfigStagedTransaction`，形成 preview -> confirmation token -> backup -> staged temp write -> target write -> verify -> rollback-on-failure 的事务语义。Wails/root DTO 已接入 explicit target prepare/apply，并拒绝当前 HOME 下真实 `~/.codex/config.toml`。测试覆盖成功提交、verify 失败回滚、target write 失败回滚、invalid operation/token mismatch 提前失败，以及 comments、unknown fields、nested mcp tools/oauth、sibling tables、多个 `[[skills.config]]`、redaction 边界。
- 剩余仅限真实 config wiring：active runner、正式 TOML AST writer、真实 `~/.codex/config.toml` local apply 仍需后续明确授权和写入前 diff confirmation；本轮不再把 staged transaction helper/DTO/tests 留作“下轮”。

## Contract Artifact Validator

进入 runtime 实现前先运行轻量契约 artifact 门禁：

```bash
node docs-linhay/scripts/check-omniroute-contract-artifacts.mjs
```

该脚本会校验本 space 的 manifest schema、enable-state artifact schema、valid/invalid examples、README、round12/round15 plan 与 Phase 1 只读 registry 计划是否保持一致；同时对 manifest valid example 与 enable-state example 执行本地 schema-level validation，并证明 invalid fixtures 会覆盖 unknown capability、forbidden permission、missing required、unknown top-level field、invalid source type、capability missing required source field、declared-endpoint missing endpoint、static-json missing path 等拒绝路径。脚本也会联动检查 Protocol Bridge Surfaces 的 manifest / examples。
