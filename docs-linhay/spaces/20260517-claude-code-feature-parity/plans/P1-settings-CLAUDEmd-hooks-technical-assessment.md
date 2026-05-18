# P1: settings.json 通用编辑器 + CLAUDE.md + Hooks — 技术评估

## 1. settings.json 通用配置管理

### 1.1 现有实现基础

**后端** (`claude_local_apply.go`):
- `buildClaudeCodeSettingsJSON()` — 创建新 settings.json / preservative merge env 对象
- `replaceClaudeCodeEnvObject()` — 在现有 JSON 中替换 env 对象
- `insertClaudeCodeEnvObject()` — 在根对象插入 env key
- 手动 JSON scanning（字符级遍历，保留格式）

**限制**：
- 只处理 `env` 字段
- 手动 JSON scanning 难以扩展到任意嵌套路径
- 所有字段平铺在 `buildClaudeCodeEnvPayload()` 中

### 1.2 Claude Code settings.json 完整字段清单

根据官方文档和社区参考，`settings.json` 支持的字段：

```
顶层字段：
  env                  object   环境变量 (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, etc.)
  permissions          object   工具权限规则
    allow              string[] 允许的工具（支持通配符）
    deny               string[] 显式禁止的工具
    ask                string[] 需要确认的工具
    defaultMode        string   默认行为 (allow/deny/ask)
  hooks                object   事件钩子
    PreToolUse         object[] 工具调用前
    PostToolUse        object[] 工具调用后
    Notification       object[] 通知事件
    Stop               object[] 会话停止
    SessionStart       object[] 会话启动
    UserPromptSubmit   object[] 用户提交提示词
    PreCompact         object[] 上下文压缩前
  statusLine           object   状态行配置
    type               string   "command" | "text"
    command            string   执行的 shell 命令
    text               string   静态文本
  model                string   默认模型 ID
  includeCoAuthoredBy  boolean  是否包含协作者标注
  cleanupPeriodDays    number   自动清理天数
  autoCompact          boolean  是否自动压缩上下文
  skipPermissionsOnStartup boolean 启动时跳过权限检查
  autoUpdate           boolean  自动更新
  enableAllProjectMcpServers boolean 启用所有项目 MCP servers
```

### 1.3 通用 JSON Editor 设计

**后端设计**：

```go
// internal/settingsjson/patcher.go

// SettingsDocument 完整的 settings.json 文档
type SettingsDocument struct {
    Path     string             // 文件路径
    Raw      json.RawMessage    // 原始 JSON
    Fields   map[string]any     // 结构化字段
    Unknowns map[string]any     // 未知字段（保留）
}

// MergeSettingsField 通用 preservative merge 单个字段
// path: ["permissions", "allow"] -> 写入 permissions.allow
func MergeSettingsField(existing []byte, path []string, value any) ([]byte, error)

// MergeSettingsFields 批量 merge
func MergeSettingsFields(existing []byte, patches map[string]any) ([]byte, error)

// ValidateSettingsField 字段级校验
func ValidateSettingsField(path []string, value any) error
```

**与现有 `claude_local_apply.go` 的关系**：
- 保留 `ApplyClaudeCodeAPIKeyConfigToLocal()` 作为快捷入口
- 新增 `GetSettingsDocument()` / `MergeSettingsField()` 作为通用底层
- 快捷入口内部调用通用底层

**关键设计决策**：

JSON preservative merge 采用 `json.RawMessage` 方案：
```go
func MergeSettingsField(existingJSON []byte, path []string, value any) ([]byte, error) {
    // 1. Unmarshal 到 map[string]json.RawMessage（保留嵌套）
    // 2. 沿 path 遍历，用 json.RawMessage 避免精度丢失
    // 3. 在目标层级 merge value
    // 4. Marshal 回 JSON（不保留原始注释/空格，因为没有注释语法）
}
```

与 TOML 的 line-based preservative patch 不同，JSON 天然就需要 parse 后 merge。这是合理的设计差异。

