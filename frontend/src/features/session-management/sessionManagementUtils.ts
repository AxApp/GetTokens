import type { SessionFilter, SessionManagementSnapshot } from './model.ts';
import type { SessionDetailState } from './SessionManagementView.tsx';
import { SESSION_MANAGEMENT_EMPTY_VALUE } from './sessionManagementCopy.ts';

export const COMPACT_LAYOUT_MAX_WIDTH = 720;
export const SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH = 560;
export const SESSIONS_PANEL_COMPACT_META_MAX_WIDTH = 640;

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

export function shouldUseSessionsPanelActionMenu(panelWidth: number) {
  return Number.isFinite(panelWidth) && panelWidth > 0 && panelWidth <= SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH;
}

export function shouldUseCompactSessionMetadata(panelWidth: number) {
  return Number.isFinite(panelWidth) && panelWidth > 0 && panelWidth <= SESSIONS_PANEL_COMPACT_META_MAX_WIDTH;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

export function formatSessionMetadataDate(value: string, now: Date = new Date()) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) {
    return text || SESSION_MANAGEMENT_EMPTY_VALUE;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return text;
  }

  const dateLabel = `${pad2(month)}/${pad2(day)}`;
  return year === now.getFullYear() ? dateLabel : `${year}/${dateLabel}`;
}
