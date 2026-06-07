# Relay 厂商接入需求设计 v01

日期：2026-06-06
更新：2026-06-07

## 一句话目标

让 GetTokens 账号资产原生支持多端 endpoint，并让用户可以把 `sub2api`、`new-api` 这类自建或第三方 relay / gateway 作为首批三端预设接入。

## 设计立场

本需求做的是 **账号级多端 endpoint 能力 + Relay Vendor Preset**，不是新增账号主类型。

核心判断：

1. `sub2api` 和 `new-api` 都是 gateway / relay 平台，不是单一上游模型厂商。
2. GetTokens 不新增 `AccountRecord.accountKind`，而是把“同一账号支持多端 endpoint”提升为账号资产的通用能力。
3. 三端能力用用户语义展示，用内部 `ApiFormat` 保存：
   - `openai-compatible` -> `openai_chat`
   - `codex API` -> `openai_responses`
   - `anthropic` -> `anthropic`
4. 同一账号可以同时声明和保存三端 endpoint，主 `baseUrl` 只代表默认入口，不能替代三端配置。
5. 余额 / 额度是管理端能力，不是第四种运行态 endpoint；管理脚本使用 `openai-compatible` endpoint 作为默认 `{{baseUrl}}`。
6. `platformCookie`、`curlVariables`、`modelFetchApiKey`、`modelFetchBaseUrl` 都是管理侧凭据，不能进入运行态路由、auth 合成、route guard 或 usage attribution。

## 2026-06-07 系统接线修正

本需求经过系统接线审计后，范围从“详情页三端配置 + relay 预设”修正为“账号能力事实源 + sidecar runtime 多端投影 + route/executor 精确消费 + relay 预设”。原因是当前 GetTokens 已经在 UI / Wails / management 层部分支持 `formatBaseUrls`，但 CLIProxyAPI runtime synthesis 与 executor 仍主要消费单一 `base_url`。

修正后的实现优先级：

1. 先明确账号能力事实源：`supportedFormats` 要显式持久化，或至少从非空 `formatBaseUrls` keys 派生，再用 provider 默认值兜底。
2. 再补 sidecar runtime projection：account-store 中的 `format_base_urls_json` 必须投影到 runtime auth attributes，不能只写主 `base_url`。
3. 再补 executor endpoint selection：OpenAI Chat、Codex / Responses、Claude / Anthropic Messages 按下游协议分别读取 `openai_chat / openai_responses / anthropic` endpoint。
4. 再收窄 Channel Routing / route explain：候选过滤以目标下游协议为准，缺少目标 format 时输出明确过滤原因。
5. 最后落 `sub2api` / `new-api` 预设与创建流，避免“表单能保存三端、运行态仍走单一 base URL”的假完成。

这次修正不改变“不新增账号主类型”的立场，也不把余额、额度、模型拉取管理凭据纳入 runtime auth。

## 账号级多端模型

本需求进一步明确：多端支持不是 `sub2api` / `new-api` 的厂商特例，而是 GetTokens 账号资产的基础能力。

账号资产应同时具备：

- 一个默认入口：`baseUrl`
- 一组能力声明：`supportedFormats`
- 一组端点映射：`formatBaseUrls`
- 一组管理凭据：`modelFetchApiKey/modelFetchBaseUrl/platformCookie/curlVariables`

其中：

- `baseUrl` 用于兼容旧数据、默认展示和缺省回退。
- `supportedFormats` 决定这个账号能被哪些客户端/运行态使用。
- `formatBaseUrls` 决定每个客户端/运行态实际请求哪个 endpoint。
- 管理凭据只服务模型拉取、额度、余额等管理动作。

验收要求：

- 新建账号、编辑账号、导入账号、复制账号都不能丢失 `supportedFormats` 与 `formatBaseUrls`。
- 账号详情页必须展示账号真实支持的端，而不是只展示当前主 `apiFormat`。
- 本地 CLI apply、route evidence、模型拉取、quota/billing 管理接口都必须从账号级多端模型读取 endpoint。
- 旧账号没有 `formatBaseUrls` 时继续用 `baseUrl` 回退，不要求迁移时强行补三端。

