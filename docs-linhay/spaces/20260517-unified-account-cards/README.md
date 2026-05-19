# 统一账号卡片 + 多格式端点 + 厂商预设

## 状态

- 状态：implementation-in-progress
- 创建：2026-05-17
- 最后更新：2026-05-17

## 目标

将 GetTokens 的账号体系从按凭证类型（auth-file / api-key / openai-compatible）分离，改为按**厂商**统一：
- 一张卡片 = 一个厂商 + 一个 API Key + 多个格式端点
- 卡片创建使用厂商预设，自动填入多端点 + 额度/余额 curl
- 详情弹窗按账号能力可组合显示区块

## 已完成的改动

### 1. 后端 — 数据模型扩展

**`internal/accounts/account_records.go`**
- `AccountRecord` 新增字段：
  - `SupportedFormats []string` — 支持的 API 格式列表
  - `FormatBaseURLs map[string]string` — 每格式端点 URL
  - `BillingCurl string` / `BillingEnabled bool` — 余额查询配置
- 新增 `resolveDefaultFormats(provider)` — 已知厂商→格式映射
- `BuildAuthFileAccountRecord` / `BuildCodexAPIKeyAccountRecord` / `BuildOpenAICompatibleProviderAccountRecord` 自动填入 `SupportedFormats`

**`internal/cliproxyapi/types.go`**
- `CodexAPIKey` / `CodexAPIKeyInput` 新增：
  - `FormatBaseURLs map[string]string`
  - `BillingCurl string` / `BillingEnabled bool`

**`internal/wailsapp/accounts.go`**
- `ListAccounts()` 合并 OpenAI-compatible providers 到统一列表
- `ListAccounts()` 容错：auth files 或 codex keys 获取失败时继续返回已有数据
- `CreateCodexAPIKey` sync 失败不回滚（本地已存储）
- `UpdateCodexAPIKeyConfig` 支持 billing 字段

**`internal/wailsapp/quota.go`**
- 新增 `TestCodexAPIKeyBillingCurl` Wails 绑定
- `executeCodexAPIKeyQuotaRequest` 返回 billing 数据

**`internal/accounts/quota_curl.go`**
- `BuildCodexQuotaResponseFromUsagePayload`：解析失败时回退到 billing 格式
- 新增 `TryParseBillingResponse` — 多格式计费解析器：
  - DeepSeek: `{"is_available": true, "balance_infos": [...]}`
  - OpenRouter: `{"data": {"total_credits": ..., "total_usage": ...}}`
  - OpenAI: `{"total_granted": ..., "hard_limit_usd": ...}`
  - 通用: `{"total_balance": ...}` / `{"balance": ...}`

**`internal/accounts/quota_types.go`**
- 新增 `CodexQuotaBilling` / `CodexQuotaBalanceInfo` 结构体

**`internal/wailsapp/codex_routing_probe.go`**
- 跳过 `openai-compatible:` 前缀的账号（避免与 `ListOpenAICompatibleProviders` 重复）

### 2. 前端 — 类型与预设系统

**`frontend/src/types.ts`**
- 新增 `ApiFormat = 'anthropic' | 'openai_chat' | 'openai_responses' | 'gemini_native'`
- `AccountRecord` 新增：`supportedFormats`, `formatBaseUrls`, `billingCurl`, `billingEnabled`
- `AccountWorkspace` 简化为 `'all'`
- 新增 `BillingDisplay` 接口

**`vendorPresets.ts`** (新文件)
- 35+ 厂商预设，源自 cc-switch + OpenAI 兼容
- 每个预设：`id`, `name`, `apiFormat`, `supportedFormats`, `baseUrl`, `formatBaseUrls`, `modelSuggestions`, `category`, `quotaCurlTemplate`, `billingCurlTemplate`
- 分类：official / cn_official / aggregator / third_party / cloud_provider
- `getFormatBaseUrl(preset, format)` 取格式特定端点
- Codex 优先：双格式厂商的 `apiFormat` 默认 `openai_chat`，`supportedFormats` 以 `openai_chat` 开头

**`vendorPresetHelpers.ts`** (新文件)
- `getVendorPresetByBaseURL`, `resolveVendorPresetID`, `formatLabel`, `formatSupportedFormatsDisplay`

### 3. 前端 — 卡片可组合模式

