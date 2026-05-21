# Claude Code Binary / Installer / Runtime 技术调研

日期：2026-05-21
状态：P2 仅做安装状态与 PATH doctor，暂不管理版本

## 结论

Claude Code binary 管理不应按 Codex Binary 的 release cache 和托管 PATH 直接复刻。当前可验证、低风险的能力是检测 `claude` 是否可执行、版本输出、PATH 来源、关键环境变量冲突和本机配置路径；版本安装/升级留到单独验证官方安装渠道后再做。

## 已验证依据

- 官方与外部参考均以 `npm install -g @anthropic-ai/claude-code` 作为常见安装入口，但安装渠道和升级策略可能随版本变化，不能复用 Codex release asset 逻辑。
- `musistudio/claude-code-router` 的 README 依赖官方 `claude` CLI，并通过 env activation 改变 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL`、`API_TIMEOUT_MS` 等运行时变量，说明 runtime doctor 对 Claude Code 更有价值。
- 本地 Codex binary 代码可复用“状态卡 / PATH doctor / 版本展示”交互，但不能复用下载、签名、激活、回退流程。

## 数据边界

- 读取：
  - `which claude`
  - `claude --version` 或官方稳定版本命令，需实现前实机验证。
  - 环境变量：`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL`、`API_TIMEOUT_MS`、`CLAUDE_CONFIG_DIR`。
- 写入：
  - P2 不写 npm 全局包、不修改 shell rc、不替换二进制。
  - 只允许生成诊断建议。

## 后端设计

- `GetClaudeCodeRuntimeStatus`：
  - command path、version、config dir、env conflicts、recommended actions。
- `ProbeClaudeCodeRuntime`：
  - 只运行只读命令。
  - timeout 限制，避免 CLI 卡住。

## TDD 红灯

- PATH 中无 `claude` 时返回 not installed。
- mock `claude --version` 超时返回 warning。
- 同时存在 `ANTHROPIC_AUTH_TOKEN` 与 GetTokens 受控 API key 时提示冲突。
- `CLAUDE_CONFIG_DIR` override 正确反映到配置路径。

## 验收方式

- Go 单测通过 fake executable / temp PATH。
- 桌面验收只读状态卡。
- 不做安装/升级自动化。

## 风险

- npm 全局安装受 Node 版本、权限、包管理器影响，贸然接管会引入高维护成本。
- Claude Code 官方分发策略变化快，必须在进入 installer 开发前重新调研官方文档和真实安装命令。

