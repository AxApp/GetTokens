export interface UploadFilePayload {
  name: string;
  contentBase64: string;
}

export const ACCOUNT_CARD_IMPORT_SCHEMA = 'gettokens.account-card.v1';

export interface AccountCardImportPayload {
  schema: typeof ACCOUNT_CARD_IMPORT_SCHEMA;
  credentialSource: 'auth-file' | 'api-key';
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
    };

export function resolvePastedAuthFileName(parsed: Record<string, unknown>) {
  if (typeof parsed.name === 'string' && parsed.name) {
    return parsed.name.endsWith('.json') ? parsed.name : `${parsed.name}.json`;
  }
  if (typeof parsed.email === 'string' && parsed.email) {
    return `${parsed.email.split('@')[0]}-auth.json`;
  }
  return 'pasted-auth.json';
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
