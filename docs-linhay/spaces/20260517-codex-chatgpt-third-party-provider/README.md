# Codex ChatGPT Login With Third-Party Provider

## 背景
用户希望验证一条关于 Codex App 的教程是否真有上游源码支撑：

1. `auth.json` 保持 ChatGPT 登录态：
   - `"auth_mode": "chatgpt"`
   - `"OPENAI_API_KEY": null`
2. `config.toml` 指向第三方 provider：
   - `model_provider = "apiname"`
   - `[model_providers.apiname]`
   - `experimental_bearer_token = "xxxx"`
   - `requires_openai_auth = true`

用户关心的不是 GetTokens 自己是否能写出这份配置，而是 OpenAI Codex 本体是否真的支持这种“保留 ChatGPT 登录态，同时把主对话请求发到第三方 OpenAI-compatible provider”的混合模式。

## 目标
1. 建立本次调查的 space，沉淀范围、证据与结论。
2. 核对 OpenAI Codex 源码是否真的支持上述字段与行为组合。
3. 区分以下三件事：
   - 配置字段是否存在
   - 字段是否被运行时代码真正消费
   - 用户声称的结果里，哪些能从源码直接证明，哪些只能谨慎推断

## 范围
1. 只核对 OpenAI Codex 本体源码与本仓库已有参考实现。
2. 只分析以下链路：
   - `auth.json` 中 `auth_mode` / `OPENAI_API_KEY`
   - `config.toml` 中 `model_provider` / `[model_providers.*]`
   - `experimental_bearer_token`
   - `requires_openai_auth`
   - ChatGPT 账号态、额度读取、分析事件等附属能力的代码依赖
3. 本次使用的本地源码镜像：
   - 路径：`/Users/linhey/.nolon/references/github.com/openai@codex`
   - commit：`e6773f856c97ce766b7f507a99e5447a1e2a306c`

## 非目标
1. 不对第三方中转站的可用性、合规性或稳定性背书。
2. 不做一次真实联网 E2E 来证明“所有移动端/插件能力都可用”。
3. 不修改 GetTokens 业务代码；本次以调查与文档沉淀为主。

## 验收标准
- [x] 建立独立 `space` 并补齐背景、范围与结论。
- [x] 找到 OpenAI Codex 源码中 `experimental_bearer_token`、`requires_openai_auth`、`auth_mode` 的实际消费路径。
- [x] 给出“能确认支持 / 不能直接确认”的边界说明。
- [ ] 真实联网验证第三方 provider 与 Codex App 组合的线上表现。

## 调查结论
结论分级：

1. 可以直接确认：上游源码支持这种配置组合的“机制层”。
2. 不能直接确认：教程里“完美解锁 Codex Mobile、插件、额度查询等”的全部体验细节，源码只能证明其中一部分能力边界。

可以直接确认的点：

1. `auth.json` 确实支持 `auth_mode` 与 `OPENAI_API_KEY` 两个字段，且 `OPENAI_API_KEY` 是 `Option<String>`，因此 `null` 是合法值。
   - 证据：`codex-rs/core/src/auth/storage.rs`
2. `auth_mode = "chatgpt"` 会把当前 auth 解析为 ChatGPT 登录态，而不是 API key 模式。
   - 证据：`codex-rs/core/src/auth.rs`
3. 自定义 `model_providers.*` 确实支持 `experimental_bearer_token` 与 `requires_openai_auth`。
   - 证据：`codex-rs/core/src/model_provider_info.rs`
4. `model_provider = "apiname"` 会把活跃 provider 切换到 `[model_providers.apiname]`。
   - 证据：`codex-rs/core/src/config/mod.rs`
5. 真正发模型请求时，鉴权优先级是：
   - `env_key` 对应环境变量
   - `experimental_bearer_token`
   - `auth.json` / ChatGPT 登录态里的 token
   这意味着只要自定义 provider 配了 `experimental_bearer_token`，请求头里的 `Authorization: Bearer ...` 会优先使用这个第三方 token，而不是 ChatGPT 登录 token。
   - 证据：`codex-rs/core/src/api_bridge.rs`
6. `requires_openai_auth = true` 不是摆设。它会影响 App 对“是否需要登录 OpenAI/ChatGPT 账号”的判断，以及账号状态接口的返回。
   - 证据：`codex-rs/app-server/src/codex_message_processor.rs`
