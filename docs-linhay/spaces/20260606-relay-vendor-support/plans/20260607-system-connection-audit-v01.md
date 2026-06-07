# Relay 厂商系统接线审计 v01

日期：2026-06-07
状态：system-audited / runtime-gap-identified

## 目的

本审计用于校准 `sub2api` / `new-api` 接入 GetTokens 的真实系统边界。结论不是“前端加两个厂商预设”即可完成，而是要让账号资产、管理接口、channel routing、sidecar runtime auth 和 executor 共同理解同一份多端 endpoint 配置。

## 当前系统事实

### 1. 账号模型已有多端字段

主仓 root DTO 与账号领域模型已有：

- `AccountRecord.supportedFormats`
- `AccountRecord.formatBaseUrls`
- `AccountRecord.models`
- `quotaCurl / billingCurl`
- `platformCookie / curlVariables`
- `modelFetchApiKey / modelFetchBaseUrl`

这些字段说明 GetTokens 已经有“同一账号多端 endpoint”的雏形，不能再把 `sub2api` / `new-api` 做成三个重复账号。

### 2. 账号主类型不需要新增

当前账号资产主类型包括：

- `auth-file`
- `codex-api-key`
- `openai-compatible`

`sub2api` 与 `new-api` 是 relay / gateway，不是单一上游模型厂商。首期应落在 `openai-compatible` unified account 加 `aggregator` vendor preset，不新增 `AccountRecord.accountKind`。

### 3. 前端详情页和管理调用已部分对齐

当前已看到的可用链路：

- `ApiKeyConfigDraft` 已承载 `formatBaseUrls`。
- 账号详情页已有三端配置区域：`openai-compatible / codex API / anthropic`。
- `UpdateCodexAPIKeyConfig` 与 `UpdateOpenAICompatibleProvider` 已能保存 `formatBaseUrls`。
- `resolveManagementBaseUrl` 已优先使用 `formatBaseUrls.openai_chat`，quota / billing 管理脚本不会默认误用 Codex 或 Anthropic endpoint。

这部分是 UI 和 management 层进展，不等于 runtime 已经按三端路由。

### 4. Channel Routing 已有下游协议意识，但 Codex 仍过宽

当前 Claude channel 候选过滤会检查 `supportedFormats` 是否包含 `anthropic`。

当前 Codex channel 对 `codex-api-key` 和 `openai-compatible` 账号仍直接放行，随后才检查 `openai_responses / openai_chat`。这会导致一个只声明 OpenAI Chat 的 openai-compatible 账号也可能进入 Codex 候选池。后续应收窄为下游协议优先：

- Codex / Responses 请求优先要求 `openai_responses`。
- Claude / Anthropic Messages 请求要求 `anthropic`。
- OpenAI-compatible Chat 请求要求 `openai_chat`。

### 5. Account-store 持久化了 format base URLs，但 runtime synthesis 未消费

CLIProxyAPI account-store 已有 `openai_compatible_accounts.format_base_urls_json`，并能随管理 API 往返。

当前运行态断点在 sidecar synthesizer：`synthesizeAccountStoreOpenAICompat` 只把主 `base_url` 写入 auth attributes，未把 `format_base_urls_json` 投影为 runtime 可解析的每端 endpoint。

因此当前风险是：

- 详情页能保存 `openai_chat / openai_responses / anthropic`。
- 但 executor 仍只读取 `auth.Attributes["base_url"]`。
- 下游 Claude / Codex / OpenAI-compatible 实际请求可能仍落到同一个主 `base_url`。

这会产生“UI 看起来三端已支持，运行态仍是单端”的假完成。

### 6. supportedFormats 仍不是完整持久化事实源

主仓 `BuildUnifiedOpenAICompatibleAccountRecord` 目前主要按 provider 名称推断 `supportedFormats`。如果新增 `sub2api` / `new-api` 预设但不调整能力持久化或推断逻辑，账号可能保存了三端 `formatBaseUrls`，但列表和路由看到的 `supportedFormats` 不一定准确。

首版至少需要满足其一：

1. 在 account-store credential 中持久化 `supported_formats_json`。
2. 或在回读时从非空 `formatBaseUrls` keys 派生 `supportedFormats`，再用 provider 默认值兜底。

长期更稳的是显式持久化能力集合，并把 `formatBaseUrls` 视为端点映射。

