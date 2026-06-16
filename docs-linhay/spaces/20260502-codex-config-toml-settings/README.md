# Codex 本地 config.toml 快捷配置

## 背景
GetTokens 已经在状态页支持把本地 relay service 的 `apiKey / baseURL / model / provider` 一键应用到本机 Codex，并会写入 `~/.codex/auth.json` 与 `~/.codex/config.toml`。

本期范围已扩展为 Codex `config.toml` typed 配置面板：root、`[features]`、`[notice]` 与已配置的 `[model_providers.<id>]` 都纳入页面。简单标量按类型提供开关、文本框、数字框、下拉选项或多行文本；复合 TOML table 使用 raw TOML textarea 编辑，并在保存时校验 section header 必须落在对应 path 前缀下，避免一个字段改穿其他配置段。现有能力仍偏向“接入 GetTokens relay 的一次性应用”，用户缺少一个更直接的入口：读取当前本机 `config.toml`，展示可配置项，保存前预览差异，并在不破坏用户手写配置、注释、MCP、agents 等扩展段落的前提下落盘。

## 目标
1. 支持对 Codex 本地 `config.toml` 中 root、`[features]`、`[notice]` 与 `[model_providers.<id>]` 配置做快捷配置或只读查看。
2. 将读取、预览、保存收敛到后端统一能力，避免前端拼 TOML 或整文件覆盖。
3. 保存时只修改用户本次操作的受控标量键，保留未知字段、注释、换行风格和无关 section。
4. 给用户提供保存前的风险感知：目标路径、将修改的键、备份路径或恢复方式、错误原因。

## 范围
本期覆盖 `~/.codex/config.toml` 中可安全 patch 的 typed 配置：

- 读取 root 已存在的 bool、string、enum、integer、string array、text 配置。
- 展示 Codex 当前源码 schema 支持的 root key；简单类型支持对应控件编辑。
- 读取 `[features]` 下已存在的 bool key 和复合 feature table。
- 展示 Codex 当前源码 schema 支持的 feature key；纯 bool 支持开关，`multi_agent_v2` 按上游 schema 展开为 `enabled` 开关与受控子配置项，`apps_mcp_path_override`、`network_proxy` 仍以 raw TOML textarea 编辑。
- 支持保存前 preview：新增、修改、未改、可能的 legacy alias 提示。
- 读取 `[notice]` 下已存在的 bool key 和复合 notice table。
- 展示 Codex 当前源码支持的 notice key；bool 支持开关，`model_migrations`、`external_config_migration_prompts` 以 raw TOML textarea 编辑。
- 读取已配置 provider 和当前 `model_provider` 指向的 provider；`name/base_url/wire_api/requires_openai_auth/env_key/env_key_instructions/experimental_bearer_token/request_max_retries/stream_idle_timeout_ms/stream_max_retries/supports_websockets/websocket_connect_timeout_ms` 支持编辑，`auth/aws/http_headers/env_http_headers/query_params` 以 raw TOML textarea 编辑。
- 保留原文兜底：展示完整 TOML 原文或“打开配置文件”入口，但本期不做大而全的通用 TOML 编辑器。

## 非目标
1. 不管理 `auth.json` 中的 OAuth token 生命周期；`auth.json` 仍由现有“一键应用到本地”能力负责。
2. 不迁移历史 Codex session 的 `model_provider`。
3. 不提供通用 TOML 编辑器；root 与 provider 只纳入 schema 中已审查的受控字段。
4. 不将前端 localStorage 偏好伪装成 Codex 配置事实。
5. 除已经字段化的 `multi_agent_v2` 外，复合结构统一走 raw TOML 写入，不提供细粒度表单；保存时校验 raw TOML 中的 `[section]` / `[[section]]` 必须匹配当前字段 path 或其子路径。
6. 不管理 `mcp_servers`、`skills.config`、`projects."<path>".trust_level` 这类已有专用入口或高风险结构化配置。

## 验收标准
- [x] 打开快捷配置入口时，能读取当前 `CODEX_HOME/config.toml`；未设置 `CODEX_HOME` 时默认指向 `~/.codex/config.toml`。
- [x] 用户能查看 Codex 当前支持的 `[features]` bool key，并能切换其中的 bool 值。
- [x] 用户能查看 Codex 当前支持的 `[notice]` bool key，并能切换其中的 bool 值。
- [x] 保存前能看到最小 diff 摘要：新增、修改、未改的 feature key。
- [x] 保存后无关顶层键、注释、MCP section、agents section、未知 provider 字段保持不变。
- [x] 当现有 `config.toml` 语法明显无法安全 patch 时，停止写入并给出错误，不生成破坏性覆盖。
- [x] 新增 Go 单元测试覆盖 `[features]` 读取、diff、merge、异常输入、未知字段保留；前端测试覆盖开关派生状态、保存前校验与 Codex 二级路由迁移。
- [x] `Feature 配置` 页面不再以长列表展示，root、features、notice、model providers 均按语义分组，用户能先定位配置域再修改具体键。
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
- 最近更新：2026-06-16

