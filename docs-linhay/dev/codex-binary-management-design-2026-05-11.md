# Codex 二进制源管理技术方案

关联 space：`docs-linhay/spaces/20260511-codex-binary-management/README.md`

## 业务定义

Codex 二进制源管理是独立业务，只回答四个问题：

1. 当前 GetTokens 托管的 `codex` 二进制来自哪里。
2. 本机已安装哪些 Codex 二进制版本。
3. 远端有哪些可安装版本。
4. 用户如何安全安装、更新、切换和诊断。

它不负责账号池、local apply、用量统计、会话管理，也不作为这些模块的运行时依赖。

## 数据目录

按 GetTokens profile 隔离：

```text
~/.config/gettokens/codex/
├── manifest.json
├── bin/
│   └── codex -> ../versions/<version-id>/codex
├── current -> versions/<version-id>/
├── versions/
│   └── <version-id>/
│       ├── codex
│       └── metadata.json
├── downloads/
│   ├── <task-id>.tmp
│   └── tasks.json
└── cache/
    ├── releases.json
    └── release-notes/
        └── <source-id>/<tag>.json
```

dev profile 使用：

```text
~/.config/gettokens-dev/codex/
```

目录职责：

- `manifest.json`：业务唯一状态文件。
- `versions/`：已安装版本，不直接暴露给用户编辑。
- `bin/codex`：GetTokens 托管 shim，切换 active 时只更新这个链接。
- `current`：便于人工排查当前版本目录。
- `downloads/`：下载临时文件与任务快照，任务完成或取消后清理临时文件。
- `cache/releases.json`：远端 release 索引缓存，网络失败时用于展示版本列表。
- `cache/release-notes/`：单个版本的变更说明缓存，避免每次展开 cell 都重新请求。

## Manifest Schema

首期 schema 版本为 `1`：

```json
{
  "schemaVersion": 1,
  "selectedVersionId": "0.118.0-a1b2c3d4",
  "includePrerelease": false,
  "sources": [
    {
      "id": "openai-codex-github",
      "type": "githubRelease",
      "name": "OpenAI Codex GitHub Releases",
      "enabled": true,
      "repo": "openai/codex",
      "tagPrefix": "rust-v"
    }
  ],
  "versions": [
    {
      "id": "0.118.0-a1b2c3d4",
      "displayName": "Codex 0.118.0",
      "detectedVersion": "0.118.0",
      "binaryRelativePath": "versions/0.118.0-a1b2c3d4/codex",
      "sha256": "a1b2c3d4...",
      "sourceId": "openai-codex-github",
      "sourceType": "download",
      "sourceURL": "https://github.com/openai/codex/releases/download/rust-v0.118.0/...",
      "installedAt": "2026-05-11T00:00:00Z",
      "lastActivatedAt": "2026-05-11T00:00:00Z",
      "notes": ""
    }
  ],
  "lastRemoteCheck": {
    "checkedAt": "2026-05-11T00:00:00Z",
    "sourceId": "openai-codex-github",
    "status": "success",
    "version": "0.118.0",
    "tag": "rust-v0.118.0",
    "assetURL": "https://github.com/openai/codex/releases/download/rust-v0.118.0/...",
    "htmlURL": "https://github.com/openai/codex/releases/tag/rust-v0.118.0",
    "publishedAt": "2026-05-10T00:00:00Z",
    "error": ""
  }
}
```

兼容规则：

- 未找到 `manifest.json` 时返回默认空 manifest，不自动创建版本。
- 未知字段首期不要求写回保留，但不能导致读取失败。
- `selectedVersionId` 指向缺失版本时，doctor 标记为 `broken_selection`，list 不自动修复。
- `versions[].binaryRelativePath` 必须限制在 `versions/` 内，防止 manifest 被手改后指向任意路径。

## Source 模型

首期只实现两类来源：

1. `githubRelease`
   - 默认源：`openai/codex`
   - tag 前缀：`rust-v`
   - asset 过滤：按当前平台和架构匹配 macOS arm64 / amd64 包。
   - prerelease：默认隐藏，可通过 `includePrerelease` 打开。

