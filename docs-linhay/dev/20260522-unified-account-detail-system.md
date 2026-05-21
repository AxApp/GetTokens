# 统一账号详情系统第一阶段

## 背景
账号详情此前存在三套 UI：

- `UnifiedAccountDetailModal`：账号池内 auth-file / API key 详情。
- `OpenAICompatibleDetailModal`：OpenAI-compatible provider 编辑详情。
- `CodexAccountDetailModal`：Codex / Claude Code 请求顺序与模型映射详情。

它们的业务数据来源不同，但用户心智都是“查看和管理一个账号资产”。本阶段目标是先统一视觉语言和基础构件，不把页面 controller 合并成一个跨域大控制器。

## 决策
1. 保留 controller 分工：Accounts、Codex、Claude Code 继续各自负责数据加载、保存、验证、模型拉取和错误处理。
2. 新增 `AccountDetailPrimitives` 作为详情 UI 基础层，提供 section、字段网格、状态 pill、notice、empty state、evidence grid。
3. `CodexAccountDetailModal` 使用 `AccountDetailModalFrame`，从而与账号池详情共享壳层、遮罩、滚动和 header/footer 结构。
4. `OpenAICompatibleDetailPanel` 暂时保留自身 header/footer，因为其 provider 编辑流程和保存提示仍有独立状态；内部内容区已统一为详情 section。
5. `AccountProxyRouteSection` 是跨三类详情复用模块，统一接入 `AccountDetailSection`，避免 OpenAI-compatible 和 API key 的出口配置出现两套视觉语言。
6. `RateLimitRulesSection` 属于账号详情模块，不再自带 `px-6 py-5` 分区边距，也不再把每条规则渲染成卡片；外层交给账号详情内容流控制，内部使用单层横向行。
7. 限流规则的保存语义跟随页面 footer。组件通过 `forwardRef` 暴露 `save()`，父级详情弹窗负责把账号配置保存与限流规则保存串联起来。
8. `calendar-day` 表示自然日窗口，UI 展示为 `00:00-23:59`；CLIProxyAPI evaluator 对该窗口按本地自然日 00:00 作为起点计算用量，不等同于滚动 `24h`。
9. 卡片模式里的运行数据进入详情页时不复用卡片容器，而是通过 `AccountRuntimeSnapshotSection` 展示同源语义：近期请求、总 token、cached token、平均延迟、首个 quota 窗口、balance 明细。
10. Codex 排序卡片和 Codex 详情共用 `buildCodexQuotaSummaryAccount`，保证 `CodexAccountRow` 映射到 quota/billing 展示时不分叉。

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
- `UnifiedAccountDetailModal` 从 `AccountRecord + CodexQuotaState` 构建 `QuotaDisplay` 与 billing；`CodexAccountDetailModal` 从 `CodexAccountRow` 通过 `buildCodexQuotaSummaryAccount` 走同一 `buildQuotaDisplay` 链路。
- OpenAI-compatible provider 当前只有 usage attribution，因此详情快照展示近期统计；后续若 provider 具备 quota/billing 数据，再通过同一 props 扩展。

## 验收
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test:unit`
- `go test ./internal/gettokenshooks`（CLIProxyAPI）
- `git diff --check`
- `git -C docs-linhay/references/CLIProxyAPI diff --check`
- `docs-linhay/scripts/check-docs.sh`

## 后续建议
1. 给 `AccountDetailPrimitives` 补 Storybook Overview，覆盖 section、pill tone、notice、empty、evidence 状态矩阵。
2. 再评估是否把 `OpenAICompatibleDetailPanel` 的 header/footer 也完全迁移到 `AccountDetailModalFrame` slots。
3. 如果出现第四类账号详情，再开始抽 `AccountDetailTarget` / capability registry；不要提前把现有 controller 合成单体。
