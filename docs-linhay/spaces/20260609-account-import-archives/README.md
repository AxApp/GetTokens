# 20260609-account-import-archives

## 背景

- 用户在账号导入界面反馈：文件选择区需要支持拖入压缩包，并扫描压缩包内部 JSON 文件。
- 用户进一步说明“不止是 zip”，要求查看并添加高星解压缩库，避免手写 ZIP/deflate 解析。
- 当前代码事实位置：
  - `frontend/src/features/accounts/model/accountTransfer.ts` 负责导入文件读取与 payload 展开。
  - `frontend/src/features/accounts/components/AccountImportModal.tsx` 与 `frontend/src/pages/AccountImportPage.tsx` 负责导入文件选择区。
  - `frontend/src/features/accounts/tests/accountTransfer.test.mjs` 与 `accountCardInteractions.test.mjs` 覆盖导入模型和源码结构守护。

## 目标

- 账号导入文件区支持拖拽压缩包。
- 读取压缩包内部 JSON 文件并作为独立导入候选展示，不把非 JSON 条目加入队列。
- 使用成熟解压缩库处理压缩层，避免维护手写 ZIP/deflate 解析。
- 常见归档格式至少覆盖 `.zip`、`.tar`、`.tar.gz`、`.tgz`、`.json.gz` / `.gzip`。

## 范围

- 前端导入模型的压缩包展开逻辑。
- 账号导入 modal 与独立导入页的文件 accept、拖拽事件和提示文案。
- 前端单元/源码守护测试。

## 非目标

- 不改后端账号导入规范化路径；最终账号识别仍走既有 JSON 解析和提交逻辑。
- 不处理加密压缩包、损坏压缩包或超大压缩包的流式进度 UI。
- 不修改正式版 `/Applications/GetTokens.app`。

## 验收标准

1. Given 用户选择或拖入 `.zip`，When 压缩包内包含多个文件，Then 只把 `.json` 条目展开为导入候选，并保留 `archive.zip:path/file.json` 名称。
2. Given 用户选择或拖入 `.tar` / `.tar.gz` / `.tgz`，When 归档内包含 JSON 和非 JSON，Then 只扫描 JSON 条目。
3. Given 用户选择 `.json.gz`，When 解压后内容是 JSON，Then 生成一个以压缩包限定名标识的导入候选。
4. Given 用户拖拽文件到导入文件区，When 松开鼠标，Then 复用现有 `readUploadFiles` 流程追加导入队列。
5. Given 提交前验证，When 运行 focused 前端测试、typecheck 和 build，Then 均通过。

## 证据门禁

- 问题来源：用户浏览器评论指出“支持拖入 压缩包，扫码内部 json 文件”，随后要求“不止是 zip，看看添加高星解压缩库”。
- 当前现象：导入模型原先只处理普通文件；前一轮临时实现只覆盖 ZIP，且不应继续维护手写 ZIP/deflate 解析。
- 预期验收方式：模型测试构造 zip/tar/tgz/json.gz 输入；源码测试确认 modal/page 都有 drop handler、dropzone 标记和扩展 accept；前端 typecheck/build 通过。
- 反证条件：若 `.tar.gz` / `.tgz` 不能展开 JSON，或导入队列仍把非 JSON 压缩包条目加入候选，则视为未完成。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`（未新建，当天小修直接在当前工作区完成）`
- worktree：`（未新建）`

## 相关链接

- 账号规模优化前置 space：`docs-linhay/spaces/20260608-account-pool-scale-optimization/README.md`

## 当前状态

- 状态：done
- 最近更新：2026-06-09

## 2026-06-09 实现记录

- 前端新增依赖 `fflate@^0.8.3`，用于 ZIP/GZIP 解压。
- `accountTransfer.ts` 新增统一 `readArchiveJSONFiles`：
  - `.zip` 通过 `unzipSync` 扫描内部 `.json`。
  - `.gz` / `.gzip` 通过 `gunzipSync` 解压，支持单个 JSON 文件。
  - `.tar.gz` / `.tgz` 先 gunzip，再用轻量 TAR header 枚举 `.json` 条目。
  - `.tar` 只做归档目录枚举，不维护自定义压缩算法。
  - 单个压缩包最多展开 `1000` 个 JSON 候选。
- 导入 modal 与独立导入页都支持拖拽文件，dropzone 增加 `data-account-import-dropzone`，文件选择 accept 扩展到 `.zip/.tar/.tar.gz/.tgz/.gz/.gzip`。
- 中英文导入提示从 ZIP 特例改为通用“压缩包 / archives”。

### 已验证

- `node --test frontend/src/features/accounts/tests/accountTransfer.test.mjs frontend/src/features/accounts/tests/accountCardInteractions.test.mjs`
- `npm --prefix frontend run test:unit`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- Browser DOM 验收：`http://localhost:5173/#frame=account-import` 渲染 `data-account-import-dropzone`；文件 accept 为 `.json,.zip,.tar,.tar.gz,.tgz,.gz,.gzip,application/json,application/zip,application/gzip,application/x-tar`；提示文案包含“压缩包内 JSON 会自动扫描”。
