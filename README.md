# GetTokens

GetTokens 是一个基于 Wails + React + Go 的桌面应用，用来管理本地 AI 凭证资产、查看 sidecar 运行状态、维护中转服务配置，并为多平台发布和自动更新提供统一入口。

GetTokens is a desktop application built with Wails, React, and Go. It is used to manage local AI credential assets, inspect sidecar status, maintain relay service configuration, and provide a unified entry for cross-platform releases and app updates.

## 核心能力 | Core Capabilities

- 统一账号资产中心：在同一界面管理 `auth-file`、`api-key`、OpenAI-Compatible 映射与本地配置草稿。
- Unified credential hub: manage `auth-file`, `api-key`, OpenAI-compatible mappings, and local config drafts in one place.

- 多模型渠道路由：支持 Codex / Claude Code 渠道路由策略、账号探测与可视化切换。
- Multi-channel model routing: configure Codex / Claude Code routing strategies, account probing, and visual switching.

- 账号配额与健康治理：提供额度、重置周期、可用性和失败诊断的聚合视图。
- Account quota and health governance: provide aggregated views for quota, reset windows, availability, and failure diagnostics.

- Codex 运行时工具链：内置 Codex 二进制版本管理、技能扩展（Skills/MCP）管理与会话能力入口。
- Codex runtime toolchain: includes Codex binary version management, Skills/MCP extensions management, and session entry points.

- Sidecar 运行态观测：实时查看本地后端服务状态、端口、健康检查结果和调试请求。
- Sidecar runtime observability: inspect backend status, port, health checks, and debug requests in real time.

- Relay 与更新工作台：统一生成接入配置、查看策略生效状态，并按平台执行升级流程。
- Relay and update workspace: generate relay configs, inspect active policy state, and execute platform-safe upgrade flows.

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

- macOS 可分发 DMG 发布手册 / macOS distributable DMG release guide:
  `docs-linhay/dev/20260426-release-prep-guide.md`
- Sparkle 更新架构 / Sparkle updater architecture:
  `docs-linhay/dev/20260427-macos-sparkle-updater-architecture.md`
- 版本边界说明 / Release label vs version boundary:
  `docs-linhay/dev/20260426-release-label-version-boundary.md`