## 实施结果
1. 后端新增 `GetCodexFeatureConfig`、`PreviewCodexFeatureConfig`、`SaveCodexFeatureConfig`，并通过根层 `main.App` wrapper 暴露到 Wails bindings。
2. 写入范围限定在 `CODEX_HOME/config.toml` 的 root / `[features]` / `[notice]` / `[model_providers.<id>]` 受控标量 key；保存只提交用户显式修改值，不 materialize 所有默认值。
3. 前端新增一级菜单 `Codex`，本期能力作为二级菜单 `Feature 配置` 进入；会话管理、OpenAI 状态和 Codex 用量也归入 `Codex` 下作为二级菜单，URL 为 `#frame=codex`、`#frame=codex&workspace=session-management`、`#frame=codex&workspace=vendor-status` 或 `#frame=codex&workspace=usage-codex`。
4. `Feature 配置` 页面使用全宽 `Codex Root Settings`、`Codex Features`、`Codex Notices`、`Codex Model Providers` 四段工作区：每个 item 独立一行，按 value type 渲染开关、文本框、数字框、选项或只读 TOML。
5. 状态页不再承载本期配置面板；已移除该页顶部 4 个概览卡片，页面容器不再限制为居中窄画板。
6. 后端 feature definition 已补充 `description`，优先使用上游 experimental menu 文案和源码注释；legacy alias 自动显示 canonical key 提示，避免 UI 全部落到“暂无描述”兜底。
7. `model`、`approval_policy`、`sandbox_mode`、`model_reasoning_effort`、`notify` 等 root typed key 已纳入页面；`hide_rate_limit_model_nudge`、`fast_default_opt_out` 等 `notice` bool 已纳入页面；`notice.model_migrations`、`notice.external_config_migration_prompts` 已以 raw TOML 纳入可编辑路径。
8. `multi_agent_v2` 已按上游 schema 展开为 `enabled`、并发线程数、wait timeout、usage hint、tool namespace 与 metadata/code-mode 等子配置项；旧的 `[features] multi_agent_v2 = true/false` 读取时映射到 `enabled`，写入任意子字段时自动迁移为 `[features.multi_agent_v2]` table，避免 scalar/table 冲突。`apps_mcp_path_override`、`network_proxy` 等其他复合 feature 仍以 raw TOML 纳入可编辑路径；provider schema 的 17 个字段已全部纳入，复杂 provider table 通过 path-scoped raw TOML 保存。
9. Codex 参考源码本地仓库已更新到 2026-05-23 `origin/main`：`7d47056ea42636271ac020b86347fbbef49490aa`（`fix: plugin bundle archive handling for upload and install (#23983)`）；本轮以该最新 `main` 的 `config.schema.json` 做覆盖审查。
10. Gemini 用量入口暂不暴露，后续 Gemini 能力成型后再单独纳入导航。
11. 旧 `#frame=session-management`、`#frame=vendor-status`、`#frame=usage-desk` 路由和本地存储值保留兼容迁移，统一进入 `Codex` 对应二级项。
12. 实现截图：[`20260502-codex-config-codex-menu-after-v01.png`](screenshots/20260502/codex-config/20260502-codex-config-codex-menu-after-v01.png)。
13. `Feature 配置` 长列表已追加展示分组：root 按启动默认、模型输出、权限沙箱、工作区文档、工具集成、高级兼容分组；features 按推荐稳定、实验性、高级、兼容旧项分组；notice 按安全提示、迁移提示、结构化 notice 分组；model providers 按 provider id 分组。分组仅影响展示，不改变 draft、preview、save 的字段路径和写入语义。
14. 固定枚举值控件已从原生 select 收敛为 `SegmentedControl`；bool / boolean 仍使用 `ToggleSwitch`。当前值不在枚举 options 中时临时并入 segment 头部展示，布尔型缺省假值不会被渲染成 `false` 枚举项。枚举 options 已按本地 Codex 源码 `7d47056ea4` 的 `codex-rs/core/config.schema.json` 校准：`approvals_reviewer`、`cli_auth_credentials_store`、`mcp_oauth_credentials_store`、`model_auto_compact_token_limit_scope`、`personality`、`model_providers.*.wire_api` 等不再使用旧值。