## 下游协议优先原则

多端支持后的路由与直连配置必须以**下游请求协议**为优先匹配键，而不是优先使用账号的主 `apiFormat` 或主 `baseUrl`。

下游协议映射：

| 下游来源 | 优先匹配格式 | endpoint 来源 |
|---|---|---|
| OpenAI-compatible client | `openai_chat` | `formatBaseUrls.openai_chat` |
| Codex API / Responses client | `openai_responses` | `formatBaseUrls.openai_responses` |
| Claude Code / Anthropic Messages client | `anthropic` | `formatBaseUrls.anthropic` |

原则：

- 下游请求是 Anthropic Messages，就优先选择声明支持 `anthropic` 的账号，并使用该账号的 `formatBaseUrls.anthropic`。
- 下游请求是 Codex / Responses，就优先选择声明支持 `openai_responses` 的账号，并使用该账号的 `formatBaseUrls.openai_responses`。
- 下游请求是 OpenAI-compatible，就优先选择声明支持 `openai_chat` 的账号，并使用该账号的 `formatBaseUrls.openai_chat`。
- 不因为账号默认 `apiFormat` 是 `openai_chat`，就把 Claude Code 或 Codex 请求强行落到 `openai_chat` endpoint。
- 协议转换只能作为显式设计的 fallback 或 relay 自身能力，不能由 GetTokens 在路由层静默猜测。
- 若候选账号不支持当前下游协议，route explain / local apply disabled reason 必须说明缺少对应 `supportedFormats`，而不是悄悄换用其他端。

## 用户场景

## 场景 A：自建 sub2api 后接入 GetTokens

用户在本机或服务器部署 `sub2api`，希望在 GetTokens 里选择 `Sub2API` 厂商预设，然后配置一个 API Key。

期望：

- 统一厂商入口可以选择 `Sub2API`。
- 创建表单自动出现三端 endpoint：`openai-compatible`、`codex API`、`anthropic`。
- 用户可以按自己的部署域名改写任意端点。
- 保存后账号详情页仍能看到并修改这三端配置。

## 场景 B：自建 new-api 后同时服务 Codex 和 Claude Code

用户部署 `new-api`，同一个 key 后面挂了 OpenAI Responses、Claude Messages 和 OpenAI Compatible 转发能力。

期望：

- `New API` 作为 relay / aggregator 预设出现。
- Codex 本地直连草稿读取 `codex API` endpoint。
- Claude Code 草稿读取 `anthropic` endpoint。
- `/models` 拉取和余额 / 额度管理默认读取 `openai-compatible` endpoint。

## 场景 C：一个账号三端 endpoint 不同

用户的 relay 服务部署在同一域名下，但不同协议有不同 path prefix。例如 OpenAI 风格走 `/v1`，Claude Code 走 `/antigravity`。

期望：

- UI 不把三端合并成一个 Base URL。
- 保存时三端 endpoint 都能进入账号配置。
- 后续 local CLI apply、模型拉取、额度/余额脚本按各自语义读取对应 endpoint。

## 场景 D：relay 没有标准余额接口

用户的 relay 只提供运行态代理，不提供标准余额接口，或余额查询需要平台 Cookie / 管理 token。

期望：

- GetTokens 不伪造默认余额接口。
- 用户可以保留余额 / 额度脚本为空。
- 如果用户配置自定义 cURL，模板变量中的 `{{baseUrl}}` 使用管理 base URL 解析规则。
- 管理凭据只用于脚本测试和刷新，不参与 agent 对话。

## 术语

| 名称 | 含义 |
|---|---|
| Relay Vendor Preset | 用于统一厂商选择的 relay / gateway 厂商预设，例如 `sub2api`、`new-api`。 |
| 三端 endpoint | 同一账号面向不同客户端协议的 Base URL：`openai-compatible`、`codex API`、`anthropic`。 |
| `apiFormat` | 账号默认格式。relay 预设首选 `openai_chat`，不代表账号只支持 OpenAI Chat。 |
| `supportedFormats` | 当前账号或预设声明支持的内部格式集合。 |
| `formatBaseUrls` | 每个内部格式对应的 Base URL 映射，是三端配置的主存储。 |
| 管理 base URL | quota / billing / model fetch 等管理调用使用的 base URL；默认从 `formatBaseUrls.openai_chat` 解析。 |
| 管理凭据 | `platformCookie`、`curlVariables`、`modelFetchApiKey` 等只用于管理调用的凭据。 |

