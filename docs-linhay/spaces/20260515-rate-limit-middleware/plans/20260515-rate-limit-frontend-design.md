# 限流策略 — 前端展示设计

日期：2026-05-15

## 2026-05-16 核对修正

本文件原始插入点仍有参考价值，但设计稿已按 2026-05-15 之后的账号归因卡母版重做，当前实现依据以 `../rate-limit-design-v01.html` 和以下修正为准：

1. `RateLimitSection` 不再按“旧账号卡新增一块进度条”理解，而是共享 `AttributionCard` 的 `Route Guard` 区域：位置在 quota 后、evidence 前，语义是 routing guard / DenyIDs，而不是平台 quota 的另一组窗口。
2. `AccountCard`、`CodexAccountOrderRow`、`OpenAICompatibleProviderCard` 已统一到共享账号卡骨架，限流状态应作为区域配置和 badge 数据注入，不应复制独立卡片 JSX。
3. Codex 请求顺序卡存在 `完整 / 缩略` 密度：缩略模式隐藏 traffic、usage、quota、evidence，但仍必须保留限流 blocked chip、route target、runtime、model mapping 和 route policy。
4. `ApiKeyDetailModal` 的限流配置区命名为 `Route Guard Rules` 更准确，放在 `Management` 与 `Verification` 之间；保存规则后应触发 `EvaluateNow`，并在 UI 上展示 evaluator/cache 的最近更新时间。
5. `UsageDeskFeature` 当前只有 `observed / projected` 两个 source。若首期继续包含 `rate-limit` source，需要同步扩展 `UsageDeskSource`、localStorage 持久化、preview data、表格视图和测试；不能只在现有页面里追加静态表。

## 现有组件架构回顾

所有账号卡片共享 `AttributionCard` 组件（`frontend/src/features/accounts/components/AttributionCard.tsx`），其 section 结构为：

```
┌─ Header ─────────────────────────────────────────┐
│  ● title / subtitle / eyebrow                     │
│  [badge] [badge] [badge]                          │
│  failureReason (red text)                         │
├─ Traffic Curve ──────────────────────────────────┤
│  requestCount | 24H curve (flow points, SVG)      │
│  window / peak / now tokens                       │
├─ Token Strip ────────────────────────────────────┤
│  requests | total tokens | cached | avg latency   │
├─ Quota Windows ──────────────────────────────────┤
│  [5H ████████░░ 80%]                             │
│  [7D ██████░░░░ 60%]                             │
│  (Codex 计划额度，蓝色 progress bar)               │
├─ Evidence ───────────────────────────────────────┤
│  ASSET ID / SOURCE / LAST ACTIVE                  │
├─ customBody (optional) ──────────────────────────┤
│  AccountOrderRow: Codex route / models / policy   │
├─ Footer ─────────────────────────────────────────┤
│  [Details] [Refresh Quota] [Reauth]               │
└──────────────────────────────────────────────────┘
```

## 插入点设计

### 插入点 1：AttributionCard — 新增 `RateLimitSection`

在 Quota Windows section 之后，Evidence section 之前插入。视觉上与 quota windows 一致但使用 **amber 色轨**区分：

```
├─ Quota Windows (既有, 蓝色) ──────────────────────┤
│  [5H ████████░░ 80%]                             │
│  [7D ██████░░░░ 60%]                             │
├─ Rate Limits (新增, amber 色轨) ─────────────────┤
│  [24h tokens    ██████████ 1.2M/1.0M] ← 超限红色  │
│  [1h requests   ████░░░░░░ 40/100]   ← 正常 amber │
│  [本地限额]                                       │
└──────────────────────────────────────────────────┘
```

**AttributionCard 新增 prop：**

```typescript
interface AttributionCardProps {
  // ... existing ...
  rateLimitStatus?: RateLimitState;  // NEW
}
```

**渲染逻辑（新增 section，位于 quota section 之后、evidence section 之前）：**