**`CardSections.tsx`** (新文件)
- `FormatBadges` — 格式徽章
- `QuotaBars` — 5H/7D 窗口进度条
- `BillingBalance` — 余额展示（Total + Granted + 币种）
- `UsageMetrics` — 用量网格
- `RateLimitGuard` — 路由守卫
- `EvidenceSection` — 归因证据行
- `UnsupportedQuotaPlaceholder` — 无额度提示

**`AttributionCard.tsx`** — 委托给 CardSections 组件

**`AccountCard.tsx`**
- 格式徽章替代旧的来源徽章（AUTH FILE / API KEY → ANTHROPIC / OPENAI CHAT）
- 显示 `formatBaseUrls` 端点行
- 传入 `billing` 给 AttributionCard
- 通过 `extractBilling(quotaState.quota)` 获取余额

**`accountSelectors.ts`**
- `groupAccountsByVendor()` 替代 `groupAccountsByPlan()` — 按 vendor 分组
- `filterAccounts()` 移除 source 过滤器

**`accountQuota.ts`**
- `supportsQuota()` 同时检查 `quotaEnabled && quotaCurl` 和 `billingEnabled && billingCurl`
- `extractBilling(quota)` 从配额响应提取计费信息

**`accountPresentation.ts`**
- `resolveSupportedFormats(provider)` — 前端侧已知厂商格式映射
- `mapAuthFileToRecord()` 自动填入 `supportedFormats`
- `mapBackendAccountRecord()` 从 baseURL 推断 provider，覆盖格式
- `inferProviderFromBaseURL()` — 25+ 厂商 URL 匹配

### 4. 前端 — 统一 Compose Modal + 详情

**`UnifiedComposeModal.tsx`** (新文件)
- **Step 1**: 厂商预设选择器（分类 grid + 搜索）
- **Step 2**: 配置表单
  - 格式显示（绿色徽章 + 原生透传说明）
  - 每格式独立端点输入框
  - Label / API Key / Base URL
  - Advanced: Quota cURL + Billing cURL（自动填入）
- 提交：调用 `CreateCodexAPIKey` 含 `formatBaseUrls`、`billingCurl`

**`UnifiedAccountDetailModal.tsx`** (新文件)
- 可组合区块：`DetailHeader` / `CredentialsSection` / `AuthFileContentSection` / `RateLimitSection` / `VerifySection` / `QuotaSection` / `CompatibleModelsSection`
- 替换三个独立详情的合并（`ApiKeyDetailModal` + `AccountDetailModal` + `OpenAICompatibleDetailModal`）
- 显示时机：`api-key` 显示 Credentials/Verify/Quota，`auth-file` 显示 RawContent/Models

### 5. 前端 — 工作区简化

- **Sidebar**: 移除账号子菜单（codex / openai-compatible workspace）
- **`useAppNavigation.ts`**: 移除 `activeAccountWorkspace` 状态
- **`pagePersistence.ts`**: `AccountWorkspace` 只保留 `'all'`
- **`accountFilters.ts`**: 移除 `source` 字段
- **`AccountsToolbar.tsx`**: 移除来源单选按钮
- **`AccountsFeature.tsx`**: 移除 workspace 分支和独立 OpenAI-compatible 区域
- **`AccountsHeader.tsx`**: 新增 `+ ADD ACCOUNT` 按钮

### 6. 前端 — 数据加载容错

**`accountRuntime.ts`**: `shouldLoadAccountsData` 接受 `'stopped'` 状态
**`useAccountsPageState.ts`**:
- `loadAccounts` 在 `ListAuthFiles` 失败时从 `ListAccounts()` 提取 auth-file 记录
- 2026-05-17 接手修复：提取出的 auth-file 记录现在会真正写回页面状态和选择集合，不再只用于配额/用量加载，避免卡片在 UI 中消失

## 文件变更清单

### 新增
| 文件 | 说明 |
|------|------|
| `frontend/src/features/accounts/model/vendorPresets.ts` | 35+ 厂商预设 |
| `frontend/src/features/accounts/model/vendorPresetHelpers.ts` | 预设工具函数 |
| `frontend/src/features/accounts/components/CardSections.tsx` | 卡片可组合区块 |
| `frontend/src/features/accounts/components/UnifiedComposeModal.tsx` | 统一创建弹窗 |
| `frontend/src/features/accounts/components/UnifiedAccountDetailModal.tsx` | 统一详情弹窗 |
| `docs-linhay/spaces/20260517-cc-switch-claude-config-comparison/README.md` | cc-switch 对比 |
| `docs-linhay/spaces/20260517-unified-account-cards/README.md` | 本文档 |