2. `localImport`
   - 用户选择本地 `codex` 可执行文件。
   - 复制到 GetTokens 管理目录。
   - 通过 sha256 去重。

后续可扩展但首期不实现：

- 自定义 GitHub repo。
- 固定下载 URL。
- 企业内网镜像源。
- 多平台 Windows/Linux 安装。

首期已确认：

- 远端源固定为 `openai/codex` GitHub Releases。
- release tag 固定使用 `rust-v` 前缀。
- 平台只支持当前 GetTokens macOS 桌面环境，覆盖 arm64 / amd64 asset 匹配。
- 自定义源、镜像源和 Windows/Linux 支持全部后置。

## 版本 ID

格式：

```text
<detected-version>-<sha256-prefix>
```

示例：

```text
0.118.0-a1b2c3d4
```

规则：

- `detected-version` 来自执行 `codex --version` 后解析出的语义版本。
- 无法检测版本时使用 `unknown`，但仍允许导入；UI 应标记为“版本未知”。
- `sha256-prefix` 默认取前 8 位，若冲突则延长到 12 位。
- 同 sha256 视为同一二进制，不新增版本。

## 领域数据模型

首期模型只围绕“版本列表 cell 可直接下载、激活、回退、看变更记录”设计，不引入全局任务中心。

### Release Catalog

`cache/releases.json` 保存远端版本索引：

```json
{
  "schemaVersion": 1,
  "sourceId": "openai-codex-github",
  "repo": "openai/codex",
  "fetchedAt": "2026-05-11T00:00:00Z",
  "expiresAt": "2026-05-11T00:15:00Z",
  "etag": "\"abc123\"",
  "source": "network",
  "items": [
    {
      "version": "0.120.0",
      "tag": "rust-v0.120.0",
      "title": "rust-v0.120.0",
      "htmlURL": "https://github.com/openai/codex/releases/tag/rust-v0.120.0",
      "publishedAt": "2026-05-10T00:00:00Z",
      "isPrerelease": false,
      "asset": {
        "name": "codex-aarch64-apple-darwin.tar.gz",
        "downloadURL": "https://github.com/openai/codex/releases/download/rust-v0.120.0/...",
        "size": 12345678,
        "contentType": "application/gzip"
      },
      "bodyCacheKey": "openai-codex-github/rust-v0.120.0"
    }
  ]
}
```

规则：

- 版本排序使用语义版本，`rust-v0.120.0` 归一为 `0.120.0`。
- draft 永不展示；prerelease 默认隐藏。
- 缓存 TTL 首期建议 15 分钟；用户点“检查更新”强制 revalidate，可带 `ETag`。
- 网络失败时返回缓存并标记 `source = cache`，cell 上显示“使用缓存”而不是阻断本地激活。

### Version Notes

版本说明来自 GitHub release body，不写入 manifest 主体，按 tag 独立缓存：

```json
{
  "schemaVersion": 1,
  "sourceId": "openai-codex-github",
  "tag": "rust-v0.120.0",
  "version": "0.120.0",
  "title": "rust-v0.120.0",
  "htmlURL": "https://github.com/openai/codex/releases/tag/rust-v0.120.0",
  "publishedAt": "2026-05-10T00:00:00Z",
  "fetchedAt": "2026-05-11T00:00:00Z",
  "bodyMarkdown": "## What's Changed\n...",
  "bodyPlainText": "What's Changed ...",
  "truncated": false
}
```

展示规则：

- 版本 cell 默认只展示 1 行摘要：版本号、发布时间、安装状态、下载状态。
- 用户展开 cell 时加载 `bodyMarkdown`；没有网络但有缓存时展示缓存。
- Markdown 渲染只允许标题、段落、列表、链接、代码和引用；禁止 HTML 原样注入。
- `bodyMarkdown` 为空时展示“这个版本没有提供变更说明”，不把空态变成错误。
- 本地导入版本没有 release tag 时展示来源、导入时间、sha256 和 `codex --version` 结果。

### Download Task

下载是行内动作，但后端需要任务模型承载进度和取消：

