interface CodexLivePollingInput {
  browserMode: boolean;
  sidecarReady: boolean;
  hidden: boolean;
  activeSessionCount: number;
}

interface CodexLiveDetailPollingInput {
  browserMode: boolean;
  sidecarReady: boolean;
  hidden: boolean;
  hasSelection: boolean;
}

const ACTIVE_POLL_INTERVAL_MS = 2000;
const IDLE_POLL_INTERVAL_MS = 8000;
const HIDDEN_POLL_INTERVAL_MS = 30000;
const DETAIL_POLL_INTERVAL_MS = 4000;
const BROWSER_PREVIEW_POLL_INTERVAL_MS = 1000;

export function resolveCodexLiveSessionsPollIntervalMs(input: CodexLivePollingInput): number | null {
  if (input.browserMode) {
    return input.hidden ? HIDDEN_POLL_INTERVAL_MS : BROWSER_PREVIEW_POLL_INTERVAL_MS;
  }
  if (!input.sidecarReady) {
    return null;
  }
  if (input.hidden) {
    return HIDDEN_POLL_INTERVAL_MS;
  }
  return input.activeSessionCount > 0 ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
}

export function resolveCodexLiveSessionDetailPollIntervalMs(input: CodexLiveDetailPollingInput): number | null {
  if (!input.hasSelection) {
    return null;
  }
  if (input.browserMode) {
    return null;
  }
  if (!input.sidecarReady) {
    return null;
  }
  if (input.hidden) {
    return HIDDEN_POLL_INTERVAL_MS;
  }
  return DETAIL_POLL_INTERVAL_MS;
}