## 参考项目校准

### sub2api

本地参考显示 `sub2api` 是 AI API gateway / relay。它支持：

- `/v1/chat/completions`
- `/v1/responses`
- `/v1/models`
- `/v1/messages`
- `/antigravity/v1/messages`

文档示例中 Claude Code 使用：

```bash
export ANTHROPIC_BASE_URL="http://localhost:8080/antigravity"
```

所以首版预设默认：

- `openai_chat`: `http://localhost:8080/v1`
- `openai_responses`: `http://localhost:8080/v1`
- `anthropic`: `http://localhost:8080/antigravity`

### new-api

本地参考显示 `new-api` router 暴露：

- `/v1/models`
- `/v1/messages`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/responses/compact`

其 Web 模板也把 Codex CLI 与 Claude CLI 作为可填模板场景。

所以首版预设默认：

- `openai_chat`: `http://localhost:3000/v1`
- `openai_responses`: `http://localhost:3000/v1`
- `anthropic`: `http://localhost:3000`

## 正确接线顺序

### P0：账号能力事实源

先补账号资产级能力，不从厂商预设直接跳到 UI：

1. 明确 `supportedFormats` 是显式持久化，还是从 `formatBaseUrls` 派生。
2. 新建、编辑、复制、导入、恢复账号都要往返能力集合与端点映射。
3. 旧账号无 `formatBaseUrls` 时继续回退主 `baseUrl`。

### P1：sidecar runtime projection

在 CLIProxyAPI account-store synthesis 中投影每端 endpoint，例如：

- 主 `base_url` 保持兼容回退。
- 新增 runtime attributes 表达 `openai_chat / openai_responses / anthropic` endpoint。
- 对缺失格式使用主 `base_url` 作为最后回退，但 route explain 要保留缺失原因。

executor 侧需要按当前下游请求协议解析 endpoint：

- OpenAI Chat executor 使用 `openai_chat`。
- Codex / Responses executor 使用 `openai_responses`。
- Claude executor 使用 `anthropic`。

### P2：route context / channel filtering

Channel Routing 和 route engine 必须消费请求协议，而不是账号主格式：

1. Claude channel 候选要求 `anthropic`。
2. Codex channel 候选优先要求 `openai_responses`；是否允许 `openai_chat` fallback 必须作为显式策略，不作为默认静默行为。
3. OpenAI-compatible client 候选要求 `openai_chat`。
4. route explain 输出应包含“缺少目标 format”之类的过滤原因。

### P3：预设和创建流

在 runtime 事实源明确后，再新增：

- `vendorPresets` 中的 `sub2api` / `new-api`
- 旧 `openAICompatibleProviderPresets` 的同源薄别名或入口收敛
- 创建流测试，确保三端端点被写入账号配置

### P4：管理接口和本地 CLI apply

保持现有方向：

- `/models`、quota、billing 使用管理 base URL：`modelFetchBaseUrl || formatBaseUrls.openai_chat || baseUrl`。
- Codex direct 使用 `openai_responses`。
- Claude Code direct 使用 `anthropic`。
- 管理凭据不进入 runtime auth、route guard、usage attribution 或本地 direct auth。

## 测试门禁

后续实现不能只跑预设存在性测试。最小门禁应包含：

1. account-store 旧 schema / 新 schema 均能往返多端字段。
2. Wails create / update / detail DTO 保留 `supportedFormats` 与 `formatBaseUrls`。
3. `BuildUnifiedAccountRecord` 对 `sub2api` / `new-api` 返回三端 `supportedFormats`。
4. sidecar synthesizer 把 `format_base_urls_json` 投影到 runtime auth attributes。
5. Codex / Claude / OpenAI-compatible executor 按下游协议选择对应 endpoint。
6. Channel Routing explain 对缺少目标格式的账号给出过滤原因。
7. local CLI apply 对 Codex 取 `openai_responses`，对 Claude 取 `anthropic`。
8. `/models` 与 quota / billing 不误用 `anthropic` 或 `openai_responses`。

## 当前整理结论

本 space 后续状态应从 `implementation-partial` 调整为：

```text
system-audited / runtime-gap-identified
```

已完成的是前端详情页和管理接口方向的部分能力；未完成的关键路径是账号能力事实源、sidecar runtime projection、channel routing 精确过滤和 executor endpoint 解析。
