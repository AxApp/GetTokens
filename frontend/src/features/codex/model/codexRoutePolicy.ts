import type { CodexModelMappingRow } from './codexModelMappings.ts';

export interface CodexRoutingProbeAttemptView {
  index: number;
  success?: boolean;
  statusCode?: number;
  accountID?: string;
  accountLabel?: string;
  provider?: string;
  message?: string;
  evidence?: string;
}

export interface CodexRoutePolicyDraft {
  allowAccountIDs: string[];
  denyAccountIDs: string[];
  orderAccountIDs: string[];
  allowFallback: boolean;
}

export function buildCodexRoutingProbeRequestInput(model: string, attempts: number) {
  return {
    model: String(model || '').trim(),
    attempts: Math.max(1, Math.min(5, Number.isFinite(attempts) ? attempts : 1)),
    allowAccountIDs: [],
    denyAccountIDs: [],
    orderAccountIDs: [],
    allowFallback: false,
  };
}

export type CodexRoutePolicyRowMode = 'default' | 'allow' | 'deny' | 'blocked';

export interface CodexRoutePolicyRowState {
  mode: CodexRoutePolicyRowMode;
  previewRank: number;
  participates: boolean;
}

export interface CodexRoutePolicySummary {
  allowCount: number;
  denyCount: number;
  orderedCount: number;
  previewCount: number;
  fallbackEnabled: boolean;
}

export interface CodexRoutePolicyExplainPreviewCandidate {
  id: string;
  displayName: string;
  provider: string;
  routeOrder: number;
  channelOrder: number;
}

export interface CodexRoutePolicyExplainPreviewFiltered {
  id: string;
  reason: string;
}

export interface CodexRoutePolicyProjectRuleLike {
  id?: string;
  projectKey?: string;
  projectName?: string;
  projectKeySource?: string;
  projectKeyConfidence?: string;
  allowAccountIDs?: string[];
}

export interface CodexRoutePolicyExplainProjectCandidatePool {
  evaluated: boolean;
  activated: boolean;
  reason: string;
  ruleID: string;
  projectKey: string;
  projectName: string;
  projectKeySource: string;
  projectKeyConfidence: string;
  allowAccountIDs: string[];
  filteredAccountIDs: string[];
  beforeCandidateCount: number;
  afterCandidateCount: number;
}

export interface CodexRoutePolicyExplainPreview {
  baseCandidates: CodexRoutePolicyExplainPreviewCandidate[];
  candidates: CodexRoutePolicyExplainPreviewCandidate[];
  filtered: CodexRoutePolicyExplainPreviewFiltered[];
  projectCandidatePool?: CodexRoutePolicyExplainProjectCandidatePool;
}

export type CodexRoutingProbeStreamLineStatus = 'command' | 'queued' | 'running' | 'hit' | 'passed' | 'miss' | 'empty';

export interface CodexRoutingProbeStreamLine {
  key: string;
  marker: string;
  label: string;
  detail: string;
  status: CodexRoutingProbeStreamLineStatus;
}

export const DEFAULT_CODEX_ROUTING_PROBE_MODEL = 'gpt-5.4';

export function buildCodexRoutingProbeModelOptions(
  rows: Array<{ modelMappings: CodexModelMappingRow[] }>,
  catalogMappings: CodexModelMappingRow[] = [],
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const append = (mappings: CodexModelMappingRow[]) => {
    for (const mapping of mappings || []) {
      const codexModel = String(mapping.codexModel || '').trim();
      const realModel = String(mapping.realModel || '').trim();
      const name = codexModel || realModel;
      if (!name || seen.has(name)) {
        continue;
      }
      seen.add(name);
      names.push(name);
    }
  };
  for (const row of rows || []) {
    append(row.modelMappings || []);
  }
  append(catalogMappings);
  if (!seen.has(DEFAULT_CODEX_ROUTING_PROBE_MODEL)) {
    names.push(DEFAULT_CODEX_ROUTING_PROBE_MODEL);
  }
  return names;
}

export function resolveCodexRoutingProbeDefaultModel(
  rows: Array<{ modelMappings: CodexModelMappingRow[] }>,
  catalogMappings: CodexModelMappingRow[] = [],
) {
  return buildCodexRoutingProbeModelOptions(rows, catalogMappings)[0] || DEFAULT_CODEX_ROUTING_PROBE_MODEL;
}

export function summarizeCodexRoutingProbeAttempt(attempt: CodexRoutingProbeAttemptView | null | undefined) {
  if (!attempt) {
    return '';
  }
  const account = String(attempt.accountLabel || attempt.accountID || '').trim();
  const status = attempt.statusCode ? `HTTP ${attempt.statusCode}` : '';
  const message = String(attempt.message || '').trim();
  if (account) {
    return [account, status, attempt.evidence].filter(Boolean).join(' · ');
  }
  return [message, status].filter(Boolean).join(' · ');
}

