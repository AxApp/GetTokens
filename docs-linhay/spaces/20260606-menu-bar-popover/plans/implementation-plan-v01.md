# Menu Bar Popover 实施计划 v01

> 当前权威状态：后续 `SwiftUI 迁移实现 v05` 已覆盖早期 v01/v02 的 AppKit-only 路线和“检查更新 / 退出 GetTokens”操作区。当前 popover 使用 SwiftUI 优先渲染，操作只保留 `打开账号池 / 刷新额度`，退出 App 不在小票 popover 内显示。

## 决策前置

本需求先做技术 spike，再决定实现路线。当前不建议直接把现有主窗口 Wails 视图迁入 `NSPopover`，因为 Wails v2 的主窗口、runtime bridge 和生成绑定都围绕单个主 WebView 工作。首期应把“能稳定显示 menu bar 图标”和“能打开一个可用轻量入口”放在前面。

## 推荐路线

### Phase 1：需求和状态模型

1. 新增运行时设置字段，例如 `showMenuBarIcon`。
2. 明确与既有 `closeAction` 的关系：
   - `showMenuBarIcon=true`：启动后显示 menu bar 图标。
   - `showMenuBarIcon=false`：正常前台模式可隐藏图标。
   - `closeAction=keep_service_in_menu_bar`：必须保证恢复/退出路径，不允许静默隐藏唯一入口。
3. 设置页文案拆分：
   - “显示菜单栏图标”
   - “关闭窗口后保留服务”

### Phase 2：原生 status item 改造

1. 将 `internal/menubar.Controller` 从驻留专用改为通用 menu bar controller。
2. `Startup` 时根据 `showMenuBarIcon` 启动 status item。
3. `BeforeClose` 时若选择保留服务，确保 status item 可用或阻止进入不可恢复状态。
4. 保留模板 PNG 图标。

### Phase 3：popover 技术 spike

验证三条路线，并用最小 demo 做结论：

1. `NSPopover + 原生 AppKit view`
   - 优点：生命周期简单、稳定、可控。
   - 缺点：不能直接复用 React 组件。
   - 适合首期。
2. `NSPopover + 独立 WKWebView`
   - 优点：有机会复用前端视觉和部分组件。
   - 风险：Wails bridge、资源路径、事件同步、焦点和窗口层级都需要验证。
   - 需要 spike 后才能采用。
3. 继续 `NSStatusItem + NSMenu`
   - 优点：最稳。
   - 缺点：达不到 popover 体验目标。
   - 可作为降级路径。

### Phase 4：首期 popover 实现

若 spike 没有证明 WKWebView/Wails 方案足够稳，首期使用原生 AppKit popover：

1. 尺寸建议：宽 300-340px，高 260-420px。
2. 内容：
   - GetTokens 标题和服务状态。
   - sidecar 端口和 ready/error/stopped。
   - 最近更新时间。
   - `打开 GetTokens`
   - `检查更新...`
   - `退出 GetTokens`
3. 点击外部自动关闭。
4. 状态变更时更新 popover 文案。

### Phase 5：验证

1. Go 测试：
   - runtime settings 默认值和 round-trip。
   - `showMenuBarIcon` 与 `closeAction` 归一化关系。
   - 非 macOS stub 不崩。
2. 前端测试：
   - 设置页显示与切换状态。
   - 驻留策略提示文案。
3. 构建：
   - `go test ./...`
   - `npm --prefix frontend run test:unit`
   - `npm --prefix frontend run typecheck`
   - `./scripts/wails-cli.sh build`
4. 桌面验收：
   - dev `.app` 启动后图标显示。
   - 设置关闭图标后移除。
   - 重新打开后恢复。
   - 点击图标显示 popover。
   - 关闭主窗口保留服务时仍可恢复或退出。
5. 截图：
   - 图标显示状态。
   - popover 打开状态。
   - 设置页开关状态。

## 风险