## 核心需求

## R0：账号资产必须支持多端 endpoint

多端 endpoint 是账号资产级能力。所有账号创建、编辑、复制、导入、恢复和详情读取链路都必须把 `supportedFormats` 与 `formatBaseUrls` 当作结构化账号配置的一部分。

验收：

- API Key 账号、OpenAI-compatible provider 账号都能保存 `supportedFormats` 与 `formatBaseUrls`。
- 账号复制 / 导入 / 剪贴板恢复不会只复制 `baseUrl` 而丢失三端 endpoint。
- 本地 CLI apply 和管理接口读取账号 endpoint 时，优先使用账号自己的 `formatBaseUrls`，再回退预设和主 `baseUrl`。
- 路由和直连配置按下游请求协议选择账号支持格式，不以账号主 `apiFormat` 覆盖下游协议。
- 没有多端配置的旧账号继续按主 `baseUrl` 工作。

## R1：新增两个 relay 厂商预设

`sub2api` 和 `new-api` 必须进入统一厂商选择入口。

预设归类：

- `category`: `aggregator`
- `apiFormat`: `openai_chat`
- `supportedFormats`: `["openai_chat", "openai_responses", "anthropic"]`

验收：

- 厂商列表可搜索到 `Sub2API` 和 `New API`。
- 两个预设不新增账号主类型。
- 两个预设的能力标签同时显示 OpenAI-compatible、Responses/Codex、Anthropic/Claude 语义。

## R2：默认 endpoint 采用自部署语义

`sub2api` 和 `new-api` 都是可自部署 relay，不应把赞助商站点、公开 demo 或第三方商业站点写成生产默认。

建议默认值：

| 预设 | `openai_chat` | `openai_responses` | `anthropic` |
|---|---|---|---|
| `sub2api` | `http://localhost:8080/v1` | `http://localhost:8080/v1` | `http://localhost:8080/antigravity` |
| `new-api` | `http://localhost:3000/v1` | `http://localhost:3000/v1` | `http://localhost:3000` |

说明：

- `sub2api` 的 Claude Code 文档示例使用 `ANTHROPIC_BASE_URL="http://localhost:8080/antigravity"`，因此 Anthropic 端默认给 `/antigravity`。
- `new-api` 的 Claude Messages 按 `/v1/messages` 语义接入，Anthropic base URL 默认使用部署根地址。
- 如果用户的部署路径不同，创建表单和详情页都必须允许改写。

验收：

- 创建 `Sub2API` 草稿时，`formatBaseUrls.anthropic` 默认不是 `/v1`。
- 创建 `New API` 草稿时，`formatBaseUrls.anthropic` 默认不是 `/v1`。
- 用户清空某一端 endpoint 时，保存逻辑按既有 normalize 规则处理，不写入空字符串噪音。

## R3：创建流和详情页必须一致承载三端配置

统一创建流选择 relay 预设后，应把预设的 `formatBaseUrls` 种到表单；提交时写入账号配置。账号详情页读取同一字段并允许编辑。

验收：

- 创建时三端 endpoint 输入框来自 `supportedFormats`。
- 提交 payload 包含非空 `formatBaseUrls`。
- 详情页打开后展示保存过的三端 endpoint。
- 修改任一 endpoint 后，变更检测能启用保存按钮。
- 保存后重新打开详情页，endpoint 不丢失。
- 复制、导入或从剪贴板恢复账号时，`supportedFormats` 与 `formatBaseUrls` 也必须随结构化账号 payload 往返。

## R4：三端映射必须驱动 local CLI apply

本地 CLI apply 不能只读主 `baseUrl`。

映射规则：

