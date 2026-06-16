# OmniRoute 借鉴能力评估

## 背景

用户要求评估本地参考项目 `diegosouzapw/OmniRoute` 对 GetTokens 的借鉴价值，并判断是否适合作为插件服务直接集成到 GetTokens app 内。

当前结论边界：

- `OmniRoute` 不适合以“整包内嵌插件服务”的方式直接并入 GetTokens。
- GetTokens 现有运行态真源仍应保持在 sidecar 边界内，账号选择、route guard、quota、session affinity、live sessions 等热路径不应被外部 Node 服务或通用脚本 hook 体系接管。
- `OmniRoute` 适合作为产品能力与工程治理的参考输入，尤其是路由弹性、配额解释、诊断工具、协议出口和扩展边界设计。

## 目标

1. 明确 `OmniRoute` 中哪些能力值得 GetTokens 借鉴。
2. 按“低成本高收益 / 中期可做 / 明确不做”整理成后续可拆分的机会清单。
3. 明确这些能力应落在 sidecar、Wails core 还是前端工作台，而不是停留在抽象判断。

## 范围

- 阅读和比对本地参考项目 `docs-linhay/references/OmniRoute/` 的 README、routing、security、architecture、CLI 与 plugin 相关实现。
- 结合 GetTokens 当前架构边界，评估借鉴价值而非直接复刻。
- 形成书面清单，作为后续 feature space 或技术方案的输入。

## 非目标

- 本轮不实现 OmniRoute 相关能力。
- 本轮不设计完整通用插件 marketplace。
- 本轮不调整 GetTokens 当前 sidecar 真源边界。
- 本轮不引入 OmniRoute 源码到 GetTokens 主仓。

## 验收标准

- `space README` 清晰记录本轮背景、目标、边界和结论口径。
- `plans/` 下存在一份机会清单，至少覆盖：
  - 最值得借鉴的能力
  - 不建议照搬的能力
  - 每类能力建议落位到 sidecar / Wails / frontend 的位置
  - 建议优先级与后续拆分方向
- 文档结构校验通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260615-omniroute-capability-review`
- worktree：`../GetTokens-worktrees/20260615-omniroute-capability-review/`

## 相关链接

- 本地参考仓库：`/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/OmniRoute`
- 参考索引：[docs-linhay/references/README.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/references/README.md:20)
- OmniRoute 架构文档：`docs-linhay/references/OmniRoute/docs/architecture/ARCHITECTURE.md`
- OmniRoute 路由文档：`docs-linhay/references/OmniRoute/docs/routing/AUTO-COMBO.md`
- OmniRoute 插件实现：`docs-linhay/references/OmniRoute/src/lib/plugins/`
- GetTokens 运行态边界：[AGENTS.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/AGENTS.md:50)
- GetTokens 路由系统边界：[docs-linhay/dev/20260524-account-routing-engine.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260524-account-routing-engine.md:292)
- 架构文档：[docs-linhay/dev/20260615-omniroute-capability-architecture.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260615-omniroute-capability-architecture.md:1)
- 技术方案：[plans/20260615-omniroute-capability-technical-roadmap-v01.md](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/spaces/20260615-omniroute-capability-review/plans/20260615-omniroute-capability-technical-roadmap-v01.md:1)

## 当前状态
- 状态：in-review
- 最近更新：2026-06-15
