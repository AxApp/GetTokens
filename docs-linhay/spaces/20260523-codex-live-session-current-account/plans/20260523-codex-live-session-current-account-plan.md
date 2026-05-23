# Codex 实时会话当前账号判定修复计划

## 现象

账号额度用尽后页面仍显示旧账号，误导用户以为 sidecar 没有切到下一个账号。

## 已确认事实

- sidecar 会继续重选账号。
- live sessions 页面把 session 级 sticky auth 和 request 级 auth 混用了。
- 默认 request 回退策略仍可能落到 `requests[0]`。

## 修复步骤

1. 先补测试，锁定 request 选择顺序与账号展示口径。
2. 抽出统一的“当前 request”选择函数，优先级为 `activeRequestID` -> `lastRequestID` -> 最新 sequence。
3. 让列表行、详情页和诊断摘要统一消费这个选择结果。
4. 回归验证前端测试和文档结构。

## 验收

- 当前账号展示与真实切号一致。
- 诊断摘要不再回显旧 session 级 auth。
- 不再把数组第一条 request 当作默认当前 request。
