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

async function rewriteSessionMetaProvider(absolutePath, targetProvider) {
  const raw = await fs.readFile(absolutePath, 'utf8');
  const lines = raw.split('\n');
  let updated = false;

  const nextLines = lines.map((line) => {
    if (updated || !line.trim()) {
      return line;
    }

    try {
      const entry = JSON.parse(line);
      if (entry?.type !== 'session_meta' || !entry.payload || typeof entry.payload !== 'object') {
        return line;
      }
      entry.payload.model_provider = targetProvider;
      updated = true;
      return JSON.stringify(entry);
    } catch {
      return line;
    }
  });

  if (!updated) {
    throw new Error('未找到 session_meta，无法修改 provider');
  }

  await fs.writeFile(absolutePath, nextLines.join('\n'), 'utf8');
}

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
  const parts = [];
  const append = (label, key) => {
    const count = Number(roleCounts[key] || 0);
    if (count > 0) {
      parts.push(`${label} ${count}`);
    }
  };
  append('用户', 'user');
  append('助手', 'assistant');
  append('系统', 'system');
  append('推理', 'reasoning');
  append('工具调用', 'tool_call');
  append('工具结果', 'tool_result');
  append('事件', 'event');
  return parts.length ? parts.join(' / ') : '系统 0';
}

