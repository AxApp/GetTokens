import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const desktopURL = 'http://127.0.0.1:4173/?preview=vendor-status#frame=vendor-status';
const mobileURL = 'http://127.0.0.1:4173/?preview=vendor-status#frame=vendor-status';
const screenshotDir = path.resolve(
  'docs-linhay/spaces/20260430-openai-status-page/screenshots/20260430/openai-status-page',
);
const desktopScreenshotPath = path.join(
  screenshotDir,
  '20260430-openai-status-page-vendor-status-web-baseline-v01.png',
);
const mobileScreenshotPath = path.join(
  screenshotDir,
  '20260430-openai-status-page-vendor-status-mobile-baseline-v01.png',
);
const chromeExecutablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir(screenshotDir, { recursive: true });

async function captureScreenshot(url, outputPath, width, height) {
  await execFileAsync(chromeExecutablePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=5000',
    `--screenshot=${outputPath}`,
    url,
  ]);
}

await captureScreenshot(desktopURL, desktopScreenshotPath, 1600, 2200);
await captureScreenshot(mobileURL, mobileScreenshotPath, 430, 2200);

console.log(
  JSON.stringify(
    {
      desktopScreenshotPath,
      mobileScreenshotPath,
    },
    null,
    2,
  ),
);
