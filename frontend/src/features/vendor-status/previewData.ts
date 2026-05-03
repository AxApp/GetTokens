import { buildVendorStatusViewModel, type VendorStatusPageViewModel } from './model';
import { hasPreviewMode } from '../../utils/previewMode';
import type { LocaleCode } from '../../types';

const previewRSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <lastBuildDate>Thu, 30 Apr 2026 04:36:36 GMT</lastBuildDate>
    <item>
      <title><![CDATA[Partial Disruption of ChatGPT Workspace Connector Write Actions]]></title>
      <link>https://status.openai.com/incidents/open-1</link>
      <guid>https://status.openai.com/incidents/open-1</guid>
      <pubDate>Wed, 29 Apr 2026 21:59:10 GMT</pubDate>
      <description><![CDATA[<b>Status: Identified</b><br/><br/>We have identified an issue where write actions for some ChatGPT workspace connectors were automatically disabled.<br/><br/><b>Affected components</b><ul><li>Connectors/Apps (Degraded performance)</li></ul>]]></description>
    </item>
    <item>
      <title><![CDATA[Users may experience elevated error rate for gpt-4o-mini in the API]]></title>
      <link>https://status.openai.com/incidents/open-2</link>
      <guid>https://status.openai.com/incidents/open-2</guid>
      <pubDate>Wed, 29 Apr 2026 05:41:04 GMT</pubDate>
      <description><![CDATA[<b>Status: Resolved</b><br/><br/>All impacted services have now fully recovered.<br/><br/><b>Affected components</b><ul><li>Responses (Operational)</li></ul>]]></description>
    </item>
  </channel>
</rss>`;

const previewSummaryPayload = {
  summary: {
    name: 'OpenAI',
    public_url: 'https://status.openai.com',
    components: [
      { id: 'comp-api-a', name: 'Responses' },
      { id: 'comp-api-b', name: 'Realtime API' },
      { id: 'comp-chat-a', name: 'Connectors/Apps' },
      { id: 'comp-chat-b', name: 'ChatGPT Workspace' },
      { id: 'comp-codex-a', name: 'Codex API' },
    ],
    affected_components: [
      { component_id: 'comp-chat-a', status: 'degraded_performance' },
      { component_id: 'comp-chat-b', status: 'degraded_performance' },
    ],
    structure: {
      items: [
        {
          group: {
            id: 'group-api',
            name: 'APIs',
            components: [
              { component_id: 'comp-api-a', name: 'Responses' },
              { component_id: 'comp-api-b', name: 'Realtime API' },
            ],
          },
        },
        {
          group: {
            id: 'group-chat',
            name: 'ChatGPT',
            components: [
              { component_id: 'comp-chat-a', name: 'Connectors/Apps' },
              { component_id: 'comp-chat-b', name: 'ChatGPT Workspace' },
            ],
          },
        },
        {
          group: {
            id: 'group-codex',
            name: 'Codex',
            components: [{ component_id: 'comp-codex-a', name: 'Codex API' }],
          },
        },
      ],
    },
  },
};

const previewImpactsPayload = {
  incident_links: [
    {
      id: 'link-1',
      name: 'History incident',
      permalink: 'https://statuspage.incident.io/openai-1/incidents/abc',
      published_at: '2026-04-28T13:52:19.243Z',
      status: 'resolved',
    },
  ],
  component_impacts: [
    {
      component_id: 'comp-chat-a',
      status: 'degraded_performance',
      start_at: '2026-04-29T21:59:10.119Z',
    },
    {
      component_id: 'comp-chat-b',
      status: 'degraded_performance',
      start_at: '2026-04-29T21:59:10.119Z',
    },
    {
      component_id: 'comp-api-a',
      status: 'partial_outage',
      start_at: '2026-04-10T01:00:00.000Z',
      end_at: '2026-04-10T03:00:00.000Z',
    },
    {
      component_id: 'comp-codex-a',
      status: 'partial_outage',
      start_at: '2026-04-24T09:00:00.000Z',
      end_at: '2026-04-24T11:30:00.000Z',
    },
  ],
  component_uptimes: [
    { component_id: 'comp-api-a', status_page_component_group_id: 'group-api', uptime: '99.99' },
    { component_id: 'comp-api-b', status_page_component_group_id: 'group-api', uptime: '99.97' },
    { component_id: 'comp-chat-a', status_page_component_group_id: 'group-chat', uptime: '99.93' },
    { component_id: 'comp-chat-b', status_page_component_group_id: 'group-chat', uptime: '99.96' },
    { component_id: 'comp-codex-a', status_page_component_group_id: 'group-codex', uptime: '99.98' },
  ],
};

export function hasVendorStatusPreviewMode() {
  return hasPreviewMode('vendor-status');
}

export function getVendorStatusPreviewModel(locale: LocaleCode): VendorStatusPageViewModel {
  return buildVendorStatusViewModel(
    previewSummaryPayload,
    previewImpactsPayload,
    previewRSS,
    new Date('2026-04-30T15:59:59.999Z'),
    locale,
  );
}
