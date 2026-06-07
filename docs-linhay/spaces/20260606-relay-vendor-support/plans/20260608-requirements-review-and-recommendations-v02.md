# Relay 厂商接入需求整理与建议 v02

日期：2026-06-08
状态：recommendation-ready

## 目的

这份文档是在 `20260606` 需求稿和 `20260607` 系统接线审计之上，重新整理 `sub2api / new-api` 接入需求，并给出新的产品与技术建议。重点不是重复“新增两个厂商预设”，而是把多端账号能力、runtime 真实路由、管理接口和 UI 创建流拆成可执行的阶段。

## 重新整理后的一句话需求

GetTokens 应让一个第三方 relay 账号同时承载 OpenAI-compatible、Codex / Responses、Anthropic 三类下游协议，并让 `sub2api`、`new-api` 作为首批内置 relay 预设进入统一厂商创建入口；下游请求必须优先走自己支持的协议端点，不能被账号主 `baseUrl` 或主 `apiFormat` 静默改道。

## 我建议冻结的决策

1. 不新增账号主类型。
   - `sub2api`、`new-api` 都是 gateway / relay，不是 `AccountRecord.accountKind` 的新枚举。
   - 首期继续落在 `openai-compatible` unified account 加 `aggregator` vendor preset。

2. 三端能力是账号资产能力，不是两个 relay 预设的私有字段。
   - 账号详情页、创建流、复制/导入/恢复、本地 CLI apply、Channel Routing、runtime executor 都要读同一组 `formatBaseUrls`。
   - `baseUrl` 只作为默认入口和旧数据回退。

3. 下游协议优先级固定。
   - OpenAI-compatible 请求使用 `openai_chat`。
   - Codex / Responses 请求使用 `openai_responses`。
   - Claude Code / Anthropic Messages 请求使用 `anthropic`。

4. 管理接口不进入 runtime auth。
   - `/models`、quota、billing 使用管理 base URL。
   - `modelFetchApiKey/modelFetchBaseUrl/platformCookie/curlVariables` 不进入 route guard、usage attribution、executor auth 或本地 direct auth。

5. `sub2api` 与 `new-api` 默认地址采用自部署语义。
   - `sub2api.openai_chat/openai_responses`: `http://localhost:8080/v1`
   - `sub2api.anthropic`: `http://localhost:8080/antigravity`
   - `new-api.openai_chat/openai_responses`: `http://localhost:3000/v1`
   - `new-api.anthropic`: `http://localhost:3000`

## 我的新建议

### 建议 1：首期不要急着新增独立的 `supported_formats_json`

当前 Wails / DTO / 前端已经有 `supportedFormats` 展示字段，但 create/update 输入里主要保存的是 `formatBaseUrls`。我建议首期先把能力来源定义为：

```text
non-empty formatBaseUrls keys
  -> vendor preset default supportedFormats at creation time
  -> legacy provider default only when old account has no formatBaseUrls
```

也就是说：

- 新建 relay 账号时，预设把三端 endpoint 写入 `formatBaseUrls`。
- 后续回读时，非空 endpoint 的 key 就是账号显式支持的 format。
- 旧账号没有 `formatBaseUrls` 时，才按 provider 默认能力兜底。
- 用户清空某端 endpoint，等价于该账号暂不支持这一端。

这样能先避免新增一套“能力勾选状态”和 SQLite 字段迁移，同时解决当前最核心的运行态假完成。等后续确实需要“端点存在但临时禁用能力”时，再新增 `supported_formats_json`。

### 建议 2：新增一个统一的端点解析 helper

不要让本地 CLI、Channel Routing、executor、管理接口各自写一套 fallback。建议抽一个稳定语义 helper：

```text
ResolveAccountEndpoint(account, purpose)
```

其中 `purpose` 至少包含：

- `runtime.openai_chat`
- `runtime.openai_responses`
- `runtime.anthropic`
- `management.models`
- `management.quota`
- `management.billing`
- `local_apply.codex`
- `local_apply.claude`

好处：

- 能把 `formatBaseUrls -> baseUrl -> preset default` 的顺序固定下来。
- route explain 可以复用同一套解析结果。
- 后续新增 Gemini 或其他协议时，不需要再追多个分支。

### 建议 3：runtime auth attribute 使用显式 per-format key

