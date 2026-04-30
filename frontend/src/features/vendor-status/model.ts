import type { LocaleCode } from '../../types';

export type VendorStatusKind =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown';

export interface VendorStatusSegment {
  dayKey: string;
  status: VendorStatusKind;
}

export interface VendorStatusGroupViewModel {
  id: string;
  name: string;
  componentCount: number;
  uptimeLabel: string;
  status: VendorStatusKind;
  affectedComponentNames: string[];
  segments: VendorStatusSegment[];
  components: VendorStatusComponentViewModel[];
}

export interface VendorStatusComponentViewModel {
  id: string;
  name: string;
  status: VendorStatusKind;
  uptimeLabel: string;
  segments: VendorStatusSegment[];
}

export interface VendorIncidentViewModel {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  publishedLabel: string;
  metaLabel: string;
  status: string;
  statusLabel: string;
  body: string;
  affectedComponents: string[];
  scopeLabel: string;
}

export interface VendorStatusPageViewModel {
  vendorName: string;
  publicUrl: string;
  subscribeUrl: string;
  historyUrl: string;
  historyRangeLabel: string;
  lastSyncLabel: string;
  feedUpdatedLabel: string;
  activeIncidentCount: number;
  heroIncident: VendorIncidentViewModel | null;
  groups: VendorStatusGroupViewModel[];
  recentIncidents: VendorIncidentViewModel[];
}

interface SummaryComponent {
  id: string;
  name: string;
}

interface SummaryAffectedComponent {
  component_id: string;
  status: string;
}

interface SummaryOngoingIncident {
  id: string;
  name: string;
  status: string;
  published_at: string;
  affected_components?: Array<{
    component_id: string;
    status: string;
  }>;
  updates?: Array<{
    message_string?: string;
    to_status?: string;
  }>;
}

interface SummaryStructureGroupComponent {
  component_id: string;
  name: string;
}

interface SummaryStructureGroup {
  id: string;
  name: string;
  components: SummaryStructureGroupComponent[];
}

interface SummaryStructure {
  items?: Array<{
    group?: SummaryStructureGroup;
  }>;
}

interface SummaryPayload {
  summary: {
    name?: string;
    public_url?: string;
    components?: SummaryComponent[];
    affected_components?: SummaryAffectedComponent[];
    ongoing_incidents?: SummaryOngoingIncident[];
    structure?: SummaryStructure;
  };
}

interface ComponentImpactRecord {
  component_id?: string;
  status_page_incident_id?: string;
  status?: string;
  start_at?: string;
  end_at?: string;
}

interface ComponentUptimeRecord {
  component_id?: string;
  status_page_component_group_id?: string;
  uptime?: string;
}

interface IncidentLinkRecord {
  id?: string;
  name?: string;
  permalink?: string;
  published_at?: string;
  status?: string;
}

interface ComponentImpactsPayload {
  incident_links?: IncidentLinkRecord[];
  component_impacts?: ComponentImpactRecord[];
  component_uptimes?: ComponentUptimeRecord[];
}

interface ParsedRssIncident {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  status: string;
  statusLabel: string;
  body: string;
  affectedComponents: string[];
}

const STATUS_PRIORITY: Record<VendorStatusKind, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded_performance: 3,
  partial_outage: 4,
  major_outage: 5,
};

const RSS_ITEM_PATTERN = /<item>([\s\S]*?)<\/item>/gi;

function normalizeComponentLabel(value: string) {
  return normalizeWhitespace(value.replace(/\s+\(([^)]+)\)$/, ''));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTagValue(block: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  return match ? decodeEntities(match[1]).trim() : '';
}

function stripTags(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n');
}

export function normalizeVendorStatus(rawStatus: string): VendorStatusKind {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (value === 'operational') return 'operational';
  if (value === 'degraded_performance' || value === 'degraded performance') return 'degraded_performance';
  if (value === 'partial_outage' || value === 'partial outage') return 'partial_outage';
  if (value === 'major_outage' || value === 'major outage' || value === 'full_outage' || value === 'full outage') {
    return 'major_outage';
  }
  if (value === 'maintenance' || value === 'planned_maintenance' || value === 'planned maintenance') return 'maintenance';
  return 'unknown';
}