### 修改
| 文件 | 变更 |
|------|------|
| `internal/accounts/account_records.go` | `SupportedFormats`, `FormatBaseURLs`, `BillingCurl/Enabled` |
| `internal/accounts/quota_curl.go` | billing 回退 + 多格式解析器 |
| `internal/accounts/quota_types.go` | billing 结构体 |
| `internal/cliproxyapi/types.go` | `FormatBaseURLs`, `BillingCurl` |
| `internal/wailsapp/accounts.go` | 统一 ListAccounts, billing 字段, 容错 |
| `internal/wailsapp/quota.go` | billing curl 执行器 |
| `internal/wailsapp/codex_routing_probe.go` | 去重 openai-compatible |
| `internal/wailsapp/types.go` | billing Wails 类型 |
| `internal/sidecar/profile.go` | Wails dev profile 判定修复 |
| `internal/sidecar/manager_test.go` | dev app bundle profile 回归测试 |
| `app_types.go` | 前端类型扩展 |
| `app_mappers.go` | 字段透传 |
| `app.go` | `TestCodexAPIKeyBillingCurl` 绑定 |
| `frontend/src/types.ts` | `ApiFormat`, 新字段 |
| `frontend/src/features/accounts/AccountsFeature.tsx` | 统一列表 + compose |
| `frontend/src/features/accounts/hooks/useAccountsPageState.ts` | ListAuthFiles 容错 + auth-file fallback state |
| `frontend/src/features/accounts/hooks/useAppNavigation.ts` | 移除 account workspace |
| `frontend/src/features/accounts/model/accountSelectors.ts` | vendor 分组 |
| `frontend/src/features/accounts/model/accountQuota.ts` | billing 支持 |
| `frontend/src/features/accounts/model/accountPresentation.ts` | 格式推断 + provider 检测 + fallback helpers |
| `frontend/src/features/accounts/model/accountFilters.ts` | 移除 source |
| `frontend/src/features/accounts/model/types.ts` | 新类型 |
| `frontend/src/features/accounts/model/accountRuntime.ts` | stopped 状态接受 |
| `frontend/src/features/accounts/components/AccountCard.tsx` | 格式徽章 + billing |
| `frontend/src/features/accounts/components/AttributionCard.tsx` | 委托 CardSections |
| `frontend/src/features/accounts/components/AccountGroupSection.tsx` | vendor 标题 |
| `frontend/src/features/accounts/components/AccountsToolbar.tsx` | 移除 source 筛选 |
| `frontend/src/features/accounts/components/AccountsHeader.tsx` | + ADD ACCOUNT |
| `frontend/src/components/biz/Sidebar.tsx` | 移除 account workspace |
| `frontend/src/utils/pagePersistence.ts` | 简化 workspace |

## 未完成 / 待验证

1. **余额显示未端到端验证** — `supportsQuota` 已修复接受 billing curl，但 dev 环境无真实 API key 无法验证 DeepSeek 余额接口
2. **`mapBackendAccountRecord` 的 `inferProviderFromBaseURL`** — 已补前端单测覆盖 base URL → vendor 推断；仍需在真实 Wails 窗口重启后验证热更新链路
3. **OpenAICompatibleDetailModal 保留** — 未合并到 `UnifiedAccountDetailModal`（模型管理/headers 编辑较复杂）
4. **旧 compose modals 未删除** — `ApiKeyComposeModal`, `OpenAICompatibleComposeModal`, `PasteAuthModal` 仍存在但不再主动渲染
5. **`OpenAICompatibleWorkspace` 组件未删除** — 导入已移除但文件仍在

## 本次接手补完（2026-05-17）

1. 修复 `ListAuthFiles()` 失败时 auth-file 卡片只参与 quota/usage 加载、却没有真正出现在页面状态里的回归。
2. 新增前端单测，锁定：
   - base URL 推断 vendor 与 `supportedFormats`
   - `ListAccounts()` fallback 的 auth-file 记录恢复与选择 ID 生成
3. 新增 Go 单测，覆盖 DeepSeek / OpenRouter / OpenAI 三类 billing 响应解析。
4. 通过浏览器 preview 验证统一卡片列表和 `+ ADD ACCOUNT` 统一弹窗可渲染，并产出截图。

## 桌面验收收口（2026-05-18）

