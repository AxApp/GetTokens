import type { SidecarStatus } from '../../types';

export type AccountMigrationStatus = 'needs-migration' | 'ready-to-delete-legacy' | 'ready' | 'empty' | string;

export interface AccountMigrationPreview {
  status: AccountMigrationStatus;
  accountCount?: number;
  candidateCount?: number;
  kindSummary?: Array<{ kind: string; count: number }>;
  warnings?: string[];
  generatedAtUnixMs?: number;
  backupHint?: string;
}

export function shouldCheckAccountMigration(sidecarStatus: SidecarStatus, hasWailsBindings: boolean) {
  return hasWailsBindings && sidecarStatus?.code === 'ready';
}

export function shouldShowAccountMigrationGate(preview: AccountMigrationPreview | null) {
  return preview?.status === 'needs-migration' || preview?.status === 'ready-to-delete-legacy';
}

export function canCommitAccountMigration(preview: AccountMigrationPreview | null, busy: boolean) {
  return (
    !busy &&
    (preview?.status === 'needs-migration' || preview?.status === 'ready-to-delete-legacy') &&
    Number(preview?.candidateCount ?? 0) > 0
  );
}

export function canDeleteLegacyAccountSources(preview: AccountMigrationPreview | null, busy: boolean) {
  return (
    !busy &&
    preview?.status === 'ready-to-delete-legacy' &&
    Number(preview?.accountCount ?? 0) > 0 &&
    Number(preview?.candidateCount ?? 0) > 0
  );
}

export function formatAccountMigrationKind(kind: string) {
  switch (kind) {
    case 'auth-file':
      return 'Auth File';
    case 'codex-api-key':
      return 'Codex API Key';
    case 'openai-compatible':
      return 'OpenAI Compatible';
    default:
      return kind || 'Unknown';
  }
}

export function resolveAccountMigrationStepState(preview: AccountMigrationPreview | null) {
  if (!preview) {
    return {
      inspect: 'active',
      commit: 'pending',
      cleanup: 'pending',
    } as const;
  }
  if (preview.status === 'needs-migration' || preview.status === 'ready-to-delete-legacy') {
    return {
      inspect: 'done',
      commit: 'active',
      cleanup: 'pending',
    } as const;
  }
  return {
    inspect: 'done',
    commit: 'done',
    cleanup: 'done',
  } as const;
}
