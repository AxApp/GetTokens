import { main } from '../../../../wailsjs/go/models';
import type {
  QuotaThresholdRule,
  QuotaUsageCalibration,
  QuotaWindowFact,
  RouteGuardSimulationRequest,
  RouteGuardSimulationResult,
} from '../../../types';
import type { QuotaWindowDisplay } from './types';

export type SimulationDecision = 'allow' | 'block' | 'diagnostic';

export interface ReasonTraceStep {
  code: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface AccountDecisionTrace {
  accountId: string;
  source: string;
  reason: string;
  reasonTrace: ReasonTraceStep[];
}

export interface SimulationResult {
  decision: SimulationDecision;
  matchedRule?: {
    id: string;
    name?: string;
    source?: string;
  };
  accountTrace: AccountDecisionTrace;
  recoveryAt?: string;
  expiresAt?: string;
  diagnostics?: ReasonTraceStep[];
}

export function buildRouteGuardSimulationRequest(options: {
  accountKey: string;
  rule?: QuotaThresholdRule;
  ruleId?: string;
  window?: QuotaWindowDisplay | null;
  quotaWindowFacts?: QuotaWindowFact[];
  calibrations?: QuotaUsageCalibration[];
  now?: Date;
}): RouteGuardSimulationRequest {
  const now = options.now ?? new Date();
  const quotaWindowFacts = (options.quotaWindowFacts || []).map((item) => main.QuotaWindowFact.createFrom(item));
  const fallbackWindowFact = options.window ? buildQuotaWindowFact(options.window, now) : undefined;
  return main.SimulateRouteGuardRuleRequest.createFrom({
    ruleId: String(options.ruleId || '').trim() || undefined,
    rule: options.rule,
    facts: main.SimulationFacts.createFrom({
      accountId: String(options.accountKey || '').trim(),
      now: now.toISOString(),
      quotaWindow: quotaWindowFacts[0] || fallbackWindowFact,
      quotaWindows: quotaWindowFacts.length > 0 ? quotaWindowFacts : fallbackWindowFact ? [fallbackWindowFact] : [],
      calibrationEntries: (options.calibrations || []).map((item) => buildCalibrationFact(item)),
      metadata: {},
    }),
  });
}

export function normalizeSimulationResult(input: unknown): SimulationResult | null {
  if (!input) return null;
  const result = main.SimulationResult.createFrom(input);
  const decision = normalizeDecision(result.decision);
  return {
    decision,
    matchedRule: result.matchedRule ? {
      id: String(result.matchedRule.id || ''),
      name: result.matchedRule.name,
      source: result.matchedRule.source,
    } : undefined,
    accountTrace: {
      accountId: String(result.accountTrace?.accountId || ''),
      source: String(result.accountTrace?.source || ''),
      reason: String(result.accountTrace?.reason || ''),
      reasonTrace: normalizeReasonTrace(result.accountTrace?.reasonTrace),
    },
    recoveryAt: result.recoveryAt,
    expiresAt: result.expiresAt,
    diagnostics: normalizeReasonTrace(result.diagnostics),
  };
}

function buildQuotaWindowFact(window: QuotaWindowDisplay, now: Date) {
  const tokenLimit = Number(window.limitTokens);
  const tokenRemaining = Number(window.remainingTokens);
  const tokenUsed = Number(window.usedTokens);
  const hasTokenCounts = Number.isFinite(tokenLimit) && tokenLimit > 0;
  const observedLimit = hasTokenCounts ? tokenLimit : 100;
  const observedRemaining = hasTokenCounts && Number.isFinite(tokenRemaining)
    ? tokenRemaining
    : clampPercent(Number(window.remainingPercent ?? 100));
  const observedUsed = hasTokenCounts && Number.isFinite(tokenUsed)
    ? tokenUsed
    : clampPercent(100 - Number(window.remainingPercent ?? 100));
  const resetMs = window.resetAtUnix ? window.resetAtUnix * 1000 : now.getTime();
  return main.QuotaWindowFact.createFrom({
    windowId: window.id,
    kind: 'tokens',
    metric: 'tokens',
    startsAt: new Date(now.getTime() - 60_000).toISOString(),
    endsAt: new Date(resetMs).toISOString(),
    observedUsed,
    observedLimit,
    observedRemaining,
    status: 'fresh',
  });
}

function buildCalibrationFact(item: QuotaUsageCalibration) {
  return main.CalibrationFact.createFrom({
    id: item.id,
    accountId: item.accountKey,
    windowId: item.windowKey,
    metric: item.metric,
    mode: item.mode,
    value: item.value,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    revokedAt: item.revokedAt,
  });
}

function normalizeReasonTrace(items: unknown): ReasonTraceStep[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const step = main.ReasonTraceStep.createFrom(item);
    return {
      code: String(step.code || ''),
      message: step.message,
      data: isRecord(step.data) ? step.data : undefined,
    };
  }).filter((item) => item.code);
}

function normalizeDecision(value: string): SimulationDecision {
  if (value === 'block' || value === 'diagnostic') return value;
  return 'allow';
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
