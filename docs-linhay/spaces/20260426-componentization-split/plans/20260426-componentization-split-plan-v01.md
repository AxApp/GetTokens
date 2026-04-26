# 组件化与业务拆分计划 v01

## 1. 输入结论
本计划基于 2026-04-26 的静态扫描结果制定，当前热点如下：

- 前端热点：
  - `frontend/src/features/accounts/hooks/useAccountsPageState.ts` `621` 行
  - `frontend/src/features/accounts/model/accountConfig.ts` `475` 行
  - `frontend/src/pages/StatusPage.tsx` `407` 行
  - `frontend/src/pages/SettingsPage.tsx` `306` 行
- 后端热点：
  - `internal/accounts/codex_quota.go` `826` 行
  - `internal/sidecar/manager.go` `472` 行
  - `internal/wailsapp/quota.go` `283` 行
  - `internal/wailsapp/codex_api_key_store.go` `276` 行
  - `internal/wailsapp/auth_files.go` `240` 行

目录级聚合：

- `frontend/src/features/accounts/` 约 `2143` 行，是最明确的前端业务域
- `internal/accounts/` 约 `1518` 行，是核心领域逻辑区
- `internal/wailsapp/` 约 `1699` 行，但当前混合了 bridge、存储、配额、auth file、relay 配置
- `internal/sidecar/` 约 `565` 行，但大部分压在单一 `manager.go`

## 2. 目标结构

### 2.1 前端目标
逐步从 `pages` 驱动迁移到 `features` 驱动，建议目标结构：

```text
frontend/src/
├── features/
│   ├── accounts/
│   │   ├── AccountsFeature.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── model/
│   │   └── tests/
│   ├── status/
│   └── settings/
├── components/
├── context/
├── utils/
└── pages/
```

约束：

- `pages/` 只保留路由装配职责
- 业务状态、数据加载、副作用逻辑下沉到 feature hooks
- 纯格式化、映射、片段生成、存储访问不得继续堆进单个 `helpers.ts`
- feature 内部优先按 `components / hooks / model / tests` 分层，而不是继续平铺

### 2.2 Go 侧目标
建议把 `wailsapp` 收口为应用入口与桥接层，领域逻辑继续下沉：

```text
internal/
├── accounts/
│   ├── quota/
│   ├── authfiles/
│   └── records/
├── sidecar/
│   ├── process/
│   ├── config/
│   ├── health/
│   └── ports/
└── wailsapp/
```

约束：

- `wailsapp` 暴露应用接口，不承载复杂解析、存储细节和流程拼装
- 领域逻辑优先放在 `internal/accounts` 和 `internal/sidecar`
- 同一文件中避免同时出现“外部 IO + 数据解析 + 业务规则 + DTO 组装”

## 3. BDD 场景

### 场景 1：账号域继续迭代时
- Given 账号页需要继续加交互或数据来源
- When 开发者进入 `accounts` 域修改
- Then 应能在 feature 内定位状态、组件、格式化和副作用，而不是回到单个超级 hook

### 场景 2：配额逻辑修复时
- Given 需要调整 Codex quota 的解析、请求或窗口计算
- When 开发者修改 Go 侧实现
- Then 应能只在 quota 子模块内改动并通过对应测试，不影响 Wails bridge 结构

### 场景 3：sidecar 生命周期增强时
- Given 需要改端口、健康检查、配置写入或服务 key 规则
- When 开发者修改 sidecar 管理逻辑
- Then 应能在独立职责文件内改动，而不是在单个 manager 文件里横向穿透

## 4. 分阶段计划

### Phase 0：建立边界与红线
目标：

- 冻结继续放大热点文件的趋势
- 先定义目录边界、命名规则和迁移顺序

动作：

- 在本 space 维护拆分目标、阶段与验收标准
- 后续涉及 `accounts` 的新功能，默认优先落到 feature 目录而不是继续扩写大文件
- 新增或修改逻辑前，先判断是“页面装配”、“feature 状态”、“格式化/映射”、“基础设施访问”哪一层

完成定义：

- 本计划文档已存在并作为后续实现基线
- 团队对第一优先级和边界已有统一口径

### Phase 1：前端先拆 `accounts`
目标：

- 把当前最大前端热点拆成可独立测试和复用的 feature 结构

建议拆分：

- `useAccountsPageState.ts`
  - `useAccountsData`
  - `useAccountsSelection`
  - `useAccountsQuota`
  - `useAccountsMutations`
  - `useAccountsModals`
