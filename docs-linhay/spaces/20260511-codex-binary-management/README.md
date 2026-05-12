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
6. Given 用户点击“下载并激活”，When 下载、解包、导入和激活进行中，Then cell 内显示进度和阶段，完成后该版本成为 active shim。
7. Given 用户取消下载，When 下载仍处于可取消阶段，Then 删除临时文件、不修改 manifest、不破坏已有 active shim。
8. Given 用户点击旧版 cell 的“激活回退”，When 激活成功，Then `current` 与 `bin/codex` 指向旧版，列表唯一 active 标记移动到旧版。
9. Given 下载、解包、版本检测、symlink 任一步失败，When 操作返回，Then 不破坏已有 active shim，并返回可定位的错误信息。
10. Given Wails 方法新增或 DTO 变更，When 生成 bindings 后运行前端单测，Then `frontend/wailsjs/go/models.ts` 与调用方类型一致。
11. Given 用户点击“一键托管”，When 后端识别当前 shell，Then zsh 优先现有 `ZDOTDIR/.zshrc` / `ZDOTDIR/.zprofile`，bash 优先现有 `.bashrc` / `.bash_profile` / `.profile`，fish 写入 `XDG_CONFIG_HOME/fish/config.fish` 或 `~/.config/fish/config.fish`；写入前备份已有文件，重复点击不重复插入。

## 设计稿入口

- 本期设计稿：`docs-linhay/spaces/20260511-codex-binary-management/codex-binary-design-v01.html`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

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
- 本切片未完成项：
  - 取消下载、下载 event 进度推送、Reveal in Finder 仍为后续实现项；当前下载使用按钮 busy 状态兜底。

## 冒烟截图

- Web preview：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-web-preview-after-v01.png`
- Mobile preview：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-mobile-preview-after-v01.png`
- Wails release list：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-wails-release-list-after-v01.png`
- Wails download enabled：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-wails-download-enabled-after-v01.png`
- Wails managed path：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-managed-path-after-v01.png`
- Wails managed profile target：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-managed-profile-target-after-v01.png`
- Wails summary panel redesign：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-after-v01.png`
- Mobile summary panel redesign：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-summary-panel-mobile-after-v01.png`

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
- 状态：download-activate-slice-implemented
- 最近更新：2026-05-12
