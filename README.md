# GetTokens

GetTokens 是一个基于 Wails + React + Go 的桌面应用，用来管理本地 AI 凭证资产、查看 sidecar 运行状态、维护中转服务配置，并为多平台发布和自动更新提供统一入口。

GetTokens is a desktop application built with Wails, React, and Go. It is used to manage local AI credential assets, inspect sidecar status, maintain relay service configuration, and provide a unified entry for cross-platform releases and app updates.

## 核心能力 | Core Capabilities

- 统一账号池：同时管理 `auth-file` 和 `api-key` 两类凭证资产。
- Unified account inventory: manage both `auth-file` and `api-key` credential assets in one place.

- Sidecar 状态面板：查看本地后端服务状态、端口、健康检查结果和调试请求。
- Sidecar status panel: inspect local backend status, port, health check results, and debug requests.

- Relay 配置工作台：生成和复制接入配置，查看当前生效的轮动与重试策略。
- Relay configuration workspace: generate and copy client config, and inspect active routing and retry strategy.

- 设置与更新入口：检查新版本，并按平台触发安全的升级动作。
- Settings and update entry: check for new versions and trigger platform-safe update actions.

## 技术栈 | Tech Stack

- 桌面壳：Wails `v2.12.0`
- Desktop shell: Wails `v2.12.0`

- 前端：React 18 + Vite + TypeScript
- Frontend: React 18 + Vite + TypeScript

- 后端：Go `1.23`
- Backend: Go `1.23`

- 自动更新：`go-selfupdate`
- Auto update: `go-selfupdate`

## 本地开发 | Local Development

### 环境要求 | Requirements

- Go `1.23+`
- Node.js `20+`
- npm
- Wails CLI（可选；仓库脚本会自动探测并在缺失时回退到 `go run`）

- Go `1.23+`
- Node.js `20+`
- npm
- Wails CLI (optional; the repo script will detect it and fall back to `go run` if needed)

### 启动开发环境 | Run In Development

```bash
./scripts/wails-cli.sh dev
```

这会启动 Wails 开发模式，并拉起前端监听与桌面应用窗口。

This starts Wails in development mode, including the frontend watcher and the desktop app window.

### 构建应用 | Build The App

```bash
./scripts/wails-cli.sh build
```

### 常用检查 | Common Checks

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
go test ./...
```

## 发布与下载 | Releases

发布产物托管在 GitHub Releases：

Releases are published on GitHub Releases:

- `https://github.com/AxApp/GetTokens/releases`

当前阶段只支持 macOS，release workflow 仅生成以下资产类型：

The current release workflow produces the following asset types:

- macOS Apple Silicon：`GetTokens_macOS_AppleSilicon.dmg`
- macOS Apple Silicon updater asset：`GetTokens_macOS_AppleSilicon.tar.gz`
- macOS Intel：`GetTokens_macOS_Intel.dmg`
- macOS Intel updater asset：`GetTokens_macOS_Intel.tar.gz`
- Checksums：`checksums.txt`

## 自动更新说明 | Auto Update Notes

- macOS 出于已签名 `.app` bundle 完整性约束，只执行“检查更新 + 打开 release 页面下载 DMG”。
- On macOS, due to signed `.app` bundle integrity constraints, the app uses “check update + open release page for DMG download” instead of in-place bundle replacement.
- 实验链路：当 release workflow 启用 `SPARKLE_ENABLE=1` 且提供 Sparkle feed / public key 后，macOS 构建会预埋 Sparkle 所需 metadata 与 framework，为后续原生更新切换做准备。

## 项目结构 | Project Layout

```text
.
├── frontend/           # React + Vite frontend
├── internal/           # Go application modules
├── scripts/            # build / release helper scripts
├── docs-linhay/        # project docs, spaces, memory, and dev notes
├── app.go              # Wails app entry and bindings
└── wails.json          # Wails project config
```

## 参考文档 | Related Docs

- 发布准备指南 / Release prep guide:
  `docs-linhay/dev/20260426-release-prep-guide.md`
- 版本边界说明 / Release label vs version boundary:
  `docs-linhay/dev/20260426-release-label-version-boundary.md`
- Release 工作空间 / Release workspace:
  `docs-linhay/spaces/20260426-release-prep/README.md`
