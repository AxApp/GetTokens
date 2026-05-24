# Codex Skills / MCP 本地扩展工作台技术方案

## 目标

为 GetTokens 增加 Codex-only 的本地扩展管理能力。实现必须对齐 Codex Rust 源码的真实解析规则，同时吸收 cc-switch 的配置编辑经验和 Nolon 的 Skill 预览、安装、更新链路。

## 总体架构

后端分三条独立链路：

1. Skills 扫描与启停：读取 Codex roots，解析 `SKILL.md`，通过 `[skills]` / `[[skills.config]]` 写禁用 override。
2. Git managed Skill：解析 `tk://...` schema，clone / fetch 到 managed cache，校验后 materialize 到 Codex root，并维护 manifest。
3. MCP 配置：读取和 patch `~/.codex/config.toml` 中的 `[mcp_servers.<id>]`。

三条链路不能共享同一个“保存配置”接口。它们的事务边界、风险和回滚方式不同。

## 2026-05-12 落地后沉淀

本轮实现验证了两个首期能力：Codex `Skills` / `MCP Servers` 浏览器预览，以及 MCP `config.toml` 内置文本编辑器。以下规则后续继续沿用。

1. 浏览器预览是一等入口：Codex workspace tab 需要在无 Wails runtime 时显式 fallback 到 preview data，不能因为缺少 `window.go.main.App` 空白或崩溃。
2. 桌面真实能力仍以 Wails 为准：新增后端方法必须经过 `internal/wailsapp`、root `app.go`、root DTO/mapper、`frontend/wailsjs` 和前端调用链完整暴露。
3. raw editor 与结构化 editor 需要同步：保存 `config.toml` 后必须重新加载 MCP 列表；结构化保存后也应刷新 raw 视图，避免两个编辑面展示不同真相。
4. 浏览器 raw editor 只保存到页面状态，并明确展示 preview-only 结果；桌面 raw editor 才读写真实 `~/.codex/config.toml`。
5. modal/detail layer 需要接入 frame hash 约定。Codex 工作区内的详情 modal 应保留 `frame=codex` 与 `workspace=<key>`，并只增删 `detail` 参数。
6. Skill 和 MCP 列表以“列表为主，整行打开详情”为默认交互；启停 toggle 是独立控件，点击时不得触发行级详情。

本次不沉淀的临时内容：

1. 针对某一张截图的行高、间距、边框权重等微调，只保留在代码和截图记录中，不上升为长期规范。
2. 未落地的 Git managed Skill clone/fetch/materialize/update 仍保留为后续计划，不把尚未验证的实现细节写成 skill 规则。
3. 用户本地现有图标、参考项目删除、Codex binary prerelease 标记等脏文件不属于本 space 的整理对象。

## 2026-05-13 MCP 源码核对修正

本轮按 `docs-linhay/references/codex/codex-rs/config/src/mcp_types.rs` 与 `mcp_edit.rs` 重新核对 MCP 配置语义，并修正 UI / DTO / parser。

1. `[mcp_servers.<id>.tools.<tool>]` 是父 server 的 `tools` nested table，列表只能展示一个 `<id>` server。读取时将 tool name 与 `approval_mode` 挂到父 server 的 `Tools`，保存父 section 时保留已有 nested tool sections。
2. 结构化编辑按 transport 互斥字段分区：
   - stdio：`command`、`args`、`env`、`env_vars`、`cwd`
   - streamable_http：`url`、`bearer_token_env_var`、`http_headers`、`env_http_headers`、`oauth_resource`
   - shared：`experimental_environment`、`enabled`、`required`、`supports_parallel_tool_calls`、`startup_timeout_sec`、`tool_timeout_sec`、`default_tools_approval_mode`、`enabled_tools`、`disabled_tools`、`scopes`
3. `bearer_token` 继续视为无效字段，不写回；保存时只写 `bearer_token_env_var`。
4. `default_tools_approval_mode` 只允许 Codex 当前源码里的 `auto`、`prompt`、`approve`。
5. `startup_timeout_ms` 读取时折算为秒展示；写回统一使用 `startup_timeout_sec`，避免新旧字段同时存在。
6. modal 布局保持单层 overlay：最外层 overlay 负责滚动，表单 `main` 不独立滚动；桌面宽度下右侧当前值栏与编辑区并排，移动端自然下排。

