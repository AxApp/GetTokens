# macOS Sparkle Updater 接入方案

## 背景

GetTokens 当前在 macOS 上使用 `go-selfupdate` 做“检查更新”，但不执行 bundle 内原地替换，只打开 GitHub Release 页面让用户手动下载 DMG。

原因不是更新检测能力不足，而是：

1. macOS signed / notarized `.app` bundle 不适合直接用当前方式做二进制替换
2. 现有发布产物和 updater 校验链更偏跨平台统一方案，不是 macOS 原生升级方案

## 目标

对 macOS 引入 Sparkle，同时保留：

1. GitHub Release 作为最终公开发布源
2. 现有 DMG / updater 资产分发链
3. 非 macOS 平台继续沿用当前 updater 逻辑

## 分层设计

### 1. 前端层

前端不直接理解 Sparkle framework，只消费一个更抽象的“macOS 可原生更新”能力。

建议边界：

1. `CanApplyUpdate()` 不再仅以 `runtime.GOOS != "darwin"` 判定
2. macOS 在 Sparkle 可用后可返回 `true`
3. 前端按钮语义可保持“检查更新 / 安装更新”，但实际走 Sparkle 原生流程

### 2. Go / Wails 层

建议新增一个 macOS 专属 updater bridge：

1. 负责启动 Sparkle updater
2. 暴露“用户触发检查更新”入口
3. 暴露“应用启动时自动检查”策略

当前阶段先不落 framework 联编，只先把发布基础设施补齐。

### 3. Bundle / 发布层

Sparkle 至少需要：

1. `SUFeedURL`
2. `SUPublicEDKey`
3. 正确递增的 `CFBundleVersion`
4. app bundle 内可加载 Sparkle framework

当前阶段先完成第 1、2、3 项的预留；第 4 项放到下一阶段。

## 第一阶段落地内容

1. 新增脚本：`scripts/configure-sparkle-macos.sh`
2. 新增脚本：`scripts/prepare-sparkle-framework.sh`
3. 新增脚本：`scripts/embed-sparkle-framework.sh`
4. `configure-sparkle-macos.sh` 负责把 Sparkle 元数据写入 `GetTokens.app/Contents/Info.plist`
5. `embed-sparkle-framework.sh` 负责把官方 release 中的 `Sparkle.framework` 拷入 app bundle
6. release workflow 在 secrets 就绪时可选调用 plist 注入；framework 嵌入在下一阶段切换为正式启用

## 第二阶段当前进度

当前已额外完成：

1. 新增 `internal/sparkle/` darwin bridge skeleton
2. bridge 现已改为动态加载 `Sparkle.framework`，不依赖编译期静态链接
3. `wailsapp` 在检测到 Sparkle 可用时，会把 macOS 更新入口切到原生更新 UI 模式
4. 前端设置页已能识别“原生更新 UI”模式，并在该模式下只保留单次“检查更新”入口
5. release workflow 现已支持生成签名后的 Sparkle appcast，并推送到固定分支供 `raw.githubusercontent.com` 托管
6. release workflow 新增 `scripts/sync-macos-bundle-version.sh`，在 `wails build` 后显式把 `Info.plist` 中的 `CFBundleShortVersionString` 与 `CFBundleVersion` 改写为 release tag 对应的语义版本

## 新增边界：Sparkle 弹框版本号来源

这次回归额外确认了一条实现边界：

1. GetTokens 前端设置页读取的是 `main.Version`
2. Sparkle 原生“当前已是最新版本”弹框读取的是 app bundle 的 `CFBundleShortVersionString` / `CFBundleVersion`
3. Wails 默认生成的 `Info.plist` 若不在发布后显式改写，可能继续保留默认 `1.0.0`

因此发布链必须把这两套元数据对齐：

1. release tag 继续作为 `main.Version` 注入来源
2. macOS release workflow 在签名、公证前追加一次 bundle 版本同步
3. `scripts/sync-macos-bundle-version.sh` 负责把 `v0.1.10` 这类 tag 规范化为 `0.1.10`，再写入 `CFBundleShortVersionString` 与 `CFBundleVersion`
4. 设置页中的“当前版本 / 最新版本”显示也统一去掉 `v` 前缀，避免和 Sparkle 原生弹框肉眼不一致

当前仍未完成：

1. Sparkle API 的回调事件还没有回流到前端状态栏
2. 还没有用真实 feed 完成端到端升级回归

## Secrets / 环境变量建议

1. `SPARKLE_PUBLIC_ED_KEY`
2. `SPARKLE_PRIVATE_ED_KEY`
3. `SPARKLE_APPCAST_BRANCH`（推荐固定为 `sparkle-appcast`）

当前 appcast 发布策略：

1. release 产物继续上传到 GitHub Release
2. `generate_appcast` 只消费 notarized `.dmg`，不消费纯二进制 `.tar.gz`
3. workflow 从既有 feed 增量生成新内容，并把结果推送到 `sparkle-appcast` 分支
4. Sparkle feed 按架构拆分：
   - `appcast-arm64.xml`
   - `appcast-amd64.xml`
5. 构建时按目标架构写入对应 `SUFeedURL`：
   - `https://raw.githubusercontent.com/AxApp/GetTokens/sparkle-appcast/appcast-arm64.xml`
   - `https://raw.githubusercontent.com/AxApp/GetTokens/sparkle-appcast/appcast-amd64.xml`

## 官方要求摘要

根据 Sparkle 官方文档：

1. 外部构建系统需要自己负责 link framework、拷贝到 `Contents/Frameworks/`、设置 rpath
2. `Info.plist` 需要包含 `SUFeedURL` 与 `SUPublicEDKey`
3. `CFBundleVersion` 必须可递增
4. appcast 推荐使用 `generate_appcast` 生成并签名

参考：

1. https://sparkle-project.org/documentation/programmatic-setup/
2. https://sparkle-project.org/documentation/publishing/

## 当前未完成项

1. Sparkle framework 已支持通过脚本下载并嵌入 app bundle，运行时也已通过动态 bridge 接入，但缺少升级事件回流
2. 分架构 appcast 生成与 `sparkle-appcast` 分支发布链路已在真实 release `v0.1.10` 上验证通过
3. 前端设置页已切到“原生更新 UI”识别模式，但仍缺少 Sparkle 状态反馈
4. 真实的 Sparkle 自动升级安装回归还没有做，只验证到了 release / appcast 发布闭环
