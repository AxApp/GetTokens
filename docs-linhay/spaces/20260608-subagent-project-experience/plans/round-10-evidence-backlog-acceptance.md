# 第 10 轮证据修复验收记录

## 状态

- 日期：2026-06-08
- 环境：dev / 本仓
- 范围：`E15` MCP 运行前诊断；`P18/P10` Live Sessions 历史窗口、加载更多和历史未闭合语义。
- 结论：代码修复、自动化、Wails build 和 Wails dev bridge 辅助交互验收通过；真实桌面窗口手点未能完成，原因是本轮本仓 dev App 窗口在当前桌面环境中只呈现启动背景/无可枚举窗口控件，已记录为后续诊断项。

## 自动化验收

已通过：

```bash
cd frontend && node --test src/features/codex-extensions/model.test.mjs src/features/codex-live-sessions/model.test.mjs
go test ./internal/wailsapp -run 'TestPreflightCodexMcpServer|TestGetCodexLiveSessionHistory'
cd frontend && npm run typecheck
cd frontend && npm run test:unit
go test ./...
docs-linhay/scripts/check-docs.sh
git diff --check
./scripts/wails-cli.sh build
```

补充回归：

```bash
cd frontend && node --test src/features/codex-live-sessions/model.test.mjs
cd frontend && npm run typecheck
```

## 桌面 dev App 尝试

尝试路径：

```bash
GETTOKENS_APP_PROFILE=dev ./build/bin/GetTokens.app/Contents/MacOS/GetTokens
GETTOKENS_APP_PROFILE=dev ./scripts/wails-cli.sh dev
```

事实：

- 直跑构建产物时 dev sidecar 启动到 `18317`，进程为 `build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`。
- Wails dev 模式同样启动 dev App、Vite 和 dev sidecar，`34115 / 5173 / 18317` 端口正常。
- 两种桌面窗口路径在当前环境中都未暴露可枚举的 `GetTokens` 主窗口控件，屏幕截图只呈现启动背景，无法完成真实手点。
- 正式版 `/Applications/GetTokens.app` 与 prod sidecar `8317` 未被 kill、重启或替换。

截图：

- `screenshots/20260608/round10/20260608-round10-devapp-launch-failed-v01.png`
- `screenshots/20260608/round10/20260608-round10-devapp-launch-failed-v02.png`
- `screenshots/20260608/round10/20260608-round10-devapp-launch-failed-v03.png`

## Wails dev bridge 辅助交互验收

使用 `http://localhost:34115` 连接同一个 Wails dev backend 与 dev sidecar。

### MCP 运行前诊断

路径：

1. 打开 `#frame=codex&workspace=mcp-servers`。
2. 点击 `XcodeBuildMCP`。
3. 点击 `运行前诊断`。

结果：

- DOM 存在 `data-codex-mcp-preflight-result="true"`。
- 结果文本包含 `command / cwd / env_vars` 检查，`command` 解析为 `/opt/homebrew/bin/xcodebuildmcp`。
- 未输出 env secret 值。

截图：

- `screenshots/20260608/round10/20260608-round10-mcp-preflight-after-v01.png`

### Live Sessions 历史窗口

路径：

1. 打开 `#frame=codex&workspace=live-sessions`。
2. 等待历史请求加载。
3. 点击 `加载更多历史`。
4. 等待超过一个轮询周期。

结果：

- 初始历史窗口为 `History all · 1-80 · 80/page`。
- 点击加载更多后变为 `History all · 1-160 · 80/page`。
- 等待 5 秒后仍保持 `1-160`，未被轮询刷新回第一页。
- dev 历史库 `live-sessions-v1.sqlite` 前 160 条内存在 `active/streaming` 历史请求；请求列表中这些行显示 `历史未闭合`，不再显示为当前 streaming 语义。

截图：

- `screenshots/20260608/round10/20260608-round10-live-history-after-v01.png`
- `screenshots/20260608/round10/20260608-round10-live-history-after-v02.png`
- `screenshots/20260608/round10/20260608-round10-live-history-after-v03.png`
- `screenshots/20260608/round10/20260608-round10-live-history-after-v04.png`

## 残余风险

- 本轮未能完成真实桌面窗口手点，后续修复轮次应优先诊断本仓 dev App 窗口为何只显示启动背景或无法被系统窗口/AX 枚举。
- Wails dev bridge 辅助验收可以证明 Wails backend、dev sidecar、页面交互和数据状态，但不能替代用户要求的真实 macOS/Wails 窗口手点。