1. 清理残留的 `wails dev` / `GetTokens.app` / `cli-proxy-api` 进程，解除 `127.0.0.1:34115` 端口占用。
2. 定位真实根因：`internal/sidecar/profile.go` 仅凭可执行名识别 dev，`wails dev` 产物名是普通 `GetTokens`，被误判为 prod，导致 sidecar 只在 `.app/Contents/MacOS` / `Resources` 中找 `cli-proxy-api`，无法命中 `build/bin/cli-proxy-api`。
3. 修复 profile 判定：当可执行完整路径匹配 `.../build/bin/GetTokens.app/Contents/MacOS/GetTokens` 时强制走 dev profile，从而恢复 dev 侧 `18317` 端口、`gettokens-dev` 配置目录和 `build/bin/cli-proxy-api` 候选路径。
4. 新增 `internal/sidecar` 回归测试，并在真实 Wails 窗口中验证 sidecar 状态恢复到 `ready`，账号池退出 skeleton。

## 余额展示与 Billing 配置补齐（2026-05-18）

1. 定位到 `internal/wailsapp/quota.go` 已经能产出 `billing`，但 root Wails bridge `app.go` 的 `GetCodexQuota` / `TestCodexAPIKeyQuotaCurl` 只映射了 `windows`，把 `billing` 丢掉了；因此前端即使拿到真实余额，也无法显示。
2. 新增 `mapCodexQuotaResponse` / `mapCodexQuotaBillingInfo`，并补 Go 回归测试，锁定 root bridge 必须透传 `billing`。
3. 统一详情弹窗补齐 API key 配置草稿模型，修复此前 `CredentialsSection` 和 `QuotaSection` 各自维护本地状态、导致 quota 编辑不会真正保存的问题。
4. 统一详情弹窗新增 `Balance` 区块：
   - 显示实时 `BALANCE`
   - 暴露 `billingEnabled` / `billingCurl`
   - 支持 `Test Billing`
   - 对已知厂商提供 `Use Vendor Template`
5. `useAccountsActions` / `useAccountsPageState` / `AccountsFeature` 已接入 `billingCurl` 保存和 `TestCodexAPIKeyBillingCurl` 调用链。
6. 真实页面验收：
   - 列表卡片中，`codex-api-key:05020af65051` 已显示 `BALANCE Total 121.58 CNY / Granted 0.00 CNY`
   - 详情弹窗中，同一账号已显示实时余额区块和 billing 编辑区
   - 截图归档：[20260518-accounts-detail-billing-after-v02.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260518/accounts/20260518-accounts-detail-billing-after-v02.png)

## 账号列表密度模式（2026-05-19）

1. 账号池聚合页参考 Codex 账号列表补齐 `完整 / 缩略 / 列表` 三种密度模式。
2. 默认保持原有完整卡片模式；缩略模式复用 `AttributionCard` 的紧凑展示，隐藏 traffic / quota / evidence 等重信息区；列表模式改为单列横向行，保留账号标题、状态、格式徽章、近期请求、累计 token、额度摘要与账号操作菜单。
3. 密度状态持久化到 `localStorage` 的 `gettokens.accounts.display-mode`，并同步到 hash 的 `density=compact|list`；回到完整模式时移除默认 `density` 参数。
4. 验证通过：
   - `cd frontend && node --test src/features/accounts/tests/accountListLayout.test.mjs`
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run test:unit`
   - Playwright browser preview：`http://127.0.0.1:5174/#frame=accounts` 切换缩略和列表模式，确认桌面布局可读；控制台仅有既存 `favicon.ico` 404。
5. 验收截图：
   - [20260519-accounts-display-mode-compact-after-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/screenshots/20260519/accounts/20260519-accounts-display-mode-compact-after-v01.png)
   - [20260519-accounts-display-mode-list-after-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/screenshots/20260519/accounts/20260519-accounts-display-mode-list-after-v01.png)

## 账号卡片窄宽自适应修复（2026-05-19）

1. 修复正式版侧栏占宽后账号卡片仍按视口断点强制两列的问题：账号组网格改为 `auto-fit + minmax(min(100%, ...), 1fr)`，让卡片按实际可用宽度降级为单列。
2. `AccountCardFrame` 增加 `w-full min-w-0 max-w-full`，并解除卡片根节点 `overflow-hidden` 对内部弹层和重排内容的裁剪。
3. 卡片内部固定网格改为语义类 + container query：
   - traffic、quota、usage、rate-limit、billing、evidence 在窄卡片下自动降列；
   - footer action grid 在更窄容器下单列显示，避免按钮文案被截断；
   - 全卡片子元素默认 `min-width: 0`，长文本走 truncate/换行策略。
