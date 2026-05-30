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

### 筛选口径

1. 账号池主列表筛选采用 AND 条件叠加：来源、可请求、异常、禁用、余额、最长窗口额度同时满足才保留账号。
2. 状态筛选不再使用单选枚举，也不再兼容旧字段。
3. 筛选菜单中的状态、资源、来源都使用同一种勾选框行样式；状态无勾选即表示不过滤状态。
4. 2026-05-23 无头浏览器验收截图：`screenshots/20260523/accounts/20260523-accounts-filter-and-after-v01.png`。

### 分组模式规划

1. 账号池主列表需要支持可切换分组模式和排序模式，二者只改变列表组织方式，不改变筛选、选择、路由、轮动、禁用或导出语义。
2. 默认分组模式为“按套餐分组”，优先级最高；用户进入 `#frame=accounts` 时默认看到当前账号数据动态聚合出的套餐结构。`Pro / Team / Plus / Free` 等已知套餐按业务优先级排序；`enterprise`、`billing`、`key` 或后续新增套餐按 plan key 独立成组，不因不在静态列表内落到“未识别套餐”。只有缺少 plan 的 auth-file 账号才进入未识别套餐，API key / 兼容服务仍进入独立分组。
3. 其他规划维度按阶段推进：
   - P0：来源、状态
   - P1：供应商、资源状态
4. 默认排序模式为“业务优先级”，保留现有 Codex API Key `priority` 轮动顺序；其他 P0 排序维度为名称、状态、剩余额度，P1 维度为重置时间、最近使用。
5. 搜索和筛选先执行，再对过滤后的账号分组，最后在每个分组内排序；选择模式的全选继续作用于全部过滤结果，不限制在单个分组。
6. 分组模式需要支持 hash 与本地偏好恢复，显式 `group=plan|source|status|provider|resource` 优先于本地持久化。
7. 排序模式需要支持 hash 与本地偏好恢复，显式 `sort=priority|name|status|quota|reset|recent` 优先于本地持久化。
8. 详细规划见 `plans/20260524-account-grouping-mode-plan-v01.md`。
9. 2026-05-24 无头浏览器验收截图：`screenshots/20260524/accounts/20260524-accounts-group-sort-toolbar-after-v01.png`。

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
- 父级主视图允许作为聚合页存在；当设计稿需要展示跨子菜单汇总信息时，父级页可以承接统一入口、统一轮动入口与跨子域摘要，但不能抹平子菜单各自的业务边界

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
  - API Key 名称属于资产元数据，修改后必须写入后端本地存储并在应用重启后仍可恢复；不得只存在前端 `localStorage`
- 当前 `Codex API Key` 资产已补一个 `codex-only` 的过渡验证入口；该入口只服务单条资产，不代表最终统一的 provider 验证架构

#### 子级 2：openai-compatible

- 新增一个面向 provider 的子工作区
- 其核心对象不是“单个 key”，而是“provider”
- 当前产品口径进一步收紧为：`1 张 openai-compatible 卡片 = 1 个兼容 OpenAI 账号 = 1 个 provider + 1 个 apiKey`
- 第一阶段使用独立的 provider 列表模型，不强行进入现有 `AccountRecord` 主列表，也不伪装成 `Codex API Key` 卡片
- provider 最小字段：
  - `name`
  - `baseUrl`
  - `apiKey`
- provider 标识规则：
  - 第一阶段以 `name` 作为产品层主标识
  - `name` 必须唯一
  - 新增或编辑时若与现有 provider 重名，必须阻止保存并给出冲突提示
- 当前阶段增强字段：
  - `headers`
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

### 设计稿与文案口径

