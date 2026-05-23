# GetTokens macOS 可分发 DMG 发布手册

本文件是 GetTokens 当前 macOS Release 的主发布手册。发布目标不是“GitHub Release 页面存在”，而是两份可分发 DMG 均已通过 checksum、Gatekeeper、公证票据、签名链、架构和版本信息验收。

## 适用范围

当前正式发布范围只覆盖 macOS：

1. Apple Silicon 安装包：`GetTokens_macOS_AppleSilicon.dmg`
2. Apple Silicon updater asset：`GetTokens_macOS_AppleSilicon.tar.gz`
3. Intel 安装包：`GetTokens_macOS_Intel.dmg`
4. Intel updater asset：`GetTokens_macOS_Intel.tar.gz`
5. 校验文件：`checksums.txt`

`tar.gz` 资产用于更新检测和 Sparkle 实验链路；用户可分发安装物以 DMG 为准。

## 发布前边界

1. 不复用已失败、已创建或已被 CI 消费过的 tag；失败后直接 bump 到下一个 patch tag。
2. `frontend/package.json`、`frontend/package-lock.json`、`frontend/package.json.md5` 必须与目标版本同步。
3. 发布 tag 是 release workflow 的唯一触发源，格式为 `vX.Y.Z`。
4. 本轮发布相关变更必须已提交；工作区内无关脏文件不得被误 stage。
5. macOS 可分发验收必须覆盖 DMG 本身，不只验收 GitHub Release asset 是否存在。

## 标准发布流程

### 1. 本地预检

```bash
git status --short --branch
go test ./...
npm --prefix frontend run typecheck
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
```

若某项无法运行，必须在发布记录中写明原因、影响范围和剩余风险。

### 2. 版本同步

同步以下文件中的版本号：

1. `frontend/package.json`
2. `frontend/package-lock.json`
3. `frontend/package.json.md5`

`package.json.md5` 需要在 `package.json` 改完后重新计算，不能手写猜测。

### 3. 提交、打 tag、推送

```bash
git add frontend/package.json frontend/package-lock.json frontend/package.json.md5
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin <branch>
git push origin vX.Y.Z
```

tag 推送后 GitHub Actions 会触发 release workflow。不要在同一个失败 tag 上反复删 tag 重跑；这会让发布记录、资产和缓存状态变得不可追踪。

### 4. 监控 CI

```bash
gh run list --workflow Release --limit 5
gh run view <run-id> --json status,conclusion,url
gh run watch <run-id>
```

CI 失败时先看失败 job 的日志，再改脚本或版本策略：

```bash
gh run view <run-id> --log-failed
```

## Release workflow 契约

`.github/workflows/release.yml` 当前承担以下职责：

1. 只响应 `v*` tag。
2. 使用 Node 24 构建前端，避免 GitHub Actions Node 20 deprecation。
3. `arm64` 与 `amd64` 分开在 macOS runner 构建，不再合并为 universal DMG。
4. 通过 `scripts/build-sidecar.sh` 从维护中的 `CLIProxyAPI` fork 源码构建 sidecar，不下载上游 release 二进制。
5. `wails build` 后显式把新构建的 `cli-proxy-api` 覆盖进 `GetTokens.app/Contents/MacOS/cli-proxy-api`。
6. 在签名前同步 bundle 版本，保证 `CFBundleShortVersionString` 和 `CFBundleVersion` 与 tag 一致。
7. 先签名、公证、staple `.app`，再生成、签名、公证、staple `.dmg`。
8. 从已签名且 stapled 的 `.app` 生成 updater `tar.gz`。
9. 生成 `checksums.txt` 并发布五类 release assets。
10. 若启用 Sparkle，则按架构生成并发布 `appcast-arm64.xml` 和 `appcast-amd64.xml`。

## 发布状态口径

发布状态分两层记录，不能混用：

1. `CI 发布完成`：目标 tag 触发的 release workflow 已成功结束，GitHub Release 已创建，五类资产已挂载。此时可以说“版本已发布到 GitHub Release”。
2. `可分发 DMG 验收完成`：从 GitHub Release 下载正式资产后，完成 checksum、Gatekeeper、stapler、app 签名、架构、bundle 版本和 Sparkle feed 校验。此时才可以说“可分发 DMG 已验收完成”。

