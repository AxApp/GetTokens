# Codex 本地 typed config 快捷配置方案 v02

## 本轮调整
一期范围从“完整 `config.toml` 快捷配置”收窄为“只支持 `[features]` 下的 bool feature 配置”，后续又补入 `[notice]` 下的 bool 提示开关。

2026-05-23 继续扩展：本页不再限定 bool。root、`[features]`、`[notice]`、`[model_providers.<id>]` 均按上游 `config.schema.json` 纳入；简单类型使用合适控件编辑，复合 TOML table 使用 raw TOML textarea 编辑，并在保存时做 path-scoped section header 校验。

参考源码已归档到 `docs-linhay/references/codex/`，当前对应官方 `openai/codex` main 最新 HEAD：

- commit：`7d47056ea42636271ac020b86347fbbef49490aa`
- 时间：`2026-05-22T19:31:39-07:00`
- 提交：`fix: plugin bundle archive handling for upload and install (#23983)`
- 关键文件：
  - `codex-rs/core/src/config/edit.rs`
  - `codex-rs/core/src/config/types.rs`
  - `codex-rs/tui/src/chatwidget.rs`
  - `codex-rs/tui/src/status/snapshots/codex_tui__status__tests__status_snapshot_shows_refreshing_limits_notice.snap`

## 需求边界
本期从最初 bool feature 扩展为 typed config 面板，覆盖 `config.toml` 中可安全 patch 的标量配置：

```toml
[features]
multi_agent = true
tool_search = true
goals = false
```

不处理：

1. `[mcp_servers.*]`。
2. `[agents]`、`[profiles.*]`、`[projects.*]` 等复杂 section 的结构化写入。
3. `multi_agent_v2`、`apps_mcp_path_override`、`network_proxy` 这类可写成 bool 或 object 的复合 feature 写入。
4. `[notice].model_migrations`、`[notice].external_config_migration_prompts` 这类 map / nested table 写入。
5. provider `auth/aws/http_headers/env_http_headers/query_params` 这类复合 table 写入。

说明：上述复合项现在进入页面，并通过 raw TOML textarea 保存；保存时只允许写入对应 path 或子 path 的 section。

## 上游配置形态
Codex 当前源码中 `[features]` 的 schema 有三类：

1. 纯 bool feature：schema 中 `type = boolean`，支持开关编辑。
2. 复合 feature：`multi_agent_v2`、`apps_mcp_path_override`、`network_proxy`，既可以是 bool，也可以是带 `enabled` 的对象；当前支持 raw TOML 编辑，section header 必须位于对应 feature path 下。
3. legacy alias：schema 仍接受，但源码会提示优先使用 canonical key；一期只读可识别，写入时建议转成 canonical key。

## UI 策略
建议用一个独立的“Codex Features”配置面板，不混入 relay 一键应用区。

列表分组：

1. 推荐：`Stable` 与 `Experimental`。
2. 高级：`UnderDevelopment`，默认折叠，并显示风险提示。
3. 兼容：`Deprecated` 与 `Removed`，默认隐藏；只有读取到用户本地已有配置时展示，避免鼓励新增。
4. legacy alias：只做读取提示，不作为新增写入目标。

每一行显示：

- key
- 当前有效值
- 默认值
- 阶段：stable / experimental / under_development / deprecated / removed
- 来源：默认值 / 本地 config / profile（profile 支持本期可只标记“暂不编辑”）

控件选择：

- boolean：开关。
- enum：下拉选项。
- integer / number：数字输入框。
- string：文本框。
- string_array：多行文本，按行拆分。
- text / textarea：多行文本。
- toml / raw：多行 raw TOML；若内容以 section header 开头，保存时替换该 path 前缀下的 section block，否则按当前 path 写入 inline/raw 值。

