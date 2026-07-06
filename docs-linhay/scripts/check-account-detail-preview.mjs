import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const chromeExecutablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.ACCOUNT_DETAIL_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const screenshotDir = path.resolve('docs-linhay/spaces/20260529-account-detail-ui/screenshots/20260706/accounts');

const scenarios = [
  {
    name: 'api-key-detail-credentials',
    url: `${baseURL}/?accountDetailSection=credentials#frame=accounts&detail=codex-api-key%3Astable-001`,
    screenshotPath: path.join(screenshotDir, '20260706-accounts-api-key-credentials-after-v01.png'),
    checks: {
      modal: (dom) => dom.includes('data-account-detail-modal="unified"'),
      credential: (dom) => dom.includes('data-design-system-component-name="AccountCredentialVerifySection"'),
      noLegacyBandGrid: (dom) => !dom.includes('data-account-detail-band-index'),
    },
  },
  {
    name: 'api-key-detail-models',
    url: `${baseURL}/?accountDetailSection=models#frame=accounts&detail=codex-api-key%3Astable-001`,
    screenshotPath: path.join(screenshotDir, '20260706-accounts-api-key-models-after-v01.png'),
    checks: {
      modal: (dom) => dom.includes('data-account-detail-modal="unified"'),
      modelMapping: (dom) => dom.includes('data-account-model-mapping-grid="source-route"'),
      noLegacyBandGrid: (dom) => !dom.includes('data-account-detail-band-index'),
    },
  },
  {
    name: 'auth-file-detail-config',
    url: `${baseURL}/?accountDetailSection=auth-file-actions#frame=accounts&detail=acct_preview_codex_pro_json`,
    screenshotPath: path.join(screenshotDir, '20260706-accounts-auth-file-config-after-v01.png'),
    checks: {
      modal: (dom) => dom.includes('data-account-detail-modal="unified"'),
      configApply: (dom) => dom.includes('data-auth-file-config-action="apply"'),
      configWritesAccountStore: (dom) => dom.includes('写回账号数据库并刷新运行时配置'),
      noPlaceholder: (dom) => !dom.includes('待接入 account-store management API'),
    },
  },
  {
    name: 'auth-file-detail-models',
    url: `${baseURL}/?accountDetailSection=models#frame=accounts&detail=acct_preview_codex_pro_json`,
    screenshotPath: path.join(screenshotDir, '20260706-accounts-auth-file-models-after-v01.png'),
    checks: {
      modal: (dom) => dom.includes('data-account-detail-modal="unified"'),
      modelMapping: (dom) => dom.includes('data-account-model-mapping-grid="source-route"'),
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
  await mkdir(path.dirname(screenshotPath), { recursive: true });
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
  const checks = Object.fromEntries(Object.entries(scenario.checks).map(([key, check]) => [key, check(dom)]));
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
    screenshotPath: path.relative(process.cwd(), scenario.screenshotPath),
  });
}

console.log(JSON.stringify(results, null, 2));
