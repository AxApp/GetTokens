# P0: Skills + MCP + Relay Apply 扩展 — 技术评估

## 1. Skills 管理

### 1.1 现有 Codex 实现分析

**后端** (`internal/wailsapp/codex_extensions.go`):

```
GetCodexSkillsSnapshot() -> 扫描 roots → 解析 SKILL.md → 计算启停状态 → 返回列表
SaveCodexSkillEnabled(input) -> 写入 [[skills.config]] 到 config.toml
GetCodexSkillFilePreview(input) -> 读取 skill 目录下文件 (≤64KB)
RemoveCodexSkill(input) -> 删除 skill 目录 + 清理 config.toml 中禁用 override
OpenCodexSkillInFinder(input) -> macOS Finder 定位
parseCodexGitSkillSource(raw) -> tk:// schema 解析
```

**Skill roots**：
```go
func resolveCodexSkillRoots(codexHome string) []CodexSkillRoot {
    candidates := []CodexSkillRoot{
        {Label: "$CODEX_HOME/skills", Path: filepath.Join(codexHome, "skills"), SourceKind: "user"},
        {Label: "$HOME/.agents/skills", Path: filepath.Join(home, ".agents", "skills"), SourceKind: "user"},
        {Label: "$CODEX_HOME/skills/.system", Path: filepath.Join(codexHome, "skills", ".system"), SourceKind: "system"},
        {Label: "/etc/codex/skills", Path: "/etc/codex/skills", SourceKind: "system"},
    }
}
```

**启停机制**：写入 `config.toml` 的 `[[skills.config]]`：
```toml
[[skills.config]]
path = "/absolute/path/SKILL.md"
enabled = false
```

**前端** (`features/codex-extensions/`):
- `CodexExtensionsFeature.tsx` — 页面 controller
- `SkillsModals.tsx` — skill 详情 modal、Git 安装 modal
- `adapters.ts` — `mapBackendSkill()`, `mapBackendMcpServer()`, `toBackendMcpServer()`
- `model.ts` — 纯函数、类型定义

### 1.2 Claude Code Skills 差异分析

| 维度 | Codex | Claude Code | 改造量 |
|------|-------|-------------|--------|
| Skills 目录 | `$CODEX_HOME/skills/`, `$HOME/.agents/skills/` | `~/.claude/skills/`, 项目 `.claude/skills/` | 小 — 改 root 列表 |
| SKILL.md 格式 | YAML front matter + Markdown | 同格式 | 零 — 完全相同 |
| 启停机制 | `config.toml` 的 `[[skills.config]]` | `settings.json` 的 `skills` 字段或直接移动目录 | 中 — 需确认 Claude Code 原生 skills 启停机制 |
| Git 安装 | `tk://` schema → clone → materialize | 同 schema | 小 — tk:// 解析通用 |
| 系统 Skills | `/etc/codex/skills`、`.system` | 无对应 | 小 — Claude Code 无系统 skills |

### 1.3 Claude Code Skills 启停机制调研结论

Claude Code 的 skills 目前通过**目录存在性**控制启停：
- `~/.claude/skills/<name>/SKILL.md` 存在 → 启用
- 移除目录或 SKILL.md → 禁用
- `settings.json` 目前没有 `[[skills.config]]` 的等价物

**这意味着**：Claude Code skills 管理比 Codex 更简单——不需要维护 config.toml 的启停规则，只管理目录本身。这反而降低了实现复杂度。

### 1.4 复用方案

```
内部架构：
  internal/
    cliskill/                          # 新 package：通用 CLI Skills 管理
      scanner.go                       # 通用 skill 扫描器
        - SkillScanner{ Roots []string }
        - Scan() []SkillRecord
      parser.go                        # SKILL.md front matter 解析
      git_source.go                    # tk:// schema 解析 (从 codex_extensions.go 提取)
      service.go                       # 通用 CRUD：启用/禁用/删除/预览

      # 每个 CLI 工具的差异只在这里：
      codex_roots.go                   # Codex roots 配置
      claude_roots.go                  # Claude Code roots 配置

    wailsapp/
      codex_extensions.go              # 调用 cliskill + 写 config.toml
      claude_skills.go                 # 新增：调用 cliskill + 写 settings.json
```

**关键差异点**：
1. Roots: Codex 有 4 个 roots，Claude Code 只有 1 个 (`~/.claude/skills/`)
2. 启停: Codex 写 TOML `[[skills.config]]`，Claude Code 移出/移回目录
3. 系统 skills: Claude Code 无此概念，所有 skills 都是 user skills
4. 项目 skills: Claude Code 有项目级 `.claude/skills/`，Codex 无

### 1.5 前端复用

