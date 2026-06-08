# 未修复问题清单

## 状态

- 日期：2026-06-08
- 来源：三份第 1 轮体验报告、`evaluation-and-fixes*.md`、`final-acceptance.md`
- 当前判断：第 1-10 轮已修复低风险项与第一批高证据项；真实 dev App 手点不再作为每轮硬门槛，后续按风险选择验收证据。

## 产品/体验决策类

这些问题需要先确定入口优先级、默认视图、用户承诺或信息架构，再进入实现。

| ID | 问题 | 当前状态 | 建议下一步 |
| --- | --- | --- | --- |
| P2 | 账号池刷新入口没有区分“刷新列表”和“刷新额度/用量/限流” | 已修复 | 第 9 轮拆分为账号列表刷新与运行态刷新 |
| P3 | 账号筛选偏能力字段，缺少运营巡检视图 | 未修复 | 定义运营巡检视图字段、排序和筛选目标 |
| P4 | 批量选择工具条只在进入选择模式后出现，发现成本偏高 | 未修复 | 决定是否常驻批量入口或增加显性入口 |
| P5 | 账号操作入口过于集中在菜单，新增/导入/登录路径缺少主次优先级 | 未修复 | 重新排账号新增/导入/OAuth 登录的主入口层级 |
| P7 | Usage Desk 缺少 provider / account / model 的运营分面入口 | 未修复 | 定义 Usage Desk 分面维度与 URL/hash 状态 |
| P8 | Usage Desk 索引刷新/重建动作缺少影响范围说明 | 已修复 | 第 9 轮补动作影响范围说明，并明确不删除原始 session 文件 |
| P11 | Live Sessions 项目/会话切换入口偏窄，缺少运营摘要 | 未修复 | 设计项目维度摘要和会话维度切换路径 |
| P12 | 侧边栏二级菜单靠 hover/pin，Codex 高频入口排序不贴近日常运营 | 未修复 | 决定 Codex 高频入口排序和固定展示策略 |
| P13 | 菜单栏快捷入口缺少完整产品化入口 | 已修复 | 第 9 轮真实 dev App 菜单栏手点验收通过 |
| P14 | 菜单栏 quota snapshot 只取最低 3 个 quota 和 4 个余额，缺少“更多风险”入口 | 已修复 | 第 9 轮真实 dev App 菜单栏风险入口验收通过 |
| E1 | Git Skill 安装入口仍停留在浏览器预览/计划层，没有真实安装闭环 | 未修复 | 确认 Git skill install 是否进入近期扩展工作台范围 |
| E11 | openai-compatible 模型映射与 Codex 扩展/配置页缺少跳转闭环 | 未修复 | 定义跨页跳转、回退和上下文保留 |
| E12 | deep-link import 与 Codex config apply 没有进入扩展工作台可见审计面 | 未修复 | 定义审计记录、展示范围和敏感字段规则 |
| E15 | 缺少 MCP “运行前诊断”按钮 | 已修复 | 第 10 轮补 server 级只读 preflight；自动化、Wails build 与 Wails dev bridge 辅助交互验收通过 |

## 技术方案类

这些问题涉及 sidecar 热路径、运行态接口、SQLite、TOML AST 或分页/历史模型，需要先写技术方案和失败测试。