如果 CI 已绿但本地正式资产下载慢、下载方式异常或 post-release 验收未完成，状态应写为“已发布，分发验收待完成/被阻塞”，不要回退成“未发布”或误以为需要手工重新发版。

## sidecar 构建边界

发布前必须从仓库维护的 fork 源码构建 sidecar：

```bash
./scripts/build-sidecar.sh darwin arm64 build/bin
./scripts/build-sidecar.sh darwin amd64 build/bin
```

约束：

1. 本地优先使用 `docs-linhay/references/CLIProxyAPI`。
2. CI 中该目录不存在时，脚本会 clone `https://github.com/AxApp/CLIProxyAPI.git`。
3. 默认构建分支为 `gettokens/sidecar`，必要时通过 `CLI_PROXY_SOURCE_REF` 覆盖。旧分支名 `gettokens/wham-token-fix` 已从 active fork 删除，不再作为新流程入口。
4. app bundle 内 sidecar 必须与当前构建目标架构一致。
5. 这里的 `AxApp/CLIProxyAPI` 是 GetTokens 维护 fork，只用于承载本项目补丁和 release 构建；canonical upstream 仍是 `router-for-me/CLIProxyAPI`。需要同步上游时从 `upstream=router-for-me/CLIProxyAPI` 合并，再推回维护 fork。

## 签名与公证配置

CI release workflow 需要以下 secrets / variables：

1. `MACOS_SIGNING_IDENTITY`
2. `MACOS_DEVELOPER_ID_P12_BASE64`
3. `MACOS_DEVELOPER_ID_P12_PASSWORD`
4. `MACOS_NOTARY_KEY_ID`
5. `MACOS_NOTARY_ISSUER_ID`
6. `MACOS_NOTARY_API_KEY_BASE64`
7. `SPARKLE_PUBLIC_ED_KEY`，可选
8. `SPARKLE_PRIVATE_ED_KEY`，可选
9. `SPARKLE_ENABLE`，GitHub Actions variable，可选
10. `SPARKLE_APPCAST_BRANCH`，GitHub Actions variable，默认 `sparkle-appcast`

常见误区：

1. 本地 keychain 里有 Developer ID 证书，不代表本地 `notarytool` 鉴权可用。
2. `notarytool` 返回 401 通常是 key id、issuer id、`.p8` 或 profile 配置不匹配；不要把它误判为签名证书问题。
3. 本地缺少 `supacode-notary` 不阻塞 CI 发布；CI secrets 配齐时以 GitHub workflow 为准。
4. `xcrun notarytool history` 使用 API key 时必须同时提供 key id、issuer id 和 `.p8`，不能只拿本地证书推断。

## 发布后验收

发布后必须下载 GitHub Release 上的正式资产做验收，不使用本地 build 目录替代。

### 1. 确认 release 与资产

```bash
gh release view vX.Y.Z --json url,assets,publishedAt
```

必须看到五类资产均存在：

1. `GetTokens_macOS_AppleSilicon.dmg`
2. `GetTokens_macOS_AppleSilicon.tar.gz`
3. `GetTokens_macOS_Intel.dmg`
4. `GetTokens_macOS_Intel.tar.gz`
5. `checksums.txt`

### 2. 下载并校验 checksum

```bash
mkdir -p /tmp/gettokens-vX.Y.Z-verify
gh release download vX.Y.Z --dir /tmp/gettokens-vX.Y.Z-verify
cd /tmp/gettokens-vX.Y.Z-verify
shasum -a 256 -c checksums.txt
```

checksum 只证明上传后的字节完整性，不证明 DMG 可被 Gatekeeper 接受。

### 3. 验收 DMG 公证状态

分别对 Apple Silicon 和 Intel DMG 执行：

```bash
spctl -a -t open --context context:primary-signature -v GetTokens_macOS_AppleSilicon.dmg
xcrun stapler validate GetTokens_macOS_AppleSilicon.dmg

spctl -a -t open --context context:primary-signature -v GetTokens_macOS_Intel.dmg
xcrun stapler validate GetTokens_macOS_Intel.dmg
```

验收标准：

