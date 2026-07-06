import { gunzipSync, unzip } from 'fflate';

export const ACCOUNT_CARD_IMPORT_SCHEMA = 'gettokens.account-card.v1';
export const ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT = 224;
export const ACCOUNT_IMPORT_QUEUE_OVERSCAN = 4;
const ARCHIVE_JSON_ENTRY_LIMIT = 1000;
const TAR_BLOCK_SIZE = 512;

export interface AccountCardImportPayload {
  schema: typeof ACCOUNT_CARD_IMPORT_SCHEMA;
  credentialSource: 'auth-file' | 'api-key' | 'openai-compatible';
  account?: {
    id?: string;
    provider?: string;
    displayName?: string;
  };
  authFile?: {
    name?: string;
    content?: unknown;
  };
  codexAPIKey?: {
    label?: string;
    apiKey?: string;
    baseUrl?: string;
    prefix?: string;
    supportedFormats?: string[];
    formatBaseUrls?: Record<string, string>;
  };
  openAICompatibleProvider?: {
    name?: string;
    apiKey?: string;
    apiKeys?: string[];
    baseUrl?: string;
    prefix?: string;
    proxyUrl?: string;
    headers?: Record<string, string>;
    models?: Array<{ name?: string; alias?: string }>;
    supportedFormats?: string[];
    formatBaseUrls?: Record<string, string>;
  };
}

export type ParsedAccountCardImport =
  | {
      type: 'auth-file';
      name: string;
      content: string;
    }
  | {
      type: 'codex-api-key';
      label: string;
      apiKey: string;
      baseUrl: string;
      prefix: string;
      supportedFormats?: string[];
      formatBaseUrls?: Record<string, string>;
    }
  | {
      type: 'openai-compatible';
      name: string;
      apiKey: string;
      apiKeys: string[];
      baseUrl: string;
      prefix: string;
      proxyUrl: string;
      headers: Record<string, string>;
      models: Array<{ name: string; alias?: string }>;
      supportedFormats?: string[];
      formatBaseUrls?: Record<string, string>;
    };

export type AccountImportPayloadItem =
  | {
      type: 'upload-file';
      name: string;
      contentBase64: string;
    }
  | ParsedAccountCardImport;

export function resolvePastedAuthFileName(parsed: Record<string, unknown>) {
  if (typeof parsed.name === 'string' && parsed.name) {
    return parsed.name.endsWith('.json') ? parsed.name : `${parsed.name}.json`;
  }
  if (typeof parsed.email === 'string' && parsed.email) {
    return `${parsed.email.split('@')[0]}-auth.json`;
  }
  return 'pasted-auth.json';
}

export function resolveCopiedAuthFileName(name: string, existingNames: readonly string[]): string {
  const normalizedName = normalizeAuthFileName(name);
  const stem = normalizedName.slice(0, -'.json'.length);
  const existingStems = existingNames.map((item) => normalizeAuthFileName(item).slice(0, -'.json'.length));
  const nextStem = resolveNumberedDuplicateTitle(stem, existingStems);
  return `${nextStem}.json`;
}

