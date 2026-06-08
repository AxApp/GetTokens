# 第 7 轮：评估 + 修复

## 范围与边界

- 本报告属于 **第 7 轮：评估 + 修复**。
- 基线：延续第 6 轮报告列出的下一轮候选，基于当前工作树继续，不回退第 1/2/3/4/5/6 轮或其他 subagent 改动。
- 环境边界：仅修改仓库 dev 代码、前端 Wails UI 和本 space 文档；未触碰 `/Applications/GetTokens.app`，未 kill/restart 正式版进程，未修改 `/Users/linhey/.config/gettokens/` 正式数据目录。

## 候选复核与选择

### 本轮选中

1. **Skills 启停规则来源解释**
   - 原因：用户看到 Skill 是启用或禁用，但不知道来自默认行为、path rule 还是 name rule。
   - 低风险边界：只扩展 snapshot DTO 和详情 modal 展示，不改变 Skill 启停写入规则。
   - 边界说明：用户执行 enable 后移除 override 这个“动作历史”不会长期保存在 `config.toml` 中；下一次 snapshot 只能如实显示为 `默认启用`。即时保存提示仍保留“已移除 enabled=false 覆盖”。

2. **MCP tool approval 行级校验**
   - 原因：第 6 轮已提供 `tool=approval_mode` 入口，但没有限制 approval mode，非法值会进入结构化保存。
   - 低风险边界：沿用现有允许集合 `auto` / `prompt` / `approve`；空 approval mode 允许，语义是仅保留 tool section、不写 `approval_mode`。

### 本轮未选

- raw `config.toml` 完整 TOML AST/parser 化预检：当前仓库没有现成 TOML parser 依赖；第 6 轮只做轻量结构预检。完整 parser 化会引入依赖、错误映射和保存兼容策略，属于较大技术方案。
- MCP raw TOML 多行 AST patch：第 5 轮已做 warning；真正 patch 多行数组/map 需要 AST 或非常窄的文本 patch 边界，仍属于较大技术方案。

## 红灯测试

本轮先补测试并确认失败：

- `TestCodexSkillEnabledStateReportsRuleSource`
  - 要求 path rule、name rule、default enabled 三类来源可被准确报告。
  - 红灯表现：旧实现只有 `codexSkillEnabled` bool，没有来源状态函数。
- `TestSaveCodexMcpServerRejectsInvalidToolApprovalMode`
  - 要求后端拒绝 `approval_mode = "always"` 这类非法值。
  - 红灯表现：旧保存链路没有校验 `server.Tools[*].ApprovalMode`。
- `validateMcpToolRows rejects unsupported approval modes while allowing empty mode`
  - 要求前端允许空值、`auto`、`prompt`、`approve`，拒绝其他值。
  - 红灯表现：旧模型没有 `validateMcpToolRows`。

## 本轮修复清单

### 1. Skills 启停来源展示

- 新增 `codexSkillEnabledState`：
  - 默认：`default_enabled`
  - 命中 `[[skills.config]] name = ...`：`name_rule`
  - 命中 `[[skills.config]] path = ...`：`path_rule`
  - 多条规则仍按既有顺序覆盖语义，最终命中的规则就是来源。
- `CodexSkillRecord` 新增：
  - `enabledSource`
  - `enabledSourceValue`
- 前端 adapter 映射新增字段。
- Skill 详情 modal 新增 `启停来源` 元信息，展示默认启用、path rule 或 name rule 及匹配值。

### 2. MCP tool approval 行级校验

- 后端 `validateCodexMcpServer` 校验每个 tool approval mode：
  - 允许：空、`auto`、`prompt`、`approve`
  - 拒绝：其他值，并返回 `tool approval_mode ...` 错误。
- 前端新增 `validateMcpToolRows`。
- MCP server editor 保存区新增非法 tool approval mode 提示，并在有错误时禁用保存。
- 文案明确：留空表示只保留 tool section，不写 `approval_mode`。

## 变更文件

- `internal/wailsapp/codex_extensions.go`
- `internal/wailsapp/codex_extensions_types.go`
- `internal/wailsapp/codex_extensions_test.go`
- `frontend/src/features/codex-extensions/SkillsModals.tsx`
- `frontend/src/features/codex-extensions/McpModals.tsx`
- `frontend/src/features/codex-extensions/adapters.ts`
- `frontend/src/features/codex-extensions/model.ts`
- `frontend/src/features/codex-extensions/model.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
- `frontend/wailsjs/go/models.ts`
- `docs-linhay/spaces/20260608-subagent-project-experience/plans/evaluation-and-fixes-round-7.md`
- `docs-linhay/memory/2026-06-08.md`

## 验证命令

已通过：

```bash
go test ./internal/wailsapp -run 'TestCodexSkillEnabledStateReportsRuleSource|TestGetCodexSkillsSnapshotAppliesNameSkillConfigSelector|TestCodexSkillConfigRulesApplyInOrderAndNormalizePath|TestSaveCodexMcpServerRejectsInvalidToolApprovalMode|TestSaveCodexMcpServerPatchesToolApprovalSections'
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-extensions/adapters.test.mjs src/features/codex-extensions/featureSource.test.mjs
cd frontend && npm run typecheck
docs-linhay/scripts/check-docs.sh
```

说明：

- 未启动 Wails dev app 做桌面点击验收；本轮行为由 Go focused tests、Node model/source tests 和 typecheck 覆盖。
- `enable 后移除 override` 的历史动作不写入持久状态，因此 snapshot 展示为 `默认启用`。这是配置事实边界，不是本轮漏实现。

## 下一轮候选判断

本轮结束后，暂时 **无低风险可继续修改候选**。

剩余项判断：

1. raw `config.toml` 完整 TOML AST/parser 化预检：需要引入或选择 TOML parser、设计错误映射和兼容策略，属于较大技术方案。
2. MCP raw TOML 多行 AST patch：需要 AST patch 或严格限定文本 patch 边界，属于较大技术方案。
3. route probe sidecar endpoint、usage reconciliation、SQLite busy 治理、request diagnostics index：均涉及运行态接口或 sidecar 热路径，应先定接口边界和失败测试，不适合本轮低风险继续。