1. 同时运行正式版和 dev 版时，两个 menu bar 图标可能难以区分；dev 图标或 tooltip 需要可识别。
2. macOS 菜单栏空间不足时，图标可能被系统隐藏，这属于系统层表现，需要在验收说明中区分。
3. 若采用 WKWebView popover，Wails bridge 不稳定会导致 popover 看起来像“前端能显示但操作不可用”，必须在 spike 里提前淘汰。

## 当前建议

先实现“默认显示 menu bar 图标 + 可关闭 + 原生 AppKit popover”，同时保留一个独立 spike 任务验证 `NSPopover + WKWebView/React`。只有 spike 通过后，再考虑把 popover 内容迁到 React/Wails 视图。

## 实现记录 v01：原生 AppKit popover

本轮已进入首轮实现，采用“原生 AppKit popover 优先”的路线，不把现有 Wails 主窗口 WebView 直接塞进 `NSPopover`：

1. 运行时设置新增 `showMenuBarIcon`，默认 `true`；正常前台模式可显式保存为 `false`。
2. `closeAction=keep_service_in_menu_bar` 时强制 `showMenuBarIcon=true`，保证关闭主窗口后仍有恢复窗口和退出服务入口。
3. Wails root DTO、`internal/wailsapp` DTO、`frontend/wailsjs` 绑定和设置页状态已同步 `showMenuBarIcon`。
4. 设置页“启动与驻留”新增“显示菜单栏图标”开关；进入驻留模式时开关显示为开启并禁用，用文案说明这是恢复/退出安全入口。
5. `internal/menubar` 原生桥从 `NSStatusItem + NSMenu` 改为 `NSStatusItem + NSPopover`：点击状态栏图标弹出 popover；popover 内包含服务状态、sidecar 端口提示、`打开 GetTokens`、`检查更新...`、`退出 GetTokens`。
6. 当前 popover 是首期原生稳定入口；额度/余额小票设计稿仍作为后续接入 sidecar quota/balance 快照的视觉目标，不在本轮强行复用 Wails 视图。

### 自动化验收 v01

- `go test ./...`：通过。
- `npm --prefix frontend run test:unit`：通过，741 项。
- `npm --prefix frontend run typecheck`：通过。
- `./scripts/wails-cli.sh build`：通过，产物为 `build/bin/GetTokens.app/Contents/MacOS/GetTokens`；仅剩链接器环境 warning：`ignoring duplicate libraries: '-lobjc'` 与本机 SDK/部署目标版本提示。

### 覆盖测试

1. `internal/wailsapp/app_runtime_settings_test.go` 覆盖默认显示图标、前台模式隐藏图标、驻留模式强制显示图标、配置 round-trip。
2. `app_test.go` 覆盖 root Wails DTO 映射保留 `showMenuBarIcon`。
3. `frontend/src/features/settings/settingsAppRuntime.test.mjs` 覆盖设置页状态归一化，尤其是驻留模式强制开启菜单栏图标。
4. `internal/menubar/popover_bridge_test.go` 源码级锁定状态栏入口使用 `NSPopover`，不再通过 `setMenu:` 挂原生菜单。

## 设计稿 v01

- 入口：`docs-linhay/spaces/20260606-menu-bar-popover/design-preview.html`
- 风格：参考用户提供的 OVERLOADED 像素纸张风格，转换为 GetTokens 的账号额度/余额小票。
- 核心内容：服务状态、可用账号、最低额度、总余额、账号 quota 列表、余额小票、打开工作台、刷新额度。
- 实现提醒：若首期采用原生 AppKit popover，应复刻结构、密度和状态层级，而不是逐像素追求 Web CSS 效果；若后续采用 WKWebView/React，则可复用该 HTML 的布局语义。

## 设计稿 v04：额度余额小票

用户进一步确认：menu bar popover 里用户只关心额度和余额。本版收窄为 `quota + balance only`：

1. 首屏摘要只保留最低额度、风险账号数、总余额和刷新时间。
2. 额度列表只展示需要注意的账号，按剩余比例升序；正常账号不逐个展示。
3. 余额列表只展示可读余额源；无余额能力的账号不显示，不写“未知”。
4. 状态只保留影响使用的 `empty / low / stale`，删除账号类型教学、模型映射、route guard 解释。
5. 操作只保留 `打开账号池` 和 `刷新额度`；完整账号类型、模型、路由和编辑能力统一回主窗口。

