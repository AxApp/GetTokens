# Storybook 公开目录范围

## 背景
`http://127.0.0.1:6006/` 是设计系统公开工作台入口，不再承担全量业务组件验收。此前 Storybook 通过 `../src/**/*.stories.@(ts|tsx|mdx)` 加载所有 story，导致 `frontend/src/features/**` 下的业务组件全部进入 6006 侧栏。

## 当前边界
6006 只加载以下三类 story：

1. `frontend/src/stories/tokens/**/*.stories.@(ts|tsx|mdx)`
2. `frontend/src/stories/primitives/**/*.stories.@(ts|tsx|mdx)`
3. `frontend/src/components/ui/**/*.stories.@(ts|tsx|mdx)`

6006 的公开 Storybook catalog 只统计 tokens、基础样式和通用 UI 组件。业务设计系统任务交给 `http://127.0.0.1:5173/#frame=design-system`，应用内 5173 catalog 继续保留 `feature-components` 分组。

## 保留策略
`frontend/src/features/**/**/*.stories.tsx` 暂不删除。这些 story 仍可作为 feature-owned 的内部验收素材、历史 mock 数据和 5173 业务设计系统入口的定向收编参考，但不能通过 6006 的默认公开目录暴露。

`componentManifest.ts` 中已有的业务组件收编记录暂时保留，用于追踪历史设计系统资产和 mock 状态。后续如果要重新开放某个业务组件，必须先明确它已经从业务域抽象为通用组件，再移动到允许的公开 story 目录。

## 回归约束
`frontend/src/features/design-system/storyCatalog.test.mjs` 负责锁定以下规则：

1. Storybook 配置不能回退到 `../src/**/*.stories.@(ts|tsx|mdx)`。
2. Storybook 配置不能包含 `features/**`。
3. 5173 应用内 catalog 必须保留 `feature-components`，用于承接业务设计系统任务。
4. 6006 的 Storybook 配置和构建产物不能包含 `Design System/业务组件`、`feature-components` 或 `frontend/src/features/`。

## 会话沉淀
本轮沉淀到项目级 skill 的稳定模式是“设计系统双入口分工”：

1. `6006` 是公开基础 Storybook，只服务 tokens、primitives、`components/ui`。
2. `5173/#frame=design-system` 是应用开发态设计系统入口，继续承接业务组件、inspect 模式和 feature-owned catalog。
3. 后续处理业务组件设计系统时，不要为了让 6006 变干净而删除 `feature-components`、`componentManifest.ts` 记录或 feature-owned story 文件。
4. 回归验证必须同时检查 6006 的排除结果和 5173 的保留结果，避免“从一个入口移除”误变成“从设计系统移除”。

不纳入长期规则的内容：

1. 本轮截图文件名、具体 story 数量 `36` 只是本次验收事实，不作为长期固定值。
2. 本轮在脏工作区中用定向暂存提交，是通用 Git 卫生动作，不额外提升为设计系统规则。
