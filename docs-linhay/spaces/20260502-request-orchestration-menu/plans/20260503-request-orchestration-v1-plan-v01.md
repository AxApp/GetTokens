# 请求编排 V1 实施计划 v01

## 目标
在**不修改 CLIProxyAPI 原生策略语义**的前提下，为 GetTokens 新增一个独立的 `请求编排` 菜单与泳道工作台，并交付第一版可落地能力：

1. 展示并编辑 `请求入口 -> 账号组 -> 账号代理 -> 出口` 四段泳道。
2. 为每个账号补充 `支持的 CLI` 与 `模型映射` 的 APP 层编排元数据。
3. 通过 `现有 routing 配置 + 账号禁用/恢复` 实现“唯一 provider / 唯一账号组”模式。
4. 为编排应用提供 `apply / restore` 闭环，避免破坏用户原始 sidecar 状态。

## 约束与判断

### 1. 不改 CLIProxyAPI 原生策略
当前 sidecar 已暴露的 routing 可控面只有：

- `strategy`
- `session-affinity`
- `session-affinity-ttl`
- `request-retry`
- `max-retry-credentials`
- `max-retry-interval`

对应实现见：

- `internal/wailsapp/routing_config.go`

因此 V1 不新增 sidecar 原生 `unique-provider` 或类似枚举。

### 2. “唯一 provider”按 APP 层编排翻译
V1 中“唯一 provider / 唯一账号组”不是 sidecar 自己理解的新策略，而是 GetTokens 在 APP 层把编排意图翻译成：

1. 保留现有 routing strategy。
2. 仅启用目标组内账号 / provider。
3. 临时禁用其他账号 / provider。
4. 恢复时按快照回滚。

### 3. `支持的 CLI` 与 `模型映射` 先做 APP-owned overlay
现有统一账号模型没有 `supportedCli`、`modelMappings`、`proxyMode` 等字段，因此 V1 不直接把这些字段硬塞回现有 `AccountRecord` 真源，而是：

1. 在 Wails 层新增请求编排配置模型。
2. 持久化到 GetTokens 自己的本地数据目录。
3. 用于页面兼容性判断、出口预览和 apply 决策。

### 4. 账号代理分两阶段
V1 页面可以展示和编辑账号代理编排语义，但真实 apply 先只保证：

- 唯一组 / 唯一 provider 生效
- routing 配置生效

账号级代理写回 sidecar 的统一落地，延后到 V1.1。

## 分层设计

## 一、前端层

### 新增页面与 feature
- `frontend/src/pages/RequestOrchestrationPage.tsx`
- `frontend/src/features/request-orchestration/RequestOrchestrationFeature.tsx`
- `frontend/src/features/request-orchestration/components/*`
- `frontend/src/features/request-orchestration/model/*`
- `frontend/src/features/request-orchestration/tests/*`

### 需要接入的现有壳层
- `frontend/src/types.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/biz/Sidebar.tsx`
- `frontend/src/utils/pagePersistence.ts`
- `frontend/src/hooks/useAppNavigation.ts`

### 前端职责
1. 渲染四段泳道。
2. 展示当前编排快照与入口/出口摘要。
3. 编辑 APP 编排配置草稿。
4. 展示账号兼容性判断：
   - 是否支持当前 CLI
   - 是否存在入口模型映射
   - 是否因唯一组模式被排除
5. 提供 `应用编排` 与 `恢复默认编排` 动作。

## 二、Wails / APP 后端层

### 建议新增接口
```go
type RequestOrchestrationConfig struct {}
type RequestOrchestrationSnapshot struct {}
type ApplyRequestOrchestrationResult struct {}

func (a *App) GetRequestOrchestrationConfig() (*RequestOrchestrationConfig, error)
func (a *App) SaveRequestOrchestrationConfig(input RequestOrchestrationConfig) (*RequestOrchestrationConfig, error)
func (a *App) GetRequestOrchestrationSnapshot() (*RequestOrchestrationSnapshot, error)
func (a *App) ApplyRequestOrchestration() (*ApplyRequestOrchestrationResult, error)
func (a *App) RestoreRequestOrchestration() (*ApplyRequestOrchestrationResult, error)
```

### Wails 层职责
1. 聚合现有账号、provider、relay routing、auth-file 模型列表。
2. 读取 / 保存请求编排配置。
3. 计算兼容性与出口预览。
4. 执行 apply / restore。
5. 保存运行时快照。

### 配置落盘位置
建议新增目录：

- `~/.config/gettokens-data/request-orchestration/config.json`
- `~/.config/gettokens-data/request-orchestration/runtime-snapshot.json`

持久化方式对齐当前项目已有的本地设置模式，不仅依赖前端 localStorage。

## 三、CLIProxyAPI / sidecar 层

V1 不改。

只复用已有能力：
1. relay routing config
2. auth-file disabled
3. codex api key disabled
4. openai-compatible provider disabled

## V1 配置模型建议

```json
{
  "entry": {
    "cliContext": "codex",
    "model": "gpt-5.5",
    "routingStrategy": "round-robin",
    "sessionAffinity": true
  },
  "activeGroupMode": {
    "type": "all",
    "groupId": ""
  },
  "groups": [
    { "id": "codex", "label": "Codex 组" },
    { "id": "openai-compatible", "label": "OpenAI-Compatible 组" }
  ],
  "accountOverrides": {
    "auth-file:demo": {
      "supportedCli": ["codex"],
      "modelMappings": [
        {
          "entryModel": "gpt-5.5",
          "targetModel": "gpt-5.4-mini",
          "alias": "GPT 5.4 Mini"
        }
      ],
      "proxyMode": "inherit",
      "proxyRef": ""
    }
  }
}
```