账号类型差异仍在实现层影响数据标签和取数方式，但不占用 popover 首屏注意力。

## 设计稿 v05：进度条密度调整

根据用户反馈，额度进度条左右间距过大。本版将风险列表中的窗口标签列和百分比列收窄，进度条与左右读数更贴近小票读数密度：

1. 左侧窗口标签列从宽标签位收窄为紧凑位。
2. 右侧百分比列右对齐。
3. 进度条与左右读数之间只保留小间距。

## 设计稿 v06：移除冗余标题行

根据浏览器评论，移除左侧 popover 中“额度风险 / 按剩余排序”小节标题行。顶部摘要已经说明当前是额度风险视图，风险账号列表可直接承接虚线分隔。

## 设计稿 v07：风险账号行重设计

根据浏览器评论，重新设计单条额度风险行。本版不增加账号类型解释，只强化扫读层级：

1. 左侧用独立票根展示剩余额度百分比，让 `06% / 18% / 22%` 成为第一视觉锚点。
2. 中间只放账号名和窗口/重置信息，避免状态标签挤压账号名。
3. 右侧保留 `empty / low / watch` 小戳记，作为处理紧急度提示。
4. 底部进度条恢复左右读数，窗口标签、条形和百分比紧贴排列，保持小票密度。

## 设计稿 v08：风险账号行再收窄

根据浏览器评论继续重设计 `codex-free-low.json` 这类风险账号行。本版把 v07 的大百分比票根和右侧状态戳进一步删减，改成更直接的额度/余额读数行：

1. 顶部左侧展示账号名和重置窗口，右侧只保留剩余额度百分比。
2. 中间保留紧凑进度条，左右读数仍贴近条形，避免恢复过大的横向间距。
3. 底部只展示影响处理的信息：`empty / low / watch` 状态和余额摘要。
4. 不展示账号类型、OAuth/API key、模型或路由解释，继续保持 `quota + balance only`。

## 设计稿 v09：风险账号行去重复标签

根据浏览器评论继续重设计 `codex-free-low.json` 风险账号行。本版去掉同一行里重复出现的 `quota / 06% / 7D / empty` 标签堆叠，改成更像 menu bar popover 清单的三段式：

1. 顶部左侧只放账号名和重置时间，右侧只放大号剩余额度百分比与“剩余额度”说明。
2. 进度条改为 `1fr + 窗口标签`，不再左右各放一个读数，避免同一百分比重复出现。
3. 底部左侧展示余额值，右侧展示处理状态，例如 `$0.00 余额 / 需充值`。
4. 三条风险账号使用同一结构，保证用户扫读时只看额度和余额，不被账号类型或路由信息打断。

## 桌面验收 v01

本轮桌面验收使用仓库 dev 构建与隔离 profile，没有修改或停止 `/Applications/GetTokens.app` 正式版：

1. dev app：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`，验证时 PID 为 `20252`。
2. dev sidecar：验证时 PID 为 `21156`。
3. dev config：`/tmp/gettokens-menubar-home.aj8UnG/.config/gettokens-dev/config.yaml`。
4. `curl http://127.0.0.1:18317/healthz` 返回 `{"status":"ok"}`。
5. 菜单栏 dev 状态项显示为 `DEV`，点击后打开 `GetTokens Dev` popover。
6. popover 显示 `sidecar port: 18317`，并包含打开窗口、检查更新和退出入口。
7. 正式版进程保持运行，仅作为背景对照；没有触碰正式版二进制、配置或 sidecar。
8. 验收截图：
   - `screenshots/20260607/menubar/20260607-menubar-dev-status-after-v04.png`
   - `screenshots/20260607/menubar/20260607-menubar-dev-popover-after-v04.png`
   - `screenshots/20260607/menubar/20260607-menubar-top-wide-after-v04.png`

## 原生 popover 样式修复 v02

