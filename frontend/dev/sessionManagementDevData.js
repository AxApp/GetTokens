import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const SESSION_PATH_PATTERN = /\/Users\/[^/\s]+(?:\/[^\s"'<>]+)*/g;
const SESSION_CALL_ID_PATTERN = /\bcall[_-]?[A-Za-z0-9_-]+\b/g;
const SESSION_HEX_ID_PATTERN = /\b[0-9a-f]{8,}\b/gi;
const SESSION_SECRET_PATTERN = /\b(?:sk-ant|sk-proj|sk)-[A-Za-z0-9_-]{8,}\b|(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi;
const SESSION_WHITESPACE_PATTERN = /\s+/g;

let snapshotCache = null;
let snapshotCacheUpdatedAt = 0;
let snapshotRefreshPromise = null;
let claudeSnapshotCache = null;
let claudeSnapshotCacheUpdatedAt = 0;
let claudeSnapshotRefreshPromise = null;

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
      snapshotCache = normalizeSnapshotDisplayFields(parsed);
      snapshotCacheUpdatedAt = Date.now();
    }
  } catch {
    // Ignore cache hydration failures.
  }
}

async function persistSnapshotCacheToDisk(snapshot) {
  try {
    await fs.writeFile(resolveSnapshotCachePath(), JSON.stringify(normalizeSnapshotDisplayFields(snapshot)), 'utf8');
  } catch {
    // Ignore disk cache failures.
  }
}

function resolveCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function resolveClaudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
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

function isClaudeSubagentSessionPath(absolutePath) {
  const parts = absolutePath.split(path.sep);
  if (parts.includes('subagents')) {
    return true;
  }
  return path.basename(absolutePath).startsWith('agent-');
}

