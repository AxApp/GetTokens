# 通用墙面看板技术选型与环境配置计划

## 阶段目标

先完成技术调研和环境配置，不进入功能开发。完成后应能明确下一阶段使用哪条技术路线做可运行原型，以及需要补齐哪些平台能力。

## 工作流

1. 新建 space
2. 设计需求
3. 技术细节补充
4. 回到需求调整
5. 调整设计系统的稿子
6. 执行开发
7. 冒烟测试
8. 交付用户测试

## 任务拆分

1. 需求设计
   - 定义墙挂看板的首屏信息结构。
   - 明确天气、提醒事项、时间日期、离线状态和刷新状态的验收标准。
   - 确认首轮是否只做个人看板，暂不做家庭多账号协同。
2. 技术细节补充
   - 对比 Flutter、Tauri、React Native / Expo、Wails/React 延展方案。
   - 确认 iPadOS / iOS / macOS / Android 的常亮、kiosk、后台刷新和本地通知能力边界。
   - 确认天气数据源：WeatherKit REST、平台原生 WeatherKit、或第三方天气 API。
   - 确认提醒事项数据源：Apple Reminders、Android Calendar/Tasks、或先做应用内提醒。
3. 需求回调
   - 根据平台限制回调需求，不承诺系统不允许的后台行为。
   - 把必须依赖用户设置的能力写成显式配置说明。
4. 设计系统稿
   - 单期只保留一个 HTML 入口。
   - 覆盖 iPad 横屏墙挂、iPhone 竖屏、Mac 窗口、Android 平板四类视口。
5. 环境配置
   - 补齐选定技术路线的 CLI、SDK、模拟器或真机验证链路。
   - 固化 `doctor` / smoke check 命令。
6. 冒烟测试
   - 原型启动。
   - 页面无白屏。
   - 核心卡片渲染。
   - 离线降级状态可见。
   - 至少保留一组截图验收产物。

## 当前环境初检

已具备：

- Node.js：`v25.9.0`
- npm：`11.12.1`
- Go：`go1.25.0 darwin/arm64`
- Xcode：`26.5 (17F42)`
- Xcode path：`/Applications/Xcode.app/Contents/Developer`
- JDK：`Temurin OpenJDK 17.0.18`
- Android SDK root：`/Users/linhey/Library/Android/sdk`
- adb：`36.0.2-14143358`
- Cargo：`1.85.0`

缺口与风险：

- Flutter CLI 未安装。
- Wails CLI 未安装。
- `rustc --version` 失败，Homebrew Rust 链接到的 LLVM 动态库符号不匹配；若走 Tauri，需要先修复 Rust 工具链。
- `ANDROID_HOME` 未设置，`ANDROID_SDK_ROOT` 已设置；若走移动端构建，建议统一补齐 `ANDROID_HOME`。
- 尚未确认 Android Emulator、iOS Simulator、CocoaPods、NDK、Watchman 是否完整。

## 下一步验收

1. 选择一条原型路线。
2. 补齐该路线的环境。
3. 新建最小可运行原型。
4. 用模拟器或真机完成首轮 smoke。
5. 把截图归档到本 space。