| 目标 | 首选格式 | Base URL 来源 |
|---|---|---|
| Codex API key direct | `openai_responses` | `account.formatBaseUrls.openai_responses` -> `preset.formatBaseUrls.openai_responses` -> `account.baseUrl` -> `preset.baseUrl` |
| OpenAI-compatible runtime | `openai_chat` | `account.formatBaseUrls.openai_chat` -> `preset.formatBaseUrls.openai_chat` -> `account.baseUrl` -> `preset.baseUrl` |
| Claude Code direct | `anthropic` | `account.formatBaseUrls.anthropic` -> `preset.formatBaseUrls.anthropic` -> `account.baseUrl` -> `preset.baseUrl` |

验收：

- `Sub2API` 的 Codex 草稿使用 `openai_responses` endpoint。
- `Sub2API` 的 Claude 草稿使用 `anthropic` endpoint。
- `New API` 的 Codex 草稿使用 `openai_responses` endpoint。
- `New API` 的 Claude 草稿使用 `anthropic` endpoint。
- 缺少目标格式时不伪造支持能力；对应 apply action 应禁用或给出明确原因。

## R5：余额 / 额度接口对齐管理 base URL

quota / billing cURL 中的 `{{baseUrl}}` 解析规则固定为：

```text
normalize(formatBaseUrls.openai_chat) || normalize(baseUrl)
```

适用范围：

- 默认 quota 模板
- 默认 billing 模板
- cURL 变量面板
- cURL 测试调用
- 保存配置前预检

验收：

- 三端配置里 `openai_chat` 与主 `baseUrl` 不同时，quota / billing 脚本使用 `openai_chat`。
- `platformCookie`、`curlVariables` 只透传到 quota / billing 管理调用。
- 这些管理凭据不出现在运行态账号合成、route guard、usage attribution、API key entries 或本地 CLI direct auth 中。

## R6：模型列表拉取默认走 OpenAI-compatible 管理口

`/models` 是 OpenAI-compatible 管理调用，不应默认走 `anthropic` 或 `openai_responses` endpoint。

解析规则：

```text
modelFetchBaseUrl || formatBaseUrls.openai_chat || baseUrl
modelFetchApiKey || apiKey
```

验收：

- relay 账号未配置专用 model fetch 字段时，模型拉取使用 `formatBaseUrls.openai_chat`。
- 配置 `modelFetchBaseUrl/modelFetchApiKey` 时，模型拉取使用专用管理凭据。
- `modelFetchApiKey/modelFetchBaseUrl` 不参与 runtime auth、route guard 或 local CLI direct write。

## R7：所有创建入口必须口径一致

如果项目同时保留统一厂商创建入口和 OpenAI-compatible 专用创建入口，两个入口都不能遗漏 `sub2api` / `new-api`。

可接受实现路径：

1. 专用入口复用 `vendorPresets`。
2. 或为专用入口增加 thin alias preset，但字段必须从同一事实源派生。
3. 或将专用入口显式收敛到统一创建流。

验收：

- 用户从账号页新建入口能选择 `Sub2API` / `New API`。
- 用户从 OpenAI-compatible provider 编辑流进入时，不会看到一套缺失 relay 预设的旧列表。
- 同一预设在两个入口里的默认 endpoint、能力标签、model fetch 策略一致。

## R8：supportedFormats 必须匹配实际能力

`supportedFormats` 是运行和 UI 的能力声明，不能只作为徽标。

验收：

- `supportedFormats` 包含 `openai_responses` 时，Codex apply 才能选择 Responses/Codex endpoint。
- `supportedFormats` 包含 `anthropic` 时，Claude apply 才能选择 Anthropic endpoint。
- 如果后续确认某个 relay 部署不支持某端，用户可以在账号详情里调整能力或 endpoint；首版预设按参考项目能力给出三端默认。

## R9：默认余额 / 额度模板不做过度承诺

`sub2api` 和 `new-api` 的部署与管理 API 差异较大，首版不强行内置生产可用的余额 / 额度 cURL。

验收：

- 首版可以没有默认 quota / billing 模板。
- 如果添加模板，必须注明依赖的部署版本、管理路径和凭据变量。
- 没有模板时，账号仍可正常创建和用于 runtime。

## UI 需求

## U1：统一厂商卡片

厂商卡片应表达它们是 relay / gateway：

