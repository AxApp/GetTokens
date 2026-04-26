# OpenAI-Compatible Provider Support Debate

## 辩论背景

目标是确认 GetTokens 如果要支持 `openai-compatible` provider（例如 DeepSeek），应该如何设计交互与技术落地边界。
本轮采用合作型讨论，要求所有论点先基于仓库代码引用，再形成结论。

## 参与者观点

### 2026-04-27 10:00 Codex（主持归纳）

1. 论点 → 引用:[internal/wailsapp/accounts.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/accounts.go:15) → `ListAccounts()` 只聚合 `auth-file` 和 `codex-api-key`；`UpdateAccountPriority()` 也只识别 `auth-file:` 与 `codex-api-key:` 前缀。 → 代码事实：当前账户聚合域没有第三类 provider 容器或新的 API key 资产入口。 → 结论：`openai-compatible` 不是现有 codex API key 入口改个名字就能接进来，账户域本身要先扩模型。

2. 论点 → 引用:[internal/accounts/account_records.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/accounts/account_records.go:57) → `BuildAccountRecords` 的第二类输入固定是 `[]cliproxyapi.CodexAPIKey`，`BuildCodexAPIKeyAccountRecord()` 把 `Provider` 固定写成 `codex`，资产 ID 也固定为 `codex-api-key:*`。 → 代码事实：前端当前看到的 API Key 账号不是通用模型，而是 codex 专属 record。 → 结论：若直接复用“单 API key 账号”心智，后续会把 provider 级配置压扁成错误的数据结构。

3. 论点 → 引用:[internal/wailsapp/codex_api_key_store.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/codex_api_key_store.go:15) → 本地持久化目录、文件名、读写函数全部围绕 `codex-api-keys` 命名。 → 代码事实：本地存储层没有 provider 泛化抽象。 → 结论：如果接 `openai-compatible`，至少要决定是抽象成通用 provider store，还是先新增平行的 openai-compatible store。

4. 论点 → 引用:[internal/cliproxyapi/client.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/cliproxyapi/client.go:31) 与 [internal/cliproxyapi/types.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/cliproxyapi/types.go:8) → 当前 Wails 管理 client 只有 `List/Put/Patch/DeleteCodexAPIKey` 一套封装，类型也只有 `CodexAPIKey*`。 → 代码事实：应用后端到 sidecar 的桥接层没有 openai-compatible 对应类型与接口。 → 结论：第一批技术改造必须先补 `internal/cliproxyapi` 与 `internal/wailsapp`，否则前端没有真实调用链。

5. 论点 → 引用:[docs-linhay/references/CLIProxyAPI/internal/config/config.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/config/config.go:520) 与 [docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/config_lists.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/internal/api/handlers/management/config_lists.go:429) → 参考 sidecar 的 `openai-compatibility` 顶层结构是 `name / prefix / base-url / api-key-entries[] / models[] / headers`，管理接口粒度也是 provider 级 `GET/PUT/PATCH/DELETE`。 → 代码事实：协议天然是 provider 容器，而不是单个 key 条目。 → 结论：产品交互若要贴合底层协议，最小正确心智是“provider 容器 + key entries + models”。

### 2026-04-27 10:06 Gemini 视角（子 agent：Arendt）

1. 论点 → 引用:[frontend/src/features/accounts/hooks/useAccountsActions.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/hooks/useAccountsActions.ts:156) → 新增、删除、优先级更新都固定调用 `CreateCodexAPIKey / DeleteCodexAPIKey / UpdateCodexAPIKeyPriority`。 → 代码事实：当前账户行为层完全绑定 codex mutation。 → 结论：如果 UI 直接新增 DeepSeek/OpenAI-compatible 入口，但 action 层不改，最终只会得到“看起来支持，实际仍写 codex”的假闭环。

2. 论点 → 引用:[frontend/src/features/accounts/components/ApiKeyComposeModal.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyComposeModal.tsx:26) → 新增弹窗标题是 `add_codex_api_key`，表单字段只有 `label / apiKey / baseUrl / priority`。 → 代码事实：创建交互当前针对的是单条 codex key，而不是 provider 容器。 → 结论：交互最小方案不应继续复用这个 modal，而应新建 provider 级表单。

3. 论点 → 引用:[frontend/src/features/accounts/components/ApiKeyDetailModal.tsx](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/ApiKeyDetailModal.tsx:70) 与 [frontend/src/features/accounts/model/accountConfig.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/model/accountConfig.ts:79) → 详情页和 snippet 都围绕单个 `apiKey/baseUrl/prefix` 构建。 → 代码事实：现有详情工作台是单 key 配置工作台，不支持 provider 名、多 key、模型别名。 → 结论：前端最容易踩的坑不是多几个字段，而是继续用错误的信息架构承载 provider 级对象。

4. 论点 → 引用:[frontend/src/types.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/types.ts:20) 与 [docs-linhay/references/Cli-Proxy-API-Management-Center/src/types/provider.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/Cli-Proxy-API-Management-Center/src/types/provider.ts:52) → GetTokens 当前 `AccountRecord` 是扁平单记录，而参考管理中心已经单独建模 `OpenAIProviderConfig`。 → 代码事实：参考实现已经验证 provider 容器建模是合理的。 → 结论：要降低改造风险，应该借鉴 `OpenAIProviderConfig` 心智，而不是在 `AccountRecord` 上继续打补丁。

## 轮次记录

### 第 1 轮

- Codex 先从账户聚合域、存储层、Wails client 和 sidecar 协议层确认：当前实现是强 `codex-api-key` 定制，没有 openai-compatible 的桥接能力。
- Gemini 视角补充前端交互风险：现有 modal、detail、snippet、action 都是单 key 心智，若不改信息架构，会把 provider 级对象错误压扁。
- 本轮形成共识，无需继续展开对抗。

## 结论与行动项

### 结论

1. `openai-compatible` 不应被建模成“再新增一种单 API key 账号”。
2. 最小正确心智应是“provider 容器 + key entries + models”。
3. 第一阶段也不需要一次把全部能力做满，但顶层对象必须先是 provider。

### 推荐分阶段方案

1. 第一阶段：补 `internal/cliproxyapi` 与 `internal/wailsapp` 的 openai-compatible 类型和管理接口；前端新增 provider 级最小表单，仅支持 `name / baseUrl / apiKeyEntries[0].apiKey / prefix(可选)`。
2. 第二阶段：在 accounts 或独立 provider 面板中展示 provider 容器，并支持编辑/删除 provider、补 `headers` 与多 `apiKeyEntries`。
3. 第三阶段：补 `models`、alias、测试模型与更完整的配置工作台。

### 暂不建议

1. 不建议把 `DeepSeek` 直接做成一个新的 `CreateDeepSeekAPIKey` 平行特例。
2. 不建议继续沿用当前 `Codex API Key` modal 只换标题文案。
3. 不建议在第一阶段把 provider 容器伪装成普通账号卡，否则后续还要二次推翻列表、详情和导出模型。
