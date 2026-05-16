# 2026-05-16 未收口需求判定

## 结论

当前需求队列按三层处理：

1. `202604xx` 遗留 `in-progress` 文档先归档，不再计入当前未收口需求。
2. `20260511-codex-binary-management` 作为短线收尾：主流程已可用，剩余 `CancelCodexBinaryDownload` 与下载 event 推送。
3. `20260515-rate-limit-middleware` 作为接下来需求设计主线：先围绕 v5 “内存缓存 + 定时评估”方案推进 BDD / TDD / 实现。

## 4 月遗留文档归档口径

以下 space 已不作为当前开放需求排队：

- `20260426-provider-config-setup`：归档为 `archived-implemented`。
- `20260426-componentization-split`：归档为 `archived-implemented`。
- `20260427-account-metrics-split`：归档为 `archived-superseded`，后续由 `AttributionCard` 卡片体系承接。
- `20260427-deepseek-provider-support`：归档为 `archived-superseded`，后续由 `openai-compatible provider` 心智承接。
- `20260427-macos-sparkle-updater`：归档为 `archived-release-governance`，后续按 release governance 处理。
- `20260428-gettokens-usage-dual-source`：归档为 `archived-superseded`，后续由 sidecar usage attribution 主线承接。
- `20260428-nolon-codex-usage`：归档为 `archived-research`，作为参考研究保留。
- `20260429-network-proxy`：归档为 `archived-implemented-app-layer`，后续 sidecar 级代理配置需另起主线。
- `20260429-usage-desk-controls-redesign`：归档为 `archived-handoff`，当前不作为独立开放需求排队。

`account-pool` 保留为 `active-umbrella`，只作为账号池长期文档入口，不按单个未收口需求统计。

## 当前执行顺序

1. 先清理文档状态噪音，确保项目进度视图只暴露真实未收口项。
2. 收尾 `codex-binary-management`：补取消下载与 event 推送，或明确从首期 DoD 移出。
3. 进入 `rate-limit-middleware` 主线：确认 v5 验收场景，先补失败测试，再实现 sidecar / Wails / 前端闭环。

## 非目标

- 不删除历史 space。
- 不把旧研究稿迁成新需求。
- 不在本次判定中扩展 `rate-limit-middleware` 的功能范围。
