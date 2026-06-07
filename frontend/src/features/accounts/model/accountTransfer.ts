export interface UploadFilePayload {
  name: string;
  contentBase64: string;
}

export const ACCOUNT_CARD_IMPORT_SCHEMA = 'gettokens.account-card.v1';

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

export async function readUploadFiles(files: FileList) {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<UploadFilePayload>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
              reject(new Error('文件读取失败'));
              return;
            }

            const marker = 'base64,';
            const base64Index = result.indexOf(marker);
            resolve({
              name: file.name,
              contentBase64: base64Index >= 0 ? result.slice(base64Index + marker.length) : result,
            });
          };

          reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
          reader.readAsDataURL(file);
        })
    )
  );
}
