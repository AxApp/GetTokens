import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const SESSION_PATH_PATTERN = /\/Users\/[^/\s]+(?:\/[^\s"'<>]+)*/g;
const SESSION_CALL_ID_PATTERN = /\bcall[_-]?[A-Za-z0-9_-]+\b/g;
const SESSION_HEX_ID_PATTERN = /\b[0-9a-f]{8,}\b/gi;
const SESSION_WHITESPACE_PATTERN = /\s+/g;

let snapshotCache = null;
let snapshotCacheUpdatedAt = 0;
let snapshotRefreshPromise = null;

function resolveSnapshotCachePath() {
  return path.join(resolveCodexHome(), '.gettokens-session-management-snapshot-cache.json');
}

async function hydrateSnapshotCacheFromDisk() {
  try {
    const raw = await fs.readFile(resolveSnapshotCachePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.projects)) {
      snapshotCache = parsed;
      snapshotCacheUpdatedAt = Date.now();
    }
  } catch {
    // Ignore cache hydration failures.
  }
}

async function persistSnapshotCacheToDisk(snapshot) {
  try {
    await fs.writeFile(resolveSnapshotCachePath(), JSON.stringify(snapshot), 'utf8');
  } catch {
    // Ignore disk cache failures.
  }
}

function resolveCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walkRolloutPaths(rootPath, output) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await walkRolloutPaths(absolutePath, output);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      output.push(absolutePath);
    }
  }
}

