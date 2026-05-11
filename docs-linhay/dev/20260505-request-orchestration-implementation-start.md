# 2026-05-05 Request Orchestration Implementation Start

## 背景

请求编排设计稿经历了画布、节点、泳道、四卡横向流程和路径优先单面板几轮收敛。用户最终反馈“四卡版仍然复杂”，因此本轮在开始真实前端施工前，先把稳定 UI 模式沉淀下来。

## 沉淀模式

复杂编排页不要优先增加卡片数量，而要先把信息架构降到两个层级：

1. 第一层只回答“当前请求会怎么走”。
   - 用一条路径摘要表达 `入口 -> 账号组 -> 账号 / 出口 -> 测试`。
   - 折叠态也只展示这条链路的压缩摘要和状态。
2. 第二层只保留用户必须操作的决策区。
   - `请求入口` 只选 CLI。
   - `账号` 先选组再选账号，代理池开关跟随账号。
   - `出口与测试` 只处理当前账号出口和连通性。

## 实现边界

本轮开始施工的第一步只落 APP 层工作台：

- 新增一级菜单 `请求编排`。
- 新增 `features/request-orchestration/`，把兼容性、账号选择、出口可见性和测试判定放到纯模型层。
- 页面先支持浏览器 preview 静态数据，同时在 Wails 环境下接入真实账号池数据。
- 真实账号来源：sidecar `ready` 后调用 `ListAuthFiles` 与 `ListAccounts`，复用账号池现有 `mapAuthFileToRecord` / `mapBackendAccountRecord` 映射。
- OpenAI-Compatible 账号与模型来源：同步调用 `ListOpenAICompatibleProviders`，先把 provider 本体转换成请求编排账号，再把 provider 内已配置的模型列表映射为该账号在 `codex` 入口下的目标模型，优先精确匹配入口模型，否则回退到 provider 第一个模型。
- 真实代理来源：读取代理池 localStorage 中的代理节点，只把 `available` 节点映射为请求出口；账号未启用代理池时只显示 `direct`，启用代理池后只显示可用代理出口。
- 编排流程组来源：APP 层 localStorage 持久化，恢复时会过滤已经不存在的账号和代理出口。
- 账号级覆盖来源：APP 层 localStorage 持久化请求编排页内的 `disabled / proxyPoolEnabled` 覆盖，不回写账号池资产本体。
- 账号参与来源：每个流程组维护自己的 `enabledAccountIDs` 白名单；兼容性只决定账号是否“可用”，是否参与该流程由用户在账号列表中勾选，不回写账号池资产本体。
- 暂不写入 CLIProxyAPI，也不改 sidecar 原生策略枚举。

## 当前真实数据边界

- `codex` / `claude-code` 支持关系先按账号 provider 保守推断：`codex`、Codex API key 和 OpenAI-Compatible provider 参与 `codex`；`anthropic / claude` 参与 `claude-code`；`bridge` 账号可参与两者。
- 模型映射对 OpenAI-Compatible provider 已接入真实 provider 模型列表；OpenAI-Compatible provider 本体必须进入 `openai-compatible` 账号组，不能只作为模型映射源存在。其他账号仍先使用入口默认模型到同名目标模型的 APP 层默认值，后续再补账号级可编辑映射。
- 账号禁用与代理池启用目前是请求编排页内的 APP 层临时覆盖，不回写账号池或 CLIProxyAPI。
- 启用账号代理池时，若当前账号仍是 `direct/null` 出口，会自动选择第一个可用代理；若没有可用代理，则该账号不可出站，测试结果会阻断并提示未选择可用代理。
- 账号列表中的 checkbox 是流程级参与开关；取消勾选当前账号时，当前流程会自动切到同组内仍勾选且可用的下一个账号。

## 2026-05-07 后端闭环

- `应用当前组` 已从纯 APP 层标记升级为 Wails 后端动作：前端先保存当前 flows 到 `~/.config/gettokens-data/request-orchestration/config.json`，再调用 `ApplyRequestOrchestration`。
- apply 会读取当前 relay routing config、账号 disabled 状态和 OpenAI-Compatible provider disabled 状态，写入 `runtime-snapshot.json` 后，只保留当前流程组 `enabledAccountIDs` 参与，其余账号 / provider 临时禁用。
- restore 会读取 `runtime-snapshot.json`，恢复 relay routing YAML 和各账号 / provider 原始 disabled 状态，随后删除快照。
- 浏览器 preview 或 sidecar 未 ready 时，前端仍只显示预览标记，不宣称真实 sidecar 状态已改变。
- V1 仍不新增 CLIProxyAPI 原生策略；账号级代理选择仍先服务于 APP 层出口预览和测试判定，不承诺写回所有账号类型。

## 可复用规则

已补充项目级 skill `gettokens-domain-engineering` 的 `Complex Workflow Screens` 规则：

- 最终路径/结果摘要优先。
- 决策区数量压到最少。
- 未满足条件时不展示不可操作的大量候选项。
- 不重复展示“当前配置”KV。
- 定位器和调试元数据保留，但视觉上降级。
