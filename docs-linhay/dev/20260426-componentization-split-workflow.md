# 组件化与业务拆分工作流

## 背景
`20260426-componentization-split` 这轮工作沉淀出了一套可复用的拆分顺序，适合后续继续治理 `GetTokens` 的页面层和 Go 侧大文件。

这份文档不描述单个需求，而是记录“怎么拆”。

## 1. 前端页面到 feature 的迁移顺序

### 1.1 目标边界
- `frontend/src/pages/*` 只保留路由包装职责
- 重型页面装配、数据加载、副作用、派生状态、mutation 编排放在 `frontend/src/features/<domain>/`
- feature 内部优先按以下二级结构分层：
  - `components/`
  - `hooks/`
  - `model/`
  - `tests/`

### 1.2 推荐步骤
1. 先把原页面主体迁到 `features/<domain>/<Domain>Feature.tsx`
2. 把原 `pages/<Domain>Page.tsx` 收缩为 prop-forwarding wrapper
3. 把 feature 内的纯逻辑从超级 hook 或大 helper 中拆到 `model/`
4. 再把状态编排拆到 `hooks/`
5. 最后把重型展示拆到 `components/`

### 1.3 拆分原则
- 优先先拆纯逻辑，再拆状态编排，再拆目录结构
- 第一轮不改对外调用契约，先做内部职责收口
- 避免重新引入 `helpers.ts` 式 catch-all 文件
- 页面迁移完成后，要同步更新调试源码映射和测试路径

### 1.3.1 超大 feature 的优先拆分刀法
- 当单个 feature 文件已经同时混有本地持久化、编辑弹层、数据加载和大段 JSX 时，先拆 `model/<domain>LocalState.ts` 一类的本地状态模块，把 `localStorage`、默认值、序列化和 editor state 类型收口。
- 第二刀优先拆一组强内聚的弹层或独立面板，例如 `components/RelayEditors.tsx`，让主 feature 只保留状态编排和回调，不在入口文件里铺开几百行 modal JSX。
- 如果页面仍然过大，再继续拆摘要卡片、配置面板、列表区；不要第一刀就把一个大文件切成很多薄碎组件，避免 props 面爆炸。

### 1.3.2 带弹层的面板拆分要把 overlay ownership 一起迁走
- 如果某个配置面板内部带下拉菜单、listbox、popover 或日期面板，不要只把静态 JSX 抽出去，最好把该弹层的开关状态、外点关闭逻辑和定位容器也一起收进新组件。
- 这样主 feature 不会继续持有“纯视图级 UI state”，而且更容易在组件内直接排查 `overflow / z-index / click outside` 问题。
- 拆完后第一轮优先检查：
  1. 外层卡片是否仍然是 `overflow-hidden`
  2. 弹层是否依赖主文件里的 ref 才能关闭
  3. 交互验收是否需要浏览器实测而不是只看 JSX

### 1.3.3 已经上线的大 feature，优先按“减负顺序”拆，不要一次打散
当一个 feature 已经接上真实数据、Wails bridge、浏览器 fallback 和交互弹层时，推荐按下面顺序做减负，而不是第一刀就切成很多碎文件：

1. 先保住页面壳和真实数据链可用  
   不先动 bridge / fallback / page shell 的验收闭环。
2. 先抽重型展示层  
   例如 `SessionManagementView.tsx`，把大段列表、弹层、面板 JSX 从 controller 挪走。
3. 再抽 copy 和纯 helper  
   例如 `sessionManagementCopy.ts`、`sessionManagementUtils.ts`，把文案工厂、空态常量、过滤器、纯格式化函数拿走。
4. 再抽强内聚 mutation hook  
   例如 `useSessionManagementProviderMerge`，把“打开弹窗 / 编辑草稿 / 保存写回 / 错误处理”收成一条业务行为链。
5. 再抽数据加载 hook  
   例如 `useSessionManagementSnapshot`、`useSessionManagementDetail`，把请求状态、并发保护、缓存写回从 controller 拿走。
6. 最后再考虑 view-state hook  
   只在 `activeProject / visibleSessions / selectedSummary / modalProjectName` 这类派生状态已经明显压主文件时再拆。

这套顺序的目的不是追求“文件越多越好”，而是让主 `*Feature.tsx` 稳定退化成 page controller：
- 持有少量页面级选择状态
- 组织 hooks
- 组织组件装配
- 保留少量 effect 和边界判断

如果一开始就直接拆很多细碎 hooks / components，往往会在 props、依赖和边界判断上重新制造一层噪音。

### 1.4 本轮已验证的落地样例
- `AccountsPage` -> `features/accounts/AccountsFeature.tsx`
- `StatusPage` -> `features/status/StatusFeature.tsx`
- `SettingsPage` -> `features/settings/SettingsFeature.tsx`
- `SessionManagementFeature.tsx`
  - 第一轮：接页面壳、真实数据、dev bridge、provider 写回
  - 第二轮：抽 `SessionManagementView.tsx`
  - 第三轮：抽 `sessionManagementCopy.ts`、`sessionManagementUtils.ts`
  - 第四轮：抽 `useSessionManagementProviderMerge.ts`
  - 第五轮：抽 `useSessionManagementSnapshot.ts`、`useSessionManagementDetail.ts`

## 2. Go 大文件拆分顺序

### 2.1 适用信号
当一个 Go 文件同时包含以下 3 类以上职责时，优先考虑拆分：
- 外部 IO / HTTP 请求
- token / payload 解析
- 业务规则判断
- DTO / response 组装
- debug / redaction
- 配置写入
- 进程生命周期

### 2.2 推荐模板

#### quota / parser 型
- `types`
- `auth parser`
- `client`
- `builder`
- `debug`

#### sidecar / lifecycle 型
- `config`
- `port`
- `process_support`

### 2.3 拆分原则
- 第一轮拆分保持导出方法签名不变
- 先切内部职责边界，再考虑 API 设计重写
- 先让原测试继续兜底，再决定是否补更细粒度测试文件
- 每拆一刀都要立刻跑包级测试，避免把结构调整和行为改写混在一起

### 2.4 本轮已验证的落地样例
- `internal/accounts/codex_quota.go`
  - `quota_types.go`
  - `quota_auth_parser.go`
  - `quota_client.go`
  - `quota_builder.go`
  - `quota_debug.go`
- `internal/sidecar/manager.go`
  - `config.go`
  - `port.go`
  - `process_support.go`
- `internal/wailsapp/quota.go`
  - `quota_support.go`
  - `quota_debug.go`
- `app.go`
  - `app_types.go`
  - `app_mappers.go`

## 3. 验证顺序

### 前端
- `npm run test:unit`
- `npm run typecheck`
- `npm run build`

### 后端
- 先跑直接受影响包
- 再跑相邻 bridge / lifecycle 包

当前常用组合：
- `go test ./internal/accounts`
- `go test ./internal/accounts ./internal/wailsapp ./internal/sidecar`

## 4. 何时不该上升到 AGENTS
- 还只是当前 repo 的实现偏好，而不是所有任务都成立的长期规则
- 仍然可能随着目录结构继续演进而调整
- 更适合沉到 skill 或研发文档，而不是 repo-wide 强约束

本轮结论：
- 该工作流已经足够稳定，适合写入 skill 和 `docs-linhay/dev/`
- 但暂不需要更新 `AGENTS.md`