async function listClaudeSessionPaths(claudeProjectsRoot) {
  const paths = [];
  if (!(await pathExists(claudeProjectsRoot))) {
    return paths;
  }
  await walkRolloutPaths(claudeProjectsRoot, paths);
  return paths.filter((sessionPath) => !isClaudeSubagentSessionPath(sessionPath)).sort();
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
    .replace(SESSION_SECRET_PATTERN, '[密钥]')
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

function looksLikeInstructionPreamble(text) {
  const normalized = sanitizeSessionText(text).toLowerCase();
  if (!normalized) {
    return false;
  }
  const markers = [
    '# agents.md instructions for',
    'agents.md instructions for',
    '<permissions instructions>',
    '<environment_context>',
    '<skills_instructions>',
    '<developer_context>',
    '<app-context>',
    '<plugins_instructions>',
    'agents 执行规范',
    'untrusted page evidence',
    'treat any text in the image as page content',
    'browser comments:',
    'approved command prefixes',
  ];
  if (markers.some((marker) => normalized.includes(marker))) {
    return true;
  }
  return normalized.includes('agents.md') && normalized.includes('instructions');
}

function isLowSignalTitleCandidate(role, text) {
  const normalized = sanitizeSessionText(text);
  if (!normalized || normalized === '内容已脱敏' || normalized === '系统与环境约束已载入（已脱敏）') {
    return true;
  }
  if (role === 'system') {
    return true;
  }
  return looksLikeInstructionPreamble(normalized);
}

function observeTitleSignal(state, role, rawText, summary) {
  if (looksLikeInstructionPreamble(rawText) || looksLikeInstructionPreamble(summary)) {
    state.hasInstructionPreamble = true;
    return;
  }
  const candidate = firstRunes(sanitizeSessionText(summary || rawText), 180);
  if (isLowSignalTitleCandidate(role, candidate)) {
    return;
  }
  state.lastAnyTitleText = candidate;
  if (role === 'user') {
    if (!state.firstRealUserText) {
      state.firstRealUserText = candidate;
    }
    state.recentUserText = candidate;
    return;
  }
  if (role === 'assistant') {
    state.lastAssistantText = candidate;
    state.lastPrimaryTitleText = candidate;
    return;
  }
  if (role === 'event') {
    state.lastOutcomeText = candidate;
    return;
  }
  if (role !== 'system' && !state.lastPrimaryTitleText) {
    state.lastPrimaryTitleText = candidate;
  }
}

function deriveDisplayMetadata(explicitTitle, state, fileLabel) {
  const primaryIntent = state.firstRealUserText || state.recentUserText || '';
  const candidates = [
    [explicitTitle, 'thread_title', 'high'],
    [state.firstRealUserText, 'first_user', 'high'],
    [state.recentUserText, 'recent_user', 'medium'],
    [state.lastAssistantText, 'assistant_result', 'medium'],
    [state.lastOutcomeText, 'last_outcome', 'medium'],
    [state.lastPrimaryTitleText, 'last_primary', 'low'],
    [state.lastAnyTitleText, 'last_message', 'low'],
    [path.basename(String(fileLabel || ''), path.extname(String(fileLabel || ''))), 'file', 'low'],
  ];
  for (const [text, titleSource, titleConfidence] of candidates) {
    if (isLowSignalTitleCandidate('', text)) {
      continue;
    }
    return {
      displayTitle: firstRunes(sanitizeSessionText(text), 60),
      titleSource,
      titleConfidence,
      primaryIntent,
      lastOutcome: state.lastOutcomeText || state.lastAssistantText || '',
      hasInstructionPreamble: state.hasInstructionPreamble === true,
    };
  }
  return {
    displayTitle: 'UNTITLED SESSION',
    titleSource: 'fallback',
    titleConfidence: 'low',
    primaryIntent,
    lastOutcome: state.lastOutcomeText || state.lastAssistantText || '',
    hasInstructionPreamble: state.hasInstructionPreamble === true,
  };
}

function deriveCachedDisplayMetadata(...values) {
  const sources = [
    'cache_display_title',
    'cache_title',
    'cache_topic',
    'cache_summary',
    'cache_preview',
    'file',
  ];
  for (let index = 0; index < values.length; index += 1) {
    const text = values[index];
    if (isLowSignalTitleCandidate('', text)) {
      continue;
    }
    return {
      displayTitle: firstRunes(sanitizeSessionText(text), 60),
      titleSource: sources[index] || 'cache',
      titleConfidence: index <= 1 ? 'medium' : 'low',
    };
  }
  return {
    displayTitle: 'UNTITLED SESSION',
    titleSource: 'fallback',
    titleConfidence: 'low',
  };
}

function normalizeSnapshotDisplayFields(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.projects)) {
    return snapshot;
  }

  for (const project of snapshot.projects) {
    if (!Array.isArray(project?.sessions)) {
      continue;
    }
    for (const session of project.sessions) {
      if (!session || typeof session !== 'object') {
        continue;
      }
      const hadInstructionPreamble =
        looksLikeInstructionPreamble(session.title) ||
        looksLikeInstructionPreamble(session.displayTitle) ||
        looksLikeInstructionPreamble(session.topic) ||
        looksLikeInstructionPreamble(session.summary);
      const metadata = deriveCachedDisplayMetadata(
        session.displayTitle,
        session.title,
        session.topic,
        session.summary,
        session.preview,
        session.fileLabel || session.sessionID || session.id,
      );

      session.displayTitle = metadata.displayTitle;
      if (isLowSignalTitleCandidate('', session.title)) {
        session.title = metadata.displayTitle;
      }
      if (!session.titleSource || looksLikeInstructionPreamble(session.titleSource)) {
        session.titleSource = metadata.titleSource;
      }
      if (!session.titleConfidence) {
        session.titleConfidence = metadata.titleConfidence;
      }
      if (!session.primaryIntent && !isLowSignalTitleCandidate('', session.summary)) {
        session.primaryIntent = firstRunes(sanitizeSessionText(session.summary), 180);
      }
      if (!session.lastOutcome && !isLowSignalTitleCandidate('', session.preview)) {
        session.lastOutcome = firstRunes(sanitizeSessionText(session.preview), 180);
      }
      if (hadInstructionPreamble) {
        session.hasInstructionPreamble = true;
      }
    }
  }

  return snapshot;
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
  observeTitleSignal(state, role, rawText, summary);
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

function summarizeClaudeToolUse(item) {
  const name = String(item?.name || '').trim();
  let input = '';
  try {
    input = JSON.stringify(item?.input || {});
  } catch {
    input = String(item?.input || '');
  }
  return [name, input].filter(Boolean).join(' / ');
}

function summarizeClaudeToolResult(item) {
  const content = item?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => entry?.text || entry?.content || '')
      .filter(Boolean)
      .join(' ');
  }
  try {
    return JSON.stringify(content || item || {});
  } catch {
    return String(item?.tool_use_id || '工具结果');
  }
}

function getClaudeTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((item) => item?.text || item?.content || '')
    .filter((value) => typeof value === 'string')
    .join(' ');
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
    firstRealUserText: '',
    recentUserText: '',
    lastAssistantText: '',
    lastOutcomeText: '',
    lastPrimaryTitleText: '',
    lastAnyTitleText: '',
    hasInstructionPreamble: false,
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
  const displayMetadata = deriveDisplayMetadata(
    String(threadNames[String(meta?.id || '').trim()] || '').trim(),
    state,
    relativePath,
  );
  const title = displayMetadata.displayTitle;
  const detail = {
    sessionID: relativePath,
    projectID: projectName.toLowerCase().replace(/\s+/g, '-'),
    title,
    displayTitle: displayMetadata.displayTitle,
    titleSource: displayMetadata.titleSource,
    titleConfidence: displayMetadata.titleConfidence,
    status: resolveSessionStatus(relativePath),
    fileLabel: relativePath,
    messageCount: messages.length,
    roleSummary: formatRoleSummary(roleCounts),
    topic: firstRunes(state.lastPrimaryText || state.lastAnyText || path.basename(relativePath, '.jsonl'), 60),
    primaryIntent: displayMetadata.primaryIntent,
    lastOutcome: displayMetadata.lastOutcome,
    hasInstructionPreamble: displayMetadata.hasInstructionPreamble,
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
      displayTitle: displayMetadata.displayTitle,
      titleSource: displayMetadata.titleSource,
      titleConfidence: displayMetadata.titleConfidence,
      status: detail.status,
      messageCount: detail.messageCount,
      roleSummary: detail.roleSummary,
      updatedAt: detail.messages.length ? formatTimestamp(lastTimestamp) : '',
      fileLabel: detail.fileLabel,
      summary: detail.topic,
      topic: detail.topic,
      primaryIntent: displayMetadata.primaryIntent,
      lastOutcome: displayMetadata.lastOutcome,
      hasInstructionPreamble: displayMetadata.hasInstructionPreamble,
      provider: resolvedProvider,
    },
    detail,
  };
}

