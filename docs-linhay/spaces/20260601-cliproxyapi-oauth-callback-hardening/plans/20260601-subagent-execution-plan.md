# 20260601 Subagent Execution Plan

## 分工

- 主控：确认边界、集成 review、运行收敛测试、写回 docs / memory / qmd。
- Relay：实现 OAuth callback 写入前创建缺失 `auth-dir`，并补 management handler 测试。

## 验收门禁

- pending session 校验和 callback 文件格式保持不变。
- 写入失败继续返回现有错误语义。
- 日志不得泄露 token 或完整 redirect secret。
