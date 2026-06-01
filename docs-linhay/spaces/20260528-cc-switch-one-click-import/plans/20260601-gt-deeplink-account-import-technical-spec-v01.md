# GetTokens gt deep link 账号导入技术规格 v01

日期：2026-06-01

## 结论

本期只做 GetTokens 私有账号与账号配置导入，不做 cc-switch 格式兼容，不做旧 `gettokens://` 入口兼容，不做 Codex / Claude Code 本地配置写回，不做 MCP、prompt、skill、script 导入。

最终入口固定为一类：

```text
gt://app/v1/import?payload=<base64url-json>
```

`gt://app/v1/import?payload=...` 用于系统 deep link 唤起桌面 app。协议不使用 `resource=account`、`resource=codex-config`、`resource=codex-setup`，也不使用 `resource=provider`、`documents`、`operations`、`codexLocal` 这类兼容层或文件补丁语义。

账号写入只通过 sidecar management API 的统一账号接口完成，最终编译为 `cliproxyapi.AccountWriteRequest` 并调用 `POST /v0/management/accounts`。GetTokens 不直接写 auth-file、Codex API key JSON store、`config.yaml` 账号段或账号 SQLite。

## 范围

### 本期支持

1. `gt://app/v1/import?payload=...` 解析 GetTokens 私有 JSON。
2. 多账号导入，账号数量不设置硬上限。
3. 每个账号导入后由 sidecar 分配新的 `acct_*`。
4. 单账号失败不回滚其他已成功账号。
5. UI 展示批量账号摘要、风险提示、逐账号结果。
6. 日志、debug、UI preview 对 API key、token、payload 脱敏。

### 本期不支持

1. 不支持 cc-switch provider / MCP / prompt / skill 格式。
2. 不导入 script，也不接受 `usageScript`、任意 JS、任意 shell。
3. 不支持 `configUrl` 或其他远程配置拉取。
4. 不支持 query 级 `headers.*` 注入。
5. 不写 `CODEX_HOME/auth.json`、`CODEX_HOME/config.toml`、`CLAUDE_CONFIG_DIR/settings.json`。
6. 不更新已有账号；本期导入只创建新账号。
7. 不接受 payload 中的 `account_key` 作为写入目标。
8. 不提供跨账号事务；失败账号可重试，成功账号保留。

## URL 规范

### GetTokens private deep link

```text
gt://app/v1/import?payload=<base64url-json>
```

解析规则：

| 部分 | 规则 |
| --- | --- |
| scheme | 必须是 `gt` |
| host | 必须是 `app` |
| path | 必须是 `/v1/import`，尾部 `/` 可接受并归一化 |
| payload | 必须是 Base64URL UTF-8 JSON；接受无 padding 和有 padding 两种编码 |

不采用 `gt://app/v1/import/payload=<base64>`。`payload` 是参数，不是路径资源；放 query 里更利于系统 URL parser、红线字段脱敏和后续粘贴导入复用。

### Dev smoke alias

开发与本地冒烟允许使用：

```text
gt-dev://app/v1/import?payload=<base64url-json>
```

`gt-dev://` 只用于本地测试入口隔离，payload schema、校验、preview 和 apply 语义必须与 `gt://` 完全一致。Wails 构建配置需要同时注册 `gt` 与 `gt-dev`，确保本地可通过系统 URL handoff 做真实冒烟；产品文档、外部链接和正式分发仍只使用 `gt://app/v1/import?payload=...`。

### 不兼容入口

以下入口直接拒绝，不做迁移窗口：

| 输入 | 错误码 |
| --- | --- |
| `gettokens://v1/import...` | `unsupported_scheme` |
| `gt://v1/import...` | `unsupported_route` |
| `gt://app/v1/import?resource=...` | `missing_payload` |
| `gt://app/v1/import/payload=...` | `unsupported_route` |
| cc-switch `resource=provider/mcp/prompt/skill` | `unsupported_resource` |
| `POST /v0/management/gettokens/account-imports...` | `unsupported_route` |

