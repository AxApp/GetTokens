# P2: 二进制管理 + Session + Quota + Permissions — 技术评估

## 1. 二进制版本管理

### 1.1 现有 Codex 实现分析

**后端** (`internal/codexbinary/service.go`, 2409 行):

```
Service 核心流程:
  GetSnapshot()           → 返回 Manifest 状态 + 本地版本 + 远程可用版本
  RefreshAvailable()      → 从 GitHub Releases API 获取最新版本列表
  ImportBinary(path)      → 导入本地二进制 (SHA-256 去重)
  DownloadBinary(version) → 从 GitHub 下载 .tar.gz，解压，移入 managed dir
  UseVersion(id)          → 更新 symlink bin/codex -> versions/<id>/codex
  EnableManagedPath()     → 在 shell profile 写入 PATH 注入块
  DeleteVersion(id)       → 删除版本 (非活跃版本)
  GetVersionNotes(tag)    → 获取 Release Notes (缓存)
  GetDoctor()             → 检查 managed codex 是否正确配置
```

**Manifest 数据结构**：
```go
type Manifest struct {
    SchemaVersion     int
    SelectedVersionID string
    IncludePrerelease bool
    Sources           []Source          // 下载源: openai-codex-github
    Versions          []ManagedVersion  // 已管理的版本
    LastRemoteCheck   *RemoteCheckState
}

type ManagedVersion struct {
    ID              string  // SHA-256 based
    DisplayName     string
    DetectedVersion string
    BinaryPath      string
    SHA256          string
    SourceID        string
    SourceType      string  // "github-release"
    ReleaseTag      string
    InstalledAt     string
}
```

**版本发现**：
- GitHub Releases API: `GET /repos/openai/codex/releases?per_page=100&page=N`
- Tag 前缀: `rust-v`（过滤）
- 平台匹配: `aarch64-apple-darwin` / `x86_64-apple-darwin`
- 后备: Atom feed → HTML scraping

**下载流程**：
1. `DownloadBinary()` → goroutine 异步下载
2. 进度追踪: `downloadTasks map[string]DownloadTaskView`
3. .tar.gz 解压 → 匹配 `codex` 或 `codex-platform` 二进制
4. SHA-256 校验
5. 写入 `versions/<id>/`

**PATH 管理**：
- `EnableManagedPath()` 在 `~/.zshrc` / `~/.bashrc` / `~/.profile` / `~/.config/fish/config.fish` 中写入 managed PATH 块
- Managed PATH 格式:
  ```bash
  # >>> GetTokens managed codex >>>
  export PATH="$HOME/.config/gettokens/codex/bin:$PATH"
  # <<< GetTokens managed codex <<<
  ```

### 1.2 Claude Code 发布渠道调研

Claude Code 的发布方式与 Codex 不同：

| 渠道 | 详情 | 可行性 |
|------|------|--------|
| npm | `npm install -g @anthropic-ai/claude-code` | 官方推荐方式，二进制在 npm 全局 node_modules 下 |
| GitHub Releases | `anthropics/claude-code` repo | 不确定是否有独立二进制发布 |
| Homebrew | 可能有 `brew install claude-code` | 待确认 |
| 内嵌于 Claude Desktop | 部分用户通过桌面应用使用 | 不适用 |

**关键问题**：Claude Code 主要分发方式是通过 npm 全局安装，而非独立二进制下载。这意味着：
1. npm 用户通过 `npm update -g @anthropic-ai/claude-code` 更新，不需要二进制管理器
2. 如果 GitHub 有独立二进制发布，则可复用 Codex 二进制管理架构
3. 如果只有 npm，则二进制管理的价值大打折扣

### 1.3 改造分析

**方案 A：如果 GitHub 有独立二进制**

