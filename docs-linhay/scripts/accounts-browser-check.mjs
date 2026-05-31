import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const chromeExecutablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.ACCOUNTS_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const screenshotDir = path.resolve(
  'docs-linhay/spaces/20260531-bug-fix/screenshots/20260531/accounts',
);

const scenarios = [
  {
    name: 'accounts-preview-mock-data',
    url: process.env.ACCOUNTS_PREVIEW_URL || `${baseURL}/#frame=accounts`,
    screenshotPath: path.join(screenshotDir, '20260531-accounts-browser-preview-mock-data-after-v01.png'),
    checks: {
      codexAuthFile: (dom) => dom.includes('codex-pro.json'),
      codexAPIKey: (dom) => dom.includes('Stable 001'),
      openAICompatible: (dom) => dom.includes('OPENAI-COMPATIBLE'),
      email: (dom) => dom.includes('ops-pro@example.com'),
    },
  },
  {
    name: 'accounts-detail-credential-quota-billing',
    url: `${baseURL}/#frame=accounts&detail=codex-api-key%3Amanual-disabled`,
    screenshotPath: path.join(screenshotDir, '20260531-accounts-credential-quota-billing-after-v01.png'),
    checks: {
      runtimeEvidenceMerged: (dom) => dom.includes('data-design-system-component-name="AccountRuntimeEvidenceSection"'),
      runtimeEvidenceLayout: (dom) => dom.includes('data-account-runtime-evidence-layout="merged"'),
      runtimeEvidenceSnapshot: (dom) => dom.includes('data-account-runtime-evidence-slot="snapshot"'),
      runtimeEvidenceAudit: (dom) => dom.includes('data-account-runtime-evidence-slot="audit"'),
      noStandaloneEvidenceSection: (dom) => !dom.includes('data-design-system-component-name="AccountEvidenceSection"'),
      credentialSectionWide: (dom) =>
        /data-design-system-component-name="AccountCredentialVerifySection"[^>]*class="[^"]*lg:col-span-2/.test(dom),
      credentialLabelsAbove: (dom) => dom.includes('data-account-credential-field-label="above"'),
      credentialNoEmbeddedLabels: (dom) => !dom.includes('data-account-credential-field-label="embedded"'),
      quotaEmptyState: (dom) =>
        dom.includes('暂无额度脚本，添加后可测试并展示额度')
        || dom.includes('暂无额度数据，可测试额度脚本确认接口返回'),
      billingEmptyState: (dom) => dom.includes('暂无余额脚本，添加后可测试并展示余额'),
      billingAddRight: (dom) => {
        const sectionIndex = dom.indexOf('data-design-system-component-name="AccountBillingSection"');
        if (sectionIndex < 0) return false;
        const tail = dom.slice(sectionIndex);
        const testIndex = tail.indexOf('测试余额');
        const addIndex = tail.indexOf('添加');
        return testIndex >= 0 && addIndex > testIndex;
      },
    },
  },
  {
    name: 'codex-detail-credential-proxy-wide',
    url: `${baseURL}/#frame=codex&workspace=account-list&detail=codex-api-key%3Astable-001`,
    screenshotPath: path.join(screenshotDir, '20260531-codex-detail-credential-proxy-wide-after-v01.png'),
    checks: {
      noSplitOverviewGrid: (dom) => !dom.includes('data-account-detail-overview-grid="runtime-evidence"'),
      credentialSectionWide: (dom) =>
        /data-design-system-component-name="AccountCredentialVerifySection"[^>]*class="[^"]*lg:col-span-2/.test(dom),
      verticalLayout: (dom) => dom.includes('data-account-credential-verify-layout="vertical"'),
      proxyFoldedIntoCredential: (dom) => dom.includes('data-account-credential-list-item="proxy-route"'),
      noStandaloneProxySection: (dom) => !dom.includes('data-design-system-component-name="AccountProxyRouteSection"'),
      credentialLabelsAbove: (dom) => dom.includes('data-account-credential-field-label="above"'),
      credentialNoEmbeddedLabels: (dom) => !dom.includes('data-account-credential-field-label="embedded"'),
      headerSummaryInline: (dom) =>
        /data-codex-account-detail-header="summary"[^>]*class="[^"]*flex/.test(dom),
    },
  },
];

async function dumpDOM(url) {
  const { stdout } = await execFileAsync(
    chromeExecutablePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--window-size=1440,1100',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=5000',
      '--dump-dom',
      url,
    ],
    { maxBuffer: 30 * 1024 * 1024 },
  );
  return stdout;
}

async function captureScreenshot(url, screenshotPath) {
  await mkdir(screenshotDir, { recursive: true });
  await execFileAsync(chromeExecutablePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1440,1100',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
    `--screenshot=${screenshotPath}`,
    url,
  ]);
}

const results = [];

for (const scenario of scenarios) {
  const dom = await dumpDOM(scenario.url);
  const checks = Object.fromEntries(
    Object.entries(scenario.checks).map(([key, check]) => [key, check(dom)]),
  );
  const missing = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(JSON.stringify({ scenario: scenario.name, url: scenario.url, checks, missing }, null, 2));
    process.exit(1);
  }

  await captureScreenshot(scenario.url, scenario.screenshotPath);
  results.push({
    scenario: scenario.name,
    url: scenario.url,
    checks,
    screenshotPath: scenario.screenshotPath,
  });
}

console.log(JSON.stringify(results, null, 2));