## 私有 payload schema

### 顶层结构

```json
{
  "schema": "gettokens.import.v1",
  "source": {
    "name": "team-doc",
    "url": "https://example.com/setup"
  },
  "options": {
    "continue_on_error": true
  },
  "accounts": [
    {
      "ref": "team-relay",
      "kind": "codex-api-key",
      "title": "Team Relay",
      "provider": "codex",
      "disabled": false,
      "codex_api_key": {
        "api_key": "sk-xxx",
        "base_url": "https://api.example.com/v1",
        "prefix": "",
        "proxy_url": "",
        "websockets": true,
        "models_json": "[{\"name\":\"gpt-5-codex\",\"alias\":\"gpt-5-codex\"}]",
        "format_base_urls_json": "{\"openai_responses\":\"https://api.example.com/v1\"}"
      }
    }
  ]
}
```

### 顶层字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schema` | 是 | 固定 `gettokens.import.v1` |
| `source` | 否 | 展示与审计用，不参与信任判断 |
| `options.continue_on_error` | 否 | 默认 `true`；`false` 表示首个失败后停止后续账号 |
| `accounts` | 是 | 账号数组；数量不设硬上限 |

### account 字段

`accounts[]` 尽量贴近 `cliproxyapi.AccountWriteRequest`，只增加一个本地关联字段 `ref`：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `ref` | 否 | payload 内部关联和结果回填用；不写入 sidecar |
| `kind` | 是 | `auth-file` / `codex-api-key` / `openai-compatible` |
| `title` | 否 | 账号卡标题；缺失时按 kind 和 provider 派生 |
| `provider` | 否 | provider 标识；缺失时按 kind 派生 |
| `priority` | 否 | 初始优先级 |
| `disabled` | 否 | 默认 `false` |
| `auth_file` | kind=auth-file 必填 | 对应 `AuthFileAccountCredential` |
| `codex_api_key` | kind=codex-api-key 必填 | 对应 `CodexAPIKeyAccountCredential` |
| `openai_compatible` | kind=openai-compatible 必填 | 对应 `OpenAICompatibleAccountCredential` |

禁止字段：

| 字段 | 原因 |
| --- | --- |
| `account_key` | 新建账号必须由 sidecar 分配 `acct_*` |
| `credential_source` | 事实源由 sidecar 决定 |
| `runtime_apply_status` / `runtime_apply_error` | runtime 状态由 sidecar watcher 产生 |
| `documents` / `operations` | 本期不做文件 patch 语义 |
| `codexLocal` / `claudeLocal` | 本期不写本地 CLI 配置 |
| query 级 `headers.*` 或顶层 header patch | 避免外链注入请求头 |

### auth-file account

```json
{
  "ref": "codex-oauth",
  "kind": "auth-file",
  "title": "team-codex-auth.json",
  "provider": "codex",
  "auth_file": {
    "source_file_name": "team-codex-auth.json",
    "auth_json": "{\"auth_mode\":\"chatgpt\",\"tokens\":{\"access_token\":\"...\"}}",
    "auth_type": "codex",
    "email": "team@example.com",
    "plan_type": "plus"
  }
}
```

规则：

1. `auth_json` 必须是完整 JSON 字符串，不接受 `documents/operations` 拼装。
2. 导入前调用现有 auth-file normalize / profile extraction 逻辑。
3. UI 只展示 email、plan、auth_type、source_file_name 和 token 存在性，不展示完整 token。

### codex-api-key account

