# 本机 macOS 正式环境安装包脚本

## 背景

需要在本机先安装验证接近正式环境的 GetTokens 包，同时把手工打包步骤沉淀成可重复执行脚本。

## 脚本入口

```bash
scripts/build-local-macos-package.sh
```

默认行为：

1. 读取 `frontend/package.json` 的版本号并转换为 `vX.Y.Z`。
2. 使用当前机器架构构建 macOS 包，Apple Silicon 输出 `GetTokens_local_macOS_AppleSilicon.dmg`。
3. 运行 `go test ./...`、`npm --prefix frontend run typecheck` 和 `docs-linhay/scripts/check-docs.sh`。
4. 通过 `scripts/ensure-sidecar.sh` 从 GetTokens 维护 fork 构建当前架构 sidecar。
5. 以 production Wails build 构建 `GetTokens.app`，注入 `main.Version` 与 `main.ReleaseLabel`。
6. 同步 `CFBundleShortVersionString` / `CFBundleVersion`。
7. 将 freshly built `cli-proxy-api` 和 metadata 回灌到 app bundle。
8. 默认使用 ad-hoc codesign，生成本机可安装测试 DMG 并做挂载校验。
9. 输出 DMG 与 `.sha256`。

## 常用命令

```bash
# 默认当前架构，跑完整预检
scripts/build-local-macos-package.sh

# 已单独跑过预检时，只重新产包
scripts/build-local-macos-package.sh --skip-tests

# 指定版本或输出目录
scripts/build-local-macos-package.sh --version v1.0.33 --output-dir dist/local-release

# 只打印解析后的计划，不执行构建
LOCAL_MACOS_PACKAGE_PRINT_PLAN=1 scripts/build-local-macos-package.sh --skip-tests
```

## 公证边界

默认产物用于本机正式 profile 验证，不等同于对外可分发 Release 资产。默认 DMG 没有 Developer ID notarization；若需要走签名公证链，必须显式传入：

```bash
scripts/build-local-macos-package.sh --notarize
```

并提供 `scripts/sign-notarize-macos-release.sh` 所需的 `MACOS_SIGNING_IDENTITY`、`MACOS_NOTARY_KEY_ID`、`MACOS_NOTARY_ISSUER_ID`、`MACOS_NOTARY_KEY_PATH`。

## 本次验收

2026-05-29 已在 Apple Silicon 本机跑通：

1. `go test ./...` 通过。
2. `npm --prefix frontend run typecheck` 通过。
3. `docs-linhay/scripts/check-docs.sh` 通过。
4. `scripts/build-local-macos-package.sh --skip-tests` 产出并挂载校验通过：
   - `dist/local-release/GetTokens_local_macOS_AppleSilicon.dmg`
   - `dist/local-release/GetTokens_local_macOS_AppleSilicon.dmg.sha256`
5. DMG 内主程序为 `Mach-O 64-bit executable arm64`。
6. `CFBundleShortVersionString` 为 `1.0.33`。
7. `GetTokens.app` 和内置 `cli-proxy-api` 通过 `codesign --verify --deep --strict`。
