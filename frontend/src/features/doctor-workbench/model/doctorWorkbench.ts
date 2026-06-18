import {
  buildQuotaFactEvidenceView,
} from '../../accounts/model/accountQuota.ts';
import { buildRouteResilienceEvidenceDigestsFromDroppedReasons } from '../../channel-routing/model/channelRouting.ts';
import { deriveQuotaFactFromDoctorEvidence } from './quotaEvidenceAdapter.ts';

export type DoctorCheckStatus = 'critical' | 'warning' | 'degraded' | 'not_ready' | 'ok' | 'skipped';
export type DoctorSnapshotSource = 'sidecar' | 'sidecar-diagnostics' | 'wails-aggregate' | 'preview';

export interface DoctorRouteEvidencePayload {
  accountKey?: string;
  accountId?: string;
  accountID?: string;
  authId?: string;
  authID?: string;
  model?: string;
  source?: string;
  scope?: string;
  reason?: string;
  routeBlocking?: boolean | null;
}

export interface DoctorQuotaFactEvidencePayload {
  state?: string;
  source?: string;
  freshness?: string;
  confidence?: string;
  risk?: string;
  explanation?: string;
  observedAt?: string;
  expiresAt?: string;
  evidenceRefs?: string[];
}

export interface DoctorEvidenceRef {
  kind: string;
  label: string;
  summary: string;
  refID: string;
  source: string;
  accountKey?: string;
  accountID?: string;
  authId?: string;
  authID?: string;
  model?: string;
  scope?: string;
  reason?: string;
  routeBlocking?: boolean | null;
  routeEvidence?: Readonly<DoctorRouteEvidencePayload>;
  droppedReason?: Readonly<DoctorRouteEvidencePayload>;
  quotaFact?: Readonly<DoctorQuotaFactEvidencePayload>;
}

export interface DoctorNavigationTarget {
  kind: string;
  label: string;
  hash: string;
}

export interface DoctorCheck {
  id: string;
  kind: string;
  title: string;
  status: DoctorCheckStatus;
  reason: string;
  repairability: 'none' | 'manual' | 'guided' | 'automatic_candidate' | 'read_only';
  authority: 'sidecar' | 'wails' | 'local_file' | 'preview';
  confidence: 'high' | 'medium' | 'low';
  lastCheckedAtUnixMs: number;
  evidence: DoctorEvidenceRef[];
  navigation: DoctorNavigationTarget[];
}

export interface DoctorSnapshot {
  generatedAtUnixMs: number;
  source: DoctorSnapshotSource;
  sidecarReady: boolean;
  status: DoctorCheckStatus;
  checks: DoctorCheck[];
  summary?: DoctorSummary;
}

export interface DoctorSummary {
  total: number;
  critical: number;
  warning: number;
  degraded: number;
  notReady: number;
  ok: number;
  skipped: number;
}

export interface DoctorWorkbenchCheckView extends DoctorCheck {
  evidenceCount: number;
  evidence: DoctorWorkbenchEvidenceView[];
  primaryNavigation: DoctorNavigationTarget | null;
}

export interface DoctorWorkbenchView {
  source: DoctorSnapshotSource;
  runtimeTruth: boolean;
  generatedAtUnixMs: number;
  sidecarReady: boolean;
  statusCounts: Record<DoctorCheckStatus, number>;
  checks: DoctorWorkbenchCheckView[];
}

export interface DoctorWorkbenchEvidenceView extends DoctorEvidenceRef {
  sourceLabel: string;
  summaryLabel: string;
  targetKey?: string;
  accountKey?: string;
  authId?: string;
  model?: string;
  scope?: string;
  reasonSummary?: string;
  routeBlockingLabel?: string;
  routeFallbackState?: 'partial-identity' | 'unknown-non-authoritative';
}

const statusRank: Record<DoctorCheckStatus, number> = {
  critical: 0,
  warning: 1,
  degraded: 2,
  not_ready: 3,
  ok: 4,
  skipped: 5,
};

