import test from 'node:test';
import assert from 'node:assert/strict';

import {
  persistVendorStatusCache,
  readVendorStatusCache,
  VENDOR_STATUS_CACHE_KEY,
} from './cache.ts';

const summaryPayload = {
  summary: {
    name: 'OpenAI',
    public_url: 'https://status.openai.com',
    components: [{ id: 'comp-api-a', name: 'Responses' }],
    affected_components: [],
    structure: {
      items: [
        {
          group: {
            id: 'group-api',
            name: 'APIs',
            components: [{ component_id: 'comp-api-a', name: 'Responses' }],
          },
        },
      ],
    },
  },
};

const impactsPayload = {
  component_impacts: [],
  component_uptimes: [{ status_page_component_group_id: 'group-api', uptime: '99.99' }],
};

test('persistVendorStatusCache writes serialized payload', () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  persistVendorStatusCache(storage, {
    summaryPayload,
    impactsPayload,
    rssXML: '',
    fetchedAt: new Date('2026-04-30T00:00:00.000Z'),
  });

  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], VENDOR_STATUS_CACHE_KEY);
  assert.match(writes[0][1], /2026-04-30T00:00:00.000Z/);
});

test('readVendorStatusCache returns localized view model when cache is fresh', () => {
  const storage = {
    getItem(key) {
      assert.equal(key, VENDOR_STATUS_CACHE_KEY);
      return JSON.stringify({
        fetchedAtISO: '2026-04-30T15:59:59.999Z',
        summaryPayload,
        impactsPayload,
        rssXML: '',
      });
    },
  };

  const viewModel = readVendorStatusCache(storage, 'zh', new Date('2026-04-30T16:02:00.000Z'));

  assert.equal(viewModel?.vendorName, 'OpenAI');
  assert.equal(viewModel?.groups[0].uptimeLabel, '99.99% 可用率');
});

test('readVendorStatusCache returns null when cache is expired or invalid', () => {
  const expiredStorage = {
    getItem() {
      return JSON.stringify({
        fetchedAtISO: '2026-04-30T15:59:59.999Z',
        summaryPayload,
        impactsPayload,
        rssXML: '',
      });
    },
  };

  assert.equal(readVendorStatusCache(expiredStorage, 'en', new Date('2026-04-30T16:10:00.000Z')), null);
  assert.equal(readVendorStatusCache({ getItem: () => 'not-json' }, 'en', new Date()), null);
  assert.equal(readVendorStatusCache(null, 'en', new Date()), null);
});