- `helpers.ts`
  - `mappers.ts`
  - `quota-formatters.ts`
  - `config-snippets.ts`
  - `storage.ts`
  - `account-grouping.ts`
- `AccountsPage.tsx`
  - 保留页面装配
  - 将状态与操作集中从 feature hooks 注入

测试门禁：

- 先补现有 helper 和关键 hook 的单测
- 重构后页面交互不回归：搜索、筛选、选择、删除、导入、导出、quota 刷新
- 至少完成 `frontend` 的 `typecheck` 和 `build`

完成定义：

- `AccountsPage.tsx` 不再直接依赖超级 hook 的全部细节
- `helpers.ts` 不再同时承载 5 类以上职责
- 账号域主要能力可以按 feature 内文件名快速定位

### Phase 2：Go 侧拆 `quota`
目标：

- 收敛 `codex_quota.go` 的多重职责

建议拆分：

- `quota_types.go`
- `quota_auth_parser.go`
- `quota_client.go`
- `quota_builder.go`
- `quota_debug.go`

测试门禁：

- 先保留现有 `codex_quota_test.go`
- 新增针对 `auth parser`、`window builder`、`fallback cache` 的单测
- 保证 `internal/accounts` 包测试全绿

完成定义：

- 发请求、解析 token、构造 quota response 已分离
- 出现新额度规则时可在 builder 层局部修改

实施结果（2026-04-26）：

- `internal/accounts/codex_quota.go` 已拆为：
  - `quota_types.go`
  - `quota_auth_parser.go`
  - `quota_client.go`
  - `quota_builder.go`
  - `quota_debug.go`
- 请求发起、auth file 解析、JWT claim 提取、额度窗口组装、debug redaction 已完成职责分离，`wailsapp` 调用入口保持不变。
- 本轮未额外扩展新测试文件，先保留并复用现有 `codex_quota_test.go` 作为行为护栏；后续如果 quota 规则继续膨胀，再补 builder / parser 的更细粒度表驱动测试。
- 回归验证通过：
  - `go test ./internal/accounts`
  - `go test ./internal/accounts ./internal/wailsapp ./internal/sidecar`

### Phase 3：Go 侧拆 `sidecar` 与 `wailsapp`
目标：

- 让 `sidecar` 成为清晰的生命周期模块
- 让 `wailsapp` 回到 façade / bridge 角色

建议拆分：

- `internal/sidecar/manager.go`
  - `process.go`
  - `config.go`
  - `health.go`
  - `port.go`
- `internal/wailsapp/`
  - 按 `accounts`、`auth_files`、`quota`、`relay_service` 保留接口文件
  - 具体存储、解析与流程拼装下沉到 domain/service

测试门禁：

- sidecar manager 相关单测继续保留并扩展
- `wailsapp` 侧以行为回归测试为主，确保 bridge 不变形

完成定义：

- `manager.go` 不再同时管理进程、端口、配置、健康检查和 key 生成
- `wailsapp` 单文件平均复杂度下降，bridge 层不再继续膨胀

实施结果（2026-04-26）：

- `internal/sidecar/manager.go` 已拆出：
  - `config.go`
  - `port.go`
  - `process_support.go`
- `internal/wailsapp/quota.go` 已拆出：
  - `quota_support.go`
  - `quota_debug.go`
- 当前 `Manager` 对外方法与 `wailsapp` bridge 导出接口保持不变，本轮只做内部职责下沉，避免牵动前端绑定层。
- 回归验证通过：
  - `go test ./internal/sidecar ./internal/wailsapp ./internal/accounts`
  - `go test ./internal/accounts ./internal/wailsapp ./internal/sidecar`

### Phase 4：第二梯队页面治理
对象：

- `StatusPage.tsx`
- `SettingsPage.tsx`
- `DebugPage.tsx`

目标：

- 将状态页和设置页拆成卡片级组件与对应 hooks
- 减少页面文件中的 IO、副作用与展示耦合

测试门禁：

- `typecheck`
- `build`
- 关键卡片交互的最小回归验证

实施结果（2026-04-26）：