```json
{
  "id": "dl_20260511_001",
  "sourceId": "openai-codex-github",
  "tag": "rust-v0.120.0",
  "version": "0.120.0",
  "assetName": "codex-aarch64-apple-darwin.tar.gz",
  "downloadURL": "https://github.com/openai/codex/releases/download/rust-v0.120.0/...",
  "status": "downloading",
  "phase": "download",
  "bytesTotal": 12345678,
  "bytesDone": 4567890,
  "startedAt": "2026-05-11T00:00:00Z",
  "updatedAt": "2026-05-11T00:00:08Z",
  "installAfterDownload": true,
  "activateAfterInstall": true,
  "errorCode": "",
  "errorMessage": ""
}
```

状态机：

```text
queued
  -> resolving_asset
  -> downloading
  -> verifying
  -> extracting
  -> importing
  -> activating
  -> completed

queued/downloading/verifying/extracting/importing
  -> canceling -> canceled

任意非 completed 状态
  -> failed
```

关键规则：

- 同一 `sourceId + tag` 同时只允许一个下载任务；重复点击返回现有 task。
- `tasks.json` 只保存未完成任务和最近失败任务摘要，避免成为长期历史库。
- 任务进度以内存为主，写盘节流到 500ms 或阶段变化，App 重启后可识别未完成任务并标记为 `interrupted`。
- 取消只保证停止网络下载和删除 `.tmp`；如果已经进入 `importing/activating`，取消请求返回“正在完成安装”，不强杀文件替换。
- `completed` 后立即刷新 snapshot，cell 的按钮从“取消下载”变成“激活”或“已启用”。

### Installed Metadata

每个 `versions/<version-id>/metadata.json` 保存安装来源快照：

```json
{
  "schemaVersion": 1,
  "id": "0.120.0-a1b2c3d4",
  "detectedVersion": "0.120.0",
  "sha256": "a1b2c3d4...",
  "sourceId": "openai-codex-github",
  "sourceType": "download",
  "sourceURL": "https://github.com/openai/codex/releases/download/rust-v0.120.0/...",
  "releaseTag": "rust-v0.120.0",
  "releaseHTMLURL": "https://github.com/openai/codex/releases/tag/rust-v0.120.0",
  "installedAt": "2026-05-11T00:00:00Z",
  "binaryRelativePath": "versions/0.120.0-a1b2c3d4/codex"
}
```

`manifest.json` 保留选中版本和版本清单，`metadata.json` 承担可追溯来源；两者不一致时以 manifest 为列表入口，doctor 标记 metadata 异常。

## 核心操作

### List

读取 manifest，返回 selected version id、已安装版本列表、active shim 状态、manifest 是否存在。不访问网络，不执行下载。

### Available

读取源并查询远端 release：

- 成功：更新 `cache/releases.json` 和 `lastRemoteCheck`。
- 失败且有缓存：返回缓存，并标记 `source = cache`。
- 失败且无缓存：返回错误态，不影响本地版本列表。

数据流程：

1. 前端进入页面时先调用 `GetCodexBinarySnapshot`，只读本地 manifest、release cache 和任务快照。
2. 用户点击“检查更新”时调用 `RefreshCodexBinaryAvailable(force=true)`。
3. 后端通过 release client 拉取 GitHub releases，按 `tagPrefix`、draft、prerelease、平台架构和 asset 名称过滤。
4. 后端归一为 `CodexBinaryRemoteVersionView`，与已安装版本按 `releaseTag`、`detectedVersion`、`sha256` 做合并。
5. 前端只渲染一个版本列表：同一个版本若已安装且远端也存在，合并成一个 cell，不分“已安装/可下载”两个表。

### Version Notes

版本说明单独按需加载：

1. cell 展开时调用 `GetCodexBinaryVersionNotes(sourceID, tag)`。
2. 后端优先读 `cache/release-notes/<source-id>/<tag>.json`；未命中或过期时访问 GitHub release detail。
3. 成功后写入缓存并返回 markdown、plain text 摘要、来源链接和缓存状态。
4. 网络失败但有缓存时返回缓存；网络失败且无缓存时 cell 内展示“暂时无法加载变更说明”。
5. 已安装版本如果 `metadata.json` 中有 `releaseTag`，展开时仍按远端 release notes 加载；本地导入版本只展示本地元数据。

