# macOS Runtime Residency 会话沉淀

日期：2026-05-19

## 背景

本轮从设置页新增“启动与驻留”能力开始，最终落到一个跨层闭环：设置页负责用户配置，Wails root binding 负责暴露运行时能力，`internal/wailsapp` 负责持久化和生命周期策略，macOS 原生 status item 负责在关闭主窗口但保留服务时提供恢复、更新和退出入口。

这类需求容易只完成前端开关或只完成 native 行为，导致用户关闭窗口后服务仍在但没有可见控制入口，或者浏览器预览能跑、真实 Wails 绑定缺失。后续遇到同类能力需要按桌面生命周期闭环处理。

## 本次沉淀的可复用模式

### 1. 设置页开关必须绑定真实桌面能力

“开机启动”和“关闭窗口是否关闭服务”不是普通前端偏好项。验收必须覆盖：

1. 设置项持久化。
2. macOS login item / LaunchAgent 写入与移除意图。
3. `OnBeforeClose` 或等价生命周期钩子的行为分支。
4. 前端设置页读取、展示和切换状态。
5. 真实桌面 app 中关闭、恢复和退出链路。

### 2. 后台驻留必须有可见恢复和退出入口

如果关闭主窗口后继续运行服务，必须同时提供 status item 或等价 native 入口。该入口至少包含：

1. 当前服务状态。
2. 打开主窗口。
3. 检查更新。
4. 退出应用。

否则用户会进入“服务仍运行但无法感知、无法恢复、无法退出”的状态。

### 3. Wails root binding 是交付边界

GetTokens 的 Wails 绑定根对象是 `main.App`，不是 `internal/wailsapp.App`。后续新增运行时 API 时必须同步：

1. `internal/wailsapp` 实现真实行为和测试。
2. `app.go` 暴露 root method。
3. `app_types.go` 暴露前端需要的 DTO。
4. 必要 mapper 保持 root/internal 类型一致。
5. 重新生成并检查 `frontend/wailsjs` 导出。

只在 `internal/wailsapp` 增加方法会导致前端导出缺失，甚至被下一次 binding 生成移除。

### 4. 浏览器预览只能验收布局，不能替代桌面能力

设置页浏览器预览需要显式 fallback，避免直接调用缺失的 Wails runtime。它适合验收：

1. 信息层级。
2. 文案和开关状态。
3. 响应式布局。
4. 截图归档。

它不能替代：

1. LaunchAgent 写入。
2. 主窗口关闭行为。
3. status item 展示和菜单点击。
4. Sparkle/native updater 行为。

### 5. App 菜单和状态栏图标要按原生 macOS 语义验收

Wails 的 `menu.AppMenu()` 是默认 App 菜单 role，不等同于“可以往左上角应用菜单追加任意自定义项”。如果用户明确指向左上角 `GetTokens` 菜单，需要用 AppKit 在启动后操作 `NSApp.mainMenu`，把自定义项插入到第一个 App 菜单子菜单中；不能把入口放到 `Help` 菜单后宣称完成。

右侧状态栏入口也不应长期使用 `GT` 文字占位。macOS status item 更适合使用 template image：

1. 使用透明 PNG 或其他可模板化资源。
2. 在 AppKit 中调用 `setTemplate:YES`。
3. 使用 `NSSquareStatusItemLength` 保持按钮宽度稳定。
4. Go 侧若用 embed 注入图片字节，Objective-C 侧必须先复制为 `NSData`，再切到主线程安装，避免内存生命周期竞态。
5. 验收时至少读取真实桌面 App 菜单或观察真实状态栏按钮；浏览器预览不能覆盖这类 native placement。

## 不纳入沉淀的内容

1. 本轮不把具体菜单文案、图标造型、LaunchAgent plist 字段固化为长期规则；这些属于当前实现细节。
2. 本轮不把所有设置项都要求 native 验收；只有涉及桌面生命周期、系统集成或 Wails runtime 的设置项适用。
3. 本轮不升级 `AGENTS.md`；该模式属于 GetTokens Wails/macOS 桌面交付流程，先沉淀到项目级 skill 与 dev 文档。

## Skill 更新

已更新 `.agents/skills/gettokens-ops-governance/SKILL.md`，新增 `macOS Runtime Residency & App Lifecycle Settings`：

1. 生命周期设置的 BDD/TDD 基线。
2. 关闭窗口保留服务时的 status item 合同。
3. Wails root binding 同步合同。
4. 浏览器预览 fallback 与验收边界。
5. Go、前端、桌面实机和截图归档的验收清单。

2026-05-26 追加更新：该 skill 补充 `Native menu/status item detail rule`，明确左上角 App 菜单自定义项需要 AppKit bridge，状态栏按钮优先使用 template image，并记录 Go embed 图片字节传给 Objective-C 时的 `NSData` 生命周期边界。

## 后续执行入口

后续遇到设置页新增 macOS 桌面生命周期能力时，先从对应 `space` README 写清验收场景，再按 `gettokens-ops-governance` 的 `macOS Runtime Residency & App Lifecycle Settings` 执行：

1. 先补测试并确认红灯。
2. 实现 root binding、runtime 行为、前端设置和 preview fallback。
3. 跑 Go / 前端测试与构建。
4. 真实 macOS app 验证 close、status item、quit/update 链路。
5. 截图归档到对应 space，并写回 memory 与 qmd。
