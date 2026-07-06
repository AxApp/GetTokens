---
name: gettokens-codex-binary-management
description: GetTokens Codex 二进制管理：Codex CLI 版本源、下载、激活、回退、托管 PATH、release cache、版本说明和紧凑列表 UI。
---

# GetTokens Codex Binary Management

当任务涉及 Codex 二进制管理、Codex CLI 版本切换、release 拉取、下载/激活流程、托管 PATH，或修改 `frontend/src/features/codex-binary` / `internal/codexbinary` 时使用本 skill。

## 1. 业务边界
- Codex Binary 是独立业务，负责 Codex CLI 二进制源切换、下载、激活、回退、更新与变更记录。
- 不接入账号池、local apply、用量、会话管理或路由策略流程。
- 用户可见界面保持窄范围：
  - 当前启用摘要
  - 托管 PATH 状态
  - release 筛选
  - 单一版本列表
  - 下载 / 激活动作
  - 变更记录
  - 版本行更多菜单
- 默认筛选为 `stable`。Alpha / prerelease 必须由用户通过筛选显式进入。

## 2. 数据流程
- 进入页面只加载本地 snapshot/cache，不要每次进入都自动请求 GitHub releases。
- `检查更新` 是显式远端刷新边界。
- 远端 release 数据应写入本地缓存，后续进入页面优先复用缓存。
- 历史版本必须分页拉取，不只拿最新正式版。
- 优先使用 GitHub REST；REST 失败或限流时可 fallback 到 Atom / HTML release 页，但当 Atom 最近窗口几乎全是 alpha 时，仍必须能补到 stable 历史版本。
- prerelease 判断不能把 `rust-v` 前缀里的连字符当成 prerelease。应检测 version/tag 中的 alpha/beta/rc/pre/preview 标记。
- 版本说明必须使用 `react-markdown` + `rehype-sanitize` 安全渲染，禁止直接注入远端 HTML。

## 3. 下载 / 激活语义
- 下载和激活是两个独立动作。
- 远端未安装版本显示 `下载`。
- 下载中的版本隐藏下载/激活按钮，只显示阶段、百分比和大小进度。
- 已下载版本显示 `激活`。
- 旧版本在 UI 中仍显示 `激活`。内部可保留 rollback 语义用于 action 推导和成功提示测试。
- 下载完成后只导入托管版本目录，不自动激活；除非后续需求明确改变。
- 下载或导入失败不能破坏当前 active shim。
- 当前启用版本不能删除，前端和后端都必须阻止。

## 4. Managed PATH
- 不假设用户一定使用 `~/.zshrc`。
- 后端负责识别 shell/profile 目标：
  - zsh：优先现有 `ZDOTDIR/.zshrc` / `ZDOTDIR/.zprofile`
  - bash：优先现有 `.bashrc` / `.bash_profile` / `.profile`
  - fish：使用 `XDG_CONFIG_HOME/fish/config.fish` 或 `~/.config/fish/config.fish`
- 只写入 GetTokens 自己的标记 PATH block。
- 写入前备份目标 profile。
- 重复启用必须幂等，不能重复插入 PATH block。

## 5. UI 规则
- Codex Binary 页面保持紧凑、操作导向，避免说明型/营销型文案堆叠。
- 版本列表不要使用卡中卡布局。
- 版本行布局：
  - 左侧：版本身份与紧凑状态
  - 身份附近：可用时显示文件大小
  - 右侧：主操作和菜单
  - 点击行主体展开/收起 release notes
- 主操作直接放在 cell 上：
  - `下载`
  - `激活`
- 次级操作放进右侧菜单：
  - 远端 release：在浏览器中打开
  - 已安装版本：在 Finder 中打开
  - 已安装且非当前版本：删除
- 行内按钮必须阻止事件冒泡，避免误触发 release notes 展开。
- 页面和长 notes 滚动区域使用稳定 scrollbar gutter，避免滚动条出现/消失导致宽度抖动。
- 进度条沿用当前实现和用户最新视觉反馈；普通下载进度不要回退成错误/警告色。

## 6. 前端结构
- `CodexBinaryFeature.tsx` 保持为 controller：
  - snapshot 加载
  - 显式远端刷新
  - 下载轮询
  - 激活/下载/删除/Finder/浏览器动作
  - notes 与菜单状态
- 视图组件放在 `frontend/src/features/codex-binary/components/`：
  - summary panel
  - version list
  - version cell
- release URL、任务大小等纯展示工具放入 `presentation.ts`。
- 行合并、release 筛选、action 推导、任务进度、binary size 格式化保留在 `model.ts`。
- 不新增 catch-all helper 文件。

## 7. 后端 / Wails 边界
- 领域逻辑放在 `internal/codexbinary`。
- Wails-facing 方法放在 `internal/wailsapp`，随后必须通过 `cmd/gettokens/app.go`、必要的 `cmd/gettokens` DTO/mapper 和前端 generated bindings 暴露。
- Wails 生成的 `frontend/wailsjs/go/models.ts` 可能带尾随空白；交付前运行：
  - `perl -i -pe 's/[ \t]+$//' frontend/wailsjs/go/models.ts`
  - `perl -0pi -e 's/\n[ \t]*\n\z/\n/' frontend/wailsjs/go/models.ts`
  - `git diff --check`

## 8. 验证
- 仅前端结构或 UI 调整：
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test:unit -- src/features/codex-binary/model.test.mjs`
  - `npm --prefix frontend run build`
  - 浏览器预览检查 `http://localhost:34115/#frame=codex&workspace=binary-management`
- 后端、DTO 或 Wails 调整：
  - 跑 `internal/codexbinary` / `internal/wailsapp` 相关 Go 测试
  - 影响 shared Wails/root binding 时跑 `go test ./...`
  - public Wails DTO/方法形状变化后重新生成 bindings
- 视觉调整截图放到 `docs-linhay/spaces/20260511-codex-binary-management/screenshots/<YYYYMMDD>/codex-binary/`。

## 9. 文档
- 需求、范围、实施状态、截图和未完成项写入 `docs-linhay/spaces/20260511-codex-binary-management/README.md`。
- 稳定决策写入 `docs-linhay/memory/YYYY-MM-DD.md`。
- 文档或记忆写回后运行 `docs-linhay/scripts/check-docs.sh`。