## 2026-05-24 MCP 配置字段补齐

再次按 `docs-linhay/references/codex/codex-rs/config/src/mcp_types.rs` 与 `mcp_edit.rs` 校准后，Codex 当前有效 MCP 配置还包括：

1. shared：`environment_id`。省略时 Codex 等价为 `local`；当 stdio server 使用非 `local` environment 时，Codex 要求 `cwd` 为绝对路径。
2. HTTP OAuth：`[mcp_servers.<id>.oauth] client_id = "..."`，也可由 TOML inline table 表达为 `oauth = { client_id = "..." }`。

本轮实现策略：

1. 后端 DTO / parser / patch 支持 `environment_id`、`oauth.client_id`、`startup_timeout_sec`；`startup_timeout_ms` 仍只作为读取兼容字段，写回统一为秒。
2. `[mcp_servers.<id>.oauth]` 与 `[mcp_servers.<id>.tools.<tool>]` 一样归属于父 server，不作为独立 server 行展示。
3. 保存单个 server 时只替换目标主 section 与目标 oauth nested section，继续保留其它 server、nested tools、未知字段和非 MCP 配置。
4. 编辑 modal 中 transport 字段、runtime 字段、tool scope 字段改为可直接新增，不再只显示已有值；用户可以直接填写 `startup_timeout_sec = 20` 这类空白配置。

## 后端模块建议

### `internal/codexskills`

职责：

1. Resolve Codex roots。
2. 扫描 `SKILL.md`。
3. 解析 skill front matter 和 `agents/openai.yaml`。
4. 读取 preview file tree。
5. 计算启用 / 禁用状态。
6. 写入或移除 skill disable override。

核心类型：

```go
type CodexSkillEntry struct {
    ID          string
    Name        string
    Description string
    Short       string
    Scope       string
    Root        CodexSkillRoot
    SkillPath   string
    Enabled     bool
    Source      CodexSkillSource
    ParseError  string
    Metadata    CodexSkillMetadata
}

type CodexSkillPreview struct {
    Skill      CodexSkillEntry
    Files      []CodexSkillPreviewFile
    ActivePath string
    Content    string
    RenderMode string
}
```

注意：

1. User / Admin / Repo scope 可跟随 symlink；System scope 不跟随。
2. 扫描最大深度为 6，每个 root 最多遍历 2000 个目录。
3. 预览文件必须验证 realpath 位于 skill root 内。
4. `SKILL.md` 缺 front matter 时作为 parse error 展示，不静默吞掉。

### `internal/codexskillgit`

职责：

1. 解析 Git source schema。
2. 生成 install plan。
3. clone / fetch managed repository。
4. checkout / resolve ref。
5. 校验 skill path。
6. symlink 或 copy 到 Codex user root。
7. 维护 manifest。
8. 检查和应用更新。

支持 schema：

```text
tk://github.com/<owner>/<repo>?ref=<ref>&path=<skill-dir>
tk://gitlab.com/<namespace>/<repo>?ref=<ref>&path=<skill-dir>
tk://<allowed-gitlab-host>/<namespace>/<repo>?ref=<ref>&path=<skill-dir>
```

Install plan：

```go
type GitSkillInstallPlan struct {
    SourceSchema     string
    Provider         string
    Host             string
    Namespace        string
    Repo             string
    NormalizedRemote string
    Ref              string
    SkillPath        string
    ClonePath        string
    MaterializedPath string
}
```

Manifest：

```go
type GitSkillManifestEntry struct {
    SkillID           string
    DisplayName       string
    SourceType        string
    SourceSchema      string
    NormalizedRemote  string
    Host              string
    Namespace         string
    Repo              string
    Ref               string
    SkillPath         string
    ResolvedCommit    string
    SkillFolderHash   string
    Version           string
    MaterializedPath  string
    MaterializeMethod string
    InstalledAt       time.Time
    UpdatedAt         time.Time
    LastCheckedAt     time.Time
}
```

路径规则：