async function parseClaudeSessionFile(claudeProjectsRoot, absolutePath) {
  const relativePath = path.relative(claudeProjectsRoot, absolutePath).split(path.sep).join('/');
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
  const state = {
    firstUserText: '',
    firstRealUserText: '',
    recentUserText: '',
    lastAssistantText: '',
    lastOutcomeText: '',
    lastPrimaryTitleText: '',
    lastAnyTitleText: '',
    hasInstructionPreamble: false,
    lastPrimaryText: '',
    lastAnyText: '',
  };
  let firstTimestamp = '';
  let lastTimestamp = '';
  let cwd = '';
  let model = '';
  let sessionID = path.basename(absolutePath, '.jsonl');

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
    if (String(entry?.cwd || '').trim()) {
      cwd = String(entry.cwd).trim();
    }
    if (String(entry?.sessionId || entry?.sessionID || '').trim()) {
      sessionID = String(entry.sessionId || entry.sessionID).trim();
    }
    if (String(entry?.message?.model || '').trim()) {
      model = String(entry.message.model).trim();
    }

    if (entry?.type === 'attachment') {
      buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'event', '附件', getClaudeTextContent(entry?.message?.content || entry?.content || entry));
      continue;
    }

    if (entry?.type === 'user') {
      const content = entry?.message?.content;
      if (Array.isArray(content)) {
        let emitted = false;
        for (const item of content) {
          if (item?.type === 'tool_result') {
            buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'tool_result', '工具结果', summarizeClaudeToolResult(item));
            emitted = true;
          } else if (item?.type === 'text' && item?.text) {
            buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'user', '用户消息', String(item.text));
            emitted = true;
          }
        }
        if (!emitted) {
          buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'user', '用户消息', getClaudeTextContent(content));
        }
        continue;
      }
      buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'user', '用户消息', getClaudeTextContent(content));
      continue;
    }

    if (entry?.type === 'assistant') {
      const content = entry?.message?.content;
      if (typeof content === 'string') {
        buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'assistant', '助手消息', content);
        continue;
      }
      if (Array.isArray(content)) {
        for (const item of content) {
          switch (item?.type) {
            case 'text':
              buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'assistant', '助手消息', String(item?.text || ''));
              break;
            case 'thinking':
              buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'reasoning', '推理', String(item?.thinking || item?.text || ''));
              break;
            case 'tool_use':
              buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'tool_call', '工具调用', summarizeClaudeToolUse(item));
              break;
            default:
              buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'event', '响应项', JSON.stringify(item || {}));
              break;
          }
        }
        continue;
      }
      buildMessageRecord(relativePath, messages, roleCounts, state, timestamp, 'assistant', '助手消息', '');
      continue;
    }
  }

  const projectName = cwd ? path.basename(cwd) : path.basename(path.dirname(absolutePath)).replace(/^-+/, '').replace(/-/g, '/').split('/').at(-1) || 'Claude Code';
  const displayMetadata = deriveDisplayMetadata(state.firstUserText || sessionID, state, relativePath);
  const detail = {
    sessionID: relativePath,
    projectID: projectName.toLowerCase().replace(/\s+/g, '-'),
    title: displayMetadata.displayTitle,
    displayTitle: displayMetadata.displayTitle,
    titleSource: displayMetadata.titleSource,
    titleConfidence: displayMetadata.titleConfidence,
    status: 'active',
    fileLabel: relativePath,
    messageCount: messages.length,
    provider: 'claude',
    roleSummary: formatRoleSummary(roleCounts),
    topic: firstRunes(state.lastPrimaryText || state.lastAnyText || `claude --resume ${sessionID}`, 60),
    primaryIntent: displayMetadata.primaryIntent,
    lastOutcome: displayMetadata.lastOutcome,
    hasInstructionPreamble: displayMetadata.hasInstructionPreamble,
    currentMessageLabel: formatCurrentMessageLabel(messages),
    messages,
  };

  const resumeSummary = `claude --resume ${sessionID}`;
  if (model) {
    detail.topic = firstRunes(`${detail.topic} / 模型 ${model} / ${resumeSummary}`, 90);
  } else if (!detail.topic.includes('claude --resume')) {
    detail.topic = firstRunes(`${detail.topic} / ${resumeSummary}`, 90);
  }

  return {
    projectName,
    provider: 'claude',
    updatedAt: formatTimestamp(lastTimestamp),
    updatedAtRaw: new Date(lastTimestamp || firstTimestamp || 0).getTime(),
    session: {
      id: relativePath,
      sessionID: relativePath,
      projectID: detail.projectID,
      projectName,
      title: firstRunes(detail.title, 60),
      displayTitle: detail.displayTitle,
      titleSource: detail.titleSource,
      titleConfidence: detail.titleConfidence,
      status: detail.status,
      archived: false,
      messageCount: detail.messageCount,
      roleSummary: detail.roleSummary,
      updatedAt: detail.messages.length ? formatTimestamp(lastTimestamp) : '',
      fileLabel: detail.fileLabel,
      summary: detail.topic,
      primaryIntent: detail.primaryIntent,
      lastOutcome: detail.lastOutcome,
      hasInstructionPreamble: detail.hasInstructionPreamble,
      provider: 'claude',
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

async function buildClaudeSessionManagementSnapshot() {
  const claudeProjectsRoot = path.join(resolveClaudeConfigDir(), 'projects');
  const sessionPaths = await listClaudeSessionPaths(claudeProjectsRoot);
  const parsedSessions = await mapWithConcurrency(sessionPaths, 24, (sessionPath) =>
    parseClaudeSessionFile(claudeProjectsRoot, sessionPath),
  );
  const projectsByID = new Map();
  let activeSessionCount = 0;
  const providerCounts = {};

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
    project.activeSessionCount += 1;
    activeSessionCount += 1;
    project.providerCounts[parsed.provider] = (project.providerCounts[parsed.provider] || 0) + 1;
    providerCounts[parsed.provider] = (providerCounts[parsed.provider] || 0) + 1;
    if (parsed.updatedAtRaw > project.lastActiveAtRaw) {
      project.lastActiveAtRaw = parsed.updatedAtRaw;
      project.lastActiveAt = parsed.updatedAt;
    }
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
    sessionCount: activeSessionCount,
    activeSessionCount,
    archivedSessionCount: 0,
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

async function refreshClaudeSnapshotCache() {
  if (claudeSnapshotRefreshPromise) {
    return claudeSnapshotRefreshPromise;
  }

  claudeSnapshotRefreshPromise = buildClaudeSessionManagementSnapshot()
    .then((snapshot) => {
      claudeSnapshotCache = snapshot;
      claudeSnapshotCacheUpdatedAt = Date.now();
      return snapshot;
    })
    .finally(() => {
      claudeSnapshotRefreshPromise = null;
    });

  return claudeSnapshotRefreshPromise;
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

export async function loadClaudeSessionManagementSnapshot(options = {}) {
  const { forceRefresh = false } = options;
  const cacheFresh = claudeSnapshotCache && Date.now() - claudeSnapshotCacheUpdatedAt < SNAPSHOT_CACHE_TTL_MS;

  if (!forceRefresh && cacheFresh) {
    return claudeSnapshotCache;
  }

  if (!forceRefresh && claudeSnapshotCache) {
    void refreshClaudeSnapshotCache();
    return claudeSnapshotCache;
  }

  return refreshClaudeSnapshotCache();
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

export async function loadClaudeSessionManagementDetail(sessionID) {
  const claudeProjectsRoot = path.join(resolveClaudeConfigDir(), 'projects');
  const relativePath = String(sessionID || '').trim();
  if (!relativePath) {
    throw new Error('缺少 session id');
  }
  const absolutePath = path.join(claudeProjectsRoot, relativePath);
  return (await parseClaudeSessionFile(claudeProjectsRoot, absolutePath)).detail;
}

const ANALYSIS_STOP_WORDS = new Set([
  '一个', '一些', '不是', '不会', '不应', '以及', '但是', '已经', '我们', '这个', '那个', '需要', '应该', '可以', '进行', '通过', '如果', '因为', '所以', '然后', '当前', '页面',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'true', 'false',
]);

function tokenizeAnalysisText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}_\-.]+/gu, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !ANALYSIS_STOP_WORDS.has(term) && /[\p{Script=Han}\p{Letter}]/u.test(term));
}

function topAnalysisKeywords(termCounts, termSessions, limit) {
  const items = Array.from(termCounts.entries()).map(([term, count]) => ({
    term,
    count,
    sessionCount: termSessions.get(term)?.size || 0,
    score: Math.round(count * (1 + Math.log1p(termSessions.get(term)?.size || 0)) * 100) / 100,
  }));
  items.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
    return left.term.localeCompare(right.term);
  });
  return limit > 0 ? items.slice(0, limit) : items;
}