## 后端接口草案
```go
type CodexFeatureDefinition struct {
    Key            string `json:"key"`
    Description    string `json:"description,omitempty"`
    Stage          string `json:"stage"`
    DefaultEnabled bool   `json:"defaultEnabled"`
    CanonicalKey   string `json:"canonicalKey,omitempty"`
    LegacyAlias    bool   `json:"legacyAlias,omitempty"`
}

type CodexFeatureConfigSnapshot struct {
    CodexHomePath string                  `json:"codexHomePath"`
    ConfigPath    string                  `json:"configPath"`
    Exists        bool                    `json:"exists"`
    Definitions   []CodexFeatureDefinition `json:"definitions"`
    Values        map[string]bool         `json:"values"`
    Raw           string                  `json:"raw"`
    Warnings      []string                `json:"warnings"`
}

type SaveCodexFeatureConfigInput struct {
    Values map[string]bool `json:"values"`
}

type CodexFeatureConfigPreview struct {
    ConfigPath string                     `json:"configPath"`
    WillCreate bool                       `json:"willCreate"`
    Changes    []CodexFeatureConfigChange `json:"changes"`
    Preview    string                     `json:"preview"`
    Warnings   []string                   `json:"warnings"`
}
```

Wails 方法：

1. `GetCodexFeatureConfig()`：读取 `CODEX_HOME/config.toml`，返回 definitions、已配置 values、raw。
2. `PreviewCodexFeatureConfig(input)`：基于最新磁盘内容计算 `[features]` / `[notice]` patch 和 diff。
3. `SaveCodexFeatureConfig(input)`：再次读取最新磁盘内容，执行同一 patch，原子写入。

## 写入规则
1. 只修改 root、`[features]`、`[notice]`、`[model_providers.<id>]` 中已审查的受控标量 key。
2. 只写用户明确修改的 key，不把所有默认值 materialize 到文件里。
3. 不写 legacy alias；如果用户本地存在 `collab = true`，保存时提示 canonical key 是 `multi_agent`，默认不自动迁移，除非用户明确确认。
4. 若 `[features]` 或 `[notice]` 不存在，按本次保存的 key 所属 section 追加新 section；根级 bool 写在第一个 TOML section 之前。
5. 若 key 已存在，原地更新并保留行尾注释。
6. 若 key 不存在，在对应 section 末尾追加。
7. 不删除未知 root / feature / notice key；未知 key 在 UI 中以“本地未知项”展示但不提供新增入口。
8. 保留 LF / CRLF。

## 当前 bool 配置项
来源：`codex-rs/core/config.schema.json` 与 `codex-rs/features/src/lib.rs`。

### Stable
默认开启：`shell_tool`、`unified_exec`（非 Windows）、`shell_snapshot`、`hooks`、`enable_request_compression`、`multi_agent`、`apps`、`tool_suggest`、`plugins`、`plugin_sharing`、`in_app_browser`、`browser_use`、`browser_use_external`、`computer_use`、`image_generation`、`skill_mcp_dependency_install`、`guardian_approval`、`tool_call_mcp_elicitation`、`personality`、`fast_mode`、`goals`、`workspace_dependencies`。

### Experimental
`terminal_resize_reflow` 默认开启。

默认关闭：`memories`、`external_migration`、`mentions_v2`、`prevent_idle_sleep`。

### UnderDevelopment
默认关闭：`shell_zsh_fork`、`code_mode`、`code_mode_only`、`runtime_metrics`、`chronicle`、`child_agents_md`、`apply_patch_streaming_events`、`exec_permission_approvals`、`request_permissions_tool`、`enable_fanout`、`enable_mcp_apps`、`tool_search_always_defer_mcp_tools`、`remote_plugin`、`default_mode_request_user_input`、`auth_elicitation`、`realtime_conversation`、`responses_websocket_response_processed`、`remote_compaction_v2`。

### Deprecated
默认关闭：`web_search_request`、`web_search_cached`、`use_legacy_landlock`。

### Removed
这些 key 为兼容旧配置而保留，不建议在 UI 新增：

默认开启：`sqlite`、`steer`、`collaboration_modes`、`tui_app_server`。