| 组件 | Codex 现有 | Claude Code 改造 |
|------|-----------|-----------------|
| Skill 列表 | `CodexSkillsSnapshot.skills[]` | 复用同一数据结构，改 roots 标签 |
| Skill 详情 modal | `SkillsModals.tsx` | 直接复用，关掉系统 skill 限制 |
| SKILL.md 预览 | Markdown 渲染 | 零改造 |
| 文件预览懒加载 | `GetCodexSkillFilePreview` | 改后端接口路径，前端复用 |
| Git 安装 | tk:// schema modal | 直接复用 tk:// 解析 |
| 启停开关 | Toggle + 写 config.toml | 改为移出/移回目录操作 |

**估算复用度**：前端 85%+，后端 70%+

### 1.6 实施步骤

1. 抽取 `cliskill` 通用 package
2. 新增 `ClaudeSkillsRoots()`：`~/.claude/skills/`
3. 改启停逻辑：`claude.Enable()` → `os.Rename(skillDir, claudeSkillsDir+"/"+name)`
4. 前端新增 `#frame=claude&workspace=skills` 路由
5. 复用 Codex Skills 前端组件，注入 Claude Code 数据源

---

## 2. MCP Servers 管理

### 2.1 现有 Codex 实现分析

**后端** (`codex_extensions.go`):

```
GetCodexMcpServers() -> 解析 config.toml [mcp_servers.<id>] sections → 返回 JSON
SaveCodexMcpServer(input) -> 校验 + TOML section patch → 写回 config.toml
```

**核心数据结构** `CodexMcpServer`：
- ID, Label, Enabled, Transport, SourcePath, Status
- stdio: Command, Args, Env, EnvVarsRaw, Cwd
- streamable_http: URL, BearerTokenEnvVar, HTTPHeaders, EnvHTTPHeaders, OAuthResource
- 共享: Required, SupportsParallelToolCalls, StartupTimeoutSec, ToolTimeoutSec
- Tool filters: DefaultToolsApprovalMode, EnabledTools, DisabledTools, Scopes
- 嵌套: Tools (per-tool approval)

**TOML 读写**：
- `readCodexMcpDocument()` — 扫描所有 `[mcp_servers.*]` sections
- `parseCodexMcpServerSection()` — 逐行解析字段
- `patchCodexMcpServerSection()` — 保留未知字段的 preservative patch
- `validateCodexMcpServer()` — transport 冲突、required 字段校验

### 2.2 Claude Code MCP 差异分析

| 维度 | Codex | Claude Code | 改造量 |
|------|-------|-------------|--------|
| 配置位置 | `~/.codex/config.toml` | `~/.claude.json` | **大** — 文件格式完全不同 |
| 配置格式 | TOML section `[mcp_servers.<id>]` | JSON object `mcpServers.<id>` | **大** — 需要 JSON patcher |
| 字段语义 | 几乎相同 (command, args, env, url, headers, timeout...) | 几乎相同 | 小 — 字段集高度重叠 |
| Transport 推断 | command→stdio, url→streamable_http | 同规则 | 零 |
| Tool approval 嵌套 | `[mcp_servers.<id>.tools.<tool>]` | `mcpServers.<id>.tools.<tool>` | 小 — 嵌套结构语义相同 |
| 其他顶层字段 | `~/.claude.json` 无其他内容 | `~/.claude.json` 还包含 `projects`、`installSource` 等 | 中 — preservative patch 需保留非 MCP 字段 |
| 写入策略 | TOML section 级 preservative patch | JSON object 级 preservative merge | 中 — 需要 JSON merge 替代 TOML patch |

### 2.3 JSON Patcher 设计

Claude Code 的 `~/.claude.json` 是标准 JSON，现有的 `claude_local_apply.go` 已有 JSON 读写基础，可以扩展：

```go
// 通用 JSON preservative merge
func patchJSONObject(existing []byte, path []string, value any,
                     knownKeys map[string]bool) ([]byte, error)

// 具体到 MCP server patch:
// path = ["mcpServers", "server-id"]
// knownKeys = {"command","args","env","url","headers",...}
```

对比 TOML patcher 和 JSON patcher：

| 操作 | TOML (line-based) | JSON (structure-based) |
|------|-------------------|----------------------|
| 新增 server | Append lines | 新增 JSON key |
| 删除 server | Remove lines range | Delete JSON key |
| 修改字段 | Replace known lines, keep unknown | Merge known fields, keep unknown |
| 保留注释 | TOML 注释保留（line-based 天然支持） | JSON 不保留注释（无官方注释语法） |
| 复杂嵌套 | TOML 多层 section | JSON 深层 nesting |

**关键问题**：JSON 不支持注释。如果用户手动添加了 `// comment`（虽然非标但可能），JSON patcher 无法保留。这是从 TOML patcher 切换到 JSON patcher 的主要降级。

### 2.4 复用方案

