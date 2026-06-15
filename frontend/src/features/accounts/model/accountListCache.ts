import type { AccountRecord, ApiFormat, CredentialSource } from '../../../types';

export const ACCOUNT_LIST_CACHE_STORAGE_KEY = 'gettokens.accounts.list-cache';

interface StoredAccountListCache {
  version?: number;
  updatedAt?: number;
  items?: unknown[];
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function readStoredAccountRecords(
  storage: ReadableStorage | null | undefined,
): AccountRecord[] {
  try {
    const raw = storage?.getItem(ACCOUNT_LIST_CACHE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredAccountListCache;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items.map(normalizeStoredAccountRecord).filter((item): item is AccountRecord => item !== null);
  } catch {
    return [];
  }
}

export function persistStoredAccountRecords(
  storage: WritableStorage | null | undefined,
  accounts: AccountRecord[],
): void {
  try {
    storage?.setItem(
      ACCOUNT_LIST_CACHE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        updatedAt: Date.now(),
        items: accounts.map(toStoredAccountRecord).filter((item): item is AccountRecord => item !== null),
      } satisfies StoredAccountListCache),
    );
  } catch {
    // The account list cache is only a first-paint convenience.
  }
}

function normalizeStoredAccountRecord(value: unknown): AccountRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const item = value as Partial<AccountRecord>;
  const id = stringValue(item.id);
  const provider = stringValue(item.provider);
  const displayName = stringValue(item.displayName);
  if (!id || !provider || !displayName) {
    return null;
  }

  const credentialSource = normalizeCredentialSource(item.credentialSource);
  if (!credentialSource) {
    return null;
  }

  return toStoredAccountRecord({
    ...item,
    id,
    provider,
    credentialSource,
    displayName,
    status: stringValue(item.status) || 'ACTIVE',
  } as AccountRecord);
}

function toStoredAccountRecord(account: AccountRecord): AccountRecord | null {
  const id = stringValue(account.id);
  const provider = stringValue(account.provider);
  const displayName = stringValue(account.displayName);
  const credentialSource = normalizeCredentialSource(account.credentialSource);
  if (!id || !provider || !displayName || !credentialSource) {
    return null;
  }

  return {
    id,
    accountKind: optionalString(account.accountKind),
    provider,
    credentialSource,
    displayName,
    status: stringValue(account.status) || 'ACTIVE',
    statusMessage: optionalString(account.statusMessage),
    runtimeStatus: optionalString(account.runtimeStatus),
    runtimeReason: optionalString(account.runtimeReason),
    runtimeFailureClass: optionalString(account.runtimeFailureClass),
    routeable: optionalBoolean(account.routeable),
    registeredModelCount: optionalNumber(account.registeredModelCount),
    runtimeRepairTriggerClass: optionalString(account.runtimeRepairTriggerClass),
    priority: optionalNumber(account.priority),
    disabled: optionalBoolean(account.disabled),
    email: optionalString(account.email),
    planType: optionalString(account.planType),
    name: optionalString(account.name),
    keyFingerprint: optionalString(account.keyFingerprint),
    keySuffix: optionalString(account.keySuffix),
    baseUrl: optionalString(account.baseUrl),
    prefix: optionalString(account.prefix),
    proxyUrl: optionalString(account.proxyUrl),
    quotaKey: optionalString(account.quotaKey),
    quotaEnabled: optionalBoolean(account.quotaEnabled),
    localOnly: optionalBoolean(account.localOnly),
    supportedFormats: normalizeSupportedFormats(account.supportedFormats),
    formatBaseUrls: normalizeFormatBaseUrls(account.formatBaseUrls),
    models: normalizeModels(account.models),
    billingEnabled: optionalBoolean(account.billingEnabled),
    requestability: normalizeRequestability(account.requestability),
  };
}

function normalizeCredentialSource(value: unknown): CredentialSource | null {
  return value === 'api-key' || value === 'auth-file' ? value : null;
}

function normalizeSupportedFormats(value: unknown): ApiFormat[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const formats = value.map((item) => stringValue(item)).filter(Boolean) as ApiFormat[];
  return formats.length > 0 ? formats : undefined;
}

function normalizeFormatBaseUrls(value: unknown): AccountRecord['formatBaseUrls'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => [stringValue(key), stringValue(rawValue)] as const)
    .filter(([key, rawValue]) => key && rawValue);
  return entries.length > 0 ? Object.fromEntries(entries) as AccountRecord['formatBaseUrls'] : undefined;
}

function normalizeModels(value: unknown): AccountRecord['models'] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const models = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const name = stringValue((item as { name?: unknown }).name);
      if (!name) {
        return null;
      }
      const alias = optionalString((item as { alias?: unknown }).alias);
      return alias ? { name, alias } : { name };
    })
    .filter((item): item is { name: string; alias?: string } => item !== null);
  return models.length > 0 ? models : undefined;
}

function normalizeRequestability(value: unknown): AccountRecord['requestability'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const manual = optionalBoolean((value as { manual?: unknown }).manual);
  const evidence = Array.isArray((value as { evidence?: unknown }).evidence)
    ? (value as { evidence: unknown[] }).evidence.map((item) => stringValue(item)).filter(Boolean)
    : undefined;
  if (manual === undefined && (!evidence || evidence.length === 0)) {
    return undefined;
  }
  return {
    manual,
    evidence: evidence && evidence.length > 0 ? evidence : undefined,
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
  const normalized = stringValue(value);
  return normalized || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
