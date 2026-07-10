# CLIProxyAPI upstream v7.2.60 intake

## 背景

用户要求 sidecar 同步上游变更。GetTokens 侧 canonical upstream 为 `https://github.com/router-for-me/CLIProxyAPI.git`，当前本地已接受 tag 到 `v7.2.49`，2026-07-10 首轮查到 canonical upstream 最新 tag 为 `v7.2.58`，继续同步时复核到最新 tag 已更新为 `v7.2.60`。

当前 GetTokens fork：`docs-linhay/references/CLIProxyAPI`，branch `gettokens/sidecar`，HEAD `c1b0dd6c Port CLIProxyAPI upstream fixes through v7.2.60`。

## 目标

- 对 `v7.2.49..v7.2.60` 做 reference-port intake。
- 不全量 merge upstream；按 GetTokens sidecar 热路径重实现可接受变更。
- 优先同步影响 GetTokens 运行态稳定性、Codex/Claude 兼容性、模型暴露契约和 sidecar 热路径的变更。

## 范围

- upstream commit/tag 比较：`v7.2.49..v7.2.60`。
- 账号选择、auth refresh、quota cooldown、Codex WebSocket、模型 registry / header override、Codex client models、Claude/Gemini translator、thinking validator、xAI reasoning、Claude model id 暴露等 sidecar 运行态候选。
- 文档/赞助素材/README 仅分类，不 port。

## 非目标

- 不合并 upstream Docker、README、赞助图、TUI 展示等非 GetTokens 运行态内容。
- 不在本轮引入完整 Google Interactions 协议面；该变更跨 70+ 文件，应独立评审。
- 不引入 upstream example safe-mode management path；GetTokens management/Wails 边界独立维护。
- 不触碰 `/Applications/GetTokens.app` 正式版。

## 验收标准

- [x] 确认 canonical upstream 最新 tag。
- [x] 生成 `v7.2.49..v7.2.60` commit、stat、name-only 差异证据。
- [x] 分类 accepted / planned / deferred / rejected 候选。
- [x] accepted 小切片完成测试、fork commit、sidecar clean rebuild。
- [x] 文档与 memory 写回，父仓门禁通过。

## Upstream 差异摘要

- 最新 tag：`v7.2.60`。
- 对比基线：`v7.2.49`。
- 差异规模：首轮 `v7.2.49..v7.2.58` 为 154 文件，约 20792 行新增、1071 行删除；继续同步时补充 `v7.2.59..v7.2.60`。
- 主要类别：
  - 文档/赞助素材：README 与 sponsor assets。
  - Interactions 协议：新增 `gemini-interactions` / `interactions` translators、handlers、config。
  - Auth 与路由稳定性：invalid_grant retry suspension、unauthorized 后自动 refresh、quota cooldown 抖动和上限。
  - Codex / 模型：Codex WebSocket `message_too_big` 映射、模型 modalities、模型 header override、Codex client `max` / `ultra`、GPT-5.6/Grok/XAI 更新。
  - Translator / executor：Claude/Gemini sampling、OpenAI to Gemini max token、stream usage attribution、Codex to Claude function call buffering。
  - Config / management：safe mode、WebsocketAuth 默认值、config list 扩展。

## 分类

### Accepted

- `3aa42a6f fix(auth): handle invalid_grant errors with retry suspension logic`
- `ec3aba23 feat(auth): enable automatic credential refresh on unauthorized errors`
- `270869dd fix(auth): escalate quota backoff once per cooldown window and jitter cooldown waits`
- `0d23f791 fix(auth): keep jittered cooldown waits within max-retry-interval`
- `4f157fbd fix(executor): map message_too_big WebSocket errors to structured API responses`
- `26d45fd4 feat(models): add model header overrides from configuration`
- `078ed178` / `15f30371` Codex client model modalities 与非 template priority。
- `505c59d8` Codex auth filename/account hashing。
- imagegen function tool 去重兼容 flattened namespace。
- Claude/Gemini translator sampling 与 max token 映射修正。
- stream usage buffer，避免 usage delta 被多次或过早归因。
- Codex to Claude pending function call buffering。
- thinking validator Kimi `max` clamp。
- xAI reasoning effort 按 registry metadata 判断。
- `/backend-api/codex/responses` WebSocket GET 请求日志覆盖。
- Claude model id prefix / reverse id 兼容。
- selected `models.json` registry 更新与 upstream-only model 补充。
- `v7.2.60` Codex client `ultra` reasoning effort 暴露。

## 本轮落地

- fork commit：
  - 第一批：`64d11c3bd9d0faeebf8f0f783f9b7af63f2f4f61` (`Port selected upstream sidecar fixes`)。
  - 完整同步：`c1b0dd6c49952160bf84ec21076dab3ca104e027` (`Port CLIProxyAPI upstream fixes through v7.2.60`)。
