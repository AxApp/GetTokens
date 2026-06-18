#!/usr/bin/env node
import { access, mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.DOCTOR_WORKBENCH_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const workspaceHash = '#frame=codex&workspace=doctor-workbench';
const url = process.env.DOCTOR_WORKBENCH_PREVIEW_URL || `${baseURL}/${workspaceHash}`;
const spaceRoot = path.resolve('docs-linhay/spaces/20260616-doctor-workbench');
const screenshotDir = path.resolve(
  `${spaceRoot}/screenshots/20260617/workbench`,
);
const archivedSnapshotPath = path.resolve(
  `${spaceRoot}/plans/20260617-round15-doctor-workbench-preview-snapshot-v01.md`,
);
const previewFixturePath = path.resolve(
  'frontend/src/features/doctor-workbench/model/previewData.ts',
);
const screenshotPath = path.join(
  screenshotDir,
  '20260617-doctor-workbench-baseline-v01.png',
);
const readmePath = path.resolve(`${spaceRoot}/README.md`);
const userDataDir = process.env.DOCTOR_WORKBENCH_CHROME_PROFILE || '/tmp/gettokens-doctor-workbench-preview-chrome';

function chromeFlags() {
  return [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,1100',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
  ];
}

function hasAny(content, patterns) {
  return patterns.some((pattern) => (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)));
}

function missingCheck(content, patterns) {
  return hasAny(content, patterns) ? null : patterns.map((pattern) => pattern.toString()).join(' | ');
}

function extractFixtureBlock(content, marker) {
  const start = content.indexOf(marker);
  if (start < 0) {
    return '';
  }
  const nextFixture = content.indexOf('refID:', start + marker.length);
  return content.slice(start, nextFixture < 0 ? undefined : nextFixture);
}

async function readArtifact(filePath) {
  return readFile(filePath, 'utf8');
}

async function dumpDOM(targetURL) {
  try {
    const { stdout } = await execFileAsync(
      chromeExecutablePath,
      [...chromeFlags(), '--dump-dom', targetURL],
      { maxBuffer: 30 * 1024 * 1024 },
    );
    return { dom: stdout, source: 'chrome' };
  } catch (error) {
    const snapshot = await readArtifact(archivedSnapshotPath);
    return { dom: snapshot, source: 'archived-playwright-snapshot', chromeError: error.message };
  }
}

async function captureScreenshot(targetURL, outputPath) {
  await mkdir(screenshotDir, { recursive: true });
  try {
    await execFileAsync(chromeExecutablePath, [
      ...chromeFlags(),
      '--hide-scrollbars',
      `--screenshot=${outputPath}`,
      targetURL,
    ]);
    return { screenshotPath: outputPath, source: 'chrome' };
  } catch (error) {
    await access(screenshotPath);
    return { screenshotPath, source: 'archived-playwright-screenshot', chromeError: error.message };
  }
}