async function listCodexRolloutPaths(codexHome) {
  const roots = [
    path.join(codexHome, 'sessions'),
    path.join(codexHome, 'archived_sessions'),
  ];
  const paths = [];
  for (const rootPath of roots) {
    if (!(await pathExists(rootPath))) {
      continue;
    }
    await walkRolloutPaths(rootPath, paths);
  }
  return paths.sort();
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (!items.length) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

function sanitizeSessionText(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(SESSION_PATH_PATTERN, '<redacted-path>')
    .replace(SESSION_CALL_ID_PATTERN, '[调用ID]')
    .replace(SESSION_HEX_ID_PATTERN, '[会话ID]')
    .replace(SESSION_WHITESPACE_PATTERN, ' ')
    .trim();
}

function firstRunes(value, limit) {
  const text = String(value || '').trim();
  const runes = [...text];
  if (runes.length <= limit) {
    return text;
  }
  return `${runes.slice(0, limit).join('')}…`;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function normalizeProvider(modelProvider, model) {
  const provider = String(modelProvider || '').trim().toLowerCase();
  if (provider.includes('gemini')) {
    return 'gemini';
  }
  if (provider) {
    return provider;
  }
  const normalizedModel = String(model || '').trim().toLowerCase();
  if (normalizedModel.includes('gemini')) {
    return 'gemini';
  }
  if (
    normalizedModel.includes('gpt') ||
    normalizedModel.includes('codex') ||
    normalizedModel.includes('o1') ||
    normalizedModel.includes('o3') ||
    normalizedModel.includes('o4')
  ) {
    return 'openai';
  }
  if (normalizedModel.includes('claude')) {
    return 'anthropic';
  }
  return 'unknown';
}

function deriveProjectName(meta, relativePath) {
  const cwd = String(meta?.cwd || '').trim();
  if (cwd) {
    return path.basename(cwd);
  }
  const repositoryURL = String(meta?.git?.repository_url || meta?.git?.repositoryURL || '').trim();
  if (repositoryURL) {
    return repositoryURL.replace(/\.git$/, '').split('/').at(-1) || '未知项目';
  }
  return relativePath.startsWith('archived_sessions/') ? '归档会话' : '未知项目';
}

function resolveSessionStatus(relativePath) {
  return relativePath.startsWith('archived_sessions/') ? 'archived' : 'active';
}

function formatRoleSummary(roleCounts) {
  return `用户 ${roleCounts.user || 0} / 助手 ${roleCounts.assistant || 0} / 系统 ${roleCounts.system || 0}`;
}

function formatCurrentMessageLabel(messages) {
  if (!messages.length) {
    return '00 / 系统';
  }
  const roleMap = {
    system: '系统',
    user: '用户',
    assistant: '助手',
  };
  const role = roleMap[messages.at(-1).role] || '系统';
  return `${String(messages.length).padStart(2, '0')} / ${role}`;
}

function formatProviderSummary(counts) {
  const entries = Object.entries(counts).sort((left, right) => {
    if (left[1] === right[1]) {
      return left[0].localeCompare(right[0]);
    }
    return right[1] - left[1];
  });
  if (!entries.length) {
    return 'openai 0';
  }
  return entries.map(([provider, count]) => `${provider} ${count}`).join(' / ');
}

function looksSensitive(role, text) {
  const lowered = String(text || '').toLowerCase();
  return role === 'system' && (lowered.includes('<permissions instructions>') || lowered.length > 500);
}

function getMessageText(contentItems) {
  if (!Array.isArray(contentItems)) {
    return '';
  }
  return contentItems
    .map((item) => item?.text || item?.content || '')
    .filter(Boolean)
    .join(' ');
}

async function parseSessionFile(codexHome, absolutePath) {
  const relativePath = path.relative(codexHome, absolutePath).split(path.sep).join('/');
  const raw = await fs.readFile(absolutePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const roleCounts = { system: 0, user: 0, assistant: 0 };
  const messages = [];
  let firstTimestamp = '';
  let lastTimestamp = '';
  let meta = {};
  let firstUserText = '';
  let lastAssistantText = '';
  let model = '';
  let provider = '';

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const timestamp = entry?.timestamp || '';
    if (!firstTimestamp && timestamp) {
      firstTimestamp = timestamp;
    }
    if (timestamp) {
      lastTimestamp = timestamp;
    }

    if (entry?.type === 'session_meta') {
      meta = entry?.payload || {};
      provider = String(meta?.model_provider || meta?.modelProvider || '').trim();
      model = String(meta?.model || '').trim();
      continue;
    }

    if (entry?.type !== 'response_item' || entry?.payload?.type !== 'message') {
      continue;
    }

    const role = entry?.payload?.role === 'user' || entry?.payload?.role === 'assistant' ? entry.payload.role : 'system';
    roleCounts[role] += 1;
    const rawText = getMessageText(entry?.payload?.content);
    if (role === 'user' && !firstUserText) {
      firstUserText = sanitizeSessionText(rawText);
    }
    if (role === 'assistant') {
      lastAssistantText = sanitizeSessionText(rawText);
    }
    const summary = looksSensitive(role, rawText)
      ? '系统与环境约束已载入（已脱敏）'
      : firstRunes(sanitizeSessionText(rawText) || '内容已脱敏', 180);
    messages.push({
      id: `${relativePath}#${messages.length + 1}`,
      role,
      timeLabel: formatTime(timestamp),
      timestamp: formatTimestamp(timestamp),
      title: firstRunes(sanitizeSessionText(rawText) || (role === 'user' ? '用户消息' : role === 'assistant' ? '助手消息' : '系统上下文'), 24),
      summary,
    });
  }

  const projectName = deriveProjectName(meta, relativePath);
  const resolvedProvider = normalizeProvider(provider, model);
  const title = firstRunes(firstUserText || lastAssistantText || path.basename(relativePath, '.jsonl'), 30);
  const detail = {
    sessionID: relativePath,
    projectID: projectName.toLowerCase().replace(/\s+/g, '-'),
    title,
    status: resolveSessionStatus(relativePath),
    fileLabel: relativePath,
    messageCount: messages.length,
    roleSummary: formatRoleSummary(roleCounts),
    topic: firstRunes(lastAssistantText || firstUserText || title, 60),
    currentMessageLabel: formatCurrentMessageLabel(messages),
    messages,
  };

  return {
    projectName,
    provider: resolvedProvider,
    updatedAt: formatTimestamp(lastTimestamp),
    updatedAtRaw: new Date(lastTimestamp || firstTimestamp || 0).getTime(),
    session: {
      id: relativePath,
      sessionID: relativePath,
      projectID: detail.projectID,
      title,
      status: detail.status,
      messageCount: detail.messageCount,
      roleSummary: detail.roleSummary,
      updatedAt: detail.messages.length ? formatTimestamp(lastTimestamp) : '',
      fileLabel: detail.fileLabel,
      summary: detail.topic,
      topic: detail.topic,
    },
    detail,
  };
}

async function buildSessionManagementSnapshot() {
  const codexHome = resolveCodexHome();
  const rolloutPaths = await listCodexRolloutPaths(codexHome);
  const parsedSessions = await mapWithConcurrency(rolloutPaths, 24, (rolloutPath) =>
    parseSessionFile(codexHome, rolloutPath),
  );
  const projectsByID = new Map();
  const providerCounts = {};
  let activeSessionCount = 0;
  let archivedSessionCount = 0;

  for (const parsed of parsedSessions) {
    const projectID = parsed.detail.projectID;
    if (!projectsByID.has(projectID)) {
      projectsByID.set(projectID, {
        id: projectID,
        name: parsed.projectName,
        sessionCount: 0,
        activeSessionCount: 0,
        archivedSessionCount: 0,
        lastActiveAt: parsed.updatedAt,
        lastActiveAtRaw: parsed.updatedAtRaw,
        providerCounts: {},
        sessions: [],
      });
    }
    const project = projectsByID.get(projectID);
    project.sessions.push(parsed.session);
    project.sessionCount += 1;
    project.providerCounts[parsed.provider] = (project.providerCounts[parsed.provider] || 0) + 1;
    if (parsed.session.status === 'archived') {
      project.archivedSessionCount += 1;
      archivedSessionCount += 1;
    } else {
      project.activeSessionCount += 1;
      activeSessionCount += 1;
    }
    if (parsed.updatedAtRaw > project.lastActiveAtRaw) {
      project.lastActiveAtRaw = parsed.updatedAtRaw;
      project.lastActiveAt = parsed.updatedAt;
    }
    providerCounts[parsed.provider] = (providerCounts[parsed.provider] || 0) + 1;
  }

  const projects = [...projectsByID.values()]
    .map((project) => ({
      id: project.id,
      name: project.name,
      sessionCount: project.sessionCount,
      activeSessionCount: project.activeSessionCount,
      archivedSessionCount: project.archivedSessionCount,
      lastActiveAt: project.lastActiveAt,
      providerCounts: project.providerCounts,
      providerSummary: formatProviderSummary(project.providerCounts),
      sessions: project.sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    }))
    .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt));

  const now = new Date();
  return {
    projectCount: projects.length,
    sessionCount: activeSessionCount + archivedSessionCount,
    activeSessionCount,
    archivedSessionCount,
    lastScanAt: formatTimestamp(now.toISOString()),
    providerCounts,
    projects,
  };
}

