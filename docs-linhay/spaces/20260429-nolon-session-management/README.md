# Nolon Session Management Research

## 背景

用户希望深入研究参考项目 `nolon` 中“会话管理”是如何实现的，并基于真实代码而不是口头描述，明确：

1. `nolon` 管理的“会话”对象到底是什么。
2. 会话扫描、聚合、缓存、详情、rewrite、CLI 对齐是如何串起来的。
3. 这套实现有哪些能力已经落地，哪些边界最容易被误解。

本轮研究对象位于本机参考仓库：

- `/Users/linhey/Desktop/FlowUp-Libs/nolon`

## 目标

1. 明确 `nolon` 的会话管理真实数据源与投影层边界。
2. 明确用户可见能力与 CLI 能力的对齐情况。
3. 明确 `rewrite` 的执行链、落点与风险。
4. 通过一次基于代码证据的 `debate` 产出结构化研究结论。

## 范围

- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift`
- `nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift`
- `nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift`
- `nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift`
- `nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCommands.swift`
- `nolon/docs-linhay/dev/codex-session-cli-and-scanner-alignment-2026-04-11.md`
- `nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md`

## 非目标

1. 本轮不修改 `GetTokens` 现有实现。
2. 本轮不直接复刻 `nolon` 的整套会话页 UI。
3. 本轮不把 `Codex Sessions` 与 `Codex Usage` 完全混成一个问题，只在必要处讨论它们共享的数据链路。

## 验收标准

1. 能准确说明 `nolon` 会话管理的真源、投影层、缓存层与 UI 状态层。
2. 能列出当前已实现的核心会话管理功能，而不是泛泛而谈。
3. 能说明 `rewrite` 为什么是文件与数据库双写的一条完整链路。
4. 已在本 space 下产出一份 `debate` 纪要，记录代码证据、共识和开放问题。

## 相关链接

- [nolon README](/Users/linhey/Desktop/FlowUp-Libs/nolon/README.md)
- [CodexSessionScanner.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionScanner.swift)
- [CodexSessionStore.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexSessionStore.swift)
- [CodexSessionsTabViewModel.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabViewModel.swift)
- [CodexSessionsTabView.swift](/Users/linhey/Desktop/FlowUp-Libs/nolon/nolon/Skills/Domain/Providers/Views/CodexSessionsTabView.swift)
- [codex-session-cli-and-scanner-alignment-2026-04-11.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-session-cli-and-scanner-alignment-2026-04-11.md)
- [codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md](/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-sessions-detail-panel-file-split-and-ui-refine-2026-04-19.md)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-29
