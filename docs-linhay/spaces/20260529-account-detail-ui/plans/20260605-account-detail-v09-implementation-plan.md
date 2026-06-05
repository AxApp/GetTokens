# 2026-06-05 账号详情页 v09 重构执行计划

## 设计基线

- 收敛设计稿：`../account-detail-account-types-v09.html`
- 目标页面：`http://localhost:5173/#frame=accounts&detail=<account-id>` 的账号详情 modal。
- 设计方向：把连续浏览器评论收敛为「数据库账号详情工作台」而不是 auth-file / API key 长表单。

## 已确认设计约束

1. 顶部不需要额外标题区，账号详情 modal 直接进入工作台内容。
2. Header 左侧只显示账号类型/账号名称，不显示 `READY/DIRTY/BUSY/ERROR` 状态 pill，以减少宽度占用。
3. Codex Auth-file/OAuth 已统一存入数据库，头部不显示文件名；文件名不作为主要管理对象。
4. 账号详情页内凭据默认明文展示，不再使用圆点掩码。
5. Auth-file/OAuth 凭据区需要支持：名称修改、配置预览、配置下载、配置应用、Reauth。
6. 请求配置左右等分，Custom Headers 拉满模块高度；代理只选择已保存节点，不在详情页刷新/测速/增删节点。
7. 模型映射为 `Source Model → Alias / Route`，非只读项支持点击修改；Auth-file provider 模型保持只读。
8. 验证只发送一条短消息，不做模型目录拉取、额度探测或 credential/proxy/model route 深度 probe。
9. Footer 状态说明只允许单行居中展示，保存门禁仍保留。
10. GetTokens 默认桌面/Wails 布局，不做移动端适配。

## 待确认事项（明天继续对齐）

1. **Auth-file/OAuth 配置应用接口**：
   - 当前前端已有 `DownloadAuthFile / NormalizeAuthFileContent / GetAuthFileModels`，但“配置预览/下载/应用”是否对应新的 management API 仍需确认。
   - 临时判断：先做 UI 与交互结构，真实应用接口后续按 sidecar/account-store 边界接入。
2. **短消息验证接口入参**：
   - 当前 `onVerify` 只接收 `{ apiKey, baseUrl, model }`。
   - v09 需要表达短消息内容、maxTokens、timeout、不写入会话记录等约束；接口是否扩展为 `{ model, message, maxTokens, timeoutMs, persist: false }` 待确认。
   - 临时判断：第一片先收窄 UI 文案与状态，不破坏现有 verify 调用。
3. **模型映射保存结构**：
   - 设计稿中 Source/Alias 可编辑，但当前真实账号详情是否已有映射保存 DTO 需要继续盘点。
   - 临时判断：先保留模型列表/目录能力，不在第一片引入未确认保存协议。
4. **Footer 状态来源**：
   - v09 需要 READY/DIRTY/BUSY/BLOCKED 统一语义；当前 footer 由 `configDirty/rateLimitDirty/missingFields/savingConfig` 组合。
   - 临时判断：先做单行显示与文案收敛，后续再统一状态模型。
5. **设计稿文件治理**：
   - 当前 space 存在大量历史 `account-detail-account-types-v03..v27.html` 未跟踪文件。
   - AGENTS 约束要求单期设计稿默认只保留一个 HTML；但这些是历史迭代证据，是否归档/删除需确认。
   - 临时判断：本轮把 README 指向 v09 收敛稿，不主动删除历史稿，避免误删用户仍在看的文件。

## 执行切片

### Slice 1：低风险结构收敛（先做）

- 更新 `AccountDetailHeader`：移除 header 内 operational status pill；Auth-file 头部 label 用账号类型/数据库账号名，不用文件名。
- 更新 `VerifyConnectionPanel`：文案从“验证连接”收窄为“短消息验证/发送验证”；保留现有 `onVerify`，不扩展接口。
- 更新 `AccountDetailFooter`：状态说明单行显示。
- 补 source-level focused tests，先防止旧语义回归。

### Slice 2：身份凭据区重排

