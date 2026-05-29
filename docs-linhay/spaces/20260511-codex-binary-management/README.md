# Codex 二进制管理

## 背景
- 用户希望参考 Nolon 中 Codex 二进制管理业务，在 GetTokens 中实现同类能力。
- Nolon 已有对标 space：`qmd://nolon/docs-linhay/spaces/nolon-codex-binary-switch/readme.md`，核心目标是 `nolon codex binary switch` 支持从已安装/可下载版本中交互切换。
- Nolon 当前实现已下沉到 `libs/Providers`，App 层只做编排；GetTokens 需要新增一个独立的 Codex 二进制源管理业务，负责 Codex CLI 来源、版本、切换、更新和诊断，不依赖账号池、local apply、用量或会话业务完成主流程。

## 目标
- 在 GetTokens 中提供独立的 Codex CLI 二进制源管理能力，覆盖来源发现、已安装版本清单、远端可用版本、下载安装、激活切换、当前状态和诊断。
- 管理 GetTokens 自己的 Codex CLI shim，并明确显示系统 PATH 中 `codex` 的对照状态。
- 后端先形成可测试的独立领域服务和 Wails 绑定，前端再落独立业务入口，避免只做页面不闭环。

## 范围
- 首期确认边界：
  - 平台：仅支持 macOS arm64 / amd64。
  - 远端源：固定 `openai/codex` GitHub Releases，tag 前缀固定 `rust-v`。
  - 校验：下载后必须计算本地 sha256；首期不强依赖上游 checksum asset。
  - 下载并发：UI 只允许一个活跃下载任务，后端仍按 `sourceId + tag` 去重。
  - 版本说明：前端使用 `react-markdown` + `rehype-sanitize` 安全渲染 release notes，禁止直接注入 HTML。
  - 入口：放在 Codex 二级菜单下独立入口 `二进制管理`，不挂到账号池、用量、会话、local apply 页面。
- 新增 GetTokens 本地二进制管理目录：
  - 首选目录：`~/.config/gettokens/codex/`；dev profile 使用 `~/.config/gettokens-dev/codex/`。
  - manifest：`manifest.json`。
  - 版本目录：`versions/<version-id>/codex`。
  - 当前版本链接：`current -> versions/<version-id>/`。
  - CLI shim：`bin/codex -> versions/<version-id>/codex`。
- 领域能力：
  - 加载/保存 manifest，兼容缺省字段。
  - 导入本地 Codex 可执行文件，计算 sha256 去重，检测 `codex --version`。
  - 从 OpenAI Codex GitHub releases 拉取 `rust-v*` 版本，按当前架构选择 release asset。
  - 缓存远端 release catalog 和单版本 release notes，网络失败时可回退展示缓存。
  - 以下载任务承载进度、取消、失败重试和下载后激活，不把下载做成不可感知的同步阻塞。
  - 下载 `.tar.gz` 或裸二进制，解包/导入，设置可执行权限。
  - 激活指定版本，更新 symlink 和 manifest。
  - 查询当前版本、active path、PATH 配置状态和 doctor 信息。
  - 提供一键托管入口，由后端识别当前 shell/profile 并写入 GetTokens 受控 PATH block。
- Wails 绑定：
  - `GetCodexBinarySnapshot`
  - `RefreshCodexBinaryAvailable`
  - `GetCodexBinaryVersionNotes`
  - `DownloadCodexBinary`
  - `UseCodexBinary`
  - `GetCodexBinaryDoctor`
  - 后续补充：`CancelCodexBinaryDownload`、`RevealCodexBinary`
- 前端入口：
  - 首期作为 Codex 二进制管理的独立业务入口，可挂在 Codex 工作区内，但不混入账号池、local apply、用量、会话或状态诊断页面。
  - 首屏只展示当前启用摘要、检查更新和版本列表；下载、取消、激活、回退、定位文件都在版本 cell 上完成。
  - 版本 cell 支持展开查看变更记录；本地导入版本展示导入来源、sha256 和检测版本。

