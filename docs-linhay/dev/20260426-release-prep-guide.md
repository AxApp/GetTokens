# GetTokens 发布准备指南

## 目标版本
当前首发版本建议采用 `v0.1.0`，原因：

1. 仓库当前还没有任何 git tag。
2. `frontend/package.json` 版本号已是 `0.1.0`。
3. 当前功能集合更接近首个公开可用版本，而不是后续增量 patch。

## 发布资产分层
当前阶段先只支持 macOS release，资产分成两类：

1. 用户下载安装包
   - macOS: `GetTokens_darwin_universal.dmg`
2. 自动升级资产
   - macOS: `GetTokens_darwin_universal.tar.gz`

说明：
- macOS 保留 `tar.gz` 资产用于检测最新版本和统一校验链，但签名发布包不做 bundle 内原地替换，设置页会跳转到 release 页面安装。
- 原因是 Apple 对签名 bundle 的 seal 有要求；修改 `.app` 主可执行文件会破坏签名边界。参见 Apple Technical Note TN2206。

## sidecar 构建边界
发布前必须先从仓库内维护的 `docs-linhay/references/CLIProxyAPI` 源码构建 sidecar，不能直接下载上游 release 二进制。

原因：

1. `CLIProxyAPI` 已经进入 fork 维护态，行为修复首先落在 fork 源码，而不是等 fork release。
2. fork release 可能滞后，直接下载 release 无法保证包含本轮补丁。
3. 对 `darwin/universal`，最终写入 `GetTokens.app` 的 `Contents/MacOS/cli-proxy-api` 必须是 universal binary；不能只塞一份 `arm64`。

对应脚本：
- `scripts/build-sidecar.sh <goos> <goarch> <output-dir>`

补充：

1. 本地开发默认优先使用 `docs-linhay/references/CLIProxyAPI`
2. CI runner 若没有该目录，脚本会自动 clone `https://github.com/linhay/CLIProxyAPI.git`
3. 默认构建分支为 `gettokens/wham-token-fix`，可通过 `CLI_PROXY_SOURCE_REF` 覆盖

示例：

```bash
./scripts/build-sidecar.sh darwin universal build/bin
```

## macOS 签名与公证
macOS release 现在按以下顺序处理：

0. 从 `docs-linhay/references/CLIProxyAPI` 源码构建 universal sidecar，写入 `build/bin/cli-proxy-api`
1. 执行 `wails build`
2. 用 `build/bin/cli-proxy-api` 显式覆盖 `build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api`，确保 app bundle 内 sidecar 仍是 universal binary
3. 使用 `Developer ID Application` 证书对 `GetTokens.app` 做 hardened runtime 签名
4. 使用 `notarytool` 提交 `.app` 的 zip 包并等待公证完成
5. 对 `.app` 执行 `stapler staple`
6. 基于已 stapled 的 `.app` 生成 DMG
7. 对 DMG 重新签名后再次提交 notarization
8. 对 DMG 执行 `stapler staple`
9. 最后再从签名后的 `.app` 中提取 updater 原始可执行文件，打成 `tar.gz`

对应脚本：
- [scripts/build-sidecar.sh](/Users/linhey/Desktop/linhay-open-sources/GetTokens/scripts/build-sidecar.sh)
- [scripts/sign-notarize-macos-release.sh](/Users/linhey/Desktop/linhay-open-sources/GetTokens/scripts/sign-notarize-macos-release.sh)
- [scripts/package-updater-asset.sh](/Users/linhey/Desktop/linhay-open-sources/GetTokens/scripts/package-updater-asset.sh)

`sign-notarize-macos-release.sh` 分成两个模式：
1. `app <path>`：签名、notarize、staple `.app`
2. `dmg <path>`：签名、notarize、staple `.dmg`

## GitHub Secrets
CI release workflow 需要以下 secrets：

1. `MACOS_SIGNING_IDENTITY`
   示例：`Developer ID Application: HAN LIN (3L8RM3MDLS)`
2. `MACOS_DEVELOPER_ID_P12_BASE64`
   Developer ID Application 证书导出的 `.p12` 内容做 base64 后存入
3. `MACOS_DEVELOPER_ID_P12_PASSWORD`
   上述 `.p12` 的导出密码
4. `MACOS_NOTARY_KEY_ID`
   App Store Connect API Key 的 key id
5. `MACOS_NOTARY_ISSUER_ID`
   App Store Connect API Key 的 issuer id
6. `MACOS_NOTARY_API_KEY_BASE64`
   `AuthKey_<KEY_ID>.p8` 文件内容做 base64 后存入

## 原则
1. 自动升级资产必须可直接解压出目标可执行文件，不能是安装器。
2. 自动升级比较继续使用语义化版本 tag，例如 `v0.1.0`。
3. UI 展示版本时间使用 `ReleaseLabel`，不和 `Version` 混用。
4. macOS universal updater 资产需要和 `UniversalArch=universal` 对齐。
5. macOS release workflow 必须先把源码构建出来的 universal sidecar 回填进 `.app`，再 notarize `.app`，然后从已 stapled 的 `.app` 生成 DMG，最后再 notarize DMG。
6. 已签名 macOS `.app` 在当前框架下只支持“检查更新 + 跳转 release 页面”，不支持 bundle 内 `ApplyUpdate`。

## 建议发布步骤
1. 确认工作区只包含本次准备发布的变更。
2. 运行前端类型检查、Go 测试、文档校验。
3. 从 fork 源码构建 sidecar，并确认 macOS 场景下 `build/bin/cli-proxy-api` 为 universal binary。
4. 合并到干净提交后创建 tag，例如：`v0.1.3`。
5. 推送 tag 触发 GitHub Actions release workflow。
6. 在生成的 release 页面检查：
   - 安装包资产存在
   - updater 资产存在
   - `checksums.txt` 包含全部资产
   - macOS DMG 已经 stapled，`xcrun stapler validate` 通过
7. 使用非 dev 构建验证：
   - `CheckUpdate` 能发现新版本
   - macOS: 设置页能打开对应 release 页面，下载安装后进入新版本
