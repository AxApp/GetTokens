#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const checkDocsPath = path.join(scriptDir, 'check-docs.sh');
const quotaGatePath = path.join(scriptDir, 'check-quota-no-direct-fact-parser.mjs');
const execFileAsync = promisify(execFile);

const [checkDocs, quotaGate] = await Promise.all([
  readFile(checkDocsPath, 'utf8'),
  readFile(quotaGatePath, 'utf8'),
]);

assert.match(
  checkDocs,
  /check-quota-no-direct-fact-parser\.mjs/,
  'docs check must invoke the quota no-direct-fact-parser gate',
);

for (const fixturePattern of [
  String.raw`^frontend\/src\/features\/accounts\/tests\/`,
  String.raw`^frontend\/src\/features\/status\/tests\/`,
  String.raw`^frontend\/src\/features\/doctor-workbench\/tests\/`,
  String.raw`^frontend\/src\/features\/accounts\/previewData\.ts$`,
  String.raw`^frontend\/src\/features\/doctor-workbench\/model\/previewData\.ts$`,
]) {
  assert.ok(quotaGate.includes(fixturePattern), `quota gate must allow fixture path pattern ${fixturePattern}`);
}

assert.ok(
  !quotaGate.includes(String.raw`/^frontend\/src\/features\/doctor-workbench\//,`),
  'quota gate must not allow the full doctor-workbench feature as a typed consumer exception',
);
assert.ok(
  !quotaGate.includes(String.raw`^frontend\/src\/features\/doctor-workbench\/model\/quotaEvidenceAdapter\.ts$`),
  'quota gate must not retain the doctor quota evidence adapter as a typed consumer exception',
);

async function withTempRepo(filesByPath, callback) {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), 'gettokens-quota-static-gate-'));
  try {
    await Promise.all(Object.entries(filesByPath).map(async ([relPath, source]) => {
      const absPath = path.join(tmpRoot, relPath);
      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, source);
    }));
    return await callback(tmpRoot);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function runQuotaGate(repoRoot) {
  const result = await execFileAsync(process.execPath, [quotaGatePath], {
    cwd: repoRoot,
    env: { ...process.env, GETTOKENS_REPO_ROOT: repoRoot },
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(result.stdout);
}

async function expectQuotaGateFailure(repoRoot) {
  await assert.rejects(
    execFileAsync(process.execPath, [quotaGatePath], {
      cwd: repoRoot,
      env: { ...process.env, GETTOKENS_REPO_ROOT: repoRoot },
      maxBuffer: 10 * 1024 * 1024,
    }),
    (error) => {
      const stderr = String(error.stderr || '');
      assert.ok(stderr.trim(), 'quota gate failure must print JSON findings to stderr');
      return true;
    },
  );
}

await withTempRepo({
  'frontend/src/features/status/model/proseOnlyQuotaNotice.ts': [
    'export const quotaNotice = [',
    "  'payload.quotaFact is forbidden in prose examples, not code',",
    "  'JSON.parse(rawPayload).quota_fact is also prose only',",
    '].join("\\n");',
    '// payload.quotaFact in a comment must not fail the lexical gate',
    '// const parsed = JSON.parse(rawPayload); parsed.quota_fact;',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  const result = await runQuotaGate(tmpRoot);
  assert.equal(result.ok, true, 'quota gate must ignore comments and string-only examples');
  assert.equal(result.findings.length, 0);
});

await withTempRepo({
  'frontend/src/features/new-quota-consumer/model/directRawFact.ts': [
    'export function directRawFact(status: any) {',
    '  const { rawPayload: raw } = status;',
    '  const parsed = JSON.parse(raw);',
    '  return parsed.quotaFact?.state;',
    '}',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  await expectQuotaGateFailure(tmpRoot);
});

await withTempRepo({
  'frontend/src/features/new-quota-consumer/model/originalMessageFact.ts': [
    'export function originalMessageFact(status: any) {',
    '  const raw = status.originalMessage;',
    '  const parsed = JSON.parse(raw);',
    "  return parsed['quota_fact'] ?? parsed.fact;",
    '}',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  await expectQuotaGateFailure(tmpRoot);
});

await withTempRepo({
  'frontend/src/features/doctor-workbench/model/directQuotaFactConsumer.ts': [
    'export function directDoctorQuotaFact(payload: any) {',
    '  return payload.quotaFact?.state;',
    '}',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  await expectQuotaGateFailure(tmpRoot);
});

await withTempRepo({
  'frontend/src/features/doctor-workbench/model/quotaEvidenceAdapter.ts': [
    "import { resolveExplicitQuotaFactDisplay } from '../../accounts/model/accountQuota.ts';",
    'export function doctorQuotaEvidenceAdapter(payload: any) {',
    "  return resolveExplicitQuotaFactDisplay(payload, { sourceFallback: payload.source, explanationFallback: payload.summary });",
    '}',
    '',
  ].join('\n'),
  'frontend/src/features/accounts/model/accountQuota.ts': [
    'export function resolveExplicitQuotaFactDisplay(payload: any) {',
    "  return payload.quotaFact ? { state: payload.quotaFact.state } : undefined;",
    '}',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  const result = await runQuotaGate(tmpRoot);
  assert.equal(result.ok, true, 'doctor quota evidence adapter must pass without a typed quotaFact exception');
  assert.equal(result.findings.length, 0);
  assert.equal(result.exceptionFiles, 0);
  assert.deepEqual(result.knownTypedConsumerExceptions, []);
});

await withTempRepo({
  'frontend/src/features/accounts/model/accountQuota.ts': [
    'export function canonical(payload: any) {',
    "  return payload.quotaFact ?? payload['quota_fact'] ?? payload.fact;",
    '}',
    '',
  ].join('\n'),
  'frontend/src/features/accounts/tests/quotaFixture.test.mjs': [
    'export const fixture = {',
    "  originalMessage: '{\"quotaFact\":{\"state\":\"available\"}}',",
    "  quotaFact: { state: 'available' },",
    '};',
    '',
  ].join('\n'),
  'frontend/src/features/accounts/previewData.ts': [
    'export const preview = {',
    "  rawPayload: '{\"quota_fact\":{\"state\":\"available\"}}',",
    "  quota_fact: { state: 'available' },",
    '};',
    '',
  ].join('\n'),
}, async (tmpRoot) => {
  const result = await runQuotaGate(tmpRoot);
  assert.equal(result.ok, true, 'canonical helper and fixture paths must remain allowed');
  assert.equal(result.findings.length, 0);
});

console.log('Quota static gate docs-check integration policy passed.');
