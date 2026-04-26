# 20260427 Account Metrics Split Plan

## 背景

账号卡当前已有 `status`、`quota remaining/reset`、`reauth`，但没有把“高频决策指标”和“低频详情指标”分开。参考项目说明卡片应该承载稳定性摘要，详情页承载完整历史与调试信息。

## 分层原则

### 卡片优先

- `status`
- `failure reason`
- `plan type`
- `quota remaining`
- `quota reset`
- `successRate` 或轻量健康趋势条，二选一

### 详情优先

- `success / failure`
- `latency`
- `request / response`
- `statusCode`
- `startedAt / endedAt`
- 原始 payload / sanitized payload
- 账号元数据明细

### 暂不进卡片

- 原始调试日志全文
- 折线图 / 点位图
- 60 分钟以上趋势明细
- 只对排障有价值的低频字段

## 执行顺序

1. 先补 `AccountCard` 分层设计与文案
2. 再补详情页承接字段
3. 卡片首版稳定性摘要只选一种表达：`successRate` 或 `20-block` 趋势条
4. 最后评估是否需要新增后端统计字段

## 验收

- 卡片不出现调试噪音
- 详情页能看到完整排障信息
- 首屏信息能支撑账号选择和是否重登的判断
- 卡片不同时堆 `successRate`、原始计数和重型趋势
- 后续实现能直接按本方案拆任务
