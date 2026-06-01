# 20260601 Subagent Execution Plan

## 分工

- 主控：确认边界、集成 review、运行收敛测试、写回 docs / memory / qmd。
- Switch：实现 WebSocket -> HTTP fallback 删除 `generate`，并补最小失败测试。

## 验收门禁

- 不 cherry-pick 上游整包。
- 不改 GetTokens route guard、rate-limit admission、usage attribution 或 live sessions。
- focused Go test 通过后，纳入 CLIProxyAPI 汇总测试。
