# account-rotation-modal-placement

**日期**：20260427
**模式**：合作型
**参与者**：Gemini（福尔摩斯）/ Codex（主持人）
**总轮次**：1 / 60
**结束原因**：全员共识

## 执行元数据
- 候选参与者：Gemini
- 首轮实际启用：Gemini
- 后续 active participants：Gemini
- 淘汰参与者：无
- 不可用原因：无

## 辩论背景
> 用户提出：是否应把 `frontend/src/features/status/StatusFeature.tsx` 中的账号轮动配置编辑区迁移为 `frontend/src/features/accounts/AccountsFeature.tsx` 下的 modal 入口。目标是统一账号顺序与轮动策略的操作入口，同时避免把状态页继续做成配置页。

## 各轮观点记录

### 第 1 轮
**[Gemini - 福尔摩斯]** 论点：账号轮动属于账号资产使用策略，应与账号池入口对齐。  
引用：`frontend/src/features/accounts/AccountsFeature.tsx:103-127`  
代码事实：账号页头部已经承载账号相关入口，且该页已挂载 `ApiKeyComposeModal`、`ApiKeyDetailModal`、`PasteAuthModal`、`CodexOAuthModal`。  
结论：从信息架构看，轮动配置迁入账号池 modal 更合理。

**[Gemini - 福尔摩斯]** 论点：不应把状态页的轮动编辑区原样搬到账号池。  
引用：`frontend/src/features/status/StatusFeature.tsx:36-57`、`frontend/src/features/status/StatusFeature.tsx:317-325`、`frontend/src/features/status/StatusFeature.tsx:550-660`  
代码事实：`StatusFeature` 当前自己维护 `routingConfig / routingDraft / routingMessage / isSavingRoutingConfig`，并由 `saveRoutingConfig()` 直接调用 `UpdateRelayRoutingConfig`；550-660 行是和这些状态强绑定的一整块表单。  
结论：必须先抽成独立组件或 hook，再接到账号池入口。

**[Codex - 主持人]** 论点：状态页当前混合了 relay service key、endpoint、接入片段、healthz 和轮动编辑，轮动编辑在职责上已偏离“状态页”。  
引用：`frontend/src/features/status/StatusFeature.tsx:2-14`、`frontend/src/features/status/StatusFeature.tsx:45-57`、`frontend/src/features/status/StatusFeature.tsx:520-660`  
代码事实：状态页同时处理 `GetRelayServiceConfig`、`ApplyRelayServiceConfigToLocal`、`GetRelayRoutingConfig`、`UpdateRelayRoutingConfig`，其中 520-660 行已经不是“只读状态展示”，而是完整配置编辑器。  
结论：轮动配置应与运维状态展示分层，避免继续把状态页做成杂糅配置中心。

**[Codex - 主持人]** 论点：账号页已经具备 modal 编排基础，新增一个轮动设置 modal 的成本低于继续扩写状态页。  
引用：`frontend/src/features/accounts/AccountsFeature.tsx:97-170`、`frontend/src/features/accounts/AccountsFeature.tsx:234-275`  
代码事实：账号页主容器外层已统一管理多个 modal，页面本身就是账号资产主入口。  
结论：最稳的落地方式是在账号页新增“轮动设置”入口和独立 modal，而不是复制粘贴状态页片段。

## 最终结论与行动项

### 达成共识 / 裁定结论
- 结论：将账号轮动配置迁移为账号池下的 modal 主入口。
- 不建议：直接把 `StatusFeature.tsx:550-660` 原样搬进 `AccountsFeature.tsx`。
- 建议实现：先抽出独立的轮动配置表单组件与状态 hook，再由账号页 modal 承载。
- 状态页后续处理建议：移除该编辑区，或至少退化为只读展示，不再作为主编辑入口。

### 行动项
| # | 行动 | 负责方 | 截止 |
|---|------|--------|------|
| 1 | 提取 `routing config` 的独立 hook，收敛加载、草稿、保存逻辑 | Codex | 本轮实现时 |
| 2 | 新增账号页下的 `RoutingConfigModal` / `AccountRotationModal` | Codex | 本轮实现时 |
| 3 | 账号页头部或工具栏增加“轮动设置”入口 | Codex | 本轮实现时 |
| 4 | 状态页删除主编辑区，保留只读或完全移除轮动区 | Codex | 重构完成时 |

### 未解问题
- 轮动配置 modal 的入口放在 `AccountsHeader` 还是 `AccountsToolbar` 更合适，需结合现有 header 操作密度决定。