1. Clone path：`<appData>/codex-skill-repos/<host>/<namespace>@<repo>`。
2. Materialized path：默认 `$HOME/.agents/skills/<skillID>`。
3. GitLab nested group：repo 是最后一个 segment，namespace 是前置 segments。
4. 拒绝空 path、绝对路径、`..`、NUL、Windows drive path、软链逃逸。

更新规则：

1. `Check Updates` 执行 `git fetch --tags --prune`。
2. 通过 `git rev-parse FETCH_HEAD` 或明确 remote ref 解析 latest commit。
3. 只比较 commit，不比较 ref 字符串。
4. Apply update 前先 checkout 到 staged worktree / managed repo 的目标 commit，并重新校验 `SKILL.md`。
5. materialize 失败时保持当前版本不变。

凭据规则：

1. 不把 token 写入 manifest。
2. 不保存带 token 的 remote URL。
3. 首期使用系统 git credential、SSH agent 或用户本地 git 配置。
4. UI 只显示 host、namespace、repo、ref、commit，不显示 credential。

### `internal/codexmcp`

职责：

1. 读取 `~/.codex/config.toml`。
2. 解析 `[mcp_servers.<id>]`，只把一级 server table 作为 server 列表项。
3. 推断 transport。
4. 校验单 server 修改。
5. patch 单个 server section。
6. 保留未知字段和非 MCP section。

Codex 字段：

1. stdio：`command`、`args`、`env`、`env_vars`、`cwd`
2. streamable_http：`url`、`bearer_token_env_var`、`http_headers`、`env_http_headers`
3. shared：`enabled`、`environment_id`、`required`、`supports_parallel_tool_calls`、`startup_timeout_sec`、`startup_timeout_ms`、`tool_timeout_sec`、`default_tools_approval_mode`、`enabled_tools`、`disabled_tools`、`scopes`、`oauth_resource`、`tools`
4. nested OAuth：`[mcp_servers.<id>.oauth] client_id = "..."` 属于 `<id>` server。
5. nested tool policy：`[mcp_servers.<id>.tools.<tool>] approval_mode = "approve|prompt|auto"` 属于 `<id>` server 的嵌套配置，不是独立 MCP server。

校验：

1. `command` 和 `url` 不能同时存在。
2. `bearer_token` 直接拒绝，提示改用 `bearer_token_env_var`。
3. `default_tools_approval_mode` 只允许 `auto`、`prompt`、`approve`。
4. 保存时不写 `type`。

## Wails 边界

`internal/wailsapp` 负责组合服务和 DTO 映射，根 `app.go` 必须暴露同名方法。

建议方法：

```go
ListCodexSkills(input CodexSkillsListInput) (CodexSkillsSnapshot, error)
GetCodexSkillPreview(input CodexSkillPreviewInput) (CodexSkillPreview, error)
SetCodexSkillEnabled(input CodexSkillToggleInput) (CodexSkillsSnapshot, error)
PlanCodexGitSkillInstall(input GitSkillInstallInput) (GitSkillInstallPlan, error)
InstallCodexGitSkill(input GitSkillInstallInput) (CodexSkillsSnapshot, error)
CheckCodexGitSkillUpdates(input GitSkillUpdateCheckInput) (GitSkillUpdateSnapshot, error)
ApplyCodexGitSkillUpdate(input GitSkillUpdateApplyInput) (CodexSkillsSnapshot, error)
GetCodexMcpConfig(input CodexMcpConfigInput) (CodexMcpSnapshot, error)
PreviewCodexMcpSave(input SaveCodexMcpInput) (CodexMcpPreview, error)
SaveCodexMcpConfig(input SaveCodexMcpInput) (CodexMcpSnapshot, error)
```

## 前端结构

建议目录：

```text
frontend/src/features/codex-extensions/
├── CodexExtensionsPage.tsx
├── skills/
│   ├── SkillsWorkspace.tsx
│   ├── SkillSourceBar.tsx
│   ├── SkillRows.tsx
│   └── SkillPreviewOverlay.tsx
├── mcp/
│   ├── McpWorkspace.tsx
│   ├── McpRows.tsx
│   ├── McpFieldEditor.tsx
│   └── McpChangePreview.tsx
└── model/
    ├── skills.ts
    ├── gitSource.ts
    └── mcp.ts
```

