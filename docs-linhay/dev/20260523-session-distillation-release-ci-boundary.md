# 会话整理：CI 自动发布与 DMG 分发验收边界

## 背景

本轮 `v1.0.22` 发布由 GitHub Actions release workflow 自动完成。后续本地尝试下载正式 DMG 做 post-release 验收时，出现下载慢以及本地历史文件不是原始 DMG 的干扰，容易把“CI 已发布”和“DMG 验收未完成”混成同一状态。

## 沉淀模式

发布状态以后分两层表达：

1. `CI 发布完成`：release workflow 全绿，GitHub Release 存在，预期资产已挂载。
2. `可分发 DMG 验收完成`：下载 GitHub Release 正式资产，并完成 checksum、Gatekeeper、stapler、app 签名、架构、bundle 版本和 Sparkle feed 校验。

当第一层已完成、第二层还在进行或被网络下载阻塞时，结论应写成“已发布，分发验收待完成/被阻塞”。不要把本地验收未完成表述为“还没发布”，也不要因此手工重打或重传 DMG。

## 执行入口

- 主发布手册：`docs-linhay/dev/20260426-release-prep-guide.md`
- 流程 skill：`.agents/skills/gettokens-ops-governance/SKILL.md`

## 不纳入范围

本次不改变 release workflow，不移动 `v1.0.22` tag，不重新生成 DMG。GitHub Actions 产物仍是正式发布资产来源。

## 验证

本次是文档与流程沉淀，验证以结构检查和 qmd 索引同步为主：

```bash
docs-linhay/scripts/check-docs.sh
qmd update
qmd embed
```