export function resolveNumberedDuplicateTitle(title: string, existingTitles: readonly string[]): string {
  const normalizedTitle = String(title || '').trim() || 'Untitled';
  const baseTitle = stripNumberedDuplicateSuffix(normalizedTitle);
  const occupied = new Set(existingTitles.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
  if (!occupied.has(normalizedTitle.toLowerCase())) {
    return normalizedTitle;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseTitle} #${index}`;
    if (!occupied.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${baseTitle} #${Date.now()}`;
}

export function resolveCopiedOpenAICompatibleProviderName(name: string, existingNames: readonly string[]): string {
  const normalizedName = String(name || '').trim() || 'openai-compatible';
  return resolveNumberedDuplicateTitle(normalizedName, existingNames);
}

function stripNumberedDuplicateSuffix(title: string): string {
  return title.replace(/\s+#\d+$/, '').trim() || title;
}

export function parseAccountCardImportPayload(parsed: unknown): ParsedAccountCardImport | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const payload = parsed as AccountCardImportPayload;
  if (payload.schema !== ACCOUNT_CARD_IMPORT_SCHEMA) {
    return null;
  }

  if (payload.credentialSource === 'api-key') {
    const apiKey = String(payload.codexAPIKey?.apiKey || '').trim();
    const baseUrl = String(payload.codexAPIKey?.baseUrl || '').trim();
    if (!apiKey || !baseUrl) {
      return null;
    }
    return {
      type: 'codex-api-key',
      label: String(payload.codexAPIKey?.label || payload.account?.displayName || '').trim(),
      apiKey,
      baseUrl,
      prefix: String(payload.codexAPIKey?.prefix || '').trim(),
      ...optionalMultiEndpointFields(payload.codexAPIKey),
    };
  }

  if (payload.credentialSource === 'openai-compatible') {
    const provider = payload.openAICompatibleProvider;
    const apiKeys = normalizeStringList([provider?.apiKey, ...(provider?.apiKeys ?? [])]);
    const apiKey = apiKeys[0] || '';
    const baseUrl = String(provider?.baseUrl || '').trim();
    if (!apiKey || !baseUrl) {
      return null;
    }
    return {
      type: 'openai-compatible',
      name: String(provider?.name || payload.account?.provider || payload.account?.displayName || '').trim(),
      apiKey,
      apiKeys,
      baseUrl,
      prefix: String(provider?.prefix || '').trim(),
      proxyUrl: String(provider?.proxyUrl || '').trim(),
      headers: normalizeHeaders(provider?.headers),
      models: normalizeModels(provider?.models),
      ...optionalMultiEndpointFields(provider),
    };
  }

  if (payload.credentialSource === 'auth-file') {
    const rawContent = payload.authFile?.content;
    if (rawContent === undefined || rawContent === null) {
      return null;
    }
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);
    const name = String(payload.authFile?.name || payload.account?.displayName || 'pasted-auth.json').trim();
    return {
      type: 'auth-file',
      name: name.endsWith('.json') ? name : `${name}.json`,
      content,
    };
  }

  return null;
}

export function parseAccountImportPayloads(parsed: unknown): ParsedAccountCardImport[] | null {
  const items: ParsedAccountCardImport[] = [];

  function collect(value: unknown): boolean {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return false;
      }
      return value.every((item) => collect(item));
    }

    const item = parseSingleAccountImportPayload(value);
    if (!item) {
      return false;
    }
    items.push(item);
    return true;
  }

  return collect(parsed) ? items : null;
}

export function resolveAccountImportPayloadPreview(item: AccountImportPayloadItem): string {
  if (item.type === 'upload-file') {
    return normalizeAccountImportPreview(redactSensitiveAccountImportPreview(decodeBase64Text(item.contentBase64) || item.name));
  }
  if (item.type === 'auth-file') {
    return normalizeAccountImportPreview(redactSensitiveAccountImportPreview(item.content));
  }
  return normalizeAccountImportPreview(redactSensitiveAccountImportPreview(JSON.stringify(item, null, 2)));
}

export interface AccountImportQueueRenderWindow {
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  topOffset: number;
  totalHeight: number;
}

export function resolveAccountImportQueueRenderWindow({
  itemCount,
  scrollTop,
  viewportHeight,
  itemHeight = ACCOUNT_IMPORT_QUEUE_ITEM_HEIGHT,
  overscan = ACCOUNT_IMPORT_QUEUE_OVERSCAN,
}: {
  itemCount: number;
  scrollTop: number;
  viewportHeight: number;
  itemHeight?: number;
  overscan?: number;
}): AccountImportQueueRenderWindow {
  const safeItemCount = Math.max(0, Math.floor(itemCount));
  const safeItemHeight = Math.max(1, Math.floor(itemHeight));
  const safeViewportHeight = Math.max(safeItemHeight, Math.floor(viewportHeight));
  const safeScrollTop = Math.max(0, Math.floor(scrollTop));
  const safeOverscan = Math.max(0, Math.floor(overscan));

  if (safeItemCount === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      visibleCount: 0,
      topOffset: 0,
      totalHeight: 0,
    };
  }

  const firstVisibleIndex = Math.floor(safeScrollTop / safeItemHeight);
  const viewportItemCount = Math.ceil(safeViewportHeight / safeItemHeight);
  const startIndex = Math.max(0, firstVisibleIndex - safeOverscan);
  const endIndex = Math.min(safeItemCount, firstVisibleIndex + viewportItemCount + safeOverscan);

  return {
    startIndex,
    endIndex,
    visibleCount: endIndex - startIndex,
    topOffset: startIndex * safeItemHeight,
    totalHeight: safeItemCount * safeItemHeight,
  };
}

