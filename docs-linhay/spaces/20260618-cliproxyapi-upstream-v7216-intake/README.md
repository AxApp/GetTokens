# CLIProxyAPI Upstream v7.2.16 Intake

## 背景

用户要求“按流程评估合并 cliproxyapi 上游新增功能”。按照当前 GetTokens 治理规则，本轮不做 CLIProxyAPI 上游合并式同步，也不直接 cherry-pick 大块 commit；上游只能作为 reference input。需要先确认 canonical upstream、当前 fork 状态和 tag delta，再把可接受能力拆成 GetTokens sidecar 边界内的 reference-port 子项。

本轮只读探测结果：

- canonical upstream：router-for-me/CLIProxyAPI.git
- 已验证最新 upstream tag：v7.2.16@dd49a520
- v7.2.16..origin/main：无额外 commit
- 上次已评估并已部分落地的窗口：v7.1.50..v7.1.53
- 本轮 intake 窗口：v7.1.53..v7.2.16
- 上游窗口规模：138 commits，316 files changed，约 +38281/-8716
- 本地维护 fork：docs-linhay/references/CLIProxyAPI#gettokens/sidecar@4781570f
- 本地 fork describe：v7.1.28-110-g4781570f-dirty
- 本地 fork remote 当前只有 origin=https://github.com/AxApp/CLIProxyAPI.git，没有 canonical upstream remote；本轮使用 /private/tmp 临时 clone 审核上游，未污染 fork refs。
- 本地 fork 当前已有未提交改动：internal/api/server.go、internal/api/handlers/management/openai_quota_reset.go、internal/api/handlers/management/openai_quota_reset_test.go。

## 目标

1. 建立 v7.1.53..v7.2.16 的 intake 证据和分类结论。
2. 明确哪些 upstream 行为可以进入 GetTokens sidecar reference-port，哪些只能进入设计/研究，哪些应拒绝或忽略。
3. 为后续实现拆分子 space，确保每个接受项都有证据矩阵、BDD、失败测试、最小实现和验收路径。
4. 保护 GetTokens sidecar 自治边界：账号选择、route guard、rate-limit、live sessions、usage attribution、system proxy、Codex WebSocket、管理 API 和 Wails/front-end contract 不被上游通用逻辑覆盖。

## 范围

- 审核 v7.1.53..v7.2.16 tag/commit/file delta。
- 按能力族分类：translator / Codex / Claude / Gemini / Antigravity 协议 hardening、Codex Responses WebSocket、management log cursor、OpenAI video handlers、XAI executor、auth/home/cache/scheduler、pluginhost/pluginstore、AMP 删除、build/release/Docker/README sponsorship。
- 写回本 space、计划文件和当天 memory。

## 非目标

- 不 merge upstream v7.2.16。
- 不 cherry-pick 上游大块 commit。
- 不在本轮直接修改 docs-linhay/references/CLIProxyAPI 代码。
- 不触碰正式版 /Applications/GetTokens.app、正式 sidecar、正式配置或正式进程。
- 不把 upstream pluginhost/pluginstore/examples 直接纳入 GetTokens runtime 或 release。
- 不默认删除 GetTokens fork 中仍存在的 AMP integration。

## 证据矩阵

| 项目 | 当前证据 | 判断 |
| --- | --- | --- |
| 问题来源 | 用户要求评估合并 CLIProxyAPI 上游新增功能 | 进入 upstream intake，不直接实现 |
| canonical upstream | router-for-me/CLIProxyAPI.git，v7.2.16@dd49a520 | 可信来源 |
| 当前 fork | gettokens/sidecar@4781570f-dirty，且已有 openai_quota_reset 未提交改动 | 后续实现必须先保护/隔离现有改动 |
| 上游窗口 | v7.1.53..v7.2.16，138 commits，316 files | 范围过大，禁止整包 merge |
| 高风险冲突面 | pluginhost/pluginstore、auth scheduler、management API、Codex websocket、AMP removal | 必须拆子项和 TDD |
| 已部分存在面 | fork 已存在 openai_videos_handlers.go、management logs、AMP 模块、GetTokens Codex websocket 改造 | 不能按 upstream 是否新增简单判断缺失 |
| 验收方式 | 本轮纯评估跑 docs gate；实现轮必须先子 space + red tests + fork focused tests + sidecar rebuild | 本轮不跑 Go/Node 功能测试 |

