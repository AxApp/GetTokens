import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { resolveQuotaStatusEvidenceFromPayload } from '../../accounts/model/quotaStatusEvidence.ts';
import { buildStatusQuotaEvidenceSectionState } from '../model/quotaEvidenceSection.ts';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const quotaNoDirectParserScript = fileURLToPath(
  new URL('../../../../../docs-linhay/scripts/check-quota-no-direct-fact-parser.mjs', import.meta.url),
);

test('status quota evidence helper resolves explicit fact payload for status page consumer', () => {
  const evidence = resolveQuotaStatusEvidenceFromPayload(
    {
      quotaFact: {
        state: 'stale',
        source: 'quota-runtime',
        freshness: 'stale',
        confidence: 'medium',
        risk: 'warning',
        explanation: 'cached quota fact',
        evidenceRefs: ['source:cache'],
      },
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
    },
    'codex',
  );

  assert.deepEqual(evidence, {
    title: 'Codex 配额事实',
    summary: 'Stale / Warning risk',
    view: {
      stateLabel: 'Stale',
      sourceLabel: 'Quota runtime authority',
      freshnessLabel: 'Stale',
      confidenceLabel: 'Medium confidence',
      riskLabel: 'Warning risk',
      summary: 'Stale / Warning risk',
      explanation: 'cached quota fact',
      observedAt: undefined,
      expiresAt: undefined,
      evidenceRefs: ['source:cache'],
    },
  });
});

test('status quota evidence helper ignores windows and blockReason when explicit fact is missing', () => {
  const evidence = resolveQuotaStatusEvidenceFromPayload(
    {
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
      totalTokens: 128000,
    },
    'codex',
  );

  assert.equal(evidence, undefined);
});

test('status quota evidence helper treats camelCase, snake case, and legacy fact fields as explicit facts', () => {
  const payloads = [
    {
      label: 'camel',
      payload: {
        quotaFact: {
          state: 'available',
          source: 'quota-runtime',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'none',
          evidenceRefs: ['quota:camel'],
        },
      },
    },
    {
      label: 'snake',
      payload: {
        quota_fact: {
          state: 'stale',
          source: 'quota-runtime',
          freshness: 'stale',
          confidence: 'medium',
          risk: 'warning',
          evidence_refs: ['quota:snake'],
        },
      },
    },
    {
      label: 'legacy',
      payload: {
        fact: {
          state: 'denied',
          source: 'quota-runtime',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'denied',
          evidence_refs: ['quota:legacy'],
        },
      },
    },
  ];

  for (const { label, payload } of payloads) {
    const evidence = resolveQuotaStatusEvidenceFromPayload(
      {
        ...payload,
        windows: [{ id: 'weekly', remainingPercent: 0 }],
        blockReason: `${label} payload should not need local inference`,
      },
      'codex',
    );

    assert.ok(evidence, `${label} payload should produce explicit quota evidence`);
    assert.equal(evidence.title, 'Codex 配额事实');
    assert.equal(evidence.view.sourceLabel, 'Quota runtime authority');
    assert.equal(evidence.view.evidenceRefs?.[0], `quota:${label}`);
  }
});

test('status quota evidence section keeps non-authoritative empty state when only doctored local fields exist', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      accountKey: 'codex-empty',
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
      totalTokens: 128000,
    },
  ]);

  assert.deepEqual(state.items, []);
  assert.deepEqual(state.notice, {
    eyebrow: 'NON-AUTHORITATIVE',
    title: 'Quota authority unavailable for 1 account',
    description: 'Some status payloads did not include explicit quotaFact. This page does not infer authority from windows, block reasons, or usage totals.',
    accountKeys: ['codex-empty'],
    unscopedMissingFactCount: 0,
  });
});

test('status quota evidence section renders authoritative fact cards when explicit quotaFact exists', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      accountKey: 'codex-fact',
      updatedAt: '2026-06-17T12:00:00Z',
      quotaFact: {
        state: 'no-quota',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'critical',
        explanation: 'provider reported quota exhausted',
        evidenceRefs: ['runtime:quota'],
      },
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
    },
  ]);

  assert.equal(state.notice, undefined);
  assert.deepEqual(state.items, [
    {
      accountKey: 'codex-fact',
      updatedAt: '2026-06-17T12:00:00Z',
      evidence: {
        title: 'Codex 配额事实',
        summary: 'No quota / Blocking risk',
        view: {
          stateLabel: 'No quota',
          sourceLabel: 'Quota runtime authority',
          freshnessLabel: 'Fresh',
          confidenceLabel: 'High confidence',
          riskLabel: 'Blocking risk',
          summary: 'No quota / Blocking risk',
          explanation: 'provider reported quota exhausted',
          observedAt: undefined,
          expiresAt: undefined,
          evidenceRefs: ['runtime:quota'],
        },
      },
    },
  ]);
});

