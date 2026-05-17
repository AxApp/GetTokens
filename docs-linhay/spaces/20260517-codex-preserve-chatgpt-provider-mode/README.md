# Codex Preserve ChatGPT Auth Provider Mode

## 背景
当前 GetTokens 的“一键应用到本地 Codex”链路以 relay key 为中心，落盘策略是：

1. 把 `CODEX_HOME/auth.json` 强制改写为 `auth_mode = "apikey"`
2. 把 relay key 写入 `OPENAI_API_KEY`
3. 再写入 `config.toml` 的 `model` / `model_provider` / `[model_providers.*]`

这条链路适合“把本地 Codex 完全切成 API Key 模式”，但不适合本轮新增目标：

1. 保留用户已经登录好的 ChatGPT / Codex 账号态
2. 同时把主对话请求切到第三方 OpenAI-compatible provider
3. 尽量保住上游 Codex App 里仍依赖 ChatGPT auth 的附属能力

前一轮源码调查已经确认，上游 Codex 存在这种机制层支持：账号态与主请求 bearer token 可以分离。但 GetTokens 当前前后端都还没有围绕这个模式做正式产品设计。

## 目标
1. 为“保留 ChatGPT 登录态的一键配置模式”建立正式需求空间。
2. 明确该模式的用户场景、入口位置、风险提示、验收标准。
3. 给出前后端统一方案，替代当前仅支持 `auth_mode = "apikey"` 的单一路径。
4. 明确与现有状态页本地工作台、账号池、OAuth 登录桥接之间的边界。

## 范围
1. 仅覆盖本地 Codex 配置写入场景，不改变 sidecar 业务路由。
2. 仅覆盖桌面端 GetTokens -> 本地 `CODEX_HOME` 的写入与预览：
   - `auth.json`
   - `config.toml`
3. 仅设计 Codex 的两种本地应用模式：
   - `replace_auth_with_apikey`：现有模式
   - `preserve_chatgpt_auth`：本期新模式
4. 涉及前端页面范围：
   - `frontend/src/features/status/StatusFeature.tsx`
   - `frontend/src/features/status/model/relayLocalState.ts`
5. 涉及后端模块范围：
   - `internal/wailsapp/relay_local_apply.go`
   - 新的本地 auth 读取 / preview DTO / apply DTO
   - root `app.go` / `app_types.go` / `app_mappers.go` 的 Wails 暴露层

## 非目标
1. 不在本期接入真实线上探活或自动验证第三方 provider 可用性。
2. 不在本期改造账号池登录流程；用户若未登录 ChatGPT，仍通过现有账号池 OAuth 入口解决。
3. 不在本期自动修复所有历史 `auth.json` 漂移状态。
4. 不在本期支持把内置 `openai` provider 直接变成 bearer-token provider。
5. 不在本期管理移动端、浏览器插件或所有 Apps 能力的兼容矩阵。

## 验收标准
- [ ] 用户能在 UI 中明确选择“替换为 API Key 模式”或“保留 ChatGPT 登录态模式”。
- [ ] 选择“保留 ChatGPT 登录态模式”时，前端能在提交前显示本机 ChatGPT auth 前置条件与风险说明。
- [ ] 选择“保留 ChatGPT 登录态模式”时，后端不会再把 `auth.json` 强制改写成 `apikey`。
- [ ] 后端能把 `config.toml` 写成非 `openai` 的自定义 provider，并包含：
  - `model_provider = "<custom-id>"`
  - `[model_providers.<custom-id>]`
  - `experimental_bearer_token = "..."`
  - `requires_openai_auth = true`
  - `wire_api = "responses"`
- [ ] 当前本地未登录 ChatGPT、`auth.json` 非法、provider id 为 `openai` 等情况会被阻止并给出明确错误。
- [ ] 前后端各自补齐测试与文档写回。

## 用户场景
### 场景 1：已有 ChatGPT 登录态，想把主对话切到第三方 provider
1. 用户本机 `CODEX_HOME/auth.json` 已有有效 ChatGPT auth。
2. 用户在 GetTokens 状态页选择 relay key、endpoint、model。
3. 用户切换为“保留 ChatGPT 登录态”模式。
4. 用户填写一个非 `openai` 的 provider id / name。
5. 系统预览差异，显示：
   - `auth.json` 将保留
   - `config.toml` 将新增或更新自定义 provider
6. 用户确认后应用成功。