function topAnalysisWordCloud(termCounts, termSessions, limit) {
  const keywords = topAnalysisKeywords(termCounts, termSessions, limit);
  if (!keywords.length) {
    return [];
  }
  const maxCount = Math.max(...keywords.map((keyword) => keyword.count), 1);
  return keywords.map((keyword) => ({
    term: keyword.term,
    count: keyword.count,
    sessionCount: keyword.sessionCount,
    weight: Math.round((0.4 + 0.6 * (keyword.count / maxCount)) * 100) / 100,
  }));
}

function topAnalysisCommonPhrases(phraseCounts, phraseSessions, limit) {
  const items = Array.from(phraseCounts.entries()).map(([text, count]) => ({
    text,
    count,
    sessionCount: phraseSessions.get(text)?.size || 0,
    score: Math.round(count * (1 + Math.log1p(phraseSessions.get(text)?.size || 0)) * 100) / 100,
  }));
  items.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    if (right.sessionCount !== left.sessionCount) return right.sessionCount - left.sessionCount;
    if (right.text.length !== left.text.length) return right.text.length - left.text.length;
    return left.text.localeCompare(right.text);
  });
  return limit > 0 ? items.slice(0, limit) : items;
}

function roleContributions(roleMessages, roleTerms, totalTerms) {
  return Array.from(roleMessages.entries())
    .map(([role, messageCount]) => {
      const termCount = roleTerms.get(role) || 0;
      return {
        role,
        messageCount,
        termCount,
        share: totalTerms > 0 ? Math.round((termCount / totalTerms) * 100) / 100 : 0,
      };
    })
    .sort((left, right) => {
      if (right.termCount !== left.termCount) return right.termCount - left.termCount;
      if (right.messageCount !== left.messageCount) return right.messageCount - left.messageCount;
      return left.role.localeCompare(right.role);
    });
}

function isHanAnalysisTerm(term) {
  return /^[\p{Script=Han}]+$/u.test(term);
}

function joinAnalysisPhraseTerms(terms) {
  return terms.every(isHanAnalysisTerm) ? terms.join('') : terms.join(' ');
}

