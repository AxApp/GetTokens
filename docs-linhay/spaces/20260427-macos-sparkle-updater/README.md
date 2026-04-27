# 20260427-macos-sparkle-updater

## 背景

当前 GetTokens 在 macOS 上的更新体验仍然停留在：

1. 应用内检查 GitHub Release 是否有新版本
2. 用户点击后跳转到 release 页面
3. 用户手动下载 `.dmg` 并替换安装

这条链路对 signed / notarized 的 macOS app 是安全的，但用户体验明显弱于标准 Mac 应用的“应用内下载并安装更新”。

Sparkle 是 macOS 上成熟的原生更新框架，更适合 GetTokens 当前的发布形态。

## 目标

在不破坏现有签名、公证和 GitHub Release 分发链路的前提下，为 GetTokens 引入 Sparkle 所需的最小基础设施，并逐步把 macOS 更新体验迁移为原生应用内更新。

第一阶段目标：

1. 在文档系统中明确 Sparkle 接入边界、依赖与发布职责
2. 为 macOS app bundle 增加 Sparkle 所需的 `Info.plist` 元数据注入能力
3. 为后续 appcast / Sparkle framework / UI 接入预留稳定发布入口

后续阶段目标：

1. 接入 Sparkle framework 与原生桥接
2. 生成并发布 appcast feed
3. 将 macOS 更新入口从“打开 release 页面”切换为 Sparkle 驱动

## 范围

本 space 包含：

1. Sparkle 接入方案文档
2. Sparkle 所需 app bundle 元数据设计
3. 发布 workflow 的预留与发布脚本改造
4. 后续原生桥接与 UI 迁移计划

第一阶段不强求在本轮完成 Sparkle framework 真正联编进 Wails 二进制。

## 非目标

1. 本轮不替换非 macOS 的 `go-selfupdate`
2. 本轮不废弃 GitHub Release
3. 本轮不立即切掉现有 macOS “跳转 release 页面”兜底链路
4. 本轮不实现 Sparkle 全量 UI 自定义

## 验收标准

### 场景 1：发布链可以写入 Sparkle 元数据

- Given 已构建出 `GetTokens.app`
- When 发布脚本收到 Sparkle feed URL 与 public key
- Then 脚本可以把 `SUFeedURL` 与 `SUPublicEDKey` 写入 app bundle 的 `Info.plist`
- And 缺少任一参数时不会静默写入错误值

### 场景 2：发布链保持向后兼容

- Given 当前 release workflow 仍使用 GitHub Release + DMG / updater 资产
- When 尚未启用 Sparkle secrets
- Then 现有 release 流程仍可继续产出并签名发布
- And 不会因为 Sparkle 尚未启用而阻断发布

### 场景 3：Sparkle 接入边界有据可依

- Given 后续要接入 Sparkle framework 与 appcast
- When 开发者查看项目文档
- Then 能明确知道：
  - Sparkle 依赖哪些 plist key
  - appcast 需要如何生成
  - Wails / macOS 原生桥接应落在哪一层
  - 当前阶段完成了什么、未完成什么

## 相关链接

- [Sparkle Programmatic Setup](https://sparkle-project.org/documentation/programmatic-setup/)
- [Sparkle Publishing](https://sparkle-project.org/documentation/publishing/)
- [GetTokens 发布准备指南](/Users/linhey/Desktop/linhay-open-sources/GetTokens/docs-linhay/dev/20260426-release-prep-guide.md)

## 当前状态
- 状态：in-progress
- 最近更新：2026-04-27
- 最近变更：已完成 Sparkle space / 架构文档 / plist 注入脚本 / framework 下载与嵌入脚本 / darwin bridge / 设置页原生更新入口适配；release workflow 现已支持通过 `SPARKLE_ENABLE=1` 生成并发布签名后的 `appcast.xml` 到 `sparkle-appcast` 分支，但还没有做真实 release 回归。