```tsx
{rateLimitStatus && rateLimitStatus.rules.length > 0 ? (
  <section className="grid gap-3 border-b border-dashed border-[var(--border-color)] px-4 py-4">
    <div className="font-mono text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {t('accounts.rate_limits')}
    </div>
    {rateLimitStatus.rules.map(rs => {
      const exceeded = rs.exceeded && rs.rule.action === 'block';
      const barFill = exceeded ? 'bg-red-500' : 'bg-amber-600';
      const textTone = exceeded ? 'text-red-500' : 'text-[var(--text-primary)]';
      return (
        <div key={rs.rule.id} className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2">
          <div className={`font-mono text-[0.625rem] font-black uppercase tracking-[0.12em] ${textTone}`}>
            {rs.rule.window} {rs.rule.limit_type === 'tokens' ? 'TOKENS' : 'REQ'}
          </div>
          <div className="relative h-4 overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)]"
               style={{ backgroundImage: 'repeating-linear-gradient(...)' }}>
            <div className={`absolute inset-y-0 left-0 ${barFill}`}
                 style={{ width: `${Math.min(100, rs.usagePct)}%` }} />
          </div>
          <div className={`text-right font-mono text-[0.625rem] font-black uppercase tracking-[0.08em] ${textTone}`}>
            {exceeded ? rs.reason : `${formatMetric(rs.currentUsage)}/${formatMetric(rs.rule.limit_value)}`}
          </div>
        </div>
      );
    })}
  </section>
) : null}
```

### 插入点 2：AccountCard — 获取并传递限流状态

**`AccountCard.tsx` 变更：**

1. 新增 prop（或从 hook 获取）：`rateLimitStatus?: RateLimitState`
2. 传入 `AttributionCard`：

```tsx
<AttributionCard
  // ... existing props ...
  rateLimitStatus={rateLimitStatus}
/>
```

**数据获取**：在 `useAccountsPageState` 或 `useAccountsQuotaState` 同级新增 `useAccountsRateLimitState` hook：

```typescript
function useAccountsRateLimitState(accountKeys: string[]) {
  const [statuses, setStatuses] = useState<Record<string, RateLimitState>>({});

  useEffect(() => {
    // 30s 轮询 sidecar
    const timer = setInterval(async () => {
      const result = await GetAllRateLimitStatuses();
      const byAccount: Record<string, RateLimitState> = {};
      for (const s of result) {
        byAccount[s.account_key] = s;
      }
      setStatuses(byAccount);
    }, 30_000);

    // 首次立即加载
    GetAllRateLimitStatuses().then(...);

    return () => clearInterval(timer);
  }, []);

  return statuses;
}
```

### 插入点 3：AccountOrderRow — badges 添加超限 chip

**`CodexAccountOrderRow.tsx` 变更：**

当 `rateLimitStatus.blocked === true` 时，向 `badges` 数组追加一个 critical tone chip：

```typescript
const badges: AttributionCardBadge[] = [
  // ... existing badges (ORDER NN, sourceKindLabel, etc.) ...
  ...(rateLimitStatus?.blocked ? [{ label: rateLimitStatus.block_reason, tone: 'critical' as const }] : []),
];
```

compact 模式下这个 chip 也会显示——badges 区域不受 density 影响。

### 插入点 4：ApiKeyDetailModal — 新增 RATE LIMITS 配置区

**位置**：在既有 MANAGEMENT section 末尾、VERIFICATION section 之前。

**布局**：每条规则一行，紧凑排列：

```
┌─ MANAGEMENT ──────────────────────────────────────┐
│  (既有: API Key / Base URL / Prefix / Quota Curl) │
├─ RATE LIMITS ─────────────────────────────────────┤
│                                                    │
│  ┌─ Rule Row 1 ────────────────────────────────┐  │
│  │ [Token 窗口限流 ▼] [24h ▼] [1000000] [Block ▼] [✓] [✕] │
│  │ 当前: 320K / 1M (32%)                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌─ Rule Row 2 ────────────────────────────────┐  │
│  │ [请求窗口限流 ▼] [1h ▼] [100] [Warn ▼] [✓] [✕] │
│  │ 当前: 45 / 100 (45%)                         │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [+ 新增规则]                                      │
│                                                    │
├─ VERIFICATION ────────────────────────────────────┤
│  (既有)                                            │
└────────────────────────────────────────────────────┘
```

**状态管理：**

```typescript
// 在 ApiKeyDetailModal 中新增
interface RateLimitRuleDraft {
  id?: string;         // 已有规则编辑时存在
  strategy: string;    // "token-window" | "request-window"
  window: string;      // "1h" | "24h" | "7d" | "30d"
  limit_value: number;
  action: 'block' | 'warn';
  enabled: boolean;
  label: string;
}

const [ruleDrafts, setRuleDrafts] = useState<RateLimitRuleDraft[]>([]);
const [availableStrategies, setAvailableStrategies] = useState<StrategyMeta[]>([]);

// 打开 modal 时加载
useEffect(() => {
  ListRateLimitStrategies().then(setAvailableStrategies);
  GetRateLimitStatus(account.id).then(status => {
    setRuleDrafts(status.rules.map(r => ({
      id: r.rule.id,
      strategy: r.rule.strategy,
      window: r.rule.window,
      limit_value: r.rule.limit_value,
      action: r.rule.action,
      enabled: r.rule.enabled,
      label: r.rule.label,
    })));
  });
}, [account.id]);
```