可复用 Codex 架构 70%：
- `Service` 结构体 → 改 Source (repo: `anthropics/claude-code`, tagPrefix: `@anthropic-ai/claude-code@` 或 `v`)
- Manifest 结构 → 完全复用
- 下载/解压/SHA-256/版本管理/PATH 注入 → 完全复用
- 前端组件 → 完全复用，换 Source ID 和标签

**方案 B：如果只有 npm**

独立设计 npm 全局包管理器：
- 检测系统中 `claude` 命令路径
- `npm list -g @anthropic-ai/claude-code` 获取当前版本
- `npm view @anthropic-ai/claude-code versions --json` 获取可用版本
- `npm install -g @anthropic-ai/claude-code@<version>` 切换版本
- 比二进制管理更简单，但也更脆弱（依赖 npm 环境）

### 1.4 建议

**P2 暂不投入实现**，先做调研：
1. 确认 `anthropics/claude-code` GitHub 是否有独立二进制发布
2. 确认用户群体中 npm vs 独立二进制的比例
3. 如果主要用 npm，考虑更简单的"版本检测 + npm update 触发"替代完整的二进制管理器

---

## 2. Session 管理

### 2.1 Claude Code Session 存储调研

Claude Code 的 session/对话历史存储在：
- `~/.claude/projects/<project-hash>/` 目录下
- 格式为 JSON/SQLite（具体待确认）

与 Codex session 的差异：
- Codex 使用自己的 session 管理 API
- Claude Code 的 session 由 Claude Code 自身管理

### 2.2 可行性

| 功能 | 可行性 | 备注 |
|------|--------|------|
| 列出 Claude Code 会话 | 中 | 需调研 `~/.claude/projects/` 目录结构和 session 文件格式 |
| 查看会话详情（模型、token、时间） | 中 | 取决于 session 文件是否包含这些元数据 |
| 更新 provider 映射 | 不适用 | Claude Code 使用 API key 模式，无 provider 映射概念 |
| 统计用量 | 低 | 不如从 relay 侧统计更准确 |

### 2.3 建议

**P2 暂不投入**，先调研：
1. 读取 `~/.claude/projects/` 目录结构
2. 解析 session 文件格式（JSON/SQLite/二进制）
3. 如果格式稳定且包含有用元数据，可设计 session 列表 UI

优先级低于 relay 侧的用量统计（跨所有 CLI 工具通用）。

---

## 3. 配额与用量追踪

### 3.1 现有 Codex 实现分析

**后端** (`internal/wailsapp/quota.go`):

```
GetCodexQuota()              → 获取 Codex 配额（auth-file 或 API key）
getCodexAPIKeyQuota()        → 执行 quota curl 命令，解析 JSON 响应
TestCodexAPIKeyQuotaCurl()   → 测试 quota curl 命令能否执行
executeCodexAPIKeyQuotaRequest() → HTTP 请求 + JSON 解析
```

**Quota curl 机制**：
- 用户配置自定义 curl 命令（如 `curl -s https://api.openai.com/v1/usage`）
- 后端执行命令，解析 JSON 响应中的 `remaining` / `limit` 等字段
- 返回结构化的 `CodexQuotaResponse`

### 3.2 Claude Code 配额查询

Claude Code 使用 Anthropic API，对应的配额/用量查询：

| 接口 | 用途 | 对应 Codex 概念 |
|------|------|----------------|
| Anthropic Usage API | 获取组织/API key 的用量 | 类似 OpenAI usage API |
| Relay 用量统计 | 经过 GetTokens relay 的请求按 key 聚合 | 跨 CLI 工具通用 |

**Anthropic API usage 接口** (未公开文档)：
- 需要 API key 权限
- 返回组织/workspace 级别的 token 用量
- 可能不支持 per-key 查询

### 3.3 改造分析

**方案 A：Anthropic API usage 查询**
- 复用 quota curl 机制 → 用户配置 Anthropic API usage endpoint
- 解析 Anthropic usage JSON → 映射到 `QuotaResponse`
- 改造量：小（不到 100 行）

