# Nolon Session Management Research

## 背景

本 space 用于研究参考项目 `nolon` 中“会话管理”是如何实现的，并基于真实代码而不是口头描述，回答以下问题：

1. `nolon` 管理的“会话”对象到底是什么。
2. 会话扫描、聚合、缓存、详情、rewrite、CLI 对齐是如何串起来的。
3. 这套实现有哪些能力已经落地，哪些边界最容易被误解。

本轮研究对象位于本机参考仓库：

- `/Users/linhey/Desktop/FlowUp-Libs/nolon`

## 目标

1. 明确 `nolon` 的会话管理真实数据源与投影层边界。
2. 明确用户可见能力与 CLI 能力的对齐情况。
3. 明确 `rewrite` 的执行链、落点与风险。
4. 产出可被 GetTokens 后续复用的结构化研究结论。

## 范围

1. `CodexSessionScanner`
2. `CodexSessionStore`
3. `CodexSessionsTabViewModel` / `CodexSessionsTabView`
4. `NolonCodexCommands`
5. 相关设计文档、测试与 autoresearch 归档
6. 基于上述事实产出的 GetTokens 视角设计稿与结论整理

## 当前非目标

1. 当前这一步不接真实 session 数据流、扫描链路或 rewrite 执行。
2. 当前这一步不直接复刻 `nolon` 的整套会话页 UI。
3. 当前这一步不把 `Codex Sessions` 与 `Codex Usage` 完全混成一个问题，只先建立导航入口与页面骨架。

## 验收标准

1. 能准确说明 `nolon` 会话管理的真源、投影层、缓存层与 UI 状态层。
2. 能列出当前已实现的核心会话管理功能，而不是泛泛而谈。
3. 能说明 `rewrite` 为什么是文件与数据库双写的一条完整链路。
4. 已在本 space 下产出研究纪要、autoresearch 归档和单一设计稿入口。
5. GetTokens 已先落第一步前端接入：侧边栏入口、workspace hash 与占位页骨架可用。

## 当前裁定

### 实现边界
1. `nolon` 的会话管理不是聊天式 CRUD，而是一套围绕本地 Codex rollout / state / usage 索引建立的 session 投影与治理系统。
2. 真源不止一个介质，但最终对外的会话对象由 `CodexSessionStore` 统一投影。
3. `projection cache` 与 `usage index` 都是可丢弃的加速层，不是 source of truth。
4. UI 与 CLI 是两套入口，但底层会话扫描、rewrite、usage 聚合没有分叉成两套实现。

### 容易被误解的四个点
1. `summary` 目前不是首屏稳定数据。
2. 搜索不是全文检索。
3. `usage index` 不是列表主快照。
4. `rewrite` 不是事务性迁移，而是多介质 staged rewrite + verify。

### 当前交付结论
1. 这轮研究已经足够支撑“完整分析完成”的判断。
2. 更长的代码证据、delta 语义、去重语义、层级矩阵和演进时间线，统一下沉到 `plans/20260429-nolon-session-management-autoresearch-summary-v01.md`。
3. 当前视觉交接只保留一个 HTML 主入口，不再拆分 `option-a/b/c` 平行文件。

### 当前实现进度
1. 已把设计稿里的侧边栏层级先接入 GetTokens：
   - 顶层 `会话管理`
   - 子项 `codex sessions`
   - 子项 `provider groups`
2. 已接通 `session-management` 页面 hash、workspace fallback 与本地持久化，不是纯视觉假入口。
3. 当前正文仍是第一阶段占位页，只用于承接导航结构和后续真实页面实现。

## 设计稿入口

- 本期设计稿：`design-preview.html`
- 约束：本期只保留这一个 HTML 主入口；当前已经从模块比较稿收口成单页真实页面稿，用于判断整体主次、信息密度和工作台气质。

## Worktree 映射

- branch：`feat/20260429-nolon-session-management`
- worktree：`../GetTokens-worktrees/20260429-nolon-session-management/`

## 相关链接

- [design-preview.html](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/design-preview.html)
- [debate v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/debate/20260429/nolon-session-management/20260429-nolon-session-management-v01.md)
- [autoresearch summary v01](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/plans/20260429-nolon-session-management-autoresearch-summary-v01.md)
- [autoresearch results](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/plans/20260429-nolon-session-management-autoresearch-results-v01.tsv)
- [autoresearch state](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260429-nolon-session-management/plans/20260429-nolon-session-management-autoresearch-state-v01.json)
- [nolon README](/Users/linhey/Desktop/FlowUp-Libs/nolon/README.md)
- [CodexSessionScanner.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift)
- [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift)
- [CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift)
- [CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift)
- [NolonCodexCommands.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCommands.swift)

## 当前状态

- 状态：research-complete-first-shell-landed
- 最近更新：2026-04-29
