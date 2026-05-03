# Codex 本地 config.toml 快捷配置方案草案 v01

## 需求边界
用户目标不是再复制一段 `config.toml` snippet，而是在 GetTokens 内直接、快速、可回滚地修改本机 Codex 的 `config.toml`。

本期应把它定义为“本地 Codex 配置工作台”：

1. 事实源是磁盘上的 `CODEX_HOME/config.toml`，默认 `~/.codex/config.toml`。
2. 前端只编辑结构化 draft，不直接拼接或写入 TOML。
3. 后端提供读取、预览 diff、保存三类能力，并复用现有保留式 patch 语义。
4. 未覆盖的字段与 section 必须原样保留；无法证明安全时宁可拒绝写入。

## BDD 场景
### 场景 1：首次快捷配置
Given 用户没有 `~/.codex/config.toml`
When 用户选择 relay endpoint、model、reasoning effort 与 provider 并保存
Then 系统创建 `config.toml`
And 写入受控字段
And 返回目标路径与保存结果

### 场景 2：保留用户已有配置
Given 用户已有 `config.toml`，其中包含 `approval_policy`、`[mcp_servers.docs]`、注释和未知字段
When 用户只修改 `model` 与 `model_reasoning_effort`
Then 保存结果只改变这两个键
And 原注释、MCP section、未知字段和换行风格保持不变

### 场景 3：修改 provider
Given 用户已有 `[model_providers.gettokens]`
When 用户修改 provider `base_url` 和 `wire_api`
Then 系统在原 section 内更新受控键
And 保留该 provider section 中未知键，例如 `env_key`

### 场景 4：保存前预览
Given 用户改动了多个快捷配置项
When 用户点击保存前预览
Then UI 展示目标路径、受控键 diff、是否会新建文件、是否会创建备份
And 不展示 API key 明文

### 场景 5：异常配置保护
Given 现有 `config.toml` 存在无法安全解析或定位的结构
When 用户保存
Then 后端拒绝写入
And UI 展示错误与手动打开文件入口

## 产品入口
优先入口放在状态页现有“应用到本地”区域附近，但不要把它塞进同一个按钮语义里。

建议拆成两个动作：

1. `应用 relay 接入配置`：沿用现有能力，写 `auth.json` + relay 相关 `config.toml` 字段。
2. `编辑 Codex 本地配置`：打开快捷配置抽屉或 modal，只负责 `config.toml`。

UI 结构建议：

1. 顶部显示 `CODEX_HOME`、`config.toml` 路径和文件状态。
2. `模型与 provider` 分区：model、reasoning effort、verbosity、provider、base URL、wire API。
3. `执行策略` 分区：approval policy、sandbox mode、web search。
4. `保存前预览` 分区：diff 摘要、受控字段列表、备份提示。
5. `高级入口`：复制当前 TOML、打开文件、刷新磁盘内容。

## 后端接口草案
在 `internal/wailsapp` 新增或扩展本地 Codex 配置服务，接口建议：

```go
type CodexLocalConfigSnapshot struct {
    CodexHomePath string
    ConfigPath    string
    Exists        bool
    Raw           string
    Draft         CodexLocalConfigDraft
    Providers     []LocalCodexModelProvider
    Warnings      []string
}

type CodexLocalConfigDraft struct {
    Model                string
    ModelProvider        string
    ModelReasoningEffort string
    ModelVerbosity       string
    ApprovalPolicy       string
    SandboxMode          string
    WebSearch            *bool
    Provider             CodexLocalProviderDraft
}

type CodexLocalConfigPreview struct {
    ConfigPath string
    WillCreate bool
    Changes    []CodexLocalConfigChange
    Preview    string
    Warnings   []string
}
```

Wails 方法：

1. `GetCodexLocalConfig()`：读取磁盘、解析受控字段、返回 snapshot。
2. `PreviewCodexLocalConfig(input)`：基于当前磁盘内容重新 read-modify，返回 preview 和 change list。
3. `SaveCodexLocalConfig(input)`：再次读取最新磁盘内容，执行同一 patch，原子写入。

