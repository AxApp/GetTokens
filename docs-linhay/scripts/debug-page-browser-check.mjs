import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const playwrightModule = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = playwrightModule;

const appURL = 'http://127.0.0.1:4173/#frame=proxy-pool';
const outputDir = path.resolve('output/playwright');
const screenshotPath = path.join(outputDir, 'debug-page-browser-check.png');
const chromeExecutablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function buildMockEntries(count) {
  return Array.from({ length: count }, (_, index) => {
    const payloadItems = Array.from({ length: 80 }, (__, itemIndex) => ({
      id: `${index}-${itemIndex}`,
      label: `payload-${index}-${itemIndex}`,
      value: 'x'.repeat(64),
    }));

    return {
      id: `mock-${index}`,
      name: `MockRequest${index}`,
      transport: index % 2 === 0 ? 'http' : 'wails',
      status: index % 9 === 0 ? 'error' : 'success',
      request: {
        url: `/mock/${index}`,
        method: 'POST',
        headers: {
          authorization: 'Bearer masked',
          'content-type': 'application/json',
        },
        body: {
          items: payloadItems,
        },
      },
      response:
        index % 9 === 0
          ? undefined
          : {
              ok: true,
              result: payloadItems,
            },
      error: index % 9 === 0 ? `mock-error-${index}` : undefined,
      startedAt: new Date(Date.now() - index * 1000).toISOString(),
      endedAt: new Date(Date.now() - index * 1000 + 320).toISOString(),
      durationMs: 320,
    };
  });
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromeExecutablePath });
const page = await browser.newPage();

await page.addInitScript(() => {
  const listeners = new Map();
  const noop = () => {};
  const createOff = (eventName, callback) => () => {
    const current = listeners.get(eventName) || [];
    listeners.set(
      eventName,
      current.filter((item) => item !== callback),
    );
  };

  window.runtime = {
    LogPrint: noop,
    LogTrace: noop,
    LogDebug: noop,
    LogInfo: noop,
    LogWarning: noop,
    LogError: noop,
    LogFatal: noop,
    EventsOnMultiple(eventName, callback) {
      const current = listeners.get(eventName) || [];
      current.push(callback);
      listeners.set(eventName, current);
      return createOff(eventName, callback);
    },
    EventsOff(eventName, ...rest) {
      [eventName, ...rest].forEach((name) => listeners.delete(name));
    },
    EventsOffAll() {
      listeners.clear();
    },
    EventsEmit(eventName, ...args) {
      (listeners.get(eventName) || []).forEach((callback) => callback(...args));
    },
    ClipboardSetText: async () => {},
    ClipboardGetText: async () => '',
  };

  window.go = {
    main: {
      App: {
        GetVersion: async () => 'dev-browser',
        GetReleaseLabel: async () => 'dev-browser',
        GetSidecarStatus: async () => ({
          code: 'running',
          port: 18317,
          message: 'mocked browser runtime',
          version: 'dev-browser',
          startedAtUnix: Math.floor(Date.now() / 1000),
        }),
        CanApplyUpdate: async () => false,
        UsesNativeUpdaterUI: async () => false,
      },
    },
  };
});

page.on('console', (message) => {
  if (message.type() === 'error') {
    console.error(`[browser-console] ${message.text()}`);
  }
});

await page.goto(appURL, { waitUntil: 'networkidle' });
await page.waitForSelector('aside[data-collaboration-id="NAV_SIDEBAR"]');
console.log('[browser-check] app shell ready');

await page.evaluate((entries) => {
  window.dispatchEvent(new CustomEvent('debug:inject-entries', { detail: entries }));
}, buildMockEntries(300));
console.log('[browser-check] injected 300 mock entries');

const start = performance.now();
await page.getByRole('button', { name: /debug|调试面板/i }).click();
await page.waitForURL(/frame=debug/);
await page.waitForSelector('text=/300 UNITS/');
await page.waitForSelector('text=/展开详情|Expand/');
console.log('[browser-check] debug page opened');
const navigationDurationMs = performance.now() - start;

await page.getByRole('button', { name: /展开详情|Expand/i }).first().click();
await page.waitForSelector('text=/发送数据|Request/');
await page.waitForSelector('text=/响应数据|Response|错误响应|Error/');
console.log('[browser-check] first entry expanded');

await page.screenshot({ path: screenshotPath, fullPage: true });

const result = {
  navigationDurationMs: Math.round(navigationDurationMs),
  screenshotPath,
};

console.log(JSON.stringify(result, null, 2));

await browser.close();
