# Codex Skills / MCP 本地扩展工作台

## 背景

GetTokens 的 Codex 工作区已经包含账号、会话、状态、用量、二进制管理等能力，但缺少对 Codex 本地扩展的可视化管理。用户现在需要在同一个 Codex 工作区里管理两类扩展：

1. Skills：查看 Codex 实际会扫描到的 `SKILL.md`，支持预览、启停，并支持从 GitHub / GitLab 显式 schema 安装与更新。
2. MCP Servers：查看和编辑 `~/.codex/config.toml` 中的 `[mcp_servers.<id>]`，按 Codex 源码真实解析逻辑安全写回。

本 space 用于沉淀首期业务范围、设计稿、技术方案、验收标准和后续实现计划。

## 产品目标

首期目标是做一个 Codex-only 的本地扩展工作台，不做多应用配置中心。

1. 用户能快速知道 Codex 当前有哪些 Skills、来自哪个 root、是否启用、是否有解析错误。
2. 用户能在不打开编辑器的情况下预览 Skill 内容，尤其是 `SKILL.md`、`agents/openai.yaml`、`references/`、`scripts/`。
3. 用户能通过显式 `tk://github.com/...` / `tk://gitlab.com/...` schema 安装 Git managed Skill，并能手动检查更新。
4. 用户能以列表方式查看 MCP Servers，直接修改单个 server 的参数。
5. 所有写回都必须保留用户原有 Codex 配置，不格式化整个文件，不误删非目标内容。

## 信息架构

Codex 侧边栏新增两个独立入口：

1. `Skills`
2. `MCP Servers`

右侧主体沿用会话页面的信息组织：主视图优先展示当前列表，详情与编辑进入独立 modal / detail layer。两页都使用扁平分隔线、表格化字段，不使用多层卡片嵌套。

## 组件约束

落地实现必须优先复用现有通用组件与全局样式，不为该页面另造一套按钮、输入框、分段控件或页面头。

优先级：

1. 页面标题：`frontend/src/components/ui/WorkspacePageHeader.tsx`
2. 分段切换：`frontend/src/components/ui/SegmentedControl.tsx`
3. 选择 + 创建/删除动作：`frontend/src/components/ui/ActionSelect.tsx`
4. 按钮：全局 `btn-swiss`
5. 输入框：全局 `input-swiss`
6. 下拉框：全局 `select-swiss`
7. 启停开关：现有通用 Toggle / Switch 组件形态，参考 Codex 账号列表的 `ToggleSwitch`
8. Codex feature 配置面板：参考 `StatusCodexFeaturesSection` 的 header、chip、filter、row、preview/save 结构

设计稿只表达布局、信息层级和交互状态。生产代码应把设计稿中的自定义 `tag`、`switch`、`row action` 收敛到现有组件或现有全局样式的组合，尤其不能为 Skill / MCP 单独手写一套 toggle。

## 首期范围

### Skills

1. 按 Codex 源码真实 root 规则扫描：
   - `$CODEX_HOME/skills`
   - `$HOME/.agents/skills`
   - `$CODEX_HOME/skills/.system`
   - `/etc/codex/skills`
   - 不在列表展示 project / repo scope roots，也不展示 Git / plugin 追加 root；当前页面只展示全局 Skills
2. 只识别包含 `SKILL.md` 的目录。
3. 解析 YAML front matter：`name`、`description`、`metadata.short-description`。
4. 可选解析 `agents/openai.yaml`，展示 interface / dependencies / policy 摘要。
5. 支持通过 Codex 真实 `[[skills.config]]` 规则禁用和重新启用 Skill：
   - `path = "/abs/path/SKILL.md"` + `enabled = false`
   - `name = "skill-name"` + `enabled = false`
   - 启停状态按 Codex 规则顺序计算，后出现的匹配规则覆盖前面的匹配规则
6. 支持只读预览：
   - 默认渲染去掉 front matter 的 `SKILL.md`
   - 文件树限制在 skill 目录内
   - 文件列表支持点击切换预览
   - snapshot 只返回文件路径、类型和可预览标记，不一次性返回所有文件内容
   - 点击文件后通过单文件预览接口读取内容，并在前端缓存；Markdown 使用 Markdown 渲染，脚本和其他文本使用等宽文本预览
   - 代码文件只读展示，不执行；大文件或二进制文件不读取内容，只显示不可预览提示
