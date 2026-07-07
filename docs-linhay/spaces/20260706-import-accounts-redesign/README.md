# Account Import Redesign

## 背景
用户反馈当前的“导入账号内容”页面和弹窗交互太差。主要痛点在于：
1. 文件拖拽/上传和手动粘贴 JSON 分裂在左侧两个独立卡片区域，不仅视觉杂乱，而且强行分割了同一目的的输入源。
2. 粘贴文本区需要用户手动粘贴后点“添加”才能生效，无法实时反馈；从剪贴板粘贴按钮位置不显眼，且没有任何智能提示。
3. 导入后的“候选队列”以庞大难读的 JSON raw 文本（甚至是脱敏后多行文本）直接呈现在卡片里，不便于迅速扫读和对账。
4. 无法在导入前就地修改账号名称、基础 URL 等关键字段。如果文件或粘贴内容包含小瑕疵或重名，用户只能先强行导入，再到主界面列表一个个寻找并编辑，交互极其繁琐。
5. 缺乏批量管理功能（如一键清空、选择性导入等）。

## 目标
1. **视觉统一与降噪**：采用现代化的布局，消除套娃卡片；提供 Tab 切换或更优雅的并列输入区域。
2. **结构化智能解析与预览**：将 JSON/文件转化为清晰、格式化、可快速扫读的“待导入卡片”，直观展示账号类型、名称、API Key（脱敏）、基础 URL、端点等核心元数据。
3. **导入前就地编辑 (Inline Edit)**：支持用户在队列卡片上直接修改名称、Base URL、API Key 等配置，支持重新验证就地保存。
4. **剪贴板智能检测**：如果检测到剪贴板有合法的账号 JSON，在页面上方提供明显的“一键粘贴导入”按钮，提升高频使用效率。
5. **多选及批量控制**：支持复选框（批量选择/取消选择）、批量移除等机制。

## 范围
- 优化前端 `AccountImportPage.tsx` 和 `AccountImportModal.tsx`（它们共用了绝大部分交互）。
- 优化或重构队列展示组件 `AccountImportQueueList.tsx`。
- 新增或调整相关的 locale 翻译项（中英文支持）。
- 保证已有的 Wails 传输逻辑、解析机制（ZIP/TGZ 压缩文件、JSON 数组）功能完全不受负面影响。

## 非目标
- 不改变 Sidecar 的 `/accounts/import` 接口契约，仅在前端导入前进行数据整理和暂存交互。
- 不引入新的非 AntD 或非 Lucide 图标的外部第三方依赖。

## 验收标准
1. **输入整合**：拖拽上传与粘贴输入区域视觉高雅，有明显的切换或统一布局。
2. **预览卡片化/结构化**：导入队列中不直接渲染大段原始 JSON，而是提炼为带标志的“配置面板”（如显示 `Type: API KEY`，`Name: my-key`，`Endpoint: https://api.openai.com/v1` 等）。
3. **就地修改验证**：点击任一待导入项的编辑按钮后，展开表单（名称、Base URL、Key等），修改保存后能成功改变 payload。
4. **批量操作**：支持对队列项进行全选/全消、批量移除，仅导入被勾选的账号。
5. **智能剪贴板**：当剪贴板里有合法 JSON 时，页面能检测到并允许一键导入。
6. **兼容性与回归**：测试（例如 `accountTransfer.test.mjs`）保持通过，且 Wails 打包和构建无影响。

## 2026-07-06 批量导入卡顿止血

### 问题来源
- 用户在正式环境导入 875 个账号时，导入弹窗长时间停留在“导入中”。
- 当前轮不触碰正式版 GetTokens、不重启正式进程，只在仓库 dev 代码与测试中处理。

### 代码事实
- 前端 `submitAccountImport` 已经把 auth-file 候选合并成一次 `UploadAuthFiles(authFilePayload)`。
- Wails 层 `internal/wailsapp/auth_files.go` 在 `UploadAuthFiles` 内逐条调用 `client.CreateAccount(write)`。
- sidecar 当前只有单条 `POST /v0/management/accounts` 与批量删除 `POST /v0/management/accounts/batch-delete`，缺少批量创建。

### 当前现象
- 875 个 auth file 会被放大为 875 次 management create 请求，并触发 875 次账号存储写入和运行态 apply/reconcile，符合“导入中”长时间卡住的现象。

### 验收方式
- 新增 sidecar `POST /v0/management/accounts/batch-create`，一次事务写入多账号，昂贵的 account-store apply 只触发一次。
- Wails `UploadAuthFiles` 优先调用 `CreateAccountsBatch`；如果旧 sidecar 返回 404/501，再退回逐条 `CreateAccount`，保证已发布 dev/prod 组合兼容。
- 聚焦测试覆盖 sidecar handler、accountstore、Wails 批量与回退、cliproxyapi client 契约。

### 处理结果
- 已在 CLIProxyAPI sidecar fork 增加 `CreateAccounts` store 方法、`CreateAccountsBatch` management handler 与 `/accounts/batch-create` 路由。
- 已在 GetTokens management client 增加 `CreateAccountsBatch`，并让 `UploadAuthFiles` 优先批量创建、旧 sidecar 缺路由时回退单条创建。
- 已重建本地 dev sidecar；因 fork 尚未提交，sidecar meta 当前记录 dirty 源码指纹。

## 2026-07-07 导入链路继续优化

### 问题来源
- 用户要求在批量导入与刷新止血后“继续优化”。
- 继续排查后确认，后端批量创建之外，前端导入链路仍有多处放大：多文件选择、提交后 reload 和队列统计。

### 代码事实
- `AccountImportModal` 的 AntD `Upload.beforeUpload` 会按文件逐个触发；旧实现每次都创建 `DataTransfer` 并调用 `handleAddFiles(dt.files)`，选择 800 个 JSON 时会变成 800 次解析入口和 800 次队列追加。
- `submitAccountImport` 成功后调用 `await loadAccounts()`，而 `loadAccounts()` 默认还会触发 quota / usage / rate-limit supplemental 同步；导入完成被运行态同步拖慢。
- 导入弹窗 footer 的 selected summary 和 allValid 分别扫描选中队列，提交前又再次 filter/validate，在 800+ 队列下形成重复计算。

### 处理结果
- `submitAccountImport` 成功后改为 `loadAccounts({ refreshSupplementalData: false })`，导入完成只刷新账号资产列表，不等待运行态数据。
- `AccountImportModal` 新增 `pendingUploadFilesRef` 与 `queueMicrotask` 聚合，文件选择路径和拖拽路径一样批量进入 `readUploadFiles`。
- `accountTransfer.ts` 新增 `summarizeAccountImportQueueSelection`，一次扫描产出 footer 统计、合法性和提交 payload。

### 验收记录
- `node --test frontend/src/features/accounts/tests/accountRuntimeSync.test.mjs frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs` 通过。
- `npm --prefix frontend run typecheck` 通过。
- `node --test frontend/src/features/accounts/tests/*.test.mjs` 通过，`524 pass / 0 fail`。

## 设计稿入口

- 本期设计稿：`docs-linhay/spaces/20260706-import-accounts-redesign/design-preview.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260706-import-accounts-redesign`
- worktree：`../GetTokens-worktrees/20260706-import-accounts-redesign/`

## 相关链接

## 当前状态
- 状态：verification
- 最近更新：2026-07-07