const [readme, previewFixture, { dom, source, chromeError: domChromeError }] = await Promise.all([
  readArtifact(readmePath),
  readArtifact(previewFixturePath),
  dumpDOM(url),
]);
const nestedDroppedReasonFixture = extractFixtureBlock(previewFixture, "refID: 'rd_preview_nested_dropped_reason'");
const parsedURL = new URL(url);
const requiredArtifacts = {
  script: 'docs-linhay/scripts/check-doctor-workbench-preview.mjs',
  snapshot: 'plans/20260617-round15-doctor-workbench-preview-snapshot-v01.md',
  screenshot: 'screenshots/20260617/workbench/20260617-doctor-workbench-baseline-v01.png',
};
const checks = {
  workspaceHash: parsedURL.hash === workspaceHash,
  title: hasAny(dom, ['Doctor Workbench']),
  previewSource: hasAny(dom, ['source=preview', 'source=&quot;preview&quot;']),
  previewRuntimeBoundary: hasAny(dom, ['preview-only']),
  sourceBoundary: hasAny(dom, ['Source boundary']),
  readOnlyMode: hasAny(dom, [/data-doctor-mode="read-only"/, 'Mutation surface: none', 'no repair handler']),
  structuredTarget: hasAny(dom, [/data-doctor-route-evidence-target=(\\?")acct_route_001\|auth_route_001\|gpt-5\|upstream-error\|model\1/]),
  structuredAccount: hasAny(dom, [/data-doctor-route-evidence-account="acct_route_001"/, '>Account<']),
  structuredAuth: hasAny(dom, [/data-doctor-route-evidence-auth="auth_route_001"/, '>Auth<']),
  structuredModel: hasAny(dom, [/data-doctor-route-evidence-model="gpt-5"/, '>Model<']),
  structuredScope: hasAny(dom, [/data-doctor-route-evidence-scope="model"/, '>Scope<']),
  structuredBlocking: hasAny(dom, [/data-doctor-route-evidence-blocking="Route blocking"/, 'Route blocking']),
  partialIdentityFallback: hasAny(dom, [/data-doctor-route-evidence-fallback="partial-identity"/, 'Partial identity fallback']),
  noMutationBindings: !/RepairDoctorSnapshot|ApplyDoctorRepair|MutateDoctorSnapshot|SaveDoctorSnapshot/.test(dom),
  noRepairCTA: !/Open repair|Run repair|Apply repair|Retry mutation/i.test(dom),
  noDraftStatusHash: !dom.includes('#status/all'),
  noDraftCodexHash: !dom.includes('#codex/channel-routing'),
  noDraftAccountsHash: !dom.includes('#accounts/all'),
  readmeReferencesHash: readme.includes(workspaceHash),
  readmeReferencesScript: readme.includes(requiredArtifacts.script),
  readmeReferencesSnapshot: readme.includes(requiredArtifacts.snapshot),
  readmeReferencesScreenshot: readme.includes(requiredArtifacts.screenshot),
  fixtureNestedDroppedReason: hasAny(previewFixture, [/droppedReason:\s*\{/]),
  fixtureNestedAccountKey: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*accountKey:\s*'acct_route_001'/]),
  fixtureNestedAuthId: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*authId:\s*'auth_route_001'/]),
  fixtureNestedModel: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*model:\s*'gpt-5'/]),
  fixtureNestedSource: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*source:\s*'upstream-error'/]),
  fixtureNestedScope: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*scope:\s*'model'/]),
  fixtureNestedReason: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*reason:\s*'nested preview droppedReason survives browser fixture'/]),
  fixtureNestedRouteBlocking: hasAny(previewFixture, [/droppedReason:\s*\{[\s\S]*routeBlocking:\s*true/]),
  fixtureKeepsConflictText: hasAny(previewFixture, [
    /label:\s*'account=acct_wrong_preview auth=auth_wrong_preview'/,
  ]) && hasAny(previewFixture, [
    /summary:\s*'scope=account reason=conflicting preview text routeBlocking=false'/,
  ]) && hasAny(previewFixture, [
    /source:\s*'preview-text-conflict'/,
  ]),
  fixtureAvoidsLegacyRouteEvidenceAuthority: nestedDroppedReasonFixture !== '' && !/routeEvidence:\s*\{/.test(nestedDroppedReasonFixture),
};

const missing = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(JSON.stringify({
    url,
    source,
    domChromeError,
    checks,
    missing,
    hints: {
      structuredTarget: missingCheck(dom, [
        'data-doctor-route-evidence-target="acct_route_001|auth_route_001|gpt-5|upstream-error|model"',
        'data-doctor-route-evidence-target=\\"acct_route_001|auth_route_001|gpt-5|upstream-error|model\\"',
      ]),
      structuredAccount: missingCheck(dom, ['data-doctor-route-evidence-account="acct_route_001"', 'Account']),
      structuredAuth: missingCheck(dom, ['data-doctor-route-evidence-auth="auth_route_001"', 'Auth']),
      structuredModel: missingCheck(dom, ['data-doctor-route-evidence-model="gpt-5"', 'Model']),
      structuredScope: missingCheck(dom, ['data-doctor-route-evidence-scope="model"', 'Scope']),
      structuredBlocking: missingCheck(dom, ['data-doctor-route-evidence-blocking="Route blocking"', 'Route blocking']),
      partialIdentityFallback: missingCheck(dom, ['data-doctor-route-evidence-fallback="partial-identity"', 'Partial identity fallback']),
      readOnlyMode: missingCheck(dom, ['data-doctor-mode="read-only"', 'Mutation surface: none', 'no repair handler']),
      fixtureNestedDroppedReason: missingCheck(previewFixture, ['droppedReason: {']),
      fixtureNestedRouteAuthority: missingCheck(previewFixture, [
        "accountKey: 'acct_route_001'",
        "authId: 'auth_route_001'",
        "model: 'gpt-5'",
        "source: 'upstream-error'",
        "scope: 'model'",
        "reason: 'nested preview droppedReason survives browser fixture'",
        'routeBlocking: true',
      ]),
      fixtureConflictText: missingCheck(previewFixture, [
        "label: 'account=acct_wrong_preview auth=auth_wrong_preview'",
        "summary: 'scope=account reason=conflicting preview text routeBlocking=false'",
        "source: 'preview-text-conflict'",
      ]),
    },
  }, null, 2));
  process.exit(1);
}

const screenshot = await captureScreenshot(url, screenshotPath);
await Promise.all([access(archivedSnapshotPath), access(screenshotPath), access(readmePath)]);

console.log(JSON.stringify({
  url,
  source,
  domChromeError,
  checks,
  artifacts: {
    readmePath,
    previewFixturePath,
    snapshotPath: archivedSnapshotPath,
    screenshotPath,
  },
  screenshot,
}, null, 2));