1. 设计稿默认使用中文；产品说明、按钮、空状态、提示文案优先中文表达。
2. `Codex`、`ChatGPT`、`OpenAI` 这类必要产品名可以保留英文技术标识，但不应让界面主文案退化成英文堆叠。
3. `openai-compatible` 在界面中的默认呈现口径应为“兼容 OpenAI 账号”或等价中文表达；只有在需要强调协议/字段名时才保留技术词。
4. 轮动弹窗、聚合页、详情弹窗中的标签文本应避免出现裸露的 `PROVIDER / BASE URL / API KEY / MODELS / DRAG / CONFIGURED` 这类英文 UI 标签，除非设计稿明确要求保留。
5. 若本轮实现需要调整设计稿口径，必须先回写本 space，再改代码与文案资源。
- provider 远端模型规则：
  - provider detail 打开后可以主动拉取远端 `/models`
  - 每个 provider 的远端模型结果需要按 provider 配置缓存；配置未变时按天刷新，也允许用户手动刷新
  - 未保存草稿触发的拉取结果不得污染 workspace 卡片上已保存 provider 的模型数或验证状态
  - 若远端模型拉取成功，验证模型候选应优先显示远端模型，而不是只看本地手填 `models`
  - 用户可以将远端模型列表直接回写为本地 `models / alias` 草稿
  - 若远端模型拉取失败，页面应保留错误信息，并回退到本地模型或 preset 模型，不清空现有配置

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

#### 场景 2B：修改 Codex API Key 名称后可跨重启保留

- Given 当前位于 `codex` 子菜单
- And 页面中已有一条 `Codex API Key` 资产
- When 用户在详情弹窗中修改该资产名称并点击保存
- Then 新名称必须写入后端本地存储
- And 当前列表与详情视图立即显示新名称
- When 用户关闭应用并重新打开
- Then 该资产仍显示用户保存的新名称
- And 不依赖前端 `localStorage` 才能恢复名称

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
- When 用户保存成功
- Then 页面出现新的 openai-compatible provider 容器
- And 该容器不被错误地渲染成 `Codex API Key`

#### 场景 10：编辑 openai-compatible provider

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户点击 `Manage Provider` 打开该 provider 的详情或编辑面板
- Then 用户可以查看并修改基础字段
- And 当前阶段至少支持修改 `name`、`baseUrl`、`apiKey`
- And 当前阶段至少支持编辑 `headers`
- And 当前阶段至少支持编辑 `models / alias`

#### 场景 11：验证 openai-compatible provider 配置

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户在 provider 详情或编辑面板触发“验证”
- Then 应用应以 provider 配置为输入发起验证，而不是复用 `codex quota` 链路
- And 最小验证入参至少包括 `baseUrl`、`apiKey`、可选 `headers` 与显式必填的 `model`
- And 页面应展示最近一次验证结果状态：`idle / loading / success / error`
- And 当验证失败时，页面应保留失败原因，不能只显示一个无上下文的失败提示

#### 场景 11A：拉取 openai-compatible provider 的远端模型

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有 provider 容器
- When 用户打开 provider detail 或手动触发“拉取远端模型”
- Then 应用应基于当前 draft 的 `baseUrl`、`apiKey` 与可选 `headers` 请求远端 `/models`
- And 若请求成功，页面应直接列出远端模型，并将它们作为验证候选的优先来源
- And 用户可以选择把远端模型覆盖到本地 `models / alias` 草稿
- And 已保存 provider 的远端模型列表需要按天缓存，并在手动刷新时强制更新
- But 若请求失败，页面只能回退到本地或 preset 模型，不能清空已有模型配置

#### 场景 12：删除 openai-compatible provider

- Given 用户已进入 `openai-compatible` 子菜单
- And 页面中已有一个 provider 容器
- When 用户执行删除操作
- Then 删除粒度应是整个 provider
- And 不应误实现为“只删除 provider 里的某一个 key 但保留残缺容器”

#### 场景 13：codex API Key 的过渡性验证

- Given 用户当前位于 `codex` 子菜单
- And 页面中已有 `Codex API Key` 资产
- When 用户在 `ApiKeyDetailModal` 中输入测试模型并点击验证
- Then 应用应使用当前弹窗里的 `apiKey + baseUrl + model` 发起一次 `codex-only` 验证
- And 页面应展示最近一次验证结果状态：`idle / loading / success / error`
- And 当测试模型为空时，页面应直接提示用户先补齐测试模型
- And 不得把它定义成最终统一的 provider 验证架构
- And 后续 `openai-compatible` provider 工作区上线后，应以 provider 级验证作为正式能力归属

#### 场景 14：子菜单状态保持

- Given 用户已进入 `账号池` 下的任意子菜单
- When 用户刷新页面或切换到其他主导航后再返回
- Then 应用应按优先级恢复子菜单：显式导航目标 > 本地持久化 > 默认 `codex`
- And 不应出现父级高亮、子级选中、主体内容三者不一致
- And 父级折叠后再展开时，应保留上次子菜单选中态