7. 支持移除可写 root 下的 Skill：
   - 从 Skill 详情 modal 进入二次确认
   - 二次确认必须使用 alert dialog 形式，不能用按钮文案切换代替确认层
   - 当前列表只展示全局 Skills，因此只允许删除 user 全局 root 下的 skill 目录
   - 系统 Skill 不允许删除
   - 删除后清理对应 `[[skills.config]]` 禁用 override
   - 删除成功后关闭详情 modal，并展示短暂成功动画 HUD
   - 浏览器预览环境不允许执行移除，避免只隐藏 UI 但本地目录仍被 Codex 扫描；桌面 Wails 环境必须删除目录并校验目录已不存在
8. 支持从 Skill 详情在 Finder 中打开：
   - macOS 桌面环境使用 Finder 定位 `SKILL.md`
   - 浏览器预览只展示不可用提示
   - 路径必须落在 Codex 已配置 skill roots 内
9. 支持 Git source 安装：
   - 主页面只放 `添加 Skill` 操作，点击后打开独立 Git 安装 modal
   - GitHub：`tk://github.com/<owner>/<repo>?ref=<ref>&path=<skill-dir>`
   - GitLab：`tk://gitlab.com/<namespace>/<repo>?ref=<ref>&path=<skill-dir>`
   - 自建 GitLab：只允许配置过的 host allowlist
10. Git source 更新：
   - 用户手动触发 `Check Updates`
   - 后端 `git fetch` 后比对 `resolvedCommit`
   - 用户确认后再更新 materialized skill

### MCP Servers

1. 读取 `~/.codex/config.toml` 的 `[mcp_servers.<id>]`，只把一级 server table 作为列表项。
2. 通过字段推断 transport：
   - `command` => `stdio`
   - `url` => `streamable_http`
3. 支持新增、编辑、删除单个 MCP server。
4. 点击单个 server 行打开独立编辑 modal，支持字段级 dirty 状态和 change preview。
5. `[mcp_servers.<id>.tools.<tool>]` 是该 server 的 per-tool approval 嵌套配置，不展示为独立 server。
6. 保存时只 patch 目标 server，保留其他 server、非 MCP 配置和未知字段。

## 明确非目标

1. 不做 Claude / Gemini / OpenCode / Hermes 的统一扩展管理。
2. 不做 GitHub / GitLab 仓库搜索、marketplace、skills.sh 搜索。
3. 不支持任意 git URL。首期只支持 `tk://github.com/...`、`tk://gitlab.com/...` 和 allowlist 自建 GitLab。
4. 不做后台自动更新。更新必须由用户触发并确认。
5. 不删除未纳管 Skill。没有 manifest 的 Skill 只能展示和启停。
6. 不把 MCP 与 Skills 写回合并成一个事务。
7. 不写入 `type = "stdio"` 或 `type = "streamable_http"` 到 Codex TOML。

## 关键业务规则

1. Skill 禁用使用 Codex 支持的 `[[skills.config]]`，selector 可为 `path` 或 `name` 且二选一；路径按 Codex canonicalize 语义匹配。
2. Skill 启用不是写 `enabled = true`，而是移除匹配的禁用 override；GetTokens 从 UI 启用时会同时清理同名 `name` override，避免列表状态与 Codex 实际读取不一致。
3. Git managed Skill 安装必须拆成两层：
   - managed repository/cache
   - Codex 可扫描 materialized root
4. manifest 是更新、回滚、安全删除的唯一依据。
5. GitLab nested group 的解析规则：最后一个 path segment 是 repo，前面全部是 namespace。
6. 凭据不能进 manifest。token、用户名密码、带 token 的 remote URL 都不能落盘。
7. MCP 的 `bearer_token` 无效且应拒绝，必须使用 `bearer_token_env_var`。
8. `command` 与 `url` 同时存在时不保存，提示 transport 冲突。

## BDD 验收

### 场景 1：查看 Codex Skills

Given 本机存在 `$HOME/.agents/skills/foo/SKILL.md`
When 用户打开 Codex `Skills` 页面
Then 页面展示 `foo` 的名称、描述、scope、root、绝对路径和启用状态
And 页面不会修改磁盘文件

### 场景 2：预览 Skill

Given 用户选择一个包含 `SKILL.md` 的 skill
When 用户点击 Preview
Then 以 modal / detail layer 打开只读预览，而不是在页面右侧常驻详情
And `SKILL.md` 正文不显示 YAML front matter
And 用户可以点击文件列表切换查看 `agents/openai.yaml`、`references/`、`scripts/` 中的小文本文件
And 大文件或二进制文件显示不可预览提示
And 页面不会在打开详情时一次性读取所有文件内容

### 场景 3：禁用与启用 Skill

