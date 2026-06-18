# 20260617 Round 18 Enable State Core Registry Tracer

日期：2026-06-17

## 1. 目标

在 `internal/gettokensextensions` core registry 中证明 extension enable/disable state 可以通过本地文件持久化，并能与 manifest registry view 合并。

本轮只做 tracer：

1. 读取本地 enable-state JSON 文件。
2. 写入 `enabled` / `disabled` 状态后可重新读取。
3. `LoadRegistrySnapshot` 在显式传入 state path 时，把 manifest snapshot 与 enable-state 合并。
4. 拒绝非法 extension id 与未知 state，并对大小写/空白做规范化。

## 2. 边界

明确不做：

1. 不执行 extension capability。
2. 不读取或写入用户 `~/.codex/config.toml`。
3. 不接 marketplace、runner 或远程安装。
4. 不修改前端。
5. 不改 Protocol / Route / Doctor / Quota。

## 3. 已证明链路

### 3.1 缺省读取

`LoadExtensionEnableState(path)` 在 state 文件不存在时返回空 `extensions` 列表，并保留 `contractVersion = 0.1.0`。

### 3.2 持久化写入与重读

`SaveExtensionEnableState(path, state)` 写入稳定 JSON：

- 顶层 `contractVersion`
- 可选 `updatedAt`
- `extensions[]`
  - `id`
  - `state`
  - 可选 `updatedAt`
  - 可选 `reason`

保存前会校验并规范化条目，输出按 `id` 排序，便于 diff 和后续扩展。

### 3.3 Registry view merge

`LoadOptions.StatePath` 是显式注入入口。只有调用方传入本地 state path 时，`LoadRegistrySnapshot` 才读取 enable-state 文件并合并到有效 manifest snapshot。

合并规则：

1. manifest 仍负责 id、capability、permission、compatibility 与 schema gate。
2. 无 state 条目的 extension 保留既有 `readonly-compatible` / `readonly-incompatible` / `invalid` 状态。
3. 有 state 条目的有效 extension 覆盖为 `enabled` 或 `disabled`。
4. capability view state 跟随 extension view state；已 invalid 的 capability 不被覆盖。
5. invalid manifest 不被 enable-state 覆盖，避免用 state 文件掩盖契约错误。

### 3.4 输入拒绝与规范化

持久化 state 只接受：

- `enabled`
- `disabled`

状态字符串读取时会做 trim + lowercase 规范化。非法 extension id、未知状态、未知 contract version 会返回错误。

## 4. 验证命令

```bash
go test ./internal/gettokensextensions
```

已覆盖用例：

1. state 文件不存在返回空/默认。
2. 写入 enable/disable 后可重新读取。
3. registry view merge manifest + state 后体现 enabled/disabled。
4. 非法 extension id 被拒绝。
5. 未知 state 被拒绝，大小写/空白形式可规范化。

## 5. 剩余风险

1. 当前 state file path 只在 core API 中注入，尚未接 Wails、前端或 dev app。
2. 没有实现 enable/disable mutation 的产品流程、审计 UI 或用户确认。
3. 没有处理并发写入锁；本轮只证明本地单进程 tracer 链路。
4. 没有迁移或读取任何 Codex Skills/MCP 配置；后续若接 Codex config 必须继续遵守局部 patch 与 `bearer_token_env_var` 边界。
5. 没有 capability runner，因此 enabled 只表示 registry view 中的启用状态，不代表热路径执行。
