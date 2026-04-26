# GetTokens VS Code 运行配置

## 目标

在 VS Code 中实现“点击运行 = 编译 + 拉起 app”。

## 方案

1. 新增仓库脚本 `scripts/wails-cli.sh`
   - 启动 Wails 前先按当前主机架构执行 `scripts/ensure-sidecar.sh`
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

## sidecar 按需更新

`wails-cli.sh` 现在会在 `wails dev` / `wails build` 之前先确保 `cli-proxy-api` 与当前源码状态一致。

规则：

1. sidecar 源码默认取 `docs-linhay/references/CLIProxyAPI`
2. 当前源码指纹固定为 `<short-commit>:<dirty|clean>:<goos>:<goarch>`
3. 若 `build/bin/cli-proxy-api` 或 `build/bin/cli-proxy-api.meta.json` 缺失，直接重编
4. 若 `meta.json` 里的 `fingerprint` 与当前源码指纹不一致，直接重编
5. 若指纹一致，则跳过 sidecar 重编，继续执行 Wails CLI

对应脚本：

- `scripts/ensure-sidecar.sh`
- `scripts/build-sidecar.sh`

产物与元数据：

- sidecar 二进制：`build/bin/cli-proxy-api`
- 构建指纹：`build/bin/cli-proxy-api.meta.json`

## 说明

- 当前项目的稳定启动入口是 `wails dev`，不是直接 `go run main.go`
- `go run main.go` 不能替代 Wails CLI，因为它不会按 Wails 开发流程启动前端 dev server 与桌面壳
- 若首次 fallback 到 `go run github.com/wailsapp/wails/v2/cmd/wails@v2.12.0`，可能会有一次依赖拉取耗时
- 若终端无外网但本机已经有 `~/go/bin/wails`，脚本会直接复用本地 CLI，不再访问 `proxy.golang.org`
- sidecar 指纹比较是开发期便利策略，不替代 release 流程里按目标架构显式构建与回填 `.app` 的要求