test('status quota evidence section keeps per-account non-authoritative hints for mixed payloads without inventing new facts', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      accountKey: 'codex-fact',
      updatedAt: '2026-06-17T12:00:00Z',
      quotaFact: {
        state: 'no-quota',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'critical',
        explanation: 'provider reported quota exhausted',
        evidenceRefs: ['runtime:quota'],
      },
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
    },
    {
      accountKey: 'codex-missing-a',
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
      totalTokens: 128000,
    },
    {
      accountKey: 'codex-missing-b',
      usageTotals: { input: 1024, output: 512 },
    },
    {
      windows: [{ id: 'monthly', remainingPercent: 10 }],
      blockReason: 'quota uncertain',
    },
    {
      usageTotals: { input: 2048, output: 256 },
    },
  ]);

  assert.equal(state.items.length, 1);
  assert.deepEqual(state.notice, {
    eyebrow: 'NON-AUTHORITATIVE',
    title: 'Quota authority unavailable for 2 accounts',
    description: 'Some status payloads did not include explicit quotaFact. This page does not infer authority from windows, block reasons, or usage totals.',
    accountKeys: ['codex-missing-a', 'codex-missing-b'],
    unscopedMissingFactCount: 2,
    unscopedMissingFactSamples: ['payload #4', 'payload #5'],
  });
});

test('status quota evidence section keeps unscoped missing fact count when payloads have no accountKey', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
    },
    {
      usageTotals: { input: 512, output: 128 },
    },
  ]);

  assert.deepEqual(state.items, []);
  assert.deepEqual(state.notice, {
    eyebrow: 'NON-AUTHORITATIVE',
    title: 'Quota authority unavailable',
    description: 'Some status payloads did not include explicit quotaFact. This page does not infer authority from windows, block reasons, or usage totals.',
    unscopedMissingFactCount: 2,
    unscopedMissingFactSamples: ['payload #1', 'payload #2'],
  });
});

test('status quota evidence section adds deterministic non-authoritative trace labels for unscoped missing fact payloads', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      source: 'status',
      status: 'runtime-snapshot',
      updatedAt: '2026-06-17T12:34:56Z',
      provider: 'codex',
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'quota empty: weekly',
      usageTotals: { input: 512, output: 128 },
    },
    {
      accountKey: 'codex-fact',
      quotaFact: {
        state: 'available',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'normal',
      },
    },
    {
      source: 'quota-status',
      provider: 'openai-compatible',
      usageTotals: { authority: 'usage-derived-authority' },
      blockReason: 'derived-account-from-block-reason',
      windows: [{ authority: 'window-derived-authority' }],
    },
  ]);

  assert.equal(state.notice?.unscopedMissingFactCount, 2);
  assert.deepEqual(state.notice?.accountKeys, undefined);
  assert.deepEqual(state.notice?.unscopedMissingFactSamples, [
    'payload #1 · source=status · status=runtime-snapshot · updatedAt=2026-06-17T12:34:56Z · provider=codex',
    'payload #3 · source=quota-status · provider=openai-compatible',
  ]);
  assert.equal(state.notice?.unscopedMissingFactSamples?.some((label) => label.includes('quota empty')), false);
  assert.equal(state.notice?.unscopedMissingFactSamples?.some((label) => label.includes('usage-derived-authority')), false);
  assert.equal(state.notice?.unscopedMissingFactSamples?.some((label) => label.includes('window-derived-authority')), false);
  assert.equal(state.notice?.unscopedMissingFactSamples?.some((label) => label.includes('derived-account-from-block-reason')), false);
});

test('status quota evidence section never promotes missing fact payloads with quota-shaped authority bait', () => {
  const state = buildStatusQuotaEvidenceSectionState([
    {
      accountKey: 'codex-bait',
      updatedAt: '2026-06-17T13:00:00Z',
      windows: [
        {
          id: 'weekly',
          remainingPercent: 0,
          authority: {
            state: 'no-quota',
            confidence: 'high',
          },
        },
      ],
      blockReason: 'quota empty: weekly',
      usageTotals: {
        total: 128000,
        state: 'denied',
        risk: 'blocking',
      },
      totalTokens: 128000,
      factLike: {
        state: 'available',
        source: 'local-derived',
      },
    },
    {
      accountKey: 'codex-explicit',
      quota_fact: {
        state: 'available',
        source: 'quota-runtime',
        freshness: 'fresh',
        confidence: 'high',
        risk: 'none',
        evidence_refs: ['quota:explicit'],
      },
      windows: [{ id: 'weekly', remainingPercent: 0 }],
      blockReason: 'ignored because explicit fact wins',
    },
  ]);

  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].accountKey, 'codex-explicit');
  assert.equal(state.items[0].evidence.view.evidenceRefs[0], 'quota:explicit');
  assert.deepEqual(state.notice, {
    eyebrow: 'NON-AUTHORITATIVE',
    title: 'Quota authority unavailable for 1 account',
    description: 'Some status payloads did not include explicit quotaFact. This page does not infer authority from windows, block reasons, or usage totals.',
    accountKeys: ['codex-bait'],
    unscopedMissingFactCount: 0,
  });
});

