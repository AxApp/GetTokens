# 20260528-storybook-remove-business-components

## 背景
`http://127.0.0.1:6006/` 当前由 Storybook 直接加载 `../src/**/*.stories.@(ts|tsx|mdx)`，导致 `frontend/src/features/**` 下的全量业务组件都出现在设计系统工作台中。

这让 6006 入口承担了过多业务验收内容。当前要求是移除全量业务组件，只保留设计系统基础层：tokens、基础样式和通用 UI 组件。

## 目标
1. Storybook 6006 不再显示 `Design System/业务组件/*`。
2. Storybook 配置不再使用全量 `src/**/*.stories`。
3. 业务设计系统任务交给 `http://127.0.0.1:5173/#frame=design-system`，应用内 5173 catalog 继续保留 `feature-components` 分组。
4. 业务组件 story 文件暂不删除，作为历史/后续定向验收素材保留。

## 范围
1. `frontend/.storybook/main.ts` 的 stories include 范围。
2. `frontend/src/features/design-system/storyCatalog.ts` 的公开目录分组。
3. `frontend/src/features/design-system/storyCatalog.test.mjs` 的回归约束。

## 非目标
1. 不删除 `frontend/src/features/**/**/*.stories.tsx` 文件。
2. 不改运行时业务组件的 `data-design-system-component` 标记。
3. 不整理 `componentManifest.ts` 的历史收编记录。

## 验收标准
1. Given 打开 `http://127.0.0.1:6006/`，When 查看侧栏，Then 不出现 `Design System/业务组件` 分组。
2. Given 构建 Storybook，When 读取 `storybook-static/index.json`，Then 不包含任意 `Design System/业务组件/*` story。
3. Given 打开 `http://127.0.0.1:5173/#frame=design-system`，When 查看应用内设计系统页，Then 业务组件仍由 `feature-components` 分组承接。
4. Given 后续新增 story，When 运行设计系统单元测试，Then `frontend/.storybook/main.ts` 不能回退到 `../src/**/*.stories` 全量加载。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260528-storybook-remove-business-components`
- worktree：`../GetTokens-worktrees/20260528-storybook-remove-business-components/`

## 相关链接
- 技术边界：[`docs-linhay/dev/20260528-storybook-public-catalog-scope.md`](../../dev/20260528-storybook-public-catalog-scope.md)
- 验收截图：[`screenshots/20260528/design-system/20260528-storybook-no-business-components-after-v01.png`](screenshots/20260528/design-system/20260528-storybook-no-business-components-after-v01.png)

## 当前状态
- 状态：done
- 最近更新：2026-05-28

## 验收记录
1. `frontend/.storybook/main.ts` 已从全量 `../src/**/*.stories.@(ts|tsx|mdx)` 收敛为 tokens、primitives、`components/ui` 三类基础入口。
2. `frontend/src/features/design-system/storyCatalog.ts` 继续保留 `feature-components` 分组，业务设计系统任务归口到 5173 应用开发态入口。
3. `storybook-static/index.json` 和 live `http://127.0.0.1:6006/index.json` 均验证为 36 条 story，且不包含 `Design System/业务组件`、`feature-components` 或 `frontend/src/features`。
4. 截图已归档到本 space 的 `screenshots/20260528/design-system/` 目录。