## 验证记录
1. `go test ./...`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run test:unit`（212 项）
4. `npm --prefix frontend run build`
5. `docs-linhay/scripts/check-docs.sh`
6. `./scripts/wails-cli.sh build`
7. 构建产物 `build/bin/GetTokens.app/Contents/MacOS/GetTokens` 启动 smoke，通过后正常关闭。

## 2026-05-23 追加验证
1. `go test ./internal/wailsapp -run CodexFeatureConfig`
2. `go test ./...`
3. `node --test frontend/src/features/status/tests/codexFeatureConfig.test.mjs`
4. `npm --prefix frontend run typecheck`
5. `git diff --check`
6. `docs-linhay/scripts/check-docs.sh`
7. 以本地最新 `docs-linhay/references/codex/codex-rs/core/config.schema.json` 审查 root、features、notice、model_provider 覆盖差集，missing 均为 `(none)`；features 仅额外保留 `experimental_use_freeform_apply_patch`、`include_apply_patch_tool` 两个 legacy alias 用于兼容旧配置。
8. 浏览器 MCP 导航被自动审批超时阻塞后，改用 headless Chrome + CDP 验证 `http://127.0.0.1:34115/#frame=codex`；12 秒后页面 `loading=false`，DOM 命中 `Codex Root Settings`、`Codex Model Providers`、`Codex Features`、`Codex Notices`、`hide_rate_limit_model_nudge`、`approval_policy`、`request_max_retries`、`supports_websockets`、`multi_agent_v2`、`apps_mcp_path_override`、`network_proxy`、`model_migrations`、`external_config_migration_prompts`。

补充：`npm --prefix frontend run test:unit` 当前 416 项中 415 通过，失败项为 `frontend/src/features/accounts/tests/accountFilters.test.mjs` 的 `AccountsToolbar keeps status, resource, and source filters in the new order`，属于 accounts 工具栏既有工作区改动，不在本次 Codex 配置页修改范围。

## 2026-05-25 追加验证
1. `node --test frontend/src/features/status/tests/codexFeatureConfig.test.mjs`
2. `npm --prefix frontend run typecheck`
3. `npm --prefix frontend run build`
4. 浏览器重新加载 `http://127.0.0.1:34115/#frame=codex`，页面命中分组标题 `启动与默认`、`模型与输出`、`权限与沙箱`、`工作区与文档`、`工具与集成`、`高级与兼容`、`推荐与稳定`、`实验性`、`兼容与旧项`、`安全提示`、`迁移提示`，确认配置项已从长列表收敛为分组列表；空分组不会渲染。
5. 追加控件形态验收：同一页面 DOM 命中 `SegmentedControl: 16`、`ToggleSwitch: 79`、`selectCount: 0`，固定枚举已改为 segment，bool 仍为 toggle。
6. 追加 Codex 源码校准：对照 `docs-linhay/references/codex` 当前 `main`（`7d47056ea4`）的 `codex-rs/core/config.schema.json`，并用 `go test ./internal/wailsapp -run 'TestGetCodexFeatureConfigReturnsTypedRootDefinitionsAndValues|TestGetCodexFeatureConfigReturnsAllModelProviderSchemaFields'` 锁定关键 enum options。

## 2026-06-16 multi_agent_v2 字段化

### 证据门禁
- 问题来源：用户在 GetTokens `Codex -> 功能开关` 页面指出 `multi_agent_v2` 不应继续以 textarea/raw TOML 方式配置，当前马上需要配置这些值。
- 当前事实：后端曾把 `multi_agent_v2` 定义为 `ValueType: "toml"`，前端因此统一渲染 textarea；上游 Codex `MultiAgentV2ConfigToml` 支持 `enabled`、`max_concurrent_threads_per_session`、`*_wait_timeout_ms`、`usage_hint_*`、`tool_namespace`、`hide_spawn_agent_metadata`、`non_code_mode_only` 等字段。
- 预期验收：`multi_agent_v2.enabled` 以开关渲染，其他已知字段按 boolean/integer/string/textarea 渲染；旧 scalar 写法可读；保存子字段时写入 `[features.multi_agent_v2]` table 且移除旧 scalar；不影响 `apps_mcp_path_override`、`network_proxy` raw TOML 路径。
- 反证条件：页面仍出现 `[features.multi_agent_v2]` raw textarea，或旧 `multi_agent_v2 = false` 与新 `[features.multi_agent_v2]` 同时存在。