### Import Local

流程：

1. 校验文件存在。
2. 校验是普通文件且可执行；不可执行时尝试 chmod `0755`。
3. 计算 sha256。
4. 执行 `codex --version`，解析版本。
5. 生成 version id。
6. 复制到 `versions/<id>/codex.tmp`。
7. chmod `0755`。
8. rename 为 `versions/<id>/codex`。
9. 写入 manifest。

失败处理：

- 任何失败不修改 `selectedVersionId`。
- 已复制的临时文件清理。
- 同 sha256 已存在时直接返回已有版本。

### Install Remote

流程：

1. 根据 source + version/tag 找到远端 release asset。
2. 创建或复用 `Download Task`，返回 task id 给前端。
3. 下载到 `downloads/<task-id>.tmp`，按 `Content-Length` 或 asset size 更新进度。
4. 下载完成后计算 sha256；若上游提供 checksum asset，首期可记录但不强依赖，后续再强校验。
5. 若是 `.tar.gz` / `.tgz`，解包到临时目录并查找 `codex` 或 `codex-*`。
6. 复用 Import Local 的导入流程，写入 `metadata.json` 的 release tag 与 source url。
7. 若 `activateAfterInstall = true`，执行 Activate。
8. 标记任务完成并刷新 snapshot。

失败处理：

- 下载失败不改 manifest。
- 解包失败不改 manifest。
- 导入成功但 Activate 失败时保留已安装版本，但不改变 active。
- 取消下载会删除 `.tmp` 并把 task 标记为 `canceled`。
- App 重启发现 `.tmp` 存在但没有活跃任务时，清理临时文件并把旧 task 标记为 `interrupted`。

### Cell Actions

列表 cell 是首期唯一操作入口，按钮与后端数据流如下：

| cell 状态 | 主按钮 | 次按钮 | 后端调用 | 成功后 |
| --- | --- | --- | --- | --- |
| 远端可下载，未安装 | 下载并激活 | 仅下载 | `StartCodexBinaryDownload` | cell 进入下载进度 |
| 下载中 | 取消下载 | - | `CancelCodexBinaryDownload` | cell 回到可下载或取消态 |
| 已下载，未启用 | 激活 | 定位文件 | `UseCodexBinary` / `RevealCodexBinary` | selected 切换到该版本 |
| 当前启用 | 已启用 | 定位文件 | `RevealCodexBinary` | 不改变 active |
| 旧版已安装 | 激活回退 | 定位文件 | `UseCodexBinary` | selected 切换到旧版 |
| 下载/解包失败 | 重试下载 | 查看错误 | `StartCodexBinaryDownload` | 复用 tag 创建新 task |

互斥规则：

- 首期 UI 只允许一个活跃下载任务，降低取消、进度和磁盘竞争复杂度；后端仍按 `sourceId + tag` 去重复用任务。
- 激活时禁用所有版本的激活按钮，下载按钮可继续保留；如果实现上共享 manifest 写锁，激活期间也可短暂禁用下载完成后的导入阶段。
- 当前 active 版本不能删除，删除能力后置。

### Activate Data Flow

激活和回退是同一条数据流：

1. 前端传入 `versionID` 和 `expectedCurrentVersionID`。
2. 后端在 manifest 写锁内重新读取当前 selected，若与 expected 不一致，返回 `codex_binary_state_conflict`，前端刷新 snapshot。
3. 校验目标版本目录、metadata、binary 可执行。
4. 原子替换 `bin/codex` 与 `current`。
5. 写入 manifest 的 `selectedVersionId` 与目标版本 `lastActivatedAt`。
6. 返回新的 snapshot，前端只以返回值更新列表，不在本地乐观猜测 active。

### Activate

流程：

1. 校验 version id 存在。
2. 校验目标二进制存在且可执行。
3. 创建新 symlink 临时文件：
   - `bin/codex.next -> ../versions/<id>/codex`
   - `current.next -> versions/<id>`
