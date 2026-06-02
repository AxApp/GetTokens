# Session Management

## 背景

会话管理页用于在桌面工作台中按项目查看 Codex / Claude 会话，支持搜索、项目切换、状态过滤、刷新和详情查看。

## 本轮目标

2026-06-02 使用 Open Design 对 `http://127.0.0.1:34115/#frame=claude&workspace=session-management` 做视觉评价，并基于评价落地小步视觉修正。

## 调整范围

- 强化页头标题尺度，保持 industrial / brutalist 工作台风格。
- 将搜索区改为更安静的 utility rail，避免与主容器粗边框抢层级。
- 降低项目列表与会话列表之间的分隔强度。
- 将会话摘要限制为适合扫读的一行宽度。
- 将 provider、消息数、文件和更新时间收敛到虚线 footer rail。

## 验收标准

- 会话页在桌面视口下仍保持左导航、项目列表、会话列表的三栏关系。
- 搜索框、过滤按钮、刷新按钮不再压过会话内容层级。
- 会话行标题、摘要、元信息分别形成清晰的三段阅读节奏。
- 相关源码级视觉回归测试通过。

## 证据

- 修改前截图：`screenshots/20260602/open-design/20260602-open-design-session-before-v01.png`
- 修改后截图：`screenshots/20260602/open-design/20260602-open-design-session-after-v01.png`
