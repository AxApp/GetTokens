# Mac 状态栏更新入口计划 v01

## 需求边界

目标是在 macOS 状态栏菜单中新增“检查更新...”入口，并复用现有 Sparkle 原生更新能力。同时在设置页补齐应用生命周期配置：开机启动、关闭窗口时退出服务或继续驻留。状态栏入口只负责后台驻留后的恢复、更新与退出，不重做发布链、appcast 或完整设置中心。

## BDD 场景

1. macOS 状态栏菜单展示更新入口。
2. 点击更新入口触发与设置页一致的 Sparkle 原生检查更新。
3. Sparkle 不可用时入口有明确降级行为，不崩溃、不静默失败。
4. 主窗口关闭但应用仍驻留状态栏时，更新入口仍可工作。
5. 设置页可配置开机启动。
6. 设置页可配置关闭窗口行为：退出 App 和服务，或隐藏窗口并保留服务。
7. 选择保留服务时，macOS 状态栏驻留入口必须可恢复窗口并退出后台服务。
8. 自动化测试与 macOS 桌面验收产物可追踪。

## TDD / 实施步骤

1. 调研当前状态栏菜单实现位置，确认菜单项构建代码和 action 分发链路。
2. 先补失败测试：
   - 菜单模型或构建函数包含更新菜单项。
   - 更新菜单项调用统一 updater service，而不是复制设置页逻辑。
   - Sparkle unavailable 时返回可断言的降级状态。
   - 应用生命周期设置可持久化，非法 close action 会回退默认值。
   - 开机启动配置写入用户级 LaunchAgent，并能关闭删除。
   - 设置页 section 顺序包含“启动与驻留”。
3. 最小实现：
   - 抽取或复用现有更新检查调用边界。
   - 在 macOS 状态栏菜单中挂接更新 action。
   - 增加 `GetAppRuntimeSettings` / `UpdateAppRuntimeSettings` Wails API。
   - 通过 `OnBeforeClose` 根据设置决定退出或隐藏窗口。
   - 选择保留服务时启用 macOS 状态栏菜单：打开窗口、检查更新、退出。
   - 保持非 macOS 构建可通过。
4. 回归验证：
   - 运行 Go / 前端相关测试。
   - 运行 Wails/macOS 桌面验收，确认状态栏菜单可见并可触发更新检查。
   - 截图归档到 `docs-linhay/spaces/20260519-mac-menubar-app-update/screenshots/`。

## 风险

1. Wails 状态栏菜单 action 可能运行在原生菜单回调上下文，需要避免直接依赖前端窗口状态。
2. Sparkle bridge 当前主要由设置页触发，若缺少统一后端边界，需先收敛到单一 service。
3. 开发构建通常未嵌入 Sparkle framework，验收要区分 dev 可见性验证与 release 包真实更新验证。

## 当前状态

- 状态：implemented
- 最近更新：2026-05-19
- 已完成：
  - 新增 `app_menu.go`，构建 macOS 顶部菜单栏 `Help -> Check for Updates...`。
  - `main.go` 挂载自定义 Wails application menu。
  - 接入 `OnBeforeClose`，支持按设置退出或隐藏主窗口。
  - 新增 `internal/menubar` 原生 macOS status item bridge，驻留菜单包含打开窗口、检查更新和退出。
  - 新增 `AppRuntimeSettings` 后端存储、LaunchAgent 写入/删除和 root Wails 绑定。
  - 设置页接入“启动与驻留”section。
  - `app_test.go` 增加菜单项存在性与点击回调测试。
  - 桌面验证确认本地构建进程菜单栏包含 `Help`，且 `Help` 下存在 `Check for Updates...`。
- 验证：
  - `go test . -run 'TestBuildApplicationMenuIncludesUpdateEntry|TestApplicationMenuUpdateEntryUsesSharedUpdateAction'`
  - `go test ./internal/wailsapp -run 'Test'`
  - `go test ./...`
  - `npm --prefix frontend run test:unit`
  - `npm --prefix frontend run typecheck`
  - `./scripts/wails-cli.sh build`
  - `osascript` 读取本地构建进程菜单项
- 截图：
  - `screenshots/20260519/menubar/20260519-menubar-check-update-after-v01.png`
- 待办：
  - 无需重复做真实 Sparkle appcast 点击回归；设置页已验证该链路，菜单入口已核对复用同一个 `App.CheckUpdate()` 后端入口。
  - 若后续需要更丰富驻留视图，再在当前 NSMenu 之外设计轻量 popover。
