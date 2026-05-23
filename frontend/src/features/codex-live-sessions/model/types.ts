export type CodexLiveSessionStatus =
  | 'active'
  | 'streaming'
  | 'reconnecting'
  | 'upstream_disconnected'
  | 'degraded_http'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CodexLiveTransport = 'websocket' | 'http' | 'unknown';

export type CodexLiveSessionSource = 'live' | 'cache' | 'preview' | 'unavailable';

export interface CodexLiveTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CodexLiveQuotaWindow {
  label: string;
  remaining?: number;
  limit?: number;
  remainingPercent?: number | null;
  resetLabel?: string;
  resetAtUnix?: number;
}

export interface CodexLiveBillingBalance {
  currency: string;
  totalBalance: number;
  grantedBalance: number;
  toppedUpBalance: number;
}

export interface CodexLiveErrorSummary {
  statusCode?: number;
  code?: string;
  message: string;
  retryable?: boolean;
}

export interface CodexLiveTimingMetrics {
  queueWaitMs?: number;
  authSelectMs?: number;
  upstreamConnectMs?: number;
  firstEventMs?: number;
  firstTokenMs?: number;
  averageEventGapMs?: number;
  longestEventGapMs?: number;
  streamDurationMs?: number;
  totalDurationMs?: number;
  reconnectCount?: number;
  outputTokensPerSecond?: number;
  totalTokensPerSecond?: number;
}

export interface CodexLiveTimelineEvent {
  id: string;
  at: string;
  lane: 'downstream' | 'sidecar' | 'upstream' | 'fallback';
  kind: string;
  label: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  detail?: string;
}

export interface CodexLiveRequest {
  requestID: string;
  clientRequestID?: string;
  upstreamRequestID?: string;
  sessionID: string;
  sequence: number;
  model: string;
  status: CodexLiveSessionStatus;
  startedAt: string;
  completedAt?: string;
  downstreamTransport: CodexLiveTransport;
  upstreamTransport: CodexLiveTransport;
  connectionReused?: boolean;
  authID?: string;
  authLabel?: string;
  provider?: string;
  proxyRoute?: string;
  usage?: CodexLiveTokenUsage;
  quota?: CodexLiveQuotaWindow[];
  billing?: CodexLiveBillingBalance[];
  timing?: CodexLiveTimingMetrics;
  error?: CodexLiveErrorSummary;
  timeline: CodexLiveTimelineEvent[];
}

export interface CodexLiveSession {
  sessionID: string;
  projectName?: string;
  executionSessionID?: string;
  downstreamSessionID?: string;
  codexWindowID?: string;
  status: CodexLiveSessionStatus;
  startedAt: string;
  lastEventAt: string;
  durationMs: number;
  requestCount: number;
  activeRequestID?: string;
  lastRequestID?: string;
  model: string;
  authID?: string;
  authLabel?: string;
  provider?: string;
  downstreamTransport: CodexLiveTransport;
  upstreamTransport: CodexLiveTransport;
  fallbackInferred?: boolean;
  fallbackConfidence?: 'high' | 'medium' | 'low';
  fallbackReason?: string;
  recentEvents: CodexLiveTimelineEvent[];
  requests: CodexLiveRequest[];
}

export interface CodexLiveSessionSummary {
  activeSessions: number;
  activeRequests: number;
  websocketSessions: number;
  httpSessions: number;
  degradedSessions: number;
  errorSessions: number;
}

export interface CodexLiveSessionSnapshot {
  generatedAt: string;
  sidecarReady: boolean;
  source: CodexLiveSessionSource;
  retentionLabel: string;
  summary: CodexLiveSessionSummary;
  sessions: CodexLiveSession[];
}

export type CodexLiveSessionFilter = 'all' | 'active' | 'reconnecting' | 'degraded_http' | 'failed' | 'completed';
export type CodexLiveTransportFilter = 'all' | CodexLiveTransport;
