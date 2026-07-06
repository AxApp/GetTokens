# Account Import Redesign Development & Verification Plan

## 1. 目标
重构 `AccountImportPage.tsx` 和 `AccountImportModal.tsx`（以及队列展示组件 `AccountImportQueueList.tsx`），提供统一的导入操作区，支持结构化卡片预览、智能剪贴板检测、就地修改编辑、批量删除与勾选导入。

## 2. 交互与技术实现细节
1. **左侧输入面板降噪 (Unified Input Panel)**：
   - 采用 AntD 的 `Tabs` 组件切换“文件导入”和“文本粘贴”。
   - 拖拽区域支持多文件拖放。
   - 文本粘贴区在粘贴文本时进行基础的 JSON 实时检测，并在输入合法时点亮“解析并添加”按钮。

2. **右侧工作台管理 (Workbench Dashboard)**：
   - 队列顶部增加“批量选择/取消选择”的复选框，显示“已勾选 N / 共 M 项”。
   - 增加“一键清空”按钮。
   - 队列不再渲染冗长无序的 JSON 文本预览，而是提炼展示：
     - **序号 & 选择框**。
     - **数据源标签**：`[文件导入]`、`[文本粘贴]` 或 `[剪贴板]`。
     - **类型标签**：`[AUTH FILE]`、`[API KEY]`、`[PROVIDER]`。
     - **名称/标识**。
     - **核心连接信息预览**（例如 Base URL、脱敏后的 key 等）。
     - **状态标签**：若格式不完整或字段校验未通过，标记为红色的 `Error`。
   - **就地编辑表单 (Inline Form Edit)**：
     - 每个卡片提供“编辑”按钮。
     - 点击后在卡片下方展开可折叠表单：
       - `auth-file`：允许修改 `name` 和 `content` (JSON 格式化文本)。
       - `codex-api-key`：允许修改 `label` (名称)、`apiKey`、`baseUrl`、`prefix`。
       - `openai-compatible`：允许修改 `name`、`apiKey`、`baseUrl`、`prefix`、`proxyUrl`。
       - `upload-file`：若无法在前端解析为具体卡片，仅允许修改 `name`。
     - 在表单下方提供“保存并校验”与“取消”按钮。
     - 修改后当即重新调用校验逻辑，如果数据恢复合法，自动清除 `Error` 状态。

3. **智能剪贴板检测 (Smart Clipboard Detection)**：
   - 当组件加载时，检查当前系统剪贴板（若有读取权限），若包含合法账号 JSON，则在页面顶部渲染一条精致的 Banner 提示：“检测到系统剪贴板有合法的账号 JSON。是否直接粘贴导入？[一键粘贴解析]”。

4. **数据提炼机制**：
   - 如果用户上传的文件是一个普通的 `.json`，且里面是合法的账号配置，我们在前端 `handleAddFiles` 读取文件后，若能将其 JSON 解密并 parse，则自动将其转化为具体的 `auth-file` / `codex-api-key` / `openai-compatible` 类型，而不以 raw `upload-file` 传递，这使得上传的文件也能支持全面的就地字段编辑。

## 3. 修改文件范围
- [AccountImportPage.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/pages/AccountImportPage.tsx)
- [AccountImportModal.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/AccountImportModal.tsx)
- [AccountImportQueueList.tsx](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/components/AccountImportQueueList.tsx)
- 翻译 Locale 项：
  - [zh.json](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/locales/zh.json)
  - [en.json](file:///Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/locales/en.json)

## 4. 回归与验证步骤
1. **本地单元测试回归**：
   - 运行前端单元测试命令：`npm run test:unit`
   - 确保 `accountTransfer.test.mjs` 和 `accountClipboard.test.mjs` 测试 100% 通过。
2. **预览构建验证**：
   - 在 frontend 目录运行 `npm run typecheck` 进行 TS 类型检查。
   - 运行 `npm run build` 进行打包验证。
3. **真实 Wails 桌面冒烟测试**：
   - 运行 Wails dev 进行热重载：`wails dev`（使用 `./scripts/wails-cli.sh dev`）。
   - 手动进入导入界面，体验“文件拖放”、“文本粘贴”、“智能剪贴板Banner”、“就地编辑卡片并保存校验”、“批量多选仅导入选中项”的功能。
   - 录制截图，放入对应 `docs-linhay/spaces/20260706-import-accounts-redesign/screenshots/`。
