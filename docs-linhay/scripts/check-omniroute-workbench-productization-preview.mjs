#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.OMNIROUTE_WORKBENCH_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const workspaceHash = '#frame=codex&workspace=doctor-workbench';
const url = process.env.OMNIROUTE_WORKBENCH_PREVIEW_URL || `${baseURL}/${workspaceHash}`;
const spaceRoot = path.resolve('docs-linhay/spaces/20260618-omniroute-workbench-productization');
const screenshotDir = path.resolve(`${spaceRoot}/screenshots/20260618/workbench`);
const snapshotPath = path.resolve(`${spaceRoot}/plans/20260618-omniroute-workbench-preview-snapshot-v01.md`);
const screenshotPath = path.join(screenshotDir, '20260618-omniroute-workbench-preview-baseline-v01.png');
const readmePath = path.resolve(`${spaceRoot}/README.md`);
const planPath = path.resolve(`${spaceRoot}/plans/20260618-productization-plan-v01.md`);
const featureSourcePath = path.resolve('frontend/src/features/doctor-workbench/DoctorWorkbenchFeature.tsx');
const modelSourcePath = path.resolve('frontend/src/features/doctor-workbench/model/doctorWorkbench.ts');
const userDataDir = process.env.OMNIROUTE_WORKBENCH_CHROME_PROFILE || '/tmp/gettokens-omniroute-workbench-preview-chrome';

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
    '--window-size=1440,1200',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=6000',
  ];
}

function hasAny(content, patterns) {
  return patterns.some((pattern) => (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)));
}

function hasAll(content, patterns) {
  return patterns.every((pattern) => (pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern)));
}

function missingCheck(content, patterns) {
  return hasAny(content, patterns) ? null : patterns.map((pattern) => pattern.toString()).join(' | ');
}

async function readArtifact(filePath) {
  return readFile(filePath, 'utf8');
}

async function runChrome(args, options = {}) {
  const timeoutMs = Number(process.env.OMNIROUTE_WORKBENCH_CHROME_TIMEOUT_MS || 25000);
  try {
    return await execFileAsync(
      chromeExecutablePath,
      args,
      {
        maxBuffer: options.maxBuffer || 40 * 1024 * 1024,
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
      },
    );
  } catch (error) {
    if (error?.stdout) {
      return {
        stdout: error.stdout,
        stderr: error.stderr || '',
        timedOut: Boolean(error.killed),
        failed: true,
      };
    }
    throw error;
  }
}

async function dumpDOM(targetURL) {
  try {
    const { stdout } = await runChrome([...chromeFlags(), '--dump-dom', targetURL]);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(
      snapshotPath,
      [
        '# OmniRoute Workbench preview DOM snapshot',
        '',
        `- URL: \`${targetURL}\``,
        `- Captured: \`${new Date().toISOString()}\``,
        `- Source: \`chrome-headless\``,
        '',
        '```html',
        stdout,
        '```',
        '',
      ].join('\n'),
      'utf8',
    );
    return { dom: stdout, source: 'chrome' };
  } catch (error) {
    const snapshot = await readArtifact(snapshotPath);
    return { dom: snapshot, source: 'archived-productization-snapshot', chromeError: error.message };
  }
}

async function captureScreenshot(targetURL) {
  await mkdir(screenshotDir, { recursive: true });
  try {
    await runChrome([
      ...chromeFlags(),
      '--hide-scrollbars',
      `--screenshot=${screenshotPath}`,
      targetURL,
    ]);
    return { screenshotPath, source: 'chrome' };
  } catch (error) {
    await access(screenshotPath);
    return { screenshotPath, source: 'chrome-file-written-after-nonzero-exit', chromeError: error.message };
  }
}

const [readme, plan, featureSource, modelSource, { dom, source, chromeError: domChromeError }] = await Promise.all([
  readArtifact(readmePath),
  readArtifact(planPath),
  readArtifact(featureSourcePath),
  readArtifact(modelSourcePath),
  dumpDOM(url),
]);

const parsedURL = new URL(url);
const requiredArtifacts = {
  script: 'docs-linhay/scripts/check-omniroute-workbench-productization-preview.mjs',
  snapshot: 'plans/20260618-omniroute-workbench-preview-snapshot-v01.md',
  screenshot: 'screenshots/20260618/workbench/20260618-omniroute-workbench-preview-baseline-v01.png',
};

