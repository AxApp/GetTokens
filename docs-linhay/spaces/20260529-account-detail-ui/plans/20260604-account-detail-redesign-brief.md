# Frontend Handoff: 账号详情页重新设计 v02

## Goal
把现有 `OpenAICompatibleDetailPanel` 从“长表单 + 分散摘要”改为桌面工作台式的账号配置台：让用户能一眼确认账号身份、连接健康、模型目录来源、保存阻断原因，并能在同一页完成 endpoint、headers、proxy、models、verify、rate-limit 的编辑与验证。

## User scenario
1. 用户从账号列表打开 OpenAI-compatible 账号详情（例如 DeepSeek）。
2. 用户检查账号名、当前验证状态与使用中的测试模型。
3. 用户修改 endpoint/API key/headers/proxy 或模型目录。
4. 用户拉取远端模型、选择是否应用远端模型。
5. 用户选择验证模型并验证账号。
6. 用户保存配置；若 proxy/rate-limit/必填字段阻断，底部 command bar 明确说明原因。

## Data contract
- 账号/凭据 draft：前端 local draft，保存后回写 Wails/sidecar。
- 验证结果：`ProviderVerifyState`；只展示真实验证结果，不伪造 sidecar 状态。
- 远端模型：`ProviderRemoteModelsState`；来源必须标记 `remote/local/preset/empty`。
- Proxy route：`AccountProxyRouteSection` 管理，`proxyRouteError` 为保存阻断权威。
- Rate limit：`RateLimitRulesSection` 管理，dirty 通过 `footerMessage` 汇总。
- 错误：`error` prop 与各模块本地错误分层展示。

## State matrix
- ready：已保存配置、验证摘要可读、footer 显示最近状态。
- editing：任意 draft dirty，左侧状态条和底部 command bar 提醒未保存。
- loading：远端模型拉取、验证、保存规则时显示 busy，不隐藏现有数据。
- success：验证/拉取/保存成功后在右侧 inspector 和模块状态中同步反馈。
- empty：无模型列表时保留手动输入模型入口。
- error：验证/拉取/保存错误不覆盖页面，只进入模块 notice 和底部阻断说明。
- blocked：proxy 无效或缺少必填字段时保存按钮 disabled。

## Layout responsibilities
- 左侧 Identity Rail：账号身份、当前主标识、验证摘要、源与路由概览。
- 中央 Configuration Stack：Endpoint、Headers、Model Catalog、Model Fetch Credentials。
- 右侧 Run Inspector：Connection Verify、Proxy Route、Rate Limit、最后错误/证据。
- 底部 Command Bar：保存/放弃、阻断原因、dirty summary。
- Modal Frame：仍为全应用视口遮罩，正文内滚动，底部固定。

## Interaction rules
- Header 不再占据大面积横向表单；账号名进入左侧 identity rail 顶部。
- Endpoint/API key 是主任务，放在中央首屏第一模块。
- Headers 默认折叠为一行摘要；有内容或展开时显示 textarea。
- Model Catalog 改为“本地草稿 + 远端候选对比”的表格，远端成功时显示 review/apply 动作。
- Verify 与保存解耦：验证使用当前 draft，但不会自动保存。
- Footer message 优先级保持：proxyRouteError > rateLimitDirty > verifyState.message > idle。

## Visual density/tone
专业、冷静、工具感；采用 Swiss Industrial Print 方向：米白纸底、黑色机械线框、单一红色用于危险/阻断，绿色/蓝色仅作为状态语义点缀。中高密度，但通过左/中/右分区建立稳定扫读线。

## Anti-goals
- 不做营销站 hero，不引入移动端优先布局。
- 不用前端假状态掩盖 sidecar 或 Wails 的真实状态。
- 不把所有模块做成等权卡片；验证、保存阻断、模型来源要有明确优先级。
- 不引入新运行时依赖。

## Tests/evidence required
- 组件/源码测试：锁定 detail frame、headers collapse、models remote apply、verify inspector、footer save gate 的结构与状态文案。
- DOM/无头截图：ready、dirty、remote success、verify error、proxy blocked 五个状态。
- Wails/desktop：若进入实现，需验证 hash detail 关闭与保存流程。

## Files likely touched
- `frontend/src/features/accounts/components/OpenAICompatibleDetailPanel.tsx`
- `frontend/src/features/accounts/components/AccountProxyRouteSection.tsx`
- `frontend/src/features/accounts/components/RateLimitRulesSection.tsx`
- `frontend/src/features/accounts/components/AccountDetailPrimitives.tsx`
- `frontend/src/features/accounts/tests/openAICompatible.test.mjs`
- `frontend/src/features/accounts/tests/accountDetailLayout.test.mjs`
- `frontend/src/locales/zh.json`
- `frontend/src/locales/en.json`