export function buildCodexRoutingProbeStreamLines(
  previewRows: Array<{ id: string; label: string; provider: string; sourceKind: string }>,
  attempts: CodexRoutingProbeAttemptView[],
  input: {
    model: string;
    requestedAttempts: number;
    running: boolean;
  },
): CodexRoutingProbeStreamLine[] {
  const requestedAttempts = Math.max(1, input.requestedAttempts || attempts.length || 1);
  const model = String(input.model || DEFAULT_CODEX_ROUTING_PROBE_MODEL).trim() || DEFAULT_CODEX_ROUTING_PROBE_MODEL;
  const lines: CodexRoutingProbeStreamLine[] = [
    {
      key: 'command',
      marker: '$',
      label: `probe --model ${model} --attempts ${requestedAttempts}`,
      detail: input.running ? 'dispatching' : 'ready',
      status: 'command',
    },
  ];

  if (!previewRows.length) {
    lines.push({
      key: 'empty',
      marker: '!',
      label: 'no candidates',
      detail: 'route policy excludes every requestable account',
      status: 'empty',
    });
    return lines;
  }

  const latestAttempt = attempts[attempts.length - 1] || null;
  const hitIndex = latestAttempt?.accountID ? previewRows.findIndex((row) => row.id === latestAttempt.accountID) : -1;
  const hadUnresolvedAttempt = Boolean(latestAttempt && !latestAttempt.accountID);

  previewRows.forEach((row, index) => {
    let status: CodexRoutingProbeStreamLineStatus = 'queued';
    if (hitIndex === index) {
      status = 'hit';
    } else if (hitIndex > index) {
      status = 'passed';
    } else if (hadUnresolvedAttempt && !input.running) {
      status = 'miss';
    } else if (input.running && attempts.length === 0 && index === 0) {
      status = 'running';
    }
    lines.push({
      key: `candidate-${row.id}`,
      marker: String(index + 1).padStart(2, '0'),
      label: row.label,
      detail: [row.sourceKind, row.provider || row.id].filter(Boolean).join(' · '),
      status,
    });
  });

  attempts.forEach((attempt) => {
    const summary = summarizeCodexRoutingProbeAttempt(attempt) || attempt.message || 'request finished';
    lines.push({
      key: `attempt-${attempt.index}`,
      marker: `#${String(attempt.index).padStart(2, '0')}`,
      label: summary,
      detail: attempt.success ? 'completed' : 'returned without a successful hit',
      status: attempt.accountID ? 'hit' : 'miss',
    });
  });

  if (input.running && attempts.length < requestedAttempts) {
    lines.push({
      key: 'running',
      marker: '...',
      label: `attempt ${attempts.length + 1} running`,
      detail: `${previewRows.length} candidates in route order`,
      status: 'running',
    });
  }

  return lines;
}

export function buildCodexRoutePolicyPreview<T extends { id: string; requestable?: boolean }>(
  rows: T[],
  policy: CodexRoutePolicyDraft,
): T[] {
  const requestableRows = (rows || []).filter((row) => row.requestable !== false);
  const byID = new Map(requestableRows.map((row) => [row.id, row]));
  const allow = new Set(normalizeCodexAccountIDList(policy.allowAccountIDs));
  const deny = new Set(normalizeCodexAccountIDList(policy.denyAccountIDs));
  const order = normalizeCodexAccountIDList(policy.orderAccountIDs);

  const eligible = requestableRows.filter((row) => {
    if (deny.has(row.id)) {
      return false;
    }
    if (allow.size > 0 && !allow.has(row.id) && !policy.allowFallback) {
      return false;
    }
    return true;
  });
  const eligibleIDs = new Set(eligible.map((row) => row.id));
  const used = new Set<string>();
  const out: T[] = [];

  for (const id of order) {
    if (!eligibleIDs.has(id) || used.has(id)) {
      continue;
    }
    const row = byID.get(id);
    if (!row) {
      continue;
    }
    out.push(row);
    used.add(id);
  }

  if (allow.size > 0 && order.length === 0) {
    for (const row of eligible) {
      if (!allow.has(row.id) || used.has(row.id)) {
        continue;
      }
      out.push(row);
      used.add(row.id);
    }
  }

  if (policy.allowFallback) {
    for (const row of eligible) {
      if (used.has(row.id)) {
        continue;
      }
      out.push(row);
      used.add(row.id);
    }
  }
  return out;
}

export function buildCodexRoutePolicyExplainPreview<
  T extends {
    id: string;
    label?: string;
    provider?: string;
    requestable?: boolean;
    disabled?: boolean;
    blockReason?: string;
  },
>(
  rows: T[],
  policy: CodexRoutePolicyDraft,
  projectRule?: CodexRoutePolicyProjectRuleLike | null,
): CodexRoutePolicyExplainPreview {
  const allRows = rows || [];
  return buildCodexRoutePolicyExplainPreviewFromCandidates(allRows, buildCodexRoutePolicyPreview(allRows, policy), projectRule);
}

export function buildCodexRoutePolicyExplainPreviewFromCandidates<
  T extends {
    id: string;
    label?: string;
    provider?: string;
    requestable?: boolean;
    disabled?: boolean;
    blockReason?: string;
  },
