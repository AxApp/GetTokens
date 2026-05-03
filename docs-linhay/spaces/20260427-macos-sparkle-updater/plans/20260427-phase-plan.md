# Sparkle 接入阶段计划

## Phase 1：发布基础设施预留

1. 建立 space 与技术方案文档
2. 为 `GetTokens.app` 增加 Sparkle 所需 plist key 注入脚本
3. 在 release workflow 中预留可选 Sparkle 元数据注入步骤
4. 保持现有 GitHub Release 发布不受影响

## Phase 2：原生框架接入

1. 引入 Sparkle framework
2. 在 Wails/macOS 壳层建立原生桥接
3. 提供“检查更新 / 安装更新”调用入口
4. 在非 Sparkle 可用场景保留 release 页面兜底

## Phase 3：appcast 与正式切换

1. 生成 appcast feed
2. 管理 EdDSA key 与签名流程
3. 把 macOS 前端设置页切换为 Sparkle 驱动
4. 做真实升级回归验证