4. 原子替换 `bin/codex` 和 `current`。
5. 更新 `selectedVersionId`、`lastActivatedAt`。

失败处理：

- 目标缺失或不可执行时直接失败。
- 替换 symlink 失败时尽量保留原 active。
- manifest 写入失败时 doctor 应能从 symlink 反查 active，提示状态不一致。

### Doctor

返回诊断项：

- manifest 是否存在。
- selected version 是否存在。
- selected binary 是否存在。
- `bin/codex` 是否存在。
- `bin/codex` 是否指向 selected version。
- `current` 是否指向 selected version。
- `PATH` 中是否存在 GetTokens shim 目录。
- 系统 `codex` 是否存在，以及版本。
- 最近远端检查状态。
- 可恢复建议。

doctor 只读，不自动修复。

## Wails API

首期方法：

```go
GetCodexBinarySnapshot() (*CodexBinarySnapshot, error)
RefreshCodexBinaryAvailable() (*CodexBinaryAvailableResponse, error)
GetCodexBinaryVersionNotes(input CodexBinaryVersionNotesInput) (*CodexBinaryVersionNotesView, error)
ImportCodexBinary(input ImportCodexBinaryInput) (*CodexBinaryInstallResult, error)
StartCodexBinaryDownload(input StartCodexBinaryDownloadInput) (*CodexBinaryDownloadTaskView, error)
CancelCodexBinaryDownload(input CancelCodexBinaryDownloadInput) (*CodexBinaryDownloadTaskView, error)
UseCodexBinary(input UseCodexBinaryInput) (*CodexBinaryUseResult, error)
RevealCodexBinary(input RevealCodexBinaryInput) error
GetCodexBinaryDoctor() (*CodexBinaryDoctor, error)
```

推荐合并 `list/current` 为 `GetCodexBinarySnapshot`，减少前端多次调用和状态竞争。
下载进度建议通过 Wails event 推送 `codexBinaryDownloadUpdated`；前端也可以在窗口重新聚焦或 event 丢失时调用 snapshot 对齐。

关键 DTO：

