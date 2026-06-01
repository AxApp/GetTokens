# 20260601 Subagent Execution Plan

## 分工

- 主控：确认边界、集成 review、运行收敛测试、写回 docs / memory / qmd。
- Delta：实现 AMP tool casing 恢复、Claude Opus 4.8 registry、XAI video preview model 支持。

## 验收门禁

- 请求声明的工具大小写优先于 AMP 内置映射。
- 大小写冲突声明不强制改写。
- `grok-imagine-video-1.5-preview` 仅接受 XAI 相关 prefix。
- 不引入 HomeAppLogForwarder。
