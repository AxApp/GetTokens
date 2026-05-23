# 统一账号详情系统第一阶段

## 背景
账号详情此前存在三套 UI：

- `UnifiedAccountDetailModal`：账号池内 auth-file / API key 详情。
- `OpenAICompatibleDetailModal`：OpenAI-compatible provider 编辑详情。
- `CodexAccountDetailModal`：Codex / Claude Code 请求顺序与模型映射详情。

它们的业务数据来源不同，但用户心智都是“查看和管理一个账号资产”。本阶段目标是先统一视觉语言和基础构件，不把页面 controller 合并成一个跨域大控制器。

## 决策
1. 保留 controller 分工：Accounts、Codex、Claude Code 继续各自负责数据加载、保存、验证、模型拉取和错误处理。
2. 新增 `AccountDetailPrimitives` 作为详情 UI 基础层，提供 section density、标准模块头部、body、overview grid、module grid、module stack、stat grid、字段网格、状态 pill、notice、empty state、evidence grid。
3. `CodexAccountDetailModal` 使用 `AccountDetailModalFrame`，从而与账号池详情共享壳层、遮罩、滚动和 header/footer 结构。
4. `OpenAICompatibleDetailPanel` 暂时保留自身 header/footer，因为其 provider 编辑流程和保存提示仍有独立状态；内部内容区已统一为详情 section。
5. `AccountProxyRouteSection` 是跨三类详情复用模块，统一接入 `AccountDetailSection`，避免 OpenAI-compatible 和 API key 的出口配置出现两套视觉语言。
6. `RateLimitRulesSection` 属于账号详情模块，不再自带 `px-6 py-5` 分区边距，也不再把每条规则渲染成卡片；外层交给账号详情内容流控制，内部使用单层横向行。
7. 限流规则的保存语义跟随页面 footer。组件通过 `forwardRef` 暴露 `save()`，父级详情弹窗负责把账号配置保存与限流规则保存串联起来。
8. `calendar-day` 表示自然日窗口，UI 展示为 `00:00-23:59`；CLIProxyAPI evaluator 对该窗口按本地自然日 00:00 作为起点计算用量，不等同于滚动 `24h`。
9. 卡片模式里的运行数据进入详情页时不复用卡片容器，而是通过 `AccountRuntimeSnapshotSection` 展示同源语义：近期请求、总 token、cached token、平均延迟、首个 quota 窗口、balance 明细。
10. Codex 排序卡片和 Codex 详情共用 `buildCodexQuotaSummaryAccount`，保证 `CodexAccountRow` 映射到 quota/billing 展示时不分叉。
11. 详情模块布局统一为 `AccountDetailBody -> AccountDetailOverviewGrid(runtime + evidence) -> AccountDetailModuleStack -> AccountDetailSection`，避免卡中卡和局部 padding 分叉。
12. 保存动作按页面 footer 归口：限流规则和 Codex 模型映射不再在模块内部放独立保存按钮，模块内部只保留添加、删除、验证、拉取模型等局部动作。
13. 宽屏详情弹窗默认支持 card-mode：`AccountDetailModuleStack layout="cards"` 让短模块多列并排；`AccountDetailSection span="wide"` 让限流规则、额度/余额编辑、模型目录、auth content 等横向内容跨列，避免单列浪费空间或压缩表格。
14. 模块头部统一走 `AccountDetailSectionHeader`，所有详情模块使用相同的 eyebrow、title、meta、actions 排布。
15. 顶部运行信息统一走 `AccountDetailOverviewGrid`，将 `AccountRuntimeSnapshotSection` 与 evidence 模块并排；运行快照内部使用 `quota-balance` 资源网格让额度和余额在宽屏并排。
16. Codex route row 详情不再把类型、状态、路由、优先级等字段作为独立字段网格，而是通过 `CodexAccountEvidenceSection` 放入 overview evidence。
17. `AccountDetailOverviewGrid` 负责顶部 runtime/evidence 的等高行为；slot 和内部 card section 均使用 stretch / full-height 约束。
18. Codex 模型映射的新增动作属于 section header action，放在 `CodexModelRoutingSection` 右上角，避免底部编辑区同时承载创建和错误提示。

## 当前边界
本阶段不是最终的 capability registry。后续如果继续收敛，可以在当前 primitives 之上新增：

```ts
type AccountDetailTarget =
  | { kind: 'account-record' }
  | { kind: 'openai-compatible-provider' }
  | { kind: 'route-row'; workspace: 'codex' | 'claude-code' };
```

但 registry 只能负责模块选择和布局，不应接管 Wails 调用、保存编排或 hash 同步。

## 路由守卫模块边界
- `RateLimitRulesSection` 仍可独立加载、编辑和提交规则，但提交动作由父级页面保存入口触发。
- 删除已有规则只进入本地草稿，直到页面保存时才调用 management API delete。
- 规则 label 不再由用户编辑，展示值来自 `rateLimitRuleLabel`，减少一行次要输入。
- 新窗口值 `calendar-day` 需要 sidecar 支持；已在本地 CLIProxyAPI 参考源补齐策略列表、校验、窗口起点和回归测试。

