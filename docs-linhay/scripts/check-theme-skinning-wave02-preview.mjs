#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseURL = process.env.THEME_SKINNING_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const shouldStartVite = process.env.THEME_SKINNING_START_VITE !== '0';
const spaceRoot = path.resolve(repoRoot, 'docs-linhay/spaces/20260519-theme-skinning');
const screenshotDir = path.join(spaceRoot, 'screenshots/20260619/theme-skinning');
const snapshotPath = path.join(spaceRoot, 'plans/20260619-wave-0-2-preview-snapshot-v01.md');

const screenshots = {
  settingsBaseline: path.join(screenshotDir, '20260619-theme-skinning-settings-baseline-v01.png'),
  settingsAfter: path.join(screenshotDir, '20260619-theme-skinning-settings-after-v01.png'),
  designSystemAfter: path.join(screenshotDir, '20260619-theme-skinning-design-system-after-v01.png'),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForURL(url, timeoutMs = 30000) {
  const start = Date.now();
  let lastError = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function startViteServer() {
  if (!shouldStartVite) {
    return null;
  }

  const child = spawn(
    'npm',
    ['--prefix', 'frontend', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    },
  );
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function waitForDevToolsPort(userDataDir, timeoutMs = 15000) {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(portFile)) {
      const [port] = (await readFile(portFile, 'utf8')).trim().split('\n');
      if (port) {
        return port;
      }
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

class CDPPage {
  constructor(wsURL) {
    this.ws = new WebSocket(wsURL);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) {
          reject(new Error(payload.error.message));
        } else {
          resolve(payload.result);
        }
        return;
      }
      const handlers = this.events.get(payload.method) || [];
      for (const handler of handlers) {
        handler(payload.params);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const handlers = this.events.get(method) || [];
        this.events.set(method, handlers.filter((entry) => entry !== handler));
        resolve(params);
      };
      const handlers = this.events.get(method) || [];
      handlers.push(handler);
      this.events.set(method, handlers);
    });
  }

  async close() {
    this.ws.close();
  }
}

