# Design System Storybook Session Distillation

## 背景
本轮从“换肤 / 主题要提上日程”开始，先建立 `20260519-theme-skinning` space，再扩展出 `20260519-design-system-workbench` space。讨论过程中出现了一个重要偏好：当成熟专业工具明显适合当前问题时，应该主动建议，而不是默认保守自研。

## 本次沉淀的可复用模式
### 1. 专业工具主动建议
当问题已经落到某个成熟工具的核心能力范围内时，agent 应主动提出该工具，并解释它解决了哪些自研成本。

本次案例：

1. 设计系统需要组件工作台、Docs、Controls、主题预览、稳定 story URL 和截图入口。
2. Storybook 正是这类问题的成熟工具。
3. 初始方案过于保守，把 Storybook 放到二期；用户明确表示可接受这类“认知边界之外”的专业建议。
4. 方案随即升级为 Storybook 主工作台 + 应用内入口。

后续规则：

1. 先检查成熟工具和官方方案。
2. 如果工具直接命中问题核心，直接建议，不把“用户没提过这个词”当作不建议的理由。
3. 同时给出风险、边界和回滚方式，避免盲目引入依赖。

### 2. 设计系统工作台边界
GetTokens 的设计系统工作台不应该自研完整组件预览器。当前稳定边界：

1. Storybook 是主工作台。
2. 应用内 `design-system` 路由只做入口、说明、启动命令、覆盖矩阵和截图路径。
3. stories 渲染真实组件，不复制静态 HTML。
4. stories 使用 mock 数据，不调用 Wails / sidecar。
5. 第一批覆盖 `frontend/src/components/ui` 和 token stories，业务组件后置。

### 3. 旧方案保留但标记取代
当一个 space 内出现方案升级时，不直接删除旧文档。更好的做法是：

1. 新增 `v02` 文档承载当前方案。
2. 在旧 `v01` 顶部标记已被取代。
3. README 指向当前方案，同时保留历史链接。
4. memory 记录方案升级原因。

本次已应用到：

1. `docs-linhay/spaces/20260519-design-system-workbench/plans/20260519-design-system-workbench-technical-design-v01.md`
2. `docs-linhay/spaces/20260519-design-system-workbench/plans/20260519-design-system-workbench-technical-design-v02.md`
3. `docs-linhay/spaces/20260519-design-system-workbench/plans/20260519-design-system-workbench-plan-v01.md`
4. `docs-linhay/spaces/20260519-design-system-workbench/plans/20260519-design-system-workbench-plan-v02.md`

## 不纳入沉淀的内容
1. 本次没有把 Storybook 具体版本锁定为长期规则；实现时以当时 `package-lock.json` 和官方 React/Vite 文档为准。
2. 本次不把“所有外部工具都优先引入”升级为规则；只针对成熟工具直接命中问题核心的场景。
3. 本次不把应用内 `design-system` 路由是否正式用户可见写入 AGENTS；这是后续产品/发布边界。

## Skill 更新
已更新 `.agents/skills/gettokens-domain-engineering/SKILL.md`：

1. 增加 `Professional Tooling Bias`。
2. 增加 `Storybook Baseline`。
3. 增加 `Storybook Scope`。

## 后续执行入口
当前实现应从 `docs-linhay/spaces/20260519-design-system-workbench/plans/20260519-design-system-workbench-plan-v02.md` 开始：

1. 初始化 Storybook React/Vite。
2. 加入应用内 `design-system` 入口。
3. 为基础组件和 token 建第一批 stories。
4. 跑 `test:unit`、`typecheck`、`build`、`build-storybook`。
5. 用浏览器验收并归档截图。
