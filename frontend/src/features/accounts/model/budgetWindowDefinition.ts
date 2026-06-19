import { main } from '../../../../wailsjs/go/models';
import type { BudgetWindowDefinition, QuotaWindowFact } from '../../../types';

export type BudgetWindowKind = 'daily' | 'multi-day' | 'bounded';
export type BudgetWindowMetric = 'tokens' | 'requests';

export function normalizeBudgetWindowDefinitions(items: unknown): BudgetWindowDefinition[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => main.BudgetWindowDefinition.createFrom(item))
    .filter((item) => String(item.id || '').trim())
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
}

export function normalizeQuotaWindowFacts(items: unknown): QuotaWindowFact[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => main.QuotaWindowFact.createFrom(item))
    .filter((item) => String(item.windowId || '').trim());
}

export function buildDailyBudgetWindowDefinition(options: {
  id: string;
  metric?: BudgetWindowMetric;
  limit: number;
  timezone: string;
}): BudgetWindowDefinition {
  return main.BudgetWindowDefinition.createFrom({
    id: normalizeWindowID(options.id),
    kind: 'daily',
    metric: options.metric || 'tokens',
    limit: options.limit,
    timezone: String(options.timezone || '').trim(),
    enabled: true,
  });
}

export function buildMultiDayBudgetWindowDefinition(options: {
  id: string;
  metric?: BudgetWindowMetric;
  limit: number;
  days: number;
  timezone: string;
}): BudgetWindowDefinition {
  return main.BudgetWindowDefinition.createFrom({
    id: normalizeWindowID(options.id),
    kind: 'multi-day',
    semantics: 'calendar',
    days: Math.max(1, Math.floor(Number(options.days) || 1)),
    metric: options.metric || 'tokens',
    limit: options.limit,
    timezone: String(options.timezone || '').trim(),
    enabled: true,
  });
}

export function buildBoundedBudgetWindowDefinition(options: {
  id: string;
  metric?: BudgetWindowMetric;
  limit: number;
  startsAt: string;
  endsAt: string;
}): BudgetWindowDefinition {
  return main.BudgetWindowDefinition.createFrom({
    id: normalizeWindowID(options.id),
    kind: 'bounded',
    metric: options.metric || 'tokens',
    limit: options.limit,
    startsAt: new Date(options.startsAt).toISOString(),
    endsAt: new Date(options.endsAt).toISOString(),
    enabled: true,
  });
}

export function budgetWindowDefinitionLabel(definition: BudgetWindowDefinition) {
  const id = String(definition.id || '').trim();
  const metric = String(definition.metric || 'tokens');
  if (definition.kind === 'daily') {
    return `${id} · daily · ${metric} · ${definition.timezone || 'timezone?'}`;
  }
  if (definition.kind === 'multi-day') {
    return `${id} · ${definition.days || 1} calendar days · ${metric} · ${definition.timezone || 'timezone?'}`;
  }
  if (definition.kind === 'bounded') {
    return `${id} · bounded · ${metric}`;
  }
  return id || 'budget window';
}

export function quotaWindowFactLabel(fact: QuotaWindowFact) {
  const used = Number(fact.observedUsedPercent);
  const remaining = Number(fact.observedRemainingPercent);
  const percent = Number.isFinite(remaining)
    ? `${remaining.toFixed(1)}% remaining`
    : Number.isFinite(used)
      ? `${used.toFixed(1)}% used`
      : 'no percent';
  return `${fact.windowId} · ${fact.kind || 'window'} · ${percent}`;
}

export function normalizeWindowID(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.:-]/g, '_');
}