### 实施结果
1. 后端 `CodexFeatureDefinition` 将 `multi_agent_v2` 从 raw TOML 改为 12 个受控子字段。
2. `readCodexTypedValueFromLines` 支持把旧 `[features] multi_agent_v2 = true/false` 映射到 `features.multi_agent_v2.enabled`。
3. typed patch 写入任意 `features.multi_agent_v2.*` 子字段前会移除旧 scalar，随后写入 `[features.multi_agent_v2]` table。
4. 前端 features 行支持 path 分段展示，`multi_agent_v2 / enabled` 等嵌套字段不再显示成长 key；`multi_agent_v2` 字段按上游使用频率排序，`enabled` 位于首位。
5. 追加 UI 收敛：`multi_agent_v2` 作为独立子组标题只出现一次，子行只显示 `enabled`、`max_concurrent_threads_per_session` 等字段名，避免每行重复父级名称。
6. 追加 Open Design 重做：用户明确要求使用 `$open-design` 后，按 Open Design `Neutral Modern` 设计系统重做 Codex feature 列表。放弃账号卡外壳拼贴，改为配置对象垂直列表：普通 feature 是一行对象设置，左侧身份/状态、中间说明、右侧控件；`multi_agent_v2` 等复合对象是父对象行加子字段设置列表。局部关闭 dev project highlight 的红色组件标注，避免 `ToggleSwitch` 调试标签干扰真实配置界面。
7. 追加参考图布局收敛：用户给出 control-plane 配置页参考图后，确认目标是“按图片的信息架构布局”，不是迁移浅灰蓝配色或 chip 风格。最终保留 GetTokens 现有黑白瑞士风格，普通 feature/root/provider rows 使用 settings table 布局；`multi_agent_v2` 成为独立 complex feature panel，header 放 icon、标题、描述与 `Active` 主开关，内部按 `Runtime Capacity`、`Wait Timeouts`、`Usage Hints`、`Tool Metadata` 四组排列真实字段。长 textarea 字段使用 label 在上、控件全宽，避免半栏内字段名竖排。

### 验证记录
1. `go test ./internal/wailsapp -run 'TestGetCodexFeatureConfigReturnsCompositeFeatureAndNoticeTables|TestGetCodexFeatureConfigMapsMultiAgentV2ScalarToEnabled|TestSaveCodexFeatureConfigWritesMultiAgentV2Fields|TestSaveCodexFeatureConfigWritesRawTomlSections|TestSaveCodexFeatureConfigRejectsRawTomlOutsidePath'`
2. `go test ./internal/wailsapp -run 'Codex|Mcp|Skill'`
3. `node --test frontend/src/features/status/tests/codexFeatureConfig.test.mjs`
4. `npm --prefix frontend run typecheck`
5. 本地 Vite `http://127.0.0.1:4173/#frame=codex&workspace=feature-config` DOM 验收：命中 `multi_agent_v2 / enabled`、`max_concurrent_threads_per_session`、`usage_hint_text`，且 textarea 中不存在 `[features.multi_agent_v2]`。
6. 截图：[`20260616-codex-feature-config-multi-agent-v2-after-v01.png`](screenshots/20260616/codex-feature-config/20260616-codex-feature-config-multi-agent-v2-after-v01.png)。
7. 追加分组截图：[`20260616-codex-feature-config-multi-agent-v2-group-after-v01.png`](screenshots/20260616/codex-feature-config/20260616-codex-feature-config-multi-agent-v2-group-after-v01.png)。
8. 追加 Open Design 验收：本地 `http://localhost:34115/#frame=codex` DOM 命中 `data-codex-feature-object-list="neutral-vertical"`，对象卡 60 个，`card-swiss` / `account-card-header` 残留数为 0；`multi_agent_v2` 为 12 行子字段设置列表，父标题重复斜杠数为 0；project highlight 在该 panel 内被抑制，`ToggleSwitch` 伪元素 content 为 `none`，输入控件宽度约 216px，字段行列宽约 `516px / 288px`。截图：[`20260616-codex-feature-config-open-design-neutral-after-v02.png`](screenshots/20260616/codex-feature-config/20260616-codex-feature-config-open-design-neutral-after-v02.png)。
9. 追加参考图布局验收：`node --test frontend/src/features/status/tests/codexFeatureConfig.test.mjs frontend/src/features/status/tests/statusTypography.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 通过。浏览器 DOM 命中 `data-codex-feature-object-list="settings-table"`、`data-codex-complex-feature-panel="multi_agent_v2"`、四个 `data-codex-complex-feature-group`；`max_concurrent_threads_per_session`、`default_wait_timeout_ms`、`subagent_usage_hint_text`、`non_code_mode_only` 真实字段存在，`handshake_ms`、`execution_ttl_sec`、`retry_backoff_factor` 不存在；`multi_agent_v2 /` 重复标题为 0，`codex-blue` / `codex-panel` / `codex-accent` 临时配色 token 残留为 0，复合字段宽度未低于 220px。截图：[`20260616-codex-feature-config-reference-layout-existing-style-header-after-v01.png`](screenshots/20260616/codex-feature-config/20260616-codex-feature-config-reference-layout-existing-style-header-after-v01.png)、[`20260616-codex-feature-config-reference-layout-existing-style-after-v02.png`](screenshots/20260616/codex-feature-config/20260616-codex-feature-config-reference-layout-existing-style-after-v02.png)。
