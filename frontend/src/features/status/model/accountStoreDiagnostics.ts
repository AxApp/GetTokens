import type { main } from '../../../../wailsjs/go/models';
import { buildRuntimeWarningDisplay } from '../../accounts/model/runtimeWarning.ts';

export type AccountStoreDiagnosticsTone = 'success' | 'warning' | 'critical' | 'muted';

export interface AccountStoreDiagnosticsView {
  tone: AccountStoreDiagnosticsTone;
  headline: string;
  recoveryLine: string;
  errorSummary: string;
  fullError: string;
}

export function buildAccountStoreDiagnosticsView(
  diagnostics: main.AccountStoreDiagnostics | null | undefined,
): AccountStoreDiagnosticsView {
  if (!diagnostics) {
    return {
      tone: 'muted',
      headline: 'UNAVAILABLE',
      recoveryLine: 'WAITING FOR SIDECAR',
      errorSummary: '',
      fullError: '',
    };
  }

  const basename = basenameOnly(diagnostics.pathBasename) || 'accounts-v1.sqlite';
  const recovery = diagnostics.readRecovery;
  const count = Math.max(0, Number(recovery?.count || 0));
  const lastRecovered = Boolean(recovery?.lastRecovered);
  const endpoint = String(recovery?.lastEndpoint || '').trim() || 'unknown';
  const fullError = String(recovery?.lastError || '').trim();
  const warning = buildRuntimeWarningDisplay(fullError, undefined, { friendly: false });
  const statusLabel = diagnostics.open ? 'OPEN' : diagnostics.configured ? 'CLOSED' : 'UNCONFIGURED';
  const tone: AccountStoreDiagnosticsTone = count === 0
    ? diagnostics.open ? 'success' : 'muted'
    : lastRecovered
      ? 'warning'
      : 'critical';

  return {
    tone,
    headline: `${statusLabel} · ${basename}`,
    recoveryLine: count === 0
      ? 'NO RECOVERY EVENTS'
      : `${lastRecovered ? 'RECOVERED' : 'FAILED'} · ${endpoint} · #${count}`,
    errorSummary: warning.summary,
    fullError: warning.full,
  };
}

function basenameOnly(path: string | undefined | null) {
  const value = String(path || '').trim().replace(/\\/g, '/');
  if (!value) return '';
  return value.split('/').filter(Boolean).pop() || value;
}