根据用户截图反馈，首期原生 popover 虽然功能可用，但视觉仍是默认 AppKit 表单，与 `design-preview.html` 的额度余额小票差距过大。本轮将 `internal/menubar/menubar_bridge.m` 的 `NSPopover` 内容改为设计稿语义：

1. 背景使用纸张色系，不再使用默认 `windowBackgroundColor`。
2. 标题区改为 `GETTOKENS / BALANCE` 顶栏、像素钥匙和 `Quota receipt`。
3. 摘要区保留最低额度、风险账号、总余额、刷新时间四格；真实快照未接入前使用 `--` / `--:--` 占位。
4. 风险账号区使用账号名、剩余额度、贴边进度条、余额和状态 chip 的小票行结构；当前只显示 `quota snapshot` 占位，不伪造真实账号额度。
5. 余额区保留 `Sidecar ready`、运行状态和 `sidecar port`，作为首期真实运行态来源。
6. 操作区改为 `打开账号池`、`刷新额度`、`退出 GetTokens`，贴近设计稿的 `quota + balance only` 范围。
7. 为避免 macOS 10.13 deployment target warning，mono heavy 字体通过 `popover_mono_font_weight` 包装 `@available(macOS 10.15, *)`。

### 桌面验收 v02

本轮仍只使用仓库 dev 构建与隔离 profile，没有修改或停止 `/Applications/GetTokens.app` 正式版：

1. dev app：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`，最终验证时 PID 为 `25371`。
2. dev sidecar：最终验证时 PID 为 `25379`。
3. dev config：`/tmp/gettokens-menubar-style-home.PiltQd/.config/gettokens-dev/config.yaml`。
4. `curl http://127.0.0.1:18317/healthz` 返回 `{"status":"ok"}`。
5. 点击菜单栏 `DEV` 后出现 layer 25 popover，窗口 bounds 约为 `X=727 Y=28 Width=420 Height=551`。
6. 最终实机截图：`screenshots/20260607/menubar/20260607-menubar-popover-after-v06.png`。

## Runtime quota/balance snapshot 接入 v03

本轮完成真实 sidecar runtime 快照接入，保持 `quota + balance only` 范围：

1. `internal/wailsapp` 新增 menu bar snapshot 投影：读取 `GetAllQuotaStatuses()` 和 `ListAccounts()`，按剩余额度升序取最多 3 条额度行，汇总最低额度、风险账号数、总余额和刷新时间。
2. 投影只读 `/v0/management/gettokens/quota-status` 与 `/v0/management/accounts`，不调用 `/gettokens/quota-refresh`；`刷新额度` 按钮只触发本地 snapshot 重读，不主动刷新上游额度。
3. `internal/menubar` 新增 `SetQuotaSnapshot` bridge；Objective-C 侧只解析 JSON 并渲染，不承载账号类型、模型映射或路由逻辑。
4. 原生 popover 根据 snapshot 动态显示 `sidecar quota / balance 快照已接入`、摘要四格、额度进度条、余额来源列表；无 snapshot 时保留占位态。
5. 当前隔离 dev profile 没有真实账号卡，验收注入的 runtime account key 会 fallback 为 `acct_...`；真实账号环境会通过 `ListAccounts()` 映射到 display name / quota key。

### 自动化验收 v03

- `go test ./internal/menubar ./internal/wailsapp`：通过。
- `go test ./...`：通过。
- `./scripts/wails-cli.sh build`：通过。
- `./docs-linhay/scripts/check-docs.sh`：通过。

新增测试覆盖：

1. `internal/wailsapp/app_runtime_menubar_snapshot_test.go`：排序、余额汇总、空态、只读 runtime snapshot 请求路径。
2. `internal/menubar/popover_bridge_test.go`：锁定 `GetTokensMenuBarSetQuotaSnapshot`、`NSJSONSerialization`、`refreshSnapshot:` selector，并禁止回退到 update-check callback。

### 桌面验收 v03

本轮仍只使用仓库 clean dev 构建与隔离 profile，没有修改或停止 `/Applications/GetTokens.app` 正式版：