## 非目标
- 首期不接入账号池、local apply、用量统计、会话管理的业务流程。
- 首期不把二进制管理设计成其他 Codex 功能的公共依赖底座。
- 首期不复刻 Nolon 的 `nolon codex binary switch` 交互式 CLI。
- 首期不改写 Xcode CodingAssistant Agents 目录，也不替换 Xcode 内置 `codex`。
- 不写死 `~/.zshrc`，也不接管用户整个 shell profile；只在后端识别到的 profile 内维护 GetTokens 标记块。
- 首期不处理多平台安装包发布，只支持当前 macOS 桌面运行环境。
- 首期不把 Codex model preference、reasoning effort、launch environment 放进同一批实现；这些属于后续高级配置。
- 首期不支持断点续传；App 重启后未完成下载标记为 `interrupted` 并允许重试。

## 验收标准
1. Given 本机没有托管 Codex manifest，When 打开 Codex 二进制管理，Then 返回空版本列表、当前系统 `codex` 版本（若 PATH 可解析）和可读诊断信息。
2. Given 用户导入一个本地可执行 `codex`，When 导入成功，Then manifest 新增版本，文件复制到 `versions/<id>/codex`，sha256 相同的重复导入不会新增记录。
3. Given 已存在一个托管版本，When 用户激活该版本，Then `current` 与 `bin/codex` 指向该版本，`selectedVersionId` 更新，`GetCodexBinarySnapshot` 返回该版本为当前启用。
4. Given GitHub releases 返回多个 `rust-v*` 版本，When 查询可下载版本，Then 只展示匹配当前架构的非 draft release；默认过滤 prerelease。
5. Given 用户展开远端版本 cell，When release notes 可获取，Then 展示该版本变更记录；网络失败但有缓存时展示缓存并标记来源。
6. Given 用户点击远端版本的“下载”，When 下载、解包和导入进行中，Then cell 内隐藏下载/激活按钮并显示进度和阶段；完成后该版本进入已下载状态，同一 cell 只显示“激活”。
7. Given 用户取消下载，When 下载仍处于可取消阶段，Then 删除临时文件、不修改 manifest、不破坏已有 active shim。
8. Given 用户点击旧版 cell 的“激活”，When 激活成功，Then `current` 与 `bin/codex` 指向旧版，列表唯一 active 标记移动到旧版。
9. Given 下载、解包、版本检测、symlink 任一步失败，When 操作返回，Then 不破坏已有 active shim，并返回可定位的错误信息。
10. Given Wails 方法新增或 DTO 变更，When 生成 bindings 后运行前端单测，Then `frontend/wailsjs/go/models.ts` 与调用方类型一致。
11. Given 用户点击“一键托管”，When 后端识别当前 shell，Then zsh 优先现有 `ZDOTDIR/.zshrc` / `ZDOTDIR/.zprofile`，bash 优先现有 `.bashrc` / `.bash_profile` / `.profile`，fish 写入 `XDG_CONFIG_HOME/fish/config.fish` 或 `~/.config/fish/config.fish`；写入前备份已有文件，重复点击不重复插入。
12. Given 用户点击版本 cell 右侧更多菜单，When 该版本来自远端 release，Then 可在浏览器中打开 release 页面；已下载版本还可在 Finder 中定位，非当前启用版本可删除，当前启用版本前端禁用删除且后端拒删。

## 设计稿入口

- 本期设计稿：`docs-linhay/spaces/20260511-codex-binary-management/codex-binary-design-v01.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## 会话蒸馏

- 项目级 skill：`.agents/skills/gettokens-codex-binary-management/SKILL.md`
- 本轮沉淀文档：`docs-linhay/dev/20260514-codex-binary-session-distillation.md`
- 适用范围：Codex CLI 二进制源、版本下载、激活/回退、托管 PATH、release cache、版本说明、版本列表 UI 和相关拆文件工作流。

## 实施状态

- 2026-05-12 已完成首个可冒烟实现切片：
  - 后端新增 `internal/codexbinary` 领域服务，覆盖 snapshot、本地导入、sha256 去重、版本检测、激活 symlink、版本说明缓存。
  - 远端版本列表已接入 `openai/codex` GitHub Releases；当 GitHub REST API 匿名限流时，回退读取 `releases.atom`，用于展示 release tag 列表和变更摘要。
  - Wails root App 已暴露 `GetCodexBinarySnapshot`、`ImportCodexBinary`、`UseCodexBinary`、`GetCodexBinaryVersionNotes`、`GetCodexBinaryDoctor`，并已重新生成 `frontend/wailsjs`。
  - 前端新增 Codex 二级菜单 `二进制管理`，支持普通浏览器 `?preview=codex-binary#frame=codex&workspace=binary-management` 预览。
  - 前端新增单列表版本 cell、下载任务展示、行内激活/回退入口、release notes 安全渲染。
