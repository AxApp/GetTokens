# 20260705-extension-registry-refactor

## 背景

GetTokens Extension Registry 页面目前在一个页面内塞入了过多密集且结构混乱的信息，且右侧 Aside 极其臃肿（包含了 Dry-run、Roots、Diagnostics 以及 Selected Extension 详情）。
此外，列表项采用了 Button 嵌套 Button 的非标准 HTML 结构，存在交互和 a11y 上的隐患。页面的样式也残留了部分非 gt-* 的硬编码过渡样式。

## 目标

1. **样式与组件收敛**：全面迁移到 Ant Design 组件规范，只保留新的 `gt-*` 语义 Token，剔除任何裸 px 字号、过渡态样式及硬编码颜色。
2. **结构合理化与 Aside 减负**：
   - 列表项用标准的 Div / List.Item 代替 Button。
   - Selected Extension 详情重构为覆盖全视口的 Detail Modal（基于 hash 路由持久化 `detail=<id>` ），保持 Aside 简洁。
   - Aside 中仅保留：Codex Config Dry-run (Staged Temp Apply 嵌套在其内部)、Roots 以及 Registry Diagnostics 模块。
3. **保持测试兼容**：重构后保证 `featureSource.test.mjs` 与 `model.test.mjs` 中的断言能够正常工作。

## 范围

- `frontend/src/features/gettokens-extension-registry/GetTokensExtensionRegistryFeature.tsx` 的整体重构与拆分。
- `frontend/src/features/gettokens-extension-registry/featureSource.test.mjs` 的适配（如需要）。
- `docs-linhay/spaces/20260705-extension-registry-refactor/` 的文档及截图。

## 非目标

- 不改变已有的 Wails binding API 契约。
- 不影响 sidecar registry runtime core 的 Go 实现。

## 验收标准

- 页面只使用 AntD 组件及 `gt-*` Token 样式。
- 列表项无 Button 嵌套 Button 的 HTML 报错。
- 点击 Extension 打开覆盖全视口的 Detail Modal，Modal 可通过 `detail=<id>` 路由恢复。
- Aside 仅显示 Dry-run、Roots 和 Registry Diagnostics。
- `npm run typecheck` 通过（如果环境可用的话）。

## 设计稿入口

- 本期设计稿：`（未产出）`

## Worktree 映射

- branch：`feat/20260705-extension-registry-refactor`
- worktree：`../GetTokens-worktrees/20260705-extension-registry-refactor/`

## 相关链接

## 当前状态
- 状态：completed
- 最近更新：2026-07-06
- 已完成：Extension Registry 运行态崩溃修复、missing-id 详情选择、`detail=<id>` hash 打开/关闭、AntD `Collapse`/`Tabs` 弃用 API 清理、裸 px 字号与运行态 `transition-*` 清理、静态测试与浏览器预览验收。
- 门禁：`featureSource.test.mjs` 已锁定运行态源码不得回退到 `text-[数字px]`、`transition-*`、`Collapse.Panel` 或 `Tabs.TabPane`。