### 1.4 前端设计

参考 Codex feature config 面板 (`CodexFeature.tsx`) 的交互模式：
- 左侧按分类（env / permissions / hooks / statusLine / 其他）分区
- 每个字段独立编辑
- 右侧 diff preview 实时更新
- 保存前展示 change summary

组件复用：
```
WorkspacePageHeader    ← 页面标题
SegmentedControl       ← 分区切换
btn-swiss              ← 保存/重置按钮
input-swiss            ← 文本输入
select-swiss           ← 下拉选择
ToggleSwitch           ← 布尔开关
```

**数据流**：
```
GetSettingsDocument() => { env, permissions, hooks, statusLine, model, ... }
  ↓
前端表单编辑 (per-category panels)
  ↓
Build Diff Preview (对比 original vs draft)
  ↓
MergeSettingsFields(original, patches[]) => 写入 settings.json
```

### 1.5 实施步骤

1. 实现 `internal/settingsjson/patcher.go` — 通用 JSON preservative merge
2. 替换 `claude_local_apply.go` 的手动 JSON scanning 为通用 patcher
3. 新增 Wails 接口：`GetClaudeSettingsDocument()`, `MergeClaudeSettingsFields()`
4. 前端新增 settings editor 页面 (`#frame=claude&workspace=settings`)
5. 按分区逐步覆盖字段（先 env 全部字段 → permissions → hooks → 其他）

### 1.6 改造量估算

| 层次 | 改造量 | 说明 |
|------|--------|------|
| 后端 JSON patcher | 中 (~300 行) | 通用 JSON merge，可复用于 MCP JSON patcher |
| 后端 Wails 接口 | 小 (~50 行) | 2 个新方法 |
| 后端重构 `claude_local_apply.go` | 小 (~50 行改动) | 替换为通用 patcher |
| 前端新页面 | 中 (~400 行) | 参考 CodexFeature.tsx 的交互模式 |
| 前端组件复用 | 零新增 | 全用现有组件 |

---

## 2. CLAUDE.md 管理

### 2.1 功能范围

Claude Code 的 `CLAUDE.md` 用于注入系统指令，分为两级：
- 用户级：`~/.claude/CLAUDE.md` — 对所有项目生效
- 项目级：`<project>/.claude/CLAUDE.md` — 仅对该项目生效

Codex 使用 `AGENTS.md` 而非 `CLAUDE.md`，但概念完全相同。

### 2.2 后端设计

```go
// internal/wailsapp/claude_md.go

type ClaudeMDDocument struct {
    Path    string `json:"path"`          // CLAUDE.md 路径
    Scope   string `json:"scope"`         // "user" | "project"
    Content string `json:"content"`       // 文件内容
    Exists  bool   `json:"exists"`
}

func (a *App) GetClaudeMD() (*ClaudeMDDocument, error) {
    // 读取 ~/.claude/CLAUDE.md
}

func (a *App) SaveClaudeMD(content string) (*ClaudeMDDocument, error) {
    // 写入 ~/.claude/CLAUDE.md
}

// 项目级 CLAUDE.md
func (a *App) GetProjectClaudeMD(projectPath string) (*ClaudeMDDocument, error) {
    // 读取 <project>/.claude/CLAUDE.md
}

func (a *App) SaveProjectClaudeMD(projectPath string, content string) (*ClaudeMDDocument, error) {
    // 写入 <project>/.claude/CLAUDE.md
}
```

**功能要点**：
1. 读取/保存 Markdown 文件（无解析需求，纯文本）
2. 模板系统：预设常用 CLAUDE.md 模板（如 Go 项目模板、React 项目模板）
3. 编辑历史：可选，localStorage 级别

### 2.3 前端设计