function parseSingleAccountImportPayload(parsed: unknown): ParsedAccountCardImport | null {
  const copiedAccount = parseAccountCardImportPayload(parsed);
  if (copiedAccount) {
    return copiedAccount;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.schema === ACCOUNT_CARD_IMPORT_SCHEMA) {
    return null;
  }

  return {
    type: 'auth-file',
    name: resolvePastedAuthFileName(payload),
    content: JSON.stringify(payload, null, 2),
  };
}

function normalizeAccountImportPreview(value: string, limit = 420): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '(empty)';
  }
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit).trimEnd()}…`;
}

function redactSensitiveAccountImportPreview(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(redactSensitiveAccountImportValue(parsed), null, 2);
  } catch {
    return trimmed
      .replace(/("(?:access_token|refresh_token|id_token|api[_-]?key|apiKey|OPENAI_API_KEY|ANTHROPIC_API_KEY|authorization)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
      .replace(/((?:access_token|refresh_token|id_token|api[_-]?key|apiKey|OPENAI_API_KEY|ANTHROPIC_API_KEY|authorization)=)[^&\s]+/gi, '$1[REDACTED]');
  }
}

function redactSensitiveAccountImportValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveAccountImportValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitiveAccountImportKey(key) ? '[REDACTED]' : redactSensitiveAccountImportValue(item);
  }
  return out;
}

function isSensitiveAccountImportKey(key: string) {
  return /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|openai_api_key|anthropic_api_key|authorization)/i.test(key);
}

function decodeBase64Text(value: string, maxBase64PreviewLength = 8192): string {
  try {
    const chunk = value.length > maxBase64PreviewLength ? value.slice(0, maxBase64PreviewLength) : value;
    const alignedChunk = chunk.length === value.length ? chunk : chunk.slice(0, chunk.length - (chunk.length % 4));
    if (!alignedChunk) {
      return '';
    }
    const binary = atob(alignedChunk);
    if (!binary) {
      return '';
    }
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function normalizeStringList(items: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function optionalMultiEndpointFields(input: unknown): {
  supportedFormats?: string[];
  formatBaseUrls?: Record<string, string>;
} {
  const source = input && typeof input === 'object' ? input as {
    supportedFormats?: unknown;
    formatBaseUrls?: unknown;
  } : {};
  const supportedFormats = normalizeStringList(Array.isArray(source.supportedFormats) ? source.supportedFormats : []);
  const formatBaseUrls = normalizeStringMap(source.formatBaseUrls);
  return {
    ...(supportedFormats.length > 0 ? { supportedFormats } : {}),
    ...(Object.keys(formatBaseUrls).length > 0 ? { formatBaseUrls } : {}),
  };
}

function normalizeStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const nextKey = String(key || '').trim();
    const nextValue = String(item || '').trim();
    if (nextKey && nextValue) {
      out[nextKey] = nextValue;
    }
  }
  return out;
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const nextKey = String(key || '').trim();
    const nextValue = String(value || '').trim();
    if (nextKey && nextValue) {
      out[nextKey] = nextValue;
    }
  }
  return out;
}

function normalizeModels(models: unknown): Array<{ name: string; alias?: string }> {
  if (!Array.isArray(models)) {
    return [];
  }
  const out: Array<{ name: string; alias?: string }> = [];
  const seen = new Set<string>();
  for (const model of models) {
    if (!model || typeof model !== 'object') {
      continue;
    }
    const item = model as { name?: unknown; alias?: unknown };
    const name = String(item.name || '').trim();
    const alias = String(item.alias || '').trim();
    const key = `${name}\x00${alias}`;
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(alias ? { name, alias } : { name });
  }
  return out;
}

function normalizeAuthFileName(name: string) {
  const trimmed = String(name || '').trim() || 'pasted-auth.json';
  return trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`;
}

