# Auth File Metadata Cache

## 背景

当前账号页和用量归因都会触发 auth-file 读取。对于桌面客户端，这类本地文件访问本身不重，但如果每次刷新都重复读原文、重复推断元数据，就会放大 IO、CPU、日志和敏感内容暴露面。

## 目标

1. 把 auth-file 读取拆成“强一致刷新”和“缓存优先返回”两条路径。
2. 降低账号列表、详情、归因 join 等普通展示场景的重复下载频率。
3. 保留需要实时读取原文的场景能力，不牺牲用户可见的一致性。

## 范围

1. auth-file 元数据缓存与失效策略。
2. 账号列表 / 归因 / OAuth 回填等调用链的重复读取收敛。
3. 对应测试与文档写回。

## 非目标

1. 不把 auth-file 存储从文件迁移到数据库。
2. 不改变现有 auth-file 作为事实源的边界。
3. 不在本期引入跨进程共享缓存。

## 验收标准

1. 普通展示场景优先命中进程缓存，不再对同一批 auth-file 反复下载原文。
2. 文件内容、大小或修改时间变化后，缓存能及时失效并重新读取。
3. 强一致场景仍能强制走 fresh 读取。
4. 相关测试通过，且 README / plan / 后续记忆写回可检索。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260526-auth-file-metadata-cache`
- worktree：`../GetTokens-worktrees/20260526-auth-file-metadata-cache/`

## 相关链接

## 当前状态
- 状态：implemented
- 最近更新：2026-05-27

## 实现记录

### 2026-05-27

- 在 `internal/wailsapp` 增加 auth-file 元数据进程缓存；缓存身份按 canonical `name` 归一，`size + modified` 只作为 freshness fingerprint。
- `ListAuthFiles` 对普通列表场景优先使用缓存；首次 fresh 下载后只缓存展示元数据，不缓存完整 auth 原文。
- 上传、删除、启停状态修改成功后按文件名失效缓存；文件大小或修改时间变化会自然绕过旧缓存。
- 补充 sidecar mock 测试，覆盖重复列表不重复下载、元数据仍不完整也不重复下载、fingerprint 变化后重新下载。
- 补充同名 fingerprint churn 构造测试与 benchmark，确认同一 auth-file 名称不会因 `size/modified` 变化累积多条 cache entry。
