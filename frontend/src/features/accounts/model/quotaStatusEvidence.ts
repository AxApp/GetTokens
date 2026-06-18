import type { UsageDeskWorkspace } from '../../../types';
import { buildQuotaFactEvidenceView, resolveExplicitQuotaFactDisplay } from './accountQuota.ts';
import type { QuotaFactEvidenceView } from './types.ts';

export interface QuotaStatusEvidence {
  title: string;
  summary: string;
  view: QuotaFactEvidenceView;
}

function resolveQuotaStatusEvidenceTitle(workspace: UsageDeskWorkspace) {
  return workspace === 'claude' ? 'Claude 配额事实' : 'Codex 配额事实';
}

export function resolveQuotaStatusEvidenceFromPayload(
  payload: unknown,
  workspace: UsageDeskWorkspace,
): QuotaStatusEvidence | undefined {
  const fact = resolveExplicitQuotaFactDisplay(payload);
  const view = buildQuotaFactEvidenceView(fact);
  if (!view) {
    return undefined;
  }

  return {
    title: resolveQuotaStatusEvidenceTitle(workspace),
    summary: view.summary,
    view,
  };
}