- 新增 `frontend/src/features/status/StatusFeature.tsx`，原 `pages/StatusPage.tsx` 现在只保留路由包装职责。
- 新增 `frontend/src/features/settings/SettingsFeature.tsx`，原 `pages/SettingsPage.tsx` 现在只保留路由包装职责。
- `Settings` 页内的源码映射已同步到 `features/status` 与 `features/settings` 新路径。
- 本轮先完成页面装配层迁移，尚未继续把 `Status` 页拆成更细的卡片组件；当前目标是先把 `pages/` 收口为入口层。
- 回归验证通过：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`

## 5. 执行顺序建议
建议严格按下面顺序推进，避免前后端同时大改：

1. 先做 Phase 1，完成 `accounts` 前端拆分
2. 再做 Phase 2，收敛 quota 领域逻辑
3. 然后做 Phase 3，拆 sidecar 和 wailsapp
4. 最后处理 `Status / Settings / Debug` 页面的结构治理

原因：

- `accounts` 是当前最频繁承接需求的业务面
- 前端拆分后更容易稳定接口和状态边界
- quota 与 sidecar 属于后端能力核心，宜在前端目录稳定后再重构

## 6. 风险与控制

- 风险：重构时把“目录调整”做成“行为改写”
  - 控制：每个 phase 先锁定验收场景，再做红绿重构
- 风险：一次性迁移过多文件导致 review 困难
  - 控制：按 phase 和子模块分 PR，避免跨域大包
- 风险：`wailsapp` bridge 改动影响前端调用契约
  - 控制：优先抽内部实现，不先改导出接口名和参数
- 风险：前端 helper 下沉后出现重复实现
  - 控制：先按职责拆，不急于跨 feature 提公共层

## 7. 近期行动项

### 第一批
- 创建 `frontend/src/features/accounts/` 目标结构
- 梳理 `useAccountsPageState.ts` 的状态分层
- 补 `helpers.ts` 和 quota 格式化的单测
- 给 Phase 1 拆分列出更细的文件迁移清单

### 第一批实施切片（2026-04-26）
- 本次实现先不引入新的全局状态容器，也不一次性搬迁整个 `accounts` 目录。
- 第一刀只拆“纯逻辑层”，优先从 `helpers.ts` 和 `useAccountsPageState.ts` 中分离：
  - 账号筛选与分组 selector
  - quota 展示与账号展示 label 计算
  - provider 配置片段生成与 API key label storage key
- 页面与 Wails 调用契约保持不变，避免本轮同时触发结构重排和行为改写。
- 测试基线采用现有 Node `node:test` 方式，先覆盖纯函数，再继续拆 hook 和页面装配层。

### 第一批实施结果（2026-04-26）
- 新增模块：
  - `frontend/src/features/accounts/model/accountConfig.ts`
  - `frontend/src/features/accounts/model/accountPresentation.ts`
  - `frontend/src/features/accounts/model/accountQuota.ts`
  - `frontend/src/features/accounts/model/accountSelectors.ts`
- 兼容层 `helpers.ts` 已删除，不再保留过时入口。
- `useAccountsPageState.ts` 已改为消费 `buildAccountsView(...)` 派生视图，减少页面状态 hook 内的筛选/分组/选择拼装逻辑。
- 新增测试：
  - `frontend/src/features/accounts/tests/accountConfig.test.mjs`
  - `frontend/src/features/accounts/tests/accountSelectors.test.mjs`
- 新增脚本：
  - `frontend/package.json` 增加 `npm run test:unit`
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`
- 未完成项：
  - 还没有把 `useAccountsPageState.ts` 进一步拆成多个 hooks
  - 还没有把 `AccountsPage.tsx` 迁到 `features/accounts`
  - 还没有进入 Go 侧 `quota / sidecar / wailsapp` 拆分

### 第二批实施结果（2026-04-26）
- 新增模块：
  - `frontend/src/features/accounts/model/accountSelection.ts`
  - `frontend/src/features/accounts/hooks/useAccountsQuotaState.ts`
  - `frontend/src/features/accounts/model/accountTransfer.ts`
- `useAccountsPageState.ts` 已将以下职责外移：
  - selection 状态切换、全选与失效选择清理
  - codex quota 加载与刷新
  - 导入上传文件解析、粘贴导入文件名决策、导出文件名生成
- 新增测试：
  - `frontend/src/features/accounts/tests/accountSelection.test.mjs`
  - `frontend/src/features/accounts/tests/accountTransfer.test.mjs`