- 2026-05-12 已继续完成真实下载激活切片：
  - 后端新增 `DownloadCodexBinary` 同步入口，支持按 `sourceId + tag` 解析远端版本、下载裸二进制或 `.tar.gz`、解包查找 `codex`、复用本地导入、下载后激活。
  - release asset 选择优先 `codex-<platform>.tar.gz`，避免误选同 release 中的 DMG 或其他工具资产。
  - `releases.atom` 回退源没有 asset 时，会再读取 GitHub `expanded_assets/<tag>` 页面补齐下载链接。
  - 前端版本 cell 上的“下载并激活”已接入真实 Wails 方法；浏览器 preview 继续使用安全预览数据。
- 2026-05-12 已补齐一键托管入口：
  - `Snapshot` 新增 `managedConfig`，区分“版本已激活”和“shell PATH 已启用托管 shim”两个状态。
  - 顶部摘要显示托管目录、当前 `codex` 解析路径、托管 PATH 状态和实际写入配置路径。
  - 未启用时提供“一键托管”，后端按 `$SHELL` / `ZDOTDIR` / `XDG_CONFIG_HOME` / 现有 profile 文件选择目标；只写 GetTokens 标记块，写入前备份，重复点击保持幂等。
  - POSIX shell 写入 `export PATH='<managed-bin>':"$PATH"`，保证包含空格的托管目录安全，同时保留新终端运行时 `$PATH` 展开；fish 使用 `fish_add_path -g -- '<managed-bin>'`。
- 2026-05-13 已调整入口加载策略：
  - 进入页面只读取本地 snapshot/cache，不自动拉取 GitHub 发布列表。
  - 用户点击“检查更新”时才主动刷新远端版本，避免每次切回页面都产生网络请求。
- 2026-05-13 已修复正式版筛选为空的远端 fallback 问题：
  - 根因：GitHub REST API 匿名请求失败时后端只回退到 `releases.atom`；Atom 只返回最近少量 release，当最近窗口几乎全是 `alpha` 时，正式版不会进入远端版本模型。
  - 同步修正 Atom prerelease 判断：不能用 tag 是否包含 `-` 判断，因为正式版 tag `rust-v0.129.0` 本身包含 `rust-v` 的连字符。
  - 修复：Atom fallback 若没有正式版，继续读取 GitHub releases HTML 分页，解析 `/releases/tag/rust-v*` 链接并补齐符合 semver 的 release。远端刷新会缓存正式版与 prerelease 的完整列表，由前端 `全部 / 正式版 / Alpha` 筛选器决定显示范围。
  - 历史版本：GitHub REST 拉取改为 `per_page=100`、最多 5 页；REST 不可用时 HTML fallback 也最多扫 5 页，不再拿到第一个正式版就停止。刷新结果写入本地 release catalog，后续进入页面优先展示缓存。
  - 后续资产解析仍复用 `expanded_assets/<tag>` 链路，因此 HTML 补出的正式版也能继续获得当前平台下载链接。
- 2026-05-13 已调整版本 cell 内部布局：
  - 默认版本筛选改为“正式版”，进入页面先展示稳定历史版本。
  - 经 Gemini 设计讨论后，版本 cell 拆为身份/变更记录入口、状态元信息、右侧主操作三段；下载进度独立跨列显示，不再塞在展开按钮内部。
  - 移除当前不可用的灰色定位/取消按钮，只保留下载并激活、激活、回退和变更记录入口，避免列表操作区噪音。
  - 变更记录展开区增加最大高度与内部滚动，防止长 release notes 撑散版本列表。
