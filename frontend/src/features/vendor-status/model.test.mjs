import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildComponentImpactsURL,
  buildVendorStatusViewModel,
  normalizeVendorStatus,
  parseIncidentMarkup,
  parseOpenAIStatusRSS,
} from './model.ts';

const rssXML = `<?xml version="1.0" encoding="utf-8"?>
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

const summaryPayload = {
  summary: {
    name: 'OpenAI',
    public_url: 'https://status.openai.com',
    components: [
      { id: 'comp-api-a', name: 'Responses' },
      { id: 'comp-chat-a', name: 'Connectors/Apps' },
    ],
    affected_components: [
      { component_id: 'comp-chat-a', status: 'degraded_performance' },
    ],
    structure: {
      items: [
        {
          group: {
            id: 'group-api',
            name: 'APIs',
            components: [{ component_id: 'comp-api-a', name: 'Responses' }],
          },
        },
        {
          group: {
            id: 'group-chat',
            name: 'ChatGPT',
            components: [{ component_id: 'comp-chat-a', name: 'Connectors/Apps' }],
          },
        },
      ],
    },
  },
};

const impactsPayload = {
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
      component_id: 'comp-api-a',
      status: 'partial_outage',
      start_at: '2026-04-10T01:00:00.000Z',
      end_at: '2026-04-10T03:00:00.000Z',
    },
  ],
  component_uptimes: [
    { component_id: 'comp-api-a', status_page_component_group_id: 'group-api', uptime: '99.99' },
    { component_id: 'comp-chat-a', status_page_component_group_id: 'group-chat', uptime: '99.80' },
  ],
};

test('normalizeVendorStatus handles OpenAI status vocabulary', () => {
  assert.equal(normalizeVendorStatus('degraded_performance'), 'degraded_performance');
  assert.equal(normalizeVendorStatus('partial outage'), 'partial_outage');
  assert.equal(normalizeVendorStatus('full_outage'), 'major_outage');
  assert.equal(normalizeVendorStatus('operational'), 'operational');
});

test('parseIncidentMarkup extracts status, body and affected components', () => {
  const parsed = parseIncidentMarkup(
    '<b>Status: Identified</b><br/><br/>Primary detail.<br/><br/><b>Affected components</b><ul><li>Connectors/Apps (Degraded performance)</li></ul>',
  );

  assert.equal(parsed.status, 'identified');
  assert.equal(parsed.statusLabel, 'Identified');
  assert.match(parsed.body, /Primary detail/);
  assert.deepEqual(parsed.affectedComponents, ['Connectors/Apps (Degraded performance)']);
});

test('parseOpenAIStatusRSS returns incident entries sorted by feed order', () => {
  const incidents = parseOpenAIStatusRSS(rssXML);

  assert.equal(incidents.length, 2);
  assert.equal(incidents[0].title, 'Partial Disruption of ChatGPT Workspace Connector Write Actions');
  assert.equal(incidents[0].status, 'identified');
  assert.deepEqual(incidents[0].affectedComponents, ['Connectors/Apps (Degraded performance)']);
});

test('buildComponentImpactsURL creates the expected proxy endpoint', () => {
  const url = buildComponentImpactsURL(new Date('2026-04-30T15:59:59.999Z'));

  assert.match(url, /^https:\/\/status\.openai\.com\/proxy\/status\.openai\.com\/component_impacts\?/);
  assert.match(url, /start_at=/);
  assert.match(url, /end_at=/);
});

test('buildVendorStatusViewModel combines RSS and JSON into page sections', () => {
  const viewModel = buildVendorStatusViewModel(
    summaryPayload,
    impactsPayload,
    rssXML,
    new Date('2026-04-30T15:59:59.999Z'),
  );

  assert.equal(viewModel.vendorName, 'OpenAI');
  assert.equal(viewModel.heroIncident?.title, 'Partial Disruption of ChatGPT Workspace Connector Write Actions');
  assert.equal(viewModel.heroIncident?.scopeLabel, 'ChatGPT');
  assert.equal(viewModel.groups.length, 2);
  assert.equal(viewModel.groups[0].name, 'APIs');
  assert.equal(viewModel.groups[0].components.length, 1);
  assert.equal(viewModel.groups[0].components[0].name, 'Responses');
  assert.equal(viewModel.groups[0].components[0].uptimeLabel, '99.99% uptime');
  assert.equal(viewModel.groups[0].uptimeLabel, '99.99% uptime');
  assert.equal(viewModel.groups[0].segments.length, 90);
  assert.equal(viewModel.groups[1].status, 'degraded_performance');
  assert.equal(viewModel.groups[1].components[0].status, 'degraded_performance');
  assert.match(viewModel.feedUpdatedLabel, /^Apr 30,/);
  assert.equal(viewModel.activeIncidentCount, 1);
  assert.equal(viewModel.recentIncidents.length, 2);
  assert.match(viewModel.recentIncidents[0].metaLabel, /(Identified|Resolved)/);
});

test('buildVendorStatusViewModel localizes time and uptime labels for zh locale', () => {
  const viewModel = buildVendorStatusViewModel(
    summaryPayload,
    impactsPayload,
    rssXML,
    new Date('2026-04-30T15:59:59.999Z'),
    'zh',
  );

  assert.equal(viewModel.groups[0].uptimeLabel, '99.99% 可用率');
  assert.match(viewModel.historyRangeLabel, /2026/);
  assert.match(viewModel.heroIncident?.publishedLabel || '', /影响范围 ChatGPT/);
});

test('buildVendorStatusViewModel falls back to incident links when RSS is unavailable', () => {
  const viewModel = buildVendorStatusViewModel(
    summaryPayload,
    impactsPayload,
    '',
    new Date('2026-04-30T15:59:59.999Z'),
  );

  assert.equal(viewModel.recentIncidents.length, 1);
  assert.equal(viewModel.recentIncidents[0].title, 'History incident');
  assert.equal(viewModel.heroIncident, null);
});