```go
type CodexBinarySnapshot struct {
    ManifestPath      string                   `json:"manifestPath"`
    ManagedBinPath    string                   `json:"managedBinPath"`
    SelectedVersionID string                   `json:"selectedVersionID,omitempty"`
    CurrentVersion    *CodexBinaryVersionView  `json:"currentVersion,omitempty"`
    Versions          []CodexBinaryVersionView `json:"versions"`
    RemoteVersions    []CodexBinaryRemoteVersionView `json:"remoteVersions"`
    VersionRows       []CodexBinaryVersionRowView `json:"versionRows"`
    DownloadTasks     []CodexBinaryDownloadTaskView `json:"downloadTasks"`
    Sources           []CodexBinarySourceView  `json:"sources"`
    Doctor            CodexBinaryDoctorSummary `json:"doctor"`
}

type CodexBinaryVersionView struct {
    ID              string `json:"id"`
    DisplayName     string `json:"displayName"`
    DetectedVersion string `json:"detectedVersion"`
    ReleaseTag      string `json:"releaseTag,omitempty"`
    SourceID        string `json:"sourceID"`
    SourceType      string `json:"sourceType"`
    SourceURL       string `json:"sourceURL,omitempty"`
    InstalledAt     string `json:"installedAt"`
    LastActivatedAt string `json:"lastActivatedAt,omitempty"`
    IsSelected      bool   `json:"isSelected"`
    ExistsOnDisk    bool   `json:"existsOnDisk"`
}

type CodexBinaryRemoteVersionView struct {
    SourceID     string `json:"sourceID"`
    Version      string `json:"version"`
    Tag          string `json:"tag"`
    Title        string `json:"title"`
    DownloadURL  string `json:"downloadURL"`
    HTMLURL      string `json:"htmlURL,omitempty"`
    AssetName    string `json:"assetName,omitempty"`
    AssetSize    int64  `json:"assetSize,omitempty"`
    PublishedAt  string `json:"publishedAt,omitempty"`
    IsPrerelease bool   `json:"isPrerelease"`
    IsInstalled  bool   `json:"isInstalled"`
}

type CodexBinaryVersionRowView struct {
    RowID            string `json:"rowID"`
    Version          string `json:"version"`
    Tag              string `json:"tag,omitempty"`
    SourceID         string `json:"sourceID"`
    InstalledVersionID string `json:"installedVersionID,omitempty"`
    IsInstalled      bool   `json:"isInstalled"`
    IsSelected       bool   `json:"isSelected"`
    IsRollback       bool   `json:"isRollback"`
    HasRemote        bool   `json:"hasRemote"`
    PublishedAt      string `json:"publishedAt,omitempty"`
    InstalledAt      string `json:"installedAt,omitempty"`
    NotesState       string `json:"notesState"` // none | cached | remote | unavailable
    Task             *CodexBinaryDownloadTaskView `json:"task,omitempty"`
    PrimaryAction    string `json:"primaryAction"` // download_activate | download | activate | rollback | none
    SecondaryAction  string `json:"secondaryAction,omitempty"` // cancel | reveal | retry
}

type CodexBinaryDownloadTaskView struct {
    ID                   string `json:"id"`
    SourceID             string `json:"sourceID"`
    Tag                  string `json:"tag"`
    Version              string `json:"version"`
    Status               string `json:"status"` // queued | resolving_asset | downloading | verifying | extracting | importing | activating | completed | canceling | canceled | interrupted | failed
    Phase                string `json:"phase"`
    BytesDone            int64  `json:"bytesDone"`
    BytesTotal           int64  `json:"bytesTotal"`
    InstallAfterDownload bool   `json:"installAfterDownload"`
    ActivateAfterInstall bool   `json:"activateAfterInstall"`
    ErrorCode            string `json:"errorCode,omitempty"`
    ErrorMessage         string `json:"errorMessage,omitempty"`
    UpdatedAt            string `json:"updatedAt"`
}

type CodexBinaryVersionNotesView struct {
    SourceID      string `json:"sourceID"`
    Tag           string `json:"tag"`
    Version       string `json:"version"`
    Title         string `json:"title"`
    HTMLURL       string `json:"htmlURL,omitempty"`
    PublishedAt   string `json:"publishedAt,omitempty"`
    BodyMarkdown  string `json:"bodyMarkdown"`
    BodyPlainText string `json:"bodyPlainText,omitempty"`
    Source        string `json:"source"` // remote | cache | local
    Truncated     bool   `json:"truncated"`
}
```

错误码建议：

- `codex_binary_manifest_invalid`
- `codex_binary_not_found`
- `codex_binary_not_executable`
- `codex_binary_version_missing`
- `codex_binary_download_failed`
- `codex_binary_extract_failed`
- `codex_binary_release_not_found`
- `codex_binary_activate_failed`
- `codex_binary_download_canceled`
- `codex_binary_download_interrupted`
- `codex_binary_state_conflict`
- `codex_binary_notes_unavailable`

## 前端信息架构

独立 Codex Binary 页面或工作区内独立 tab，但首期只保留一个主列表：

```text
Codex Binary
├── 顶部摘要
│   ├── 当前启用版本
│   ├── GetTokens shim 路径
│   ├── 最近检查时间 / 缓存状态
│   └── 检查更新
└── 版本列表
    └── Version Cell
        ├── 版本号 / tag / 发布时间
        ├── 安装状态 / 启用状态 / 下载进度
        ├── 行内操作：下载、取消、激活、激活回退、定位文件
        └── 展开区：变更记录或本地导入信息
```

首期按钮只允许出现在顶部或 cell 内：

- 顶部：检查更新。
- 未安装 cell：仅下载、下载并激活。
- 下载中 cell：取消下载。
- 已安装未启用 cell：激活、定位文件。
- 当前启用 cell：定位文件、已启用禁用态。
- 旧版已安装 cell：激活回退、定位文件。
- 失败 cell：重试下载、查看错误。

首期不做：

