export function resolveQuotaRemainingFillClass(remainingPercent: number) {
  const value = Number.isFinite(remainingPercent)
    ? Math.max(0, Math.min(100, remainingPercent))
    : 0;

  if (value <= 20) {
    return 'bg-[var(--color-status-danger)]';
  }

  if (value <= 50) {
    return 'bg-[var(--color-status-warning)]';
  }

  return 'bg-[var(--color-status-success)]';
}
