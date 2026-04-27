# 账号池

## 背景
账号池相关需求、设计、计划、截图和辩论记录统一沉淀在本 space 下，避免散落到仓库级目录。

## 目标
为账号池能力提供单一工作入口，承载后续的需求澄清、实现计划、验证记录与回归资料。

## 范围
- 账号池需求背景、边界和验收标准维护
- 账号池开发计划归档到 `plans/`
- 账号池截图归档到 `screenshots/`
- 账号池多 agent 讨论归档到 `debate/`
- `nolon/chatgpt(codex)` OAuth 登录与账号过期恢复集成
- 账号池信息架构与子菜单导航
- `openai-compatible` provider 资产入口与管理范围

## 非目标
- 在本次操作中直接定义账号池的详细产品方案或技术实现
- 在仓库级 `dev/` 或其他 space 中重复维护同一份账号池范围说明
- 为整个桌面应用引入独立的全局登录页或 Web 管理后台式会话系统

## 当前需求

### 完全体目标

账号池在完全体状态下不再是一个单平面页面，而是一个带子菜单的父级工作区：

1. 用户点击侧边栏 `账号池` 后，`账号池` 下方展开两个子菜单：
   - `codex`
   - `openai-compatible`
2. `codex` 子菜单承接现有 `ChatGPT OAuth auth-file + Codex API Key + quota + reauth + rotation` 的完整闭环。
3. `openai-compatible` 子菜单承接通用 OpenAI 兼容 provider 的新增、查看、编辑、删除与配置工作台。
4. 父级 `账号池` 负责统一入口、统一导航状态和统一空间命名；两个子菜单分别承接各自的业务模型，不强行压成同一种“账号卡”心智。

### 已知边界

1. 当前 GetTokens 已能把 `nolon chatgptAccount` 类 auth 文件识别为 `codex`
2. 当前导入链路已能把 legacy `codex/nolon` auth 清洗成 sidecar 真正消费的最小字段结构
3. 当前失败原因已能从 sidecar `statusMessage` 透传到账号卡片
4. 当前前端入口仍以“上传文件 / 粘贴 JSON / API Key 录入”为主，`codex` 已有 OAuth bridge，但 `openai-compatible` 还没有正式产品入口
5. 当前桌面应用不是单一全局登录应用，不能把单个账号失效等同于整个应用登出
6. 参考 sidecar 的 `openai-compatible` 协议是 `provider 容器 + api-key-entries + models`，不是单个 API key 资产

### 信息架构

#### 父级：账号池

- 侧边栏主项：`账号池`
- 交互：点击后展开/聚焦子菜单，而不是直接只展示单一列表
- 子菜单顺序：
  1. `codex`
  2. `openai-compatible`
- 子菜单恢复规则优先级：
  1. 若存在明确子菜单路由或显式导航目标，优先使用该目标
  2. 否则读取本地持久化的上次子菜单选择
  3. 若以上都不存在，默认回到 `codex`
- 父级 `账号池` 折叠后再次展开时，保留上一次子菜单选中态，不重置到默认值

#### 子级 1：codex

- 继续保留并增强现有 `codex` 账号池能力：
  - `ChatGPT 登录`
  - `导入 Auth File`
  - `粘贴 Auth 内容`
  - `添加 Codex API Key`
  - `重新登录`
  - `额度观察`
  - `轮动设置`
- `Codex API Key` 详情弹窗继续承接“单条 API key 资产详情 / 配置分发工作台”职责：
  - 可以复用统一 detail shell
  - 但标题、provider config 区块、配置工作台标题都必须显式带出当前 `provider`
  - 不得把该弹窗误实现成通用 provider 设置页
- 当前 `Codex API Key` 资产没有正式“验证 provider 配置”链路；若后续补验证，只能视为过渡方案，不代表最终信息架构

#### 子级 2：openai-compatible

- 新增一个面向 provider 的子工作区
- 其核心对象不是“单个 key”，而是“provider”
- 第一阶段使用独立的 provider 列表模型，不强行进入现有 `AccountRecord` 主列表，也不伪装成 `Codex API Key` 卡片
- provider 最小字段：
  - `name`
  - `baseUrl`
  - `apiKeyEntries[0].apiKey`
  - `prefix(可选)`
- provider 标识规则：
  - 第一阶段以 `name` 作为产品层主标识
  - `name` 必须唯一
  - 新增或编辑时若与现有 provider 重名，必须阻止保存并给出冲突提示
- 后续增强字段：
  - `headers`
  - `apiKeyEntries[]`
  - `models[]`
- 空状态规则：
  - 当列表中没有任何 openai-compatible provider 时，页面必须展示明确空状态
  - 空状态需要解释“这里管理的是 provider，而不是单个 API key 账号”
  - 空状态主 CTA 为“新增 openai-compatible provider”
