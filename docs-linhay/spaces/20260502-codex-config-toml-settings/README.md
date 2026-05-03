# Codex 本地 config.toml 快捷配置

## 背景
GetTokens 已经在状态页支持把本地 relay service 的 `apiKey / baseURL / model / provider` 一键应用到本机 Codex，并会写入 `~/.codex/auth.json` 与 `~/.codex/config.toml`。

一期范围已收窄为 Codex `[features]` 下的 bool feature 开关快捷配置。现有能力仍偏向“接入 GetTokens relay 的一次性应用”，用户缺少一个更直接的入口：读取当前本机 `config.toml`，展示可配置的 bool feature，保存前预览差异，并在不破坏用户手写配置、注释、MCP、agents 等扩展段落的前提下落盘。

## 目标
1. 支持对 Codex 本地 `config.toml` 中 `[features]` bool 开关做快捷配置。
2. 将读取、预览、保存收敛到后端统一能力，避免前端拼 TOML 或整文件覆盖。
3. 保存时只修改 `[features]` 下用户本次操作的 bool 键，保留未知字段、注释、换行风格和无关 section。
4. 给用户提供保存前的风险感知：目标路径、将修改的键、备份路径或恢复方式、错误原因。

## 范围
本期只覆盖 `~/.codex/config.toml` 的 `[features]` bool 配置：

- 读取 `[features]` 下已存在的 bool 键。
- 展示 Codex 当前源码 schema 支持的 bool feature key。
- 支持开关并保存用户明确修改的 bool key。
- 支持保存前 preview：新增、修改、未改、可能的 legacy alias 提示。
- 保留原文兜底：展示完整 TOML 原文或“打开配置文件”入口，但 v1 不做大而全的通用 TOML 编辑器。

## 非目标
1. 不管理 `auth.json` 中的 OAuth token 生命周期；`auth.json` 仍由现有“一键应用到本地”能力负责。
2. 不迁移历史 Codex session 的 `model_provider`。
3. 不修改 `model`、`model_provider`、`model_reasoning_effort`、provider、MCP server、agents role、profiles 等非 feature 配置。
4. 不将前端 localStorage 偏好伪装成 Codex 配置事实。
5. 不支持 `multi_agent_v2`、`apps_mcp_path_override` 这类 bool 或 object 双形态的复合 feature 配置；一期只做纯 bool key。

## 验收标准
- [x] 打开快捷配置入口时，能读取当前 `CODEX_HOME/config.toml`；未设置 `CODEX_HOME` 时默认指向 `~/.codex/config.toml`。
- [x] 用户能查看 Codex 当前支持的 `[features]` bool key，并能切换其中的 bool 值。
- [x] 保存前能看到最小 diff 摘要：新增、修改、未改的 feature key。
- [x] 保存后无关顶层键、注释、MCP section、agents section、未知 provider 字段保持不变。
- [x] 当现有 `config.toml` 语法明显无法安全 patch 时，停止写入并给出错误，不生成破坏性覆盖。
- [x] 新增 Go 单元测试覆盖 `[features]` 读取、diff、merge、异常输入、未知字段保留；前端测试覆盖开关派生状态、保存前校验与 Codex 二级路由迁移。
- [ ] 与现有“一键应用到本地 Codex 配置”共用后端保留式 TOML patch 工具，不出现两套写入规则。

说明：本期实现已经使用同一类“保留原文件、只 patch 受控字段”的写入语义，但尚未把既有 relay 一键应用链路重构到同一个 helper；该项保留为后续内部收敛任务。

## 设计稿入口

- 本期设计稿：[`design-preview.html`](design-preview.html)
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260502-codex-config-toml-settings`
- worktree：`../GetTokens-worktrees/20260502-codex-config-toml-settings/`

## 相关链接
- [一期 bool feature 实现方案](plans/20260502-codex-config-toml-settings-plan-v02.md)
- [早期完整配置草案](plans/20260502-codex-config-toml-settings-plan-v01.md)
- [relay service 配置边界](../../dev/20260426-relay-service-config-boundary.md)
- [Codex 参考源码](../../references/codex/)

## 当前状态
- 状态：implemented
- 最近更新：2026-05-03

## 实施结果
1. 后端新增 `GetCodexFeatureConfig`、`PreviewCodexFeatureConfig`、`SaveCodexFeatureConfig`，并通过根层 `main.App` wrapper 暴露到 Wails bindings。
2. 写入范围限定在 `CODEX_HOME/config.toml` 的 `[features]` bool key；保存只提交用户显式修改值，不 materialize 所有默认值。
3. 前端新增一级菜单 `Codex`，本期能力作为二级菜单 `Feature 配置` 进入；会话管理、OpenAI 状态和 Codex 用量也归入 `Codex` 下作为二级菜单，URL 为 `#frame=codex`、`#frame=codex&workspace=session-management`、`#frame=codex&workspace=vendor-status` 或 `#frame=codex&workspace=usage-codex`。
4. `Feature 配置` 页面使用全宽 `Codex Features` 表格工作区：每个 feature 独立一行，开关直接显示当前 ON/OFF 与默认 `true/false`。
5. 状态页不再承载本期配置面板；已移除该页顶部 4 个概览卡片，页面容器不再限制为居中窄画板。
6. 后端 feature definition 已补充 `description`，优先使用上游 experimental menu 文案和源码注释；legacy alias 自动显示 canonical key 提示，避免 UI 全部落到“暂无描述”兜底。
7. Gemini 用量入口暂不暴露，后续 Gemini 能力成型后再单独纳入导航。
8. 旧 `#frame=session-management`、`#frame=vendor-status`、`#frame=usage-desk` 路由和本地存储值保留兼容迁移，统一进入 `Codex` 对应二级项。
9. 实现截图：[`20260502-codex-config-codex-menu-after-v01.png`](screenshots/20260502/codex-config/20260502-codex-config-codex-menu-after-v01.png)。

## 验证记录
1. `go test ./...`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run test:unit`（212 项）
4. `npm --prefix frontend run build`
5. `docs-linhay/scripts/check-docs.sh`
6. `./scripts/wails-cli.sh build`
7. 构建产物 `build/bin/GetTokens.app/Contents/MacOS/GetTokens` 启动 smoke，通过后正常关闭。