- 2026-05-13 已根据真实截图二次收敛版本 cell：
  - 问题：三段式落地后在桌面截图中形成竖向边框切割、灰色操作井和中间大面积留白，整体更像表格货架而不是版本操作列表。
  - 修复：去掉内部三栏硬分割、固定高度和右侧灰底，改成紧凑“工业铭牌”行：版本/标签/变更记录在左，下载/激活主操作在右，展开内容独立挂在底部。
  - 窄屏下取消按钮固定最小宽度，避免侧栏存在时“下载并激活”被截断。
- 2026-05-13 已进一步简化版本 cell：
  - 移除 `VersionBadge` 和次级元信息行，只保留版本号、active/rollback 状态和右侧主操作。
  - 移除独立“变更记录”按钮，点击版本 cell 非操作区域即可展开/收起 release notes。
  - 右侧下载/激活/回退按钮会阻止事件冒泡，避免执行操作时误触发展开。
- 2026-05-13 已拆分下载与激活流程：
  - 远端未安装版本只显示“下载”；下载中的 cell 不再显示下载/激活按钮，只显示阶段、百分比和进度条。
  - 下载完成后只导入到托管版本目录，不自动激活；同一版本行变为“激活”按钮。
  - 已安装版本按 semver 判断操作语义：高于或低于当前版本都显示“激活”，内部仍保留 rollback action 用于成功提示和回归测试。
  - 后端 `DownloadTaskView` 写入 snapshot，前端在下载期间轮询 snapshot 刷新进度。
  - 解包兼容上游 `codex-aarch64-apple-darwin.tar.gz` 只包含 `codex-<platform>` 可执行文件的结构，导入时统一落成托管 `codex`。
- 2026-05-13 已补齐版本 cell 右侧更多菜单：
  - 所有远端版本右侧新增更多菜单，未下载版本菜单只承载“在浏览器中打开”；已安装版本菜单额外承载“在 Finder 中打开”和“删除版本”；下载、激活、回退仍保留为主按钮，不同时铺开次级操作。
  - `VersionRowView` 透传 release `htmlURL`，远端行和已安装/远端合并行都能打开对应 GitHub release 页面；缺少 `htmlURL` 时按 `openai/codex` tag 构造 release URL。
  - `VersionRowView` 同步透传 release `assetSize`，版本 cell 在版本号下方显示文件大小；历史缓存或 HTML fallback 缺少大小时显示“未知”，下载中则优先用任务 `bytesTotal` 显示已下载/总大小。
  - `RevealCodexBinaryVersion` 根据托管 `versionID` 解析真实二进制路径，并复用桌面文件管理器打开能力定位文件。
  - `DeleteCodexBinaryVersion` 删除非当前启用版本目录并更新 manifest；当前启用版本前端禁用删除，后端返回 `codex_binary_delete_active_version` 拒绝破坏 active shim。
  - 菜单点击会阻止行展开，外部点击或 Escape 会关闭菜单，避免筛选或列表刷新后悬浮层错位。
- 2026-05-13 已整理前端代码结构：
  - `CodexBinaryFeature.tsx` 收敛为页面 controller，保留 snapshot 加载、远端刷新、下载轮询、激活、删除、Finder/浏览器打开和 notes 展开状态编排。
  - 新增 `components/CodexBinarySummaryPanel.tsx`、`components/CodexBinaryVersionList.tsx`、`components/CodexBinaryVersionCell.tsx`，把顶部摘要、筛选列表和版本行从主文件拆出。
  - 新增 `presentation.ts` 承载 release 浏览器 URL 与下载大小展示格式化，避免把纯展示逻辑继续堆在 controller 中。
  - 本轮为结构整理，不改变下载、激活、回退、菜单、release notes 和默认正式版筛选语义。
