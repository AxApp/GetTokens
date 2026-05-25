# Mac 状态栏更新入口

## 背景

GetTokens 已完成 macOS Sparkle 更新链路接入，并在设置页提供原生“检查更新”入口。但 macOS 用户常见操作路径是从状态栏图标菜单快速唤起应用能力；如果更新入口只在主窗口设置页内，用户在后台运行或窗口关闭到状态栏时不容易发现更新能力。

本需求把“检查更新 / 更新 App”入口补到 Mac 状态栏菜单中，复用现有 Sparkle 更新能力，不重新设计发布链。同时补齐设置页中的应用生命周期配置：开机启动、关闭主窗口时是否结束服务、以及保留服务运行时的 macOS 状态栏驻留入口。

## 目标

1. 在 macOS 状态栏菜单中增加清晰的更新入口。
2. 点击状态栏更新入口时，触发现有 Sparkle 原生检查更新流程。
3. 保持设置页更新入口与状态栏入口语义一致，避免两套更新逻辑。
4. 在 Sparkle 不可用、非 macOS、开发环境未嵌入 framework 等场景下提供可理解的降级行为。
5. 在设置页提供开机启动与关闭行为配置。
6. 当关闭主窗口但保留服务运行时，必须启用 macOS 状态栏驻留入口，避免用户无法恢复窗口或退出后台服务。

## 范围

本 space 包含：

1. 状态栏菜单现状调研与入口位置确认。
2. Wails / macOS 原生层到现有 Sparkle bridge 的调用链设计。
3. 状态栏菜单项文案、可用性状态与降级策略。
4. 对应单元测试、集成测试或可执行验证脚本。
5. macOS 桌面实机 / 模拟 release 包验证与截图归档。
6. 设置页生命周期配置：开机启动、关闭行为、状态栏驻留说明。
7. 应用关闭行为：默认关闭主窗口即退出 App 并停止 sidecar；选择保留服务时关闭主窗口只隐藏窗口，sidecar 继续运行，并通过状态栏菜单恢复或退出。

## 非目标

1. 不重新实现 Sparkle 发布、appcast、签名或公证链路。
2. 不把状态栏菜单改造成完整设置中心。
3. 不改变当前设置页的更新入口，除非为了复用同一调用边界必须调整。
4. 不覆盖 Windows / Linux 的系统托盘更新体验。
5. 不在本需求内重做自动后台检查、更新进度事件回流或自定义 Sparkle UI。
6. 不在首期实现复杂自定义 popover；状态栏驻留视图首期使用原生 NSMenu，后续如需要再扩展轻量窗口。

## 验收标准

### 场景 1：状态栏菜单展示更新入口

- Given 用户在 macOS 运行 GetTokens
- When 点击状态栏图标打开菜单
- Then 菜单中能看到“检查更新...”或等价更新入口
- And 入口位置不影响现有显示主窗口、退出等基础操作

### 场景 2：点击入口触发 Sparkle 原生更新检查

- Given release 构建已嵌入 Sparkle framework 且 `SUFeedURL` / `SUPublicEDKey` 配置有效
- When 用户点击状态栏菜单中的更新入口
- Then 应触发现有 Sparkle `checkForUpdates` 流程
- And 弹出的原生更新 UI 与设置页“检查更新”入口行为一致

### 场景 3：Sparkle 不可用时降级明确

- Given 当前环境为非 macOS、开发构建未嵌入 Sparkle framework，或 Sparkle bridge 返回 unavailable
- When 用户打开状态栏菜单
- Then 更新入口不应触发崩溃或无响应
- And 应禁用该入口或走现有 release 页面兜底，具体策略需在实现前固定

### 场景 4：窗口关闭到后台时仍可更新

- Given 用户关闭主窗口但应用仍驻留状态栏
- When 从状态栏菜单点击更新入口
- Then 更新检查仍能被触发
- And 不要求用户先重新打开主窗口

### 场景 5：验证产物可追踪

- Given 本需求完成实现
- When 执行验收
- Then 自动化测试通过，或明确说明不可自动化部分
- And macOS 状态栏菜单 before / after 截图归档到本 space 的 `screenshots/`

### 场景 6：设置页配置开机启动