## 初步分类结论

### A. 建议接受为 reference-port 候选

这些不是直接合并，而是在 GetTokens fork 中用窄测试证明缺失后最小重实现。

1. Translator / protocol hardening
   - 涉及 upstream：v7.1.63、v7.1.64、v7.1.74、v7.2.7、v7.2.10、v7.2.11、v7.2.15、v7.2.16。
   - 候选行为：finish_reason 全 chunk 处理、response aggregation / annotation、Antigravity Claude WebSearch 到 native googleSearch、Claude tool_result normalization、Codex web_search_call server tool blocks、Claude responses namespace/function call mapping、content block stream hardening、tool_use/tool_result adjacency、assistant prefill stripping、tool call ID sanitization。
   - 边界：只改 translator 层和必要 executor helper；不得改账号选择、route guard 或 Codex system/developer 策略。
   - 建议子 space：20260618-cliproxyapi-translator-protocol-hardening-v7216。

2. Codex Responses WebSocket / compact response hardening
   - 涉及 upstream：702295d7、4330b926、2e81766c、ed52c614、3b961190、56988aea、f33bc56b、b9d024af、96a8b0cf。
   - 候选行为：Codex stream errors 转 Claude、generated image extraction 性能、pending tool call / response ID 注入测试、terminal event/error propagation、websocket passthrough、transcript state、compaction trigger、usage limit retry、reasoning text event normalization。
   - 边界：GetTokens 已有 Codex websocket transport、live sessions、usage attribution 和 route guard hook，必须先证明上游行为在 fork 当前路径缺失；不能覆盖现有 GetTokens websocket session ownership。
   - 建议子 space：20260618-cliproxyapi-codex-websocket-v7216-hardening。

3. Management log cursor / observability
   - 涉及 upstream：c61453a8、95a72a47、331daa24、0d82daca、d417fa53、917cec3b、db3fdea4、a47c3863、5036513b、0b21b071。
   - 当前 fork 已存在 internal/api/handlers/management/logs.go，说明可能已有同类或 fork 自研能力。
   - 候选行为：cursor tail、rotation continuation、zero-offset disambiguation、bounded cursor reads、避免全量计数。
   - 边界：GetTokens 侧必须按 dev App / sidecar log / doctor workbench 消费方式复核，不直接照搬 management API contract。
   - 建议子 space：20260618-cliproxyapi-management-log-cursor-audit。

4. OpenAI video request/auth binding 差异复核
   - 涉及 upstream：v7.2.2、v7.2.5、v7.2.9、v7.2.14。
   - 当前 fork 已存在 sdk/api/handlers/openai/openai_videos_handlers.go，需要判断是否已有 GetTokens 版本，还是缺 upstream 的 auth binding、proxy、video_url extraction/validation。
   - 边界：只有当 GetTokens 产品要支持 video proxy，才进入实现；否则只保留差异审计。
   - 建议子 space：20260618-cliproxyapi-openai-video-diff-audit。

5. 小型 model / executor compatibility
   - 涉及 upstream：Claude Fable 5、Kimi K2.7 Code、Composer context length、Antigravity version/UA、XAI compact response、XAI websocket executor、Anthropic web_search domains sanitize。
   - 边界：模型 registry 变更先对齐 GetTokens model catalog / account capability，不默认照加照删；XAI websocket 是 executor 新能力，需要产品证据和 fake upstream tests。
   - 建议先拆成 model-catalog-compat 与 xai-antigravity-executor-compat 两个候选。

### B. 只进入设计/研究，暂不实现

1. Auth / scheduler / home / cache 运行态变化：refresh token singleflight、credential errors to unauthorized、frontend auth providers、post-auth interceptors、home credential forwarding、kv cache fault tolerance、config API key exclusion、usage limit retry。原因是这些直接触及 GetTokens 账号 SQLite、manual disabled、quota guard、route guard、project candidate pool、OAuth refresh 和 runtime snapshot。