- provider 验证规则：
  - “验证”针对的是 provider 配置可用性，不是单个资产卡片是否存在
  - 第一阶段验证对象至少覆盖：
    - `baseUrl`
    - `apiKey`
    - `headers(可选)`
    - `model(第一阶段显式必填，避免默认模型导致验证结论漂移)`
  - 第一阶段验证结果状态至少覆盖：
    - `idle`
    - `loading`
    - `success`
    - `error`
  - `error` 状态需要保留最近一次失败原因，便于用户在第一跳看到验证失败信息

### BDD 场景

#### 场景 1：进入账号池父级后看到子菜单

- Given 用户已进入桌面应用主界面
- When 用户点击侧边栏 `账号池`
- Then `账号池` 下方展开两个子菜单：`codex` 与 `openai-compatible`
- And 当前页面主体展示默认子菜单对应的内容
- And 父级高亮与子级选中态保持一致

#### 场景 2：切换到 codex 子菜单

- Given 用户已展开 `账号池` 子菜单
- When 用户点击 `codex`
- Then 页面进入 `codex` 账号池视图
- And 用户可以看到 `ChatGPT 登录`、`导入 Auth File`、`粘贴 Auth 内容`、`添加 Codex API Key`
- And 现有 quota、reauth、rotation 等 codex 专属能力仍保留在该子菜单内

#### 场景 2A：打开 Codex API Key 详情时保留明确 provider 归属

- Given 当前位于 `codex` 子菜单
- And 页面中已有一条 `Codex API Key` 资产
- When 用户打开该资产详情弹窗
- Then 页面标题应显式带出当前 `provider`
- And `provider config` 区块应显式带出当前 `provider`
- And `configuration workspace` 标题应显式带出当前 `provider`
- And 该弹窗仍只承担单条 API key 资产详情与配置复制职责
- And 不得把它误实现成正式 provider 验证入口

#### 场景 3：切换到 openai-compatible 子菜单

- Given 用户已展开 `账号池` 子菜单
- When 用户点击 `openai-compatible`
- Then 页面进入 `openai-compatible` provider 视图
- And 主体对象是 provider 列表或 provider 容器
- And 页面不再误用 `添加 Codex API Key` 作为主入口

#### 场景 4：新增 ChatGPT 账号

- Given sidecar 已就绪，账号池页面可操作
- And 当前位于 `codex` 子菜单
- When 用户点击 `ChatGPT 登录`
- Then 应用调用 sidecar OAuth 起始接口并弹出登录确认框
- And 确认框展示登录 URL，并提供 `复制`、`在浏览器中打开`、`关闭`
- And 前端显示登录进行中状态
- When sidecar OAuth 流程完成
- Then 账号池刷新并出现新的 `codex` 账号记录

#### 场景 5：过期账号重新登录

- Given 当前位于 `codex` 子菜单
- And 账号池中已有一个 `codex` auth-file 账号，状态异常且存在失败原因
- When 用户点击该卡片上的 `重新登录`
- Then 应用发起新的 OAuth 流程
- When OAuth 成功且检测到新的 `codex` auth 文件
- Then 应用将新 auth 内容回填到原账号资产
- And 刷新后原账号 ID 仍以原文件名存在
- And 临时生成的新 auth 文件不会作为重复账号残留

#### 场景 6：OAuth 失败或超时

- Given 用户已发起 `ChatGPT 登录` 或 `重新登录`
- When sidecar 返回 `error` 状态或超时
- Then 前端保留错误提示
- And 不修改现有账号内容
- And 用户可以再次触发登录

#### 场景 7：登录 URL 手动操作

- Given 用户已发起 `ChatGPT 登录` 或 `重新登录`
- When 前端展示登录确认框
- Then 用户可以复制登录 URL
- And 用户可以手动打开浏览器继续登录
- And 用户可以关闭确认框而不影响后续列表刷新

#### 场景 8：账号失效后的可恢复性

- Given `codex` auth-file 账号状态不是 `ACTIVE / CONFIGURED / DISABLED / LOCAL`
- When 用户查看账号卡片
- Then 卡片除失败原因外，还应暴露 `重新登录` 动作
- And 该动作只作用于当前账号，不影响其他账号和应用整体路由

#### 场景 9：新增 openai-compatible provider

- Given 用户已进入 `openai-compatible` 子菜单
- When 用户点击新增 provider
- Then 页面展示 provider 级表单
- And 表单至少要求填写 `name`、`baseUrl`、`apiKey`
- And `prefix` 作为可选字段出现
- When 用户保存成功
- Then 页面出现新的 openai-compatible provider 容器
- And 该容器不被错误地渲染成 `Codex API Key`

