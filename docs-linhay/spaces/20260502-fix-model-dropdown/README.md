# 修复模型下拉框未显示模型列表

## 背景

管理页面 `http://127.0.0.1:8317/management.html#/system` 能正常获取并显示模型列表（8 个 codex 静态模型），但 GetTokens 应用中两处模型选择位置无法展示对应列表。

## 根因分析

**问题 1：StatusPanels.tsx 下拉框空白**
- `StatusFeature.tsx` 调用 `ListRelaySupportedModels()` 构建 `resolvedRelayModels`
- Go 侧 `listRelaySupportedModels` 只从以下来源聚合：
  1. OpenAI Compatible Providers（配置的 models 字段 + 远程拉取）
  2. Codex API Keys（keys 配置的 models 字段，当前均为 `null` 或 `[]`）
  3. 本地 codex models cache（`~/.codex/models_cache.json`）
- **缺失来源**：sidecar 的 `/v0/management/model-definitions/codex` 静态模型定义（含 8 个已知模型）

**问题 2：ApiKeyDetailModal.tsx 无模型下拉框**
- `ApiKeyDetailModal:input:361` 仅为纯文本输入框（`<input>`）
- 父组件 `AccountsFeature` 未获取模型列表，也未传递给 Modal

## 验收标准

- [ ] `StatusApplyLocalSection` 的模型选择下拉框展示 ≥1 个模型
- [ ] `ApiKeyDetailModal` 的验证模型输入旁有下拉按钮，点击后展示模型列表
- [ ] 两处下拉框都展示来自 sidecar 的静态模型名称（gpt-5.2、gpt-5.4-mini 等）
- [ ] 同一模型族按模型版本从大到小展示，例如 `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.3-codex`、`gpt-5.2`
- [ ] 现有测试通过，不引入 regression

## 实现进度

### Go 后端 ✅
- [x] 添加 `fetchSidecarStaticModelDefinitions()` 方法，调用 sidecar `/v0/management/model-definitions/codex`
- [x] 添加 `parseSidecarModelDefinitions()` 函数，解析 JSON 响应
- [x] 更新 `ListRelaySupportedModels()` 调用 sidecar API
- [x] 更新 `listRelaySupportedModels()` 合并 sidecar 模型（用户配置优先）
- [x] 添加测试覆盖 JSON 解析、合并逻辑、优先级顺序
- [x] 所有 Go 测试通过

### 前端 — 帐户模态框 (当前调试中 🔧)
- [x] 在 `AccountsFeature.tsx` 导入 `ListRelaySupportedModels`
- [x] 添加 `relayModelNames` 状态，useEffect 调用 ListRelaySupportedModels()
- [x] 修复 useEffect 中的条件逻辑（确保总是赋值 relayModelNames）
- [x] 将 `modelNames={relayModelNames}` 传给 `ApiKeyDetailModal`
- [x] review 修复：relay model catalog 不再只在 `ready` 初次切换时拉取；现在会在 OpenAI-compatible provider catalog 变化、打开 API key 详情时重新拉取，避免新增/编辑 provider 后快照长期陈旧。

### 前端 — 帐户模态框 UI
- [x] 添加 `modelNames` prop 到 `ApiKeyDetailModal` props 接口
- [x] 添加下拉菜单状态和 ref（`isModelMenuOpen`、`modelMenuRef`）
- [x] 实现模型菜单浏览/过滤分离：点击下拉按钮或输入框获焦时展示完整 catalog，只有用户实际输入查询时才过滤。
- [x] 实现 useEffect 处理菜单外点击关闭
- [x] 将纯文本 input 改造为下拉选择框
  - [x] 显示向下箭头按钮（当有模型时）
  - [x] 输入框变更和获焦时打开菜单
  - [x] 下拉菜单展示过滤后的模型，可点击选中
- [x] TypeScript 编译通过

### 前端 — StatusPanels（依赖 Go 修复）
- 现有代码已支持下拉，一旦 Go 后端返回模型列表，自动显示

## 关键数据点

- **Sidecar 模型端点**：GET `/v0/management/model-definitions/codex` (已验证，返回 8 个模型)
- **管理 key**：`gettokens-local-management-key` (已硬编码在 sidecar_client.go)
- **测试状态**：parseSidecarModelDefinitions() 单元测试通过；完整集成流程待验证
- **前端状态**：所有 TS 类型检查通过

## 下一步调试

1. **验证数据流**：可能需要在运行时检查：
   - AccountsFeature useEffect 是否成功调用 ListRelaySupportedModels()
   - result.models 是否包含正确数据
   - relayModelNames 是否被正确设置

2. **可能的堵点**：
   - sidecar 连接/请求失败导致 sidecarModels = nil
   - 所有来源（providers、codexKeys、sidecarModels、localCodexModels）均为空
   - 前端 useEffect 的依赖数组或条件逻辑问题

## 相关文件

- `internal/wailsapp/relay_model_catalog.go` — 后端模型聚合逻辑
- `internal/wailsapp/relay_model_catalog_test.go` — 后端测试
- `frontend/src/features/status/components/StatusPanels.tsx` — StatusApplyLocalSection 下拉框
- `frontend/src/features/accounts/components/ApiKeyDetailModal.tsx` — 验证模型输入
- `frontend/src/features/accounts/AccountsFeature.tsx` — ApiKeyDetailModal 父组件

## Review 修复记录（2026-05-02）

- 修复 API key 详情弹窗模型下拉：预填默认模型或历史验证模型时，点击下拉按钮展示完整 relay model catalog，不再只展示当前模型。
- 修复 relay model catalog 刷新：`AccountsFeature` 在 provider catalog 签名变化和打开 API key 详情时重新调用 `ListRelaySupportedModels()`，降低初次瞬时失败或后续 provider 编辑导致的陈旧快照风险。
- 修复 rotation priority 拖拽取消：`RotationPriorityItem` 补回 `onDragEnd`，并确保 drop 到自身时也清空 `draggedAccountID`。
- 新增 `apiKeyModelCatalog.test.mjs` 覆盖完整 catalog 浏览、输入过滤、provider model 变化签名。
- 验证：`npm run test:unit` 190 项通过；`npm run typecheck` 通过；`go test ./...` 通过；`npm run build` 已完成产物输出但 Vite 进程未自然退出，已手动清理卡住的 build 进程。

## 排序修复记录（2026-05-02）

- 规则：模型列表按“模型族字母序 + 同族版本从大到小”排序；同版本下标准版排在 `mini` / `lite` / `nano` 等小型号前。
- 示例顺序：`gpt-5.5` → `gpt-5.4` → `gpt-5.4-mini` → `gpt-5.3-codex` → `gpt-5.2` → `gpt-4.1`。
- 后端：`ListRelaySupportedModels` 聚合结果使用同一排序规则，保证 Status 页和账号详情入口一致。
- 前端：`ApiKeyDetailModal` 下拉菜单兜底排序，即使传入顺序不稳定也按同一规则展示。
- 验证：新增后端排序测试和前端下拉排序测试；`go test ./...`、`npm run test:unit -- src/features/accounts/tests/apiKeyModelCatalog.test.mjs`、`npm run typecheck` 通过。
