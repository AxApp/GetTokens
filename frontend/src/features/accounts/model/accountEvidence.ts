import type { AccountUsageSummary } from './accountUsage';
import type { AccountRecord, Translator } from './types';

export interface AccountEvidenceRow {
  label: string;
  value: string;
  title?: string;
}

export function buildAccountEvidenceRows(
  t: Translator,
  account: AccountRecord,
  usageSummary?: AccountUsageSummary,
): AccountEvidenceRow[] {
  const rows: AccountEvidenceRow[] = [
    {
      label: t('accounts.card_asset'),
      value: account.id,
      title: account.id,
    },
    {
      label: t('accounts.card_source_type'),
      value: resolveEvidenceSource(usageSummary),
    },
    {
      label: t('accounts.card_last_hit'),
      value: formatEvidenceTimestamp(usageSummary?.lastActivityAt ?? null),
    },
  ];

  if (usageSummary?.attributionKey) {
    rows.splice(2, 0, {
      label: t('accounts.card_attribution_key'),
      value: usageSummary.attributionKey,
      title: usageSummary.attributionKey,
    });
  }

  const formatBaseUrls = account.formatBaseUrls;
  if (formatBaseUrls && Object.keys(formatBaseUrls).length > 0) {
    for (const [format, url] of Object.entries(formatBaseUrls)) {
      if (!url) continue;
      rows.push({
        label: `ENDPOINT · ${format.toUpperCase()}`,
        value: url,
        title: url,
      });
    }
  }

  return rows;
}

export function formatEvidenceTimestamp(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}

function resolveEvidenceSource(usageSummary?: AccountUsageSummary) {
  if (usageSummary?.source === 'attribution') {
    return 'ATTRIBUTION';
  }
  if (usageSummary?.source === 'legacy') {
    return 'LEGACY';
  }
  return 'NONE';
}