#### 场景 10：编辑 openai-compatible provider

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户点击 `Manage Provider` 打开该 provider 的详情或编辑面板
- Then 用户可以查看并修改基础字段
- And 第一阶段至少支持修改 `name`、`baseUrl`、首个 `apiKey entry` 与 `prefix`
- And 后续阶段可继续扩展 `headers`、多 `apiKey entries` 与 `models`

#### 场景 11：验证 openai-compatible provider 配置

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户在 provider 详情或编辑面板触发“验证”
- Then 应用应以 provider 配置为输入发起验证，而不是复用 `codex quota` 链路
- And 最小验证入参至少包括 `baseUrl`、`apiKey`、可选 `headers` 与显式必填的 `model`
- And 页面应展示最近一次验证结果状态：`idle / loading / success / error`
- And 当验证失败时，页面应保留失败原因，不能只显示一个无上下文的失败提示

#### 场景 12：删除 openai-compatible provider

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户执行删除操作
- Then 删除粒度应是整个 provider
- And 不应误实现为“只删除 provider 里的某一个 key 但保留残缺容器”

#### 场景 13：codex API Key 的过渡性验证

- Given 用户当前位于 `codex` 子菜单
- And 页面中已有 `Codex API Key` 资产
- When 产品选择先补一个过渡性的验证动作
- Then 必须明确该动作只代表“单条 codex api key 的临时验证方案”
- And 不得把它定义成最终统一的 provider 验证架构
- And 后续 `openai-compatible` provider 工作区上线后，应以 provider 级验证作为正式能力归属

#### 场景 14：子菜单状态保持

- Given 用户已进入 `账号池` 下的任意子菜单
- When 用户刷新页面或切换到其他主导航后再返回
- Then 应用应按优先级恢复子菜单：显式导航目标 > 本地持久化 > 默认 `codex`
- And 不应出现父级高亮、子级选中、主体内容三者不一致
- And 父级折叠后再展开时，应保留上次子菜单选中态

## 验收标准
- 已存在 `docs-linhay/spaces/account-pool/README.md`
- 已存在 `docs-linhay/spaces/account-pool/plans/`
- 已存在 `docs-linhay/spaces/account-pool/screenshots/`
- 已存在 `docs-linhay/spaces/account-pool/debate/`
- 后续账号池相关文档默认优先落到该 space
- 已定义 `账号池` 父级与 `codex / openai-compatible` 子菜单的信息架构
- 已定义 `codex` OAuth 登录与过期恢复的验收场景
- 已定义 `openai-compatible` provider 的最小闭环场景
- 已明确定义子菜单恢复规则：显式目标 > 本地持久化 > 默认 `codex`
- 已明确定义 `openai-compatible provider` 的唯一性与主标识规则
- 已明确定义 `openai-compatible` 第一阶段采用独立 provider 列表模型
- 已明确定义 `openai-compatible` 的空状态与默认主 CTA
- 已明确定义“验证”归属为 provider 配置验证，而不是简单给现有 API key 卡片补按钮
- 已明确定义 provider 验证最小入参与结果状态模型
- 已明确定义 `ApiKeyDetailModal` 必须显式保留 `provider` 归属表达，但不承载正式验证主流程
- 第一阶段实现已把 `openai-compatible` 收口到 `provider card -> detail modal -> save/verify` 的正式工作流，不再只停留在卡片级临时输入
- 实现后至少覆盖后端 bridge 测试与前端账号动作测试
- 过期 `codex` 账号不再只是显示失败原因，而是可直接触发重新登录
- 成功重登后默认回填原账号资产，不新增重复账号
- 登录入口改为手动确认框，不再无提示直接拉起系统浏览器
- `openai-compatible` 第一阶段不要求完整 AI Provider 后台，但必须以 provider 为主对象，而不是复用 `Codex API Key` 单条资产心智
- 左侧导航、父级高亮、子菜单选中态与主体内容必须一致

## 相关链接
- [docs-linhay 文档入口](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/README.md)
- [spaces 结构治理](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260424-spaces-structure-governance.md)
- [OpenAI-Compatible 评估与边界](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260427-deepseek-provider-support/README.md)
- [OpenAI-Compatible Debate](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260427-deepseek-provider-support/debate/20260427/accounts/20260427-openai-compatible-provider-support-v01.md)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-27
- 最近变更：账号池需求已升级为完全体信息架构，父级 `账号池` 下明确收敛两个子菜单 `codex / openai-compatible`；`codex` 继续承接 OAuth 与 quota 闭环，`openai-compatible` 改为 provider 级心智，不复用单条 `Codex API Key` 交互。
