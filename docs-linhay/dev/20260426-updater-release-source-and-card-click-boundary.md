# Updater Release Source 与 Account Card 点击边界

## 背景

本轮会话收敛了两类容易被误判成“前端没反应”或“自动升级坏了”的问题：

1. 自动升级按钮本身可点击，但 `CheckUpdate` 查的是错误仓库，或者目标 release 仓库是 private，导致终端用户看到的结果始终是“没有更新”。
2. 账号卡片视觉上像可点击卡片，但实际上只有底部 `DETAILS` 按钮能打开详情，导致用户点击卡片主体时没有反应。

这两类问题都属于“UI 表面正常，但真实行为边界没收敛”。

## 规则一：Updater Release Source 必须对齐真实发布仓库

`app.go` 中的 `GitHubRepo` 必须和实际发布 release 的仓库 slug 保持一致。

当前稳定边界：

- 正式 release 仓库：`AxApp/GetTokens`
- updater source slug：`AxApp/GetTokens`

禁止情况：

- release 已迁到新仓库，但 `GitHubRepo` 仍指向旧仓库
- 只改 GitHub 远端，不改 app 内 updater source

## 规则二：private GitHub Release 不是终端用户可用的自动升级源

当前接入的 `go-selfupdate` 在终端用户环境下按匿名方式访问 GitHub release。

因此：

- private repo 的 `releases/latest` 对终端用户等价于不可见
- 即使 release 存在，`CheckUpdate` 也可能返回“无可用更新”

结论：

1. 如果希望应用内自动升级对终端用户可用，release 仓库必须是 public
2. 如果仓库必须保持 private，就不能把它当成终端用户的默认 update source

## 规则三：Account Card 应支持整卡进入详情

账号卡片的主体区域应该支持点击进入详情，不应要求用户只能点底部 `DETAILS` 按钮。

当前稳定交互约束：

- 卡片主体点击：打开详情
- `Enter` / `Space`：也应支持打开详情
- 交互子元素点击：只响应子元素自身行为，不触发卡片级详情打开

交互子元素包括但不限于：

- `button`
- `input`
- `label`
- 以及任何显式标记为“忽略卡片点击冒泡”的局部容器

## 实现建议

### Updater

- 用常量集中声明 updater repo slug
- 为该常量补最小单测，防止仓库迁移时漏改
- 真实验证时不要只看 UI，要做一次实际 `CheckUpdate`

### Account Card

- 把“是否应触发卡片详情打开”抽成独立 helper
- 用纯函数测试覆盖：
  - 普通卡片区域点击
  - 按钮本身点击
  - 按钮内部嵌套元素点击
  - 显式 ignore marker 点击

## 本轮落点

- updater source 修正：`app.go`
- updater source 防回归测试：`app_test.go`
- card 点击规则：`frontend/src/features/accounts/accountCardInteractions.ts`
- card 点击测试：`frontend/src/features/accounts/accountCardInteractions.test.mjs`

## 为什么不更新 AGENTS

这两条规则属于 GetTokens 项目级技术边界：

- updater 发布源如何选择
- accounts 卡片交互如何实现

它们不是所有仓库通用的长期治理规则，因此沉淀到项目 skill 和研发文档即可，不需要上升到 `AGENTS.md`。
