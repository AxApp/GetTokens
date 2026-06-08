# Subagent Experience Review Usage Workflow

## 适用场景

- 用户要求用 subagents 体验 GetTokens 项目，并给出修改建议。
- 需要多个角色同时从产品运营、运行态路由、扩展工作台等角度巡检。
- 需要一个评估修复角色归并建议、建立证据门禁，并筛出下一轮可修候选。

## 标准组合

| 顺序 | Agent | 写权限 | 产物 |
| --- | --- | --- | --- |
| 并行 | `gettokens_experience_product_operator` | read-only | 产品/运营体验报告，至少 10 条中度建议 |
| 并行 | `gettokens_experience_runtime_routing` | read-only | 运行态/路由/sidecar 体验报告，至少 10 条中度建议 |
| 并行 | `gettokens_experience_extension_workbench` | read-only | 扩展工作台体验报告，至少 10 条中度建议 |
| 串行 | `gettokens_evaluation_repair_controller` | workspace-write | 建议归并、证据矩阵、修复候选、backlog / 下期需求 |

## 主控执行顺序

1. 新建或确认对应 `space`，在 README 写清体验目标、范围、非目标和验收标准。
2. 固定报告路径，例如：
   - `plans/experience-product-operator.md`
   - `plans/experience-runtime-routing.md`
   - `plans/experience-extension-workbench.md`
   - `plans/evaluation-and-fixes.md`
   - `plans/unfixed-backlog.md`
3. 并行调度三个只读体验 agent。
4. 主控审阅三份报告，剔除无证据、重复、过宽或越界建议。
5. 调度 `gettokens_evaluation_repair_controller` 做归并和证据门禁。
6. 只有证据充分、边界清楚、无需产品决策或重大技术方案的候选才进入修复。
7. 每轮修复后更新验收文档、未修复 backlog、memory。
8. 如果用户暂停或要求剩余项进入下期，撤回半成品代码，把证据和验收计划转成下期需求。
9. 收尾时自动做 session distillation audit，判断是否需要更新 skills / workflow / AGENTS。

## 输出要求

每条中度建议至少包含：

1. 问题描述。
2. 影响范围。
3. 事实依据：体验报告、代码路径、UI 位置、日志、测试缺口或文档引用。
4. 修改方向。
5. 验收方式。

评估修复报告至少包含：

1. 去重后的建议分组。
2. 可立即修复 / 需要产品决策 / 需要技术方案 / 暂不处理。
3. 每个进入修复候选的 evidence matrix。
4. 本轮已修复项、未修复项和建议下一批。

## 边界

- 三个体验 agent 默认只读，不修改仓库。
- 评估修复 agent 可写，但不拥有最终完成判断；主控 agent 负责集成、验证、提交和沉淀。
- 不触碰正式版 GetTokens、不重启或替换正式版 sidecar、不修改正式配置。
- 正式数据只可按 AGENTS 规则备份后搬到 dev profile 使用。
- 不把 backlog 标签、直觉优先级或单次截图感受直接升级为代码修改。
