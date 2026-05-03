# OpenAI-Compatible Provider Verify Plan

## 背景

当前 GetTokens 的账号池已经明确升级为父级工作区，下面分 `codex` 与 `openai-compatible` 两个子菜单。
其中 `openai-compatible` 的正式能力不只是 provider CRUD，还包括“验证 provider 配置是否可用”。

这条链路当前在产品中尚不存在：

1. `Codex API Key` 只有资产管理，没有 verify/test
2. `GetCodexQuota` 复用的是 `auth-file + auth_index + wham/usage` 专用链路，不能承担通用 provider verify
3. 参考项目中的验证能力是 provider 级配置验证，不是单条账号卡片动作

## 本轮目标

交付第一阶段最小闭环：

1. 侧边栏 `账号池` 下支持二级子菜单：
   - `codex`
   - `openai-compatible`
2. `openai-compatible` 子菜单支持最小 provider 列表与新增/删除
3. `openai-compatible` provider 支持最小配置验证
4. 验证状态可在前端展示：`idle / loading / success / error`

## 范围

### 后端

- `internal/cliproxyapi/`
- `internal/wailsapp/`
- `app.go`

### 前端

- `frontend/src/components/biz/Sidebar.tsx`
- `frontend/src/App.tsx`
- `frontend/src/types.ts`
- `frontend/src/features/accounts/`

### 文档与测试

- `docs-linhay/spaces/account-pool/`
- `docs-linhay/spaces/20260427-deepseek-provider-support/`
- Go 单测
- 前端模型/状态单测

## 非目标

1. 本轮不做完整 AI Providers 后台
2. 本轮不补多 `apiKeyEntries`
3. 本轮不补 `headers` 可视化编辑
4. 本轮不补 `models` 列表编辑
5. 本轮不做 `codex api key` 过渡验证

## 设计收敛

### 1. 导航

- 仍保留主页面 `accounts`
- 在侧边栏内为 `accounts` 增加二级子菜单
- 第一阶段子菜单状态优先级：
  1. 当前会话显式切换
  2. 本地持久化
  3. 默认 `codex`

### 2. openai-compatible 对象模型

- 第一阶段使用独立 provider 列表模型
- 不进入现有 `AccountRecord` 主列表
- provider 最小字段：
  - `name`
  - `baseUrl`
  - `apiKey`
  - `prefix`

### 3. 验证接口

- 前端不直接调用 `/v0/management/api-call`
- 新增 Wails bridge，例如：
  - `VerifyOpenAICompatibleProvider(input)`
- Go 层负责：
  - 组装请求
  - 默认 endpoint 选择
  - 请求超时
  - 响应与错误归一化
  - debug record / 日志边界

### 4. 验证请求最小策略

- 第一阶段默认使用 OpenAI-compatible 的 `/chat/completions` 请求
- 最小入参：
  - `baseUrl`
  - `apiKey`
  - `headers?`
  - `model`
- 第一阶段不再尝试推断默认模型，前端必须显式提供最小测试模型

### 5. 前端状态

- 主状态：
  - `idle`
  - `loading`
  - `success`
  - `error`
- 附加信息：
  - `message`
  - `lastVerifiedAt`

## BDD

### 场景 1：进入 openai-compatible 子菜单

- Given 用户点击侧边栏 `账号池`
- When 用户选择 `openai-compatible`
- Then 页面进入 provider 列表视图
- And 不显示 codex 专属 quota / OAuth 动作

### 场景 2：新增 provider

- Given 当前位于 `openai-compatible`
- When 用户新增 provider 并填写 `name / baseUrl / apiKey / prefix`
- Then provider 出现在列表中
- And `name` 重复时保存失败并提示冲突

### 场景 3：验证 provider

- Given 当前位于 `openai-compatible`
- And 页面中已有 provider
- And 用户已填写测试模型
- When 用户点击验证
- Then 页面进入 `loading`
- And 验证完成后进入 `success` 或 `error`
- And `error` 需要展示失败原因

### 场景 4：删除 provider

- Given 当前位于 `openai-compatible`
- When 用户删除 provider
- Then 删除粒度是整个 provider

## 实施顺序

1. 先补 Go 类型、client 与 Wails bridge
2. 先补 Go 单测，验证 CRUD 与 verify 请求拼装
3. 再补前端子菜单与 provider 独立视图
4. 再补前端 verify 状态与交互
5. 最后补文案与文档回写

## 验证

最少需要通过：

1. `go test ./internal/cliproxyapi ./internal/wailsapp`
2. `cd frontend && npm run test:unit`
3. `cd frontend && npm run typecheck`

## 风险

1. 第一阶段已将 `model` 固定为显式必填；若后续要降级为可选，必须补可靠默认模型来源
2. 侧边栏二级导航会触及全局页面状态持久化，需要避免污染现有 `AppPage` 逻辑
3. 若直接在 `useAccountsPageState` 上继续堆逻辑，前端复杂度会快速失控，应优先拆独立 hook / model
