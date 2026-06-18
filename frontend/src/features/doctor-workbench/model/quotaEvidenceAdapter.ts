import {
  resolveExplicitQuotaFactDisplay,
} from '../../accounts/model/accountQuota.ts';
import type { QuotaFactDisplay } from '../../accounts/model/types';

interface DoctorQuotaFactEvidencePayload {
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

interface DoctorQuotaEvidenceRef {
  source: string;
  summary: string;
  quotaFact?: Readonly<DoctorQuotaFactEvidencePayload>;
}

interface DoctorQuotaCheckRef {
  id: string;
  kind: string;
}

export function deriveQuotaFactFromDoctorEvidence(
  check: DoctorQuotaCheckRef,
  evidence: DoctorQuotaEvidenceRef,
): QuotaFactDisplay | undefined {
  const isQuotaCheck = check.kind === 'quota-runtime-fact' || check.id === 'quota_facts';
  if (!isQuotaCheck) {
    return undefined;
  }

  return resolveExplicitQuotaFactDisplay(evidence, {
    sourceFallback: evidence.source,
    explanationFallback: evidence.summary,
  });
}