## APP-only 与 apply-to-sidecar 的边界

### 只存在 APP 的字段
1. `entry.cliContext`
2. `activeGroupMode`
3. `accountOverrides.supportedCli`
4. `accountOverrides.modelMappings`
5. `accountOverrides.proxyMode`
6. 页面兼容性判断与出口预览结果

### 真正 apply 到 sidecar 的字段
1. routing strategy
2. session affinity
3. retry 相关配置
4. 账号 / provider 的 disabled 状态

## apply / restore 机制

### Apply
1. 读取当前 routing config。
2. 读取当前账号与 provider 的 disabled 状态。
3. 保存 runtime snapshot。
4. 根据当前 `activeGroupMode` 计算目标参与集合。
5. 更新 routing config。
6. 仅保留目标集合启用，禁用其他集合。
7. 返回差异摘要与结果。

### Restore
1. 读取 runtime snapshot。
2. 恢复 routing config。
3. 恢复各账号 / provider 原始 disabled 状态。
4. 清除当前已应用编排状态。

## 数据聚合策略

### 1. 账号真源
现有真源分散：

- auth-file
- codex api key
- openai-compatible provider

V1 不建议前端直接拼装三套数据，而是由 Wails 提供编排快照 DTO。

### 2. 模型来源
优先级建议：
1. openai-compatible provider 已配置 `models[]`
2. codex api key 已配置 `models[]`
3. auth-file 的 `GetAuthFileModels`
4. relay 模型聚合结果，仅作辅助补全

### 3. CLI 支持集合
默认推断策略：
1. auth-file：依据 provider / auth_mode 推断默认 CLI 倾向
2. codex api key：默认支持 `codex`
3. openai-compatible provider：默认支持 `openai-compatible`

之后允许用户在请求编排页中覆盖。

## 任务拆分

### 阶段 1：页面壳与路由接入
1. 新增 `请求编排` 一级菜单。
2. 新增页面壳与 hash / storage 持久化。
3. 新增页面空态与 preview 数据。

### 阶段 2：Wails 配置与快照存储
1. 定义请求编排配置结构。
2. 定义 runtime snapshot 结构。
3. 新增读写本地 JSON 的 Wails 接口。
4. 补充对应 Go 测试。

### 阶段 3：编排快照 DTO
1. 聚合 auth-file、codex key、openai-compatible provider。
2. 输出账号组、账号行、入口、出口预览所需 DTO。
3. 加入 CLI 兼容性与模型映射缺失标记。

### 阶段 4：apply / restore
1. 读取当前 sidecar routing config。
2. 生成并保存 snapshot。
3. 执行唯一组模式的启停切换。
4. 恢复默认编排。
5. 补充 Go 测试。

### 阶段 5：前端泳道工作台
1. 请求入口泳道
2. 账号组泳道
3. 账号代理泳道
4. 出口泳道
5. apply / restore 反馈与最近变更摘要
6. 前端 model / selector / interaction 测试

## V1 明确不做
1. 不新增 CLIProxyAPI 原生 routing strategy。
2. 不实现请求级动态分流。
3. 不保证账号级代理在所有账号类型上都真实写回 sidecar。
4. 不在本轮打通 Gemini CLI 的本地配置写回。
5. 不把代理池 CRUD 搬进本页。

## BDD 验收

### 场景 1：菜单与页面壳
- Given 用户进入主界面
- When 用户点击 `请求编排`
- Then 应进入独立一级页面
- And 页面以四段泳道展示主结构

### 场景 2：保存 APP 编排配置
- Given 用户修改某个账号的 `支持 CLI` 或 `模型映射`
- When 用户点击保存配置
- Then 配置应写入 GetTokens 本地 orchestration store
- And 不要求 sidecar 当前运行状态立即变化

### 场景 3：应用唯一组模式
- Given 用户选择某个账号组为唯一活跃组
- When 用户点击 `应用编排`
- Then Wails 应保存 snapshot
- And 仅保留目标组参与 sidecar 运行

### 场景 4：恢复默认编排
- Given 用户此前已经应用唯一组模式
- When 用户点击 `恢复默认编排`
- Then 原始 routing 与 disabled 状态应恢复

### 场景 5：兼容性提示
- Given 当前入口 CLI 或模型与某个账号不兼容
- When 页面刷新编排结果
- Then 该账号必须被标记为不可参与出口
- And 原因应明确为 `CLI 不兼容` 或 `缺少模型映射`

## 风险与后续

### 风险 1
通过“禁用其他账号”实现唯一组，本质是**配置级切换**，不是请求级动态策略。页面文案必须明确，避免用户误解。

### 风险 2
auth-file 的模型来源能力弱于 openai-compatible / codex key，模型映射在不同账号类型上的真实度不一致，V1 需要明确“预览优先”的边界。

### 风险 3
若未来要支持“同一 sidecar 同时处理多入口、多策略并存”，最终仍需要 CLIProxyAPI 原生支持编排语义。

## 当前建议
按 V1 推进时，先把“配置持久化 + 快照回滚 + 唯一组 apply”做扎实，再补复杂的账号代理真实落地。不要在一期里把 sidecar 变成新的编排 DSL。