## 运行快照模块边界
- `accountDetailRuntime` 只做格式化与统计项组装，不读取 Wails、不拉取 quota、不关心详情保存。
- `AccountRuntimeSnapshotSection` 只负责详情页展示，不把 `AttributionCard`、`QuotaBars`、`BillingBalance` 作为整卡嵌入，避免卡中卡。
- `AccountRuntimeSnapshotSection` 内部按 stats、quota/balance 两层组织；quota 与 balance 只在同一资源层并排，不拆成两个孤立模块。
- `UnifiedAccountDetailModal` 从 `AccountRecord + CodexQuotaState` 构建 `QuotaDisplay` 与 billing；`CodexAccountDetailModal` 从 `CodexAccountRow` 通过 `buildCodexQuotaSummaryAccount` 走同一 `buildQuotaDisplay` 链路。
- OpenAI-compatible provider 当前只有 usage attribution，因此详情快照展示近期统计；后续若 provider 具备 quota/billing 数据，再通过同一 props 扩展。

## 设计系统收编
- 运行时详情模块根节点通过 `data-design-system-component="true"` 与 `data-design-system-component-name` 暴露项目高亮标记。
- `AccountDetailSectionDensity` 用于区分 standard、dense、hero 三类详情密度，避免每个业务 section 自行写 padding 和列宽。
- `AccountDetailSectionHeader` 是详情 body 模块的唯一标准头部路径，避免 flow/card 分支各写一套 header。
- section header actions 是新增行/新增模型这类模块级创建动作的默认位置。
- `AccountDetailOverviewGrid` 是运行快照与 evidence 的顶部组合模式，避免 evidence 被放到与快照脱节的 sidebar。
- `AccountDetailOverviewGrid` 的 runtime slot 与 evidence slot 在宽屏并排时等高，保证 `AccountRuntimeSnapshotSection` 与 evidence section 边界一致。
- `CodexAccountEvidenceSection` 承载 route row 的审计字段：asset id、来源类型、状态、路由、优先级、请求状态和启用状态。
- `AccountDetailModuleStackLayout` 用于区分 `flow` 与 `cards`。cards 模式通过 context 让内部 `AccountDetailSection` 自动切换为独立模块卡片，不要求每个业务 section 手动改壳层。
- `AccountModalComponents.stories.tsx` 的详情 section 示例覆盖运行快照/evidence overview、主列模块、footer 保存状态；manifest 的 `requiredStates` 显式记录 `runtime-snapshot`、`runtime-evidence-overview`、`quota-balance-grid`、`standard-module-header`、`module-layout`、`footer-save`。
- `componentManifest.ts` 已补齐 `card-mode` required state，并补齐 Codex live sessions 新拆分组件的收编记录，保证 manifest coverage 继续严格。
- 可复用规则已沉淀到 `.agents/skills/gettokens-domain-engineering/SKILL.md` 的 Account Detail Surfaces 小节；该规则限定在账号域，不写入 `AGENTS.md`。

## 验收
- `node --test frontend/src/features/design-system/storyCatalog.test.mjs`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run build-storybook`
- `go test ./internal/gettokenshooks`（CLIProxyAPI）
- `git diff --check`
- `git -C docs-linhay/references/CLIProxyAPI diff --check`
- `docs-linhay/scripts/check-docs.sh`

## 后续建议
1. 给 `AccountDetailPrimitives` 补 Storybook Overview，覆盖 section、pill tone、notice、empty、evidence 状态矩阵。
2. 再评估是否把 `OpenAICompatibleDetailPanel` 的 header/footer 也完全迁移到 `AccountDetailModalFrame` slots。
3. 如果出现第四类账号详情，再开始抽 `AccountDetailTarget` / capability registry；不要提前把现有 controller 合成单体。

## 会话沉淀：2026-05-22
本轮“统一账号详情 + 账号筛选 + Codex 请求顺序筛选”形成了三个可复用模式：

1. 账号详情视觉统一应优先抽 UI primitives，而不是把不同来源的 controller 合并成单体。Accounts、Codex、Claude Code、OpenAI-compatible 继续各自持有数据加载、保存、hash 与 Wails 调用边界；共享层只负责 frame、section、overview、module stack、header 和 footer 等详情结构。
2. 账号详情中的运行态、evidence、quota、balance 必须从账号卡共享语义进入详情页，但不能把账号卡整体嵌入详情造成卡中卡。宽屏详情默认允许 card-mode 多列排布，长编辑面通过 `span="wide"` 跨列。
3. 账号筛选一旦来源、请求性、禁用、错误、余额和额度语义分离，就必须使用对象状态，并用 AND-style requirement 字段表达叠加条件，不回退到旧单选或旧兼容字段。Codex 请求顺序页同步账号池筛选维度时只过滤展示行，不改变真实拖拽顺序、ORDER 编号或路由探测顺序。

已沉淀位置：

- `.agents/skills/gettokens-domain-engineering/SKILL.md`：Account Detail Surfaces、account list filters。
- `.agents/skills/gettokens-codex-account-list/SKILL.md`：Codex account-list 展示筛选与请求顺序边界。
- `docs-linhay/memory/2026-05-22.md`：本轮决策、验证与沉淀摘要。

不纳入长期规则：

- 本轮具体测试账号、浏览器运行端口、临时截图路径和一次性 Playwright 节点编号。
- 当前阶段的 `AccountDetailTarget` registry 草案只作为后续建议，不作为已落地架构约束。
- `AGENTS.md` 不更新：本轮规则属于账号域和 Codex account-list 域，不是 repo-wide 治理规则。
