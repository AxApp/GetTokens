# 2026-05-17 Codex Preserve ChatGPT Provider Mode Design

## Building
本期设计一个新的本地 Codex 一键配置模式：在 GetTokens 状态页继续复用现有 relay key、endpoint、model 工作台，但允许用户在不覆盖本地 ChatGPT 登录态的前提下，把主对话请求切到第三方 OpenAI-compatible provider。目标不是再造一套全新页面，而是在现有 `StatusFeature` 的本地应用工作流上新增“auth strategy”分支，并把前端预检、差异预览、后端校验与原子写入统一起来。

## Not Building
1. 不自动帮用户完成 ChatGPT 登录；仍复用现有 OAuth / auth-file 资产流程。
2. 不把内置 `openai` provider 改造成可配置 bearer token provider。
3. 不对第三方 provider 做在线可用性担保或探活。
4. 不在本期引入新的独立 Codex 设置页。
5. 不改造 sidecar、账号池、quota 路由本身。

## 方案选型
### 方案 A：在现有状态页本地应用面板中新增“保留 ChatGPT 登录态”模式
- 摘要：保留当前入口，新增模式选择、预检与新的后端 apply/preview DTO。
- 成本：中
- 风险：低到中
- 复用：`StatusFeature`、`relayLocalState.ts`、`ApplyRelayServiceConfigToLocal`、本地 provider 目录读取

### 方案 B：单独做一个 Codex 高级配置页
- 摘要：在 `#frame=codex` 下新建专门工作区，状态页只保留旧模式。
- 成本：中到高
- 风险：中
- 复用：现有 Codex 导航、feature config 工作区结构

### 方案 C：继续沿用旧 API，只在后端偷偷分支
- 摘要：前端不显式暴露新模式，只靠 provider 选择和隐含规则切换。
- 成本：低
- 风险：高
- 复用：最多，但语义极不透明

## 推荐方案
推荐方案 A。

理由：
1. 这个能力本质上仍属于“把当前 relay 工作台配置应用到本地 CLI”，放在状态页最符合用户路径。
2. 与方案 B 相比，不需要拆新页面、迁移路由或重复建模 provider / endpoint 选择器。
3. 与方案 C 相比，模式是显式的，风险提示和失败条件可以讲清楚，不会把“保留 ChatGPT 登录态”做成隐藏副作用。

## 攻击面校验
### Dependency failure
如果第三方 provider 宕机，新模式不会破坏本地 ChatGPT token 资产；回退成本仅限于重新切回旧模式或其他 provider。

### Scale explosion
本能力只写本地 `CODEX_HOME` 配置，不引入服务端扩容问题；最容易失控的是前端状态复杂度，因此必须避免新增第二套页面。

### Rollback cost
若方向错误，可直接回退到旧模式：
1. 重新应用 `replace_auth_with_apikey`
2. 或手工切回其他 provider
不涉及数据库迁移和服务端状态回滚。

### Premise collapse
最脆弱的前提是“内置 `openai` provider 可被用户配置覆盖”。这个前提是假的，因此设计必须显式禁止在新模式里使用 `providerID = openai`。

## 关键决策
### 1. 保留状态页入口，不新建独立配置页
因为用户当前心智是“选择 relay key / endpoint / model 并应用到本地 CLI”，新模式仍然是这条链路的分支，而不是另一种产品对象。

### 2. 新增显式 `authStrategy`
后端和前端都不再用隐式条件判断模式，而是统一为：
1. `replace_auth_with_apikey`
2. `preserve_chatgpt_auth`

旧的 positional Wails API 不继续承载新语义；新增 object-based preview/apply API，旧 API 保留兼容期。

### 3. `preserve_chatgpt_auth` 模式只允许自定义 provider id
不能使用 `openai`，因为上游 Codex 内置 provider 合并规则是：

```text
built_in_model_providers()
-> for (key, provider) in cfg.model_providers { entry(key).or_insert(provider) }
```

这意味着用户配置无法覆盖内置 `openai`。因此新模式必须要求自定义 provider id，例如 `relay-chatgpt-preserve`、`my-proxy`。

### 4. v1 默认不改写现有 ChatGPT auth.json 结构
推荐策略是：
1. 读取并校验 `auth.json`
2. 若当前 auth 不是 ChatGPT，则报错
3. 若是 ChatGPT，则默认保留原文件内容不动

不在 v1 顺手把 `OPENAI_API_KEY` 清成 `null`，避免对刷新 token、`last_refresh`、外部 auth token 结构造成不必要扰动。

### 5. 新模式的 bearer token 来源仍是当前选中的 relay key
虽然最终写入 `experimental_bearer_token`，但用户心智不变：仍然是在当前状态页从 relay key 列表中挑一条“作为本次本地 CLI 的上游 bearer token”。

## 前端设计
### 入口
保留 `frontend/src/features/status/StatusFeature.tsx` 的 `StatusApplyLocalSection`，在 Codex 本地应用卡片新增：
1. 模式切换器
2. 前置状态提示
3. 模式相关的 diff 预览

### 交互字段
新增或重构字段：
1. `authStrategy`
2. `localCodexAuthState`
3. `preserveModeWarnings`
4. `providerCompatibility`

其中 `providerCompatibility` 至少区分：
1. `compatible`
2. `blocked_builtin_openai`
3. `missing_chatgpt_auth`