Given 用户选择一个启用的 skill
When 用户点击禁用
Then GetTokens 写入 `[[skills.config]] enabled = false`
When 用户再次启用
Then GetTokens 移除对应禁用 override，而不是写入 `enabled = true`
And 如果禁用来自同名 `name` selector，GetTokens 也会清理该 selector，避免 Codex 继续把该 Skill 判定为禁用

### 场景 4：移除 Skill

Given 用户打开一个位于 user 全局 root 下的 Skill 详情
When 用户点击 `移除 Skill` 并二次确认
Then GetTokens 删除该 Skill 目录
And 清理 `config.toml` 中对应的禁用 override
And 列表与顶部统计立即移除该 Skill
And 页面显示删除成功动画 HUD

Given 用户打开系统 Skill 详情
When 用户查看移除区域
Then 页面提示系统 Skill 不支持移除
And 后端拒绝删除 `.system` 或 `/etc/codex/skills` 下的 Skill

### 场景 5：在 Finder 中打开 Skill

Given 用户打开 Skill 详情
When 用户点击 `在 Finder 中打开`
Then macOS 桌面环境通过 Finder 定位该 Skill 的 `SKILL.md`
And 后端拒绝打开不在 Codex skill roots 内的任意路径
And 浏览器预览环境只显示不可用提示

### 场景 6：从 GitHub / GitLab 安装 Skill

Given 用户输入 `tk://github.com/ln/xxx?ref=main&path=skills/foo`
Or 用户输入 `tk://gitlab.com/f2e/axure-helper/axure-skill-group?ref=main&path=skills/foo`
When 用户点击 Install
Then GetTokens clone / fetch 到 managed cache
And 只读取 schema 指定 path 下的 skill 目录
And 校验合法 `SKILL.md` 后 materialize 到 Codex root
And manifest 记录 provider、host、namespace、repo、ref、path、resolvedCommit、materializedPath、materializeMethod
And 安装入口来自 `添加 Skill` modal，主列表页面不保留常驻 Git source 表单

### 场景 7：更新 Git managed Skill

Given 已安装 Skill 记录了 `resolvedCommit`
When 用户点击 Check Updates
Then GetTokens 执行 `git fetch` 并解析目标 ref 的最新 commit
And 未变化时展示 up to date
And 有变化时展示 update available 和 commit delta
When 用户确认更新
Then 新版本先校验成功，再替换当前 materialized skill
And 失败时保留当前版本

### 场景 8：读取 MCP Servers

Given `config.toml` 中存在 `[mcp_servers.linear]`
When 用户打开 `MCP Servers` 页面
Then 页面展示 server id、推断 transport、核心参数、启用状态和配置路径
And 非 MCP 配置继续保留在原文件中

### 场景 9：修改单个 MCP 参数

Given 用户展开 `linear` 行的 Edit
When 用户修改 `url`、`bearer_token_env_var`、timeout 或 tool filters
Then 页面展示字段级 dirty 状态
And change preview 只汇总该 server 的变更
When 用户保存
Then GetTokens 只 patch `[mcp_servers.linear]`

### 场景 10：异常保护

Given `config.toml` 不是有效 TOML
When 用户尝试保存 MCP 修改
Then GetTokens 拒绝写入并展示错误
And 原始文件不变

### 场景 11：直接编辑 Codex 配置文件

Given 用户位于 `MCP Servers` 页面
When 用户点击 `编辑 config.toml`
Then 页面打开内置 `config.toml` 文本编辑 modal
And 桌面环境从真实 `~/.codex/config.toml` 读取和保存
And 浏览器预览环境使用内置 preview 文本，不访问本机文件系统

## 设计稿

- 单文件入口：[design-preview.html](./design-preview.html)
- 视觉方向：本地配置控制台，深色侧栏 + 浅色密集工作区 + 扁平行分隔。
- 交互范围：侧边栏 `Skills` / `MCP Servers` 切换、MCP 独立编辑 modal、Skill preview overlay、移动端响应。
- 禁止事项：多层卡片嵌套、营销式 hero、装饰渐变、无来源的远端搜索入口。
- 落地约束：优先套用 `WorkspacePageHeader`、`SegmentedControl`、`btn-swiss`、`input-swiss`、`select-swiss`、通用 Toggle/Switch 等现有组件/样式，设计稿中的局部样式不得直接复制成新的通用体系。

## 技术方案

- 技术设计：[docs-linhay/dev/codex-skills-mcp-architecture-2026-05-12.md](../../dev/codex-skills-mcp-architecture-2026-05-12.md)
- 实施计划：[plans/20260511-cc-switch-codex-skills-mcp-plan-v01.md](./plans/20260511-cc-switch-codex-skills-mcp-plan-v01.md)

