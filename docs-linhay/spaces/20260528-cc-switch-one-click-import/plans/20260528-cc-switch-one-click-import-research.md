# cc-switch 一键导入功能调研

## 调研对象

- 本地参考项目：`docs-linhay/references/cc-switch/`
- 版本：`package.json` / `tauri.conf.json` 均为 `3.15.0`
- 本地源码 HEAD：`0b1707141bbdaa5ad6c48271f5c5afe0bbbab3ef`
- 参考索引记录：`docs-linhay/references/README.md:16` 记录 cc-switch 参考项目用途与版本；该索引中的 HEAD 与当前本地 `git rev-parse HEAD` 不一致，后续若要做代码级对齐，应先刷新索引或确认本地参考项目是否有未同步更新。

## 结论摘要

cc-switch 的“一键导入”不是剪贴板自动识别，而是一个显式 deep link 导入协议：外部页面、文档或团队配置生成 `ccswitch://v1/import?...` 链接，系统唤起桌面应用，应用解析 URL，前端展示确认弹窗，用户确认后才写入数据库或配置。

这个模式适合 GetTokens 借鉴，但不能原样照搬。GetTokens 的核心对象不是单纯 CLI provider，而是账号、认证文件、CLIProxyAPI provider、账号池路由和用量状态的组合。后续若做一键导入，应把 deep link 当成“导入意图入口”，最终写入仍要走 GetTokens 现有账号/Provider 服务层和二次确认。

## 用户入口与协议

cc-switch 用户手册明确说明支持 `ccswitch://` 深度链接，可用于团队共享配置、教程一键配置和跨设备同步。官方还提供在线生成工具 `https://farion1231.github.io/cc-switch/deplink.html`，用户填写配置后生成 deep link。

协议格式是：

```text
ccswitch://v1/import?resource={type}&app={app}&name={name}&...
```

支持的资源类型：

| resource | 作用 | 关键参数 |
| --- | --- | --- |
| `provider` | 导入供应商配置 | `app`、`name`、`endpoint`、`apiKey`、`homepage`、`model`、`config`、`usageScript` |
| `mcp` | 导入 MCP server | `apps`、`config`、`enabled` |
| `prompt` | 导入提示词预设 | `app`、`name`、`content`、`description`、`enabled` |
| `skill` | 导入 skill 仓库信息 | `repo`、`directory`、`branch` |

关键出处：

- 用户手册说明和生成工具：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md:3`
- V1 协议格式：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md:27`
- provider 参数：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md:45`
- 使用流程和确认弹窗：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md:151`
- 安全提醒：`docs-linhay/references/cc-switch/docs/user-manual/zh/5-faq/5.3-deeplink.md:197`

## 调用链路

### 1. 桌面协议注册

Tauri 配置注册 `ccswitch` scheme，源码启动阶段注册 deep link handler：

- scheme 配置：`docs-linhay/references/cc-switch/src-tauri/tauri.conf.json:56`
- 启动注册 handler：`docs-linhay/references/cc-switch/src-tauri/src/lib.rs:729`
- `on_open_url` 回调只处理第一个 `ccswitch://` URL：`docs-linhay/references/cc-switch/src-tauri/src/lib.rs:767`

### 2. 后端接收 URL 并发给前端

`handle_deeplink_url` 先做 `ccswitch://` 前缀判断，再调用 parser。解析成功后 emit `deeplink-import` 给前端；失败 emit `deeplink-error`。

关键出处：`docs-linhay/references/cc-switch/src-tauri/src/lib.rs:102`

### 3. Parser 转成结构化请求

`parse_deeplink_url` 校验：

1. scheme 必须是 `ccswitch`
2. host/version 必须是 `v1`
3. path 必须是 `/import`
4. query 必须包含 `resource`
5. resource 只允许 `provider` / `prompt` / `mcp` / `skill`

provider 解析阶段还会校验 `app`，当前源码允许 `claude`、`codex`、`gemini`、`opencode`、`openclaw`、`hermes`，并支持逗号分隔多个 endpoint。

关键出处：

