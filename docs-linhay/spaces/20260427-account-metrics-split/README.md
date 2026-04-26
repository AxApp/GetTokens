# Account Metrics Split

## 背景

当前 `AccountCard` 已经有状态、额度窗口和重登入口，但还没有把“稳定性”和“历史表现”分层清楚。参考项目里已有 `success / failure / successRate + status bar` 的卡片级做法，也有 `latency` 的明细级做法；本轮要求优先保证简洁和实用，避免把卡片做成调试面板。

## 目标

1. 明确哪些指标应该直接进 `AccountCard`。
2. 明确哪些指标只放进详情页。
3. 明确哪些指标当前不做，保证卡片只服务“选账号 / 判断是否处理”。

## 范围

- 账号卡信息层级划分
- 卡片级指标清单
- 详情页指标清单
- 参考项目映射与迁移建议
- 后续实现顺序与验证点

## 非目标

- 直接改代码实现
- 直接定义埋点/统计存储方案
- 在卡片上堆叠所有后端可见字段

## 验收标准

- 给出卡片级与详情级指标分层表
- 给出每类指标的展示理由
- 明确卡片只回答“能不能用 / 值不值得选 / 要不要处理”
- 给出明确的首批实现顺序
- 能指导后续 `AccountCard` 与详情页拆分

## 相关链接

- `frontend/src/features/accounts/components/AccountCard.tsx`
- `frontend/src/components/biz/AccountDetailModal.tsx`
- `docs-linhay/references/Cli-Proxy-API-Management-Center/src/components/providers/ProviderStatusBar.tsx`
- `docs-linhay/references/Cli-Proxy-API-Management-Center/src/features/authFiles/components/AuthFileCard.tsx`

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-27

## 分层结论

### 卡片只回答 3 个问题

1. 这个账号现在能不能用
2. 这个账号现在值不值得选
3. 这个账号现在要不要处理

### 卡片保留

- `status`
- `failure reason`，仅异常时显示
- `plan type`，仅短 badge
- `quota remaining`
- `quota reset`
- `stability summary`，`successRate` 和 `趋势条` 二选一，不同时重展示

### 详情页承接

- `success / failure` 原始计数
- `latency`
- `statusCode`
- `request / response`
- `startedAt / endedAt`
- 原始账号元数据与调试信息

### 当前不做

- 卡片内折线图或重型图表
- 长时间历史点位
- 低频技术字段直接上卡片
