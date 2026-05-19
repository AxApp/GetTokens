# 通用墙面看板技术调研与技术选型

## 背景

目标是构建一个 iPad / Mac / iOS / Android 通用的看板系统。核心使用场景是设备墙挂或常驻桌面，用户出门前用几秒钟查看天气、提醒事项和关键状态。

这类产品的技术风险不在普通页面渲染，而在跨端一致性、长时间展示、系统锁定/常亮限制、后台刷新、天气与提醒数据权限、以及后续实机验收。

## 候选路线

### Flutter

优势：

- 官方支持 Android、iOS、macOS 等多平台部署，适合一套 UI 覆盖移动端和平板/桌面。
- 自绘 UI 对远距离可读、固定比例卡片、动画和大屏适配更可控。
- 原生插件和 platform channel 能覆盖 WeatherKit、Android lock task、屏幕常亮等平台能力。

风险：

- 当前本机未安装 Flutter CLI，需要补齐 SDK、doctor、iOS/Android 构建链路。
- 需要为 Apple Reminders、Android 任务/日历等系统能力写或筛选插件。
- 桌面端如果需要深度 macOS 菜单栏/系统托盘能力，需要额外验证。

初步判断：适合作为第一推荐原型路线。

### Tauri 2 + React

优势：

- 官方定位为 Linux、macOS、Windows、Android、iOS 跨平台，并可复用 Web/React 经验。
- 适合把看板做成 WebView 驱动的轻量客户端，状态层和设计系统可与现有 GetTokens 前端经验靠拢。
- Rust 后端适合做本地缓存、同步和安全边界。

风险：

- 当前本机 `rustc` 失败，Tauri CLI 未安装；先修工具链才能验证。
- 移动端平台能力需要 Rust/Swift/Kotlin 插件或原生桥接，复杂度高于纯展示型 Web。
- iPad / Android 平板的长期常驻体验需要实机验证，不能只看桌面。

初步判断：适合做第二验证路线，尤其当后续希望复用 Web 设计系统和本地服务能力时。

### React Native / Expo

优势：

- iOS / Android 开发链成熟，Expo 能加速移动端原型。
- 适合手机和平板交互，生态里天气、通知、设备信息等模块多。

风险：

- macOS 不是 React Native 核心官方主路径；React Native macOS 是 Microsoft 维护的 out-of-tree platform。
- 如果目标强要求 Mac 与移动端同一套工程高一致交付，路线复杂度会上升。
- Android/iOS 原生 kiosk、提醒事项深度权限仍需脱离 Expo Go，使用 development build 或原生模块。

初步判断：适合移动优先原型，不适合作为本轮“iPad / Mac / iOS / Android 一体化”的默认首选。

### 现有 GetTokens Wails / React 延展

优势：

- 当前仓库已有 Wails、React、Vite、Storybook、文档治理和截图验收经验。
- macOS 桌面端能力延续性最好。

风险：

- Wails 当前主要服务桌面端，不覆盖 iOS / Android。
- 若强行以 Wails 为主，会把移动端变成另一套技术栈，违背通用看板的“一套产品体验”目标。

初步判断：适合作为设计系统、文档流程、桌面验收经验来源，不作为跨端运行时主路线。

## 平台能力边界

### iPadOS / iOS

- 普通家庭/个人使用可依赖 Guided Access 让设备临时限制在单个 app 内。
- MDM 场景可使用 Single App Mode，但这不是普通用户默认能力。
- 天气数据可考虑 WeatherKit：Apple 平台有 Swift API，其他平台可用 REST API。
- 提醒事项如需读取 Apple Reminders，需要走 Apple 平台权限；Android 侧不能直接复用同一系统数据源。

### macOS

- 更适合做桌面窗口、全屏显示、菜单栏恢复入口和本地缓存管理。
- 如果选择 Flutter 或 Tauri，都需要验证全屏、开机启动、保活和低干扰展示。

### Android

- 专用设备可以使用 Lock Task Mode 做 kiosk-like 展示，但需要 DPC allowlist；普通用户更可能只能用屏幕固定、全屏和保持亮屏。
- 可以通过 Activity flag 或布局属性保持屏幕常亮，但必须考虑耗电和后台限制。

## 初步推荐

第一轮建议按以下顺序推进：

1. Flutter 作为主候选，先验证一套 UI 覆盖 iPadOS / iOS / macOS / Android。
2. Tauri 作为 Web 技术复用候选，在修复 Rust 环境后做最小可行性验证。
3. React Native / Expo 仅作为移动优先备选，除非后续降低 macOS 同构要求。

推荐理由：

- 看板产品重视跨屏一致视觉、平板适配和长时间展示，Flutter 的跨端 UI 一致性更直接。
- 当前 GetTokens 的 React/Wails 经验仍可沉淀为设计系统、状态建模、文档和验收流程，而不必强行绑定运行时。
- Tauri 的移动能力已进入官方路线，但当前本机 Rust 环境不可用，适合并行观察，不适合作为第一天就开工的主链路。

## 环境配置建议

第一优先级：

1. 安装 Flutter SDK。
2. 运行 `flutter doctor`。
3. 确认 iOS Simulator 可运行。
4. 确认 Android Emulator 或真机可运行。
5. 建立 `hello board` 原型并截图。

第二优先级：

1. 修复 Rust 工具链，优先使用 `rustup` 管理稳定版，避免 Homebrew LLVM 动态库不匹配。
2. 安装 Tauri CLI。
3. 验证 `tauri android dev`、`tauri ios dev` 的最小项目。

第三优先级：

1. 确认 Watchman、CocoaPods、Android NDK。
2. 若验证 Expo，必须使用 development build，而不是只依赖 Expo Go。

## 官方资料来源

- Flutter supported deployment platforms: https://docs.flutter.dev/reference/supported-platforms
- Tauri 2 prerequisites and mobile targets: https://v2.tauri.app/start/prerequisites/
- Tauri 2 develop mobile app commands: https://v2.tauri.app/develop/
- Tauri 2 cross-platform positioning: https://v2.tauri.app/
- React Native getting started: https://reactnative.dev/docs/getting-started.html
- React Native macOS introduction: https://microsoft.github.io/react-native-macos/docs/intro
- Expo Android Emulator setup: https://docs.expo.dev/workflow/android-studio-emulator/
- Apple WeatherKit: https://developer.apple.com/weatherkit/
- Apple Guided Access: https://support.apple.com/en-gw/111795
- Android Lock Task Mode: https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode
- Android keep screen on: https://developer.android.com/develop/background-work/background-tasks/awake/screen-on

## 待决问题

1. 首轮是否必须读取系统提醒事项，还是先做应用内提醒？
2. 天气是否优先使用 WeatherKit REST，还是选择跨平台第三方 API？
3. iPad 墙挂是否面向普通家庭用户，还是未来会有 MDM/企业设备场景？
4. macOS 端是同等一等公民，还是作为编辑/预览控制台？
5. 首个原型是否需要账号同步，还是先使用本地配置和本地缓存？