1. clean build 产物：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`。
2. dev app：最终验证 PID `21447`。
3. dev sidecar：最终验证 PID `21498`。
4. dev config：`/tmp/gettokens-menubar-final-home.4tS4mS/.config/gettokens-dev/config.yaml`。
5. `curl http://127.0.0.1:18317/healthz` 返回 `{"status":"ok"}`。
6. 使用 local management key 向 dev sidecar 注入 3 条合法 `acct_<uuid>` quota-status 快照，确认 `/v0/management/gettokens/quota-status` 返回 remaining `06% / 18% / 88%` 与 `$0.00 / $42.00 / $80.25` 余额。
7. 点击菜单栏 `DEV` 后打开新小票 popover；点击 `刷新额度` 后重新读取本地 sidecar snapshot，再打开显示最低额度 `06%`、风险账号 `2`、总余额 `$122.25`、刷新 `11:10`。
8. 验收截图：
   - 空态小票：`screenshots/20260607/menubar/20260607-menubar-popover-after-v12.png`
   - quota/balance 快照态：`screenshots/20260607/menubar/20260607-menubar-popover-after-v14.png`

验收注意：本机同时运行正式版和 dev 版时，状态栏会出现正式版模板图标、dev `DEV` 文本和系统状态项。自动化点击需按截图坐标准确点击 `DEV`，否则容易误点正式版旧 popover 或系统电池菜单；本轮未停止或修改正式版。

## SwiftUI 迁移实现 v05

用户明确要求由 Codex 负责推进到 SwiftUI。本轮将 menu bar popover 从“AppKit 手写小票为主”推进为“SwiftUI 渲染优先，AppKit fallback”：

1. 新增 `internal/menubar/swiftui/GetTokensMenuBarPopover.swift`，用 SwiftUI `VStack/HStack/Canvas/ButtonStyle` 实现额度/余额小票视图。
2. SwiftUI 层通过 `@_cdecl("GetTokensMenuBarCreateSwiftUIViewController")` 暴露 C ABI factory，返回 `NSHostingController(rootView:)`。
3. `internal/menubar/menubar_bridge.m` 保留 `NSStatusItem`、`NSPopover`、状态更新和 Go callback 生命周期；打开 popover 时优先 `dlopen` `libGetTokensMenuBarSwiftUI.dylib` 并使用 SwiftUI controller，加载失败时才回退到 AppKit 小票。
4. `打开账号池` 与 `刷新额度` 按钮由 Objective-C 传入 C callback，点击后先关闭 popover，再复用原有 Go 回调；popover 内不再显示 `退出 GetTokens`。
5. 新增 `scripts/build-menubar-swiftui.sh` 按目标架构编译 SwiftUI dylib，显式指定 macOS SDK 与 deployment target，避免 Xcode 默认 target 漂移导致标准库加载失败。
6. 新增 `scripts/install-menubar-swiftui.sh` 安装 dylib 到 `.app/Contents/Frameworks/`，并接入 `scripts/wails-cli.sh`、`scripts/build-local-macos-package.sh` 与 GitHub release workflow。
7. 设计稿同步：分割线改为左右 full-bleed，按钮字体改为 12px heavy mono，操作区只保留 `打开账号池 / 刷新额度`。

### 自动化验收 v05