export function formatStatusLabel(rawStatus: string) {
  const value = String(rawStatus || '').trim();
  if (!value) {
    return 'Unknown';
  }
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function pickWorseStatus(left: VendorStatusKind, right: VendorStatusKind) {
  return STATUS_PRIORITY[right] > STATUS_PRIORITY[left] ? right : left;
}

export function parseIncidentMarkup(markup: string) {
  const decoded = decodeEntities(markup);
  const statusMatch = decoded.match(/<b>\s*Status:\s*([^<]+)<\/b>/i);
  const statusLabel = statusMatch ? normalizeWhitespace(statusMatch[1]) : 'Unknown';
  const affectedBlockMatch = decoded.match(/<b>\s*Affected components\s*<\/b>([\s\S]*)$/i);
  const affectedComponents = affectedBlockMatch
    ? Array.from(affectedBlockMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/gi), (match) => normalizeWhitespace(stripTags(match[1])))
    : [];

  let bodyBlock = decoded.replace(/<b>\s*Status:\s*[^<]+<\/b>/i, '').trim();
  bodyBlock = bodyBlock.replace(/<b>\s*Affected components\s*<\/b>[\s\S]*$/i, '').trim();

  return {
    status: statusLabel.toLowerCase().replace(/\s+/g, '_'),
    statusLabel,
    body: normalizeWhitespace(stripTags(bodyBlock)),
    affectedComponents,
  };
}

export function parseOpenAIStatusRSS(xml: string): ParsedRssIncident[] {
  const items = Array.from(xml.matchAll(RSS_ITEM_PATTERN));
  return items.map((match, index) => {
    const block = match[1];
    const title = stripTags(extractTagValue(block, 'title'));
    const link = stripTags(extractTagValue(block, 'link'));
    const guid = stripTags(extractTagValue(block, 'guid'));
    const publishedAt = stripTags(extractTagValue(block, 'pubDate'));
    const description = extractTagValue(block, 'content:encoded') || extractTagValue(block, 'description');
    const parsed = parseIncidentMarkup(description);

    return {
      id: guid || link || `rss-${index}`,
      title,
      link: link || guid,
      publishedAt,
      status: parsed.status,
      statusLabel: parsed.statusLabel,
      body: parsed.body,
      affectedComponents: parsed.affectedComponents,
    };
  });
}

function parseDateValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function resolveIntlLocale(locale: LocaleCode) {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

function formatShortDateTime(value: string, locale: LocaleCode) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return '--';
  }
  const intlLocale = resolveIntlLocale(locale);
  return new Intl.DateTimeFormat(intlLocale, locale === 'zh'
    ? {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    : {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(parsed);
}

function formatShortDate(value: string, locale: LocaleCode) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return '--';
  }
  const intlLocale = resolveIntlLocale(locale);
  return new Intl.DateTimeFormat(intlLocale, locale === 'zh'
    ? {
        month: 'numeric',
        day: 'numeric',
      }
    : {
        month: 'short',
        day: 'numeric',
      }).format(parsed);
}

function extractRSSLastBuildDate(xml: string) {
  const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i);
  if (!channelMatch) {
    return '';
  }
  return stripTags(extractTagValue(channelMatch[1], 'lastBuildDate'));
}

function formatMonthRangeLabel(startAt: Date, endAt: Date, locale: LocaleCode) {
  const intlLocale = resolveIntlLocale(locale);
  const start = new Intl.DateTimeFormat(intlLocale, locale === 'zh'
    ? { year: 'numeric', month: 'numeric' }
    : { month: 'short', year: 'numeric' }).format(startAt);
  const end = new Intl.DateTimeFormat(intlLocale, locale === 'zh'
    ? { year: 'numeric', month: 'numeric' }
    : { month: 'short', year: 'numeric' }).format(endAt);
  if (locale !== 'zh') {
    return `${start.toUpperCase()} - ${end.toUpperCase()}`;
  }
  return `${start} - ${end}`;
}

