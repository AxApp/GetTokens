# 账号详情页 UI 改造

## 背景
`#frame=accounts` 已经有浏览器预览数据，但账号详情弹层仍存在两个问题：

1. API Key 详情的凭据编辑区被压在半宽卡片里，验证区和输入区显得拥挤。
2. 浏览器预览模式缺少部分详情级测试数据，例如 API Key 可选模型、auth-file 原文摘要和模型目录，导致 UI 验收无法覆盖真实详情状态。

## 目标
1. 改造账号详情页 UI，让关键编辑区更像稳定的工作台面板。
2. 在 `http://localhost:5173/#frame=accounts` 浏览器预览下补齐详情测试数据。
3. 保持现有账号详情 hash、保存、验证、限流规则和 quota/billing 业务闭环不变。

## 范围
1. `frontend/src/features/accounts/` 下的账号详情组件、preview data 与 focused tests。
2. 本 space 下的验收截图和文档记录。

## 非目标
1. 不改 sidecar / Wails 账号加载协议。
2. 不合并 OpenAI-compatible、Codex、Claude Code 三类详情 controller。
3. 不重做账号列表卡片视觉。

## 验收标准
1. 打开 `http://localhost:5173/#frame=accounts&detail=codex-api-key%3Astable-001`，API Key 详情展示全宽凭据/验证工作区，模型下拉有浏览器预览数据。
2. 打开 `http://localhost:5173/#frame=accounts&detail=auth-file%3Acodex-pro.json`，auth-file 详情展示预览内容状态和模型目录，不依赖 Wails。
3. 账号详情关闭仍清理 `detail` hash，不出现二次弹回。
4. Quota / Billing 的 curl 编辑弹窗中，默认变量按钮在 textarea 有光标时插入到光标处；无光标时显示复制并复制变量 token。
5. Quota / Billing 的 curl 编辑弹窗支持独立 URL 路由：`script=quota` / `script=billing` 可直接打开对应弹窗，关闭弹窗只回到账户详情页。
6. focused unit tests、`typecheck` 通过；浏览器截图落入本 space。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260529-account-detail-ui`
- worktree：`../GetTokens-worktrees/20260529-account-detail-ui/`

## 相关链接
- `screenshots/20260529/accounts/20260529-accounts-detail-web-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-detail-curl-modal-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-curl-editor-variable-insert-after-v01.png`
- `screenshots/20260529/accounts/20260529-accounts-detail-authfile-after-v01.png`

## 当前状态
- 状态：done
- 最近更新：2026-05-29