- `./scripts/build-menubar-swiftui.sh arm64`：通过，产物为 arm64 Mach-O dylib，install name 为 `@executable_path/../Frameworks/libGetTokensMenuBarSwiftUI.dylib`。
- `./scripts/build-menubar-swiftui.sh amd64`：通过，产物为 x86_64 Mach-O dylib；随后重新构建 arm64，保证本机 dev 产物恢复到当前架构。
- `go test ./internal/menubar`：通过。
- `go test ./internal/menubar ./internal/wailsapp`：通过，仍有既有 duplicate `-lobjc` linker warning。
- `./scripts/wails-cli.sh build`：通过；构建前编译 SwiftUI dylib，构建后安装到 `build/bin/GetTokens.app/Contents/Frameworks/` 并重新 ad-hoc codesign。
- `codesign --verify --deep --strict --verbose=2 build/bin/GetTokens.app`：通过；bundle sealed resources 包含 `libGetTokensMenuBarSwiftUI.dylib`。
- `python3 + ctypes` 直接 `dlopen build/menubar-swiftui/libGetTokensMenuBarSwiftUI.dylib` 并调用 `GetTokensMenuBarCreateSwiftUIViewController`：通过，factory 返回非空 controller 指针。
- `xcrun swift docs-linhay/scripts/render-menubar-swiftui-preview.swift ...`：通过，直接 `dlopen` SwiftUI dylib，创建 `NSHostingController` 并渲染 PNG；截图 `screenshots/20260607/menubar/20260607-menubar-swiftui-render-after-v15.png` 证明底部 `打开账号池 / 刷新额度` 操作可见。
- `./docs-linhay/scripts/check-docs.sh`：通过。

### 收尾验收 v06

- `scripts/wails-cli.sh` 补充失败构建保护：只有 Wails build 返回 0 后才执行 `scripts/install-menubar-swiftui.sh` 与 `codesign --deep --force --sign -`，避免 build 失败时继续改写旧 bundle，造成签名证据漂移。
- `scripts/build-menubar-swiftui.sh` 默认把 Swift/clang module cache 放到 `build/menubar-swiftui/module-cache`，不再依赖用户 `~/.cache/clang/ModuleCache`，保证受限本地环境也能编译 arm64 / amd64 SwiftUI dylib。
- `./scripts/wails-cli.sh build`：通过；构建前编译 SwiftUI dylib，构建后安装到 `build/bin/GetTokens.app/Contents/Frameworks/` 并重新 ad-hoc codesign。
- `codesign --verify --deep --strict --verbose=2 build/bin/GetTokens.app`：通过；输出显示 `libGetTokensMenuBarSwiftUI.dylib` 被 prepared/validated，`GetTokens.app` valid on disk。
- `file build/bin/GetTokens.app/Contents/Frameworks/libGetTokensMenuBarSwiftUI.dylib`：通过，当前本机产物为 arm64 Mach-O dylib。
- `otool -D build/bin/GetTokens.app/Contents/Frameworks/libGetTokensMenuBarSwiftUI.dylib`：通过，install name 为 `@executable_path/../Frameworks/libGetTokensMenuBarSwiftUI.dylib`。
- `nm -gU build/bin/GetTokens.app/Contents/Frameworks/libGetTokensMenuBarSwiftUI.dylib | rg GetTokensMenuBarCreateSwiftUIViewController`：通过，确认 SwiftUI factory 符号存在。
- `go test ./internal/menubar ./internal/wailsapp`：通过，仍有既有 duplicate `-lobjc` linker warning。
- `env CLANG_MODULE_CACHE_PATH=/private/tmp/gettokens-swift-module-cache xcrun swift -target arm64-apple-macosx15.0 docs-linhay/scripts/render-menubar-swiftui-preview.swift ...`：通过，截图 `screenshots/20260607/menubar/20260607-menubar-swiftui-render-after-v17.png` 证明 SwiftUI 小票样式、贴边分割线和底部 `打开账号池 / 刷新额度` 操作可见，且没有 `退出 GetTokens`。
- `./docs-linhay/scripts/check-docs.sh`：通过。

### 打开账号池导航修复 v07

根因：SwiftUI / Objective-C 按钮回调链路只调用了 Go 侧 `OpenWindow`，而 `internal/wailsapp/app_runtime_menubar.go` 中的 `OpenWindow` 只执行 `wailsRuntime.Show(a.ctx)` 和 `wailsRuntime.WindowShow(a.ctx)`。它能把主窗口拉出来，但没有向前端发送页面导航意图，也没有修改 hash，因此窗口会停留在用户上一次所在页面。

修复：