### 场景 2：用户未登录 ChatGPT，误选保留模式
1. 用户切到“保留 ChatGPT 登录态”模式。
2. 系统预检发现本地 auth 不存在或不是 ChatGPT 模式。
3. 系统阻止应用，提示先走现有 ChatGPT 登录流程。

### 场景 3：用户选择了 `openai` provider
1. 用户切到“保留 ChatGPT 登录态”模式。
2. 用户仍试图使用 `providerID = openai`。
3. 系统阻止提交，并解释：
   - 上游 Codex 内置 `openai` provider 不能被 `experimental_bearer_token` 覆盖
   - 必须改用自定义 provider id

## 核心约束
1. 新模式必须使用“非 `openai` 的自定义 provider id”。
原因：
   上游 Codex 在配置加载时先放入内置 provider，再用 `or_insert` 合并用户 provider，用户无法覆盖内置 `openai` 条目，因此不能依赖 `model_providers.openai.experimental_bearer_token` 生效。
2. 新模式默认不修改现有 ChatGPT token 结构。
原因：
   `auth.json` 是高风险资产，v1 以“保留原有 ChatGPT auth”为默认策略，比“顺手清空 / 改写字段”更稳。
3. 新模式不承诺“所有附属能力都与主请求完全同源”。
原因：
   上游 Codex 的额度读取、analytics 等仍依赖 ChatGPT auth。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260517-codex-preserve-chatgpt-provider-mode`
- worktree：`../GetTokens-worktrees/20260517-codex-preserve-chatgpt-provider-mode/`

## 相关链接
- 上游机制调查结论：[`../20260517-codex-chatgpt-third-party-provider/README.md`](../20260517-codex-chatgpt-third-party-provider/README.md)
- relay service 本地配置边界：[`../../dev/20260426-relay-service-config-boundary.md`](../../dev/20260426-relay-service-config-boundary.md)
- Codex OAuth bridge 边界：[`../../dev/20260426-codex-oauth-bridge-boundary.md`](../../dev/20260426-codex-oauth-bridge-boundary.md)
- 本期技术方案：[`../../dev/20260517-codex-preserve-chatgpt-provider-mode-design.md`](../../dev/20260517-codex-preserve-chatgpt-provider-mode-design.md)
- 本期落地计划：[`plans/20260517-codex-preserve-chatgpt-provider-mode-plan-v01.md`](plans/20260517-codex-preserve-chatgpt-provider-mode-plan-v01.md)
- 验收截图：[`screenshots/20260518/status/20260518-status-codex-preserve-chatgpt-auth-after-v01.png`](screenshots/20260518/status/20260518-status-codex-preserve-chatgpt-auth-after-v01.png)

## 当前状态
- 状态：implemented-smoked
- 最近更新：2026-05-18
- 实现摘要：
  - root `main.App` 已补齐 `GetLocalCodexAuthState` 与 `ApplyRelayServiceConfigToLocalV2`，Wails 绑定同步导出到前端。
  - `internal/wailsapp/relay_local_apply.go` 已支持双模式：
    - `replace_auth_with_apikey`
    - `preserve_chatgpt_auth`
  - preserve 模式会保留现有 `auth.json`，仅 patch `config.toml`，并写入 `experimental_bearer_token`、`requires_openai_auth`、`wire_api = "responses"`，同时清理冲突的 `env_key`。
  - `StatusFeature` / `StatusPanels` 已新增 `AUTH STRATEGY`、本地 auth 状态展示、前置阻断和 diff 预览。
- 验收记录：
  - 自动化：`go test ./internal/wailsapp`、`cd frontend && npm run typecheck`、`cd frontend && npm run test:unit -- --runInBand src/features/status/tests/relayLocalState.test.mjs`、`cd frontend && npm run build` 均通过。
  - 真实运行页：重启 `./scripts/wails-cli.sh dev` 后，`http://127.0.0.1:34115/#frame=status` 已确认 root Wails bridge 可调用 `GetLocalCodexAuthState()`，返回 `authMode=chatgpt`、`canPreserveChatGPTAuth=true`。
  - 交互复验：
    - provider=`openai` + preserve 模式时，页面显示阻断文案并禁用“应用到 CODEX”。
    - provider=`gettokens` + preserve 模式时，页面显示放行提示，diff 中出现 `+experimental_bearer_token` 与 `-env_key = "OPENAI_API_KEY"`。