极简 UI：
```
┌─────────────────────────────────────────┐
│  CLAUDE.md                   用户级 ▾  │
├─────────────────────────────────────────┤
│  [模板选择: 无 ▾]  [插入模板]          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  # Project Instructions         │   │
│  │                                 │   │
│  │  - Always use TypeScript        │   │
│  │  - Prefer functional components │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [预览]  [保存]                         │
└─────────────────────────────────────────┘
```

右上角下拉切换用户级 / 项目级（需输入项目路径或从 Codex projects 列表选择）。

Markdown 预览复用 Codex Skills 的 Markdown 渲染组件。

### 2.4 实施步骤

1. 后端新增 `GetClaudeMD()` / `SaveClaudeMD()` 接口
2. 前端新增 CLAUDE.md 编辑页面
3. 预设 3-5 个模板
4. Markdown 预览

### 2.5 改造量估算

| 层次 | 改造量 | 说明 |
|------|--------|------|
| 后端 | 极小 (~60 行) | 纯文件读写 |
| 前端 | 小 (~200 行) | 文本编辑器 + 模板下拉 + Markdown 预览 |
| 总计 | 半天工作量 | 独立功能，零依赖 |

---

## 3. Hooks 管理

### 3.1 Claude Code Hooks 机制

Claude Code 支持 7 种事件钩子，配置在 `settings.json` 的 `hooks` 字段：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash\\b.*",
        "command": "echo 'About to run: $CLAUDE_TOOL_NAME'",
        "timeout": 10
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write\\b.*",
        "command": "node ~/scripts/log-write.js $CLAUDE_FILE_PATH"
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "command": "terminal-notifier -title 'Claude' -message '$CLAUDE_MESSAGE'"
      }
    ],
    "Stop": [
      {
        "command": "bash ~/hooks/on-stop.sh"
      }
    ],
    "SessionStart": [
      {
        "matcher": "",
        "command": "echo 'Claude session started'"
      }
    ],
    "UserPromptSubmit": [
      {
        "command": "python log-prompt.py '$CLAUDE_PROMPT'"
      }
    ],
    "PreCompact": [
      {
        "command": "echo 'Compacting context...'"
      }
    ]
  }
}
```

每个 hook rule：
- `matcher` (string, 可选): 正则表达式，匹配工具名或事件内容
- `command` (string, 必需): 执行的 shell 命令
- `timeout` (number, 可选): 超时秒数

### 3.2 后端设计

Hooks 管理是 settings.json 通用编辑器的子集——本质就是编辑 `hooks` 字段。

```
MergeSettingsField(existing, ["hooks", "PreToolUse", "0", "command"], "new-command")
MergeSettingsField(existing, ["hooks", "SessionStart"], [{"command": "..."}])
```

不需要独立后端接口，直接复用 settings.json 通用 patcher。

### 3.3 前端设计

独立于通用 settings.json 编辑器的原因是 hooks 有特殊交互需求：

```
┌──────────────────────────────────────────────┐
│  Hooks                                       │
├──────────────────────────────────────────────┤
│  PreToolUse        ← 2 条规则                │
│  PostToolUse       ← 1 条规则                │
│  Notification      ← 0 条规则                │
│  Stop              ← 0 条规则                │
│  SessionStart      ← 1 条规则                │
│  UserPromptSubmit  ← 0 条规则                │
│  PreCompact        ← 0 条规则                │
├──────────────────────────────────────────────┤
│                                               │
│  [+] 新增规则          [保存到 settings.json] │
│                                               │
└──────────────────────────────────────────────┘
```

点击事件类型展开规则列表，每条规则可编辑 matcher / command / timeout。

**资源**：预设常用 hook 模板：
- "运行测试前通知"
- "写入文件后格式检查"
- "会话开始时加载环境变量"
- "工具调用日志"

### 3.4 改造量估算

| 层次 | 改造量 | 说明 |
|------|--------|------|
| 后端 | 零 | 复用 settings.json patcher |
| 前端 | 小 (~250 行) | hooks 专属 UI + 模板预设 |
| 总计 | 半天工作量 | 纯前端，零后端开发 |
