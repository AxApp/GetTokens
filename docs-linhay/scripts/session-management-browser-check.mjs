import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const chromeExecutablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const screenshotDir = path.resolve(
  'docs-linhay/spaces/20260429-nolon-session-management/screenshots/20260430/session-management',
);
const pageScreenshotPath = path.join(
  screenshotDir,
  '20260430-session-management-project-sessions-page-baseline-v01.png',
);
const modalScreenshotPath = path.join(
  screenshotDir,
  '20260430-session-management-session-detail-modal-baseline-v01.png',
);

async function captureScreenshot(url, outputPath) {
  await execFileAsync(chromeExecutablePath, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1600,1200',
    `--screenshot=${outputPath}`,
    url,
  ]);
}

await mkdir(screenshotDir, { recursive: true });

await captureScreenshot(
  'http://127.0.0.1:4173/?preview=session-management#frame=session-management',
  pageScreenshotPath,
);

await captureScreenshot(
  'http://127.0.0.1:4173/?preview=session-management&detail=session-gettokens-01#frame=session-management',
  modalScreenshotPath,
);

console.log(
  JSON.stringify(
    {
      pageScreenshotPath,
      modalScreenshotPath,
    },
    null,
    2,
  ),
);
