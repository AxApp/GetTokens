# 2026-05-27 Account Detail Close & OpenAI-Compatible Layout Session Distillation

## 背景

本轮处理 `#frame=accounts` 账号详情弹层的两个浏览器评论：

1. `关闭面板` 按钮第一次点击后弹层会重新出现，需要第二次点击才关闭。
2. OpenAI-compatible provider detail 的 `MODEL CATALOG` 与运行快照在中窄视口下布局不自适应，出现大片空白、内容被挤压和删除按钮竖排。

## 根因

- 账号详情弹层由 `selectedAccount` 和 frame hash 中的 `detail` 共同驱动。关闭时只清空 `selectedAccount`，但本地 `accountDetailIDFromHash` 仍保留旧值；后续 hydration effect 会按旧 detail 再次选中账号，造成“第一次关闭被重新打开”。
- OpenAI-compatible provider detail 沿用了通用账号详情的双列模块栈和较早的 runtime/evidence split。该页面是密集表单编辑面，双列卡片会制造空白，也会压缩模型行操作区。

## 沉淀模式

- Hash 驱动的 detail/modal 关闭逻辑，必须先同步本地 detail state，再清理 URL hash，不能只依赖异步 `hashchange`。
- 账号详情的通用双列模块栈不是绝对规则。对于 provider 配置、模型映射这类密集编辑面板，允许使用 `cardColumns={1}`，把每个模块做成全宽工作表。
- 模型行这类“输入 + 输入 + 行动作”结构要按宽度分阶段响应：中等宽度先让行动作换到下一行且保持横向按钮；足够宽时再回到同一行。

## 本轮改动

- `AccountsFeature`：打开/关闭账号 detail 时同步 `accountDetailIDFromHash`。
- `OpenAICompatibleDetailModal`：OpenAI-compatible runtime/evidence split 延后到 `2xl`。
- `OpenAICompatibleDetailPanel`：编辑模块改成单列 stack，模型行改成响应式两段布局，删除按钮不再被挤成竖排。
- `gettokens-domain-engineering`：补充 hash detail state 同步和 OpenAI-compatible 详情布局例外规则。

## 验证

- `node --test src/features/accounts/tests/accountDetailLayout.test.mjs`
- `node --test src/features/accounts/tests/openAICompatible.test.mjs`
- `npm run typecheck`
- `npm run test:unit`

## 未纳入

- 未升级 `AGENTS.md`：本轮是账号详情领域内的具体实现边界，不是 repo-wide 流程规则。
- 未新增独立 `space`：这是浏览器评论驱动的小修与会话沉淀，不是多日需求或并行 feature。
