# ModalFrame 设计系统标准

## 背景
GetTokens 已有多个业务 modal / dialog：账号详情、账号新增、OAuth URL、Codex 详情、状态页编辑器、代理池编辑器等。过去这些窗口各自手写遮罩、窗口尺寸、滚动边界和 footer，导致主题、文字缩放、Storybook 回归和项目页设计组件圈定不一致。

## 标准
1. 新增或重构 modal shell 时，优先使用 `frontend/src/components/ui/ModalFrame.tsx`。
2. `ModalFrame` 是 GetTokens 对 AntD `Modal` 的薄适配层；遮罩、dialog 语义、ESC、mask close、portal/container 归 AntD 维护，不再手写根层遮罩 div。
3. `ModalFrame` 只保留项目级窗口外壳约束：尺寸档位、sidebar 覆盖策略、滚动边界、`header / body / footer / error` 插槽和设计系统标记。
4. 业务组件继续拥有字段、提交、校验、Wails 调用和状态流转，不下沉到 `ModalFrame`。
5. 基础尺寸档位：
   - `sm`：危险确认、短表单。
   - `md`：常规配置表单。
   - `lg / xl`：多区块编辑。
   - `detail`：账号详情、运行详情等宽内容。
6. 已纳入设计系统的 modal 必须有 Storybook mock 状态，不得调用 Wails、sidecar 或真实网络。
7. 项目页运行时的设计系统圈定依赖 `data-design-system-component="true"` 与 `data-design-system-component-name="ModalFrame"`。

## 当前落地
1. `ModalFrame` 已进入 `Design System/通用组件/弹窗窗口`。
2. Storybook `Overview` 覆盖默认、错误、长内容、确认、详情宽屏状态。
3. `AccountDetailModalFrame` 已改为复用 `ModalFrame`，保持原业务 API 兼容。
4. `storyCatalog.test.mjs` 已将 `ModalFrame` 纳入 catalog 与运行时 marker 门禁。
5. 2026-06-22 已将 `ModalFrame` 底层从自绘遮罩 / panel root 切换为 AntD `Modal`，保留调用方 API 与 detail fullscreen 行为。

## 后续迁移边界
1. 简单账号弹窗（粘贴导入、OAuth URL、新增 API Key）可逐步迁移到 `ModalFrame`。
2. 依赖真实数据加载的复杂弹窗需要先拆出纯展示层，再进入 Storybook。
3. 每次迁移一个业务 modal 时，同步更新对应 feature story 的 Overview 状态和 `componentManifest.ts` 决策说明。