**保存逻辑**：对比 `ruleDrafts` 与原始规则，执行 create/update/delete 调用。

### 插入点 5：UsageDesk — 新增限流观察源

**`UsageDeskFeature.tsx` 变更：**

在 source toggle 中新增第三个选项 `rate-limit`：

```
[OBSERVED] [PROJECTED] [RATE LIMITS]
```

选中 `rate-limit` 时，渲染所有已配置限流规则的状态一览：

```
┌─ Rate Limit Status ──────────────────────────────┐
│                                                    │
│  account-1 (codex-api-key:abc123)                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ 24h tokens  ████████████████  1.8M/2.0M  90% │ │
│  │ 1h requests ██████░░░░░░░░░░  60/100    60%  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  account-2 (auth-file:auth.json)                   │
│  ┌──────────────────────────────────────────────┐ │
│  │ 24h tokens  ████████████████████████████ 已满  │ │ ← critical
│  │ 7d tokens   ████░░░░░░░░░░░░░░  2.1M/10M  21% │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

按 `blocked` 降序排列（超限在前），每个账号一个 compact 状态条。

## 前端类型定义

```typescript
// frontend/src/types.ts (追加)

interface StrategyMeta {
  id: string;              // "token-window"
  name: string;            // "Token 窗口限流"
  supported_windows: string[]; // ["1h", "6h", "12h", "24h", "7d", "30d"]
}

interface RateLimitRule {
  id: string;
  account_key: string;
  strategy: string;
  window: string;
  limit_value: number;
  action: 'block' | 'warn';
  enabled: boolean;
  label: string;
  created_at: number;
  updated_at: number;
}

interface RuleState {
  rule: RateLimitRule;
  exceeded: boolean;
  reason: string;
  usage_pct: number;
}

interface RateLimitState {
  account_key: string;
  blocked: boolean;
  block_reason: string;
  rules: RuleState[];
  updated_at: number;
}
```

## Wails 绑定（前端调用）

```typescript
// 来自 wailsjs/go/main/App (自动生成)
import {
  ListRateLimitStrategies,
  ListRateLimitRules,
  CreateRateLimitRule,
  UpdateRateLimitRule,
  DeleteRateLimitRule,
  GetRateLimitStatus,
  GetAllRateLimitStatuses,
} from '../../../../wailsjs/go/main/App';
```

## 实施文件清单

| 文件 | 变更类型 | 内容 |
|------|---------|------|
| `types.ts` | 追加类型 | `StrategyMeta`, `RateLimitRule`, `RuleState`, `RateLimitState` |
| `AttributionCard.tsx` | 修改 | 新增 `rateLimitStatus` prop + Rate Limits section |
| `AccountCard.tsx` | 修改 | 获取 `rateLimitStatus` 并传入 `AttributionCard` |
| `accountPresentation.ts` | 追加函数 | `resolveRateLimitStatusTone`, `formatRateLimitMetric` |
| `CodexAccountOrderRow.tsx` | 修改 | badges 中追加超限 chip |
| `ApiKeyDetailModal.tsx` | 修改 | 新增 RATE LIMITS 配置区 |
| `RateLimitRuleEditor.tsx` | **新建** | 单条规则的编辑行组件 |
| `RateLimitBar.tsx` | **新建** | 限流进度条组件（card 和 desk 共用） |
| `UsageDeskFeature.tsx` | 修改 | 新增 `rate-limit` source |
| `useRateLimitState.ts` | **新建** | 30s 轮询 hook |

## 视觉规范

| 元素 | 样式 |
|------|------|
| Rate Limits section 标题 | `font-mono text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]` |
| 进度条高度 | `h-4` (与 quota windows 一致) |
| 正常进度条填充 | `bg-amber-600` |
| 超限进度条填充 | `bg-red-500` |
| 超限文字 | `text-red-500` |
| Chip 超限标记 | `BADGE_TONE_CLASS['critical']` (红底) |
| Strategy/WIndow dropdown | 复用既有 combobox 组件 |
