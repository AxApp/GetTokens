# Codex 二进制管理实现计划

技术细化：`docs-linhay/dev/codex-binary-management-design-2026-05-11.md`

## 实施顺序
1. P0 红灯：为 manifest、local import、activate、doctor、snapshot API 建立失败测试。`DONE`
2. P0 绿灯：新增 `internal/codexbinary`，以本地临时目录替代真实 home 跑通本地版本管理。`DONE`
3. P1 红灯：为 GitHub release catalog、ETag/TTL 缓存、release notes 缓存、网络失败回退建立 fake loader 测试。`DONE: 先覆盖 release 过滤、缓存和网络失败回退；ETag/TTL 深化后置`
4. P1 绿灯：实现远端版本索引和版本说明数据流，保证无网络时本地列表与缓存说明可用。`DONE: GitHub REST + Atom fallback + expanded_assets 补 asset 链路已完成`
5. P2 红灯：为下载链路建立测试，覆盖 `.tar.gz` 解包、下载后激活、缺少当前平台 asset 时失败且不改 active。`DONE`
6. P2 绿灯：实现 `DownloadCodexBinary` 同步下载、解包、导入和可选激活。`DONE`
7. Wails 编排：在 `internal/wailsapp` 增加 DTO 和方法，并在 root `app.go` / `app_types.go` 暴露。`DONE: snapshot/import/download/use/notes/doctor 已暴露；cancel/event/reveal 后置`
8. 前端模型红灯：先补 `codexBinary` 单列表 row 合并、行内 action、notes 展开态、download task 进度和空态/错误态单测。`DONE`
9. 前端 UI：在 Codex 二级菜单新增 `二进制管理` 独立入口，只保留顶部摘要和版本列表；下载、激活、激活回退都在 cell 内完成。`DONE: 取消和定位文件入口后置`
10. 回归验收：运行 Go 单测、前端单测、bindings 生成检查；如改动 Wails runtime，再启动桌面窗口做实际验收。`DONE: 自动化、web preview 和真实 Wails 列表/按钮状态已验证`
11. 托管启用状态：补齐 `managedConfig`，在顶部摘要显示托管目录、当前 `codex` 解析路径、托管 PATH 是否启用，并提供一键托管入口。`DONE`
12. 一键托管边界：后端按 shell/profile 识别实际写入目标，只维护 GetTokens 标记块，写入前备份，重复点击幂等；不能默认用户一定使用 `~/.zshrc`。`DONE`

## 2026-05-12 冒烟结果
- `go test ./...` 通过。
- `npm --prefix frontend run test:unit` 通过，包含 `frontend/src/features/codex-binary/model.test.mjs`。
- `npm --prefix frontend run typecheck` 通过。
- `npm --prefix frontend run build` 通过。
- `./scripts/wails-cli.sh generate module` 已执行，`frontend/wailsjs` 包含 Codex Binary 绑定。
- Web preview URL：`http://127.0.0.1:5173/?preview=codex-binary#frame=codex&workspace=binary-management`。
- `agent-browser` 已验证桌面 preview 可见 `二进制管理`、下载中 cell、激活回退 cell、release notes 展开；页面错误为空。
- 390px 移动宽度下 `document.documentElement.scrollWidth === window.innerWidth === 390`，无横向溢出。
- `http://localhost:34115/#frame=codex&workspace=binary-management` 已验证真实 Wails 页面可自动拉取远端发布列表；当前 GitHub REST API 匿名请求 403 限流时，会回退 `releases.atom` 并展示 `rust-v0.131.0-alpha.*` 列表。
- 已新增 `DownloadCodexBinary` 真实下载入口；Go 层通过 `httptest` 验证 `.tar.gz` 下载、解包、导入和激活闭环。
- 已重启 Wails dev，并在真实页面验证 `rust-v0.131.0-alpha.*` release cell 上“下载并激活”按钮为可执行状态；验收时未点击真实下载，避免改变本机当前 Codex 托管版本。
- 新增截图：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-wails-download-enabled-after-v01.png`。
- 已补齐“一键托管”入口：真实页面显示 `未启用托管 PATH`、托管目录、当前 `codex` 解析路径和后端识别的写入配置路径；点击后由后端写入受控 profile block。截图：`docs-linhay/spaces/20260511-codex-binary-management/screenshots/20260512/codex-binary/20260512-codex-binary-managed-path-after-v01.png`。
- profile 选择规则：zsh 使用 `ZDOTDIR` 时优先 `ZDOTDIR/.zshrc` / `ZDOTDIR/.zprofile`，否则使用 home 下现有 `.zshrc` / `.zprofile`；bash 优先现有 `.bashrc` / `.bash_profile` / `.profile`；fish 使用 `XDG_CONFIG_HOME/fish/config.fish` 或 `~/.config/fish/config.fish`；未知 shell 在 macOS 走 zsh 规则，其它平台走 `.profile` 系列规则。
- 写入边界：只维护 `# >>> gettokens codex binary managed path >>>` 到 `# <<< gettokens codex binary managed path <<<` 标记块；已有 profile 写入前生成 `.gettokens-backup-<timestamp>` 备份；POSIX shell block 使用 `export PATH='<managed-bin>':"$PATH"`，fish 使用 `fish_add_path -g -- '<managed-bin>'`。