function formatRelativeDuration(fromValue: string, now: Date, locale: LocaleCode) {
  const parsed = parseDateValue(fromValue);
  if (!parsed) {
    return '';
  }
  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 24) {
    const diffDays = Math.floor(diffHours / 24);
    return locale === 'zh' ? `已持续 ${diffDays} 天` : `${diffDays}d ongoing`;
  }
  if (diffHours >= 1) {
    return locale === 'zh' ? `已持续 ${diffHours} 小时` : `${diffHours}h ongoing`;
  }
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return locale === 'zh' ? `已持续 ${diffMinutes} 分钟` : `${diffMinutes}m ongoing`;
}

function formatUptimeLabel(uptime: string | undefined, locale: LocaleCode) {
  const value = uptime || '100.00';
  return locale === 'zh' ? `${value}% 可用率` : `${value}% uptime`;
}

function buildAffectedComponentMaps(summary: SummaryPayload['summary']) {
  const componentNameById = new Map<string, string>();
  const groupNameByComponentId = new Map<string, string>();
  const groupComponentsByGroupId = new Map<string, string[]>();

  for (const component of summary.components || []) {
    if (component?.id) {
      componentNameById.set(component.id, component.name || component.id);
    }
  }

  for (const item of summary.structure?.items || []) {
    if (!item.group) {
      continue;
    }
    const componentIDs = item.group.components.map((component) => component.component_id);
    groupComponentsByGroupId.set(item.group.id, componentIDs);
    for (const component of item.group.components) {
      groupNameByComponentId.set(component.component_id, item.group.name);
      if (!componentNameById.has(component.component_id)) {
        componentNameById.set(component.component_id, component.name || component.component_id);
      }
    }
  }

  return {
    componentNameById,
    groupNameByComponentId,
    groupComponentsByGroupId,
  };
}

function buildHistoryItemsFromIncidentLinks(incidentLinks: IncidentLinkRecord[] | undefined, locale: LocaleCode) {
  return (incidentLinks || [])
    .filter((item) => item.id && item.name)
    .sort((left, right) => Date.parse(right.published_at || '') - Date.parse(left.published_at || ''))
    .map((item) => ({
      id: item.id || '',
      title: item.name || '',
      link: item.permalink || '',
      publishedAt: item.published_at || '',
      publishedLabel: formatShortDateTime(item.published_at || '', locale),
      metaLabel: formatShortDate(item.published_at || '', locale),
      status: String(item.status || 'unknown'),
      statusLabel: formatStatusLabel(String(item.status || 'unknown')),
      body: '',
      affectedComponents: [],
      scopeLabel: 'OpenAI',
    }));
}

function buildHeroIncidentFromSummary(
  ongoingIncident: SummaryOngoingIncident,
  componentNameById: Map<string, string>,
  groupNameByComponentId: Map<string, string>,
  now: Date,
  locale: LocaleCode,
): VendorIncidentViewModel {
  const latestUpdate = ongoingIncident.updates?.[ongoingIncident.updates.length - 1];
  const affectedComponents = (ongoingIncident.affected_components || [])
    .map((component) => componentNameById.get(component.component_id) || component.component_id)
    .filter(Boolean);
  const groupedScopes = Array.from(
    new Set((ongoingIncident.affected_components || []).map((component) => groupNameByComponentId.get(component.component_id)).filter(Boolean)),
  );
  const scopeLabel = groupedScopes[0] || affectedComponents[0] || 'OpenAI';
  const publishedAt = ongoingIncident.published_at || '';
  const durationLabel = formatRelativeDuration(publishedAt, now, locale);
  const metaParts = [formatStatusLabel(ongoingIncident.status)];
  if (durationLabel) {
    metaParts.push(durationLabel);
  }
  metaParts.push(locale === 'zh' ? `影响范围 ${scopeLabel}` : `Affects ${scopeLabel}`);

  return {
    id: ongoingIncident.id,
    title: ongoingIncident.name,
    link: '',
    publishedAt,
    publishedLabel: metaParts.join(' • '),
    metaLabel: formatShortDateTime(publishedAt, locale),
    status: ongoingIncident.status,
    statusLabel: formatStatusLabel(ongoingIncident.status),
    body: normalizeWhitespace(String(latestUpdate?.message_string || 'OpenAI is actively investigating an ongoing issue.')),
    affectedComponents,
    scopeLabel,
  };
}

