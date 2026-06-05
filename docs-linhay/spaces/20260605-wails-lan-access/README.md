# Wails LAN Access

## 背景

用户确认正式环境不直接开放公网后，要求让 Wails / GetTokens 支持局域网访问。当前产品仍定位为 macOS/Wails 桌面工作台，远程管理面必须继续限制在本机。

## 目标

1. Wails 开发预览的前端服务允许局域网设备访问，方便同网段调试。
2. 状态页的 relay endpoint 在局域网开关开启时优先选择 LAN 地址。
3. sidecar relay 业务端口继续监听所有网卡。
4. management API 继续强制 `remote-management.allow-remote=false`。
5. CLIProxyAPI 原生 `/management.html` 控制台退役，不再由 GetTokens 状态页打开，也不再由 sidecar 配置允许服务。

## 范围

- `frontend/package.json` 的 Vite dev host。
- 状态页本地 relay endpoint 选择逻辑。
- 聚焦测试覆盖 Wails dev host、endpoint 选择与 sidecar 配置安全边界。

## 非目标

- 不把 Wails 桌面应用改造成公网 Web 服务。
- 不开放远程 management API。
- 不增加 TLS、反代、用户登录或公网暴露能力。

## 验收标准

1. `npm run dev` 通过 Vite 监听 `0.0.0.0`。
2. 状态页局域网开关开启时，若存在 `kind=lan` endpoint，默认选择 LAN 地址。
3. 状态页头部不显示“打开 Web”按钮，不再生成或打开 `http://127.0.0.1:<sidecar-port>/management.html`。
4. `writeConfig` 生成或修复配置时保留 `host: ""`，强制 `remote-management.allow-remote=false`，并强制 `disable-control-panel=true` / `disable-auto-update-panel=true`。
5. 聚焦 Go 与 Node 测试通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：本期无视觉稿，仅做运行边界与状态选择逻辑调整。

## Worktree 映射

- branch：`master`
- worktree：未创建；本轮为当天可完成的主工作区短改。

## 相关链接

- 研发边界：`docs-linhay/dev/20260426-relay-service-config-boundary.md`

## 当前状态

- 状态：accepted
- 最近更新：2026-06-05
- 收尾结论：`5173` 属于 Vite dev / browser preview 入口，无 Wails bindings 时会使用预览数据；正式环境不再提供 CLIProxyAPI 原生 `/management.html` 控制台入口，LAN 对外只覆盖 relay 业务端口，management 仍保持本机 API 边界并禁用控制台页面。
