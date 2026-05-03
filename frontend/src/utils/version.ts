const dateHourPattern =
  /^(?<year>\d{4})[./-]?(?<month>\d{2})[./-]?(?<day>\d{2})(?:[T\s_.:+/-]?(?<hour>\d{2}))(?:[:]\d{2}(?::\d{2})?)?/;
const semanticVersionPattern = /^v(?=\d+\.\d+\.\d+(?:$|[-+]))/i;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildDateHourLabel(date: Date): string {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}.${pad(date.getHours())}`;
}

export function formatSidebarVersion(version: string, now: Date = new Date()): string {
  const normalized = version.trim();

  if (!normalized || normalized === 'dev') {
    return buildDateHourLabel(now);
  }

  const match = normalized.match(dateHourPattern);
  if (match?.groups) {
    const { year, month, day, hour } = match.groups;
    if (year && month && day && hour) {
      return `${year}.${month}.${day}.${hour}`;
    }
  }

  return normalized;
}

export function formatAppVersion(version: string): string {
  const normalized = version.trim();

  if (!normalized) {
    return normalized;
  }

  return normalized.replace(semanticVersionPattern, '');
}