1. `OpenWindow` callback 在显示主窗口后发送 `wailsRuntime.EventsEmit(a.ctx, "menubar:navigate", map[string]string{"page": "accounts"})`。
2. `frontend/src/App.tsx` 监听 `menubar:navigate`；当 payload page 为 `accounts` 时执行 `setActivePage('accounts')` 并把 hash 设置为 `#frame=accounts`。
3. 新增 `internal/wailsapp/app_runtime_menubar_test.go` 和 `frontend/src/tests/menuBarNavigation.test.mjs`，锁定 native callback 不再退化为只打开窗口。
4. 同步 `frontend/package.json` 单测清单与 `frontend/package.json.md5`。

自动化验收：

- `go test ./internal/wailsapp ./internal/menubar`：通过，仍有既有 duplicate `-lobjc` linker warning。
- `node --test frontend/src/tests/menuBarNavigation.test.mjs`：通过。
- `npm --prefix frontend run typecheck`：通过。
- `npm --prefix frontend run build`：通过。
- `./scripts/wails-cli.sh build`：通过；产物重新打包并安装 SwiftUI dylib。
- `codesign --verify --deep --strict --verbose=2 build/bin/GetTokens.app`：通过。
- `./docs-linhay/scripts/check-docs.sh`：通过。

已知无关测试状态：

- `npm --prefix frontend run test:unit` 中新增的 `menuBarNavigation` 测试通过，但完整前端单测仍因既有 design-system manifest 覆盖问题失败：`ProjectCandidatePoolRulesModal.tsx` / `ProjectCandidatePoolRulesPanel.tsx` 期望登记到 feature component manifest。该失败来自当前工作区已有 project candidate pool 改动，不属于本次 menu bar 导航修复。

可见状态栏验收说明：

1. 当前用户级 dev runtime 设置为 `showMenuBarIcon=false`，顶部菜单栏未出现 `DEV` 文本入口。
2. 本轮短暂备份并临时开启 dev runtime 菜单栏图标验证，之后已恢复原设置；由于状态栏入口仍被系统/隐藏工具收起，未继续盲点点击。
3. 未修改、停止或替换 `/Applications/GetTokens.app` 正式版。

## 原生 popover 布局修复 v04

根据用户截图反馈，当前小票风格方向正确，但布局存在明显问题：内容主列不统一、余额表头靠空格凑位置、空态额度行被账号行固定列宽拉散、自动化截图曾误点正式版状态栏入口。

本轮修复范围：

1. `internal/menubar/menubar_bridge.m` 新增 `kPopoverWidth`、`kPopoverContentWidth`、`kPopoverHeight`，把小票主列宽收敛为统一 token。
2. 新增 `constrain_width` helper，统一虚线、摘要、额度行、余额行、状态文案和按钮区的宽度约束。
3. 新增 `receipt_header_view()`，替换原先靠 `"余额                                   sources"` 空格字符串对齐的余额表头。
4. 新增 `empty_resource_row()`，为空态单独提供布局，不再复用真实账号额度行导致 `--% / -- / 待接入` 视觉被拉散。
5. `internal/menubar/popover_bridge_test.go` 增加源码级回归，禁止余额表头继续用空格字符串对齐，并锁定统一宽度 token、结构化表头和空态布局入口。

自动化验收：

1. `go test ./internal/menubar`：通过。
2. `go test ./internal/wailsapp`：通过，仍有已知 duplicate `-lobjc` linker warning。
3. `go test ./internal/menubar ./internal/wailsapp`：通过。
4. `./scripts/wails-cli.sh build`：通过；build 产物包含 `BALANCE :: / Quota receipt / quota snapshot` 字符串。
5. `./docs-linhay/scripts/check-docs.sh`：通过。

验收 caveat：

1. 本机同时存在正式版 `/Applications/GetTokens.app` 与仓库 dev build 的同名 `GetTokens` 进程，System Events 对同名进程 status item 的定位不稳定。
2. 本轮曾误点正式版状态栏入口，用户指出后已确认并删除错误截图；这些截图不作为验收证据。
3. 后续做可见截图时，必须先明确关闭正式版 popover，确认点击的是顶部 `DEV` 入口，且截图中出现 `BALANCE :: / Quota receipt` 后才可归档为有效证据。

