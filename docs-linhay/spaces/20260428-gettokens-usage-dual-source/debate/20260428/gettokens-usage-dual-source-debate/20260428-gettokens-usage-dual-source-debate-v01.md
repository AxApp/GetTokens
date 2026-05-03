# GetTokens Usage Dual Source Debate

**日期**：20260428
**模式**：合作型
**参与者**：Codex（主持人） / Schrodinger（最小落地） / Mill（领域建模） / Mendel（风险审查）
**总轮次**：1 / 60
**结束原因**：第 1 轮达成全员共识

## 执行元数据
- 候选参与者：Schrodinger / Mill / Mendel
- 首轮实际启用：Schrodinger / Mill / Mendel
- 后续 active participants：Schrodinger / Mill / Mendel
- 淘汰参与者：无
- 不可用原因：无

## 辩论背景
> 用户要求围绕 GetTokens 的“用量统计”做一次全方面研讨，目标不是直接开工，而是先明确是否应按 `nolon` 的思路，把当前产品拆成 `真实请求用量统计` 与 `本地用量统计` 两条事实源，并与现有 `quota` 做边界切分。

## 各轮观点记录

### 第 1 轮
**[Schrodinger]** 代码事实：`internal/sidecar/config.go:29-35`、`internal/wailsapp/usage.go:13-33` → 现有 sidecar `/usage` 已是稳定真源，应被正式定义成“真实请求用量统计”，v1 不应重写。  
**[Schrodinger]** 代码事实：`frontend/src/features/accounts/model/accountUsage.ts:319-337`，以及本机 [rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:1>) / [同文件](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:5>) → 当前账号归因依赖 `authIndex` 与 `apiKey/prefix` 启发式匹配，而本地 rollout 样本里没有 `auth-file` 相关标识。  
**[Schrodinger]** 代码事实：`internal/accounts/quota_builder.go:66-72`、`internal/accounts/quota_builder.go:225-296` → quota 只产出额度窗口，必须继续独立于 usage summary。

**[Mill]** 代码事实：`internal/wailsapp/usage.go:8-33`、`frontend/src/features/accounts/model/accountUsage.ts:237-305` → 账号卡片上当前所谓 `usage` 实际是请求观测/稳定性，不包含 token、minute projection、历史趋势。  
**[Mill]** 代码事实：`docs-linhay/spaces/20260428-nolon-codex-usage/README.md:60-67`、`docs-linhay/spaces/20260428-nolon-codex-usage/README.md:189-191` → 参考实现中的本地 usage 真源是 `rollout/session -> minute projection`，与 sidecar `/usage` 不是一条链。  
**[Mill]** 代码事实：`internal/accounts/quota_builder.go:225-296` → `quota` 就算读取 cached usage snapshot，最终仍是 `PlanType + Windows`，不应并入 usage 域。

**[Mendel]** 代码事实：`frontend/src/features/accounts/model/accountUsage.ts:146-175`、`frontend/src/features/accounts/model/accountUsage.ts:319-336`，以及本机 [rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:1>) / [同文件](</Users/linhey/.codex/sessions/2025/11/10/rollout-2025-11-10T10-59-02-019a6bb3-e2cc-75f2-ac9c-21616d503dd4.jsonl:5>) → 现有 `source` 归一化与账号归因是启发式，而本地 rollout 样本里没有 `authIndex / account_id / email / token` 这类 join key，不足以支撑本地 usage 的精确账号归因。  
**[Mendel]** 代码事实：`frontend/src/features/accounts/model/accountUsage.ts:339-384` → 当前前端对每个账号都重复扫描 usage 明细，若把本地 usage 事件流直接喂前端，10x 数据量会先炸在 CPU/内存上。  
**[Mendel]** 代码事实：`docs-linhay/spaces/20260428-nolon-codex-usage/README.md:324-327` → 如果要借鉴 `nolon`，真正该借的是后端 `delta reducer + minute projection + disposable sqlite index`，不是把本地 usage 强行并进现有前端映射层。

## 最终结论与行动项

### 达成共识 / 裁定结论
- GetTokens 的“用量”必须拆成三条并列信息，而不是一个大桶：
  - `ObservedRequestUsage / 真实请求用量统计`
  - `LocalProjectedUsage / 本地用量统计`
  - `QuotaSnapshot / 配额快照`
- `ObservedRequestUsage` 继续以 sidecar `/usage` 为真源，保持当前口径，不重写 sidecar。
- `LocalProjectedUsage` 若落地，应参考 `nolon` 的本地索引思路，在后端构建独立索引与聚合链，而不是复用当前前端账号映射模型。
- `LocalProjectedUsage` 必须先按 `provider` 分域；即使首版只实现 `Codex`，模型、API 和前端状态也不能写死成单 provider。
- `quota` 继续独立域，不得再被包装成 usage fact。
- 按当前实现与本机 `~/.codex` 样本，`Codex local usage` 当前无法归因到每个 `auth-file` 账号；首版只应先做 provider/global 级视图。
- v1 最低风险方案是：
  - 保留现有 `GetUsageStatistics` 与 `GetCodexQuota`
  - 新增一条只服务 `Codex local usage` 的后端链路
  - 首版不回写账号卡片，只做独立面板/详情区

### 行动项
| # | 行动 | 负责方 | 截止 |
|---|------|--------|------|
| 1 | 将 debate 裁定摘要回写到当前 space README | Codex | 本轮完成 |
| 2 | 将本轮关键决策写入 memory，并同步 qmd | Codex | 本轮完成 |
| 3 | 若用户确认继续，基于本结论产出正式设计文档与实施计划 | Codex | 后续 |

### 未解问题
- `LocalProjectedUsage` 的首版落盘位置与索引 schema 还未设计。
- `ObservedRequestUsage` 是否需要在 Wails 层升级成类型化 DTO，而不是继续透传松散 `map[string]interface{}`，尚待下一步方案文档裁定。
- 本地 usage 的 workspace 粒度、provider 粒度、时间桶粒度，尚未细化到 API 设计层。