#### 场景 15：默认按套餐分组查看账号池

- Given 用户进入 `#frame=accounts`
- When 当前没有显式 `group` hash 且没有本地分组偏好
- Then 账号列表默认按 `套餐` 分组
- And 分组顺序为 `Pro -> Plus -> Free -> API Key / 兼容服务 -> 未识别套餐`
- And 搜索、筛选、密度模式仍按原语义工作

#### 场景 16：切换分组模式不改变筛选结果

- Given 用户已在账号池主列表设置搜索词和筛选条件
- When 用户将分组模式从 `套餐` 切换为 `来源` 或 `状态`
- Then 页面只改变列表分组方式
- And 过滤后的账号集合不应因为分组模式切换而扩大或缩小
- And 选择模式中的全选仍作用于全部过滤结果

#### 场景 17：默认按业务优先级排序

- Given 用户进入 `#frame=accounts`
- When 当前没有显式 `sort` hash 且没有本地排序偏好
- Then 每个分组内账号默认按 `业务优先级` 排序
- And Codex API Key 继续按 `priority` 从高到低排列
- And priority 相同时按名称稳定排列

#### 场景 18：切换排序模式不改变分组和过滤结果

- Given 用户已在账号池主列表设置搜索词、筛选条件和 `套餐` 分组
- When 用户将排序模式切换为 `剩余额度`
- Then 页面只改变每个分组内部的账号顺序
- And 分组数量、分组名称和过滤后的账号集合不应改变

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
- 已明确定义账号池分组模式规划，默认按套餐分组，其他维度按来源、状态、供应商、资源状态分阶段推进
- 已明确定义账号池排序模式规划，默认按业务优先级排序，P0 支持名称、状态、剩余额度排序，P1 支持重置时间和最近使用排序
- 已明确定义分组和排序模式不改变筛选、选择、路由、轮动、禁用或导出语义
- 已实现账号池工具栏分组与排序模式入口，并支持 `group` / `sort` hash 恢复
- `openai-compatible` detail modal 已覆盖基础字段、单 `apiKey`、`headers` 文本编辑、`models / alias` 与 provider 级验证
- 已明确定义 `openai-compatible provider` 的唯一性与主标识规则
- 已明确定义 `openai-compatible` 第一阶段采用独立 provider 列表模型
- 已明确定义 `openai-compatible` 的空状态与默认主 CTA
- 已明确定义“验证”归属为 provider 配置验证，而不是简单给现有 API key 卡片补按钮
- 已明确定义 provider 验证最小入参与结果状态模型
- 已明确定义 `openai-compatible` provider detail 可拉取远端 `/models`，并以远端模型作为验证候选优先来源
- 已明确定义远端模型和 provider 验证状态要按 provider 配置签名缓存，避免未保存草稿污染 workspace 卡片
- 已明确定义 `ApiKeyDetailModal` 必须显式保留 `provider` 归属表达，但不承载正式验证主流程
- `ApiKeyDetailModal` 当前已补一个 `codex-only` 过渡验证区，显式要求输入测试模型
- 第一阶段实现已把 `openai-compatible` 收口到 `provider card -> detail modal -> save/verify` 的正式工作流，不再只停留在卡片级临时输入
- 第二阶段实现已补齐 `headers` 文本编辑、`models / alias` 编辑、远端模型按天缓存与单 `apiKey` provider 保存
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
- [账号池分组模式规划 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/account-pool/plans/20260524-account-grouping-mode-plan-v01.md)

## 当前状态
- 状态：active-umbrella
- 最近更新：2026-05-24
- 最近变更：新增账号池分组与排序模式规划，默认按套餐分组、按业务优先级排序；P0 同时规划来源/状态分组与名称/状态/剩余额度排序，P1 规划供应商/资源状态分组与重置时间/最近使用排序；分组和排序只改变列表组织方式，不改变筛选、选择、路由、轮动、禁用或导出语义。
- 判定：`account-pool` 是长期 umbrella space，不按单个未收口需求管理；具体新需求应进入独立 space，当前近期主线为 `20260515-rate-limit-middleware`，短线收尾为 `20260511-codex-binary-management`。
