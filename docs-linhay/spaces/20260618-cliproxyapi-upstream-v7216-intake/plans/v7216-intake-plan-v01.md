# CLIProxyAPI v7.2.16 Intake Plan v01

## 执行原则

本计划只评估 upstream v7.1.53..v7.2.16。后续执行必须继续遵守：

1. 不 full-merge upstream tag。
2. 不 cherry-pick 大块 upstream commit as-is。
3. 接受项只作为 reference-port，必须在 GetTokens sidecar 边界内窄实现。
4. 每个实现切片先创建子 space，再写 BDD、证据矩阵、失败测试和验收命令。
5. fork 先提交，父仓再记录 gitlink、space、memory 和必要构建元信息。
6. 当前 fork 有 openai_quota_reset dirty work，后续 reference-port 实现前必须先隔离或确认归属，不得混入。

## Phase 0：Intake 准备结果

- 父仓 HEAD：ec4f2498 feat: land omniroute capability foundations
- 父仓当前 dirty：存在 .codex/config.toml、memory、references、relay vendor docs、internal/cliproxyapi/types.go 等多项未提交改动。
- fork branch：gettokens/sidecar
- fork HEAD：4781570f chore: record gettokens sidecar smoke provenance
- fork dirty：internal/api/server.go、internal/api/handlers/management/openai_quota_reset.go、internal/api/handlers/management/openai_quota_reset_test.go
- canonical upstream latest：v7.2.16@dd49a520
- v7.2.16..origin/main：空。
- review range：v7.1.53..v7.2.16
- review range size：138 commits / 316 files / +38281/-8716

## Phase 1：Translator / protocol hardening

接受为第一优先级 reference-port 候选。已拆到 `20260618-cliproxyapi-translator-protocol-hardening-v7216` 并完成本轮闭环。

上游行为池：

- 58bf645e：finish_reason all chunks。
- dc04d8be：response aggregation 和 annotation handling。
- 48dcadd9：Antigravity Claude WebSearch to native googleSearch。
- d6c4fc2d：mid-conversation system messages consolidate。
- 2406daf3：Claude tool_result content normalize。
- 30dc2e7f：Codex web_search_call stream to Claude server tool blocks。
- f49d1798：Claude responses namespace/function call mapping。
- a5cb8832：content block stream-specific handling。
- f23fb122：tool_use 与 tool_result adjacency。
- dd49a520：assistant prefill stripping、tool call ID sanitize tests。
- cde5081e：OpenAI responses top-level output_text omission test。

建议子 space：20260618-cliproxyapi-translator-protocol-hardening-v7216。

Evidence gate：