| ID | 问题 | 当前状态 | 建议下一步 |
| --- | --- | --- | --- |
| P10 | Live Sessions 历史中大量 `streaming/active` 状态容易误导当前健康度 | 已修复 | 第 10 轮历史请求标记 `historical_unclosed`，overview 时间线和详情 modal 显示 `历史未闭合`；dev 历史库前 160 条存在真实 streaming/active 样本并通过 bridge 验收 |
| P16 | 账号用量加载失败会静默落成“无数据”，缺少降级态 | 已修复 | 第 8 轮补 `error/stale` 状态、卡片显示和测试 |
| P17 | 账号用量缺少 hook 级异步失败/合并测试 | 已修复 | 第 8 轮补用量失败/合并路径测试 |
| P18 | Live Sessions history 每次 `window: all` 固定 limit，缺少偏移/分页交互契约 | 已修复 | 第 10 轮补 overview/detail 历史窗口提示与加载更多；加载后 `1-160` 不再被轮询重置回第一页 |
| R1 | 路由探测仍依赖旧 `X-GetTokens-Route-*` header | 未修复 | 设计 sidecar management `route-probe` endpoint 和 Wails 调用边界 |
| R4 | Usage attribution 仍存在未归因和 legacy key 聚合 | 未修复 | 设计 attribution reconciliation 和 legacy key 迁移策略 |
| R5 | Sidecar 管理接口轮询会放大 SQLite 锁竞争 | 未修复 | 设计快照缓存、busy 策略和轮询退避 |
| R6 | Route explain 与真实 sidecar engine 仍有两套实现 | 未修复 | 收敛 explain 到 sidecar engine，补一致性测试 |
| R7 | Session affinity 失败预算缺少可视化诊断 | 未修复 | 明确 failure budget 数据源和 UI 显示规则 |
| R8 | WebSocket pinned auth 的释放原因没有形成用户可读链路 | 未修复 | 设计 pinned auth lifecycle events 和 timeline 展示 |
| R9 | 模型可用性失败与账号可用性失败还不够分层 | 未修复 | 拆分错误类别、route explain 和前端文案 |
| R10 | Live session history 体量大，但排查入口仍偏实时快照 | 未修复 | 设计 history 索引、筛选和详情入口 |
| R11 | Sidecar 诊断缺少“当前 dev 真源路径”总览 | 未修复 | 明确 dev source path 的读取与脱敏展示 |
| R12 | 运行态日志缺少按 request id 的统一索引 | 未修复 | 设计 request id 日志索引和跳转路径 |
| E4 | raw `config.toml` 已有轻量预检和备份，但没有完整 TOML AST/parser 化校验 | 部分修复 | 选择 TOML parser，设计错误映射和兼容策略 |
| E7 | MCP Server ID 已支持 quoted id patch，但缺少安全重命名流程 | 部分修复 | 设计 rename 语义、冲突处理和 section 迁移测试 |
| E21 | 后端 TOML 解析已增加多行 warning，但没有多行 AST patch | 部分修复 | 先做 TOML AST 技术方案，不建议直接文本 patch |

## 诊断/可维护性类

这些问题可以后续独立小需求处理，但当前不再属于“无方案即可继续修”的低风险项。

| ID | 问题 | 当前状态 | 建议下一步 |
| --- | --- | --- | --- |
| D1 | 本仓 dev App 桌面窗口无法完成真实手点，构建产物/Wails dev 只显示启动背景或无可枚举窗口控件 | 不再作为每轮阻塞项 | 用户已取消每轮真实点击验收；仅在 native/Wails 桌面行为相关需求中按需复核 |
| P6 | Usage Desk 的数据源文案偏研发，运营用户难以判断该看哪一个 | 未修复 | 结合 Usage Desk 信息架构一起改文案和入口 |
| P15 | 账号禁用失败提示复用 `deleteError`，错误归因会串到删除语义 | 已修复 | 第 8 轮补独立 `accountActionErrors` 与失败文案测试 |
| R2 | Channel routing 历史事件只有数量，缺少过滤原因摘要 | 已修复 | 第 8 轮补 `filteredReasonCounts` 与前端摘要 |
| R3 | Rate-limit 规则仍有 legacy account key，运行态会静默失效 | 已修复 | 第 8 轮补 legacy key 只读检测与提示 |
| E9 | Skill 文件扫描没有数量/深度预算提示 | 已修复 | 第 9 轮补文件数/深度预算 warning 和详情展示 |
| E14 | 扩展详情 modal 未接入独立 hash 路由 | 已修复 | 第 9 轮 Skills 详情接入 `detail=<skillId>` hash 恢复与关闭清理 |

## 暂不处理/低优先

| ID | 问题 | 当前状态 | 原因 |
| --- | --- | --- | --- |
| E6 | MCP inline map 排序影响预览，diff 不提示排序变化 | 暂不处理 | 价值存在，但优先级低于 raw 保存安全、transport 冲突和 args/env 破坏性保存 |
| E10 | 浏览器预览数据与真实 dev 数据断层较大 | 暂不处理 | 需要脱敏 fixture 生成、敏感字段审计和生命周期设计 |

## 建议修复顺序

1. `P7/P6` Usage Desk 分面与数据源文案：进入证据复核，先明确缺的是可操作分面 UI、数据归因还是文案层。
2. `P11` Live Sessions 运营摘要：进入证据复核，结合第 10 轮历史窗口结果决定是否做 compact operational strip。
3. `P3/P4/P5/P12` 账号池/侧边栏运营入口：属于产品信息架构项，需要先补真实 dev UI 证据和入口优先级方案。