### 交互规则
1. 默认模式保持现有 `replace_auth_with_apikey`，避免无声行为变化。
2. 切到 `preserve_chatgpt_auth` 时：
   - 若本地 auth 非 ChatGPT，显示阻断态
   - 若 provider id 为 `openai`，显示阻断态
   - 若 provider id 合法，显示说明：
     - 主对话请求将走第三方 bearer token
     - ChatGPT 账号态仍保留用于部分附属能力
3. diff 预览中：
   - 旧模式继续显示 `auth.json` 被改成 `apikey`
   - 新模式应显示 `auth.json` 为 preserved，重点展示 `config.toml` 新增的 provider section

### 文案重点
必须避免误导用户：
1. 不写“官方支持”
2. 不写“所有插件完美兼容”
3. 应写成“保留 ChatGPT 登录态，同时将主请求切到第三方 provider”

### 前端测试
至少覆盖：
1. 模式切换后的 diff 差异
2. `openai` provider 在新模式下被禁用
3. 无 ChatGPT auth 时的阻断提示
4. 兼容旧模式的默认行为不变

## 后端设计
### API 形态
新增结构化 Wails API，而不是继续扩展 positional 参数：

1. `GetLocalCodexAuthState()`
2. `PreviewRelayServiceConfigToLocal(input)`
3. `ApplyRelayServiceConfigToLocalV2(input)`

其中 `input` 建议包含：
1. `apiKey`
2. `baseURL`
3. `model`
4. `reasoningEffort`
5. `providerID`
6. `providerName`
7. `supportsWebsockets`
8. `authStrategy`

### 新的本地 auth 读取 DTO
建议返回：
1. `authMode`: `none | apikey | chatgpt | chatgpt_auth_tokens | unknown`
2. `hasAuthFile`
3. `hasOpenAIAPIKey`
4. `hasTokens`
5. `accountEmail`
6. `planType`
7. `warnings`

### Apply 规则
#### 模式 1：`replace_auth_with_apikey`
沿用当前逻辑，行为基本不变。

补充约束：
1. 若历史 provider section 里残留 `experimental_bearer_token`，旧模式应用时必须清掉，避免其继续抢占请求鉴权优先级。

#### 模式 2：`preserve_chatgpt_auth`
1. 读取 `auth.json`
2. 若不存在、JSON 非法或当前 auth 不是 ChatGPT，则报错
3. 若 `providerID == "openai"`，报错
4. 仅 patch `config.toml`：
   - `model`
   - `model_reasoning_effort`
   - `model_provider`
   - `[model_providers.<providerID>]`
   - `name`
   - `base_url`
   - `experimental_bearer_token`
   - `requires_openai_auth = true`
   - `wire_api = "responses"`
   - `supports_websockets = true`（如适用）
5. 若历史 provider section 里残留 `env_key`，必须清掉，避免其继续压过 `experimental_bearer_token`
6. `auth.json` 保持原样

### Preview 规则
preview 逻辑与 apply 共用同一套判定：
1. 能 apply 的输入必须能 preview
2. 被阻断的输入在 preview 阶段就返回错误或 warning
3. preview 结果里要明确区分：
   - `auth.json preserved`
   - `config.toml updated`

### 与现有 helper 的关系
当前 `buildRelayCodexAuthJSON` / `mergeRelayCodexConfigToml` 需要拆分为：
1. auth strategy 无关的 config patch helper
2. `apikey` 专属 auth patch helper
3. `chatgpt preserve` 专属 preflight helper

避免继续把“写 auth.json”与“写 config.toml”硬绑死。

### 后端测试
至少覆盖：
1. preserve 模式下 `auth.json` 原文不变
2. preserve 模式下写入 `experimental_bearer_token`
3. preserve 模式下 `providerID = openai` 被拒绝
4. preserve 模式下缺失 ChatGPT auth 被拒绝
5. 旧模式回归不变

## 数据流
```text
StatusFeature
  -> GetLocalCodexAuthState
  -> buildCodexLocalApplyDiff(input)   # frontend local preview
  -> ApplyRelayServiceConfigToLocalV2(input)
       -> read CODEX_HOME/auth.json
       -> validate authStrategy + providerID
       -> patch CODEX_HOME/config.toml
       -> optionally patch auth.json (only old mode)
       -> return paths / warnings / summaries
```

### v1 实施落点
1. 后端已落地：
   - `GetLocalCodexAuthState`
   - `ApplyRelayServiceConfigToLocalV2`
2. 前端已落地：
   - 状态页 `authStrategy` 切换
   - preserve 模式前置阻断
   - 本地 diff 预览切换为 `auth.json preserved` / `experimental_bearer_token`
3. 暂缓项：
   - 单独的后端 `PreviewRelayServiceConfigToLocal` API 暂不实现，v1 先复用前端纯函数预览。

## 实施阶段
### Phase 1
文档与 DTO 设计定稿。

### Phase 2
后端引入结构化 preview/apply API 和本地 auth 读取能力。

### Phase 3
前端状态页新增模式切换、预检提示与 diff 重构。

### Phase 4
跑 Go 单测、前端单测、文档索引写回。

## Unknowns
1. 是否需要在 v1 就提供“自动打开 ChatGPT 登录入口”的快捷跳转。
   - 当前决定：不做，避免把状态页和账号池登录流程耦合得更深。
   - Owner：后续实现阶段若用户明确要求，再单独扩展。
2. preserve 模式是否要主动把遗留 `OPENAI_API_KEY` 清成 `null`。
   - 当前决定：不做，优先保守保留现有 auth 文件。
   - Owner：实现阶段如发现上游对遗留 key 有副作用，再补二期治理。
