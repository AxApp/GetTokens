# Account Detail Proxy Route Technical Evaluation v01

## 结论

推荐采用“账号级 `proxyUrl` 直写 sidecar 配置”的最小方案：

1. 账号详情弹窗只负责选择出口语义：`inherit`、`direct`、`custom`。
2. 保存时把语义归一成账号配置中的 `proxyUrl`：
   - `inherit` -> `""`
   - `direct` -> `"direct"`
   - `custom` -> 代理池节点构造出的标准 URL，例如 `socks5://127.0.0.1:7890`
3. 代理池继续作为 App 层资产来源，不把代理节点对象嵌入账号配置。
4. 第一阶段只闭环 `codex-api-key` 与 `openai-compatible` 主 key entry；`auth-file` 暂不纳入写入链路。

这条方案复用现有 sidecar `proxy-url` 字段，不需要新增 sidecar 路由策略，也不改变账号稳定 ID。

## 现有代码事实

### 已有承载字段

1. `app_types.go` 的 `CreateCodexAPIKeyInput` 已有 `ProxyURL`。
2. `internal/wailsapp/accounts.go` 的 `CreateCodexAPIKeyInput` 已有 `ProxyURL`，创建账号时会写入 `cliproxyapi.CodexAPIKeyInput.ProxyURL`。
3. `internal/cliproxyapi/types.go` 已有：
   - `CodexAPIKey.ProxyURL`
   - `CodexAPIKeyInput.ProxyURL`
   - `CodexAPIKeyPatch.ProxyURL`
   - `OpenAICompatibleAPIKeyEntry.ProxyURL`
4. 代理池模型已有 `PROXY_POOL_STORAGE_KEY` 与 `buildProxyURLFromNode()`，能把节点转成标准代理 URL。

### 当前缺口

1. 前端 `AccountRecord` 还没有 `proxyUrl?: string`，账号详情拿不到当前出口。
2. `internal/wailsapp/accounts.go` 的 `UpdateCodexAPIKeyConfigInput` 没有 `ProxyURL`，编辑账号配置时无法改代理。
3. root `app_types.go` / `app.go` 的 `UpdateCodexAPIKeyConfigInput` 也没有透传 `ProxyURL`。
4. root `app.go` 当前 `UpdateCodexAPIKeyConfig()` 只透传 `quotaCurl / quotaEnabled`，没有透传 `billingCurl / billingEnabled`；这会让现有 billing 编辑链路存在 root 层漏传风险，实施代理时应一并修掉。
5. OpenAI-Compatible provider 的前端 draft 只有单个 `apiKey`，后端 `UpdateOpenAICompatibleProvider()` 当前会保留旧 entry 的 `ProxyURL`，但没有提供“用户主动改 proxy”的输入字段。
6. `auth-file` 路径没有明确 Wails 管理入口暴露 `proxyUrl`，不适合混入第一期。

## 数据流设计

```text
ProxyPool localStorage
  gettokens.proxy-pool.nodes
          |
          | read + buildProxyURLFromNode(node)
          v
Account detail proxy section
  mode: inherit | direct | custom
  proxyUrl: "" | "direct" | "socks5://..."
          |
          | save draft
          v
Wails root App DTO
          |
          v
internal/wailsapp update method
          |
          v
sidecar management config
  codex-api-key[].proxy-url
  openai-compatibility[].api-key-entries[0].proxy-url
```

## 推荐实现细节

### 1. 前端模型

新增 `frontend/src/features/accounts/model/accountProxyRoute.ts`，集中处理纯逻辑：

1. `type AccountProxyMode = 'inherit' | 'direct' | 'custom'`
2. `buildAccountProxyRouteDraft(account, proxyNodes)`
3. `buildAccountProxySaveValue(draft)`
4. `formatAccountProxySummary(proxyUrl, proxyNodes)`
5. `listAccountProxySupport(account)`

设计要点：

1. `direct` 是有效值，不是空值。
2. 空字符串才是 `inherit`。
3. `custom` 保存前必须有合法 `proxyUrl`。
4. 代理池节点只作为选择来源；保存 payload 不包含 `proxyNodeID`，避免代理池节点重命名、删除后破坏账号配置。

### 2. 账号 DTO

需要补齐：

1. `frontend/src/types.ts`：`AccountRecord.proxyUrl?: string`
2. `app_types.go`：`AccountRecord.ProxyURL`
3. `internal/accounts/account_records.go` 或相邻 mapper：把 `cliproxyapi.CodexAPIKey.ProxyURL` 映射到账号 record。
4. `frontend/wailsjs/go/models.ts` 需要通过 Wails 重新生成。

### 3. Codex API Key 保存链路

需要扩展：

1. `frontend/src/features/accounts/model/accountDetailConfig.ts`
   - `ApiKeyConfigDraft` 增加 `proxyUrl`
   - `buildApiKeyConfigDraft()` 读取 `account.proxyUrl`
   - `hasApiKeyConfigChanges()` 比较 `proxyUrl`
2. `UnifiedAccountDetailModal`
   - 在 credentials/verify/quota 之间新增“出口 / 代理”section
   - 修改 draft 时参与保存按钮 dirty 状态
3. `useAccountsActions.updateSelectedApiKeyConfig()`
   - 透传 `proxyUrl`
   - 保存成功后更新 `selectedAccount.proxyUrl`
4. `internal/wailsapp/accounts.go`
   - `UpdateCodexAPIKeyConfigInput.ProxyURL`
   - `UpdateCodexAPIKeyConfig()` 写入 `existing.ProxyURL = strings.TrimSpace(input.ProxyURL)`