- `frontend/package.json` 的 `npm run test:unit` 已纳入新测试入口。
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`
- 当前剩余热点：
  - `useAccountsPageState.ts` 仍承载 delete / create api key / paste import / export / rename 等 mutation 编排
  - `AccountsPage.tsx` 还未迁到 `features/accounts`

### 第三批实施结果（2026-04-26）
- 新增模块：
  - `frontend/src/features/accounts/hooks/useAccountsActions.ts`
- 共享类型：
  - `frontend/src/features/accounts/model/types.ts` 新增 `TrackRequest`
- `useAccountsPageState.ts` 已将 delete / upload / create api key / paste import / export / rename 等 mutation 编排外移到 `useAccountsActions.ts`
- `useAccountsQuotaState.ts` 改为复用 `types.ts` 中的 `TrackRequest`，避免同类类型在多个 hook 内重复定义
- 结果：
  - `useAccountsPageState.ts` 从上一批的 `507` 行下降到 `237` 行，主 hook 现在主要负责状态装配和子 hook 组合
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`
- 当前剩余热点：
  - `useAccountsActions.ts` 仍然偏大，后续若继续拆分，应优先按 `api key mutations / auth file transfer / export` 三组边界继续细化
  - `AccountsPage.tsx` 还未迁到 `features/accounts`

### 第四批实施结果（2026-04-26）
- 新增目录与入口：
  - `frontend/src/features/accounts/AccountsFeature.tsx`
- 结构迁移：
  - `frontend/src/pages/AccountsPage.tsx` 已收缩为路由包装层，只负责转发 `sidecarStatus`
  - 原本位于 `pages/AccountsPage.tsx` 的装配逻辑已经迁到 `features/accounts/AccountsFeature.tsx`
- 调试映射同步：
  - `frontend/src/pages/SettingsPage.tsx` 中 `PAGE_ACCOUNTS` 的 source mapping 已改到 `src/features/accounts/AccountsFeature.tsx`
- 结果：
  - `pages/AccountsPage.tsx` 从装配大页收缩到 `10` 行
  - `features/accounts` 正式成为账号域的装配入口
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`
- 当前剩余热点：
  - `useAccountsActions.ts` 仍偏大
  - `features/accounts` 下的组件与 hooks 还没有继续按 `components / hooks / model` 子目录细分

### 第五批实施结果（2026-04-26）
- 目录归并：
  - 原 `frontend/src/pages/accounts/` 下的账号域组件、hooks、纯逻辑模块与测试文件已整体迁移到 `frontend/src/features/accounts/`
  - 空目录 `frontend/src/pages/accounts/` 已删除
- 入口与引用调整：
  - `frontend/src/features/accounts/AccountsFeature.tsx` 已改为只依赖 feature 内本地文件
  - `frontend/src/pages/StatusPage.tsx` 对账号域配置片段工具的引用已切到 `../features/accounts/model/accountConfig`
  - `frontend/package.json` 中 `test:unit` 的账号域测试路径已全部切到 `src/features/accounts/tests/*`
- 结果：
  - `features/accounts` 下当前共有 `25` 个文件，账号域前端已基本完成目录级收口
  - 代码与文档中的稳定 `pages/accounts` 路径引用已清空
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`
- 当前剩余热点：
  - `useAccountsActions.ts` 仍偏大，但已不阻塞目录级组件化

### 第六批实施结果（2026-04-26）
- 最终分层：
  - `frontend/src/features/accounts/components/`
  - `frontend/src/features/accounts/hooks/`
  - `frontend/src/features/accounts/model/`
  - `frontend/src/features/accounts/tests/`
- 收尾动作：
  - 原平铺目录下的账号域文件已全部按上述层级归位
  - 旧兼容层 `frontend/src/features/accounts/helpers.ts` 已删除
  - 账号域单测路径已统一迁到 `src/features/accounts/tests/*`
- 结果：
  - `features/accounts` 从“单目录平铺”升级为“feature 内部分层”
  - `pages/AccountsPage.tsx` 保持 10 行包装，`AccountsFeature.tsx` 作为唯一装配入口
  - `Phase 1` 的前端组件化与业务拆分已完成
- 本轮验证：
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run build`

### 第二批
- 拆 `internal/accounts/codex_quota.go`
- 对 `wailsapp` 内的 quota / auth file / key store 做桥接与领域下沉清理

## 8. 完成定义
- 本计划作为后续拆分工作的唯一基线文档
- 后续每进入一个 phase，都要先补对应计划或记录，再开始代码改造
- 每个 phase 完成后都要同步更新本 space、相关测试结果和 memory