7. ChatGPT 账号相关的附属能力至少有一部分是独立走 ChatGPT auth 链路的，不依赖当前模型请求是否已切到第三方 provider。
   - 额度读取要求 `auth.is_chatgpt_auth()`，并使用 `chatgpt_base_url` 构造 ChatGPT 后端客户端。
   - 分析事件也要求 `auth.is_chatgpt_auth()`，并显式带上 ChatGPT token 与 `chatgpt-account-id`。
   - 证据：`codex-rs/app-server/src/codex_message_processor.rs`、`codex-rs/core/src/analytics_client.rs`

综合判断：

1. 这条教程的核心机制成立：
   - 保留 ChatGPT 登录态
   - 让当前活跃 provider 仍然声明“需要 OpenAI auth”
   - 但实际对话请求走自定义 provider 的 `experimental_bearer_token`
2. 换句话说，源码层面确实存在“账号态看起来还是 ChatGPT / OpenAI auth，实际主请求走第三方 bearer token”的分离设计。
3. 这不是偶然副作用，而是由鉴权优先级和 app-server 账号判断逻辑共同形成的可解释行为。

不能直接从源码下死结论的点：

1. “Codex Mobile 完美解锁”
   - 本次没有核对移动端具体判定逻辑，只能说上游桌面 App / CLI 账号链路允许保留 ChatGPT auth。
2. “插件全部完美可用”
   - 只能确认部分插件/Apps/analytics 能力依赖 ChatGPT auth；不能仅凭当前阅读量就断言所有插件都不受第三方 provider 影响。
3. “额度查询一定成功”
   - 源码显示额度查询走 ChatGPT auth，而不是第三方 provider token；前提是你的 ChatGPT token 本身有效且具备对应账号信息。

## 关键证据
1. `auth.json` 结构包含 `auth_mode` 与 `OPENAI_API_KEY`：
   - `codex-rs/core/src/auth/storage.rs:43`
2. auth 解析优先认 `auth_mode`，没有 mode 时才根据 `OPENAI_API_KEY` 推断 API key：
   - `codex-rs/core/src/auth.rs:160`
   - `codex-rs/core/src/auth.rs:782`
3. 无 API key 时会被解析成 ChatGPT auth 的测试：
   - `codex-rs/core/src/auth.rs:1450`
4. provider 结构支持 `experimental_bearer_token` 与 `requires_openai_auth`：
   - `codex-rs/core/src/model_provider_info.rs:57`
5. 请求鉴权优先级里，`experimental_bearer_token` 先于 `auth.json` token：
   - `codex-rs/core/src/api_bridge.rs:239`
6. app-server 用 `requires_openai_auth` 决定是否展示/返回账号认证需求：
   - `codex-rs/app-server/src/codex_message_processor.rs:1259`
7. app-server 读取账号、额度时要求 ChatGPT auth：
   - `codex-rs/app-server/src/codex_message_processor.rs:1302`
   - `codex-rs/app-server/src/codex_message_processor.rs:1382`
8. analytics 事件也独立要求 ChatGPT auth：
   - `codex-rs/core/src/analytics_client.rs:408`

## 对教程的技术化改写
更准确的表述应该是：

1. 先保留或登录 ChatGPT 账号，使 `auth.json` 维持 ChatGPT auth。
2. 再把 `model_provider` 切到一个自定义 provider。
3. 让该 provider 配置 `requires_openai_auth = true`，这样 Codex App 仍把它视为需要 OpenAI/ChatGPT 账号态的 provider。
4. 同时配置 `experimental_bearer_token`，这样主对话请求会优先使用第三方 bearer token，而不是 ChatGPT token。

这比“实测对话走第三方中转站”更精确，因为源码已经把“账号态”和“实际模型请求 token”拆成了两条逻辑。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260517-codex-chatgpt-third-party-provider`
- worktree：`../GetTokens-worktrees/20260517-codex-chatgpt-third-party-provider/`

## 相关链接
- OpenAI Codex 本地源码镜像：`/Users/linhey/.nolon/references/github.com/openai@codex`
- GetTokens 现有本地 relay 写入逻辑：`internal/wailsapp/relay_local_apply.go`
- GetTokens 现有 Codex provider 解析：`internal/wailsapp/local_codex_providers.go`

## 当前状态
- 状态：investigated
- 最近更新：2026-05-17