function buildHeroIncident(
  rssIncidents: ParsedRssIncident[],
  summary: SummaryPayload['summary'],
  componentNameById: Map<string, string>,
  groupNameByComponentId: Map<string, string>,
  now: Date,
  locale: LocaleCode,
): VendorIncidentViewModel | null {
  const unresolved = rssIncidents.find((incident) => !['resolved', 'completed', 'closed'].includes(incident.status));
  if (unresolved) {
    const scopeLabel = unresolved.affectedComponents[0]
      ? groupNameByComponentId.get(
          Array.from(componentNameById.entries()).find(
            (entry) => normalizeComponentLabel(entry[1]) === normalizeComponentLabel(unresolved.affectedComponents[0]),
          )?.[0] || '',
        ) || normalizeComponentLabel(unresolved.affectedComponents[0])
      : 'OpenAI';
    const metaParts = [unresolved.statusLabel];
    const durationLabel = formatRelativeDuration(unresolved.publishedAt, now, locale);
    if (durationLabel) {
      metaParts.push(durationLabel);
    }
    metaParts.push(locale === 'zh' ? `影响范围 ${scopeLabel}` : `Affects ${scopeLabel}`);
    return {
      id: unresolved.id,
      title: unresolved.title,
      link: unresolved.link,
      publishedAt: unresolved.publishedAt,
      publishedLabel: metaParts.join(' • '),
      metaLabel: formatShortDateTime(unresolved.publishedAt, locale),
      status: unresolved.status,
      statusLabel: unresolved.statusLabel,
      body: unresolved.body,
      affectedComponents: unresolved.affectedComponents,
      scopeLabel,
    };
  }

  const fallback = summary.ongoing_incidents?.[0];
  if (!fallback) {
    return null;
  }
  return buildHeroIncidentFromSummary(fallback, componentNameById, groupNameByComponentId, now, locale);
}

function toUTCStartOfDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildStatusSegments(
  componentIDs: string[],
  impacts: ComponentImpactRecord[],
  endAt: Date,
  days: number,
): VendorStatusSegment[] {
  const componentSet = new Set(componentIDs);
  const relevantImpacts = impacts.filter((impact) => impact.component_id && componentSet.has(impact.component_id));
  const endDay = new Date(toUTCStartOfDay(endAt));
  const startDay = new Date(endDay.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const segments: VendorStatusSegment[] = [];

  for (let index = 0; index < days; index += 1) {
    const dayStart = new Date(startDay.getTime() + index * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    let worstStatus: VendorStatusKind = 'operational';

    for (const impact of relevantImpacts) {
      const startAt = parseDateValue(impact.start_at || '');
      const impactEndAt = impact.end_at ? parseDateValue(impact.end_at) : endAt;
      if (!startAt || !impactEndAt) {
        continue;
      }
      if (impactEndAt <= dayStart || startAt >= dayEnd) {
        continue;
      }
      worstStatus = pickWorseStatus(worstStatus, normalizeVendorStatus(impact.status || 'unknown'));
    }

    segments.push({
      dayKey: dayStart.toISOString().slice(0, 10),
      status: worstStatus,
    });
  }

  return segments;
}

function buildGroupViewModels(
  summary: SummaryPayload['summary'],
  impactsPayload: ComponentImpactsPayload,
  now: Date,
  locale: LocaleCode,
) {
  const { componentNameById } = buildAffectedComponentMaps(summary);
  const currentAffectedStatusByComponentID = new Map<string, VendorStatusKind>();

  for (const affectedComponent of summary.affected_components || []) {
    currentAffectedStatusByComponentID.set(
      affectedComponent.component_id,
      normalizeVendorStatus(affectedComponent.status),
    );
  }

  const uptimeByGroupID = new Map<string, string>();
  const uptimeByComponentID = new Map<string, string>();
  for (const uptime of impactsPayload.component_uptimes || []) {
    if (uptime.component_id && uptime.uptime) {
      uptimeByComponentID.set(uptime.component_id, uptime.uptime);
    }
    if (uptime.status_page_component_group_id && uptime.uptime) {
      uptimeByGroupID.set(uptime.status_page_component_group_id, uptime.uptime);
    }
  }

  const impacts = impactsPayload.component_impacts || [];
  return (summary.structure?.items || [])
    .filter((item) => item.group)
    .map((item) => {
      const group = item.group as SummaryStructureGroup;
      const componentIDs = group.components.map((component) => component.component_id);
      const affectedComponentNames = componentIDs
        .filter((id) => currentAffectedStatusByComponentID.has(id))
        .map((id) => componentNameById.get(id) || id);

      let worstStatus: VendorStatusKind = 'operational';
      for (const componentID of componentIDs) {
        const tone = currentAffectedStatusByComponentID.get(componentID);
        if (tone) {
          worstStatus = pickWorseStatus(worstStatus, tone);
        }
      }

      const components = componentIDs.map((componentID) => ({
        id: componentID,
        name: componentNameById.get(componentID) || componentID,
        status: currentAffectedStatusByComponentID.get(componentID) || 'operational',
        uptimeLabel: formatUptimeLabel(uptimeByComponentID.get(componentID) || uptimeByGroupID.get(group.id), locale),
        segments: buildStatusSegments([componentID], impacts, now, 90),
      }));

      return {
        id: group.id,
        name: group.name,
        componentCount: group.components.length,
        uptimeLabel: formatUptimeLabel(uptimeByGroupID.get(group.id), locale),
        status: worstStatus,
        affectedComponentNames,
        segments: buildStatusSegments(componentIDs, impacts, now, 90),
        components,
      };
    });
}

function buildRecentIncidents(
  rssIncidents: ParsedRssIncident[],
  impactsPayload: ComponentImpactsPayload,
  locale: LocaleCode,
) {
  if (rssIncidents.length > 0) {
    return rssIncidents
      .slice()
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, 8)
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        link: incident.link,
        publishedAt: incident.publishedAt,
        publishedLabel: formatShortDateTime(incident.publishedAt, locale),
        metaLabel: `${incident.statusLabel} · ${formatShortDate(incident.publishedAt, locale)}`,
        status: incident.status,
        statusLabel: incident.statusLabel,
        body: incident.body,
        affectedComponents: incident.affectedComponents,
        scopeLabel: normalizeComponentLabel(incident.affectedComponents[0] || 'OpenAI'),
      }));
  }

  return buildHistoryItemsFromIncidentLinks(impactsPayload.incident_links, locale).slice(0, 8);
}