- API Key：Display / API Key / Base URL / Prefix 调整为更清晰网格；凭据明文展示。
- Split Credential：Chat Key / Model Fetch Key 明文展示与间距统一。
- Auth-file/OAuth：新增账号名称编辑、配置预览、下载配置、应用配置 UI。

### Slice 3：请求配置与模型映射

- 请求配置左右等分；Headers 拉满；Proxy 节点只选择保存项。
- 模型映射卡 Source/Alias 点击编辑；Auth-file provider 模型只读。

### Slice 4：运行验收

- `npm run test:unit -- accountDetailLayout` 或对应 node test。
- `npm run typecheck`。
- 浏览器预览 `#frame=accounts&detail=codex-api-key%3Astable-001`、`#frame=accounts&detail=auth-file%3Acodex-pro.json`。
- 截图归档到 `docs-linhay/spaces/20260529-account-detail-ui/screenshots/`。

## 今日进度

- 2026-06-05：完成 space 盘点；生成 v09 收敛稿；补本执行计划；开始 Slice 1。

## 2026-06-05 追加进度：Slice 2 启动

- 已补并通过 source-level 回归测试：
  - 凭据字段使用 `data-account-credential-fields="balanced-grid"`，从原 `stacked` 转向 v09 的平衡网格布局。
  - 详情凭据输入使用 `data-account-credential-field="plaintext"`，输入类型固定为 `text`，不再根据 `secret` 切到 password。
  - Codex Auth-file 详情从“文件摘要 / 脱敏 / 复制原文”语义收窄为数据库配置管理语义，覆盖账号名称、配置预览、下载配置、应用配置、`SQLite account store`。
- 已落地最小实现：
  - `AccountCredentialVerifySection`：凭据字段容器改为 balanced grid；API Key/Base URL/Prefix 设置桌面列宽；`CredentialInputField` 固定明文 text。
  - `AuthFileSummarySection`：标题改为“配置管理”；主要内容改为账号名称和配置预览语义；操作改为预览配置、下载配置、应用配置。
- 暂未接真实“应用配置”后端接口；当前仍沿用已有内容读取/normalize/copy 能力作为 UI 占位，接口边界继续保留为待确认事项。

## 2026-06-05 追加进度：Slice 3A 启动

- 已补并通过 source-level 回归测试：
  - 账号详情代理配置仅允许选择已保存代理池节点，`AccountProxyRouteEditor` 增加 `data-account-proxy-route-editor="saved-node-only"`，移除 inherit/direct/custom 模式切换入口。
  - Auth-file 兼容模型目录改为 `Source Model → Alias / Route` 的只读映射卡结构，增加 `data-account-model-mapping-grid="source-route"` 与 `data-account-model-mapping-card="readonly"`。
- 已落地最小实现：
  - `AccountProxyRouteSection`：从模式切换 editor 收窄为保存节点 select，说明刷新/测速/增删节点在代理池页面完成。
  - `CredentialProxyRoutePanel`：同步适配 saved-node-only editor，不再传 `onModeChange`。
  - `CompatibleModelsSection`：从 pill 列表改为双列只读映射卡，展示 Source Model 与 Alias/Route。
- 仍未实现非只读模型映射编辑保存；保存 DTO 与 sidecar ownership 继续列为待确认事项。

## 2026-06-05 追加进度：Auth-file 配置 API 边界固化

- 已补并通过 source-level 回归测试：
  - `AuthFileSummarySection` 配置管理区域必须显式带 `data-auth-file-config-management="ui-placeholder"`。
  - 配置管理动作必须分别标记为 `preview`、`download`、`apply`。
  - UI 文案必须明确“待接入 account-store management API”。
  - 禁止在未确认接口前引入 `ApplyAuthFileConfig` / `SaveAuthFileConfig` 这类伪 API。
- 实现调整：
  - 为配置管理区域和三个按钮补充 data hooks。
  - 在配置预览说明中明确 account-store management API 待接入边界。
- 目的：后续继续实现时，不能把当前 Normalize/clipboard 占位误认为真实应用配置能力。