- 分类展示为 `Aggregator` 或现有聚合类分组。
- 名称分别为 `Sub2API`、`New API`。
- 说明文案避免暗示它们是官方模型提供商。
- 能力标签展示三端格式。

## U2：创建表单 endpoint 区

选择预设后，endpoint 区按 `supportedFormats` 渲染。

最低字段：

- `openai-compatible Base URL`
- `codex API Base URL`
- `anthropic Base URL`

交互要求：

- 每个输入框都有预设 placeholder 或默认值。
- 清空字段时不产生空字符串配置噪音。
- 用户能在保存前看到每端实际值。

## U3：账号详情页 endpoint 区

详情页需要比卡片更明确地展示三端配置。

验收：

- 详情页有独立 endpoint 配置区。
- 区块展示外部用户语义标签，而不是只显示内部枚举。
- 修改后保存路径与创建路径使用同一 DTO 字段。

## 数据契约

推荐预设形态：

```ts
{
  id: "sub2api",
  name: "Sub2API",
  apiFormat: "openai_chat",
  supportedFormats: ["openai_chat", "openai_responses", "anthropic"],
  baseUrl: "http://localhost:8080/v1",
  formatBaseUrls: {
    openai_chat: "http://localhost:8080/v1",
    openai_responses: "http://localhost:8080/v1",
    anthropic: "http://localhost:8080/antigravity"
  },
  category: "aggregator"
}
```

```ts
{
  id: "new-api",
  name: "New API",
  apiFormat: "openai_chat",
  supportedFormats: ["openai_chat", "openai_responses", "anthropic"],
  baseUrl: "http://localhost:3000/v1",
  formatBaseUrls: {
    openai_chat: "http://localhost:3000/v1",
    openai_responses: "http://localhost:3000/v1",
    anthropic: "http://localhost:3000"
  },
  category: "aggregator"
}
```

账号存储形态：

```json
{
  "apiFormat": "openai_chat",
  "supportedFormats": ["openai_chat", "openai_responses", "anthropic"],
  "baseUrl": "http://localhost:3000/v1",
  "formatBaseUrls": {
    "openai_chat": "http://localhost:3000/v1",
    "openai_responses": "http://localhost:3000/v1",
    "anthropic": "http://localhost:3000"
  }
}
```

## BDD 验收场景

## B1：创建 Sub2API 账号

Given 用户打开统一厂商创建入口
When 用户选择 `Sub2API`
Then 表单展示三端 endpoint
And `codex API` 默认值为 `http://localhost:8080/v1`
And `anthropic` 默认值为 `http://localhost:8080/antigravity`
And 保存 payload 包含三端 `formatBaseUrls`

## B2：创建 New API 账号

Given 用户打开统一厂商创建入口
When 用户选择 `New API`
Then 表单展示三端 endpoint
And `openai-compatible` 和 `codex API` 默认值为 `http://localhost:3000/v1`
And `anthropic` 默认值为 `http://localhost:3000`

## B3：详情页修改三端配置

Given 账号已有三端 endpoint
When 用户在详情页修改 `codex API` endpoint
Then 保存按钮变为可用
And 保存后 `formatBaseUrls.openai_responses` 更新
And 其他 endpoint 不被覆盖

## B4：余额 / 额度脚本使用管理 base URL

Given 账号主 `baseUrl` 是 `https://relay.example.com/default`
And `formatBaseUrls.openai_chat` 是 `https://relay.example.com/v1`
When 用户测试 quota cURL
Then 模板变量 `{{baseUrl}}` 解析为 `https://relay.example.com/v1`

## B5：Codex 与 Claude 本地草稿读取不同 endpoint

Given 一个 relay 账号同时配置三端 endpoint
When 用户生成 Codex local apply 草稿
Then 草稿使用 `formatBaseUrls.openai_responses`
When 用户生成 Claude Code local apply 草稿
Then 草稿使用 `formatBaseUrls.anthropic`

## B6：模型拉取不误用 Anthropic endpoint

Given 一个 relay 账号配置了三端 endpoint
And 没有配置 `modelFetchBaseUrl`
When 用户拉取模型列表
Then 请求发送到 `formatBaseUrls.openai_chat + /models`

