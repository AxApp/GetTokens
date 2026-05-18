# Account Detail Proxy Route Plan v01

## BDD 场景
1. `codex-api-key` 账号详情可选择 `继承`，保存后清空账号级 `proxyUrl`。
2. `codex-api-key` 账号详情可选择 `直连`，保存后写入 `proxyUrl = "direct"`。
3. `codex-api-key` 账号详情可从代理池选择节点，保存后写入节点构造出的标准代理 URL。
4. `openai-compatible` provider 详情至少支持主 key entry 的代理配置往返。
5. 代理池为空时，`选择代理` 状态不可保存，并提示去代理池维护节点。
6. 暂不支持的账号类型展示只读原因。

## TDD 顺序
1. 前端纯模型测试：
   - `resolveAccountProxyRouteState(account, proxyNodes)`
   - `buildAccountProxyRouteDraft(account)`
   - `buildAccountProxySavePayload(draft)`
   - `formatAccountProxySummary(route)`
2. 后端/Wails 测试：
   - `ListAccounts` 返回 `proxyUrl`。
   - `UpdateCodexAPIKeyConfig` 保留并更新 `proxyUrl`。
   - `UpdateOpenAICompatibleProvider` 保存 provider 主 key entry `proxy-url` 时不丢其他字段。
3. 前端组件测试或聚焦单测：
   - 代理池为空时 custom 不可保存。
   - `inherit / direct / custom` 的保存 payload 正确。

## 实施拆分
### 1. 数据模型
- 前端 `AccountRecord` 增加 `proxyUrl?: string`。
- 账号展示映射保留后端 `proxyUrl`。
- 新增账号代理 route 模型文件，例如 `frontend/src/features/accounts/model/accountProxyRoute.ts`。

### 2. Wails / 后端
- 扩展 `UpdateCodexAPIKeyConfigInput`，增加 `ProxyURL`。
- 更新 `updateSelectedApiKeyConfig` 链路，保存代理字段时不破坏 quota/billing。
- 检查 root `app.go` / `app_types.go` DTO 是否同步。
- OpenAI-Compatible provider 先按主 key entry 支持保存 `proxy-url`，多 key entry 后续拆分。

### 3. 代理池读取
- 复用 `PROXY_POOL_STORAGE_KEY` 和 `buildProxyURLFromNode()`。
- 账号详情只读代理节点列表，不做新增、导入、订阅管理。
- 节点显示建议包含：名称、协议、地址、延迟、状态。

### 4. UI
- 在 `UnifiedAccountDetailModal` 或下钻子组件新增“出口 / 代理”section。
- 控件采用 segmented control：`继承 / 直连 / 选择代理`。
- `选择代理` 下使用列表或 select 选择已有代理。
- 卡片或详情 header 增加当前出口摘要：`继承`、`直连`、`SOCKS5 127.0.0.1:7890`。

### 5. 验收
- 运行前端 account 相关单测。
- 运行 `go test ./internal/wailsapp`。
- 运行 `npm --prefix frontend run typecheck`。
- 浏览器 preview 验证弹窗布局；若涉及真实 Wails 保存，再跑桌面窗口验收。
- 截图归档到 `docs-linhay/spaces/20260518-account-detail-proxy-route/screenshots/<YYYYMMDD>/accounts/`。

## 风险与边界
1. `auth-file` 代理配置需要单独确认 sidecar 管理入口，暂不纳入第一期。
2. `openai-compatible` 多 key entry 的逐 key 代理编辑比 provider 级摘要复杂，第一期只做主 key entry 最小闭环。
3. 代理池节点当前是 App 层本地资产，账号配置保存的是 `proxyUrl` 字符串，不应保存节点对象引用。
4. `direct` 是有语义的字符串，不等同于空值；空值表示继承。

## 当前状态
- 状态：draft
- 最近更新：2026-05-18
