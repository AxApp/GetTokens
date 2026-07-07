#!/usr/bin/env node
import { access, mkdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.GETTOKENS_EXTENSION_REGISTRY_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const workspaceHash = '#frame=codex&workspace=extension-registry';
const url = process.env.GETTOKENS_EXTENSION_REGISTRY_PREVIEW_URL || `${baseURL}/${workspaceHash}`;
const spaceRoot = path.resolve('docs-linhay/spaces/20260616-extension-contract-v0');
const screenshotDir = path.resolve(
  `${spaceRoot}/screenshots/20260617/extension-registry`,
);
const archivedSnapshotPath = path.resolve(
  `${spaceRoot}/plans/20260617-extension-registry-playwright-snapshot-v01.md`,
);
const screenshotPath = path.join(
  screenshotDir,
  '20260617-extension-registry-playwright-baseline-v01.png',
);
const readmePath = path.resolve(`${spaceRoot}/README.md`);
const userDataDir = process.env.GETTOKENS_EXTENSION_REGISTRY_CHROME_PROFILE || '/tmp/gettokens-extension-registry-preview-chrome';
const chromeTimeoutMs = Number(process.env.GETTOKENS_EXTENSION_REGISTRY_CHROME_TIMEOUT_MS || 30000);

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

async function readArtifact(filePath) {
  return readFile(filePath, 'utf8');
}

async function dumpDOM(targetURL) {
  try {
    const { stdout } = await execFileAsync(
      chromeExecutablePath,
      [...chromeFlags(), '--dump-dom', targetURL],
      { maxBuffer: 30 * 1024 * 1024, timeout: chromeTimeoutMs },
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
    await execFileAsync(chromeExecutablePath, [...chromeFlags(), '--hide-scrollbars', `--screenshot=${outputPath}`, targetURL], {
      timeout: chromeTimeoutMs,
    });
    return { screenshotPath: outputPath, source: 'chrome' };
  } catch (error) {
    await access(screenshotPath);
    return { screenshotPath, source: 'archived-playwright-screenshot', chromeError: error.message };
  }
}

const [readme, { dom, source, chromeError: domChromeError }] = await Promise.all([
  readArtifact(readmePath),
  dumpDOM(url),
]);

const parsedURL = new URL(url);
const requiredArtifacts = {
  script: 'docs-linhay/scripts/check-gettokens-extension-registry-preview.mjs',
  snapshot: 'plans/20260617-extension-registry-playwright-snapshot-v01.md',
  screenshot: 'screenshots/20260617/extension-registry/20260617-extension-registry-playwright-baseline-v01.png',
};

const checks = {
  workspaceHash: parsedURL.hash === workspaceHash,
  workspaceEntry: hasAny(dom, ['Extension Registry', "workspace === 'extension-registry'"]),
  title: hasAny(dom, ['GetTokens Extension Registry']),
  collaboration: hasAny(dom, ['PAGE_GETTOKENS_EXTENSION_REGISTRY', 'AssetWorkbenchShell']),
  registryPageBoundary: hasAny(dom, ['Local enable-state only', 'Read-only only']) &&
    hasAny(dom, ['mode read-only', 'data-gettokens-extension-enable-action=']),
  localEnableStateBoundary: hasAny(dom, ['Local enable-state only', 'dev/app-local extension enable-state file', 'data-gettokens-extension-enable-action=']) ||
    (readme.includes('SetGetTokensExtensionEnabled') && readme.includes('不写 Codex config') && readme.includes('不执行 capability')),
  rootMarkers: hasAny(dom, [/data-gettokens-extension-registry-root=/, /\bRoots\b/]) &&
    hasAny(dom, ['app-owned', 'bundled', 'extensions']),
  diagnosticMarkers: hasAny(dom, [/data-gettokens-extension-registry-diagnostic=/, /Registry Diagnostics/]) &&
    hasAny(dom, ['unknown-capability-kind', 'forbidden-permission', 'extension-root-not-found', 'No registry diagnostics']),
  capabilityMarkers: ['quota-probe', 'provider-metadata', 'model-catalog-source'].every((marker) => dom.includes(marker)),
  sourceMarkers: hasAny(dom, [/data-gettokens-extension-registry-source="true"/, /\bManifest\b/, /\bSource\b/]),
  stagedApplyTestSurface: hasAny(dom, [
    /data-gettokens-extension-codex-config-staged-apply="true"/,
    'Staged Temp Apply',
  ]) && hasAny(dom, [
    '/tmp/gettokens-extension-codex-config-staged-preview.toml',
    'staged-preview.toml',
  ]),
  stagedApplyActions: hasAny(dom, [
    /data-gettokens-extension-codex-config-staged-apply-action="prepare"/,
    'Prepare Test Plan',
  ]) && hasAny(dom, [
    /data-gettokens-extension-codex-config-staged-apply-action="apply"/,
    'Apply Test Transaction',
  ]),
  stagedApplyRuntimeBoundary: hasAny(dom, [
    'Wails runtime is required before staged test apply can run',
    'status=blocked',
  ]) && hasAny(dom, [
    'staged-preview.toml',
    '/tmp/gettokens-extension-codex-config-staged-preview.toml',
  ]),
  noForbiddenMutationBindings: !/SaveGetTokensExtension|EnableGetTokensExtension|DisableGetTokensExtension|RunGetTokensExtensionCapability|SaveCodex|RemoveCodex|PreflightCodexMcpServer/.test(dom),
  noMarketplace: !/marketplace/i.test(dom),
  readmeReferencesHash: readme.includes(workspaceHash),
  readmeReferencesScript: readme.includes(requiredArtifacts.script),
  readmeReferencesSnapshot: readme.includes(requiredArtifacts.snapshot),
  readmeReferencesScreenshot: readme.includes(requiredArtifacts.screenshot),
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
      workspaceHash: workspaceHash,
      workspaceEntry: missingCheck(dom, ['Extension Registry', "workspace === 'extension-registry'"]),
      registryPageBoundary: missingCheck(dom, ['Read-only only', 'mode read-only', 'Local enable-state only', 'dev/app-local extension enable-state file']),
      localEnableStateBoundary: missingCheck(dom, ['Local enable-state only', 'dev/app-local extension enable-state file', 'data-gettokens-extension-enable-action=']),
      rootMarkers: missingCheck(dom, ['data-gettokens-extension-registry-root=', 'Roots', 'app-owned|bundled|extensions']),
      diagnosticMarkers: missingCheck(dom, ['data-gettokens-extension-registry-diagnostic=', 'Registry Diagnostics', 'unknown-capability-kind|forbidden-permission|extension-root-not-found|No registry diagnostics']),
      capabilityMarkers: missingCheck(dom, ['quota-probe', 'provider-metadata', 'model-catalog-source']),
      sourceMarkers: missingCheck(dom, ['data-gettokens-extension-registry-source="true"', 'Manifest', 'Source']),
      stagedApplyTestSurface: missingCheck(dom, ['data-gettokens-extension-codex-config-staged-apply="true"', 'Staged Temp Apply', 'staged-preview.toml']),
      stagedApplyActions: missingCheck(dom, ['data-gettokens-extension-codex-config-staged-apply-action="prepare"', 'Prepare Test Plan', 'data-gettokens-extension-codex-config-staged-apply-action="apply"', 'Apply Test Transaction']),
      stagedApplyRuntimeBoundary: missingCheck(dom, ['Wails runtime is required before staged test apply can run', 'status=blocked', 'staged-preview.toml']),
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
    snapshotPath: archivedSnapshotPath,
    screenshotPath,
  },
  screenshot,
}, null, 2));
