# Menu Bar Popover

## 背景

当前 GetTokens 已有 macOS 原生 `NSStatusItem + NSMenu` 驻留能力，但它只在设置页选择“关闭窗口后继续运行服务 / keep_service_in_menu_bar”时显示。用户现在希望把右上角 menu bar 图标变成更稳定的入口：启动后可显示图标，用户可主动关闭该图标，并进一步支持点击图标打开轻量 `menu bar popover`，而不是只显示原生菜单。

本需求需要重新划清三层能力：

1. `status item`：右上角菜单栏图标是否显示。
2. `status menu`：当前已有的原生菜单。
3. `menu bar popover`：点击图标后出现的轻量浮层，可展示更丰富状态和操作。

## 当前判断：popover 中能否显示 Wails 视图

结论：**可以作为技术 spike 评估，但不能先假设现有 Wails 主窗口视图可以直接塞进 `NSPopover`。**

原因：

1. macOS 原生 `NSPopover` 可以承载 `NSViewController`，理论上也可以承载独立 `WKWebView`。
2. 当前 GetTokens 是 Wails v2.12 单主窗口架构，现有 React 视图、Wails runtime binding、事件桥和 root `App` 绑定都围绕主 Wails window 生成。
3. 直接在 `NSPopover` 内复用主窗口 WebView 不现实；在 popover 内新建 `WKWebView` 也需要解决资源加载、Wails JS bridge、Go 方法调用、事件同步、生命周期和焦点管理。
4. 如果目标只是展示额度、余额、运行状态和打开主窗口等轻量内容，首期更稳的路线是原生 macOS popover，由 Go/Objective-C bridge 把状态快照传进去。
5. 如果一定要复用 React 组件，建议先做独立 spike：为 popover 提供一个 `#frame=menubar-popover` 或专用 HTML 入口，并验证该 WebView 是否能稳定调用所需 Wails API；验证不通过时退回原生 AppKit 视图。

## 当前判断：是否改用 SwiftUI 实现 popover

结论：**已推进为 SwiftUI 优先实现。** `NSStatusItem` 和 `NSPopover` 生命周期仍由现有 Objective-C bridge 管理；popover 内容优先通过 `NSHostingController` 承载 SwiftUI 小票视图，AppKit 小票保留为动态库缺失时的 fallback。

核对事实：

1. Apple 官方路径可行：`NSPopover` 的 `contentViewController` 可以承载 AppKit view controller；`NSHostingController` / `NSHostingView` 是把 SwiftUI view hierarchy 放进 AppKit 的官方桥接方式，macOS 可用版本为 10.15+。
2. 当前 GetTokens 原生桥是 Go + cgo + Objective-C：`internal/menubar/controller_darwin.go` 通过 `#cgo CFLAGS: -x objective-c -fmodules` 与 `#cgo LDFLAGS: -framework Foundation -framework AppKit` 编译 `menubar_bridge.m`。
3. 本轮新增 `internal/menubar/swiftui/GetTokensMenuBarPopover.swift`，通过 C ABI factory 返回 `NSHostingController`，Objective-C 使用 `dlopen` 加载 `libGetTokensMenuBarSwiftUI.dylib`。
4. `scripts/build-menubar-swiftui.sh` 负责按目标架构编译 SwiftUI 动态库；`scripts/install-menubar-swiftui.sh` 负责安装到 `.app/Contents/Frameworks/`。
5. `scripts/wails-cli.sh`、`scripts/build-local-macos-package.sh` 和 GitHub release workflow 均已接入 SwiftUI 动态库构建/安装，避免开发版和打包版实现分叉。
6. Go 端 quota/balance JSON snapshot contract 不变；SwiftUI 只替换 popover 渲染层，按钮通过 Objective-C 传入的 C callback 执行 `打开账号池` 和 `刷新额度`。

## 目标

1. GetTokens 支持在 macOS menu bar 默认显示应用图标，不再只依赖“关闭窗口后驻留”配置。
2. 设置页提供“显示菜单栏图标”开关；关闭后立即移除 `NSStatusItem`。
3. 关闭菜单栏图标不应等同退出 App，也不应破坏 sidecar 运行。
4. 当用户选择“关闭窗口后继续运行服务”时，即使关闭了常驻图标，也必须有可恢复窗口/退出服务的安全路径，避免后台服务不可见。
5. 点击 menu bar 图标后支持自定义 `menu bar popover`，展示 GetTokens 运行态摘要和常用操作。
6. 首期技术路线已明确为 `NSStatusItem + NSPopover + SwiftUI NSHostingController`，保留 AppKit view 作为缺失 SwiftUI dylib 时的 fallback。

## 范围