function extractAnalysisPhrases(terms) {
  const phrases = [];
  for (let size = 2; size <= 3; size += 1) {
    if (terms.length < size) {
      continue;
    }
    for (let start = 0; start + size <= terms.length; start += 1) {
      const phrase = joinAnalysisPhraseTerms(terms.slice(start, start + size)).trim();
      if ([...phrase].length >= 4) {
        phrases.push(phrase);
      }
    }
  }
  return phrases;
}

function addTermSession(termSessions, term, sessionID) {
  let sessions = termSessions.get(term);
  if (!sessions) {
    sessions = new Set();
    termSessions.set(term, sessions);
  }
  sessions.add(sessionID);
}

function analyzeSessionDetailForDev(detail) {
  const termCounts = new Map();
  const termSessions = new Map();
  const phraseCounts = new Map();
  const phraseSessions = new Map();
  const roleMessages = new Map();
  const roleTerms = new Map();
  let messageCount = 0;
  let termCount = 0;

  for (const message of detail.messages || []) {
    if (!['user', 'assistant', 'reasoning', 'tool_call', 'tool_result'].includes(message.role)) {
      continue;
    }
    const terms = tokenizeAnalysisText(`${message.title || ''} ${message.summary || ''} ${message.content || ''}`);
    if (!terms.length) {
      continue;
    }
    messageCount += 1;
    termCount += terms.length;
    roleMessages.set(message.role, (roleMessages.get(message.role) || 0) + 1);
    roleTerms.set(message.role, (roleTerms.get(message.role) || 0) + terms.length);
    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
      addTermSession(termSessions, term, detail.sessionID);
    }
    for (const phrase of extractAnalysisPhrases(terms)) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      addTermSession(phraseSessions, phrase, detail.sessionID);
    }
  }

  const keywords = topAnalysisKeywords(termCounts, termSessions, 10);
  const commonPhrases = topAnalysisCommonPhrases(phraseCounts, phraseSessions, 8);
  return {
    sessionID: detail.sessionID,
    projectID: detail.projectID,
    projectName: detail.projectName || detail.projectID,
    title: detail.title,
    status: detail.status,
    provider: detail.provider || 'unknown',
    model: detail.model || '',
    messageCount,
    termCount,
    topicLine: keywords.slice(0, 5).map((item) => item.term).join(' / ') || '—',
    keywords,
    commonPhrases,
    roleContributions: roleContributions(roleMessages, roleTerms, termCount),
  };
}