sidecar synthesis 继续保留 `base_url` 做旧 executor 回退，但新增 per-format attribute。建议 key 形态为：

```text
format_base_url:openai_chat
format_base_url:openai_responses
format_base_url:anthropic
```

原因：

- 与现有 `header:<name>` 风格一致。
- 不污染旧 `base_url` 语义。
- executor 可以用一个小 helper 按目标 format 读取。

不建议把 route 阶段临时改写 `auth.Attributes["base_url"]`，因为这样会让 usage attribution、route trace 和调试日志看不出账号原始配置，也容易在 WebSocket sticky 场景里产生状态污染。

### 建议 4：Codex 不默认 fallback 到 `openai_chat`

对于 Codex / Responses 请求，我建议首期强制要求 `openai_responses`。如果某个 relay 实际上同一个 `/v1` 同时支持 Chat Completions 和 Responses，就让预设或用户配置显式写：

```text
openai_chat = https://relay.example.com/v1
openai_responses = https://relay.example.com/v1
```

不要让 Codex channel 因为看到 `openai_chat` 就自动认为可用。这样 route explain 更准确，也能避免把只支持 Chat Completions 的普通 OpenAI-compatible 账号误投到 Codex。

### 建议 5：账号详情页增加“请求端点预览”

详情页除了三端输入框，还应展示一个只读预览区：

| 场景 | 将使用的 endpoint |
|---|---|
| OpenAI-compatible client | `formatBaseUrls.openai_chat || baseUrl` |
| Codex / Responses | `formatBaseUrls.openai_responses || disabled` |
| Claude Code / Anthropic | `formatBaseUrls.anthropic || disabled` |
| 模型拉取 | `modelFetchBaseUrl || formatBaseUrls.openai_chat || baseUrl` |
| quota / billing | `formatBaseUrls.openai_chat || baseUrl` |

这能直接回答用户关心的“下游会优先走支持的类型吗”，也能减少后续排障。

### 建议 6：`openAICompatibleProviderPresets` 收敛成薄别名

如果旧的 OpenAI-compatible 专用入口还存在，我建议不要维护第二套 preset 数据。更稳的路径是：

1. `vendorPresets` 作为事实源。
2. 旧入口只过滤 `supportedFormats` 包含 `openai_chat` 的 preset。
3. 旧入口展示字段从统一 preset 派生。

这样 `sub2api / new-api` 不会出现“统一厂商入口有三端，旧入口只有单端”的分叉。

### 建议 7：首期不内置余额 / 额度模板

`sub2api` 和 `new-api` 的部署版本、管理 API、鉴权方式差异很大。首期建议：

- 不内置生产默认 quota / billing cURL。
- 提供空模板和变量说明。
- `{{baseUrl}}` 固定解析为 `formatBaseUrls.openai_chat || baseUrl`。
- 保留 `platformCookie/curlVariables` 作为用户自定义管理脚本能力。

内置模板可以作为后续针对某个固定版本的增强，不进入首期 DoD。

### 建议 8：新增“端点矩阵 smoke”，不依赖真实上游

后续实现验收不需要一开始连真实 `sub2api/new-api`。建议先用三个本地 `httptest` server 或 mock upstream：

- OpenAI Chat endpoint 返回 `chat-ok`
- Responses endpoint 返回 `responses-ok`
- Anthropic endpoint 返回 `anthropic-ok`

然后验证：

- Chat 请求只打到 Chat server。
- Codex / Responses 请求只打到 Responses server。
- Claude 请求只打到 Anthropic server。
- route explain 对缺失 format 的账号显示过滤原因。

这比只看草稿字段或 UI 保存更可靠。

## 需求分期建议

### P0：能力事实源与端点解析

目标：先让账号的三端配置成为一个可信事实源。

范围：

1. 定义 `formatBaseUrls` keys 派生 `supportedFormats` 的规则。
2. 旧账号无多端配置时，继续使用 provider 默认能力回退。
3. 新建、编辑、复制、导入、恢复都保留非空 `formatBaseUrls`。
4. 新增统一 endpoint resolver，并覆盖管理、local apply、route explain 的可测试分支。

验收：

- 一个账号三端 URL 不同，保存后重新打开仍不同。
- 清空 `anthropic` 后，Claude apply / Claude route explain 不再认为它可用。
- 旧账号无 `formatBaseUrls` 时继续按当前行为工作。

