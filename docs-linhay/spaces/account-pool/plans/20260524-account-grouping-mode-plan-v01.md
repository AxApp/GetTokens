# 账号池分组模式规划 v01

## 背景

当前 `#frame=accounts` 已经存在 `AccountGroup` 渲染结构，但选择器实际按 `provider` 分组，界面文案又保留了 `plan_group_*` 的套餐分组痕迹。后续需要把“分组”从固定 provider 分组升级为用户可切换的列表组织模式，并把套餐分组作为默认主路径。同时，列表还需要支持排序模式，避免用户只能依赖当前隐式的 `compareAccountRecords` 排列。

本规划只定义需求、数据口径和验收边界，不直接实现代码。

## 目标

1. 账号池主列表支持分组模式切换。
2. 默认分组模式为“按套餐分组”。
3. 账号池主列表支持排序模式切换。
4. 默认排序模式保留现有业务优先级，尤其是 Codex API Key 的 `priority` 轮动顺序。
5. 搜索、筛选、选择模式和密度模式继续按现有语义工作。
6. 分组和排序只改变列表组织方式，不改变账号是否参与路由、轮动、禁用或导出。
7. quota enrichment 仍然增量更新，不因为等待套餐遥测阻塞完整列表渲染。

## 非目标

1. 不把分组模式做成新的过滤条件。
2. 不把排序模式做成新的过滤条件。
3. 不在第一阶段引入用户自定义分组规则或自定义排序表达式。
4. 不改变现有账号唯一性、禁用、异常、最长 quota、余额筛选语义。
5. 不把 `openai-compatible` provider 强行并入 Codex 账号卡模型。

## 分组维度

### P0：按套餐分组（默认）

用途：用户最快判断账号池里 `pro / plus / free / 未识别` 的资产结构，优先服务额度规划和路由策略。

分组顺序：

1. `Pro`
2. `Plus`
3. `Free`
4. `API Key / 兼容服务`
5. `未识别套餐`

数据口径：

1. 优先读取 quota 返回的 `planType`。
2. quota 未返回时回退到 `AccountRecord.planType`。
3. Codex API Key 若有可解析套餐，进入对应套餐组；否则进入 `API Key / 兼容服务`。
4. `openai-compatible` provider 若后续进入同屏聚合，默认进入 `API Key / 兼容服务`，除非 provider 验证结果能稳定提供套餐。
5. 未识别、加载失败、无 quota 权限的 auth-file 进入 `未识别套餐`，不能被误归为 Free。

### P0：按来源分组

用途：区分 `ChatGPT OAuth / Auth File`、`Codex API Key`、`兼容 OpenAI 账号`，帮助用户做导入、删除、批量选择和迁移判断。

分组顺序：

1. `ChatGPT / Auth File`
2. `Codex API Key`
3. `兼容 OpenAI 账号`
4. `其他来源`

### P0：按状态分组

用途：快速处理不可用资产，同时保持“手动禁用”和“异常不可用”的语义分离。

分组顺序：

1. `可请求`
2. `手动禁用`
3. `需要处理`
4. `状态未知`

数据口径：

1. `disabled` 或 `DISABLED` 进入 `手动禁用`。
2. `rawAuthFile.unavailable` 或非正常状态进入 `需要处理`。
3. 正常可用资产进入 `可请求`。
4. 缺少状态但又未明确异常的资产进入 `状态未知`。

### P1：按供应商分组

用途：保留当前 provider 分组能力，适合跨供应商资产较多的用户。

数据口径：

1. 使用 normalized provider key 作为 group id。
2. label 使用 provider 的展示名，大写只作为视觉样式，不作为数据语义。
3. 未识别 provider 进入 `UNKNOWN`。

### P1：按资源状态分组

用途：面向额度调度场景，查看哪些资产还有最长窗口额度或余额。

分组顺序：

1. `有可用长窗口额度`
2. `有余额`
3. `额度耗尽`
4. `暂无资源遥测`

注意：这个维度依赖 quota/billing enrichment，第一阶段不作为默认值，避免加载过程导致分组抖动过强。

## 排序维度

排序模式只作用于每个分组内部；分组之间仍按分组模式定义的 `rank` 排列。若用户关闭分组或后续提供“无分组”模式，排序作用于整张列表。

### P0：业务优先级（默认）

用途：保留当前账号池的隐式稳定顺序，避免上线排序模式后破坏 Codex API Key 轮动心智。

数据口径：

