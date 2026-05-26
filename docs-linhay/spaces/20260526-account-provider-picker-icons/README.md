# Account Provider Picker Icons

## 背景
账号页的添加账号入口已经收敛到头部 actions menu 中的第一项，由加号图标承担动作提示，文案不再额外带 `+`。弹窗一次性展示大量厂商和格式标签，当前卡片主要依赖大写文本，扫读压力偏高，也没有把 `vendorPresets` 中已有的 `icon / iconColor` 信息真正呈现出来。

## 目标
- 让厂商选择卡片优先通过品牌图形和短名称识别，降低首屏文字密度。
- 使用本地化图标数据，避免弹窗打开时依赖外部图片请求。
- 对没有官方 SVG 的厂商提供统一字母徽记兜底，保证所有 preset 都有可识别图形锚点。

## 范围
- `frontend/src/features/accounts/components/UnifiedComposeModal.tsx`
- 账号厂商 preset 的展示辅助模型与聚焦测试。
- 浏览器预览截图归档到本 space。

## 非目标
- 不新增、删除或调整厂商 preset 的业务语义。
- 不改变账号创建、保存、quota / billing curl 的提交流程。
- 不引入新的运行时远端图片依赖。

## 验收标准
1. Given 用户打开 `#frame=accounts` 并展开头部 actions menu，再点击添加账号入口，When 厂商选择弹窗出现，Then 每个厂商卡片都有品牌图形或字母徽记。
2. Given 选择弹窗展示官方、国内厂商和聚合商列表，When 用户扫读卡片，Then 卡片主名称使用短名称，格式标签使用短格式，不再堆叠长格式文案。
3. Given 某厂商没有可用官方 SVG，When 该厂商出现在列表，Then 使用品牌色或默认色的字母徽记兜底，并保留完整厂商名作为可访问标签。
4. Given 用户选择某个 preset 进入配置步骤，When 查看顶部厂商摘要和 endpoint 列表，Then 摘要继续展示图标与短格式标签，账号创建流程不变。
5. 相关单元测试、类型检查和浏览器预览截图通过。

## 设计稿入口

- 本期设计稿：`（未产出）`
- 约束：单期只保留一个 HTML 文件；若存在多稿对比，也必须收敛在同一个 HTML 文件内。

## Worktree 映射

- branch：`feat/20260526-account-provider-picker-icons`
- worktree：`../GetTokens-worktrees/20260526-account-provider-picker-icons/`

## 相关链接
- 页面：`http://localhost:5173/#frame=accounts`

## 当前状态
- 状态：completed
- 最近更新：2026-05-26
- 备注：添加账号入口已从 header 独立按钮收口到 actions menu 的第一项；首项保留加号图标，文案不再额外带 `+`；统一新增弹窗已完成 provider 图标 / 字母徽记、短名称、短格式标签和中英本地化收口。
- 验收截图：`docs-linhay/spaces/20260526-account-provider-picker-icons/screenshots/20260526/accounts/20260526-accounts-header-actions-menu-after-v01.png`
- 字号修正截图：`docs-linhay/spaces/20260526-account-provider-picker-icons/screenshots/20260526/accounts/20260526-accounts-header-menu-font-after-v01.png`
- provider picker 截图：`docs-linhay/spaces/20260526-account-provider-picker-icons/screenshots/20260526/accounts/20260526-accounts-provider-picker-icons-after-v01.png`