## 2026-06-05 追加验证：全量前端单元测试门禁

- 已运行：`cd frontend && npm run test:unit`。
- 结果：失败 1 项，失败项为 `codex live sessions workbench keeps the right pane as overview until a session is selected`。
- 失败位置：`frontend/src/features/codex-live-sessions/model.test.mjs:913`。
- 失败断言期望 `data-codex-overview-timeline-shell="session-style"`，属于当前工作树中 Codex live sessions 相关改动，不在账号详情页重构路径内。
- 账号详情 focused 测试仍通过：`accountDetailLayout.test.mjs` 29/29。
- 结论：账号详情本轮切片未引入 focused regression；全量门禁当前受 unrelated live-sessions dirty work 阻断，后续提交前需要单独处理或确认该路径的预期变更。

## 2026-06-05 追加纠偏：真实账号详情页切到 v09 band row 骨架

- 用户指出“账号详情页没有按照设计稿重做”。复核后确认：前面主要完成 space、设计稿、source-level 测试和局部切片，真实 modal 仍基本沿用卡片网格结构，没有完整切到 v09 的 band row 视觉骨架。
- 已补红灯测试并落地真实布局骨架：
  - `AccountDetailModuleStackLayout` 增加 `bands`。
  - `AccountDetailSection` 在 `bands` 布局下渲染为左侧 index/title rail + 右侧内容区域，增加 `data-account-detail-section-layout="band"` 与 `data-account-detail-band-index`。
  - `UnifiedAccountDetailModal` 从 `<AccountDetailModuleStack layout="cards">` 改为 `<AccountDetailModuleStack layout="bands">`。
  - `AccountDetailBody` 移除原有大 padding/space-y，使 band row 可以贴合 modal 内容面。
- 这是第一步真实视觉骨架重做；后续仍需浏览器/Wails 截图检查密度、滚动高度、各账号类型下的行高和 footer 贴合情况。

## 2026-06-05 追加纠偏：真实 Header 切到 v09 三栏摘要

- 已补红灯测试并落地真实 Header 重做：
  - `AccountDetailHeader` 增加 `data-account-detail-header="v09-compact"`。
  - Header 改为三栏：左侧账号名、中央 chips + 描述、右侧 last/latency。
  - 增加 hooks：`data-account-detail-header-account`、`data-account-detail-header-chips`、`data-account-detail-header-description`、`data-account-detail-header-last`。
  - 中央 chips 覆盖：类型、凭据、验证、路由、余额/额度。
  - `UnifiedAccountDetailModal` 设置 `headerClassName="p-0"`，避免 ModalFrame 默认 padding 破坏 v09 header 贴边结构。
- Header 仍保留账号名称编辑入口；Reauth 入口从 header 退出，后续由 Auth-file 配置管理区承接。

## 2026-06-05 追加前端直改：凭据/验证/代理模块低嵌套化

- 用户再次指出应直接改前端代码。已继续对真实 `AccountCredentialVerifySection` 做结构调整，而不是停留在设计稿或测试：
  - `data-account-credential-verify-layout` 从旧 `vertical` 改为 `v09-low-nesting`。
  - 内部 credential / short-message verify / proxy-route 三段改为单模块内低嵌套分割，不再依赖多层 dashed border 卡片感。
  - 保留已有真实数据与保存逻辑，不凭空新增尚未确认的 headersText 字段。
- focused 测试更新到 v09-low-nesting，并通过。

## 2026-06-05 追加前端直改：Quota/Billing 合并为 v09 左右等分 band

- 继续直接改真实前端：`UnifiedAccountDetailModal` 中 `quota` 与 `billing` 不再作为两个独立顶层 module 渲染。
- 新增真实组合 band：`AccountBalanceSplitSection`。
- 内部使用 `data-account-balance-panel="quota-billing"`，左右 pane 分别为 quota 与 billing，并增加 `data-account-balance-divider="full-height"` 中线。
- 当前仍复用 `AccountQuotaSection` / `AccountBillingSection` 的内部脚本逻辑，下一步可继续削掉内部嵌套和重复 section header。