## B7：运行态按下游协议读取 endpoint

Given 一个 relay 账号配置了三个不同 endpoint
And 该账号声明支持 `openai_chat / openai_responses / anthropic`
When 下游发起 OpenAI Chat 请求
Then executor 使用 `formatBaseUrls.openai_chat`
When 下游发起 Codex / Responses 请求
Then executor 使用 `formatBaseUrls.openai_responses`
When 下游发起 Claude / Anthropic Messages 请求
Then executor 使用 `formatBaseUrls.anthropic`

## B8：缺少目标 format 时 route explain 可解释

Given 一个账号只声明支持 `openai_chat`
When Codex channel 做 dry-run / explain
Then 该账号不进入 Codex / Responses 候选
And explain 输出缺少 `openai_responses` 的过滤原因
When Claude channel 做 dry-run / explain
Then 该账号不进入 Anthropic 候选
And explain 输出缺少 `anthropic` 的过滤原因

## 非目标

1. 不新增账号主类型。
2. 不为 `sub2api` / `new-api` 做真实公网联调。
3. 不承诺所有自部署版本的余额 / 额度 API 都可自动识别。
4. 不新增 `gemini_native` 三端以外的运行态配置；Gemini 可作为后续独立需求。
5. 不在运行态请求中自动做协议转换；转换能力由 relay 平台负责。

## 测试计划

实现时按 BDD/TDD 顺序补测试：

1. `vendorPresets` 测试：两个预设存在、分类为 `aggregator`、三端 `supportedFormats` 和默认 `formatBaseUrls` 正确。
2. 创建流测试：选择预设后表单种入三端 endpoint，提交 payload 保留 `formatBaseUrls`。
3. 详情页测试：`buildApiKeyConfigDraft` 保留三端 endpoint，变更检测覆盖任一 endpoint。
4. local CLI mapping 测试：Codex 选择 `openai_responses`，Claude 选择 `anthropic`。
5. 管理接口测试：quota / billing / model fetch 使用管理 base URL，管理凭据不进入 runtime。
6. Wails DTO 测试：create / update / test 路径都保留 `formatBaseUrls` 和管理字段。
7. account-store 测试：旧 schema 与新 schema 都能往返 `formatBaseUrls`，并能持久化或派生 `supportedFormats`。
8. runtime synthesis 测试：`format_base_urls_json` 被投影到 runtime auth attributes，不只写主 `base_url`。
9. executor 测试：OpenAI Chat、Codex / Responses、Claude / Anthropic Messages 分别读取对应 endpoint。
10. Channel Routing / route explain 测试：Codex 优先要求 `openai_responses`，Claude 要求 `anthropic`，过滤原因可见。

## 开放问题

1. `sub2api` 普通 Claude 账户是否应默认走部署根 `/v1/messages`，还是保持文档里的 `/antigravity/v1/messages`。首版采用 `/antigravity`，因为这是参考文档给出的 Claude Code 配置示例。
2. 是否要把 `sub2api` / `new-api` 同步写入旧的 `openAICompatibleProviderPresets`。设计要求是所有创建入口一致，具体实现可选择复用或收敛入口。
3. 是否要为两个 relay 预设提供 logo alias。没有稳定图标时可先使用 initials，不阻塞功能。
4. Gemini relay 能力是否进入同一账号详情页。首版不纳入，避免把三端需求扩大成四端协议矩阵。

## 完成定义

本需求完成时至少满足：

1. 用户能从厂商入口创建 `Sub2API` / `New API` 账号。
2. 同一账号能保存、展示、编辑三端 endpoint。
3. Codex / Claude / OpenAI-compatible / 管理接口都读取正确 endpoint。
4. 余额 / 额度和模型拉取的管理凭据不污染 runtime。
5. sidecar runtime auth 与 executor 已证明按下游协议消费三端 endpoint。
6. Channel Routing / route explain 已证明缺少目标 format 的账号不会静默进入错误候选池。
7. 聚焦测试、类型检查、Go 桥接测试和文档结构检查通过，或明确列出与本需求无关的既有失败。