export function buildAccountsExportFilename(date = new Date()) {
  return `gettokens-accounts-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}

export function encodeUTF8Base64(value: string) {
  return window.btoa(unescape(encodeURIComponent(value)));
}

export async function readUploadFiles(files: FileList | File[]) {
  const payloads = await Promise.all(Array.from(files).map((file) => readUploadFile(file)));
  return payloads.flat();
}

async function readUploadFile(file: File): Promise<AccountImportPayloadItem[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isArchiveUploadFile(file, bytes)) {
    return readArchiveJSONFiles(bytes, file.name);
  }
  return createImportPayloadsFromBytes(file.name, bytes);
}

export async function readArchiveJSONFiles(bytes: Uint8Array, archiveName: string): Promise<AccountImportPayloadItem[]> {
  const normalizedName = archiveName.toLowerCase();
  if (isZipArchiveBytes(bytes) || normalizedName.endsWith('.zip')) {
    return readZipArchiveJSONFiles(bytes, archiveName);
  }
  if (isGzipArchiveBytes(bytes) || isGzipArchiveName(normalizedName)) {
    return readGzipArchiveJSONFiles(bytes, archiveName);
  }
  if (isTarArchiveName(normalizedName) || isTarArchiveBytes(bytes)) {
    return readTarArchiveJSONFiles(bytes, archiveName);
  }
  return [];
}

export async function readZipArchiveJSONFiles(bytes: Uint8Array, archiveName: string): Promise<AccountImportPayloadItem[]> {
  const entries = Object.entries(await unzipArchive(bytes))
    .filter(([name]) => isImportableArchiveJSONEntry(name))
    .slice(0, ARCHIVE_JSON_ENTRY_LIMIT);
  return createArchiveEntryImportPayloads(archiveName, entries);
}

export async function readGzipArchiveJSONFiles(bytes: Uint8Array, archiveName: string): Promise<AccountImportPayloadItem[]> {
  const content = gunzipSync(bytes);
  const entryName = resolveGzipEntryName(archiveName);
  if (isTarArchiveName(entryName.toLowerCase()) || isTarArchiveBytes(content)) {
    return readTarArchiveJSONFiles(content, archiveName);
  }
  if (!isImportableArchiveJSONEntry(entryName) && !looksLikeJSONBytes(content)) {
    return [];
  }
  return createImportPayloadsFromBytes(
    resolveArchiveEntryUploadName(archiveName, entryName.endsWith('.json') ? entryName : `${entryName}.json`),
    content,
  );
}

export async function readTarArchiveJSONFiles(bytes: Uint8Array, archiveName: string): Promise<AccountImportPayloadItem[]> {
  const entries: AccountImportPayloadItem[] = [];
  let offset = 0;
  let pendingLongName = '';

  while (offset + TAR_BLOCK_SIZE <= bytes.length && entries.length < ARCHIVE_JSON_ENTRY_LIMIT) {
    const header = bytes.slice(offset, offset + TAR_BLOCK_SIZE);
    offset += TAR_BLOCK_SIZE;
    if (isZeroTarBlock(header)) {
      break;
    }

    const size = parseTarOctal(header, 124, 12);
    const typeFlag = String.fromCharCode(header[156] || 0);
    const rawName = pendingLongName || readTarEntryName(header);
    pendingLongName = '';
    const dataStart = offset;
    const dataEnd = Math.min(bytes.length, dataStart + size);
    const content = bytes.slice(dataStart, dataEnd);
    offset += Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;

    if (typeFlag === 'L') {
      pendingLongName = decodeTarText(content).replace(/\0+$/g, '').trim();
      continue;
    }
    if (typeFlag && typeFlag !== '0' && typeFlag !== '\0') {
      continue;
    }
    if (!isImportableArchiveJSONEntry(rawName)) {
      continue;
    }
    entries.push(...createImportPayloadsFromBytes(resolveArchiveEntryUploadName(archiveName, rawName), content));
  }

  return entries;
}

function isArchiveUploadFile(file: File, bytes: Uint8Array) {
  const name = file.name.toLowerCase();
  return (
    isZipArchiveBytes(bytes)
    || isGzipArchiveBytes(bytes)
    || isTarArchiveBytes(bytes)
    || name.endsWith('.zip')
    || isGzipArchiveName(name)
    || isTarArchiveName(name)
  );
}

function isZipArchiveBytes(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isGzipArchiveBytes(bytes: Uint8Array) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isGzipArchiveName(name: string) {
  return name.endsWith('.gz') || name.endsWith('.gzip') || name.endsWith('.tgz') || name.endsWith('.tar.gz');
}

function isTarArchiveName(name: string) {
  return name.endsWith('.tar') || name.endsWith('.tar.gz') || name.endsWith('.tgz');
}

function isTarArchiveBytes(bytes: Uint8Array) {
  return bytes.length > 265
    && bytes[257] === 0x75
    && bytes[258] === 0x73
    && bytes[259] === 0x74
    && bytes[260] === 0x61
    && bytes[261] === 0x72;
}

function resolveArchiveEntryUploadName(archiveName: string, entryName: string) {
  const archive = String(archiveName || 'archive').trim() || 'archive';
  const normalizedEntry = String(entryName || 'entry.json').replace(/^\/+/, '').trim() || 'entry.json';
  return `${archive}:${normalizedEntry}`;
}

function isImportableArchiveJSONEntry(name: string) {
  const normalizedName = String(name || '').replace(/^\/+/, '');
  return Boolean(
    normalizedName
    && !normalizedName.endsWith('/')
    && !normalizedName.startsWith('__MACOSX/')
    && normalizedName.toLowerCase().endsWith('.json')
  );
}

function resolveGzipEntryName(archiveName: string) {
  const trimmed = String(archiveName || 'archive.json.gz').trim() || 'archive.json.gz';
  return trimmed
    .replace(/\.tar\.gz$/i, '.tar')
    .replace(/\.tgz$/i, '.tar')
    .replace(/\.gzip$/i, '')
    .replace(/\.gz$/i, '') || 'archive.json';
}

function readTarEntryName(header: Uint8Array) {
  const name = decodeTarText(header.slice(0, 100)).replace(/\0+$/g, '').trim();
  const prefix = decodeTarText(header.slice(345, 500)).replace(/\0+$/g, '').trim();
  return prefix ? `${prefix}/${name}` : name;
}

function parseTarOctal(header: Uint8Array, start: number, length: number) {
  const text = decodeTarText(header.slice(start, start + length)).replace(/\0.*$/g, '').trim();
  const value = Number.parseInt(text || '0', 8);
  return Number.isFinite(value) ? value : 0;
}

function isZeroTarBlock(block: Uint8Array) {
  return block.every((byte) => byte === 0);
}

function decodeTarText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function looksLikeJSONBytes(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes.slice(0, 1024)).trimStart();
  return text.startsWith('{') || text.startsWith('[');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function createArchiveEntryImportPayloads(
  archiveName: string,
  entries: Array<[string, Uint8Array]>,
): Promise<AccountImportPayloadItem[]> {
  const payloads: AccountImportPayloadItem[] = [];
  for (const [name, content] of entries) {
    if (payloads.length > 0 && payloads.length % 50 === 0) {
      await yieldToEventLoop();
    }
    payloads.push(...createImportPayloadsFromBytes(resolveArchiveEntryUploadName(archiveName, name), content));
  }
  return payloads;
}

function createImportPayloadsFromBytes(name: string, bytes: Uint8Array): AccountImportPayloadItem[] {
  const text = new TextDecoder().decode(bytes);
  try {
    const parsed = JSON.parse(text);
    const items = parseAccountImportPayloads(parsed);
    if (items?.length) {
      return items;
    }
  } catch {
    // Fall through to raw upload fallback.
  }
  return [{ type: 'upload-file', name, contentBase64: bytesToBase64(bytes) }];
}

function unzipArchive(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function validateAccountImportPayloadItem(item: AccountImportPayloadItem): { valid: boolean; error?: string } {
  if (!item) {
    return { valid: false, error: 'Empty item' };
  }
  if (item.type === 'upload-file') {
    if (!item.name.trim()) {
      return { valid: false, error: 'Name is required' };
    }
    if (!item.contentBase64) {
      return { valid: false, error: 'File content is empty' };
    }
    return { valid: true };
  }
  if (item.type === 'auth-file') {
    if (!item.name.trim()) {
      return { valid: false, error: 'Name is required' };
    }
    if (!item.content.trim()) {
      return { valid: false, error: 'Content is required' };
    }
    try {
      JSON.parse(item.content);
    } catch {
      return { valid: false, error: 'Invalid JSON format' };
    }
    return { valid: true };
  }
  if (item.type === 'codex-api-key') {
    if (!item.apiKey.trim()) {
      return { valid: false, error: 'API Key is required' };
    }
    if (!item.baseUrl.trim()) {
      return { valid: false, error: 'Base URL is required' };
    }
    return { valid: true };
  }
  if (item.type === 'openai-compatible') {
    if (!item.name.trim()) {
      return { valid: false, error: 'Provider Name is required' };
    }
    if (!item.apiKey.trim()) {
      return { valid: false, error: 'API Key is required' };
    }
    if (!item.baseUrl.trim()) {
      return { valid: false, error: 'Base URL is required' };
    }
    return { valid: true };
  }
  return { valid: false, error: 'Unknown type' };
}
