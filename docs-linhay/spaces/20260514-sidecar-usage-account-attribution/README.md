# Sidecar Usage Account Attribution

## 背景
账号卡片当前可以从 sidecar `/v0/management/usage` 读取真实请求统计，但账号归因仍依赖前端启发式匹配：

1. `auth-file` 主要靠 `auth_index`。
2. `codex-api-key` 主要靠 `apiKey / prefix` 归一化后的 `source`。
3. `openai-compatible` 与多 key provider 只能通过 recent request 差量或组合 key 近似识别。

这会导致两个问题：

1. 流量事实源在 sidecar，但账号身份 join key 没有在流量侧被稳定记录。
2. 前端账号卡片能展示 recent health，却无法可靠回答“具体哪个账号经过了多少请求 / token”。

本期目标是按模型映射方案的思路，在流量侧引入一个稳定中间键；但实现方式改为 GetTokens 专属 middleware 旁路截取和持久化，不再修改 upstream core usage 结构。这样之前可能写进 `usage.Record / RequestDetail` 的相关改动可以撤回，CLIProxyAPI core 尽量保持和上游一致。

## 目标
1. 新增 GetTokens middleware，在 relay 请求完成后生成稳定账号归因事件。
2. 让 `auth-file`、`codex-api-key`、`openai-compatible` 都能在旁路 ledger 中记录同一类中间键。
3. GetTokens 账号列表使用 attribution ledger 做精确归因，优先按账号统计请求数、token、延迟与必要的状态分布。
4. 保留现有 `/usage` 与 upstream snapshot 结构，不把 GetTokens 账号键写入 sidecar core usage DTO。
5. 为后续 Usage Desk 的账号级筛选打基础。
6. `#frame=codex&workspace=usage-codex` 的“真实请求量”也改用同一套 attribution ledger，避免账号卡片与 Usage Desk 使用两套真实请求真源。

## 范围
1. CLIProxyAPI fork：
   - 通过 `WithMiddleware` 安装 GetTokens attribution middleware。
   - 在 `internal/gettokenshooks/` 或等价 GetTokens 维护目录中实现 SQLite ledger。
   - 如现有上下文不足，只允许补极薄 metadata hook，不扩展 upstream usage DTO。
   - 撤回或避免 `usage.Record / RequestDetail / /usage payload` 的 GetTokens 专属字段。
2. GetTokens backend / Wails：
   - 新增读取 attribution summary 的 Wails 方法。
   - 账号 DTO 暴露可用于 join 的账号资产 key。
   - usage 读取保留 `GetUsageStatistics` 作为兼容 fallback。
3. Frontend：
   - `AccountUsageSummary` 增加请求数与 token 字段。
   - 账号卡片展示经过请求数，详情展示 token 与平均延迟。
   - `UsageDeskFeature workspace="codex"` 的真实请求量优先读取 attribution summary，旧 `GetUsageStatistics` 只作为 fallback。
4. 测试：
   - sidecar middleware / attribution ledger。
   - `/usage` upstream schema 兼容。
   - Wails DTO 映射。
   - 前端账号归因纯函数、账号卡片展示和 Usage Desk observed source。

## 非目标
1. 不在本期重做 Usage Desk 的全部交互。
2. 不把 Codex 本地 rollout usage 强行归因到 `auth-file`。
3. 不把 upstream usage snapshot 改造成 GetTokens 账号归因事件表；账号归因事件使用独立 ledger。
4. 不把 API key 明文、access token 或 refresh token 写入 attribution ledger。
5. 不改变 quota 语义；配额仍是独立 `QuotaSnapshot` 域。
6. 不在本期接入 Gemini Usage Desk 真源；`usage-gemini` 保留独立页面边界。

## 验收标准
### 场景 1：auth-file 请求归因
Given sidecar 从 `auth-file:auth.json` 选中一个 Codex OAuth 账号发起请求  
When 请求完成并经过 GetTokens attribution middleware  
Then attribution ledger 应包含 `account_key = "auth-file:auth.json"`  
And GetTokens 账号卡片应显示该账号经过请求数 +1。