function formatCurrentMessageLabel(messages) {
  if (!messages.length) {
    return '00 / 系统';
  }
  const roleMap = {
    system: '系统',
    user: '用户',
    assistant: '助手',
    reasoning: '推理',
    tool_call: '工具调用',
    tool_result: '工具结果',
    event: '事件',
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

function getReasoningText(summaryItems) {
  if (!Array.isArray(summaryItems)) {
    return '';
  }
  return summaryItems
    .map((item) => item?.text || '')
    .filter(Boolean)
    .join(' ');
}

function fallbackTitle(role) {
  switch (role) {
    case 'assistant':
      return '助手消息';
    case 'user':
      return '用户消息';
    case 'reasoning':
      return '推理';
    case 'tool_call':
      return '工具调用';
    case 'tool_result':
      return '工具结果';
    case 'event':
      return '事件';
    default:
      return '系统上下文';
  }
}

function buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, role, title, rawText) {
  const sanitizedTitle = sanitizeSessionText(title);
  const sanitizedBody = sanitizeSessionText(rawText);
  const masked = role === 'system' && looksSensitive(role, rawText);
  const summary = masked
    ? '系统与环境约束已载入（已脱敏）'
    : firstRunes(sanitizedBody || '内容已脱敏', 180);
  const record = {
    id: `${relativePath}#${messages.length + 1}`,
    role,
    timeLabel: formatTime(timestamp),
    timestamp: formatTimestamp(timestamp),
    title: firstRunes(sanitizedTitle || sanitizedBody || fallbackTitle(role), 24),
    summary,
  };
  messages.push(record);
  roleCounts[role] = (roleCounts[role] || 0) + 1;
  if (role === 'user' && !state.firstUserText) {
    state.firstUserText = summary;
  }
  if (role !== 'system' && role !== 'event') {
    state.lastPrimaryText = summary;
  }
  state.lastAnyText = summary;
}

function summarizeSessionMeta(meta) {
  const parts = [];
  const repositoryURL = String(meta?.git?.repository_url || meta?.git?.repositoryURL || '').trim();
  if (repositoryURL) {
    parts.push(`仓库 ${repositoryURL.replace(/\.git$/, '').split('/').at(-1) || repositoryURL}`);
  }
  const provider = String(meta?.model_provider || meta?.modelProvider || '').trim();
  if (provider) {
    parts.push(`Provider ${provider}`);
  }
  const cwd = String(meta?.cwd || '').trim();
  if (cwd) {
    parts.push(`目录 ${cwd}`);
  }
  return parts.join(' / ');
}

function summarizeTurnContext(payload) {
  const parts = [];
  const cwd = String(payload?.cwd || '').trim();
  const model = String(payload?.model || '').trim();
  if (cwd) {
    parts.push(`目录 ${cwd}`);
  }
  if (model) {
    parts.push(`模型 ${model}`);
  }
  return parts.join(' / ');
}

function summarizeToolCall(payload) {
  const parts = [];
  const name = String(payload?.name || '').trim();
  const status = String(payload?.status || '').trim();
  const input = String(payload?.input || payload?.arguments || '').trim();
  if (name) {
    parts.push(name);
  }
  if (status) {
    parts.push(`状态 ${status}`);
  }
  if (input) {
    parts.push(input);
  }
  return parts.join(' / ');
}

function summarizeToolResult(payload) {
  const parts = [];
  const callID = String(payload?.call_id || '').trim();
  const output = String(payload?.output || '').trim();
  if (callID) {
    parts.push(`调用 ${callID}`);
  }
  if (output) {
    parts.push(output);
  }
  return parts.join(' / ');
}

function summarizeWebSearch(payload) {
  const direct = String(payload?.action?.query || '').trim();
  const queries = Array.isArray(payload?.action?.queries)
    ? payload.action.queries.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  return [direct, ...queries].filter(Boolean).slice(0, 2).join(' / ') || '网络搜索';
}

function summarizeEvent(payload) {
  switch (payload?.type) {
    case 'task_started':
      return [
        '任务已开始',
        payload?.collaboration_mode_kind ? `模式 ${payload.collaboration_mode_kind}` : '',
        payload?.model_context_window ? `上下文窗口 ${payload.model_context_window}` : '',
      ].filter(Boolean).join(' / ');
    case 'task_complete':
      return String(payload?.last_agent_message || '').trim() || '任务已完成';
    case 'context_compacted':
      return '上下文已压缩';
    case 'turn_aborted':
      return '当前轮次已中断';
    case 'thread_rolled_back':
      return '线程已回滚到较早状态';
    case 'entered_review_mode':
      return '已进入 review 模式';
    case 'exited_review_mode':
      return '已退出 review 模式';
    case 'item_completed':
      return '一个处理步骤已完成';
    default:
      try {
        return JSON.stringify(payload);
      } catch {
        return String(payload?.type || '事件');
      }
    }
}

async function parseSessionFile(codexHome, absolutePath) {
  const relativePath = path.relative(codexHome, absolutePath).split(path.sep).join('/');
  const raw = await fs.readFile(absolutePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const roleCounts = {
    system: 0,
    user: 0,
    assistant: 0,
    reasoning: 0,
    tool_call: 0,
    tool_result: 0,
    event: 0,
  };
  const messages = [];
  let firstTimestamp = '';
  let lastTimestamp = '';
  let meta = {};
  const state = {
    firstUserText: '',
    lastPrimaryText: '',
    lastAnyText: '',
  };
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
      buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'system', '会话元数据', summarizeSessionMeta(meta));
      continue;
    }

    if (entry?.type === 'turn_context') {
      const payload = entry?.payload || {};
      if (String(payload?.model || '').trim()) {
        model = String(payload.model).trim();
      }
      buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'system', '上下文更新', summarizeTurnContext(payload));
      continue;
    }

    if (entry?.type === 'response_item') {
      const payload = entry?.payload || {};
      switch (payload?.type) {
        case 'message': {
          const role = payload?.role === 'user' || payload?.role === 'assistant' ? payload.role : 'system';
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, role, fallbackTitle(role), getMessageText(payload?.content));
          break;
        }
        case 'reasoning':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'reasoning', '推理', getReasoningText(payload?.summary));
          break;
        case 'function_call':
        case 'custom_tool_call':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'tool_call', '工具调用', summarizeToolCall(payload));
          break;
        case 'function_call_output':
        case 'custom_tool_call_output':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'tool_result', '工具结果', summarizeToolResult(payload));
          break;
        case 'web_search_call':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'tool_call', '网络搜索', summarizeWebSearch(payload));
          break;
        default:
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'event', '响应项', JSON.stringify(payload));
          break;
      }
      continue;
    }

    if (entry?.type === 'event_msg') {
      const payload = entry?.payload || {};
      switch (payload?.type) {
        case 'user_message':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'user', '用户输入', String(payload?.message || ''));
          break;
        case 'agent_message':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'assistant', '助手说明', String(payload?.message || ''));
          break;
        case 'agent_reasoning':
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'reasoning', '推理', String(payload?.text || ''));
          break;
        default:
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'event', '事件', summarizeEvent(payload));
          break;
      }
    }
  }

  const projectName = deriveProjectName(meta, relativePath);
  const resolvedProvider = normalizeProvider(provider, model);
  const threadNames = await loadSessionThreadNames(codexHome);
  const title = String(threadNames[String(meta?.id || '').trim()] || '').trim();
  const detail = {
    sessionID: relativePath,
    projectID: projectName.toLowerCase().replace(/\s+/g, '-'),
    title,
    status: resolveSessionStatus(relativePath),
    fileLabel: relativePath,
    messageCount: messages.length,
    roleSummary: formatRoleSummary(roleCounts),
    topic: firstRunes(state.lastPrimaryText || state.lastAnyText || path.basename(relativePath, '.jsonl'), 60),
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

let sessionThreadNamesPromise = null;

async function loadSessionThreadNames(codexHome) {
  if (sessionThreadNamesPromise) {
    return sessionThreadNamesPromise;
  }

  sessionThreadNamesPromise = (async () => {
    const indexPath = path.join(codexHome, 'session_index.jsonl');
    try {
      const raw = await fs.readFile(indexPath, 'utf8');
      const result = {};
      for (const line of raw.split('\n').filter(Boolean)) {
        try {
          const entry = JSON.parse(line);
          const id = String(entry?.id || '').trim();
          const threadName = String(entry?.thread_name || '').trim();
          if (id && threadName) {
            result[id] = threadName;
          }
        } catch {
          continue;
        }
      }
      return result;
    } catch {
      return {};
    }
  })();

  return sessionThreadNamesPromise;
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
  if (forceRefresh) {
    sessionThreadNamesPromise = null;
  }
  if (!snapshotCache && !snapshotRefreshPromise) {
    await hydrateSnapshotCacheFromDisk();
  }
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

export async function updateSessionManagementProviders({ projectID, mappings }) {
  const normalizedProjectID = String(projectID || '').trim();
  if (!normalizedProjectID) {
    throw new Error('缺少 project id');
  }

  const normalizedMappings = new Map();
  for (const item of Array.isArray(mappings) ? mappings : []) {
    const sourceProvider = String(item?.sourceProvider || '').trim();
    const targetProvider = String(item?.targetProvider || '').trim();
    if (!sourceProvider || !targetProvider) {
      continue;
    }
    normalizedMappings.set(sourceProvider, targetProvider);
  }

  if (!normalizedMappings.size) {
    throw new Error('缺少有效的 provider 归并规则');
  }

  const codexHome = resolveCodexHome();
  const snapshot = await loadSessionManagementSnapshot({ forceRefresh: true });
  const project = snapshot.projects.find((item) => item.id === normalizedProjectID);
  if (!project) {
    throw new Error('未找到对应项目');
  }

  let updatedCount = 0;
  for (const session of project.sessions) {
    const sourceProvider = String(session.provider || '').trim();
    const targetProvider = normalizedMappings.get(sourceProvider);
    if (!targetProvider || targetProvider === sourceProvider) {
      continue;
    }

    await rewriteSessionMetaProvider(path.join(codexHome, session.sessionID), targetProvider);
    updatedCount += 1;
  }

  if (!updatedCount) {
    return snapshot;
  }

  snapshotCache = null;
  snapshotCacheUpdatedAt = 0;
  snapshotRefreshPromise = null;
  sessionThreadNamesPromise = null;
  return loadSessionManagementSnapshot({ forceRefresh: true });
}

void hydrateSnapshotCacheFromDisk()
  .finally(() => refreshSnapshotCache())
  .catch(() => {
    // Warm cache in the background for browser dev sessions.
  });
