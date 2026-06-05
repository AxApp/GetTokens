# 2026-06-05 Wails LAN Access Plan

## 场景

1. 开发者运行 `./scripts/wails-cli.sh dev` 或 Wails dev watcher 时，同网段设备可以访问 Vite dev server。
2. 用户在状态页开启局域网 endpoint 后，本地 CLI 配置预览优先使用 LAN 地址。
3. 用户在状态页点击“打开 Web”后，系统浏览器打开当前 sidecar 端口的 `/management.html` 真实管理面板。
4. sidecar relay 业务入口可用于局域网客户端，但 management API 仍只允许本机访问。

## TDD 步骤

1. 增加 `TestWailsDevFrontendBindsToLAN`，断言前端 dev script 包含 `--host 0.0.0.0`。
2. 增加 `resolveRelayEndpointSelection` 模型测试，断言 LAN 开启时优先选 `kind=lan`。
3. 增加状态页源码测试，断言 header 暴露 `common.open_web`，并由 `StatusFeature` 调用 `BrowserOpenURL` 打开 `resolveSidecarManagementWebOpenURL(sidecarStatus.port)`。
4. 复用 sidecar 配置测试，确认 `host: ""` 与 `allow-remote: false`。
5. 最小实现后跑聚焦 Go / Node 测试。

## 实现摘要

1. `frontend/package.json` 的 `dev` script 改为 `vite --host 0.0.0.0`。
2. `relayLocalState.ts` 新增 endpoint 选择纯函数。
3. `StatusFeature` 加载 relay 配置、保存 relay key、切换 LAN 开关时统一使用该选择规则。
4. `StatusFeature` 页头新增“打开 Web”按钮，Wails runtime 下用 `BrowserOpenURL`，浏览器预览下 fallback 到 `window.open`；URL 固定为 `127.0.0.1:<sidecar-port>/management.html`，避免打开 Vite / 5173 预览数据。

## 验收命令

```bash
go test . -run 'TestWailsDevFrontendBindsToLAN|TestWailsConfigRegistersProdAndDevDeepLinkSchemes' -count=1
go test ./internal/sidecar -run 'TestWriteConfigCreatesMinimalConfig|TestWriteConfigPreservesCodexAPIKeys' -count=1
go test ./internal/wailsapp -run 'TestNormalizeRelayAPIKeys|TestBuildRelayServiceEndpoints' -count=1
node --test frontend/src/features/status/tests/relayLocalState.test.mjs
node --test frontend/src/features/status/tests/statusTypography.test.mjs
npm --prefix frontend run typecheck
docs-linhay/scripts/check-docs.sh
```

## 收尾记录

- `5173` 已确认被当前 Vite dev server 占用，且该入口在浏览器预览模式会使用模拟数据，不作为正式环境 Web 入口。
- “打开 Web”最终指向 sidecar 真实管理面板：`http://127.0.0.1:<sidecar-port>/management.html`。
- LAN 对外只覆盖 relay 业务端口；management 仍维持本机访问边界。