1. `spctl` 显示 `accepted`
2. `spctl` 来源包含 `Notarized Developer ID`
3. `stapler validate` 成功

### 4. 挂载 DMG 验收 app bundle

```bash
mkdir -p /tmp/gettokens-arm64 /tmp/gettokens-amd64
hdiutil attach -nobrowse -readonly -mountpoint /tmp/gettokens-arm64 GetTokens_macOS_AppleSilicon.dmg
hdiutil attach -nobrowse -readonly -mountpoint /tmp/gettokens-amd64 GetTokens_macOS_Intel.dmg

codesign -dv --verbose=4 /tmp/gettokens-arm64/GetTokens.app
codesign -dv --verbose=4 /tmp/gettokens-amd64/GetTokens.app

file /tmp/gettokens-arm64/GetTokens.app/Contents/MacOS/GetTokens
file /tmp/gettokens-amd64/GetTokens.app/Contents/MacOS/GetTokens

plutil -p /tmp/gettokens-arm64/GetTokens.app/Contents/Info.plist
plutil -p /tmp/gettokens-amd64/GetTokens.app/Contents/Info.plist

hdiutil detach /tmp/gettokens-arm64
hdiutil detach /tmp/gettokens-amd64
```

验收标准：

1. `codesign` 显示 `Developer ID Application: HAN LIN (3L8RM3MDLS)`。
2. `codesign` 显示 `Timestamp`。
3. `codesign` 显示 `Notarization Ticket=stapled`。
4. Apple Silicon 主可执行文件为 `arm64`。
5. Intel 主可执行文件为 `x86_64`。
6. `CFBundleShortVersionString` 与 `CFBundleVersion` 等于目标版本。
7. `SUFeedURL` 指向匹配架构的 appcast：
   - arm64: `appcast-arm64.xml`
   - amd64: `appcast-amd64.xml`

## Sparkle 约束

1. `SPARKLE_ENABLE=1` 时才启用 Sparkle metadata、framework 嵌入和 appcast 发布。
2. appcast 必须按架构拆分，不能在相同 bundle version 下合并成一个 feed。
3. `SUFeedURL` 必须与当前构建架构匹配。
4. `generate_appcast` 在 CI 中必须写入显式 staged 输出路径，不能假设它会覆盖 seed file。

## 可分发完成定义

只有同时满足以下条件，才能对外宣称“已发布可分发 DMG”：

1. Release workflow 成功。
2. GitHub Release 资产齐全。
3. `checksums.txt` 校验通过。
4. 两个 DMG 的 `spctl` 均 accepted。
5. 两个 DMG 的 `stapler validate` 均通过。
6. 两个 DMG 内的 `.app` 签名链、timestamp、公证票据均正确。
7. 两个 `.app` 的架构、版本号和 `SUFeedURL` 均正确。
8. 发布结论已写入 `docs-linhay/memory/YYYY-MM-DD.md` 并执行 `qmd update && qmd embed`。

## 已验证参考版本

`v1.0.9` 是当前已跑通的可分发 DMG 发布样例：

1. GitHub Actions run：`26009770548`
2. Release：`https://github.com/AxApp/GetTokens/releases/tag/v1.0.9`
3. Apple Silicon DMG sha256：`d93fc49b054661b2f7a8e57f7f91a9f1e37b2c3f08fbea2800fe8817f588fa30`
4. Intel DMG sha256：`454b9b3c95cdd2d3e99c9f678743a76a36209971be3a23e5a649d781de83491f`
5. 验收结论：checksum、`spctl`、`stapler validate`、`codesign`、架构、bundle version、`SUFeedURL` 均通过。

## 失败处理原则

1. release run 失败后先看失败 job 日志，不凭猜测改脚本。
2. tag 已被消费或 release 已创建后，不复用同一个 tag，直接 bump patch。
3. 只看到 `checksums.txt` 通过不能代表可分发，必须继续做 Gatekeeper 与 stapler 验收。
4. 只看到 `.app` 已公证不能代表 DMG 可分发，DMG 本身也必须签名、公证和 staple。
5. 工作区存在无关脏文件时，只 stage 本轮发布相关文件；不要用 `git add -A` 混入临时文件。