### P1：sidecar runtime projection 与 executor 消费

目标：消除“UI 三端、runtime 单端”的假完成。

范围：

1. CLIProxyAPI synthesizer 把 `format_base_urls_json` 投影到 runtime auth attributes。
2. executor 按请求协议读取 per-format endpoint。
3. 保留 `base_url` 作为旧行为回退，不作为新协议选择依据。

验收：

- OpenAI Chat / Codex Responses / Anthropic Messages 请求分别命中不同测试 server。
- usage / trace / route log 能看出目标 format 与 endpoint。

### P2：Channel Routing 精确过滤

目标：下游请求只选择支持目标协议的账号。

范围：

1. Claude channel 要求 `anthropic`。
2. Codex channel 要求 `openai_responses`。
3. OpenAI-compatible client 要求 `openai_chat`。
4. route explain 输出缺失 format 的原因。

验收：

- 只有 `openai_chat` 的账号不会进入 Codex 候选。
- 只有 `openai_responses` 的账号不会进入 Claude 候选。
- explain 中能区分 `missing_format:openai_responses` 和 `missing_format:anthropic`。

### P3：relay vendor preset 与创建入口

目标：真正把 `sub2api/new-api` 作为产品入口交付。

范围：

1. `vendorPresets` 新增 `sub2api`、`new-api`。
2. 统一创建流选择预设后写入三端 `formatBaseUrls`。
3. 旧 OpenAI-compatible provider 入口复用统一 preset 或薄别名。
4. 详情页展示 endpoint 预览。

验收：

- 新建 `Sub2API` 后默认三端地址符合冻结值。
- 新建 `New API` 后默认三端地址符合冻结值。
- 从任一创建入口进入，默认值和能力标签一致。

### P4：管理接口与可观测性补强

目标：减少真实用户配置 relay 时的排障成本。

范围：

1. `/models` 使用 `modelFetchBaseUrl || openai_chat || baseUrl`。
2. quota / billing 使用 `openai_chat || baseUrl`。
3. 详情页或 route explain 展示 endpoint 解析预览。
4. 可选增加一键端点连通性测试，但不进入首期必须项。

验收：

- 模型拉取不误用 `anthropic` 或 `openai_responses`。
- quota / billing 自定义脚本变量解析一致。
- 端点预览与实际请求命中一致。

## 我建议暂缓的内容

1. 暂缓真实联调作为首期 DoD。
   - 先用 mock endpoint matrix 证明 GetTokens 自身路由正确。
   - 真实联调用于后续兼容性补强。

2. 暂缓 Gemini / `/v1beta` 纳入本需求。
   - `new-api` 支持 Gemini，但本需求已经覆盖三端矩阵。
   - Gemini 应作为后续四端扩展单独建模。

3. 暂缓 provider logo。
   - 没有稳定 logo 时用 initials。
   - 不让视觉资源阻塞 runtime 接线。

4. 暂缓内置 quota / billing 模板。
   - 先保留用户自定义脚本能力。
   - 等确认固定版本管理 API 后再加模板。

## 更新后的 DoD

本需求完成时至少满足：

1. 一个账号可以保存并恢复 `openai_chat / openai_responses / anthropic` 三端 endpoint。
2. Codex / Claude / OpenAI-compatible 请求分别使用对应 endpoint。
3. Channel Routing 不把缺少目标 format 的账号放进候选池。
4. route explain 能说明缺少哪个 format。
5. `sub2api/new-api` 作为 `aggregator` preset 出现在统一厂商入口。
6. 旧 OpenAI-compatible 创建入口与统一入口同源。
7. `/models`、quota、billing 管理调用不误用 runtime-only endpoint。
8. 聚焦测试覆盖 endpoint matrix、创建流、详情页保存、local CLI apply、route explain。
9. 文档、memory 和必要 skill 已写回。

## 最终建议

我建议下一轮实现不要从 `vendorPresets.ts` 开始，而是从 `formatBaseUrls` 的事实源和 sidecar runtime projection 开始。只有 runtime 能真实按协议走三端 endpoint 后，再加 `sub2api/new-api` 预设。这样交付出来的能力才是“账号支持多端”，不是“表单上看起来支持多端”。
