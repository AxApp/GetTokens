# 2026-04-28 ApiKeyDetailModal Relay Boundary

## 背景

本轮会话围绕 `frontend/src/features/accounts/components/ApiKeyDetailModal.tsx` 连续做了多轮收口。用户的核心纠偏不是“再加更多字段”，而是把这个 modal 从“单账号配置片段工作台”收回到“中转服务上游凭据编辑与验证面板”。

过程中暴露出两个容易漂移的点：

1. 详情页是否应该给单账号导出 `auth.json / config.toml`
2. `recent health` 应该算内容区卡片，还是头部状态摘要

## 结论

### 1. 这个 modal 的职责

`ApiKeyDetailModal` 当前只负责以下内容：

1. 编辑单个上游 API key 资产的名称
2. 编辑该资产的 `apiKey / baseUrl`
3. 展示该资产最近请求健康状态
4. 基于当前草稿配置发起一次验证

它不再负责：

1. 导出面向客户端的 `auth.json`
2. 导出 relay 侧 `config.toml`
3. 承载“如何把单个上游账号直接接入客户端”的教学或配置分发

原因：

1. GetTokens 当前产品语义是“中转服务工作台”
2. 单个上游账号不是对客户端暴露的最终接入对象
3. 在单账号详情里给出 `auth.json / config.toml`，会把“上游供应商资产”和“relay 对外入口”重新混在一起

### 2. 健康状态的摆放规则

`recent health` 不再作为 `MANAGEMENT` 区里的独立右侧卡片，而是上移到 header 下方，成为一个头部状态带。

固定结构如下：

1. 第一层：来源、名称、provider
2. 第二层：`recent health` 状态带
3. 第三层：正文编辑区（`apiKey / baseUrl`）
4. 第四层：验证区

其中：

1. 健康条本体放在头部状态带左侧
2. `recent failure / average latency` 放在该状态带右下角
3. 正文区不再重复出现第二张健康卡

这样做的目标是：

1. 把“资产状态”前置
2. 把“配置编辑”与“运行健康”拆成不同层级
3. 减少 modal 正文区横向分栏导致的视觉竞争

### 3. 间距与组头规则

本轮最终采用的组织方式：

1. 组头统一使用全大写、紧字距的小号 mono 文案
2. 组头右侧只放状态型信息，不放第二个解释块
3. 同一组内字段之间用紧凑纵向间距
4. section 之间用实线主边界，组内再用虚线次边界

这个规则继续沿用 GetTokens 现有 Swiss-industrial 视觉体系，不单独为该 modal 发明新样式。

## 验收

本轮已完成一次截图验收，确认调整后的头部健康状态带与主体编辑区关系正常。

截图归档：

- `docs-linhay/screenshots/20260428/accounts/20260428-accounts-api-key-detail-modal-after-v03.png`

## 不升级的内容

本轮没有新增项目级 skill，也没有更新 `AGENTS.md`。

原因：

1. 这次沉淀的是产品边界与单组件布局收口，不是可跨任务复用的执行流程
2. 该结论应先作为领域文档和记忆保留
3. 只有当后续多个 modal 都反复沿用同一套“状态带 + 编辑区 + 验证区”收口模式时，才值得再上升成项目级 skill
