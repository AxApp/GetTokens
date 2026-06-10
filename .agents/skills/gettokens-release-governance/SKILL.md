---
name: gettokens-release-governance
description: GetTokens macOS 发版流程：版本同步、提交 tag、Release workflow、Sparkle appcast、官方 DMG 下载验收、memory 写回。
---

# GetTokens Release Governance

当用户要求“提交 / 推送 / 发版 / release / 发布 / 走发版流程”，或需要确认某个 GetTokens macOS 版本是否已经可分发时，使用本 skill。它是 GetTokens 专用发布入口，执行时同时遵守 `check` 的 Ship / Release Follow-through 门禁和 `gettokens-ops-governance` 的文档、memory、AGENTS 边界。

## 1. 发布边界
- 当前正式发布范围是 macOS。
- Release tag 格式为 `vX.Y.Z`，由 GitHub Actions `Release` workflow 触发。
- tag 指向实际发版代码；发布后的文档或 memory 提交可以继续推到 `master`，但不得移动、删除或重建已发布 tag。
- 如果 tag 已被失败 run、GitHub Release 或缓存消费过，不复用该 tag，改发下一个 patch。
- 不触碰 `/Applications/GetTokens.app` 正式版，不 kill 正式版进程，不替换正式版 sidecar 或配置。

## 2. Worktree 预检
先读状态，不要假设干净：

```bash
git status --short --branch -uall
git fetch --tags origin
git tag --sort=-version:refname | head -20
git ls-remote --tags origin "refs/tags/vX.Y.Z"
```

判断并记录：
- 当前分支与 `origin/<branch>` 是否同步。
- 目标 tag 是否已存在。
- 脏文件是否属于本轮发版。无关脏文件只能保留，不要 stage。
- `frontend/wailsjs` 若只有尾随空白漂移，优先运行 `./scripts/normalize-wailsjs.sh` 收口，再重新读 diff。

## 3. 版本同步
只同步 release 版本三件套：

```bash
npm --prefix frontend version X.Y.Z --no-git-tag-version --allow-same-version
md5 -q frontend/package.json
```

