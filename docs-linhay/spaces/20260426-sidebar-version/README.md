# Sidebar Version Label

## 背景
Sidebar 底部原本直接展示原始 `version` 字符串，缺少统一的版本号展示规则，无法满足“发布日期 + hh”的产品要求。同时自动更新仍依赖原始版本比较，不能直接把界面展示格式塞回 `Version`。

## 目标
在 Sidebar 底部增加稳定的发布日期标签，格式统一为 `YYYY.MM.DD.HH`，且不影响自动更新的版本比较逻辑。

追加目标：应用启动后若检测到新版本，Sidebar 底部版本区域直接出现更新提示按钮，让用户不用进入设置页也能看到升级入口。

## 范围
- 提取前端版本展示格式化逻辑
- 新增仅供 UI 展示的 `ReleaseLabel` 构建注入字段
- 在 Sidebar 底部显示格式化后的发布日期标签
- 检测到 `availableRelease` 时，在 Sidebar 底部版本区域显示更新按钮提示
- 更新按钮根据平台能力复用既有更新路径：支持原地更新时触发 `ApplyUpdate`，不支持时打开 release 页面，原生更新器场景交给原生检查更新 UI
- 更新提示文案去重：状态文案只说明“发现新版本”，版本号仅保留在按钮动作中
- 为浏览器验收提供 `?preview=sidebar-update` 预览态
- 为版本格式化补充可执行测试

## 非目标
- 不修改自动更新使用的原始 `Version` 语义
- 不调整状态页上的版本展示
- 不改动自动更新版本比较逻辑

## 验收标准
- Sidebar 底部显示 `VERSION <YYYY.MM.DD.HH>`
- Release 构建通过 `-ldflags` 注入真实发布日期标签
- `dev` 构建可回退到当前日期小时格式展示
- 日期型版本串会被规范化为 `YYYY.MM.DD.HH`
- 启动检测到新版本后，展开 Sidebar 显示 `发现新版本` 语义的更新按钮
- 折叠 Sidebar 时，版本点位替换为可点击更新图标，并保留 tooltip / aria-label
- 展开态更新提示不重复显示版本号，版本号仅保留在按钮动作上
- 浏览器预览 `?preview=sidebar-update#frame=accounts` 能稳定复现更新按钮
- 新增测试可覆盖日期规范化、dev 回退和展示字段读取场景
- 新增测试覆盖 Sidebar 更新提示的隐藏、原地更新、发布页安装和原生更新器分支

## 相关链接
- [Sidebar 组件](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/Sidebar.tsx)
- [Sidebar 更新提示模型](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/sidebarUpdatePrompt.ts)
- [版本格式化工具](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/utils/version.ts)
- [Release 工作流](/Users/linhey/Desktop/linhay-open-sources/GetTokens/.github/workflows/release.yml)

## 当前状态
- 状态：done
- 最近更新：2026-05-26
