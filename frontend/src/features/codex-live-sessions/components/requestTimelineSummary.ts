import type { CodexLiveRequest, CodexLiveTimelineEvent } from '../model/types.ts';
import { formatOptionalDuration } from './formatters.ts';
import type { Translate } from './types.ts';

export interface RequestTimelineSummary {
  requestID: string;
  sequenceLabel: string;
  modelLabel: string;
  startedAtLabel: string;
  completedAtLabel: string;
  totalDurationLabel: string;
  ttftLabel: string;
  firstTokenLabel: string;
  streamDurationLabel: string;
  averageGapLabel: string;
  longestGapLabel: string;
}

export interface FallbackTimelineSummary {
  requestID: string;
  sequenceLabel: string;
  modelLabel: string;
  startedAtLabel: string;
  completedAtLabel: string;
  totalDurationLabel: string;
  ttftLabel: string;
  firstTokenLabel: string;
  streamDurationLabel: string;
  averageGapLabel: string;
  longestGapLabel: string;
}

interface TimelineSummaryOptions {
  now?: Date;
}

export function buildRequestTimelineSummary(request: CodexLiveRequest, options: TimelineSummaryOptions = {}): RequestTimelineSummary {
  return {
    requestID: request.requestID,
    sequenceLabel: `#${request.sequence}`,
    modelLabel: request.model,
    startedAtLabel: formatTimelineTimeLabel(request.startedAt, options.now),
    completedAtLabel: formatTimelineTimeLabel(request.completedAt || '-', options.now),
    totalDurationLabel: formatOptionalDuration(request.timing?.totalDurationMs),
    ttftLabel: formatOptionalDuration(request.timing?.firstEventMs),
    firstTokenLabel: formatOptionalDuration(request.timing?.firstTokenMs),
    streamDurationLabel: formatOptionalDuration(request.timing?.streamDurationMs),
    averageGapLabel: formatOptionalDuration(request.timing?.averageEventGapMs),
    longestGapLabel: formatOptionalDuration(request.timing?.longestEventGapMs),
  };
}

export function buildFallbackTimelineSummary(
  events: readonly CodexLiveTimelineEvent[],
  t: Translate,
  options: TimelineSummaryOptions = {},
): FallbackTimelineSummary {
  return {
    requestID: t('codex_live_sessions.unknown_request'),
    sequenceLabel: '-',
    modelLabel: '-',
    startedAtLabel: formatTimelineTimeLabel(events[0]?.at || '-', options.now),
    completedAtLabel: formatTimelineTimeLabel(events[events.length - 1]?.at || '-', options.now),
    totalDurationLabel: 'n/a',
    ttftLabel: 'n/a',
    firstTokenLabel: 'n/a',
    streamDurationLabel: 'n/a',
    averageGapLabel: 'n/a',
    longestGapLabel: 'n/a',
  };
}

export function formatTimelineTimeLabel(value: string, _now = new Date()): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '-';
  }

  const datedTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (datedTime) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatClockTime(parsed);
    }
    return datedTime[2];
  }

  const clockTime = trimmed.match(/^(\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
  if (clockTime) {
    return clockTime[1];
  }

  return trimmed;
}

export function formatTimelineRequestID(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '-';
  }

  const reqMatch = trimmed.match(/(?:^|[-_])req[-_]([a-z0-9]+)$/i);
  if (reqMatch) {
    return `REQ-${reqMatch[1].toUpperCase()}`;
  }

  if (trimmed.length <= 14) {
    return trimmed;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
