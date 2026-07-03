# 20260703-cliproxyapi-upstream-v7249-intake

## 背景

用户要求“同步 cpa 上游功能”。按 GetTokens 当前治理规则，CPA/CLIProxyAPI 上游不能做 full merge，也不直接 cherry-pick 大块提交；上游只能作为 reference input。需要先确认 canonical upstream 与本地 fork 差异，再挑 GetTokens sidecar 边界内可验证的最小行为移植。

本轮只读探测结果：

- canonical upstream：`https://github.com/router-for-me/CLIProxyAPI.git`
- 已验证最新 upstream tag：`v7.2.49@cde9336b`
- 上一轮 intake 基线：`v7.2.16`
- 本轮 intake 窗口：`v7.2.16..v7.2.49`
- 上游窗口规模：约 110 commits，303 files changed，`+22287/-9316`
- 本地维护 fork：`docs-linhay/references/CLIProxyAPI#gettokens/sidecar@f2c4cdf5`
- 本地 fork describe：`v7.1.28-122-gf2c4cdf5`

## 目标

1. 建立 `v7.2.16..v7.2.49` 的 intake 证据和分类结论。
2. 只移植一个证据明确、影响面窄的运行时行为，避免把 pluginhost/home/auth 大块上游逻辑带入 GetTokens sidecar。
3. 保持 GetTokens sidecar 自治边界：账号选择、route guard、rate-limit、live sessions、usage attribution、system proxy、Codex WebSocket 与 management API 不被上游通用逻辑覆盖。

## 范围

- 审核 `v7.2.16..v7.2.49` tag/commit/file delta。
- 本轮实现 slice：Codex Responses 下游 WebSocket、上游 HTTP/SSE 的非 passthrough 路径必须全量 transcript replay，不再向 CPA-mediated upstream 发送 `previous_response_id`。
- 更新本 space、当天 memory，并运行 focused Go test 与文档门禁。

## 非目标

- 不 merge upstream `v7.2.49`。
- 不 cherry-pick 上游大块 commit。
- 不引入 upstream pluginhost/pluginstore/home plugin 同步体系。
- 不删除 GetTokens fork 仍需保留的 Gemini CLI / AMP / 本地 sidecar 能力。
- 不触碰 `/Applications/GetTokens.app`、正式 sidecar、正式配置或正式进程。

## 证据矩阵

| 项目 | 当前证据 | 判断 |
| --- | --- | --- |
| 问题来源 | 用户要求同步 CPA 上游功能 | 进入 upstream reference-port，不做整包 merge |
| canonical upstream | `router-for-me/CLIProxyAPI.git`，最新 tag `v7.2.49@cde9336b` | 可信来源 |
| 当前 fork | `gettokens/sidecar@f2c4cdf5` | 可直接做 focused slice |
| 上游窗口 | `v7.2.16..v7.2.49`，303 files，`+22287/-9316` | 范围过大，禁止整包 merge |
| 已存在行为 | `strip model prefix for websocket payloads` 已在 fork 内存在 | 不重复实现 |
| 缺失行为 | `sdk/api/handlers/openai/openai_responses_websocket.go` 仍允许非 passthrough 上游使用 `previous_response_id` | 本轮接受为最小实现 |
| 预期验收 | focused test 固定第二轮 payload 不含 `previous_response_id` 且包含合并 transcript | 红灯后最小 patch |

## 分类结论

### A. 本轮接受并实现

1. Codex WS-to-SSE transcript replay hardening
   - upstream source：`8f686345 fix(responses): full transcript replay on WS-to-SSE Codex paths`
   - GetTokens 当前事实：fork 已有 failover 后 transcript replay 测试，但普通非 passthrough 第二轮仍可能走 incremental `previous_response_id`。
   - 实现边界：只调整 downstream WebSocket + CPA-mediated upstream HTTP/SSE 归一化开关；不改变 upstream websocket passthrough。

### B. 后续 reference-port 候选

1. Translator hardening：structured tool choice、input image/audio details、Gemini schema sanitize、Responses reasoning to Gemini signatures。
2. Auth/model alias hardening：OAuth model alias force mapping、API key alias response rewrite、transient cooldown。
3. OpenAI image/video proxy：`gpt-image-1.5`、direct image API proxy、video auth model binding。
4. Model registry：Claude Sonnet 5 metadata、Gemini 3.5 Flash variants、Codex client model `service_tiers`。