```json
{
  "ref": "codex-relay",
  "kind": "codex-api-key",
  "title": "Team Codex Relay",
  "provider": "codex",
  "codex_api_key": {
    "api_key": "sk-xxx",
    "base_url": "https://api.example.com/v1",
    "prefix": "",
    "proxy_url": "socks5://127.0.0.1:7890",
    "websockets": true,
    "quota_curl": "",
    "quota_enabled": false,
    "billing_curl": "",
    "billing_enabled": false,
    "format_base_urls_json": "{\"openai_responses\":\"https://api.example.com/v1\",\"anthropic\":\"https://api.example.com/anthropic\"}",
    "models_json": "[{\"name\":\"gpt-5-codex\",\"alias\":\"gpt-5-codex\"}]",
    "excluded_models_json": "[]"
  }
}
```

规则：

1. `api_key` 和 `base_url` 必填。
2. `websockets` 缺失时默认 `true`。
3. `models_json`、`format_base_urls_json`、`excluded_models_json` 必须是合法 JSON 字符串。
4. `quota_curl`、`billing_curl` 可以导入，但 UI 必须高亮它们来自外部 payload；默认不自动执行。

### openai-compatible account

```json
{
  "ref": "deepseek",
  "kind": "openai-compatible",
  "title": "DeepSeek",
  "provider": "deepseek",
  "openai_compatible": {
    "provider_name": "deepseek",
    "base_url": "https://api.deepseek.com/v1",
    "prefix": "",
    "api_key_entries_json": "[{\"api-key\":\"sk-xxx\"}]",
    "models_json": "[{\"name\":\"deepseek-chat\",\"alias\":\"deepseek-chat\"}]"
  }
}
```

规则：

1. `provider_name`、`base_url`、`api_key_entries_json` 必填。
2. `api_key_entries_json` 必须至少包含一个非空 `api-key`。
3. `headers_json` 只允许通过私有 JSON payload 导入，不允许通过 URL query 注入 headers。
4. 当 `provider_name` 与现有账号冲突时，默认自动追加 ` #2`、` #3`，不覆盖旧账号。

## 解析与执行流程

```text
URL
  |
  v
ImportRequestIngress
  |-- gt://app/v1/import?payload=... -> decodeBase64URLPayload()
  |
  v
validateGetTokensImportPayload()
  |
  v
compileAccountWriteRequest()
  |
  v
PreviewDeepLinkImport()
  |
  v
ApplyDeepLinkImport()
  |
  v
sidecar POST /v0/management/accounts
```

### ingress

1. deep link 只接受 `gt://app/v1/import?payload=...`。
2. `payload` 在 redacted URL 中显示为 `[REDACTED]`。
3. 旧 scheme、cc-switch resource、路径式 payload 和导入 POST route 全部在 ingress 阶段拒绝。

### preview

Preview 不写入账号，只返回：

1. 总账号数量。
2. 每个账号的 kind、title、provider、base_url、模型数量、key 数量。
3. 每个账号的 warning / blocking error。
4. 重名后的目标标题预估。
5. 来源、schema、协议类型。

### apply

Apply 按数组顺序执行：

1. 编译为 `AccountWriteRequest`。
2. 调用 `CreateAccount`。
3. 保存 sidecar 返回的 `account_key`。
4. 单项失败时记录错误；若 `continue_on_error=true` 继续下一个账号。
5. 结束后刷新账号列表。

默认不回滚已创建账号。因为 sidecar `acct_*` 分配和 runtime apply 是外部状态，批量事务会扩大失败面；用户可以在结果页删除误导入账号。

## Wails / frontend DTO

### request / preview

```go
type DeepLinkImportPreview struct {
    Protocol     string
    RedactedURL  string
    Source       DeepLinkImportSource
    Accounts     []DeepLinkAccountPreviewItem
    Warnings     []string
    Blocking     []string
}

type DeepLinkAccountPreviewItem struct {
    Index         int
    Ref           string
    Kind          string
    Title         string
    Provider      string
    BaseURL       string
    APIKeyPreview string
    KeyCount      int
    ModelCount    int
    Disabled      bool
    Warnings      []string
    Blocking      []string
}
```

### apply result

