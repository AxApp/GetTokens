# 账号卡右上角操作菜单

## 背景
账号池卡片底部操作区当前包含删除按钮，常用操作和危险操作混在一起。用户要求将删除移到右上角垂直三点菜单，并在菜单中加入复制能力。

## 目标
- 在 `AccountCard` 右上角展示垂直三点菜单。
- 菜单支持：
  - `复制`：复制账号主标识。
  - `复制内容`：复制可粘贴导入的账号卡 JSON。
  - `删除`：进入现有二次确认删除流程。
- 移除卡片底部常驻删除按钮。
- 粘贴导入支持从账号卡复制出的内容，能重新创建对应账号卡。

## 范围
- `frontend/src/features/accounts/components/AccountCard.tsx`
- 账号卡复制内容相关纯函数与测试。
- 中英文文案。

## 非目标
- 不改变删除确认流程和后端删除逻辑。
- 不改变账号详情弹窗能力。
- 不调整 OpenAI-compatible 独立工作区卡片。

## 验收标准
1. Given 账号卡正常展示，When 用户点击右上角垂直三点按钮，Then 展示 `复制 / 复制内容 / 删除` 菜单。
2. Given 用户点击 `复制`，Then 剪贴板写入账号主标识。
3. Given 用户点击 `复制内容`，Then 剪贴板写入 `gettokens.account-card.v1` JSON，包含账号摘要和可导入凭据字段。
4. Given 用户点击菜单中的 `删除`，Then 复用现有 `pendingDeleteID` 二次确认区域。
5. Given 账号卡不是删除确认态，Then 底部操作区不再显示删除按钮。
6. Given 用户将 `复制内容` 的 JSON 粘贴到导入弹窗，Then Codex API key 卡通过 `CreateCodexAPIKey` 创建，auth-file 卡通过 `UploadAuthFiles` 创建。
7. 相关前端测试与类型检查通过。

## 复制-粘贴导入修复记录

- `复制内容` 输出 schema 固定为 `gettokens.account-card.v1`。
- Codex API key payload 携带 `label / apiKey / baseUrl / prefix`，粘贴导入时创建新的本地 API key 卡。
- Auth-file payload 在可下载原始文件内容时携带 `authFile.content`，粘贴导入时按原文件内容上传创建账号卡。
- 粘贴导入弹窗文案从 Auth-only 调整为账号内容导入，继续兼容旧的裸 Auth File JSON。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260502-account-card-actions-menu`
- worktree：`../GetTokens-worktrees/20260502-account-card-actions-menu/`

## 相关链接
- `docs-linhay/spaces/account-pool/README.md`

## 当前状态
- 状态：done
- 最近更新：2026-05-02