### 场景 2：codex-api-key 请求归因
Given GetTokens 本地持久化的 codex API key 拥有稳定 `LocalID`  
When sidecar 命中该 API key 发起请求  
Then Wails 暴露给前端的 attribution summary 必须记录 `account_key = <LocalID>`，其中 `LocalID` 本身就是完整账号 ID，例如 `codex-api-key:stable-001`  
And sidecar ledger 可保留 runtime `auth_id / source_hash / api_key_hash` 作为证据键  
And 编辑 `apiKey / baseUrl / prefix` 后，既有账号归因应继续归到同一个 `local-id`。

### 场景 3：openai-compatible provider 请求归因
Given openai-compatible provider `MI` 有多个上游 key  
When sidecar 命中其中任意 key  
Then attribution ledger 至少应记录 `account_key = "openai-compatible:MI"`  
And 如可稳定识别 key entry，则同时记录 credential 级辅助键，避免多 key 混淆。

### 场景 4：历史 snapshot 兼容
Given 已存在旧版 usage snapshot，且没有 GetTokens attribution ledger  
When 新版本 sidecar 启动  
Then restore 不应失败  
And GetTokens 应对旧明细回退到现有 `auth_index/source` 归因逻辑。

### 场景 5：敏感信息保护
Given attribution ledger 会被 GetTokens 读取  
When 请求使用任意 API key 或 OAuth token  
Then ledger 不得包含完整密钥、access token、refresh token 或原始 Authorization header。

### 场景 6：Codex Usage Desk 真实请求量
Given 用户打开 `#frame=codex&workspace=usage-codex` 并选择“真实请求量”  
When attribution ledger 可用  
Then Usage Desk 应优先从 attribution summary 渲染真实请求量、token 分解和分钟级明细  
And attribution 不可用时才回退旧 `GetUsageStatistics` 解析逻辑。

## 设计稿入口

- 本期设计稿：[account-card-attribution-design-v01.html](account-card-attribution-design-v01.html)
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。
- 端约束：本设计稿只面向桌面 Wails 工作台，不做移动端适配；窄窗口下允许横向滚动预览。

设计方向：
1. 卡片主指标从“近期健康”升级为“请求经过次数”。
2. 归因流量区域使用一条持续向前的细曲线表达时间推进，节点只标记经过该账号的用量，不表达成功/失败。
3. 请求归因证据、token 分解和 quota 窗口在同一张卡内分层展示；quota 支持 daily、weekly、monthly、5H 等多个窗口并列。
4. 视觉沿用 Swiss-industrial：硬边框、硬投影、monospace 数字、状态色轨道。
5. 该账号卡片作为后续统一组件母版，但不是要求所有页面完全同构；实现上应按数据结构拆成可配置区域，例如 identity、traffic attribution、usage tokens、quota windows、evidence、route policy、runtime、route target、probe result。
6. `#frame=codex&workspace=account-list` 的账号顺序卡可以把请求顺序前置到 identity / 名称区，底部则按 Codex 路由数据结构独立分区；上下区域都应可配置，避免把多个无关状态硬塞进同一个“自定义底栏”。
7. 同一组账号卡必须保持一致卡片尺寸；数据条数差异由固定高度 region、留白或内部滚动承接，不允许把整张卡撑成不同高度。
8. Codex 账号卡必须与上方账号归因卡共享同一三列宽度轨道；即使 Codex 当前只有两张卡，也保留第三列空轨，不把两张卡拉伸成半屏宽。
9. Codex 账号卡需要支持 `完整 / 缩略` 密度模式：
   - 完整模式显示账号归因区域：traffic curve、usage tokens、quota windows、evidence。
   - 缩略模式隐藏账号归因区域，只保留 route tape、带请求顺序的 identity、Codex 路由配置区域和 actions。
   - 两种模式都必须保持与上方账号卡同宽；缩略模式不改变卡片体系，只改变可见 region。

