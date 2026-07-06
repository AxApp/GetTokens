# Root Go Migration Plan v01

## 证据门禁

- 问题来源：用户连续要求“根目录下太多后端文件”“都收到各自的文件夹里”“这些 go 文件呢？”并授权迁移和测试。
- 当前事实：根目录仍存在 `main.go`、`app.go`、`app_types.go`、`app_mappers.go`、`proxy_pool.go`、`wails.json` 等 Wails command 文件。
- 风险事实：Wails 绑定对象必须保持 `main.App`；`go:embed` 不能引用包目录外的 `frontend/dist`。
- 验收方式：迁移到 `cmd/gettokens` 后跑 Go/Node/Wails build，确认 `frontend/wailsjs/go/main/App` 不变。

## 步骤

1. 新建 `cmd/gettokens/`，移动 Wails command 源文件和配置。
2. 配置 `frontend:dir`、`wailsjsdir`、`build:dir` 保持根部工作区契约。
3. 增加 `frontend/scripts/sync-wails-embed.mjs`，把前端 dist 同步到 `cmd/gettokens/frontend/dist` 供 `go:embed` 使用。
4. 更新脚本、测试、skill、dev 文档和 memory。
5. 跑自动化测试与 Wails build 验收。