默认关闭：`undo`、`js_repl`、`js_repl_tools_only`、`codex_git_commit`、`apply_patch_freeform`、`tool_search`、`unavailable_dummy_tools`、`search_tool`、`use_linux_sandbox_bwrap`、`request_rule`、`experimental_windows_sandbox`、`elevated_windows_sandbox`、`remote_models`、`image_detail_original`、`plugin_hooks`、`skill_env_var_dependency_prompt`、`remote_control`、`workspace_owner_usage_nudge`、`responses_websockets`、`responses_websockets_v2`。

### Legacy Alias
schema 仍接受这些 bool key，但源码建议使用 canonical key：

- `codex_hooks` -> `hooks`
- `collab` -> `multi_agent`
- `connectors` -> `apps`
- `enable_experimental_windows_sandbox` -> `experimental_windows_sandbox`
- `experimental_use_freeform_apply_patch` -> `apply_patch_freeform`
- `experimental_use_unified_exec_tool` -> `unified_exec`
- `include_apply_patch_tool` -> `apply_patch_freeform`
- `memory_tool` -> `memories`
- `request_permissions` -> `exec_permission_approvals`
- `telepathy` -> `chronicle`
- `web_search` -> `web_search_request`

### 复合 feature，raw TOML
- `multi_agent_v2`
- `apps_mcp_path_override`
- `network_proxy`

补充：源码 registry 里还有 `artifact`，但当前 `config.schema.json` 的 `[features]` properties 中未暴露为 bool；一期不纳入 UI。

### Notice bool
当前纳入页面：`hide_full_access_warning`、`hide_world_writable_warning`、`fast_default_opt_out`、`hide_rate_limit_model_nudge`、`hide_gpt5_1_migration_prompt`、`hide_gpt-5.1-codex-max_migration_prompt`。

raw TOML：`notice.model_migrations`、`notice.external_config_migration_prompts`。它们是 map / nested table，当前走 path-scoped raw TOML 保存，后续可再做独立结构化编辑模型。

### Root bool
当前纳入页面：所有 schema 顶层 root key，除 `features`、`notice` 作为容器不作为可编辑项。bool 使用开关，string / enum / integer / string array / text 按类型编辑，复杂 section 以 raw TOML textarea 编辑。

已修复早期 key -> bool 保存入参带来的跨 section 歧义：新增 `changes[]`，按 `id/path/valueType/value` 写入。

### `[notice]` bool，一期纳入
- `hide_full_access_warning`
- `hide_world_writable_warning`
- `fast_default_opt_out`
- `hide_rate_limit_model_nudge`
- `hide_gpt5_1_migration_prompt`
- `hide_gpt-5.1-codex-max_migration_prompt`

### `[model_providers.<id>]`
当前纳入 17 个 schema 字段：

- 可编辑：`name`、`base_url`、`wire_api`、`requires_openai_auth`、`env_key`、`env_key_instructions`、`experimental_bearer_token`、`request_max_retries`、`stream_idle_timeout_ms`、`stream_max_retries`、`supports_websockets`、`websocket_connect_timeout_ms`
- raw TOML：`auth`、`aws`、`env_http_headers`、`http_headers`、`query_params`

## BDD 场景
### 场景 1：没有 `[features]`
Given 用户已有 `config.toml` 但没有 `[features]`
When 用户开启 `goals`
Then 保存后追加 `[features]`
And 写入 `goals = true`
And 其他 section 不变

### 场景 2：已有 feature 注释
Given 用户已有 `tool_search = true # app tools`
When 用户关闭 `tool_search`
Then 保存后该行变成 `tool_search = false # app tools`

### 场景 3：legacy alias
Given 用户已有 `collab = true`
When 打开功能面板
Then UI 显示该项是 legacy alias
And 提示 canonical key 是 `multi_agent`
And 默认保存不自动删除 `collab`

### 场景 4：复合 feature
Given 用户已有 `[features.multi_agent_v2] enabled = true`
When 打开功能面板
Then UI 显示 `multi_agent_v2` 为暂不支持编辑
And 保存其他 bool feature 时不改动该对象配置