必须更新并核对：
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/package.json.md5`

`frontend/package.json.md5` 必须等于 `md5 -q frontend/package.json`，不要手写猜值。

## 4. 本地门禁
标准发布前至少运行：

```bash
go test ./...
npm --prefix frontend run test:unit
npm --prefix frontend run typecheck
npm --prefix frontend run build
docs-linhay/scripts/check-docs.sh
```

说明：
- Vite chunk size warning 是体量提醒，不自动阻塞发布；除非本轮明确要求处理 bundle size。
- 若某项无法运行，必须写明原因、影响范围和剩余风险，不要声称可分发已验收。

## 5. 提交、推送、tag
只 stage 发版相关文件：

```bash
git add frontend/package.json frontend/package-lock.json frontend/package.json.md5
git commit -m "chore: bump version to X.Y.Z"
git push origin <branch>
git tag vX.Y.Z
git push origin vX.Y.Z
```

推 tag 前再次确认：
- `git rev-parse HEAD` 等于 `git rev-parse origin/<branch>`。
- `git ls-remote --tags origin "refs/tags/vX.Y.Z"` 为空。

## 6. CI 发布监控
tag 推送后监控 Release workflow：

```bash
gh run list --workflow Release --limit 5 --json databaseId,headBranch,headSha,status,conclusion,createdAt,url,displayTitle
gh run watch <run-id> --exit-status
```

成功标准：
- `Build H5` 成功。
- `Build macOS arm64` 成功。
- `Build macOS amd64` 成功。
- `Publish Sparkle appcast` 成功。
- `Publish Release` 成功。

失败处理：
- 先看失败 job：`gh run view <run-id> --log-failed`。
- 不凭猜测改脚本，不复用已消费 tag。
- CI annotation 不是自动失败。以 job / run conclusion 为准，但要记录非阻塞提醒。

## 7. GitHub Release 资产
Release workflow 成功后读取官方 Release：

```bash
gh release view vX.Y.Z --json url,assets,publishedAt,tagName
```

必须存在七个资产：
- `GetTokens_macOS_AppleSilicon.dmg`
- `GetTokens_macOS_AppleSilicon.tar.gz`
- `GetTokens_darwin_arm64.tar.gz`
- `GetTokens_macOS_Intel.dmg`
- `GetTokens_macOS_Intel.tar.gz`
- `GetTokens_darwin_amd64.tar.gz`
- `checksums.txt`

其中 `GetTokens_macOS_*` 是用户可读资产名，`GetTokens_darwin_*` 是 `go-selfupdate` 检测兼容资产名。若某个已安装旧版本因本地策略没有进入 Sparkle 原生 UI，它仍会依赖 `go-selfupdate DetectLatest` 判断是否有新版；缺少 `darwin_<arch>` 兼容资产时，旧客户端会把已发布版本误判为“当前已是最新版本”。

注意：Sparkle appcast 默认不是 GitHub Release asset，它发布到 `sparkle-appcast` 分支。

## 8. Sparkle 验收
先从 CI job 确认发布动作：

```bash
gh run view <run-id> --json jobs,status,conclusion,url
git ls-remote origin refs/heads/sparkle-appcast
```

再验证远端 appcast 内容。推荐先 fetch，避免本地 `origin/sparkle-appcast` 缓存陈旧：

```bash
git fetch origin sparkle-appcast
git show origin/sparkle-appcast:appcast-arm64.xml | rg "vX.Y.Z|GetTokens_macOS_AppleSilicon\\.dmg|sparkle:version|shortVersionString"
git show origin/sparkle-appcast:appcast-amd64.xml | rg "vX.Y.Z|GetTokens_macOS_Intel\\.dmg|sparkle:version|shortVersionString"
```

可用网络直读补充验证：

```bash
curl --max-time 15 -fsSL https://raw.githubusercontent.com/AxApp/GetTokens/sparkle-appcast/appcast-arm64.xml
curl --max-time 15 -fsSL https://raw.githubusercontent.com/AxApp/GetTokens/sparkle-appcast/appcast-amd64.xml
```

判断口径：
- `Publish Sparkle appcast` job 成功，并且 `sparkle-appcast` 分支两个 XML 顶部包含目标版本和对应 DMG URL，即为 Sparkle 已发布。
- 如果 GitHub Release 页面没有 `appcast-*.xml`，这是当前流程的正常状态，不代表 Sparkle 没发。
- 如果 `raw.githubusercontent.com` 超时，改用 `git fetch` + `git show origin/sparkle-appcast:<file>` 作为权威确认。

### 8.1 Sparkle 运行时回归止血
如果线上已经出现“Sparkle 在线更新后 app 签名、公证静态校验都通过，但 GUI 启动被 AppleSystemPolicy / provenance runtime policy 拦截”的真实用户故障，必须额外执行一轮 server-side 止血判断：

1. 不要把“新版本代码里禁用了原生更新入口”直接当作线上已修复。
2. 先判断现网用户从旧版本升级到新版本时，是否仍会经过同一条 Sparkle 安装链路。
3. 若答案是会，则必须先 hold 新版本 appcast 条目，让 `sparkle-appcast` 继续停留在上一安全版本；必要时把新版本视为“仅 GitHub Release 手动安装可用”。
4. 只有在真实端到端 Sparkle 升级回归通过后，才恢复 appcast 推送该版本。

结论口径也要区分：
- `GitHub Release 已发布`：官方 DMG 可手动下载安装。
- `Sparkle rollout 已 hold`：appcast 故意不暴露该版本，避免旧客户端继续触发已知坏更新链路。

如果用户明确要求“检查更新能检测到新版”、或最终交付口径包含“在线更新 / 检查更新可用”，不得静默执行 Sparkle hold。此时必须让远端 appcast 顶部保留目标版本，或在 hold 前先明确说明“检查更新不会看到这个版本”并获得用户确认。

不要因为单次 macOS provenance/runtime policy 故障就在客户端永久禁用 Sparkle。默认策略是：macOS bundle 内 Sparkle 可用时，检查更新走 Sparkle 原生 UI；疑似系统策略拦截按独立故障保留证据、临时 hold appcast 或做端到端升级回归。

## 9. 官方 DMG 分发验收
必须下载 GitHub Release 上的正式资产，不使用本地 `dist/` 替代：

```bash
VERIFY_DIR="$(mktemp -d /tmp/gettokens-vX.Y.Z-verify.XXXXXX)"
EXPECTED_CLI_PROXY_COMMIT="$(git ls-tree HEAD docs-linhay/references/CLIProxyAPI | awk '$2 == "commit" {print $3}')"
test -n "$EXPECTED_CLI_PROXY_COMMIT"
gh release download vX.Y.Z --dir "$VERIFY_DIR"
cd "$VERIFY_DIR"
shasum -a 256 -c checksums.txt
```

DMG 级验收：

```bash
spctl -a -t open --context context:primary-signature -v GetTokens_macOS_AppleSilicon.dmg
xcrun stapler validate GetTokens_macOS_AppleSilicon.dmg
spctl -a -t open --context context:primary-signature -v GetTokens_macOS_Intel.dmg
xcrun stapler validate GetTokens_macOS_Intel.dmg
```

挂载并验包内 app：

```bash
mkdir -p /tmp/gettokens-vX.Y.Z-arm64 /tmp/gettokens-vX.Y.Z-amd64
hdiutil attach -nobrowse -readonly -mountpoint /tmp/gettokens-vX.Y.Z-arm64 GetTokens_macOS_AppleSilicon.dmg
hdiutil attach -nobrowse -readonly -mountpoint /tmp/gettokens-vX.Y.Z-amd64 GetTokens_macOS_Intel.dmg

