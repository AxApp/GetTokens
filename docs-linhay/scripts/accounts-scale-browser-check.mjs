import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createConnection, createServer } from 'node:net';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const chromeExecutablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const previewBaseURL = process.env.ACCOUNTS_PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const previewCount = Number.parseInt(process.env.ACCOUNTS_PREVIEW_COUNT || '1652', 10);
const maxRenderedCards = Number.parseInt(process.env.ACCOUNTS_SCALE_MAX_RENDERED_CARDS || '180', 10);
const maxSpacerEstimateRatio = Number.parseFloat(process.env.ACCOUNTS_SCALE_MAX_SPACER_ESTIMATE_RATIO || '1.35');
const previewHash = normalizePreviewHash(process.env.ACCOUNTS_PREVIEW_HASH || 'frame=accounts');
const caseSlug = sanitizeSlug(process.env.ACCOUNTS_SCALE_CASE || previewHash);
const screenshotDir = path.resolve(
  'docs-linhay/spaces/20260608-account-pool-scale-optimization/screenshots/20260609/accounts-scale',
);
const initialScreenshotPath = path.join(screenshotDir, `20260609-accounts-scale-${caseSlug}-initial-baseline-v01.png`);
const scrolledScreenshotPath = path.join(screenshotDir, `20260609-accounts-scale-${caseSlug}-scrolled-baseline-v01.png`);

const url = `${previewBaseURL}/?preview=accounts&accountsPreviewCount=${previewCount}#${previewHash}`;

const port = await findFreePort();
const userDataDir = path.join('/tmp', `gettokens-accounts-scale-chrome-${process.pid}`);
const chrome = spawn(chromeExecutablePath, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDataDir}`,
  `--remote-debugging-port=${port}`,
  '--window-size=1440,1100',
  'about:blank',
], {
  stdio: ['ignore', 'ignore', 'pipe'],
});

let chromeStderr = '';
chrome.stderr.on('data', (chunk) => {
  chromeStderr += String(chunk);
});

try {
  await waitForDevTools(port);
  const target = await createPageTarget(port, url);
  const socket = await connectWebSocket(target.webSocketDebuggerUrl);
  const cdp = createCDPClient(socket);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url });
  await waitForPageLoad(cdp);
  await waitForAccountCards(cdp);
  await mkdir(screenshotDir, { recursive: true });

  const initialMetrics = await evaluateJSON(cdp, collectAccountScaleMetricsExpression());
  validateMetrics('initial', initialMetrics);
  await captureScreenshot(cdp, initialScreenshotPath);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const target = Array.from(document.querySelectorAll('*'))
        .filter((node) => node instanceof HTMLElement)
        .map((node) => ({
          node,
          overflowY: getComputedStyle(node).overflowY,
          scrollRoom: node.scrollHeight - node.clientHeight,
        }))
        .filter((item) => item.scrollRoom > 300 && /auto|scroll|overlay/.test(item.overflowY))
        .sort((a, b) => b.scrollRoom - a.scrollRoom)[0]?.node;
      if (target) {
        target.scrollTop = Math.max(target.scrollHeight * 0.65, 1200);
      } else {
        window.scrollTo(0, Math.max(document.documentElement.scrollHeight * 0.65, 1200));
      }
    })(); undefined`,
    awaitPromise: true,
  });
  await delay(800);
  const scrolledMetrics = await evaluateJSON(cdp, collectAccountScaleMetricsExpression());
  validateMetrics('scrolled', scrolledMetrics);
  validateScrollChanged(initialMetrics, scrolledMetrics);
  await captureScreenshot(cdp, scrolledScreenshotPath);

  const summary = {
    url,
    previewHash,
    caseSlug,
    previewCount,
    maxRenderedCards,
    initial: initialMetrics,
    scrolled: scrolledMetrics,
    screenshots: {
      initial: initialScreenshotPath,
      scrolled: scrolledScreenshotPath,
    },
  };
  console.log(JSON.stringify(summary, null, 2));

  socket.end();
} finally {
  chrome.kill('SIGTERM');
}