const checks = {
  workspaceHash: parsedURL.hash === workspaceHash,
  title: hasAny(dom, ['Doctor Workbench']),
  omniRouteSummary: hasAny(dom, [
    /data-omniroute-workbench-summary="true"/,
    'OmniRoute Workbench',
    'Failure explanation surface',
  ]),
  routeQuotaExtensionLedgerSignals: ['Route health', 'Quota health', 'Extension impact', 'Evidence ledger'].every((label) => dom.includes(label)),
  safeActionSurface: hasAny(dom, [
    /data-omniroute-workbench-action-surface="true"/,
    'Safe actions',
    'Controlled next steps',
  ]),
  routeRecheckAction: hasAny(dom, [
    /data-omniroute-workbench-action="route-recheck"/,
    'Route recheck',
    'Run recheck',
  ]),
  evidenceLedgerSurface: hasAny(dom, [
    /data-omniroute-workbench-ledger="true"/,
    'Evidence ledger',
  ]) && hasAll(dom, [
    /data-omniroute-workbench-ledger-entry="diagnostics-snapshot"/,
    /data-omniroute-workbench-ledger-entry="route-action-ledger"/,
    /data-omniroute-workbench-ledger-entry="extension-config-ledger"/,
  ]),
  checkFilterSurface: hasAny(dom, [
    /data-omniroute-workbench-check-filter-surface="true"/,
    'Check filters',
  ]) && hasAll(dom, [
    /data-omniroute-workbench-check-filter="all"/,
    /data-omniroute-workbench-check-filter="actionable"/,
    /data-omniroute-workbench-check-filter="route"/,
    /data-omniroute-workbench-check-filter="quota"/,
    /data-omniroute-workbench-check-filter="critical"/,
  ]),
  signalActionLinks: hasAll(dom, [
    /data-omniroute-workbench-signal-action="account-detail"/,
    /data-omniroute-workbench-signal-action="route-decisions"/,
    /data-omniroute-workbench-signal-action="quota-status"/,
    /data-omniroute-workbench-signal-action="quota-account-detail"/,
    /data-omniroute-workbench-signal-action="extension-registry"/,
  ]) && hasAll(dom, [
    '#frame=accounts&amp;detail=codex-api-key%3Astable-001',
    '#frame=codex&amp;workspace=account-list',
    '#frame=status',
    '#frame=codex&amp;workspace=extension-registry',
  ]),
  extensionStagedApplyBlocked: hasAny(dom, [
    /data-omniroute-workbench-action="extension-staged-apply"/,
    'Extension staged apply',
  ]) && hasAny(dom, [
    'real ~/.codex/config.toml write is out of scope',
    /data-omniroute-workbench-action-status="blocked"/,
  ]),
  sourceBoundary: hasAny(dom, ['Source boundary']) && hasAny(dom, ['Mutation surface: none', 'without repair mutations']),
  previewRuntimeBoundary: hasAny(dom, ['source=preview', 'preview-only']),
  modelSafeAction: hasAny(modelSource, [
    /deriveOmniRouteWorkbenchSafeActionSurface/,
    /Route recheck requires accountKey or authId/,
    /real ~\/\.codex\/config\.toml write is out of scope/,
  ]),
  featureRouteAction: hasAny(featureSource, [
    /RunRouteResilienceAction/,
    /RouteResilienceActionInput\.createFrom/,
    /recheck_routeability/,
    /doctor-workbench:route-recheck/,
  ]),
  featureSignalActionLinks: hasAny(featureSource, [
    /data-omniroute-workbench-signal-action=/,
    /data-omniroute-workbench-signal-action-kind=/,
    /data-omniroute-workbench-signal-primary-action=/,
  ]),
  noRealExtensionApplyInDoctor: !/PrepareGetTokensExtensionCodexConfigApply|ApplyGetTokensExtensionCodexConfigTransaction/.test(featureSource),
  readmeReferencesArtifacts: Object.values(requiredArtifacts).every((artifact) => readme.includes(artifact)),
  planReferencesArtifacts: Object.values(requiredArtifacts).every((artifact) => plan.includes(artifact)),
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
      omniRouteSummary: missingCheck(dom, ['data-omniroute-workbench-summary="true"', 'OmniRoute Workbench', 'Failure explanation surface']),
      safeActionSurface: missingCheck(dom, ['data-omniroute-workbench-action-surface="true"', 'Safe actions', 'Controlled next steps']),
      routeRecheckAction: missingCheck(dom, ['data-omniroute-workbench-action="route-recheck"', 'Route recheck', 'Run recheck']),
      evidenceLedgerSurface: missingCheck(dom, [
        'data-omniroute-workbench-ledger="true"',
        'Evidence ledger',
        'data-omniroute-workbench-ledger-entry="diagnostics-snapshot"',
        'data-omniroute-workbench-ledger-entry="route-action-ledger"',
        'data-omniroute-workbench-ledger-entry="extension-config-ledger"',
      ]),
      checkFilterSurface: missingCheck(dom, [
        'data-omniroute-workbench-check-filter-surface="true"',
        'Check filters',
        'data-omniroute-workbench-check-filter="all"',
        'data-omniroute-workbench-check-filter="actionable"',
        'data-omniroute-workbench-check-filter="route"',
        'data-omniroute-workbench-check-filter="quota"',
        'data-omniroute-workbench-check-filter="critical"',
      ]),
      signalActionLinks: missingCheck(dom, [
        'data-omniroute-workbench-signal-action="account-detail"',
        'data-omniroute-workbench-signal-action="route-decisions"',
        'data-omniroute-workbench-signal-action="quota-status"',
        'data-omniroute-workbench-signal-action="quota-account-detail"',
        'data-omniroute-workbench-signal-action="extension-registry"',
      ]),
      extensionStagedApplyBlocked: missingCheck(dom, ['data-omniroute-workbench-action="extension-staged-apply"', 'Extension staged apply', 'real ~/.codex/config.toml write is out of scope']),
      requiredArtifacts,
    },
  }, null, 2));
  process.exit(1);
}

const screenshot = await captureScreenshot(url);
await Promise.all([access(snapshotPath), access(screenshotPath), access(readmePath), access(planPath)]);

console.log(JSON.stringify({
  url,
  source,
  domChromeError,
  checks,
  artifacts: {
    readmePath,
    planPath,
    snapshotPath,
    screenshotPath,
  },
  screenshot,
}, null, 2));
