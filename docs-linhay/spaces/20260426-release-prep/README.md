# Release Prep & Auto Update

## 背景
当前仓库尚未形成一条可直接发布的版本链路：没有正式 tag，前端没有自动升级入口，release workflow 产物也没有区分“用户下载安装包”和“self-update 可直接替换的原始二进制资产”。

## 目标
- 准备首个可发布版本，默认版本号采用 `v0.1.0`
- 补齐自动升级闭环：release 资产、后端 updater 选择规则、前端检查/应用更新入口
- 明确发布流程中的版本边界与验收标准

## 范围
- GitHub Release workflow 产出安装包和 updater 专用资产
- Settings 页面提供检查更新入口，并按平台切换为“应用更新并退出”或“打开发布页安装”
- 文档沉淀版本号与 updater 资产约束

## 非目标
- 本轮不引入额外发布平台（App Store / winget / homebrew）
- 本轮不做完整 Linux AppImage 工具链建设
- 本轮不自动创建远端 GitHub Release tag

## 验收标准
- `go-selfupdate` 能从 release 中选中当前平台对应的 updater 资产，而不是安装包
- Settings 页面能展示当前版本、检查更新结果，并按平台触发安全的升级动作
- release workflow 中显式区分安装包资产与 updater 资产
- 文档记录首发版本建议、macOS 签名公证顺序与平台升级边界

## 相关链接
- [release workflow](/Users/linhey/Desktop/linhay-open-sources/GetTokens/.github/workflows/release.yml)
- [updater](/Users/linhey/Desktop/linhay-open-sources/GetTokens/internal/updater/updater.go)

## 当前状态
- 状态：done
- 最近更新：2026-04-26