export async function analyzeCodexSessions(input = {}) {
  const snapshot = await loadSessionManagementSnapshot();
  const selectedIDs = new Set(Array.isArray(input.sessionIDs) ? input.sessionIDs.map(String) : []);
  const projectID = String(input.projectID || '').trim();
  const limit = Number.isFinite(Number(input.limit)) ? Number(input.limit) : 0;
  const candidates = [];
  for (const project of snapshot.projects || []) {
    if (projectID && project.id !== projectID) {
      continue;
    }
    for (const session of project.sessions || []) {
      if (selectedIDs.size > 0 && !selectedIDs.has(session.sessionID || session.id)) {
        continue;
      }
      candidates.push(session.sessionID || session.id);
    }
  }

  const analyzeInParallel = limit <= 0 && candidates.length > 1;
  const globalTermCounts = new Map();
  const globalTermSessions = new Map();
  const globalPhraseCounts = new Map();
  const globalPhraseSessions = new Map();
  const globalRoleMessages = new Map();
  const globalRoleTerms = new Map();
  const projectDrafts = new Map();
  const sessions = [];
  let totalMessages = 0;
  let totalTerms = 0;
  let skippedSessionCount = 0;

  const summaries = analyzeInParallel
    ? await mapWithConcurrency(candidates, Math.min(24, Math.max(4, os.cpus().length - 1)), async (sessionID) => {
      const summary = analyzeSessionDetailForDev(await loadSessionManagementDetail(sessionID));
      return summary.termCount === 0 ? null : summary;
    })
    : [];

  if (analyzeInParallel) {
    for (const summary of summaries) {
      if (!summary) {
        skippedSessionCount += 1;
        continue;
      }
      sessions.push(summary);
      totalMessages += summary.messageCount;
      totalTerms += summary.termCount;
      let project = projectDrafts.get(summary.projectID);
      if (!project) {
        project = {
          projectID: summary.projectID,
          projectName: summary.projectName,
          sessionCount: 0,
          messageCount: 0,
          termCount: 0,
          termCounts: new Map(),
          termSessions: new Map(),
        };
        projectDrafts.set(summary.projectID, project);
      }
      project.sessionCount += 1;
      project.messageCount += summary.messageCount;
      project.termCount += summary.termCount;
      for (const keyword of summary.keywords) {
        globalTermCounts.set(keyword.term, (globalTermCounts.get(keyword.term) || 0) + keyword.count);
        addTermSession(globalTermSessions, keyword.term, summary.sessionID);
        project.termCounts.set(keyword.term, (project.termCounts.get(keyword.term) || 0) + keyword.count);
        addTermSession(project.termSessions, keyword.term, summary.sessionID);
      }
      for (const phrase of summary.commonPhrases) {
        globalPhraseCounts.set(phrase.text, (globalPhraseCounts.get(phrase.text) || 0) + phrase.count);
        addTermSession(globalPhraseSessions, phrase.text, summary.sessionID);
      }
      for (const contribution of summary.roleContributions) {
        globalRoleMessages.set(contribution.role, (globalRoleMessages.get(contribution.role) || 0) + contribution.messageCount);
        globalRoleTerms.set(contribution.role, (globalRoleTerms.get(contribution.role) || 0) + contribution.termCount);
      }
    }
  } else {
    for (const sessionID of candidates) {
      if (limit > 0 && sessions.length >= limit) {
        skippedSessionCount += 1;
        continue;
      }
      const summary = analyzeSessionDetailForDev(await loadSessionManagementDetail(sessionID));
      if (summary.termCount === 0) {
        skippedSessionCount += 1;
        continue;
      }
      sessions.push(summary);
      totalMessages += summary.messageCount;
      totalTerms += summary.termCount;
      let project = projectDrafts.get(summary.projectID);
      if (!project) {
        project = {
          projectID: summary.projectID,
          projectName: summary.projectName,
          sessionCount: 0,
          messageCount: 0,
          termCount: 0,
          termCounts: new Map(),
          termSessions: new Map(),
        };
        projectDrafts.set(summary.projectID, project);
      }
      project.sessionCount += 1;
      project.messageCount += summary.messageCount;
      project.termCount += summary.termCount;
      for (const keyword of summary.keywords) {
        globalTermCounts.set(keyword.term, (globalTermCounts.get(keyword.term) || 0) + keyword.count);
        addTermSession(globalTermSessions, keyword.term, summary.sessionID);
        project.termCounts.set(keyword.term, (project.termCounts.get(keyword.term) || 0) + keyword.count);
        addTermSession(project.termSessions, keyword.term, summary.sessionID);
      }
      for (const phrase of summary.commonPhrases) {
        globalPhraseCounts.set(phrase.text, (globalPhraseCounts.get(phrase.text) || 0) + phrase.count);
        addTermSession(globalPhraseSessions, phrase.text, summary.sessionID);
      }
      for (const contribution of summary.roleContributions) {
        globalRoleMessages.set(contribution.role, (globalRoleMessages.get(contribution.role) || 0) + contribution.messageCount);
        globalRoleTerms.set(contribution.role, (globalRoleTerms.get(contribution.role) || 0) + contribution.termCount);
      }
    }
  }

  return {
    scope: input.scope || (selectedIDs.size > 0 ? 'selected' : 'all'),
    generatedAt: formatTimestamp(new Date().toISOString()),
    requestedSessionCount: candidates.length,
    analyzedSessionCount: sessions.length,
    skippedSessionCount,
    totalMessages,
    totalTerms,
    keywords: topAnalysisKeywords(globalTermCounts, globalTermSessions, 20),
    wordCloud: topAnalysisWordCloud(globalTermCounts, globalTermSessions, 40),
    commonPhrases: topAnalysisCommonPhrases(globalPhraseCounts, globalPhraseSessions, 12),
    roleContributions: roleContributions(globalRoleMessages, globalRoleTerms, totalTerms),
    projects: Array.from(projectDrafts.values())
      .map((project) => ({
        projectID: project.projectID,
        projectName: project.projectName,
        sessionCount: project.sessionCount,
        messageCount: project.messageCount,
        termCount: project.termCount,
        keywords: topAnalysisKeywords(project.termCounts, project.termSessions, 8),
      }))
      .sort((left, right) => right.sessionCount - left.sessionCount || left.projectName.localeCompare(right.projectName)),
    sessions,
  };
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
