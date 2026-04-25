# Sidebar Version Label

## 背景
Sidebar 底部原本直接展示原始 `version` 字符串，缺少统一的版本号展示规则，无法满足“发布日期 + hh”的产品要求。同时自动更新仍依赖原始版本比较，不能直接把界面展示格式塞回 `Version`。

## 目标
在 Sidebar 底部增加稳定的发布日期标签，格式统一为 `YYYY.MM.DD.HH`，且不影响自动更新的版本比较逻辑。

## 范围
- 提取前端版本展示格式化逻辑
- 新增仅供 UI 展示的 `ReleaseLabel` 构建注入字段
- 在 Sidebar 底部显示格式化后的发布日期标签
- 为版本格式化补充可执行测试

## 非目标
- 不修改自动更新使用的原始 `Version` 语义
- 不调整状态页上的版本展示
- 不改动自动更新版本比较逻辑

## 验收标准
- Sidebar 底部显示 `VERSION <YYYY.MM.DD.HH>`
- Release 构建通过 `-ldflags` 注入真实发布日期标签
- `dev` 构建可回退到当前日期小时格式展示
- 日期型版本串会被规范化为 `YYYY.MM.DD.HH`
- 新增测试可覆盖日期规范化、dev 回退和展示字段读取场景

## 相关链接
- [Sidebar 组件](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/components/biz/Sidebar.tsx)
- [版本格式化工具](/Users/linhey/Desktop/linhay-open-sources/GetTokens/frontend/src/utils/version.ts)
- [Release 工作流](/Users/linhey/Desktop/linhay-open-sources/GetTokens/.github/workflows/release.yml)

## 当前状态
- 状态：done
- 最近更新：2026-04-26
