# Claude Code 相关业务设计系统打磨计划

日期：2026-05-21
状态：第一刀已落地

## 目标

Claude Code 后续不是先堆页面，而是先把相关业务纳入设计系统，形成可复用的业务组件、Storybook 状态矩阵和视觉验收门禁。P0 的 Skills / Commands 与 MCP Servers 进入开发前，先完成资产工作台的设计系统打磨；P1/P2 能力则先以 candidate 形式定义组件边界，不提前写产品逻辑。

## 设计方向

- Visual thesis：高密度运维控制台，强调 scope、来源、diff 和风险态；用背景层级、边框强度和单一操作焦点表达秩序，不做营销式大卡片。
- Content plan：先定位当前 Claude 资产范围，再展示列表和来源，再进入预览/patch/diff，最后提供明确的保存或只读状态。
- Interaction thesis：所有主操作保持 `active:scale-95`；列表行点击进入详情，行内 toggle / menu 阻止冒泡；保存前必须展示 diff preview，风险字段用固定高度 warning 区，不让布局跳动。

## 已验证基础

1. `ClaudeCodeAccountListWorkbench` 已进入 `Design System/业务组件/Claude Code 账号列表`，并登记到 `componentManifest.ts`。
2. `storyCatalog.test.mjs` 已要求业务组件 story 必须有 `Overview`、使用 mock 数据、不得调用 Wails / sidecar / fetch。
3. Codex Extensions 已存在 `CodexExtensionsFeature`、`SkillsModals`、`McpModals`、`model.ts` 和 `previewData.ts`，可作为 Claude 资产工作台的 UI 模式来源。
4. `ModalFrame`、`WorkspacePageHeader`、`SegmentedControl`、`SearchInput`、`SnippetPre` 已进入通用设计系统，可直接作为 Claude 资产工作台基础控件。

## 第一刀完成记录

2026-05-21 已完成 `ClaudeCodeAssetWorkbench` 纯展示层和 Storybook 状态矩阵：

- 组件文件：`frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.tsx`
- Storybook：`frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.stories.tsx`
- Catalog：`frontend/src/features/design-system/storyCatalog.ts`
- Manifest：`frontend/src/features/design-system/componentManifest.ts`
- 覆盖状态：`skills-ready`、`skills-legacy-command`、`mcp-ready`、`mcp-shadowed-scope`、`empty`、`parse-error`、`saving-diff`
- 复用通用组件：`SegmentedControl`、`SearchInput`、`SnippetPre`
- Codex 设计骨架：对齐 `CodexExtensionsFeature` 的 `WorkspacePageHeader`、投影单面板、顶部 filter/search、`divide-y` 行列表和 preview rail；Claude 只在字段语义上分叉。
- 截图归档：
  - `docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/design-system/20260521-claude-code-asset-workbench-storybook-after-v02.png`
  - `docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/design-system/20260521-claude-code-asset-workbench-storybook-mobile-after-v02.png`

2026-05-21 追加完成 Codex 设计复用修正：

- 新增通用组件：`frontend/src/components/ui/AssetWorkbenchShell.tsx`
- 新增 Storybook：`frontend/src/components/ui/AssetWorkbenchShell.stories.tsx`
- Codex 与 Claude 共用该 shell：
  - `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx`
  - `frontend/src/features/claude-code/components/ClaudeCodeAssetWorkbench.tsx`
- `storyCatalog.test.mjs` 新增复用门禁，要求 Codex Extensions 与 Claude Code 资产页都引用 `AssetWorkbenchShell`，避免只做视觉相似。
- 浏览器截图归档：
  - `docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/20260521/design-system/20260521-claude-code-extensions-shared-shell-after-v02.png`

本阶段仍只使用 mock 数据，不调用 Wails、sidecar 或 fetch；后端 adapter 必须等状态矩阵与设计系统门禁通过后再接入。

2026-05-21 app 内真实读取阶段继续保持复用边界：

- `ClaudeCodeAssetWorkbenchFeature` 只负责 Wails snapshot 加载、preview fallback 和 backend DTO 映射，不重新实现页面壳。
- `ClaudeCodeAssetWorkbench` 继续复用 `AssetWorkbenchShell`；Codex Extensions 也继续复用同一 shell。
- 设计系统门禁保留 `storyCatalog.test.mjs` 对 Codex / Claude 双方引用 `AssetWorkbenchShell` 的断言，避免真实数据接入后回退成两套相似但不可维护的 UI。
- 本轮验证覆盖 `go test ./...`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 与 `./scripts/wails-cli.sh build -skipbindings`。

2026-05-21 MCP 保存阶段仍保持同一设计系统骨架：

- MCP 行内 `Edit` 展开在列表行内部，不新增右侧永久详情列，避免破坏 `AssetWorkbenchShell` 的列表 + preview rail 结构。
- transport 使用 `SegmentedControl`，endpoint 使用固定高度输入框，保存和取消使用 lucide 图标按钮，保持 Codex Extensions 的工具型交互密度。
- browser preview 只验证编辑控件展开与 mock dirty 状态；真实写入仅在 Wails app 内通过 `SaveClaudeCodeMcpServer` 执行。