function validateMetrics(label, metrics) {
  const failures = [];
  if (metrics.totalPreviewAccounts < previewCount) {
    failures.push(`expected at least ${previewCount} preview accounts, got ${metrics.totalPreviewAccounts}`);
  }
  if (metrics.renderedCards <= 0) {
    failures.push('expected rendered account cards');
  }
  if (metrics.renderedCards > maxRenderedCards) {
    failures.push(`expected rendered cards <= ${maxRenderedCards}, got ${metrics.renderedCards}`);
  }
  if (metrics.virtualizedGroups < 1) {
    failures.push('expected at least one virtualized group');
  }
  if (!metrics.virtualWindows.some((item) => item.window && item.window !== '0:0')) {
    failures.push('expected at least one non-empty virtual render window');
  }
  const missingMeasuredRows = metrics.virtualWindows.filter((item) => item.bottomSpacer > 0 && !(item.measuredRowHeight > 0));
  if (missingMeasuredRows.length > 0) {
    failures.push(`expected measurable row heights for bottom spacers: ${missingMeasuredRows.map((item) => item.group).join(', ')}`);
  }
  const excessiveSpacerRatios = metrics.virtualWindows.filter(
    (item) => item.spacerEstimateRatio > maxSpacerEstimateRatio,
  );
  if (excessiveSpacerRatios.length > 0) {
    failures.push(
      `expected spacer estimate ratio <= ${maxSpacerEstimateRatio}, got ${excessiveSpacerRatios
        .map((item) => `${item.group}:${item.spacerEstimateRatio.toFixed(2)}`)
        .join(', ')}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(`${label} account scale check failed: ${failures.join('; ')}\n${JSON.stringify(metrics, null, 2)}`);
  }
}

function validateScrollChanged(initialMetrics, scrolledMetrics) {
  const scrolledContainer = scrolledMetrics.scrollContainers.some((item) => item.scrollTop > 0);
  const changedWindow = scrolledMetrics.virtualWindows.some((item, index) => {
    const initial = initialMetrics.virtualWindows[index];
    return initial && (item.window !== initial.window || item.topSpacer !== initial.topSpacer);
  });
  if (!scrolledContainer || !changedWindow) {
    throw new Error(`scroll account scale check failed: expected scrollTop and virtual window change\n${JSON.stringify({ initialMetrics, scrolledMetrics }, null, 2)}`);
  }
}

function collectAccountScaleMetricsExpression() {
  return `(() => {
    const cards = Array.from(document.querySelectorAll('[data-account-card]'));
    const groups = Array.from(document.querySelectorAll('[data-plan-group-grid]'));
    const virtualizedGroups = groups.filter((node) => node.getAttribute('data-account-group-virtualized') === 'true');
    const scrollContainers = Array.from(document.querySelectorAll('*'))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        className: typeof node.className === 'string' ? node.className : '',
        overflowY: getComputedStyle(node).overflowY,
        scrollTop: node.scrollTop,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }))
      .filter((item) => item.scrollHeight - item.clientHeight > 300 && /auto|scroll|overlay/.test(item.overflowY))
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))
      .slice(0, 3);
    const groupMeta = Array.from(document.querySelectorAll('section p')).map((node) => node.textContent || '');
    const totalPreviewAccounts = groupMeta.reduce((sum, text) => {
      const match = text.match(/(\\d+)\\s+项资产/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
    return {
      renderedCards: cards.length,
      firstRenderedCardID: cards[0]?.getAttribute('data-account-card-id') || '',
      lastRenderedCardID: cards[cards.length - 1]?.getAttribute('data-account-card-id') || '',
      totalPreviewAccounts,
      groupCount: groups.length,
      virtualizedGroups: virtualizedGroups.length,
      virtualWindows: virtualizedGroups.map((node) => {
        const windowValue = node.getAttribute('data-account-group-render-window') || '';
        const [startIndex, endIndex] = windowValue.split(':').map((value) => Number.parseInt(value || '0', 10));
        const style = getComputedStyle(node);
        const columns = Math.max(1, countGridColumns(style.gridTemplateColumns));
        const groupText = node.closest('section')?.querySelector('[data-account-group-header="true"] p')?.textContent || '';
        const groupCountMatch = groupText.match(/(\\d+)\\s+项资产/);
        const groupItemCount = groupCountMatch ? Number(groupCountMatch[1]) : 0;
        const rowCount = groupItemCount > 0 ? Math.ceil(groupItemCount / columns) : 0;
        const endRow = Number.isFinite(endIndex) ? Math.ceil(endIndex / columns) : 0;
        const remainingRows = Math.max(0, rowCount - endRow);
        const rowGap = Number.parseFloat(style.rowGap || '0') || 0;
        const measuredRowHeight = measureRenderedRowHeight(node, rowGap);
        const topSpacer = Number(node.querySelector('[data-account-group-virtual-spacer="top"]')?.style.height?.replace('px', '') || 0);
        const bottomSpacer = Number(node.querySelector('[data-account-group-virtual-spacer="bottom"]')?.style.height?.replace('px', '') || 0);
        const expectedBottomSpacer = measuredRowHeight > 0 ? remainingRows * measuredRowHeight : 0;
        const spacerEstimateRatio = expectedBottomSpacer > 0
          ? bottomSpacer / expectedBottomSpacer
          : bottomSpacer > 0 ? Number.POSITIVE_INFINITY : 1;
        return {
          group: node.getAttribute('data-plan-group-grid') || '',
          window: windowValue,
          cardCount: node.querySelectorAll('[data-account-card]').length,
          columns,
          groupItemCount,
          remainingRows,
          measuredRowHeight,
          spacerEstimateRatio,
          topSpacer,
          bottomSpacer,
        };
      }),
      scrollY: window.scrollY,
      scrollContainers,
      documentHeight: document.documentElement.scrollHeight,
    };

    function countGridColumns(value) {
      const normalized = String(value || '').trim();
      if (!normalized || normalized === 'none') {
        return 0;
      }
      return normalized.split(/\\s+/).filter(Boolean).length;
    }

    function measureRenderedRowHeight(groupNode, rowGap) {
      const groupRect = groupNode.getBoundingClientRect();
      const cards = Array.from(groupNode.querySelectorAll('[data-account-card]'))
        .map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            top: Math.round(rect.top - groupRect.top),
            height: rect.height,
          };
        })
        .filter((item) => Number.isFinite(item.top) && item.height > 0);
      const rowTops = Array.from(new Set(cards.map((card) => card.top))).sort((a, b) => a - b);
      if (rowTops.length > 1) {
        return Math.max(1, rowTops[1] - rowTops[0]);
      }
      const maxCardHeight = cards.reduce((max, card) => Math.max(max, card.height), 0);
      return maxCardHeight > 0 ? Math.round(maxCardHeight + rowGap) : 0;
    }
  })()`;
}

async function captureScreenshot(cdp, outputPath) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await import('node:fs/promises').then(({ writeFile }) => writeFile(outputPath, Buffer.from(result.data, 'base64')));
}

async function waitForAccountCards(cdp) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const metrics = await evaluateJSON(cdp, `(() => ({
      cards: document.querySelectorAll('[data-account-card]').length,
      virtualized: document.querySelectorAll('[data-account-group-virtualized="true"]').length,
    }))()`);
    if (metrics.cards > 0 && metrics.virtualized > 0) {
      return;
    }
    await delay(150);
  }
  throw new Error('timed out waiting for account cards and virtualized groups');
}

async function evaluateJSON(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function waitForPageLoad(cdp) {
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000);
    cdp.once('Page.loadEventFired', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createCDPClient(socket) {
  let nextID = 1;
  const pending = new Map();
  const listeners = new Map();
  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const parsed = readWebSocketFrame(buffer);
      if (!parsed) {
        break;
      }
      buffer = buffer.subarray(parsed.length);
      if (parsed.opcode === 0x8) {
        socket.end();
        break;
      }
      if (parsed.opcode !== 0x1) {
        continue;
      }
      const message = JSON.parse(parsed.payload.toString('utf8'));
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        continue;
      }
      if (message.method && listeners.has(message.method)) {
        const callbacks = listeners.get(message.method);
        listeners.delete(message.method);
        callbacks.forEach((callback) => callback(message.params || {}));
      }
    }
  });

  return {
    send(method, params = {}) {
      const id = nextID++;
      const payload = Buffer.from(JSON.stringify({ id, method, params }));
      socket.write(encodeWebSocketFrame(payload));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    once(method, callback) {
      const callbacks = listeners.get(method) || [];
      callbacks.push(callback);
      listeners.set(method, callbacks);
    },
  };
}

async function createPageTarget(port, targetURL) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetURL)}`, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`create Chrome target failed: ${response.status}`);
  }
  return response.json();
}