- auth/quota：
  - `invalid_grant` 不再被归类为 request-shape invalid，改为凭证/账号状态冷却与模型挂起信号。
  - 请求期遇到 401 且 auth 有 refresh token 时，同步刷新一次凭证并重试当前 auth；后台 auto-refresh 仍保留 per-auth singleflight 去重，避免重复使用同一个 refresh token。
  - quota 429 backoff 在同一个 cooldown window 内只升级一次；等待增加 jitter，且不会突破 `max-retry-interval` 上限。
- Codex WebSocket：
  - 上游 close code `CloseMessageTooBig` 映射为结构化 413 `message_too_big`，避免把裸 WebSocket close error 泄给下游。
- 模型 header override：
  - `models.json` / registry 支持 `config.override_header`。
  - Codex HTTP、compact、stream、images、WebSocket 请求在应用默认 header 后再按模型覆盖 header。
- Codex client models：
  - 同步 `codex_client_models.json` 到 `v7.2.60`。
  - 暴露 `max` 与 `ultra` reasoning effort；补齐 modalities metadata、priority、空 `service_tiers` 与 image model 可见性清理。
- Translator / executor：
  - Claude translators/executor 不再向上游透传 temperature；thinking 开启时移除 `top_p` / `top_k`。
  - OpenAI `max_tokens` / `max_completion_tokens` 映射为 Gemini `generationConfig.maxOutputTokens`。
  - Kimi 与 OpenAI-compatible streaming 使用 `StreamUsageBuffer` 稳定 usage 归因。
  - Codex to Claude response translator 缓冲 pending function call，终端响应补发未完成调用并回填 arguments。
  - xAI reasoning effort 由 registry metadata 决策，不再依赖硬编码 allowlist。
- 其他兼容：
  - WebSocket auth 默认开启。
  - Codex credential filename 对 team/k12 scope 使用 hash 前先校验 hash 非空并 trim。
  - Claude `/models` 对非 `claude-*` id 使用可逆 prefix，request 入口支持 reverse id 解码。
  - request logging 覆盖 `/backend-api/codex/responses` WebSocket GET。

## 验证

- 红灯：
  - `TestCodexWebsocketsExecuteStreamMapsMessageTooBigClose` 旧实现返回裸 `*websocket.CloseError`。
  - `TestModelOverrideHeadersReturnsClone` / `TestApplyModelHeaderOverridesMultipleHeaders` 旧实现缺少 registry config 与 header override helper。
  - auth/quota 新测试旧实现缺少 `authAccessToken` / `jitteredCooldownWait`，且没有 401 请求期 refresh。
  - 后续 accepted 切片均先补 focused tests 覆盖旧实现缺口，包括 Codex client `ultra`、filename hashing、imagegen 去重、translator sampling、usage buffer、pending function calls、thinking clamp、xAI reasoning、Claude model prefix。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth ./internal/registry ./internal/runtime/executor -count=1`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./internal/translator/claude/gemini ./internal/translator/claude/openai/chat-completions ./internal/translator/gemini/openai/chat-completions ./internal/translator/codex/claude ./internal/runtime/executor/helps ./internal/runtime/executor ./internal/config ./internal/auth/codex ./sdk/api/handlers/openai -count=1`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -count=1`
  - `./scripts/ensure-sidecar.sh darwin arm64`
- sidecar build meta：
  - 第一批：`64d11c3bd9d0faeebf8f0f783f9b7af63f2f4f61:clean:5e5bbc367ae302e0a74ed4a96855183561af427e9043f6810115130ffe226ca4:darwin:arm64`
  - 完整同步：`c1b0dd6c49952160bf84ec21076dab3ca104e027:clean:30bac5e7872369c3ea81a8fe30d687f28d42eb81ba4a47d6b113eac05babd506:darwin:arm64`

### Planned / 需要独立切片

- Google Interactions：若未来产品需要，需要单独做协议、translator、handler、config、UI 与 API key 管理方案。
- example safe mode management access：若未来需要，应按 GetTokens management/Wails 边界重新设计，不直接 port upstream example path。

### Deferred

- `8b9c4da2 feat(interactions): add support for Google Interactions`：跨协议、translator、handler、config、TUI 与 API key 管理，超出本轮同步热修范围。
- full-file `models.json` 覆盖：当前 GetTokens fork 有本地/更新 metadata，采用结构化合并，保留 GetTokens 更完整的 xAI thinking metadata。

### Rejected / 不 port

- README、赞助素材、图片资产、文档链接调整。
- `df080389` upstream example API key safe-mode server path：当前 GetTokens sidecar 不使用该 path，management API 可按桌面产品需求破坏性调整，不为上游兼容保留旧合约。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260710-cliproxyapi-upstream-v7258-intake`
- worktree：`../GetTokens-worktrees/20260710-cliproxyapi-upstream-v7258-intake/`

## 相关链接

- canonical upstream：`https://github.com/router-for-me/CLIProxyAPI.git`
- previous accepted tag：`v7.2.49`
- latest upstream tag：`v7.2.60`

## 当前状态
- 状态：synced-through-v7.2.60
- 最近更新：2026-07-10
