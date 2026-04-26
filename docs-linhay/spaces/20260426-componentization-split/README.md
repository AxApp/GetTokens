# 组件化与业务拆分

## 背景
当前项目已经出现若干明显的大文件和大模块，前端主要集中在 `accounts` 域，后端主要集中在 `codex quota`、`sidecar manager` 与 `wailsapp` bridge。继续在这些热点文件上叠加需求，会同时放大改动半径、回归成本和认知负担，不利于后续组件化复用与业务边界稳定。

本 space 用于承载一轮“先治理结构、再承接迭代”的拆分工作，优先把高耦合热点从“大页面 / 大 hook / 大 helper / 大 bridge”收敛到可测试、可替换、可演进的 feature / domain / service 结构。

## 目标
- 基于当前仓库的大文件扫描结果，形成一版可执行的组件化与业务拆分计划
- 优先收敛 `accounts` 域前端结构，避免继续把状态、视图、格式化和副作用塞进单个 hook
- 收敛 Go 侧 `quota`、`sidecar`、`wailsapp` 的职责边界，减少 bridge 层承载领域逻辑
- 为后续按 feature 继续演进提供稳定目录和迁移顺序，降低回归风险

## 范围
- 前端：
  - `frontend/src/features/accounts/`
  - `frontend/src/features/accounts/components/`
  - `frontend/src/features/accounts/hooks/`
  - `frontend/src/features/accounts/model/`
  - `frontend/src/features/accounts/tests/`
  - `frontend/src/pages/AccountsPage.tsx`
  - `frontend/src/pages/StatusPage.tsx`
  - `frontend/src/pages/SettingsPage.tsx`
- 后端：
  - `internal/accounts/`
  - `internal/sidecar/`
  - `internal/wailsapp/`
- 文档：
  - 本 space 的 `README.md`
  - 本 space 的 `plans/`
  - 相关治理说明与后续回归记录

## 非目标
- 本轮不直接完成整仓库 package 重构或 monorepo 级拆分
- 本轮不为了“拆而拆”去重写稳定逻辑
- 本轮不把参考项目 `docs-linhay/references/` 纳入业务架构拆分范围
- 本轮不处理纯构建产物和依赖文件的结构优化，例如 `node_modules`、构建目录本身

## 验收标准
- 已形成一份明确的拆分阶段计划，说明优先级、目录目标、迁移顺序和测试门禁
- 已明确第一优先级是 `accounts` 前端域，第二优先级是 Go 侧 `quota / sidecar / wailsapp`
- 已给出每一阶段的完成定义，避免一次性大改
- 后续相关截图、计划、辩论与回归资料默认归档到本 space

## 相关链接
- [拆分计划 v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260426-componentization-split/plans/20260426-componentization-split-plan-v01.md)
- [docs-linhay 文档入口](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/README.md)
- [spaces 结构治理](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260424-spaces-structure-governance.md)
- [供应商配置与一键复制配置](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260426-provider-config-setup/README.md)

## 当前状态
- 状态：ready
- 最近更新：2026-04-26
- 补充：`accounts` 前端 Phase 1 已完成，目录已收敛到 `features/accounts/{components,hooks,model,tests}`，`pages/AccountsPage.tsx` 已回归路由包装层
- 补充：Go 侧 Phase 2 已完成，`internal/accounts/codex_quota.go` 已按 `types / auth parser / client / builder / debug` 拆分为独立文件，并通过 `go test ./internal/accounts ./internal/wailsapp ./internal/sidecar`
- 补充：Go 侧 Phase 3 已完成第一轮职责拆分，`internal/sidecar/manager.go` 已拆出 `config / port / process_support`，`internal/wailsapp/quota.go` 已拆出 `quota_support / quota_debug`
- 补充：前端 Phase 4 已完成页面装配层迁移，`StatusPage.tsx` 与 `SettingsPage.tsx` 已收敛为路由包装，主实现迁入 `features/status/StatusFeature.tsx` 与 `features/settings/SettingsFeature.tsx`