### C. 默认拒绝或暂不跟随

1. Pluginhost/pluginstore/home plugin 大块体系：GetTokens 当前没有把 CPA pluginhost 作为桌面插件层的产品决策。
2. Build/release/Docker/README/partners/sponsorship：属于上游项目治理，不进入 GetTokens runtime。
3. 删除 Gemini CLI translator/executor：GetTokens fork 是否保留需另开迁移决策，不由上游删除驱动。

## 验收标准

### BDD 场景

1. 给定下游 Codex 以 WebSocket 连入 GetTokens，且上游不是 websocket passthrough，当第二轮请求带 `previous_response_id` 时，sidecar 必须把完整 transcript 合并后发送给上游 HTTP/SSE，不发送 `previous_response_id`。
2. 给定上游是 end-to-end websocket passthrough，仍允许使用 incremental `previous_response_id`，不被本轮改动破坏。
3. 给定 upstream `v7.2.49` 含大量 pluginhost/home/auth 改动，本轮不得把它们混入 sidecar reference-port。

### 本轮门禁

- `go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocketMergesTranscriptForNonPassthroughUpstream|TestResponsesWebsocketInjectsPreviousResponseIDForWebsocketUpstream' -count=1`
- `git -C docs-linhay/references/CLIProxyAPI diff --check`
- `docs-linhay/scripts/check-docs.sh`
- `git diff --check`

## 实施记录

- fork commit：`7c6c1077 fix(gettokens): replay transcript for codex ws sse`
- 接受行为：Codex Responses 下游 WebSocket 经 sidecar 转发到 CPA-mediated upstream 时，第二轮请求合并完整 transcript，不再发送 `previous_response_id`。
- 红灯：新增 `TestResponsesWebsocketMergesTranscriptForNonPassthroughUpstream` 后，当前实现失败于 `previous_response_id must not be sent on non-passthrough upstream`。
- 绿灯：禁用该 handler 路径的 incremental `previous_response_id` 推断后，新增测试通过。
- sidecar rebuild：`build/bin/cli-proxy-api.meta.json` 指向 `7c6c107792d4faa14ed1aa53a3117110b05c7768:clean:8217992a8fe06b4265aa6d7f9248a8d1978b35531abb24fa6faea4a39262a3d1:darwin:arm64`。

## 验收结果

- `go test ./sdk/api/handlers/openai -run 'TestResponsesWebsocketMergesTranscriptForNonPassthroughUpstream|TestResponsesWebsocketPrewarmHandledLocallyForSSEUpstream|TestResponsesWebsocketReleasesPinnedAuthAfterQuotaError|TestResponsesWebsocketReleasesPinnedAuthAfterRouteGuardBlock|TestResponsesWebsocketRequestBoundaryReleaseUsesRouteGuard' -count=1`：通过。
- `go test ./sdk/api/handlers/openai -count=1`：通过。
- `go test ./... -count=1`：通过。
- `git -C docs-linhay/references/CLIProxyAPI diff --check`：通过。
- `./scripts/ensure-sidecar.sh darwin arm64`：通过，clean source build。
- 真实 dev App 手点：未运行。本轮不涉及 macOS/Wails native surface，按 AGENTS 普通 sidecar 修复验收规则以自动化测试和 clean sidecar rebuild 为准。
- 正式版 GetTokens：未触碰 `/Applications/GetTokens.app`、正式 sidecar、正式配置或正式进程。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260703-cliproxyapi-upstream-v7249-intake`
- worktree：`../GetTokens-worktrees/20260703-cliproxyapi-upstream-v7249-intake/`

## 相关链接

- 上一轮 intake：`docs-linhay/spaces/20260618-cliproxyapi-upstream-v7216-intake/README.md`
- reference-port skill：`.agents/skills/gettokens-cliproxyapi-reference-port/SKILL.md`
- ops governance skill：`.agents/skills/gettokens-ops-governance/SKILL.md`

## 当前状态
- 状态：implemented
- 最近更新：2026-07-03