## BDD 场景

### 场景 1：Claude 资产工作台先进入 Storybook

Given 计划实现 Claude Code Skills / MCP
When 开发前查看设计系统
Then 能在 `Design System/业务组件/Claude Code 资产工作台` 看到 Skills、MCP、只读、空态、错误、diff 和保存中状态。

### 场景 2：Skills 与 legacy commands 不复刻 Codex 启停

Given Claude Code 没有 Codex `[[skills.config]] enabled=false` 同构语义
When 设计系统展示 skill 行
Then 行内不出现 Codex 启停开关，而是展示 `user-invocable`、`disable-model-invocation`、scope 和路径来源。

### 场景 3：MCP scope 与 precedence 可扫描

Given 同名 MCP server 分布在 local、project、user
When 设计系统展示 MCP 列表
Then 能看到 scope、source path、active/shadowed 状态和保存目标；secret 默认脱敏。

### 场景 4：Settings / CLAUDE.md / Subagents 先 candidate 化

Given P1/P2 能力还未实现
When 查看设计系统计划
Then 能看到它们的候选业务组件、必备状态和复用控件，不会在 P0 偷跑产品逻辑。

## 组件分层

### Admitted / 待新增 Story

1. `ClaudeCodeAssetWorkbench`
   - owner：`claude-code`
   - 用途：Skills / Commands 与 MCP 的共同 shell。
   - 复用：`WorkspacePageHeader`、`SegmentedControl`、`SearchInput`、`SnippetPre`、`ModalFrame`。
   - Story 状态：`skills-ready`、`skills-legacy-command`、`mcp-ready`、`mcp-shadowed-scope`、`empty`、`parse-error`、`saving-diff`。

2. `ClaudeCodeSkillAssetList`
   - 用途：展示 `~/.claude/skills`、`.claude/skills`、`.claude/commands`。
   - 必备状态：user skill、project skill、legacy command、frontmatter parse error、non-removable source。
   - 设计规则：无启停 toggle；详情 modal 展示 frontmatter、文件列表、Markdown preview 和路径安全状态。

3. `ClaudeCodeMcpServerList`
   - 用途：展示 Claude MCP user/project/local scope。
   - 必备状态：stdio、http、sse deprecated、secret redacted、same-name shadowed、dirty diff。
   - 设计规则：scope badge 固定宽度，active/shadowed 不改变行高；headers/env 默认脱敏。

### Candidate / P1 前置

1. `ClaudeCodeSettingsScopeStack`
   - 覆盖 user / project / local / managed 四层 settings。
   - 必备状态：valid、invalid JSON、managed readonly、array merge hint、disableAllHooks。

2. `ClaudeCodeMemoryFilesPanel`
   - 覆盖 `CLAUDE.md`、`.claude/CLAUDE.md`、`CLAUDE.local.md`、`@AGENTS.md` import。
   - 必备状态：import exists、import missing、local not gitignored、save preview。

3. `ClaudeCodeSubagentCatalog`
   - 覆盖 user/project subagents 与 frontmatter 字段。
   - 必备状态：valid、missing name、missing description、plugin ignored fields、license pending。

### Deferred / P2

1. `ClaudeCodeSessionSummary`
   - 只读摘要，不展示完整 prompt。
2. `ClaudeCodeRuntimeDoctor`
   - PATH / version / env conflict 状态，不做安装管理。

## 实施顺序

1. 先拆纯展示层：从 `CodexExtensionsFeature` 抽出无 Wails 依赖的资产工作台 view，不改变现有 Codex 行为。
2. 新增 Storybook mock：先覆盖 Claude P0 的 Skills / MCP 状态矩阵。
3. 更新 `storyCatalog.ts` 与 `componentManifest.ts`：新增 admitted 业务组件，candidate/deferred 明确 revisit trigger。
4. 通过设计系统测试后再接后端 adapter：`GetClaudeCodeSkillsSnapshot`、`GetClaudeCodeMcpServers`、`SaveClaudeCodeMcpServer`。
5. browser preview 与 Wails 验证放在后端接入之后；设计系统阶段只使用 mock 数据。

## TDD / 验证门禁

设计系统阶段：

- `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build-storybook`
- Storybook 截图归档到本 space：`docs-linhay/spaces/20260521-claude-code-codex-alignment/screenshots/<YYYYMMDD>/design-system/`

后端接入阶段：

- `go test ./internal/wailsapp -run 'ClaudeCode.*Skill|ClaudeCode.*Mcp|ApplyClaudeCode'`
- `npm --prefix frontend run test:unit -- src/features/codex-extensions/model.test.mjs src/features/design-system/storyCatalog.test.mjs`
- Wails 桌面验证真实文件读写与 diff preview。

## 不做

1. 不把 Claude Code Skills 做成 Codex Skills 的视觉复制；启停、scope、frontmatter 和 commands 语义必须按 Claude 单独设计。
2. 不先写 settings / hooks / subagents 的后端逻辑；先在设计系统 candidate 中明确状态和风险。
3. 不为 P2 的 session/runtime 做编辑 UI；只定义只读摘要和 doctor 状态。
