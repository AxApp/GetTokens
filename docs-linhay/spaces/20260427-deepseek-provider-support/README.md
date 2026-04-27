# DeepSeek 与其他厂商接入评估

## 背景
用户希望确认 GetTokens 当前是否已经支持添加 `DeepSeek` 账号，或者至少明确“还能接入多少其他厂商”。
这个问题必须拆成两层：

1. `GetTokens` 产品层当前是否已经暴露出可用的账号接入入口。
2. 仓库内依赖的 `CLIProxyAPI` / 参考 sidecar 本身理论上能承载哪些 provider / executor。

## 目标
1. 明确当前产品层能否直接添加 `DeepSeek` 账号。
2. 明确当前产品层已经做成闭环的账号类型有哪些。
3. 明确底层参考 sidecar 可扩展到哪些厂商通道，避免把“底层可配”误判成“产品已支持”。
4. 为后续是否扩展“通用 API Key 厂商接入”提供需求边界。

## 范围
- `internal/wailsapp/accounts.go`
- `internal/wailsapp/oauth.go`
- `internal/wailsapp/codex_api_key_store.go`
- `internal/accounts/account_records.go`
- `frontend/src/features/accounts/hooks/useAccountsActions.ts`
- `frontend/src/locales/zh.json`
- `internal/cliproxyapi/types.go`
- `docs-linhay/references/CLIProxyAPI/config.example.yaml`
- `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/`

## 非目标
- 本轮不直接实现 DeepSeek 接入
- 本轮不承诺参考 `CLIProxyAPI` 中所有 provider 都会进入 GetTokens 首批产品范围
- 本轮不照搬参考项目的完整 AI Providers 后台
- 本轮不把 `openai-compatible` 降级为新的单条 `DeepSeek API Key` 特例

## 验收标准
- 能明确回答“现在能不能添加 DeepSeek 账号”
- 能区分“产品已支持”和“底层参考工程可承载”
- 能列出当前产品层已经闭环的账号类型
- 能给出底层参考 sidecar 已出现的 provider / executor 家族清单
- 能输出后续若要支持 DeepSeek 的最小实现边界

## 相关链接
- [账号池 Space](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/account-pool/README.md)
- [accounts.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/accounts.go)
- [oauth.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/wailsapp/oauth.go)
- [account_records.go](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/accounts/account_records.go)
- [useAccountsActions.ts](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/features/accounts/hooks/useAccountsActions.ts)
- [CLIProxyAPI config.example.yaml](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/CLIProxyAPI/config.example.yaml)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-27

## 完全体需求补充

在账号池信息架构升级后，`openai-compatible` 不再只是一个“未来可讨论”的技术槽位，而是 `账号池` 父级下的正式子菜单之一：

1. 左侧点击 `账号池`
2. 在 `账号池` 下展开：
   - `codex`
   - `openai-compatible`
3. `openai-compatible` 子菜单承接 provider 级对象管理

这意味着本 space 的定位也从“能不能支持”升级为“如何在产品内以完整心智接入”。

## 当前结论

### 结论 1：现在不能把 DeepSeek 当成 GetTokens 已支持的“可添加账号”

当前产品层没有 `CreateDeepSeekAPIKey`、`ListDeepSeekAPIKeys`、`PutDeepSeekAPIKeys` 这一类实现，账号池里唯一做成闭环的 API Key 录入入口是 `Codex API Key`：

- 后端只暴露了 `CreateCodexAPIKey / DeleteCodexAPIKey / UpdateCodexAPIKeyPriority`
- 本地持久化目录固定是 `~/.config/gettokens-data/codex-api-keys/`
- 前端动作和文案也只存在 `Add Codex API Key`

因此，如果现在问“GetTokens 支不支持直接添加 DeepSeek 账号”，答案是：

- `不支持产品级直接添加`
- `也没有 DeepSeek 的专用 UI、存储、Wails 绑定和回写链路`

### 结论 2：当前产品层已闭环的账号类型非常有限

当前账号池可以展示两类资产：

1. `auth-file`
2. `api-key`

但真正做成产品闭环的能力只有：

1. `codex` / ChatGPT OAuth auth-file 登录与回填
2. `Codex API Key` 的新增、删除、优先级管理

其中 `auth-file` 在展示层是相对通用的，`provider` 可来自 sidecar 返回值；但 OAuth 登录、重新登录回填、额度遥测这些增强能力当前仍然明显绑定 `codex`。

### 结论 3：底层参考 sidecar 的可扩展范围明显大于 GetTokens 当前产品范围

在 `docs-linhay/references/CLIProxyAPI/internal/runtime/executor/` 中，当前已出现的执行器家族至少有：

1. `codex`
2. `claude`
3. `gemini`
4. `gemini-cli`
5. `vertex`
6. `kimi`
7. `aistudio`
8. `antigravity`
9. `openai-compatible`

其中 `DeepSeek` 没有在 GetTokens 主产品中作为独立账号类型出现，但在参考 sidecar 的 `openai-compatibility` 配置示例里，已经直接出现了 `deepseek-v3.1` 示例，说明它更接近：