1. Codex API Key 继续按 `priority` 从高到低排序。
2. 非 API Key 或 priority 相同的账号按 `displayName` 稳定排序。
3. 该模式是现有 `compareAccountRecords` 的显式产品化版本。

### P0：名称

用途：用户按账号名、邮箱或导入命名快速定位。

排序规则：

1. 主字段：`displayName`，A-Z。
2. 次字段：`email`。
3. 兜底字段：`id`。

### P0：状态

用途：把需要处理的账号提前暴露，适合清理异常、禁用或过期账号。

排序顺序：

1. `需要处理`
2. `手动禁用`
3. `状态未知`
4. `可请求`

同一状态内回退到业务优先级排序。

### P0：剩余额度

用途：把还有可用 quota 的账号排到前面，服务日常调度和额度观察。

排序规则：

1. 使用最长窗口剩余百分比从高到低排序。
2. 有 token 进度但没有百分比时，不用 token 数推导百分比。
3. quota loading、error、empty、unsupported 统一排到有明确剩余额度的账号之后。
4. 同一剩余额度或无遥测时回退到业务优先级排序。

### P1：重置时间

用途：用户想看哪些账号最早恢复额度。

排序规则：

1. 使用最长窗口的 `resetAtUnix` 从近到远排序。
2. 缺少 `resetAtUnix` 的账号排在后面。
3. 不解析 `resetLabel`，避免显示文本丢秒导致排序漂移。

### P1：最近使用

用途：结合 Usage Desk 或 sidecar 归因数据，查看哪些账号近期高频使用。

边界：

1. 第一阶段不强行实现，除非账号记录中已有稳定 `lastUsedAt` 或使用归因字段。
2. 不为了排序读取敏感会话内容。
3. 无最近使用数据时回退到业务优先级排序。

## 交互设计

1. 在账号列表工具栏增加“分组”分段控件或菜单，位置放在密度切换左侧。
2. 分组选项：`套餐`、`来源`、`状态`、`供应商`、`资源`。
3. `套餐`为默认模式。
4. 分组模式持久化到 localStorage：`gettokens.accounts.group-mode`。
5. URL hash 支持 `group=plan|source|status|provider|resource`；显式 hash 优先于 localStorage。
6. 在账号列表工具栏增加“排序”菜单，位置放在“分组”和密度切换之间。
7. 排序选项：`业务优先级`、`名称`、`状态`、`剩余额度`、`重置时间`、`最近使用`。
8. `业务优先级`为默认排序模式。
9. 排序模式持久化到 localStorage：`gettokens.accounts.sort-mode`。
10. URL hash 支持 `sort=priority|name|status|quota|reset|recent`；显式 hash 优先于 localStorage。
11. 搜索与筛选先执行，再对过滤后的列表分组，最后在每个分组内排序。
12. 选择模式的“全选”继续作用于过滤后的所有账号，不限制在单个分组，也不受排序方向影响。
13. 分组 header 展示：分组名、账号数、可请求数、异常数；P0 可先只展示账号数。
14. 空分组默认隐藏；当搜索/筛选结果为空时继续使用现有空状态。
15. P0 排序先只提供固定方向；后续如需要再补升序/降序切换，避免控件过早复杂化。

## 数据模型建议

新增：

```ts
export type AccountGroupMode = 'plan' | 'source' | 'status' | 'provider' | 'resource';
export type AccountSortMode = 'priority' | 'name' | 'status' | 'quota' | 'reset' | 'recent';

export interface AccountGroup {
  id: string;
  label: string;
  rank: number;
  mode: AccountGroupMode;
  accounts: AccountRecord[];
  meta?: {
    requestableCount: number;
    disabledCount: number;
    errorCount: number;
  };
}
```

选择器建议：

1. 保留 `filterAccounts` 的现有职责。
2. 将 `groupAccountsByVendor` 演进为 `groupAccounts(accounts, mode, codexQuotaByName, t)`。
3. 独立实现 `resolveAccountPlanGroup`、`resolveAccountSourceGroup`、`resolveAccountStatusGroup`、`resolveAccountProviderGroup`、`resolveAccountResourceGroup`。
4. 计划相关解析复用当前 `resolveAccountPlanType` 口径，避免前端多处重复解析。
5. 将当前 `compareAccountRecords` 提升为 `compareAccountsBySortMode(left, right, sortMode, codexQuotaByName)` 的默认分支。
6. quota / reset 排序复用最长窗口选择口径，避免和“最长 quota”筛选出现两个定义。
7. 排序比较器必须稳定：主字段相同或遥测缺失时回退到 `priority` 排序，再回退到 `id`。

