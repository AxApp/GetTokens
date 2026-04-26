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

### 1.4 本轮已验证的落地样例
- `AccountsPage` -> `features/accounts/AccountsFeature.tsx`
- `StatusPage` -> `features/status/StatusFeature.tsx`
- `SettingsPage` -> `features/settings/SettingsFeature.tsx`

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
