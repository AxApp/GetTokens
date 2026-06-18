# 20260617 Round 19 Local Enable State Mutation

日期：2026-06-17

## 1. 目标

把 Round 18 的 enable-state core tracer 接到 GetTokens extension registry 工作台：

1. Wails/root 暴露 `SetGetTokensExtensionEnabled`。
2. Snapshot 默认读取 GetTokens app-local state file。
3. 前端 registry view 提供 enable/disable action model 与 handler。
4. UI 明确 local-only，不写 Codex config，不执行 capability，不接 marketplace。

## 2. 证据门禁

- 问题来源：Round 18 已证明 core state file 可读写和 merge，但 README 仍记录“真正的 enable/disable mutation 待后续切片”。
- 代码事实位置：
  - core：`internal/gettokensextensions/state.go`
  - Wails：`internal/wailsapp/gettokens_extensions.go`
  - root binding：`app.go`、`app_types.go`、`app_mappers.go`
  - frontend：`frontend/src/features/gettokens-extension-registry/`
- 当前现象：前端只展示 action availability，不存在 enable/disable handler；Wails snapshot 未默认带 state path；root binding 没有 mutation 方法。
- 预期验收：disable/enable 只写本地 `extension-enable-state.json`，随后 snapshot 能显示 `disabled` / `enabled`；不读取或写入 `~/.codex/config.toml`，不运行 capability，不出现 marketplace 入口。

## 3. 实现摘要

### 3.1 Core

新增 `SetExtensionEnabled(path, extensionID, enabled, now)`：

- 校验 extension id。
- 读取本地 state file，不存在则按空 state 初始化。
- 插入或更新单个 extension 条目。
- 写入 `updatedAt` 与 `reason = local-state-mutation`。
- 复用现有 normalize / atomic temp rename 保存逻辑。

### 3.2 Wails / Root

新增输入 DTO：

- `SetGetTokensExtensionEnabledInput`
  - `extensionID`
  - `enabled`
  - 可选 `statePath`

默认 state path：

- prod：`~/.config/gettokens/extension-enable-state.json`
- dev：`~/.config/gettokens-dev/extension-enable-state.json`

测试可通过 `statePath` 注入临时目录。Snapshot input 也支持 `statePath`，用于同一测试链路内证明 mutation 后 merge 生效。

### 3.3 Frontend

`deriveGetTokensExtensionRegistryView` 将可操作状态映射为：

- `enabled` -> `actionAvailability.action = disable`
- `disabled` -> `actionAvailability.action = enable`
- blocked / pending / unsupported -> disabled action

页面新增 `data-gettokens-extension-enable-action` 按钮。点击后调用 `SetGetTokensExtensionEnabled`，成功后刷新 snapshot。按钮文案和 notice 明确：

- 只写 GetTokens dev/app-local enable-state file。
- 不写 Codex config。
- 不执行 capability。

## 4. 验证命令

```bash
go test ./internal/gettokensextensions ./internal/wailsapp -run 'Extension|GetTokensExtension'
go test . -run 'GetTokensExtension'
cd frontend && npm run test:unit -- src/features/gettokens-extension-registry/model.test.mjs src/features/gettokens-extension-registry/featureSource.test.mjs ../frontend/wailsjs/gettokensExtensionRegistryBinding.test.mjs
cd frontend && npm run typecheck
```

结果：以上命令均已通过。

## 5. 边界与剩余项

本轮仍不做：

1. 不执行 extension capability。
2. 不读取或写入 `~/.codex/config.toml`。
3. 不接 marketplace 或远程安装。
4. 不实现 capability runner。
5. 不把 enable-state 写入 Codex Skills/MCP 配置。

后续若接入 runner，需要重新定义 enabled 与实际 capability active 的执行边界，并补审计、权限和失败隔离。
