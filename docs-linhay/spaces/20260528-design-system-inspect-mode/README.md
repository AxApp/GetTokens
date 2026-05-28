# 20260528-design-system-inspect-mode

## 背景
设计系统已经有 Storybook 组件工作台、运行时 `data-design-system-component` 标记，以及开发态 `@linhey/react-debug-inspector` 注入的 `data-debug` 源码定位信息。

当前缺口是设计系统入口没有把 inspect 模式作为明确能力暴露出来。开发者需要从设计系统页直接进入元素定位状态，悬浮元素查看源码路径、组件名、标签与行号，并能复制定位 ID。

## 目标
1. 设计系统页提供明确的 inspect 入口。
2. 开发态 Web 入口可通过 URL 参数自动进入 inspect 模式。
3. inspect 模式复用现有 `@linhey/react-debug-inspector` 与 `data-debug` 注入链路，不另建一套定位协议。
4. 自动化测试约束入口、初始化与 Vite 注入链路，避免后续退化。

## 范围
1. `frontend/src/features/design-system/` 下的入口 URL、文案和初始化桥接。
2. `frontend/src/main.tsx` 的开发态 inspector 初始化。
3. `frontend/src/features/design-system/storyCatalog.test.mjs` 的回归测试。

## 非目标
1. 不改 Storybook 自身工具栏或 addon。
2. 不把 inspect 模式带入生产构建。
3. 不替换运行时设计系统组件高亮与 label copy 机制。

## 验收标准
1. Given 开发者在设计系统页点击“Inspect Elements”，When Web 入口打开，Then URL 带有 `inspect=design-system`，应用在开发态自动进入元素定位模式。
2. Given inspect 模式激活，When 鼠标悬浮支持 `data-debug` 的元素，Then 页面显示源码定位信息；点击元素可复制完整 debug id。
3. Given 非开发环境，When 应用启动，Then 不初始化 inspect 工具，不影响 Wails 生产运行。
4. Given 后续改动设计系统入口，When 运行设计系统单元测试，Then 必须验证 inspect URL、初始化 helper 与 Vite `data-debug` 插件仍存在。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260528-design-system-inspect-mode`
- worktree：`../GetTokens-worktrees/20260528-design-system-inspect-mode/`

## 相关链接
- 技术说明：`docs-linhay/dev/20260528-design-system-inspect-mode.md`
- 验收截图：`screenshots/20260528/design-system/20260528-design-system-inspect-mode-after-v01.png`

## 当前状态
- 状态：done
- 最近更新：2026-05-28