```
internal/
  climcp/                             # 新 package：通用 CLI MCP 管理
    types.go                          # CLI 无关的 McpServer 类型
    parser_json.go                    # JSON 解析 (~/.claude.json)
    parser_toml.go                    # TOML 解析 (config.toml) — 从 codex_extensions.go 提取
    patcher_json.go                   # JSON preservative merge
    patcher_toml.go                   # TOML section patch — 从现有代码提取
    validator.go                      # 通用校验 (transport, fields)
    service.go                        # 通用 CRUD

  wailsapp/
    codex_extensions.go               # 调用 climcp + TOML parser/patcher
    claude_mcp.go                     # 新增：调用 climcp + JSON parser/patcher
```

### 2.5 前端复用

| 组件 | Codex 现有 | Claude Code 改造 |
|------|-----------|-----------------|
| MCP 列表 | `CodexMcpServersSnapshot.servers[]` | 复用同一数据结构 |
| MCP 编辑 modal | `McpModals.tsx` | 直接复用，改 sourcePath 标签 |
| inline config.toml 编辑 | `config.toml` textarea | 改为 `~/.claude.json` textarea |
| Transport 推断 | `transport` 字段 | 完全复用 |
| 字段编辑 | 左列表单 + 右列当前值 | 完全复用 |
| Change preview | `buildCodexMcpChanges()` | 复用 diff 逻辑 |

**估算复用度**：前端 90%+（MCP server 数据结构完全相同），后端 60%+（主要改造在 JSON patcher）

### 2.6 实施步骤

1. 抽取 `climcp` 通用 package（类型 + 校验）
2. 实现 `patcher_json.go` — JSON preservative merge
3. 新增 `claude_mcp.go` — 读 `CLAUDE_CONFIG_DIR/claude.json`
4. 前端新增 `#frame=claude&workspace=mcp-servers` 路由
5. 复用 MCP Modals 组件

---

## 3. Relay Local Apply 扩展

### 3.1 现有实现

**后端** (`claude_local_apply.go`):
```
ApplyClaudeCodeAPIKeyConfigToLocal(apiKey, baseURL, model) ->
  读 settings.json → preservative merge env 字段 → 写回
```

受控字段（当前）：
- `env.ANTHROPIC_API_KEY`
- `env.ANTHROPIC_BASE_URL`
- `env.ANTHROPIC_MODEL`

冲突检测：`ANTHROPIC_AUTH_TOKEN`

**实现细节**：
- `buildClaudeCodeSettingsJSON()` — 创建新文件或 preservative merge
- `replaceClaudeCodeEnvObject()` — 找到 env 对象并替换（保留未知字段）
- `insertClaudeCodeEnvObject()` — 在根对象插入 env key
- 手动 JSON scanning（非 `encoding/json` 完整解析）以保留格式

### 3.2 扩展范围

**当前 env 字段扩展**：
```
ANTHROPIC_API_KEY          ← 已支持
ANTHROPIC_BASE_URL         ← 已支持
ANTHROPIC_MODEL            ← 已支持
ANTHROPIC_AUTH_TOKEN       ← 已检测（冲突提示），不支持写入
ANTHROPIC_DEFAULT_HAIKU_MODEL  ← 新：Claude Code 支持的模型指定
ANTHROPIC_DEFAULT_SONNET_MODEL ← 新
ANTHROPIC_DEFAULT_OPUS_MODEL   ← 新
ANTHROPIC_SMALL_FAST_MODEL     ← 新：Claude Code 4.x
```

**非 env 字段扩展**（P1 范围，但基础设施可在此阶段准备）：
```
model                     → 默认模型名
permissions               → 工具权限规则
includeCoAuthoredBy       → 协作者标注
cleanupPeriodDays         → 自动清理天数
```

### 3.3 改造分析

现有 `claude_local_apply.go` 的手动 JSON scanning 方法（`findJSONStringKey`、`skipJSONWhitespace`、`findMatchingJSONBrace`）是专为 env 字段设计的。扩展到更多字段时有两种选择：

**方案 A：继续扩展手动扫描**
- 为每个新字段写 `findXxx/replaceXxx`
- 代码量线性增长，维护成本高
- 优点：零外部依赖，保留换行/空格

**方案 B：通用 JSON preservative merger**
- 封装为 `MergeJSONField(existing, path, value)` 通用函数
- 一次投入，覆盖所有字段
- 可复用于 settings.json 编辑器

**建议：P0 扩展 env 字段用方案 A（改动小），P1 全字段编辑器用方案 B。**

### 3.4 前端改造

当前状态页 `Codex / Claude Code` tab 的 Claude Code tab 只有 3 个输入（API Key、Base URL、Model）。

扩展：
```
Claude Code tab 增加：
  - Default Haiku Model (下拉)
  - Default Sonnet Model (下拉)
  - Default Opus Model (下拉)
  - Small Fast Model (下拉)
```

右侧 Diff 预览自动包含新增字段。

### 3.5 实施步骤

1. 后端扩展 `buildClaudeCodeEnvPayload()` 支持 4 个新增字段
2. 前端扩展 `ClaudeCodeLocalApplyDraft` 类型增加字段
3. 前端扩展 `buildClaudeCodeSettingsDiff()` 显示新增字段
4. 扩展单元测试覆盖
