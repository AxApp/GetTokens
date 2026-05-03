# Nolon / Codex 用量统计深挖计划 v01

## 目标
在不改动 GetTokens 现有实现的前提下，完整摸清参考项目中 Codex 用量统计的技术链路，并提炼可迁移结论。

## 步骤
1. 确认研究对象
   - 核对用户口中的 `nolon` 是否就是当前 `references/cc-switch`
   - 若不是，记录真实参考目录并迁移本 space 的相关链接
2. 验证数据源
   - 找一份真实 `~/.codex/sessions/*.jsonl` 样本
   - 核对 `session_meta / turn_context / token_count` 的实际字段结构
3. 验证统计语义
   - 判断 `total_token_usage -> delta` 是否稳定代表单次请求
   - 标记近似统计与严格统计的边界
4. 对比其他 provider
   - 与 Claude / Gemini 的 session usage 或 proxy usage 路径做一次横向对照
   - 明确共性事实表与差异化采集方式
5. 映射回 GetTokens
   - 提炼“可借鉴点 / 风险点 / 不应照搬点”
   - 形成面向 GetTokens 的后续建议

## 交付物
1. 本 space README 持续更新
2. 必要时补充 `debate/` 或 `screenshots/`
3. 若形成稳定方案，再补 `docs-linhay/dev/` 技术文档

## 当前状态
- 状态：draft
- 最近更新：2026-04-28
