export function resolveQuotaRemainingFillClass(remainingPercent: number) {
  const value = Number.isFinite(remainingPercent)
    ? Math.max(0, Math.min(100, remainingPercent))
    : 0;

  if (value <= 20) {
    return 'bg-[var(--gt-status-danger)]';
  }

  if (value <= 50) {
    return 'bg-[var(--gt-status-warning)]';
  }

  return 'bg-[var(--gt-status-success)]';
}
