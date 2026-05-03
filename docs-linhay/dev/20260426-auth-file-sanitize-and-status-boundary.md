# 2026-04-26 Auth File Sanitize And Status Boundary

## 背景

本轮会话围绕账号池又收敛出两条容易反复丢失的边界：

1. legacy `codex` auth file 在导入时到底应该保留多少字段
2. 账号失败原因应该显示在哪一层，而不是只躺在 sidecar 原始返回里

如果这两条边界不固定下来，后续继续做账号池组件化或 sidecar/Wails 拆分时，很容易出现下面两类回归：

1. 导入链路重新变回“保留原始 payload 再补字段”
2. 失败态原因在 DTO 映射中被丢掉，卡片又只能显示红点，没有诊断信息

## 结论

### 1. codex auth file 只保留最小可用字段

对于 legacy `codex` auth payload，导入/上传前应统一清洗成 sidecar 实际可消费的最小结构，而不是保留原始 JSON。

当前最小字段集合：

1. `type`
2. `access_token`
3. `id_token`
4. `refresh_token`
5. `account_id`
6. `email`
7. `plan_type`

像下面这些内容都不应该继续落盘：

1. `nolon`
2. 嵌套 `tokens`
3. 其他仅用于来源系统描述的元数据

原因：

1. sidecar 真正消费的是扁平化后的顶层 token 字段
2. 保留原始冗余字段会让“实际运行所需字段”和“来源系统元数据”混在一起
3. 后续排障时用户会误以为这些字段仍被 sidecar 使用

### 2. 前端清洗预览必须复用后端同一入口

账号详情页里的“清洗字段”按钮不能在前端另写一套 normalize 规则。

当前规则：

1. 导入链路使用后端统一 normalize 入口
2. 详情页清洗预览也调用同一个 Wails bridge
3. 用户看到的“清洗结果”必须和实际落盘结果一致

这样做的目的，是避免出现“详情页看起来能用，但真实导入后不是这份结果”的双轨逻辑。

### 3. statusMessage 必须作为一等状态字段保留

auth file 的失败原因事实源来自 sidecar `statusMessage`。

这条字段必须沿着下面这条链保留：

1. sidecar auth file item
2. Wails `AuthFileItem`
3. 统一 `AccountRecord`
4. 前端账号卡片 failed-state 展示

不能只在详情接口里保留，而在列表态模型里丢掉。

### 4. 失败原因优先显示在账号卡片

当账号已经进入失败态时，用户第一跳最需要的是“为什么失败”，而不是“失败了但需要再点进详情页看”。

当前规则：

1. `ACTIVE / CONFIGURED / DISABLED / LOCAL` 不显示失败原因
2. 其他异常状态若存在 `statusMessage`，则在账号卡片标题下直接展示
3. 详情页继续保留完整原始内容和清洗结果，作为第二跳诊断面板

## 实现落点

1. 最小清洗：`internal/accounts/auth_file_normalize.go`
2. 前端清洗预览 bridge：`internal/wailsapp/auth_file_normalize.go`
3. 账号统一映射：`internal/accounts/account_records.go`
4. 前端账户映射与失败原因解析：`frontend/src/features/accounts/accountPresentation.ts`
5. 账号卡片失败原因展示：`frontend/src/features/accounts/AccountCard.tsx`

## 回归清单

后续如果继续拆 `accounts` 域或调整 sidecar/Wails DTO，至少回归下面几项：

1. 粘贴导入 legacy codex auth file 后，落盘内容是否仍是最小字段集合
2. 详情页“清洗字段”结果是否与导入落盘结果一致
3. failed auth file 的 `statusMessage` 是否还能进入 `AccountRecord`
4. 失败态账号卡片是否仍会直接显示原因
