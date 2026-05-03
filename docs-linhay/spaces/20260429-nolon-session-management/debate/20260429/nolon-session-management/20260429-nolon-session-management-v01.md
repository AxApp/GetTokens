# Nolon Session Management Debate

**日期**：20260429
**模式**：合作型
**参与者**：Galileo（独立参与者 A） / Faraday（独立参与者 B） / Codex（主持人）
**总轮次**：1 / 60
**结束原因**：第 1 轮形成事实收敛；两位参与者均认可核心结论，无实质分歧

## 执行元数据
- 候选参与者：Gemini CLI / Claude Code / GitHub Copilot CLI
- 首轮实际启用：Gemini CLI / Claude Code / GitHub Copilot CLI
- 后续 active participants：Galileo / Faraday
- 淘汰参与者：Gemini CLI / Claude Code / GitHub Copilot CLI
- 不可用原因：
  - `Gemini CLI`：需要交互式认证，首轮无法无阻塞执行
  - `Claude Code`：默认模型 `claude-opus-4-6[1m]` 当前环境不可用
  - `GitHub Copilot CLI`：缺少 GitHub 认证信息

## 辩论背景
> 本轮围绕参考项目 `nolon` 的“会话管理”实现做代码级研究。目标不是泛谈“有个 sessions 页”，而是澄清：它实际管理的对象是什么、真实数据源在哪、缓存与 UI 状态如何分层、用户可见能力有哪些、rewrite 为什么是一条多介质迁移链路，以及 CLI 与 UI 是否真正对齐。

## 各轮观点记录

### 第 1 轮
**[Galileo]**
- 论点：`CodexSessionRecord` 是 `CodexSessionStore` 聚合产物，不是单一文件直读对象。
  - 引用：[CodexSessionScanner.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift:138)、[CodexSessionScanner.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift:189)、[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:1218)
  - 代码事实：scanner 只读首个 `session_meta`；store 再用 state index/session index 补标题、provider、更新时间、stateRowCount。
  - 结论：rollout 提供会话身份入口，但对外口径是 store 聚合出的 session record。
- 论点：projection cache、usage index、ViewModel 交互态已经明确分层。
  - 引用：[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:818)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:1025)、[codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md:45)
  - 代码事实：列表首屏优先 cached snapshot/skeleton；usage index 只做 usage/timeline 预热；ViewModel 单例负责 refresh、selection、expanded state。
  - 结论：列表展示真源已经前移到 projection cache，而不是每次直扫。
- 论点：project 分组只是 UI projection，不是 rewrite 的天然安全边界。
  - 引用：[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:136)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:1676)
  - 代码事实：当前 SwiftUI ViewModel 只有 `project/provider`；多 provider project section 会失去 group rewrite 资格。
  - 结论：project 分组是浏览视图，不是底层会话结构。
- 论点：rewrite 是 preview -> rollout 文件 -> state db -> verify 的多阶段链路，不是原子事务。
  - 引用：[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:1350)、[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:1907)、[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:2038)
  - 代码事实：先 preview，再按 threadID 定位 rollout 文件，改 `session_meta.model_provider`，再改 SQLite `threads.model_provider`，最后一致性校验；失败可部分累计。
  - 结论：rewrite 是多介质迁移，存在部分成功风险。
- 论点：CLI 与 UI 在 rewrite 引擎上对齐，但 grouping 语义已经漂移。
  - 引用：[codex-session-cli-and-scanner-alignment-2026-04-11.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-session-cli-and-scanner-alignment-2026-04-11.md:22)、[NolonCodexCommands.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCommands.swift:244)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:136)
  - 代码事实：CLI 仍暴露 `time-project`；当前 SwiftUI ViewModel 只有 `project/provider`。
  - 结论：CLI/UI 对 rewrite 成立，对 grouping 不成立。

**[Faraday]**
- 论点：首屏加载是“View 触发，ViewModel 统一编排，先缓存后对账”。
  - 引用：[CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift:61)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:784)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:1033)
  - 代码事实：appearance 只调用 `handleViewAppearance()`；后者优先重放缓存，再判断是否 stale refresh。
  - 结论：首屏责任不在 View，而在 ViewModel 的缓存编排。
- 论点：首次无缓存时是“骨架占位 + 流式增量 + 落盘缓存”的渐进加载。
  - 引用：[CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift:153)、[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:875)、[CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift:1254)
  - 代码事实：先 project skeleton，再订阅 `snapshotStream`，最终持久化 projection snapshot / skeleton snapshot。
  - 结论：真实首屏不是一次性 blocking scan。