UI 原则：

1. Codex 侧边栏拆成 `Skills` 与 `MCP Servers` 两个 tab。
2. 右侧按会话页面布局：主视图优先保留列表，详情进入 modal / detail layer。
3. MCP 不做 `Config Groups`，只做列表。
4. MCP 点击 server 行打开独立编辑 modal，单次只编辑一个 server。
5. Skills preview 参考 Nolon：左 identity / source / files，右侧使用 `react-markdown` + `rehype-sanitize` 安全渲染 `SKILL.md`。
6. 禁止卡片套卡片；详情层用分隔线和字段网格。
7. Skills Git source install 不常驻主列表页面；主页面只放 `添加 Skill` 操作，点击后打开独立 Git 安装 modal。

### 通用组件优先

实现时先复用现有组件和全局样式，再考虑新增局部组件。除非现有组件无法表达交互，否则不得为该 feature 新建另一套基础 UI。

组件映射：

| 设计对象 | 生产实现优先选择 |
| --- | --- |
| 页面标题与操作区 | `WorkspacePageHeader` |
| `Skills` / `MCP Servers` 二级切换或局部 filter | `SegmentedControl`，或沿用现有 Codex 侧边栏路由项 |
| source 输入、搜索输入 | `input-swiss` |
| transport / approval / filter 下拉 | `select-swiss` 或 `ActionSelect` |
| Install / Update / Preview / Save / Reset | `btn-swiss`，主动作使用 `bg-[var(--text-primary)] !text-[var(--bg-main)]` |
| Skill enabled / MCP enabled | 通用 Toggle / Switch 组件；参考 Codex 账号列表 `ToggleSwitch` 的 `role="switch"`、`aria-checked`、pending/disabled 状态 |
| 配置 header、统计 chip、filter、row、preview/save | 参考 `StatusCodexFeaturesSection` |
| 空态 / loading | `PageLoadingFallback` 或现有页面空态样式 |

允许新增的局部组件只承担业务结构，例如 `SkillRows`、`SkillPreviewOverlay`、`McpFieldEditor`，但内部按钮、输入框、select、toggle、标题和分段控件仍优先使用上述通用组件/样式。

若确实需要新增通用能力，先评估是否应该沉淀到 `frontend/src/components/ui/`，而不是写在 `features/codex-extensions/` 内。

## 测试策略

### Go 单测

1. Codex skill roots 解析。
2. `SKILL.md` front matter 解析。
3. `agents/openai.yaml` 容错解析。
4. preview 路径逃逸拒绝。
5. skill disable / enable override 写回。
6. GitHub schema 解析。
7. GitLab nested group schema 解析。
8. 自建 GitLab allowlist。
9. clone path 推导。
10. install 缺 `SKILL.md` 拒绝。
11. update 失败不破坏当前 materialized path。
12. MCP transport 推断。
13. MCP 单 server patch 保留未知字段。
14. 无效 TOML 不写回。

### 前端单测

1. Skills / MCP tab 状态。
2. Git source schema normalization。
3. MCP dirty field 计算。
4. change preview 汇总。
5. preview overlay 文件切换。

### 验收

1. 浏览器 preview：桌面和 375px 无水平溢出。
2. Wails 桌面窗口：真实绑定可用。
3. 使用临时 `CODEX_HOME` 和临时 git repo 做安装 / 更新冒烟。
4. 截图归档到对应 space。

## 风险

1. TOML patch 如果退回字符串拼接，容易破坏用户 config。
2. Git source 安装如果允许任意 URL，会扩大安全面。
3. GitLab self-hosted 如果不做 allowlist，容易误接不可信 host。
4. symlink / copy fallback 如果不写 manifest，后续无法安全删除。
5. Token 如果进入 manifest 或日志，会造成凭据泄露。

## 首期建议

首期按以下顺序实现：

1. 只读 Skills + preview。
2. MCP 读取 + 独立 modal 编辑 + patch 保存。
3. Skill 启停。
4. Git source install plan + manifest。
5. GitHub / GitLab 安装。
6. Git managed 更新。
