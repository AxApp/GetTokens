# CLIProxyAPI upstream v7.2.58 intake

## 背景

用户要求 sidecar 同步上游变更。GetTokens 侧 canonical upstream 为 `https://github.com/router-for-me/CLIProxyAPI.git`，当前本地已接受 tag 到 `v7.2.49`，2026-07-10 查到 canonical upstream 最新 tag 为 `v7.2.58`。

当前 GetTokens fork：`docs-linhay/references/CLIProxyAPI`，branch `gettokens/sidecar`，HEAD `2443e76f Deduplicate concurrent auth refreshes`。

## 目标

- 对 `v7.2.49..v7.2.58` 做 reference-port intake。
- 不全量 merge upstream；按 GetTokens sidecar 热路径重实现可接受变更。
- 第一批优先同步低耦合且影响运行态稳定性的变更：auth/quota 稳定性、Codex WebSocket 错误映射、模型 header override。

## 范围

- upstream commit/tag 比较：`v7.2.49..v7.2.58`。
- 账号选择、auth refresh、quota cooldown、Codex WebSocket、模型 registry / header override 等 sidecar 运行态候选。
- 文档/赞助素材/README 仅分类，不 port。

## 非目标

- 不合并 upstream Docker、README、赞助图、TUI 展示等非 GetTokens 运行态内容。
- 不在本轮引入完整 Google Interactions 协议面；该变更跨 70+ 文件，应独立评审。
- 不触碰 `/Applications/GetTokens.app` 正式版。

## 验收标准

- [x] 确认 canonical upstream 最新 tag。
- [x] 生成 `v7.2.49..v7.2.58` commit、stat、name-only 差异证据。
- [x] 分类 accepted / planned / deferred / rejected 候选。
- [x] 第一批 accepted 小切片完成测试、fork commit、sidecar clean rebuild。
- [x] 文档与 memory 写回，父仓门禁通过。

## Upstream 差异摘要

- 最新 tag：`v7.2.58`。
- 对比基线：`v7.2.49`。
- 差异规模：154 文件，约 20792 行新增、1071 行删除。
- 主要类别：
  - 文档/赞助素材：README 与 sponsor assets。
  - Interactions 协议：新增 `gemini-interactions` / `interactions` translators、handlers、config。
  - Auth 与路由稳定性：invalid_grant retry suspension、unauthorized 后自动 refresh、quota cooldown 抖动和上限。
  - Codex / 模型：Codex WebSocket `message_too_big` 映射、模型 modalities、模型 header override、GPT-5.6/Grok/XAI 更新。
  - Config / management：safe mode、WebsocketAuth 默认值、config list 扩展。

## 分类

### Accepted 第一批

- `3aa42a6f fix(auth): handle invalid_grant errors with retry suspension logic`
- `ec3aba23 feat(auth): enable automatic credential refresh on unauthorized errors`
- `270869dd fix(auth): escalate quota backoff once per cooldown window and jitter cooldown waits`
- `0d23f791 fix(auth): keep jittered cooldown waits within max-retry-interval`
- `4f157fbd fix(executor): map message_too_big WebSocket errors to structured API responses`
- `26d45fd4 feat(models): add model header overrides from configuration`

## 本轮落地

- fork commit：`64d11c3bd9d0faeebf8f0f783f9b7af63f2f4f61` (`Port selected upstream sidecar fixes`)。
- auth/quota：
  - `invalid_grant` 不再被归类为 request-shape invalid，改为凭证/账号状态冷却与模型挂起信号。
  - 请求期遇到 401 且 auth 有 refresh token 时，同步刷新一次凭证并重试当前 auth；后台 auto-refresh 仍保留 per-auth singleflight 去重，避免重复使用同一个 refresh token。
  - quota 429 backoff 在同一个 cooldown window 内只升级一次；等待增加 jitter，且不会突破 `max-retry-interval` 上限。
- Codex WebSocket：
  - 上游 close code `CloseMessageTooBig` 映射为结构化 413 `message_too_big`，避免把裸 WebSocket close error 泄给下游。
- 模型 header override：
  - `models.json` / registry 支持 `config.override_header`。
  - Codex HTTP、compact、stream、images、WebSocket 请求在应用默认 header 后再按模型覆盖 header。

## 验证

- 红灯：
  - `TestCodexWebsocketsExecuteStreamMapsMessageTooBigClose` 旧实现返回裸 `*websocket.CloseError`。
  - `TestModelOverrideHeadersReturnsClone` / `TestApplyModelHeaderOverridesMultipleHeaders` 旧实现缺少 registry config 与 header override helper。
  - auth/quota 新测试旧实现缺少 `authAccessToken` / `jitteredCooldownWait`，且没有 401 请求期 refresh。
- 绿灯：
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./sdk/cliproxy/auth ./internal/registry ./internal/runtime/executor -count=1`
  - `GOCACHE=/private/tmp/gettokens-go-build-cache go test ./... -count=1`
  - `./scripts/ensure-sidecar.sh darwin arm64`
- sidecar build meta：`64d11c3bd9d0faeebf8f0f783f9b7af63f2f4f61:clean:5e5bbc367ae302e0a74ed4a96855183561af427e9043f6810115130ffe226ca4:darwin:arm64`

### Planned / 需要独立切片

- `078ed178` / `15f30371` Codex client model modalities：当前 GetTokens fork 已有 registry 层 `supportedInputModalities`，需单独确认 openai-compatible 输出契约后 port。
- `b4c59405` / `f21beb05` / `5f8899b7` 模型 registry 更新：需要跟 GetTokens 模型映射策略核对，避免把 upstream 实验模型直接暴露给用户。
- `505c59d8` Codex auth filename/account hashing：与 GetTokens account-store 命名和重复导入逻辑相关，需独立证据。
- `df080389` safe mode management access：GetTokens 有本地 management key 与桌面 sidecar 管理边界，需单独评估。

### Deferred

- `8b9c4da2 feat(interactions): add support for Google Interactions`：跨协议、translator、handler、config、TUI 与 API key 管理，超出本轮同步热修范围。
- Antigravity hub user-agent 重构：非当前 Codex/账号卡异常主路径。

### Rejected / 不 port

- README、赞助素材、图片资产、文档链接调整。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260710-cliproxyapi-upstream-v7258-intake`
- worktree：`../GetTokens-worktrees/20260710-cliproxyapi-upstream-v7258-intake/`

## 相关链接

- canonical upstream：`https://github.com/router-for-me/CLIProxyAPI.git`
- previous accepted tag：`v7.2.49`
- latest upstream tag：`v7.2.58`

## 当前状态
- 状态：first-batch-done
- 最近更新：2026-07-10