## BDD 场景

### 场景 1：默认按套餐分组

- Given 用户进入 `#frame=accounts`
- When 当前没有显式 `group` hash 且没有本地分组偏好
- Then 账号列表默认按 `套餐` 分组
- And 分组顺序为 `Pro -> Plus -> Free -> API Key / 兼容服务 -> 未识别套餐`

### 场景 2：显式切换分组模式

- Given 用户位于账号池主列表
- When 用户将分组模式切换为 `来源`
- Then 列表改为按来源分组
- And 搜索、筛选、密度模式、选择模式保持原状态
- And 分组偏好写入 localStorage

### 场景 3：hash 优先恢复分组模式

- Given localStorage 中保存的分组模式为 `provider`
- When 用户打开 `#frame=accounts&group=plan`
- Then 页面按 `套餐` 分组
- And 不应被 localStorage 的 `provider` 覆盖

### 场景 4：套餐遥测增量更新

- Given 账号列表已先用本地账号数据渲染
- And 某个账号初始套餐未知
- When quota enrichment 返回该账号的 `planType=pro`
- Then 该账号移动到 `Pro` 分组
- And 页面不应在 quota 请求完成前整体空白

### 场景 5：状态分组保持禁用和异常分离

- Given 列表中同时存在手动禁用账号和异常不可用账号
- When 用户切换到 `状态` 分组
- Then 手动禁用账号进入 `手动禁用`
- And 异常不可用账号进入 `需要处理`
- And 两类账号不能合并为同一个不可用组

### 场景 6：默认按业务优先级排序

- Given 用户进入 `#frame=accounts`
- When 当前没有显式 `sort` hash 且没有本地排序偏好
- Then 每个分组内账号默认按 `业务优先级` 排序
- And Codex API Key 继续按 `priority` 从高到低排列
- And priority 相同时按名称稳定排列

### 场景 7：切换排序模式不改变分组和过滤结果

- Given 用户已经设置分组模式为 `套餐`
- And 用户已经设置搜索词和筛选条件
- When 用户将排序模式切换为 `剩余额度`
- Then 页面只改变每个套餐分组内部的账号顺序
- And 分组数量、分组名称、过滤后的账号集合不应改变

### 场景 8：hash 优先恢复排序模式

- Given localStorage 中保存的排序模式为 `name`
- When 用户打开 `#frame=accounts&sort=quota`
- Then 页面按 `剩余额度` 排序
- And 不应被 localStorage 的 `name` 覆盖

## 验收标准

1. `buildAccountsView` 可根据 `groupMode` 返回不同分组结果。
2. `buildAccountsView` 可根据 `sortMode` 返回稳定排序结果。
3. 默认 `groupMode` 为 `plan`。
4. 默认 `sortMode` 为 `priority`。
5. 账号筛选测试覆盖：套餐、来源、状态、供应商、资源至少各一个分组样例。
6. 账号排序测试覆盖：业务优先级、名称、状态、剩余额度、重置时间至少各一个排序样例。
7. 工具栏测试覆盖：分组控件、排序控件渲染、切换回调、hash/localStorage 恢复。
8. Storybook 或组件测试覆盖：每种密度模式下分组 header、排序控件和列表卡片不挤压、不溢出。
9. 浏览器预览验收覆盖：`#frame=accounts&group=plan&sort=priority`、`group=source&sort=name`、`group=status&sort=quota`。
10. 若涉及 Wails 真实数据，最终还需要桌面应用验证 sidecar ready 后列表正常显示。

## 实施顺序

1. 增加 `AccountGroupMode` / `AccountSortMode`、解析和持久化工具。
2. 先写选择器红灯测试：默认套餐分组、来源分组、状态分组、provider 分组。
3. 继续写排序红灯测试：默认业务优先级、名称、状态、剩余额度、重置时间。
4. 改造 `buildAccountsView`，把固定 provider 分组改为按 `groupMode` 分发，并在分组内按 `sortMode` 排序。
5. 在 `AccountsToolbar` 增加分组控件和排序控件，并补组件测试。
6. 接入 hash 与 localStorage 恢复。
7. 补浏览器预览和截图验收。
8. 视实际数据稳定性决定是否在 P0 暴露资源分组和重置时间排序，或先隐藏到 P1。
