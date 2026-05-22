# Codex 禁用账号仍被路由 — 根因与修复

日期: 2026-05-22

## 问题

用户在 GetTokens 前端禁用了 Codex API key 账号，但 Codex CLI 实际请求仍然会命中这些已禁用的账号。

## 架构背景

```
GetTokens (Go/Wails App)
  → PUT /v0/management/codex-api-key  ← 同步 codex key 配置（含 disabled 字段）
  → Sidecar (CLIProxyAPI)
      → config.yaml 持久化
      → ConfigSynthesizer → synthesizeCodexKeys() → Auth record (Disabled=true)
      → CoreManager.Register/Update
      → applyRouteGuardForAuthUpdate() → MarkManualDisabledAuth()
      → accountRouteGuardPolicy → DenyIDsForCandidates()
      → Routing conductor 过滤 Disabled auth
```

Sidecar 的路由 guard 系统本身支持 `accountRouteGuardPolicy`（`internal/gettokenshooks/route_guard.go`），通过 `MarkManualDisabledAuth` 将禁用的 auth 加入 deny list，在路由时由 `accountRouteGuardPolicy.RewriteCandidates` 拦截。

## 根因

**`SaveConfigPreserveComments` 的 YAML 注释保留合并逻辑丢失了 `disabled` 字段。**

`Sidecar internal/config/config.go` 中的 `SaveConfigPreserveComments`:
1. `yaml.Marshal(cfg)` → 生成含 `disabled: true` 的 YAML
2. `yaml.Unmarshal` → 转回 yaml.Node 树
3. `mergeMappingPreserve(original, generated)` → 保留注释的顺序合并
4. 合并过程中，序列元素（codex-api-key 各项）内的新布尔字段 `disabled: true` 被丢弃
5. 写入磁盘的 YAML 不包含 `disabled: true`

触发链路：
```
PUT /codex-api-key 含 disabled:true
  → h.cfg.CodexKey = filtered (内存正确，Disabled=true)
  → persistLocked → SaveConfigPreserveComments
      → mergeMappingPreserve → disabled 字段被丢弃 ✗
  → 磁盘 YAML 无 disabled:true ✗
  → File Watcher (150ms debounce) 检测变更
  → Config reload → synthesizeCodexKeys → Auth.Disabled=false ✗
  → applyRouteGuardForAuthUpdate → 不会 MarkManualDisabledAuth ✗
  → 路由引擎仍然使用该 key ✗
```

Route guard、ConfigSynthesizer、Conductor 的 disabled 检查逻辑本身都是正确的，问题只在 YAML 持久化这一环。

## 修复方案

在 `SaveConfigPreserveComments` 的合并步骤后，新增 `applyCodexKeyDisabledOverrides` 调用，从 in-memory config 强制写回 `disabled` 字段到 YAML node tree。

```go
// SaveConfigPreserveComments 中:
mergeMappingPreserve(original.Content[0], generated.Content[0])
applyCodexKeyDisabledOverrides(original.Content[0], persistCfg)  // 强制同步 disabled
normalizeCollectionNodeStyles(original.Content[0])
```

新函数遍历 YAML 树中 `codex-api-key` 序列的每个 item，按 `api-key` 匹配 in-memory config：
- `Disabled=true` → 写入或更新 `disabled: true` 节点
- `Disabled=false` → 移除 `disabled` 节点（如果存在）

选择此方案而非修改 `PutCodexKeys` handler 直接调 route guard，是因为 handler 更新后 file watcher reload 会从磁盘重新加载 config（不含 disabled），覆盖 route guard 状态。

## 时效

修复后禁用生效链路（< 1 秒）：
```
UI 禁用 → Go App SET disabled → PUT /codex-api-key (同步)
  → YAML 持久化含 disabled:true ✓
  → File watcher (150ms debounce) → Config reload
  → synthesizeCodexKeys → Auth.Disabled=true
  → applyRouteGuardForAuthUpdate → MarkManualDisabledAuth
  → Route guard deny list 更新，路由立即拦截
```

## 涉及文件

**Sidecar (CLIProxyAPI)**:
- `internal/config/config.go` — 新增 `applyCodexKeyDisabledOverrides` 函数，在 `SaveConfigPreserveComments` 中调用

**Go App (GetTokens)**:
- 无需修改（原 workaround `sidecarCodexAPIKeyInputs` 过滤 disabled key 方案已 revert，因会阻止 sidecar 收到 disabled 通知）

## 验证

```bash
# PUT 禁用 key
curl -X PUT .../v0/management/codex-api-key -d '[{"api-key":"sk-...","disabled":true,...}]'

# GET 确认 disabled 字段存在
curl .../v0/management/codex-api-key  # 返回 "disabled":true

# 磁盘 YAML 确认持久化
grep "disabled: true" config.yaml  # 存在 ✓
```