4. `useGroupCardHeights` 只在完整模式且实际渲染为多列时同步等高；单列、缩略和列表模式都会清掉等高，避免窄宽切换后继承异常 `min-height`。
5. 验证：
   - `cd frontend && node --test src/features/accounts/tests/accountCardLayout.test.mjs`
   - `cd frontend && npm run test:unit`
   - `cd frontend && npm run build`
   - Playwright：`900x900` 下 full 模式首组网格为 `556px` 单列、无横向溢出、卡片 `min-height: 0px`；`1452x900` 下首组保持 `348px 348px 348px` 三列并仅在多列时等高。
   - `cd frontend && npm run typecheck` 当前被未纳入本轮的 Storybook story 类型错误阻塞，错误集中在 `frontend/src/components/ui/*.stories.tsx` 缺少 `args` 和一个 segmented control 泛型不匹配。
6. 验收截图：
   - [20260519-accounts-card-layout-full-web-after-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260519/accounts/20260519-accounts-card-layout-full-web-after-v01.png)

## 账号卡片启用/禁用入口（2026-05-19）

1. 账号卡右上角操作菜单新增统一启用/禁用入口：
   - 当前启用账号显示 `禁用账户`
   - 当前禁用账号显示 `激活账户`
2. 入口复用后端统一 `SetAccountDisabled`，保持与轮换管理一致的语义：禁用账号保留顺序和记录，但不参与请求。
3. 前端增加 `pendingStatusAccountID`，保存期间禁用菜单项并显示 loading 文案，避免重复提交。
4. 本地状态会同步 patch 当前列表和详情选中账号，再轻量 reload 真实账号列表。
5. 验证：
   - `cd frontend && node --test src/features/accounts/tests/accountCardInteractions.test.mjs src/features/accounts/tests/accountRotation.test.mjs`
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm run build`
   - Playwright：账号卡菜单中启用账号显示 `禁用账户`，已禁用账号显示 `激活账户`，控制台无新增错误。
   - `cd frontend && npm run test:unit` 当前有 2 个未纳入本轮的 settings layout 断言失败：`app_lifecycle` section 已不在当前设置分组中，但测试仍期望它存在。
6. 验收截图：
   - [20260519-accounts-card-disable-menu-web-after-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260519/accounts/20260519-accounts-card-disable-menu-web-after-v01.png)

## 验证方式

```bash
# 后端测试
go test github.com/linhay/gettokens/internal/accounts github.com/linhay/gettokens/internal/wailsapp

# 前端类型检查 + 测试 + 构建
cd frontend && npm run typecheck && npm run test:unit && npm run build

# 启动开发服务器
cd /Users/linhey/Desktop/linhay-open-sources/GetTokens
~/go/bin/wails dev
# 浏览器打开 http://localhost:34115/
```

## 已完成验证

- `go test ./internal/accounts`
- `go test ./internal/sidecar`
- `go test ./internal/wailsapp`
- `go test`（root package，覆盖 quota billing bridge mapper）
- `cd frontend && npm run typecheck`
- `cd frontend && node --test src/features/accounts/tests/accountConfig.test.mjs`
- `cd frontend && npm run test:unit -- src/features/accounts/tests/accountConfig.test.mjs src/features/accounts/tests/accountPresentation.test.mjs src/features/accounts/tests/accountSelectors.test.mjs src/utils/pagePersistence.test.mjs`
- `cd frontend && npm run build`
- 浏览器 preview：`http://127.0.0.1:4173/?preview=accounts#frame=accounts`
- 截图产物：[20260517-accounts-unified-compose-after-v01.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260517/accounts/20260517-accounts-unified-compose-after-v01.png)
- `window.go.main.App.GetSidecarStatus()` in Wails dev browser returned `{"code":"ready","port":18317,"message":"后端服务已就绪"}`
- 真实 Wails 窗口截图：[20260518-accounts-wails-window-after-v05.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260518/accounts/20260518-accounts-wails-window-after-v05.png)
- 真实页面截图：[20260518-accounts-detail-billing-after-v02.png](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260517-unified-account-cards/screenshots/20260518/accounts/20260518-accounts-detail-billing-after-v02.png)

## 相关 Space

- [cc-switch Claude 配置对比](../20260517-cc-switch-claude-config-comparison/README.md)
- [cc-switch 业务覆盖路线](../20260505-cc-switch-coverage-roadmap/README.md)
- [Claude Code 功能对齐](../20260517-claude-code-feature-parity/README.md)