async function waitForDevTools(port) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome DevTools did not start on port ${port}: ${chromeStderr}`);
}

async function connectWebSocket(wsURL) {
  const url = new URL(wsURL);
  const key = randomBytes(16).toString('base64');
  const socket = await new Promise((resolve, reject) => {
    const client = createConnectionWithTimeout({
      host: url.hostname,
      port: Number(url.port),
    }, reject);
    client.once('connect', () => {
      client.write([
        `GET ${url.pathname}${url.search} HTTP/1.1`,
        `Host: ${url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'));
    });
    let handshake = Buffer.alloc(0);
    client.on('data', function onHandshake(chunk) {
      handshake = Buffer.concat([handshake, chunk]);
      const marker = handshake.indexOf('\r\n\r\n');
      if (marker < 0) {
        return;
      }
      client.off('data', onHandshake);
      const header = handshake.subarray(0, marker).toString('utf8');
      if (!/^HTTP\/1\.[01]\s+101\b/.test(header)) {
        reject(new Error(`websocket handshake failed: ${header}`));
        client.destroy();
        return;
      }
      const remainder = handshake.subarray(marker + 4);
      if (remainder.length > 0) {
        queueMicrotask(() => client.emit('data', remainder));
      }
      resolve(client);
    });
    client.once('error', reject);
  });
  return socket;
}

function createConnectionWithTimeout(options, reject) {
  const client = createConnection(options);
  const timer = setTimeout(() => {
    client.destroy();
    reject(new Error('websocket connection timeout'));
  }, 5000);
  client.once('connect', () => clearTimeout(timer));
  return client;
}

function readWebSocketFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  let offset = 2;
  let length = second & 0x7f;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    length = high * 2 ** 32 + low;
    offset += 8;
  }
  const masked = Boolean(second & 0x80);
  const maskOffset = offset;
  if (masked) {
    offset += 4;
  }
  if (buffer.length < offset + length) {
    return null;
  }
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    const mask = buffer.subarray(maskOffset, maskOffset + 4);
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }
  return {
    opcode,
    payload,
    length: offset + length,
  };
}

function encodeWebSocketFrame(payload) {
  const mask = randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(payload.length, 6);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

async function findFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

function normalizePreviewHash(value) {
  const normalized = String(value || '').trim().replace(/^#/, '');
  if (!normalized) {
    return 'frame=accounts';
  }
  const params = new URLSearchParams(normalized);
  if (!params.get('frame')) {
    params.set('frame', 'accounts');
  }
  return params.toString();
}

function sanitizeSlug(value) {
  return String(value || 'accounts')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'accounts';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