**方案 B：Relay 用量统计（推荐）**
- relay 已经在代理所有请求
- 按 relay key 聚合 token 用量 → 跨工具（Codex / Claude Code / Gemini）通用
- 不依赖 Anthropic API usage 接口
- 优先级高于单个 API key 查询

### 3.4 建议

**P2 投入 relay 用量统计**：
1. relay 侧记录每个请求的 relay_key_id、model、prompt_tokens、completion_tokens
2. 聚合查询按时间范围 / relay key 分组
3. 前端用量仪表板 → 对用户价值高于单个 API key 的 quota curl

**不优先做 Anthropic API usage 查询**，因为 relay 用量统计覆盖面更广。

---

## 4. Permissions 管理

### 4.1 Claude Code Permissions 机制

```json
{
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(git:*)",
      "Read",
      "Write",
      "Edit"
    ],
    "deny": [
      "Bash(rm:*)",
      "Bash(sudo:*)"
    ],
    "ask": [
      "Bash(curl:*)"
    ],
    "defaultMode": "ask"
  }
}
```

- `allow`: 直接允许的工具（支持通配符 `Bash(npm:*)` 匹配 `Bash(npm install xxx)`）
- `deny`: 显式禁止的工具
- `ask`: 需要用户确认的工具
- `defaultMode`: 未匹配规则时的默认行为（`allow` / `deny` / `ask`）

### 4.2 技术方案

Permissions 管理是 settings.json 通用编辑器的子集——本质就是编辑 `permissions` 字段。

不需要独立后端接口。

### 4.3 前端设计

相较于通用 JSON 编辑器，Permissions 可以提供一个更友好的专用 UI：

```
┌──────────────────────────────────────────────┐
│  Permissions                  default: ask ▾ │
├──────────────────────────────────────────────┤
│  Allowed                                     │
│  ┌────────────────────────────────────┐  [-] │
│  │ Bash(npm:*)                        │      │
│  ├────────────────────────────────────┤  [-] │
│  │ Bash(git:*)                        │      │
│  ├────────────────────────────────────┤  [-] │
│  │ Read                               │      │
│  └────────────────────────────────────┘      │
│  [+ 添加允许规则]                            │
│                                              │
│  Denied                                      │
│  ┌────────────────────────────────────┐      │
│  │ Bash(rm:*)                         │      │
│  └────────────────────────────────────┘      │
│  [+ 添加禁止规则]                            │
│                                              │
│  Ask Before                                  │
│  ┌────────────────────────────────────┐      │
│  │ Bash(curl:*)                       │      │
│  └────────────────────────────────────┘      │
│  [+ 添加确认规则]                            │
└──────────────────────────────────────────────┘
```

### 4.4 建议

**与 settings.json 通用编辑器合并实现**：
- 不单独做 permissions 管理页面
- 在 settings.json 编辑器中为 permissions 提供专用子表单
- 改造量：纯前端，约 150 行

---

## 总体优先级排序（调整后）

基于所有技术评估，重新排序：

```
P0 (立即做):
  1. Skills 管理     — 复用度最高(80%+), 用户价值最高
  2. MCP Servers 管理 — 复用度高(70%+), 需 JSON patcher
  3. Relay Apply 扩展 — 基础已有, 扩展 env 字段

P1 (尽快做):
  4. CLAUDE.md 管理   — 极低改造量, 高价值
  5. settings.json 通用编辑器 — 一劳永逸解决所有 JSON 配置管理
  6. Hooks 管理        — 零后端, 依赖 settings.json patcher

P2 (调研后决定):
  7. Permissions 管理  — 合并到 settings.json 编辑器
  8. Relay 用量统计    — 跨工具通用, 独立于 Claude Code
  9. 二进制管理        — 需先调研发布渠道
  10. Session 管理     — 需先调研存储格式
  11. Anthropic API quota — relay 用量统计覆盖后优先级降低
```