## 参考资料

1. cc-switch 参考：`docs-linhay/references/cc-switch/`
2. Codex 源码参考：`docs-linhay/references/codex/`
3. Nolon Skill Detail / installer / update checker：
   - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/NolonUIFoundation/Sources/NolonUIFoundation/SkillDetail/`
   - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/NolonResourceKit/Infrastructure/SkillInstaller.swift`
   - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/ProviderCatalog/RemoteGitRepositorySupport.swift`

## 当前状态

- 状态：implementation-cleanup-completed
- 最近更新：2026-05-14
- 已完成首个 Web 切片：
  - Codex 侧边栏新增 `Skills` / `MCP Servers` 两个独立入口。
  - 前端新增 `features/codex-extensions/`，在浏览器无 Wails runtime 时使用稳定预览数据。
  - 新增通用 `ToggleSwitch` 并复用到 Codex 账号列表与功能开关面板。
  - Skills 支持全局 root filter/search、启停预览、Markdown 安全渲染的 `SKILL.md` 预览、`tk://github.com` / `tk://gitlab.com` schema 校验和安装/更新预览；列表不展示 PROJECT / GIT 分类。
  - Skills 列表为主视图，点击整条 skill 行后以 modal/detail layer 展示 Skill 元信息与 `SKILL.md` 预览；列表不再显示单独的详情按钮，也不保留右侧常驻详情页。
  - Skills Git 安装入口已收敛为 header 的 `添加 Skill` 按钮；点击后打开独立 Git 安装 modal，主列表页面不再常驻 Git source 表单。
  - Skills 支持从详情 modal 移除可写 root 下的 Skill：二次确认后删除本地 skill 目录、清理禁用 override、关闭 modal 并更新列表；系统 Skill 明确禁删。
  - Skills 详情支持在 Finder 中打开：macOS 桌面环境定位 `SKILL.md`，浏览器预览显示不可用提示，后端校验路径必须属于已配置 skill roots。
  - Skills 详情 modal 已改为左右区域独立滚动；文件列表 snapshot 不再携带全部文件内容，点击单个文件后调用 `GetCodexSkillFilePreview` 懒加载并缓存内容。
  - Skills 详情 modal 固定为视口约束高度，文件切换时只更新内部预览滚动区，避免因 Markdown / 文本内容长短不同导致整个 modal 上下跳动；桌面视口保留约 40px 上下间距，避免底部贴边。
  - Git 安装 modal 会展开展示当前 schema 可解析出的全部相关值：Source、Provider、Host、Repo、Ref、Path。
  - MCP Servers 支持列表过滤；点击 server 行打开独立编辑 modal，modal 内完成单 server 参数编辑、字段级 change preview 与本地保存预览；页面不包含 `Config Groups`。
  - MCP server 编辑 modal 会展开展示当前记录的全部相关值：Server ID、Label、Enabled、Status、Transport、Source Path、stdio 字段、HTTP 字段、共享配置字段和 nested tool approval。
  - MCP server 编辑 modal 左侧表单只展示当前 server 已配置的有效字段：transport 必需字段保留，空的 `cwd/env/env_vars`、HTTP header、runtime、tool filters 等可选字段不默认渲染。
  - MCP server 编辑 modal 的滚动由整个 overlay / dialog 承担，不在表单 `main` 内做独立滚动；桌面视口下收窄 max-height，避免底部贴边。
  - MCP server 编辑 modal 按 Codex transport 互斥语义分区：stdio 展示 `command/args/env/env_vars/cwd`，streamable_http 展示 `url/bearer_token_env_var/http_headers/env_http_headers/oauth_resource`，共享区展示 `required/supports_parallel_tool_calls/timeouts/tool filters/scopes`。
  - MCP server 编辑 modal 左侧表单改为单层分区布局：左列展示分区标题与 transport/meta，右列统一字段网格；布尔项使用 `ToggleField` 展示字段名、当前 true/false 和通用 `ToggleSwitch`，避免只显示开关导致层级不齐。
  - MCP server 编辑 modal 在常规桌面宽度使用右侧当前值栏，结构对齐会话页 detail 布局，不把当前值区压到页面底部。
  - MCP Servers 列表区经 debate 收敛后移除独立 metrics 卡片；总数、启用数、待保存数、config path 与 visible count 合入列表 section header，页面保持“只要列表”的单 section 结构。