2. Claude cloak / disable-image-generation passthrough / thinking refactor：这些是跨 provider 行为策略，不是普通 translator bug；必须先定义 GetTokens 的用户配置语义和默认值。

3. Auto-updater skip logic：GetTokens 是 Wails/macOS 桌面应用，更新路径由父仓 release governance 管，不跟 CLIProxyAPI upstream auto-updater 决策。

### C. 默认拒绝或忽略

1. Pluginhost / pluginstore / interceptor / model router 大块能力：默认拒绝实现。只有用户明确要求评估 CLIProxyAPI pluginhost 是否成为 GetTokens 插件运行层时，另开 architecture research space。

2. AMP integration removal：默认拒绝。当前 fork 仍保留 internal/api/modules/amp/* 和 test/amp_management_test.go；除非 GetTokens 产品明确废弃 AMP，否则不得用 upstream 删除驱动 fork 删除。

3. Build / release / Docker / sponsorship / README / examples：忽略或记录为 upstream-only。GetTokens sidecar 构建由父仓 scripts/ensure-sidecar.sh 和 macOS release pipeline 管理。

4. Config legacy migration removal：拒绝默认跟随。GetTokens 要保护已有用户迁移路径。

## 推荐执行顺序

1. translator-protocol-hardening-v7216：价值明确、实现面相对窄，先补 focused tests。
2. codex-websocket-v7216-hardening：高价值但高风险，必须先列出现有 fork websocket 路径与上游差异。
3. management-log-cursor-audit：先做差异审计，避免重复实现已有 GetTokens log/doctor 能力。
4. openai-video-diff-audit：仅当产品确认 video proxy 需要继续支持时进入实现。
5. model-catalog-compat / xai-antigravity-executor-compat：按用户可见模型能力和账号配置证据排期。
6. auth-runtime-state-research：只做设计，不与前面小修混在同一 PR。
7. pluginhost/pluginstore/AMP/build/release 默认不排期。

## 验收标准

### BDD 场景

1. 给定 upstream 已到 v7.2.16，当评估合并时，必须先用 canonical remote 和临时 clone 验证 tag，而不是相信本地 fork tag 缓存或 AxApp fork。
2. 给定 upstream delta 超过百个 commit，当形成计划时，必须按能力族拆分，并拒绝整包 merge。
3. 给定候选能力触及 Codex WebSocket、账号、auth scheduler、management API 或 pluginhost，当进入实现前，必须先创建子 space 和 evidence matrix。
4. 给定候选只是 translator 小修，当进入实现时，仍必须先写失败测试，再做最小 patch。
5. 给定本地 fork 已有未提交改动，当后续实现时，不得把当前 openai_quota_reset dirty work 混入 reference-port commit。

### 本轮门禁

- 已读取项目级 gettokens-cliproxyapi-reference-port 和 gettokens-ops-governance。
- 已读取当前 AGENTS.md。
- 已确认父仓和 fork dirty 状态。
- 已通过 canonical upstream 临时 clone 获取 v7.1.53..v7.2.16 log、diff stat、name-only。
- 本轮不运行 Go/Node 功能测试；这是纯评估和文档落位。
- 纯文档验收运行 docs-linhay/scripts/check-docs.sh 和 git diff --check。

## 设计稿入口

- 本期设计稿：未产出
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：feat/20260618-cliproxyapi-upstream-v7216-intake
- worktree：../GetTokens-worktrees/20260618-cliproxyapi-upstream-v7216-intake/

## 相关链接

- 上一轮 intake：docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/README.md
- v7.1.53 增量计划：docs-linhay/spaces/20260608-cliproxyapi-upstream-v7150-intake/plans/v7153-incremental-intake-plan-v01.md
- reference-port skill：.agents/skills/gettokens-cliproxyapi-reference-port/SKILL.md
- ops governance skill：.agents/skills/gettokens-ops-governance/SKILL.md
- 本轮计划：docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-intake-plan-v01.md
- 本轮 closure audit：docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/plans/v7216-reference-port-closure-audit-v01.md

## 当前状态

- 状态：reference-port-closure-audited
- 最近更新：2026-06-18