async function createPage(devToolsPort, targetURL, preset) {
  const createResponse = await fetch(`http://127.0.0.1:${devToolsPort}/json/new?about:blank`, { method: 'PUT' });
  if (!createResponse.ok) {
    throw new Error(`Failed to create Chrome target: ${createResponse.status} ${createResponse.statusText}`);
  }
  const target = await createResponse.json();
  const page = new CDPPage(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.setItem('theme-mode', 'light');
      localStorage.setItem('theme-preset', ${JSON.stringify(preset)});
      localStorage.setItem('i18nextLng', 'zh');
    `,
  });
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url: targetURL });
  await loaded;
  await sleep(1500);
  return page;
}

async function evaluate(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

async function captureScreenshot(page, filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(result.data, 'base64'));
}

async function validateCase(devToolsPort, testCase) {
  const url = `${baseURL}/${testCase.hash}`;
  const page = await createPage(devToolsPort, url, testCase.preset);
  try {
    const checks = await evaluate(page, `(() => {
      const root = document.documentElement;
      const bodyText = document.body.innerText;
      const styles = getComputedStyle(root);
      const requiredSelectors = ${JSON.stringify(testCase.requiredSelectors)}.map((selector) => ({
        selector,
        found: Boolean(document.querySelector(selector)),
      }));
      const requiredTexts = ${JSON.stringify(testCase.requiredTexts)}.map((text) => ({
        text,
        found: bodyText.includes(text),
      }));
      return {
        title: document.title,
        url: location.href,
        themePreset: root.dataset.themePreset,
        inspectMode: root.getAttribute('data-design-system-inspect-mode') || '',
        surfaceCanvas: styles.getPropertyValue('--gt-surface-canvas').trim(),
        surfacePanel: styles.getPropertyValue('--gt-surface-panel').trim(),
        accentPrimary: styles.getPropertyValue('--gt-accent-primary').trim(),
        requiredSelectors,
        requiredTexts,
        visibleDesignSystemMarkers: Array.from(document.querySelectorAll('[data-design-system-component-name]'))
          .filter((element) => {
            const content = getComputedStyle(element, '::before').content;
            return content && content !== 'none' && content !== 'normal';
          })
          .map((element) => element.getAttribute('data-design-system-component-name')),
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth + 2,
      };
    })()`);

    const missingSelectors = checks.requiredSelectors.filter((entry) => !entry.found).map((entry) => entry.selector);
    const missingTexts = checks.requiredTexts.filter((entry) => !entry.found).map((entry) => entry.text);
    const failures = [];

    if (checks.themePreset !== testCase.preset) {
      failures.push(`themePreset=${checks.themePreset}, expected ${testCase.preset}`);
    }
    if (testCase.expectedSurfaceCanvas && checks.surfaceCanvas !== testCase.expectedSurfaceCanvas) {
      failures.push(`--gt-surface-canvas=${checks.surfaceCanvas}, expected ${testCase.expectedSurfaceCanvas}`);
    }
    if (missingSelectors.length > 0) {
      failures.push(`missing selectors: ${missingSelectors.join(', ')}`);
    }
    if (missingTexts.length > 0) {
      failures.push(`missing texts: ${missingTexts.join(', ')}`);
    }
    if (checks.hasHorizontalOverflow) {
      failures.push(`horizontal overflow: ${checks.scrollWidth} > ${checks.clientWidth}`);
    }
    if (checks.inspectMode !== '') {
      failures.push(`unexpected inspect mode: ${checks.inspectMode}`);
    }
    if (checks.visibleDesignSystemMarkers.length > 0) {
      failures.push(`visible design-system markers outside inspect mode: ${checks.visibleDesignSystemMarkers.join(', ')}`);
    }

    await captureScreenshot(page, testCase.screenshotPath);
    return {
      ...testCase,
      url,
      checks,
      screenshotPath: path.relative(repoRoot, testCase.screenshotPath),
      passed: failures.length === 0,
      failures,
    };
  } finally {
    await page.close();
  }
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(1500).then(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }),
  ]);
}

const cases = [
  {
    name: 'settings-classic-baseline',
    hash: '#frame=settings',
    preset: 'classic',
    expectedSurfaceCanvas: '#ffffff',
    requiredSelectors: [
      '[data-settings-antd-spike="true"]',
      '[data-settings-antd-spike="true"] .ant-segmented',
      '[data-settings-antd-spike="true"] .ant-switch',
      '[data-theme-preset-control="true"]',
    ],
    requiredTexts: ['界面风格', 'CLASSIC', 'PARCHMENT'],
    screenshotPath: screenshots.settingsBaseline,
  },
  {
    name: 'settings-parchment-after',
    hash: '#frame=settings',
    preset: 'parchment-trust-console',
    expectedSurfaceCanvas: '#f5f4ed',
    requiredSelectors: [
      '[data-settings-antd-spike="true"]',
      '[data-settings-antd-spike="true"] .ant-segmented',
      '[data-settings-antd-spike="true"] .ant-switch',
      '[data-theme-preset-control="true"]',
    ],
    requiredTexts: ['界面风格', 'CLASSIC', 'PARCHMENT'],
    screenshotPath: screenshots.settingsAfter,
  },
  {
    name: 'design-system-parchment-after',
    hash: '#frame=design-system',
    preset: 'parchment-trust-console',
    expectedSurfaceCanvas: '#f5f4ed',
    requiredSelectors: [],
    requiredTexts: ['设计系统'],
    screenshotPath: screenshots.designSystemAfter,
  },
];

let vite = null;
let chrome = null;
let userDataDir = null;

try {
  vite = startViteServer();
  await waitForURL(baseURL);

  userDataDir = await mkdtemp(path.join(tmpdir(), 'gettokens-theme-skinning-chrome-'));
  chrome = spawn(chromeExecutablePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  const devToolsPort = await waitForDevToolsPort(userDataDir);
  const results = [];
  for (const testCase of cases) {
    results.push(await validateCase(devToolsPort, testCase));
  }

  const failed = results.filter((result) => !result.passed);
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(
    snapshotPath,
    [
      '# Wave 0-2 preview snapshot',
      '',
      `- Captured: \`${new Date().toISOString()}\``,
      `- Base URL: \`${baseURL}\``,
      '- Browser: headless Chrome via DevTools Protocol',
      '- Scope: Settings theme preset picker and Design System theme preset baseline.',
      '',
      '## Results',
      '',
      ...results.flatMap((result) => [
        `### ${result.name}`,
        '',
        `- URL: \`${result.url}\``,
        `- Preset: \`${result.preset}\``,
        `- Screenshot: \`${result.screenshotPath}\``,
        `- CSS canvas token: \`${result.checks.surfaceCanvas}\``,
        `- Horizontal overflow: \`${result.checks.hasHorizontalOverflow ? 'yes' : 'no'}\``,
        `- Visible design-system markers: \`${result.checks.visibleDesignSystemMarkers.length}\``,
        `- Status: \`${result.passed ? 'passed' : 'failed'}\``,
        result.failures.length > 0 ? `- Failures: ${result.failures.join('; ')}` : '- Failures: none',
        '',
      ]),
    ].join('\n'),
    'utf8',
  );

  const summary = {
    baseURL,
    snapshotPath: path.relative(repoRoot, snapshotPath),
    results: results.map((result) => ({
      name: result.name,
      passed: result.passed,
      preset: result.preset,
      screenshotPath: result.screenshotPath,
      surfaceCanvas: result.checks.surfaceCanvas,
      failures: result.failures,
    })),
  };

  if (failed.length > 0) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await stopProcess(chrome);
  await stopProcess(vite);
  if (userDataDir) {
    await rm(userDataDir, { recursive: true, force: true });
  }
}
