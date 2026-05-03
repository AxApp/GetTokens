# 2026-05-02 Account Pool Page Refactor

## 背景
账号池已经积累了 `codex` 资产、`openai-compatible` provider、轮动配置、quota 视图、详情弹窗与工作区切换等多层职责。当前页面虽然功能逐步补齐，但信息架构、交互入口、状态归属和组件边界仍然偏散，继续叠功能会放大维护成本。

这轮工作单独开一个日期化 space，用来承接“账号池页面改造”这次实现周期，避免与长期 `account-pool` 总纲 space 混写。

## 目标
为账号池页面建立一轮独立改造空间，收敛本轮需求边界、交互目标、实现计划、截图和验收记录。

在进入代码改造前，先明确：

- 本轮页面改造覆盖哪些账号池入口与工作区
- 哪些是信息架构 / 视觉交互调整
- 哪些会触发 Wails / sidecar / 状态流边界改动
- 最终验收需要哪些自动化验证与截图产物

## 范围
- `frontend/src/pages/AccountsPage.tsx`
- `frontend/src/features/accounts/`
- 账号池聚合页与相关 workspace 的页面结构、入口组织和交互闭环
- 账号池页面改造过程中新增的计划文档、截图和 debate 记录

若页面改造涉及以下内容，也纳入本轮范围：

- 账号池路由包装与 workspace 切换方式
- `codex` / `openai-compatible` 区块的信息密度与操作入口重排
- 账号详情、轮动入口、provider workspace 的页面级编排
- 为本轮页面改造补充或调整的前端测试

## 非目标
- 不在本 README 中直接定义完整视觉稿；设计稿另行放到本 space 根目录的单一 HTML 文件
- 不在本轮默认承诺改造 sidecar 原生路由策略语义
- 不把长期账号池领域总规则搬迁到本 space；长期规则继续留在 `docs-linhay/spaces/account-pool/`、`docs-linhay/dev/` 与项目级 skill
- 不在没有明确需求和验收标准前，顺手重做全部账号领域模型或 sidecar 管理接口

## 验收标准
1. 本轮账号池页面改造的需求边界、目标与非目标在本 space README 中可追踪。
2. 后续实现计划统一落到 `plans/`，不再散落到聊天记录中。
3. 若页面改造涉及视觉或交互调整，验收截图统一落到本 space 的 `screenshots/`。
4. 若实现过程中需要多 agent 讨论或方案取舍，记录统一落到本 space 的 `debate/`。
5. 当代码改造开始后，相关自动化验证、Wails 验收结论和收尾说明可回链到本 space。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260502-account-pool-page-refactor`
- worktree：`../GetTokens-worktrees/20260502-account-pool-page-refactor/`

## 相关链接
- 长期总纲：`docs-linhay/spaces/account-pool/README.md`
- 组件化参考：`docs-linhay/spaces/20260502-frontend-componentization-refactor/README.md`

## 当前状态
- 状态：superseded
- 最近更新：2026-05-02
- 说明：用户已将本轮方向更正为“新开菜单做请求编排”，本 space 不再作为当前实施入口