5. root `app_types.go` / `app.go`
   - 同步 `ProxyURL`
   - 顺手补透传 `BillingCurl / BillingEnabled`

### 4. OpenAI-Compatible 最小闭环

第一期建议只做“主 key entry 代理”：

1. `OpenAICompatibleProviderDraft` 增加 `proxyUrl`。
2. `buildOpenAICompatibleProviderDraft()` 从 `provider.apiKeyEntries[0].proxyUrl` 初始化。
3. `UpdateOpenAICompatibleProviderInput` 增加 `ProxyURL`。
4. `UpdateOpenAICompatibleProvider()` 构造 `APIKeyEntries[0]` 时使用输入的 `ProxyURL`；其余 entry 继续按 index 保留旧 proxy。
5. 前端 `saveDetail()` 传入 `proxyUrl`。

暂不做多 key entry 的逐 key 代理 UI，因为现有 OpenAI-Compatible 详情已经把 key 编辑压成单 key 主流程；强行做多 key 表格会扩大改动面。

### 5. UI 结构

放在账号详情弹窗主内容区，建议顺序：

1. Credentials
2. 出口 / 代理
3. Rate Limit
4. Verify
5. Quota / Billing

控件：

1. Segmented control：`继承`、`直连`、`选择代理`
2. `选择代理` 模式下显示已有代理节点列表或 select：
   - 名称
   - 协议
   - 地址
   - 延迟 / 状态
3. 空代理池时显示“先去代理池维护节点”，禁用保存。
4. Header 或摘要行显示当前出口：`继承全局`、`直连`、`SOCKS5 127.0.0.1:7890`。

## 方案对比

### 方案 A：直接写账号 `proxyUrl`（推荐）

一句话：账号详情保存时直接更新 sidecar 已有的账号级 `proxy-url` 字段。

- Effort：中等，主要是 DTO、draft、modal、测试。
- Risk：低，复用现有 sidecar 语义。
- Builds on：`CodexAPIKey.ProxyURL`、`OpenAICompatibleAPIKeyEntry.ProxyURL`、代理池 localStorage。
- 缺点：代理池节点删除后，账号仍保留旧 URL；但这是可接受的，因为运行时需要的是 URL，不是节点引用。

### 方案 B：新增 App 层账号-代理绑定表

一句话：额外维护 `accountID -> proxyNodeID`，运行时再解析成 `proxyUrl`。

- Effort：高，需要新增持久化、迁移、同步和失效处理。
- Risk：中高，代理池节点本地状态和 sidecar 配置容易产生双写不一致。
- Builds on：代理池 localStorage。
- 不推荐原因：第一期目标是让真实请求生效，绑定表会增加一层状态源。

### 方案 C：只做全局代理，不做账号级代理

一句话：在设置页或代理池页设置全局 `proxy-url`，账号详情只展示。

- Effort：低。
- Risk：低。
- 不推荐原因：不满足“单个账号和代理关联”的核心诉求。

## 风险评估

### 依赖失败

代理池 localStorage 读取失败或为空时，custom 模式不可保存；已有账号中的 `proxyUrl` 仍应显示为“自定义 URL”，避免用户看不到历史配置。

### 规模增长

代理节点数量增大时，select/list 会变长。第一期可以按状态排序：可用节点优先、低延迟优先；后续再加搜索。

### 回滚成本

回滚前端不会破坏账号配置，因为 sidecar 里只是多了 `proxy-url` 字符串。最坏情况手动把账号代理改为继承即可。

### 脆弱假设

最脆弱假设是 `openai-compatible` 继续维持“单主 key”详情编辑。如果后续必须逐 key 编辑代理，需要把 provider detail 从单 key draft 升级为 `apiKeyEntries[]` 表格。

## 测试矩阵

### 前端纯模型

1. 空 `proxyUrl` -> `inherit`
2. `direct` / `none` -> `direct`
3. 标准代理 URL -> `custom`
4. custom 但无 URL -> invalid
5. 代理池节点转 URL 后参与保存
6. 已保存 URL 不在代理池节点中时仍能展示为自定义 URL

### 前端组件/状态

1. 选择 `继承` 后保存按钮 dirty。
2. 选择 `直连` 后 payload 为 `direct`。
3. 选择代理节点后 payload 为 `buildProxyURLFromNode(node)`。
4. 空代理池选择 custom 时不可保存。
5. 重新打开详情时能恢复当前模式。

### Go / Wails

1. `ListAccounts` 返回 `proxyUrl`。
2. `UpdateCodexAPIKeyConfig` 更新 `proxyUrl` 且稳定 local ID 不变。
3. `UpdateCodexAPIKeyConfig` 继续保留 quota/billing 字段。
4. `UpdateOpenAICompatibleProvider` 更新主 key entry `ProxyURL` 且不丢 headers/models/prefix。
5. root `app.go` DTO 字段完整透传。

### 验收

1. 浏览器 preview 验证弹窗布局。
2. Wails 桌面验证保存后重新打开账号详情仍显示出口。
3. 如有本地可用 Proxyman/HTTP 代理，补一条真实请求链路验收。

## 推荐实施顺序

1. 先补模型测试和 `accountProxyRoute.ts`。
2. 补 DTO 与 Go Wails 测试，修通 `codex-api-key` 的 `proxyUrl` 往返。
3. 前端 `UnifiedAccountDetailModal` 接入 `codex-api-key`。
4. 再接 `openai-compatible` 主 key entry。
5. 跑 typecheck、前端单测、`go test ./internal/wailsapp`。
6. 做浏览器/Wails 验收与截图归档。

## 当前状态

- 状态：proposed
- 最近更新：2026-05-18
