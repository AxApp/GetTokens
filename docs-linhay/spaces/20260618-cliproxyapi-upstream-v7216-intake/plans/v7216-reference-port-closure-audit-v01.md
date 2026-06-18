# CLIProxyAPI v7.2.16 reference-port closure audit v01

## 目标

证明本轮 `v7.1.53..v7.2.16` upstream 新增功能已经按 GetTokens reference-port 流程完成评估：可接入的窄行为已在 `gettokens/sidecar` 内重实现；已满足的候选没有制造无意义提交；缺产品/策略/热路径边界的候选已 defer；不适合 GetTokens 的 upstream-only 变化已 reject / ignore。

## Fork commits

| Commit | Slice | 状态 |
| --- | --- | --- |
| `51f9d9c4` | Gemini streaming finish_reason delay | implemented |
| `803ab64c` | Gemini assistant prefill stripping | implemented |
| `578afbfe` | Claude mid-conversation system consolidation | implemented |
| `7cc308d0` | Codex web_search_call to Claude server tool blocks | implemented |
| `de947e0f` | Codex stream errors to Claude | implemented |
| `66558927` | Responses WebSocket terminal/error payloads | implemented |
| `19fbddc4` | Responses WebSocket incremental state | implemented |
| `8d1ef22c` | Management log cursor tailing | implemented |
| `411a50f9` | Latest compatible model catalog entries | implemented |
| `d9d9c6a2` | Claude web_search empty domain sanitizer | implemented |

> `f2910e97` 是本轮过程中出现的 OpenAI quota reset management API fork commit，属于相邻 GetTokens sidecar 管理面工作，不作为 v7.2.16 upstream reference-port closure 的核心 commit 计入本表。

## 已满足 / 不改代码

| Candidate | 证据 | 决策 |
| --- | --- | --- |
| OpenAI Responses top-level `output_text` omission | 临时加入 upstream 场景后 focused test 直接通过，已撤回临时测试 | already-satisfied-no-port |
| Responses WebSocket input item ID dedupe | fork 已有 duplicate id / referenced tool call dedupe，focused selector 通过 | already-satisfied-no-port |
| Responses WebSocket handler integration | `19fbddc4` 已接入 last response id / pending tool call state；临时 handler tests 通过后撤回 | already-satisfied-no-port |

## Deferred

| Candidate | 原因 | 重新进入条件 |
| --- | --- | --- |
| Codex/XAI upstream WebSocket passthrough | 会改变 GetTokens sidecar 对 Codex WebSocket hot path、route guard、live sessions、usage attribution、account selection 与 failover 的所有权 | 独立产品策略；fake upstream + route guard/live sessions/usage attribution tests |
| XAI WebSocket executor / compact / reasoning / tool_choice normalization | 新 provider executor 与 compact/reasoning 语义混合，缺 GetTokens 用户场景与 route selection 设计 | 独立 executor compatibility space；fake upstream + route selection tests |
| Antigravity executor/version/UA/grounding/signature/home-kv | 涉及 Antigravity runtime 策略、Home/KV/signature 语义，不是单点 translator bug | Antigravity 产品场景明确；状态机与 fake upstream tests |
| OpenAI video support | Sora mapping、retrieve/content URL、download、auth binding、TTL cache 需要 video proxy 产品入口 | 独立 video proxy space；fake upstream、proxy/security、auth binding、download stream tests |
| Auth/runtime state | refresh singleflight、config API key exclusion、home credential forwarding、cache fault tolerance、config snapshot、usage-limit retry、Claude cloak/fallback 触及 GetTokens sidecar 自治热路径 | 独立需求；账号 SQLite、route guard、quota/rate-limit、usage attribution、live sessions、Home refresh 状态机与 E2E tests |

## Rejected / ignored

| Candidate | 决策 |
| --- | --- |
| Pluginhost / pluginstore / interceptor / model router | Reject。需要新插件运行层和管理面，不属于 reference-port。 |
| AMP removal | Reject。GetTokens fork 当前仍保留 AMP integration，不跟随 upstream 删除。 |
| Build / release / Docker / sponsorship / README / examples | Ignore。GetTokens sidecar 构建与发版由父仓流程控制。 |
| Config legacy migration removal | Reject。GetTokens 需要保护已有用户迁移路径。 |

## Verification summary

- 每个 implemented slice 均有对应 child space、evidence matrix、红灯或缺失证明、focused tests、fork commit、docs/memory 写回。
- 最新 fork HEAD：`d9d9c6a2 fix(claude): sanitize empty web search domains`。
- 最新 sidecar meta：`d9d9c6a2450562fcd5d3508972282cb928c99215:clean:6d320244d2e7dc98bf8e3112e527ad5a7bc47bc50f5c14167e9611166e3d1fdf:darwin:arm64`。
- 最新 sidecar sha256：`989fe66c50afb9866b62da02d58f22b4bc31717ab01c9f5f55f4eb6a11c2b7a6`。
- 当前环境限制：sandbox 禁止 localhost listener，若 package-level tests 失败于 `httptest.NewServer` / `[::1]:0`，以 focused no-listener tests 和明确记录作为本轮证据边界；该模式已沉淀到 `.agents/skills/gettokens-cliproxyapi-reference-port/SKILL.md`。
- 正式版 GetTokens 未触碰：`/Applications/GetTokens.app` 时间戳保持 `Jun  7 11:08:33 2026`。

## Parent closure risk

父仓存在大量并行脏改。本轮最终父仓提交只能 stage 以下 closure set，禁止吸收无关变更：

- `.agents/skills/gettokens-cliproxyapi-reference-port/SKILL.md`
- `docs-linhay/references/CLIProxyAPI` gitlink
- `docs-linhay/spaces/20260618-cliproxyapi-*`
- `docs-linhay/memory/2026-06-18.md` 中本轮 CLIProxyAPI reference-port 相关记录

`docs-linhay/memory/2026-06-18.md` 是共享日记文件，若其中混有其他工作面记录，提交前需要 hunk 级复核；不能为获得 clean tree 而提交 `.codex/config.toml`、Wails/frontend、quota reset UI、route guard DSL 或其他 unrelated dirty files。
