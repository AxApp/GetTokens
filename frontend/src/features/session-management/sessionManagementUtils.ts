import type { SessionFilter, SessionManagementSnapshot } from './model.ts';
import type { SessionDetailState } from './SessionManagementView.tsx';
import { SESSION_MANAGEMENT_EMPTY_VALUE } from './sessionManagementCopy.ts';

export const COMPACT_LAYOUT_MAX_WIDTH = 720;
export const SESSIONS_PANEL_ACTIONS_MENU_MAX_WIDTH = 560;
export const SESSIONS_PANEL_COMPACT_META_MAX_WIDTH = 640;
export const SESSION_LIST_ROW_HEIGHT = 76;
export const SESSION_LIST_OVERSCAN_ROWS = 8;
export const SESSION_LIST_MIN_RENDERED_ROWS = 40;

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
  messagePageLoading: false,
  messagePageError: null,
  hasMoreMessages: false,
  nextMessageOffset: 0,
  rawJSONByMessageID: {},
  rawJSONLoadingMessageID: null,
  rawJSONError: null,
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

export interface SessionListRenderWindowInput {
  total: number;
  scrollTop: number;
  viewportHeight: number;
  rowHeight?: number;
  overscanRows?: number;
  minRenderedRows?: number;
}

export interface SessionListRenderWindow {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
  rowHeight: number;
  isWindowed: boolean;
}

export function resolveSessionListRenderWindow({
  total,
  scrollTop,
  viewportHeight,
  rowHeight = SESSION_LIST_ROW_HEIGHT,
  overscanRows = SESSION_LIST_OVERSCAN_ROWS,
  minRenderedRows = SESSION_LIST_MIN_RENDERED_ROWS,
}: SessionListRenderWindowInput): SessionListRenderWindow {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const safeRowHeight = Math.max(1, Math.floor(Number.isFinite(rowHeight) ? rowHeight : SESSION_LIST_ROW_HEIGHT));
  const safeOverscanRows = Math.max(0, Math.floor(Number.isFinite(overscanRows) ? overscanRows : SESSION_LIST_OVERSCAN_ROWS));
  const safeMinRenderedRows = Math.max(1, Math.floor(Number.isFinite(minRenderedRows) ? minRenderedRows : SESSION_LIST_MIN_RENDERED_ROWS));

  if (safeTotal <= safeMinRenderedRows) {
    return {
      startIndex: 0,
      endIndex: safeTotal,
      paddingTop: 0,
      paddingBottom: 0,
      rowHeight: safeRowHeight,
      isWindowed: false,
    };
  }

  const safeScrollTop = Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0);
  const safeViewportHeight = Math.max(0, Number.isFinite(viewportHeight) ? viewportHeight : 0);
  const firstVisibleIndex = Math.max(0, Math.floor(safeScrollTop / safeRowHeight));
  const visibleRows = Math.max(1, Math.ceil(safeViewportHeight / safeRowHeight));
  const renderCount = Math.max(safeMinRenderedRows, visibleRows + safeOverscanRows * 2);
  const maxStart = Math.max(0, safeTotal - renderCount);
  const startIndex = Math.min(maxStart, Math.max(0, firstVisibleIndex - safeOverscanRows));
  const endIndex = Math.min(safeTotal, startIndex + renderCount);

  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * safeRowHeight,
    paddingBottom: Math.max(0, safeTotal - endIndex) * safeRowHeight,
    rowHeight: safeRowHeight,
    isWindowed: true,
  };
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