- 2026-05-21 已补齐摘要面板和版本 cell 的设计系统运行时圈定：
  - `CodexBinarySummaryPanel` 与 `CodexBinaryVersionCell` 根节点新增 `data-design-system-component="true"` 和对应 `data-design-system-component-name`，项目页设计系统高亮可直接定位 Codex Binary 业务组件。
  - `storyCatalog.test.mjs` 将这两个业务组件纳入 runtime marker 门禁，避免后续重构移除标记。
- 2026-05-29 Codex 接管该页面维护：
  - 当前责任边界：Codex Binary 页面继续按 `.agents/skills/gettokens-codex-binary-management/SKILL.md` 维护，保持独立业务，不混入账号池、local apply、用量、会话或路由策略。
  - 接管基线：工作区干净；`frontend/src/features/codex-binary` 已拆为 controller、summary panel、version list、version cell、model 与 presentation 工具。
  - 验证基线：已运行 `npm --prefix frontend run test:unit -- src/features/codex-binary/model.test.mjs`，实际触发完整 frontend unit suite，613 个测试全通过。
  - 补充验证：`npm --prefix frontend run typecheck`、`npm --prefix frontend run build`、`go test ./internal/codexbinary ./internal/wailsapp` 均通过；build 仅有既有 chunk size warning。
  - 治理补齐：新增可跟踪的 `screenshots/.gitkeep`，并调整 `.gitignore` 为忽略截图内容但允许保留截图目录骨架。
- 2026-05-29 已修复托管 PATH 与 release notes 两个回归：
  - 根因 1：`managedConfig()` 只检查当前 App 进程的 `PATH`。macOS GUI App 重启后通常不会 source shell profile，导致 profile 里已有 GetTokens managed block 时仍显示“一键托管”。
  - 修复 1：托管状态改为同时检查进程 `PATH` 和目标 profile 中的 GetTokens managed block；新增 `TestManagedPathSnapshotUsesProfileBlockAfterAppRestart`。
  - 根因 2：`VersionNotes()` 只读 `cache/release-notes`，有缓存就标记为 `cache`，无缓存就返回 `local` 空内容，点击版本行不会请求 GitHub。
  - 修复 2：`GetCodexBinaryVersionNotes` 进入后端时优先通过 release client 拉取对应 GitHub release body，成功后刷新本地缓存；远端失败时才回退缓存；新增 `TestVersionNotesPrefersRemoteWhenCacheExists` 和 `TestVersionNotesFallsBackToCacheWhenRemoteFails`。
  - 验证：`go test ./internal/codexbinary ./internal/wailsapp`、`go test ./...`、`npm --prefix frontend run test:unit -- src/features/codex-binary/model.test.mjs`、`npm --prefix frontend run typecheck`、`npm --prefix frontend run build` 均通过；build 仅有既有 chunk size warning。
- 本切片未完成项：
  - 取消下载、下载 event 推送仍为后续实现项；当前下载进度通过 snapshot 轮询展示。

## 冒烟截图

