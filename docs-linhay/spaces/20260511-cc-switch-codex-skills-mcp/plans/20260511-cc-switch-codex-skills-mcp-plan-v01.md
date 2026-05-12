# Codex Skills / MCP 实施计划 v01

## 范围基线

本计划服务于 `20260511-cc-switch-codex-skills-mcp` space。业务需求见 space `README.md`，技术方案见 `docs-linhay/dev/codex-skills-mcp-architecture-2026-05-12.md`。

首期只做 Codex 本地扩展工作台：

1. `Skills`
2. `MCP Servers`

不做多应用同步、不做 marketplace、不做任意 git URL。

## 里程碑

### M1：只读与预览

目标：

1. 后端扫描 Codex Skills roots。
2. 前端展示 Skills 列表、root rail、parse error、enabled 状态。
3. Skill preview overlay 可查看 `SKILL.md`、`agents/openai.yaml` 和资源文件。
4. 后端读取 MCP config 并展示列表。

验收：

1. 临时 `CODEX_HOME` 下的 skill 能被识别。
2. `SKILL.md` front matter 不显示在 preview 正文。
3. 缺 front matter 的 skill 显示解析错误。
4. MCP transport 由 `command` / `url` 推断。

测试：

1. `internal/wailsapp/codex_skills_test.go`
2. `internal/wailsapp/codex_mcp_config_test.go`
3. 前端 preview model 单测

### M2：安全写回

目标：

1. Skill 禁用 / 启用写回 `[skills]` override。
2. MCP 单 server 编辑、预览和保存。
3. 保存前展示 change preview。
4. 无效 TOML 或 transport 冲突时拒绝写入。

验收：

1. 启用 Skill 是移除禁用 override，不写 `enabled = true`。
2. 编辑 `[mcp_servers.linear]` 不影响其他 server。
3. `bearer_token` 被拒绝。
4. 非 MCP section 保留。

测试：

1. Skill enable / disable override 单测。
2. MCP patch 保留未知字段单测。
3. 无效 TOML 不写回单测。

### M3：Git source 安装

目标：

1. 支持 `tk://github.com/...`。
2. 支持 `tk://gitlab.com/...` nested group。
3. 支持 allowlist 自建 GitLab host。
4. clone / fetch 到 GetTokens managed repository/cache。
5. 校验后 symlink 或 copy 到 Codex user root。
6. 写入 manifest。

验收：

1. GitHub schema 能生成稳定 clone path。
2. GitLab nested group 能生成 `gitlab.com/<namespace>@<repo>` clone path。
3. `path` 穿越被拒绝。
4. 缺 `SKILL.md` 不写入 Codex root。
5. manifest 不包含 token。

测试：

1. schema parser table tests。
2. allowlist tests。
3. path boundary tests。
4. materialize symlink / copy fallback tests。

### M4：Git managed 更新

目标：

1. 用户手动 Check Updates。
2. 后端 `git fetch` 后解析 latest commit。
3. UI 展示 up to date / update available。
4. Apply update 两阶段校验，失败保留当前版本。

验收：

1. ref 不变但 commit 更新时能识别。
2. 更新失败不破坏当前 materialized skill。
3. 更新后 manifest 的 `resolvedCommit` 和 `updatedAt` 更新。

测试：

1. 本地 bare repo 模拟远端更新。
2. 更新失败 rollback 测试。
3. manifest migration / readback 测试。

### M5：桌面验收与截图

目标：

1. Wails root App 暴露所有方法。
2. 重新生成 `frontend/wailsjs`。
3. 浏览器 preview 和真实桌面窗口都完成验收。
4. 截图归档到当前 space。

验收：

1. `go test ./internal/wailsapp` 通过。
2. `npm --prefix frontend run test` 通过。
3. 桌面窗口中 Skills / MCP tab 可切换。
4. 375px preview 无水平溢出。

## 设计交付

当前设计稿为单文件：

```text
docs-linhay/spaces/20260511-cc-switch-codex-skills-mcp/design-preview.html
```

设计原则：

1. 侧边栏拆 `Skills` / `MCP Servers`。
2. 右侧采用会话页面式工作区，主视图保留列表，详情/编辑进入 modal。
3. MCP 只保留列表，不做 `Config Groups`。
4. Skills 预览参考 Nolon detail。
5. Git source install 使用扁平输入区和 source metadata。
6. 全稿不做多层卡片嵌套。
7. 生产实现优先复用 `WorkspacePageHeader`、`SegmentedControl`、`ActionSelect`、`btn-swiss`、`input-swiss`、`select-swiss`、通用 Toggle/Switch 和 `StatusCodexFeaturesSection` 的配置面板模式；设计稿样式只作为布局表达，不直接复制成另一套基础组件。

## 组件落地清单

实现前先完成一次组件映射自检：

1. 页面 header 是否使用 `WorkspacePageHeader`。
2. 所有文本按钮是否使用 `btn-swiss` 或现有按钮变体。
3. 所有输入是否使用 `input-swiss`。
4. 所有 select 是否使用 `select-swiss` 或 `ActionSelect`。
5. 所有启停控件是否复用通用 Toggle/Switch，而不是在 feature 内手写 switch。
6. tab/filter 是否可复用 `SegmentedControl`。
7. MCP 配置列表是否沿用 Codex feature 配置页的 header/chip/filter/row/preview-save 结构。
8. 只有业务复合组件留在 `features/codex-extensions/`，基础控件不重复造。

## 当前状态

- 业务文档：已重写
- 技术方案：已新增
- 设计稿：已重做并复验
- 实现：Web 预览切片已完成
- 已交付：
  1. `CodexWorkspace` 新增 `skills` / `mcp-servers`，侧边栏、hash 持久化与 Codex 页面路由已接入。
  2. `frontend/src/components/ui/ToggleSwitch.tsx` 抽为通用组件，并复用到账号列表和 Codex 功能开关。
  3. `frontend/src/features/codex-extensions/` 提供浏览器可运行的 Skills / MCP 预览页面。
  4. `frontend/src/features/codex-extensions/model.test.mjs` 覆盖 front matter 剥离、Git schema 解析、MCP 参数/env 解析与 change preview。
  5. 冒烟验证已归档到本 space 的 `screenshots/20260512/codex-extensions/`。
  6. Skills 详情已按用户确认改为 modal/detail layer：主视图只保留列表、筛选、Git source 输入和行操作，点击整行后覆盖打开预览层，`SKILL.md` 使用 `react-markdown` + `rehype-sanitize` 安全渲染。
  7. MCP server 编辑已按用户确认改为独立 modal：主视图只保留 MCP 列表、筛选、搜索和 config.toml 编辑入口，点击 server 行后覆盖打开单 server 编辑器。
  8. `internal/wailsapp/codex_extensions.go` 已提供真实读取/写回基础能力，`codex_extensions_test.go` 覆盖 Skills roots 扫描、Skill override 写回、Git schema 解析、MCP section 读取、per-tool approval 嵌套 section 过滤和单 server patch。
  9. Wails root App 与 `frontend/wailsjs` 已更新，前端现在在桌面环境优先读取真实 Codex 配置，浏览器无 Wails runtime 时继续使用 preview data。
- 下一步：
  1. 后端实现 Git managed skill cache、manifest、install/update/rollback。
  2. 补 MCP inline table / plugin MCP 配置读取策略，明确与 user `config.toml` section 型写回的边界。
  3. 补自建 GitLab allowlist 配置入口。
  4. 真实 Wails 窗口验收后补桌面截图。