验收截图：
1. [桌面设计稿](screenshots/20260514/accounts/20260514-accounts-card-attribution-design-desktop-after-v01.png)
2. [桌面曲线版](screenshots/20260514/accounts/20260514-accounts-card-attribution-flow-curve-desktop-after-v02.png)
3. [桌面固定画布曲线版](screenshots/20260514/accounts/20260514-accounts-card-attribution-flow-curve-desktop-after-v03.png)
4. [桌面用量端点曲线版](screenshots/20260515/accounts/20260515-accounts-card-attribution-flow-usage-desktop-after-v04.png)
5. [桌面 Codex 请求顺序变体](screenshots/20260515/accounts/20260515-accounts-card-attribution-codex-order-variant-desktop-after-v05.png)
6. [桌面 Codex 可配置数据区域版](screenshots/20260515/accounts/20260515-accounts-card-attribution-codex-regions-desktop-after-v06.png)
7. [桌面 Codex 等尺寸数据区域版](screenshots/20260515/accounts/20260515-accounts-card-attribution-equal-size-regions-desktop-after-v07.png)
8. [桌面 Codex 同宽三列轨道版](screenshots/20260515/accounts/20260515-accounts-card-attribution-same-width-regions-desktop-after-v08.png)
9. [桌面 Codex 缩略模式版](screenshots/20260515/accounts/20260515-accounts-card-attribution-codex-compact-mode-desktop-after-v09.png)
10. [桌面 Codex 实装预览版](screenshots/20260515/accounts/20260515-codex-account-list-attribution-cards-implementation-after-v10.png)
11. [桌面 OpenAI-Compatible 卡片实装版](screenshots/20260515/accounts/20260515-openai-compatible-account-card-after-v11.png)
12. [桌面 Codex 缩略态实装验收版](screenshots/20260515/accounts/20260515-codex-account-list-compact-after-v11.png)
13. [桌面 Usage Codex 真实请求量预览版](screenshots/20260515/accounts/20260515-usage-codex-observed-preview-after-v12.png)
14. [桌面 Usage Codex 本地投影预览版](screenshots/20260515/accounts/20260515-usage-codex-projected-preview-after-v12.png)
15. [桌面 Accounts auth-file live 验收](screenshots/20260515/accounts/20260515-accounts-auth-file-live-after-v13.png)
16. [桌面 OpenAI-Compatible live 验收](screenshots/20260515/accounts/20260515-openai-compatible-live-after-v13.png)
17. [桌面 Usage Codex live 验收](screenshots/20260515/accounts/20260515-usage-codex-live-after-v13.png)

## Worktree 映射

- branch：`feat/20260514-sidecar-usage-account-attribution`
- worktree：`../GetTokens-worktrees/20260514-sidecar-usage-account-attribution/`

## 相关链接
- 技术方案：[20260514-sidecar-usage-account-attribution-architecture.md](../../dev/20260514-sidecar-usage-account-attribution-architecture.md)
- 实施计划：[20260514-sidecar-usage-account-attribution-plan-v01.md](plans/20260514-sidecar-usage-account-attribution-plan-v01.md)
- 历史边界：[CLIProxyAPI Usage Hook Boundary](../../dev/20260428-cliproxyapi-usage-hook-boundary.md)
- 历史 usage space：[20260428-gettokens-usage-dual-source](../20260428-gettokens-usage-dual-source/README.md)

## 已确认

1. `codex-api-key` 的最终账号归因必须直接落到持久化 `LocalID`。当前 `LocalID` 本身就是完整账号 ID，例如 `codex-api-key:stable-001`；sidecar ledger 可以保存 runtime `auth_id` 等证据键，但 Wails 返回给前端的 `accountKey` 必须已经映射为该 `LocalID`。
2. `codex-api-key` 的主 join 证据优先使用 sidecar runtime `auth_id`，`api_key_hash/source_hash` 只作为 fallback 与诊断辅助。为支持编辑 `apiKey / baseUrl / prefix` 后历史归因不丢失，Wails 侧需要维护 `local-id -> historical auth_id/source_hash/api_key_hash` 映射。
3. openai-compatible 多 key provider 首版聚合到 `openai-compatible:<provider>`，credential hash 只做诊断辅助。
4. attribution ledger 默认保留 30 天，且最多 100000 events。
5. 账号卡片曲线只表达 24h token 用量，成功/失败不在曲线节点表达。
6. `usage-codex` 的真实请求量首版仍以请求次数为主图单位，token 分解放在摘要和明细表。
7. Wails 方法签名采用 options DTO：`GetSidecarUsageAttribution({ window, bucket, includeUnresolved })`，以同时覆盖账号卡片固定 24h 和 Usage Desk 动态 resolution。
8. historical evidence mapping 的本地持久化位置采用独立文件 `~/.config/gettokens-data/codex-api-key-attribution-identities-v1.json`，不污染 sidecar config 和现有 codex API key JSON。
9. `usage-codex` 需要保留一个稳定的预览入口用于视觉回归；当前约定入口为 `?preview=usage-codex#frame=codex&workspace=usage-codex`，即使桌面 dev 壳存在 Wails runtime 也应强制走 preview 数据。

