# Root Go Migration

## 背景

用户要求继续整理根目录，把剩余 Go/Wails 入口文件收进各自文件夹，降低仓库根目录噪音。

## 目标

- 根目录不再保留 Go 源文件和 `wails.json`。
- Wails 桌面入口集中到 `cmd/gettokens/`。
- 前端生成绑定仍保持 `frontend/wailsjs/go/main/App` 命名空间，不破坏现有前端 import。
- `go:embed` 的生产静态资源仍能被 Wails build 正常打包。

## 范围

- 移动 `main.go`、`app*.go`、`proxy_pool.go`、`wails.json` 到 `cmd/gettokens/`。
- 更新 `scripts/wails-cli.sh` 从 `cmd/gettokens` 调用 Wails，同时继续使用仓库根部 `build/`、`frontend/`、sidecar 与 menubar 产物。
- 更新静态契约测试、项目 skill 和 dev 文档中的 Wails binding 路径。

## 验收

- `go test ./...` 通过。
- Wails binding surface 静态测试通过。
- `npm --prefix frontend run build` 通过。
- `./scripts/wails-cli.sh build` 通过，且生成绑定命名空间仍为 `main.App`。
- `docs-linhay/scripts/check-docs.sh` 与 `git diff --check` 通过。