test('status feature consumes quota evidence section state via shared helper and renders read-only fact fields', async () => {
  const featureSource = await readFile(new URL('../StatusFeature.tsx', import.meta.url), 'utf8');
  const panelsSource = await readFile(new URL('../components/StatusPanels.tsx', import.meta.url), 'utf8');
  const modelSource = await readFile(new URL('../model/quotaEvidenceSection.ts', import.meta.url), 'utf8');

  assert.match(featureSource, /GetAllQuotaStatuses/);
  assert.match(featureSource, /buildStatusQuotaEvidenceSectionState\(quotaStatuses,\s*'codex'\)/);
  assert.match(featureSource, /<StatusQuotaEvidenceSection state=\{quotaEvidenceSection\} \/>/);
  assert.match(modelSource, /resolveQuotaStatusEvidenceFromPayload\(status,\s*workspace\)/);
  assert.match(modelSource, /does not infer authority from windows, block reasons, or usage totals/);
  assert.match(panelsSource, /data-status-quota-evidence-section/);
  assert.match(panelsSource, /data-status-quota-evidence-item/);
  assert.match(panelsSource, /data-status-quota-evidence-empty/);
  assert.match(panelsSource, /data-status-quota-evidence-missing-accounts/);
  assert.match(panelsSource, /state\.notice\.eyebrow/);
  assert.match(panelsSource, /state\.notice\.title/);
  assert.match(panelsSource, /state\.notice\.description/);
  assert.match(panelsSource, /state\.notice\.accountKeys/);
  assert.match(panelsSource, /state\.notice\.unscopedMissingFactCount/);
  assert.match(panelsSource, /state\.notice\.unscopedMissingFactSamples/);
  assert.match(panelsSource, /MISSING EXPLICIT FACT/);
  assert.match(panelsSource, /UNSCOPED PAYLOADS MISSING EXPLICIT FACT/);
  assert.match(panelsSource, /UNSCOPED TRACE SAMPLES/);
  assert.match(panelsSource, /NON-AUTHORITATIVE TRACE/);
  assert.match(panelsSource, /STATE/);
  assert.match(panelsSource, /SOURCE/);
  assert.match(panelsSource, /FRESHNESS/);
  assert.match(panelsSource, /CONFIDENCE/);
  assert.match(panelsSource, /RISK/);
  assert.match(panelsSource, /SUMMARY/);
  assert.match(panelsSource, /EXPLANATION/);
  assert.match(panelsSource, /EVIDENCE REFS/);
});

test('quota evidence consumers are covered by the no-direct fact parser static gate', async () => {
  const { stdout } = await execFileAsync(process.execPath, [quotaNoDirectParserScript], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(stdout);

  assert.equal(result.ok, true);
  assert.equal(result.scannedRoot, 'frontend/src/features');
  assert.equal(result.directParserEntrypoint, 'frontend/src/features/accounts/model/accountQuota.ts');
  assert.equal(result.findings.length, 0);
  assert.equal(result.exceptionFiles, 0);
  assert.deepEqual(result.knownTypedConsumerExceptions, []);
});

test('quota no-direct fact parser gate rejects an unauthorized new consumer parser', async () => {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), 'gettokens-quota-gate-'));
  const consumerDir = path.join(tmpRoot, 'frontend/src/features/new-quota-consumer/model');
  await mkdir(consumerDir, { recursive: true });
  await writeFile(
    path.join(consumerDir, 'directFactReader.ts'),
    [
      'export function readQuotaAuthority(payload: any) {',
      "  return payload.quotaFact ?? payload['quota_fact'] ?? payload.fact;",
      '}',
      '',
    ].join('\n'),
  );

  await assert.rejects(
    execFileAsync(process.execPath, [quotaNoDirectParserScript], {
      cwd: tmpRoot,
      env: { ...process.env, GETTOKENS_REPO_ROOT: tmpRoot },
      maxBuffer: 10 * 1024 * 1024,
    }),
    (error) => {
      const stderr = String(error.stderr || '');
      assert.match(stderr, /new-quota-consumer\/model\/directFactReader\.ts/);
      assert.match(stderr, /quotaFact property access/);
      assert.match(stderr, /quota_fact parser access/);
      assert.match(stderr, /legacy fact parser access/);
      return true;
    },
  );
});
