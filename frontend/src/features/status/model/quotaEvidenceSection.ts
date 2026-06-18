import type { UsageDeskWorkspace } from '../../../types';
import { resolveQuotaStatusEvidenceFromPayload } from '../../accounts/model/quotaStatusEvidence.ts';
import type { QuotaStatusEvidence } from '../../accounts/model/quotaStatusEvidence.ts';

export interface StatusQuotaEvidenceItem {
  accountKey: string;
  updatedAt?: string;
  evidence: QuotaStatusEvidence;
}

export interface StatusQuotaEvidenceNotice {
  eyebrow: string;
  title: string;
  description: string;
  accountKeys?: string[];
  unscopedMissingFactCount: number;
  unscopedMissingFactSamples?: string[];
}

export interface StatusQuotaEvidenceSectionState {
  items: StatusQuotaEvidenceItem[];
  notice?: StatusQuotaEvidenceNotice;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const MAX_UNSCOPED_MISSING_FACT_SAMPLES = 5;
const SAFE_UNSCOPED_TRACE_FIELDS = ['source', 'status', 'updatedAt', 'provider'] as const;

function readTraceValue(payload: Record<string, unknown>, key: (typeof SAFE_UNSCOPED_TRACE_FIELDS)[number]): string {
  const value = payload[key];
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim().slice(0, 80);
}

function buildUnscopedMissingFactSampleLabel(payload: Record<string, unknown>, payloadIndex: number): string {
  const parts = [`payload #${payloadIndex}`];
  for (const key of SAFE_UNSCOPED_TRACE_FIELDS) {
    const value = readTraceValue(payload, key);
    if (value) {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join(' · ');
}

function buildNonAuthoritativeNotice(
  accountKeys: readonly string[],
  unscopedMissingFactCount: number,
  unscopedMissingFactSamples: readonly string[] = [],
): StatusQuotaEvidenceNotice {
  const uniqueAccountKeys = Array.from(
    new Set(accountKeys.map((value) => value.trim()).filter(Boolean)),
  );
  const missingCount = uniqueAccountKeys.length;
  const titleSuffix = missingCount > 0 ? ` for ${missingCount} account${missingCount === 1 ? '' : 's'}` : '';

  return {
    eyebrow: 'NON-AUTHORITATIVE',
    title: `Quota authority unavailable${titleSuffix}`,
    description:
      'Some status payloads did not include explicit quotaFact. This page does not infer authority from windows, block reasons, or usage totals.',
    unscopedMissingFactCount,
    ...(uniqueAccountKeys.length > 0 ? { accountKeys: uniqueAccountKeys } : {}),
    ...(unscopedMissingFactSamples.length > 0
      ? { unscopedMissingFactSamples: Array.from(unscopedMissingFactSamples) }
      : {}),
  };
}

export function buildStatusQuotaEvidenceSectionState(
  statuses: readonly unknown[],
  workspace: UsageDeskWorkspace = 'codex',
): StatusQuotaEvidenceSectionState {
  let sawPayload = false;
  const items: StatusQuotaEvidenceItem[] = [];
  const missingFactAccountKeys: string[] = [];
  let unscopedMissingFactCount = 0;
  const unscopedMissingFactSamples: string[] = [];

  for (const [index, status] of statuses.entries()) {
    if (!isRecord(status)) {
      continue;
    }

    sawPayload = true;
    const accountKey = String(status.accountKey ?? '').trim();
    const evidence = resolveQuotaStatusEvidenceFromPayload(status, workspace);
    if (!evidence) {
      if (accountKey) {
        missingFactAccountKeys.push(accountKey);
      } else {
        unscopedMissingFactCount += 1;
        if (unscopedMissingFactSamples.length < MAX_UNSCOPED_MISSING_FACT_SAMPLES) {
          unscopedMissingFactSamples.push(buildUnscopedMissingFactSampleLabel(status, index + 1));
        }
      }
      continue;
    }

    items.push({
      accountKey,
      updatedAt: String(status.updatedAt ?? '').trim() || undefined,
      evidence,
    });
  }

  if (items.length > 0 && missingFactAccountKeys.length === 0) {
    if (unscopedMissingFactCount === 0) {
      return { items };
    }
    return {
      items,
      notice: buildNonAuthoritativeNotice(
        missingFactAccountKeys,
        unscopedMissingFactCount,
        unscopedMissingFactSamples,
      ),
    };
  }

  if (!sawPayload) {
    return { items };
  }

  return {
    items,
    notice: buildNonAuthoritativeNotice(
      missingFactAccountKeys,
      unscopedMissingFactCount,
      unscopedMissingFactSamples,
    ),
  };
}
