import type { SessionFilter, SessionManagementSnapshot } from './model.ts';
import type { SessionDetailState } from './SessionManagementView.tsx';
import { SESSION_MANAGEMENT_EMPTY_VALUE } from './sessionManagementCopy.ts';

export const COMPACT_LAYOUT_MAX_WIDTH = 720;

export const EMPTY_SNAPSHOT: SessionManagementSnapshot = {
  stats: {
    projectCount: 0,
    sessionCount: 0,
    activeSessionCount: 0,
    archivedSessionCount: 0,
    lastScanAt: SESSION_MANAGEMENT_EMPTY_VALUE,
    providerSummary: SESSION_MANAGEMENT_EMPTY_VALUE,
  },
  projects: [],
};

export const INITIAL_DETAIL_STATE: SessionDetailState = {
  sessionID: null,
  detail: null,
  loading: false,
  refreshing: false,
  error: null,
};

export const sessionFilters: ReadonlyArray<{ id: SessionFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'session_management.filter_all' },
  { id: 'active', labelKey: 'session_management.filter_active' },
  { id: 'archived', labelKey: 'session_management.filter_archived' },
];

export function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function normalizeProviderInput(value: string | null | undefined, fallback: string) {
  const text = String(value || '').trim();
  if (!text || text === SESSION_MANAGEMENT_EMPTY_VALUE || text === fallback || text.toLowerCase() === 'unknown') {
    return 'unknown';
  }
  return text;
}