- Given 用户打开设置页
- When 打开“开机启动”
- Then App 写入用户级启动项配置
- And 设置页能展示保存结果
- And 非 macOS 或无法定位 `.app` 时给出明确失败信息

### 场景 7：关闭主窗口时退出 App 和服务

- Given 用户在设置页选择“关闭窗口即退出 App 和服务”
- When 用户点击主窗口关闭按钮
- Then Wails 允许窗口关闭并触发 App shutdown
- And sidecar 随 App shutdown 停止

### 场景 8：关闭主窗口时保留服务并驻留状态栏

- Given 用户在设置页选择“关闭窗口后继续运行服务”
- When 用户点击主窗口关闭按钮
- Then 主窗口隐藏而不是退出
- And sidecar 继续运行
- And macOS 状态栏菜单可用于打开主窗口、检查更新、退出 App 和服务

## 状态栏驻留视图设计

首期采用原生菜单而不是自定义浮窗，避免后台驻留能力和复杂 UI 绑定在一起：

1. 顶部状态：`GetTokens` 与 sidecar 状态文案。
2. 主操作：`打开 GetTokens`，用于恢复主窗口。
3. 服务操作：`检查更新...`，复用 Sparkle / 现有更新链路。
4. 分隔线后提供 `退出 GetTokens`，明确这会结束 App 和 sidecar。

后续如果要做驻留窗口，应是 280-320px 宽的轻量面板，只展示服务状态、端口、最近账号命中、打开主窗口、退出服务，不承载完整设置表单。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260519-mac-menubar-app-update`
- worktree：`../GetTokens-worktrees/20260519-mac-menubar-app-update/`

## 相关链接

- [macOS Sparkle Updater Space](../20260427-macos-sparkle-updater/README.md)
- [macOS Sparkle Updater 接入方案](../../dev/20260427-macos-sparkle-updater-architecture.md)
- [GetTokens 发布准备指南](../../dev/20260426-release-prep-guide.md)

## 当前状态
- 状态：implemented
- 最近更新：2026-05-25
- 最近变更：将顶部更新入口从 `Help` 菜单迁移到左上角 `GetTokens` App 菜单，位置紧跟 `About GetTokens`，文案为 `检查更新...`；右侧状态栏图标改为嵌入式模板 PNG，不再显示 `GT` 文字。
- 历史变更：修复登录项启动参数未消费导致 Wails 报 `flag provided but not defined: -gettokens-login-item` 的问题；登录项参数会在 `wails.Run` 前剥离，并在驻留模式下用于 `StartHidden` 后台启动。
- 历史变更：扩展为 macOS 状态栏驻留与应用生命周期设置；明确关闭窗口保留服务时必须提供状态栏恢复 / 退出入口，首期状态栏视图采用原生菜单。
- 实施记录：已完成 macOS 顶部 `GetTokens -> 检查更新...` App 菜单入口，点击后复用 `App.CheckUpdate()`；同时补齐原生 status item 驻留菜单、设置页启动与驻留配置、用户级 LaunchAgent 开机启动、关闭窗口隐藏并保留服务的 `OnBeforeClose` 链路。
- 状态栏菜单：选择“关闭窗口后继续运行服务”时启动 macOS status item，菜单包含状态文案、`打开 GetTokens`、`检查更新...`、`退出 GetTokens`；状态栏按钮现使用模板图标。
- 验证：已通过菜单模型测试、应用生命周期 Go 测试、`go test ./...`、`npm --prefix frontend run test:unit`、`npm --prefix frontend run typecheck`、`./scripts/wails-cli.sh build` 和 System Events 桌面菜单读取验证；2026-05-20 追加验证构建后的 `.app` 带 `--gettokens-login-item` 启动不再输出 Wails 未定义 flag。
- 验收产物：`screenshots/20260519/menubar/20260519-menubar-check-update-after-v01.png`；2026-05-25 追加使用 System Events 读取本地构建 App 菜单，确认菜单项为 `About GetTokens, 检查更新..., ...`。
- 补充核对：不需要重新执行真实 Sparkle 点击回归；设置页已有可用更新链路，且代码核对确认设置页、顶部菜单栏和 status item 都调用同一个 root `App.CheckUpdate()`，最终落到 `internal/wailsapp.CheckUpdate()`。菜单入口与设置页的差异仅是无前端状态提示，错误只写日志。