- URL 基础校验：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/parser.rs:11`
- resource 分派：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/parser.rs:52`
- provider app 与字段解析：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/parser.rs:70`

### 4. 前端确认弹窗

前端监听 `deeplink-import`。如果 payload 包含 `config` 或 `configUrl`，先调用后端 `merge_deeplink_config` 合并完整配置，再展示确认弹窗。用户点击导入后调用 `import_from_deeplink_unified`，按返回资源类型刷新 provider / MCP / prompt / skill 缓存。

关键出处：

- 监听事件并合并 config：`docs-linhay/references/cc-switch/src/components/DeepLinkImportDialog.tsx:51`
- 用户确认后导入：`docs-linhay/references/cc-switch/src/components/DeepLinkImportDialog.tsx:94`
- 导入后按资源刷新：`docs-linhay/references/cc-switch/src/components/DeepLinkImportDialog.tsx:133`

### 5. 后端统一导入

后端命令 `import_from_deeplink_unified` 根据 `request.resource` 分派到 provider、prompt、mcp、skill 导入函数，并返回结构化结果。

关键出处：`docs-linhay/references/cc-switch/src-tauri/src/commands/deeplink.rs:46`

## Provider 导入细节

provider 导入核心函数 `import_provider_from_deeplink` 做五件事：

1. 验证 resource 必须是 `provider`
2. 合并 inline config
3. 要求最终存在 `app`、`apiKey`、`endpoint`、`homepage`、`name`
4. 按 app 类型构建 provider settings
5. 调 `ProviderService::add` 写入，若 `enabled=true` 再切换为当前 provider

关键出处：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:23`

### 多 endpoint 处理

`endpoint` 支持逗号分隔。第一个 endpoint 是主 endpoint，其余 endpoint 作为 custom endpoints 附加到 provider。

关键出处：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:54`

### App 映射

| app | 写入形态 | 关键行为 |
| --- | --- | --- |
| Claude | `env.ANTHROPIC_AUTH_TOKEN`、`env.ANTHROPIC_BASE_URL`、模型 env | 可带 haiku / sonnet / opus 独立模型 |
| Codex | `auth.OPENAI_API_KEY` + 生成 `config.toml` 文本 | 默认 `wire_api = "responses"`、`requires_openai_auth = true`、默认模型 `gpt-5-codex` |
| Gemini | `GEMINI_API_KEY`、`GOOGLE_GEMINI_BASE_URL`、`GEMINI_MODEL` | flat env |
| OpenCode | `@ai-sdk/openai-compatible` options/models | `baseURL`、`apiKey`、models |
| OpenClaw | `baseUrl`、`apiKey`、`api`、models | 默认 `api = "openai-completions"` |
| Hermes | `base_url`、`api_key`、`api_mode`、models | 默认 `api_mode = "chat_completions"` |

关键出处：

- Claude 映射：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:247`
- Codex 映射：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:286`
- Gemini / OpenCode / OpenClaw / Hermes 映射：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:357`

### Inline config 合并

provider deep link 可以只带 `config` + `configFormat`，让后端从 Base64 内嵌配置中补齐 API key、endpoint、model 等字段。优先级是 URL params 高于 inline config。`configUrl` 字段存在，但当前实现直接返回“Remote config URL is not yet supported”，因此不能视为已完成的远程导入能力。

关键出处：

- config merge 入口和优先级注释：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:473`
- remote config 暂不支持：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:490`
- Claude config 抽取：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:549`
- Codex config 抽取：`docs-linhay/references/cc-switch/src-tauri/src/deeplink/provider.rs:614`

### 用量查询脚本

provider 参数支持 `usageScript`、`usageEnabled`、`usageApiKey`、`usageBaseUrl`、`usageAccessToken`、`usageUserId`、`usageAutoInterval`。`usageScript` 是 Base64 编码的 JavaScript，最终写入 provider meta 的 `UsageScript`。

这对 GetTokens 有参考价值，但风险更高：如果 GetTokens 允许外部链接导入脚本，必须单独设计信任边界、执行沙箱、展示和禁用默认策略。首期不建议跟随 cc-switch 把脚本导入纳入 MVP。

## 测试覆盖

cc-switch 有 Rust 集成测试覆盖 provider deep link 写入：

- Claude provider 写入 DB 并校验 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL`：`docs-linhay/references/cc-switch/src-tauri/tests/deeplink_import.rs:9`
- Codex provider 写入 DB 并校验 `OPENAI_API_KEY`、endpoint 和 model 出现在生成 config 中：`docs-linhay/references/cc-switch/src-tauri/tests/deeplink_import.rs:45`