codesign -dv --verbose=4 /tmp/gettokens-vX.Y.Z-arm64/GetTokens.app 2>&1 | rg "Authority=|Timestamp=|Notarization|TeamIdentifier="
codesign -dv --verbose=4 /tmp/gettokens-vX.Y.Z-amd64/GetTokens.app 2>&1 | rg "Authority=|Timestamp=|Notarization|TeamIdentifier="
file /tmp/gettokens-vX.Y.Z-arm64/GetTokens.app/Contents/MacOS/GetTokens
file /tmp/gettokens-vX.Y.Z-amd64/GetTokens.app/Contents/MacOS/GetTokens
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" -c "Print :CFBundleVersion" -c "Print :SUFeedURL" /tmp/gettokens-vX.Y.Z-arm64/GetTokens.app/Contents/Info.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" -c "Print :CFBundleVersion" -c "Print :SUFeedURL" /tmp/gettokens-vX.Y.Z-amd64/GetTokens.app/Contents/Info.plist
cat /tmp/gettokens-vX.Y.Z-arm64/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json
cat /tmp/gettokens-vX.Y.Z-amd64/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json
EXPECTED_CLI_PROXY_COMMIT="$EXPECTED_CLI_PROXY_COMMIT" \
python3 - <<'PY'
import json
import os
from pathlib import Path

expected = os.environ["EXPECTED_CLI_PROXY_COMMIT"].strip()
for label, meta_path in {
    "arm64": Path("/tmp/gettokens-vX.Y.Z-arm64/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json"),
    "amd64": Path("/tmp/gettokens-vX.Y.Z-amd64/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json"),
}.items():
    meta = json.loads(meta_path.read_text())
    actual = str(meta.get("commit", "")).strip()
    if actual != expected:
        raise SystemExit(f"{label} sidecar metadata mismatch: {actual!r} != {expected!r}")
PY

hdiutil detach /tmp/gettokens-vX.Y.Z-arm64
hdiutil detach /tmp/gettokens-vX.Y.Z-amd64
```

验收标准：
- checksum 全部 OK。
- 两个 DMG 均 `accepted`，来源包含 `Notarized Developer ID`。
- 两个 DMG 的 `stapler validate` 成功。
- `.app` 签名链为 `Developer ID Application: HAN LIN (3L8RM3MDLS)`，有 timestamp 和 `Notarization Ticket=stapled`。
- Apple Silicon 可执行文件为 `arm64`，Intel 可执行文件为 `x86_64`。
- `CFBundleShortVersionString` 与 `CFBundleVersion` 等于目标版本。
- `SUFeedURL` 分别指向 `appcast-arm64.xml` 和 `appcast-amd64.xml`。
- 两个 `.app` 内置 `cli-proxy-api.meta.json` 的 `commit` 必须等于 `docs-linhay/references/CLIProxyAPI` 当前提交；如果 release 修复依赖某个 sidecar 热路径字段、endpoint 或 JSON 字段，还必须用 `strings` 或只读 management API 验证该特征确实存在。只验证主程序版本、签名和 DMG 公证不足以声明 sidecar 修复已进入正式包。

## 10. 文档与 memory
发布结论必须写入 `docs-linhay/memory/YYYY-MM-DD.md`，至少包含：
- 版本同步文件与 md5。
- 本地预检命令和结果。
- commit、tag、workflow run、Release URL。
- 五个 Release assets。
- checksum、Gatekeeper、stapler、codesign、架构、bundle version、bundled sidecar metadata、Sparkle feed 验收结论。
- 最终状态：`CI 发布完成`、`可分发 DMG 验收完成` 或具体阻塞。

写回后运行：

```bash
docs-linhay/scripts/check-docs.sh
qmd update && qmd embed
```

如果只产生 post-release memory/docs 变更，可以在 tag 之后单独提交并推送 `master`，但不要移动 release tag。

## 11. 最终回报口径
区分三种状态：
- `已推 tag，CI 进行中`：还不能说 Release 已发布。
- `CI 发布完成`：workflow 成功，GitHub Release 和七个资产存在。
- `可分发 DMG 验收完成`：官方资产下载后，checksum、DMG Gatekeeper/stapler、app 签名/架构/版本/Sparkle 全部通过。

最终回复应给出：
- release commit 与 tag。
- workflow run URL。
- Release URL。
- Sparkle appcast 分支状态。
- 官方 DMG 验收结果。
- post-release docs/memory commit（如有）。