## 已确认实现决策
- 平台：首期只支持 macOS arm64 / amd64，不做 Windows/Linux。
- 远端源：首期固定 `openai/codex` GitHub Releases + `rust-v` tag 前缀，不做自定义 repo / URL。
- 校验：下载后必须计算本地 sha256；上游 checksum asset 只记录不强依赖。
- 下载并发：首期 UI 只允许一个活跃下载任务，后端按 `sourceId + tag` 去重。
- 版本说明：前端新增 `react-markdown` + `rehype-sanitize` 安全渲染 release notes，禁止直接注入 HTML。
- 入口：Codex 二级菜单独立入口 `二进制管理`，不挂到账号池、local apply、用量或会话页面。

## 首批测试清单
- `internal/codexbinary`：
  - 无 manifest 时返回默认空状态。
  - 导入本地可执行文件会复制到版本目录并写入 sha256。
  - 相同 sha256 重复导入不会新增版本。
  - 激活版本会更新 `current` 和 `bin/codex` symlink。
  - 激活缺失文件返回错误且不覆盖已有 active。
  - GitHub releases 只选择 `rust-v*`、非 draft、匹配当前架构的 asset。
  - release catalog 使用 ETag/TTL 缓存；网络失败时返回缓存并标记来源。
  - release notes 展开时按 tag 缓存；空 body、无缓存失败、有缓存失败都有稳定返回。
  - 同一 tag 重复下载复用同一个 task，不创建并发重复任务。
  - 取消下载会清理 `.tmp`，不修改 manifest 和 active shim。
  - 下载完成后解包、导入、可选激活；激活失败时保留已安装版本但不切换 active。
  - App 重启遇到未完成 task 时标记 `interrupted` 并清理临时文件。
  - doctor 返回 selected/current/path/configured/active/managed count。
- `internal/wailsapp`：
  - Wails DTO 不暴露内部路径结构之外的敏感内容。
  - snapshot/refresh/notes/download/cancel/use/reveal/doctor 编排能调用领域服务并传递错误。
  - 下载 event 丢失时，前端重新调用 snapshot 能恢复一致列表。
- `frontend`：
  - 空态展示“未托管，但可回退 PATH”。
  - active 版本标记唯一。
  - installed/remote/task 合并为单个版本列表 cell，不拆成多个面板。
  - 下载、取消、激活、激活回退、定位文件都在 cell 内操作。
  - 下载/激活按钮在 loading 时禁用，取消按钮只在可取消阶段出现。
  - 版本说明支持加载中、缓存、不可用和本地导入信息。
  - 账号池、local apply、用量、会话页面不因 binary 状态变化而改变主流程。

## 风险与处理
- GitHub release API 受网络与 rate limit 影响：领域测试必须使用 fake loader，不依赖实时网络。
- release notes 是上游 markdown：前端必须使用 `react-markdown` + `rehype-sanitize` 安全渲染，禁止直接注入 HTML。
- 下载任务和 manifest 写入存在并发：领域服务需要写锁；前端传 `expectedCurrentVersionID`，状态冲突时刷新 snapshot。
- 下载中断恢复不是首期重点：当前下载入口为同步事务，下载失败不写入 manifest、不破坏 active；任务状态、取消和 interrupted 标记后续补齐。
- symlink 在 Windows 语义不同：首期限定 macOS，后续再抽象平台差异。
- `~/.config/gettokens` 与 sidecar 配置共用 profile：目录必须按 `gettokens` / `gettokens-dev` 隔离，避免 dev 覆盖正式用户状态。
- Wails binding 易遗漏 root 暴露：任何新增方法必须同步 `app.go`、`app_types.go` 和前端 `wailsjs`。
- 业务边界漂移：二进制管理只负责 Codex CLI 来源切换和更新，不承担账号池、local apply、用量、会话的解析器或运行时底座角色。

## 暂不创建 worktree
- 本轮只完成需求空间和调研落位，尚未进入并行或多日代码实现。
- 开始实现前再按映射创建 `../GetTokens-worktrees/20260511-codex-binary-management/` 与 `feat/20260511-codex-binary-management`。
