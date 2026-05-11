# cc-switch 业务覆盖路线

## 背景

本 space 保存 2026-05-05 对照 `cc-switch` 后形成的后续路线判断。`cc-switch` 是多 CLI provider / MCP / Prompts / Skills / 代理 / 用量 / 同步的一体化配置管理器；GetTokens 当前主线是账号池、quota、sidecar relay、请求编排和 Codex 工作台。

本轮结论不是“照搬 cc-switch”，而是识别哪些能力值得纳入 GetTokens 的 token/account/workbench 定位，哪些能力应延后或明确不做。

## 目标

1. 保存 cc-switch 业务覆盖差异，作为后续 backlog。
2. 明确 GetTokens 应该优先补的方向：
   - provider 级测试配置
   - 真实请求编排落地
   - 请求日志与成本账
   - MCP / Prompts / Skills 的最小工作台
3. 明确不应优先投入的方向：
   - 全 CLI provider switcher
   - WebDAV / 云同步
   - 系统托盘轻量模式
   - Deep Link 全家桶
   - 大一统 SQLite SSOT

## 范围

### P0：核心闭环

- Provider/card 级测试配置：模型、prompt、timeout、结果日志、失败原因。
- 请求编排接真实后端配置：入口、账号组、账号、代理出口、测试结果与应用动作要能闭环。
- 请求日志与成本账：记录请求走过的账号、出口、模型、token、成本、错误和耗时。

### P1：工作台扩展

- MCP / Prompts / Skills 最小工作台：优先服务 Codex / Claude Code 高使用频动作。
- 资产写入必须保持 preservative patch，不覆盖用户未知字段。
- 先做本地可验证闭环，再考虑跨应用同步。

### P2：平台化能力

- WebDAV / 备份 / 多端同步。
- 系统托盘与轻量后台切换。
- Deep Link 导入。
- 跨 Claude Code / Codex / Gemini CLI / OpenCode / OpenClaw / Hermes 的完整 provider 管理。

## 非目标

1. 不把 GetTokens 改造成 cc-switch 的复制品。
2. 不在本期创建 worktree 或进入实现。
3. 不承诺全 CLI 覆盖。
4. 不把 sidecar truth、本地配置文件、API key store 和 auth files 强行合并成单一 SQLite 真源。
5. 不为了功能完整度牺牲请求编排和账号池的可理解性。

## 验收标准

后续重新启动本 space 时，应先确认：

1. 需求仍符合 GetTokens 的账号池 / relay / workbench 定位。
2. P0 任一子项都有 BDD 场景与失败测试。
3. 新增 UI 遵循现有 Swiss-industrial 体系，并优先降低信息架构复杂度。
4. 涉及本地文件写入时，必须保留未知字段、注释和用户已有配置。
5. 涉及 sidecar / CLIProxyAPI 时，必须有自动化测试和真实 Wails 验收。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260505-cc-switch-coverage-roadmap`
- worktree：`../GetTokens-worktrees/20260505-cc-switch-coverage-roadmap/`

## 相关链接

- 参考项目：`docs-linhay/references/cc-switch/`
- cc-switch README：`docs-linhay/references/cc-switch/README_ZH.md`
- 记忆：`docs-linhay/memory/2026-05-05.md`
- 已有关联空间：`docs-linhay/spaces/20260502-request-orchestration-menu/`
- 已有关联空间：`docs-linhay/spaces/20260502-claude-code-api-key-mode/`

## 当前状态
- 状态：parked
- 最近更新：2026-05-05