```go
type DeepLinkApplyResult struct {
    Status   string
    Total    int
    Created  int
    Failed   int
    Accounts []DeepLinkAccountApplyResultItem
}

type DeepLinkAccountApplyResultItem struct {
    Index      int
    Ref        string
    Kind       string
    Title      string
    AccountKey string
    Status     string
    Error      string
}
```

`Status` 取值：

| 值 | 含义 |
| --- | --- |
| `applied` | 全部成功 |
| `partial` | 部分成功、部分失败 |
| `failed` | 全部失败 |
| `noop` | 没有可导入账号 |

## UI 细节

1. deep link 事件进入账号页后打开账号导入确认 modal。
2. modal 标题使用“导入账号”，不再使用“应用模板到 Codex”。
3. 顶部显示来源、协议类型、账号数量、风险数量。
4. 列表按导入顺序展示账号；每项展示 kind、title、provider、base URL、模型数量、key 数量。
5. API key 只展示 `abcd****wxyz` 形式。
6. `auth-file` 只展示 email、plan、auth_type、token 存在性。
7. footer 显示“导入 N 个账号”；失败后显示逐账号结果。
8. 浏览器 preview 模式只展示，不调用 Wails 写入。

## 测试矩阵

### Go parser tests

1. `gt://app/v1/import?payload=...` 支持多账号。
2. `gt://app/v1/import/payload=...` 返回 `unsupported_route`。
3. `gettokens://v1/import...` 返回 `unsupported_scheme`。
4. `gt://v1/import?resource=provider...` 返回 `unsupported_route`。
5. payload 中 `account_key`、`documents`、`operations`、`codexLocal` 被拒绝。
6. payload 大小超过上限时返回 `payload_too_large`。
7. `POST /v0/management/gettokens/account-imports...` 返回 `unsupported_route`。

### Go apply tests

1. 多账号全部成功，返回 `applied` 和每项 `account_key`。
2. 中间账号失败且 `continue_on_error=true`，返回 `partial` 并继续后续账号。
3. 中间账号失败且 `continue_on_error=false`，停止后续账号。
4. openai-compatible 重名时自动 suffix，不覆盖原账号。
5. auth-file 导入调用 normalize，结果写入 `POST /v0/management/accounts`。

### Frontend tests

1. deep link 预览渲染批量账号列表。
2. API key、token、payload 全部脱敏。
3. blocking error 禁用导入按钮。
4. partial result 展示逐账号成功和失败。
5. preview-only 环境不调用 Wails apply。

### 验证命令

```bash
go test ./internal/wailsapp -run DeepLink -count=1
go test ./internal/cliproxyapi -run Account -count=1
node --test frontend/src/features/accounts/tests/accountLocalCliMapping.test.mjs
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
```

涉及 Wails 绑定变更后，再运行：

```bash
./scripts/wails-cli.sh build
```

## 实施顺序

1. 删除旧 `gettokens://` 和 `gt://v1/import` 兼容测试，新增明确拒绝测试。
2. 拆分导入入口：deep link payload parser、payload validator、compiler。
3. 新增 `AccountWriteRequest` 直接编译路径，绕开旧 `DeepLinkAccountDraft` 和旧 `AccountImportPayloadItem`。
4. 改 Wails DTO 和 root binding mapper。
5. 改前端 deep link modal 为批量账号确认。
6. 跑测试和 Wails build。

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| URL 太长 | deep link 限制 decoded payload 字节数；超限时要求改用文件导入 |
| 账号名冲突 | 自动 ` #2` suffix，不覆盖旧账号 |
| 部分导入失败 | 返回逐账号结果，不回滚已创建账号 |
| 外链带恶意脚本 | 不支持 cc-switch/script/configUrl，拒绝 `documents/operations/codexLocal` |
| sidecar 未 ready | 预览可做；apply 返回 sidecar not ready，不写入 |
| 旧链接仍被点击 | 直接拒绝并提示当前只支持 GetTokens 私有入口 |