GetTokens 后续若实现，应按同等粒度先补解析与导入服务测试，再接 UI 确认流。

## 对 GetTokens 的借鉴建议

### 可直接借鉴

1. 使用显式 URL scheme 做外部导入入口，例如 `gettokens://v1/import?...`。
2. 所有 deep link 先解析成结构化 `ImportRequest`，不要直接写配置。
3. 导入前必须展示确认弹窗，敏感字段默认脱敏。
4. URL 参数优先于 inline config，便于外部链接覆盖少量字段。
5. `enabled=true` 这类会产生副作用的字段必须显式传入，默认只导入不启用。
6. 对不同 resource 使用统一入口、分资源导入结果，便于 UI 刷新和错误提示。

### 需要重新设计

1. GetTokens 的导入对象应优先是 `account` / `provider template` / `CLIProxyAPI provider`，不是直接映射各 CLI 配置文件。
2. Codex 官方 OAuth、openai-compatible、API key 账号的字段边界不同，不能只靠 `apiKey` + `endpoint` 表达。
3. CLIProxyAPI Management API 已有 provider import / config sync 语义，deep link 应调用现有服务层，而不是绕过 sidecar 直接写文件。
4. usage script 不应进入首期 MVP；如果要做，只允许导入模板引用或只读预览，不默认执行。
5. `configUrl` 远程拉取能力需要签名、域名 allowlist、大小限制和超时策略；首期应只支持 inline config。

## 建议的 GetTokens MVP

### 协议草案

```text
gettokens://v1/import?resource=account&channel=codex&mode=openai-compatible&name=My%20Provider&baseUrl=https%3A%2F%2Fapi.example.com%2Fv1&apiKey=sk-xxx&model=gpt-5-codex
```

首期只建议支持：

| resource | 说明 |
| --- | --- |
| `account` | 导入 Codex / Claude API key 或 openai-compatible 账号 |
| `provider` | 导入 CLIProxyAPI provider 草稿，不立即启用 |

首期不建议支持：

- `usageScript`
- remote `configUrl`
- 批量导入多个账号
- 自动启用并切换当前账号

### BDD 验收草案

Given 用户点击可信来源的 `gettokens://v1/import?...`
When GetTokens 被系统唤起
Then 后端解析 URL 并发出待确认导入请求
And 前端展示来源、账号类型、base URL、模型、脱敏 API key
And 默认不启用、不切换当前账号

Given 用户确认导入
When 参数完整且通过校验
Then GetTokens 调用现有账号服务创建账号
And 若需要 CLIProxyAPI provider，同步调用 Management API
And 导入结果出现在账号列表中

Given URL 缺少必填字段或包含不支持的 resource
When GetTokens 解析 deep link
Then 不写入任何文件或数据库
And 显示明确错误

## 风险清单

1. Deep link 中 API key 会进入浏览器历史、聊天记录或日志；必须在日志、UI 和文档中默认脱敏。
2. URL 长度限制会影响 inline config；复杂配置更适合文件导入或本地 paste JSON。
3. 自动启用/切换当前账号容易造成用户正在运行的 CLI 使用错误账号；首期应禁止默认切换。
4. 远程 config URL 会引入供应链风险；不做签名和 allowlist 前不要实现。
5. 脚本导入会引入远程代码执行风险；即使只是 usage script，也需要单独安全设计。

## 后续行动项

1. 若确认要进入产品设计，新建或复用产品 space，先写 GetTokens `gettokens://` deep link 的 feature spec。
2. 先实现 parser + service 层测试，不先做 UI。
3. 在账号创建服务层增加“导入草稿”模式，默认不启用、不切换。
4. 若要支持 CLIProxyAPI provider，同步校准 Management API 的 provider import 字段和 GetTokens 本地账号模型。