- `通过 openai-compatible provider 接入的上游模型/厂商`
- `而不是当前产品里现成的一类 DeepSeek 账号资产`

### 结论 4：如果按“其他厂商接入能力”来问，需要区分两个口径

口径 A，`GetTokens 产品当前已支持`：

- 明确闭环的上游厂商能力基本只有 `Codex / ChatGPT`

口径 B，`仓库里的参考 sidecar 理论可承载`：

- 至少已有 `8` 个非单一 Codex 的执行器 / provider family 方向
- 其中 `openai-compatible` 还是一个扩展槽位，可以继续挂更多兼容 OpenAI 协议的厂商
- `DeepSeek` 属于这个扩展槽位中的候选，而不是现在已经打通的产品功能

## OpenAI-Compatible 最小产品边界

如果后续要把 DeepSeek 或其他 OpenAI 兼容厂商做成正式能力，最小实现边界至少包括：

1. 后端补齐 `openai-compatible` 的 Wails / management bridge，而不是只扩 `CodexAPIKey`
2. 前端从“添加 Codex API Key”升级为“新增 openai-compatible provider”
3. 顶层对象改为 provider 容器，而不是单个 API key 资产；第一阶段使用独立 provider 列表模型，不进入现有 `AccountRecord` 主列表
4. 第一阶段最少支持：
   - `name`
   - `baseUrl`
   - `apiKeyEntries[0].apiKey`
   - `prefix`
   - `name` 唯一性校验
   - 空状态与默认 CTA
   - provider 配置验证
5. 第二阶段再补：
   - `headers`
   - 多 `apiKeyEntries`
   - `models`
6. DeepSeek 作为 `openai-compatible` 下的 provider 候选，而不是先做专用 `DeepSeek API Key`

## Provider 验证边界

当前 GetTokens 里的 API Key 资产还没有被设计成“可验证 provider 配置”的正式链路：

1. `Codex API Key` 现状只有创建、删除、改优先级，没有 verify / test 接口
2. 现有外呼桥接主要服务 `codex auth-file quota`，依赖 `auth_index + chatgpt.com/backend-api/wham/usage`，不适合直接承担通用 API Key/provider 验证
3. 当前前端状态模型也没有“最近一次验证结果/失败原因”的展示位

因此，这个需求的正式归属应是：

1. `account-pool -> openai-compatible` 子菜单负责人
2. 验证对象是 provider 配置，而不是单条资产卡片

如果产品决定先在 `codex api key` 上补一个最小验证版本，应明确它只是过渡方案，不是最终信息架构。

### 最小验证入参与结果

最小后端验证入参建议至少包括：

1. `baseUrl`
2. `apiKey`
3. `headers(可选)`
4. `model(第一阶段显式必填)`

最小前端结果状态建议至少包括：

1. `idle`
2. `loading`
3. `success`
4. `error`

并且 `error` 需要保留最近一次失败原因，作为用户可见状态，而不是仅写调试日志。

## BDD 场景

### 场景 1：当前版本尝试添加 DeepSeek

- Given 用户打开账号池页面
- When 用户寻找 DeepSeek 账号录入入口
- Then 页面只会提供 `ChatGPT 登录`、`导入 Auth File`、`粘贴 Auth 内容`、`添加 Codex API Key`
- And 用户无法通过正式产品入口直接新增 DeepSeek 账号

### 场景 2：区分产品支持与底层可扩展

- Given 仓库中存在 `CLIProxyAPI` 参考实现
- When 开发者搜索 provider / executor
- Then 能看到多个执行器家族与 `openai-compatible` 配置槽位
- But 这些能力默认不能等同于 GetTokens 主产品已经支持

### 场景 3：未来支持 DeepSeek 的产品化边界

- Given 决定把 DeepSeek 纳入账号池正式能力
- When 开始实现
- Then 需要同时补齐后端 provider bridge、Wails 接口、前端 provider 入口、持久化方案与测试
- And DeepSeek 应优先以 `openai-compatible provider` 的形式进入产品
- And 不能只改 UI 文案或只依赖参考 sidecar 配置示例

### 场景 4：账号池子菜单中的 openai-compatible

- Given 用户点击左侧 `账号池`
- When 用户选择子菜单 `openai-compatible`
- Then 页面主体进入 openai-compatible provider 视图
- And 用户看到的对象应是 provider 容器
- And 页面不应继续显示只适用于 codex 的新增入口文案

### 场景 5：验证 provider 配置

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有 provider 容器
- When 用户触发验证
- Then 验证请求应基于 provider 配置发起，而不是复用 `codex quota` 请求
- And 页面应能展示最近一次验证状态与失败原因

### 场景 6：codex api key 的过渡验证边界

- Given 产品决定先在 `codex api key` 上补最小验证功能
- When 进入实现
- Then 必须把该功能标记为过渡方案
- And 后续正式的统一验证归属仍应回到 `openai-compatible provider` 工作区