export function deriveDoctorWorkbenchView(snapshot: DoctorSnapshot): DoctorWorkbenchView {
  const statusCounts: Record<DoctorCheckStatus, number> = {
    critical: 0,
    warning: 0,
    degraded: 0,
    not_ready: 0,
    ok: 0,
    skipped: 0,
  };

  for (const check of snapshot.checks) {
    statusCounts[check.status] += 1;
  }

  const checks = snapshot.checks
    .map((check) => {
      const evidence = deriveDoctorEvidenceViews(check);
      return {
        ...check,
        evidence,
        evidenceCount: evidence.length,
        primaryNavigation: check.navigation[0] ?? null,
      };
    })
    .sort((left, right) => {
      const byStatus = statusRank[left.status] - statusRank[right.status];
      if (byStatus !== 0) {
        return byStatus;
      }
      return left.title.localeCompare(right.title);
    });

  return {
    source: snapshot.source,
    runtimeTruth: snapshot.source !== 'preview',
    generatedAtUnixMs: snapshot.generatedAtUnixMs,
    sidecarReady: snapshot.sidecarReady,
    statusCounts,
    checks,
  };
}

function deriveDoctorEvidenceViews(check: DoctorCheck): DoctorWorkbenchEvidenceView[] {
  if (!isRouteEvidenceCheck(check)) {
    return check.evidence.map((item) => deriveDoctorEvidenceView(check, item));
  }

  const views: DoctorWorkbenchEvidenceView[] = [];
  const digestEntries: Array<{
    decisionID: string;
    droppedReason: {
      accountID: string;
      authID: string;
      model: string;
      source: string;
      scope: string;
      reason: string;
      routeBlocking?: boolean;
    };
  }> = [];
  const routeBlockingByTarget = new Map<string, RouteEvidenceBlockingState>();

  for (const evidence of check.evidence) {
    const normalized = normalizeDoctorRouteEvidence(evidence);
    if (!normalized?.targetKey) {
      views.push(deriveDoctorEvidenceView(check, evidence, {
        routeFallbackState: detectDoctorRouteFallbackState(evidence),
      }));
      continue;
    }
    digestEntries.push({
      decisionID: evidence.refID,
      droppedReason: {
        accountID: normalized.accountKey,
        authID: normalized.authId,
        model: normalized.model,
        source: normalized.source,
        scope: normalized.scope,
        reason: normalized.reason,
        routeBlocking: normalized.routeBlocking ?? undefined,
      },
    });
    const existing = routeBlockingByTarget.get(normalized.targetKey);
    if (existing) {
      if (normalized.routeBlocking === true) {
        existing.hasRouteBlockingTrue = true;
      } else if (normalized.routeBlocking === false) {
        existing.hasRouteBlockingFalse = true;
      }
      continue;
    }
    routeBlockingByTarget.set(normalized.targetKey, {
      hasRouteBlockingTrue: normalized.routeBlocking === true,
      hasRouteBlockingFalse: normalized.routeBlocking === false,
      kind: normalized.kind,
    });
  }

  const digests = buildRouteResilienceEvidenceDigestsFromDroppedReasons(digestEntries, [], '', {
    requireFullIdentity: true,
  });

  for (const digest of digests) {
    const blockingState = routeBlockingByTarget.get(digest.id);
    const routeBlockingLabel = formatDoctorRouteBlockingLabel(
      blockingState?.hasRouteBlockingTrue === true,
      blockingState?.hasRouteBlockingFalse === true,
    );
    const summaryLabel = [
      digest.reasonSummary,
      routeBlockingLabel,
      digest.occurrenceCount > 1 ? `${digest.occurrenceCount} 次命中` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    views.push({
      kind: blockingState?.kind || 'route_dropped_reason',
      label: digest.accountTitle,
      summary: digest.reasonSummary,
      refID: digest.id,
      source: digest.source,
      sourceLabel: digest.sourceLabel,
      summaryLabel: summaryLabel || 'Route evidence available',
      targetKey: digest.id,
      accountKey: digest.accountKey || undefined,
      authId: digest.authId || undefined,
      model: digest.model || undefined,
      scope: digest.scope || undefined,
      reasonSummary: digest.reasonSummary || undefined,
      routeBlockingLabel: routeBlockingLabel || undefined,
    });
  }

  return views;
}

function deriveDoctorEvidenceView(
  check: DoctorCheck,
  evidence: DoctorEvidenceRef,
  options?: { routeFallbackState?: 'partial-identity' | 'unknown-non-authoritative' },
): DoctorWorkbenchEvidenceView {
  const displayEvidence = options?.routeFallbackState ? stripDoctorRouteAuthorityFields(evidence) : evidence;
  const quotaFact = deriveQuotaFactFromDoctorEvidence(check, evidence);
  if (quotaFact) {
    const view = buildQuotaFactEvidenceView(quotaFact);
    if (view) {
      return {
        ...displayEvidence,
        sourceLabel: view.sourceLabel,
        summaryLabel: view.summary,
        routeFallbackState: options?.routeFallbackState,
      };
    }
  }

  return {
    ...displayEvidence,
    sourceLabel: formatDoctorEvidenceSourceLabel(evidence.source),
    summaryLabel: String(evidence.summary || '').trim() || 'No summary',
    routeFallbackState: options?.routeFallbackState,
  };
}

function stripDoctorRouteAuthorityFields(evidence: DoctorEvidenceRef): DoctorEvidenceRef {
  const next = { ...evidence };
  delete next.accountKey;
  delete next.accountID;
  delete next.authId;
  delete next.authID;
  delete next.model;
  delete next.scope;
  delete next.reason;
  delete next.routeBlocking;
  delete next.routeEvidence;
  delete next.droppedReason;
  return next;
}

function formatDoctorEvidenceSourceLabel(source: string) {
  const normalized = String(source || '').trim().toLowerCase();
  if (!normalized) {
    return 'Unknown source';
  }
  if (normalized === 'wails-aggregate') {
    return 'Wails aggregate';
  }
  if (normalized === 'sidecar-diagnostics') {
    return 'Sidecar diagnostics';
  }
  if (normalized === 'sidecar') {
    return 'Sidecar authority';
  }
  return normalized
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

interface NormalizedDoctorRouteEvidence {
  targetKey: string;
  accountKey: string;
  authId: string;
  model: string;
  source: string;
  scope: string;
  reason: string;
  routeBlocking: boolean | null;
  kind: string;
}

interface RouteEvidenceBlockingState {
  hasRouteBlockingTrue: boolean;
  hasRouteBlockingFalse: boolean;
  kind: string;
}

function isRouteEvidenceCheck(check: DoctorCheck) {
  return (
    check.id === 'route_guard_dropped_reasons' ||
    check.kind === 'route-guard-stale-block' ||
    check.evidence.some((item) => {
      const kind = String(item.kind || '').trim().toLowerCase();
      return kind === 'route_decision' || kind === 'route_dropped_reason';
    })
  );
}

function normalizeDoctorRouteEvidence(evidence: DoctorEvidenceRef): NormalizedDoctorRouteEvidence | null {
  const typedRouteEvidence = extractTypedDoctorRouteEvidence(evidence);

  const accountKey = typedRouteEvidence.accountKey;
  const authId = typedRouteEvidence.authId;
  const model = typedRouteEvidence.model;
  const normalizedSource = typedRouteEvidence.source;
  const scope = typedRouteEvidence.scope;
  const reason = typedRouteEvidence.reason;
  const routeBlocking = typedRouteEvidence.routeBlocking;

  if (!(accountKey || authId) || !model || !normalizedSource || !scope) {
    return null;
  }

  const targetKey = [accountKey, authId, model, normalizedSource, scope].join('|');
  return {
    targetKey,
    accountKey,
    authId,
    model,
    source: normalizedSource,
    scope,
    reason,
    routeBlocking,
    kind: String(evidence.kind || '').trim() || 'route_dropped_reason',
  };
}

function detectDoctorRouteFallbackState(evidence: DoctorEvidenceRef): 'partial-identity' | 'unknown-non-authoritative' | undefined {
  const typedRouteEvidence = extractTypedDoctorRouteEvidence(evidence);
  const hasAnyRouteIdentity =
    Boolean(typedRouteEvidence.accountKey || typedRouteEvidence.authId || typedRouteEvidence.model || typedRouteEvidence.scope);

  return hasAnyRouteIdentity ? 'partial-identity' : 'unknown-non-authoritative';
}

function extractTypedDoctorRouteEvidence(evidence: DoctorEvidenceRef) {
  const droppedReason = evidence.droppedReason;
  const routeEvidence = evidence.routeEvidence;
  return {
    accountKey: firstNonEmpty([
      String(droppedReason?.accountKey || ''),
      String(droppedReason?.accountId || ''),
      String(droppedReason?.accountID || ''),
      String(routeEvidence?.accountKey || ''),
      String(routeEvidence?.accountId || ''),
      String(routeEvidence?.accountID || ''),
    ]),
    authId: firstNonEmpty([
      String(droppedReason?.authId || ''),
      String(droppedReason?.authID || ''),
      String(routeEvidence?.authId || ''),
      String(routeEvidence?.authID || ''),
    ]),
    model: firstNonEmpty([String(droppedReason?.model || ''), String(routeEvidence?.model || '')]),
    source: firstNonEmpty([String(droppedReason?.source || ''), String(routeEvidence?.source || '')]),
    scope: firstNonEmpty([String(droppedReason?.scope || ''), String(routeEvidence?.scope || '')]),
    reason: firstNonEmpty([String(droppedReason?.reason || ''), String(routeEvidence?.reason || '')]),
    routeBlocking: firstKnownBoolean([
      droppedReason?.routeBlocking ?? null,
      routeEvidence?.routeBlocking ?? null,
    ]),
  };
}

function extractRouteFieldsFromText(text: string) {
  const input = String(text || '').trim();
  if (!input) {
    return {
      accountKey: '',
      authId: '',
      model: '',
      scope: '',
      reason: '',
      routeBlocking: null as boolean | null,
    };
  }

  const aliasMap: Record<string, 'accountKey' | 'authId' | 'model' | 'scope' | 'reason' | 'routeBlocking'> = {
    account: 'accountKey',
    accountkey: 'accountKey',
    accountid: 'accountKey',
    acct: 'accountKey',
    auth: 'authId',
    authid: 'authId',
    model: 'model',
    scope: 'scope',
    reason: 'reason',
    routeblocking: 'routeBlocking',
  };
  const matches: Array<{ key: keyof typeof aliasMap; field: (typeof aliasMap)[keyof typeof aliasMap]; valueStart: number; start: number }> = [];
  const pattern = /(^|[\s|,;])(?<key>accountKey|accountID|account|acct|authId|authID|auth|model|scope|reason|routeBlocking)\s*[:=]/gi;

  for (const match of input.matchAll(pattern)) {
    const rawKey = String(match.groups?.key || '').toLowerCase();
    const field = aliasMap[rawKey];
    if (!field) {
      continue;
    }
    matches.push({
      key: rawKey as keyof typeof aliasMap,
      field,
      valueStart: (match.index || 0) + match[0].length,
      start: match.index || 0,
    });
  }

  const parsed = {
    accountKey: '',
    authId: '',
    model: '',
    scope: '',
    reason: '',
    routeBlocking: null as boolean | null,
  };

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const value = input
      .slice(current.valueStart, next ? next.start : input.length)
      .trim()
      .replace(/^[|,;]+/, '')
      .replace(/[|,;]+$/, '')
      .trim();
    if (!value) {
      continue;
    }
    if (current.field === 'routeBlocking') {
      const normalized = value.toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        parsed.routeBlocking = true;
      } else if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        parsed.routeBlocking = false;
      }
      continue;
    }
    if (!parsed[current.field]) {
      parsed[current.field] = value;
    }
  }

  return parsed;
}

function inferRouteIdentityToken(candidates: string[], pattern: RegExp) {
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (pattern.test(normalized)) {
      return normalized;
    }
  }
  return '';
}

function formatDoctorRouteBlockingLabel(hasTrue: boolean, hasFalse: boolean) {
  if (hasTrue && hasFalse) {
    return 'Mixed blocking state';
  }
  if (hasTrue) {
    return 'Route blocking';
  }
  if (hasFalse) {
    return 'Non-blocking evidence';
  }
  return '';
}

function firstNonEmpty(values: string[]) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function firstKnownBoolean(values: Array<boolean | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
}
