# Remove Request Orchestration

## 背景
2026-05-11 用户明确要求“完整移除请求编排这部分业务”，并要求本轮记录为新的 space。

此前 `20260502-request-orchestration-menu` 已完成 V1：独立一级菜单、前端工作台、Wails `apply / restore` 与本地配置快照。但进入 V2 评估后，用户决定不再保留这条业务线。

## 目标
1. 从产品入口中移除 `请求编排` 一级菜单。
2. 从前端删除请求编排页面、feature、模型、测试和本地 page persistence 入口。
3. 从 Wails / Go 层删除请求编排配置、快照、apply / restore 接口和测试。
4. 从生成绑定中删除对应 JS / d.ts / models 导出，避免前端仍可调用废弃 API。
5. 保留历史 space 作为归档，不删除历史需求、设计稿、截图和 debate。

## 范围
- 前端导航、页面路由、页面持久化与 unit tests。
- `frontend/src/features/request-orchestration/` 与 `frontend/src/pages/RequestOrchestrationPage.tsx`。
- `app_request_orchestration.go`、`internal/wailsapp/request_orchestration.go` 与对应测试。
- `frontend/wailsjs/go/main/App.js`、`frontend/wailsjs/go/main/App.d.ts`、`frontend/wailsjs/go/models.ts` 中的请求编排绑定。
- 文档、memory、qmd 索引。

## 非目标
- 不清理用户本机已有的 `~/.config/gettokens-data/request-orchestration/` 运行时残留文件。
- 不删除 `docs-linhay/spaces/20260502-request-orchestration-menu/` 历史归档。
- 不重做账号池、代理池或 relay routing 配置。
- 不处理本机 `npm run build` / Wails build 产物输出后进程不退出的既有风险。

## 验收标准
1. Given 用户打开应用，When 查看侧边栏，Then 不再看到 `请求编排` 一级菜单。
2. Given 本地存储或 URL hash 仍指向 `request-orchestration`，When 应用解析初始页面，Then 回退到默认页面而不是进入请求编排。
3. Given 前端单测运行，Then 不再引用 `frontend/src/features/request-orchestration/model.test.mjs`。
4. Given Go 测试运行，Then 不再存在请求编排 Wails 接口测试或实现。
5. Given 搜索业务代码，Then `RequestOrchestration` / `request-orchestration` 不再出现在前端、Go 业务代码和 Wails bindings 中。
6. Given 文档检查运行，Then 新 space 结构合法，旧 space 保持历史归档。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260511-remove-request-orchestration`
- worktree：`../GetTokens-worktrees/20260511-remove-request-orchestration/`

## 相关链接
- 历史归档：`docs-linhay/spaces/20260502-request-orchestration-menu/`
- 移除提交：本 space 对应的同轮提交

## 当前状态
- 状态：implemented
- 最近更新：2026-05-11