- 独立 Sources 面板。
- 独立 Doctor 面板。
- Remove active version。
- 自动写 shell profile。
- 自动替换系统 `codex`。
- 全局下载任务中心。
- 版本回滚确认弹窗以外的复杂运维控件。

## UI 状态

必须覆盖：

- `empty`：没有托管版本。
- `managed-active`：已有 active 托管版本。
- `managed-broken`：manifest 有 selected，但文件或 symlink 缺失。
- `system-only`：系统 PATH 有 `codex`，但 GetTokens 未托管。
- `offline-cache`：远端查询失败，展示缓存。
- `notes-loading`：版本说明加载中。
- `notes-cache`：版本说明来自缓存。
- `notes-unavailable`：版本说明暂不可用。
- `installing`：下载/解包/导入中。
- `download-canceling`：取消下载中。
- `download-canceled`：下载已取消，可重新下载。
- `activating`：切换 active 中。
- `failed`：操作失败，可重试。

## 依赖库建议

以下为首期确认方案。

Go 侧：

- 直接依赖 `github.com/google/go-github/v30`：GitHub releases API，当前已在 `go.mod` 间接存在，二进制管理实现时应提升为直接依赖。
- 直接依赖 `github.com/hashicorp/go-retryablehttp`：release 拉取和下载重试，当前已间接存在；只用于网络层，不把重试逻辑散落到业务代码。
- 继续使用 `github.com/Masterminds/semver/v3`：版本归一、排序、判断更新/回退。
- 可继续使用标准库 `archive/tar`、`compress/gzip`：处理 `.tar.gz` / `.tgz`，首期不引入大型 archive 框架。
- 使用标准库 `crypto/sha256`：下载后和导入后计算 sha256。
- 使用标准库 `os/exec`：只执行受控的 `<candidate> --version`，带 timeout，不继承敏感环境。
- 使用标准库 `context`：下载取消和 Wails 请求生命周期控制。

前端侧：

- 新增 `react-markdown` + `rehype-sanitize`：渲染 release notes，并限制可用标签。
- 后端仍返回 `bodyPlainText` 作为无障碍摘要、搜索摘要和降级展示字段。

暂不建议：

- 不引入通用包管理器、安装器或多源插件框架。
- 不引入大型下载管理库；首期下载进度、取消、断点续传先用标准库实现，断点续传后置。
- 不为了渲染 release notes 使用 `dangerouslySetInnerHTML`。

## 测试策略

Go 单元测试优先，不依赖真实网络和用户 home：

- 使用临时目录作为 profile root。
- 使用 fake release loader 返回 GitHub JSON。
- 使用 fake `codex` shell 脚本模拟 `--version`。
- 校验 symlink 目标，不执行真实 Codex。
- release catalog 测试覆盖 ETag、TTL、prerelease 过滤、asset 匹配和网络失败回退缓存。
- download task 测试覆盖重复点击复用任务、取消清理 `.tmp`、失败不改 active、重启后 interrupted 标记。
- version notes 测试覆盖 release body 缓存、空 body、网络失败有缓存、网络失败无缓存。

前端单测：

- snapshot 转单列表 `VersionRow`。
- doctor severity 聚合。
- installed/available 去重。
- loading 状态下按钮禁用。
- cell 行内按钮按状态切换：下载、取消、激活、激活回退、重试。
- release notes 展开态、缓存态、不可用态。
- binary 状态变化不影响账号池、local apply、用量、会话入口状态。

桌面验收：

- Wails 方法能在真实窗口调用。
- 导入本地 fake codex 后 UI 显示 active。
- 切换版本后 doctor 变绿。
- 失败状态有明确错误提示。

## 实施切分

P0：本地版本管理

- manifest。
- local import。
- activate。
- doctor。
- snapshot API。

P1：远端源

- GitHub release 查询。
- release cache。
- 下载、解包、安装。
- include prerelease。

P2：前端独立入口

- 页面骨架。
- 已安装版本表。
- 可用版本表。
- doctor 区域。
- 操作按钮和错误态。

P3：维护能力

- 删除非 active 版本。
- reveal in Finder。
- 手动修复 symlink。
- 自定义源设计。
