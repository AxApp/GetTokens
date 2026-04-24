# GetTokens VS Code 运行配置

## 目标

在 VS Code 中实现“点击运行 = 编译 + 拉起 app”。

## 方案

1. 新增仓库脚本 `scripts/wails-cli.sh`
   - 优先使用全局 `wails`
   - 若 VS Code 终端的 `PATH` 没包含 Wails，则自动探测 `~/go/bin/wails`、`/opt/homebrew/bin/wails`、`/usr/local/bin/wails`
   - 若本机未安装全局 `wails`，则回退到 `go run github.com/wailsapp/wails/v2/cmd/wails@v2.12.0`
2. 新增 `.vscode/tasks.json`
   - `GetTokens: Run App` 对应 `wails dev`
   - `GetTokens: Build App` 对应 `wails build`
3. 新增 `.vscode/launch.json`
   - `Run GetTokens App` 可直接在 VS Code “运行和调试”面板点击启动

## 使用方式

1. 打开 VS Code 的 “运行和调试”
2. 选择 `Run GetTokens App`
3. 点击运行

这会执行 `scripts/wails-cli.sh dev`，等价于在仓库根目录执行 Wails 开发态启动，包含前端编译/监听与桌面 app 拉起。

## 说明

- 当前项目的稳定启动入口是 `wails dev`，不是直接 `go run main.go`
- `go run main.go` 不能替代 Wails CLI，因为它不会按 Wails 开发流程启动前端 dev server 与桌面壳
- 若首次 fallback 到 `go run github.com/wailsapp/wails/v2/cmd/wails@v2.12.0`，可能会有一次依赖拉取耗时
- 若终端无外网但本机已经有 `~/go/bin/wails`，脚本会直接复用本地 CLI，不再访问 `proxy.golang.org`