export function buildComponentImpactsURL(now: Date) {
  const endAt = new Date(now);
  const startAt = new Date(endAt.getTime() - 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
  });
  return `https://status.openai.com/proxy/status.openai.com/component_impacts?${params.toString()}`;
}

export function buildVendorStatusViewModel(
  summaryPayload: SummaryPayload,
  impactsPayload: ComponentImpactsPayload,
  rssXML: string,
  now = new Date(),
  locale: LocaleCode = 'en',
): VendorStatusPageViewModel {
  const summary = summaryPayload.summary || {};
  const rssIncidents = parseOpenAIStatusRSS(rssXML);
  const { componentNameById, groupNameByComponentId } = buildAffectedComponentMaps(summary);
  const groups = buildGroupViewModels(summary, impactsPayload, now, locale);
  const heroIncident = buildHeroIncident(rssIncidents, summary, componentNameById, groupNameByComponentId, now, locale);
  const unresolvedCount = rssIncidents.filter((incident) => !['resolved', 'completed', 'closed'].includes(incident.status)).length;
  const lastFeedBuildDate = extractRSSLastBuildDate(rssXML);
  const publicUrl = summary.public_url || 'https://status.openai.com/';

  return {
    vendorName: summary.name || 'OpenAI',
    publicUrl,
    subscribeUrl: `${publicUrl.replace(/\/$/, '')}/subscribe`,
    historyUrl: `${publicUrl.replace(/\/$/, '')}/history`,
    historyRangeLabel: formatMonthRangeLabel(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now, locale),
    lastSyncLabel: formatShortDateTime(now.toISOString(), locale),
    feedUpdatedLabel: lastFeedBuildDate ? formatShortDateTime(lastFeedBuildDate, locale) : '--',
    activeIncidentCount: unresolvedCount,
    heroIncident,
    groups,
    recentIncidents: buildRecentIncidents(rssIncidents, impactsPayload, locale),
  };
}
