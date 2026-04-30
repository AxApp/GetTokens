import { buildVendorStatusViewModel, type VendorStatusPageViewModel } from './model.ts';
import type { LocaleCode } from '../../types';

export const VENDOR_STATUS_CACHE_KEY = 'gettokens.vendorStatus.openai';
export const VENDOR_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedSummaryPayload = Parameters<typeof buildVendorStatusViewModel>[0];
type CachedImpactsPayload = Parameters<typeof buildVendorStatusViewModel>[1];

interface VendorStatusCachePayload {
  fetchedAtISO: string;
  summaryPayload: unknown;
  impactsPayload: unknown;
  rssXML: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readVendorStatusCache(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  locale: LocaleCode,
  now = new Date(),
): VendorStatusPageViewModel | null {
  const raw = storage?.getItem(VENDOR_STATUS_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as VendorStatusCachePayload;
    if (!isRecord(parsed)) {
      return null;
    }

    const fetchedAtISO = typeof parsed.fetchedAtISO === 'string' ? parsed.fetchedAtISO : '';
    const fetchedAt = Date.parse(fetchedAtISO);
    if (Number.isNaN(fetchedAt)) {
      return null;
    }

    if (now.getTime() - fetchedAt > VENDOR_STATUS_CACHE_TTL_MS) {
      return null;
    }

    const rssXML = typeof parsed.rssXML === 'string' ? parsed.rssXML : '';
    return buildVendorStatusViewModel(
      parsed.summaryPayload as any,
      parsed.impactsPayload as any,
      rssXML,
      new Date(fetchedAt),
      locale,
    );
  } catch {
    return null;
  }
}

export function persistVendorStatusCache(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  payload: {
    summaryPayload: unknown;
    impactsPayload: unknown;
    rssXML: string;
    fetchedAt: Date;
  },
): void {
  const cachePayload: VendorStatusCachePayload = {
    fetchedAtISO: payload.fetchedAt.toISOString(),
    summaryPayload: payload.summaryPayload,
    impactsPayload: payload.impactsPayload,
    rssXML: payload.rssXML,
  };

  storage?.setItem(VENDOR_STATUS_CACHE_KEY, JSON.stringify(cachePayload));
}
