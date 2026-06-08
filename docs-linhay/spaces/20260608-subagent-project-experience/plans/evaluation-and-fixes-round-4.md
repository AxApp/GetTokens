# 第 4 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 4 轮：评估 + 修复**。
- 基线：延续第 3 轮报告列出的下一轮候选，基于当前工作树继续，不回退第 1/2/3 轮或其他 subagent 改动。
- 环境边界：仅修改仓库 dev 代码与本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **MCP raw/结构化 editor dirty arbitration**
   - 原因：raw `config.toml` editor 与结构化 MCP server editor 可以同时存在，若 raw editor dirty 时继续打开或保存结构化 editor，容易覆盖用户未保存的 raw 内容。
   - 低风险边界：只增加前端状态门禁和提示，不改变 Wails 保存契约。

2. **MCP quoted server id 写回保护**
   - 原因：读取侧能解析 `[mcp_servers."linear.team"]`，但保存侧要求 server id 是 bare TOML key，且 section 查找使用 `[mcp_servers.<id>]`，对 quoted id 读写不对称。
   - 低风险边界：只放宽单段 TOML key 的写回格式化，继续拒绝空 id、NUL 和换行；不支持 server id 重命名。

### 本轮未选

- raw `config.toml` 保存前 TOML 预检与备份提示：需要 Go 侧 TOML parser、备份文件生成、返回 DTO 和保存失败语义，仍建议独立成后端/Wails 小步修复。
- Skills 启停规则来源解释：需要扩展 Skill record DTO、配置规则匹配记录和前端详情展示，范围比本轮两项更大。

## 红灯测试

本轮先补测试并确认失败：

- `internal/wailsapp/codex_extensions_test.go`
  - 新增 `TestSaveCodexMcpServerPatchesQuotedServerIDInPlace`，构造 `[mcp_servers."linear.team"]`、`.oauth` 和 `.tools.search`，保存后要求仍 patch 原 quoted section，不追加 `[mcp_servers.linear.team]`。
  - 红灯表现：旧实现返回 `mcp server id must be a bare TOML key`。
- `frontend/src/features/codex-extensions/featureSource.test.mjs`
  - 新增源码行为断言：存在 `isConfigEditorDirty`，raw dirty 时阻止结构化编辑/保存，并使用对应提示文案。
  - 红灯表现：旧实现没有 raw dirty 门禁。

## 本轮修复清单

### 1. MCP raw/结构化 dirty arbitration

- 新增 `isConfigEditorDirty = configEditor.content !== configEditor.originalContent`。
- raw editor dirty 时：
  - 阻止打开 MCP server editor。
  - 阻止保存当前结构化 draft。
  - 显示明确提示，要求先保存或关闭 raw editor。
- 结构化 draft 已有变更时：
  - 阻止打开 raw `config.toml` editor，避免两边并行编辑互相覆盖。
- 新增中英文提示文案。

### 2. MCP quoted server id 写回保护

- `SaveCodexMcpServer` 不再要求 server id 必须是 bare TOML key，改为要求非空且不含 NUL/换行。
- section header 统一通过 TOML key formatter 输出：
  - `linear` -> `[mcp_servers.linear]`
  - `linear.team` -> `[mcp_servers."linear.team"]`
- OAuth 与 tool nested section 同步使用同一格式化方式，避免 quoted id 的主 section 与 nested section 路径不一致。
- `formatMcpCurrentConfigToml` 也同步使用 quoted header，保证保存结果和预览一致。

## 变更文件

- `internal/wailsapp/codex_extensions.go`
- `internal/wailsapp/codex_extensions_test.go`
- `frontend/src/features/codex-extensions/CodexExtensionsFeature.tsx`
- `frontend/src/features/codex-extensions/featureSource.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-4.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
go test ./internal/wailsapp -run 'TestSaveCodexMcpServerPatchesQuotedServerIDInPlace|TestSaveCodexMcpServerPatchesTargetSectionOnly|TestSaveCodexMcpServerRejectsTransportConflict'
cd frontend && node --test src/features/codex-extensions/featureSource.test.mjs src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

说明：

- 未启动 Wails dev app 做桌面点击验收。本轮改动包含 Go 侧 raw config patch 逻辑和前端 editor 状态门禁，已用 focused Go/node tests 与 typecheck 覆盖。
- 未运行全量测试，沿用前几轮说明：本轮只运行匹配修复面的 focused tests，避免把无关既有失败混入判断。

## 下一轮候选判断

仍有可继续修改的下一轮候选：

1. raw `config.toml` 保存前 TOML 预检与备份提示。
2. Skills 启停规则来源解释。
3. MCP tool approval 结构化编辑保存链路。
4. MCP raw TOML 多行结构 warning 或 AST 级读取/patch 方案。

仍不建议直接进入的候选：route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index。这些属于较大技术方案，应先定接口边界和失败测试。