关键点：`Preview` 和 `Save` 都必须基于保存时的最新文件内容计算，不能让前端旧快照覆盖后端新内容。

## 写入策略
现有 `relay_local_apply.go` 已有 `mergeRelayCodexConfigToml`、`upsertRootTomlKey`、`upsertTomlSectionKey` 等保留式工具。本期应先把这些能力抽成更通用的 `codex_config_toml` 内部模块，再让现有 relay apply 与新快捷配置共用同一套 patch 函数。

受控字段分为三类：

1. 顶层字符串：`model`、`model_provider`、`model_reasoning_effort`、`model_verbosity`、`approval_policy`、`sandbox_mode`。
2. 顶层布尔：`web_search`。
3. provider section：`name`、`base_url`、`requires_openai_auth`、`wire_api`。

安全边界：

1. 不删除未知字段。
2. 不重排已有键。
3. 不重渲染整份 TOML。
4. 保留 CRLF / LF。
5. 保留行尾注释。
6. 对 TOML 字符串统一使用安全 quote。
7. 保存前可创建 `config.toml.gettokens-backup-YYYYMMDDHHMMSS`，但备份策略需要在实现前定稿。

## 与现有能力的关系
当前状态页已经具备：

1. relay service API key 管理。
2. endpoint 选择。
3. model catalog 聚合。
4. provider catalog 读取本地 `[model_providers.*]`。
5. `ApplyRelayServiceConfigToLocal` 保留式写入 `auth.json` 和 `config.toml`。

新能力不应替代这些已有功能，而是把 `config.toml` 的结构化读写正式产品化。`ApplyRelayServiceConfigToLocal` 后续可以内部调用同一个 `SaveCodexLocalConfig` patch 层，减少重复规则。

## TDD 计划
### Go 红灯测试
1. 空文件生成默认受控字段。
2. 保留已有顶层键顺序、注释和未知 section。
3. provider section 局部更新并保留未知字段。
4. CRLF 文件保存后仍使用 CRLF。
5. 布尔字段 `web_search` 能正确写入与更新。
6. preview change list 能区分 `added / modified / unchanged`。
7. 异常输入拒绝写入：空 provider id、非法 base URL、无法安全定位的 section。

### 前端红灯测试
1. snapshot 到 draft 的初始化。
2. draft 校验：provider id、base URL、model 必填策略。
3. preview changes 的展示排序和敏感值脱敏。
4. 保存中、保存成功、保存失败状态。

## 实施顺序
1. 先补 `space` 验收标准和本方案文档。
2. 抽出 Go 侧 TOML patch helper，并让现有 `relay_local_apply_test.go` 保持通过。
3. 新增 `Get / Preview / Save` 三个 Wails 后端方法与单元测试。
4. 前端新增快捷配置状态模型和测试。
5. 在状态页接入 modal 或抽屉，复用现有 model/provider catalog。
6. 跑 Go、前端单元测试、typecheck。
7. 若 UI 进入实现，补浏览器或 Wails 窗口截图到本 space。

## 风险
1. Codex 上游字段变化快，v1 只能承诺本期受控字段。
2. 简易 TOML patch 工具不是完整 TOML parser；必须避免“看起来能解析全部 TOML”的错觉。
3. 并发写入仍有窗口期；若后续出现多入口同时写，应参考 Nolon 的单一路径锁方案，增加进程内锁和 `.lock` 文件。
4. `auth.json` 与 `config.toml` 的职责要保持分离，否则会再次混淆“账号凭据”和“Codex 行为配置”。

## 暂定结论
本期推荐做“结构化快捷配置 + 原文兜底 + 最小 diff + 保留式保存”，不做完整高级 TOML 编辑器。这样能解决用户的高频配置诉求，同时把破坏本地 Codex 配置的风险控制在可测试范围内。