## 剩余实施验收

1. 补一轮最终截图归档，把本次已通过的 `accounts / openai-compatible / usage-codex` live 状态落为正式验收产物。
2. 如需要清理历史脏数据，可评估是否增加“仅迁移期” ledger reset 或历史桶合并脚本；当前历史 `auth-index:*` 旧桶仍会与新 `auth-id:*` 桶并存，但不再影响新请求展示。

## 当前状态
- 状态：done
- 最近更新：2026-05-15
- 实现进展：
  1. sidecar attribution ledger、management route 与 Wails `GetSidecarUsageAttribution({ window, bucket, includeUnresolved })` 已接通。
  2. `useAccountsUsageState` 已优先用 attribution summary 构建账号卡片 `requestCount / token / latency`，卡片与详情面板都已消费这些字段；旧 `/usage` 只作 fallback。
  3. `UsageDeskFeature workspace="codex"` 的 observed source 已优先读取 attribution summary，并按 `requestCount` 聚合日级 / 分钟级请求量；token 分解进入摘要与明细表。
  4. `range = 全部` 已收敛为 `window = all`，sidecar summary 支持真正的无限窗口查询，不再使用 `365d` 临时映射。
  5. 已通过聚焦测试：`go test ./internal/wailsapp -run 'TestGetSidecarUsageAttributionResolvesCodexAPIKeyLocalID|TestCodexAttributionIdentityStoreKeepsHistoricalAuthID'` 与 `npm --prefix frontend run test:unit -- src/features/accounts/tests/accountUsage.test.mjs src/features/accounts/tests/usageDesk.test.mjs src/features/accounts/tests/accountHealthMeta.test.mjs`。
  6. 已新增共享卡片骨架 `frontend/src/features/accounts/components/AttributionCard.tsx`，`AccountCard` 与 `CodexAccountOrderRow` 已迁移到同一套 identity / traffic / usage / quota / evidence 区域配置。
  7. `CodexAccountOrderSection` 已改为三列卡片轨道，默认完整模式显示账号归因区域；`Codex` 卡片支持 `完整 / 缩略` 密度切换，且与上方账号卡保持同宽轨道。
  8. 浏览器预览验收已补充 `#frame=codex&workspace=account-list` 截图：[20260515-codex-account-list-attribution-cards-implementation-after-v10.png](screenshots/20260515/accounts/20260515-codex-account-list-attribution-cards-implementation-after-v10.png)。
  9. `OpenAICompatibleWorkspace` 里的 provider 卡片已迁移到共享 `AttributionCard` 骨架：上半区与账号归因卡统一为 identity / attribution / usage / evidence 区域，下半区改成 provider 专属的 `base url / runtime / key / headers / model mapping / verify summary` 数据区；卡片轨道也改成和账号区一致的三列宽度。
  10. 浏览器验收已确认 `Codex` 缩略态会隐藏账号归因区域，仅保留 route / runtime / mapping / policy；同时 `accounts` 页内的 openai-compatible 卡片已显示统一上半区与新的 provider 下半区，截图分别归档到 [20260515-codex-account-list-compact-after-v11.png](screenshots/20260515/accounts/20260515-codex-account-list-compact-after-v11.png) 与 [20260515-openai-compatible-account-card-after-v11.png](screenshots/20260515/accounts/20260515-openai-compatible-account-card-after-v11.png)。
  11. `usage-codex` 已补显式 preview 入口：`?preview=usage-codex#frame=codex&workspace=usage-codex`。该入口下会强制使用 preview attribution / projected 样本渲染图表与明细表，不再依赖 live sidecar；两种 source 的验收截图分别归档到 [20260515-usage-codex-observed-preview-after-v12.png](screenshots/20260515/accounts/20260515-usage-codex-observed-preview-after-v12.png) 与 [20260515-usage-codex-projected-preview-after-v12.png](screenshots/20260515/accounts/20260515-usage-codex-projected-preview-after-v12.png)。
  12. 本轮回归已补跑 `go test ./...`、`npm --prefix frontend run typecheck`、前端归因相关单测、`docs-linhay/scripts/check-docs.sh`、`qmd update` 与 `qmd embed`；当前剩余的强验收只差真实桌面 Wails + live sidecar 请求闭环。
  13. 已重启 dev 环境到最新源码 sidecar，并完成一次真实 live 请求验收：
     - `openai-compatible:MI`：强制路由 `gpt-5.4`，HTTP 200，sidecar 返回上游 `mimo-v2.5`，usage `251 in / 192 cached / 8 out / 259 total`
     - `codex-api-key:26b1c3ff958f`（公司）：强制路由 `gpt-5.4`，HTTP 200，返回 `OK`，usage `352 in / 0 cached / 5 out / 357 total`
     - `auth-file:auth.json`：强制路由 `gpt-5.4`，HTTP 401，错误为 `Provided authentication token is expired`；sidecar 仍记录了 `failedCount = 1`
  14. 本轮最终修复包含两处真实根因：
     - sidecar attribution middleware 的 `shouldPreferUsageAttributionAuthID()` 只覆盖了测试里的 `api-key`，未覆盖 runtime 实际返回的 `api_key`；导致 live API key / openai-compatible 请求继续回落到 `auth-index:*`
     - Wails `GetSidecarUsageAttribution()` 默认不带 `include_unresolved=true`，而 raw sidecar summary 在 join 前会先把无 `accountKey` 的结果放进 `unresolved`；前端虽然请求到了 summary，但 Wails 没拿到可 join 的原始桶，因此页面一直显示 `0`
  15. 修复后已重新强制重编 sidecar，并完成第二轮真实 live 请求验收：
     - `openai-compatible:MI`：再次强制路由 `gpt-5.4`，HTTP 200，sidecar raw ledger 新增 `auth-id:openai-compatibility:mi:4a25ae6b9cc4`
     - `codex-api-key:26b1c3ff958f`：再次强制路由 `gpt-5.4`，HTTP 200，sidecar raw ledger 新增 `auth-id:codex:apikey:a6ba88c12cad`
     - Wails `GetSidecarUsageAttribution({ window: "24h", bucket: "1h" })` 已能把 raw `auth-index:*` / `auth-id:*` 桶统一 join 成前端账号资产键：
       - `codex-api-key:26b1c3ff958f`
       - `openai-compatible:MI`
  16. 最终 live 页面结果：
     - `#frame=accounts`：`codex-api-key:26b1c3ff958f` 卡显示 `近期请求 1 / Token 357 / ATTRIBUTION / 1528 MS`；`openai-compatible:MI` 嵌入卡显示 `近期请求 1 / Token 259 / CACHED 192 / ATTRIBUTION / 752 MS`
     - `#frame=accounts&workspace=openai-compatible`：独立 provider workspace 卡显示 `近期请求 2 / Token 518 / CACHED 384 / ATTRIBUTION / 1094 MS`，证明独立页与聚合页共用同一组件和同一数据源
     - `#frame=codex&workspace=usage-codex`：observed source 已显示 `请求 7 次 / 失败 1 次 / Token 1848 / 输入 1809 / 输出 39`
  17. 结论：`raw sidecar ledger -> Wails account join -> accounts cards -> openai-compatible workspace -> usage-codex observed source` 已完成 live 闭环。