>(
  rows: T[],
  policyPreview: T[],
  projectRule?: CodexRoutePolicyProjectRuleLike | null,
): CodexRoutePolicyExplainPreview {
  return buildCodexRoutePolicyExplainPreviewFromPolicyCandidates(rows, policyPreview, projectRule);
}

function buildCodexRoutePolicyExplainPreviewFromPolicyCandidates<
  T extends {
    id: string;
    label?: string;
    provider?: string;
    requestable?: boolean;
    disabled?: boolean;
    blockReason?: string;
  },
>(
  rows: T[],
  policyPreview: T[],
  projectRule?: CodexRoutePolicyProjectRuleLike | null,
): CodexRoutePolicyExplainPreview {
  const allRows = rows || [];
  const previewRows = policyPreview || [];
  const policyCandidateIDs = new Set(previewRows.map((row) => row.id));
  const channelOrderByID = new Map(allRows.map((row, index) => [row.id, index]));
  const baseCandidates = previewRows.map((row, index) => ({
    id: row.id,
    displayName: String(row.label || row.id),
    provider: String(row.provider || ''),
    routeOrder: index,
    channelOrder: channelOrderByID.get(row.id) ?? index,
  }));
  const projectKey = String(projectRule?.projectKey || '').trim();
  const projectAllowIDs = new Set(normalizeCodexAccountIDList(projectRule?.allowAccountIDs || []));
  const projectRuleMatched = Boolean(projectKey && projectAllowIDs.size > 0);
  const projectFiltered = projectRuleMatched
    ? baseCandidates
        .filter((candidate) => !projectAllowIDs.has(candidate.id))
        .map((candidate) => ({ id: candidate.id, reason: 'project-candidate-pool' }))
    : [];
  const candidates = projectRuleMatched ? baseCandidates.filter((candidate) => projectAllowIDs.has(candidate.id)) : baseCandidates;
  const filtered = allRows
    .filter((row) => !policyCandidateIDs.has(row.id))
    .map((row) => ({
      id: row.id,
      reason:
        row.requestable === false
          ? row.disabled
            ? 'account-disabled'
            : row.blockReason || 'account-unrequestable'
          : 'route-policy-excluded',
    }))
    .concat(projectFiltered);
  const projectCandidatePool = projectKey
    ? {
        evaluated: true,
        activated: projectRuleMatched,
        reason:
          projectRuleMatched
            ? candidates.length > 0
              ? 'project-candidate-pool:matched'
              : 'project-candidate-pool:no-routeable-account'
            : 'project-candidate-pool:not-matched',
        ruleID: String(projectRule?.id || ''),
        projectKey,
        projectName: String(projectRule?.projectName || ''),
        projectKeySource: String(projectRule?.projectKeySource || ''),
        projectKeyConfidence: String(projectRule?.projectKeyConfidence || ''),
        allowAccountIDs: [...projectAllowIDs],
        filteredAccountIDs: projectFiltered.map((item) => item.id),
        beforeCandidateCount: baseCandidates.length,
        afterCandidateCount: candidates.length,
      }
    : undefined;
  return {
    baseCandidates,
    candidates,
    filtered,
    projectCandidatePool,
  };
}

export function buildCodexRoutePolicyRowStates<T extends { id: string; requestable?: boolean }>(
  rows: T[],
  policy: CodexRoutePolicyDraft,
): Record<string, CodexRoutePolicyRowState> {
  const allow = new Set(normalizeCodexAccountIDList(policy.allowAccountIDs));
  const deny = new Set(normalizeCodexAccountIDList(policy.denyAccountIDs));
  const preview = buildCodexRoutePolicyPreview(rows, policy);
  const rankByID = new Map(preview.map((row, index) => [row.id, index + 1]));
  const out: Record<string, CodexRoutePolicyRowState> = {};

  for (const row of rows || []) {
    const id = String(row.id || '').trim();
    if (!id) {
      continue;
    }
    const previewRank = rankByID.get(id) || 0;
    let mode: CodexRoutePolicyRowMode = 'default';
    if (row.requestable === false) {
      mode = 'blocked';
    } else if (deny.has(id)) {
      mode = 'deny';
    } else if (allow.has(id)) {
      mode = 'allow';
    }
    out[id] = {
      mode,
      previewRank,
      participates: previewRank > 0,
    };
  }
  return out;
}

export function buildCodexRoutePolicySummary<T extends { id: string; requestable?: boolean }>(
  rows: T[],
  policy: CodexRoutePolicyDraft,
): CodexRoutePolicySummary {
  return {
    allowCount: normalizeCodexAccountIDList(policy.allowAccountIDs).length,
    denyCount: normalizeCodexAccountIDList(policy.denyAccountIDs).length,
    orderedCount: normalizeCodexAccountIDList(policy.orderAccountIDs).length,
    previewCount: buildCodexRoutePolicyPreview(rows, policy).length,
    fallbackEnabled: policy.allowFallback,
  };
}

export function normalizeCodexAccountIDList(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}