- 论点：用户动作收敛为概览级、分组级、行级、详情级四类。
  - 引用：[CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift:26)、[CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift:233)、[CodexSessionsSectionDataBuilder.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsSectionDataBuilder.swift:27)
  - 代码事实：有 refresh/group/sort/search、group rewrite/copy IDs/open folder、row rewrite/show in finder/select/expand、detail 中的 `Resume/Copy Command/Show in Finder`。
  - 结论：View 主要做接线，动作语义由 ViewModel/Store 决定。
- 论点：详情是行内展开而不是独立页面，是刻意的信息架构选择。
  - 引用：[CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift:266)、[codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md:24)、[codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md:180)
  - 代码事实：只渲染当前选中行的 detail panel；文档明确“不改行内展开机制”，并强调这是条目延展，不是第二张卡。
  - 结论：详情与列表一体化是有意设计，不是过渡态。
- 论点：section 级 rewrite 是否出现，来自聚合后的业务约束，而不是展示层随意决定。
  - 引用：[CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift:1463)、[CodexSessionsSectionDataBuilder.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsSectionDataBuilder.swift:28)
  - 代码事实：多 provider section 不设置 `rewriteSourceProviderID`，也不会生成 section actions。
  - 结论：UI 上“有些组能 Move Group，有些组只能 Move Session”是业务边界映射，不是视觉规则。

## 共识检测
- Galileo：认同摘要核心结论；状态 `部分共识`；无实质反对，仅保持谨慎措辞
- Faraday：认同摘要核心结论；状态 `部分共识`；无实质反对，仅保持谨慎措辞
- 主持人裁定：两位参与者均回答“是 / 无分歧点”，因此按合作型 debate 视为已达事实共识

## 最终结论与行动项

### 达成共识 / 裁定结论
- `nolon` 的会话管理，对外管理的不是“原始 rollout 文件集合”，而是 `CodexSessionStore` 聚合出来的 `CodexSessionRecord` / `Snapshot` / `Timeline` / `Usage` 这一组 provider 级投影。
- 真正的身份入口来自 rollout `session_meta`；标题、provider、更新时间、state row 数、logical usage 等信息会由 state SQLite、session index、usage index 继续补全。
- 列表首屏已经不是“每次直扫磁盘”，而是 `projection cache -> skeleton -> snapshot stream -> reconcile` 的分层加载链路。
- 当前用户可见能力至少包括：
  - 分组：`project` / `provider`
  - 排序：`recent` / `usage`
  - 搜索
  - 行内详情
  - `Resume`
  - `Copy Command`
  - `Show in Finder`
  - section/row 级 provider rewrite
  - 复制 thread IDs / 打开项目目录 / 分享 section 或 session
- rewrite 不是内存态切换，而是：
  - preview 命中范围
  - 按 threadID 重新解析 rollout 文件集合
  - 改 live/archived rollout 中首条 `session_meta`
  - 改 state db `threads.model_provider`
  - 做一致性校验与缓存失效
- rewrite 的最大风险不是“会不会弹窗确认”，而是它本质上是多介质、非事务、允许部分失败的迁移链路。
- CLI 与 UI 共享同一个底层 rewrite 引擎，但 grouping 已经出现漂移：
  - CLI 文档与命令面仍保留 `time-project`
  - 当前 SwiftUI ViewModel 只剩 `project/provider`

### 行动项
| # | 行动 | 负责方 | 截止 |
|---|------|--------|------|
| 1 | 继续核对 `time-project` 是否是产品口径回退还是 UI 实现漂移 | 后续研究 | 待定 |
| 2 | 继续核对 `summary` 字段为何在详情层保留但 store 当前不产出 | 后续研究 | 待定 |
| 3 | 若未来要借鉴到 GetTokens，优先借鉴“scan/store/cache/viewmodel 分层”与“rewrite 先 preview 再落盘”的边界，而不是直接照搬 UI | 后续设计 | 待定 |

### 未解问题
- `summary` 字段当前在详情层预留，但 store 聚合时仍写死为 `nil`，需确认是否存在未接入的数据源。
- 当前只重写第一条可命中的 `session_meta`，若未来 rollout 结构变化或出现多条 `session_meta`，一致性校验可能不够强。
- 文档所说“usage/search/sort 预热”与当前实现的实际边界可能不完全一致，尤其搜索是否真的依赖 usage index 仍需再核实。