- upstream source commit：逐项列在子 space。
- 当前 fork code location：internal/translator/**、必要时 internal/runtime/executor/helps/**。
- 当前现象：先用 red tests 证明 fork 当前缺失对应行为；不能只凭 upstream 新增判断需要修改。
- 预期验收：focused translator package tests、受影响 executor helper tests、go test ./internal/translator/... ./internal/runtime/executor/helps/... -count=1。
- 非目标：不改账号选择、auth、route guard、management API、pluginhost。

执行状态：

- Implemented：Gemini / Gemini CLI streaming finish_reason 延迟输出，fork commit `51f9d9c4`。
- Implemented：Gemini / Gemini Responses request 末尾 assistant prefill stripping，fork commit `803ab64c`。
- Implemented：Claude mid-conversation system messages consolidation，fork commit `578afbfe`。
- Implemented：Codex web_search_call 到 Claude server tool blocks，fork commit `7cc308d0`。
- Implemented：Codex stream errors 转 Claude，fork commit `de947e0f`。
- Already satisfied：OpenAI Responses top-level `output_text` omission。临时 upstream 场景测试直接通过，撤回测试，不做 fork commit。
- Deferred by boundary：Antigravity Claude WebSearch to native googleSearch、Claude responses namespace/function call mapping、tool_use/tool_result adjacency、tool call ID sanitize 等混合跨 provider 行为未在本轮找到足够红灯证据或会触及更大 runtime/executor 策略；保留到后续独立 evidence gate。

## Phase 2：Codex WebSocket / compact response / reasoning hardening

接受为高风险 reference-port 候选，但必须在 translator 小修之后单独做。

上游行为池：

- 702295d7：Codex stream errors translated for Claude。
- 4330b926、2e81766c：generated image extraction memory/perf。
- ed52c614：response ID injection / pending tool calls tests。
- 3b961190：terminal events and error propagation。
- 56988aea：Codex websocket passthrough。
- f33bc56b：transcript state tracking and compaction trigger。
- b9d024af：usage limit errors retry logic。
- 96a8b0cf：reasoning text events normalize。

建议子 space：20260618-cliproxyapi-codex-websocket-v7216-hardening。

Evidence gate：

- 先画 fork 当前 sdk/api/handlers/openai/openai_responses_websocket.go 与 GetTokens hooks 的数据链。
- 红灯必须覆盖 terminal upstream event、pending tool call / response ID 注入、compact response / compaction、usage limit retry 与 route guard / failure budget 的关系。
- 验收命令至少包括 focused sdk/api/handlers/openai tests、focused internal/runtime/executor/codex* tests、GetTokens hooks / routing affected tests。

执行状态：

- Implemented：WebSocket `response.done` terminal event 与 inline `type=error` payload 终止传播，fork commit `66558927`。
- Implemented：Responses WebSocket incremental state，记录 last response id / pending tool calls，并按 pending output 注入 `previous_response_id`，fork commit `19fbddc4`。
- Already satisfied：duplicate input item ID / referenced tool call dedupe，focused upstream 场景直接通过，不做 fork commit。
- Already satisfied：handler-level `previous_response_id` injection、pending output missing 与 `generate` fallback cleanup，临时 handler tests 通过后撤回，不做 fork commit。
- Deferred by product strategy：Codex/XAI upstream WebSocket passthrough、XAI Responses WebSocket executor、compact passthrough。原因是会改变 GetTokens sidecar 对 Codex WebSocket hot path、route guard、live sessions、usage attribution、account selection 与 failover 证据链的所有权。
- Deferred by runtime boundary：usage-limit retry 与 reasoning text normalization 进入 Phase 5/6 的 XAI/Auth runtime 策略，不在本 WebSocket hardening 切片内照搬。

## Phase 3：Management log cursor audit

差异审计优先。当前 fork 已存在 management logs 文件，不能默认再实现。

上游行为池：log cursor helpers、tail management logs with cursors、cursor across rotation、zero-offset disambiguation、bounded reads、avoid full count for tail reads。

建议子 space：20260618-cliproxyapi-management-log-cursor-audit。

Evidence gate：

- 对比 upstream logs API 与 fork logs API contract。
- 明确 GetTokens 消费者：Doctor Workbench、dev App sidecar log、management API、CLI/debug script。
- 只有发现具体缺失和用户可见问题，才进入 TDD 实现。

执行状态：

- Implemented：management logs cursor tailing、cursor incremental complete-line reads、truncate / missing-file reset、rotation continuation、safe cursor file validation，fork commit `8d1ef22c`。
- Package full test limitation：当前 sandbox 禁止 localhost listener，management package 全量测试被既有 `httptest.NewServer` 用例阻断；focused cursor tests 与全仓 focused selector 已通过并记录在子 space。

## Phase 4：OpenAI video support diff audit

产品条件接受。当前 fork 已存在 sdk/api/handlers/openai/openai_videos_handlers.go，先审计再决定。

上游行为池：7de9757c、bbef8da4、2884a67e、644ba74b。

建议子 space：20260618-cliproxyapi-openai-video-diff-audit。

Evidence gate：

- 若没有 GetTokens video proxy 用户场景，本项不实现。
- 若实现，必须使用 fake upstream tests 覆盖 auth binding、proxy、validation、错误传播。
- 不允许前端或 Wails 伪造 sidecar 已处理状态。

执行状态：

- Deferred by product scenario：upstream Sora mapping、retrieve/content URL normalization、video content download、selected auth proxy binding、TTL cache 暂不实现。
- 原因：当前没有 GetTokens video proxy 用户入口或验收场景；这类能力涉及账号绑定、代理、下载流与 TTL runtime state，不是本轮已确认 sidecar bug。

## Phase 5：Model / executor compatibility

拆成两个候选：

1. model-catalog-compat：只处理 registry/catalog 与账号可见性。
2. xai-antigravity-executor-compat：处理 XAI websocket/compact 和 Antigravity UA。

Evidence gate：

- 模型新增必须证明 GetTokens catalog 未覆盖且账号能力允许。
- Executor 新能力必须有 fake upstream 和 route selection tests。
- 不默认删除或替换 GetTokens 已有 model mapping。

执行状态：

- `model-catalog-compat` 已实现窄切片：`claude-fable-5`、`kimi-k2.7-code`、`grok-composer-2.5-fast`，fork commit `411a50f9`。
- `xai-antigravity-executor-compat` 已实现窄切片：Claude built-in `web_search_*` 空 `allowed_domains` / `blocked_domains` 清理，fork commit `d9d9c6a2`。
- XAI WebSocket executor、XAI compact/reasoning/tool_choice normalize、Antigravity executor/version 暂不实现；原因是涉及新运行态与 WebSocket/route selection 所有权，需要独立产品策略与 fake upstream tests。

## Phase 6：Auth / scheduler / config / home runtime research

只研究，不进入本轮实现。

原因：这些行为都接近 GetTokens sidecar 自治热路径。GetTokens 已经有账号 SQLite、route guard、manual disabled、quota/rate-limit guard、project candidate pool、usage attribution 和 live sessions。若照搬 upstream，会产生双真相或绕过本地策略。

执行状态：

- 已建立 research space：`docs-linhay/spaces/20260618-cliproxyapi-auth-runtime-state-research/`。
- 已分类 `8e52c403` refresh singleflight、`f85768ee` config API key exclusion、`b5da0887` home credential forwarding、`2a050dc9` kv cache fault tolerance、`7f026e1a` / `a4756ab7` runtime config snapshot、`b9d024af` usage-limit retry、`8fad0d03` Claude cloak/fallback。
- 结论：全部 defer / independent-design，不做 fork 代码改动；重新进入前必须有独立产品目标、状态机边界、fake upstream/management/route guard/usage attribution 测试。

## Phase 7：拒绝 / 忽略项

- Pluginhost / pluginstore / interceptor / model router：默认拒绝实现，除非另有产品/架构决策。
- AMP removal：默认拒绝。fork 当前仍有 internal/api/modules/amp/* 与 test/amp_management_test.go。
- Build / release / Docker / sponsorship / README：忽略或记录为 upstream-only。
- Config legacy migration removal：拒绝默认跟随。

执行状态：

- Reject：Pluginhost / pluginstore / interceptor / model router。它们会引入新的插件运行层和管理面，不属于本轮 reference-port；若未来要评估，必须单独做架构 research。
- Reject：AMP removal。GetTokens fork 当前仍保留 AMP integration，不能用 upstream 删除驱动本地删除。
- Ignore：Build / release / Docker / sponsorship / README / examples。GetTokens sidecar 构建由父仓 `scripts/ensure-sidecar.sh` 和 macOS release pipeline 管理。
- Reject：Config legacy migration removal。GetTokens 需要保护已有用户迁移路径，不跟随 upstream 删除迁移逻辑。

## 推荐排期

已按以下顺序执行并记录：

1. Translator protocol hardening：已实现 / 已满足 / 延后项已记录。
2. Codex websocket / compact response hardening：已实现 / 已满足 / 延后项已记录。
3. Management log cursor audit：已实现。
4. OpenAI video diff audit：已延后。
5. Model catalog / XAI / Antigravity compatibility：model catalog 与 Claude web_search sanitizer 已实现；XAI / Antigravity runtime 已延后。
6. Auth runtime research：已完成 research，全部 defer / independent-design。
7. pluginhost / AMP / build-release：已记录 reject / ignore。

## 本轮 DoD

- [x] 读取项目级 reference-port 与 ops governance skill。
- [x] 读取当前 AGENTS.md。
- [x] 确认父仓与 fork dirty 状态。
- [x] 用 canonical upstream 临时 clone 验证最新 tag。
- [x] 生成 upstream commit / diff / path evidence。
- [x] 新建 intake space。
- [x] 写回分类和后续子项计划。
- [x] 运行 docs-linhay/scripts/check-docs.sh。
- [x] 运行 git diff --check。

## 未运行功能测试说明

本轮是 upstream intake 评估，不改 sidecar 代码，不运行 Go/Node 功能测试。后续任何接受项进入实现时必须重新按子 space 建立红灯测试。
