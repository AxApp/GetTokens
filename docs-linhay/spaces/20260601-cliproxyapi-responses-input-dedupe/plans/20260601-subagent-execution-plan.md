# 20260601 Subagent Execution Plan

## 分工

- 主控：确认边界、集成 review、运行收敛测试、写回 docs / memory / qmd。
- Switch：实现 Responses WebSocket input item 按 `id` 去重，并补最小失败测试。

## 验收门禁

- 保留没有 `id` 的 input item。
- 去重必须保留最后一次出现的同 `id` item。
- 不改变 pinned auth release、full transcript replay 或 incremental input 判断。
