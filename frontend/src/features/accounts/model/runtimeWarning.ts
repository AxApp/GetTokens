export interface RuntimeWarningDisplay {
  summary: string;
  full: string;
}

const DEFAULT_RUNTIME_WARNING_SUMMARY_LIMIT = 96;

export interface RuntimeWarningDisplayOptions {
  friendly?: boolean;
}

export function buildRuntimeWarningDisplay(
  reason: string | undefined | null,
  limit = DEFAULT_RUNTIME_WARNING_SUMMARY_LIMIT,
  options: RuntimeWarningDisplayOptions = {},
): RuntimeWarningDisplay {
  const full = String(reason || '').trim();
  if (!full) {
    return { summary: '', full: '' };
  }

  const friendlySummary = options.friendly === false ? '' : resolveFriendlyRuntimeWarningSummary(full);
  if (friendlySummary) {
    return { summary: friendlySummary, full };
  }

  const normalized = full.replace(/\s+/g, ' ');
  const maxLength = Math.max(8, Math.floor(limit));
  if (normalized.length <= maxLength) {
    return { summary: normalized, full };
  }

  return {
    summary: `${trimRuntimeWarningFragment(normalized.slice(0, Math.max(1, maxLength - 1)))}…`,
    full,
  };
}

function trimRuntimeWarningFragment(value: string) {
  let fragment = value.trimEnd();
  const openParen = fragment.lastIndexOf('(');
  const closeParen = fragment.lastIndexOf(')');
  if (openParen > closeParen && openParen > 0) {
    fragment = fragment.slice(0, openParen).trimEnd();
  }

  const lastSpace = fragment.lastIndexOf(' ');
  if (lastSpace > 0 && /[A-Za-z0-9_-]$/.test(fragment) && /[A-Za-z0-9_-]/.test(fragment[lastSpace + 1] || '')) {
    const tail = fragment.slice(lastSpace + 1);
    if (tail.length <= 4) {
      fragment = fragment.slice(0, lastSpace).trimEnd();
    }
  }

  return fragment || value.slice(0, Math.max(1, value.length - 1)).trimEnd();
}


function resolveFriendlyRuntimeWarningSummary(reason: string) {
  const normalized = reason.replace(/\s+/g, ' ');
  if (
    /account_store_io_error/i.test(normalized) ||
    /disk I\/O error \(522\)/i.test(normalized) ||
    /SQLITE_IOERR_SHORT_READ/i.test(normalized)
  ) {
    return '账号库读取异常，正在使用上次额度快照';
  }
  return '';
}