- 已完成首个真实后端切片：
  - `internal/wailsapp` 新增 Codex Skills / MCP 基础 service。
  - Skills 支持按 Codex 全局 roots 扫描 `SKILL.md`、解析 YAML front matter、返回去 front matter 预览正文；依据 Codex `core-skills/src/loader.rs`，全局 roots 保留 User/System layer，排除 Repo scope 与 plugin/Git 追加 roots。
  - Skills 文件内容读取改为按需接口：`GetCodexSkillFilePreview` 会校验 skill root 与相对路径边界，只读取 64KB 内的非二进制小文本文件。
  - Skills 启停已按 Codex 源码校准：支持 path/name selector、canonical path 匹配、规则顺序覆盖；禁用写入 path 型 `[[skills.config]] enabled=false`，启用时移除匹配 override 而不是写 `enabled=true`。
  - Git source schema parser 已覆盖 `tk://github.com/...` 与 `tk://gitlab.com/...` nested group。
  - MCP 支持读取 section 型 `[mcp_servers.<id>]`，按 `command` / `url` 推断 transport；`[mcp_servers.<id>.tools.<tool>]` 会按 Codex 语义视作嵌套工具策略，不拆成多个 server。
  - MCP 解析和保存字段已按 Codex 源码补齐：stdio 的 `env_vars/cwd`，streamable_http 的 `http_headers/env_http_headers/oauth_resource`，共享字段 `required/supports_parallel_tool_calls/startup_timeout_sec|ms/tool_timeout_sec/default_tools_approval_mode/enabled_tools/disabled_tools/scopes/tools`。
  - MCP 保存支持 patch 单个 section，移除无效 `bearer_token`，保留目标 section 内未知字段和其他非目标配置。
  - MCP Servers 页新增 `编辑 config.toml` 按钮；点击后打开内置文本编辑 modal。桌面环境通过 Wails 读取/保存真实 `~/.codex/config.toml`，浏览器预览使用内置 preview 文本并只保存到页面状态。
  - Wails root `App`、`app_types.go`、`app_mappers.go` 与 `frontend/wailsjs` 已同步，前端桌面环境优先调用真实接口，浏览器继续 fallback 预览数据。
- 已完成收尾整理：
  - 前端 `CodexExtensionsFeature.tsx` 从单一大文件拆分为页面 controller、`SkillsModals.tsx`、`McpModals.tsx` 与 `adapters.ts`；业务纯函数继续留在 `model.ts`。
  - 后端 `codex_extensions.go` 的 Wails DTO 与内部数据结构已迁移到 `codex_extensions_types.go`，保留现有 Wails 方法签名和解析/写回行为。
  - 新增项目级 skill `.agents/skills/gettokens-codex-extensions-management/SKILL.md`，并在领域 skill 与 `AGENTS.md` 中补充入口规则。
  - 整理文档已归档到 `docs-linhay/dev/20260514-codex-extensions-session-distillation.md`。
- 验证产物：
  - `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`
  - `npm run typecheck`
  - `go test ./...`
  - `npm run test:unit`
  - `npm run build`
  - `agent-browser --session codex-mcp-config-inline open 'http://127.0.0.1:5173/#frame=codex&workspace=mcp-servers'` 验证 `编辑 config.toml` 按钮可见；点击后打开内置 `config.toml` modal，textarea 载入 preview 内容，修改后保存按钮启用，保存后提示 `浏览器预览 config.toml 已保存`，浏览器 errors 为空。
  - 浏览器冒烟截图：
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-web-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-list-web-after-v02.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-modal-web-after-v02.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-row-click-web-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-markdown-modal-web-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-add-modal-web-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-skills-add-modal-mobile-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-skills-add-values-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-skills-add-values-mobile-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-values-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-values-mobile-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-whole-modal-scroll-web-after-v01.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-modal-after-v02.png`
    - `screenshots/20260513/codex-extensions/20260513-codex-extensions-mcp-list-redesign-after-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-mcp-editor-before-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-mcp-editor-after-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-mcp-editor-bottom-gap-after-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-mcp-editor-hide-empty-fields-after-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-skill-preview-stable-after-v01.png`
    - `screenshots/20260514/codex-extensions/20260514-codex-extensions-skill-preview-bottom-gap-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-mcp-modal-web-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-mcp-web-after-v02.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-mcp-web-real-api-after-v01.png`
    - `screenshots/20260512/codex-extensions/20260512-codex-extensions-mcp-mobile-after-v01.png`
- 未完成：真实 `git clone/fetch`、Git managed manifest/cache/materialize、Skill update/rollback、MCP inline table / plugin MCP 读取策略、自建 GitLab allowlist 配置 UI。
