import { main } from '../../../../wailsjs/go/models';
import type { QuotaUsageCalibration, QuotaUsageCalibrationInput } from '../../../types';

export type QuotaCalibrationMode = 'delta' | 'set-effective';
export type QuotaCalibrationMetric = 'tokens';

export interface BuildQuotaCalibrationInputOptions {
  accountKey: string;
  windowKey: string;
  value: number;
  mode?: QuotaCalibrationMode;
  metric?: QuotaCalibrationMetric;
  expiresAt?: string;
}

export function buildQuotaCalibrationInput(options: BuildQuotaCalibrationInputOptions): QuotaUsageCalibrationInput {
  return main.QuotaUsageCalibrationInput.createFrom({
    accountKey: String(options.accountKey || '').trim(),
    windowKey: String(options.windowKey || '').trim(),
    metric: options.metric || 'tokens',
    mode: options.mode || 'delta',
    value: Number.isFinite(options.value) ? options.value : 0,
    expiresAt: String(options.expiresAt || '').trim() || undefined,
  });
}

export function normalizeQuotaCalibrations(items: unknown): QuotaUsageCalibration[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => main.QuotaUsageCalibration.createFrom(item))
    .filter((item) => String(item.id || '').trim() && String(item.accountKey || '').trim());
}

export function isQuotaCalibrationActive(item: QuotaUsageCalibration, nowMs = Date.now()) {
  if (String(item.revokedAt || '').trim()) {
    return false;
  }
  const expiresAt = Date.parse(String(item.expiresAt || ''));
  return !Number.isFinite(expiresAt) || expiresAt > nowMs;
}