## 主动刷新额度修复 v08

根因：dev sidecar 当前 `/v0/management/accounts` 有 8 个账号，但 `/v0/management/gettokens/quota-status` 返回 `items: []`。menu bar popover 的数据源是 sidecar runtime quota-status snapshot；此前 `刷新额度` callback 只调用 `refreshMenuBarQuotaSnapshot()` 重新读取本地 snapshot，不会触发 `/gettokens/quota-refresh/<account>`，因此用户已在 dev 账号里配置 quota curl / balance curl 时，小票仍只能显示空态。

修复：

1. 保持启动、sidecar ready 和打开 popover 时只读已有 snapshot，避免后台无提示请求上游。
2. 新增 `refreshMenuBarQuotaSnapshotActive()`，只在用户点击 popover 的 `刷新额度` 时执行。
3. 主动刷新先读取账号列表，只挑选启用且配置了 quota curl 或 billing curl 的 `codex-api-key` / `openai-compatible` 账号调用 sidecar `RefreshQuota(accountKey, includeBilling=true, force=false)`。
4. 每个账号刷新失败只记录日志，不阻断其它账号；最后统一重读 sidecar quota-status snapshot 并推送给 native popover。
5. 保留只读 snapshot 回归测试，并新增主动刷新测试，锁定禁用账号和未配置账号不会被刷新。

当前 dev 证据：

- dev app：`build/bin/GetTokens.app/Contents/MacOS/GetTokens`
- dev sidecar：`build/bin/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml`
- dev sidecar 端口：`18317`
- `/v0/management/accounts`：8 个账号。
- `/v0/management/gettokens/quota-status`：`items: []`，因此修复前 popover 显示 `--% / -- / 待接入` 属于真实空 snapshot。

自动化验收：

- `go test ./internal/wailsapp -run 'TestRefreshMenuBarQuotaSnapshot|TestMenuBarOpenWindow'`：通过，仍有既有 duplicate `-lobjc` linker warning。
- `go test ./internal/menubar`：通过。
- `go test ./internal/wailsapp ./internal/menubar`：通过，仍有既有 duplicate `-lobjc` linker warning。

## 空态文案收敛 v09

用户要求 popover 显示 `等待账号额度快照`。本轮统一 SwiftUI 主渲染与 AppKit fallback：

1. 空态主提示显示 `等待账号额度快照`。
2. 接入态主提示显示 `账号额度快照已接入。`。
3. 资源行 fallback 继续显示 `等待账号额度快照`。
4. 小票主文案不再暴露 `sidecar quota / balance` 工程词。

自动化验收：

- `rg -n "等待 sidecar quota|sidecar quota / balance 快照|等待账号额度和余额快照|账号额度快照" internal/menubar -S`：确认旧主文案已无残留，目标文案存在于 SwiftUI 与 AppKit fallback。
- `go test ./internal/menubar`：通过。
- `./scripts/build-menubar-swiftui.sh arm64`：通过。

## 空账号行文案修正 v10

用户进一步澄清：不是只改顶部提示，而是账号列表没有真实账号时，也不要显示 `quota snapshot` 假账号名，应显示 `等待账号额度快照`。

修复：

1. SwiftUI `Resource()` 空态默认 `name` 改为 `等待账号额度快照`，`detail` 改为 `点击刷新额度后更新`。
2. AppKit fallback `empty_resource_row()` 同步改为同样文案。
3. JSON 资源缺失 `name/detail` 时的 fallback 也同步使用用户文案。
4. `internal/menubar/popover_bridge_test.go` 增加断言，禁止 SwiftUI / AppKit fallback 再把 `quota snapshot` 当作空账号名。

自动化验收：

- `go test ./internal/menubar`：通过。
- `./scripts/build-menubar-swiftui.sh arm64`：通过。
- `./scripts/install-menubar-swiftui.sh build/bin/GetTokens.app && codesign --force --deep --sign - build/bin/GetTokens.app && codesign --verify --deep --strict --verbose=2 build/bin/GetTokens.app`：通过。
