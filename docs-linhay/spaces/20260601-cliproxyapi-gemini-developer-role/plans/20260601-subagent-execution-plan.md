# 20260601 Subagent Execution Plan

## 分工

- 主控：确认边界、集成 review、运行收敛测试、写回 docs / memory / qmd。
- Relay：实现 Gemini OpenAI Responses `developer` role 合并到 `systemInstruction`，并补 translator 测试。

## 验收门禁

- `system` role 既有行为保持。
- `developer` role 不进入普通 `contents`。
- 不改 Codex translator 或前端模型 UI。