1. 新增 menu bar 图标显示策略配置。
2. 改造现有 `internal/menubar` controller，使“图标显示”和“关闭窗口后驻留”解耦。
3. 设计 menu bar popover 的信息结构、尺寸和交互边界。
4. 验证 popover 内承载 Wails/React 视图的可行性，并记录技术结论。
5. 增加对应设置页文案、Wails root binding、Go 测试和桌面验收。
6. popover 操作只保留 `打开账号池` 和 `刷新额度`；退出 App 不在该小票 popover 内显示。

## 非目标

1. 不把 menu bar popover 做成完整设置中心或账号管理页。
2. 不在首期迁移主窗口完整路由到 popover。
3. 不覆盖 Windows / Linux tray。
4. 不擅自修改 `/Applications/GetTokens.app` 正式版；验证默认使用 dev 构建或明确指定的测试包。
5. 不在没有 spike 证据前承诺 popover 内能完整复用 Wails 主窗口运行态。

## 验收标准

### 场景 1：默认显示菜单栏图标

- Given 用户在 macOS 启动 GetTokens
- When 应用完成 startup
- Then 右上角 menu bar 能看到 GetTokens 模板图标
- And 图标不依赖主窗口是否关闭

### 场景 2：用户可以关闭菜单栏图标

- Given 用户打开设置页
- When 关闭“显示菜单栏图标”
- Then 右上角 GetTokens 图标被移除
- And sidecar 不因图标隐藏而停止
- And 重新打开开关后图标恢复

### 场景 3：驻留安全路径

- Given 用户选择“关闭窗口后继续运行服务”
- When 用户关闭主窗口
- Then App 不得进入“后台服务仍运行但没有任何恢复/退出入口”的状态
- And 若用户关闭了菜单栏图标，设置页或关闭动作必须给出限制、自动恢复图标或其他明确安全策略

### 场景 4：点击图标打开 popover

- Given 菜单栏图标可见
- When 用户点击图标
- Then 显示 `menu bar popover` 而不是只显示原生菜单
- And popover 至少包含额度摘要、余额摘要、服务状态、端口、打开账号池和刷新额度

### 场景 5：popover 视图技术 spike

- Given 本需求进入实现前
- When 评估 popover 技术路线
- Then 需产出明确结论：使用原生 AppKit、独立 WKWebView/React，或保留 NSMenu
- And 若选择 Wails/React 视图，必须验证资源加载、Wails API 调用、事件同步和桌面交互

### 场景 6：验证产物可追踪

- Given 本需求完成
- When 执行验收
- Then 自动化测试通过，或明确说明不可自动化部分
- And 桌面截图归档到 `docs-linhay/spaces/20260606-menu-bar-popover/screenshots/`

## 设计稿入口

- 本期设计稿：[`design-preview.html`](./design-preview.html)
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260606-menu-bar-popover`
- worktree：`../GetTokens-worktrees/20260606-menu-bar-popover/`

## 相关链接

- [Mac 状态栏更新入口](../20260519-mac-menubar-app-update/README.md)
- [macOS Runtime Residency Session Distillation](../../dev/20260519-macos-runtime-residency-session-distillation.md)

## 当前状态
- 状态：active-quota-refresh-tested-v08
- 最近更新：2026-06-07
- 最近变更：已将 menu bar popover 推进为 SwiftUI 优先渲染，并修复 `打开账号池` 只打开窗口、不定位账号池的问题。Go 端 quota/balance JSON snapshot contract 不变；Objective-C bridge 继续负责 `NSStatusItem/NSPopover` 生命周期，打开时优先加载 `libGetTokensMenuBarSwiftUI.dylib` 并创建 `NSHostingController`，失败时回退 AppKit 小票。`打开账号池` 现在先显示主窗口，再通过 Wails `menubar:navigate` 事件让前端切到 `#frame=accounts`；`刷新额度` 已从“只重新读取本地 sidecar snapshot”改为用户主动触发已配置账号的 sidecar quota refresh，然后再重读 snapshot。启动、sidecar ready 和打开 popover 仍只读已有 snapshot，不自动请求上游。空态和接入态文案面向用户统一为 `等待账号额度快照` / `账号额度快照已接入。`，不再在小票主文案暴露 sidecar quota / balance 工程词。构建链已接入 SwiftUI dylib 编译、安装和本地 build 重签；`scripts/wails-cli.sh` 现仅在 Wails build 成功后安装 dylib 与重签，避免失败构建留下被二次修改的 bundle。SwiftUI 离线渲染截图已归档到 `screenshots/20260607/menubar/20260607-menubar-swiftui-render-after-v17.png`；真实状态栏点击截图因当前用户 dev 设置 `showMenuBarIcon=false` 且菜单栏入口被系统/隐藏工具收起，未继续盲点。