- Web preview：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-web-preview-after-v01.png`
- Mobile preview：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-mobile-preview-after-v01.png`
- Wails release list：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-wails-release-list-after-v01.png`
- Wails download enabled：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-wails-download-enabled-after-v01.png`
- Wails managed path：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-managed-path-after-v01.png`
- Wails managed profile target：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-managed-profile-target-after-v01.png`
- Wails summary panel redesign：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-after-v01.png`
- Mobile summary panel redesign：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-mobile-after-v01.png`
- Wails release filter alpha：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-release-filter-alpha-after-v01.png`
- Wails compact summary：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-compact-summary-after-v02.png`
- Mobile compact summary：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-compact-summary-mobile-after-v01.png`
- Wails release filter stable：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-release-filter-stable-after-v01.png`
- Wails release filter alpha after stable fallback：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-release-filter-alpha-after-v02.png`
- Wails release filter stable history：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-release-filter-stable-history-after-v01.png`
- Wails version cell layout：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-layout-after-v02.png`
- Mobile version cell layout：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-layout-mobile-after-v01.png`
- Wails version cell weird before：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-weird-before-v01.png`
- Wails version cell compact row：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-layout-after-v04.png`
- Mobile version cell compact row：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-layout-mobile-after-v03.png`
- Wails version cell click row：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-click-row-after-v01.png`
- Wails version cell expanded by row click：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-cell-click-row-expanded-after-v01.png`
- Wails download progress：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-download-progress-after-v01.png`
- Wails download complete activate-only：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-download-complete-activate-after-v01.png`
- Wails filter toolbar flattened：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-filter-toolbar-after-v01.png`
- Wails version cell menu：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-menu-after-v01.png`
- Wails version cell browser menu：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-menu-browser-after-v01.png`
- Wails version file size：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260513/codex-binary/20260513-codex-binary-version-file-size-after-v01.png`

## Nolon 对标结论
- 核心模型：`CodexBinaryManifest` + `ManagedCodexVersion`，字段包括 selected version、sync model、preferred terminal、launch env、versions、last seen remote release、include beta 和 update state。
- 核心服务：`CodexBinaryManager` 负责目录、manifest、导入、下载、激活、PATH 状态、远端 release、doctor。
- CLI 层：`NolonCodexCLIService` 暴露 `binaryList / binaryAvailable / binaryCurrent / binaryInstall / binaryUse / binaryDoctor`，`NolonCodexCLIExecutor` 负责命令渲染和交互式 switch。
- UI 层：Nolon 将 Binary 作为 Codex provider tab 之一，视图模型再组合 manifest、release notes、版本表和 action bar。
- 可借鉴但需裁剪：GetTokens 先做“二进制源管理”独立闭环，不需要 Nolon 的 Swift Package 下沉和 ParsableCommand CLI 体系，也不把它并入账号池、local apply、用量或会话。

## GetTokens 落点
- 后端建议新增：
  - `internal/codexbinary/`：领域服务、manifest、release client、archive extraction、symlink/path helper、单元测试。
  - `internal/wailsapp/codex_binary.go`：Wails-facing 编排和 DTO。
  - root `app.go` / `app_types.go`：导出 Wails 方法和映射类型。
- 前端建议新增：
  - 独立的 `codex-binary` feature/component：承载顶部摘要和单一版本列表，不拆来源表、安装表和诊断表。
  - 独立的 `codexBinary` 状态转换和 UI helper，负责 installed/remote/task 合并、cell action 推导和 notes 展开态。
  - `frontend/src/locales/en.json` / `zh.json`：文案。
- 测试建议：
  - Go：manifest 兼容、导入去重、激活 symlink、release asset 选择、release notes 缓存、下载取消、下载失败不破坏 active、doctor。
  - 前端：单列表合并、cell 行内操作、当前版本展示、下载进度、变更记录展开、错误态和空态。
  - Wails binding：方法和 DTO 生成后运行相关前端单测。
- 技术细化：
  - `docs-linhay/dev/codex-binary-management-design-2026-05-11.md`

## Worktree 映射

- branch：`feat/20260511-codex-binary-management`
- worktree：`../GetTokens-worktrees/20260511-codex-binary-management/`

## 相关链接
- Nolon space：`qmd://nolon/docs-linhay/spaces/nolon-codex-binary-switch/readme.md`
- Nolon 下沉文档：`/Users/linhey/Desktop/FlowUp-Libs/nolon/docs-linhay/dev/codex-binary-downsink-phase1.md`
- Nolon 核心实现：
  - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexBinaryManager.swift`
  - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/Providers/Codex/CodexBinaryManifest.swift`
  - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCLI.swift`
  - `/Users/linhey/Desktop/FlowUp-Libs/nolon/libs/Providers/Sources/NolonCoreCLIKit/NolonCodexCLIExecutor.swift`
- GetTokens 相关现状：
  - `internal/wailsapp/codex_feature_config.go`
  - `internal/sidecar/profile.go`
  - `frontend/src/features/status/StatusFeature.tsx`
- GetTokens 技术方案：
  - `docs-linhay/dev/codex-binary-management-design-2026-05-11.md`

## 当前状态
- 状态：codex-owned-maintenance
- 最近更新：2026-05-29