### 场景 5：未知 feature
Given 用户已有 `future_feature = true`
When 保存 `goals = true`
Then `future_feature = true` 保留
And UI 标记为本地未知项

## TDD 计划
### Go
1. 读取空文件返回 definitions 和空 values。
2. 读取 `[features]` 中的 bool key。
3. 读取 legacy alias 并返回 warning / canonical 映射。
4. 更新已有 bool key 并保留行尾注释。
5. 新增 `[features]` section。
6. 在已有 `[features]` 末尾追加新 key，不影响后续 section。
7. 复合 feature table 原样保留。
8. 未知 key 原样保留。
9. CRLF 保留。
10. definitions 中的已知 key 均返回非空 description；legacy alias 返回 canonical key 提示。

### 前端
1. definitions 按 stage 分组。
2. deprecated / removed 默认隐藏，但本地已有值时展示。
3. legacy alias 显示 canonical 提示。
4. dirty state 与 preview changes 正确。
5. 保存失败不覆盖本地 draft。
6. 后端 `definitions[]` 形态中的 description 能进入表格行，不落到“暂无描述”兜底。

## 实施顺序
1. 抽出 TOML section patch helper，先覆盖 `[features]`。
2. 新增 Go 侧 feature definitions 常量或从嵌入 JSON 生成；一期先静态同步当前上游 key，后续再考虑自动生成。
3. 实现 `Get / Preview / Save`。
4. 前端接入状态页或设置页中的独立 Codex Features 面板。
5. 补单元测试、typecheck 和文档校验。

## 实施状态
已完成一期实现，落在一级菜单 `Codex` 下的二级菜单 `Feature 配置`。

实现收敛点：

1. 后端按本方案暴露 `GetCodexFeatureConfig`、`PreviewCodexFeatureConfig`、`SaveCodexFeatureConfig`。
2. 根层 `main.App` 已补 wrapper 和 DTO 映射，Wails bindings 已生成对应 TypeScript 方法与模型。
3. 前端保存入参只包含 dirty bool key；legacy alias、root bool、notice bool 和 removed 项按只读或兼容提示处理。
4. 表格 UI 已按最新设计反馈收敛为全宽工作区、独立行、矩形 switch，并从状态页迁移到 `Codex > Feature 配置`。
5. `test:unit` 已接入 `frontend/src/features/status/tests/codexFeatureConfig.test.mjs`，避免新增模型测试游离在标准回归外。
6. feature / notice definition 已补充 description 字段：experimental 项优先同步上游 `/experimental` menu description，其余项参考上游源码注释补齐；前端同步修复 `definitions[]` 归一化路径，避免表格统一显示“暂无描述”。
7. `Codex Root Settings` 与 `Codex Notices` 子区块已落地，`hide_agent_reasoning`、`hide_rate_limit_model_nudge`、`fast_default_opt_out` 等 root / notice bool 可直接切换，且 preview / save 只影响对应 section。
8. typed editor 已落地：root、features、notice、model providers 支持 boolean / enum / integer / string / string_array / text；复合 TOML table 以 path-scoped raw TOML textarea 编辑。
9. 以 2026-05-23 本地最新 `docs-linhay/references/codex/codex-rs/core/config.schema.json` 做差集审查，root、features、notice、model_provider missing 均为 `(none)`；features 仅额外保留 `experimental_use_freeform_apply_patch`、`include_apply_patch_tool` 两个 legacy alias。

保留后续项：

1. 既有 relay 一键应用链路尚未重构到同一个 `[features]` patch helper；当前只是保持同类保留式写入原则。
2. 后续若 Codex 上游 feature schema 频繁变化，应把静态 definitions 改为自动同步或生成。
3. 若 Codex upstream main 后续再次强制更新，先确认 `docs-linhay/references/codex` 无本地修改，再同步到新的 `origin/main` 并重新跑 schema 差集审查。