async function refreshSnapshotCache() {
  if (snapshotRefreshPromise) {
    return snapshotRefreshPromise;
  }

  snapshotRefreshPromise = buildSessionManagementSnapshot()
    .then((snapshot) => {
      snapshotCache = snapshot;
      snapshotCacheUpdatedAt = Date.now();
      void persistSnapshotCacheToDisk(snapshot);
      return snapshot;
    })
    .finally(() => {
      snapshotRefreshPromise = null;
    });

  return snapshotRefreshPromise;
}

export async function loadSessionManagementSnapshot(options = {}) {
  const { forceRefresh = false } = options;
  const cacheFresh = snapshotCache && Date.now() - snapshotCacheUpdatedAt < SNAPSHOT_CACHE_TTL_MS;

  if (!forceRefresh && cacheFresh) {
    return snapshotCache;
  }

  if (!forceRefresh && snapshotCache) {
    void refreshSnapshotCache();
    return snapshotCache;
  }

  return refreshSnapshotCache();
}

export async function loadSessionManagementDetail(sessionID) {
  const codexHome = resolveCodexHome();
  const relativePath = String(sessionID || '').trim();
  if (!relativePath) {
    throw new Error('缺少 session id');
  }
  const absolutePath = path.join(codexHome, relativePath);
  return (await parseSessionFile(codexHome, absolutePath)).detail;
}

void hydrateSnapshotCacheFromDisk()
  .finally(() => refreshSnapshotCache())
  .catch(() => {
    // Warm cache in the background for browser dev sessions.
  });
